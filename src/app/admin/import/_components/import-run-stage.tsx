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
import { COST_NOTE_CLASS } from "./folder-forecast";

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
  /** False when the walk produced nothing at all; the button has no subject. */
  canImport: boolean;
  onImport: () => void;
  onChooseFolder: () => void;
};

export function ImportRunStage({
  folderName,
  state,
  propertiesCreated,
  scanSummary,
  documentCount,
  interpretUpperBound,
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

        {/* The folder may simply be the wrong one — and after a finished run
            this is the way to start another, which is why it is live in every
            state but `running`. It re-enters at Structure, because a different
            folder has passed nothing. The four stage panels before this one
            each carry the same control for the same reason; it used to be the
            toolbar's, which put a way round every one of their ticks two rows
            above them. */}
        <button
          type="button"
          onClick={onChooseFolder}
          disabled={state === "running"}
          className={buttonClass({
            variant: finished ? "primary" : "secondary",
            size: finished ? "lg" : "md",
          })}
        >
          {t("chooseAnotherFolder")}
        </button>
      </div>

      {!finished && !canImport && (
        <p role="status" className="mt-3 text-sm text-red-700 dark:text-red-400">
          {t("nothingToImport")}
        </p>
      )}
    </section>
  );
}
