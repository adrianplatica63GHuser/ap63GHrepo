/**
 * /api/documents/[id]/persons
 */
import { z } from "zod/v4";
import type { NextRequest } from "next/server";
import { unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { listDocumentPersons, associatePersonsToDocument } from "@/lib/documents/queries";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  try { return Response.json({ items: await listDocumentPersons(id) }); }
  catch (err) { return unexpectedError(err, "GET /api/documents/[id]/persons"); }
}

const bodySchema = z.object({
  personIds: z.array(z.string().uuid()).min(1),
  // Optional role for Certificat de Moștenitor party links.
  // 'DEFUNCT' | 'MOSTENITOR' — null / absent for general associations.
  quality: z.enum(["DEFUNCT", "MOSTENITOR"]).nullable().optional(),
  // Optional person role from the Document Persons whitelist.
  personRoleId: z.string().uuid().nullable().optional(),
});

export async function POST(request: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return zodErrorToResponse(parsed.error);
  try {
    await associatePersonsToDocument(
      id,
      parsed.data.personIds,
      parsed.data.quality ?? null,
      parsed.data.personRoleId ?? null,
    );
    return new Response(null, { status: 204 });
  } catch (err) { return unexpectedError(err, "POST /api/documents/[id]/persons"); }
}
