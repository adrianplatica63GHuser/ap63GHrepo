/**
 * src/lib/import/folder-utils.ts
 *
 * Utilities for Slice #21.01.Import:
 *  - Recursive folder walk (File System Access API)
 *  - Folder-name parsing (tarla/sola + parcela for property folders)
 *  - Page-group detection (numbered-image scanner subfolders)
 *  - Title-hint generation with abbreviation expansion
 *  - Tag-string extraction from entry path
 *
 * Slice #24.03 removed this file's `IMAGE_EXTS` set, `extOf` and `isImageName`;
 * #24.04 renamed `isSystemFile` to `isIgnoredFileName` and gave it the
 * registry's `"ignored"` kind as a third rule.
 * "Which extensions are images" and "how do I read an extension" are now asked
 * of src/lib/files/file-kinds.ts, the one module that answers them. What stays
 * here is the walk: page-group detection keeps the "and ALL of them, and at
 * least one" half of the rule, and delegates the per-file half.
 */

import { baseNameOf, isFileKind, isPageGroupMember } from "@/lib/files/file-kinds";

// ---------------------------------------------------------------------------
// Minimal File System Access API types (avoids app/ -> lib/ import)
// ---------------------------------------------------------------------------

export type FSFileHandle = {
  kind: "file";
  name: string;
  getFile: () => Promise<File>;
};

/** Permission descriptor for the File System Access API. */
export type FSPermissionDescriptor = { mode?: "read" | "readwrite" };
export type FSPermissionState = "granted" | "denied" | "prompt";

export type FSDirectoryHandle = {
  kind: "directory";
  name: string;
  values: () => AsyncIterable<FSFileHandle | FSDirectoryHandle>;
  /**
   * Optional in this type because the walk never needs them and the test stubs
   * do not implement them — but real Chromium handles do, and a lapsed grant
   * can only be recovered inside a user gesture (Slice #24.02c's re-check).
   */
  queryPermission?: (descriptor?: FSPermissionDescriptor) => Promise<FSPermissionState>;
  requestPermission?: (descriptor?: FSPermissionDescriptor) => Promise<FSPermissionState>;
};

// ---------------------------------------------------------------------------
// Entry types produced by the recursive walk
// ---------------------------------------------------------------------------

/** Parsed metadata for a Romanian property folder name. */
export type ParsedFolder = {
  isPropertyFolder: boolean;
  tarlaSola?: string;
  parcela?: string;
  rest?: string;
};

/**
 * A single file (image, PDF, text, Word, etc.).
 * pathParts = folder names from root to the file's immediate parent (no filename).
 *
 * NOTE (Slice #23.00.Import): this used to carry a `folderInfo?: ParsedFolder`
 * field — the nearest digit-prefixed ancestor, decoded as <tarla>-<parcela>.
 * It was removed along with the heuristic: the picked folder now IS one
 * Property, chosen explicitly by the user, so nothing cadastral is inferred
 * from a folder name any more.
 */
export type FSFileEntry = {
  kind: "file";
  name: string;
  /** Path relative to the root, e.g. "Cadastru/scan.jpg" */
  path: string;
  /** Folder segments from root (NOT the filename), e.g. ["Cadastru"] */
  pathParts: string[];
  handle: FSFileHandle;
};

/**
 * A subfolder where every child is a sequentially-numbered image file (scanner output).
 * The whole group becomes ONE document with multiple pages.
 */
export type FSPageGroupEntry = {
  kind: "page-group";
  /** The subfolder name, e.g. "CVC_2021-04-12" */
  name: string;
  /** Path relative to root, e.g. "Acte/CVC_2021-04-12" */
  path: string;
  /** Folder segments including this group folder, e.g. ["Acte", "CVC_2021-04-12"] */
  pathParts: string[];
  /** Image handles sorted by numeric basename (001.jpg < 002.jpg …) */
  handles: FSFileHandle[];
  /** Human-readable title derived from folder name, abbreviations expanded */
  titleHint: string;
};

export type FSEntry = FSFileEntry | FSPageGroupEntry;

// ---------------------------------------------------------------------------
// Folder-name parsing
// ---------------------------------------------------------------------------

/**
 * Parse a Romanian cadastral folder name.
 *
 * ⚠️ NOT USED BY THE IMPORT WIZARD ANY MORE (Slice #23.00.Import).
 *
 * The wizard used to treat a digit-prefixed folder as "<tarla>-<parcela>" and
 * write those values onto a Property. That guess false-positived on ordinary
 * names — "3 Calea Victoriei" became tarla "3", "2024-Arhiva" became tarla
 * "2024" / parcela "Arhiva" — so the wizard now asks the user which Property
 * the folder is, and infers nothing.
 *
 * Two SERVER-side consumers still call this and are deliberately unchanged:
 *   - src/app/api/documents/[id]/process/route.ts — the Process panel on a
 *     document detail page, a separate entry point with the same weakness.
 *   - src/lib/metadata/queries.ts (addEntityTag) — generates "47/2"-style
 *     alias tags. Harmless now that tags are descriptive only, but still
 *     driven by the same digit test.
 *
 * Do not reintroduce it into the import wizard.
 *
 * Property folders start with a digit.
 * Format: "<tarla>-<parcela>[-<rest>]"
 * <tarla> and <parcela> may contain digits and "per" (e.g. "47per2", "225per3per24").
 *
 * Examples:
 *   "47per2-225per3per24-2716 Prisecaru"
 *     → { isPropertyFolder:true, tarlaSola:"47per2", parcela:"225per3per24", rest:"2716 Prisecaru" }
 *   "Documente generale" → { isPropertyFolder: false }
 */
export function parseFolderName(name: string): ParsedFolder {
  if (!/^\d/.test(name)) return { isPropertyFolder: false };
  const d1 = name.indexOf("-");
  if (d1 === -1) return { isPropertyFolder: true, tarlaSola: name };
  const tarlaSola = name.slice(0, d1);
  const rem = name.slice(d1 + 1);
  const d2 = rem.indexOf("-");
  if (d2 === -1) return { isPropertyFolder: true, tarlaSola, parcela: rem };
  const parcela = rem.slice(0, d2);
  const rest = rem.slice(d2 + 1).trim() || undefined;
  return { isPropertyFolder: true, tarlaSola, parcela, rest };
}

// ---------------------------------------------------------------------------
// Abbreviation expansion for document title hints
// ---------------------------------------------------------------------------

const ABBR: Record<string, string> = {
  CVC:             "Contract de Vânzare-Cumpărare",
  TP:              "Titlu de Proprietate",
  CM:              "Certificat de Moștenitor",
  CF:              "Carte Funciară",
  PV:              "Proces Verbal",
  AC:              "Autorizație de Construire",
  CI:              "Carte de Identitate",
  PS:              "Plan de Situație",
  DS:              "Dosar Succesoral",
  // Additions from Adrian's test session
  "Inch Intab":    "Incheiere Intabulare",
  PAD:             "Plan de Amplasament si Delimitare",
  "Plan Parcelar": "Plan Parcelar",
  Antec:           "Antecontract",
  "Cert urbanism": "Certificat urbanism",
};

/**
 * Romanian letters that a folder name may spell either with or without its
 * diacritic. Each entry maps an ASCII base letter to every form that should be
 * treated as that letter.
 *
 * Both encodings of ș/ț are listed — comma-below (U+0219/U+021B, correct
 * Romanian) and cedilla (U+015F/U+0163, the legacy Turkish-borrowed forms still
 * produced by some keyboards, fonts and OCR — the same pair `foldRomanian` in
 * src/lib/import/id-card.ts covers via NFD decomposition).
 */
const DIACRITIC_FORMS: Record<string, string> = {
  a: "aăâàáäã",
  e: "eèéêë",
  i: "iîìíï",
  o: "oòóôöõ",
  u: "uùúûü",
  s: "sșş",
  t: "tțţ",
  c: "cç",
  n: "nñ",
};

/**
 * Build a diacritic-insensitive regex source for one abbreviation key.
 *
 * Each ASCII letter becomes a character class of its accented forms, regex
 * metacharacters are escaped (defensive — no current key contains one, but a
 * future key holding a "." would otherwise match any character), and the space
 * inside a multi-word key becomes `\s+` so "Inch  Intab" still matches.
 *
 * The `i` flag on the compiled regex covers the uppercase forms, so only the
 * lowercase variants need listing above.
 */
function abbrPattern(key: string): string {
  return key
    .split(/\s+/)
    .map((word) =>
      word
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/[a-zA-Z]/g, (ch) => {
          const forms = DIACRITIC_FORMS[ch.toLowerCase()];
          return forms ? `[${forms}]` : ch;
        }),
    )
    .join("\\s+");
}

/**
 * Convert a folder/group name into a human-readable document title hint.
 * Expands known abbreviations at word boundaries — case-insensitive (fix 7.11)
 * and diacritic-insensitive (Slice #23.03.Import) — and replaces underscores
 * with spaces.
 *
 * "CVC_2021-04-12"  → "Contract de Vânzare-Cumpărare 2021-04-12"
 * "cvc_2021-04-12"  → "Contract de Vânzare-Cumpărare 2021-04-12"  (7.11)
 * "TP_1234"         → "Titlu de Proprietate 1234"
 * "Înch Intab 2019" → "Incheiere Intabulare 2019"                 (#23.03)
 *
 * Why the boundaries are lookarounds and not `\b`
 * -----------------------------------------------
 * JavaScript's `\b` is defined over the ASCII word set, so it does not count a
 * diacritic letter as a word character at all. `\bÎnch\b` can therefore never
 * match a name that STARTS with "Î": at offset 0 `\b` asks whether the first
 * character is an ASCII word character, "Î" is not, and the match fails before
 * the diacritic class is ever reached. Unicode-property lookarounds ask the
 * question we actually mean — "is the neighbour a letter or a digit, in any
 * script?" — and behave identically to `\b` for the ASCII names that already
 * worked.
 */
export function folderNameToTitleHint(name: string): string {
  let s = name.replace(/_/g, " ");
  for (const [k, v] of Object.entries(ABBR)) {
    // "giu" — global, case-insensitive, Unicode (required by \p{...}).
    // The replacement is passed as a function so a "$" in a future expansion
    // value is never re-read as a capture-group reference.
    const re = new RegExp(
      `(?<![\\p{L}\\p{N}])${abbrPattern(k)}(?![\\p{L}\\p{N}])`,
      "giu",
    );
    s = s.replace(re, () => v);
  }
  return s.replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Cadastral identifier normalisation
// ---------------------------------------------------------------------------

/**
 * Translate "per" separators to "/" in Romanian cadastral identifiers.
 *
 * In Romanian folder/file names "/" cannot appear, so parcel fractions
 * normally written as "47/2" are encoded as "47per2".  Call this on
 * `tarlaSola` and `parcela` values **before** writing them to the database.
 *
 * Examples:
 *   "47per2"           → "47/2"
 *   "225per3per24"     → "225/3/24"
 *   "47per2-225per3"   → this function is NOT called on the full tag — only
 *                         on the individual segments after splitting on "-"
 *
 * Only applied to narrow cadastral fields, not to general text, so false
 * positives on words like "superintendent" are not a concern in practice.
 */
export function perToSlash(s: string): string {
  return s.replace(/per/gi, "/");
}

// ---------------------------------------------------------------------------
// Page-group detection
// ---------------------------------------------------------------------------

/**
 * Windows metadata files matched by NAME, not by extension.
 *
 * `folder.jpg` is the reason this list exists separately from any extension
 * rule: it is a real image extension that is nonetheless never content. The
 * rest are Windows thumbnail and view-state files that do not start with a
 * dot, so the hidden-file rule below cannot catch them. Comparison is
 * case-insensitive, so "Thumbs.db" and "thumbs.db" are both matched.
 */
const SYSTEM_FILE_NAMES_LC = new Set([
  "thumbs.db",
  "ehthumbs.db",
  "ehthumbs_vista.db",
  "desktop.ini",
  "folder.jpg",     // Windows folder thumbnail
]);

/**
 * Should the walk drop this file without a word?
 *
 * Three rules, and they are three because they are answers to three different
 * questions:
 *
 *  1. **Hidden** — the name starts with "." (.DS_Store, .gitkeep, ._metadata).
 *  2. **A Windows metadata file, by name** — `SYSTEM_FILE_NAMES_LC` above.
 *  3. **An extension of the `"ignored"` kind** — AutoCAD sidecars, autosave
 *     backups, Windows shortcuts, archives and drawings (Slice #24.04). The
 *     LIST lives in src/lib/files/file-kinds.ts and may not be written here:
 *     one module answers "what kind of file is this", and the guard test in
 *     src/__tests__/file-kinds-single-source.test.ts fails the build on a
 *     second copy.
 *
 * Renamed from `isSystemFile` in #24.04. A `.dwg` is not a system file by any
 * reading, and the old name would have made rule 3 look like a category error
 * rather than the point.
 *
 * Why this matters beyond tidiness (fix 7.9, and now again): the walk applies
 * this BEFORE page-group detection, so a folder of ten numbered scans plus one
 * Thumbs.db is still one multi-page document rather than ten separate ones.
 * The same now holds for ten scans plus a stray `.bak`.
 *
 * ⚠️ That cuts further than it first appears, and #24.04 widened its reach.
 * Dropping a file can PROMOTE a folder into a page group that was not one
 * before, and promotion changes more than the row count: `["001.jpg",
 * "plan.dwg"]` used to emit two `FSFileEntry` rows and now emits a single
 * `FSPageGroupEntry`, which takes its title from the FOLDER name rather than
 * the file name and loses the file-only row actions in bulk-import-dialog
 * (the coordinate-source claim, the ID-card extraction). It needs only ONE
 * surviving numbered image, not ten. The mechanism is not new — `Thumbs.db`
 * has always promoted `["001.jpg", "Thumbs.db"]` the same way — but the set of
 * files that can trigger it just grew by eight extensions. Measured against
 * Adrian's archive at the time of the slice: zero folders change
 * classification, in either direction.
 */
export type IgnoredReason = "hidden" | "system-file" | "ignored-extension";

/**
 * WHY the walk drops a file, or `null` if it keeps it.
 *
 * Slice #24.02b split this out of `isIgnoredFileName`. The pre-import report
 * has to tell the user *which* rule removed their file — "hidden" and "this is
 * an AutoCAD sidecar" lead to completely different reactions, and `folder.jpg`
 * (a real scan Windows treats as a thumbnail) is the case that most needs
 * naming. Re-deriving the reason at the call site would have meant a second
 * copy of the rule ORDER, which is the part that actually matters: a file
 * named `.dwg` is hidden first and an ignored extension second, and any copy
 * that disagreed would mislabel it.
 */
export function classifyIgnoredFileName(name: string): IgnoredReason | null {
  // All three rules ask about the BASENAME, and they have to agree on what
  // that is. Rule 3 delegates to `isFileKind`, which strips path segments; if
  // rules 1 and 2 read the raw string instead, then "C:\\scans\\.hidden" is
  // not hidden while ".hidden" is — the same file, two answers, decided by how
  // the caller happened to spell it. `walkFolder` only ever passes a bare
  // name, so this is a latent inconsistency rather than a live bug; it is
  // closed here because the next caller will not know that.
  const base = baseNameOf(name);
  if (base.startsWith(".")) return "hidden";             // hidden (macOS, Linux)
  if (SYSTEM_FILE_NAMES_LC.has(base.toLowerCase())) return "system-file";
  if (isFileKind(base, "ignored")) return "ignored-extension";
  return null;
}

export function isIgnoredFileName(name: string): boolean {
  return classifyIgnoredFileName(name) !== null;
}

/**
 * True if ALL names are image files with purely numeric basenames.
 * ["001.jpg","002.jpg"] → true; ["scan.jpg","001.jpg"] → false.
 *
 * Callers are responsible for pre-filtering dropped files (via
 * `isIgnoredFileName`) before passing names here — `isPageGroup` itself is
 * intentionally pure.
 */
export function isPageGroup(names: string[]): boolean {
  if (names.length === 0) return false;
  // The per-file half of the rule (image kind + numeric basename) lives in the
  // file-kind registry; what is left here is "and every one of them".
  return names.every(isPageGroupMember);
}

function sortNumericFilenames(names: string[]): string[] {
  return [...names].sort((a, b) => {
    const na = parseInt(a.slice(0, a.lastIndexOf(".")), 10);
    const nb = parseInt(b.slice(0, b.lastIndexOf(".")), 10);
    return na - nb;
  });
}

/**
 * ⚠️ **ONE collator, built once.** `a.localeCompare(b, undefined, {…})` has no
 * V8 fast path: the three-argument form constructs a fresh `Intl.Collator` per
 * comparison. Measured while #26.05 was in adversarial review — sorting 20,000
 * paths went from 2–16 ms to 130–148 ms, ~18× — and both checking stages sort
 * every list they emit, synchronously, on the UI thread. The same slice had
 * just removed a quadratic accumulation from `constraint-check.ts` for exactly
 * that reason, and this put a third of a second of it back at the walk ceiling.
 * Hoisted, it is 8 ms, and the order is identical.
 *
 * `undefined` locale on purpose: the folder names come off a Windows disk and
 * the host default is what every other `localeCompare` in the import path has
 * always used.
 */
const DISPLAY_COLLATOR = new Intl.Collator(undefined, { numeric: true });


/**
 * The order every stage lists names and paths in.   (Slice #26.05)
 *
 * `localeCompare`, the comparator `walkInto` above uses on `childFiles` and
 * `childDirs` — so a violation lists names in the order the user meets them
 * everywhere else in the import — with one addition the walk does not need.
 *
 * ⚠️ `localeCompare` alone is not a total order. Collation-ignorable characters
 * — a zero-width space, a soft hyphen, a left-to-right mark, all legal in a
 * Windows filename and all invisible on screen — compare EQUAL to nothing, so
 * `plan.jpg` and `plan\u200b.jpg` tie. `sort` is stable, which means a tie
 * silently falls back to the raw `values()` enumeration order that the checkers
 * exist to remove: `walkFolder` calls its observer BEFORE it sorts, so
 * `keptNames` and `dirNames` arrive in whatever order the filesystem produced.
 * The code-unit comparison behind it settles those pairs the same way every
 * time, and never fires for names that differ visibly.
 *
 * ⚠️ **NUMERIC, since #26.05.** Page files are the one population where the
 * order IS the subject, and `walkInto` sorts a page group's handles with
 * `sortNumericFilenames` — so a plain collation here undid the walk's own order
 * and listed a 25-page scan as 1, 10, 11, 12 … 2, 20. Every renderer truncates
 * to the first four, so the user saw pages 1, 10, 11 and 12 in a list whose
 * whole subject is page numbers.
 *
 * It CHANGES what ties, and that is worth knowing rather than assuming:
 * `"01.jpg".localeCompare("1.jpg")` was a decisive `-1` and the tie-break never
 * ran; numerically the two are equal and it now does. The order that comes out
 * is identical — the code-unit comparison puts `0` before `1` — but that is a
 * property of the tie-break rather than a coincidence, and STR-13 exists
 * precisely because those two names are one page number.
 *
 * This lives here, beside the walk whose order it extends, because #26.05 made
 * it the third place that needs it: the walk, `structure-check.ts` (which wrote
 * it first, for the fix-and-re-check loop — a list that reshuffles between two
 * checks of an unchanged folder is unusable) and now `constraint-check.ts`.
 */
export function compareForDisplay(a: string, b: string): number {
  return DISPLAY_COLLATOR.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0);
}

/** A sorted COPY, in the order above. The input is never mutated. */
export function sortedForDisplay(names: readonly string[]): string[] {
  return [...names].sort(compareForDisplay);
}

/**
 * A checked path as the user will look for it in File Explorer.   (Slice #26.04)
 *
 * Every violation the two checking stages produce carries paths from the CHOSEN
 * folder, and `""` is the chosen folder itself. Neither form is what a user
 * needs while standing in Explorer: an empty string names nothing at all, and a
 * bare `48-50D/Contract` omits the one folder they navigated to.
 *
 * Shared rather than written per component because four renderers need it — two
 * screens and the two take-away pages they save — and four spellings of "where
 * is this" is how one of them starts naming a folder the others do not. (It
 * lived in `structure-check.ts` until #26.05 gave it a second stage.)
 */
export function displayPathOf(chosenFolderName: string, path: string): string {
  if (path === "") return chosenFolderName;
  return chosenFolderName === "" ? path : `${chosenFolderName}/${path}`;
}

// ---------------------------------------------------------------------------
// Tag extraction
// ---------------------------------------------------------------------------

/**
 * Returns all folder names (root → parent folder of file) that should be
 * applied as tags to the imported document. Does NOT include the filename.
 * Tags are lowercase-normalised server-side; we pass the original casing.
 */
export function tagsForEntry(rootFolderName: string, entry: FSEntry): string[] {
  return [rootFolderName, ...entry.pathParts].filter(Boolean);
}

// ---------------------------------------------------------------------------
// Walk observation  (Slice #24.02b)
// ---------------------------------------------------------------------------

/** A file the walk removed, and the rule that removed it. */
export type DroppedFile = {
  name: string;
  /** Full path from the picked root, so the report can point at it. */
  path: string;
  reason: IgnoredReason;
  /** Kept so the metadata pass can size it — `folder.jpg` is only alarming when it is big. */
  handle: FSFileHandle;
};

/**
 * What one directory looked like at the moment the walk decided about it.
 *
 * This exists so the pre-import report can explain a decision instead of
 * merely reporting its result. "This folder became 40 documents" is not
 * actionable; "39 of its 40 files are numbered — `plan.jpg` is the one that
 * is not, and removing it would make this a single 39-page document" is.
 */
export type DirectoryObservation = {
  /** "" at the picked root. */
  path: string;
  pathParts: string[];
  depth: number;
  /** Files that survived the drop filter, in enumeration order. */
  keptNames: string[];
  /**
   * Subdirectory names. Never filtered — the system-file rule applies to
   * files only, so `.git` and `$RECYCLE.BIN` are walked like any folder and
   * any one of them disqualifies a page group (F-03, and STR-10 since #26.02
   * deleted S-03).
   */
  dirNames: string[];
  dropped: DroppedFile[];
  /** Did this directory collapse into a single multi-page Document? */
  becamePageGroup: boolean;
  /**
   * Set when the walk REFUSED to read this directory, and why.
   *
   * When present, `keptNames` and `dirNames` are empty because nothing was
   * enumerated — not because the directory is empty. The distinction matters:
   * the report must say "I could not read this" rather than silently showing
   * a smaller archive than the user has.
   */
  truncated?: WalkLimit;
};

/** Which guard stopped the walk. */
export type WalkLimit = "depth" | "budget" | "breadth";

/**
 * Called once per directory, at the exact point the walk commits to its
 * decision about that directory.
 *
 * An observer rather than a second return value, and rather than the separate
 * simulation the spec sketched: the report must describe the walk that will
 * actually run, and any parallel re-implementation is one refactor away from
 * disagreeing with it. Optional, so every existing caller is untouched.
 */
export type WalkObserver = (observation: DirectoryObservation) => void;

/**
 * How deep the walk will go before refusing to descend further.
 *
 * ⚠️ **This guard is the only thing standing between the wizard and an
 * unrecoverable hang.** A Windows directory junction (or any symlink) that
 * points at one of its own ancestors makes the recursion below infinite: the
 * File System Access API reports it as an ordinary subdirectory, the walk
 * descends, and finds the same junction again. There is no timeout on the
 * walk and no way to cancel it once started, so the tab must be killed.
 *
 * Twelve is far outside anything legitimate. The deepest folder in the real
 * archive is 5, and the structure rules now being introduced cap a compliant
 * archive at 3 (root → property → page folder). Twelve leaves room for the
 * undisciplined folders that exist today while still killing a cycle almost
 * immediately.
 */
export const MAX_WALK_DEPTH = 12;

/**
 * How many directories the walk will read in total before giving up.
 *
 * The depth cap alone is not sufficient. A directory containing TWO junctions
 * back to its ancestors branches at every level, so the number of paths grows
 * as 2^depth — bounded, but 4096 subtree walks before the depth cap bites.
 * Three junctions is half a million. This budget bounds the total work
 * regardless of how the cycle is shaped, and incidentally bounds a genuinely
 * enormous archive too.
 *
 * The largest real folder reads 118 directories, so 5000 is roughly forty
 * times the observed maximum.
 */
export const MAX_WALK_DIRECTORIES = 5000;

/**
 * How many directory entries the walk will enumerate in total.
 *
 * ⚠️ **Without this, the other two guards do not deliver what they claim.**
 * They bound how DEEP the walk goes and how many directories it descends into
 * — but a single directory's `values()` is iterated with no cap at all, so one
 * folder yielding millions of entries (or a stalled network mount whose
 * generator never returns) hangs or OOMs the tab before either guard is ever
 * consulted. Depth and breadth are separate failure modes and the first review
 * of this slice caught only the first one being handled.
 *
 * The largest real folder yields 592 files across 118 directories, so 50,000
 * is roughly eighty times the observed maximum while still failing fast.
 */
export const MAX_WALK_ENTRIES = 50_000;

function makeObservation(
  pathParts: string[],
  childFiles: { name: string; handle: FSFileHandle }[],
  childDirs: { name: string; handle: FSDirectoryHandle }[],
  dropped: DroppedFile[],
  becamePageGroup: boolean,
): DirectoryObservation {
  return {
    path: pathParts.join("/"),
    pathParts: [...pathParts],
    depth: pathParts.length,
    keptNames: childFiles.map((f) => f.name),
    dirNames: childDirs.map((d) => d.name),
    dropped,
    becamePageGroup,
  };
}

// ---------------------------------------------------------------------------
// Recursive folder walk
// ---------------------------------------------------------------------------

/**
 * Recursively walk `dirHandle` and return a flat FSEntry list.
 *
 * Rules:
 *  - A subdirectory whose children are ALL sequentially-numbered images (no
 *    nested subdirs) → one FSPageGroupEntry (becomes one multi-page document).
 *  - All other files → individual FSFileEntry items.
 *  - Empty directories are skipped.
 *
 * Slice #23.00.Import removed the third `ancestorInfo` parameter: the walk no
 * longer tries to work out which ancestor folder is "the property", because
 * the whole picked folder is one Property and the user names it explicitly.
 *
 * Slice #24.02b added the optional `observe` callback. It changes nothing
 * about what the walk returns; it reports what the walk SAW on the way, so the
 * pre-import report can explain each decision rather than re-deriving it from
 * the flattened result — by which point the evidence is gone.
 *
 * @param dirHandle     Directory to walk
 * @param pathParts     Accumulated folder segments from root ([] at root)
 * @param observe       Optional per-directory observer (see WalkObserver)
 */
export async function walkFolder(
  dirHandle: FSDirectoryHandle,
  pathParts: string[] = [],
  observe?: WalkObserver,
): Promise<FSEntry[]> {
  // A budget shared by the whole walk, not per-branch — a cycle that branches
  // would defeat any per-branch counter.
  return walkInto(dirHandle, pathParts, observe, { directoriesRead: 0, entriesSeen: 0 });
}

type WalkBudget = { directoriesRead: number; entriesSeen: number };

async function walkInto(
  dirHandle: FSDirectoryHandle,
  pathParts: string[],
  observe: WalkObserver | undefined,
  budget: WalkBudget,
): Promise<FSEntry[]> {
  // Refuse BEFORE enumerating. Stopping here keeps the refusal cheap and the
  // reason unambiguous.
  const limit: WalkLimit | null =
    pathParts.length > MAX_WALK_DEPTH
      ? "depth"
      : budget.directoriesRead >= MAX_WALK_DIRECTORIES
        ? "budget"
        : null;
  if (limit !== null) {
    // Announce it. A guard that stops quietly produces exactly the failure
    // this codebase has already had once: a confident report describing less
    // data than the user actually has.
    observe?.({
      path: pathParts.join("/"),
      pathParts: [...pathParts],
      depth: pathParts.length,
      keptNames: [],
      dirNames: [],
      dropped: [],
      becamePageGroup: false,
      truncated: limit,
    });
    return [];
  }
  budget.directoriesRead += 1;

  const results: FSEntry[] = [];
  const childFiles: { name: string; handle: FSFileHandle }[] = [];
  const childDirs: { name: string; handle: FSDirectoryHandle }[] = [];
  const dropped: DroppedFile[] = [];

  let ranOutOfEntries = false;
  for await (const child of dirHandle.values()) {
    // Checked INSIDE the enumeration, because this is the only guard that can
    // stop a single directory that never stops yielding.
    if (budget.entriesSeen >= MAX_WALK_ENTRIES) {
      ranOutOfEntries = true;
      break;
    }
    budget.entriesSeen += 1;
    if (child.kind === "file") {
      // fix 7.9 (and Slice #24.04): drop hidden files, Windows metadata and
      // the "ignored" extensions here, before page-group detection, so they
      // neither break it nor pollute the import list.
      const reason = classifyIgnoredFileName(child.name);
      if (reason === null) {
        childFiles.push({ name: child.name, handle: child as FSFileHandle });
      } else {
        dropped.push({
          name: child.name,
          path: [...pathParts, child.name].join("/"),
          reason,
          handle: child as FSFileHandle,
        });
      }
    } else {
      childDirs.push({ name: child.name, handle: child as FSDirectoryHandle });
    }
  }

  // At non-root depth: check for page-group (all numbered images, no subdirs)
  if (pathParts.length > 0 && childDirs.length === 0 && childFiles.length > 0) {
    const names = childFiles.map((f) => f.name);
    if (isPageGroup(names)) {
      // ⚠️ THE TRUNCATION FLAG BELONGS HERE TOO (Slice #26.02).
      //
      // This branch returns before the observation below, and it used to omit
      // `ranOutOfEntries` — so a directory that ran out of entry budget while
      // being read, and whose surviving names happened to all be numbered
      // scans, was reported as a COMPLETE page group. Nothing downstream could
      // tell: S-17 stayed silent, and #26.02's structure check, which
      // suppresses "the pages run 1…n" on a partial listing precisely so it
      // cannot lie, saw no reason to. A folder of 200 pages read to page 96
      // was reported as a 96-page document numbered 1 to 185, with an
      // instruction to renumber from 1 that was already true — a fix-and-
      // re-check loop the user could never leave.
      observe?.({
        ...makeObservation(pathParts, childFiles, childDirs, dropped, true),
        ...(ranOutOfEntries ? { truncated: "breadth" as const } : {}),
      });
      const sorted = sortNumericFilenames(names);
      const groupName = pathParts[pathParts.length - 1];
      results.push({
        kind: "page-group",
        name: groupName,
        path: pathParts.join("/"),
        pathParts: [...pathParts],
        handles: sorted.map((n) => childFiles.find((f) => f.name === n)!.handle),
        titleHint: folderNameToTitleHint(groupName),
      });
      return results;
    }
  }

  observe?.({
    ...makeObservation(pathParts, childFiles, childDirs, dropped, false),
    ...(ranOutOfEntries ? { truncated: "breadth" as const } : {}),
  });

  // Emit individual files
  childFiles.sort((a, b) => a.name.localeCompare(b.name));
  for (const { name, handle } of childFiles) {
    results.push({
      kind: "file",
      name,
      path: [...pathParts, name].join("/"),
      pathParts: [...pathParts],
      handle,
    });
  }

  // Recurse into subdirs
  childDirs.sort((a, b) => a.name.localeCompare(b.name));
  for (const { name, handle } of childDirs) {
    const sub = await walkInto(handle, [...pathParts, name], observe, budget);
    // NOT `results.push(...sub)`. Spreading puts every entry of the subtree on
    // the call stack as arguments, which throws RangeError at roughly 125,000
    // entries — about 250 directories of ordinary size, one twentieth of the
    // 5000 MAX_WALK_DIRECTORIES advertises as supported. A large but perfectly
    // legitimate archive crashed the walk before any guard was reached.
    for (const entry of sub) results.push(entry);
  }

  return results;
}
