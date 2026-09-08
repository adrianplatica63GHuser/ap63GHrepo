/**
 * What may become a document page   (Slice #34.06)
 *
 * The question "which files may enter the archive?" had FOUR answers and only
 * one of them was enforced:
 *
 *   - the picker offered   `image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.xml,.html`
 *   - the registry said    `file-kinds.ts` REGISTRY
 *   - the upload route     refused five executable MIME types and nothing else
 *   - the serving route    labelled a fourth list
 *
 * A user met the difference as an `.odt` deed that needed "All files" in the
 * file dialog and then uploaded perfectly; an `.xml` that uploaded and then
 * classified as UNKNOWN; a `.csv` that blocked a folder import at CON-01 while
 * the manual upload took one; and a `.bmp` that arrived as a download prompt
 * where a picture should have been, because the serving map had no entry for
 * an extension the registry calls an image.
 *
 * This file is what stops there being four again. It asserts the three
 * derived views against the registry — the accept string, the route's
 * predicate, and the MIME table — and it asserts the negative half too, which
 * is the half that rots: every extension the registry does NOT call archive
 * material must be refused by both the picker and the route.
 */

import { readFileSync } from "fs";
import { join } from "path";

import { stripComments } from "@/lib/dev/strip-comments";

import {
  KNOWN_EXTENSIONS,
  UPLOADABLE_EXTENSIONS,
  MODEL_READABLE_EXTENSIONS,
  UPLOAD_ACCEPT_ATTRIBUTE,
  extensionOf,
  extensionsOfKind,
  fileKindsOf,
  isImageOrPdf,
  isModelReadable,
  isUploadableFileName,
} from "@/lib/files/file-kinds";
import {
  MIME_TYPES,
  MODEL_IMAGE_MIME_TYPES,
  contentTypeOf,
} from "@/lib/files/file-mime";

const SRC = join(process.cwd(), "src");

/**
 * Read a module and strip its comments — every guard here is a BEHAVIOUR guard.
 *
 * ⚠️ The SHARED lexer, not a pair of regexes. The first draft of this file used
 * `.replace(/\/\*[\s\S]*?\*\//g, "")`, which is the exact mistake
 * `file-kinds-single-source.test.ts` spends twenty lines proving is wrong: the
 * slash-star inside an `accept="image/*,…"` string opens a phantom comment and
 * deletes the next two hundred lines. Here that would have been worse than a
 * false failure — several assertions below are NEGATIVE
 * (`not.toContain("BLOCKED_MIME_TYPES")`), and over-stripping turns a negative
 * assertion GREEN.
 */
function codeOf(relPath: string): string {
  return stripComments(readFileSync(join(SRC, ...relPath.split("/")), "utf8"));
}

/** Extensions the registry knows and does NOT consider archive material. */
const NOT_UPLOADABLE = KNOWN_EXTENSIONS.filter(
  (ext) => !UPLOADABLE_EXTENSIONS.includes(ext),
);

// ---------------------------------------------------------------------------
// The set itself
// ---------------------------------------------------------------------------

describe("the uploadable set is the registry's image, pdf and document kinds", () => {
  it("is exactly that union, computed here from the kinds rather than typed", () => {
    const union = new Set([
      ...extensionsOfKind("image"),
      ...extensionsOfKind("pdf"),
      ...extensionsOfKind("document"),
    ]);
    expect([...UPLOADABLE_EXTENSIONS].sort()).toEqual([...union].sort());
  });

  it("leaves the ignored and forbidden kinds out", () => {
    for (const ext of [...extensionsOfKind("ignored"), ...extensionsOfKind("forbidden")]) {
      expect(UPLOADABLE_EXTENSIONS).not.toContain(ext);
    }
    // The registry knows nothing else, so those two kinds ARE the negative set.
    expect([...NOT_UPLOADABLE].sort()).toEqual(
      [...new Set([...extensionsOfKind("ignored"), ...extensionsOfKind("forbidden")])].sort(),
    );
  });

  it("adds .txt without needing the coordinate kind to be uploadable", () => {
    // `.txt` is a document AND a coordinate candidate. It is in because of the
    // first, not the second — see UPLOADABLE_KINDS' comment in file-kinds.ts.
    expect(isUploadableFileName("corners.txt")).toBe(true);
    expect(fileKindsOf("corners.txt")).toContain("document");
  });

  it("is frozen, so no importer can widen what the archive accepts", () => {
    // `Object.isFrozen` alone, exactly as file-kinds.test.ts checks the other
    // exported arrays: whether a push() THROWS depends on the strict-mode
    // setting of the calling module, so asserting the throw would be pinning
    // the transpiler rather than the module.
    expect(Object.isFrozen(UPLOADABLE_EXTENSIONS)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The five extensions #34.06 settled
// ---------------------------------------------------------------------------

describe("Slice #34.06 membership decisions", () => {
  it("accepts .rtf and .odt, which the registry has called documents all along", () => {
    expect(isUploadableFileName("act.rtf")).toBe(true);
    expect(isUploadableFileName("act.odt")).toBe(true);
    expect(UPLOAD_ACCEPT_ATTRIBUTE).toContain(".rtf");
    expect(UPLOAD_ACCEPT_ATTRIBUTE).toContain(".odt");
  });

  it("refuses .xml and .html, which belong to no kind", () => {
    for (const name of ["export.xml", "page.html"]) {
      expect(fileKindsOf(name)).toEqual([]);
      expect(isUploadableFileName(name)).toBe(false);
      // Split, not `not.toContain` on the joined string: `.tif` is a SUBSTRING
      // of `.tiff`, so a substring test on this string is a trap waiting for
      // the first extension that is a prefix of another.
      expect(UPLOAD_ACCEPT_ATTRIBUTE.split(",")).not.toContain(extensionOf(name));
    }
  });

  it("refuses .html at the serving map too, so nothing is served inline as HTML", () => {
    // The reason this one is not merely tidiness: /api/files/[...path] sets
    // `Content-Disposition: inline` and serves from the app's own origin, so a
    // stored .html labelled text/html is a stored-XSS shape.
    expect(contentTypeOf("page.html")).toBeNull();
    expect(Object.values(MIME_TYPES)).not.toContain("text/html");
  });

  it("refuses .heic in every spelling, and keeps it in no kind", () => {
    // The slice brief recommended ACCEPTING these. The codebase disagreed:
    // making HEIC an image would make classifyFileSource, isPageGroupMember,
    // hasReadablePage and the preflight forecast all call it readable while
    // the model routes refuse it, and would cost CON-02 in constraint-rules.ts
    // its stated justification — which is that the absence of a kind IS the
    // decision. See file-kinds.ts, "MEMBERSHIP DECISIONS TAKEN IN SLICE #34.06".
    for (const name of ["IMG_1.heic", "IMG_1.heif", "IMG_1.heics", "IMG_1.heifs", "IMG_1.hif"]) {
      expect(fileKindsOf(name)).toEqual([]);
      expect(isUploadableFileName(name)).toBe(false);
    }
  });

  it("refuses .csv, which the folder import already refused at CON-01", () => {
    // The disagreement worth naming: the wizard blocked a folder holding one
    // while the manual page upload took it without a word.
    expect(fileKindsOf("export.csv")).toEqual(["forbidden"]);
    expect(isUploadableFileName("export.csv")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The picker
// ---------------------------------------------------------------------------

describe("the picker offers exactly the uploadable set", () => {
  // ⚠️ `UPLOAD_ACCEPT_ATTRIBUTE` IS `UPLOADABLE_EXTENSIONS.join(",")`, so
  // asserting the round-trip here would be arithmetic about `join`/`split` and
  // nothing about the picker. What is worth pinning is the SHAPE a file input
  // needs and the wildcard that must never come back — plus, in
  // file-kinds-single-source.test.ts, that pages-panel.tsx binds this exact
  // constant to the input rather than an expression built from it.
  it("offers exactly the uploadable extensions, in order", () => {
    // ⚠️ THE CONTENT, not just the shape. An earlier draft asserted only the
    // per-part shape and the count, on the grounds that comparing the join to
    // the list was arithmetic about `join`/`split` — and a picker built as
    // `UPLOADABLE_EXTENSIONS.map((e) => e === ".bmp" ? ".abc" : e).join(",")`
    // passed every assertion in this file. Offering one extension the registry
    // does not know while withholding one it does is the exact defect the slice
    // exists to abolish.
    expect(UPLOAD_ACCEPT_ATTRIBUTE.split(",")).toEqual([...UPLOADABLE_EXTENSIONS]);
  });

  it("is a comma-separated list of dotted extensions and nothing else", () => {
    // The shape a file input needs: no MIME types, no spaces, no wildcard.
    for (const part of UPLOAD_ACCEPT_ATTRIBUTE.split(",")) {
      expect(part).toMatch(/^\.[a-z0-9]+$/);
    }
  });

  it("offers no wildcard, so the OS cannot widen the list on our behalf", () => {
    // `image/*` is what let a HEIC be chosen: every OS picker resolves that
    // family itself, and its membership is not ours to know.
    expect(UPLOAD_ACCEPT_ATTRIBUTE).not.toContain("*");
    expect(UPLOAD_ACCEPT_ATTRIBUTE).not.toContain("/");
  });

  it("is re-checked by the dialog, because accept is only ever a hint", () => {
    // Every file dialog offers "All files", so `accept` filters what is SHOWN
    // and decides nothing. The Goal sentence of this slice — refused where the
    // user chooses it, not accepted and then unusable — lives or dies here.
    // ⚠️ ANCHORED. `toContain("isUploadableFileName")` is satisfied by the
    // IMPORT line, so deleting the check from `handleFileChange` left this test
    // green while the Goal sentence it claims to enforce was gone.
    const code = codeOf("app/documents/_components/pages-panel.tsx");
    expect(code).toContain("!isUploadableFileName(file.name)");
    expect(code).toContain("fileTypeNotAllowed");
  });
});

// ---------------------------------------------------------------------------
// The upload route
// ---------------------------------------------------------------------------

// ⚠️ The route's BEHAVIOUR is exercised in document-page-upload-route.test.ts,
// which POSTs a real FormData through the handler. Everything here reads the
// route's SOURCE, which is a different and weaker question — a source guard
// cannot see a deleted `!`. Keep the two apart so neither is mistaken for the
// other.
describe("the upload route asks the registry rather than a list of its own", () => {
  const route = codeOf("app/api/documents/[id]/pages/route.ts");

  it("asks the registry, by name", () => {
    expect(route).toContain("isUploadableFileName(file.name)");
  });

  it("no longer keeps a private MIME block list", () => {
    // The list it kept could not fire on the file it most needed to: the File
    // System Access API leaves `File.type` empty for some files on Windows,
    // `""` becomes application/octet-stream, and that was in no block list.
    expect(route).not.toContain("BLOCKED_MIME_TYPES");
    expect(route).not.toMatch(/application\/x-(sh|msdownload|executable)/);
  });

  it("imports the size limit rather than re-deriving it", () => {
    expect(route).toContain("MAX_UPLOAD_BYTES");
    expect(route).not.toMatch(/MAX_FILE_SIZE/);
    expect(route).not.toMatch(/\d+\s*\*\s*1024\s*\*\s*1024/);
  });

  it("records the extension's Content-Type in preference to the browser's", () => {
    // The serving route derives what it SENDS from the stored path, so a row
    // that records the browser's answer can disagree with the bytes the viewer
    // is handed — and on Windows the browser's answer is often "".
    expect(route).toContain("contentTypeOf(file.name)");
  });

  it("has a predicate that answers the whole registry", () => {
    // The registry side of the same question. The ROUTE side — that this
    // predicate is what decides the response — is in
    // document-page-upload-route.test.ts.
    for (const ext of UPLOADABLE_EXTENSIONS) {
      expect(isUploadableFileName(`scan${ext}`)).toBe(true);
      expect(isUploadableFileName(`SCAN${ext.toUpperCase()}`)).toBe(true);
    }
    for (const ext of NOT_UPLOADABLE) {
      expect(isUploadableFileName(`scan${ext}`)).toBe(false);
    }
  });

  it("refuses an extension the registry has never heard of", () => {
    for (const name of ["setup.exe", "run.sh", "app.js", "README", "archive.tar.gz"]) {
      expect(isUploadableFileName(name)).toBe(false);
    }
  });

  it("refuses a name whose whole value is an extension", () => {
    // `extensionOf` requires the dot INSIDE the basename, so ".pdf" as an
    // entire file name has no extension and therefore no kind. Pinned so a
    // future relaxation of that extractor cannot quietly open the route.
    expect(isUploadableFileName(".pdf")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The serving MIME table
// ---------------------------------------------------------------------------

describe("the serving MIME table is in step with the registry", () => {
  it("labels every uploadable extension and nothing else", () => {
    expect(Object.keys(MIME_TYPES).sort()).toEqual([...UPLOADABLE_EXTENSIONS].sort());
  });

  it("gives .bmp the entry it spent two slices without", () => {
    // A .bmp was an image kind with no entry here, so it served as
    // application/octet-stream and the viewer drew a download prompt.
    expect(contentTypeOf("page.bmp")).toBe("image/bmp");
  });

  it("labels every image kind as an image and the PDF as a PDF", () => {
    for (const ext of extensionsOfKind("image")) {
      expect(MIME_TYPES[ext].startsWith("image/")).toBe(true);
    }
    expect(MIME_TYPES[".pdf"]).toBe("application/pdf");
  });

  it("answers a stored page's PATH, not only a bare name", () => {
    // Pages are stored as `document-pages/<documentId>/<uuid><ext>`, and the
    // serving route hands this the resolved absolute path.
    expect(contentTypeOf("document-pages/abc/def.png")).toBe("image/png");
    expect(contentTypeOf("C:\\uploads\\document-pages\\abc\\def.PNG")).toBe("image/png");
    expect(contentTypeOf("uploads/document-pages/abc/def")).toBeNull();
  });

  it("agrees with extensionOf on the names where the two could disagree", () => {
    // Two extractors with different contracts is how the seven lists drifted in
    // the first place. `file-mime.ts` keeps its own three-liner so the
    // single-source test can treat the two modules as separate questions; this
    // is the assertion that buys that separation safely.
    //
    // ⚠️ The fixture is EDGE CASES, not `scan${ext}` over the registry. Built
    // from the registry, `extensionOf(name)` is `ext` by construction and the
    // whole assertion collapses into the key-equality test above — it would
    // stay green while `file-mime.ts` relaxed `dot > 0` to `dot >= 0`, which is
    // precisely the difference between the two extractors' contracts.
    const NAMES = [
      "scan.pdf",
      "scan.PDF",
      "scan.csv",
      ".pdf",              // whole name is an extension -> no extension
      ".gitignore",
      "README",
      "trailing.",
      "file.tar.gz",
      "1-2-livada/001.png",
      "C:\\dev\\scan.TIF",
      "document-pages/abc/def.png",
      "uploads/x/.pdf",
      "",
    ];
    for (const name of NAMES) {
      expect(contentTypeOf(name) !== null).toBe(
        UPLOADABLE_EXTENSIONS.includes(extensionOf(name)),
      );
    }
  });

  it("is frozen", () => {
    expect(Object.isFrozen(MIME_TYPES)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The serving route
// ---------------------------------------------------------------------------

describe("the serving route no longer owns a table of its own", () => {
  const route = codeOf("app/api/files/[...path]/route.ts");

  it("imports the shared one", () => {
    expect(route).toContain('from "@/lib/files/file-mime"');
    expect(route).not.toContain("MIME_MAP");
  });
});

// ---------------------------------------------------------------------------
// What the model can be shown — the fifth list, folded in
// ---------------------------------------------------------------------------

describe("the model-readable set is narrower than the image kind, and says so", () => {
  it("is a subset of what the archive accepts", () => {
    for (const ext of MODEL_READABLE_EXTENSIONS) {
      expect(UPLOADABLE_EXTENSIONS).toContain(ext);
    }
  });

  it("claims nothing the registry has never heard of", () => {
    for (const ext of MODEL_READABLE_EXTENSIONS) {
      const kinds = fileKindsOf(`a${ext}`);
      expect(kinds.includes("image") || kinds.includes("pdf")).toBe(true);
    }
  });

  it("excludes exactly the three images the model refuses", () => {
    // The gap the copy now names out loud. A .bmp or .tif is archived, served
    // and drawn by the viewer; the model will not look at one.
    const imagesTheModelRefuses = [...extensionsOfKind("image")].filter(
      (ext) => !MODEL_READABLE_EXTENSIONS.includes(ext),
    );
    expect(imagesTheModelRefuses.sort()).toEqual([".bmp", ".tif", ".tiff"]);
  });

  it("answers false for a TIFF, which isImageOrPdf answers true for", () => {
    // The whole reason both predicates exist. Before Slice #34.06 the wizard
    // asked the wrong one, so a folder of TIFF scans was counted, billed for
    // and sent — and came back 422 every time.
    expect(isModelReadable("plan.tif")).toBe(false);
    expect(isModelReadable("plan.bmp")).toBe(false);
    expect(isImageOrPdf("plan.tif")).toBe(true);
    expect(isModelReadable("scan.JPG")).toBe(true);
    expect(isModelReadable("act.pdf")).toBe(true);
    expect(isModelReadable("act.docx")).toBe(false);
  });

  it("agrees with the MIME list the AI routes dispatch on", () => {
    // Two halves of one fact: the extensions the SCREENS count, and the MIME
    // types the ROUTES accept. They were written out separately in three files
    // before #34.06 and nothing compared them.
    const fromExtensions = MODEL_READABLE_EXTENSIONS
      .filter((ext) => ext !== ".pdf")
      .map((ext) => MIME_TYPES[ext]);
    expect([...new Set(fromExtensions)].sort()).toEqual(
      [...MODEL_IMAGE_MIME_TYPES].sort(),
    );
  });

  it("is the ONLY MIME list the four model routes dispatch on", () => {
    // The extension half is guarded below; without this the MIME half is
    // guarded by nothing at all — `file-kinds-single-source.test.ts` exempts
    // MIME lists by design, so re-typing `["image/jpeg", …]` in any of these
    // three files is invisible to every other test in the repo. That is how it
    // came to be written three times in the first place.
    for (const rel of [
      "app/api/documents/[id]/ai-interpret/route.ts",
      "app/api/admin/doc-type-engine/read-sample/route.ts",
      "app/api/admin/import/scan-folder/route.ts",
      "app/api/admin/import/extract-id-card/route.ts",
    ]) {
      const code = codeOf(rel);
      expect(code).toContain('from "@/lib/files/file-mime"');
      expect(code).toContain("MODEL_IMAGE_MIME_TYPES");
      expect(code).not.toMatch(/"image\/(jpeg|png|gif|webp)"/);
      // None of the four may go back to asking the browser.
      expect(code).not.toMatch(/\.type\.startsWith\("image\//);
    }
  });

  it("makes every model route DISPATCH on the extension, not on File.type", () => {
    // ⚠️ The headline change of #34.06 for these routes, and until this test
    // existed nothing pinned it: the guard above checks the IMPORT and the
    // ABSENCE of the old literals, so reverting the one expression that
    // actually decides — back to `file.type || OCTET_STREAM` — left the whole
    // repo green while every Windows-picked `.jpg` became unreadable again.
    // Anchored on the expression, one per route.
    const EXPRESSIONS: [string, string][] = [
      [
        "app/api/admin/doc-type-engine/read-sample/route.ts",
        "contentTypeOf(file.name) ?? (file.type || OCTET_STREAM)",
      ],
      [
        "app/api/documents/[id]/ai-interpret/route.ts",
        "contentTypeOf(page.fileName) ?? (page.mimeType || OCTET_STREAM)",
      ],
      [
        "app/api/admin/import/extract-id-card/route.ts",
        "contentTypeOf(imageField.name)",
      ],
      [
        "app/api/admin/import/scan-folder/route.ts",
        "contentTypeOf(fileField.name)",
      ],
      [
        "app/api/documents/[id]/pages/route.ts",
        "contentTypeOf(file.name) ?? (file.type || OCTET_STREAM)",
      ],
    ];
    for (const [rel, expression] of EXPRESSIONS) {
      const code = codeOf(rel).replace(/\s+/g, " ");
      expect(code).toContain(expression.replace(/\s+/g, " "));
    }
  });

  it("sends the model the type it DERIVED, not the one the browser claimed", () => {
    // The other half of the same revert: a route can gate on the name and then
    // hand Anthropic `imageField.type` anyway — which on Windows is `""`.
    const idCard = codeOf("app/api/admin/import/extract-id-card/route.ts");
    expect(idCard).toContain("media_type: mediaType as ModelImageMimeType");
    expect(idCard).not.toContain("media_type: imageField.type");

    // …and reports the derived type beside a reason computed from it, so one
    // page cannot be described two ways on one screen.
    for (const [rel, field] of [
      ["app/api/documents/[id]/ai-interpret/route.ts", "mimeType: pageMimeType,"],
      ["app/api/admin/doc-type-engine/read-sample/route.ts", "mimeType: mime,"],
    ]) {
      const code = codeOf(rel);
      expect(code).toContain(field);
      expect(code).not.toMatch(/mimeType: (?:file|page)\.(?:type|mimeType)/);
    }
  });

  it("keeps the page viewer's override one-way, towards an image only", () => {
    // `<img>` sniffs the bytes and ignores the Content-Type; an `<iframe>` does
    // not, and in production the bytes come from Supabase carrying whatever was
    // recorded AT UPLOAD. So promoting a legacy octet-stream row to
    // `application/pdf` would replace a working download link with a blank
    // frame — for exactly the rows the override exists to rescue.
    const code = codeOf("app/documents/_components/pages-panel.tsx").replace(/\s+/g, " ");
    expect(code).toContain('fromName !== null && fromName.startsWith("image/")');
  });

  it("stops scan-folder relabelling what it does not recognise as JPEG", () => {
    // ⚠️ The most expensive shape of the disagreement, because it did not fail
    // — it PAID. A `.tif` was sent with its bytes labelled `image/jpeg` so
    // Anthropic would not reject the request, so the run was billed for a call
    // that could only come back wrong.
    const code = codeOf("app/api/admin/import/scan-folder/route.ts");
    expect(code).toContain("contentTypeOf(fileField.name)");
    expect(code).not.toContain('fileField.type.startsWith("image/")');
    expect(code).not.toMatch(/:\s*"image\/jpeg"/);
  });

  it("is the predicate the wizard and the forecast both ask", () => {
    // They MUST be the same one: preflight counts the calls and the wizard
    // makes them, and a forecast that promises a number nothing then spends is
    // worse than no forecast.
    for (const rel of [
      "lib/import/preflight.ts",
      "lib/import/folder-utils.ts",
      "app/admin/import/_components/import-wizard.tsx",
      "app/admin/import/_components/bulk-import-dialog.tsx",
    ]) {
      const code = codeOf(rel);
      expect(code).toContain("isModelReadable");
      expect(code).not.toContain("isImageOrPdf");
    }
  });

  it("is frozen, and so is its MIME half", () => {
    // `as const` is a compile-time promise and nothing more. This list is what
    // four routes dispatch on; a shared mutable there would let one test that
    // explored a variant rewrite what the whole process believes.
    expect(Object.isFrozen(MODEL_READABLE_EXTENSIONS)).toBe(true);
    expect(Object.isFrozen(MODEL_IMAGE_MIME_TYPES)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Type before size, in both places that decide it
// ---------------------------------------------------------------------------

describe("a wrong format is refused for its format, never for its size", () => {
  // ⚠️ ORDER, not presence. A 30 MB `.heic` refused for being 30 MB sends the
  // user to rescan it at a lower resolution — a fix that cannot work, which is
  // this repo's recorded worst failure mode. The route half is exercised for
  // real in document-page-upload-route.test.ts; this pins the client half and
  // the agreement between the two.
  // Both strings occur exactly once in each file, and neither can be satisfied
  // by an import line — which `"MAX_UPLOAD_BYTES"` on its own could.
  const TYPE_CHECK = "!isUploadableFileName(file.name)";
  const SIZE_CHECK = "file.size > MAX_UPLOAD_BYTES";

  it.each([
    "app/documents/_components/pages-panel.tsx",
    "app/api/documents/[id]/pages/route.ts",
  ])("%s decides type before size", (rel) => {
    const code = codeOf(rel);
    const typeAt = code.indexOf(TYPE_CHECK);
    const sizeAt = code.indexOf(SIZE_CHECK);
    expect(typeAt).toBeGreaterThan(-1);
    expect(sizeAt).toBeGreaterThan(-1);
    expect(typeAt).toBeLessThan(sizeAt);
    // Once each, so `indexOf` is the occurrence that decides.
    expect(code.lastIndexOf(TYPE_CHECK)).toBe(typeAt);
    expect(code.lastIndexOf(SIZE_CHECK)).toBe(sizeAt);
  });
});

// ---------------------------------------------------------------------------
// The copy that names the formats
// ---------------------------------------------------------------------------

describe("the sentences that name the model's formats name the right ones", () => {
  // ⚠️ Slice #34.06 chose to say the gap out loud rather than widen the routes
  // ("either name the four formats in the copy or widen the routes; naming them
  // is what this slice does"). That decision puts a hand-typed copy of
  // `MODEL_READABLE_EXTENSIONS` into two locales — the shape this whole slice
  // exists to abolish. It cannot be interpolated: the sentences name FORMATS
  // ("JPEG"), not extensions (".jpg"), and a business user reads the first and
  // not the second. So it is guarded instead.
  const KEYS = [
    ["docTypeEngine", "folder", "noSamples"],
    ["adminImport", "wizard", "forecast", "arithmeticCalls"],
    ["adminImport", "wizard", "forecast", "introNothingSent"],
  ];

  /**
   * The name a reader knows each model-readable extension by.
   *
   * Written out rather than derived from the extension, because "WebP" is not
   * ".webp" upper-cased and `.jpg`/`.jpeg` are one format with one name. The
   * test below fails if an extension is added to the registry's model-readable
   * list without a name here — which is the point: adding one means four
   * sentences in two locales have to be rewritten, and this is what says so.
   */
  const FORMAT_NAME: Record<string, string> = {
    ".jpg":  "JPEG",
    ".jpeg": "JPEG",
    ".png":  "PNG",
    ".gif":  "GIF",
    ".webp": "WebP",
    ".pdf":  "PDF",
  };

  it("has a display name for every model-readable extension", () => {
    for (const ext of MODEL_READABLE_EXTENSIONS) {
      expect(Object.keys(FORMAT_NAME)).toContain(ext);
    }
    for (const ext of Object.keys(FORMAT_NAME)) {
      expect(MODEL_READABLE_EXTENSIONS).toContain(ext);
    }
  });

  const FORMAT_NAMES = [
    ...new Set(MODEL_READABLE_EXTENSIONS.map((ext) => FORMAT_NAME[ext])),
  ];

  it.each(["en-GB", "ro-RO"])("%s names every format the model accepts", (locale) => {
    const messages = JSON.parse(
      readFileSync(join(process.cwd(), "messages", `${locale}.json`), "utf8"),
    ) as Record<string, unknown>;

    for (const path of KEYS) {
      const text = path.reduce<unknown>(
        (node, key) => (node as Record<string, unknown>)[key],
        messages,
      ) as string;
      expect(typeof text).toBe("string");
      for (const name of FORMAT_NAMES) expect(text).toContain(name);
    }
  });

  it.each(["en-GB", "ro-RO"])("%s names no format the model refuses", (locale) => {
    // A sentence that promised TIFF or BMP would be inviting the user to give
    // the model exactly what it cannot read — the defect the slice found.
    const messages = JSON.parse(
      readFileSync(join(process.cwd(), "messages", `${locale}.json`), "utf8"),
    ) as Record<string, unknown>;
    for (const path of [KEYS[1], KEYS[2]]) {
      const text = path.reduce<unknown>(
        (node, key) => (node as Record<string, unknown>)[key],
        messages,
      ) as string;
      expect(text).not.toContain("TIFF");
      expect(text).not.toContain("BMP");
    }
  });
});
