/**
 * DELETE /api/people/[id]/documents/[documentId]
 */
import type { NextRequest } from "next/server";
import { unexpectedError } from "@/lib/api/errors";
import { dissociateDocumentFromPerson } from "@/lib/persons/queries";

type Ctx = { params: Promise<{ id: string; documentId: string }> };

export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id, documentId } = await ctx.params;
  try {
    const ok = await dissociateDocumentFromPerson(id, documentId);
    if (!ok) return Response.json({ error: "Association not found" }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (err) {
    return unexpectedError(err, "DELETE /api/people/[id]/documents/[documentId]");
  }
}
