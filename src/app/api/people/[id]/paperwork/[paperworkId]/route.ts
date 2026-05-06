/**
 * DELETE /api/people/[id]/paperwork/[paperworkId]
 */
import type { NextRequest } from "next/server";
import { unexpectedError } from "@/lib/api/errors";
import { dissociatePaperworkFromPerson } from "@/lib/persons/queries";

type Ctx = { params: Promise<{ id: string; paperworkId: string }> };

export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id, paperworkId } = await ctx.params;
  try {
    const ok = await dissociatePaperworkFromPerson(id, paperworkId);
    if (!ok) return Response.json({ error: "Association not found" }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (err) {
    return unexpectedError(err, "DELETE /api/people/[id]/paperwork/[paperworkId]");
  }
}
