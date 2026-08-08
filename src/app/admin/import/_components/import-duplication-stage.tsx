"use client";

/**
 * ImportDuplicationStage - the Duplication stage, inside the shell. (Slice #26.06)
 *
 * WHAT THE SCREEN IS FOR
 * ----------------------
 * Structure has passed and every file can be imported. This stage asks the last
 * question of the Preparation line: is anything in here TWICE - and it asks it
 * before a single Haiku call is paid for, while the user still has File
 * Explorer open from the last two stages.
 *
 * THE THIRD SIBLING OF `ImportStructureStage` AND `ImportConstraintsStage`
 * -----------------------------------------------------------------------
 * Rules, a tick, a check, a fix list, a re-check, and a page you can save. The
 * source document asks for "the same loop" in as many words, and the value of
 * that is not code reuse - it is that the third loop costs the user nothing to
 * learn. So the three components are siblings rather than one abstraction: they
 * share `report-html.ts`, `displayPathOf` and the message-key helpers, and
 * everything that differs is visible here rather than hidden behind a prop.
 *
 * WHAT DIFFERS, AND WHY
 * ---------------------
 *  - **A violation is a list of GROUPS, not a list of paths.** This is the one
 *    real difference in the whole stage, and it is not cosmetic. A constraint's
 *    remedy is uniform across every file it names, so its sentence is stated
 *    once with the files under it. A duplication remedy is "keep one of THESE",
 *    once per set - and a flat list of seven paths that is really three pairs
 *    and a triple invites a user to keep one file out of seven. Each group is
 *    drawn as its own block with its own heading, and the heading says what
 *    holds it together: the shared name, or the shared page count.
 *  - **Nothing on this screen says "delete".** Same name and same size is
 *    evidence, not proof - `duplication-check.ts` explains why it is not a
 *    byte comparison - so the copy asks the user to look first, and offers the
 *    escape that always works for the one who cannot tell.
 *  - **The blocking-but-ruleless block is `unsized`.** Same argument as the
 *    Constraints panel's `unreadable`, one stage later: a file that could not be
 *    measured cannot be matched, and silently becoming unique is exactly how
 *    "we could not look" turns into "it is fine".
 *
 * WHAT IS DISPLAYED, AND WHAT IS COMPLETE
 * ---------------------------------------
 * Every file is named by its path from the chosen folder inclusive
 * (`displayPathOf`), because that is what the user types into Explorer. The
 * lists are truncated on screen at four, exactly as the other two panels
 * truncate, and NOT truncated in the saved page - #26.01's contract restated:
 * the data is complete, and truncation is the renderer's decision.
 */

import { useCallback, useEffect, useId, useMemo, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";

import { ActivityCue } from "@/components/activity-cue";
import { buttonClass } from "@/lib/ui/button-styles";
import {
  buildRulesPageHtml,
  groupedViolationBlocks,
  reportFileName,
} from "@/lib/import/report-html";
import { downloadHtmlFile, fileNameStamp } from "@/lib/ui/download-html";
import { displayPathOf } from "@/lib/import/folder-utils";
import type { DuplicateGroup, DuplicationVerdict } from "@/lib/import/duplication-check";
import {
  DUPLICATION_RULES,
  duplicationListingValues,
  duplicationMessageKeyFor,
} from "@/lib/import/duplication-rules";
import { COST_NOTE_CLASS } from "./folder-forecast";

/** How many paths one group shows before it stops listing them. */
const MAX_PATHS_SHOWN = 4;

type Props = {
  /**
   * `null` until the folder has been searched for copies in this run - the
   * state in which the explanations are the whole content of the screen.
   */
  verdict: DuplicationVerdict | null;
  /** The folder Structure and Constraints passed. Never `""` by the time this panel is mounted. */
  folderName: string;
  /** A check is running right now: every button that starts one is inert. */
  busy: boolean;
  /**
   * Already-translated cue text for that check - the re-walk, or the metadata
   * pass's running count once it starts.
   *
   * Passed in rather than owned here for the same reason the other two panels
   * take one: both sentences already live in `adminImport.wizard`, and moving
   * them would be a rename with no reader.
   */
  busyLabel: string;
  acknowledged: boolean;
  onAcknowledgedChange: (next: boolean) => void;
  onCheck: () => void;
  onChooseFolder: () => void;
  /**
   * The explanations disclosure, hoisted into the wizard for the same reason
   * the other panels' are: this subtree re-renders on every turn of the loop,
   * and a user who opened the explanations to read them alongside their fix
   * list must not have them shut on the next check.
   */
  rulesOpen: boolean;
  onRulesOpenChange: (open: boolean) => void;
};

export function ImportDuplicationStage({
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
  const t = useTranslations("adminImport.duplication");
  // Unnamespaced, so `duplicationMessageKeyFor` can be used as written - it
  // exists precisely so the message path is not spelled out in a component.
  const tk = useTranslations();
  const locale = useLocale();
  const checkboxId = useId();
  const hintId = useId();

  const checked = verdict !== null;

  /**
   * How many DECISIONS the last check left the user, which is the number of
   * SETS of copies and not the number of rules broken.
   *
   * ⚠️ The count the two sibling panels use - `violations.length` - is the
   * wrong number here, and it is wrong by up to the size of the archive. A
   * Structure violation is one per culprit and a Constraint violation is one
   * uniform remedy over a list of files, so in both of those a violation
   * genuinely is a thing to put right. A Duplication violation is one per RULE,
   * and each carries a group per set of copies - twelve files each sitting in
   * the folder twice is ONE violation and twelve decisions. Shipped that way
   * the heading read "Un lucru de îndreptat" directly above a sentence saying
   * twelve, and a screen-reader user heard only the heading.
   *
   * A NUMBER, not the array, and never a dependency - the lesson the Structure
   * panel learned the expensive way: `?? []` mints a fresh array on every
   * render the verdict is null, so a `useMemo` depending on one re-ran every
   * render and re-translated every sentence.
   */
  const decisionCount =
    verdict?.violations.reduce((n, v) => n + v.groups.length, 0) ?? 0;

  /**
   * Show the explanations themselves, rather than only the disclosure button.
   *
   * Before the first check they are the whole content. After one they collapse
   * behind "Arata din nou explicatiile", because the fix list is what the user
   * is working through. The third case is the re-check started from the
   * EVALUATION screen, which mounts this panel with the previous round's CLEAN
   * verdict: there is no fix list, no unsized block and - correctly - no
   * all-clear either, since one is running. The explanations being re-checked
   * are the honest content for that window.
   */
  const nothingToShow = decisionCount === 0 && (verdict?.unsized.length ?? 0) === 0;
  const showRules = !checked || rulesOpen || (busy && nothingToShow);

  /**
   * The explanations, translated once - used by the screen and by the saved
   * page, so the two can never list different rules or word them differently.
   *
   * ONE section with no heading, unlike the other two catalogues. Two rules do
   * not group, and a section heading here could only repeat `rulesTitle` one
   * line below itself; `RulesPageSection.heading` was made optional in this
   * slice for exactly that reason, and the note there records why.
   */
  const rules = useMemo(
    () =>
      DUPLICATION_RULES.map((rule) => ({
        id: rule.id,
        requirement: tk(
          duplicationMessageKeyFor(rule.id, "requirement"),
          duplicationListingValues(rule.id),
        ),
        example: tk(
          duplicationMessageKeyFor(rule.id, "example"),
          duplicationListingValues(rule.id),
        ),
      })),
    [tk],
  );

  /**
   * One sentence per violation, and one heading per group inside it.
   *
   * The group heading is translated HERE rather than carried on the group,
   * because `duplication-check.ts` holds no display text - the same rule every
   * other checker in this folder follows. `by` is the discriminant, and the
   * switch is exhaustive by construction.
   */
  const renderedViolations = useMemo(
    () =>
      (verdict?.violations ?? []).map((v) => ({
        ruleId: v.ruleId,
        sentence: tk(duplicationMessageKeyFor(v.ruleId, "violation"), { ...v.counts }),
        groups: v.groups.map((g: DuplicateGroup) => ({
          key: g.paths[0],
          heading:
            g.by === "name"
              ? t("group.name", { name: g.name, count: g.paths.length })
              : t("group.pages", { count: g.paths.length, pages: g.pages }),
          paths: g.paths.map((p) => displayPathOf(folderName, p)),
        })),
      })),
    [verdict, folderName, t, tk],
  );

  const unsizedPaths = useMemo(
    () => (verdict?.unsized ?? []).map((p) => displayPathOf(folderName, p)),
    [verdict, folderName],
  );

  /**
   * The take-away page. Everything user-facing is translated HERE and handed
   * over as plain strings - `report-html.ts` must not become a second place
   * Romanian lives, which is the rule all three exports follow.
   */
  const handleSave = useCallback(() => {
    const now = new Date();

    /**
     * Is there an ANSWER to print?
     *
     * One flag for all three fields, and the reason is a bug #26.05 shipped
     * twice: a green all-clear printed during a re-check, because the panel
     * still held the previous round's clean verdict; and then, with only
     * `clean` guarded, "the folder cannot be imported, see below for why" with
     * nothing below it. While a check is in flight the honest page is "not
     * checked yet", which `violations: null` renders.
     */
    const settled = checked && !busy;

    const html = buildRulesPageHtml({
      // Guarded although this panel is only ever mounted once a folder has been
      // walked and passed twice: `""` would print a "Folder:" line with nothing
      // after it.
      folderName: folderName === "" ? null : folderName,
      generatedAt: now.toLocaleString(locale),
      locale,
      sections: [{ rules }],
      // The rule's sentence once, then one block per set - `groupedViolationBlocks`
      // holds the shape and the reason, and it lives in the exporter so a test
      // can reach it. This slice shipped the wrong shape once.
      //
      // `null`, not `[]`, when nothing has been checked: "we looked and found
      // nothing" and "we have not looked" are different pages.
      violations: settled ? groupedViolationBlocks(renderedViolations) : null,
      clean: settled && (verdict?.clean ?? false),
      warnings:
        settled && unsizedPaths.length > 0
          ? [
              {
                // The INTRO, and no heading - both halves of #26.05's lesson.
                // The sentence carries the remedy, and the section already has
                // a title, so a heading here would print it twice.
                sentence: t("unsized.intro", { count: unsizedPaths.length }),
                paths: unsizedPaths,
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
  }, [busy, checked, folderName, locale, renderedViolations, rules, t, unsizedPaths, verdict]);

  /**
   * The one live region on this panel, always mounted, so a screen-reader user
   * hears the RESULT of each round of the loop.
   *
   * Deliberately EMPTY while the check runs: `ActivityCue` is itself a
   * `role="status"`, and two live regions announcing the same sentence read it
   * twice.
   *
   * THE UNSIZED BRANCH IS NOT A TIDY-UP. Without it, the case
   * `checkDuplicationStage` exists for - nothing was found twice, but the
   * folder is refused because some files could not be measured - falls through
   * to the violation count and announces "0 lucruri de indreptat" over a folder
   * that cannot proceed. The visible list is correctly hidden at zero, so the
   * lie would have been audible only, which is exactly how it would survive.
   *
   * AND A CLEAN VERDICT SAYS NOTHING HERE, on purpose: a passing check unmounts
   * this whole panel in the same commit that moves the phase on, so any string
   * put here would be removed before an assistive technology read it. What
   * announces success is the stage indicator's own live region moving on.
   */
  const liveSummary =
    busy || verdict === null || verdict.clean
      ? ""
      : decisionCount === 0
        ? t("unsized.title")
        : t("violationsTitle", { count: decisionCount });

  /**
   * Give the keyboard back when a round of the loop ends.
   *
   * The tick is cleared at the start of every check, which DISABLES the button
   * the user just pressed - and a disabled element cannot hold focus, so the
   * browser drops it to `<body>`. Nothing puts it back, because the button
   * stays disabled until the tick returns.
   *
   * Two triggers and two TARGETS, copied deliberately from the Constraints
   * panel rather than abstracted out of it: `finished` is the busy -> idle edge
   * within this panel and sends the keyboard to the tick; `justMounted` is the
   * ARRIVAL and sends it to the heading, because the tick sits below the whole
   * listing and `focus()` scrolls - focusing it on arrival would scroll the
   * explanations the user is being asked to confirm they have read off the top
   * of the screen.
   *
   * RESTORES focus; it does not seize it. Only when focus is on nothing at all.
   *
   * KNOWN GAP, shared with the Constraints panel: while the Cancel confirmation
   * is open the wizard marks this subtree `inert`, so a `focus()` here is a
   * no-op and the edge is spent. Recorded rather than promised away.
   *
   * SECOND KNOWN GAP, found by this slice's adversarial review and shared with
   * both siblings: a re-check pressed on the EVALUATION screen mounts this
   * panel already `busy`, so the effect returns having spent `arrived`; if that
   * check comes back clean the panel unmounts in the same commit and the
   * busy -> idle edge never fires. A keyboard user is returned to Evaluation
   * with focus on `<body>`. Closing it means the wizard restoring focus across
   * a panel swap, which is a change to the parent rather than to this effect -
   * so it is recorded here rather than half-fixed.
   */
  const checkboxRef = useRef<HTMLInputElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const wasBusy = useRef(false);
  const arrived = useRef(false);
  useEffect(() => {
    const finished = wasBusy.current && !busy;
    const justMounted = !arrived.current;
    arrived.current = true;
    wasBusy.current = busy;
    if (busy || (!finished && !justMounted)) return;
    const active = typeof document === "undefined" ? null : document.activeElement;
    const stranded = active === null || active === document.body;
    if (stranded) (justMounted ? headingRef : checkboxRef).current?.focus();
  }, [busy]);

  return (
    <section className="rounded-xl border border-card-rim bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
      <p role="status" className="sr-only">
        {liveSummary}
      </p>

      {/* `tabIndex={-1}` so the effect above can put the keyboard here on
          arrival. Not reachable by Tab, and NO `outline-none` - see the
          Constraints panel for why that class removes the ring for exactly the
          keyboard user this effect exists for. */}
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-lg font-semibold text-ink dark:text-zinc-100"
      >
        {t("title")}
      </h2>
      <p className="mt-1.5 text-sm text-ink dark:text-zinc-300">{t("intro")}</p>

      {/* `aria-busy` says "what you are reading is being recomputed" for the
          moment a check is in flight, during which the previous round's list is
          still on screen. Scoped to the RESULTS, not to the whole panel: it
          holds back live-region updates anywhere in its subtree, and the
          running cue below is a `role="status"`. */}
      <div aria-busy={busy}>

      {/* -- What could not be measured ---------------------------------- */}
      {unsizedPaths.length > 0 && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950/30">
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">
            {t("unsized.title")}
          </h3>
          <p className="mt-1 text-sm text-red-800 dark:text-red-300">
            {t("unsized.intro", { count: unsizedPaths.length })}
          </p>
          <PathList paths={unsizedPaths} />
        </div>
      )}

      {/* -- The fix list ------------------------------------------------- */}
      {checked && decisionCount > 0 && (
        <>
          <h3 className="mt-5 text-sm font-semibold text-ink dark:text-zinc-100">
            {t("violationsTitle", { count: decisionCount })}
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
                {/* One block per SET, and the heading is what holds the set
                    together. This is the whole reason a duplication violation
                    carries groups - see the module header. */}
                <ul className="mt-2 space-y-1.5">
                  {v.groups.map((g) => (
                    <li key={g.key} className="border-t border-amber-200/70 pt-1.5 first:border-0 first:pt-0 dark:border-amber-800/50">
                      <p className="text-xs font-medium text-ink dark:text-zinc-200">{g.heading}</p>
                      <PathList paths={g.paths} />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <p className={`mt-3 ${COST_NOTE_CLASS}`}>{t("fixInstructions")}</p>
        </>
      )}

      {/* `!busy` is load-bearing, and it is the one place this panel must NOT
          copy the Structure panel. Keeping the previous round's list on screen
          during a check is right for a fix list - it is the to-do list the user
          is working through. It is wrong for a passing verdict: a re-check
          pressed from the Evaluation screen mounts this panel with the previous
          round's clean verdict, and an emerald all-clear is then an assertion
          about a check that is at that moment running and may refuse the folder.

          ⚠️ AND HERE THE GUARD IS LIVE, unlike the identical one on the
          Constraints panel, which is where this comment was copied from and
          where it then said the opposite. The difference is `duplicationChecked`:
          it is deliberately NOT cleared at the top of a walk, so a re-check
          pressed on the Evaluation screen mounts this panel holding the
          PREVIOUS round's clean verdict with `busy` true. Without `!busy` the
          user would read "Nu se află nimic de două ori în folderul ales" in
          emerald while the check that may refuse the folder is still running.
          This is the frame the guard exists for, and it is reachable. */}
      {!busy && verdict !== null && verdict.clean && (
        <p className="mt-4 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          {t("clean")}
        </p>
      )}

      </div>

      {/* -- The explanations --------------------------------------------- */}
      {/* Not offered while the explanations are forced open by `nothingToShow`:
          the disclosure reads `rulesOpen` and the region reads `showRules`, and
          during that window they disagree - a control whose state contradicts
          what is on screen is worse than no control. */}
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
          <ul className="mt-1.5 space-y-2">
            {rules.map((rule) => (
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
                {/* The example is the rule, for this reader - and more so here
                    than in the other two catalogues, because "duplicate" is the
                    word a user is most likely to think they already understand. */}
                <p className="mt-0.5 pl-1 text-xs italic text-fade dark:text-zinc-400">
                  {rule.example}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* -- The gate ----------------------------------------------------- */}
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

              NOT gated on the tick, for the reason the Constraints panel gives:
              the tick says "I have read what counts as a duplicate", choosing a
              different folder is not a verification of this one, and the check
              it actually starts is the STRUCTURE check. */}
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

      {/* -- The take-away copy ------------------------------------------- */}
      <div className="mt-5 border-t border-crease pt-4 dark:border-zinc-800">
        {/* ⚠️ `disabled={busy}`, and it is not tidiness. `settled` is
            `checked && !busy`, so a Save pressed DURING a check writes "the
            folder has not been checked yet" into a dated page - while the
            screen behind it still shows the previous round's complete list,
            which is correct and is the very thing the user wants to carry into
            File Explorer. This stage's check is a re-walk plus the ~760-call
            metadata pass, so that window is seconds long and is exactly when
            someone reaches for Save. Refusing for those seconds is honest;
            printing a blank page is not. */}
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
 * The files in one group, truncated for the screen only.
 *
 * The saved page prints all of them - see the module header, and #26.01's note
 * on evidence being complete by contract.
 */
function PathList({ paths }: { paths: readonly string[] }) {
  const t = useTranslations("adminImport.duplication");
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
