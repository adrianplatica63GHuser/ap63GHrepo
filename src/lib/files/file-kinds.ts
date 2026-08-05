/**
 * src/lib/files/file-kinds.ts
 *
 * THE one answer to "what kind of file is this?"   (Slice #24.03)
 *
 * WHY THIS EXISTS
 * ───────────────
 *
 * Before this slice the question had SEVEN answers, and they disagreed:
 *
 *   - `IMAGE_EXTENSIONS`  in src/lib/metadata/provenance-rules.ts (10, dotless)
 *   - `DOCUMENT_EXTENSIONS` in the same file                       (9, dotless)
 *   - `IMAGE_EXTS`        in src/lib/import/folder-utils.ts        (8, dotted)
 *   - `IMAGE_EXTS`        in import-wizard.tsx                     (the same 8, retyped)
 *   - `IMAGE_EXTS_SET`    in bulk-import-dialog.tsx                (the same 8, retyped)
 *   - `COORDINATE_FILE_EXTS` in src/lib/import/coordinate-file.ts  (4, dotted)
 *   - `MIME_MAP`          in src/app/api/files/[...path]/route.ts  (16, dotted)
 *
 * — plus `PDF_EXT` declared twice and TWO extension extractors with different
 * contracts (`extOf`, dotted and path-blind; `fileExtension`, dotless and
 * path-aware). The drift was not theoretical. A folder of iPhone scans
 * `001.heic … 012.heic` failed `isPageGroup` and imported as twelve separate
 * documents, while `classifyFileSource` cheerfully stamped each one IMAGE.
 *
 * WHAT THIS MODULE IS, AND WHAT IT IS NOT
 * ───────────────────────────────────────
 *
 * It answers membership questions about an extension, and nothing else. It
 * holds no MIME types, no `accept=` strings and no model-capability list:
 *
 *   - the local-dev serving route's `MIME_MAP` answers "what Content-Type do I
 *     label these bytes with", which is a different question with a different
 *     right answer (a `.bmp` is an image here and still serves as
 *     `application/octet-stream` there — see "Known gaps" below);
 *   - what the AI routes accept and what the file pickers offer belong to
 *     Slice #24.04, which is why `isImageOrPdf` below is named after what it
 *     tests rather than after "readable" or "scannable". Naming it for a
 *     capability would prejudge that slice's decision from inside this one.
 *
 * Client-safe: pure, no DB and no server-only imports. Both server routes and
 * client components import it.
 *
 * MEMBERSHIP DECISIONS TAKEN IN THIS SLICE
 * ────────────────────────────────────────
 *
 *  - **`.heic` / `.heif` are not images.** They were images to
 *    `provenance-rules` alone, and `.heic` alone had a serving MIME type. They
 *    are now in no kind and in no list anywhere. The consequence is deliberate
 *    and worth knowing: `classifyFileSource` returns UNKNOWN for a `.heic`, so
 *    `inferProvenanceForFiles` returns null and the bulk-import gate asks the
 *    user for provenance rather than guessing. A HEIC file stops being
 *    silently second-class and starts asking a question out loud.
 *
 *  - **A file whose whole name is an extension has none.** Not a decision so
 *    much as a consequence of picking the stricter extractor: `extensionOf`
 *    requires the dot to fall inside the basename, so `".txt"` as an entire
 *    file name is extensionless and therefore of no kind, where the former
 *    `extOf` called it a `.txt`. Unreachable through the import wizard —
 *    `isSystemFile` in folder-utils drops every name starting with "." before
 *    the walk emits it — but pinned by tests so it stays a known answer rather
 *    than a surprise if that filter is ever relaxed.
 *
 *  - **Only `.txt` is a coordinate candidate.** The shortlist held four
 *    extensions and now holds one. `.dat` and `.asc` went first: they were
 *    candidates and members of no other kind, which made them the only
 *    coordinate extensions that could not also infer a provenance, so a `.dat`
 *    blocked its own import row at the provenance gate while a `.txt` sailed
 *    through. `.csv` followed on Adrian's decision that a cadastral export
 *    arrives as a `.txt` and nothing else. All three remain perfectly
 *    importable as documents; they are simply no longer OFFERED as the file
 *    that might define a Property's corners.
 *
 * Both decisions are Adrian's, taken at the top of this slice. Reversing either
 * is a one-line edit to REGISTRY below, and nothing else in the codebase has to
 * change — which is the whole point of the module.
 *
 * KNOWN GAPS THIS SLICE DELIBERATELY DID NOT CLOSE
 * ────────────────────────────────────────────────
 *
 *  - `.bmp` is an image kind but has no entry in the serving `MIME_MAP`, so a
 *    stored `.bmp` page is served as `application/octet-stream` and the viewer
 *    renders a download prompt instead of the picture. Pre-existing; the map is
 *    Slice #24.04's.
 *  - `.html` / `.xml` appear in `MIME_MAP` and in the upload `accept` string
 *    but belong to no kind here. Also #24.04.
 *  - The only gap this slice CREATED: `.heic` left `MIME_MAP` with the rest of
 *    the HEIC decision, but `ACCEPTED_FILE_TYPES` in pages-panel.tsx is still
 *    `image/*`, which every OS file picker resolves to include HEIC. So a HEIC
 *    page can still be uploaded, and one already stored now serves as
 *    `application/octet-stream` — a download prompt where there used to be a
 *    picture. Small in practice (only Safari renders `image/heic` at all), and
 *    it is #24.04 that owns what the picker offers.
 */

// ---------------------------------------------------------------------------
// The kinds
// ---------------------------------------------------------------------------

/**
 * The kinds a file can belong to. A file may be several at once: a `.pdf` is
 * both `"pdf"` (it needs rasterising before anything can look at it) and
 * `"document"` (it is stored as-is and nothing is extracted from the bytes),
 * and a `.txt` is both `"document"` and `"coordinate-candidate"`.
 *
 *  - `"image"`               — a raster the browser can draw directly.
 *  - `"pdf"`                 — needs rasterising to page 1 before a model sees it.
 *  - `"document"`            — stored as-is; drives DOC_FILE provenance.
 *  - `"coordinate-candidate"` — MIGHT hold a Stereo 70 export. Never a claim
 *    that it does: a `.txt` of meeting notes and a `.txt` of corners are
 *    indistinguishable by name, so only POST /api/properties/parse-text
 *    counting real corners decides. This kind is a shortlist for the user to
 *    choose from, never an answer.
 */
export type FileKind = "image" | "pdf" | "document" | "coordinate-candidate";

/** Every kind, for tests and exhaustiveness checks. Frozen — see `REGISTRY`. */
export const FILE_KINDS: readonly FileKind[] = Object.freeze([
  "image",
  "pdf",
  "document",
  "coordinate-candidate",
] as const);

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

/**
 * Extension (dotted, lowercase) -> the kinds it belongs to.
 *
 * An extension absent from this table belongs to no kind, which is a real and
 * useful answer: `classifyFileSource` turns it into UNKNOWN, and UNKNOWN means
 * ASK THE USER. Adding an extension here is the ONLY way to change what the
 * import path thinks about it — that is what "one source of truth" buys.
 */
const REGISTRY: Readonly<Record<string, readonly FileKind[]>> = (() => {
  const raw: Record<string, FileKind[]> = {
    // Rasters the browser draws directly.
    ".jpg":  ["image"],
    ".jpeg": ["image"],
    ".png":  ["image"],
    ".gif":  ["image"],
    ".webp": ["image"],
    ".bmp":  ["image"],
    ".tif":  ["image"],
    ".tiff": ["image"],

    // A PDF is both: rasterisable, and a document stored as-is.
    ".pdf":  ["pdf", "document"],

    // Documents proper.
    ".doc":  ["document"],
    ".docx": ["document"],
    ".rtf":  ["document"],
    ".odt":  ["document"],
    ".xls":  ["document"],
    ".xlsx": ["document"],

    // Plain text: a document, and possibly a coordinate export. `.txt` is the
    // ONLY extension a cadastral export may arrive in — see the header.
    ".txt":  ["document", "coordinate-candidate"],
    ".csv":  ["document"],
  };

  // Frozen, and frozen DEEPLY. `fileKindsOf` hands the caller the registry's
  // own array — copying it on every call would allocate once per file in a
  // folder walk — so the array itself has to be the thing that refuses to be
  // written. One `fileKindsOf("x.jpg").push("document")` would otherwise
  // rewrite what every module in the process believes about every .jpg, and
  // the point of collapsing seven private copies into one shared table is lost
  // the moment that table is writable. `Object.freeze` works on an array
  // (unlike on a Set, which is why `extensionsOfKind` returns a copy instead).
  for (const key of Object.keys(raw)) Object.freeze(raw[key]);
  return Object.freeze(raw);
})();

/** Shared frozen answer for "no kinds", so the empty case allocates nothing. */
const NO_KINDS: readonly FileKind[] = Object.freeze([]);

// ---------------------------------------------------------------------------
// Extension extraction — one contract, replacing two
// ---------------------------------------------------------------------------

/** The basename of `name`, with any Windows or POSIX path segments removed. */
function baseNameOf(name: string): string {
  return name.split(/[\\/]/).pop() ?? "";
}

/**
 * The lowercase extension of `name`, WITH its leading dot, or `""` when the
 * name has none.
 *
 * This replaces both former extractors and takes the stricter half of each:
 *
 *  - it strips path segments first, as `fileExtension` did, so
 *    `"1-2-livada/001.png"` and `"C:\dev\scan.tif"` answer `.png` / `.tif`
 *    rather than reading a dot out of a folder name;
 *  - it requires the dot to fall INSIDE the basename (`dot > 0`), as
 *    `fileExtension` did, so a dotfile is extensionless: `.gitignore` is a
 *    file named ".gitignore", not a file with extension ".gitignore". The old
 *    `extOf` disagreed, and nothing depended on it doing so.
 *
 *   "photo.JPG"      -> ".jpg"
 *   "file.tar.gz"    -> ".gz"      (only the final extension is an extension)
 *   "README"         -> ""
 *   ".gitignore"     -> ""
 *   ""               -> ""
 */
export function extensionOf(name: string): string {
  const base = baseNameOf(name);
  const dot  = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot).toLowerCase() : "";
}

/** The same, without the leading dot — the shape provenance codes want. */
export function bareExtensionOf(name: string): string {
  return extensionOf(name).slice(1);
}

// ---------------------------------------------------------------------------
// Membership
// ---------------------------------------------------------------------------

/**
 * Every kind `name`'s extension belongs to; `[]` when the extension is unknown.
 *
 * The returned array is the registry's own, frozen at module load — see
 * `REGISTRY`. Treat it as read-only; it will refuse the write in strict mode
 * and silently ignore it otherwise.
 */
export function fileKindsOf(name: string): readonly FileKind[] {
  return REGISTRY[extensionOf(name)] ?? NO_KINDS;
}

/** Does `name`'s extension belong to `kind`? */
export function isFileKind(name: string, kind: FileKind): boolean {
  return fileKindsOf(name).includes(kind);
}

/** True when this extension belongs to no kind at all. */
export function isUnknownFileKind(name: string): boolean {
  return fileKindsOf(name).length === 0;
}

// Built once at module load.
const BY_KIND: ReadonlyMap<FileKind, ReadonlySet<string>> = (() => {
  const m = new Map<FileKind, Set<string>>(FILE_KINDS.map((k) => [k, new Set<string>()]));
  for (const [ext, kinds] of Object.entries(REGISTRY)) {
    for (const kind of kinds) m.get(kind)!.add(ext);
  }
  return m;
})();

/**
 * Every extension of `kind`, dotted and lowercase.
 *
 * Returns a COPY, deliberately. `ReadonlySet` is a compile-time promise and
 * nothing more — it is erased at runtime, and `Object.freeze` does not work on
 * a Set. `COORDINATE_FILE_EXTS` in src/lib/import/coordinate-file.ts holds
 * whatever this returns for the life of the process, so handing out the
 * registry's own Set would mean one `(COORDINATE_FILE_EXTS as Set<string>)
 * .add(".dat")` anywhere — including in a test exploring a variant — silently
 * rewriting what every module in the process believes about every file. Before
 * this slice the lists were private copies and that was impossible;
 * centralising must not buy drift-resistance at the price of a shared mutable.
 *
 * Every other export defends the same property by being frozen instead:
 * `REGISTRY` and its arrays, `FILE_KINDS`, `KNOWN_EXTENSIONS`. This is the one
 * that has to copy, because it is the one that returns a Set.
 *
 * Cheap to copy in practice — the three production callers all run once, at
 * module load. Nothing calls it per file or per render.
 */
export function extensionsOfKind(kind: FileKind): ReadonlySet<string> {
  return new Set(BY_KIND.get(kind) ?? []);
}

/** Every extension of `kind`, without the leading dot, sorted. */
export function bareExtensionsOfKind(kind: FileKind): readonly string[] {
  return [...extensionsOfKind(kind)].map((e) => e.slice(1)).sort();
}

/**
 * Every extension the registry knows, dotted and sorted.
 *
 * A frozen array rather than a Set on purpose: a Set cannot be frozen, so
 * exporting one would hand every importer a shared mutable — the same hole
 * `extensionsOfKind` dodges by returning a copy.
 */
export const KNOWN_EXTENSIONS: readonly string[] = Object.freeze(
  Object.keys(REGISTRY).sort(),
);

// ---------------------------------------------------------------------------
// Derived questions the import path actually asks
// ---------------------------------------------------------------------------

/**
 * Image OR PDF — the two things the client can turn into a bitmap.
 *
 * Named after what it tests, not after a capability. The import wizard uses it
 * to decide which entries are worth AI-scanning and the bulk dialog uses it to
 * decide whether the "Interpret with AI" button appears; both used to compute
 * this union from their own private extension sets. What the AI routes will
 * actually ACCEPT is a separate list on the server and belongs to Slice #24.04
 * — do not rename this to `isReadable`/`isScannable` and quietly make it that
 * list's client-side twin.
 */
export function isImageOrPdf(name: string): boolean {
  const kinds = fileKindsOf(name);
  return kinds.includes("image") || kinds.includes("pdf");
}

/**
 * Could `name` be one page of a scanner page-group?
 *
 * A page group is a folder whose every child is a sequentially-numbered image,
 * imported as ONE multi-page document. Membership is two tests: the image kind,
 * and a purely numeric basename. `isPageGroup` in
 * src/lib/import/folder-utils.ts is the "and all of them, and at least one"
 * half; this is the per-file half.
 *
 *   "001.jpg"   -> true
 *   "001.heic"  -> false   (not an image kind — see the header)
 *   "scan.jpg"  -> false   (basename is not numeric)
 *   "001.pdf"   -> false
 *   "001"       -> false   (no extension)
 */
export function isPageGroupMember(name: string): boolean {
  // A page-group member is a BARE FILE NAME, never a path. `extensionOf`
  // tolerates path segments because callers elsewhere hand it storage keys, but
  // tolerating one here would silently widen the old inline rule, which tested
  // the numeric prefix against the whole string: "sub/001.jpg" was not a member
  // and must not become one. It would not merely be a wider rule, it would be a
  // broken one — `sortNumericFilenames` parseInt()s the same prefix, so
  // "sub/001" yields NaN and the page ORDER inside the document becomes
  // engine-defined. Unreachable today (`walkFolder` passes basenames), which is
  // exactly why it needs a guard rather than a comment.
  if (/[\\/]/.test(name)) return false;
  if (!isFileKind(name, "image")) return false;
  const dot = name.lastIndexOf(".");
  return dot > 0 && /^\d+$/.test(name.slice(0, dot));
}
