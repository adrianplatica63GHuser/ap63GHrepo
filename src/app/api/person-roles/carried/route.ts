/**
 * GET /api/person-roles/carried?kind=…&entityId=…      (Slice #34.05)
 *
 * The person roles this entity's association rows ALREADY CARRY — the second
 * of the two sources every role picker now unions, so a role that lost its
 * whitelist tick appears in the dropdown marked „(nu mai este disponibil)"
 * instead of vanishing from it. `src/lib/admin/value-lists/carried-roles.ts`
 * says why it is scoped to one entity and why it does not filter the ticked
 * ones out itself.
 *
 * One route with a `kind` rather than five routes under five entities: the
 * answer is one `selectDistinct` over an association table, and the five
 * association screens differ only in which column they filter on.
 */
import type { NextRequest } from "next/server";
import { z } from "zod/v4";
import { unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import {
  CARRIED_ROLE_KINDS,
  listCarriedPersonRoles,
} from "@/lib/admin/value-lists/carried-roles";

const querySchema = z.object({
  kind: z.enum(CARRIED_ROLE_KINDS),
  // A uuid, not a bare string: `entityId` goes straight into a `WHERE` on a
  // uuid column, where a non-uuid is a 22P02 and so a 500 rather than the 400
  // it is.
  entityId: z.string().uuid(),
});

export async function GET(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    kind:     url.searchParams.get("kind")     ?? undefined,
    entityId: url.searchParams.get("entityId") ?? undefined,
  });

  if (!parsed.success) return zodErrorToResponse(parsed.error);

  try {
    const items = await listCarriedPersonRoles(parsed.data.kind, parsed.data.entityId);
    return Response.json({ items });
  } catch (err) {
    return unexpectedError(err, "GET /api/person-roles/carried");
  }
}
