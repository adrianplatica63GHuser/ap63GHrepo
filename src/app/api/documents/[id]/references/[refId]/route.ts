/**
 * DELETE /api/documents/[id]/references/[refId]
 */
import type { NextRequest } from "next/server";
import { unexpectedError } from "@/lib/api/errors";
import { dissociateDocumentFromDocument } from "@/lib/documents/queries";
import { getCurrentUserEmail } from "@/lib/auth/current-user";

type Ctx = { params: Promise<{ id: string; refId: string }> };

export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id, refId } = await ctx.params;
  try {
    // Slice 41.54: the user, for the act adițional's new version.
    const ok = await dissociateDocumentFromDocument(id, refId, await getCurrentUserEmail());
    if (!ok) return Response.json({ error: "Association not found" }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (err) {
    return unexpectedError(err, "DELETE /api/documents/[id]/references/[refId]");
  }
}
