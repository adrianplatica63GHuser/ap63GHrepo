/**
 * DELETE /api/documents/[id]/references/[refId]
 */
import type { NextRequest } from "next/server";
import { unexpectedError } from "@/lib/api/errors";
import { dissociateDocumentFromDocument } from "@/lib/documents/queries";

type Ctx = { params: Promise<{ id: string; refId: string }> };

export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id, refId } = await ctx.params;
  try {
    const ok = await dissociateDocumentFromDocument(id, refId);
    if (!ok) return Response.json({ error: "Association not found" }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (err) {
    return unexpectedError(err, "DELETE /api/documents/[id]/references/[refId]");
  }
}
