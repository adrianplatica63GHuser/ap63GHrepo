/**
 * GET /api/admin/doc-type-person-roles/distinct-roles
 *
 * Returns all unique person roles that appear in at least one document-type
 * association (lookup_doc_type_person_role), ordered alphabetically.
 * Used to populate the role dropdown when associating a document to a person,
 * where the document type is not known upfront.
 */
import type { NextRequest } from "next/server";
import { unexpectedError } from "@/lib/api/errors";
import { listDistinctDocPersonRoles } from "@/lib/admin/doc-type-person-roles/queries";

export async function GET(_req: NextRequest): Promise<Response> {
  try {
    return Response.json({ items: await listDistinctDocPersonRoles() });
  } catch (err) {
    return unexpectedError(err, "GET /api/admin/doc-type-person-roles/distinct-roles");
  }
}
