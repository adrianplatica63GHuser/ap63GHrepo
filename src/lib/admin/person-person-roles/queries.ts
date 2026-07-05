import { eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { lookupPersonPersonRole, lookupPersonRole } from "@/db/schema";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PersonPersonRoleRow = {
  id:                    string;
  personRoleId:          string;
  personRoleName:        string;
  personRoleDescription: string | null;
};

// ── Queries ───────────────────────────────────────────────────────────────────

export async function listPersonPersonRoles(): Promise<PersonPersonRoleRow[]> {
  // Slice #19.30: exclude whitelist entries whose parent role was soft-deleted.
  const rows = await db
    .select({
      id:                    lookupPersonPersonRole.id,
      personRoleId:          lookupPersonPersonRole.personRoleId,
      personRoleName:        lookupPersonRole.name,
      personRoleDescription: lookupPersonRole.description,
    })
    .from(lookupPersonPersonRole)
    .innerJoin(lookupPersonRole, eq(lookupPersonPersonRole.personRoleId, lookupPersonRole.id))
    .where(isNull(lookupPersonRole.deletedAt))
    .orderBy(lookupPersonRole.name);
  return rows;
}

export async function createPersonPersonRole(
  personRoleId: string,
): Promise<PersonPersonRoleRow> {
  const [inserted] = await db
    .insert(lookupPersonPersonRole)
    .values({ personRoleId })
    .returning({ id: lookupPersonPersonRole.id });

  const [row] = await db
    .select({
      id:                    lookupPersonPersonRole.id,
      personRoleId:          lookupPersonPersonRole.personRoleId,
      personRoleName:        lookupPersonRole.name,
      personRoleDescription: lookupPersonRole.description,
    })
    .from(lookupPersonPersonRole)
    .innerJoin(lookupPersonRole, eq(lookupPersonPersonRole.personRoleId, lookupPersonRole.id))
    .where(eq(lookupPersonPersonRole.id, inserted.id));

  return row;
}

export async function deletePersonPersonRole(id: string): Promise<void> {
  await db.delete(lookupPersonPersonRole).where(eq(lookupPersonPersonRole.id, id));
}
