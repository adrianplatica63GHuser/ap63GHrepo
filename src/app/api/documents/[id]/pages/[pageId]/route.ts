/**
 * /api/documents/[id]/pages/[pageId]
 *
 * DELETE — remove the page record and its associated stored file.
 */

import type { NextRequest } from "next/server";
import { unexpectedError } from "@/lib/api/errors";
import {
  deleteDocumentPage,
  getDocumentPage,
} from "@/lib/documents/pages-queries";
import { deleteFile } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string; pageId: string }> };

export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { pageId } = await ctx.params;

  try {
    const page = await getDocumentPage(pageId);
    if (!page) {
      return Response.json({ error: "Page not found" }, { status: 404 });
    }

    // Row first, then the bytes — the same order and the same policy as
    // deleteDocuments (Slice #29.04). This used to be the other way round,
    // with a comment saying it wanted a storage failure to surface; it never
    // could, because deleteFile discarded the Supabase error. Making it throw
    // would have made this route 500 and KEEP the row, so the page became
    // undeletable and a retry hit the same branch again.
    //
    // What is left after a storage failure now is bytes nothing references —
    // invisible and sweepable. What the other order left was a page row on
    // screen whose file 404s, which is the visible lie this slice removes.
    await deleteDocumentPage(pageId);
    const gone = await deleteFile(page.filePath);
    if (!gone) {
      console.error(
        `[DELETE /api/documents/[id]/pages/[pageId]] page row ${pageId} deleted, but its file could not be removed from storage and is now orphaned: ${page.filePath}`,
      );
    }

    return new Response(null, { status: 204 });
  } catch (err) {
    return unexpectedError(err, "DELETE /api/documents/[id]/pages/[pageId]");
  }
}
