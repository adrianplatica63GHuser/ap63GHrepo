/**
 * GET /api/documents/[id]/type-change?to=<document type id>                                          (Slice 40.92)
 *
 * The parties „Schimbă tipul…" names before a saved document's type is changed: each link whose role the type `to`
 * does not allow (`partiesStrandedByType`). Read-only. A save does not re-check those links — the PATCH never
 * touches them — so the dialog names them and the change goes ahead; they stay linked as they are.
 *
 * The roles are the type's own, with no fallback (`listPersonRolesForDocumentType`, D-16(b)): a type with none
 * configured strands every link that has a role, which is the truth about that type.
 */
import { z } from "zod/v4";
import type { NextRequest } from "next/server";
import { unexpectedError } from "@/lib/api/errors";
import { listDocumentPersons, listPersonRolesForDocumentType } from "@/lib/documents/queries";
import { partiesStrandedByType } from "@/lib/documents/type-change";

type Ctx = { params: Promise<{ id: string }> };

// Any uuid shape, not zod's strict v4: a value-list row's id is whatever the seed or the rebuild wrote.
const toSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

export async function GET(req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const to = toSchema.safeParse(req.nextUrl.searchParams.get("to"));
  if (!to.success) return Response.json({ error: "`to` must be a document type id" }, { status: 400 });
  try {
    const [links, roles] = await Promise.all([listDocumentPersons(id), listPersonRolesForDocumentType(to.data)]);
    return Response.json({ parties: partiesStrandedByType(links, new Set(roles.map((r) => r.id))) });
  } catch (err) {
    return unexpectedError(err, "GET /api/documents/[id]/type-change");
  }
}
