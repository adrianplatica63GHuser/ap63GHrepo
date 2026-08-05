/**
 * /api/files/[...path]
 *
 * Local-dev-only file-serving route for document page uploads.
 * Files are stored under <project-root>/uploads/ and served from here.
 *
 * In production, files are served via Supabase Storage signed URLs and
 * this route returns 404 — UNLESS LOCAL_FILE_STORAGE=true, which keeps
 * this route live even with NODE_ENV=production. Used by deployments with
 * no real Supabase project (e.g. Ciprian's offline UAT stack). Must stay
 * in lockstep with the same flag in src/lib/storage/index.ts. See
 * CLAUDE.md Slice #15.16.
 */

import type { NextRequest } from "next/server";
import * as path from "path";
import * as fs from "fs/promises";

const useLocalStorage = process.env.LOCAL_FILE_STORAGE === "true";

// Extension -> Content-Type for the local-storage serve path.
//
// This map answers "what Content-Type do I label these bytes with", which is a
// DIFFERENT question from "what kind of file is this" — the latter has exactly
// one home in src/lib/files/file-kinds.ts (Slice #24.03) and this map is
// deliberately not derived from it. What the client offers and what the routes
// accept is Slice #24.04.
//
// #24.03 removed ".heic" from this map: HEIC belongs to no file kind any more,
// so it is served as application/octet-stream like any other unrecognised type.
// Known gaps left for #24.04: ".bmp" IS an image kind and still has no entry
// here, and ".html"/".xml" have entries here but belong to no kind.
const MIME_MAP: Record<string, string> = {
  ".pdf":  "application/pdf",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png":  "image/png",
  ".gif":  "image/gif",
  ".webp": "image/webp",
  ".tiff": "image/tiff",
  ".tif":  "image/tiff",
  ".txt":  "text/plain",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc":  "application/msword",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls":  "application/vnd.ms-excel",
  ".html": "text/html",
  ".xml":  "application/xml",
};

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  // This route is intentionally unavailable in production — unless the
  // local-storage override is on (see file header comment).
  if (process.env.NODE_ENV === "production" && !useLocalStorage) {
    return Response.json({ error: "Not available" }, { status: 404 });
  }

  const { path: segments } = await ctx.params;
  const uploadsDir = path.join(process.cwd(), "uploads");
  const filePath = path.resolve(uploadsDir, ...segments);

  // Guard against path-traversal attacks.
  if (!filePath.startsWith(uploadsDir + path.sep) && filePath !== uploadsDir) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_MAP[ext] ?? "application/octet-stream";

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buffer.length),
        // `inline` makes browsers display images/PDFs directly; other types
        // will trigger a download.
        "Content-Disposition": `inline; filename="${path.basename(filePath)}"`,
        // Prevent caching of signed/one-time URLs in the viewer.
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") {
      return Response.json({ error: "File not found" }, { status: 404 });
    }
    console.error("[api/files] error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
