/**
 * GET /api/documents/[id]/valid-person-roles
 *
 * Returns the person roles that are valid for this document's type,
 * drawn from the Document Persons whitelist (lookup_doc_type_person_role).
 * Returns an empty array when the document type has no associations defined.
 */
import type { NextRequest } from "next/server";
import { unexpectedError } from "@/lib/api/errors";
import { listPersonRolesForDocument } from "@/lib/documents/queries";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  try {
    return Response.json({ items: await listPersonRolesForDocument(id) });
  } catch (err) {
    return unexpectedError(err, "GET /api/documents/[id]/valid-person-roles");
  }
}
