/**
 * src/lib/import/structure-check.ts — the picked folder, measured against the
 * rules.   (Slice #26.02)
 *
 * Pure. It is handed what the walk SAW and it returns violations; no handles,
 * no I/O, no React. #26.01 wrote the contract, this enforces it, and #26.04
 * puts the result on the screen and runs the fix-and-re-check loop.
 *
 * WHY IT READS OBSERVATIONS AND NOT THE FOLDER
 * ────────────────────────────────────────────
 *
 * `DirectoryObservation` is the walk narrating its own decisions — one record
 * per directory, produced at the exact moment `walkFolder` committed to what
 * that directory would become. Every alternative input re-derives something
 * the walk already decided:
 *
 *  - A second walk of its own would have to re-implement the drop filter and
 *    page-group detection, and 26.01's central claim is that the rules must
 *    agree with the walk rather than merely with the source document. Two
 *    implementations of "what will this folder become" is precisely the drift
 *    #26.02's brief exists to remove — it is the same argument that deletes
 *    S-16 from `checks.ts`, applied to this module's own input.
 *  - `FSEntry[]`, the walk's RESULT, has already thrown the evidence away: a
 *    page group is one entry by then, and a folder that failed to become one
 *    is indistinguishable from a folder that never tried.
 *
 * So `keptNames` is trusted to be the walk's surviving files, and `dropped` to
 * be the ones it removed. What this module does NOT do is take the walk's
 * conclusions as its rules: STR-07 asks the question #26.01 wrote down ("are
 * this folder's own files all numbered scans?") rather than the narrower one
 * `becamePageGroup` answers — see the note on that rule for why the difference
 * is a folder losing its documents.
 *
 * A PARTIAL LISTING: WHICH RULES SURVIVE IT
 * ─────────────────────────────────────────
 *
 * A `truncated` observation means the walk stopped. For `depth` and `budget` it
 * refused before enumerating anything, so `keptNames` and `dirNames` are empty
 * because nothing was READ. For `breadth` it stopped part-way through one
 * directory and those arrays hold what it managed to get — and, importantly,
 * `walkFolder` still RETURNS entries for every one of those files, so they will
 * be imported.
 *
 * The first draft skipped all three outright. That is wrong in the direction
 * that matters here: this stage BLOCKS, so silence reads as "your folder is
 * fine", and a chosen folder holding fifty thousand loose files would have been
 * waved through because the walk ran out of budget on the way. S-17 is advisory
 * (`checks.ts`) and cannot make up the difference.
 *
 * So the split is by what kind of claim a rule makes, not by whether the walk
 * finished:
 *
 *  - **Existential rules survive.** "There is a file loose in the chosen
 *    folder", "two folders mean the same property", "a second coordinate file
 *    is here", "two pages carry number 3" — seeing the evidence is enough, and
 *    the unread remainder can only add more. Same for STR-04/05/06, which read
 *    a folder's own name and never its contents.
 *  - **Universal rules do not.** STR-07 ("EVERY file here is a numbered scan"),
 *    STR-11 ("this folder is empty") and STR-14 ("the numbers run 1…n with no
 *    gaps") are all claims about the absence of a counterexample, and the
 *    counterexample may be sitting in the part nobody read. Each is suppressed
 *    on a partial listing.
 *
 * ⚠️ A truncated folder can therefore still pass Structure with those three
 * unreported. Refusing to proceed at all while the walk could not finish is a
 * stage decision and belongs to #26.04 — recorded here so the next reader does
 * not mistake the remaining silence for a clean bill of health.
 *
 * DEPTH IS THE SCOPE
 * ──────────────────
 *
 *   0   the chosen folder            STR-01, STR-02, STR-03
 *   1   a property, `common`, `floating`   STR-04 … STR-09
 *   2   a page folder                STR-10 … STR-14
 *   3+  nothing
 *
 * Nothing at depth 3 or deeper is examined, and that is a decision rather than
 * an omission. A folder that deep only exists because its depth-2 parent broke
 * STR-10, whose instruction moves the whole subtree; reporting what is inside
 * it as well would hand the user a list of fixes for folders that are about to
 * be somewhere else. One instruction per place, and the place is the page
 * folder that should not have had subfolders.
 *
 * EMIT EVERYTHING, THEN REDUCE
 * ────────────────────────────
 *
 * `emitStructureViolations` reports every rule a place breaks;
 * `checkStructure` is that list through `firstPerPlace`, which keeps the
 * earliest rule in catalogue order per culprit. The split is not decoration:
 * the reduction is the user-facing contract and belongs in exactly one place
 * (#26.01's), while a test that wants to prove STR-12 fired on a folder that
 * ALSO breaks STR-14 needs to see the list before the reduction hid it.
 *
 * Callers show `checkStructure`. Nothing else.
 *
 * ORDER, BROKEN FOR DETERMINISM
 * ─────────────────────────────
 *
 * The fix-and-re-check loop means a user reads this list, changes one thing,
 * and reads it again. A list that reshuffles between two checks of an
 * unchanged folder is unusable.
 *
 * ⚠️ **`keptNames` and `dirNames` are NOT sorted.** `walkFolder` calls its
 * observer BEFORE it sorts, so both arrays arrive in raw `values()`
 * enumeration order — an order this module does not control and cannot
 * promise. Everything that reaches a sentence is therefore sorted here, with
 * the same `localeCompare` the walk uses on the entries it emits, so a
 * violation reads the same way whatever order the filesystem happened to
 * enumerate in. That covers the example lists and the two genuine choices:
 *
 *  - **STR-03** keeps the FIRST folder of a duplicate group in sorted order
 *    and names every other one as a culprit, so the instruction is always
 *    "move this one into that one" and never the reverse. Three folders
 *    meaning one property produce two violations, both pointing at the same
 *    survivor — two moves instead of a chain.
 *  - **STR-13** reports the LOWEST colliding page number and only that one. A
 *    folder with three collisions is three renames, and the re-check surfaces
 *    the next as soon as the first is done.
 *
 * `examples` VERSUS `related`
 * ───────────────────────────
 *
 * `related` carries complete PATHS from the chosen folder, because a report
 * that truncates its own evidence while claiming completeness is a defect this
 * codebase has already shipped once. `examples` is what goes INSIDE the
 * sentence: at most three, as bare names rather than paths, with an ellipsis
 * when it truncated — the sentence has already named the folder they are in,
 * and a user recognising a folder does not need to audit it.
 */

import type { DirectoryObservation } from "./folder-utils";
import {
  MAX_PROPERTY_FOLDERS,
  firstPerPlace,
  isDeclaredCoordinateFile,
  isPageFileName,
  isWalkedFileName,
  pageNumberOf,
  parsePropertyFolderName,
  propertyIdentityOf,
  sharedFolderName,
  sharedFolderNearMiss,
  suggestedPropertyFolderName,
  type StructureViolation,
} from "./structure-rules";

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

/** See "DEPTH IS THE SCOPE" in the module header. */
const CHOSEN_FOLDER_DEPTH = 0;
const TOP_LEVEL_DEPTH = 1;
const PAGE_FOLDER_DEPTH = 2;

/** How many names one violation sentence carries before it says "…". */
const MAX_EXAMPLES = 3;

/**
 * Every violation the chosen folder carries, one per place, in fixing order.
 *
 * The list #26.04 shows. An empty array means the folder may be imported as
 * far as STRUCTURE is concerned — the file constraints are a separate stage
 * (#26.05) and say nothing here.
 *
 * An empty `observations` array answers `[]` rather than throwing: a walk that
 * observed nothing is a walk that has not run, and a validator is not the
 * place to discover that.
 */
export function checkStructure(
  observations: readonly DirectoryObservation[],
): StructureViolation[] {
  return firstPerPlace(emitStructureViolations(observations));
}

/**
 * The same, before `firstPerPlace` collapses a place to its first rule.
 *
 * Exported for tests and for nothing else. A caller that shows this to a user
 * hands them three instructions for one folder, which is the guessing game
 * #26.01's "ONE INSTRUCTION PER PLACE" exists to prevent.
 */
export function emitStructureViolations(
  observations: readonly DirectoryObservation[],
): StructureViolation[] {
  const out: StructureViolation[] = [];
  for (const obs of observations) {
    // See "A PARTIAL LISTING" in the module header.
    const partial = obs.truncated !== undefined;

    switch (obs.depth) {
      // No `partial` here: every rule about the chosen folder is existential
      // (a loose file, a sixth property, a duplicate), so none of them can be
      // invalidated by the part of the listing nobody read.
      case CHOSEN_FOLDER_DEPTH:
        chosenFolder(obs, out);
        break;
      case TOP_LEVEL_DEPTH:
        topLevelFolder(obs, partial, out);
        break;
      case PAGE_FOLDER_DEPTH:
        pageFolder(obs, partial, out);
        break;
      default:
        break;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Depth 0 — the folder the user picked
// ---------------------------------------------------------------------------

function chosenFolder(obs: DirectoryObservation, out: StructureViolation[]): void {
  const files = walkedFiles(obs);
  const dirNames = sorted(obs.dirNames);

  // STR-01 — a file sitting loose in the chosen folder belongs to no property
  // and would be imported with no property at all.
  if (files.length > 0) {
    out.push({
      ruleId: "STR-01",
      culprit: obs.path,
      related: files.map((n) => pathUnder(obs, n)),
      counts: { files: files.length },
      values: { examples: examplesOf(files) },
    });
  }

  // STR-02 — only folders that PARSE as a property are counted.
  //
  // Two reasons, and the second is the one that matters. `common` and
  // `floating` are not properties and never count (#26.01, Adrian) — a
  // compliant chosen folder may legitimately hold seven subfolders. And a
  // folder whose name cannot be read as a property is not evidence of a sixth
  // property; it is evidence of a name to fix, which is STR-04's or STR-06's
  // instruction. Counting it here would refuse a folder for holding six
  // properties when the user can see five and one typo.
  const properties = dirNames.filter(isPropertyFolderName);
  if (properties.length > MAX_PROPERTY_FOLDERS) {
    out.push({
      ruleId: "STR-02",
      culprit: obs.path,
      related: properties.map((n) => pathUnder(obs, n)),
      counts: { found: properties.length, max: MAX_PROPERTY_FOLDERS },
      values: {},
    });
  }

  // STR-03 — two folders that reach the database as the same tarla and
  // parcela. `propertyIdentityOf` answers null for anything that is not a
  // property folder, so unreadable names are never compared with each other.
  const byIdentity = new Map<string, string[]>();
  for (const name of dirNames) {
    const identity = identityOf(name);
    if (identity === null) continue;
    byIdentity.set(identity, [...(byIdentity.get(identity) ?? []), name]);
  }
  for (const [identity, names] of byIdentity) {
    if (names.length < 2) continue;
    const [first, ...rest] = names;
    const related = names.map((n) => pathUnder(obs, n));
    for (const name of rest) {
      out.push({
        ruleId: "STR-03",
        culprit: pathUnder(obs, name),
        related,
        counts: {},
        values: { folder: name, other: first, identity },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Depth 1 — a property folder, `common` or `floating`
// ---------------------------------------------------------------------------

/**
 * What a top-level folder turned out to be.
 *
 * `"property"` covers a name that parses AND a name whose only fault is the
 * missing `||` separator: the identifiers are already correct in both cases,
 * so the folder's CONTENTS are worth checking either way. `"unreadable"` is
 * the folder that has to be renamed or moved before anything inside it means
 * anything.
 */
type TopLevelKind = "property" | "shared" | "unreadable";

function topLevelFolder(
  obs: DirectoryObservation,
  partial: boolean,
  out: StructureViolation[],
): void {
  const name = obs.pathParts[obs.pathParts.length - 1] ?? "";
  const files = walkedFiles(obs);
  const kind = classifyTopLevel(name, obs, out);

  // STR-07 — ⚠️ DELIBERATELY STRICTER THAN `becamePageGroup`, and the first
  // draft of this module was not.
  //
  // The rule as #26.01 states it is "a top-level folder's own files are not
  // ALL numbered scans". `becamePageGroup` answers a narrower question, because
  // the walk also requires no subfolder — so `10-20/{1.jpg, 2.jpg, CVC/…}` is
  // not a page group, and the delegating version reported nothing at all about
  // it. What the walk actually does there is emit `1.jpg` and `2.jpg` as two
  // ordinary files, producing two Documents titled "1" and "2". That is the
  // same loss by the other route, and it was the case deleted S-04 used to
  // cover — so leaving it silent would have made this slice a regression.
  //
  // Nothing is blessed that the walk treats differently: `becamePageGroup`
  // IMPLIES this condition (a page group is all page-group members), so every
  // folder the walk merges is still reported. This one also catches the folder
  // the walk explodes.
  //
  // It fires for `common` and `floating` too, by the same argument — hence
  // #26.02's reword of the rule's sentences, which spoke only of properties.
  const allNumbered = files.length > 0 && files.every(isPageFileName);
  if (kind !== "unreadable" && allNumbered && !partial) {
    out.push({
      ruleId: "STR-07",
      culprit: obs.path,
      related: files.map((n) => pathUnder(obs, n)),
      counts: { files: files.length },
      values: { folder: name },
    });
  }

  const coordinates = files.filter(isDeclaredCoordinateFile);
  if (coordinates.length === 0) return;

  // STR-08 / STR-09 — the same evidence, two different instructions, so they
  // are two rules rather than one with a branch. A property may have one
  // coordinate file; a shared folder may have none, because the corners it
  // would describe belong to a property and there is no way to tell which.
  //
  // Neither rule fires for an unreadable folder: until it is renamed there is
  // no answer to "one coordinate file too many, or one in the wrong place".
  if (kind === "property" && coordinates.length > 1) {
    out.push({
      ruleId: "STR-08",
      culprit: obs.path,
      related: coordinates.map((n) => pathUnder(obs, n)),
      counts: { found: coordinates.length },
      values: { folder: name, examples: examplesOf(coordinates) },
    });
  }
  if (kind === "shared") {
    out.push({
      ruleId: "STR-09",
      culprit: obs.path,
      related: coordinates.map((n) => pathUnder(obs, n)),
      counts: { found: coordinates.length },
      values: { folder: name, examples: examplesOf(coordinates) },
    });
  }
}

/**
 * Decide what this folder is, and emit the naming violation if it is not
 * anything yet.
 *
 * The order is the mutual exclusion #26.01 built the vocabulary for: an exact
 * `common` is never a near miss, a near miss never reaches the property
 * grammar, and a name with recoverable identifiers gets the small correction
 * (STR-06) rather than the useless "this is not a property folder" (STR-04).
 */
function classifyTopLevel(
  name: string,
  obs: DirectoryObservation,
  out: StructureViolation[],
): TopLevelKind {
  if (sharedFolderName(name) !== null) return "shared";

  const nearMiss = sharedFolderNearMiss(name);
  if (nearMiss !== null) {
    out.push({
      ruleId: "STR-05",
      culprit: obs.path,
      related: [],
      counts: {},
      values: { folder: name, expected: nearMiss },
    });
    return "unreadable";
  }

  const parsed = parsePropertyFolderName(name);
  if (parsed.ok) return "property";

  if (parsed.reason === "separator") {
    const suggestion = suggestedPropertyFolderName(name);
    if (suggestion !== null) {
      out.push({
        ruleId: "STR-06",
        culprit: obs.path,
        related: [],
        counts: {},
        values: { folder: name, suggestion },
      });
      return "property";
    }
    // Unreachable through `parsePropertyFolderName`, which only answers
    // "separator" when it recovered a prefix — and a recovered prefix is
    // always a suggestion. Kept because a rule that offers a rename it could
    // not compute must fall back to the rule that asks the user to choose the
    // name, never to a sentence with a hole in it.
  }

  out.push({
    ruleId: "STR-04",
    culprit: obs.path,
    related: [],
    counts: {},
    values: { folder: name },
  });
  return "unreadable";
}

/**
 * Does this name read as a property folder — separator fault and all?
 *
 * ⚠️ **"And all" is the whole point, and the first draft got it backwards.** It
 * returned `parsePropertyFolderName(name).ok`, which is false for a missing
 * `||`, while `classifyTopLevel` twelve lines away calls that same folder a
 * `"property"`. So `1-1 … 5-5` plus `6-6 descriere` reported only the separator
 * fault; STR-02 appeared one whole loop round later, after the user had renamed
 * a folder they are about to be told to move anyway.
 *
 * A separator fault is the one wrong name whose IDENTIFIERS are already
 * correct — that is exactly why #26.01 gave it its own failure reason — so it
 * is provably a property, and a rule that counts properties must count it. A
 * `cadastral` failure is different and stays excluded: nothing about
 * `Documente vechi` says a property is hiding in it, and counting it would
 * refuse a folder for holding six properties when the user can see five and a
 * typo.
 */
function isPropertyFolderName(name: string): boolean {
  if (sharedFolderName(name) !== null) return false;
  if (sharedFolderNearMiss(name) !== null) return false;
  const parsed = parsePropertyFolderName(name);
  return parsed.ok || parsed.reason === "separator";
}

/**
 * Which property this folder means — through the suggested name when the only
 * fault is the separator.
 *
 * `propertyIdentityOf` answers `null` for anything that does not parse, and
 * that refusal is right: #26.01 built it so two unreadable names can never be
 * called equal. But `10-20` and `10-20 copie` ARE the same property, and
 * leaving STR-03 silent until the second one is renamed hides the violation
 * that makes the rename pointless — the user is told to insert `||`, does it,
 * and is then told to merge the folder they just fixed.
 *
 * Composed from the two #26.01 functions rather than by loosening either:
 * `suggestedPropertyFolderName` only ever answers for a separator fault, and
 * promises whatever it returns parses.
 */
function identityOf(name: string): string | null {
  const direct = propertyIdentityOf(name);
  if (direct !== null) return direct;
  const suggestion = suggestedPropertyFolderName(name);
  return suggestion === null ? null : propertyIdentityOf(suggestion);
}

// ---------------------------------------------------------------------------
// Depth 2 — the pages of one document
// ---------------------------------------------------------------------------

function pageFolder(
  obs: DirectoryObservation,
  partial: boolean,
  out: StructureViolation[],
): void {
  const name = obs.pathParts[obs.pathParts.length - 1] ?? "";
  const files = walkedFiles(obs);
  const dirNames = sorted(obs.dirNames);

  // STR-10 — a subfolder here is what stops the walk merging this folder into
  // one document, however perfect the file names are.
  if (dirNames.length > 0) {
    out.push({
      ruleId: "STR-10",
      culprit: obs.path,
      related: dirNames.map((n) => pathUnder(obs, n)),
      counts: { subfolders: dirNames.length },
      values: { folder: name, examples: examplesOf(dirNames) },
    });
  }

  // STR-11 — ⚠️ EMPTY MEANS EMPTY ON DISK, not merely empty to the import.
  //
  // The sentence is "this folder is empty, delete it", and the first draft
  // fired it whenever the walk had kept nothing — so a page folder holding
  // `folder.jpg`, `Thumbs.db` and `plan.dwg` was reported as empty and the
  // user was told to delete it. `folder.jpg` is a real scan often enough that
  // `checks.ts` carries a whole rule about it (F-02), and `.dwg` is a drawing
  // somebody made. Telling a business user to delete that folder is the worst
  // thing this stage could do, and it would be doing it in Romanian with a
  // confident tone.
  //
  // So `dropped` is consulted, and a folder that holds only dropped files is
  // passed over in silence here. It is not unreported: F-02 speaks up when a
  // `folder.jpg` is too big to be a thumbnail, and every dropped file appears
  // in the report's Skipped section under the rule that removed it. What this
  // stage must not do is claim something about a folder it can see is not
  // empty.
  if (!partial && files.length === 0 && dirNames.length === 0 && obs.dropped.length === 0) {
    out.push({
      ruleId: "STR-11",
      culprit: obs.path,
      related: [],
      counts: {},
      values: { folder: name },
    });
    return;
  }

  // STR-12 — `isPageFileName` delegates to `isPageGroupMember`, so a numbered
  // PDF is an offender here for the same reason the walk refuses to merge it.
  const offenders = files.filter((n) => !isPageFileName(n));
  if (offenders.length > 0) {
    out.push({
      ruleId: "STR-12",
      culprit: obs.path,
      related: offenders.map((n) => pathUnder(obs, n)),
      counts: { offending: offenders.length },
      values: { folder: name, examples: examplesOf(offenders) },
    });
  }

  const pages = files.filter(isPageFileName);
  if (pages.length === 0) return;

  // STR-13 — `1.jpg` and `01.jpg` are two files and one page number, and the
  // resulting order is whatever the sort happened to do.
  const byNumber = new Map<number, string[]>();
  for (const page of pages) {
    const number = pageNumberOf(page);
    if (number === null) continue;
    byNumber.set(number, [...(byNumber.get(number) ?? []), page]);
  }
  const collisions = [...byNumber.entries()]
    .filter(([, names]) => names.length > 1)
    .sort(([a], [b]) => a - b);
  if (collisions.length > 0) {
    const [number, names] = collisions[0];
    out.push({
      ruleId: "STR-13",
      culprit: obs.path,
      related: names.map((n) => pathUnder(obs, n)),
      counts: {},
      // A string, not a count — see the catalogue. `{number}` as a number
      // renders "1.024" in Romanian above a file called `1024.jpg`.
      values: { folder: name, examples: examplesOf(names), number: String(number) },
    });
  }

  // STR-14 — the numbers must be exactly 1…n, each once.
  //
  // A page file whose basename is too long to be an exact integer has no page
  // number at all (`pageNumberOf`), and cannot be part of a 1…n run — so it
  // fails the length test below and is reported here, which is what #26.01
  // promised would happen to it. `parseInt` is used for the bounds the
  // sentence quotes, because a finite approximation the user can compare
  // against their own filenames beats no number at all.
  const numbers = pages
    .map((n) => pageNumberOf(n))
    .filter((n): n is number => n !== null);
  const runsFromOne =
    numbers.length === pages.length &&
    new Set(numbers).size === pages.length &&
    Math.min(...numbers) === 1 &&
    Math.max(...numbers) === pages.length;
  if (!runsFromOne && !partial) {
    const bounds = pages.map(displayNumberOf);
    out.push({
      ruleId: "STR-14",
      culprit: obs.path,
      related: pages.map((n) => pathUnder(obs, n)),
      counts: { pages: pages.length },
      // Strings, for the reason given on STR-13 above and in the catalogue.
      values: {
        folder: name,
        lowest: String(Math.min(...bounds)),
        highest: String(Math.max(...bounds)),
      },
    });
  }
}

/**
 * The number STR-14's sentence quotes — `parseInt` of the basename, clamped.
 *
 * Not `pageNumberOf`, which answers null above `Number.MAX_SAFE_INTEGER`. This
 * is a bound in a sentence, not an identity, and the folder is already being
 * reported as wrong.
 *
 * ⚠️ The clamp is not defensive tidiness. `parseInt` of a 400-digit basename —
 * a legal `isPageGroupMember`, since the rule is only "digits and an image
 * extension" — is `Infinity`, and the sentence would read "numbered from 1 to
 * ∞". Saying the largest number a page could be is wrong by a finite amount;
 * saying ∞ is not a number the user can look for.
 *
 * ACCEPTED: two basenames above the clamp quote the same bound, so a folder
 * holding a 400-digit and a 401-digit name reads "from … to …" with the same
 * number twice. Both are already being reported as needing renumbering from 1,
 * and no representation of those two names inside a sentence is useful.
 */
function displayNumberOf(name: string): number {
  const parsed = parseInt(name.slice(0, name.lastIndexOf(".")), 10);
  // Non-finite means enormous, never unparseable: `isPageFileName` has already
  // guaranteed the basename is all digits. Clamping UP is the only honest
  // direction — 0 would make this the folder's LOWEST page number.
  return Number.isFinite(parsed) ? Math.min(parsed, Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/**
 * The files in this directory that the import would actually take, sorted.
 *
 * Two things, both load-bearing.
 *
 * The FILTER: `keptNames` has already had the drop filter applied by the walk,
 * so it is a no-op today. It is here because "every rule about the contents of
 * a folder counts only the files `isWalkedFileName` accepts" is THIS module's
 * contract to keep, and a contract that holds only because the caller happened
 * to satisfy it is one nobody notices breaking.
 *
 * The SORT: see the module header. `keptNames` arrives in raw enumeration
 * order because `walkFolder` observes before it sorts, and every list that
 * reaches a sentence has to be stable.
 */
function walkedFiles(obs: DirectoryObservation): string[] {
  return sorted(obs.keptNames.filter(isWalkedFileName));
}

/**
 * The order the walk itself puts entries in — `localeCompare`, the comparator
 * `walkInto` uses on `childFiles` and `childDirs` before emitting them.
 *
 * Deliberately the same one, so a violation lists names in the order the user
 * will meet them everywhere else in the import.
 */
function sorted(names: readonly string[]): string[] {
  // ⚠️ `localeCompare` alone is not a total order. Collation-ignorable
  // characters — a zero-width space, a soft hyphen, a left-to-right mark, all
  // legal in a Windows filename and all invisible on screen — compare EQUAL to
  // nothing, so `plan.jpg` and `plan\u200b.jpg` tie. `sort` is stable, which
  // means a tie silently falls back to the enumeration order this function
  // exists to remove. The code-unit comparison behind it settles those pairs
  // the same way every time, and never fires for names that differ visibly.
  return [...names].sort((a, b) => a.localeCompare(b) || (a < b ? -1 : a > b ? 1 : 0));
}

/** A path from the chosen folder. `obs.path` is `""` at the root. */
function pathUnder(obs: DirectoryObservation, name: string): string {
  return obs.path === "" ? name : `${obs.path}/${name}`;
}

/** At most three names, with an ellipsis when there were more. See the header. */
function examplesOf(names: readonly string[]): string {
  const shown = names.slice(0, MAX_EXAMPLES).join(", ");
  return names.length > MAX_EXAMPLES ? `${shown}, …` : shown;
}
