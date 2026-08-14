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
  // …and whether THIS document, read before that form existed, has been read
  // again against it.                                            (Slice #27.06)
  "refillPending",
  "refillDone",
  "refillFailed",
  "refillRetyped",
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
  /**
   * Where this document is in the run's re-read queue, or absent.
   *                                                              (Slice #27.06)
   *
   * ⚠️ **This is a QUEUE POSITION, not a second copy of `ai_interpreted_at`.**
   * The re-read stamps that column exactly as the first read did, and #27.06's
   * constraint forbids a second stamp or a re-read count saying the same thing
   * twice. What the database cannot express is the bit between the click being
   * OFFERED and the click being answered — which documents this screen is still
   * proposing to spend money on — and that lives here, in this dialog's state,
   * for as long as the result screen is open and not one second longer.
   */
  refill?: RefillState;
};

/**
 * The four positions a document can be in the re-read queue.  (Slice #27.06)
 *
 *   - `pending` — the type gained a form and this document was read before it
 *     did. Nothing has been spent; the header is offering to.
 *   - `running` — its call is in flight. Deliberately draws NO note: the status
 *     cell is already blinking, and a row that says "waiting to be read again"
 *     over a read in progress is the screen a beat behind itself.
 *   - `done`    — it was read again, and `aiFieldCount` beside it is now that
 *     read's number rather than the first one's.
 *   - `failed`  — the second read did not fill the columns. Two shapes, one
 *     answer: the call did not happen at all, or it came back `partialWrite` —
 *     the extract succeeded and the GET of the document's current state did not,
 *     so `runAiInterpret` withheld exactly the `customFields` this whole walk is
 *     for. ⚠️ **The first read's fields are still there** either way, which is
 *     why this is its own state rather than `aiStatus: "failed"` — that one's
 *     sentence says the document's fields "au rămas necompletate", and on this
 *     row it is flatly untrue. Offered again, because both causes are transient.
 *   - `retyped` — ⚠️ **the second read happened, was paid for, and did not do
 *     what it was bought for.** Two adversarial rounds converged on this one:
 *     the route may RE-CLASSIFY the document on the same call, and it builds its
 *     prompt from the template of the type the document was on when the POST was
 *     made — so the values come back keyed by the OLD type's form and are then
 *     written onto a document that is on a NEW one. They reach no column the new
 *     form renders. Folded into `done` it drew an emerald "a fost citit din nou"
 *     on the one document the walk achieved nothing for, permanently, in the
 *     saved report; folded into `failed` it would claim a read that did not
 *     happen. It is deliberately NOT re-offered — a second call would re-type it
 *     the same way, and the remedy is a human opening the document and looking
 *     at its type — but it IS counted as outstanding, because the information is
 *     still in Notes.
 */
export type RefillState = "pending" | "running" | "done" | "failed" | "retyped";

/**
 * Is this row one the re-read control may spend a call on?     (Slice #27.06)
 *
 * ⚠️ **EXPORTED BECAUSE THE COUNT AND THE WALK MUST BE ONE EXPRESSION**, which
 * is `canRetryReads`'s own argument and the one this codebase keeps re-learning:
 * a header that offers "re-read 6 documents" over a walk that finds five is a
 * button that never takes the count to zero, and it goes on offering itself for
 * the life of the dialog.
 *
 * ⚠️ **`failed` is IN, and it is the term that looks wrong.** A rate limit at
 * document twelve of forty is this run's commonest failure — `handleRetryInterpret`
 * exists because of it — so a re-read that dropped its casualties would rebuild
 * exactly the dead end #26.09 opened that control to close. Pressing again is
 * the user's decision, made against a sentence that prices it; it is not a loop,
 * because nothing presses it but a person.
 *
 * ⚠️ **IT TESTS EXACTLY WHAT `refillNote` TESTS, AND NOTHING ELSE, and it took
 * two adversarial rounds to get there.** The first draft added a `docId` term
 * that `refillNote` cannot have — `OutcomeRow` carries no document id — and that
 * one extra term put the two out of step in BOTH directions across the two
 * rounds: a row this took and the note refused would be billed while drawing no
 * sentence at all; a row the note took and this refused is counted by
 * `documentsAwaitingRefill`, printed on the row and filed in the saved report
 * while `refillCount` is zero, so the whole header block — sentence and button —
 * is never rendered. Counted by the artefact, reachable by no control.
 *
 * So the `docId` invariant is enforced where it can actually be enforced: at the
 * one set site, which marks only a row that has one. The walk narrows it again
 * anyway and DROPS a row that somehow lacks it, rather than skipping it — a
 * skip would leave the count unable to reach zero, which is the same defect once
 * more.
 *
 * ⚠️ **`status` is REQUIRED, not optional, and that is load-bearing.** With
 * every field optional, `awaitsRefill(anything)` type-checks and quietly answers
 * `false` — including `awaitsRefill(someOutcomeRow)`, which is exactly the call a
 * future reader would write. Requiring the one field every real row has makes
 * the compiler refuse a shape that is not a row.
 *
 * ⚠️ **`retyped` is NOT here, and it is the term that looks missing.** That read
 * happened and was paid for; a second one would re-classify the document the
 * same way and charge again. It is outstanding — `documentsAwaitingRefill`
 * counts it — but the remedy is a person, not this button. See `RefillState`.
 */
export function awaitsRefill(row: {
  refill?: RefillState;
  status: OutcomeRow["status"];
  preexisting?: OutcomeRow["preexisting"];
}): boolean {
  if (row.status !== "done") return false;
  if (row.preexisting !== undefined) return false;
  return row.refill === "pending" || row.refill === "failed";
}

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

/**
 * What became of this document once its type had a form.       (Slice #27.06)
 *
 * ⚠️ **Drawn BESIDE `typeFormAdded`, not instead of it, and the two are
 * different sentences about different things.** "This type gained a form during
 * this import" is a fact about the TYPE and stays true whatever happens next;
 * this is a fact about THIS document — whether the values that went to Notes
 * while the form did not exist have been read again into it. A screen that said
 * only the first would be telling a user the job is done over forty documents
 * whose columns are still empty.
 *
 * ⚠️ **Silent on `running`** — see `RefillState`. The status cell is blinking,
 * and a note contradicting it is worse than no note.
 */
export function refillNote(row: OutcomeRow): OutcomeNote | null {
  if (row.status !== "done") return null;
  // The archive already held it, so this run neither created it nor read it —
  // the same carve-out `readSkipNote` and `typeFormNote` make. A pre-existing
  // row is a document from an earlier run, which #27.06 puts out of scope in as
  // many words.
  if (row.preexisting !== undefined) return null;
  if (row.refill === "pending") return { id: "refillPending", values: {} };
  // ⚠️ Ahead of `done`, because it IS a done read — and the whole point of the
  // state is that saying only "it was read again" is the reassuring half of a
  // sentence whose other half is that nothing reached the columns.
  if (row.refill === "retyped") return { id: "refillRetyped", values: {} };
  if (row.refill === "done") return { id: "refillDone", values: {} };
  if (row.refill === "failed") return { id: "refillFailed", values: {} };
  return null;
}

/** Every note for one row, in the order the row draws them. */
export function outcomeNotes(row: OutcomeRow): OutcomeNote[] {
  // `typeFormNote` fourth, because it is the only one of the first four that is
  // about the document TYPE rather than about this document — and `refillNote`
  // last, because it is what happened AFTER that type gained its form, so it
  // reads as the end of the sentence the one before it starts.
  return [
    coordinateNote(row),
    idCardNote(row),
    readSkipNote(row),
    typeFormNote(row),
    refillNote(row),
  ].filter((note): note is OutcomeNote => note !== null);
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
  /**
   * …and how that type is written in Reference Data.            (Slice #27.07)
   *
   * ⚠️ **A NAME, because a backlog nobody can read is not a backlog.** #27.05
   * counted the types with no form; this is what lets the run SAY which ones,
   * so the same list can be found again in Reference Data. The id is what makes
   * the count distinct and the name is what makes it actionable, so both travel
   * and neither replaces the other.
   *
   * ⚠️ **Optional, and an absent one is COUNTED BUT NOT NAMED.** The run reads
   * every type in the archive before it starts, so in practice every id it
   * meets has a name — but a type invented mid-run by the re-classify route is
   * known to the run by id alone until the end-of-run re-read fills it in, and
   * a run that ended before that read would otherwise print a uuid at a
   * business user. `typesWithoutForm` stays the true count and
   * `typesWithoutFormNames` names what it can, so the two can differ only in
   * that direction — which is the safe one. A list shorter than its own count
   * under-promises; a count shorter than its list is a number nobody can
   * reconcile against the rows above it.
   */
  documentTypeName?: string;
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
   * …and WHICH ones, by name.                                   (Slice #27.07)
   *
   * ⚠️ **NOT a summary line, and it must never become one.** `SUMMARY_LINE_IDS`
   * is walked by `summaryLines`, which reads `summary[id]` as a number and
   * prints it beside a label; a string list there would render `[object
   * Object]` in the concluding message and in the saved report. This is the
   * same fact in the shape a sentence needs, and `runTypeNotes` is what turns it
   * into one.
   *
   * ⚠️ **Distinct, sorted, and possibly SHORTER than `typesWithoutForm`** — see
   * `SummaryRow.documentTypeName` for why an unnamed type is counted and not
   * named, and why that is the safe direction to be incomplete in.
   */
  typesWithoutFormNames: string[];
  /**
   * Documents read before their type had a form, which nobody read again.
   *                                                              (Slice #27.06)
   *
   * ⚠️ **ITS OWN LINE BECAUSE ACCEPTING THE FORM DELETES THE ONE ABOVE IT**, and
   * an adversarial round found what that leaves. `typesWithoutForm` only counts a
   * type while `typeFormMissing` is set, and the acceptance clears that flag on
   * every row of the type at once — so the moment a user reviews a form for
   * forty documents the count drops to zero, `summaryLines` drops the line, and
   * the concluding message reads "40 documente create · 40 citite de AI" over
   * forty documents whose type-specific columns are still empty. The re-read
   * queue lives in this dialog's state and dies with it (see
   * `OutcomeRow.refill`), so without this the last screen of the wizard tells a
   * user who never pressed the button that there was nothing outstanding.
   *
   * Counted off `refillNote`, not off the raw field, so the number and the
   * sentences on the rows are one expression — and it counts every state in
   * which the information is still in Notes, which is one MORE than the button
   * offers: a re-read that re-classified the document did happen and is not
   * worth a second attempt, and is still a document whose columns are empty.
   */
  documentsAwaitingRefill: number;
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
    typesWithoutFormNames: [],
    documentsAwaitingRefill: 0,
  };

  // Distinct TYPES, so a folder of thirty contracts of one new type reports one
  // type waiting for a form rather than thirty. A row with no id falls back to
  // its own identity, which over-counts rather than under-counts — see
  // `SummaryRow.documentTypeId`.
  //
  // Slice #27.07 — a MAP rather than a Set, keyed by exactly the same id, so
  // the names and the count are one walk over one set of rows. Two passes would
  // be two chances to disagree about which rows are still waiting, and this is
  // the number the header prints beside the names it is supposed to explain.
  const typesAwaitingForm = new Map<string, string>();

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
      // Slice #27.07 — ⚠️ **the FIRST name for an id wins, and a later blank
      // never erases it.** The same type reaches this loop once per row, and
      // only some of those rows may carry the name: the id is written by the
      // import loop for every document, while the name arrives from the
      // end-of-run type-list read and can be missing on a row settled before
      // it. `??=`-style first-wins keeps the one row that knew, rather than
      // letting the last row over the type decide whether it can be named.
      const typeKey = row.documentTypeId ?? `row:${typesAwaitingForm.size}`;
      const known = typesAwaitingForm.get(typeKey);
      if (known === undefined || known === "") {
        typesAwaitingForm.set(typeKey, (row.documentTypeName ?? "").trim());
      }
    }

    // Slice #27.06 — read off the NOTE rather than off `row.refill`, so this
    // number is by construction the count of rows that say so. `refillNote`
    // already refuses an errored row, an unfinished one and one the archive
    // already held; asking it is how the concluding message and the table are
    // stopped from describing two different queues. `failed` counts as
    // outstanding for the same reason `awaitsRefill` takes it: the document is
    // still owed a read and the control still offers it.
    const refill = refillNote(row);
    if (
      refill !== null &&
      // ⚠️ `refillRetyped` counts, and it is the one that is not in
      // `awaitsRefill`. The two answer different questions: that one is "may
      // this button spend a call on it", this one is "did this document's
      // information reach its columns". A re-read that re-typed the document is
      // no to the second and no to the first, and dropping it here would let the
      // run conclude that everything landed.
      (refill.id === "refillPending" ||
        refill.id === "refillFailed" ||
        refill.id === "refillRetyped")
    ) {
      summary.documentsAwaitingRefill += 1;
    }
  }

  summary.typesWithoutForm = typesAwaitingForm.size;
  // Slice #27.07 — the same map, said in words. Blanks out, sorted the way the
  // list they send the user to is sorted, and deduped BY NAME on top of the
  // id-keyed map above: two `lookup_document_type` rows sharing a display name
  // is what `sameTypeName` exists to prevent, and printing the same name twice
  // is how a user finds out it happened anyway — from the one screen least able
  // to explain it. The count above still says two.
  summary.typesWithoutFormNames = sortedDistinctNames(typesAwaitingForm.values());

  return summary;
}

/**
 * Trim, drop the blanks, drop the repeats, and sort the way a person reads.
 *                                                              (Slice #27.07)
 *
 * ⚠️ **`localeCompare` with no locale argument, deliberately.** This module is
 * pure and framework-free and must stay so; passing a BCP-47 tag would make the
 * order depend on a value only the caller has, and the caller is a client
 * component whose locale can change under a list that is already on screen. The
 * default collator orders Romanian diacritics acceptably — Ș after S rather
 * than after Z, which is the only failure a user would actually notice — and
 * the alternative, a raw `.sort()` on UTF-16 code units, puts "Ștampilă" after
 * "Titlu de proprietate" and before nothing at all.
 */
function sortedDistinctNames(names: Iterable<string>): string[] {
  const seen = new Set<string>();
  for (const name of names) {
    const trimmed = name.trim();
    if (trimmed !== "") seen.add(trimmed);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

// ---------------------------------------------------------------------------
// What this run did to the document TYPES it met   (Slice #27.07)
// ---------------------------------------------------------------------------

/**
 * One document type, as the run found it and as it stands now.
 *
 * ⚠️ **`hadForm` is the answer `documentTypeHasForm` gave when the run STARTED
 * READING, and nothing here recomputes it.** #27.07's constraint: "gained one
 * during this run" is the difference between that answer before and after the
 * review, which the run already holds. This module is handed both answers
 * rather than either template, because the template a type has *now* is a fact
 * about the server that this module has no way to fetch and no business
 * caching — and because the two booleans are exactly what makes the difference
 * a difference.
 *
 * ⚠️ **A type the run first LEARNED OF after the review must pass
 * `hadForm === hasForm`, and the caller is what enforces it.** A type invented
 * mid-run by the re-classify route appears in no start-of-run list, so the
 * honest thing to say about what it had before is nothing — and the shape that
 * says nothing is a pair of equal booleans, which lands the type in neither
 * list. Defaulting its `hadForm` to `false` would claim every such type "gained
 * a form during this run", including one that has had a form for a year and was
 * simply met for the first time.
 */
export type RunTypeFormChange = {
  /** `lookup_document_type.id` — what makes two rows for one type one type. */
  id: string;
  /** …and how Reference Data writes it. Blank where the run never learned it. */
  name: string;
  /** `documentTypeHasForm` as the run found the type. */
  hadForm: boolean;
  /** …and as it stands at the end of the run. */
  hasForm: boolean;
};

/**
 * The types that gained a custom form during this run, by name.
 *
 * ⚠️ **NOT derived from the rows' `typeFormAdded`, and an adversarial finding in
 * the shipped code is why.** That flag lives on a DOCUMENT and the re-read walk
 * clears it (`bulk-import-dialog.tsx`, the re-type branch) on any row the second
 * read moved onto another type — correctly, because such a row is no longer on
 * the type that gained the form. But "this type gained a form" is a fact about
 * the TYPE, and it stays true whatever afterwards happens to the documents that
 * caused it: on a run where the review covered one document and its re-read
 * re-typed it, every row carrying the flag loses it, and a names list read off
 * the rows would then report that nothing was achieved at all — over a
 * `lookup_document_type` row that has a permanent form the user just built.
 *
 * ⚠️ **Deduped by ID before anything else.** The caller assembles these from a
 * map it maintains across a run, and a duplicated id is the one shape that
 * would let a type appear as both changed and unchanged; the LAST entry wins,
 * because a later entry is a later reading of the same type.
 */
export function typesThatGainedForm(types: readonly RunTypeFormChange[]): string[] {
  const byId = new Map<string, RunTypeFormChange>();
  for (const type of types) byId.set(type.id, type);
  return sortedDistinctNames(
    [...byId.values()].filter((type) => type.hasForm && !type.hadForm).map((type) => type.name),
  );
}

/**
 * Every run-level sentence about document types this module can produce.
 *
 * A catalogue of its own rather than two more entries in `OUTCOME_NOTE_IDS`,
 * and the difference is not filing: those are drawn once per ROW and this pair
 * is drawn once per RUN. `NOTE_TONE` is a total `Record<OutcomeNoteId, string>`
 * whose whole job is to fail the compile when a row note is added without a
 * colour, and folding a run-level id into it would have asked for a colour for
 * a sentence no row draws. Same shape, same both-locale test, separate list.
 */
export const RUN_TYPE_NOTE_IDS = [
  "typesGainedForm",
  "typesStillWithoutForm",
  // ⚠️ **The same fact when the run cannot name all of them**, and it is its own
  // message rather than an argument on the one above because the two make
  // different promises. That one's list IS the backlog; this one's list is part
  // of it, and a sentence that reads as complete over a partial list is how a
  // user concludes they are finished when they are not — see `runTypeNotes`.
  "typesStillWithoutFormPartial",
] as const;

export type RunTypeNoteId = (typeof RUN_TYPE_NOTE_IDS)[number];

/**
 * A run-level type sentence, and what its message interpolates.
 *
 * `count` and `names` both, because the message needs both: the count picks the
 * plural arm and the names are the list.
 *
 * ⚠️ **`count` is the number of TYPES, which is `names`' length for two of the
 * three ids and larger for the third.** An adversarial round found what a
 * single id costs: `typesWithoutForm` counts distinct type IDS and the names are
 * distinct STRINGS, so two `lookup_document_type` rows sharing a display name,
 * or one type the run could not name, put a "2 tipuri" header directly above a
 * one-item list that reads as exhaustive — on screen and permanently in the
 * saved report. `typesStillWithoutFormPartial` is the arm that says the list is
 * a sample; `runTypeNotes` is what chooses between them, so no caller has to.
 */
export type RunTypeNote = {
  id: RunTypeNoteId;
  values: { count: number; names: string };
};

/**
 * The two sentences, in the order the run happened.             (Slice #27.07)
 *
 * What was finished first, then what is left — so the backlog reads as the
 * remainder of the line above it rather than as a complaint on its own.
 *
 * ⚠️ **A name in both lists is resolved in favour of `gained` — BUT ONLY WHILE
 * A NAME SURVIVES, and both halves of that took an adversarial round.** The
 * collision is not one type in two states; accepting a form clears
 * `typeFormMissing` on every row of the id it was accepted for, so that id
 * leaves the backlog before this function sees it. What collides is two
 * `lookup_document_type` ids sharing a display name, one of which gained a form
 * and one of which did not. Dropping the name is right when there is something
 * else to print — a screen listing one name under both headings reads as
 * contradicting itself two lines apart — and wrong when it is the ONLY name,
 * because then the note is not drawn at all and an outstanding type is
 * mentioned nowhere, on screen or in the saved report, under a header still
 * counting it. Looking contradictory beats going silent, so the fallback keeps
 * the name.
 *
 * ⚠️ **An empty list draws NO note.** Same rule as `summaryLines`' dropped
 * zeroes and for the same reason: "0 types gained a form" over an ordinary run
 * is noise, and here it would be noise with a dangling colon after it.
 *
 * The names are joined here rather than by the caller so the count and the list
 * cannot come apart, and because ICU has no way to render an array. ⚠️ **`", "`
 * is punctuation and not prose** — it is the separator in both locales this
 * application ships. A locale that needed another one would move the join to the
 * caller, and would then also own keeping `count` equal to what it joined.
 */
export function runTypeNotes(input: {
  gained: readonly string[];
  withoutForm: readonly string[];
  /**
   * `ImportRunSummary.typesWithoutForm` — the count the header prints.
   *
   * ⚠️ **Passed in rather than inferred, because it counts a different thing
   * from the names and an adversarial round found what that costs.** It is
   * distinct by type ID; the names are distinct by STRING and drop the ones the
   * run could not name. Two archive rows sharing a display name, or one type
   * invented mid-run before the type list could be re-read, and the header says
   * two where the list shows one — which the Romanian reads as exhaustive.
   * Absent means "no separate total", which is the honest default for a caller
   * that has only the names.
   */
  withoutFormTotal?: number;
}): RunTypeNote[] {
  const gained = sortedDistinctNames(input.gained);
  const claimed = new Set(gained);
  const named = sortedDistinctNames(input.withoutForm);
  const unclaimed = named.filter((name) => !claimed.has(name));
  // ⚠️ **The subtraction is skipped rather than allowed to empty the list, and
  // a fourth adversarial round found the silence it otherwise makes.** Two
  // `lookup_document_type` ids share the display name "Contract"; the run gives
  // one of them a form and the other is the whole backlog. `claimed` then
  // removes the only name there is, this note is not drawn at all, and the
  // report reads "Un tip de document a primit un formular în acest import:
  // Contract." over a summary line still saying one type is outstanding — so a
  // user concludes the run finished it. Printing the name under both sentences
  // looks contradictory and IS true: they are two different types. An
  // outstanding type nobody mentions is the worse of the two by a distance.
  const withoutForm = unclaimed.length > 0 ? unclaimed : named;

  // ⚠️ **The total is NOT reduced by what `gained` took, and two adversarial
  // rounds converged on why.** The obvious reading — "that name came off
  // because the type demonstrably has a form now, so take it off the count too"
  // — is only true if the name means the same type ID in both lists, and that
  // overlap is unreachable: accepting a form clears `typeFormMissing` on every
  // row of the id it was accepted for, so that id is already out of the count
  // and out of the names. The overlap that CAN happen is two
  // `lookup_document_type` ids sharing one display name, exactly what
  // `sortedDistinctNames` collapses — and there the subtraction removed a type
  // that is genuinely still waiting, printed the exhaustive Romanian arm over a
  // short list, and left the second row named nowhere on screen or in the saved
  // report. The whole point of taking a total is to be honest when the names
  // are fewer than it; subtracting is that safeguard cancelling itself out.
  //
  // `Math.max` still clamps: a caller passing a stale or smaller total must not
  // produce "1 type" over a two-item list, which is the same unreadable
  // sentence the other way up.
  const total = Math.max(withoutForm.length, input.withoutFormTotal ?? withoutForm.length);

  const notes: RunTypeNote[] = [];
  if (gained.length > 0) {
    notes.push({
      id: "typesGainedForm",
      values: { count: gained.length, names: gained.join(", ") },
    });
  }
  // ⚠️ **Nothing at all when it cannot name even one**, and that is the correct
  // degradation rather than a gap. The count-and-offer header immediately above
  // this block already says how many types are outstanding — it is #27.05's
  // line and it is drawn from the same number — so a nameless "and N more" here
  // would be that sentence said twice, the second time with nothing added.
  if (withoutForm.length > 0) {
    notes.push({
      id: total > withoutForm.length ? "typesStillWithoutFormPartial" : "typesStillWithoutForm",
      values: { count: total, names: withoutForm.join(", ") },
    });
  }
  return notes;
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
  // …and after it, because it is what that one leaves behind.   (Slice #27.06)
  "documentsAwaitingRefill",
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
