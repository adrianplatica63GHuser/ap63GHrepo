/**
 * DB query helpers for the admin value-list tables.
 *
 * Slice #19.30: all deletes are now soft-deletes (deleted_at = NOW()).
 * All list queries filter WHERE deleted_at IS NULL so retired entries are
 * invisible to the UI.  M:M junction ON DELETE SET NULL FKs are never
 * triggered, so historical associations keep their role tag name.
 *
 * Each function dispatches on the ListKey string via a switch statement —
 * verbose but fully type-safe within each case.
 *
 * lookup_others was dropped in migration_052. ("groups" moved to its own
 * feature in Slice #18.07 — see src/lib/groups/.)
 */

import { asc, eq, isNull, sql } from "drizzle-orm";
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
} from "@/db/schema";
import type { ListKey } from "./config";

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
      }).from(lookupPropertyType)
        .where(isNull(lookupPropertyType.deletedAt))
        .orderBy(asc(lookupPropertyType.sortOrder)) as Promise<LookupRow[]>;
    case "tarla":
      return db.select().from(lookupTarla)
        .where(isNull(lookupTarla.deletedAt))
        .orderBy(asc(lookupTarla.sortOrder)) as Promise<LookupRow[]>;
    case "use-categories":
      return db.select().from(lookupUseCategory)
        .where(isNull(lookupUseCategory.deletedAt))
        .orderBy(asc(lookupUseCategory.sortOrder)) as Promise<LookupRow[]>;
    case "person-types":
      return db.select().from(lookupPersonType)
        .where(isNull(lookupPersonType.deletedAt))
        .orderBy(asc(lookupPersonType.sortOrder)) as Promise<LookupRow[]>;
    case "person-roles":
      return db.select().from(lookupPersonRole)
        .where(isNull(lookupPersonRole.deletedAt))
        .orderBy(asc(lookupPersonRole.name)) as Promise<LookupRow[]>;
    case "citizenships":
      return db.select().from(lookupCitizenship)
        .where(isNull(lookupCitizenship.deletedAt))
        .orderBy(asc(lookupCitizenship.sortOrder)) as Promise<LookupRow[]>;
    case "judicial-person-types":
      return db.select().from(lookupJudicialPersonType)
        .where(isNull(lookupJudicialPersonType.deletedAt))
        .orderBy(asc(lookupJudicialPersonType.sortOrder)) as Promise<LookupRow[]>;
    case "document-types":
      // UNCLASSIFIED (NECLASIFICAT) pinned first; rest alphabetical.
      return db.select().from(lookupDocumentType)
        .where(isNull(lookupDocumentType.deletedAt))
        .orderBy(
          sql`CASE WHEN key = 'UNCLASSIFIED' THEN 0 ELSE 1 END`,
          asc(lookupDocumentType.name),
        ) as Promise<LookupRow[]>;
    case "institutions":
      return db.select().from(lookupInstitution)
        .where(isNull(lookupInstitution.deletedAt))
        .orderBy(asc(lookupInstitution.sortOrder)) as Promise<LookupRow[]>;
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
  }
}

// ── Delete (soft) ─────────────────────────────────────────────────────────────
//
// Slice #19.30: all deletes are soft-deletes — sets deleted_at = NOW().
// The row is kept in the DB so historical associations that reference it still
// resolve to a name; it is simply excluded from all list/dropdown queries.

const NOW = sql`NOW()`;

export async function deleteValue(key: ListKey, id: string): Promise<boolean> {
  switch (key) {
    case "property-types": {
      const r = await db.update(lookupPropertyType).set({ deletedAt: NOW }).where(eq(lookupPropertyType.id, id)).returning({ id: lookupPropertyType.id });
      return r.length > 0;
    }
    case "tarla": {
      const r = await db.update(lookupTarla).set({ deletedAt: NOW }).where(eq(lookupTarla.id, id)).returning({ id: lookupTarla.id });
      return r.length > 0;
    }
    case "use-categories": {
      const r = await db.update(lookupUseCategory).set({ deletedAt: NOW }).where(eq(lookupUseCategory.id, id)).returning({ id: lookupUseCategory.id });
      return r.length > 0;
    }
    case "person-types": {
      const r = await db.update(lookupPersonType).set({ deletedAt: NOW }).where(eq(lookupPersonType.id, id)).returning({ id: lookupPersonType.id });
      return r.length > 0;
    }
    case "person-roles": {
      const r = await db.update(lookupPersonRole).set({ deletedAt: NOW }).where(eq(lookupPersonRole.id, id)).returning({ id: lookupPersonRole.id });
      return r.length > 0;
    }
    case "citizenships": {
      const r = await db.update(lookupCitizenship).set({ deletedAt: NOW }).where(eq(lookupCitizenship.id, id)).returning({ id: lookupCitizenship.id });
      return r.length > 0;
    }
    case "judicial-person-types": {
      const r = await db.update(lookupJudicialPersonType).set({ deletedAt: NOW }).where(eq(lookupJudicialPersonType.id, id)).returning({ id: lookupJudicialPersonType.id });
      return r.length > 0;
    }
    case "document-types": {
      const r = await db.update(lookupDocumentType).set({ deletedAt: NOW }).where(eq(lookupDocumentType.id, id)).returning({ id: lookupDocumentType.id });
      return r.length > 0;
    }
    case "institutions": {
      const r = await db.update(lookupInstitution).set({ deletedAt: NOW }).where(eq(lookupInstitution.id, id)).returning({ id: lookupInstitution.id });
      return r.length > 0;
    }
  }
}
