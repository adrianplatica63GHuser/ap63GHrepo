/**
 * /api/properties/[id]/paperwork
 * GET / POST
 */
import { z } from "zod/v4";
import type { NextRequest } from "next/server";
import { unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { listPropertyPaperwork, associatePaperworkToProperty } from "@/lib/properties/queries";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  try { return Response.json({ items: await listPropertyPaperwork(id) }); }
  catch (err) { return unexpectedError(err, "GET /api/properties/[id]/paperwork"); }
}

const bodySchema = z.object({ paperworkIds: z.array(z.string().uuid()).min(1) });

export async function POST(request: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return zodErrorToResponse(parsed.error);
  try {
    await associatePaperworkToProperty(id, parsed.data.paperworkIds);
    return new Response(null, { status: 204 });
  } catch (err) { return unexpectedError(err, "POST /api/properties/[id]/paperwork"); }
}
