"use client";

/**
 * ImportStructureStage — the Structure stage, inside the shell. (Slice #26.04)
 *
 * WHAT THE SCREEN IS FOR
 * ──────────────────────
 * #26.01 wrote the rules and #26.02 wrote the validator; neither was on screen.
 * This is the screen, and it is one component for the whole loop rather than
 * two — "here are the rules, choose a folder" and "here is what is wrong with
 * it" are the same conversation seen at two moments, and splitting them would
 * mean two copies of the tick, the picker and the save button.
 *
 * THE TICK IS A GATE, AND IT IS RE-ASKED EVERY ROUND
 * ──────────────────────────────────────────────────
 * "Respect regulile de structură" must be ticked before the folder can be
 * chosen, and — the part that is easy to miss in the brief — it comes back
 * unticked after every check, beside a button that now reads "Verifică din
 * nou". The wizard clears it at the start of each walk, so this component never
 * has to remember to.
 *
 * That is not ceremony. The loop's failure mode is a user who presses the
 * button, sees the same list, presses it again and concludes the system is
 * broken — without having gone to File Explorer at all. Re-ticking is the one
 * thing between the two presses that says "I have made a change". It costs a
 * click and it is the only signal available, since the browser cannot tell us
 * whether Explorer was ever opened.
 *
 * WHAT IS DISPLAYED, AND WHAT IS COMPLETE
 * ───────────────────────────────────────
 * Every violation names its culprit — the path, from the chosen folder inclusive
 * (`displayPathOf`), because that is what the user types into Explorer. The
 * `related` paths are truncated on screen at four, exactly as the folder report
 * truncates its findings, and NOT truncated in the saved page. That split is
 * #26.01's contract restated: `related` is complete, and truncation is the
 * renderer's decision.
 *
 * THE TRUNCATED WALK BLOCKS, AND SAYS SO SEPARATELY
 * ─────────────────────────────────────────────────
 * `checkStructureStage` refuses to call a folder clean while the walk gave up
 * part-way (see its own note for why). It is drawn as its own block rather than
 * as a violation, because it has no rule ID, no rename to perform and a remedy
 * of a different kind — and because a business user reading "STR-nn" beside it
 * would go looking for a rule that does not exist.
 */

import { useCallback, useEffect, useId, useMemo, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";

import { ActivityCue } from "@/components/activity-cue";
import { buttonClass } from "@/lib/ui/button-styles";
import { buildStructureHtml, reportFileName } from "@/lib/import/report-html";
import { downloadHtmlFile, fileNameStamp } from "@/lib/ui/download-html";
import { displayPathOf, type StructureVerdict } from "@/lib/import/structure-check";
import {
  RULE_SCOPES,
  messageKeyFor,
  ruleListingValues,
  rulesInScope,
  scopeKeyFor,
} from "@/lib/import/structure-rules";
import { COST_NOTE_CLASS } from "./folder-forecast";

/** How many related paths one violation shows before it stops listing them. */
const MAX_PATHS_SHOWN = 4;

type Props = {
  /**
   * `null` until a folder has been walked in this run — the state in which the
   * rules are the whole content of the screen.
   */
  verdict: StructureVerdict | null;
  /** `""` until a folder has been picked. */
  folderName: string;
  /** A walk is running right now: every button that starts one is inert. */
  busy: boolean;
  /**
   * Already-translated cue text for that walk — "reading the folder", or the
   * metadata pass's running count once the structure has passed and the
   * expensive half begins.
   *
   * Passed in rather than owned here because both sentences already exist in
   * `adminImport.wizard`, where the toolbar used to show them. #26.04 moved the
   * cue into this panel (the `walking` phase is now always a Structure phase,
   * so the toolbar's copy could only ever be a duplicate) without moving the
   * strings, which would have been a rename with no reader.
   */
  busyLabel: string;
  acknowledged: boolean;
  onAcknowledgedChange: (next: boolean) => void;
  onChooseFolder: () => void;
  onRecheck: () => void;
  /**
   * The rules disclosure, hoisted into the wizard for the same reason the
   * folder report's two disclosures are: this subtree re-renders on every turn
   * of the loop, and a user who opened the rules to read them alongside their
   * fix list must not have them shut on the next check.
   */
  rulesOpen: boolean;
  onRulesOpenChange: (open: boolean) => void;
};

export function ImportStructureStage({
  verdict,
  folderName,
  busy,
  busyLabel,
  acknowledged,
  onAcknowledgedChange,
  onChooseFolder,
  onRecheck,
  rulesOpen,
  onRulesOpenChange,
}: Props) {
  const t = useTranslations("adminImport.structure");
  // Unnamespaced, so `messageKeyFor` and `scopeKeyFor` can be used as written.
  // Those two functions exist precisely so the message path is not spelled out
  // in a component; reaching for a namespace here would spell half of it again.
  const tk = useTranslations();
  const locale = useLocale();
  const checkboxId = useId();
  const hintId = useId();

  const checked = verdict !== null;
  const showRules = !checked || rulesOpen;

  /**
   * How many rules the last check found broken. Counted here because three
   * places ask, and `verdict?.violations?.length ?? 0` inline is the sort of
   * expression that gets one of the three wrong later.
   *
   * ⚠️ A NUMBER, not the array, and never a dependency. `?? []` mints a fresh
   * array on every render the verdict is null, so a `useMemo` that depended on
   * one re-ran every render and re-translated every violation sentence —
   * `react-hooks/exhaustive-deps` says so out loud. The two memos below read
   * `verdict` and default inside their own callbacks instead: one dependency,
   * and it changes only when a walk finishes.
   */
  const violationCount = verdict?.violations.length ?? 0;

  /**
   * The rules, grouped and translated once — used by the screen and by the
   * saved page, so the two can never list different rules or word them
   * differently.
   */
  const sections = useMemo(
    () =>
      RULE_SCOPES.map((scope) => ({
        scope,
        heading: tk(scopeKeyFor(scope)),
        rules: rulesInScope(scope).map((rule) => ({
          id: rule.id,
          requirement: tk(messageKeyFor(rule.id, "requirement"), ruleListingValues(rule.id)),
          example: tk(messageKeyFor(rule.id, "example"), ruleListingValues(rule.id)),
        })),
      })),
    [tk],
  );

  /** One sentence per violation, rendered from the rule's own message. */
  const renderedViolations = useMemo(
    () =>
      (verdict?.violations ?? []).map((v) => ({
        ruleId: v.ruleId,
        culprit: displayPathOf(folderName, v.culprit),
        sentence: tk(messageKeyFor(v.ruleId, "violation"), { ...v.counts, ...v.values }),
        related: v.related.map((p) => displayPathOf(folderName, p)),
      })),
    [verdict, folderName, tk],
  );

  const renderedWarnings = useMemo(
    () =>
      (verdict?.truncations ?? []).map((group) => ({
        // `count` is the number of directories the limit stopped, which is not
        // `paths.length` — see `StructureTruncationGroup`. The sentence has to
        // quote the total or it under-reports a 15,000-folder refusal as ten.
        heading: t(`truncated.${group.limit}`, { count: group.count }),
        paths: group.paths.map((p) => displayPathOf(folderName, p)),
        total: group.count,
      })),
    [verdict, folderName, t],
  );

  /**
   * The take-away page. Everything user-facing is translated HERE and handed
   * over as plain strings — `report-html.ts` must not become a second place
   * Romanian lives, which is the same rule the folder report follows.
   */
  const handleSave = useCallback(() => {
    const now = new Date();

    /**
     * The folder this page is ABOUT, or null when it is the rules alone.
     *
     * ⚠️ `folderName` is set the moment the OS picker returns, not when the
     * walk succeeds — so after a failed pick (the folder was on a USB stick
     * that has since been unplugged) it holds a name nothing was ever read
     * from. Printing it would put "Folder: Arhiva 2025" three lines above "no
     * folder has been checked yet", and the page would contradict itself in
     * its own header.
     *
     * Computed once and used for the FILENAME too, which is where the first
     * version of this fix stopped: the body said "no folder has been checked"
     * while the download was called `structura-import-Arhiva-2025-….html`, and
     * the filename is the part that survives in File Explorer.
     */
    const namedFolder = checked && folderName !== "" ? folderName : null;

    const html = buildStructureHtml({
      folderName: namedFolder,
      generatedAt: now.toLocaleString(locale),
      locale,
      sections: sections.map((s) => ({ heading: s.heading, rules: s.rules })),
      // `null`, not `[]`, when nothing has been checked: "we looked and found
      // nothing" and "we have not looked" are different pages, and printing
      // the all-clear for the second is the confident-output failure this
      // codebase keeps a rule about.
      violations: checked ? renderedViolations : null,
      // NOT an empty violation list, which the exporter would otherwise have
      // to infer. A truncated walk breaks no rule and is refused anyway, and
      // the all-clear printed for that case is green, affirmative and wrong.
      clean: verdict?.clean ?? false,
      warnings: renderedWarnings,
      strings: {
        documentTitle: t("save.documentTitle"),
        generatedAt: t("save.generatedAt"),
        folderLabel: t("save.folderLabel"),
        rulesTitle: t("save.rulesTitle"),
        violationsTitle: t("save.violationsTitle"),
        allClear: t("save.allClear"),
        blocked: t("save.blocked"),
        notCheckedYet: t("save.notCheckedYet"),
        warningsTitle: t("save.warningsTitle"),
      },
    });

    downloadHtmlFile(
      html,
      // `save.rulesOnlyName` rather than letting `reportFileName` fall back:
      // its fallback is the literal "import", so a rules-only page would
      // download as `structura-import-import-….html`. The page really is just
      // the rules, and the filename may as well say so.
      reportFileName(
        t("save.filePrefix"),
        namedFolder ?? t("save.rulesOnlyName"),
        fileNameStamp(now),
      ),
    );
  }, [checked, folderName, locale, renderedViolations, renderedWarnings, sections, t, verdict]);

  /**
   * The one live region on this panel, always mounted, so a screen-reader user
   * hears the RESULT of each round of the loop. The stage indicator's own
   * region announces which stage they are in, and that does not change from one
   * round to the next, so it cannot carry this.
   *
   * Deliberately EMPTY while the check runs: `ActivityCue` is itself a
   * `role="status"`, and two live regions announcing the same sentence read it
   * twice. This one speaks only when the answer arrives.
   *
   * ⚠️ THE TRUNCATION BRANCH IS NOT A TIDY-UP. Without it, the case
   * `checkStructureStage` was written for — the walk gave up, so the folder is
   * blocked, but no rule was actually broken — falls through to the violation
   * count and announces "0 lucruri de îndreptat" over a folder that cannot
   * proceed. The visible list is correctly hidden at zero, so the lie would
   * have been audible only, which is exactly how it would have survived.
   *
   * ⚠️ AND A CLEAN VERDICT SAYS NOTHING HERE, on purpose. It is the one round
   * that ends the loop, and this region cannot be what carries it: a passing
   * check unmounts this whole panel in the same commit that sets the phase to
   * `folder-report`, so any string put here would be removed before an
   * assistive technology read it. What actually announces success is the stage
   * indicator's own live region moving to the next stage — which is the truer
   * sentence anyway, because "Structure is clean" and "you are now on
   * Evaluation" are the same event and only one of them needs saying.
   */
  const liveSummary =
    busy || verdict === null || verdict.clean
      ? ""
      : violationCount === 0
        ? t("truncated.title")
        : t("violationsTitle", { count: violationCount });

  /**
   * Give the keyboard back when a round of the loop ends.
   *
   * The tick is cleared at the start of every walk, which DISABLES the button
   * the user just pressed — and a disabled element cannot hold focus, so the
   * browser drops it to `<body>`. Nothing puts it back, because the button
   * stays disabled until the tick returns: a keyboard user would have to tab in
   * from the top of the page on every single round of a loop designed to be
   * gone round several times.
   *
   * The checkbox is the right target rather than the button, because it is
   * literally the next thing the user has to do.
   *
   * Fires only on the busy → idle edge, so it cannot steal focus on mount or on
   * an unrelated re-render — and when the check PASSES this component unmounts
   * instead, so it never fires on the way to the next stage.
   *
   * ⚠️ **RESTORES focus; it does not seize it.** A check takes seconds on a
   * large archive, and the sensible thing to do while waiting is to open the
   * rules and read them, or press Save. Focus is only put back when it is on
   * nothing at all — `<body>`, which is where the browser drops it — because
   * moving it out of a list the user chose to read, and scrolling the panel to
   * the bottom to do it, is a worse bug than the one this fixes.
   */
  const checkboxRef = useRef<HTMLInputElement | null>(null);
  const wasBusy = useRef(false);
  useEffect(() => {
    const finished = wasBusy.current && !busy;
    wasBusy.current = busy;
    if (!finished) return;
    const active = typeof document === "undefined" ? null : document.activeElement;
    const stranded = active === null || active === document.body;
    if (stranded) checkboxRef.current?.focus();
  }, [busy]);

  return (
    <section className="rounded-xl border border-card-rim bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
      <p role="status" className="sr-only">
        {liveSummary}
      </p>

      <h2 className="text-lg font-semibold text-ink dark:text-zinc-100">{t("title")}</h2>
      <p className="mt-1.5 text-sm text-ink dark:text-zinc-300">{t("intro")}</p>

      {/*
        `aria-busy` says "what you are reading is being recomputed" for the
        moment a check is in flight, during which the previous round's list is
        still on screen. Not an opacity change: this codebase records that
        fading a coloured panel lowers its contrast multiplicatively, and the
        list being faded would be the one the user is trying to read.

        ⚠️ Scoped to the RESULTS, not to the whole panel, and the difference is
        a silent screen reader. `aria-busy="true"` holds back live-region
        updates anywhere in its subtree — and the running cue below is an
        `ActivityCue`, i.e. a `role="status"` that exists only while `busy` is
        true and unmounts the instant it clears. Inside a busy section its
        announcement would be deferred until there was nothing left to
        announce, so the walk would pass in complete silence. It is the only
        cue there is: the toolbar's copy was deleted in this same slice.
      */}
      <div aria-busy={busy}>

      {/* ── What the walk could not read ─────────────────────────────────── */}
      {renderedWarnings.length > 0 && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950/30">
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">
            {t("truncated.title")}
          </h3>
          <p className="mt-1 text-sm text-red-800 dark:text-red-300">{t("truncated.intro")}</p>
          {renderedWarnings.map((w) => (
            <div key={w.heading} className="mt-2">
              <p className="text-sm text-red-800 dark:text-red-300">{w.heading}</p>
              <PathList paths={w.paths} total={w.total} />
            </div>
          ))}
        </div>
      )}

      {/* ── The fix list ─────────────────────────────────────────────────── */}
      {checked && violationCount > 0 && (
        <>
          <h3 className="mt-5 text-sm font-semibold text-ink dark:text-zinc-100">
            {t("violationsTitle", { count: violationCount })}
          </h3>
          <ul className="mt-2 space-y-2">
            {renderedViolations.map((v) => (
              <li
                key={`${v.ruleId}-${v.culprit}`}
                className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-700/60 dark:bg-amber-950/30"
              >
                <div className="flex items-baseline gap-2">
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-400">
                    {v.ruleId}
                  </span>
                  {/* The culprit, named — the line the user takes to Explorer. */}
                  <p
                    className="min-w-0 break-all font-mono text-xs font-semibold text-ink dark:text-zinc-100"
                    title={v.culprit}
                  >
                    {v.culprit}
                  </p>
                </div>
                <p className="mt-1 text-sm text-ink dark:text-zinc-100">{v.sentence}</p>
                <PathList paths={v.related} />
              </li>
            ))}
          </ul>
          <p className={`mt-3 ${COST_NOTE_CLASS}`}>{t("fixInstructions")}</p>
        </>
      )}

      {verdict !== null && verdict.clean && (
        <p className="mt-4 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          {t("clean")}
        </p>
      )}

      </div>

      {/* ── The rules ────────────────────────────────────────────────────── */}
      {checked && (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => onRulesOpenChange(!rulesOpen)}
            aria-expanded={rulesOpen}
            className="text-sm font-medium text-cta underline-offset-2 hover:underline"
          >
            {rulesOpen ? t("hideRules") : t("showRules")}
          </button>
        </div>
      )}

      {showRules && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-ink dark:text-zinc-100">
            {t("rulesTitle")}
          </h3>
          {sections.map((section) => (
            <div key={section.scope} className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-fade dark:text-zinc-400">
                {section.heading}
              </p>
              <ul className="mt-1.5 space-y-2">
                {section.rules.map((rule) => (
                  <li
                    key={rule.id}
                    className="border-b border-crease pb-2 last:border-0 dark:border-zinc-800"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-fade">
                        {rule.id}
                      </span>
                      <p className="text-sm text-ink dark:text-zinc-200">{rule.requirement}</p>
                    </div>
                    <p className="mt-0.5 pl-1 text-xs italic text-fade dark:text-zinc-400">
                      {rule.example}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* ── The gate ─────────────────────────────────────────────────────── */}
      <div className="mt-5 border-t border-crease pt-4 dark:border-zinc-800">
        <div className="flex items-start gap-2">
          <input
            id={checkboxId}
            ref={checkboxRef}
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => onAcknowledgedChange(e.target.checked)}
            aria-describedby={hintId}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-wire accent-cta"
          />
          <label
            htmlFor={checkboxId}
            className="text-sm font-medium text-ink dark:text-zinc-200"
          >
            {t("acknowledge")}
          </label>
        </div>
        <p id={hintId} className="mt-1 pl-6 text-xs text-fade dark:text-zinc-400">
          {t("acknowledgeHint")}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={checked ? onRecheck : onChooseFolder}
            disabled={!acknowledged || busy}
            className={buttonClass({ variant: "primary", size: "lg" })}
          >
            {checked ? t("recheck") : t("chooseFolder")}
          </button>

          {/* The folder may simply be the wrong one. Gated on the same tick,
              because it starts the same check. */}
          {checked && (
            <button
              type="button"
              onClick={onChooseFolder}
              disabled={!acknowledged || busy}
              className={buttonClass({ variant: "secondary", size: "md" })}
            >
              {t("chooseAnotherFolder")}
            </button>
          )}

          {busy && <ActivityCue>{busyLabel}</ActivityCue>}
        </div>
      </div>

      {/* ── The take-away copy ───────────────────────────────────────────── */}
      <div className="mt-5 border-t border-crease pt-4 dark:border-zinc-800">
        <button
          type="button"
          onClick={handleSave}
          className={buttonClass({ variant: "secondary", size: "md" })}
        >
          {t("save.button")}
        </button>
        <p className="mt-1.5 text-xs text-fade dark:text-zinc-400">{t("save.hint")}</p>
      </div>
    </section>
  );
}

/**
 * The evidence under one violation, truncated for the screen only.
 *
 * The saved page prints all of it — see the module header, and #26.01's note on
 * `related` being complete by contract.
 *
 * `total` exists for the one list that is ALREADY a sample before it gets here:
 * a truncation group names at most ten directories out of a count that can run
 * to thousands (`StructureTruncationGroup`). Counting the overflow from
 * `paths.length` there would report "…and 6 more" over 15,000 unread folders.
 */
function PathList({ paths, total }: { paths: readonly string[]; total?: number }) {
  const t = useTranslations("adminImport.structure");
  if (paths.length === 0) return null;

  const shown = paths.slice(0, MAX_PATHS_SHOWN);
  const hidden = (total ?? paths.length) - shown.length;

  return (
    <ul className="mt-1.5 space-y-0.5 pl-1">
      {shown.map((p) => (
        <li
          key={p}
          className="truncate font-mono text-xs text-fade dark:text-zinc-500"
          title={p}
        >
          {p}
        </li>
      ))}
      {hidden > 0 && <li className="text-xs italic text-fade">{t("morePaths", { count: hidden })}</li>}
    </ul>
  );
}
