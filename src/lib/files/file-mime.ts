/**
 * src/lib/files/file-mime.ts
 *
 * THE one answer to "what Content-Type do these bytes get?"   (Slice #34.06)
 *
 * WHY THIS IS A SEPARATE MODULE FROM `file-kinds.ts`
 * ─────────────────────────────────────────────────
 *
 * Because it answers a different question. `file-kinds.ts` answers "what kind
 * of file is this" — an editorial decision about what may enter the archive.
 * This answers "what label do I put on the bytes when I hand them to a
 * browser", which is a fact about the format rather than a decision about the
 * archive. #24.03 kept them apart for that reason and this module keeps them
 * apart still.
 *
 * WHAT CHANGED IN #34.06 IS NOT THE BOUNDARY, IT IS THE HOME
 * ─────────────────────────────────────────────────────────
 *
 * This table used to be `MIME_MAP`, private to
 * `src/app/api/files/[...path]/route.ts`. Two things made that the wrong
 * place:
 *
 *  1. It had drifted. `.bmp` was an image kind with no entry here, so a stored
 *     `.bmp` page served as `application/octet-stream` and the viewer drew a
 *     download prompt where a picture should have been; `.html` and `.xml` had
 *     entries here and belonged to no kind at all. #24.03 recorded both as
 *     known gaps and left them for a later slice. This is that slice, and
 *     `upload-file-types.test.ts` now fails when the two disagree.
 *  2. The UPLOAD route needs the same answer. `File.type` is empty for some
 *     files on Windows — the deployment target, recorded in this codebase in
 *     three separate places — so a perfectly good `.jpg` was stored as
 *     `application/octet-stream` and then rendered by `PagesPanel` as a
 *     download prompt, because that panel switches on the RECORDED type while
 *     the serving route derives its own from the path. Two consumers means the
 *     table cannot live inside one of them.
 *
 * ⚠️ THIS MODULE DOES NOT DECIDE WHAT MAY BE UPLOADED. `isUploadableFileName`
 * in `file-kinds.ts` does. An entry here is a label, not a permission — which
 * is why the test asserts the two sets are equal rather than letting either
 * one derive from the other. Deriving would make an accidental addition here
 * silently widen what the archive accepts.
 *
 * Client-safe: pure, no DB and no server-only imports.
 */

/**
 * Extension (dotted, lowercase) -> Content-Type.
 *
 * Every uploadable extension has exactly one entry, and nothing else has one —
 * pinned by `src/__tests__/upload-file-types.test.ts`. Add an extension to
 * `REGISTRY` in `file-kinds.ts` and this table has to follow in the same
 * commit, which is the whole point of the test.
 */
export const MIME_TYPES: Readonly<Record<string, string>> = Object.freeze({
  // Rasters the browser draws directly.
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png":  "image/png",
  ".gif":  "image/gif",
  ".webp": "image/webp",
  ".bmp":  "image/bmp",
  ".tif":  "image/tiff",
  ".tiff": "image/tiff",

  ".pdf":  "application/pdf",

  // Documents proper.
  ".doc":  "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".rtf":  "application/rtf",
  ".odt":  "application/vnd.oasis.opendocument.text",
  ".xls":  "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".txt":  "text/plain",
});

/** The fallback for anything this table has never heard of. */
export const OCTET_STREAM = "application/octet-stream";

/**
 * The lowercase dotted extension of `nameOrPath`.
 *
 * Deliberately a local three-liner rather than an import of `extensionOf` from
 * `file-kinds.ts`: keeping this module free of that dependency is what lets
 * the single-source test treat the two as answering separate questions, and
 * the contract here is narrower — this one never has to reason about dotfiles
 * because a stored page always has a UUID basename.
 *
 * It still matches `extensionOf`'s answers for every name that reaches it, and
 * `upload-file-types.test.ts` pins that it does.
 */
function extOf(nameOrPath: string): string {
  const base = nameOrPath.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot).toLowerCase() : "";
}

/**
 * The Content-Type for `nameOrPath`, or `null` when the extension has none.
 *
 * `null` rather than `OCTET_STREAM`, so a caller has to say out loud what it
 * wants to do with "I do not know": the serving route falls back to
 * `OCTET_STREAM`, and the upload route falls back to whatever the browser
 * claimed. Returning the fallback from here would have made those two
 * decisions look like one.
 */
export function contentTypeOf(nameOrPath: string): string | null {
  return MIME_TYPES[extOf(nameOrPath)] ?? null;
}

// ---------------------------------------------------------------------------
// What the model can be shown  (Slice #34.06)
// ---------------------------------------------------------------------------

/**
 * The four image types Anthropic's API accepts, and no other.
 *
 * Written out here as a `const` tuple because the AI routes need the
 * LITERAL UNION as a type — their `ContentBlock` shape has
 * `media_type: SupportedImage`, so a `readonly string[]` would not typecheck.
 * All THREE routes that talk to the model used to declare this list privately —
 * `ai-interpret` inside a function body, `read-sample` at module scope, and
 * `scan-folder` inline beside a normalise-to-jpeg fallback that hid the
 * disagreement by relabelling whatever it did not recognise. That is how a
 * fifth, sixth and seventh copy of "what may be read" came to exist alongside
 * the four this slice collapsed.
 *
 * The extension half of the same fact is `MODEL_READABLE_EXTENSIONS` in
 * `file-kinds.ts` (which also carries `.pdf`, sent as a `document` block
 * rather than an `image` one). `upload-file-types.test.ts` asserts the two
 * halves describe the same set, so neither can be widened alone.
 */
export const MODEL_IMAGE_MIME_TYPES = Object.freeze([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const);

/** One of the four above — the literal union the AI routes' blocks need. */
export type ModelImageMimeType = (typeof MODEL_IMAGE_MIME_TYPES)[number];

/** The one document type the model accepts, alongside the four images. */
export const MODEL_DOCUMENT_MIME_TYPE = "application/pdf";
