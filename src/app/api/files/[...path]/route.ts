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
 *
 * The extension -> Content-Type table this route used to own privately is now
 * src/lib/files/file-mime.ts (Slice #34.06). It moved because the UPLOAD route
 * needs the same answer — `File.type` is empty for some files on Windows, so a
 * good `.jpg` was recorded as application/octet-stream and the viewer, which
 * switches on the RECORDED type, drew a download prompt over a picture. It had
 * also drifted: no `.bmp` entry for a `.bmp` that IS an image kind, and
 * `.html`/`.xml` entries for extensions that are of no kind at all and are now
 * refused at upload.
 */

import type { NextRequest } from "next/server";
import * as path from "path";
import * as fs from "fs/promises";
import { OCTET_STREAM, contentTypeOf } from "@/lib/files/file-mime";

const useLocalStorage = process.env.LOCAL_FILE_STORAGE === "true";

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
    const contentType = contentTypeOf(filePath) ?? OCTET_STREAM;

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buffer.length),
        // `inline` makes browsers display images/PDFs directly; other types
        // will trigger a download.
        "Content-Disposition": `inline; filename="${path.basename(filePath)}"`,
        // Prevent caching of signed/one-time URLs in the viewer.
        "Cache-Control": "no-store",
        // `inline` above serves from the app's own origin, so the Content-Type
        // is load-bearing: without this a browser may sniff a stored file as
        // HTML and run it. Fixed in passing with Slice #34.06, which removed
        // the `.html` entry that made the sniff unnecessary in the first place
        // — a defence that only holds for files uploaded AFTER that change.
        "X-Content-Type-Options": "nosniff",
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
