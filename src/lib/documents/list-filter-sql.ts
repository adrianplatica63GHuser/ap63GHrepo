/**
 * The Documents list's bar filters, as SQL                                                       (Slice #39.63)
 *
 * One condition per filtered field, ANDed with the list's own (type, „Expiră curând", „Câmp specific", search). The
 * counts are the list's own columns' subqueries — a person or property linked twice counts once — so a filter on
 * „Persoane" means what the column shows. Slice #39.82 kept only the columns Adrian named; the number's and the
 * subject's „contains" went with their filters. Also the issuer checklist's facet query (Slice #39.72: the issuer is a
 * juridical person; the filter keeps its key, `institution`, and its label, „Instituție / Notariat”): `documents/queries.ts` may
 * quote no snapshot key (object-writers-enumerated), and these fields' names are snapshot keys.
 *
 * NO DATABASE — `document-list-filters.test.ts` renders the conditions with `PgDialect`.
 */
import { sql, type SQL } from "drizzle-orm";
import { document, entityMetadata, person } from "@/db/schema";
import type { FilterState } from "@/lib/list/filter-bar";
import { oneOf } from "@/lib/list/filter-sql";

/** The list's three count columns, as the list query reads them. */
export const DOCUMENT_COUNT_SQL = {
  pageCount:     sql<number>`(SELECT count(*)::int FROM document_page dp_c WHERE dp_c.document_id = document.id)`,
  personCount:   sql<number>`(SELECT count(DISTINCT pd_c.person_id)::int FROM person_document pd_c WHERE pd_c.document_id = document.id)`,
  propertyCount: sql<number>`(SELECT count(DISTINCT prd_c.property_id)::int FROM property_document prd_c WHERE prd_c.document_id = document.id)`,
} as const;

export function documentFilterConditions(filters: FilterState): SQL[] {
  const out: SQL[] = [];
  for (const [key, f] of Object.entries(filters)) {
    if (f.kind === "values") {
      if (key === "institution") {
        const c = oneOf(document.issuerPersonId, f.ids);
        if (c) out.push(c);
      }
    } else if (f.kind === "range") {
      const col = key === "pageCount" || key === "personCount" || key === "propertyCount" ? DOCUMENT_COUNT_SQL[key] : null;
      if (!col) continue;
      if (f.from !== null) out.push(sql`${col} >= ${f.from}`);
      if (f.to !== null) out.push(sql`${col} <= ${f.to}`);
    } else if (f.kind === "dates") {
      // „Adăugat la" is a day: the timestamp's date.
      const col = key === "dateDocument" ? sql`${document.dateDocument}` : key === "createdAt" ? sql`(${document.createdAt})::date` : null;
      if (!col) continue;
      if (f.from !== null) out.push(sql`${col} >= ${f.from}::date`);
      if (f.to !== null) out.push(sql`${col} <= ${f.to}::date`);
    }
  }
  return out;
}

/** The issuer checklist's facet query over `where` — the list's conditions with every other filter. */
export function documentFacetSql(field: string, where: SQL | undefined): SQL | null {
  if (field !== "institution") return null;
  return sql`
    SELECT ${document.issuerPersonId}::text AS id, ${person.displayName} AS label, count(DISTINCT ${document.id})::int AS n
    FROM ${document}
    LEFT JOIN ${person} ON ${person.id} = ${document.issuerPersonId}
    LEFT JOIN ${entityMetadata} ON ${entityMetadata.principalObjectId} = ${document.principalObjectId}
    ${where ? sql`WHERE ${where}` : sql``}
    GROUP BY 1, 2`;
}

/** The names of ticked issuers no document of the list holds just now. */
export function documentFacetNamesSql(field: string, ids: readonly string[]): SQL | null {
  if (field !== "institution" || ids.length === 0) return null;
  return sql`SELECT ${person.id}::text AS id, ${person.displayName} AS label FROM ${person}
    WHERE ${person.id} = ANY(ARRAY[${sql.join(ids.map((i) => sql`${i}`), sql`, `)}]::uuid[])`;
}
