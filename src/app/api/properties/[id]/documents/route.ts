/**
 * /api/properties/[id]/documents
 * GET / POST
 */
import { z } from "zod/v4";
import type { NextRequest } from "next/server";
import { unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { listPropertyDocuments, associateDocumentsToProperty } from "@/lib/properties/queries";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  try { return Response.json({ items: await listPropertyDocuments(id) }); }
  catch (err) { return unexpectedError(err, "GET /api/properties/[id]/documents"); }
}

const bodySchema = z.object({ documentIds: z.array(z.string().uuid()).min(1) });

export async function POST(request: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return zodErrorToResponse(parsed.error);
  try {
    await associateDocumentsToProperty(id, parsed.data.documentIds);
    return new Response(null, { status: 204 });
  } catch (err) { return unexpectedError(err, "POST /api/properties/[id]/documents"); }
}
