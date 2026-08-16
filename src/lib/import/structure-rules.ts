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
 * The pair that survives is the one that genuinely differs in what the user
 * must DO: STR-04 (there is no tarla and parcela here — rename it or move it)
 * versus STR-05 (this is a misspelt `comune`, not a property at all). They are
 * mutually exclusive by construction, not by convention: `sharedFolderNearMiss`
 * answers before the name is ever read as a property.
 *
 * ⚠️ **STR-06 was the third member of that set and Slice #28.02 retired it.** It
 * said "the identifiers are already right, only the description is attached with
 * the wrong separator", and the separator it recommended — `||` — no longer
 * exists. A dash before a description is now exactly what the product asks for,
 * so the rule has no subject left. **Its ID is a GAP in the catalogue and is
 * never reused**: the rules listing is a page a user saves and carries to File
 * Explorer, and a number that changes hands makes every saved copy lie.
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
 *  - **ANY name carrying a dash is read as a property** (Slice #28.02).
 *    `2024-Arhiva` is tarla 2024, parcela Arhiva; `2024-2025 Arhiva` is tarla
 *    2024, parcela "2025 Arhiva". Nothing in a name distinguishes a year range
 *    from a cadastral pair, and #23.00's grammar refused both by refusing
 *    everything that did not look cadastral — at the cost of also refusing
 *    `40-212per40IE55821-Busuioc Ion`, which is real data.
 *
 *    **The protection is no longer in the parse; it is a question.** STR-15 asks
 *    about any property folder whose identifiers carry no `per`, names the tarla
 *    and parcela it would create, and blocks until the user answers. A genuine
 *    `48-50D` is asked about too, and that is intended: the question is cheap and
 *    the alternative is a grammar. Do not reintroduce a digit test, a length test
 *    or a suffix list.
 *  - **Leading zeros are significant.** `48-50` and `048-050` are two
 *    properties to STR-03 and to #26.07's matching. Normalising them here
 *    would silently disagree with the database, which stores what it is given.
 *  - **A numeric basename larger than `Number.MAX_SAFE_INTEGER`** is a page
 *    file to `isPageGroupMember` and has no page number here — see
 *    `pageNumberOf`. It cannot reach an import regardless, because STR-14
 *    requires every page in a folder to carry a number and the run to be
 *    consecutive, and a file with no number satisfies neither.
 */

import { isPageGroupMember } from "@/lib/files/file-kinds";
import { coordinateNameConfidence } from "./coordinate-file";
import { isIgnoredFileName, perToSlash } from "./folder-utils";
import { foldRomanian } from "./id-card";
import { cadastralIdentityKey } from "@/lib/properties/cadastral-identity";

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
  // STR-06 was "free description is separated by `||`". Retired in #28.02 with
  // the separator itself. THE ID IS A GAP AND IS NEVER REUSED — module header.
  | "STR-15"   // a property folder whose identifiers carry no `per` is confirmed by the user
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
  "STR-01", "STR-02", "STR-03", "STR-04", "STR-05", "STR-15", "STR-07",
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
  // ⚠️ STR-15 sits in STR-06's old SLOT, not at the end of the array, and the
  // slot is the point rather than the number. `firstPerPlace` shows the earliest
  // rule per place, so a folder that both needs confirming and holds only
  // numbered scans is asked "is this a property at all?" before it is asked to
  // rearrange its contents. Answering the second first is work the first answer
  // may throw away.
  { id: "STR-15", scope: "topLevelFolder", counts: [],               values: ["folder", "tarla", "parcela"] },
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
 * The two folders that may sit beside the properties.
 *
 * `common` holds documents concerning every property in this chosen folder;
 * they are processed after the properties exist and linked to all of them.
 * `floating` holds documents related to none of them — stored, possibly
 * creating Persons, linked to no Property.
 *
 * ⚠️ **THESE ARE IDENTITIES, NOT SPELLINGS, AND #26.11 SPLIT THE TWO APART.**
 * Until that slice this constant was both at once, and its own comment said the
 * English lowercase names were "on purpose, in an application whose UI is
 * Romanian: these are structural markers the user types into File Explorer, not
 * copy". Adrian overruled that from the screen: he was looking at the Romanian
 * import and reading two English words, and the words in question are precisely
 * the ones a Romanian business user has to type into Windows Explorer.
 *
 * So the identity stays `common` / `floating` — it is a discriminated tag on
 * `EntryAssignment.bucket` and a field name on `FolderGrouping`, it is never
 * rendered and never typed, and renaming it would churn four modules and their
 * tests to change nothing anyone can see. What the user types and reads is
 * `SHARED_FOLDER_DISPLAY_NAMES`, and what is accepted on disk is
 * `acceptedSharedFolderSpellings` — which is a SUPERSET of what was accepted
 * before, so no archive already prepared on disk stops importing.
 */
export const SHARED_FOLDER_NAMES = Object.freeze(["common", "floating"] as const);
export type SharedFolderName = (typeof SHARED_FOLDER_NAMES)[number];

/**
 * What the user types in File Explorer, and what every sentence in the product
 * calls these two folders.   (Slice #26.11)
 *
 * ⚠️ **THE SAME IN BOTH LOCALES, AND THAT IS NOT AN OVERSIGHT.** A folder name
 * is a string on a disk, not copy: if `en-GB` told an English reader to create
 * `common` while the checker's rename instruction said `comune`, the two would
 * be giving contradictory orders about one filesystem. Both locales name these,
 * and `messages/*.json` must keep quoting them verbatim — the copy test pins it.
 *
 * ⚠️ **CHANGING A VALUE HERE IS A CHANGE TO THE PRODUCT'S CONTRACT WITH A DISK
 * SOMEBODY ALREADY POPULATED.** Whatever leaves this record is what STR-05
 * tells a user to rename their folder to. Add the outgoing spelling to
 * `LEGACY_SHARED_FOLDER_SPELLINGS` in the same commit, or every archive built
 * against the old name starts failing the structure check the next morning.
 */
export const SHARED_FOLDER_DISPLAY_NAMES: Readonly<Record<SharedFolderName, string>> =
  Object.freeze({
    common: "comune",
    floating: "flotante",
  });

/**
 * Spellings still accepted on disk although the product no longer teaches them.
 *
 * ⚠️ **This is a compatibility list and it only ever grows.** Adrian was
 * mid-import when #26.11 landed, against a folder on his own disk holding
 * `common` and `floating` subfolders, and every archive Ciprian has prepared so
 * far is spelled the same way. A rename that turned those into STR-05
 * violations would have handed a business user a rename chore across every
 * folder he owns as the price of a copy change he never asked for.
 *
 * They are accepted SILENTLY: nothing in the UI mentions them, so a user
 * reading the rules learns one spelling, and a user whose folder is already
 * named the old way is never told they are wrong. There is deliberately no
 * "deprecated, please rename" nag — a warning nobody can act on without a
 * morning of work is worse than the inconsistency it reports.
 *
 * ⚠️ **KNOWN AND ACCEPTED: BOTH SPELLINGS AT ONCE IS LEGAL AND LABELS BADLY.**
 * A chosen folder holding `comune` AND `common` side by side breaks no rule,
 * and it should not: both mean the same thing, both bucket to the same
 * identity, and every document in either is linked to every property — which
 * is correct. What is imprecise is the LABELLING downstream. The property
 * step's sentence names one folder while counting the documents of two, and
 * `inResultOrder` groups the result table by the raw `pathParts[0]`, so the
 * same concept appears as two headings. Neither loses or mis-files a document.
 *
 * It is left alone on purpose. The state exists only for a user who renamed
 * half of a transition and stopped, a rule against it would need a new ID, two
 * Romanian sentences and a place in the fixing order, and the remedy it would
 * print — "rename the other one too" — is one the user is already free to
 * apply. If it turns out to happen in practice, it is a rule, not a redesign.
 *
 * ⚠️ **AND TWO CONSEQUENCES THAT NEED NO SUCH STATE — they land on the
 * ordinary single-spelling legacy path, and they are the price of the rename:**
 *
 *  - **The product names the canonical folder even when the disk says
 *    otherwise.** A user whose folder is `common` reads "Folderul „comune”: 1
 *    document" at the property step, is offered `comune` as STR-05's rename
 *    target, and sees `comune` throughout the rules listing and the saved
 *    take-away page. Nothing tells them they are wrong; they are simply told
 *    about a folder that is not on their disk. Making these name the folder
 *    actually found would mean threading the real name through as an ICU
 *    argument at each site, and it would still have to pick one when both
 *    exist. The cheap alternative is the one already available: rename the
 *    folder once and the mismatch is gone forever.
 *  - **Tags record the spelling, because tags record the path.** `tagsForEntry`
 *    persists `pathParts` verbatim, so a document imported from `common/` gets
 *    an `entity_tag` row named `common` and one from `comune/` gets `comune`.
 *    That is correct — a tag is a record of where the file was, and rewriting
 *    history to a name the disk never used would be the lie — but it does mean
 *    an archive imported across the rename is browsable under two tags for one
 *    concept. Merging them is a data job, not a code one.
 */
export const LEGACY_SHARED_FOLDER_SPELLINGS: Readonly<Record<SharedFolderName, readonly string[]>> =
  Object.freeze({
    common: Object.freeze(["common"] as const),
    floating: Object.freeze(["floating"] as const),
  });

/**
 * Every spelling of one shared folder that a disk may legally use, canonical
 * first.
 *
 * Canonical-first matters twice: `sharedFolderName` returns the identity so the
 * order is invisible there, but any future caller wanting "the name to show"
 * gets the one the product teaches rather than whichever alias it stumbled on.
 */
export function acceptedSharedFolderSpellings(id: SharedFolderName): readonly string[] {
  return [SHARED_FOLDER_DISPLAY_NAMES[id], ...LEGACY_SHARED_FOLDER_SPELLINGS[id]];
}

/**
 * ⚠️ **THERE IS NO `DESCRIPTION_SEPARATOR` ANY MORE, AND `||` IS NOT A LEGACY
 * SPELLING.**   (Slice #28.02)
 *
 * Until this slice a property folder's free description was separated from the
 * identifiers by two vertical bars, on the #26.01 reasoning that a description
 * separated by the same character the identifiers use cannot be told from
 * another identifier — `48-50D-2716` would be a three-part cadastral name or a
 * two-part one with a description, and the parser would have to guess.
 *
 * The guess is settled by POSITION instead: the first dash ends the tarla, the
 * second ends the parcela, and everything after the second is description —
 * third and further dashes included. There is nothing left to tell apart.
 *
 * `||` is not accepted, not deprecated and not special. A folder named
 * `48-50D||Livada` parses as tarla `48`, parcela `50D||Livada` — the bars are
 * ordinary characters that fall where the dash rule puts them — and nothing
 * anywhere suggests them back to the user. **Do not reintroduce the constant in
 * order to "still accept the old form": accepting it would mean parcela `50D` in
 * one archive and `50D||Livada` in another, decided by a character whose
 * significance the user cannot see.**
 */

// ---------------------------------------------------------------------------
// The property-folder name — a POSITION, not a grammar   (Slice #28.02)
// ---------------------------------------------------------------------------

/**
 * The outcome of reading a property folder's name.
 *
 * ⚠️ **ONE failure, where there used to be two, and that is the whole of
 * relaxation #1.** Until #28.02 this enforced a cadastral grammar on both sides
 * of the dash — digits, optionally joined by `per`, with a one-letter or `bis`
 * suffix — and could fail in two ways: `"cadastral"` (nothing usable at the
 * start of the name) and `"separator"` (the identifiers were right, the
 * description was attached with a dash instead of `||`). The second reason is
 * gone with the separator it existed for, and STR-06 went with it.
 *
 * The grammar is gone too. `40-212per40IE55821-Busuioc Ion` is real data and the
 * grammar refused it, because `212per40IE55821` is not "digits, `per`, digits".
 * A parcela is whatever the deed says it is, and no pattern this module could
 * write knows that better than the person who typed the folder name.
 *
 * What replaces the grammar is not a looser pattern — it is a QUESTION. See
 * `needsPropertyConfirmation` and STR-15.
 */
export type PropertyFolderName =
  | {
      ok: true;
      /**
       * Everything before the first dash, trimmed. As written, `per` and all —
       * `perToSlash` is the caller's job, at the DB boundary.
       */
      tarla: string;
      /**
       * Everything between the first dash and the second, trimmed; everything
       * after the first when there is no second.
       */
      parcela: string;
      /**
       * Everything after the SECOND dash, trimmed — third and further dashes
       * included, because they belong to the description and not to a fourth
       * field. `null` when the name carries no second dash, or nothing after it.
       */
      description: string | null;
    }
  | {
      /**
       * ⚠️ A one-member union rather than a bare `null`, and not out of
       * ceremony: every call site reads `parsed.ok` and then reaches straight
       * for `parsed.tarla`. The discriminant is what makes the compiler enforce
       * the check that a `null` would leave to each caller to remember.
       */
      ok: false;
    };

/**
 * Read a property folder's name. **Positional. No grammar, and no guard on the
 * shape of either identifier.**
 *
 *   "47per2-225per3per24"             → tarla 47per2, parcela 225per3per24
 *   "48-50D"                          → tarla 48,     parcela 50D
 *   "40-212per40IE55821-Busuioc Ion"  → tarla 40,     parcela 212per40IE55821,
 *                                        description "Busuioc Ion"
 *   "48-50D-Livada-de-sus"            → tarla 48,     parcela 50D,
 *                                        description "Livada-de-sus"
 *   "2024-Arhiva"                     → tarla 2024,   parcela Arhiva   ← STR-15 asks
 *   "48-50D||Livada"                  → tarla 48,     parcela "50D||Livada"
 *   "Documente generale"              → not a property folder
 *
 * The last-but-one is `||` being read as what it now is: four ordinary
 * characters in the middle of a parcela. See the note above.
 *
 * ⚠️ **THE ONE CONDITION BEYOND "there is a dash", AND IT IS NOT A SHAPE
 * TEST.** Both identifiers must be non-empty once trimmed, so `-50D`, `48-` and
 * `48 - ` are not property folders. That is an absence, not a shape: the slice
 * forbids a digit test, a length test and a suffix list, and this is none of
 * them. It is here because `hasCadastralIdentity` refuses a half identity at the
 * database boundary — a Property carrying a tarla and no parcela can never be
 * matched to a folder again — so a name blessed with an empty half would parse
 * cleanly, pass the whole Structure stage, and then fail the property step with
 * a 400 in the middle of a run that has already written rows. STR-04 catches it
 * here instead, in a sentence that names what is missing.
 *
 * ⚠️ **`per` is NOT decoded here.** `212per40IE55821` comes out exactly as
 * written and reaches the database as `212/40IE55821`, once, through
 * `cadastralValue` at the boundary.
 */
export function parsePropertyFolderName(rawName: string): PropertyFolderName {
  const name = rawName.trim();

  const firstDash = name.indexOf("-");
  if (firstDash === -1) return { ok: false };

  const tarla = name.slice(0, firstDash).trim();
  const afterTarla = name.slice(firstDash + 1);

  const secondDash = afterTarla.indexOf("-");
  const parcela = (secondDash === -1 ? afterTarla : afterTarla.slice(0, secondDash)).trim();
  // `|| null` rather than `?? null`: an all-whitespace description trims to
  // `""`, which is a description the user did not write.
  const description =
    secondDash === -1 ? null : afterTarla.slice(secondDash + 1).trim() || null;

  if (tarla === "" || parcela === "") return { ok: false };

  return { ok: true, tarla, parcela, description };
}

/**
 * Does this identifier actually USE `per` as the fraction bar?
 *
 * ⚠️ **`perToSlash`, asked rather than restated, and the delegation IS the
 * rule.** The obvious implementation is `/per/i.test(segment)` — and it was, for
 * one adversarial round. `per` is a fragment of ordinary Romanian and English
 * words, so that version answered "yes, this carries a cadastral fraction" for
 * `superficie`, `Perdea`, `Perimetru`, `Persoane` and `Supermarket` — and STR-15
 * then never asked about `12-superficie teren`, which sailed through a clean
 * Structure stage and became a Property. (The value it wrote was mangled too;
 * that half is fixed in `perToSlash` itself, which had the same assumption.)
 *
 * Asking the decoder closes it by construction: this is `true` exactly when the
 * decoder would change the string, so the question STR-15 asks and the value the
 * database receives can never disagree about what `per` meant. Two definitions
 * of "is this a cadastral fraction" is the drift this codebase deletes rules to
 * avoid.
 *
 * ⚠️ **The IDENTIFIERS, never the description.** `40-212-Perdea` is asked about;
 * the description is free text and says nothing about whether this is a parcel.
 */
function usesPerAsSeparator(segment: string): boolean {
  return perToSlash(segment) !== segment;
}

/**
 * Must the user be asked whether this folder really is a property?
 *
 * The whole of Point #1. A positional parse with no grammar behind it reads
 * `2024-Arhiva` as tarla 2024 / parcela Arhiva, which is precisely what #23.00's
 * grammar existed to refuse — so the refusal moves out of the parser and becomes
 * a question the user answers once per folder.
 *
 * ⚠️ **A genuine `48-50D` is asked about too, and no exception is carved for
 * it.** It carries no `per`, so nothing in the name distinguishes it from
 * `2024-Arhiva`, and a rule that tried would be a grammar wearing a hat. The
 * question costs one click; the grammar cost a slice and still refused real
 * data.
 *
 * ⚠️ **This is a QUESTION, never a refusal to parse** — the slice's constraint,
 * in those words. Nothing here narrows what `parsePropertyFolderName` accepts,
 * and nothing here is a digit test, a length test or a suffix list: it is one
 * delegation to the decoder that has to run on these two strings anyway.
 *
 * `false` for anything that is not a property folder at all — STR-04 has that
 * one, and asking "is this a property?" about a folder already reported as not
 * one would be two instructions for one place.
 *
 * ⚠️ **`&&`, SO ONE HALF USING `per` VOUCHES FOR THE OTHER — probed three
 * rounds running, and kept.** `47per2-50D` is asked about by an `||` version and
 * is the commonest shape of real data there is; asking about it on every check
 * would turn the question into noise, which is how a protection stops being
 * read. The price is that `Arhiva 2019-2020per3` is not asked about either. That
 * is the slice's own wording ("any such folder whose name contains no `per`")
 * and the shipped Romanian sentence ("a cărui tarla **și** a cărui parcelă nu
 * conțin „per”"), and the folder shape it lets through — a Windows copy, an
 * archive named beside a real parcel — is caught by STR-03 whenever it duplicates
 * a real property, which is the case that actually costs something.
 */
export function needsPropertyConfirmation(rawName: string): boolean {
  const parsed = parsePropertyFolderName(rawName);
  if (!parsed.ok) return false;
  return !usesPerAsSeparator(parsed.tarla) && !usesPerAsSeparator(parsed.parcela);
}

/**
 * The user's answer to STR-15, for one folder.
 *
 * `"property"` clears the violation and the folder imports normally.
 * `"not-property"` does NOT clear it: the folder still cannot be imported, and
 * the stage replaces the question with the instruction to take it out of the
 * chosen folder.
 *
 * ⚠️ **Nothing here deletes anything** (Adrian, #28.02). The slice's first
 * sketch had the wizard offer to delete the folder; the folder is picked
 * `mode: "read"`, the screen promises in Romanian that the system never touches
 * the user's files, and a recursive delete from a browser does not pass through
 * the Recycle Bin. The remedy is the same File Explorer round trip every other
 * finding asks for.
 */
export type PropertyConfirmation = "property" | "not-property";

/** The answers so far, keyed by the folder's path from the chosen folder. */
export type PropertyConfirmations = ReadonlyMap<string, PropertyConfirmation>;

/**
 * What makes two property folders the same property — the STR-03 comparison.
 *
 * `per` is decoded and case is folded, because `47per2` and `47PER2` reach the
 * database as the identical `47/2` and would be one Property with two folders
 * feeding it. Whitespace inside the name is normalised for the same reason:
 * `48 - 50D` and `48-50D` parse to the same pair.
 *
 * ⚠️ **The key itself is `cadastralIdentityKey`'s, not this module's** (Slice
 * #26.07). It used to be three lines of local decoding here, and #26.07 needed
 * the identical key to find the Property a folder already has in the database
 * — at which point two implementations of "same parcel" would have existed, one
 * refusing duplicate folders and one matching rows, free to drift apart by a
 * space. The rule that STR-03 enforces and the rule the import matches on are
 * now the same function. What this keeps is the part that IS structural: only a
 * name that parses has an identity at all.
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
  return cadastralIdentityKey(parsed.tarla, parsed.parcela);
}

// ---------------------------------------------------------------------------
// The rest of the vocabulary
// ---------------------------------------------------------------------------

/**
 * Which shared folder this name IS — character for character, canonical
 * spelling or accepted legacy one. Anything else is not one.
 *
 * ⚠️ **Returns the IDENTITY, never the string it was handed.** Before #26.11
 * the two were the same value and the function could return its own argument;
 * they are not any more, and a caller that wants the name to show the user must
 * go through `SHARED_FOLDER_DISPLAY_NAMES`. Returning the matched spelling
 * instead would put `common` back into a Romanian sentence for any user whose
 * disk still says `common` — the exact thing the slice removed.
 *
 * Still exact rather than folded: a marker that has to be matched loosely is a
 * marker that has already failed. `Comune` and `COMUNE` are STR-05, below.
 */
export function sharedFolderName(name: string): SharedFolderName | null {
  return (
    SHARED_FOLDER_NAMES.find((id) => acceptedSharedFolderSpellings(id).includes(name)) ?? null
  );
}

/**
 * A folder MEANT to be one of the two and misspelled — the STR-05 case.
 *
 * Folded comparison, so `Comune`, `COMUNE` and ` comune ` all resolve — and so
 * do `Common` and `COMMON`, because the legacy spellings are matched here too.
 * That is deliberate: someone whose disk says `Common` is fixing a capital
 * letter either way, and the rename instruction they get names the canonical
 * `comune`, so the one chore they are asked to do also brings them forward.
 * `foldRomanian` is the codebase's one folding function (lowercase, trim,
 * collapse whitespace, strip diacritics through NFD, covering both encodings
 * of ș/ț) and re-implementing a subset of it here is how two definitions of
 * "the same name" begin disagreeing.
 *
 * ⚠️ **`comun` is still NOT a near miss of `comune`**, by the same argument
 * #26.01 made for it against `common`: it is a different word, it folds to
 * itself, and it falls to STR-04, which asks the user to choose a real name
 * rather than telling them they made a typo they did not make.
 *
 * Returns `null` for a name that is already accepted, so STR-04 and STR-05 stay
 * mutually exclusive by construction: a misspelt shared folder gets the rename
 * instruction, never the useless "this is not a property folder".
 */
export function sharedFolderNearMiss(name: string): SharedFolderName | null {
  if (sharedFolderName(name) !== null) return null;
  const folded = foldRomanian(name);
  return (
    SHARED_FOLDER_NAMES.find((id) => acceptedSharedFolderSpellings(id).includes(folded)) ?? null
  );
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
 * run consecutively, which a file with no number can never be part of.
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
