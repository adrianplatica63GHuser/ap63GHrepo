/**
 * src/lib/import/folder-utils.ts
 *
 * Utilities for Slice #21.01.Import:
 *  - Recursive folder walk (File System Access API)
 *  - Folder-name parsing (tarla/sola + parcela for property folders)
 *  - Page-group detection (numbered-image scanner subfolders)
 *  - Title-hint generation with abbreviation expansion
 *  - Tag-string extraction from entry path
 */

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
 */
export type FSFileEntry = {
  kind: "file";
  name: string;
  /** Path relative to the root, e.g. "47per2-225/scan.jpg" */
  path: string;
  /** Folder segments from root (NOT the filename), e.g. ["47per2-225"] */
  pathParts: string[];
  handle: FSFileHandle;
  /** Nearest property-folder ancestor, if any */
  folderInfo?: ParsedFolder;
};

/**
 * A subfolder where every child is a sequentially-numbered image file (scanner output).
 * The whole group becomes ONE document with multiple pages.
 */
export type FSPageGroupEntry = {
  kind: "page-group";
  /** The subfolder name, e.g. "CVC_2021-04-12" */
  name: string;
  /** Path relative to root, e.g. "47per2-225/CVC_2021-04-12" */
  path: string;
  /** Folder segments including this group folder, e.g. ["47per2-225", "CVC_2021-04-12"] */
  pathParts: string[];
  /** Image handles sorted by numeric basename (001.jpg < 002.jpg …) */
  handles: FSFileHandle[];
  /** Human-readable title derived from folder name, abbreviations expanded */
  titleHint: string;
  folderInfo?: ParsedFolder;
};

export type FSEntry = FSFileEntry | FSPageGroupEntry;

// ---------------------------------------------------------------------------
// Folder-name parsing
// ---------------------------------------------------------------------------

/**
 * Parse a Romanian cadastral folder name.
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
  CVC: "Contract de Vânzare-Cumpărare",
  TP: "Titlu de Proprietate",
  CM: "Certificat de Moștenitor",
  CF: "Carte Funciară",
  PV: "Proces Verbal",
  AC: "Autorizație de Construire",
  CI: "Carte de Identitate",
  PS: "Plan de Situație",
  DS: "Dosar Succesoral",
};

/**
 * Convert a folder/group name into a human-readable document title hint.
 * Expands known abbreviations at word boundaries, replaces underscores with spaces.
 *
 * "CVC_2021-04-12" → "Contract de Vânzare-Cumpărare 2021-04-12"
 * "TP_1234"        → "Titlu de Proprietate 1234"
 */
export function folderNameToTitleHint(name: string): string {
  let s = name.replace(/_/g, " ");
  for (const [k, v] of Object.entries(ABBR)) {
    s = s.replace(new RegExp(`\\b${k}\\b`, "g"), v);
  }
  return s.replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Page-group detection
// ---------------------------------------------------------------------------

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff", ".tif"]);

export function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

export function isImageName(name: string): boolean {
  return IMAGE_EXTS.has(extOf(name));
}

/**
 * System / hidden files that should be ignored during folder walks.
 *
 * Hidden files (names starting with ".") cover macOS .DS_Store, .gitkeep,
 * etc.  The explicit set covers Windows thumbnail/metadata files that do NOT
 * start with a dot.  Comparison is case-insensitive so "Thumbs.db" and
 * "thumbs.db" are both ignored.
 *
 * Fix for issue 7.9: without this filter, a folder with 10 scan images plus
 * one Thumbs.db fails `isPageGroup` and each image is imported separately.
 */
const SYSTEM_FILE_NAMES_LC = new Set([
  "thumbs.db",
  "ehthumbs.db",
  "ehthumbs_vista.db",
  "desktop.ini",
  "folder.jpg",     // Windows folder thumbnail
]);

export function isSystemFile(name: string): boolean {
  if (name.startsWith(".")) return true;                      // hidden (macOS, Linux)
  return SYSTEM_FILE_NAMES_LC.has(name.toLowerCase());       // known Windows system files
}

/**
 * True if ALL names are image files with purely numeric basenames.
 * ["001.jpg","002.jpg"] → true; ["scan.jpg","001.jpg"] → false.
 *
 * Callers are responsible for pre-filtering system files (via `isSystemFile`)
 * before passing names here — `isPageGroup` itself is intentionally pure.
 */
export function isPageGroup(names: string[]): boolean {
  if (names.length === 0) return false;
  return names.every((n) => {
    const dot = n.lastIndexOf(".");
    if (dot === -1) return false;
    return isImageName(n) && /^\d+$/.test(n.slice(0, dot));
  });
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
 * @param dirHandle     Directory to walk
 * @param pathParts     Accumulated folder segments from root ([] at root)
 * @param ancestorInfo  ParsedFolder of the nearest property-folder ancestor
 */
export async function walkFolder(
  dirHandle: FSDirectoryHandle,
  pathParts: string[] = [],
  ancestorInfo?: ParsedFolder,
): Promise<FSEntry[]> {
  const results: FSEntry[] = [];
  const childFiles: { name: string; handle: FSFileHandle }[] = [];
  const childDirs: { name: string; handle: FSDirectoryHandle }[] = [];

  for await (const child of dirHandle.values()) {
    if (child.kind === "file") {
      // fix 7.9: skip hidden and known system files so they don't break
      // page-group detection or pollute the import list.
      if (!isSystemFile(child.name)) {
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
        folderInfo: ancestorInfo,
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
      folderInfo: ancestorInfo,
    });
  }

  // Recurse into subdirs
  childDirs.sort((a, b) => a.name.localeCompare(b.name));
  for (const { name, handle } of childDirs) {
    const childPath = [...pathParts, name];
    const parsed = parseFolderName(name);
    const childAncestor = parsed.isPropertyFolder ? parsed : ancestorInfo;
    const sub = await walkFolder(handle, childPath, childAncestor);
    results.push(...sub);
  }

  return results;
}
