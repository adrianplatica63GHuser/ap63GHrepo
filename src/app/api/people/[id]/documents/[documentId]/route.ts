/**
 * DELETE / PATCH /api/people/[id]/documents/[documentId]?linkId=<uuid>
 *
 * The mirror of `/api/documents/[id]/persons/[personId]`, one axis over, and
 * `linkId` is required here for the identical reason (#36.02): a person who
 * holds two roles on one document has two `person_document` rows, and a DELETE
 * addressed at the (person, document) pair removed both. That route's header
 * carries the full argument, including why the row id is a query parameter
 * rather than a path segment and why it has no „all roles" fallback.
 */
import { z } from "zod/v4";
import type { NextRequest } from "next/server";
import { unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import {
  dissociateDocumentFromPerson,
  updatePersonDocumentCota,
} from "@/lib/persons/queries";
import { COTA_MOD_VALUES } from "@/lib/documents/cota-parte";

type Ctx = { params: Promise<{ id: string; documentId: string }> };

const linkIdSchema = z.string().uuid();

function readLinkId(req: NextRequest): string | null {
  const raw = new URL(req.url).searchParams.get("linkId");
  const parsed = linkIdSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

const missingLinkId = () =>
  Response.json(
    { error: "linkId query parameter is required and must be a UUID" },
    { status: 400 },
  );

export async function DELETE(req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id, documentId } = await ctx.params;
  const linkId = readLinkId(req);
  if (!linkId) return missingLinkId();
  try {
    const ok = await dissociateDocumentFromPerson(id, documentId, linkId);
    if (!ok) return Response.json({ error: "Association not found" }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (err) {
    return unexpectedError(err, "DELETE /api/people/[id]/documents/[documentId]");
  }
}

const patchSchema = z.object({
  cotaParte:       z.number().nullable().optional(),
  cotaSuprafataMp: z.number().nullable().optional(),
  cotaMod:         z.enum(COTA_MOD_VALUES).nullable().optional(),
});

export async function PATCH(req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id, documentId } = await ctx.params;
  const linkId = readLinkId(req);
  if (!linkId) return missingLinkId();

  let body: unknown;
  try { body = await req.json(); }
  catch { return Response.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return zodErrorToResponse(parsed.error);

  try {
    const ok = await updatePersonDocumentCota(id, documentId, linkId, {
      cotaParte:       parsed.data.cotaParte ?? null,
      cotaSuprafataMp: parsed.data.cotaSuprafataMp ?? null,
      cotaMod:         parsed.data.cotaMod ?? null,
    });
    if (!ok) return Response.json({ error: "Association not found" }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (err) {
    return unexpectedError(err, "PATCH /api/people/[id]/documents/[documentId]");
  }
}
