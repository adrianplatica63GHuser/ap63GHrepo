/**
 * The Documents list's filterable fields on the shared bar                                       (Slice #39.63)
 *
 * „Tip document" and „Câmp specific" keep their own controls and their address keys (`documentTypeIds`, `field`,
 * `value`), as do „Expiră curând" (`expiring`) — links made before this slice open the same list. Since Slice #39.82
 * the list filters by its columns, and only the columns Adrian named filter (2026-10-18): the issuing institution
 * as a checklist (multiple choice); the document's date, the day it was added and the counts of pages, persons and
 * properties as from / to. The number and the subject left with #39.82 (its Ask first 4): an old link carrying one
 * opens the list without it.
 *
 * ⚠️ **THE ROUTE READS ONLY THESE KEYS**, and an institution id that is not a uuid is dropped before SQL.
 *
 * PURE — `document-list-filters.test.ts` covers it.
 */
import { NONE_VALUE, readFilterState, type FilterFieldDef, type FilterState, type FilterValue } from "@/lib/list/filter-bar";

export const DOCUMENT_FILTER_FIELDS = [
  { key: "institution",   kind: "values" },
  { key: "dateDocument",  kind: "dates" },
  { key: "pageCount",     kind: "range" },
  { key: "personCount",   kind: "range" },
  { key: "propertyCount", kind: "range" },
  { key: "createdAt",     kind: "dates" },
] as const satisfies readonly FilterFieldDef[];

export const DOCUMENT_FILTER_KEYS: readonly string[] = DOCUMENT_FILTER_FIELDS.map((f) => f.key);

/**
 * Slice #39.82 — the column whose funnel opens each filter: the chooser's key to the filter's (the same, on this
 * list). Every filter has its column; „Nr. document" and „Subiect" show no funnel.
 */
export const DOCUMENT_COLUMN_FILTERS: Readonly<Record<string, string>> = {
  dateDocument:  "dateDocument",
  institution:   "institution",
  pageCount:     "pageCount",
  personCount:   "personCount",
  propertyCount: "propertyCount",
  createdAt:     "createdAt",
};

/** The checklists, whose values come from `/api/documents/filter-values`. */
export function isDocumentFacetField(key: string): boolean {
  return DOCUMENT_FILTER_FIELDS.some((f) => f.key === key && f.kind === "values");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The list's bar filters, read from its route's query (or the page's address), whitelisted. */
export function parseDocumentFilters(params: { get(key: string): string | null }): FilterState {
  const raw = readFilterState(params, DOCUMENT_FILTER_FIELDS);
  const out: Record<string, FilterValue> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value.kind === "values") {
      const ids = value.ids.filter((id) => id === NONE_VALUE || UUID.test(id));
      if (ids.length > 0) out[key] = { kind: "values", ids };
    } else {
      out[key] = value;
    }
  }
  return out;
}
