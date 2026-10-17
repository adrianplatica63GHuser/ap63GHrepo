/**
 * The reads and the one write of `lookup_property_type_use`.                             (Slice #39.66, migration_111)
 * Server-only. The meaning of the rows — no rows, every use — is in ./type-uses.ts.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { lookupPropertyTypeUse } from "@/db/schema";
import type { TypeUsePair } from "./type-uses";

export async function listTypeUses(): Promise<TypeUsePair[]> {
  return db
    .select({ propertyTypeId: lookupPropertyTypeUse.propertyTypeId, useCategoryId: lookupPropertyTypeUse.useCategoryId })
    .from(lookupPropertyTypeUse);
}

/** Allow or stop allowing one use for one type. Idempotent both ways. */
export async function setTypeUseAllowed(pair: TypeUsePair, allowed: boolean): Promise<void> {
  if (allowed) {
    await db.insert(lookupPropertyTypeUse).values(pair).onConflictDoNothing();
  } else {
    await db
      .delete(lookupPropertyTypeUse)
      .where(and(eq(lookupPropertyTypeUse.propertyTypeId, pair.propertyTypeId), eq(lookupPropertyTypeUse.useCategoryId, pair.useCategoryId)));
  }
}
