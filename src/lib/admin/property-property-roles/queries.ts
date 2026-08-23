/**
 * `lookup_property_property_role` — READ ONLY.                  (Slice #29.13)
 *
 * ⚠️ **The create, the rename and the delete that used to live here are gone,
 * and the delete is the reason.** It was a bare `db.delete` with no count, and
 * `property_property.relationship_role_id` is ON DELETE SET NULL — so deleting
 * a role that forty associations carried blanked forty relationship tags and
 * answered 204.
 * That is exactly the failure Slice #29.05 exists to prevent, one modal over.
 *
 * The list joined `VALID_LIST_KEYS` instead of gaining a guard of its own (see
 * src/lib/admin/value-lists/config.ts for why), so all three writes are now
 * `createValue` / `updateValue` / `deleteValue` in
 * src/lib/admin/value-lists/queries.ts, and the delete there is refused while
 * anything depends on the row.
 *
 * What is left is this one reader, and it is left because it has a consumer
 * the generic list route does not serve: the association screen's role
 * dropdown, via GET /api/admin/property-property-roles.
 */

import { db } from "@/db";
import { lookupPropertyPropertyRole } from "@/db/schema";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PropertyPropertyRoleRow = {
  id:          string;
  name:        string;
  description: string | null;
  sortOrder:   number;
};

// ── Queries ───────────────────────────────────────────────────────────────────

export async function listPropertyPropertyRoles(): Promise<PropertyPropertyRoleRow[]> {
  return db
    .select({
      id:          lookupPropertyPropertyRole.id,
      name:        lookupPropertyPropertyRole.name,
      description: lookupPropertyPropertyRole.description,
      sortOrder:   lookupPropertyPropertyRole.sortOrder,
    })
    .from(lookupPropertyPropertyRole)
    .orderBy(lookupPropertyPropertyRole.sortOrder, lookupPropertyPropertyRole.name);
}
