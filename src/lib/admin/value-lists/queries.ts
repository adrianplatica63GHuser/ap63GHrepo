/**
 * DB query helpers for the admin value-list tables.
 *
 * Slice #29.04: all deletes are real deletes. The row goes, its key is free
 * for immediate reuse, and nothing is left for a list query to filter.
 *
 * What that costs, stated rather than hidden: the M:M junction FKs are
 * ON DELETE SET NULL, so an association that carried a deleted role keeps its
 * row and loses the label. document-types is the one list the database itself
 * protects — `document.document_type_id` is NOT NULL with no onDelete clause,
 * so Postgres refuses the delete outright. Deciding what the user is TOLD in
 * either case is Slice #29.05; until then a refusal is only an error code.
 *
 * Each function dispatches on the ListKey string via a switch statement —
 * verbose but fully type-safe within each case.
 *
 * lookup_others was dropped in migration_052. ("groups" moved to its own
 * feature in Slice #18.07 — see src/lib/groups/.)
 */

import { asc, eq, like, sql } from "drizzle-orm";
import { nextFreeKey, slugifyLookupKey } from "./keys";
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
import {
  sanitizeDocumentTypeTemplateFields,
  stripDocumentTypeOrigin,
} from "./validation";
import {
  isDocumentTypeOrigin,
  type DocumentTypeOrigin,
} from "@/lib/documents/status";

// Row types — inferred from the Drizzle table definitions.
export type LookupRow = Record<string, unknown> & { id: string };

/**
 * `nextFreeKey` against the live table, in ONE round trip.
 *
 * Reads every key that could possibly collide — anything starting with the
 * base — and lets `nextFreeKey` (src/lib/admin/value-lists/keys.ts) decide. One query rather than one
 * per candidate, and, more to the point, ONE implementation of the rule: a
 * loop here as well would be a second place that decides what a free key is,
 * and the two would eventually disagree.
 *
 * `_` is a single-character wildcard to LIKE and the slug is full of them, so
 * this pattern over-matches (`ZZZ_PROBA%` also finds `ZZZAPROBA`). That is
 * harmless by construction: the set holds real keys and `has()` is exact, so
 * an extra row can only be a key that was never a candidate. Over-fetching a
 * handful of lookup rows is the cheap direction; UNDER-fetching would hand
 * back a taken key and fail on INSERT with 23505.
 */
async function generateUniqueKey(
  table: typeof lookupDocumentType | typeof lookupPropertyType,
  name: string,
): Promise<string> {
  const base = slugifyLookupKey(name);
  const rows = await db
    .select({ key: table.key })
    .from(table)
    .where(like(table.key, `${base}%`));
  const taken = new Set(rows.map((r) => r.key));
  return nextFreeKey(base, (k) => taken.has(k));
}

async function generateUniqueDocumentTypeKey(name: string): Promise<string> {
  return generateUniqueKey(lookupDocumentType, name);
}

// Same slug logic for property types (Slice #19.02).
async function generateUniquePropertyTypeKey(name: string): Promise<string> {
  return generateUniqueKey(lookupPropertyType, name);
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
        .orderBy(asc(lookupPropertyType.sortOrder)) as Promise<LookupRow[]>;
    case "tarla":
      return db.select().from(lookupTarla)
        .orderBy(asc(lookupTarla.sortOrder)) as Promise<LookupRow[]>;
    case "use-categories":
      return db.select().from(lookupUseCategory)
        .orderBy(asc(lookupUseCategory.sortOrder)) as Promise<LookupRow[]>;
    case "person-types":
      return db.select().from(lookupPersonType)
        .orderBy(asc(lookupPersonType.sortOrder)) as Promise<LookupRow[]>;
    case "person-roles":
      return db.select().from(lookupPersonRole)
        .orderBy(asc(lookupPersonRole.name)) as Promise<LookupRow[]>;
    case "citizenships":
      return db.select().from(lookupCitizenship)
        .orderBy(asc(lookupCitizenship.sortOrder)) as Promise<LookupRow[]>;
    case "judicial-person-types":
      return db.select().from(lookupJudicialPersonType)
        .orderBy(asc(lookupJudicialPersonType.sortOrder)) as Promise<LookupRow[]>;
    case "document-types":
      // UNCLASSIFIED (NECLASIFICAT) pinned first; rest alphabetical.
      return db.select().from(lookupDocumentType)
        .orderBy(
          sql`CASE WHEN key = 'UNCLASSIFIED' THEN 0 ELSE 1 END`,
          asc(lookupDocumentType.name),
        ) as Promise<LookupRow[]>;
    case "institutions":
      return db.select().from(lookupInstitution)
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
      // Slice #26.12: origin is create-only and defaults to MANUAL here rather
      // than in the Zod schema, so exactly one place decides what an unstated
      // origin means. The import path (`ensureDocType` in
      // bulk-import-dialog.tsx) is the only caller that sends "IMPORT"; a new
      // writer that forgets is labelled hand-added, which is the conservative
      // direction — it under-claims instead of crediting the machine with a
      // type Adrian typed himself.
      const origin: DocumentTypeOrigin = isDocumentTypeOrigin(data.origin)
        ? data.origin
        : "MANUAL";
      // Slice #27.03: through the same template-field choke point as the
      // update below. No admin form sends `templateFields` on a POST today —
      // the create form is built from LIST_META, which lists `name` alone —
      // but a door that sanitises on the way in and not on the way out is a
      // door that will eventually be used the other way round.
      const [row] = await db
        .insert(lookupDocumentType)
        .values({ ...sanitizeDocumentTypeTemplateFields(data), key, origin })
        .returning();
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
      const [row] = await db
        .update(lookupDocumentType)
        // Two guards, composed. `stripDocumentTypeOrigin` keeps a rename from
        // re-originating an imported type (#26.12); `sanitizeDocumentType-
        // TemplateFields` keeps a hand-typed label out of the extraction
        // prompt and renumbers `order` from array position (#27.03). Both
        // named rather than inlined so each can be asserted on behaviour
        // without opening a database connection.
        .set(sanitizeDocumentTypeTemplateFields(stripDocumentTypeOrigin(data)))
        .where(eq(lookupDocumentType.id, id))
        .returning();
      return (row as LookupRow) ?? null;
    }
    case "institutions": {
      const [row] = await db.update(lookupInstitution).set(data).where(eq(lookupInstitution.id, id)).returning();
      return (row as LookupRow) ?? null;
    }
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────
//
// Slice #29.04: the row is deleted. This is also what the route's own header
// comment has claimed since it was written — "hard delete (lookup rows have
// no soft-delete)" — so this makes the documentation true rather than
// rewriting it.
//
// Freeing the key is the point. `lookup_document_type.key` carries a real
// UNIQUE constraint, and a tombstoned row went on occupying it forever: that
// is why deleting "ZZZ Proba" and creating it again produced
// ZZZ_PROBA_SLICE_2901_2. See generateUniqueDocumentTypeKey above, which
// deliberately does NOT filter and is correct precisely because of that
// constraint.

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
  }
}
