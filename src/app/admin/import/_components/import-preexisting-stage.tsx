"use client";

/**
 * ImportPreexistingStage — the Pre-existing stage, inside the shell. (Slice #26.08)
 *
 * WHAT THE SCREEN IS FOR
 * ----------------------
 * The folder is correct, its files are importable and nothing in it sits there
 * twice. This is the first question asked of the ARCHIVE rather than of the
 * folder: which of these documents does the system already hold, and what will
 * the import do about each of them.
 *
 * ⚠️ **THE FOURTH SIBLING, AND THE FIRST ONE THAT DOES NOT BLOCK.** Structure,
 * Constraints and Duplication each end in a trip to File Explorer and refuse to
 * hand over until the folder changes. Nothing here is wrong: the archive
 * holding a document the user is offering again is an ordinary state of
 * affairs, and the source document's instruction is to TELL them and move on.
 * So the shape differs in exactly three places, and everything else is
 * deliberately identical so the fourth screen costs nothing to learn:
 *
 *  - **There is no fix list, there are OUTCOMES.** Each block says what will
 *    happen to the files under it, in the future tense, because that is a
 *    promise about the import loop rather than a description of a fault. The
 *    promise is kept in `bulk-import-dialog.tsx`; the decision behind it is
 *    `preexisting-check.ts`.
 *  - **The tick gates a Continuă as well as a check.** It IS the
 *    acknowledgement the source document asks for ("after the user
 *    acknowledges the Pre-existing items, we move to the Evaluation phase"),
 *    and it is re-asked on every round for the same reason the other three
 *    re-ask theirs.
 *  - **A failed lookup is a state of its own.** See below.
 *
 * ⚠️ **THE ALL-CLEAR MESSAGE IS ON THE ORDINARY PATH SINCE #29.08, AND IT HAS
 * BEEN REACHABLE BY THREE DIFFERENT ARGUMENTS.** The original note said there
 * was none, and gave the correct reason: a clean verdict moved the phase
 * straight to Evaluation, so the panel was never mounted holding one and a
 * green "the archive holds none of these" would have been a branch no route
 * could reach. #29.02 built a route — with step-through ticked a clean lookup
 * RESTED here — which made the branch live, but only on request. #29.08 makes
 * it the normal case: a clean lookup lands here for everybody, because this
 * screen now carries the press that starts the billed classification, and a
 * press has to have a screen to be made on. `phaseAfterFileChecks` argues it at
 * length.
 *
 * ⚠️ **SO THIS PANEL IS NOW THE COST SCREEN OF THE WHOLE IMPORT.** Everything
 * before it is free; everything after the button on it is not. That is why
 * `nothingSpentYet` is rendered here and no longer on the Evaluation panel, and
 * why the fourth difference from the three sibling stages is a sentence about
 * money rather than about the folder.
 *
 * ⚠️ **THE FAILED LOOKUP IS THE ONE THING THIS SCREEN MUST NOT GET WRONG.**
 * "The archive holds none of these" and "we could not ask the archive" produce
 * the same import and must never produce the same screen. `PreexistingResult`
 * carries the difference as a discriminant rather than as an empty list — see
 * its note — and the failure renders as a red block with two ways out: try
 * again, or continue knowing that everything will be imported and something may
 * end up in the archive twice. Both are offered because neither alone is
 * honest: a retry-only screen traps a user whose database is down, and a
 * continue-only screen hides that a retry would probably work.
 *
 * WHAT IS DISPLAYED, AND WHAT IS COMPLETE
 * ---------------------------------------
 * Every file is named by its path from the chosen folder inclusive
 * (`displayPathOf`), and beside it the code of the document the archive already
 * holds — because that code is the only handle the user has on something they
 * cannot see in File Explorer. The lists are truncated on screen at four,
 * exactly as the other three panels truncate, and NOT truncated in the saved
 * page: #26.01's contract restated, the data is complete and truncation is the
 * renderer's decision.
 */

import { useCallback, useEffect, useId, useMemo, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";

import { ActivityCue } from "@/components/activity-cue";
import { buttonClass } from "@/lib/ui/button-styles";
import { buildRulesPageHtml, reportFileName } from "@/lib/import/report-html";
import { downloadHtmlFile, fileNameStamp } from "@/lib/ui/download-html";
import { displayPathOf } from "@/lib/import/folder-utils";
import type { PreexistingResult, PreexistingRow } from "@/lib/import/preexisting-check";
import {
  PREEXISTING_NOTES,
  preexistingListingValues,
  preexistingMessageKeyFor,
  preexistingSectionCounts,
  preexistingSectionKeyFor,
} from "@/lib/import/preexisting-rules";
import { RuleExample } from "./rule-example";
import { COST_NOTE_CLASS } from "@/lib/ui/cost-note";

/** How many files one block shows before it stops listing them. */
const MAX_PATHS_SHOWN = 4;

type Props = {
  /**
   * `null` until the archive has been asked in this run — the state in which
   * the explanations are the whole content of the screen.
   *
   * `{ ok: false }` is NOT that state: it means the question was asked and no
   * answer came back.
   */
  result: PreexistingResult | null;
  /** The folder the three stages before this one passed. Never `""` when mounted. */
  folderName: string;
  /** A check is running right now: every button that starts one is inert. */
  busy: boolean;
  /**
   * Already-translated cue text for that check.
   *
   * Passed in rather than owned here for the reason the three sibling panels
   * take one: the sentences already live in `adminImport.wizard`, and moving
   * them would be a rename with no reader.
   */
  busyLabel: string;
  acknowledged: boolean;
  onAcknowledgedChange: (next: boolean) => void;
  onCheck: () => void;
  /**
   * Acknowledged — send this folder for classification.        (Slice #29.08)
   *
   * ⚠️ **THIS IS THE FIRST THING IN THE WHOLE FLOW THAT COSTS MONEY, and until
   * #29.08 it was not.** It used to move the phase and nothing else, on to the
   * Evaluation screen, whose own Continuă started the classification. The
   * classification now has to run BEFORE Evaluation — the import cannot promise
   * that every document type has a form until it knows which types the folder
   * holds — so the press that pays for it is this one, and the warning that
   * said so on that screen came here with it. See `classificationCalls`.
   */
  onContinue: () => void;
  /**
   * How many images this press will send for automatic classification.
   *                                                            (Slice #29.08)
   *
   * ⚠️ **ON THE SENTENCE RATHER THAN ON THE BUTTON, and the Evaluation screen
   * had it the other way round.** There it was a button label, because a number
   * argues better than a warning. Here the count can legitimately be ZERO — a
   * folder whose importable files are all already in the archive, or none of
   * which can be read as an image — and "Continuă — trimite 0 imagini" is a
   * button promising a non-event. So the number lives in the cost sentence,
   * which is simply not drawn at zero, and the button keeps the two labels it
   * already had.
   */
  classificationCalls: number;
  /**
   * Has this run already paid for a classification once?        (Slice #29.08)
   *
   * ⚠️ **A RE-CHECK PRESSED ON THE EVALUATION SCREEN LANDS BACK HERE, and it
   * has just thrown a paid-for classification away.** "Nu s-a trimis nimic
   * încă" would then be false on the one screen in the flow whose whole job is
   * to be right about money, so the sentence changes rather than disappearing:
   * the press is still the one that spends, it is simply spending for the
   * second time. Found by the adversarial round.
   */
  classificationSpent: boolean;
  onChooseFolder: () => void;
  /**
   * The explanations disclosure, hoisted into the wizard for the same reason
   * the other panels' are: this subtree re-renders on every round, and a user
   * who opened the explanations to read them alongside the report must not have
   * them shut on the next check.
   */
  notesOpen: boolean;
  onNotesOpenChange: (open: boolean) => void;
};

export function ImportPreexistingStage({
  result,
  folderName,
  busy,
  busyLabel,
  acknowledged,
  onAcknowledgedChange,
  onCheck,
  onContinue,
  classificationCalls,
  classificationSpent,
  onChooseFolder,
  notesOpen,
  onNotesOpenChange,
}: Props) {
  const t = useTranslations("adminImport.preexisting");
  // Unnamespaced, so the two key helpers can be used as written — they exist
  // precisely so no message path is spelled out in a component.
  const tk = useTranslations();
  const locale = useLocale();
  const checkboxId = useId();
  const hintId = useId();

  const asked = result !== null;
  const failed = result !== null && !result.ok;
  const verdict = result !== null && result.ok ? result.verdict : null;

  /**
   * The two numbers this screen quotes, and they are deliberately NOT one
   * number.
   *
   * `matchedCount` is how many documents the archive already holds;
   * `uncheckedCount` is how many files it could not be asked about. Summing
   * them and putting the total over the outcome blocks would say "4 documents
   * are already in the system" over a list of three — the unmeasurable file is
   * not a document the archive holds, it is a question nobody could answer, and
   * it has its own block saying exactly that.
   *
   * NUMBERS, not arrays, and never dependencies: the lesson the Structure panel
   * learned the expensive way is that `?? []` mints a fresh array on every
   * render, so a `useMemo` depending on one re-runs every render and
   * re-translates every sentence.
   */
  const matchedCount = verdict?.matchedCount ?? 0;
  const uncheckedCount = verdict?.unchecked.length ?? 0;

  /**
   * Show the explanations themselves rather than only the disclosure button.
   *
   * Before the first check they are the whole content. After one they collapse
   * behind "Arată din nou explicațiile", because the report is what the user is
   * reading. The third case is a re-check that mounts this panel with nothing
   * to show — see the sibling panels, where the same window exists.
   */
  const nothingToShow = matchedCount === 0 && uncheckedCount === 0 && !failed;
  /**
   * ⚠️ `|| failed` was added by this slice's adversarial review, and the case
   * it closes is the one where the tick costs the most.
   *
   * On a failed lookup the panel asks the user to re-assert "Am citit ce se
   * întâmplă cu documentele care se află deja în sistem" in order to press
   * "Continuă fără această verificare" — and `asked` has just become true, so
   * without this the four explanations collapse behind a disclosure at exactly
   * that moment. The user was being asked to confirm they had read something
   * the screen had just hidden.
   */
  const showNotes = !asked || notesOpen || failed || (busy && nothingToShow);

  /**
   * The explanations, translated once — used by the screen and by the saved
   * page, so the two can never list different notes or word them differently.
   *
   * ONE section with no heading, like the Duplication listing: four notes do
   * not group, and a section heading here could only repeat `notesTitle` one
   * line below itself.
   */
  const notes = useMemo(
    () =>
      PREEXISTING_NOTES.map((note) => ({
        id: note.id,
        requirement: tk(
          preexistingMessageKeyFor(note.id, "explanation"),
          preexistingListingValues(note.id),
        ),
        example: tk(
          preexistingMessageKeyFor(note.id, "example"),
          preexistingListingValues(note.id),
        ),
      })),
    [tk],
  );

  /**
   * One block per outcome, with its heading, its promise, and its files.
   *
   * The section headings are translated HERE rather than carried on the
   * verdict, because `preexisting-check.ts` holds no display text — the rule
   * every other checker in this folder follows.
   */
  const blocks = useMemo(
    () =>
      (verdict?.sections ?? []).map((section) => ({
        id: section.id,
        title: tk(
          preexistingSectionKeyFor(section.id, "title"),
          preexistingSectionCounts(section.id, section.rows.length),
        ),
        intro: tk(
          preexistingSectionKeyFor(section.id, "intro"),
          preexistingSectionCounts(section.id, section.rows.length),
        ),
        rows: section.rows.map((row: PreexistingRow) => ({
          key: row.path,
          path: displayPathOf(folderName, row.path),
          code: row.documentCode,
          // The property folders a `link` row's document will be attached to,
          // drawn on the row and printed on the saved page. Empty for every
          // other outcome by construction.
          folders: row.propertyFolders,
        })),
      })),
    [verdict, folderName, tk],
  );

  const uncheckedPaths = useMemo(
    () => (verdict?.unchecked ?? []).map((p) => displayPathOf(folderName, p)),
    [verdict, folderName],
  );

  /**
   * The take-away page. Everything user-facing is translated HERE and handed
   * over as plain strings — `report-html.ts` must not become a second place
   * Romanian lives, which is the rule all four exports follow.
   */
  const handleSave = useCallback(() => {
    const now = new Date();

    /**
     * Is there an ANSWER to print?
     *
     * One flag for all three fields, and the reason is a bug #26.05 shipped
     * twice: a green all-clear printed during a re-check because the panel
     * still held the previous round's verdict, and then, with only `clean`
     * guarded, "cannot be imported, see below" with nothing below it. While a
     * check is in flight the honest page is "not asked yet".
     *
     * ⚠️ A FAILED lookup is also `null` here, and that is the same honesty one
     * step further: a page printing an empty outcome list over a question the
     * archive never answered is the worst artefact this stage could produce,
     * because it is dated, saved, and read later by someone who was not at the
     * screen.
     */
    const settled = asked && !busy && verdict !== null;

    const html = buildRulesPageHtml({
      folderName: folderName === "" ? null : folderName,
      generatedAt: now.toLocaleString(locale),
      locale,
      sections: [{ rules: notes }],
      violations: settled
        ? blocks.map((block) => ({
            // The block's own heading, printed as the culprit line — this
            // exporter's slot for "what this group is about". No `ruleId`: the
            // notes carry the ids, and a block is an outcome rather than a
            // note being broken.
            culprit: block.title,
            sentence: block.intro,
            related: block.rows.map((row) => {
              // ⚠️ The property folders go on the printed line too, and their
              // absence was a real defect: the page's own hint promises "toate
              // documentele găsite, fără prescurtări", and a `link` row's
              // properties are the only fact that makes it checkable after the
              // import — which is what the page is carried away to do.
              const line = t("row.line", { path: row.path, code: row.code });
              if (row.folders.length === 0) return line;
              return `${line} ${t("row.folders", {
                folders: row.folders.join(", "),
                count: row.folders.length,
              })}`;
            }),
          }))
        : null,
      clean: settled && (verdict?.clean ?? false),
      warnings: failed
        ? [
            // ⚠️ A page saved on the FAILURE screen used to print only "not
            // asked yet" and nothing else, which collapses the one distinction
            // this whole module is built to keep — see `PreexistingResult`.
            // It is not a false all-clear, but it records neither that the
            // check was attempted nor that duplicates are now expected, and it
            // is read later by someone who was not at the screen.
            //
            // NO heading: the section's own H2 is `save.lookupFailedTitle` on
            // this path, and a heading here would print the same statement
            // twice one line apart — the lesson `RulesPageWarning.heading` was
            // made optional for.
            { sentence: t("failed.continueHint"), paths: [] },
          ]
        : settled && uncheckedPaths.length > 0
          ? [
              {
                // The INTRO and no heading — both halves of #26.05's lesson:
                // the sentence carries the remedy and the section already has a
                // title, so a heading here would print it twice.
                sentence: t("unchecked.intro", { count: uncheckedPaths.length }),
                paths: uncheckedPaths,
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
        // ⚠️ Both of these change on the failure path, and both had to. The
        // page prints `notCheckedYet` whenever `violations` is null, so a page
        // saved after a failed lookup said "încă nu s-a verificat" — true, but
        // silent about the fact that it was TRIED — directly above a warning
        // block explaining the failure. And `warningsTitle` is the H2 over that
        // block: "Fișiere care nu au putut fi verificate" over a warning about
        // the archive, naming files, with no file under it.
        notCheckedYet: failed ? t("save.lookupFailed") : t("save.notCheckedYet"),
        warningsTitle: failed ? t("save.lookupFailedTitle") : t("save.warningsTitle"),
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
  }, [asked, blocks, busy, failed, folderName, locale, notes, t, uncheckedPaths, verdict]);

  /**
   * The one live region on this panel, always mounted, so a screen-reader user
   * hears the RESULT of each round.
   *
   * Deliberately EMPTY while the check runs: `ActivityCue` is itself a
   * `role="status"`, and two live regions announcing the same sentence read it
   * twice.
   *
   * THE FAILURE BRANCH IS NOT A TIDY-UP. Without it a lookup that never
   * answered falls through to the matched count and announces the number of
   * documents found — zero — over a screen whose visible content is a red block
   * saying nothing was found out at all. The visible list is correctly hidden
   * at zero, so the lie would be audible only, which is exactly how it would
   * survive.
   */
  const liveSummary = busy
    ? ""
    : failed
      ? t("failed.title")
      : verdict === null || verdict.clean
        ? ""
        : matchedCount > 0
          ? t("reportTitle", { count: matchedCount })
          : // Matched nothing and could not measure everything. Without this
            // branch the announcement is empty over a screen that has an amber
            // block on it, which is the audible-only lie #26.06 recorded.
            t("unchecked.title");

  /**
   * Give the keyboard back when a round ends.
   *
   * Copied deliberately from the three sibling panels rather than abstracted
   * out of them: the tick is cleared at the start of every check, which
   * DISABLES the button the user just pressed, and a disabled element cannot
   * hold focus — so the browser drops it to `<body>` and nothing puts it back.
   * `finished` is the busy → idle edge and sends the keyboard to the tick;
   * `justMounted` is the arrival and sends it to the heading, because the tick
   * sits below the whole listing and `focus()` scrolls.
   *
   * RESTORES focus; it does not seize it. Only when focus is on nothing at all.
   *
   * KNOWN GAPS, both shared with the siblings and both recorded rather than
   * promised away: while the Cancel confirmation is open the wizard marks this
   * subtree `inert`, so a `focus()` here is a no-op and the edge is spent; and
   * a re-check pressed on the Evaluation screen mounts this panel already
   * `busy`, so the arrival edge is spent on a screen that is still checking.
   *
   * ⚠️ **The second gap SHRANK in #29.08, which is why this note was
   * rewritten.** It used to end "if that check comes back clean the panel
   * unmounts in the same commit and the busy → idle edge never fires". A clean
   * check no longer unmounts this panel — it lands on it — so that edge does
   * fire now and the keyboard is handed back. What is left is the arrival edge
   * alone, and that one was already spent on the way in.
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
          arrival. Not reachable by Tab, and NO `outline-none` — that class
          removes the ring for exactly the keyboard user this effect exists
          for. */}
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-lg font-semibold text-ink dark:text-zinc-100"
      >
        {t("title")}
      </h2>
      <p className="mt-1.5 text-sm text-ink dark:text-zinc-300">{t("intro")}</p>

      {/* `aria-busy` says "what you are reading is being recomputed" for the
          moment a check is in flight, during which the previous round's report
          is still on screen. Scoped to the RESULTS, not to the whole panel: it
          holds back live-region updates anywhere in its subtree, and the
          running cue below is a `role="status"`. */}
      <div aria-busy={busy}>

      {/* -- The archive could not be asked -------------------------------- */}
      {failed && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950/30">
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">
            {t("failed.title")}
          </h3>
          <p className="mt-1 text-sm text-red-800 dark:text-red-300">{t("failed.intro")}</p>
        </div>
      )}

      {/* -- What will happen ---------------------------------------------- */}
      {verdict !== null && verdict.matchedCount > 0 && (
        <>
          <h3 className="mt-5 text-sm font-semibold text-ink dark:text-zinc-100">
            {t("reportTitle", { count: matchedCount })}
          </h3>
          <ul className="mt-2 space-y-2">
            {blocks.map((block) => (
              <li
                key={block.id}
                className="rounded-md border border-sky-300 bg-sky-50 px-3 py-2 dark:border-sky-800/60 dark:bg-sky-950/30"
              >
                <p className="text-sm font-semibold text-ink dark:text-zinc-100">
                  {block.title}
                </p>
                <p className="mt-0.5 text-sm text-ink dark:text-zinc-200">{block.intro}</p>
                <RowList rows={block.rows} />
              </li>
            ))}
          </ul>
        </>
      )}

      {/* -- What could not be looked up ----------------------------------- */}
      {uncheckedPaths.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700/60 dark:bg-amber-950/30">
          <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            {t("unchecked.title")}
          </h3>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
            {t("unchecked.intro", { count: uncheckedPaths.length })}
          </p>
          <PathList paths={uncheckedPaths} />
        </div>
      )}

      {(verdict !== null && verdict.matchedCount > 0) && (
        <p className={`mt-3 ${COST_NOTE_CLASS}`}>{t("nothingToFix")}</p>
      )}

      {/* Slice #29.02 — the all-clear, in the place and the treatment its three
          siblings use, and reachable for the first time: see the header note.
          The guards are theirs too. `!busy` keeps the line off a check that is
          still running; `verdict !== null` distinguishes "asked and clean" from
          "not asked", which is what `result === null` means here; and reading
          `verdict` rather than `result` is what keeps a FAILED lookup — which
          arrives as `{ ok: false }` and has no verdict at all — from rendering
          as an archive that holds nothing. Those are two different screens and
          this file's second warning exists because they must never merge. */}
      {!busy && verdict !== null && verdict.clean && (
        <p className="mt-4 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          {t("clean")}
        </p>
      )}

      </div>

      {/* -- The explanations ---------------------------------------------- */}
      {/* Not offered while the explanations are forced open by `nothingToShow`:
          the disclosure reads `notesOpen` and the region reads `showNotes`, and
          during that window they disagree — a control whose state contradicts
          what is on screen is worse than no control. */}
      {asked && !failed && !(busy && nothingToShow) && (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => onNotesOpenChange(!notesOpen)}
            aria-expanded={notesOpen}
            className="text-sm font-medium text-cta underline-offset-2 hover:underline"
          >
            {notesOpen ? t("hideNotes") : t("showNotes")}
          </button>
        </div>
      )}

      {showNotes && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-ink dark:text-zinc-100">
            {t("notesTitle")}
          </h3>
          <ul className="mt-1.5 space-y-2">
            {notes.map((note) => (
              <li
                key={note.id}
                className="border-b border-crease pb-2 last:border-0 dark:border-zinc-800"
              >
                <div className="flex items-baseline gap-2">
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-fade">
                    {note.id}
                  </span>
                  <p className="text-sm text-ink dark:text-zinc-200">{note.requirement}</p>
                </div>
                <RuleExample
                  text={note.example}
                  className="mt-0.5 pl-1 text-xs italic text-fade dark:text-zinc-400"
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* -- The gate ------------------------------------------------------ */}
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

        {/* ⚠️ **THE ONLY WARNING THAT THE NEXT CLICK IS THE ONE THAT COSTS
            MONEY, and #29.08 moved it here from the Evaluation screen with the
            press it describes.** Not drawn before the archive has been asked —
            the button in that state starts the archive lookup, which spends
            nothing — and not drawn when the count is zero, where it would
            promise a spend that is not going to happen. See the
            `classificationCalls` prop for why the number is in the sentence
            rather than on the button. */}
        {/* ⚠️ **DRAWN ONLY ONCE THE ARCHIVE HAS BEEN ASKED, because that is
            when the folder report below this panel appears.** `ReportSections`
            is gated on the same fact in the wizard, so before the check there
            is no report at the foot of the page to send anybody to — an earlier
            draft put this sentence in `intro`, which renders from the first
            arrival, and it told the user to read something that was not on the
            screen and to press a button that was not drawn. Found by the
            adversarial round. */}
        {asked && <p className="mt-3 text-sm text-ink dark:text-zinc-200">{t("readReportFirst")}</p>}

        {asked && classificationCalls > 0 && (
          <p className={`mt-3 ${COST_NOTE_CLASS}`}>
            {/* Two literal `t()` calls rather than one with a computed key,
                and the panel's own copy test is why: it reads this source for
                translator calls made on a string literal and would see neither
                key that way, so a reword that dropped one
                would ship a dotted key path into the shipping locale with every
                test green. The precedent is `continueWithout` / `continue`
                three elements below. */}
            {classificationSpent
              ? t("spendAgain", { count: classificationCalls })
              : t("nothingSpentYet", { count: classificationCalls })}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          {/* Before the archive has been asked, the only thing to do is ask it.
              Afterwards the primary action is to go on — the report is read,
              not fixed — and re-asking becomes the secondary one. */}
          {!asked ? (
            <button
              type="button"
              onClick={onCheck}
              disabled={!acknowledged || busy}
              className={buttonClass({ variant: "primary", size: "lg" })}
            >
              {t("check")}
            </button>
          ) : (
            <>
              {/* ⚠️ **Slice #29.08 REMOVED THE `gated` SUPPRESSION THAT STOOD
                  HERE, and it is a deletion rather than a regression.** #29.02
                  hid this button at a step-through pause, because the pause
                  card below carried the same action enabled. There is no pause
                  on this stage any more: `preexisting-checking → folder-report`
                  was the transition it gated, and that transition no longer
                  exists — every settled archive lookup now lands on THIS
                  screen, which stops on this button. A suppression whose
                  condition can never be true is the kind of guard a later
                  reader deletes the real one instead of; `SELF_ADVANCING_
                  TRANSITIONS` records the same removal from the other end. */}
              <button
                type="button"
                onClick={onContinue}
                disabled={!acknowledged || busy}
                className={buttonClass({ variant: "primary", size: "lg" })}
              >
                {failed ? t("continueWithout") : t("continue")}
              </button>
              <button
                type="button"
                onClick={onCheck}
                disabled={!acknowledged || busy}
                // Deliberately secondary although the primary beside it is
                // often disabled: "Alege alt folder" sits in the same row and
                // is NOT gated on the tick, so promoting this one would make
                // the dead button the largest thing in the row and the live one
                // visually subordinate. (#29.02's adversarial round.)
                className={buttonClass({ variant: "secondary", size: "md" })}
              >
                {t("recheck")}
              </button>
            </>
          )}

          {/* The folder may simply be the wrong one, and it re-enters at
              Structure, because a different folder has passed nothing.

              NOT gated on the tick, for the reason the sibling panels give: the
              tick says "I have read what happens to documents already in the
              system", choosing a different folder is not an acknowledgement
              about this one, and the check it actually starts is the STRUCTURE
              check. */}
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

        {/* Said beside the button rather than only inside the red block above:
            this is the sentence that makes "Continuă" honest, and a user
            scrolled to the buttons must not have to scroll back up for it. */}
        {failed && (
          <p className="mt-2 text-xs text-red-700 dark:text-red-400">
            {t("failed.continueHint")}
          </p>
        )}
      </div>

      {/* -- The take-away copy -------------------------------------------- */}
      <div className="mt-5 border-t border-crease pt-4 dark:border-zinc-800">
        {/* ⚠️ `disabled={busy}` is not tidiness. `settled` is
            `asked && !busy && verdict !== null`, so a Save pressed DURING a
            check writes "not asked yet" into a dated page while the screen
            behind it still shows the previous round's complete report. This
            stage's check is a re-walk, the ~760-call metadata pass and a
            request to the archive, so that window is seconds long and is
            exactly when someone reaches for Save. */}
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
 * The files in one block, truncated for the screen only.
 *
 * The saved page prints all of them — the module header, and #26.01's note on
 * evidence being complete by contract.
 */
function RowList({
  rows,
}: {
  rows: readonly { key: string; path: string; code: string; folders: readonly string[] }[];
}) {
  const t = useTranslations("adminImport.preexisting");
  if (rows.length === 0) return null;

  const shown = rows.slice(0, MAX_PATHS_SHOWN);
  const hidden = rows.length - shown.length;

  return (
    <ul className="mt-1.5 space-y-0.5 pl-1">
      {shown.map((row) => (
        <li key={row.key} className="text-xs text-fade dark:text-zinc-500">
          <span className="truncate font-mono" title={row.path}>
            {row.path}
          </span>
          <span className="ml-1.5 font-mono text-ink dark:text-zinc-300">
            {t("row.existing", { code: row.code })}
          </span>
          {row.folders.length > 0 && (
            <span className="ml-1.5 italic">
              {t("row.folders", {
                folders: row.folders.join(", "),
                count: row.folders.length,
              })}
            </span>
          )}
        </li>
      ))}
      {hidden > 0 && <li className="text-xs italic text-fade">{t("morePaths", { count: hidden })}</li>}
    </ul>
  );
}

/** Plain paths, for the block that has no document to name. */
function PathList({ paths }: { paths: readonly string[] }) {
  const t = useTranslations("adminImport.preexisting");
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
