/**
 * /api/paperwork/[id]/pages/[pageId]
 *
 * DELETE — remove the page record and its associated stored file.
 */

import type { NextRequest } from "next/server";
import { unexpectedError } from "@/lib/api/errors";
import {
  deletePaperworkPage,
  getPaperworkPage,
} from "@/lib/paperwork/pages-queries";
import { deleteFile } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string; pageId: string }> };

export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { pageId } = await ctx.params;

  try {
    const page = await getPaperworkPage(pageId);
    if (!page) {
      return Response.json({ error: "Page not found" }, { status: 404 });
    }

    // Delete the stored file first; if storage deletion fails we still want
    // to surface the error rather than leave an orphan DB row.
    await deleteFile(page.filePath);
    await deletePaperworkPage(pageId);

    return new Response(null, { status: 204 });
  } catch (err) {
    return unexpectedError(err, "DELETE /api/paperwork/[id]/pages/[pageId]");
  }
}
