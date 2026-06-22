/**
 * /api/documents/[id]/pages/[pageId]/view
 *
 * GET — return a JSON object containing the URL (and metadata) needed to
 *       display or print the page file.
 *
 * Response: { url: string; mimeType: string | null; fileName: string }
 *
 * In development the URL is a relative /api/files/… path.
 * In production   the URL is a 60-second Supabase Storage signed URL.
 */

import type { NextRequest } from "next/server";
import { unexpectedError } from "@/lib/api/errors";
import { getDocumentPage } from "@/lib/documents/pages-queries";
import { getFileUrl } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string; pageId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { pageId } = await ctx.params;

  try {
    const page = await getDocumentPage(pageId);
    if (!page) {
      return Response.json({ error: "Page not found" }, { status: 404 });
    }

    const url = await getFileUrl(page.filePath);
    return Response.json({
      url,
      mimeType: page.mimeType,
      fileName: page.fileName,
    });
  } catch (err) {
    return unexpectedError(err, "GET /api/documents/[id]/pages/[pageId]/view");
  }
}
