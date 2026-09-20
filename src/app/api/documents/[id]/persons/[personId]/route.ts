/**
 * DELETE / PATCH /api/documents/[id]/persons/[personId]?linkId=<uuid>
 *
 * ⚠️ **`linkId` IS REQUIRED ON BOTH, AND IT IS A DEFECT FIX RATHER THAN A
 * TIGHTENING.**                                                (Slice #36.02)
 *
 * The path names a PERSON, and until migration_084 a person held at most one
 * role on one document, so the path named exactly one `person_document` row.
 * It no longer does: the man who is seller in his own name and mandatar for
 * three others has two rows here, and a DELETE addressed at the person removed
 * BOTH of them — the user unticked one role and silently lost the other.
 *
 * The row's own id closes that, and it is a query parameter rather than a
 * fourth path segment for one reason: the path is the ADDRESS of the
 * association from this document's point of view, `/documents/x/persons/y` is
 * what it means, and a row id is a detail of which of the several
 * associations, not a different resource. Moving it into the path would also
 * have orphaned the URL every existing caller builds.
 *
 * ⚠️ **AND IT IS REQUIRED, NOT OPTIONAL-WITH-A-FALLBACK.** An absent `linkId`
 * meaning „all of this person's roles" would keep the old behaviour reachable
 * from any caller that had not been updated — which is the defect, left in
 * place behind a default. 400 is the honest answer: the caller has not said
 * which row it means.
 */
import { z } from "zod/v4";
import type { NextRequest } from "next/server";
import { unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import {
  dissociatePersonFromDocument,
  updateDocumentPersonCota,
} from "@/lib/documents/queries";
import { COTA_MOD_VALUES } from "@/lib/documents/cota-parte";

type Ctx = { params: Promise<{ id: string; personId: string }> };

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
  const { id, personId } = await ctx.params;
  const linkId = readLinkId(req);
  if (!linkId) return missingLinkId();
  try {
    const ok = await dissociatePersonFromDocument(id, personId, linkId);
    if (!ok) return Response.json({ error: "Association not found" }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (err) {
    return unexpectedError(err, "DELETE /api/documents/[id]/persons/[personId]");
  }
}

/**
 * The cotă, edited in place on the Persons tab.
 *
 * ⚠️ **THE ROLE IS NOT PATCHABLE HERE, DELIBERATELY.** `person_role_id` is half
 * of the row's identity under the widened unique index, so changing it is an
 * attach and a detach rather than an update — and an UPDATE would slip past
 * `assertRoleMayBeAttached`, which is the one door deciding whether a role may
 * be attached to this document at all. Changing a role stays: dezasociază,
 * then asociază.
 *
 * ⚠️ **ALL THREE FIELDS ARE REPLACED, NOT MERGED.** They are one fact about one
 * association — the share, the area the deed stated for it, and how it is held
 * — so a PATCH that set the percentage and left a stale `cota_mod` behind would
 * be the archive disagreeing with itself. The screen sends all three because
 * the screen has all three; an omitted field is an explicit null.
 */
const patchSchema = z.object({
  cotaParte:       z.number().nullable().optional(),
  cotaSuprafataMp: z.number().nullable().optional(),
  cotaMod:         z.enum(COTA_MOD_VALUES).nullable().optional(),
});

export async function PATCH(req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id, personId } = await ctx.params;
  const linkId = readLinkId(req);
  if (!linkId) return missingLinkId();

  let body: unknown;
  try { body = await req.json(); }
  catch { return Response.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return zodErrorToResponse(parsed.error);

  try {
    const ok = await updateDocumentPersonCota(id, personId, linkId, {
      cotaParte:       parsed.data.cotaParte ?? null,
      cotaSuprafataMp: parsed.data.cotaSuprafataMp ?? null,
      cotaMod:         parsed.data.cotaMod ?? null,
    });
    if (!ok) return Response.json({ error: "Association not found" }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (err) {
    return unexpectedError(err, "PATCH /api/documents/[id]/persons/[personId]");
  }
}
