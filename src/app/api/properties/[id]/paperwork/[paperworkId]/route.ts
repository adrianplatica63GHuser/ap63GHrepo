/**
 * DELETE /api/properties/[id]/paperwork/[paperworkId]
 */
import type { NextRequest } from "next/server";
import { unexpectedError } from "@/lib/api/errors";
import { dissociatePaperworkFromProperty } from "@/lib/properties/queries";

type Ctx = { params: Promise<{ id: string; paperworkId: string }> };

export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id, paperworkId } = await ctx.params;
  try {
    const ok = await dissociatePaperworkFromProperty(id, paperworkId);
    if (!ok) return Response.json({ error: "Association not found" }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (err) {
    return unexpectedError(err, "DELETE /api/properties/[id]/paperwork/[paperworkId]");
  }
}
