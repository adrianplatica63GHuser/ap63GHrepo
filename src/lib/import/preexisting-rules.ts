/**
 * src/lib/import/preexisting-rules.ts — what "already in the system" means, as
 * one contract.   (Slice #26.08)
 *
 * The fourth catalogue of the redesign, and the first one that is NOT a list of
 * things the user must put right. `structure-rules.ts` says what the folder
 * must BE, `constraint-rules.ts` says what each file must BE, and
 * `duplication-rules.ts` says what the folder must not contain TWICE — three
 * catalogues of REQUIREMENTS, each ending in a trip to File Explorer.
 *
 * This one is a list of NOTES. The user is not asked to change anything: the
 * archive already holds some of these documents, that is a perfectly ordinary
 * state of affairs, and the only thing they have to do about it is read what
 * the import is going to do and say they have read it. So the parts are
 * `explanation` and `example` rather than `requirement`, `example` and
 * `violation`, and there is no violation sentence anywhere in this module —
 * because nothing here is a violation.
 *
 * ⚠️ **THE STAGE DOES NOT BLOCK, AND THAT IS THE DESIGN RATHER THAN AN
 * OMISSION.** The three stages before it refuse the folder because a folder
 * that breaks them cannot be imported correctly. A document that is already in
 * the archive breaks nothing — the source document's own words are "they will
 * not be imported again … the currently existing document will be linked to
 * this new property". There is nothing for the user to fix, so a fix-and-
 * re-check loop here would be a loop with no exit condition of its own.
 *
 * WHY THE OUTCOMES LIVE HERE AND NOT IN THE CHECKER
 * ─────────────────────────────────────────────────
 * `preexisting-check.ts` decides what happens to each file; this module owns
 * the NAMES of those decisions and the message path each one's sentences live
 * at, exactly as the three catalogues before it own their rule ids. A checker
 * that spelled out `adminImport.preexisting.outcome.link.title` would be the
 * second place the message path is written, and the two would drift the first
 * time a section was renamed.
 */

// ---------------------------------------------------------------------------
// The notes
// ---------------------------------------------------------------------------

export type PreexistingNoteId =
  /** What makes the system say a document is already here. */
  | "PEX-01"
  /** What happens to it: not imported again, and linked to the property instead. */
  | "PEX-02"
  /** Identity cards are imported again anyway, and why. */
  | "PEX-03"
  /** Coordinate files are imported again anyway, and why. */
  | "PEX-04";

/** Every note, in listing order — which is also the order they are shown. */
export const PREEXISTING_NOTE_IDS: readonly PreexistingNoteId[] = Object.freeze([
  "PEX-01",
  "PEX-02",
  "PEX-03",
  "PEX-04",
] as const);

export type PreexistingNote = {
  id: PreexistingNoteId;
  /**
   * The placeholders this note's sentences interpolate, so a test can prove the
   * copy and the code agree — the same contract `ConstraintRule.counts` and
   * `DuplicationRule.counts` carry, and for the same reason: a sentence naming
   * `{count}` that is handed no `count` renders the placeholder verbatim to a
   * Romanian user, and nothing type-checks that.
   *
   * Empty for all four today. Present anyway, because it is the seam
   * `preexistingListingValues` exists at and a note that later quotes a number
   * has exactly one place to get it from.
   */
  values: readonly string[];
};

/**
 * Every note, in the order the listing shows them.
 *
 * ⚠️ **The order is the READING order and carries no precedence** — the same
 * warning `DUPLICATION_RULES` carries, and here it is even less negotiable,
 * because these are not tests that a file can pass or fail. It is one argument
 * in four steps: what counts as already here, what we do about it, and the two
 * kinds of document we deliberately do the opposite for.
 *
 * The two exceptions come LAST on purpose. A reader who meets "identity cards
 * are imported again" before they have read what "already here" means has been
 * handed an exception to a rule they have not been told yet.
 */
export const PREEXISTING_NOTES: readonly PreexistingNote[] = Object.freeze([
  { id: "PEX-01", values: [] },
  { id: "PEX-02", values: [] },
  { id: "PEX-03", values: [] },
  { id: "PEX-04", values: [] },
] as const satisfies readonly PreexistingNote[]);

/** Lookup by ID, so a caller never re-derives the order. */
export const PREEXISTING_NOTE_BY_ID: ReadonlyMap<PreexistingNoteId, PreexistingNote> = new Map(
  PREEXISTING_NOTES.map((n) => [n.id, n] as const),
);

// ---------------------------------------------------------------------------
// Where the words live
// ---------------------------------------------------------------------------

/** The two sentences every note carries. See `preexistingMessageKeyFor`. */
export type PreexistingMessagePart = "explanation" | "example";

export const PREEXISTING_MESSAGE_PARTS: readonly PreexistingMessagePart[] = Object.freeze([
  "explanation",
  "example",
] as const);

/**
 * The i18n key for one sentence of one note. THE only place the message path is
 * written.
 *
 *  - `explanation` — what the system does, in the words of someone describing
 *    a decision rather than stating a rule. Read BEFORE the check, on the
 *    listing the user can save as an offline page.
 *  - `example`     — one concrete case. It carries more weight in this
 *    catalogue than in the others, because "already in the system" is invisible
 *    to the user: they cannot open File Explorer and look at the archive.
 */
export function preexistingMessageKeyFor(
  id: PreexistingNoteId,
  part: PreexistingMessagePart,
): string {
  return `adminImport.preexisting.note.${id}.${part}`;
}

/**
 * The placeholders a note's sentences interpolate.
 *
 * Empty for all four notes today, and present for the reason
 * `duplicationListingValues` is: it is where a number would come from, and a
 * test walks both locales and fails if a sentence asks for something this does
 * not supply.
 */
export function preexistingListingValues(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  id: PreexistingNoteId,
): Record<string, number> {
  return {};
}

// ---------------------------------------------------------------------------
// The outcomes — what the import will actually do with each matched file
// ---------------------------------------------------------------------------

/**
 * What happens to a file the archive already holds.
 *
 * ⚠️ **These are PROMISES about the import run, not descriptions of a screen.**
 * Each one names a branch `bulk-import-dialog.tsx` takes, and the screen exists
 * to say which branch each file is in before it happens. If the two ever
 * disagree the stage is worse than absent: it would be a system telling a
 * business user that a document will not be imported and then importing it, or
 * — the expensive direction — that it will be linked to their property and then
 * silently linking nothing.
 *
 *  - `link`     — not imported again; the Document already in the archive is
 *                 linked to the Property this run creates for the file's own
 *                 folder. The source document's sentence, exactly.
 *  - `skip`     — not imported again, and there is no property to link it to:
 *                 the file sits under `floating`, or under a `common` folder in
 *                 a run that resolves no properties at all. Nothing happens.
 *  - `reimport` — imported again anyway, on purpose. See
 *                 `PreexistingReimportReason`.
 */
export const PREEXISTING_OUTCOMES = ["link", "skip", "reimport"] as const;

export type PreexistingOutcome = (typeof PREEXISTING_OUTCOMES)[number];

/**
 * Why a file the archive already holds is imported a second time.
 *
 * ⚠️ **`id-card` IS THE SLICE'S NAMED CONSTRAINT, and its reasoning is
 * deliberate rather than defensive.** Adrian's words: the one in the system may
 * be expired, and a duplicate person in the archive is better than a missing
 * one. The failure being bought off is not "a document is imported twice" — it
 * is a match on name and size that happens to be WRONG, on the one kind of file
 * where being wrong costs a person. Two people's cards scanned on one machine
 * into two files called `Buletin.jpg` are the same number of bytes by
 * construction (an uncompressed scan's size is fixed by its dimensions and bit
 * depth alone — see `duplication-check.ts`, which learned this the hard way),
 * so the match would claim the second card is the first, and that person would
 * never enter the archive at all. The copy therefore also asks the user to make
 * a note and check after the import, which is the other half of the
 * constraint.
 *
 * ⚠️ **`coordinates` IS NOT IN THE BRIEF, and it is a correctness fix rather
 * than a second helping of caution.** A coordinate file whose corners land on a
 * Property must have a Document for `property_corner_source` to point at:
 * that column is NOT NULL, the claim happens in the import loop the moment the
 * Document exists (`bulk-import-dialog.tsx`, step 3.5), and it is the whole
 * mechanism #23.06 added to stop the Process panel building a SECOND Property
 * on top of this run's. Skipping the coordinate file as "already here" would
 * leave the corners written and the source unclaimed — reopening that hole
 * silently, in the one stage whose job is to say what the import will do.
 *
 * The cheaper reading — "claim the source on the EXISTING document instead" —
 * was rejected: that document may already be the recorded origin of a different
 * Property, in which case the claim conflicts and the row fails, and a stage
 * that cannot promise its own outcome should not make the promise.
 */
export const PREEXISTING_REIMPORT_REASONS = ["id-card", "coordinates"] as const;

export type PreexistingReimportReason = (typeof PREEXISTING_REIMPORT_REASONS)[number];

/**
 * The three blocks the report is made of.
 *
 * A section id rather than an outcome, because `reimport` splits into two
 * blocks with different sentences and a different instruction — the identity
 * cards ask the user to go and check afterwards, the coordinate files do not.
 */
export const PREEXISTING_SECTIONS = ["link", "skip", "id-card", "coordinates"] as const;

export type PreexistingSectionId = (typeof PREEXISTING_SECTIONS)[number];

/** Which block a row is drawn in. One expression, so the screen holds no copy. */
export function preexistingSectionOf(
  outcome: PreexistingOutcome,
  reason: PreexistingReimportReason | null,
): PreexistingSectionId {
  if (outcome !== "reimport") return outcome;
  // `?? "id-card"` is a narrowing over a state the checker never produces — a
  // `reimport` row always carries its reason — and it is a fallback rather than
  // a throw because the worst outcome of guessing here is a row drawn under the
  // wrong heading, while a throw takes the whole report down.
  return reason ?? "id-card";
}

export type PreexistingSectionPart = "title" | "intro";

export const PREEXISTING_SECTION_PARTS: readonly PreexistingSectionPart[] = Object.freeze([
  "title",
  "intro",
] as const);

/**
 * The i18n key for one sentence of one block of the report. THE only place this
 * message path is written.
 *
 *  - `title` — the heading over the block.
 *  - `intro` — what will happen to the files listed under it, and, for the two
 *    `reimport` blocks, why it is happening. The identity-card one is the
 *    sentence the slice's constraint asks for by name.
 */
export function preexistingSectionKeyFor(
  section: PreexistingSectionId,
  part: PreexistingSectionPart,
): string {
  return `adminImport.preexisting.section.${section}.${part}`;
}

/**
 * The numeric placeholders one block's sentences interpolate.
 *
 * `count` is how many files are in the block, and every block's `title` and
 * `intro` may use it. One shape for all four, because the four blocks answer
 * the same question about different files — unlike the duplication counts,
 * where `sets` and `files` are genuinely different numbers.
 */
export function preexistingSectionCounts(
  section: PreexistingSectionId,
  count: number,
): Record<string, number> {
  // The section is not read today. It is a parameter so that the day one block
  // quotes a second number, every call site already passes the thing that
  // decides — the alternative is a signature change at four call sites and a
  // test that was never written.
  void section;
  return { count };
}
