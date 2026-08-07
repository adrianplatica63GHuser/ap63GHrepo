/**
 * src/lib/import/constraint-rules.ts — what the FILES themselves must satisfy.
 * (Slice #26.05)
 *
 * Pure, and deliberately inert, exactly as `structure-rules.ts` is. It walks
 * nothing and decides about no real file. It is the CONTRACT: the list of
 * rules, the predicate each one is answered by, and the shape of the answer
 * when one is broken. `constraint-check.ts` measures a picked folder against
 * it; `import-constraints-stage.tsx` puts it on the screen.
 *
 * A RULE ABOUT WHERE A FILE SITS BELONGS TO STRUCTURE. A RULE ABOUT WHAT A
 * FILE *IS* BELONGS HERE.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * That sentence is #26.01's, written in its own header before this module
 * existed, and it is the whole boundary. Structure answers "is this folder
 * shaped the way the import needs" from names alone, before a byte is read.
 * Constraints answers "and will each of these files actually survive the
 * import" — which needs the file's size, so it cannot run until Structure has
 * passed and the metadata pass has read the folder.
 *
 * ⚠️ THE ADMISSION TEST: WOULD THE IMPORT LOSE, MANGLE OR HALT ON IT?
 * ──────────────────────────────────────────────────────────────────
 *
 * A constraint BLOCKS. That makes the bar much higher than it was for the
 * advisory findings these rules came from, and it is the test every candidate
 * has to pass: a rule may only name a file the import would genuinely lose,
 * corrupt, or stop dead on. "The file arrives intact and something about it is
 * merely disappointing" is not enough — that is advice, and advice belongs on
 * the Evaluation report where the user reads it and decides.
 *
 * Two candidates failed the test, and recording WHY is the point:
 *
 *  - **F-17, the Office-file note.** An Office file is stored, is
 *    downloadable, and the only thing missing is that no layer in this
 *    codebase reads text out of it. A blocking version would tell a business
 *    user to delete or convert every Word document in their archive before
 *    importing anything — the same shape as the copy-detection threshold this
 *    repo records as its worst near-miss, which told a user to discard
 *    nineteen folders out of twenty.
 *  - **F-11, "Windows reported no type for this file".** This one WAS drafted
 *    as a constraint and was taken back out by the slice's own adversarial
 *    review, which is worth stating plainly because the reasoning generalises.
 *    `File.type` comes from the extension by way of the OS registry, not from
 *    the bytes — so the rule fires on a `.tif` or a `.bmp` on a machine whose
 *    registry has no entry for it, and never on the corrupt `.jpg` its draft
 *    example described. The file uploads, is stored, and serves correctly (the
 *    serving route derives its Content-Type from the path, not from the
 *    recorded one); all that is lost is automatic AI extraction. That is
 *    exactly F-17's situation, so it gets F-17's answer. Worse, its remedy
 *    ("open it and save it again") could not change the outcome, which would
 *    have made it a violation the user could work at for ever — the failure
 *    mode this module is otherwise arranged to prevent.
 *
 * NOTHING HERE IS NEW (#26.05's brief, in as many words)
 * ─────────────────────────────────────────────────────
 *
 * "The underlying constraint checks already exist and are sound; this slice
 * rewords and re-homes them, it does not re-derive them." Every rule below is
 * an F-rule lifted out of `checks.ts`, where it was an ADVISORY finding on the
 * Evaluation report — a sentence the user read after the point at which acting
 * on it was cheap. What changed is not the predicate but the moment and the
 * force: a constraint is now stated BEFORE the check, checked immediately, and
 * blocks until the folder complies.
 *
 *   CON-01  ← the `"forbidden"` file kind      (had no consumer at all)
 *   CON-02  ← F-07  .heic / .heif
 *   CON-03  ← F-05  the provenance gate
 *   CON-04  ← F-09  an empty file
 *   CON-05  ← F-08  a file over the upload limit
 *   CON-06  ← F-02  a real scan named `folder.jpg`
 *
 * CON-01 is the one that is not merely re-homed. `file-kinds.ts` has carried a
 * `"forbidden"` kind since #24.04 with a note admitting it has no consumer:
 * a `.csv` reaches the provenance gate, which "asks for a provenance where the
 * honest answer is *take this file out of the folder*", and the note names the
 * pre-import screen as the slice that should say so properly. This is that
 * screen. The predicate is the registry's, unchanged; only the sentence is new.
 *
 * EVERY RULE HAS AN ESCAPE, AND THAT IS A REQUIREMENT
 * ───────────────────────────────────────────────────
 *
 * This codebase has already shipped a fix-and-re-check loop a user could not
 * leave (the walk bug found by the SECOND adversarial round of #26.02). A
 * blocking stage whose instruction cannot be carried out is that same defect
 * with better spelling. So every violation sentence below ends with a remedy
 * that is available unconditionally — moving the file out of the chosen folder
 * — beside the remedy that keeps the file. A user who cannot re-scan a page
 * can always take it out and import it later; nobody is ever trapped.
 *
 * ⚠️ **That requirement covers the stage's ONE non-rule refusal too.** Files
 * the metadata pass could not open block the stage and carry no rule ID, so
 * the test that walks this catalogue cannot see them — and the first draft of
 * their sentence offered three conditional remedies and no escape. The copy
 * test covers `constraints.unreadable.intro` explicitly for that reason.
 *
 * NO TECHNOLOGY LANGUAGE. EXAMPLES INSTEAD.
 * ─────────────────────────────────────────
 *
 * The source document is explicit, and #26.05's brief repeats it: the reader
 * is a business user. So there are no MIME types in the copy, no extension
 * lists presented as lists, and no byte counts — the one number that survives
 * is the megabyte figure, because that is the number Windows itself prints
 * beside the file in Explorer, which is where the user will be standing.
 *
 * Each rule therefore carries the same three sentences a structure rule does —
 * `requirement`, `example`, `violation` — and the `example` is not decoration
 * here, it is the rule's real definition for its reader: one bad case and one
 * good one, side by side.
 *
 * NO DISPLAY TEXT LIVES HERE
 * ──────────────────────────
 *
 * Same split as `structure-rules.ts` and `checks.ts`: a stable ID per rule,
 * every user-facing sentence in `messages/*.json` under
 * `adminImport.constraints`.
 */

import { isFileKind, baseNameOf } from "@/lib/files/file-kinds";
import { classifyFileSource } from "@/lib/metadata/provenance-rules";
import type { FileMeta } from "./checks";

// ---------------------------------------------------------------------------
// The catalogue
// ---------------------------------------------------------------------------

/**
 * A stable ID per rule.
 *
 * `CON-` and not `F-`, for the reason `STR-` is not `S-`: the F-numbers still
 * exist in `checks.ts` for the rules that stayed there, and two catalogues
 * sharing a numbering space is how a report ends up citing a rule that no
 * longer means what its reader thinks it means.
 */
export type ConstraintRuleId =
  | "CON-01"   // a file kind that must not be in the folder at all
  | "CON-02"   // an iPhone photo, which uploads and can then neither be seen nor read
  | "CON-03"   // a file the import does not recognise; it halts and asks
  | "CON-04"   // an empty file
  | "CON-05"   // a file too large to upload
  | "CON-06";  // a real scan named `folder.jpg`

/** Every rule ID, in listing order — which is also fixing and checking order. */
export const CONSTRAINT_RULE_IDS: readonly ConstraintRuleId[] = Object.freeze([
  "CON-01", "CON-02", "CON-03", "CON-04", "CON-05", "CON-06",
] as const);

/**
 * Where a rule is answered — and the heading the listing groups it under.
 *
 * The three the brief names: formats, sizes, naming. Carried as data rather
 * than left implicit in the checker, for the reason #26.01 gives: two
 * independent copies of "which rule is about what" would drift, and a business
 * user reading the printed listing wants three sections, not a taxonomy.
 */
export type ConstraintScope =
  | "fileType"   // what the file IS
  | "fileSize"   // how big it is
  | "fileName";  // what it is called

export type ConstraintRule = {
  id: ConstraintRuleId;
  scope: ConstraintScope;
  /**
   * The placeholders this rule's violation sentence interpolates, so a test can
   * prove the message and the checker agree. A sentence naming `{limitMb}` that
   * is handed no `limitMb` renders the placeholder verbatim to a Romanian user,
   * and nothing type-checks that today.
   *
   * ⚠️ **Counts only — a constraint sentence carries no text placeholder, and
   * that is a decision rather than a gap.** #26.01's violation sentences quote
   * two or three example NAMES because each one is about a single folder whose
   * contents the reader has to recognise. A constraint groups files from all
   * over the chosen folder, and their names are very often identical: CON-06's
   * files are all literally called `folder.jpg`, so an example list would read
   * "folder.jpg, folder.jpg, folder.jpg". The complete list of paths is
   * rendered directly beneath the sentence instead — where it is unambiguous,
   * and where the renderer, not the sentence, decides how much of it to show.
   */
  counts: readonly string[];
};

/**
 * Every rule, in the order the listing shows them and the order a file is
 * tested against them: identify the file, then measure it, then read its name.
 *
 * ⚠️ **Reordering this array changes which violation a user is shown for a file
 * that breaks several rules** (`firstBrokenRule`), not merely the order of a
 * printed page. One ordering is load-bearing: **CON-01 and CON-02 come before
 * CON-03.** A `.csv` and a `.heic` are both unrecognised by
 * `classifyFileSource`, so all three rules fire on them. The specific sentence
 * is the useful one: "copy the photo across again" and "take this table out"
 * are actions, "the system does not recognise this" is not.
 */
export const CONSTRAINT_RULES: readonly ConstraintRule[] = Object.freeze([
  { id: "CON-01", scope: "fileType", counts: ["files"] },
  { id: "CON-02", scope: "fileType", counts: ["files"] },
  { id: "CON-03", scope: "fileType", counts: ["files"] },
  { id: "CON-04", scope: "fileSize", counts: ["files"] },
  // `limitMb` is a count and not a value, unlike the identifiers STR-13 and
  // STR-14 had to move out of `counts`: it is a genuine quantity, it is never
  // matched against a filename, and at 20 it is far below the point where
  // Romanian's thousands separator would render it as something the user
  // cannot find. It is also interpolated by the requirement and the example,
  // which is why `constraintListingValues` supplies it.
  { id: "CON-05", scope: "fileSize", counts: ["files", "limitMb"] },
  { id: "CON-06", scope: "fileName", counts: ["files"] },
] as const satisfies readonly ConstraintRule[]);

/** Lookup by ID, so a caller never re-derives the order or the placeholders. */
export const CONSTRAINT_RULE_BY_ID: ReadonlyMap<ConstraintRuleId, ConstraintRule> = new Map(
  CONSTRAINT_RULES.map((r) => [r.id, r] as const),
);

/** The three sentences every rule carries. See `constraintMessageKeyFor`. */
export type ConstraintMessagePart = "requirement" | "example" | "violation";

export const CONSTRAINT_MESSAGE_PARTS: readonly ConstraintMessagePart[] = Object.freeze([
  "requirement",
  "example",
  "violation",
] as const);

/**
 * The i18n key for one sentence of one rule. THE only place the message path is
 * written.
 *
 *  - `requirement` — what the files must be like. Read BEFORE the check, on the
 *    listing the user can save as an offline page.
 *  - `example`     — one bad file and one good one, side by side. For this
 *    catalogue that is not an illustration of the rule, it is the rule as its
 *    reader can check it: a business user cannot verify "no unsupported
 *    formats" and can absolutely verify "not like this, like that".
 *  - `violation`   — read AFTER the check, with the offending files named and
 *    two remedies: the one that keeps the file, and the one that always works.
 */
export function constraintMessageKeyFor(
  id: ConstraintRuleId,
  part: ConstraintMessagePart,
): string {
  return `adminImport.constraints.rule.${id}.${part}`;
}

/** Every scope, in the order the listing shows them. */
export const CONSTRAINT_SCOPES: readonly ConstraintScope[] = Object.freeze([
  "fileType",
  "fileSize",
  "fileName",
] as const);

/** The rules answered at one scope, in catalogue order. */
export function constraintRulesInScope(scope: ConstraintScope): ConstraintRule[] {
  return CONSTRAINT_RULES.filter((r) => r.scope === scope);
}

/** The i18n key for a scope's heading — the section title on the listing. */
export function constraintScopeKeyFor(scope: ConstraintScope): string {
  return `adminImport.constraints.scope.${scope}`;
}

/**
 * The placeholders a rule's `requirement` and `example` sentences interpolate.
 *
 * ⚠️ **Not the same set as the rule's `counts`.** Those describe the VIOLATION
 * sentence, which is rendered out of a `ConstraintViolation` and therefore
 * always has its data to hand. The other two are rendered with no violation in
 * sight — the listing is read before the check — so whatever they interpolate
 * has to come from here, and today that is exactly one number: the size limit
 * CON-05 quotes twice.
 *
 * A function rather than a map, so a caller cannot reach a rule missing from
 * the map and hand next-intl `undefined`. A test walks both locales and fails
 * if this does not supply what a sentence asks for.
 */
export function constraintListingValues(id: ConstraintRuleId): Record<string, number> {
  return id === "CON-05" ? { limitMb: MAX_UPLOAD_MB } : {};
}

/**
 * The numeric placeholders one rule's VIOLATION sentence interpolates.
 *
 * Here rather than in the checker so that "CON-05 quotes the size limit" is
 * written once. The checker knows how many files broke a rule and nothing else
 * about it; the day a second rule needs a constant in its sentence, this is the
 * only line that changes, and the placeholder test fails loudly if it does not.
 */
export function constraintViolationCounts(
  id: ConstraintRuleId,
  files: number,
): Record<string, number> {
  return { files, ...constraintListingValues(id) };
}

// ---------------------------------------------------------------------------
// What a violation looks like
// ---------------------------------------------------------------------------

/**
 * One broken rule, and every file that breaks it.
 *
 * ⚠️ **ONE VIOLATION PER RULE, not one per file — the opposite of
 * `StructureViolation`, deliberately.**
 *
 * #26.01 emits one violation per culprit because a structure remedy is bespoke
 * to its place: rename THIS folder to THAT, move THIS file into THAT one. A
 * list of places is a list of different jobs.
 *
 * A constraint remedy is uniform across every file it names. "Copy these photos
 * across again as ordinary photographs, or take them out of the folder" is one
 * job with a checklist attached, and splitting it into forty identical
 * sentences — Adrian's archive really does hold dozens of files of one kind —
 * would bury the instruction under its own evidence.
 *
 * A file still breaks at most ONE rule, which is #26.01's "one instruction per
 * place" applied at the granularity this stage acts on: see `firstBrokenRule`.
 */
export type ConstraintViolation = {
  ruleId: ConstraintRuleId;
  /**
   * Every file this violation names, as paths from the chosen folder.
   *
   * ⚠️ COMPLETE, never a sample. `checks.ts` shipped a report that truncated
   * its own evidence while claiming completeness — "86 names appear more than
   * once" printed above exactly five of them — and the fix was to make the
   * field complete and let each renderer truncate. The screen shows four and
   * says how many it hid; the saved page shows all of them, which is its whole
   * reason to exist.
   */
  paths: readonly string[];
  /**
   * Numeric placeholders. Keys must match the rule's `counts` exactly — see
   * `ConstraintRule.counts` for why there is no text placeholder to match.
   */
  counts: Readonly<Record<string, number>>;
};

// ---------------------------------------------------------------------------
// The constants the rules are stated in terms of
// ---------------------------------------------------------------------------

/**
 * The largest file the import can upload.
 *
 * ⚠️ **LOAD-BEARING, and it is not this module's number.**
 * `src/app/api/documents/[id]/pages/route.ts` rejects anything larger with a
 * 413 — and it does so AFTER the Document row has been created, so the row
 * stays behind in the archive with no page inside it. Change it there and this
 * must follow, or the stage will bless files the upload then refuses. A test
 * reads that route's own code and fails when the two disagree.
 *
 * Moved here from `checks.ts` with F-08 (#26.05); the value is unchanged.
 */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/** The same limit as the copy quotes it — the number Windows prints in Explorer. */
export const MAX_UPLOAD_MB = Math.round(MAX_UPLOAD_BYTES / 1024 / 1024);

/**
 * Above this, a file named `folder.jpg` is not a Windows folder thumbnail.
 *
 * Windows writes `folder.jpg` as the picture it shows on a folder's icon, and
 * the walk drops that name on sight — so a real scan somebody happened to save
 * as `folder.jpg` disappears with no row and no warning. Size is the only
 * signal available, because the name is the thing that is wrong.
 *
 * ⚠️ It makes CON-06 a rule about BIG `folder.jpg` files and not about the name
 * as such, and the copy has to say so: Windows creates small ones by itself,
 * they are often hidden in Explorer, and a rule that read "no file may be
 * called folder.jpg" would send a business user hunting for files they cannot
 * see and did not make.
 *
 * Moved here from `checks.ts` with F-02 (#26.05); the value is unchanged.
 */
export const THUMBNAIL_BYTES = 100 * 1024;

/** The name Windows reserves for a folder's own thumbnail. CON-06's subject. */
export const FOLDER_THUMBNAIL_NAME = "folder.jpg";

// ---------------------------------------------------------------------------
// The predicates — every one delegated, none restated
// ---------------------------------------------------------------------------

/**
 * A file kind that must not be in the folder at all (CON-01).
 *
 * Delegates to the `"forbidden"` kind in `file-kinds.ts`, which is the whole
 * point: that registry is the one place an extension's meaning is decided, and
 * this rule exists to give its `"forbidden"` entry the consumer its own header
 * says it has been waiting for since #24.04.
 */
export function isForbiddenFileName(name: string): boolean {
  return isFileKind(name, "forbidden");
}

/**
 * An iPhone photo (CON-02).
 *
 * `.heic` / `.heif` belong to no kind at all — Adrian's decision, recorded in
 * `file-kinds.ts` — so they are unrecognised everywhere: page grouping refuses
 * them, classification never sees them, and no browser but Safari will even
 * draw one. They upload perfectly and land in the archive as pages nobody can
 * open. Matched by name here because there is no kind to ask about, and that
 * absence IS the decision rather than an oversight.
 *
 * `.heics` / `.heifs` (a Live Photo or burst sequence) and `.hif` (Canon's
 * spelling) are matched too. They reach the same dead end, and without them the
 * user gets CON-03's generic "the system does not recognise this" instead of
 * the instruction that actually helps.
 */
export function isIphonePhotoName(name: string): boolean {
  return /\.(hei[cf]s?|hif)$/i.test(baseNameOf(name));
}

/**
 * A file the import does not recognise (CON-03).
 *
 * Delegates to `classifyFileSource`, so this rule is answered by the exact
 * predicate that opens the provenance gate at import time. That gate is what
 * makes the rule worth blocking on: an unrecognised extension halts the ENTIRE
 * run behind a modal that must be answered once per such file, so thirty of
 * them is thirty dropdowns before anything at all is imported.
 *
 * The walk has already removed the `"ignored"` kinds (AutoCAD sidecars,
 * autosaves, shortcuts, archives) before anything reaches here, so this fires
 * only for extensions the registry has never heard of — plus the two kinds
 * CON-01 and CON-02 claim first.
 *
 * ⚠️ It can in principle name a file inside a hidden folder — `walkFolder`
 * filters FILES by name and never directories, so `.git/config` would reach
 * `entries` and be refused with an instruction about a folder Explorer does not
 * show by default. Left alone deliberately: such a folder cannot survive the
 * Structure stage that runs first, which refuses it as STR-04 at depth 1, as
 * STR-12 at depth 2 and as STR-10 deeper still. The route exists only if
 * Structure is ever relaxed, and this note is here so that whoever relaxes it
 * knows what it opens.
 */
export function isUnrecognisedFileName(name: string): boolean {
  return classifyFileSource(name) === "UNKNOWN";
}

/**
 * The first rule this file breaks by its NAME alone, or `null` if none.
 *
 * Split out from `firstBrokenRule` after the slice's adversarial review, and
 * the split is load-bearing rather than tidy: a file the metadata pass could
 * not open still has a name, and a `.csv` that happens to be locked by another
 * program is still a `.csv` that must leave the folder. Diagnosing it as
 * "could not be read — close the program using it" would send the user round a
 * loop whose real answer nobody had told them.
 */
export function firstBrokenNameRule(name: string): ConstraintRuleId | null {
  if (isForbiddenFileName(name)) return "CON-01";
  if (isIphonePhotoName(name)) return "CON-02";
  if (isUnrecognisedFileName(name)) return "CON-03";
  return null;
}

/**
 * The first rule this file breaks, in catalogue order, or `null` if it breaks
 * none.
 *
 * One rule per file — #26.01's "ONE INSTRUCTION PER PLACE" at the granularity
 * this stage acts on. A `.heic` breaks CON-02 and CON-03 at once, and handing a
 * user two sentences about one photo turns a fix list into a puzzle. The
 * re-check surfaces the next rule if the first fix did not settle it, which is
 * the loop the source document describes.
 *
 * ⚠️ The order below must stay identical to `CONSTRAINT_RULE_IDS`, and a test
 * pins that it does — the catalogue is the published fixing order, and a
 * checker that disagreed with it would show a user rules in one order while
 * claiming another.
 */
export function firstBrokenRule(name: string, meta: FileMeta): ConstraintRuleId | null {
  const byName = firstBrokenNameRule(name);
  if (byName !== null) return byName;
  if (meta.size === 0) return "CON-04";
  if (meta.size > MAX_UPLOAD_BYTES) return "CON-05";
  return null;
}
