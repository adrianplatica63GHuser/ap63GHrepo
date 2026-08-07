/**
 * What renouncing an import actually leaves behind.   (Slice #26.03)
 *
 * The shell offers a Cancel at every stage, and the rule for it is that the
 * user is told what will be left behind and what it costs BEFORE it acts —
 * never after, and never as a generic "are you sure?".
 *
 * That statement cannot be a fixed paragraph, because what is left behind
 * depends entirely on how far the run got. Cancelling on the Information page
 * loses nothing at all; cancelling after the bulk import has written documents
 * leaves those documents in the archive, and saying "nothing will be saved"
 * there would be a lie the user only discovers in the documents list.
 *
 * So this module is a pure function over the facts of the run. It is here
 * rather than inside the dialog for the usual reason: a sentence that promises
 * something about the database has to be testable against the states that
 * actually produce it, and a dialog is not testable that way.
 *
 * The three tones say what the sentence is FOR, not how alarming it is:
 *   keeps — something stays in the system that the user may have to deal with
 *   loses — something is given up, spent or forgotten
 *   safe  — a reassurance; there is nothing to act on
 *
 * `keeps` is the only one that carries an obligation, which is why every
 * `keeps` line is emitted first and a test pins that. A saved report surviving
 * is `safe`, not `keeps`: nobody has to do anything about it.
 */

/**
 * Every sentence this module can produce. Exported as a list, not only as a
 * union, so a test can assert that each one is reachable from some state and
 * has a translation in both locales — a sentence with neither is a sentence
 * that will first be read on the day it is wrong.
 */
export const CANCEL_CONSEQUENCE_IDS = [
  "documentsKept",
  "propertyKept",
  "savedReportKept",
  "classificationStops",
  "classificationAlreadyPaid",
  "folderForgotten",
  "nothingClassifiedYet",
  "filesUntouched",
] as const;

export type CancelConsequenceId = (typeof CANCEL_CONSEQUENCE_IDS)[number];

export type CancelConsequenceTone = "keeps" | "loses" | "safe";

export type CancelConsequence = {
  id: CancelConsequenceId;
  tone: CancelConsequenceTone;
};

/**
 * The facts, as the wizard knows them. Every one is something the wizard can
 * answer without guessing — no derived "probably".
 */
export type CancelFacts = {
  /** A folder handle is held, so cancelling forgets it. */
  folderPicked: boolean;
  /**
   * At least one document has been SENT for automatic classification and the
   * request has settled — whether it came back with an answer or with an
   * error. Both cost the same, which is why the fact is about sending and not
   * about succeeding: a run whose every scan errored has spent exactly as much
   * as one that worked, and telling the user nothing was spent because nothing
   * succeeded is the same lie in the opposite direction.
   */
  classificationSpent: boolean;
  /** The classification pass is running right now and will be stopped. */
  classificationRunning: boolean;
  /** A Property was picked or created for this run. */
  propertyResolved: boolean;
  /**
   * The bulk import has written at least one Document, so records exist that
   * cancelling will not remove.
   *
   * Not "the import dialog was opened": a run that fails on its first create
   * has written nothing, and telling a business user their documents are safe
   * in the archive sends them hunting a list for rows that were never made.
   */
  documentsCreated: boolean;
  /** A previous run's report is saved and survives the cancel. */
  savedReportExists: boolean;
};

/**
 * Ordered heaviest-first: what STAYS in the system, then what is given up,
 * then the reassurance. A user who reads only the first line should read the
 * line that could surprise them, not the one that comforts them.
 */
export function cancelConsequences(facts: CancelFacts): CancelConsequence[] {
  const out: CancelConsequence[] = [];

  // ── What stays behind ────────────────────────────────────────────────────
  if (facts.documentsCreated) out.push({ id: "documentsKept", tone: "keeps" });
  if (facts.propertyResolved) out.push({ id: "propertyKept", tone: "keeps" });

  // ── What is given up ─────────────────────────────────────────────────────
  if (facts.classificationRunning) {
    out.push({ id: "classificationStops", tone: "loses" });
  }
  if (facts.classificationSpent) {
    out.push({ id: "classificationAlreadyPaid", tone: "loses" });
  }
  if (facts.folderPicked) out.push({ id: "folderForgotten", tone: "loses" });

  // ── Reassurances ─────────────────────────────────────────────────────────
  // "Nothing has been classified yet" is only worth saying while it is still
  // the interesting fact. Once a run has spent anything it is not, and the
  // `classificationAlreadyPaid` line above has already covered the ground.
  if (!facts.classificationSpent && !facts.classificationRunning) {
    out.push({ id: "nothingClassifiedYet", tone: "safe" });
  }
  // `safe`, not `keeps`, and the distinction is the point of the tones: a
  // saved report surviving is good news, where a document surviving is the
  // thing the user has to decide about. Grouping it with the warnings would
  // put a caution marker on a sentence nobody needs to act on — and it is why
  // every `keeps` line can be relied on to come first.
  if (facts.savedReportExists) {
    out.push({ id: "savedReportKept", tone: "safe" });
  }
  // Always last, and always present: it is the one thing that is true in every
  // state, and it is the thing a business user is most afraid of. The system
  // never touches the files on disk — only the user does, in File Explorer.
  out.push({ id: "filesUntouched", tone: "safe" });

  return out;
}
