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
 *                         (moved to src/lib/files/file-mime.ts in #34.06)
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
 * It answers membership questions about an extension, and it holds no MIME
 * types and no model-capability list:
 *
 *   - `src/lib/files/file-mime.ts` answers "what Content-Type do I label these
 *     bytes with", which is a different question with a different right
 *     answer. It is asserted to be in step with this registry rather than
 *     derived from it — see that module's header for why the distinction is
 *     load-bearing;
 *   - what the AI ROUTES accept is narrower again — JPEG, PNG, GIF, WebP and
 *     PDF, and nothing else — which is why `isImageOrPdf` below is named after
 *     what it tests rather than after "readable" or "scannable". A `.bmp` or a
 *     `.tif` is an image here, is archived and is served correctly, and the
 *     model still cannot be shown one. Naming this function for a capability
 *     would bury that difference instead of stating it.
 *
 * It DOES now hold the `accept=` string for the document-page picker
 * (`UPLOAD_ACCEPT_ATTRIBUTE`), which #24.03 deferred and #24.04 did not take.
 * That is not a MIME list or a capability list: it is this registry's own
 * membership answer, written in the one syntax a file input can read. Deriving
 * it here is what stops the picker being a fifth list — see Slice #34.06 below.
 *
 * Client-safe: pure, no DB and no server-only imports. Both server routes and
 * client components import it.
 *
 * MEMBERSHIP DECISIONS TAKEN IN SLICE #24.03
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
 *    `isIgnoredFileName` in folder-utils drops every name starting with "."
 *    before the walk emits it — but pinned by tests so it stays a known answer
 *    rather than a surprise if that filter is ever relaxed.
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
 * MEMBERSHIP DECISIONS TAKEN IN SLICE #24.04
 * ──────────────────────────────────────────
 *
 *  - **Eight extensions are `"ignored"`** — `.dwl`, `.dwl2`, `.bak`, `.lnk`,
 *    `.zip`, `.rar`, `.7z`, `.dwg`. The folder walk drops them exactly as it
 *    drops `desktop.ini`. Fifteen files in Adrian's test archive had no kind
 *    at all, and every one of them was an AutoCAD sidecar, an autosave, a
 *    Windows shortcut or an archive — so every import of those folders opened
 *    the provenance gate and demanded a provenance for a lock file, then filed
 *    that lock file in the archive as a Document.
 *
 *    `.bak` is ANY backup, not only AutoCAD's, and `.dwg` — the drawing
 *    itself — is on the list too. That second one reads like genuine archive
 *    material and looks wrong; it is deliberate, taken with the file census in
 *    front of us. A dropped file leaves no trace anywhere in the wizard, which
 *    is the price, and Slice #24.02's "skipped" list is what pays it back.
 *
 *  - **`.csv` is `"forbidden"` and nothing else.** See the entry in REGISTRY:
 *    holding no other kind is precisely what routes it to the provenance gate
 *    today, which is the accepted interim until #24.02 can refuse it in words
 *    that mean what they say.
 *
 * Every decision here is Adrian's. Reversing any of them is a one-line edit to
 * REGISTRY below, and nothing else in the codebase has to change — which is
 * the whole point of the module.
 *
 * MEMBERSHIP DECISIONS TAKEN IN SLICE #34.06
 * ──────────────────────────────────────────
 *
 * Five extensions had never been decided, and #34.06 is the slice that made
 * this registry the single answer it had claimed to be since #24.03. The
 * registry table itself moved by NOTHING: every one of the five was settled by
 * making the other three lists agree with what was already written here.
 *
 *  - **`.rtf` and `.odt` are accepted**, because they were already
 *    `"document"` here and only the picker disagreed. An `.odt` deed used to
 *    need "All files" in the file dialog and then uploaded perfectly.
 *
 *  - **`.xml` and `.html` are refused.** They belonged to no kind here, so
 *    `classifyFileSource` answered UNKNOWN for them, while the picker offered
 *    them and the upload route took them. `/api/files/[...path]` would also
 *    have served an `.html` page `inline` from the app's own origin, which is
 *    a stored-XSS shape and reason enough on its own.
 *
 *  - **`.heic` is refused, and stays in no kind.** The slice's own brief
 *    recommended accepting it; the codebase disagreed and won. Making HEIC an
 *    image would make `classifyFileSource`, `isPageGroupMember`,
 *    `hasReadablePage` and the pre-import forecast all call it readable while
 *    the model routes refuse it — the exact gap #34.06 item 6 exists to close,
 *    for a format no browser but Safari can draw. It would also cost CON-02 in
 *    `constraint-rules.ts` its stated justification, which is that the absence
 *    of a kind IS the decision. Refusing it in the picker and at the route
 *    instead CLOSES the gap #24.03 recorded as the one it created.
 *
 * All five remain one-line edits to `REGISTRY`. Nothing else has to change
 * with them any more — the picker, the upload route and the MIME map now
 * follow, and tests fail if any of them stops following.
 *
 * KNOWN GAPS THIS SLICE DELIBERATELY DID NOT CLOSE
 * ────────────────────────────────────────────────
 *
 *  - The two coordinate-file pickers (`calculation-view.tsx`,
 *    `add-property-dialog.tsx`) do not derive their offer from the
 *    `"coordinate-candidate"` kind, and the property photo picker offers a
 *    browser wildcard. Neither creates a document page, which is what #34.06
 *    was scoped to, so both were left alone.
 *
 *    **Half-closed by Slice #34.20**, which found the same value typed in two
 *    files and moved all three into `lib/files/picker-accept.ts` — one place
 *    each, guarded by `picker-accept.test.ts`. Still NOT derived from this
 *    registry, deliberately and for the reason recorded there: deriving them
 *    from the uploadable set would widen them in the wrong direction, offering
 *    a spreadsheet to a coordinate parser. What remains open is the part that
 *    matters to a user and that no picker can fix on its own — a file the
 *    browser's own filter excludes is never offered and nothing says why.
 *  - A `.bmp` or `.tif` is accepted, stored and served correctly, and the AI
 *    routes still refuse it. #34.06 chose to say so in the copy rather than to
 *    widen the routes — see the `noSamples` and `arithmeticCalls` strings.
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
 *  - `"ignored"` — the folder walk drops it on sight, exactly as it drops
 *    `desktop.ini`. Not archive material and not worth a question: an AutoCAD
 *    lock file exists only while someone has the drawing open, a `.bak` is an
 *    autosave, a `.lnk` is a pointer to a file rather than a file.
 *  - `"forbidden"` — must not be in the folder at all, and somebody has to be
 *    TOLD. This is the difference from `"ignored"`: silence is the right
 *    answer for noise and the wrong answer for a file that should not exist.
 *
 * The last two are the only kinds that say what to DO rather than what a file
 * IS, and that is deliberate — both answers are properties of the extension
 * and both were previously spread across callers or absent entirely.
 */
export type FileKind =
  | "image"
  | "pdf"
  | "document"
  | "coordinate-candidate"
  | "ignored"
  | "forbidden";

/** Every kind, for tests and exhaustiveness checks. Frozen — see `REGISTRY`. */
export const FILE_KINDS: readonly FileKind[] = Object.freeze([
  "image",
  "pdf",
  "document",
  "coordinate-candidate",
  "ignored",
  "forbidden",
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
 *
 * Note the three-way difference, because two of them look alike from outside:
 * an ABSENT extension reaches the provenance gate and is asked about; an
 * `"ignored"` one never gets that far, because the walk drops it; a
 * `"forbidden"` one is absent from every other kind ON PURPOSE, so today it
 * behaves like the first while meaning the third.
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

    // Refused outright (Slice #24.04). `.csv` deliberately holds NO other
    // kind: dropping `"document"` is what makes `classifyFileSource` answer
    // UNKNOWN, which is what routes a stray `.csv` to the provenance gate and
    // halts the import. That gate asks the wrong question — it asks for a
    // provenance where the honest answer is "take this file out of the
    // folder" — and that is the accepted interim until the pre-import screen
    // (Slice #24.02) gives this kind a consumer that can say so properly.
    ".csv":  ["forbidden"],

    // Dropped by the walk, never seen again (Slice #24.04). Every one of these
    // used to reach the provenance gate as an unclassifiable file, so a folder
    // of scans could not be imported until somebody invented a provenance for
    // an AutoCAD lock file — and then that lock file became a Document sitting
    // in the archive next to the deeds.
    ".dwl":  ["ignored"],   // AutoCAD drawing lock — exists only while open
    ".dwl2": ["ignored"],   // AutoCAD drawing lock, second form
    ".bak":  ["ignored"],   // autosave backup, AutoCAD's or anyone else's
    ".lnk":  ["ignored"],   // Windows shortcut — a pointer, not a file
    ".zip":  ["ignored"],
    ".rar":  ["ignored"],
    ".7z":   ["ignored"],
    ".dwg":  ["ignored"],   // see the header: deliberate, and it will look wrong
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

/**
 * The basename of `name`, with any Windows or POSIX path segments removed.
 *
 * Exported because `isIgnoredFileName` in src/lib/import/folder-utils.ts needs
 * the SAME answer for its own name-based rules as this module's extension
 * rules use. Two implementations of "strip the path" would let one predicate
 * answer about the basename and another about the whole string — which is how
 * `isIgnoredFileName("C:\\x\\.hidden")` came to disagree with
 * `isIgnoredFileName(".hidden")` for the same file.
 */
export function baseNameOf(name: string): string {
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
// What may become a document page  (Slice #34.06)
// ---------------------------------------------------------------------------

/**
 * The kinds that make a file archive material.
 *
 * `"coordinate-candidate"` is deliberately absent, and its absence costs
 * nothing: `.txt` is the only extension that holds it and `.txt` is a
 * `"document"` as well, so the union is unchanged. Listing it would state that
 * a coordinate export is uploadable BECAUSE it might hold corners, which is
 * not why — it is uploadable because it is a document, and the day a
 * coordinate kind arrives that is not also a document, the honest answer is to
 * decide about it rather than to have decided by accident here.
 *
 * `"ignored"` and `"forbidden"` are absent for the obvious reason, and so is
 * every extension the registry has never heard of — which is what makes the
 * empty-`File.type` bypass unreachable. See `isUploadableFileName`.
 */
const UPLOADABLE_KINDS: readonly FileKind[] = Object.freeze([
  "image",
  "pdf",
  "document",
] as const);

/**
 * May `name` become a document page?
 *
 * ⚠️ **THIS IS THE ONE ANSWER, AND IT IS ANSWERED BY THE NAME.** The upload
 * route used to answer it from `file.type` against a five-entry block list,
 * and that list was unreachable for exactly the files it existed to stop: the
 * File System Access API leaves `File.type` EMPTY for some files on Windows,
 * which is the deployment target, and `""` is in no block list. This codebase
 * records the same fact from the other direction in `constraint-rules.ts`,
 * where it is the reason a constraint rule based on `File.type` was withdrawn.
 * An extension is a weaker claim about the bytes than a MIME type would be if
 * MIME types were reliable here — but it is the claim every other layer in
 * this app already acts on, and one weak answer everywhere beats a strong one
 * that is silently skipped.
 */
export function isUploadableFileName(name: string): boolean {
  return fileKindsOf(name).some((k) => UPLOADABLE_KINDS.includes(k));
}

/**
 * Every extension that may become a document page, dotted and sorted.
 *
 * Frozen, and derived — never typed. This is what closed the four-way
 * disagreement #34.06 opened on: the picker offered one list, this registry
 * held another, the upload route enforced a third and the serving MIME map
 * carried a fourth, and a user met the difference as an `.odt` that needed
 * "All files", an `.xml` that uploaded and then classified as UNKNOWN, and a
 * `.bmp` that arrived as a download prompt.
 */
export const UPLOADABLE_EXTENSIONS: readonly string[] = Object.freeze(
  KNOWN_EXTENSIONS.filter((ext) => (REGISTRY[ext] ?? NO_KINDS).some((k) =>
    UPLOADABLE_KINDS.includes(k),
  )),
);

/**
 * The `accept` attribute for a document-page file input.
 *
 * ⚠️ **NOT `image/*`, and that is the point.** The old string opened with
 * `image/*`, which every OS picker resolves to include HEIC — the gap #24.03
 * named as the one it created, since HEIC belongs to no kind here and no
 * browser but Safari draws one. An explicit list is the only `accept` value
 * that can agree with a registry, because a wildcard is a promise about a
 * family whose membership the OS decides.
 *
 * `accept` is a hint and nothing more — every file dialog offers "All files" —
 * so it is a convenience, not the enforcement. `AddPageDialog` re-tests with
 * `isUploadableFileName` when a file is chosen, and the upload route tests
 * again on arrival.
 */
export const UPLOAD_ACCEPT_ATTRIBUTE: string = UPLOADABLE_EXTENSIONS.join(",");

// ---------------------------------------------------------------------------
// Derived questions the import path actually asks
// ---------------------------------------------------------------------------

/**
 * Image OR PDF — the two things the client can turn into a bitmap.
 *
 * Named after what it tests, not after a capability — and #34.06 is the slice
 * that proved the distinction was load-bearing rather than pedantic.
 *
 * ⚠️ **THIS IS NOT THE MODEL'S LIST. `isModelReadable` IS.** A `.bmp` and a
 * `.tif` are images here, are archived, are served and are drawn by nothing;
 * the model refuses both. Until #34.06 the import wizard used THIS predicate
 * to decide what was worth sending, to count the calls it would cost, and to
 * decide whether a folder held any readable sample — so a folder of TIFF scans
 * was billed for three calls, told the user three files had been sent, and
 * came back 422 three times. Every one of those four call sites now asks
 * `isModelReadable`; this function is kept because "raster or PDF" is still a
 * true and useful question about the registry, and because renaming it to
 * `isReadable`/`isScannable` is precisely how the confusion started.
 */
export function isImageOrPdf(name: string): boolean {
  const kinds = fileKindsOf(name);
  return kinds.includes("image") || kinds.includes("pdf");
}

/**
 * Every extension the MODEL can be shown.   (Slice #34.06)
 *
 * ⚠️ **THIS IS A VENDOR CAPABILITY, NOT A KIND**, and that is why it is a flat
 * list rather than an entry in `REGISTRY`. A kind is a statement about what a
 * file IS and survives a change of supplier; this list is a statement about
 * what Anthropic's API accepts today and would be wrong the moment that
 * changed. Making it a kind would put "our current model vendor" inside the
 * table that decides what may enter a property archive.
 *
 * It lives in THIS file all the same, because it is still a list of file
 * extensions, and this codebase has exactly one place a list of file
 * extensions may be written — `file-kinds-single-source.test.ts` enforces it,
 * and the seven-way drift recorded at the top of this file is what that rule
 * exists to prevent. `upload-file-types.test.ts` pins that every entry here is
 * an image or the PDF, so this list can never claim something the registry has
 * never heard of.
 *
 * The MIME half of the same fact is `MODEL_IMAGE_MIME_TYPES` in
 * `file-mime.ts`, which the two AI routes dispatch on; a test asserts the two
 * halves describe the same set. Before #34.06 that MIME list was written out
 * THREE times, in `ai-interpret`, `read-sample` and `scan-folder`, and the
 * extension half did not exist at all — so the screens counted one set and the
 * routes accepted another, and `scan-folder` quietly relabelled everything it
 * did not recognise as `image/jpeg` rather than refusing it.
 */
export const MODEL_READABLE_EXTENSIONS: readonly string[] = Object.freeze([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".pdf",
]);

/**
 * Can the model actually be shown `name`?
 *
 * The predicate behind every sentence that says "only JPEG, PNG, GIF and WebP
 * images and PDFs can be read", and behind the number those sentences explain.
 * The two must be the same predicate or the screen contradicts itself in one
 * clause — which is what it did before #34.06, for every folder holding a
 * TIFF.
 */
export function isModelReadable(name: string): boolean {
  return MODEL_READABLE_EXTENSIONS.includes(extensionOf(name));
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
