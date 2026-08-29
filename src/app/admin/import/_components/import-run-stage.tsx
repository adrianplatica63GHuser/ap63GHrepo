"use client";

/**
 * ImportRunStage — the Import stage's screen.   (Slice #26.09)
 *
 * The scan has finished and nothing has been written. This panel is the last
 * thing between the folder and the archive, and its button starts the three
 * steps the source document names in this order: confirm the property for this
 * import, create the tags, then import the files and do everything that can be
 * done to them.
 *
 * WHY IT EXISTS AT ALL, GIVEN THE BUTTON ALREADY DID
 * --------------------------------------------------
 * "Importă" lived in the wizard's toolbar row, pushed to the right with
 * `ml-auto` — a control from the flow that existed before the shell, sitting
 * above a table with no sentence anywhere saying what it would do. Every stage
 * in the Preparation line explains itself and then offers its action; this one
 * offered its action and explained nothing, and it is the only action in the
 * whole workflow that writes to the archive.
 *
 * ⚠️ **THREE STATES, AND THE THIRD IS THE ONE AN ADVERSARIAL ROUND FOUND.**
 * `BulkImportDialog`'s Close returns the wizard to `ready`, which is this
 * panel's own screen — so a first draft re-drew "nothing has been saved yet",
 * the cost of the reads, and a live Import button, immediately after a finished
 * run. Pressing it again would have imported the whole folder a SECOND time:
 * the pre-existing report was computed during the walk and knows nothing about
 * the documents the run just created, so every one of them would be created
 * again and every read paid for again. The panel therefore has to know that a
 * run happened. (The result screen 26.10 builds is what properly replaces this
 * state; until then it says what is true and offers nothing that would repeat.)
 *
 * ⚠️ **THE COUNT OF AI READS IS THE POINT OF THE COST NOTE, and it is new
 * spending this slice introduced.** Until now interpreting a document was a
 * button pressed per row, so a user who never pressed it never paid; from this
 * slice the run reads every readable document by itself. This codebase's
 * standing habit is that the click which costs money says so first — #24.02a
 * exists entirely because choosing a folder used to spend 451 Claude calls in
 * silence — so the number is on the button's own screen, before the click.
 *
 * ⚠️ **`interpretUpperBound` is an UPPER BOUND and is worded as one.** The run
 * skips a document whose type is an identity card *when* the person action can
 * act on it, and whether it can depends on which property the entry belongs to
 * — an answer the property step has not produced yet at the moment this screen
 * is on. `shouldInterpretEntry` is the one predicate both this count and the
 * loop use; what it cannot know here is the second argument.
 */

import { useTranslations } from "next-intl";

import { buttonClass } from "@/lib/ui/button-styles";
import { COST_NOTE_CLASS } from "@/lib/ui/cost-note";

/**
 * Where this stage stands.
 *
 *  - `ready`   — the scan is done, nothing is written, the button is live.
 *  - `running` — one of the stage's three modal steps owns the screen. The
 *    panel is visible underneath them, so its SENTENCES have to be true then
 *    too, and the earliest of the three is where that bites: the property step
 *    writes each Property as it reaches it, so by the time anyone reads this
 *    the run may have created some, all, or none of them. The copy therefore
 *    says what is safe in all three — that whatever HAS been written stays —
 *    rather than counting.
 *  - `done`    — a run finished and its dialog was closed. See the header.
 */
export type ImportRunState = "ready" | "running" | "done";

type Props = {
  folderName: string;
  state: ImportRunState;
  /**
   * This run has already put a Property in the archive.   (Slice #26.09)
   *
   * Only ever true at `ready`, and only by one route: the property step creates
   * each Property as it goes, and cancelling out of it comes back here. Without
   * it this screen tells a user that nothing has been saved while the toolbar
   * two rows above shows the chip of the property they just made.
   */
  propertiesCreated: boolean;
  /**
   * Already-translated summary of the finished scan, or null when there was
   * nothing scannable. Handed in rather than rebuilt so
   * `adminImport.wizard.scanComplete` stays the one place that sentence lives.
   */
  scanSummary: string | null;
  /** Documents this run will create. Excludes what the archive already holds. */
  documentCount: number;
  /** At most this many documents will be read by the model — see the header. */
  interpretUpperBound: number;
  /**
   * The user pressed "continue without forms" on the stop screen, and these are
   * the two numbers that press committed to.                    (Slice #32.05)
   *
   * `null` on every ordinary run. Both come off the gate's verdict, which the
   * wizard is already holding — `missingForm.length`, and the sum of
   * `documentCount` across it. This panel counts nothing.
   *
   * ⚠️ **It is NOT a cost line, so it does not wear `COST_NOTE_CLASS`.** The
   * waiver spends LESS: no discovery read is bought for a waived type. What it
   * is is a statement about what the archive will hold afterwards, which is the
   * other thing this screen must not be vague about.
   */
  waived: { types: number; documents: number } | null;
  /** False when the walk produced nothing at all; the button has no subject. */
  canImport: boolean;
  onImport: () => void;
  /**
   * Start another import, from the beginning, with a folder of the user's
   * choosing.                                                 (Slice #32.04)
   *
   * ⚠️ **THE HANDLER IS THE WIZARD'S FOLDER PICKER AND THE NAME SAYS SO; THE
   * BUTTON'S LABEL NO LONGER DOES.** #32.04 took "Alege alt folder…" off every
   * other screen in the flow — mid-run, changing folder is either a cancel or a
   * restart, and the wizard has both; even the Structure stage, whose own work
   * is choosing a folder, keeps only its first-press "Alege folderul…". This
   * screen is the one place the control must not simply vanish: after a
   * finished run it is the only way out of the page. What was wrong here was
   * the label, not the control, because at that point in the flow it is not
   * what the button means.
   */
  onChooseFolder: () => void;
};

export function ImportRunStage({
  folderName,
  state,
  propertiesCreated,
  scanSummary,
  documentCount,
  interpretUpperBound,
  waived,
  canImport,
  onImport,
  onChooseFolder,
}: Props) {
  const t = useTranslations("adminImport.importRun");

  const finished = state === "done";

  return (
    <section className="rounded-xl border border-card-rim bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold text-ink dark:text-zinc-100">{t("title")}</h2>
      <p className="mt-1.5 text-sm text-ink dark:text-zinc-300">
        {/* One sentence per state, never a sentence that has to be read
            charitably. "Nothing has been saved yet" is false the moment the
            property step opens and catastrophic once a run has finished. */}
        {state === "ready"
          ? propertiesCreated
            ? t("introWithProperties", { folder: folderName })
            : t("intro", { folder: folderName })
          : state === "running"
            ? t("introRunning", { folder: folderName })
            : t("introDone", { folder: folderName })}
      </p>

      {!finished && scanSummary !== null && (
        <p className="mt-1.5 text-sm text-fade dark:text-zinc-400">{scanSummary}</p>
      )}

      {!finished && (
        <>
          <h3 className="mt-5 text-sm font-semibold text-ink dark:text-zinc-100">
            {t("stepsTitle")}
          </h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink dark:text-zinc-300">
            <li>{t("stepProperty")}</li>
            {/* Only when something will be created. A run that only LINKS
                documents the archive already holds tags nothing, and a list
                promising otherwise beside "no new document is created" is two
                sentences describing different runs. */}
            {documentCount > 0 && <li>{t("stepTags")}</li>}
            <li>{t("stepFiles", { count: documentCount })}</li>
            {interpretUpperBound > 0 && <li>{t("stepInterpret")}</li>}
          </ol>

          {/* Louder than the list above it on purpose: this is the sentence
              that says the click costs money, and the three sentences with that
              job on the Evaluation screen already share this class rather than
              each picking their own grey. Absent, rather than saying "zero",
              when there is nothing to read. */}
          {interpretUpperBound > 0 && (
            <p className={`mt-3 ${COST_NOTE_CLASS}`}>
              {t("costNote", { count: interpretUpperBound })}
            </p>
          )}
          <p className="mt-1.5 text-sm text-ink dark:text-zinc-300">{t("writesNote")}</p>
          {/* Beside `writesNote` because it is the same kind of sentence: what
              this run will and will not put in the archive. Inside `!finished`
              with it, too — once a run is over the result screen's own header
              is what reports the formless types, and a forecast repeated over a
              finished run is the failure the three intro states above exist to
              stop. */}
          {waived !== null && (
            <p className="mt-1.5 text-sm text-ink dark:text-zinc-300">
              {t("waivedNote", { types: waived.types, documents: waived.documents })}
            </p>
          )}
        </>
      )}

      {finished && (
        <p className="mt-3 text-sm text-ink dark:text-zinc-300">{t("doneNote")}</p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {/* Not rendered once a run has finished, rather than rendered disabled.
            A greyed "Importă" invites the question "why can't I?"; the sentence
            above has already answered a question the user did not have to ask. */}
        {!finished && (
          <button
            type="button"
            onClick={onImport}
            disabled={state !== "ready" || !canImport}
            className={buttonClass({ variant: "primary", size: "lg" })}
          >
            {t("importButton")}
          </button>
        )}

        {/* ⚠️ **ONLY ONCE A RUN HAS FINISHED, SINCE #32.04, AND IT IS THE
            PRIMARY THERE.** It used to be live in every state but `running`,
            as the four stage panels before this one each carried the same
            control. Those four have lost it: mid-run, "choose another folder"
            is a third route beside Cancel and restart that says which of the
            two it is, and the source request calls it out by name. Here the
            press is the only way out of a page whose run is over, so what came
            off is the LABEL — at this point in the flow the button does not
            mean "change the folder of this import", it means start another
            one. The `disabled` went with the other states: `finished` and
            `running` are exclusive. */}
        {finished && (
          <button
            type="button"
            onClick={onChooseFolder}
            className={buttonClass({ variant: "primary", size: "lg" })}
          >
            {t("startAnotherImport")}
          </button>
        )}
      </div>

      {!finished && !canImport && (
        <p role="status" className="mt-3 text-sm text-red-700 dark:text-red-400">
          {t("nothingToImport")}
        </p>
      )}
    </section>
  );
}
