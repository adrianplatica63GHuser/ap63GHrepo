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
 * ⚠️ **AND SINCE #32.04 THE SCREEN PRUNES ITSELF WHEN THERE IS NOTHING LEFT TO
 * ASK FOR.** See `resultOnly`. Two facts have to hold, not one, and the second
 * is what keeps this out of #26.02's unfixable-message defect: the archive's
 * answer is clean AND the folder report drawn under this panel has nothing to
 * say. Where that report still carries findings the tick and "Verifică din nou"
 * stay, because this panel's re-check is the only control that re-walks the
 * folder after the user has acted on them — and the only other live button
 * spends money on a folder the report may have condemned.
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

import { ImportListingControls } from "./import-listing-controls";
import { buildRulesPageHtml, reportFileName } from "@/lib/import/report-html";
import { downloadHtmlFile, fileNameStamp } from "@/lib/ui/download-html";
import { displayPathOf } from "@/lib/import/folder-utils";
import { stageForPhase } from "@/lib/import/workflow-stages";
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
  /**
   * Nothing is left to ask for: draw the outcome and the press that leaves.
   *                                                            (Slice #32.04)
   *
   * ⚠️ **COMPUTED IN THE WIZARD RATHER THAN HERE, WHICH IS WHERE THE THREE
   * SIBLING PANELS COMPUTE THEIRS — and the difference is not a style
   * choice.** The second half of the condition is a fact about the FOLDER
   * REPORT, which is drawn under this panel by the wizard and is not a prop of
   * it. The wizard therefore has to know the answer in order to decide whether
   * to mount that report at all, and computing it in both places is a rule
   * living twice: the day either copy gains a term, the screen shows a report
   * that says nothing above a panel that has already said it.
   *
   * ⚠️ **AND IT IS NOT `gated`.** The three siblings key theirs on a
   * step-through pause; there is no pause on this stage and there cannot be
   * one — #29.08 removed `preexisting-checking → folder-report` from
   * `SELF_ADVANCING_TRANSITIONS`, because every settled lookup now lands on
   * this screen and a stage that already stops is never gated. A `gated` term
   * copied in from a sibling would be a guard that can never fire.
   *
   * Optional, and `false` by default: a caller that passes nothing — the panel
   * rendered on its own in a test — keeps exactly today's screen.
   */
  resultOnly?: boolean;
  /**
   * The explanations disclosure, hoisted into the wizard for the same reason
   * the other panels' are: this subtree re-renders on every round, and a user
   * who opened the explanations to read them alongside the report must not have
   * them shut on the next check.
   */
  /**
   * The listing's state, and where it comes from.   (Slice #32.10)
   *
   * ⚠️ **`notesOpen` IS THE USER'S OWN ANSWER, OR `null` FOR "THEY HAVE NOT GIVEN
   * ONE".** It was a plain boolean until #32.10 and it could not stay one. Two
   * facts have to be represented and a single boolean can only hold one of
   * them: what the user chose with this panel's own show/hide button, and what
   * the screen should do when they have chosen nothing — which is now two
   * different things depending on whether a check has run.
   *
   * `rulesShown` is the stage bar's own tick: a DEFAULT for a step the user
   * has just arrived at, not a lock. Pressing this panel's button writes
   * `notesOpen` and does not re-tick it, and does not touch the other three steps.
   *
   * The derivation is `notesOpen ?? (asked ? false : rulesShown)`, and the
   * `asked ? false` arm is the behaviour Adrian asked to keep: "if 'Show the
   * Rules' is checked … as it is the current behavior". Before this slice the
   * listing fell open before a check and collapsed after one, so the fix list
   * led — and a run that shipped the tick without that arm would leave every
   * user who changed nothing scrolling past the whole listing to reach what
   * they have to go and put right, on every check, at every step.
   *
   * Hoisted into the wizard for the reason it always was: this subtree
   * re-renders on every turn of the loop, and a user who opened the listing to
   * read it beside their fix list must not have it shut on the next check.
   */
  notesOpen: boolean | null;
  onNotesOpenChange: (open: boolean) => void;
  /** The stage bar's tick — see above. Defaulted so a caller that does not know
   * about it, and the tests that render this panel on its own, keep exactly the
   * screen a first-time visitor met before #32.10: the listing open. */
  rulesShown?: boolean;
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
  resultOnly = false,
  notesOpen,
  onNotesOpenChange,
  rulesShown = true,
}: Props) {
  const t = useTranslations("adminImport.preexisting");
  // Unnamespaced, so the two key helpers can be used as written — they exist
  // precisely so no message path is spelled out in a component.
  const tk = useTranslations();
  /**
   * The step gate's own two namespaces, for the button that leaves.
   *                                                            (Slice #32.04)
   *
   * ⚠️ **THE CAPTION IS BUILT THE WAY `ImportStepGate` BUILDS ITS OWN, and a
   * second literal beside it is exactly what this avoids.** The wizard has one
   * sentence pattern for "continue to the named step"; a `continueToScanning`
   * key here would be a second, and the day either `advance` or the stage
   * vocabulary is relabelled this panel starts telling a business user to press
   * a button that no longer exists under that name. #32.03 applied the same
   * rule to `nextAction`.
   */
  const tGate = useTranslations("adminImport.stepGate");
  const tStage = useTranslations("adminImport.workflow");
  const locale = useLocale();
  const checkboxId = useId();
  const hintId = useId();

  /**
   * ⚠️ **THE STAGE THIS BUTTON NAMES IS SCANARE, NOT EVALUARE.** `onContinue`
   * is `startScan`: the press sends the images, so the screen the user arrives
   * at is the Scanning one, and Evaluation is a press further on — with the
   * step-through toggle ticked the run comes to rest at `scanning`
   * (`SELF_ADVANCING_TRANSITIONS`). Read through `stageForPhase` rather than
   * spelled as a stage id, because phase ids and stage ids are not the same
   * vocabulary — `walking` is the Structure stage — and this way the caption
   * follows the catalogue if the mapping ever moves.
   */
  const advanceLabel = tGate("advance", {
    stage: tStage(`stage.${stageForPhase("scanning")}`),
  });

  const asked = result !== null;
  const failed = result !== null && !result.ok;
  const verdict = result !== null && result.ok ? result.verdict : null;

  /**
   * What the primary button on this screen says — built ONCE and read twice.
   *                                                            (Slice #32.04)
   *
   * ⚠️ **THE MONEY SENTENCE NAMES THIS BUTTON, AND IT MUST NOT NAME IT WITH A
   * SECOND COPY OF THE LABEL.** `nothingSpentYet` and `spendAgain` used to
   * quote „Continuă” as a literal, which was correct until this slice gave the
   * pruned screen a button reading „Continuă la pasul «Scanare»” — the one
   * sentence in the whole flow whose job is to say which click costs money,
   * pointing at a name no button on that screen had. Naming it by POSITION
   * instead ("butonul de mai jos") was worse in the other direction: on every
   * screen that is not pruned there are two more buttons below that sentence,
   * one of which is the free re-walk, and a user who reads the cost as covering
   * "Verifică din nou" stops pressing the only control that re-walks the folder
   * after they have acted on the report.
   *
   * So it is interpolated, the shape `stepGate.nextAction` already uses for
   * exactly this reason — and the same value the button itself renders, so the
   * two can never disagree. All three arms are real: the pruned screen's
   * derived caption, the failed lookup's "Continuă fără această verificare",
   * and the ordinary "Continuă".
   */
  const pressLabel = resultOnly
    ? advanceLabel
    : failed
      ? t("continueWithout")
      : t("continue");

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
   * Before the first check they were the whole content, and after one they
   * collapsed behind "Arată explicațiile" because the report is what the user is
   * reading. ⚠️ Since #32.10 the FIRST half of that is the stage bar's tick to
   * decide, not this panel's. The remaining case is a re-check that mounts this
   * panel with nothing to show — see the sibling panels, where the same window
   * exists, and `showNotes` below for the `asked` term that keeps it out of the
   * first lookup.
   */
  const nothingToShow = matchedCount === 0 && uncheckedCount === 0 && !failed;
  /**
   * Is the listing open? See the `notesOpen` prop for why this is a derivation
   * and not the prop itself.
   *
   * ⚠️ Declared HERE, above the two notes below, and an adversarial round is
   * why: inserted between them and `showNotes` it left the `|| failed` note and
   * the `!resultOnly` note sitting on a declaration that mentions neither.
   */
  const listingOpen = notesOpen ?? (asked ? false : rulesShown);

  /**
   * ⚠️ `|| failed` was added by an adversarial review, and the case it closes is
   * the one where the tick costs the most.
   *
   * On a failed lookup the panel asks the user to re-assert "Am citit ce se
   * întâmplă cu documentele care se află deja în sistem" in order to press
   * "Continuă fără această verificare" — and `asked` has just become true, so
   * without this the four explanations collapse behind a disclosure at exactly
   * that moment. The user was being asked to confirm they had read something
   * the screen had just hidden.
   */
  /**
   * ⚠️ `!resultOnly` leads, exactly as `showRules` does at both sibling panels
   * (#32.01, #32.03). On a pruned screen the explanations describe a question
   * the archive has already answered, and `notesOpen` may still be true from a
   * round the user opened them in.
   */
  /**
   * ⚠️ **THE `!asked` ARM IS GONE, AND THAT IS THE POINT OF #32.10** — see
   * `listingOpen` above for what replaces it and why a tick without it would be
   * a control that appears to do nothing.
   *
   * ⚠️ **`|| failed` IS UNTOUCHED, AND UNTICKING MUST NOT REACH IT.** The first
   * of the two notes above records what it closes: on a failed lookup the panel
   * asks the user to re-assert that they have read the explanations in order to
   * press "Continuă fără această verificare", and collapsing them at that moment
   * is the defect an adversarial round found. A user who unticked the stage
   * bar's tick has said something about the resting screen, not about the one screen that asks them
   * to accept a risk — so `failed` still forces the explanations open, and the
   * row still withholds the toggle for the duration.
   *
   * ⚠️ **AND THE FORCED-OPEN ARM GAINED `asked`, WHICH IS NOT TIDYING.** It
   * covers "a re-check that mounts this panel with nothing to show" — a
   * PREVIOUS round's empty report, which cannot exist before the first lookup.
   * Without `asked` the arm is true throughout that first check, because a null
   * verdict counts zero matches and zero unchecked files: an unticked user would
   * watch the explanations they had just hidden sit open for the whole of the
   * walk, the metadata pass and the request to the archive, with the toggle
   * suppressed. The `!asked` arm this slice removed was what covered that window
   * before.
   */
  const showNotes =
    !resultOnly && (listingOpen || failed || (asked && busy && nothingToShow));

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
          // ⚠️ **THE TITLE THE MATCHED DOCUMENT IS FILED UNDER, and #32.06 is
          // why it is suddenly worth showing.** Before that slice a match
          // GUARANTEED the archive's title equalled the folder's, so the path
          // named the document and this would have been the same string twice.
          // Now the archive side keys on `import_title` while it DISPLAYS
          // `title`, and the AI rewrites `title` for two thirds of the archive
          // — so "→ DOC01511" on its own tells a user nothing about what they
          // just matched. The one remedy the copy offers on a wrong match is
          // "rename your file", and it asks them to notice the match is wrong
          // first. This is the only thing on the screen that lets them.
          title: row.documentTitle,
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
              // ⚠️ The archived title goes on the printed line for the same
              // reason the property folders do, one comment up: the page is
              // carried away to CHECK the import afterwards, and since #32.06
              // the code alone does not say which document was matched.
              const titled = row.title !== null && row.title.trim() !== ""
                ? `${t("row.line", { path: row.path, code: row.code })} ${t("row.archivedTitle", { title: row.title })}`
                : t("row.line", { path: row.path, code: row.code });
              if (row.folders.length === 0) return titled;
              return `${titled} ${t("row.folders", {
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
      : verdict === null
        ? ""
        : verdict.clean
          ? // ⚠️ **THE CLEAN ROUND ANNOUNCED NOTHING UNTIL #32.04, and that was
            // right exactly once.** It was written when a clean lookup did not
            // rest here at all; #29.02 gave it a step-through pause whose card
            // the wizard's own region announced, and #29.08 removed that pause
            // — since when the clean outcome has been announced by nobody. This
            // slice makes the silence acute: on a pruned screen two sections
            // and every control disappear, the keyboard lands on the heading,
            // and a screen-reader user hears the title and nothing about what
            // the archive said. The visible emerald line's own words, so the
            // region and the screen cannot say different things.
            t("clean")
          : matchedCount > 0
            ? t("reportTitle", { count: matchedCount })
            : // Matched nothing and could not measure everything. Without this
              // branch the announcement is empty over a screen that has an
              // amber block on it, which is the audible-only lie #26.06
              // recorded.
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
   *
   * ⚠️ **AND `resultOnly` JOINS `justMounted` IN CHOOSING THE TARGET.**
   * (Slice #32.04, copying #32.03's fix at the Duplication panel.) On a pruned
   * screen `checkboxRef.current` is `null` — the block holding the tick is not
   * rendered — so a busy → idle edge that landed there would `focus()` nothing
   * and leave a keyboard user on `<body>`. The heading is the right target
   * anyway: it is what the screen now consists of.
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
    if (stranded) (justMounted || resultOnly ? headingRef : checkboxRef).current?.focus();
    // `resultOnly` is a dependency because it is read above; it cannot make the
    // effect fire on its own, because every edge this effect acts on is a `busy`
    // edge and it returns early on anything else.
  }, [busy, resultOnly]);

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
      {/* ⚠️ **`intro` DESCRIBES WORK THAT IS ABOUT TO HAPPEN**  (Slice #32.04)
          — it ends "citiți ce urmează să se întâmple, bifați și mergeți mai
          departe", and on a pruned screen there is no list to read and no tick
          to give. Left standing it would send the user looking for controls
          that are not there, which is worse than the blocks it describes.
          `introDone` says what the screen IS instead, and swaps on the same
          condition as everything else — the shape both sibling panels use. */}
      <p className="mt-1.5 text-sm text-ink dark:text-zinc-300">
        {resultOnly ? t("introDone") : t("intro")}
      </p>

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
      {/* ⚠️ Slice #32.10 — the toggle that stood HERE, above the listing, as a
          bare text link drawn only after the archive had been asked, is now the
          left-hand button of the row below the listing. Three rulings travel
          with it and none is weakened: #32.04's, that the toggle goes with the
          listing it opens (the row is inside the same `!resultOnly` wrapper);
          and the two windows in which the explanations are forced open against
          `notesOpen` — a failed lookup, and a re-check with nothing to show —
          where a disclosure reporting `aria-expanded="false"` over an expanded
          region contradicts what the user can see. Both are now
          `showToggle={false}` on the row. */}
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

      {/* ── Show/hide, and the take-away page ────────────────────────────── */}
      {/* ⚠️ Slice #32.10 — Adrian's order: listing, then this row, THEN the
          acknowledgement tick. The take-away used to be last on the panel, below
          a tick asking the user to confirm they had read explanations they may
          have hidden; now it is what a keyboard reaches first after the listing,
          so the report can be saved whether or not the explanations are on
          screen.

          ⚠️ **INSIDE A `!resultOnly` GUARD OF ITS OWN, AS THE TAKE-AWAY WAS.**
          #32.04 hid it on a pruned screen because a dated page printing an empty
          outcome list under a green all-clear has no reader, and #32.10 does not
          revisit that: the stage bar's tick, whichever way it is set, must not bring it back.

          ⚠️ **`showToggle` IS FALSE ON A FAILED LOOKUP TOO**, not only during a
          re-check with nothing to show — see `showNotes` above for why `failed`
          forces the explanations open and why an unticked preference must not
          reach that case. The SAVE half stays up through both windows, which is
          why the flag is on the button rather than on the row; the failed screen
          is precisely one a user wants to carry away. */}
      {!resultOnly && (
        <ImportListingControls
          open={listingOpen}
          onOpenChange={onNotesOpenChange}
          showToggle={!failed && !(asked && busy && nothingToShow)}
          showLabel={t("showNotes")}
          hideLabel={t("hideNotes")}
          saveLabel={t("save.button")}
          saveHint={t("save.hint")}
          onSave={handleSave}
          busy={busy}
        />
      )}

      {/* -- The gate ------------------------------------------------------ */}
      {/* ⚠️ **THE BLOCK STAYS MOUNTED ON A PRUNED SCREEN; ITS TICK DOES NOT.**
          (Slice #32.04.) The three sibling panels drop their whole gate at
          `resultOnly`, because the step-gate card below them carries the
          Continue they give up. This panel has no card under it — there is no
          pause on this stage and there cannot be one, see the `resultOnly`
          prop — so its own Continue is the only way forward and has to survive.
          What goes is everything that asks the user for something: the tick,
          its hint, and the pointer to a folder report that has nothing to say.

          ⚠️ `hintId` is declared on the tick and pointed at by its own
          `aria-describedby`, and both are inside the same conditional — so
          there is no window in which something describes a hint that is not
          rendered. */}
      <div className="mt-5 border-t border-crease pt-4 dark:border-zinc-800">
        {!resultOnly && (
          <>
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
          </>
        )}

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
        {/* ⚠️ **AND `!resultOnly` IS THE OTHER HALF OF THAT SAME RULE.**
            (Slice #32.04.) A pruned screen is precisely one where the wizard
            has NOT mounted the report, so this sentence would again send the
            user to the foot of a page that has nothing at the foot of it. */}
        {asked && !resultOnly && (
          <p className="mt-3 text-sm text-ink dark:text-zinc-200">
            {/* ⚠️ Fixed in passing (#32.04): `{button}`, and it was wrong before
                this slice. The sentence quoted „Continuă” as a literal, and it
                renders on the FAILED screen too — where the primary has read
                "Continuă fără această verificare" since #29.02. So it pointed a
                user at a button that screen does not have, one paragraph above
                the cost sentence this slice had just taught to name the same
                button correctly. `pressLabel` is the button's own value; the
                `!resultOnly` guard means it can only ever be one of the two
                short labels here, never the self-quoting `advanceLabel`. */}
            {t("readReportFirst", { button: pressLabel })}
          </p>
        )}

        {/* ⚠️ **BOTH VARIANTS SURVIVE THE PRUNE, and the branch is not
            decoration.** (Slice #32.04.) On a first run through this is "nu
            s-a trimis nimic încă"; on a re-entry the honest sentence is the one
            saying the previous classification was thrown away and is about to
            be paid for again — this is the one screen in the flow least allowed
            to be wrong about money. The `classificationCalls > 0` guard stays
            too: a folder with nothing left to send gets no cost sentence at
            all, and the pruned page is then the all-clear line and the
            button. */}
        {asked && classificationCalls > 0 && (
          <p className={`mt-3 ${COST_NOTE_CLASS}`}>
            {/* Two literal `t()` calls rather than one with a computed key,
                and the panel's own copy test is why: it reads this source for
                translator calls made on a string literal and would see neither
                key that way, so a reword that dropped one
                would ship a dotted key path into the shipping locale with every
                test green. The precedent is `continueWithout` / `continue`,
                which `pressLabel` above reaches the same way. */}
            {/* …and `button` is that same `pressLabel`, so the sentence names
                the control by the label the control is actually rendering. See
                its declaration for what a literal cost here twice. */}
            {classificationSpent
              ? t("spendAgain", { count: classificationCalls, button: pressLabel })
              : t("nothingSpentYet", { count: classificationCalls, button: pressLabel })}
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
              {/* ⚠️ **IT STOPS READING `acknowledged` ON A PRUNED SCREEN, and
                  that is the whole defect this slice exists to remove.**
                  (Slice #32.04.) A tick that is not drawn can never be given,
                  so a button still gated on it would be permanently disabled on
                  the one screen whose only way forward it is. `busy` stays: a
                  check in flight still makes the press wrong.

                  The caption changes with it. "Continuă" is the label of a
                  button standing under a tick that has just been given; with
                  the tick gone the screen needs the wizard's own "continue to
                  the named step" sentence, which is what the three quiet
                  screens before this one leave the user expecting. */}
              <button
                type="button"
                onClick={onContinue}
                disabled={resultOnly ? busy : !acknowledged || busy}
                className={buttonClass({ variant: "primary", size: "lg" })}
              >
                {pressLabel}
              </button>
              {/* ⚠️ **THE RE-CHECK GOES ONLY WHEN THE REPORT HAS NOTHING TO
                  SAY, and `resultOnly` is what carries that.** (Slice #32.04.)
                  This is the only control anywhere that re-walks the folder
                  after the user has acted on the report below — the check here
                  is a re-walk, the metadata pass and a fresh request to the
                  archive. Take it away while that report still carries findings
                  and the user has been told to go and fix something with no way
                  to have the fix looked at, and the only live button spends
                  money on a folder the report has already condemned. That is
                  #26.02's unfixable message, on the screen where it costs
                  most. */}
              {!resultOnly && (
                <button
                  type="button"
                  onClick={onCheck}
                  disabled={!acknowledged || busy}
                  // Deliberately secondary although the primary beside it is
                  // often disabled: promoting this one would make the dead
                  // button the largest thing in the row and the live one
                  // visually subordinate. (#29.02's adversarial round.)
                  className={buttonClass({ variant: "secondary", size: "md" })}
                >
                  {t("recheck")}
                </button>
              )}
            </>
          )}

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
  rows: readonly {
    key: string;
    path: string;
    code: string;
    /** The title the matched document is filed under. Slice #32.06. */
    title: string | null;
    folders: readonly string[];
  }[];
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
          {/* ⚠️ No `truncate`: on an inline box `overflow-hidden` and
              `text-overflow` are inert and all the class does is forbid
              wrapping — which on the longest titles in the archive
              ("FISA CORPULUI DE PROPRIETATE TARLA 46, PARCELA 222/13/1", 54
              characters, from this slice's own UAT) pushes the row wider
              instead of shorter. It wraps, and the tooltip carries the whole
              string either way. Found by the #32.06 review. */}
          {row.title !== null && row.title.trim() !== "" && (
            <span className="ml-1.5 break-words" title={row.title}>
              {t("row.archivedTitle", { title: row.title })}
            </span>
          )}
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
