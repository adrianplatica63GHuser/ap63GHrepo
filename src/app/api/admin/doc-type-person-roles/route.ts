/**
 * /api/admin/doc-type-person-roles
 *
 * GET  — return all associations joined with document-type name + role name
 * POST — create a new association; body: { documentTypeId, personRoleId }
 */

import { z } from "zod/v4";
import type { NextRequest } from "next/server";
import { unexpectedError, zodErrorToResponse, pgErrorCode } from "@/lib/api/errors";
import {
  listDocTypePersonRoles,
  createDocTypePersonRole,
} from "@/lib/admin/doc-type-person-roles/queries";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  documentTypeId: z.string().uuid(),
  personRoleId:   z.string().uuid(),
});

export async function GET(): Promise<Response> {
  try {
    const items = await listDocTypePersonRoles();
    return Response.json({ items, total: items.length });
  } catch (err) {
    return unexpectedError(err, "GET /api/admin/doc-type-person-roles");
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorToResponse(parsed.error);
  }

  try {
    const row = await createDocTypePersonRole(parsed.data);
    return Response.json(row, { status: 201 });
  } catch (err) {
    // Unique-constraint violation → duplicate association.
    //
    // ⚠️ **SQLSTATE, not the constraint NAME.**                (Slice #29.13)
    // This used to match the substrings "unique"/"duplicate" in the message,
    // and its two siblings matched a literal constraint name — one of which
    // (`lookup_person_person_role_person_role_id_unique`) Postgres never
    // generates, because migration_055 declares the column UNIQUE inline and
    // Postgres names that `..._key`. A miss answered 500 and the panel said
    // the generic sentence. 23505 is the same fact with nothing to spell
    // wrong, and this slice is what made the branch load-bearing: it is the
    // only thing that produces `valueList.confirm.errors.duplicate`.
    if (pgErrorCode(err) === "23505") {
      // ⚠️ **`code`, not just a status.** Slice #29.13: the admin panel picks
      // its Romanian sentence from a CODE, because 409 is also what the
      // value-lists DELETE answers with when a row is in use — a status alone
      // cannot tell the two apart, and the sentence for one is wrong for the
      // other.
      return Response.json(
        { error: "This association already exists", code: "DUPLICATE" },
        { status: 409 },
      );
    }
    return unexpectedError(err, "POST /api/admin/doc-type-person-roles");
  }
}
