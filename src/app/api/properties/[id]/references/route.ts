/**
 * /api/properties/[id]/references
 * GET / POST
 */
import { z } from "zod/v4";
import type { NextRequest } from "next/server";
import { unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { listPropertyReferences, associatePropertiesToProperty } from "@/lib/properties/queries";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  try { return Response.json({ items: await listPropertyReferences(id) }); }
  catch (err) { return unexpectedError(err, "GET /api/properties/[id]/references"); }
}

const bodySchema = z.object({ propertyIds: z.array(z.string().uuid()).min(1) });

export async function POST(request: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return zodErrorToResponse(parsed.error);
  try {
    await associatePropertiesToProperty(id, parsed.data.propertyIds);
    return new Response(null, { status: 204 });
  } catch (err) { return unexpectedError(err, "POST /api/properties/[id]/references"); }
}
