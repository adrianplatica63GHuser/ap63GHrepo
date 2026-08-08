/**
 * src/lib/import/duplication-rules.ts — what counts as a duplicate, as one
 * contract.   (Slice #26.06)
 *
 * The third catalogue of the redesign, and deliberately the same shape as the
 * other two: an ID, a requirement, an example, a violation sentence, and no
 * display text anywhere in this file. `structure-rules.ts` says what the folder
 * must BE, `constraint-rules.ts` says what each file must BE, and this says
 * what the folder must not contain TWICE.
 *
 * ⚠️ WITHIN THE CHOSEN FOLDER, AND NOTHING ELSE
 * ─────────────────────────────────────────────
 *
 * Every rule here compares the picked folder against ITSELF. "Is this document
 * already in the archive" is a different question with a different remedy —
 * that one is not a copy to remove, it is a document to LINK — and it has its
 * own stage (Pre-existing, #26.08) reading the database. Nothing in this module
 * or in `duplication-check.ts` may touch the database, and the day one of them
 * needs to, it belongs in the other stage.
 *
 * ⚠️ WHY THE MATCH IS NAME **AND** SIZE, AND WHY F-15 IS GONE
 * ──────────────────────────────────────────────────────────
 *
 * The advisory report carried F-15 (`duplicateBasenames`) since #24.02b: two
 * files with the same name in different folders become two Documents with
 * titles nobody can tell apart. #26.06's brief calls it "the useful half of
 * this" and says to absorb it rather than run both, and this catalogue is where
 * it lands — but the half that was useful is the IDEA, not the test.
 *
 * Matching on name alone cannot survive the new structure rules. Under #26.01
 * a multi-page document is a subfolder whose files are all numbered, so every
 * page group in the archive contains a `1.jpg`, and an archive of forty
 * documents holds forty files called `1.jpg` that have nothing whatever to do
 * with one another. F-15 never saw them — `fileFindings` only ever looked at
 * top-level file entries — and it could stay name-only precisely because it was
 * blind to the case that would have drowned it. A stage that BLOCKS cannot be
 * blind in that way: it is deciding about the whole upload set, pages included,
 * and on a compliant archive a name-only rule would refuse every import there
 * has ever been.
 *
 * Size is what makes the question answerable at that scale. Two scans of
 * different pages are not the same byte count; one file copied twice is. It is
 * evidence rather than proof — which is why every sentence this catalogue ships
 * asks the user to LOOK before removing anything, and why none of them says
 * "delete".
 *
 * ⚠️ AND WHY THERE IS NO "SAME NAME, DIFFERENT SIZE" RULE
 * ──────────────────────────────────────────────────────
 *
 * It is the first thing that suggests itself as F-15's replacement, and on a
 * compliant folder it fires on every page group against every other page group
 * — `1.jpg` here, `1.jpg` there, different sizes, forty of them. It would be a
 * rule that is broken by every correct archive, and the only way past it would
 * be to ignore the stage. A rule nobody can satisfy teaches a user that the
 * stage is noise, which costs more than the title collision it was reporting.
 *
 * The collision itself has not stopped being real; what changed is that it is
 * no longer worth a rule. Documents keep their folder names as tags, so two
 * same-titled Documents remain distinguishable in every list that shows tags —
 * F-15's own message said so — and #26.07 gives each of them a Property as
 * well.
 */

// ---------------------------------------------------------------------------
// The rules
// ---------------------------------------------------------------------------

export type DuplicationRuleId =
  /** The same file, sitting in the chosen folder more than once. */
  | "DUP-01"
  /** The same multi-page document, scanned or copied into two page folders. */
  | "DUP-02";

/** Every rule ID, in listing order — which is also the order they are shown. */
export const DUPLICATION_RULE_IDS: readonly DuplicationRuleId[] = Object.freeze([
  "DUP-01",
  "DUP-02",
] as const);

export type DuplicationRule = {
  id: DuplicationRuleId;
  /**
   * The placeholders this rule's violation sentence interpolates, so a test can
   * prove the message and the checker agree — the same contract
   * `ConstraintRule.counts` carries, and for the same reason: a sentence naming
   * `{sets}` that is handed no `sets` renders the placeholder verbatim to a
   * Romanian user, and nothing type-checks that.
   *
   * ⚠️ Both rules count `sets` — how many separate groups of copies there are —
   * because that is the number of DECISIONS the user has to make, and it is the
   * one a bare file count hides. "18 files appear more than once" and "9 files
   * appear more than once" are the same amount of work when the first is nine
   * pairs and the second is one set of nine.
   */
  counts: readonly string[];
};

/**
 * Every rule, in the order the listing shows them.
 *
 * ⚠️ **Unlike `CONSTRAINT_RULES`, this order is NOT precedence**, and a reader
 * arriving from that module will assume it is. There, a file breaks at most one
 * rule and the array decides which sentence it gets. Here the two rules are
 * about different THINGS — one about files, one about folders — and the
 * precedence between them is structural: a page inside a duplicated page folder
 * is reported once, as part of its folder, and not again on its own. That is
 * enforced in `duplication-check.ts`, where it is visible, rather than encoded
 * in the position of a line here, where it would not be.
 *
 * The listing order is the reading order and nothing else: the simple idea
 * first, the one it does not cover second.
 */
export const DUPLICATION_RULES: readonly DuplicationRule[] = Object.freeze([
  { id: "DUP-01", counts: ["sets", "files"] },
  { id: "DUP-02", counts: ["sets", "folders"] },
] as const satisfies readonly DuplicationRule[]);

/** Lookup by ID, so a caller never re-derives the order or the placeholders. */
export const DUPLICATION_RULE_BY_ID: ReadonlyMap<DuplicationRuleId, DuplicationRule> = new Map(
  DUPLICATION_RULES.map((r) => [r.id, r] as const),
);

// ---------------------------------------------------------------------------
// Where the words live
// ---------------------------------------------------------------------------

/** The three sentences every rule carries. See `duplicationMessageKeyFor`. */
export type DuplicationMessagePart = "requirement" | "example" | "violation";

export const DUPLICATION_MESSAGE_PARTS: readonly DuplicationMessagePart[] = Object.freeze([
  "requirement",
  "example",
  "violation",
] as const);

/**
 * The i18n key for one sentence of one rule. THE only place the message path is
 * written.
 *
 *  - `requirement` — what the folder must not contain twice. Read BEFORE the
 *    check, on the listing the user can save as an offline page.
 *  - `example`     — one bad case and one good one. For this catalogue the
 *    example carries more than usual, because "duplicate" is the word a user is
 *    most likely to think they already understand: it is what distinguishes a
 *    copy from two different pages that happen to be numbered the same.
 *  - `violation`   — read AFTER the check, above the groups of copies, and it
 *    is the one sentence in the redesign that has to ask the user to LOOK
 *    before acting. Every remedy here ends in the same unconditional escape the
 *    constraints use — take it out of the chosen folder — because a user who
 *    cannot decide which copy is the real one must still be able to leave the
 *    loop.
 */
export function duplicationMessageKeyFor(
  id: DuplicationRuleId,
  part: DuplicationMessagePart,
): string {
  return `adminImport.duplication.rule.${id}.${part}`;
}

/**
 * The placeholders a rule's `requirement` and `example` sentences interpolate.
 *
 * Empty for both rules today, and present anyway: it is the seam
 * `constraintListingValues` exists at, the listing is rendered with no
 * violation in sight, and a rule that later quotes a number has one place to
 * get it from. A test walks both locales and fails if a listing sentence asks
 * for something this does not supply.
 */
export function duplicationListingValues(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  id: DuplicationRuleId,
): Record<string, number> {
  return {};
}

/**
 * The numeric placeholders one rule's VIOLATION sentence interpolates.
 *
 * `sets` is how many separate groups of copies the rule found; `files` (DUP-01)
 * and `folders` (DUP-02) are how many things are involved across all of them.
 * Both are needed: the first is the size of the job, the second is what the
 * user counts on screen.
 */
export function duplicationViolationCounts(
  id: DuplicationRuleId,
  sets: number,
  copies: number,
): Record<string, number> {
  return id === "DUP-01"
    ? { sets, files: copies, ...duplicationListingValues(id) }
    : { sets, folders: copies, ...duplicationListingValues(id) };
}
