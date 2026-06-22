/**
 * /api/people/[id]/documents
 */
import { z } from "zod/v4";
import type { NextRequest } from "next/server";
import { unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { listPersonDocuments, associateDocumentsToPerson } from "@/lib/persons/queries";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  try { return Response.json({ items: await listPersonDocuments(id) }); }
  catch (err) { return unexpectedError(err, "GET /api/people/[id]/documents"); }
}

const bodySchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1),
  personRoleId: z.string().uuid().nullable().optional(),
});

export async function POST(request: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return zodErrorToResponse(parsed.error);
  try {
    await associateDocumentsToPerson(id, parsed.data.documentIds, parsed.data.personRoleId ?? null);
    return new Response(null, { status: 204 });
  } catch (err) { return unexpectedError(err, "POST /api/people/[id]/documents"); }
}
