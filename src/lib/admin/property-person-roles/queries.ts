import { eq } from "drizzle-orm";
import { db } from "@/db";
import { lookupPropertyPersonRole, lookupPersonRole } from "@/db/schema";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PropertyPersonRoleRow = {
  id: string;
  personRoleId: string;
  personRoleName: string;
  personRoleDescription: string | null;
};

// ── Queries ───────────────────────────────────────────────────────────────────

export async function listPropertyPersonRoles(): Promise<PropertyPersonRoleRow[]> {
  const rows = await db
    .select({
      id:                    lookupPropertyPersonRole.id,
      personRoleId:          lookupPropertyPersonRole.personRoleId,
      personRoleName:        lookupPersonRole.name,
      personRoleDescription: lookupPersonRole.description,
    })
    .from(lookupPropertyPersonRole)
    .innerJoin(
      lookupPersonRole,
      eq(lookupPropertyPersonRole.personRoleId, lookupPersonRole.id),
    )
    .orderBy(lookupPersonRole.name);

  return rows;
}

export async function createPropertyPersonRole(
  personRoleId: string,
): Promise<PropertyPersonRoleRow> {
  const [inserted] = await db
    .insert(lookupPropertyPersonRole)
    .values({ personRoleId })
    .returning({ id: lookupPropertyPersonRole.id });

  const [row] = await db
    .select({
      id:                    lookupPropertyPersonRole.id,
      personRoleId:          lookupPropertyPersonRole.personRoleId,
      personRoleName:        lookupPersonRole.name,
      personRoleDescription: lookupPersonRole.description,
    })
    .from(lookupPropertyPersonRole)
    .innerJoin(
      lookupPersonRole,
      eq(lookupPropertyPersonRole.personRoleId, lookupPersonRole.id),
    )
    .where(eq(lookupPropertyPersonRole.id, inserted.id));

  return row;
}

export async function deletePropertyPersonRole(id: string): Promise<void> {
  await db
    .delete(lookupPropertyPersonRole)
    .where(eq(lookupPropertyPersonRole.id, id));
}
