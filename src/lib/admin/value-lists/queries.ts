/**
 * DB query helpers for the admin value-list tables.
 *
 * All operations are hard-deletes (no soft-delete on lookup tables).
 * Each function dispatches on the ListKey string via a switch statement —
 * verbose but fully type-safe within each case.
 *
 * "stamps" operates on lookup_others (filtered by category='Stampila').
 * The category value is injected automatically on create and never exposed in
 * the UI form. ("groups" moved to its own feature in Slice #18.07 —
 * see src/lib/groups/.)
 */

import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  lookupPropertyType,
  lookupTarla,
  lookupUseCategory,
  lookupPersonType,
  lookupPersonRole,
  lookupCitizenship,
  lookupJudicialPersonType,
  lookupDocumentType,
  lookupInstitution,
  lookupOthers,
} from "@/db/schema";
import type { ListKey } from "./config";

// Category constant — matches the value stored in lookup_others.category.
const CATEGORY_STAMP = "Stampila";

// Row types — inferred from the Drizzle table definitions.
export type LookupRow = Record<string, unknown> & { id: string };

// ── property-types / document-types: server-generated `key` slug ──────────
//
// Migration 020 (Slice #15.05) added `lookup_document_type.key` as an
// immutable, NOT NULL, UNIQUE slug that application code (getTypeConfig)
// switches on. The Value Lists admin form only ever exposed `name` — adding
// a new Document Type via Reference Data left `key` unset, violating the
// NOT NULL constraint. Per the standing rule ("new document types are added
// only by Adrian via Administration -> Reference Data ... never auto-seeded
// or hardcoded again"), `key` for an admin-added type doesn't need to match
// anything `type-config.ts` recognizes — unmapped keys already fall back to
// the GENERIC config. So the key is derived from `name` automatically here,
// using the same diacritics-folding approach as migration_020's fallback-slug
// step, with a numeric suffix on collision. The form itself never changes.
const ROMANIAN_DIACRITICS_MAP: Record<string, string> = {
  ă: "a", â: "a", î: "i", ș: "s", ş: "s", ț: "t", ţ: "t",
  Ă: "A", Â: "A", Î: "I", Ț: "T", Ţ: "T", Ș: "S", Ş: "S",
};

function foldRomanianDiacritics(input: string): string {
  return input.replace(/[ăâîșşțţĂÂÎȚŢȘŞ]/g, (ch) => ROMANIAN_DIACRITICS_MAP[ch] ?? ch);
}

function slugifyDocumentTypeKey(name: string): string {
  const slug = foldRomanianDiacritics(name)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "DOCTYPE";
}

async function generateUniqueDocumentTypeKey(name: string): Promise<string> {
  const base = slugifyDocumentTypeKey(name);
  let candidate = base;
  let suffix = 2;
  for (;;) {
    const existing = await db
      .select({ id: lookupDocumentType.id })
      .from(lookupDocumentType)
      .where(eq(lookupDocumentType.key, candidate));
    if (existing.length === 0) return candidate;
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
}

// Same slug logic for property types (Slice #19.02).
async function generateUniquePropertyTypeKey(name: string): Promise<string> {
  const base = slugifyDocumentTypeKey(name); // reuse the same diacritics-fold + slug helper
  let candidate = base;
  let suffix = 2;
  for (;;) {
    const existing = await db
      .select({ id: lookupPropertyType.id })
      .from(lookupPropertyType)
      .where(eq(lookupPropertyType.key, candidate));
    if (existing.length === 0) return candidate;
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
}

// ── List ─────────────────────────────────────────────────────────────────────

export async function listValues(key: ListKey): Promise<LookupRow[]> {
  switch (key) {
    case "property-types":
      // Slice #19.02: include a live usage count (# of properties that
      // reference this type) so the admin UI can show a richer delete warning.
      // The correlated subquery uses a literal qualified name to avoid Drizzle's
      // unqualified-column bug inside correlated subqueries (see CLAUDE.md Gotcha).
      return db.select({
        id:               lookupPropertyType.id,
        name:             lookupPropertyType.name,
        key:              lookupPropertyType.key,
        showTarlaParcela: lookupPropertyType.showTarlaParcela,
        showAddress:      lookupPropertyType.showAddress,
        showStreetView:   lookupPropertyType.showStreetView,
        sortOrder:        lookupPropertyType.sortOrder,
        createdAt:        lookupPropertyType.createdAt,
        updatedAt:        lookupPropertyType.updatedAt,
        usageCount: sql<number>`(SELECT COUNT(*) FROM property WHERE property_type_id = lookup_property_type.id)`,
      }).from(lookupPropertyType).orderBy(asc(lookupPropertyType.sortOrder)) as Promise<LookupRow[]>;
    case "tarla":
      return db.select().from(lookupTarla).orderBy(asc(lookupTarla.sortOrder)) as Promise<LookupRow[]>;
    case "use-categories":
      return db.select().from(lookupUseCategory).orderBy(asc(lookupUseCategory.sortOrder)) as Promise<LookupRow[]>;
    case "person-types":
      return db.select().from(lookupPersonType).orderBy(asc(lookupPersonType.sortOrder)) as Promise<LookupRow[]>;
    case "person-roles":
      return db.select().from(lookupPersonRole).orderBy(asc(lookupPersonRole.name)) as Promise<LookupRow[]>;
    case "citizenships":
      return db.select().from(lookupCitizenship).orderBy(asc(lookupCitizenship.sortOrder)) as Promise<LookupRow[]>;
    case "judicial-person-types":
      return db.select().from(lookupJudicialPersonType).orderBy(asc(lookupJudicialPersonType.sortOrder)) as Promise<LookupRow[]>;
    case "document-types":
      // UNCLASSIFIED (NECLASIFICAT) pinned first; rest alphabetical.
      return db.select().from(lookupDocumentType).orderBy(
        sql`CASE WHEN key = 'UNCLASSIFIED' THEN 0 ELSE 1 END`,
        asc(lookupDocumentType.name),
      ) as Promise<LookupRow[]>;
    case "institutions":
      return db.select().from(lookupInstitution).orderBy(asc(lookupInstitution.sortOrder)) as Promise<LookupRow[]>;
    case "stamps":
      return db
        .select()
        .from(lookupOthers)
        .where(eq(lookupOthers.category, CATEGORY_STAMP))
        .orderBy(asc(lookupOthers.sortOrder)) as Promise<LookupRow[]>;
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
      const key = await generateUniquePropertyTypeKey(data.name);
      const [row] = await db.insert(lookupPropertyType).values({ ...data, key }).returning();
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
    case "person-roles": {
      const [row] = await db.insert(lookupPersonRole).values(data).returning();
      return row as LookupRow;
    }
    case "citizenships": {
      const [row] = await db.insert(lookupCitizenship).values(data).returning();
      return row as LookupRow;
    }
    case "judicial-person-types": {
      const [row] = await db.insert(lookupJudicialPersonType).values(data).returning();
      return row as LookupRow;
    }
    case "document-types": {
      const key = await generateUniqueDocumentTypeKey(data.name);
      const [row] = await db.insert(lookupDocumentType).values({ ...data, key }).returning();
      return row as LookupRow;
    }
    case "institutions": {
      const [row] = await db.insert(lookupInstitution).values(data).returning();
      return row as LookupRow;
    }
    case "stamps": {
      const [row] = await db
        .insert(lookupOthers)
        .values({ ...data, category: CATEGORY_STAMP })
        .returning();
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
    case "person-roles": {
      const [row] = await db.update(lookupPersonRole).set(data).where(eq(lookupPersonRole.id, id)).returning();
      return (row as LookupRow) ?? null;
    }
    case "citizenships": {
      const [row] = await db.update(lookupCitizenship).set(data).where(eq(lookupCitizenship.id, id)).returning();
      return (row as LookupRow) ?? null;
    }
    case "judicial-person-types": {
      const [row] = await db.update(lookupJudicialPersonType).set(data).where(eq(lookupJudicialPersonType.id, id)).returning();
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
    case "stamps": {
      // Update name (and sort_order if supplied) but never touch category.
      const { category: _drop, ...safeData } = data;
      const [row] = await db
        .update(lookupOthers)
        .set(safeData)
        .where(eq(lookupOthers.id, id))
        .returning();
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
    case "person-roles": {
      const r = await db.delete(lookupPersonRole).where(eq(lookupPersonRole.id, id)).returning({ id: lookupPersonRole.id });
      return r.length > 0;
    }
    case "citizenships": {
      const r = await db.delete(lookupCitizenship).where(eq(lookupCitizenship.id, id)).returning({ id: lookupCitizenship.id });
      return r.length > 0;
    }
    case "judicial-person-types": {
      const r = await db.delete(lookupJudicialPersonType).where(eq(lookupJudicialPersonType.id, id)).returning({ id: lookupJudicialPersonType.id });
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
    case "stamps": {
      const r = await db
        .delete(lookupOthers)
        .where(eq(lookupOthers.id, id))
        .returning({ id: lookupOthers.id });
      return r.length > 0;
    }
  }
}
