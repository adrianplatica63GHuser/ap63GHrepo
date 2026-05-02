/**
 * DB query helpers for the eight value-list tables.
 *
 * All operations are hard-deletes (no soft-delete on lookup tables).
 * Each function dispatches on the ListKey string via a switch statement —
 * verbose but fully type-safe within each case.
 */

import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  lookupPropertyType,
  lookupTarla,
  lookupUseCategory,
  lookupPersonType,
  lookupCitizenship,
  lookupDocumentType,
  lookupInstitution,
  lookupServiceInterest,
} from "@/db/schema";
import type { ListKey } from "./config";

// Row types — inferred from the Drizzle table definitions.
export type LookupRow = Record<string, unknown> & { id: string };

// ── List ─────────────────────────────────────────────────────────────────────

export async function listValues(key: ListKey): Promise<LookupRow[]> {
  switch (key) {
    case "property-types":
      return db.select().from(lookupPropertyType).orderBy(asc(lookupPropertyType.sortOrder)) as Promise<LookupRow[]>;
    case "tarla":
      return db.select().from(lookupTarla).orderBy(asc(lookupTarla.sortOrder)) as Promise<LookupRow[]>;
    case "use-categories":
      return db.select().from(lookupUseCategory).orderBy(asc(lookupUseCategory.sortOrder)) as Promise<LookupRow[]>;
    case "person-types":
      return db.select().from(lookupPersonType).orderBy(asc(lookupPersonType.sortOrder)) as Promise<LookupRow[]>;
    case "citizenships":
      return db.select().from(lookupCitizenship).orderBy(asc(lookupCitizenship.sortOrder)) as Promise<LookupRow[]>;
    case "document-types":
      return db.select().from(lookupDocumentType).orderBy(asc(lookupDocumentType.sortOrder)) as Promise<LookupRow[]>;
    case "institutions":
      return db.select().from(lookupInstitution).orderBy(asc(lookupInstitution.sortOrder)) as Promise<LookupRow[]>;
    case "service-interests":
      return db.select().from(lookupServiceInterest).orderBy(asc(lookupServiceInterest.sortOrder)) as Promise<LookupRow[]>;
  }
}

// ── Create ───────────────────────────────────────────────────────────────────

export async function createValue(
  key: ListKey,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
): Promise<LookupRow> {
  switch (key) {
    case "property-types": {
      const [row] = await db.insert(lookupPropertyType).values(data).returning();
      return row as LookupRow;
    }
    case "tarla": {
      const [row] = await db.insert(lookupTarla).values(data).returning();
      return row as LookupRow;
    }
    case "use-categories": {
      const [row] = await db.insert(lookupUseCategory).values(data).returning();
      return row as LookupRow;
    }
    case "person-types": {
      const [row] = await db.insert(lookupPersonType).values(data).returning();
      return row as LookupRow;
    }
    case "citizenships": {
      const [row] = await db.insert(lookupCitizenship).values(data).returning();
      return row as LookupRow;
    }
    case "document-types": {
      const [row] = await db.insert(lookupDocumentType).values(data).returning();
      return row as LookupRow;
    }
    case "institutions": {
      const [row] = await db.insert(lookupInstitution).values(data).returning();
      return row as LookupRow;
    }
    case "service-interests": {
      const [row] = await db.insert(lookupServiceInterest).values(data).returning();
      return row as LookupRow;
    }
  }
}

// ── Update ───────────────────────────────────────────────────────────────────

export async function updateValue(
  key: ListKey,
  id: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
): Promise<LookupRow | null> {
  switch (key) {
    case "property-types": {
      const [row] = await db.update(lookupPropertyType).set(data).where(eq(lookupPropertyType.id, id)).returning();
      return (row as LookupRow) ?? null;
    }
    case "tarla": {
      const [row] = await db.update(lookupTarla).set(data).where(eq(lookupTarla.id, id)).returning();
      return (row as LookupRow) ?? null;
    }
    case "use-categories": {
      const [row] = await db.update(lookupUseCategory).set(data).where(eq(lookupUseCategory.id, id)).returning();
      return (row as LookupRow) ?? null;
    }
    case "person-types": {
      const [row] = await db.update(lookupPersonType).set(data).where(eq(lookupPersonType.id, id)).returning();
      return (row as LookupRow) ?? null;
    }
    case "citizenships": {
      const [row] = await db.update(lookupCitizenship).set(data).where(eq(lookupCitizenship.id, id)).returning();
      return (row as LookupRow) ?? null;
    }
    case "document-types": {
      const [row] = await db.update(lookupDocumentType).set(data).where(eq(lookupDocumentType.id, id)).returning();
      return (row as LookupRow) ?? null;
    }
    case "institutions": {
      const [row] = await db.update(lookupInstitution).set(data).where(eq(lookupInstitution.id, id)).returning();
      return (row as LookupRow) ?? null;
    }
    case "service-interests": {
      const [row] = await db.update(lookupServiceInterest).set(data).where(eq(lookupServiceInterest.id, id)).returning();
      return (row as LookupRow) ?? null;
    }
  }
}

// ── Delete ───────────────────────────────────────────────────────────────────

export async function deleteValue(key: ListKey, id: string): Promise<boolean> {
  switch (key) {
    case "property-types": {
      const r = await db.delete(lookupPropertyType).where(eq(lookupPropertyType.id, id)).returning({ id: lookupPropertyType.id });
      return r.length > 0;
    }
    case "tarla": {
      const r = await db.delete(lookupTarla).where(eq(lookupTarla.id, id)).returning({ id: lookupTarla.id });
      return r.length > 0;
    }
    case "use-categories": {
      const r = await db.delete(lookupUseCategory).where(eq(lookupUseCategory.id, id)).returning({ id: lookupUseCategory.id });
      return r.length > 0;
    }
    case "person-types": {
      const r = await db.delete(lookupPersonType).where(eq(lookupPersonType.id, id)).returning({ id: lookupPersonType.id });
      return r.length > 0;
    }
    case "citizenships": {
      const r = await db.delete(lookupCitizenship).where(eq(lookupCitizenship.id, id)).returning({ id: lookupCitizenship.id });
      return r.length > 0;
    }
    case "document-types": {
      const r = await db.delete(lookupDocumentType).where(eq(lookupDocumentType.id, id)).returning({ id: lookupDocumentType.id });
      return r.length > 0;
    }
    case "institutions": {
      const r = await db.delete(lookupInstitution).where(eq(lookupInstitution.id, id)).returning({ id: lookupInstitution.id });
      return r.length > 0;
    }
    case "service-interests": {
      const r = await db.delete(lookupServiceInterest).where(eq(lookupServiceInterest.id, id)).returning({ id: lookupServiceInterest.id });
      return r.length > 0;
    }
  }
}
