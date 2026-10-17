/**
 * The person lists' checklists: each value with how many persons of the list hold it      (Slice #39.62)
 *
 * Counted over the list with its search and every OTHER filter applied, as on Proprietăți (#39.61's Ask first 3).
 * A ticked value no person holds any more comes back named, with 0, so it can still be unticked. The SQL is
 * `./list-filter-sql`'s; this runs it.
 */
import { and } from "drizzle-orm";
import { db } from "@/db";
import { NONE_VALUE, withoutFilter, type FacetValue, type FilterState } from "@/lib/list/filter-bar";
import { facetValues } from "@/lib/list/filter-sql";
import { naturalPersonSearchCondition } from "@/lib/persons/queries";
import { judicialPersonSearchCondition } from "@/lib/judicial-persons/queries";
import { personFacetNamesSql, personFacetSql, personFilterConditions } from "./list-filter-sql";
import type { PersonListKind } from "./list-filters";

export async function listPersonFilterValues(
  kind: PersonListKind,
  field: string,
  opts: { q?: string; filters?: FilterState },
): Promise<FacetValue[]> {
  const search = kind === "NATURAL" ? naturalPersonSearchCondition(opts.q) : judicialPersonSearchCondition(opts.q);
  const where = and(search, ...personFilterConditions(kind, withoutFilter(opts.filters ?? {}, field)));
  const query = personFacetSql(kind, field, where);
  if (!query) return [];
  const res = await db.execute<{ id: string | null; label: string | null; n: number }>(query);
  const held = facetValues(res.rows);
  const own = opts.filters?.[field];
  const missing = own?.kind === "values" ? own.ids.filter((id) => id !== NONE_VALUE && !held.some((h) => h.id === id)) : [];
  if (missing.length === 0) return held;
  const namesQuery = personFacetNamesSql(kind, field, missing);
  const names = new Map<string, string>();
  if (namesQuery) {
    const r = await db.execute<{ id: string; label: string }>(namesQuery);
    for (const row of r.rows) names.set(row.id, row.label);
  }
  return [...held, ...missing.map((id) => ({ id, label: names.get(id) ?? id, count: 0 }))];
}
