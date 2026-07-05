/**
 * GET /api/admin/metadata-query
 *
 * Complex entity search combining filters across:
 *   - entity type (PERSON / PROPERTY / DOCUMENT)
 *   - metadata fields (importance, relevance, provenance)
 *   - group membership (by group code, e.g. "AA")
 *   - stamp membership (by stamp code, e.g. "STMP-AAA")
 *   - tag (substring match against entity_tag.tag)
 *   - text search on display name / code (substring, case-insensitive)
 *   - metadata last-updated date range (updatedAt from/to)
 *   - "has metadata" / "has no metadata" filter
 *
 * All filters are ANDed together.
 * Returns up to 200 results, ordered by entity code ascending.
 *
 * Response: { results: QueryResultItem[] }
 */

import { NextResponse } from "next/server";
import { and, or, eq, ilike, isNull, isNotNull, gte, lte, sql } from "drizzle-orm";
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
  const p = (key: string) => url.searchParams.get(key)?.trim() || null;

  const entityType  = p("entityType");   // PERSON | PROPERTY | DOCUMENT | null=all
  const importance  = p("importance");
  const relevance   = p("relevance");
  const provenance  = p("provenance");
  const groupCode   = p("groupCode");    // group.code exact/ilike, e.g. "AA"
  const stampCode   = p("stampCode");    // stamp.code exact/ilike, e.g. "STMP-AAA"
  const tag         = p("tag");          // entity_tag.tag substring
  const search      = p("search");       // code or display-name substring
  const updatedFrom = p("updatedFrom");  // ISO date — metadata.updated_at >=
  const updatedTo   = p("updatedTo");    // ISO date — metadata.updated_at <=
  const hasMetadata = p("hasMetadata"); // "yes" | "no" | null=any

  const types: Array<"PERSON" | "PROPERTY" | "DOCUMENT"> =
    entityType
      ? [entityType as "PERSON" | "PROPERTY" | "DOCUMENT"]
      : ["PERSON", "PROPERTY", "DOCUMENT"];

  const results: QueryResultItem[] = [];

  for (const type of types) {
    // ------------------------------------------------------------------
    // Build the WHERE conditions that apply to ALL types
    // ------------------------------------------------------------------
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
    // The outer query always joins principalObject, so we correlate on that.
    // NOTE: use literal "principal_object.id" (not ${principalObject.id}) —
    // Drizzle renders ${column} as a bare "id" inside sql`` subqueries, which
    // Postgres would resolve to gm.id or g.id (both in scope).  Literal
    // qualified name is safe (CLAUDE.md gotcha).
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

    // Tag filter via correlated EXISTS on entity_tag (keyed by principal_object_id)
    const tagExists = tag
      ? sql`EXISTS (
          SELECT 1 FROM entity_tag et
          WHERE et.principal_object_id = ${principalObject.id}
            AND et.tag ILIKE ${`%${tag}%`}
        )`
      : null;

    // ------------------------------------------------------------------
    // Per-type query
    // ------------------------------------------------------------------

    if (type === "PERSON") {
      const searchCond = search
        ? or(ilike(person.displayName, `%${search}%`), ilike(principalObject.code, `%${search}%`))
        : null;

      const where = and(
        eq(principalObject.objectType, "PERSON"),
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
      const searchCond = search
        ? or(ilike(property.nickname, `%${search}%`), ilike(principalObject.code, `%${search}%`))
        : null;

      const where = and(
        eq(principalObject.objectType, "PROPERTY"),
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
      const searchCond = search
        ? or(ilike(document.title, `%${search}%`), ilike(principalObject.code, `%${search}%`))
        : null;

      const where = and(
        eq(principalObject.objectType, "DOCUMENT"),
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

  // Final sort across types
  results.sort((a, b) => a.code.localeCompare(b.code));

  return NextResponse.json({ results: results.slice(0, 200) });
}
