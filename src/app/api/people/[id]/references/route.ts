/**
 * /api/people/[id]/references
 */
import { z } from "zod/v4";
import type { NextRequest } from "next/server";
import { roleNotOfferedToResponse, unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { listPersonReferences, associatePersonsToPerson } from "@/lib/persons/queries";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  try { return Response.json({ items: await listPersonReferences(id) }); }
  catch (err) { return unexpectedError(err, "GET /api/people/[id]/references"); }
}

const bodySchema = z.object({
  personIds:           z.array(z.string().uuid()).min(1),
  relationshipRoleId:  z.string().uuid().optional().nullable(),
});

export async function POST(request: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return zodErrorToResponse(parsed.error);
  try {
    await associatePersonsToPerson(
      id,
      parsed.data.personIds,
      parsed.data.relationshipRoleId ?? null,
    );
    return new Response(null, { status: 204 });
  } catch (err) {
    // Slice #34.15 — `valid_for_person`. Both person screens post here: the
    // natural-person one has had the picker since #34.04, and the
    // judicial-person one gained it in this slice.
    const refusal = roleNotOfferedToResponse(err);
    if (refusal) return refusal;
    return unexpectedError(err, "POST /api/people/[id]/references");
  }
}
