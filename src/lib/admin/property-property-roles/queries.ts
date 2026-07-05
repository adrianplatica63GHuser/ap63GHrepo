import { eq } from "drizzle-orm";
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

export async function createPropertyPropertyRole(
  name: string,
  description: string | null,
): Promise<PropertyPropertyRoleRow> {
  const maxRow = await db
    .select({ sortOrder: lookupPropertyPropertyRole.sortOrder })
    .from(lookupPropertyPropertyRole)
    .orderBy(lookupPropertyPropertyRole.sortOrder)
    .limit(1);
  // Place new entry at the end
  const nextSort = maxRow.length === 0 ? 1 : (maxRow[0].sortOrder ?? 0) + 10;

  const [row] = await db
    .insert(lookupPropertyPropertyRole)
    .values({ name, description: description || null, sortOrder: nextSort })
    .returning({
      id:          lookupPropertyPropertyRole.id,
      name:        lookupPropertyPropertyRole.name,
      description: lookupPropertyPropertyRole.description,
      sortOrder:   lookupPropertyPropertyRole.sortOrder,
    });
  return row;
}

export async function updatePropertyPropertyRole(
  id: string,
  name: string,
  description: string | null,
): Promise<void> {
  await db
    .update(lookupPropertyPropertyRole)
    .set({ name, description: description || null })
    .where(eq(lookupPropertyPropertyRole.id, id));
}

export async function deletePropertyPropertyRole(id: string): Promise<void> {
  await db
    .delete(lookupPropertyPropertyRole)
    .where(eq(lookupPropertyPropertyRole.id, id));
}
