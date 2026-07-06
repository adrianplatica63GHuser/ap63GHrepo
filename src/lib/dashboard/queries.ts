/**
 * DB query helpers for the Operational Dashboard (Slice #22.01).
 *
 * All four functions are read-only and require no DB migration — they query
 * existing columns only.  Each is independently callable so the API route can
 * run them in parallel.
 */

import { and, desc, eq, gte, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  document,
  entityMetadata,
  lookupDocumentType,
  person,
  principalObject,
  property,
} from "@/db/schema";

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export type RecentCounts = {
  persons:    number;
  properties: number;
  documents:  number;
};

export type ExpiringDocument = {
  id:               string;
  code:             string;
  documentTypeName: string | null;
  title:            string | null;
  dateValidUntil:   string;
};

export type StaleMetadataCount = {
  total:       number;
  persons:     number;
  properties:  number;
  documents:   number;
};

export type RecentActivityItem = {
  id:          string;
  code:        string;
  displayName: string;
  entityType:  "person" | "property" | "document";
  /** Only set when entityType === "person"; drives URL routing to natural-persons vs judicial-persons. */
  personType?: "NATURAL" | "JUDICIAL";
  updatedAt:   Date;
};

// ---------------------------------------------------------------------------
// 1. Items created in the last 7 days
// ---------------------------------------------------------------------------

export async function getDashboardRecentCounts(): Promise<RecentCounts> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);

  const [personsResult, propertiesResult, documentsResult] = await Promise.all([
    db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(person)
      .where(and(isNull(person.deletedAt), gte(person.createdAt, cutoff))),

    db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(property)
      .where(and(isNull(property.deletedAt), gte(property.createdAt, cutoff))),

    db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(document)
      .where(and(isNull(document.deletedAt), gte(document.createdAt, cutoff))),
  ]);

  return {
    persons:    personsResult[0]?.count ?? 0,
    properties: propertiesResult[0]?.count ?? 0,
    documents:  documentsResult[0]?.count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// 2. Documents with date_valid_until set, expiring within 60 days or already expired
// ---------------------------------------------------------------------------

export async function getDashboardExpiringDocuments(): Promise<ExpiringDocument[]> {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 60);
  const horizonStr = horizon.toISOString().split("T")[0];

  const rows = await db
    .select({
      id:               document.id,
      code:             document.code,
      documentTypeName: lookupDocumentType.name,
      title:            document.title,
      dateValidUntil:   document.dateValidUntil,
    })
    .from(document)
    .leftJoin(lookupDocumentType, eq(document.documentTypeId, lookupDocumentType.id))
    .where(
      and(
        isNull(document.deletedAt),
        isNotNull(document.dateValidUntil),
        lte(document.dateValidUntil, horizonStr),
      ),
    )
    .orderBy(document.dateValidUntil)
    .limit(30);

  return rows
    .filter((r): r is typeof r & { dateValidUntil: string } => r.dateValidUntil !== null)
    .map((r) => ({
      id:               r.id,
      code:             r.code,
      documentTypeName: r.documentTypeName,
      title:            r.title,
      dateValidUntil:   r.dateValidUntil,
    }));
}

// ---------------------------------------------------------------------------
// 3. Entities with stale metadata (any field timestamp NULL or > 90 days old)
// ---------------------------------------------------------------------------

export async function getDashboardStaleMetadata(): Promise<StaleMetadataCount> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  // A metadata row is "stale" when ANY of the three per-field timestamps is
  // NULL (never set) or older than 90 days.
  const stale = sql<boolean>`(
    ${entityMetadata.importanceUpdatedAt} IS NULL
    OR ${entityMetadata.importanceUpdatedAt} < ${cutoff.toISOString()}
    OR ${entityMetadata.relevanceUpdatedAt} IS NULL
    OR ${entityMetadata.relevanceUpdatedAt} < ${cutoff.toISOString()}
    OR ${entityMetadata.provenanceUpdatedAt} IS NULL
    OR ${entityMetadata.provenanceUpdatedAt} < ${cutoff.toISOString()}
  )`;

  const rows = await db
    .select({
      objectType: principalObject.objectType,
      count:      sql<number>`cast(count(*) as int)`,
    })
    .from(entityMetadata)
    .innerJoin(
      principalObject,
      eq(entityMetadata.principalObjectId, principalObject.id),
    )
    .where(stale)
    .groupBy(principalObject.objectType);

  let persons = 0, properties = 0, documents = 0;
  for (const r of rows) {
    if (r.objectType === "PERSON")   persons    = r.count;
    if (r.objectType === "PROPERTY") properties = r.count;
    if (r.objectType === "DOCUMENT") documents  = r.count;
  }

  return { total: persons + properties + documents, persons, properties, documents };
}

// ---------------------------------------------------------------------------
// 4. Last 10 updated items across all entity types
// ---------------------------------------------------------------------------

export async function getDashboardRecentActivity(): Promise<RecentActivityItem[]> {
  const [latestPersons, latestProperties, latestDocuments] = await Promise.all([
    db
      .select({
        id:          person.id,
        code:        person.code,
        displayName: person.displayName,
        personType:  person.type,
        updatedAt:   person.updatedAt,
      })
      .from(person)
      .where(isNull(person.deletedAt))
      .orderBy(desc(person.updatedAt))
      .limit(10),

    db
      .select({
        id:          property.id,
        code:        property.code,
        displayName: property.nickname,
        updatedAt:   property.updatedAt,
      })
      .from(property)
      .where(isNull(property.deletedAt))
      .orderBy(desc(property.updatedAt))
      .limit(10),

    db
      .select({
        id:          document.id,
        code:        document.code,
        displayName: document.title,
        updatedAt:   document.updatedAt,
      })
      .from(document)
      .where(isNull(document.deletedAt))
      .orderBy(desc(document.updatedAt))
      .limit(10),
  ]);

  const combined: RecentActivityItem[] = [
    ...latestPersons.map((r) => ({
      id:          r.id,
      code:        r.code,
      displayName: r.displayName,
      entityType:  "person" as const,
      personType:  r.personType,
      updatedAt:   r.updatedAt,
    })),
    ...latestProperties.map((r) => ({
      id:          r.id,
      code:        r.code,
      displayName: r.displayName ?? r.code,
      entityType:  "property" as const,
      updatedAt:   r.updatedAt,
    })),
    ...latestDocuments.map((r) => ({
      id:          r.id,
      code:        r.code,
      displayName: r.displayName ?? r.code,
      entityType:  "document" as const,
      updatedAt:   r.updatedAt,
    })),
  ];

  return combined
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 10);
}
