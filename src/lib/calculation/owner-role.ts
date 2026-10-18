/**
 * „Proprietar" — the role an owner's new property links its owner with.              (Slice #39.79, Ask first 3)
 *
 * „Creează proprietățile" makes one property per owner and links the owner to it. The role is the reference list's
 * „Proprietar" — one of the four `valid_for_property` roles (sync-reference-data.sql) — read by name, because the ids
 * differ from one database to the next. The association carries no share: the owner's property is the owner's alone.
 * A database without the row links the owner with no role rather than failing a commit that has already created
 * properties.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { lookupPersonRole } from "@/db/schema";

export const OWNER_ROLE_NAME = "Proprietar";

export async function ownerRoleId(): Promise<string | null> {
  const [row] = await db
    .select({ id: lookupPersonRole.id })
    .from(lookupPersonRole)
    .where(and(eq(lookupPersonRole.name, OWNER_ROLE_NAME), eq(lookupPersonRole.validForProperty, true)));
  return row?.id ?? null;
}
