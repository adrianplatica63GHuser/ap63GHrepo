/**
 * DELETE /api/documents/[id]/persons/[personId]
 */
import type { NextRequest } from "next/server";
import { unexpectedError } from "@/lib/api/errors";
import { dissociatePersonFromDocument } from "@/lib/documents/queries";

type Ctx = { params: Promise<{ id: string; personId: string }> };

export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id, personId } = await ctx.params;
  try {
    const ok = await dissociatePersonFromDocument(id, personId);
    if (!ok) return Response.json({ error: "Association not found" }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (err) {
    return unexpectedError(err, "DELETE /api/documents/[id]/persons/[personId]");
  }
}
