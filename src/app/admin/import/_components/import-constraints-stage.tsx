"use client";

/**
 * ImportConstraintsStage — the Constraints stage, inside the shell. (Slice #26.05)
 *
 * WHAT THE SCREEN IS FOR
 * ──────────────────────
 * Structure has passed, so the folder is shaped correctly and the files in it
 * are the ones that will be imported. This stage asks the next question: will
 * each of those files actually survive the import — and it asks it BEFORE
 * anything is spent, while the user still has File Explorer open from the last
 * stage.
 *
 * DELIBERATELY THE SAME SHAPE AS `ImportStructureStage`
 * ─────────────────────────────────────────────────────
 * Rules, a tick, a check, a fix list, a re-check, and a page you can save. The
 * source document asks for "the same loop" in as many words, and the value of
 * that is not code reuse — it is that the second loop costs the user nothing to
 * learn. So the two components are siblings rather than one abstraction: they
 * share `report-html.ts`, `displayPathOf` and the message-key helpers, and
 * everything that differs between them is visible here rather than hidden
 * behind a prop.
 *
 * WHAT DIFFERS, AND WHY
 * ─────────────────────
 *  - **There is no first "choose folder".** The folder was chosen at Structure
 *    and re-checking must not require re-picking it (#26.04's constraint, still
 *    in force). The primary button is the check, from the very first press.
 *    "Alege alt folder…" is still offered, because the folder may simply be the
 *    wrong one — and it re-enters at Structure, which is honest: a new folder
 *    has not passed the structure rules.
 *  - **A violation has no culprit line.** A constraint's remedy is uniform
 *    across every file it names, so the sentence is stated once and the
 *    complete list of files sits under it. See `ConstraintViolation`.
 *  - **The blocking-but-ruleless block is `unreadable`, not a truncated walk.**
 *    Same argument, different cause: "we could not look" must never render as
 *    "it is fine". It is drawn as its own block, with no rule ID, because a
 *    business user reading "CON-nn" beside it would go looking for a rule that
 *    does not exist.
 *
 * WHAT IS DISPLAYED, AND WHAT IS COMPLETE
 * ───────────────────────────────────────
 * Every file is named by its path from the chosen folder inclusive
 * (`displayPathOf`), because that is what the user types into Explorer. The
 * lists are truncated on screen at four, exactly as the other two panels
 * truncate, and NOT truncated in the saved page — #26.01's contract restated:
 * the data is complete, and truncation is the renderer's decision.
 */

import { useCallback, useEffect, useId, useMemo, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";

import { ActivityCue } from "@/components/activity-cue";
import { buttonClass } from "@/lib/ui/button-styles";
import { buildRulesPageHtml, reportFileName } from "@/lib/import/report-html";
import { downloadHtmlFile, fileNameStamp } from "@/lib/ui/download-html";
import { displayPathOf } from "@/lib/import/folder-utils";
import type { ConstraintVerdict } from "@/lib/import/constraint-check";
import {
  CONSTRAINT_SCOPES,
  constraintListingValues,
  constraintMessageKeyFor,
  constraintRulesInScope,
  constraintScopeKeyFor,
} from "@/lib/import/constraint-rules";
import { RuleExample } from "./rule-example";
import { COST_NOTE_CLASS } from "./folder-forecast";

/** How many paths one violation shows before it stops listing them. */
const MAX_PATHS_SHOWN = 4;

type Props = {
  /**
   * `null` until the files have been checked in this run — the state in which
   * the constraints are the whole content of the screen.
   */
  verdict: ConstraintVerdict | null;
  /** The folder Structure passed. Never `""` by the time this panel is mounted. */
  folderName: string;
  /** A check is running right now: every button that starts one is inert. */
  busy: boolean;
  /**
   * Already-translated cue text for that check — the re-walk, or the metadata
   * pass's running count once it starts.
   *
   * Passed in rather than owned here for the same reason the Structure panel
   * takes one: both sentences already live in `adminImport.wizard`, and moving
   * them would be a rename with no reader.
   */
  busyLabel: string;
  acknowledged: boolean;
  onAcknowledgedChange: (next: boolean) => void;
  onCheck: () => void;
  onChooseFolder: () => void;
  /**
   * The rules disclosure, hoisted into the wizard for the same reason the other
   * panels' are: this subtree re-renders on every turn of the loop, and a user
   * who opened the constraints to read them alongside their fix list must not
   * have them shut on the next check.
   */
  rulesOpen: boolean;
  onRulesOpenChange: (open: boolean) => void;
};

export function ImportConstraintsStage({
  verdict,
  folderName,
  busy,
  busyLabel,
  acknowledged,
  onAcknowledgedChange,
  onCheck,
  onChooseFolder,
  rulesOpen,
  onRulesOpenChange,
}: Props) {
  const t = useTranslations("adminImport.constraints");
  // Unnamespaced, so `constraintMessageKeyFor` and `constraintScopeKeyFor` can
  // be used as written — they exist precisely so the message path is not spelled
  // out in a component.
  const tk = useTranslations();
  const locale = useLocale();
  const checkboxId = useId();
  const hintId = useId();

  const checked = verdict !== null;

  /**
   * How many constraints the last check found broken.
   *
   * ⚠️ A NUMBER, not the array, and never a dependency — the lesson the
   * Structure panel learned the expensive way: `?? []` mints a fresh array on
   * every render the verdict is null, so a `useMemo` depending on one re-ran
   * every render and re-translated every sentence.
   */
  const violationCount = verdict?.violations.length ?? 0;

  /**
   * Show the constraints themselves, rather than only the disclosure button.
   *
   * Before the first check they are the whole content. After one they collapse
   * behind "Arată din nou restricțiile", because the fix list is what the user
   * is working through.
   *
   * The third case WAS the re-check started from the EVALUATION screen, which
   * mounted this panel with the previous round's CLEAN verdict.
   *
   * ⚠️ **That route no longer exists as of #26.06**, and saying so is the point
   * of this note: an Evaluation re-check now targets Duplication, so it enters
   * `duplication-checking` and mounts the Duplication panel instead. The only
   * two ways into `constraints-checking` are from `constraints`, where
   * `metadata` is null and the verdict is therefore null, and from
   * `constraints-report`, where the verdict is by definition not clean — so a
   * clean `ConstraintVerdict` can no longer be in scope here at all.
   *
   * The branch stays: it costs one boolean, it is the honest content for that
   * window if the route ever returns, and deleting a guard because the machine
   * currently cannot reach it is how the machine's next change reintroduces the
   * bug. What must NOT stay is a comment claiming the route is live — the next
   * reader would build on a model of the flow that is one slice out of date.
   */
  const nothingToShow =
    violationCount === 0 && (verdict?.unreadable.length ?? 0) === 0;
  const showRules = !checked || rulesOpen || (busy && nothingToShow);

  /**
   * The constraints, grouped and translated once — used by the screen and by
   * the saved page, so the two can never list different rules or word them
   * differently.
   */
  const sections = useMemo(
    () =>
      CONSTRAINT_SCOPES.map((scope) => ({
        scope,
        heading: tk(constraintScopeKeyFor(scope)),
        rules: constraintRulesInScope(scope).map((rule) => ({
          id: rule.id,
          requirement: tk(
            constraintMessageKeyFor(rule.id, "requirement"),
            constraintListingValues(rule.id),
          ),
          example: tk(
            constraintMessageKeyFor(rule.id, "example"),
            constraintListingValues(rule.id),
          ),
        })),
      })),
    [tk],
  );

  /** One sentence per violation, rendered from the rule's own message. */
  const renderedViolations = useMemo(
    () =>
      (verdict?.violations ?? []).map((v) => ({
        ruleId: v.ruleId,
        sentence: tk(constraintMessageKeyFor(v.ruleId, "violation"), { ...v.counts }),
        paths: v.paths.map((p) => displayPathOf(folderName, p)),
      })),
    [verdict, folderName, tk],
  );

  const unreadablePaths = useMemo(
    () => (verdict?.unreadable ?? []).map((p) => displayPathOf(folderName, p)),
    [verdict, folderName],
  );

  /**
   * The take-away page. Everything user-facing is translated HERE and handed
   * over as plain strings — `report-html.ts` must not become a second place
   * Romanian lives, which is the rule both other exports follow.
   */
  const handleSave = useCallback(() => {
    const now = new Date();

    /**
     * Is there an ANSWER to print?
     *
     * ⚠️ One flag for all three fields, and the reason is a bug this slice
     * shipped twice. The first draft printed a green all-clear during a
     * re-check, because the panel still held the previous round's clean
     * verdict. Guarding only `clean` on `!busy` then produced the opposite lie:
     * `violations` stayed `[]` and the exporter maps empty-and-not-clean to
     * `save.blocked` — "the folder cannot be imported, see below for why" —
     * with nothing below, because a clean verdict has no unreadable files
     * either. The exporter's contract is sound (`RulesPageInput.clean`); what
     * broke it was falsifying one of its inputs from outside the checker.
     *
     * While a check is in flight the honest page is "not checked yet", which
     * `violations: null` renders and which is already translated.
     */
    const settled = checked && !busy;

    const html = buildRulesPageHtml({
      // Unlike the Structure page there is no "saved before a folder was
      // picked" state to guard against: this panel is only ever mounted once a
      // folder has been walked and passed. Guarded anyway, because `""` would
      // print a "Folder:" line with nothing after it.
      folderName: folderName === "" ? null : folderName,
      generatedAt: now.toLocaleString(locale),
      locale,
      sections: sections.map((s) => ({ heading: s.heading, rules: s.rules })),
      // `null`, not `[]`, when nothing has been checked: "we looked and found
      // nothing" and "we have not looked" are different pages, and printing the
      // all-clear for the second is the confident-output failure this codebase
      // keeps a rule about.
      violations: settled
        ? renderedViolations.map((v) => ({
            ruleId: v.ruleId,
            // No culprit: a constraint names a set of files, not a place.
            sentence: v.sentence,
            related: v.paths,
          }))
        : null,
      // NOT an empty violation list, which the exporter would otherwise have to
      // infer. Files that could not be read break no constraint and are refused
      // anyway, and the all-clear printed for that case is green and wrong.
      clean: settled && (verdict?.clean ?? false),
      warnings:
        settled && unreadablePaths.length > 0
          ? [
              {
                // ⚠️ The INTRO, and no heading — the two halves of one lesson.
                //
                // The sentence that ends with "take it out of the chosen
                // folder" is `unreadable.intro`; the first draft of this call
                // passed a bare count instead, so the one medium the user
                // actually works from in File Explorer carried a list of files
                // and no remedy at all, under a body line promising "see below
                // for why". The Structure page is accidentally safe from the
                // same mistake because its `truncated.<limit>` strings ARE the
                // remedy.
                //
                // And no `heading`, because this stage emits exactly one group:
                // the section already has a title, and repeating it as an `<h3>`
                // one line below printed the same sentence twice.
                sentence: t("unreadable.intro", { count: unreadablePaths.length }),
                paths: unreadablePaths,
              },
            ]
          : [],
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
      reportFileName(
        t("save.filePrefix"),
        folderName === "" ? t("save.rulesOnlyName") : folderName,
        fileNameStamp(now),
      ),
    );
  }, [busy, checked, folderName, locale, renderedViolations, sections, t, unreadablePaths, verdict]);


  /**
   * The one live region on this panel, always mounted, so a screen-reader user
   * hears the RESULT of each round of the loop.
   *
   * Deliberately EMPTY while the check runs: `ActivityCue` is itself a
   * `role="status"`, and two live regions announcing the same sentence read it
   * twice.
   *
   * ⚠️ THE UNREADABLE BRANCH IS NOT A TIDY-UP. Without it, the case
   * `checkConstraintsStage` exists for — nothing broke a constraint, but the
   * folder is refused because some files could not be read — falls through to
   * the violation count and announces "0 lucruri de îndreptat" over a folder
   * that cannot proceed. The visible list is correctly hidden at zero, so the
   * lie would have been audible only, which is exactly how it would survive.
   *
   * ⚠️ AND A CLEAN VERDICT SAYS NOTHING HERE, on purpose: a passing check
   * unmounts this whole panel in the same commit that moves the phase on, so
   * any string put here would be removed before an assistive technology read
   * it. What announces success is the stage indicator's own live region moving
   * to the next stage.
   */
  const liveSummary =
    busy || verdict === null || verdict.clean
      ? ""
      : violationCount === 0
        ? t("unreadable.title")
        : t("violationsTitle", { count: violationCount });

  /**
   * Give the keyboard back when a round of the loop ends.
   *
   * The tick is cleared at the start of every check, which DISABLES the button
   * the user just pressed — and a disabled element cannot hold focus, so the
   * browser drops it to `<body>`. Nothing puts it back, because the button stays
   * disabled until the tick returns.
   *
   * ⚠️ RESTORES focus; it does not seize it. A check on a large archive takes
   * seconds, and the sensible thing to do while waiting is to read the rules or
   * press Save — so focus is only put back when it is on nothing at all.
   */
  const checkboxRef = useRef<HTMLInputElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const wasBusy = useRef(false);
  const arrived = useRef(false);
  useEffect(() => {
    // Two triggers and two TARGETS, and the pair is what makes it right.
    //
    // `finished` is the busy → idle edge within this panel; the tick is the
    // next thing the user has to do, so that is where the keyboard goes.
    //
    // `justMounted` is the ARRIVAL, added because a check that bounces back to
    // Structure moves the phase in a single commit: this panel unmounts (its
    // effect destroyed, never run on the edge) while the other mounts fresh
    // with `wasBusy = false`, and nothing anywhere puts the keyboard back. But
    // the tick is the WRONG target there — it sits below the whole rules
    // listing, and `focus()` scrolls, so focusing it on arrival would scroll
    // the rules the user is being asked to confirm they have read off the top
    // of the screen. That is the thing this effect's own note forbids. On
    // arrival the keyboard goes to the panel's heading, which is the ordinary
    // route-change pattern and gets the new screen announced.
    const finished = wasBusy.current && !busy;
    const justMounted = !arrived.current;
    arrived.current = true;
    wasBusy.current = busy;
    if (busy || (!finished && !justMounted)) return;
    const active = typeof document === "undefined" ? null : document.activeElement;
    const stranded = active === null || active === document.body;
    // ⚠️ RESTORES focus; it does not seize it. Only when focus is on nothing at
    // all — `<body>`, which is where the browser drops it when the control that
    // had it was disabled or unmounted.
    //
    // ⚠️ KNOWN GAP: while the Cancel confirmation is open the wizard marks this
    // subtree `inert`, so a `focus()` here is a no-op — and the edge is spent,
    // because `busy` does not change again. Dismissing the dialog therefore
    // leaves the keyboard on the Cancel button rather than on the tick. That is
    // a defensible place to land after dismissing a dialog, and closing it
    // properly would mean threading the dialog's state into this panel; left
    // alone deliberately, and recorded rather than promised away.
    if (stranded) (justMounted ? headingRef : checkboxRef).current?.focus();
  }, [busy]);

  return (
    <section className="rounded-xl border border-card-rim bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
      <p role="status" className="sr-only">
        {liveSummary}
      </p>

      {/* `tabIndex={-1}` so the effect above can put the keyboard here on
          arrival. Not reachable by Tab.

          ⚠️ NO `outline-none`. The first draft added it "so a pointer user gets
          no ring" — but a pointer user gets no ring anyway, because browsers
          style `:focus-visible` and a click does not match it. What the class
          actually removed was the ring for the KEYBOARD user this whole effect
          exists for: a programmatic `.focus()` DOES match `:focus-visible` when
          the last interaction was a keypress, which is what makes the
          focus-the-heading pattern usable at all. It turned "focus stranded on
          body" into "focus invisible", which is harder to notice. */}
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-lg font-semibold text-ink dark:text-zinc-100"
      >
        {t("title")}
      </h2>
      <p className="mt-1.5 text-sm text-ink dark:text-zinc-300">{t("intro")}</p>

      {/*
        `aria-busy` says "what you are reading is being recomputed" for the
        moment a check is in flight, during which the previous round's list is
        still on screen.

        ⚠️ Scoped to the RESULTS, not to the whole panel, and the difference is a
        silent screen reader: `aria-busy="true"` holds back live-region updates
        anywhere in its subtree, and the running cue below is an `ActivityCue`,
        i.e. a `role="status"` that exists only while `busy` is true. Inside a
        busy section its announcement would be deferred until there was nothing
        left to announce.
      */}
      <div aria-busy={busy}>

      {/* ── What could not be read ───────────────────────────────────────── */}
      {unreadablePaths.length > 0 && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950/30">
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">
            {t("unreadable.title")}
          </h3>
          <p className="mt-1 text-sm text-red-800 dark:text-red-300">
            {t("unreadable.intro", { count: unreadablePaths.length })}
          </p>
          <PathList paths={unreadablePaths} />
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
                key={v.ruleId}
                className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-700/60 dark:bg-amber-950/30"
              >
                <div className="flex items-baseline gap-2">
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-400">
                    {v.ruleId}
                  </span>
                  <p className="min-w-0 text-sm text-ink dark:text-zinc-100">{v.sentence}</p>
                </div>
                <PathList paths={v.paths} />
              </li>
            ))}
          </ul>
          <p className={`mt-3 ${COST_NOTE_CLASS}`}>{t("fixInstructions")}</p>
        </>
      )}

      {/*
        ⚠️ `!busy` is load-bearing, and it is the one place this panel must NOT
        copy the Structure panel. Keeping the previous round's list on screen
        during a check is right for a VIOLATION list — it is the to-do list the
        user is working through. It is wrong for a passing verdict: a re-check
        pressed from the Evaluation screen mounts this panel with the previous
        round's clean verdict, and "Toate fișierele din folder pot fi importate"
        in emerald is then an assertion about a check that is at that moment
        running and may refuse them.

        ⚠️ WHICH MAKES THIS LINE UNREACHABLE, and that is not a reason to delete
        the guard — it is the reason the guard has to stay. It was already
        unreachable when #26.05 wrote this note, and #26.06 removed the last
        route that could have made it reachable again: an Evaluation re-check
        now enters `duplication-checking`, not `constraints-checking`, so this
        panel is never mounted holding a clean verdict at all. A reader who
        notices the green line never appears and "repairs" it by dropping
        `!busy` restores the lie the moment a later slice re-routes that button
        — and the Duplication panel's identical guard IS live today, which is
        what that would be copied from.
      */}
      {!busy && verdict !== null && verdict.clean && (
        <p className="mt-4 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          {t("clean")}
        </p>
      )}

      </div>

      {/* ── The constraints ──────────────────────────────────────────────── */}
      {/* ⚠️ Not offered while the rules are forced open by `nothingToShow`.
          The disclosure reads `rulesOpen`, the region reads `showRules`, and
          during that window they disagree: the button reported
          `aria-expanded="false"` over an expanded region, offered to show what
          was already shown, and pressing it only relabelled itself. A control
          whose state contradicts what is on screen is worse than no control. */}
      {checked && !(busy && nothingToShow) && (
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
                    {/* The example is the rule, for this reader — see the
                        catalogue's header. Not italic-and-small-and-forgotten:
                        same treatment as the Structure listing, so the two
                        pages read as one document. */}
                    <RuleExample
                      text={rule.example}
                      className="mt-0.5 pl-1 text-xs italic text-fade dark:text-zinc-400"
                    />
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
            onClick={onCheck}
            disabled={!acknowledged || busy}
            className={buttonClass({ variant: "primary", size: "lg" })}
          >
            {checked ? t("recheck") : t("check")}
          </button>

          {/* The folder may simply be the wrong one, and it re-enters at
              Structure, because a different folder has passed nothing.

              ⚠️ NOT gated on the tick, unlike its twin on the Structure panel,
              and the asymmetry is the point. There the tick IS the gate on
              picking a folder. Here the tick says "I have read the file
              constraints", choosing a different folder is not a verification of
              this one, and the check it actually starts is the STRUCTURE check,
              whose own tick `runWalk` clears on the way in regardless. Gating it
              demanded a confirmation for a check it does not govern — and made
              the way out of a wrong folder cost a tick. */}
          <button
            type="button"
            onClick={onChooseFolder}
            disabled={busy}
            className={buttonClass({ variant: "secondary", size: "md" })}
          >
            {t("chooseAnotherFolder")}
          </button>

          {busy && <ActivityCue>{busyLabel}</ActivityCue>}
        </div>
      </div>

      {/* ── The take-away copy ───────────────────────────────────────────── */}
      <div className="mt-5 border-t border-crease pt-4 dark:border-zinc-800">
        {/* Fixed in passing (#26.06): `disabled={busy}`. `settled` is
            `checked && !busy`, so a Save pressed during a check wrote "the
            files have not been checked yet" into a dated page while the screen
            behind it still showed the previous round's complete fix list — the
            one thing the user actually carries into File Explorer. The check
            here is a re-walk plus the ~760-call metadata pass, so the window is
            seconds long. */}
        <button
          type="button"
          onClick={handleSave}
          disabled={busy}
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
 * The files under one violation, truncated for the screen only.
 *
 * The saved page prints all of them — see the module header, and #26.01's note
 * on evidence being complete by contract.
 */
function PathList({ paths }: { paths: readonly string[] }) {
  const t = useTranslations("adminImport.constraints");
  if (paths.length === 0) return null;

  const shown = paths.slice(0, MAX_PATHS_SHOWN);
  const hidden = paths.length - shown.length;

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
