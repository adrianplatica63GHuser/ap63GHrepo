/**
 * GET /api/admin/global-search
 *
 * Global entity search combining filters across:
 *   - entity type (PERSON / PROPERTY / DOCUMENT)
 *   - person subtype (NATURAL / JUDICIAL — only when entityType=PERSON or unset)
 *   - metadata fields (importance, relevance, provenance)
 *   - group membership (by group code, e.g. "GRP-001")
 *   - stamp membership (by stamp code, e.g. "STMP-AAA")
 *   - tag (substring match against entity_tag.tag)
 *   - text search on display name / code / key cadastral/document fields /
 *     property address (street_line, locality) / group description
 *   - metadata last-updated date range (updatedAt from/to)
 *   - "has metadata" / "has no metadata" filter
 *
 * All filters are ANDed together.
 *
 * Response: {
 *   results:        QueryResultItem[],  // already interleaved; at most 200
 *   truncatedTypes: SearchEntityType[], // which types were cut short, if any
 *   perTypeCap:     number,             // 50
 * }
 *
 * Slice #23.11.search — WHAT CHANGED AND WHY
 *   This route was called /api/admin/metadata-query, after a screen ("Complex
 *   query") that was renamed to Global Search in Slice #20.02 and deleted in
 *   this one. Renamed to match the only screen it serves.
 *
 *   (1) FOUR independent caps of 50 replace one shared cap of 200.
 *       The old route ran three queries, each `.limit(200)`, concatenated
 *       them, sorted by code and then took `.slice(0, 200)`. Because entity
 *       codes are type-prefixed and DOC < JPERS < PPERS < PROP
 *       lexicographically, that last slice silently dropped whole entity
 *       types: 200 matching documents meant zero properties and zero persons
 *       in the response. Persons are split into natural/judicial here so the
 *       caps are genuinely independent — one shared person budget would let
 *       judicial persons crowd out natural ones, the same defect one level
 *       down.
 *   (2) Truncation is detected with limit + 1 (fetch 51, report 50) and
 *       reported PER TYPE, so the UI can name what is missing. No COUNT: an
 *       accurate count across four filtered queries with correlated EXISTS
 *       subqueries is the expensive part of this screen.
 *   (3) Results come back interleaved round-robin by type. With a per-type cap
 *       but a plain code sort, the first three pages would still be nothing
 *       but documents.
 *   (4) Group and stamp tags are returned per row, so a group- or
 *       stamp-filtered result can show which one matched. Batched into one
 *       query each — per-row helpers would be 400 round trips for 200 rows.
 *
 *   The caps and the merge live in the pure, unit-tested
 *   src/lib/search/interleave.ts rather than inline here, because Jest cannot
 *   easily exercise a route.
 *
 * Slice #20.02 additions (preserved):
 *   (A) Property text search includes property_address.street_line/locality.
 *   (B) Text search matches group descriptions via a correlated EXISTS.
 *   (C) Property rows carry tarlaSola / parcela / nickname / cadastralNumber
 *       separately so the UI can apply its display priority.
 *
 * Slice #21.01 fixes (preserved):
 *   (1) Soft-deleted entities excluded from every type query.
 *   (2) tagExists correlated subquery uses the literal "principal_object.id".
 *   (3) Property text search covers carte_funciara, tarla_sola, cadastral_number.
 *   (4) Document text search covers nr_document and subject.
 *   (5) personSubtype filter (NATURAL | JUDICIAL).
 */

import { NextResponse } from "next/server";
import {
  and, or, eq, ilike, isNull, isNotNull, gte, lte, sql, type SQL,
} from "drizzle-orm";
import { db } from "@/db";
import {
  principalObject,
  person,
  property,
  propertyAddress,
  document,
  entityMetadata,
} from "@/db/schema";
import { listGroupTagsForEntities } from "@/lib/groups/queries";
import { listStampCodesForEntities } from "@/lib/stamps/queries";
import {
  PER_TYPE_CAP,
  capBucket,
  interleaveByType,
  truncatedTypes,
  type SearchBucket,
  type SearchEntityType,
} from "@/lib/search/interleave";

/** One membership badge on a result row. */
export type ResultGroupTag = { code: string; position: number };

export type QueryResultItem = {
  principalObjectId: string;
  code:              string;
  entityType:        string;
  /** Which of the four capped buckets this row came from. */
  searchType:        SearchEntityType;
  entityId:          string;
  displayName:       string;
  /** For PERSON rows: "NATURAL" | "JUDICIAL". Null for other entity types. */
  personType:        string | null;
  importance:        string | null;
  relevance:         string | null;
  provenance:        string | null;
  updatedBy:         string | null;
  metadataUpdatedAt: string | null;
  /** PROPERTY only — used by the UI to build display priority label. */
  propertyTarlaSola:       string | null;
  propertyParcela:         string | null;
  propertyNickname:        string | null;
  propertyCadastralNumber: string | null;
  /** Slice #23.11.search — so a group/stamp filter can show what matched. */
  groupTags:  ResultGroupTag[];
  stampCodes: string[];
};

/** Fetch one more than we keep: the extra row IS the truncation signal. */
const FETCH_LIMIT = PER_TYPE_CAP + 1;

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

  // ── Shared conditions ─────────────────────────────────────────────────────
  // Built once. The old route rebuilt these inside its per-type loop, which
  // produced identical fragments three times over.

  const metaConditions: SQL[] = [];
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

  // Tag filter — uses the literal name for the same Drizzle gotcha reason.
  const tagExists = tag
    ? sql`EXISTS (
          SELECT 1 FROM entity_tag et
          WHERE et.principal_object_id = principal_object.id
            AND et.tag ILIKE ${`%${tag}%`}
        )`
    : null;

  // Slice #20.02 (B): group description search — matches when the entity
  // belongs to ANY group whose description contains the search term.
  const groupDescriptionExists = search
    ? sql`EXISTS (
          SELECT 1 FROM group_member gm2
          JOIN groups g2 ON g2.id = gm2.group_id
          WHERE gm2.principal_object_id = principal_object.id
            AND g2.description ILIKE ${`%${search}%`}
        )`
    : null;

  /** Conditions every type query shares, spread into each `and(...)`. */
  const commonConditions: SQL[] = [
    ...metaConditions,
    ...(groupExists ? [groupExists] : []),
    ...(stampExists ? [stampExists] : []),
    ...(tagExists   ? [tagExists]   : []),
  ];

  // ── Which buckets to run ──────────────────────────────────────────────────
  // personSubtype narrows persons even when entityType is unset, matching the
  // previous behaviour (the old route applied it inside the PERSON branch,
  // which also ran when entityType was null).

  const wantsPerson = !entityType || entityType === "PERSON";
  const include: Record<SearchEntityType, boolean> = {
    DOCUMENT:        !entityType || entityType === "DOCUMENT",
    JUDICIAL_PERSON: wantsPerson && personSubtype !== "NATURAL",
    NATURAL_PERSON:  wantsPerson && personSubtype !== "JUDICIAL",
    PROPERTY:        !entityType || entityType === "PROPERTY",
  };

  // ── Per-type queries ──────────────────────────────────────────────────────

  async function queryPersons(
    subtype: "NATURAL" | "JUDICIAL",
  ): Promise<QueryResultItem[]> {
    // Text search covers display_name (= last+first for natural persons,
    // company name for judicial) and the shared principal_object code.
    const searchCond = search
      ? or(
          ilike(person.displayName,   `%${search}%`),
          ilike(principalObject.code, `%${search}%`),
          ...(groupDescriptionExists ? [groupDescriptionExists] : []),
        )
      : null;

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
      .where(and(
        eq(principalObject.objectType, "PERSON"),
        isNull(person.deletedAt),          // exclude soft-deleted
        eq(person.type, subtype),
        ...commonConditions,
        ...(searchCond ? [searchCond] : []),
      ))
      .orderBy(principalObject.code)
      .limit(FETCH_LIMIT);

    return rows.map((r) => ({
      principalObjectId:       r.principalObjectId,
      code:                    r.code,
      entityType:              "PERSON",
      searchType:              subtype === "JUDICIAL" ? "JUDICIAL_PERSON" : "NATURAL_PERSON",
      entityId:                r.entityId,
      displayName:             r.displayName,
      personType:              r.personType,
      importance:              r.importance,
      relevance:               r.relevance,
      provenance:              r.provenance,
      updatedBy:               r.updatedBy,
      metadataUpdatedAt:       r.metadataUpdatedAt?.toISOString() ?? null,
      propertyTarlaSola:       null,
      propertyParcela:         null,
      propertyNickname:        null,
      propertyCadastralNumber: null,
      groupTags:               [],
      stampCodes:              [],
    }));
  }

  async function queryProperties(): Promise<QueryResultItem[]> {
    // Text search (Slice #21.01 fix 3 + Slice #20.02 A):
    //   nickname, carte_funciara, tarla_sola, cadastral_number, code
    //   + property_address.street_line, property_address.locality
    //   + group description (via correlated EXISTS)
    const searchCond = search
      ? or(
          ilike(property.nickname,          `%${search}%`),
          ilike(property.carteFunciara,     `%${search}%`),
          ilike(property.tarlaSola,         `%${search}%`),
          ilike(property.cadastralNumber,   `%${search}%`),
          ilike(principalObject.code,       `%${search}%`),
          ilike(propertyAddress.streetLine, `%${search}%`),
          ilike(propertyAddress.locality,   `%${search}%`),
          ...(groupDescriptionExists ? [groupDescriptionExists] : []),
        )
      : null;

    const rows = await db
      .select({
        principalObjectId: principalObject.id,
        code:              principalObject.code,
        entityId:          property.id,
        // Slice #20.02 (C): individual fields for the priority display
        tarlaSola:         property.tarlaSola,
        parcela:           property.parcela,
        nickname:          property.nickname,
        cadastralNumber:   property.cadastralNumber,
        importance:        entityMetadata.importance,
        relevance:         entityMetadata.relevance,
        provenance:        entityMetadata.provenance,
        updatedBy:         entityMetadata.updatedBy,
        metadataUpdatedAt: entityMetadata.updatedAt,
      })
      .from(principalObject)
      .innerJoin(property, eq(property.principalObjectId, principalObject.id))
      // Slice #20.02 (A): LEFT JOIN property_address for street search.
      // property_address has a unique index on property_id, so this cannot
      // multiply rows and the cap stays a row cap.
      .leftJoin(propertyAddress, eq(propertyAddress.propertyId, property.id))
      .leftJoin(entityMetadata, eq(entityMetadata.principalObjectId, principalObject.id))
      .where(and(
        eq(principalObject.objectType, "PROPERTY"),
        isNull(property.deletedAt),        // exclude soft-deleted
        ...commonConditions,
        ...(searchCond ? [searchCond] : []),
      ))
      .orderBy(principalObject.code)
      .limit(FETCH_LIMIT);

    return rows.map((r) => {
      // Summary displayName for plain-text consumers.
      // Priority: tarla+parcela → nickname → cadastralNumber → ""
      const tarlaParcela = [r.tarlaSola, r.parcela].filter(Boolean).join(" / ");
      return {
        principalObjectId:       r.principalObjectId,
        code:                    r.code,
        entityType:              "PROPERTY",
        searchType:              "PROPERTY" as const,
        entityId:                r.entityId,
        displayName:             tarlaParcela || r.nickname || r.cadastralNumber || "",
        personType:              null,
        importance:              r.importance,
        relevance:               r.relevance,
        provenance:              r.provenance,
        updatedBy:               r.updatedBy,
        metadataUpdatedAt:       r.metadataUpdatedAt?.toISOString() ?? null,
        propertyTarlaSola:       r.tarlaSola,
        propertyParcela:         r.parcela,
        propertyNickname:        r.nickname,
        propertyCadastralNumber: r.cadastralNumber,
        groupTags:               [],
        stampCodes:              [],
      };
    });
  }

  async function queryDocuments(): Promise<QueryResultItem[]> {
    // Text search (Slice #21.01 fix 4): title + nr_document + subject + code
    // + group description (via correlated EXISTS).
    const searchCond = search
      ? or(
          ilike(document.title,       `%${search}%`),
          ilike(document.nrDocument,  `%${search}%`),
          ilike(document.subject,     `%${search}%`),
          ilike(principalObject.code, `%${search}%`),
          ...(groupDescriptionExists ? [groupDescriptionExists] : []),
        )
      : null;

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
      .where(and(
        eq(principalObject.objectType, "DOCUMENT"),
        isNull(document.deletedAt),        // exclude soft-deleted
        ...commonConditions,
        ...(searchCond ? [searchCond] : []),
      ))
      .orderBy(principalObject.code)
      .limit(FETCH_LIMIT);

    return rows.map((r) => ({
      principalObjectId:       r.principalObjectId,
      code:                    r.code,
      entityType:              "DOCUMENT",
      searchType:              "DOCUMENT" as const,
      entityId:                r.entityId,
      displayName:             r.displayName ?? "",
      personType:              null,
      importance:              r.importance,
      relevance:               r.relevance,
      provenance:              r.provenance,
      updatedBy:               r.updatedBy,
      metadataUpdatedAt:       r.metadataUpdatedAt?.toISOString() ?? null,
      propertyTarlaSola:       null,
      propertyParcela:         null,
      propertyNickname:        null,
      propertyCadastralNumber: null,
      groupTags:               [],
      stampCodes:              [],
    }));
  }

  // The four queries are independent, so run them concurrently rather than in
  // the old sequential loop.
  const empty: QueryResultItem[] = [];
  const [docRows, judicialRows, naturalRows, propertyRows] = await Promise.all([
    include.DOCUMENT        ? queryDocuments()          : empty,
    include.JUDICIAL_PERSON ? queryPersons("JUDICIAL")  : empty,
    include.NATURAL_PERSON  ? queryPersons("NATURAL")   : empty,
    include.PROPERTY        ? queryProperties()         : empty,
  ]);

  // Only included types get a bucket, so a filtered-out type can never appear
  // in the truncation notice.
  const buckets: SearchBucket<QueryResultItem>[] = [];
  if (include.DOCUMENT)        buckets.push(capBucket("DOCUMENT", docRows));
  if (include.JUDICIAL_PERSON) buckets.push(capBucket("JUDICIAL_PERSON", judicialRows));
  if (include.NATURAL_PERSON)  buckets.push(capBucket("NATURAL_PERSON", naturalRows));
  if (include.PROPERTY)        buckets.push(capBucket("PROPERTY", propertyRows));

  const merged = interleaveByType(buckets);

  // ── Group / stamp badges ──────────────────────────────────────────────────
  // Two queries for the whole page, after the caps have cut the set to <= 200.
  const ids = merged.map((r) => r.principalObjectId);
  const [groupMap, stampMap] = await Promise.all([
    listGroupTagsForEntities(ids),
    listStampCodesForEntities(ids),
  ]);

  const results = merged.map((row) => ({
    ...row,
    groupTags: (groupMap.get(row.principalObjectId) ?? []).map((g) => ({
      code:     g.code,
      position: g.position,
    })),
    stampCodes: stampMap.get(row.principalObjectId) ?? [],
  }));

  return NextResponse.json({
    results,
    truncatedTypes: truncatedTypes(buckets),
    perTypeCap:     PER_TYPE_CAP,
  });
}
