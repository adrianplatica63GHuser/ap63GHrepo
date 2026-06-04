/**
 * /api/paperwork/[id]/pages
 *
 * GET  — list all pages for a paperwork record (ordered by page_number).
 * POST — upload a file and create a page record (multipart/form-data).
 *
 * POST fields:
 *   pageNumber  integer (required, min 1)
 *   pageName    string  (optional)
 *   pageNotes   string  (optional)
 *   file        File    (required, max 20 MB)
 */

import type { NextRequest } from "next/server";
import { z } from "zod/v4";
import { unexpectedError } from "@/lib/api/errors";
import {
  createPaperworkPage,
  listPaperworkPages,
} from "@/lib/paperwork/pages-queries";
import { uploadFile } from "@/lib/storage";

// 20 MB limit
const MAX_FILE_SIZE = 20 * 1024 * 1024;

// Mime types that must never be served back to a browser.
const BLOCKED_MIME_TYPES = new Set([
  "text/javascript",
  "application/javascript",
  "application/x-sh",
  "application/x-msdownload",
  "application/x-executable",
]);

type Ctx = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET — list pages
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id: paperworkId } = await ctx.params;
  try {
    const pages = await listPaperworkPages(paperworkId);
    return Response.json(pages);
  } catch (err) {
    return unexpectedError(err, "GET /api/paperwork/[id]/pages");
  }
}

// ---------------------------------------------------------------------------
// POST — create page (upload file)
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id: paperworkId } = await ctx.params;

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
  if (file.size > MAX_FILE_SIZE) {
    return Response.json({ error: "File exceeds 20 MB limit" }, { status: 413 });
  }
  const mimeType = file.type || "application/octet-stream";
  if (BLOCKED_MIME_TYPES.has(mimeType)) {
    return Response.json({ error: "File type not allowed" }, { status: 415 });
  }

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
    const dotIndex = originalName.lastIndexOf(".");
    const ext = dotIndex !== -1 ? originalName.slice(dotIndex) : "";
    const filePath = `paperwork-pages/${paperworkId}/${pageId}${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadFile(buffer, filePath, mimeType);

    const page = await createPaperworkPage({
      paperworkId,
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
    return unexpectedError(err, "POST /api/paperwork/[id]/pages");
  }
}
