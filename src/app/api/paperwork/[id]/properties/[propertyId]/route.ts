/**
 * DELETE /api/paperwork/[id]/properties/[propertyId]
 */
import type { NextRequest } from "next/server";
import { unexpectedError } from "@/lib/api/errors";
import { dissociatePropertyFromPaperwork } from "@/lib/paperwork/queries";

type Ctx = { params: Promise<{ id: string; propertyId: string }> };

export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id, propertyId } = await ctx.params;
  try {
    const ok = await dissociatePropertyFromPaperwork(id, propertyId);
    if (!ok) return Response.json({ error: "Association not found" }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (err) {
    return unexpectedError(err, "DELETE /api/paperwork/[id]/properties/[propertyId]");
  }
}
