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

export type FSDirectoryHandle = {
  kind: "directory";
  name: string;
  values: () => AsyncIterable<FSFileHandle | FSDirectoryHandle>;
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
export function isIgnoredFileName(name: string): boolean {
  // All three rules ask about the BASENAME, and they have to agree on what
  // that is. Rule 3 delegates to `isFileKind`, which strips path segments; if
  // rules 1 and 2 read the raw string instead, then "C:\\scans\\.hidden" is
  // not hidden while ".hidden" is — the same file, two answers, decided by how
  // the caller happened to spell it. `walkFolder` only ever passes a bare
  // name, so this is a latent inconsistency rather than a live bug; it is
  // closed here because the next caller will not know that.
  const base = baseNameOf(name);
  if (base.startsWith(".")) return true;                 // hidden (macOS, Linux)
  if (SYSTEM_FILE_NAMES_LC.has(base.toLowerCase())) return true;
  return isFileKind(base, "ignored");
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
 * @param dirHandle     Directory to walk
 * @param pathParts     Accumulated folder segments from root ([] at root)
 */
export async function walkFolder(
  dirHandle: FSDirectoryHandle,
  pathParts: string[] = [],
): Promise<FSEntry[]> {
  const results: FSEntry[] = [];
  const childFiles: { name: string; handle: FSFileHandle }[] = [];
  const childDirs: { name: string; handle: FSDirectoryHandle }[] = [];

  for await (const child of dirHandle.values()) {
    if (child.kind === "file") {
      // fix 7.9 (and Slice #24.04): drop hidden files, Windows metadata and
      // the "ignored" extensions here, before page-group detection, so they
      // neither break it nor pollute the import list.
      if (!isIgnoredFileName(child.name)) {
        childFiles.push({ name: child.name, handle: child as FSFileHandle });
      }
    } else {
      childDirs.push({ name: child.name, handle: child as FSDirectoryHandle });
    }
  }

  // At non-root depth: check for page-group (all numbered images, no subdirs)
  if (pathParts.length > 0 && childDirs.length === 0 && childFiles.length > 0) {
    const names = childFiles.map((f) => f.name);
    if (isPageGroup(names)) {
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
    const sub = await walkFolder(handle, [...pathParts, name]);
    results.push(...sub);
  }

  return results;
}
