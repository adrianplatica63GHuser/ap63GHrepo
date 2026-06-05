/**
 * /api/admin/doc-type-person-roles
 *
 * GET  — return all associations joined with document-type name + role name
 * POST — create a new association; body: { documentTypeId, personRoleId }
 */

import { z } from "zod/v4";
import type { NextRequest } from "next/server";
import { unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
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
    // Unique-constraint violation → duplicate association
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return Response.json(
        { error: "This association already exists" },
        { status: 409 },
      );
    }
    return unexpectedError(err, "POST /api/admin/doc-type-person-roles");
  }
}
