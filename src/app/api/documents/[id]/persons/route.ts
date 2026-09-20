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
import { COTA_MOD_VALUES } from "@/lib/documents/cota-parte";

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
  // ⚠️ **THE COTĂ ARRIVES AS A NUMBER, ALREADY PARSED.** „63,64" is Romanian
  // and the parser that reads it is `src/lib/documents/cota-parte.ts`, on the
  // client, beside the box the user typed into — which is the only place that
  // can keep what they typed and show them the error in their own field. A
  // route that accepted the raw string would be a second parser, and a second
  // parser is a second answer.
  cotaParte:       z.number().nullable().optional(),
  cotaSuprafataMp: z.number().nullable().optional(),
  cotaMod:         z.enum(COTA_MOD_VALUES).nullable().optional(),
});

export async function POST(request: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return zodErrorToResponse(parsed.error);
  try {
    const result = await associatePersonsToDocument(
      id,
      parsed.data.personIds,
      parsed.data.quality ?? null,
      parsed.data.personRoleId ?? null,
      {
        cotaParte:       parsed.data.cotaParte ?? null,
        cotaSuprafataMp: parsed.data.cotaSuprafataMp ?? null,
        cotaMod:         parsed.data.cotaMod ?? null,
      },
    );
    // ⚠️ **200 WITH A BODY, WHERE THIS WAS A BARE 204.**        (Slice #36.02)
    // A 204 cannot say that nothing was added, and after the widening „nothing
    // was added" is a real and ordinary answer: the person is already on this
    // document IN THIS ROLE. The screen needs to tell the user that rather than
    // appear to work, so the counts come back. Every existing caller checks
    // `res.ok`, which a 200 satisfies exactly as a 204 did.
    return Response.json(result);
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
