/**
 * GET /api/admin/metadata-query
 *
 * Complex entity search combining filters across:
 *   - entity type (PERSON / PROPERTY / DOCUMENT)
 *   - person subtype (NATURAL / JUDICIAL — only when entityType=PERSON or unset)
 *   - metadata fields (importance, relevance, provenance)
 *   - group membership (by group code, e.g. "AA")
 *   - stamp membership (by stamp code, e.g. "STMP-AAA")
 *   - tag (substring match against entity_tag.tag)
 *   - text search on display name / code / key cadastral/document fields
 *   - metadata last-updated date range (updatedAt from/to)
 *   - "has metadata" / "has no metadata" filter
 *
 * All filters are ANDed together.
 * Returns up to 200 results, ordered by entity code ascending.
 *
 * Response: { results: QueryResultItem[] }
 *
 * Slice #21.01 fixes:
 *   (1) person.deleted_at / property.deleted_at / document.deleted_at were
 *       missing from every WHERE clause — soft-deleted entities were leaking
 *       into results.
 *   (2) tagExists correlated subquery used ${principalObject.id} which Drizzle
 *       renders as a bare "id" inside sql`` — ambiguous when entity_tag also
 *       exposes an id.  Fixed to the literal qualified name "principal_object.id".
 *   (3) Property text search now covers carte_funciara, tarla_sola, and
 *       cadastral_number in addition to nickname.
 *   (4) Document text search now covers nr_document and subject in addition to
 *       title.
 *   (5) New personSubtype filter (NATURAL | JUDICIAL).
 */

import { NextResponse } from "next/server";
import {
  and, or, eq, ilike, isNull, isNotNull, gte, lte, sql,
} from "drizzle-orm";
import { db } from "@/db";
import {
  principalObject,
  person,
  property,
  document,
  entityMetadata,
} from "@/db/schema";

export type QueryResultItem = {
  principalObjectId: string;
  code:              string;
  entityType:        string;
  entityId:          string;
  displayName:       string;
  /** For PERSON rows: "NATURAL" | "JUDICIAL". Null for other entity types. */
  personType:        string | null;
  importance:        string | null;
  relevance:         string | null;
  provenance:        string | null;
  updatedBy:         string | null;
  metadataUpdatedAt: string | null;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const p   = (key: string) => url.searchParams.get(key)?.trim() || null;

  const entityType    = p("entityType");    // PERSON | PROPERTY | DOCUMENT | null=all
  const personSubtype = p("personSubtype"); // NATURAL | JUDICIAL | null=both
  const importance    = p("importance");
  const relevance     = p("relevance");
  const provenance    = p("provenance");
  const groupCode     = p("groupCode");
  const stampCode     = p("stampCode");
  const tag           = p("tag");
  const search        = p("search");
  const updatedFrom   = p("updatedFrom");
  const updatedTo     = p("updatedTo");
  const hasMetadata   = p("hasMetadata");  // "yes" | "no" | null=any

  const types: Array<"PERSON" | "PROPERTY" | "DOCUMENT"> =
    entityType
      ? [entityType as "PERSON" | "PROPERTY" | "DOCUMENT"]
      : ["PERSON", "PROPERTY", "DOCUMENT"];

  const results: QueryResultItem[] = [];

  for (const type of types) {
    // ── Shared conditions (metadata + group + stamp + tag) ─────────────────

    const metaConditions = [];
    if (importance)  metaConditions.push(eq(entityMetadata.importance, importance));
    if (relevance)   metaConditions.push(eq(entityMetadata.relevance,  relevance));
    if (provenance)  metaConditions.push(eq(entityMetadata.provenance, provenance));
    if (updatedFrom) metaConditions.push(gte(entityMetadata.updatedAt, new Date(updatedFrom)));
    if (updatedTo)   metaConditions.push(lte(entityMetadata.updatedAt, new Date(updatedTo)));
    if (hasMetadata === "yes") metaConditions.push(isNotNull(entityMetadata.id));
    if (hasMetadata === "no")  metaConditions.push(isNull(entityMetadata.id));

    // Group filter via correlated EXISTS.
    // After migration_051, group_member has a single principal_object_id FK.
    // NOTE: use the literal qualified name "principal_object.id" — Drizzle's
    // ${principalObject.id} renders as a bare "id" inside sql`` correlated
    // subqueries and Postgres resolves it to the wrong table (CLAUDE.md gotcha).
    const groupExists = groupCode
      ? sql`EXISTS (
            SELECT 1 FROM group_member gm
            JOIN groups g ON g.id = gm.group_id
            WHERE gm.principal_object_id = principal_object.id
              AND g.code ILIKE ${groupCode}
          )`
      : null;

    // Stamp filter via correlated EXISTS (same literal-name fix).
    const stampExists = stampCode
      ? sql`EXISTS (
            SELECT 1 FROM stamp_member sm
            JOIN stamps s ON s.id = sm.stamp_id
            WHERE sm.principal_object_id = principal_object.id
              AND s.code ILIKE ${stampCode}
          )`
      : null;

    // Tag filter — bug fix: was ${principalObject.id} (Drizzle renders as
    // bare "id", ambiguous against entity_tag.id).  Now uses literal name.
    const tagExists = tag
      ? sql`EXISTS (
            SELECT 1 FROM entity_tag et
            WHERE et.principal_object_id = principal_object.id
              AND et.tag ILIKE ${`%${tag}%`}
          )`
      : null;

    // ── Per-type queries ────────────────────────────────────────────────────

    if (type === "PERSON") {
      // Text search covers display_name (= last+first for natural persons,
      // company name for judicial) and the shared principal_object code.
      const searchCond = search
        ? or(
            ilike(person.displayName,  `%${search}%`),
            ilike(principalObject.code, `%${search}%`),
          )
        : null;

      // Person subtype filter (NATURAL / JUDICIAL).
      const subtypeCond = personSubtype
        ? eq(person.type, personSubtype as "NATURAL" | "JUDICIAL")
        : null;

      const where = and(
        eq(principalObject.objectType, "PERSON"),
        isNull(person.deletedAt),           // ← (fix 1) exclude soft-deleted
        ...metaConditions,
        ...(groupExists  ? [groupExists]  : []),
        ...(stampExists  ? [stampExists]  : []),
        ...(tagExists    ? [tagExists]    : []),
        ...(searchCond   ? [searchCond]   : []),
        ...(subtypeCond  ? [subtypeCond]  : []),
      );

      const rows = await db
        .select({
          principalObjectId: principalObject.id,
          code:              principalObject.code,
          entityId:          person.id,
          displayName:       person.displayName,
          personType:        person.type,
          importance:        entityMetadata.importance,
          relevance:         entityMetadata.relevance,
          provenance:        entityMetadata.provenance,
          updatedBy:         entityMetadata.updatedBy,
          metadataUpdatedAt: entityMetadata.updatedAt,
        })
        .from(principalObject)
        .innerJoin(person, eq(person.principalObjectId, principalObject.id))
        .leftJoin(entityMetadata, eq(entityMetadata.principalObjectId, principalObject.id))
        .where(where)
        .orderBy(principalObject.code)
        .limit(200);

      for (const r of rows) {
        results.push({
          principalObjectId: r.principalObjectId,
          code:              r.code,
          entityType:        "PERSON",
          entityId:          r.entityId,
          displayName:       r.displayName,
          personType:        r.personType,
          importance:        r.importance,
          relevance:         r.relevance,
          provenance:        r.provenance,
          updatedBy:         r.updatedBy,
          metadataUpdatedAt: r.metadataUpdatedAt?.toISOString() ?? null,
        });
      }
    }

    if (type === "PROPERTY") {
      // Text search expanded (fix 3): nickname + carte_funciara + tarla_sola
      // + cadastral_number + code.  GIN trigram indexes (migration_053) make
      // each ILIKE sub-clause fast.
      const searchCond = search
        ? or(
            ilike(property.nickname,        `%${search}%`),
            ilike(property.carteFunciara,   `%${search}%`),
            ilike(property.tarlaSola,       `%${search}%`),
            ilike(property.cadastralNumber, `%${search}%`),
            ilike(principalObject.code,     `%${search}%`),
          )
        : null;

      const where = and(
        eq(principalObject.objectType, "PROPERTY"),
        isNull(property.deletedAt),         // ← (fix 1) exclude soft-deleted
        ...metaConditions,
        ...(groupExists ? [groupExists] : []),
        ...(stampExists ? [stampExists] : []),
        ...(tagExists   ? [tagExists]   : []),
        ...(searchCond  ? [searchCond]  : []),
      );

      const rows = await db
        .select({
          principalObjectId: principalObject.id,
          code:              principalObject.code,
          entityId:          property.id,
          displayName:       property.nickname,
          importance:        entityMetadata.importance,
          relevance:         entityMetadata.relevance,
          provenance:        entityMetadata.provenance,
          updatedBy:         entityMetadata.updatedBy,
          metadataUpdatedAt: entityMetadata.updatedAt,
        })
        .from(principalObject)
        .innerJoin(property, eq(property.principalObjectId, principalObject.id))
        .leftJoin(entityMetadata, eq(entityMetadata.principalObjectId, principalObject.id))
        .where(where)
        .orderBy(principalObject.code)
        .limit(200);

      for (const r of rows) {
        results.push({
          principalObjectId: r.principalObjectId,
          code:              r.code,
          entityType:        "PROPERTY",
          entityId:          r.entityId,
          displayName:       r.displayName ?? "",
          personType:        null,
          importance:        r.importance,
          relevance:         r.relevance,
          provenance:        r.provenance,
          updatedBy:         r.updatedBy,
          metadataUpdatedAt: r.metadataUpdatedAt?.toISOString() ?? null,
        });
      }
    }

    if (type === "DOCUMENT") {
      // Text search expanded (fix 4): title + nr_document + subject + code.
      const searchCond = search
        ? or(
            ilike(document.title,       `%${search}%`),
            ilike(document.nrDocument,  `%${search}%`),
            ilike(document.subject,     `%${search}%`),
            ilike(principalObject.code, `%${search}%`),
          )
        : null;

      const where = and(
        eq(principalObject.objectType, "DOCUMENT"),
        isNull(document.deletedAt),         // ← (fix 1) exclude soft-deleted
        ...metaConditions,
        ...(groupExists ? [groupExists] : []),
        ...(stampExists ? [stampExists] : []),
        ...(tagExists   ? [tagExists]   : []),
        ...(searchCond  ? [searchCond]  : []),
      );

      const rows = await db
        .select({
          principalObjectId: principalObject.id,
          code:              principalObject.code,
          entityId:          document.id,
          displayName:       document.title,
          importance:        entityMetadata.importance,
          relevance:         entityMetadata.relevance,
          provenance:        entityMetadata.provenance,
          updatedBy:         entityMetadata.updatedBy,
          metadataUpdatedAt: entityMetadata.updatedAt,
        })
        .from(principalObject)
        .innerJoin(document, eq(document.principalObjectId, principalObject.id))
        .leftJoin(entityMetadata, eq(entityMetadata.principalObjectId, principalObject.id))
        .where(where)
        .orderBy(principalObject.code)
        .limit(200);

      for (const r of rows) {
        results.push({
          principalObjectId: r.principalObjectId,
          code:              r.code,
          entityType:        "DOCUMENT",
          entityId:          r.entityId,
          displayName:       r.displayName ?? "",
          personType:        null,
          importance:        r.importance,
          relevance:         r.relevance,
          provenance:        r.provenance,
          updatedBy:         r.updatedBy,
          metadataUpdatedAt: r.metadataUpdatedAt?.toISOString() ?? null,
        });
      }
    }
  }

  // Final cross-type sort by code
  results.sort((a, b) => a.code.localeCompare(b.code));
  return NextResponse.json({ results: results.slice(0, 200) });
}
