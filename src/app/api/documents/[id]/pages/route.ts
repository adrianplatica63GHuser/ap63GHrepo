/**
 * /api/documents/[id]/pages
 *
 * GET  — list all pages for a document record (ordered by page_number).
 * POST — upload a file and create a page record (multipart/form-data).
 *
 * POST fields:
 *   pageNumber  integer (required, min 1)
 *   pageName    string  (optional)
 *   pageNotes   string  (optional)
 *   file        File    (required; an uploadable kind, at most MAX_UPLOAD_BYTES)
 *
 * WHAT THIS ROUTE ACCEPTS, AND WHY IT ASKS BY NAME   (Slice #34.06)
 * ────────────────────────────────────────────────────────────────
 *
 * It asks `isUploadableFileName`, which is the registry in
 * src/lib/files/file-kinds.ts — the same answer the picker offers and the
 * serving MIME map labels. Before #34.06 it asked neither: it held a private
 * five-entry list of executable MIME types and refused those, so `.csv`
 * (`"forbidden"`), `.xml` and `.heic` (no kind at all) all uploaded happily
 * and became pages nothing downstream could classify or draw.
 *
 * ⚠️ **AND THE BLOCK LIST COULD NOT WORK ANYWAY.** It tested
 * `file.type || "application/octet-stream"`, and the File System Access API
 * leaves `File.type` EMPTY for some files on Windows — the deployment target.
 * `""` collapses to `application/octet-stream`, which was in no block list, so
 * the one file most likely to be hostile was the one file the check waved
 * through. `constraint-rules.ts` records the same fact from the other
 * direction, as the reason a constraint rule based on `File.type` was
 * withdrawn. An extension is answerable for every file, which is why the
 * question moved to the name.
 *
 * The empty-`File.type` case is therefore DECIDED rather than left to fall
 * through: it has no bearing on admission at all, and the type recorded on the
 * row is derived from the extension first (see `mimeType` below).
 *
 * Both refusals carry a `code` alongside the English `error`, because the
 * `error` reaches the user verbatim in an app whose default locale is `ro-RO`.
 * The 415 was effectively unreachable before this slice (see above), so nobody
 * had met it; it now fires for every extension outside the registry, and a code
 * the client can translate is the difference between that being a fix and a
 * regression. **Both clients map both codes**: `pages-panel.tsx` since #34.06,
 * and `bulk-import-dialog.tsx` since #34.20 — which is where this paragraph
 * used to say the opposite. That dialog deliberately did not, because
 * `uploadPage` is module-level with no translator and its own constraints gate
 * (CON-01/02/03, CON-05) makes both refusals unreachable from a run. #34.20
 * closed it anyway: unreachable is one constraint change away from being the
 * sentence a Romanian user reads, permanently, in a saved report. It carries
 * the code out as a sentinel to the scope that has a translator; the table is
 * `lib/import/page-upload-refusals.ts`, and `page-upload-refusals.test.ts`
 * reads THIS file for the code strings, so a third code added below and left
 * unmapped fails there.
 */

import type { NextRequest } from "next/server";
import { z } from "zod/v4";
import { unexpectedError } from "@/lib/api/errors";
import {
  createDocumentPage,
  listDocumentPages,
} from "@/lib/documents/pages-queries";
import { extensionOf, isUploadableFileName } from "@/lib/files/file-kinds";
import { OCTET_STREAM, contentTypeOf } from "@/lib/files/file-mime";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@/lib/import/constraint-rules";
import { uploadFile } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET — list pages
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id: documentId } = await ctx.params;
  try {
    const pages = await listDocumentPages(documentId);
    return Response.json(pages);
  } catch (err) {
    return unexpectedError(err, "GET /api/documents/[id]/pages");
  }
}

// ---------------------------------------------------------------------------
// POST — create page (upload file)
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id: documentId } = await ctx.params;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  // --- Validate file ---
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "file is required" }, { status: 400 });
  }
  // ⚠️ TYPE BEFORE SIZE, and the order is the message rather than the code.
  // A 30 MB `.heic` is refused for being a `.heic`; telling the user to scan it
  // again at a lower resolution would be advice that cannot work, which is this
  // repo's recorded worst failure mode (Slice #26.02's unfixable violation
  // message). `AddPageDialog` orders its two checks the same way and a test
  // pins that both do.
  if (!isUploadableFileName(file.name)) {
    return Response.json(
      { error: "File type not allowed", code: "file_type_not_allowed" },
      { status: 415 },
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json(
      { error: `File exceeds ${MAX_UPLOAD_MB} MB limit`, code: "file_too_large" },
      { status: 413 },
    );
  }

  // Extension first, `File.type` only as a fallback. The serving route derives
  // the Content-Type it sends from the stored PATH, so recording the browser's
  // answer in preference to the extension's is how a row ends up claiming one
  // type while the bytes arrive labelled another — and on Windows the
  // browser's answer is often `""`, which is what used to make a good .jpg
  // render as a download prompt in the viewer.
  //
  // The fallback is belt-and-braces: `isUploadableFileName` has just passed and
  // a test pins that the MIME table's keys ARE the uploadable set, so the left
  // operand is never null in practice. `||` rather than `??` on the second one
  // all the same — an absent `File.type` is the EMPTY STRING, which `??` would
  // record verbatim as the row's MIME type.
  const mimeType = contentTypeOf(file.name) ?? (file.type || OCTET_STREAM);

  // --- Validate pageNumber ---
  const pageNumberResult = z.coerce.number().int().min(1).safeParse(
    formData.get("pageNumber"),
  );
  if (!pageNumberResult.success) {
    return Response.json(
      { error: "pageNumber must be a positive integer" },
      { status: 400 },
    );
  }

  // --- Optional text fields ---
  const rawPageName  = formData.get("pageName");
  const rawPageNotes = formData.get("pageNotes");
  const pageName  = typeof rawPageName  === "string" && rawPageName.trim()
    ? rawPageName.trim()
    : null;
  const pageNotes = typeof rawPageNotes === "string" && rawPageNotes.trim()
    ? rawPageNotes.trim()
    : null;

  try {
    // Build a deterministic storage key using a fresh UUID for each page.
    const pageId = crypto.randomUUID();
    const originalName = file.name;
    // `extensionOf`, not a fifth private extractor. It lowercases, which is
    // what makes the stored key agree with `contentTypeOf` when the serving
    // route reads the extension back off the path — `photo.JPG` used to be
    // stored as `<uuid>.JPG`.
    const ext = extensionOf(originalName);
    const filePath = `document-pages/${documentId}/${pageId}${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadFile(buffer, filePath, mimeType);

    const page = await createDocumentPage({
      documentId,
      pageNumber: pageNumberResult.data,
      pageName,
      pageNotes,
      fileName: originalName,
      filePath,
      fileSize: file.size,
      mimeType,
    });

    return Response.json(page, { status: 201 });
  } catch (err) {
    return unexpectedError(err, "POST /api/documents/[id]/pages");
  }
}
