/**
 * /api/people/[id]/documents
 */
import { z } from "zod/v4";
import type { NextRequest } from "next/server";
import { roleNotOfferedToResponse, unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { listPersonDocuments, associateDocumentsToPerson } from "@/lib/persons/queries";
import { COTA_MOD_VALUES } from "@/lib/documents/cota-parte";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  try { return Response.json({ items: await listPersonDocuments(id) }); }
  catch (err) { return unexpectedError(err, "GET /api/people/[id]/documents"); }
}

const bodySchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1),
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
    const result = await associateDocumentsToPerson(
      id,
      parsed.data.documentIds,
      parsed.data.personRoleId ?? null,
      {
        cotaParte:       parsed.data.cotaParte ?? null,
        cotaSuprafataMp: parsed.data.cotaSuprafataMp ?? null,
        cotaMod:         parsed.data.cotaMod ?? null,
      },
    );
    // 200 with the counts rather than a bare 204 — see the document-side route
    // for why „nothing was added" is now an answer a screen has to be able to
    // give.
    return Response.json(result);
  } catch (err) {
    // Slice #34.15 — every role ticked for some document type, which is what
    // this screen's picker offers. `role-offers.ts` says why it is that list
    // and not the selected documents' own types.
    const refusal = roleNotOfferedToResponse(err);
    if (refusal) return refusal;
    return unexpectedError(err, "POST /api/people/[id]/documents");
  }
}
