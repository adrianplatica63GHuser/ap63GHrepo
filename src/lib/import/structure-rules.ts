/**
 * src/lib/import/structure-rules.ts — what a folder must look like before it
 * can be imported.   (Slice #26.01)
 *
 * Pure, and deliberately inert. It walks nothing, reads nothing and decides
 * about no real folder. It is the CONTRACT: the list of rules, the vocabulary
 * they are written in, and the shape of the answer when one is broken. #26.02
 * enforces it against a picked folder; #26.04 puts it on the screen.
 *
 * WHY THE RULES EXIST AT ALL
 * ──────────────────────────
 *
 * Everything under src/lib/import/ before this slice is the system trying to
 * work out what the user MEANT from a folder shape nobody had agreed on. That
 * is where the danger came from: `checks.ts` holds a threshold whose first
 * draft would have told a user to delete nineteen of twenty properties, and a
 * truncation message whose first draft said the opposite of the truth. Both
 * are inference dressed as certainty.
 *
 * The rules below replace inference with a contract. The user is responsible
 * for the folder shape; the system's only job is to say, in Romanian a
 * non-technical person can act on, exactly which folder is wrong and exactly
 * what to rename or move. Unlike `checks.ts`, whose findings are advisory and
 * never block, a structure violation stops the import until it is fixed — and
 * that is affordable precisely because every rule below asks for one thing and
 * can be answered from names alone.
 *
 * THE ADMISSION TEST: NAMES ALONE
 * ───────────────────────────────
 *
 * A rule belongs here only if a listing of folder and file names answers it.
 * This is not a convenience, it is what makes the stage possible: Structure
 * runs before a single byte is read and before Haiku has seen anything, so a
 * rule that needs file CONTENT cannot be checked at the moment it is shown.
 *
 * The source document asked for one that fails the test — "ID card scans sit
 * directly under the property folder, never inside a subfolder". Whether a
 * JPEG is an identity card is not known until classification runs several
 * stages later, so here it could only be enforced through a filename
 * convention nobody would follow. Adrian's decision: DROPPED. Recorded so the
 * next reader of the source document does not re-derive it and quietly re-add
 * an unenforceable rule.
 *
 * ⚠️ THE RULES MUST AGREE WITH THE WALK, NOT MERELY WITH THE SOURCE DOCUMENT
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The single most important property of this module, and the easiest to lose.
 * A rule that accepts a folder the walk then treats differently is worse than
 * no rule: the user is told the folder is correct, the import reports success,
 * and the data is wrong — which is the exact failure this redesign exists to
 * remove. The mirror image is just as bad: a rule that BLOCKS on something the
 * walk would have removed anyway sends the user to File Explorer to fix a file
 * that was never going to be imported.
 *
 * So this module states nothing about a file that the walk already answers.
 * Three delegations, each closing one of those two failures:
 *
 *  - `isPageFileName` → `isPageGroupMember`. A folder of `1.pdf`, `2.pdf`,
 *    `3.pdf` reads as a perfectly good page folder by the source document's
 *    wording, and `isPageGroup` refuses it because it requires the IMAGE
 *    kind — so those three PDFs would become three documents while the
 *    Structure stage said everything was fine.
 *  - `isWalkedFileName` → `isIgnoredFileName`. `Thumbs.db`, `desktop.ini`,
 *    `plan.dwg`, `.DS_Store` and `folder.jpg` are dropped by the walk BEFORE
 *    page-group detection, so `["1.jpg", "2.jpg", "Thumbs.db"]` is already a
 *    clean two-page document. Without this delegation STR-12 would block the
 *    import and instruct the user, in Romanian, to rename an invisible Windows
 *    metadata file to "1".
 *  - `isDeclaredCoordinateFile` → `coordinateNameConfidence`.
 *
 * **Every rule about the contents of a folder counts only the files
 * `isWalkedFileName` accepts.** That sentence is the contract #26.02 must
 * implement; it is not an optimisation.
 *
 * A CONSEQUENCE WORTH STATING OUT LOUD (STR-08, STR-09)
 * ─────────────────────────────────────────────────────
 *
 * `coordinate-file.ts` says, at length and for good reasons, that a coordinate
 * file's NAME is a ranking signal and a warning and **never a filter**. The
 * two coordinate rules here do not overturn that and must not be read as
 * overturning it: which file defines a Property's corners is still decided by
 * the parse, and a correctly-formed export with an unconventional name still
 * imports.
 *
 * What they add is a rule about the FOLDER — at most one file per property
 * folder may be NAMED by the coordinate convention, and none in the shared
 * folders. The name is load-bearing for a structure violation and still not
 * load-bearing for corner selection. Two different questions, two different
 * answers; worth a paragraph, because a future reader finding
 * `coordinateNameConfidence` used here will otherwise assume one of the two
 * modules is wrong.
 *
 * ONE INSTRUCTION PER PLACE
 * ─────────────────────────
 *
 * A folder can break several rules at once — `1.jpg`, `01.jpg` and `plan.dwg`
 * in one page folder breaks three — and handing a user three instructions for
 * one folder is how a fix-and-re-check loop turns into a guessing game. So the
 * contract is: **report the FIRST failing rule per place, in catalogue order**,
 * and let the re-check surface the next one. `firstPerPlace` implements it, and
 * the catalogue order is therefore load-bearing rather than cosmetic — it is
 * the order in which a user is asked to fix things.
 *
 * That works because the loop is the design, not a fallback: the source
 * document describes the user going to File Explorer and coming back, over and
 * over, until nothing is left. One clear instruction per folder per round is
 * exactly what that loop wants.
 *
 * NO TWO RULES ANSWER THE SAME QUESTION
 * ─────────────────────────────────────
 *
 * #26.02's brief is explicit that two systems answering one question is how
 * they drift, and it applies inside this catalogue too. An earlier draft had
 * both "every top-level folder is a property, `common` or `floating`" AND "a
 * property folder is named `<tarla>-<parcela>`" — which fire on the same
 * folder, for the same reason, with two different instructions. They are one
 * rule (STR-04) and the grammar is stated in its own text.
 *
 * The pairs that survive are the ones that genuinely differ in what the user
 * must DO: STR-04 (rename it or move it — the identifiers are unrecoverable)
 * versus STR-06 (insert `||` — the identifiers are already right), and STR-04
 * versus STR-05 (this is a misspelt `common`, not a property at all). They are
 * mutually exclusive by construction, not by convention: see
 * `parsePropertyFolderName`'s two failure reasons and `sharedFolderNearMiss`.
 *
 * NO DISPLAY TEXT LIVES HERE
 * ──────────────────────────
 *
 * Same split `checks.ts` uses: a stable ID per rule, every user-facing
 * sentence in `messages/*.json` under `adminImport.structure`. The rules and
 * their wording stay separable, and Romanian copy ships without a code review
 * of this file.
 *
 * WHAT IS DELIBERATELY NOT HERE
 * ─────────────────────────────
 *
 *  - Any folder validation — #26.02. Nothing here takes a walk result, an
 *    `FSEntry` or a `DirectoryObservation`.
 *  - Any UI — #26.04.
 *  - The FILE constraints (formats, sizes, filename characters). They exist,
 *    they are sound, and they are a different stage — #26.05. A rule about
 *    what a file IS belongs there; a rule about where a file SITS belongs here.
 *  - Deleting the rules this replaces (S-16, the near-miss family) — #26.02
 *    removes them in the same commit that makes them redundant.
 *  - A minimum. Nothing here requires the chosen folder to contain a single
 *    property: a `floating`-only import is legitimate, and an empty folder
 *    produces no violations and a forecast of zero documents, which is honest.
 *    Whether an empty pick should be refused was left to #26.04, and that slice
 *    answered NO: an empty folder breaks no structure rule, so Structure passes
 *    it, and the Evaluation screen that follows already refuses to continue on
 *    a forecast of zero documents — in a sentence about what will be imported,
 *    which is the question the user actually has. A second refusal here would
 *    need a Romanian rule sentence for a state the next screen states better.
 *
 * KNOWN AND ACCEPTED AMBIGUITIES
 * ──────────────────────────────
 *
 *  - **A pair of plain numbers is always read as a cadastral pair.**
 *    `2024-2025 Arhiva` is reported as a missing `||` and the user is offered
 *    `2024-2025||Arhiva`, which would create a Property with tarla 2024 and
 *    parcela 2025. Nothing in a name distinguishes a year range from a
 *    cadastral pair, and inventing a heuristic for it is the thing this module
 *    exists to stop doing. The instruction states what the system understood,
 *    so a user who meant an archive can see that it did not — which is the
 *    honest failure mode, and the reason STR-04's text names tarla and parcela
 *    explicitly rather than saying "rename this".
 *  - **Leading zeros are significant.** `48-50` and `048-050` are two
 *    properties to STR-03 and to #26.07's matching. Normalising them here
 *    would silently disagree with the database, which stores what it is given.
 *  - **A numeric basename larger than `Number.MAX_SAFE_INTEGER`** is a page
 *    file to `isPageGroupMember` and has no page number here — see
 *    `pageNumberOf`. It cannot reach an import regardless, because STR-14
 *    requires the numbers to run 1…n.
 */

import { isPageGroupMember } from "@/lib/files/file-kinds";
import { coordinateNameConfidence } from "./coordinate-file";
import { isIgnoredFileName } from "./folder-utils";
import { foldRomanian } from "./id-card";

// ---------------------------------------------------------------------------
// The catalogue
// ---------------------------------------------------------------------------

/**
 * A stable ID per rule. `STR-` and not `S-` on purpose: `S-01 … S-17` are
 * `checks.ts` findings, several of which #26.02 deletes. Two catalogues
 * sharing a numbering space is how a report ends up citing a rule that no
 * longer means what its reader thinks it means.
 */
export type StructureRuleId =
  | "STR-01"   // the chosen folder holds no loose files
  | "STR-02"   // at most five property folders
  | "STR-03"   // no two property folders mean the same property
  | "STR-04"   // every folder in it is a property (<tarla>-<parcela>), `common` or `floating`
  | "STR-05"   // the shared folders are spelled exactly `common` / `floating`
  | "STR-06"   // free description is separated by `||`
  | "STR-07"   // a top-level folder's own files are not all numbered scans
  | "STR-08"   // at most one coordinate file per property folder
  | "STR-09"   // no coordinate file in `common` or `floating`
  | "STR-10"   // a page folder holds no further folders
  | "STR-11"   // a page folder is not empty
  | "STR-12"   // every file in a page folder is a numbered scan
  | "STR-13"   // no two pages carry the same number
  | "STR-14";  // page numbers run 1, 2, 3 … with no gaps

/** Every rule ID, in listing order — which is also fixing order. See `firstPerPlace`. */
export const STRUCTURE_RULE_IDS: readonly StructureRuleId[] = Object.freeze([
  "STR-01", "STR-02", "STR-03", "STR-04", "STR-05", "STR-06", "STR-07",
  "STR-08", "STR-09", "STR-10", "STR-11", "STR-12", "STR-13", "STR-14",
] as const);

/**
 * Where a rule is answered — and the heading #26.04 groups it under.
 *
 * Three, not seven. Carried as data rather than left implicit in the
 * validator, because two independent copies of "which rule is about what"
 * would drift, and because a business user reading the printed listing wants
 * three sections, not a taxonomy.
 */
export type RuleScope =
  | "chosenFolder"    // the folder the user picked, as a whole
  | "topLevelFolder"  // a property folder, `common` or `floating` — its name and its own files
  | "pageFolder";     // a subfolder of one of those: the pages of one document

export type StructureRule = {
  id: StructureRuleId;
  scope: RuleScope;
  /**
   * The numeric placeholders this rule's violation sentence interpolates, so a
   * test can prove the message and the emitter agree. A sentence naming
   * `{found}` that is handed no `found` renders the placeholder verbatim to a
   * Romanian user, and nothing type-checks that today.
   */
  counts: readonly string[];
  /** The same for text placeholders — a folder name, a suggested new name. */
  values: readonly string[];
};

/**
 * Every rule, in the order the listing shows them and the order a user is
 * asked to fix them: outside in. The chosen folder as a whole, then what may
 * sit in it, then what may sit inside that.
 *
 * ⚠️ Reordering this array changes which violation a user is shown for a
 * folder that breaks several rules (`firstPerPlace`), not merely the order of
 * a printed page.
 */
export const STRUCTURE_RULES: readonly StructureRule[] = Object.freeze([
  { id: "STR-01", scope: "chosenFolder",   counts: ["files"],        values: ["examples"] },
  { id: "STR-02", scope: "chosenFolder",   counts: ["found", "max"], values: [] },
  { id: "STR-03", scope: "chosenFolder",   counts: [],               values: ["folder", "other", "identity"] },
  { id: "STR-04", scope: "topLevelFolder", counts: [],               values: ["folder"] },
  { id: "STR-05", scope: "topLevelFolder", counts: [],               values: ["folder", "expected"] },
  { id: "STR-06", scope: "topLevelFolder", counts: [],               values: ["folder", "suggestion"] },
  { id: "STR-07", scope: "topLevelFolder", counts: ["files"],        values: ["folder"] },
  { id: "STR-08", scope: "topLevelFolder", counts: ["found"],        values: ["folder", "examples"] },
  { id: "STR-09", scope: "topLevelFolder", counts: ["found"],        values: ["folder", "examples"] },
  { id: "STR-10", scope: "pageFolder",     counts: ["subfolders"],   values: ["folder", "examples"] },
  { id: "STR-11", scope: "pageFolder",     counts: [],               values: ["folder"] },
  // No `total`. The first draft said "1 of the 3 files here", which renders
  // "din cele 1" for a page folder holding a single non-scan — and every way
  // of making that agree turns one sentence into three nested plurals. The
  // count of offenders plus the names is what the user acts on.
  { id: "STR-12", scope: "pageFolder",     counts: ["offending"],    values: ["folder", "examples"] },
  // ⚠️ A PAGE NUMBER IS AN IDENTIFIER, NOT A QUANTITY — so `number`, `lowest`
  // and `highest` are values and not counts (moved there in #26.02).
  //
  // A bare `{n}` holding a JavaScript number is formatted by ICU with the
  // locale's number format, and Romanian groups thousands with a full stop.
  // These two sentences exist to be matched against filenames: as counts, the
  // catalogue's own motivating example renders "numerotate de la 5.449 la
  // 31.316" above files named `5449.jpg` and `31316.jpg`, and the user is
  // asked to find a number that appears nowhere on their disk. `pages` stays
  // a count, because it genuinely is one and because it drives a plural.
  { id: "STR-13", scope: "pageFolder",     counts: [],               values: ["folder", "examples", "number"] },
  // STR-14 names the RANGE rather than the missing numbers. A folder of
  // scanner counters (`5449.jpg`, `31316.jpg`) is missing 25,867 page numbers,
  // and a sentence that tries to list them is unusable at exactly the moment
  // it matters most. "numbered from 5449 to 31316" says the same thing in one
  // line and is true of a simple gap too.
  { id: "STR-14", scope: "pageFolder",     counts: ["pages"],        values: ["folder", "lowest", "highest"] },
] as const satisfies readonly StructureRule[]);

/** Lookup by ID, so a caller never re-derives the order or the placeholders. */
export const STRUCTURE_RULE_BY_ID: ReadonlyMap<StructureRuleId, StructureRule> = new Map(
  STRUCTURE_RULES.map((r) => [r.id, r] as const),
);

/** The three sentences every rule carries. See `messageKeyFor`. */
export type RuleMessagePart = "requirement" | "example" | "violation";

export const RULE_MESSAGE_PARTS: readonly RuleMessagePart[] = Object.freeze([
  "requirement",
  "example",
  "violation",
] as const);

/**
 * The i18n key for one sentence of one rule. THE only place the message path
 * is written.
 *
 * Three sentences, because they answer three different questions at three
 * different moments:
 *
 *  - `requirement` — what the folder must look like. Read BEFORE picking a
 *    folder, on the listing the user can save as an offline HTML page.
 *  - `example`     — a good name and a bad one, side by side. The source
 *    document is explicit that a business user reads this, and an abstract
 *    grammar is not something a non-technical person can check their own
 *    folder against.
 *  - `violation`   — read AFTER a check, with the culprit named and the exact
 *    rename or move to perform. It ends with the instruction rather than
 *    deferring to `requirement`, because this is the sentence the user acts on
 *    with File Explorer already open.
 */
export function messageKeyFor(id: StructureRuleId, part: RuleMessagePart): string {
  return `adminImport.structure.rule.${id}.${part}`;
}

/**
 * Every scope, in the order the listing shows them: outside in.
 *
 * The same order the catalogue runs in, and not by coincidence — a printed page
 * whose sections ran in one order while the fix list ran in another would be
 * two documents pretending to be one. A test pins the agreement.
 */
export const RULE_SCOPES: readonly RuleScope[] = Object.freeze([
  "chosenFolder",
  "topLevelFolder",
  "pageFolder",
] as const);

/** The rules answered at one scope, in catalogue order. */
export function rulesInScope(scope: RuleScope): StructureRule[] {
  return STRUCTURE_RULES.filter((r) => r.scope === scope);
}

/**
 * The i18n key for a scope's heading — the section title on the listing.
 *
 * Here for the same reason as `messageKeyFor`: the message path is written in
 * one place, so a rename is a change to this file rather than a grep across
 * two renderers (the screen and the offline HTML page).
 */
export function scopeKeyFor(scope: RuleScope): string {
  return `adminImport.structure.scope.${scope}`;
}

/**
 * The placeholders a rule's `requirement` and `example` sentences interpolate.
 *
 * ⚠️ **Not the same set as the rule's `counts` and `values`.** Those describe
 * the VIOLATION sentence, which is rendered out of a `StructureViolation` and
 * therefore always has its data to hand. The other two sentences are rendered
 * with no violation in sight — the listing is read BEFORE a folder is picked —
 * so whatever they interpolate has to come from somewhere else, and today that
 * is exactly one number: the property limit STR-02 quotes twice.
 *
 * A function rather than a map, so a caller cannot reach a rule that is missing
 * from the map and hand next-intl `undefined`. A test walks both locales'
 * `requirement` and `example` strings, extracts every placeholder, and fails if
 * this does not supply it — which is what stops a future rewording from
 * rendering `{max}` verbatim to a Romanian user on the one page meant to be
 * printed and carried to File Explorer.
 */
export function ruleListingValues(id: StructureRuleId): Record<string, string | number> {
  return id === "STR-02" ? { max: MAX_PROPERTY_FOLDERS } : {};
}

// ---------------------------------------------------------------------------
// What a violation looks like
// ---------------------------------------------------------------------------

/**
 * One broken rule, at one place.
 *
 * ⚠️ ONE VIOLATION PER CULPRIT, never one per rule with a list of culprits.
 * `checks.ts` aggregates for the opposite reason — there the user is skimming
 * to decide whether to proceed at all. Here the user is going to File Explorer
 * to fix things one at a time, and a list they can tick off beats a paragraph
 * they have to decompose. It also keeps `culprit` a single unambiguous path,
 * which is what #26.04 turns into the line the user reads.
 */
export type StructureViolation = {
  ruleId: StructureRuleId;
  /**
   * The folder or file the user must act on, as a path from the chosen folder.
   * `""` means the chosen folder itself — the only path that can be empty, and
   * the reason this is a plain string rather than a branded non-empty one.
   */
  culprit: string;
  /**
   * Other paths the violation is ABOUT but which the user does not act on
   * individually: the six property folders when five is the limit, the two
   * coordinate files when one is.
   *
   * Complete, never a sample. `checks.ts` shipped a report that truncated its
   * own evidence while claiming completeness; truncation is a rendering
   * decision and belongs to whoever renders.
   */
  related: readonly string[];
  /** Numeric placeholders. Keys must match the rule's `counts`. */
  counts: Readonly<Record<string, number>>;
  /**
   * Text placeholders. Keys must match the rule's `values`.
   *
   * ⚠️ Several sentences interpolate a value called `examples`, and it is
   * exactly what its name says: a SHORT readable list, two or three names, for
   * a user who needs to recognise the folder rather than audit it. The
   * complete set is always `related`. That split is deliberate — `checks.ts`
   * shipped a report whose sentence said "86 names" above five of them, and
   * the fix there was to make the field complete and let the renderer
   * truncate. Here the truncation is named in the field instead, because this
   * one lives inside a sentence and a sentence cannot carry 86 paths.
   */
  values: Readonly<Record<string, string>>;
};

/**
 * Keep one violation per place: the earliest rule in catalogue order.
 *
 * See "ONE INSTRUCTION PER PLACE" in the module header. A page folder holding
 * `1.jpg`, `01.jpg` and `plan.dwg` breaks STR-12, STR-13 and STR-14 at once,
 * and three instructions for one folder is not a fix list, it is a puzzle. The
 * user is shown the first, fixes it, presses Verifică din nou, and is shown
 * the next if it survives — which is the loop the source document describes.
 *
 * Order out is catalogue order, then first-seen order within a rule, so the
 * list does not reshuffle between two checks of the same folder.
 */
export function firstPerPlace(
  violations: readonly StructureViolation[],
): StructureViolation[] {
  const rank = new Map(STRUCTURE_RULE_IDS.map((id, i) => [id, i] as const));
  const best = new Map<string, StructureViolation>();
  for (const v of violations) {
    const held = best.get(v.culprit);
    if (held === undefined || rank.get(v.ruleId)! < rank.get(held.ruleId)!) {
      best.set(v.culprit, v);
    }
  }
  return [...best.values()].sort((a, b) => rank.get(a.ruleId)! - rank.get(b.ruleId)!);
}

// ---------------------------------------------------------------------------
// Constants the rules are stated in terms of
// ---------------------------------------------------------------------------

/**
 * How many property folders one import may carry.
 *
 * ⚠️ **`common` and `floating` do NOT count** (Adrian, #26.01). A compliant
 * chosen folder may therefore hold seven subfolders: five properties plus both
 * shared folders. Stated here because the obvious implementation of STR-02
 * counts subfolders, which would reject a legal folder — the exact trap the
 * slice specification called out as needing an answer in this slice.
 *
 * The number is a manageability limit, not a technical one. The source
 * document is explicit that more than five "is harder to manage by the user",
 * and that the user must be ADVISED what to do rather than merely refused —
 * which is why STR-02's violation sentence carries the remedy (split into a
 * second chosen folder, repeating `common` in each) instead of a bare count.
 */
export const MAX_PROPERTY_FOLDERS = 5;

/**
 * The two folders that may sit beside the properties, spelled exactly.
 *
 * `common` holds documents concerning every property in this chosen folder;
 * they are processed after the properties exist and linked to all of them.
 * `floating` holds documents related to none of them — stored, possibly
 * creating Persons, linked to no Property.
 *
 * Lowercase and English on purpose, in an application whose UI is Romanian:
 * these are structural markers the user types into File Explorer, not copy. A
 * marker that has to be matched loosely is a marker that has already failed —
 * hence STR-05, which catches `Common` / `COMMON` and says exactly what to
 * rename it to instead of silently accepting it.
 */
export const SHARED_FOLDER_NAMES = Object.freeze(["common", "floating"] as const);
export type SharedFolderName = (typeof SHARED_FOLDER_NAMES)[number];

/**
 * What separates the cadastral identifiers from free description in a property
 * folder name (Adrian, #26.01 question (c)).
 *
 * Two vertical bars, and nothing else — not a space, not a third dash.
 *
 * The reason is question (a) from the same list: the surface segment in
 * `47per2-225per3per24-2716` is DECORATION, not identity. Two properties are
 * told apart by tarla and parcela alone, so everything after them is free
 * text — and free text separated by the same character the identifiers use
 * cannot be told from another identifier. `48-50D-2716` would be a three-part
 * cadastral name or a two-part one with a description, and the parser would
 * have to guess. This is the codebase that already retired one guessing
 * heuristic (`parseFolderName`, Slice #23.00) for exactly that.
 *
 * `||` is chosen because it cannot appear in a Windows folder name by accident
 * and is legal in one on purpose.
 */
export const DESCRIPTION_SEPARATOR = "||";

// ---------------------------------------------------------------------------
// The property-folder name grammar
// ---------------------------------------------------------------------------

/**
 * The letter suffixes a tarla or parcela may end with.
 *
 * Letter suffixes are legal (Adrian, #26.01 question (b)): `48-50D` is tarla
 * 48, parcela 50D. `bis` is added because Romanian cadastral practice writes
 * "parcela 50 bis" constantly and refusing it would be refusing real data.
 *
 * ⚠️ **An allowlist, not a length limit, and the difference is not
 * pedantry.** The first draft allowed any run of up to three letters, which
 * makes `50Ana` a legal parcela — so `48-50Ana-Maria` was diagnosed as a
 * missing separator and the user was told to rename the folder
 * `48-50Ana||Maria`, creating a Property whose parcela is `50Ana`. The same
 * held for `10-20Sud-Est` and `48-50Lot 3`. A limit cannot tell a suffix from
 * the first syllable of a word; a list can. Adding a genuinely used suffix is
 * a one-token edit here.
 */
const SUFFIX_ALLOWED = /^(?:[A-Za-z]|bis)$/i;

/** The widest letter run the patterns below will even consider. Not the rule — `SUFFIX_ALLOWED` is. */
const MAX_SUFFIX_SCAN = 3;

/**
 * One cadastral segment: digits, optionally joined by `per`, with an optional
 * allowed letter suffix.
 *
 *   47            47per2            225per3per24            50D            48per2A
 *
 * `per` stands in for "/" because a slash cannot appear in a folder name while
 * Romanian real-estate writing uses it constantly ("47/2"). `perToSlash` turns
 * it back before anything reaches the database, so the encoding never escapes
 * the filesystem.
 *
 * ⚠️ **`per` must be followed by digits, and the suffix must not spell `per`.**
 * Without the second half the pattern accepts `47per`, whose suffix is the
 * letters "per" — and `perToSlash("47per")` is `"47/"`, a cadastral identifier
 * with a dangling separator, written to the database and matched against in
 * #26.07. `SUFFIX_ALLOWED` refuses it, since "per" is neither one letter nor
 * "bis".
 */
const SEGMENT_RE = new RegExp(`^\\d+(?:per\\d+)*[A-Za-z]{0,${MAX_SUFFIX_SCAN}}$`, "i");

/** The same shape anchored only at the start — used to recover the cadastral prefix of a wrong name. */
const CADASTRAL_PREFIX_RE = new RegExp(
  `^\\d+(?:per\\d+)*[A-Za-z]{0,${MAX_SUFFIX_SCAN}}-\\d+(?:per\\d+)*[A-Za-z]{0,${MAX_SUFFIX_SCAN}}`,
  "i",
);

/** The trailing run of letters in a segment, `""` when it ends in a digit. */
function suffixOf(segment: string): string {
  return segment.match(/[A-Za-z]*$/)?.[0] ?? "";
}

/**
 * The outcome of reading a property folder's name.
 *
 * A discriminated result rather than `null`, because the two ways a name can
 * be wrong need two different sentences and #26.02 must not have to work out
 * which by re-parsing. `"cadastral"` means nothing usable was found at the
 * start, so the folder must be renamed or moved (STR-04); `"separator"` means
 * the identifiers are already right and only the description is attached
 * wrongly (STR-06), which is a far smaller correction and deserves to be
 * described as one.
 */
export type PropertyFolderName =
  | {
      ok: true;
      /** As written, `per` and all — `perToSlash` is the caller's job, at the DB boundary. */
      tarla: string;
      parcela: string;
      /** Everything after `||`, trimmed. `null` when the name carries none. */
      description: string | null;
    }
  | {
      ok: false;
      reason: "cadastral" | "separator";
      /** The recoverable `<tarla>-<parcela>` prefix; `null` on a `cadastral` failure. */
      prefix: string | null;
    };

function parseSegment(raw: string): string | null {
  const s = raw.trim();
  if (!SEGMENT_RE.test(s)) return null;
  const suffix = suffixOf(s);
  if (suffix !== "" && !SUFFIX_ALLOWED.test(foldRomanian(suffix))) return null;
  return s;
}

/**
 * Read a property folder's name.
 *
 * The shape is `<tarla>-<parcela>` optionally followed by `||<description>`:
 *
 *   "47per2-225per3per24"                    → tarla 47per2, parcela 225per3per24
 *   "47per2-225per3per24||2716 Prisecaru"    → …and description "2716 Prisecaru"
 *   "48-50D"                                 → tarla 48, parcela 50D
 *   "225per3-24bis"                          → tarla 225per3, parcela 24bis
 *
 * and these are the wrong ones, with the reason that produces the right
 * sentence:
 *
 *   "47per2-225per3per24-2716 Prisecaru"     → separator, prefix "47per2-225per3per24"
 *   "48-50D 2716"                            → separator, prefix "48-50D"
 *   "2024-Arhiva"                            → cadastral
 *   "48-50Ana-Maria"                         → cadastral ("Ana" is not a suffix)
 *   "Documente generale"                     → cadastral
 *   "3 Calea Victoriei"                      → cadastral
 *
 * The last two are the false positives that retired the old `parseFolderName`
 * heuristic in Slice #23.00: it read "3 Calea Victoriei" as tarla "3" and
 * "2024-Arhiva" as tarla "2024" / parcela "Arhiva", and wrote both without
 * showing anyone. This grammar refuses them outright — the whole difference
 * between a contract and a guess, and the reason nothing in this module
 * reaches for `parseFolderName`, whose leading-digit test IS the retired rule.
 *
 * A name carrying more than one `||` is a `separator` failure. The description
 * is free text and may hold almost anything, but a second separator means the
 * user is structuring it, and the honest answer is to say so rather than to
 * silently take the first split.
 */
export function parsePropertyFolderName(rawName: string): PropertyFolderName {
  const name = rawName.trim();

  const parts = name.split(DESCRIPTION_SEPARATOR);
  const cadastralPart = parts[0].trim();

  const dash = cadastralPart.indexOf("-");
  const tarla = dash === -1 ? null : parseSegment(cadastralPart.slice(0, dash));
  const parcela = dash === -1 ? null : parseSegment(cadastralPart.slice(dash + 1));

  if (tarla !== null && parcela !== null && parts.length <= 2) {
    if (parts.length === 1) return { ok: true, tarla, parcela, description: null };
    const description = parts[1].trim();
    // A trailing `||` with nothing after it is a separator the user started
    // and did not finish — reported as a separator problem, which it is.
    if (description === "") return { ok: false, reason: "separator", prefix: cadastralPart };
    return { ok: true, tarla, parcela, description };
  }

  // Wrong. Which sentence the user gets depends on whether the identifiers are
  // recoverable from the start of the name.
  const prefix = name.match(CADASTRAL_PREFIX_RE)?.[0] ?? null;
  if (prefix === null) return { ok: false, reason: "cadastral", prefix: null };

  const d = prefix.indexOf("-");
  const segmentsAreSound =
    parseSegment(prefix.slice(0, d)) !== null && parseSegment(prefix.slice(d + 1)) !== null;

  // ⚠️ The prefix must END somewhere a human would agree it ends.
  //
  // Belt to `SUFFIX_ALLOWED`'s braces. Without it the pattern cuts a word in
  // half: "48-50Arhiva" would give a parcela of "50Arh" and a leftover of
  // "iva", so the user is told — precisely, confidently and absurdly — to
  // rename the folder "48-50Arh||iva". A suggestion nobody would accept is
  // worse than no suggestion, because the rule that produced it stops being
  // believed.
  const nextChar = name.charAt(prefix.length);
  const endsCleanly = nextChar === "" || /[\s|-]/.test(nextChar);

  return segmentsAreSound && endsCleanly
    ? { ok: false, reason: "separator", prefix }
    : { ok: false, reason: "cadastral", prefix: null };
}

/**
 * The name this folder should be renamed to — the value STR-06's sentence puts
 * in front of the user.
 *
 * Only ever answers for a `separator` failure, where the identifiers are
 * already correct and the description merely needs its separator. Returns
 * `null` for anything else, because there is nothing honest to suggest: a name
 * with no cadastral identifiers cannot be repaired by a machine, and offering
 * a guess is precisely how the retired heuristic did damage.
 *
 * ⚠️ **A remainder that is itself a legal suffix is JOINED, not separated.**
 * Romanian writes "parcela 50 bis", so `48-50 bis` reaches here with a
 * remainder of "bis" — and suggesting `48-50||bis` would rename it to a
 * DIFFERENT parcel (50, with "bis" demoted to decoration), which the user
 * would then accept because the instruction told them to. `48-50bis` is the
 * only suggestion that preserves what the folder said.
 *
 * The one promise: whatever it returns parses as `ok: true`.
 */
export function suggestedPropertyFolderName(rawName: string): string | null {
  const parsed = parsePropertyFolderName(rawName);
  if (parsed.ok || parsed.reason !== "separator" || parsed.prefix === null) return null;

  const remainder = rawName
    .trim()
    .slice(parsed.prefix.length)
    // Strip whatever separator the user actually used — a dash, a space, or a
    // `||` they left dangling — so the suggestion does not carry it through.
    .replace(/^[\s|-]+/, "")
    // Any REMAINING bar is a second `||` inside what is meant to be free text.
    // It has to go, or the suggestion is a name that fails the same rule it
    // was offered to fix.
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (remainder === "") return parsed.prefix;

  // The "50 bis" case: the remainder belongs INSIDE the parcela, and only when
  // the parcela does not already carry a suffix of its own ("48-50D bis" is
  // two suffixes and genuinely a description).
  const d = parsed.prefix.indexOf("-");
  const parcelaHasSuffix = suffixOf(parsed.prefix.slice(d + 1)) !== "";
  if (!parcelaHasSuffix && SUFFIX_ALLOWED.test(foldRomanian(remainder))) {
    const joined = `${parsed.prefix}${remainder}`;
    if (parsePropertyFolderName(joined).ok) return joined;
  }

  return `${parsed.prefix}${DESCRIPTION_SEPARATOR}${remainder}`;
}

/**
 * What makes two property folders the same property — the STR-03 comparison.
 *
 * `per` is decoded and case is folded, because `47per2` and `47PER2` reach the
 * database as the identical `47/2` and would be one Property with two folders
 * feeding it. Whitespace inside the name is normalised for the same reason:
 * `48 - 50D` and `48-50D` parse to the same pair.
 *
 * Leading zeros are NOT normalised, and the description is ignored entirely —
 * see "KNOWN AND ACCEPTED AMBIGUITIES" in the module header.
 *
 * Returns `null` for a name that is not a property folder, so a caller cannot
 * accidentally compare two unparseable names and call them equal.
 */
export function propertyIdentityOf(rawName: string): string | null {
  const parsed = parsePropertyFolderName(rawName);
  if (!parsed.ok) return null;
  const decode = (s: string) => foldRomanian(s).replace(/per/g, "/");
  return `${decode(parsed.tarla)}-${decode(parsed.parcela)}`;
}

// ---------------------------------------------------------------------------
// The rest of the vocabulary
// ---------------------------------------------------------------------------

/** Exactly `common` or `floating`, character for character. Anything else is not one. */
export function sharedFolderName(name: string): SharedFolderName | null {
  return (SHARED_FOLDER_NAMES as readonly string[]).includes(name)
    ? (name as SharedFolderName)
    : null;
}

/**
 * A folder MEANT to be `common` or `floating` and misspelled — the STR-05 case.
 *
 * Folded comparison, so `Common`, `COMMON` and ` common ` all resolve.
 * `foldRomanian` is the codebase's one folding function (lowercase, trim,
 * collapse whitespace, strip diacritics through NFD, covering both encodings
 * of ș/ț) and re-implementing a subset of it here is how two definitions of
 * "the same name" begin disagreeing.
 *
 * Returns `null` for a name that is already exact, so STR-04 and STR-05 stay
 * mutually exclusive by construction: a misspelt shared folder gets the rename
 * instruction, never the useless "this is not a property folder".
 */
export function sharedFolderNearMiss(name: string): SharedFolderName | null {
  if (sharedFolderName(name) !== null) return null;
  const folded = foldRomanian(name);
  return SHARED_FOLDER_NAMES.find((n) => n === folded) ?? null;
}

/**
 * Will the walk keep this file at all?
 *
 * Delegates to `isIgnoredFileName`, and the delegation IS the rule — see the
 * module header. Every rule about a folder's CONTENTS counts only the files
 * this accepts. `Thumbs.db`, `desktop.ini`, `folder.jpg`, `.DS_Store`,
 * `plan.dwg`, `.bak` and `.lnk` are removed by `walkFolder` before page-group
 * detection, so they cannot make a folder wrong — and a rule that blocked on
 * one would send a user to File Explorer to rename a file Windows hides from
 * them.
 */
export function isWalkedFileName(name: string): boolean {
  return !isIgnoredFileName(name);
}

/**
 * Is this file a page of a scanned document?
 *
 * Delegates to `isPageGroupMember` (an image kind, with a purely numeric
 * basename), because the walk merges a folder into one multi-page document
 * only when every file satisfies it — so any other definition here would bless
 * folders the walk then explodes.
 */
export function isPageFileName(name: string): boolean {
  return isPageGroupMember(name);
}

/**
 * The page number a file name carries, or `null` when it is not a page file.
 *
 * `parseInt` on the basename, which is what `sortNumericFilenames` in the walk
 * does — so `001.jpg` is page 1 here and page 1 there. STR-13 exists precisely
 * because that mapping is many-to-one: `1.jpg` and `01.jpg` are two files and
 * one page number, and the resulting order is whatever the sort happened to do.
 *
 * A basename too long to be an exact integer answers `null` although
 * `isPageFileName` accepts it. That asymmetry is inherited rather than
 * introduced — `sortNumericFilenames` computes `Infinity - Infinity` on the
 * same input — and it is harmless here because STR-14 requires the numbers to
 * run 1…n, which no such file can satisfy.
 */
export function pageNumberOf(name: string): number | null {
  if (!isPageFileName(name)) return null;
  const parsed = parseInt(name.slice(0, name.lastIndexOf(".")), 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

/**
 * Is this file named as a coordinate export, by the convention?
 *
 * `"strong"` means both signals agree — the `.txt` extension AND a name
 * folding to a `coord` prefix. STR-08 and STR-09 are about exactly those
 * files: a `.txt` of contact details is business content and always welcome,
 * a second `coord ….txt` beside the first is the error the source document
 * names.
 *
 * See the module header on why this does not contradict `coordinate-file.ts`.
 */
export function isDeclaredCoordinateFile(name: string): boolean {
  return coordinateNameConfidence(name) === "strong";
}
