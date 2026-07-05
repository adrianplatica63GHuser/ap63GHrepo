import { eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { lookupDocumentDocumentRole } from "@/db/schema";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DocumentDocumentRoleRow = {
  id:          string;
  name:        string;
  description: string | null;
  sortOrder:   number;
};

// ── Queries ───────────────────────────────────────────────────────────────────

export async function listDocumentDocumentRoles(): Promise<DocumentDocumentRoleRow[]> {
  return db
    .select({
      id:          lookupDocumentDocumentRole.id,
      name:        lookupDocumentDocumentRole.name,
      description: lookupDocumentDocumentRole.description,
      sortOrder:   lookupDocumentDocumentRole.sortOrder,
    })
    .from(lookupDocumentDocumentRole)
    .where(isNull(lookupDocumentDocumentRole.deletedAt))
    .orderBy(lookupDocumentDocumentRole.sortOrder, lookupDocumentDocumentRole.name);
}

export async function createDocumentDocumentRole(
  name: string,
  description: string | null,
): Promise<DocumentDocumentRoleRow> {
  const [row] = await db
    .insert(lookupDocumentDocumentRole)
    .values({ name, description: description || null })
    .returning({
      id:          lookupDocumentDocumentRole.id,
      name:        lookupDocumentDocumentRole.name,
      description: lookupDocumentDocumentRole.description,
      sortOrder:   lookupDocumentDocumentRole.sortOrder,
    });
  return row;
}

export async function updateDocumentDocumentRole(
  id: string,
  name: string,
  description: string | null,
): Promise<void> {
  await db
    .update(lookupDocumentDocumentRole)
    .set({ name, description: description || null })
    .where(eq(lookupDocumentDocumentRole.id, id));
}

// Slice #19.30: soft-delete
export async function deleteDocumentDocumentRole(id: string): Promise<void> {
  await db
    .update(lookupDocumentDocumentRole)
    .set({ deletedAt: sql`NOW()` })
    .where(eq(lookupDocumentDocumentRole.id, id));
}
