/**
 * The Documents list's institution checklist: each institution with how many documents of the list it issued.
 *                                                                                                (Slice #39.63)
 * Counted over the list as it stands — type, „Expiră curând", „Câmp specific", search — and every OTHER bar filter.
 */
import { db } from "@/db";
import { NONE_VALUE, withoutFilter, type FacetValue, type FilterState } from "@/lib/list/filter-bar";
import { facetValues } from "@/lib/list/filter-sql";
import type { DocumentListQuery } from "@/lib/documents/validation";
import { documentListWhere } from "@/lib/documents/queries";
import { documentFacetNamesSql, documentFacetSql } from "./list-filter-sql";

export async function listDocumentFilterValues(
  field: string,
  opts: DocumentListQuery & { filters?: FilterState },
  expiringSoonDays: number,
): Promise<FacetValue[]> {
  if (opts.documentTypeIds !== undefined && opts.documentTypeIds.length === 0) return [];
  const where = documentListWhere({ ...opts, filters: withoutFilter(opts.filters ?? {}, field) }, expiringSoonDays);
  const query = documentFacetSql(field, where);
  if (!query) return [];
  const held = facetValues((await db.execute<{ id: string | null; label: string | null; n: number }>(query)).rows);
  const own = opts.filters?.[field];
  const missing = own?.kind === "values" ? own.ids.filter((id) => id !== NONE_VALUE && !held.some((h) => h.id === id)) : [];
  const namesQuery = documentFacetNamesSql(field, missing);
  if (!namesQuery) return held;
  const names = new Map((await db.execute<{ id: string; label: string }>(namesQuery)).rows.map((r) => [r.id, r.label]));
  return [...held, ...missing.map((id) => ({ id, label: names.get(id) ?? id, count: 0 }))];
}
