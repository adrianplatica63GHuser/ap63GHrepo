/**
 * /api/documents/[id]/persons
 */
import { z } from "zod/v4";
import type { NextRequest } from "next/server";
import {
  documentNotFoundToResponse,
  roleNotOfferedToResponse,
  unexpectedError,
  zodErrorToResponse,
} from "@/lib/api/errors";
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
  } catch (err) {
    // Slice #34.26: FIRST, and the order is the fix. Until this slice a POST
    // naming a document that no longer exists came back as the refusal below —
    // the offered set for a missing document is `[]`, and an empty offered set
    // refuses every role, so the screen told the user their ROLE had been
    // withdrawn. `associatePersonsToDocument` now decides which of the two it
    // is, and this is the half that says so.
    const missing = documentNotFoundToResponse(err);
    if (missing) return missing;
    // Slice #34.15: `associatePersonsToDocument` refuses a role the document's
    // own whitelist does not offer. It is the request that is wrong, not the
    // server, so it is a 400 — and it reaches this catch rather than a check
    // above because the rule lives in the query layer, once, for all five
    // routes. The AI party linker posts here too; `role-attachment.ts` says why
    // it needs no exemption and what the one refusable case is.
    const refusal = roleNotOfferedToResponse(err);
    if (refusal) return refusal;
    return unexpectedError(err, "POST /api/documents/[id]/persons");
  }
}
