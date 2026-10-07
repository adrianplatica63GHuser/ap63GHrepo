/**
 * The roles a parent read off an identity card is linked by  (Slice #38.29)
 *
 * „Tată" and „Mamă" (migration_095) are found by `lookup_person_role.parent_kind`
 * — FATHER / MOTHER — and never by their names, which are Adrian's to rename on
 * Date de referință → Roluri Persoană: a name the code looked up would be a
 * display value doubling as a lock.
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { lookupPersonRole } from "@/db/schema";
import type { ParentKind } from "@/lib/import/id-card-parents";
import { associatePersonsToPerson } from "@/lib/persons/queries";

/** The role's id for FATHER / MOTHER, or null when no role carries that kind. */
export async function parentRoleId(kind: ParentKind): Promise<string | null> {
  const rows = await db
    .select({ id: lookupPersonRole.id })
    .from(lookupPersonRole)
    .where(eq(lookupPersonRole.parentKind, kind))
    .limit(1);
  return rows[0]?.id ?? null;
}

/** No role carries this parent kind — migration_095 has not run, or the tick was removed. */
export class ParentRoleMissingError extends Error {
  constructor(readonly kind: ParentKind) {
    super(`No person role carries parent_kind ${kind}.`);
    this.name = "ParentRoleMissingError";
  }
}

/**
 * Link `parentId` to `holderId` as the holder's father or mother. The PARENT
 * holds the role: `associatePersonsToPerson` makes the person it is handed in
 * the list the holder of the role towards the first argument, which is what
 * the „Asociază" screen does for a ticked person (Slice #37.28).
 */
export async function linkParent(holderId: string, parentId: string, kind: ParentKind): Promise<void> {
  const roleId = await parentRoleId(kind);
  if (!roleId) throw new ParentRoleMissingError(kind);
  await associatePersonsToPerson(holderId, [parentId], roleId);
}
