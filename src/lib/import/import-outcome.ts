/**
 * What the import RUN did, as facts a screen can read out.   (Slice #26.10)
 *
 * WHY THIS MODULE EXISTS
 * ----------------------
 * Until this slice the result table offered BUTTONS: "Aplică pe proprietate",
 * "Creează persoană din CI". The source document asks for the opposite — the
 * screen describes what was done — and a description is a claim about the
 * database, which is exactly the kind of sentence this codebase keeps out of a
 * render and inside a tested pure function. A button that is wrong does
 * nothing; a sentence that is wrong is believed.
 *
 * So every note the result row draws is decided here, from facts the run
 * recorded, and the component's only job is to look each id up in
 * `messages/*.json`. No Romanian lives in this file, for the reason
 * `report-html.ts` states about itself: a second home for display text is a
 * second version of it.
 *
 * WHAT IT DOES NOT DECIDE
 * -----------------------
 * The notes that already existed and already described rather than offered —
 * `preexistingLinked`, `interpretDone`, `interpretFailed`, `interpretPartial` —
 * stay where they are. This module adds the three families that were a button
 * or a silence: the coordinate file, the identity card, and a document the run
 * deliberately did not read.
 */

// ---------------------------------------------------------------------------
// The order the rows are listed in
// ---------------------------------------------------------------------------

/**
 * What `inResultOrder` needs to know about one row.
 *
 * `pathParts` is `FSEntry.pathParts` — folder segments from the chosen folder,
 * so `pathParts[0]` is the property subfolder for every entry underneath it,
 * `"common"` / `"floating"` for the two shared folders, and absent for a file
 * lying at the root. That is the whole grouping key, and it is deliberately not
 * `EntryAssignment.bucket`: the bucket says which PROPERTY a document is linked
 * to, and two property folders share neither a bucket value nor a heading.
 */
export type OrderableRow = {
  pathParts: readonly string[];
  /** The extension-and-name test. A page-group is never one. */
  isCoordinate: boolean;
};

/**
 * The coordinate file first, inside its own property folder.
 *
 * The source document's reason, in as many words: "since the very first thing
 * will be creating a property from the coordinate text file — the coordinate
 * text file will be listed first in this list". The list is a record of what
 * happened in the order it happened, and the Property is what happened first.
 *
 * ⚠️ **PER FOLDER, not once for the whole table**, and one property folder's
 * coordinate file must not be hoisted above another folder's documents. A run
 * imports up to five properties; a single global hoist would put five
 * coordinate files at the top and then five folders' worth of documents under
 * them, so no row would sit beside the Property it belongs to.
 *
 * Everything else keeps the walk's own order, and the folders keep the order
 * they were first seen in. That matters more than it looks: the walk is
 * depth-first, so a stable grouping is a no-op on a normal folder and only ever
 * repairs one whose entries arrived interleaved.
 */
export function inResultOrder<T>(rows: readonly T[], read: (row: T) => OrderableRow): T[] {
  const groups: { head: T[]; rest: T[] }[] = [];
  const indexByKey = new Map<string, number>();

  for (const row of rows) {
    const { pathParts, isCoordinate } = read(row);
    const key = pathParts[0] ?? "";
    let index = indexByKey.get(key);
    if (index === undefined) {
      index = groups.length;
      indexByKey.set(key, index);
      groups.push({ head: [], rest: [] });
    }
    const group = groups[index];
    if (isCoordinate) group.head.push(row);
    else group.rest.push(row);
  }

  return groups.flatMap((group) => [...group.head, ...group.rest]);
}

// ---------------------------------------------------------------------------
// The notes
// ---------------------------------------------------------------------------

/**
 * Every note this module can produce.
 *
 * Exported as a list for the reason `CANCEL_CONSEQUENCE_IDS` is: a test walks
 * it and asserts each id has a translation in BOTH locales. `DEFAULT_LOCALE` is
 * `ro-RO`, so a missing key does not fall back to English — it renders the raw
 * key path into the shipping UI, on the one screen a business user reads to
 * find out what the system just did to their archive.
 */
export const OUTCOME_NOTE_IDS = [
  // The coordinate file
  "coordinateApplied",
  "coordinateNotApplied",
  // The identity card
  "personCreated",
  "personConfirmed",
  "personPending",
  "personDeclined",
  "personNoProperty",
  "personUnreadable",
  "personStepUnfinished",
  // How far the automatic read got, where it did not run at all
  "readSkippedIdCard",
  "readSkippedNoPage",
  // Whether this document's TYPE has somewhere to put what was read (#27.05)
  "typeFormPending",
  "typeFormAdded",
] as const;

export type OutcomeNoteId = (typeof OUTCOME_NOTE_IDS)[number];

/**
 * A note, and the counts its sentence interpolates.
 *
 * `values` is `{}` rather than absent for a note with no placeholders, so the
 * call site is one expression rather than two branches.
 */
export type OutcomeNote = {
  id: OutcomeNoteId;
  values: Record<string, string | number>;
};

/** The facts one row carries, as the notes below need them. */
export type OutcomeRow = {
  /** `"done"` is the only status that has a story other than the error. */
  status: "pending" | "importing" | "done" | "error";
  /** Set when the archive already held this document — see `ImportResult`. */
  preexisting?: "linked" | "skipped";
  /** The name test: this file COULD hold corners. */
  isCoordinate: boolean;
  /**
   * The Property this file's corners actually built, or null.
   *
   * Straight from `ResolvedRun.cornerSourceByPath`, whose absence already means
   * exactly the three things this note has to be careful about: the folder had
   * no coordinate file, the file parsed to no corners, or the Property's
   * corners are not this file's. In every one of them the honest sentence is
   * the same — this file did not build the Property — and none of the three is
   * an error.
   */
  cornerPropertyCode: string | null;
  cornerCount: number;
  /** The scan says this is an identity card. */
  isIdCard: boolean;
  /**
   * Is there exactly ONE Property a person read off this card could be linked
   * to? False for a card under `common` (several) or `floating` (none) — see
   * `soleProperty` in the dialog.
   */
  canLinkPerson: boolean;
  /** Set once a Person was confirmed or created from this card. */
  personId?: string;
  /** …and whether that person was NEW. `IdCardPersonOutcome.created`. */
  personCreated?: boolean;
  /**
   * The card's question was PUT and closed without a person.
   *
   * A dismissal, an Escape, or a walk into a dead session. Distinct from "not
   * asked yet", because the remedies differ: one is waiting for the queue, the
   * other is waiting for the user to press the header's own control.
   */
  personDeclined?: boolean;
  /**
   * The card's image could not be prepared, so the question was never put.
   *
   * A state of its own rather than a decline, because the remedies are
   * opposite: a decline is the user's answer and re-offering it is nagging,
   * while this is the run failing to ask and the user has to look at the file.
   */
  personFileUnreadable?: boolean;
  /**
   * The card's step WAS opened and did not finish.   (Slice #26.10)
   *
   * ⚠️ **Not the same as `personFileUnreadable`, and an adversarial round
   * merged them for one round before this comment existed.** That flag means
   * the image could not be prepared — a PDF that would not rasterise, a file
   * that is neither image nor PDF — so the question was never put and the card
   * was never queued. This one means the question WAS put and did not come to
   * an end: a rate limit, a 5xx, an expired session, a timeout, or a Person who
   * was created and then failed to link. The image is fine and the step is
   * still in the queue, so the header's own control can offer it again — which
   * is why the two are counted in different places and say different sentences.
   * Telling a user their scan could not be prepared, when what actually
   * happened is that the model was busy, sends them to re-scan a good file.
   *
   * ⚠️ **"UNFINISHED", not "the read failed", and a fourth round is why.** The
   * dialog reports a link that failed AFTER creating a Person through this same
   * channel — nothing was read badly there, and a Person exists — so a name
   * about reading would have been a second false sentence in place of the first
   * one. What every route through it has in common is that the step did not
   * reach an answer this screen can report.
   */
  personStepUnfinished?: boolean;
  /** Why the run did not read this document at all, when it did not. */
  readSkipped?: "id-card" | "no-page";
  /**
   * This document's type has no custom form, so what was read out of it went
   * to Notes instead of to fields.                             (Slice #27.05)
   *
   * ⚠️ **Set only on a document the run actually READ, and the narrowing is
   * deliberate in both directions it excludes.** An identity card is not
   * waiting for a form — CARTE_IDENTITATE's data is captured as real Person
   * records by `src/lib/import/id-card.ts`, and a custom form would put a
   * second, freely-editable copy of somebody's CNP on the document. A file with
   * no page a model can see is not waiting for one either: nothing was read, so
   * nothing went to Notes. Saying "this type has no form" on either would turn
   * a correct and permanent state into a to-do the user cannot close.
   *
   * ⚠️ **The fallback type is excluded too** — see `shouldDiscoverType` in
   * `src/lib/import/discover-run.ts` for the argument. A document on ALTUL is
   * not a document whose type lacks a form; it is a document whose type is
   * wrong, which is a different sentence and #27.04's remedy.
   */
  typeFormMissing?: boolean;
  /**
   * …and the type GAINED one during this run, because the user accepted a
   * discovery review for it.                                   (Slice #27.05)
   *
   * A separate flag rather than the absence of the one above, because the row
   * has to stop saying "waiting for a form" the moment the form exists — a
   * screen that keeps the old sentence over a decision the user has just taken
   * is the screen contradicting itself.
   */
  typeFormAdded?: boolean;
};

/**
 * The coordinate file's note, or null.
 *
 * ⚠️ **Said even on a row the archive already held.** The claim is about the
 * CORNERS, which the property step wrote before this run created or declined to
 * create any document, so it is true whatever the import then did with the file
 * itself. The pre-existing note sits beside it and answers the other question.
 */
export function coordinateNote(row: OutcomeRow): OutcomeNote | null {
  if (!row.isCoordinate) return null;
  // An errored row never reached the archive, and a row still importing has no
  // settled story. Neither is the moment to make a claim about geometry.
  if (row.status !== "done") return null;
  return row.cornerPropertyCode === null
    ? { id: "coordinateNotApplied", values: {} }
    : {
        id: "coordinateApplied",
        values: { code: row.cornerPropertyCode, count: row.cornerCount },
      };
}

/**
 * The identity card's note, or null.
 *
 * Five states, and each one is a different true sentence:
 *
 *   - the person was CREATED from the card — the source document's own example
 *   - the person already existed and was confirmed, so nothing was created
 *   - the card is queued and nobody has been asked yet
 *   - the question was put and closed without an answer
 *   - the card belongs to no single Property, so there is nothing to link to
 *
 * ⚠️ **The last is not a failure and must not read as one.** An owner's carte
 * de identitate under `common` concerns every property in the run; the person
 * flow writes to ONE, so it is not offered — and since #26.09 such a card is
 * read by the model instead, so the row already carries a field count. What was
 * missing was any sentence saying why the person half did not happen.
 */
export function idCardNote(row: OutcomeRow): OutcomeNote | null {
  if (!row.isIdCard) return null;
  if (row.status !== "done") return null;
  // The archive already held it, so this run created no Document for it and
  // every follow-up is suppressed for the reason `ResultRow` records: the id
  // belongs to somebody else's import. (Reachable only in theory — #26.08's
  // carve-out re-imports identity cards deliberately — but a note that depends
  // on another stage's exception is one this module should not be relying on.)
  if (row.preexisting !== undefined) return null;
  if (!row.canLinkPerson) return { id: "personNoProperty", values: {} };
  if (row.personFileUnreadable === true && row.personId === undefined) {
    return { id: "personUnreadable", values: {} };
  }
  if (row.personStepUnfinished === true && row.personId === undefined) {
    return { id: "personStepUnfinished", values: {} };
  }
  if (row.personId !== undefined) {
    return row.personCreated === true
      ? { id: "personCreated", values: {} }
      : { id: "personConfirmed", values: {} };
  }
  return row.personDeclined === true
    ? { id: "personDeclined", values: {} }
    : { id: "personPending", values: {} };
}

/**
 * Why nothing was read off this document, or null when something was.
 *
 * The brief asks for "a note saying how far processing got" on every document.
 * Three of the four states already had one — read, read-and-failed, read-in-
 * part. The fourth said nothing at all, and silence on a screen whose whole
 * subject is what happened reads as a row nobody looked at.
 */
export function readSkipNote(row: OutcomeRow): OutcomeNote | null {
  if (row.status !== "done") return null;
  if (row.preexisting !== undefined) return null;
  // ⚠️ **This says the general read was DECLINED, not that the card was read**,
  // and an adversarial round is why the wording matters here rather than in the
  // locale file alone. `aiSkipReason` records the run's DECISION, taken before
  // the person step is queued and regardless of whether it ever runs — so a
  // card whose image would not open, or whose queue a session expiry
  // suppressed, was read by nothing at all. `idCardNote` beside it is what says
  // how the card itself went.
  if (row.readSkipped === "id-card") return { id: "readSkippedIdCard", values: {} };
  if (row.readSkipped === "no-page") return { id: "readSkippedNoPage", values: {} };
  return null;
}

/**
 * Whether this document's TYPE has anywhere to put what was read out of it.
 *                                                              (Slice #27.05)
 *
 * The run reads every document it can, but a type with no `template_fields`
 * has no columns for the type-specific values — they land in Notes as
 * "[AI] Text neasociat unui câmp" and the document reads "Importat" rather than
 * "Procesat cu AI". That is #26.12's point, said on the row that it happened
 * to: the TYPE is what is unfinished, not the document.
 *
 * ⚠️ **Neither sentence is an ERROR and the row must not draw them as one.**
 * "Has no form" is the correct and permanent answer for a type whose content is
 * the scan itself, and the run offers a review rather than a repair. The
 * caller's severity mapping is what enforces that; this only decides which of
 * the two true sentences applies.
 */
export function typeFormNote(row: OutcomeRow): OutcomeNote | null {
  if (row.status !== "done") return null;
  // The archive already held it, so this run neither created it nor read it —
  // the same carve-out `readSkipNote` makes, for the same reason.
  if (row.preexisting !== undefined) return null;
  // Checked FIRST: the loop clears `typeFormMissing` when a form is accepted,
  // but a row that somehow carried both must say the newer thing rather than
  // leave the user looking at a job it has just watched them finish.
  if (row.typeFormAdded === true) return { id: "typeFormAdded", values: {} };
  if (row.typeFormMissing === true) return { id: "typeFormPending", values: {} };
  return null;
}

/** Every note for one row, in the order the row draws them. */
export function outcomeNotes(row: OutcomeRow): OutcomeNote[] {
  // `typeFormNote` last, because it is the only one of the four that is about
  // the document TYPE rather than about this document.
  return [coordinateNote(row), idCardNote(row), readSkipNote(row), typeFormNote(row)].filter(
    (note): note is OutcomeNote => note !== null,
  );
}

// ---------------------------------------------------------------------------
// The statistics
// ---------------------------------------------------------------------------

/**
 * One row, as the tally reads it. A superset of `OutcomeRow` — the summary
 * counts things no single row's note mentions.
 */
export type SummaryRow = OutcomeRow & {
  /**
   * This card is in the follow-up queue.
   *
   * ⚠️ **`cardsUnanswered` counts THIS and not "is a card with no person",
   * and an adversarial round is why.** The two sets differ in both directions:
   * a card whose image would not open is never queued, and a card the header
   * counts as outstanding must be one the header's own control can actually
   * reach. Two screens in one flow giving two numbers for the same question is
   * the drift this codebase writes single-source tests about.
   */
  idCardQueued?: boolean;
  /**
   * Fields the ID-card step wrote onto the Document.
   *
   * Counted into `fieldsFilled` beside the generic read's, because a card IS
   * read by a model — #23.08 moved that work here precisely because the card
   * path extracts strictly more. Without it a run of nothing but identity cards
   * reported "0 documents read, 0 fields filled" over a run that was almost
   * entirely model-filled.
   */
  idCardFieldsWritten?: number;
  /** The model read this document and wrote fields. */
  aiProcessed?: boolean;
  aiFieldCount?: number;
  /** The read did not finish the job — failed outright, or wrote only part. */
  aiUnread?: boolean;
  /** People this document's read produced, once their stepper had been through. */
  aiPeopleSettled?: number;
  /** …and people it found that nobody has confirmed. */
  aiPeoplePending?: number;
  /**
   * The type this document ended up on.                        (Slice #27.05)
   *
   * ⚠️ **Carried only so `typesWithoutForm` can count TYPES rather than rows**,
   * and the difference is the whole number: thirty documents of one new type
   * are one type waiting for a form, not thirty. An absent id on a row that
   * claims `typeFormMissing` is counted as its own type rather than dropped —
   * under-counting here would tell the user there is nothing left to do.
   */
  documentTypeId?: string;
};

/**
 * What the concluding message says.
 *
 * Every field is a count of rows or of writes, never a derived opinion. The
 * dialog decides which lines are worth drawing (it hides the zeroes); this
 * decides what is true.
 */
export type ImportRunSummary = {
  /** Documents this run created. Excludes everything the archive already held. */
  documentsCreated: number;
  /** Already held, and attached to one of this run's Properties. */
  alreadyLinked: number;
  /** Already held, with nothing to attach it to. */
  alreadySkipped: number;
  /** Rows that did not reach the archive at all. */
  failed: number;
  /** Properties this run's documents were linked to. Passed in by the wizard. */
  properties: number;
  /**
   * …of which this run actually WROTE — created, or gave corners to.
   *
   * ⚠️ **Not a line in the message; a term in `runLandedSomething`.** A second
   * import of a folder whose Properties already exist resolves all of them and
   * writes none, so `properties` alone would answer "yes, something landed" for
   * a run that put nothing in the archive. See `ResolvedProperty.created`.
   */
  propertiesWritten: number;
  /** Coordinate files whose corners built one of those Properties. */
  coordinateFilesApplied: number;
  /** People created from an identity card in this run. */
  peopleCreated: number;
  /** People already in the system, confirmed from a card and linked. */
  peopleConfirmed: number;
  /** Documents a model read — the generic read, or the identity-card one. */
  documentsRead: number;
  /** Fields those reads filled in. */
  fieldsFilled: number;
  /** Documents whose read failed or wrote only part of what it found. */
  documentsUnread: number;
  /** People from document reads that the user linked or created. */
  peopleFromDocuments: number;
  /** …and people a read found that nobody has confirmed. */
  peopleUnconfirmed: number;
  /** Identity cards still waiting for an answer, or declined. */
  cardsUnanswered: number;
  /**
   * Document TYPES this run met that still have no custom form. (Slice #27.05)
   *
   * A count of distinct types, not of rows — see `SummaryRow.documentTypeId`.
   * It is the queue §4 of the 27.01 answer describes, made visible: a type
   * without a form costs exactly one thing, which is that its documents'
   * type-specific values go to Notes instead of to columns.
   *
   * ⚠️ **A zero here is good news and prints nothing**, like every other line
   * but `documentsCreated` — see `summaryLines`.
   */
  typesWithoutForm: number;
  /**
   * Identity cards nobody could be asked about — the image would not open.
   *
   * ⚠️ **Its own line because NOTHING ELSE counts it**, and an adversarial round
   * found the hole: such a card is never queued (so `cardsUnanswered` misses
   * it), its `aiStatus` is `skipped` (so `documentsUnread` misses it) and it has
   * no person (so `documentsRead` misses it). Five cards scanned as `.tiff`
   * produced a concluding message reading "5 documents created" and nothing
   * else, and the only screen that ever mentioned the five missing people was
   * the one the user had just closed.
   */
  cardsUnreadable: number;
};

export function summariseImportRun(
  rows: readonly SummaryRow[],
  properties: number,
  propertiesWritten = 0,
): ImportRunSummary {
  const summary: ImportRunSummary = {
    documentsCreated: 0,
    alreadyLinked: 0,
    alreadySkipped: 0,
    failed: 0,
    properties,
    propertiesWritten,
    coordinateFilesApplied: 0,
    peopleCreated: 0,
    peopleConfirmed: 0,
    documentsRead: 0,
    fieldsFilled: 0,
    documentsUnread: 0,
    peopleFromDocuments: 0,
    peopleUnconfirmed: 0,
    cardsUnanswered: 0,
    cardsUnreadable: 0,
    typesWithoutForm: 0,
  };

  // Distinct TYPES, so a folder of thirty contracts of one new type reports one
  // type waiting for a form rather than thirty. A row with no id falls back to
  // its own identity, which over-counts rather than under-counts — see
  // `SummaryRow.documentTypeId`.
  const typesAwaitingForm = new Set<string>();

  for (const row of rows) {
    if (row.status === "error") {
      summary.failed += 1;
      // An errored row wrote nothing and read nothing. Counting its other
      // fields would be counting a run that did not happen.
      continue;
    }
    if (row.status !== "done") continue;

    if (row.preexisting === "linked") summary.alreadyLinked += 1;
    else if (row.preexisting === "skipped") summary.alreadySkipped += 1;
    else summary.documentsCreated += 1;

    // The corners were written by the property step, before any document
    // existed, so this one is counted whatever happened to the file itself.
    if (row.isCoordinate && row.cornerPropertyCode !== null) {
      summary.coordinateFilesApplied += 1;
    }

    if (row.personId !== undefined) {
      if (row.personCreated === true) summary.peopleCreated += 1;
      else summary.peopleConfirmed += 1;
    } else if (row.personFileUnreadable === true) {
      // Never queued, so no control can reach it — its own line, see the field.
      summary.cardsUnreadable += 1;
    } else if (row.idCardQueued === true) {
      // Includes a read that FAILED: the image is fine and the step is still in
      // the queue, so this card is exactly as outstanding as one nobody has
      // opened yet, and the same control offers it again.
      // Queued and still without a person: never asked, or asked and declined.
      // Exactly what the result screen's header counts and its own control can
      // reach — see `idCardQueued`.
      summary.cardsUnanswered += 1;
    }

    // A card the user answered was read by a vision model, and the fields that
    // read wrote are fields the AI filled in. Counting only `aiProcessed` here
    // made a run of six identity cards report that nothing had been read.
    if (row.aiProcessed === true || row.personId !== undefined) summary.documentsRead += 1;
    summary.fieldsFilled += (row.aiFieldCount ?? 0) + (row.idCardFieldsWritten ?? 0);
    if (row.aiUnread === true) summary.documentsUnread += 1;
    summary.peopleFromDocuments += row.aiPeopleSettled ?? 0;
    summary.peopleUnconfirmed += row.aiPeoplePending ?? 0;

    // ⚠️ `typeFormAdded` is not merely "not missing": the loop clears
    // `typeFormMissing` on every row of a type the moment its form is accepted,
    // and this second test is what keeps the count honest if a future caller
    // sets one without clearing the other.
    // ⚠️ `preexisting` too, so this and `typeFormNote` answer the same question
    // the same way. Unreachable today — a pre-existing row is never read, so
    // nothing sets the flag — but a count with no note behind it is a number on
    // a screen that no row explains, and only one of the two was pinned.
    if (
      row.typeFormMissing === true &&
      row.typeFormAdded !== true &&
      row.preexisting === undefined
    ) {
      typesAwaitingForm.add(row.documentTypeId ?? `row:${typesAwaitingForm.size}`);
    }
  }

  summary.typesWithoutForm = typesAwaitingForm.size;

  return summary;
}

// ---------------------------------------------------------------------------
// Which statistics are worth saying
// ---------------------------------------------------------------------------

/**
 * Every line the concluding message can draw, in the order it draws them.
 *
 * The order is the run's own: what was created, what was already here, what
 * failed, then what the run did BESIDE creating documents — properties,
 * corners, people — and last the two things that are still outstanding.
 */
export const SUMMARY_LINE_IDS = [
  "documentsCreated",
  "alreadyLinked",
  "alreadySkipped",
  "failed",
  "properties",
  "coordinateFilesApplied",
  "peopleCreated",
  "peopleConfirmed",
  "documentsRead",
  "fieldsFilled",
  "peopleFromDocuments",
  "documentsUnread",
  "peopleUnconfirmed",
  "cardsUnanswered",
  "cardsUnreadable",
  // Last, with the other things still outstanding.   (Slice #27.05)
  "typesWithoutForm",
] as const;

export type SummaryLineId = (typeof SUMMARY_LINE_IDS)[number];

/**
 * The lines worth drawing, with their numbers.
 *
 * ⚠️ **A zero is dropped, with ONE exception**, and both halves are deliberate.
 * A concluding message listing "0 people created, 0 corners applied, 0 cards
 * unanswered" over an ordinary run buries the two numbers that matter in a
 * column of noughts, and the ones at the bottom of the list are precisely the
 * ones a zero is good news about. `documentsCreated` always prints, because a
 * run that created nothing is the single most important thing this message can
 * say and the shape where it is missing entirely is the shape where the user
 * walks away believing it worked.
 */
export function summaryLines(
  summary: ImportRunSummary,
): { id: SummaryLineId; value: number }[] {
  return SUMMARY_LINE_IDS.map((id) => ({ id, value: summary[id] })).filter(
    (line) => line.id === "documentsCreated" || line.value > 0,
  );
}

// ---------------------------------------------------------------------------
// Did this run put anything in the archive?
// ---------------------------------------------------------------------------

/**
 * Is there a conclusion worth reporting, and anything worth going to look at?
 * (Slice #26.10)
 *
 * ⚠️ **A run in which everything failed must NOT conclude**, and an adversarial
 * round found the shape: `POST /api/documents` answering 500 for every entry
 * still finishes the loop, so the result screen's Close handed over a summary
 * reading "0 created, 40 failed", under a heading saying the import had
 * concluded, above an invitation to go and check the imported data, with one
 * button that left for the properties list. Leaving the page also unmounts the
 * wizard, so the ~760-call metadata pass and every Haiku scan would have to be
 * paid for again — over a run that wrote nothing at all.
 *
 * `properties` counts, and it is the term that is easy to leave out: the
 * property step writes each Property before the first document exists, so a run
 * whose documents all failed can still have put three real Properties in the
 * archive — which is precisely the case where the user most needs sending to
 * look at them.
 */
export function runLandedSomething(summary: ImportRunSummary): boolean {
  return (
    summary.documentsCreated > 0 ||
    summary.alreadyLinked > 0 ||
    // ⚠️ **`propertiesWritten`, NOT `properties`, and a third round is why.**
    // The step resolves every property folder it settles, including ones it
    // merely matched — so a second import of a folder whose Properties already
    // exist would have answered "yes" here on a run that wrote nothing at all.
    summary.propertiesWritten > 0 ||
    summary.peopleCreated > 0 ||
    summary.peopleConfirmed > 0
  );
}
