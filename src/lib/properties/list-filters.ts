/**
 * The Properties list's filterable fields                                                         (Slice #39.61)
 *
 * Since Slice #39.82 the list filters by its columns, not from „+ Filtru" (Adrian, 2026-10-18: „its functionality
 * will be replaced by column filters for the columns that can be filtered"), and only the columns Adrian named
 * filter: Tarla/Solă, Tip proprietate, Categorie de folosință and Localitate as checklists (multiple choice); the
 * official and the calculated surface (m²) as from / to; Parcelă as „contains" — a parcel number is neither a value
 * list nor an interval (#39.82's Ask first 3). The order is the chooser's („Câmpuri afișate"), so the chips read as
 * the columns do. County, group, cadastral number and CF left the list with #39.82 (its Ask first 4): an old link
 * carrying one opens the list without it.
 *
 * ⚠️ **THE ROUTE READS ONLY THESE KEYS** (`parsePropertyFilters`): a key the list did not declare is not a filter,
 * and an id that is not a uuid is dropped before it reaches SQL — a hand-edited address filters nothing it should
 * not, and never errors.
 *
 * PURE — `property-list-filters.test.ts` covers it.
 */
import { NONE_VALUE, readFilterState, type FilterFieldDef, type FilterState, type FilterValue } from "@/lib/list/filter-bar";

export const PROPERTY_FILTER_FIELDS = [
  { key: "tarla",            kind: "values" },
  { key: "parcela",          kind: "text" },
  { key: "surfaceAreaMp",    kind: "range" },
  { key: "calculatedAreaMp", kind: "range" },
  { key: "useCategory",      kind: "values" },
  { key: "propertyType",     kind: "values" },
  { key: "locality",         kind: "values" },
] as const satisfies readonly FilterFieldDef[];

export type PropertyFilterKey = (typeof PROPERTY_FILTER_FIELDS)[number]["key"];
export const PROPERTY_FILTER_KEYS: readonly PropertyFilterKey[] = PROPERTY_FILTER_FIELDS.map((f) => f.key);

/**
 * Slice #39.82 — the column whose funnel opens each filter: the chooser's key (what a browser stores) to the
 * filter's. Every filter has its column, so every filter can be set; a column not named here shows no funnel.
 * „tarlaSola" is the column's stored key, the filter is `tarla` (#34.03).
 */
export const PROPERTY_COLUMN_FILTERS: Readonly<Record<string, PropertyFilterKey>> = {
  tarlaSola:        "tarla",
  parcela:          "parcela",
  surfaceAreaMp:    "surfaceAreaMp",
  calculatedAreaMp: "calculatedAreaMp",
  useCategory:      "useCategory",
  propertyType:     "propertyType",
  locality:         "locality",
};

/** The checklists, whose values come from `/api/properties/filter-values`. */
export type PropertyFacetField = Extract<(typeof PROPERTY_FILTER_FIELDS)[number], { kind: "values" }>["key"];
export const PROPERTY_FACET_FIELDS: readonly PropertyFacetField[] = PROPERTY_FILTER_FIELDS.filter(
  (f): f is Extract<(typeof PROPERTY_FILTER_FIELDS)[number], { kind: "values" }> => f.kind === "values",
).map((f) => f.key);

/** The checklists whose values are the text itself (an address's locality), not ids. */
const TEXT_FACET_FIELDS: readonly string[] = ["locality"];
export function isTextFacetField(key: PropertyFacetField): boolean {
  return TEXT_FACET_FIELDS.includes(key);
}

export function isPropertyFacetField(key: string): key is PropertyFacetField {
  return (PROPERTY_FACET_FIELDS as readonly string[]).includes(key);
}

/** The checklists whose values are ids of a value list — and so must be uuids, or „(necompletat)". */
const UUID_FIELDS: readonly string[] = ["propertyType", "useCategory", "tarla"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The Properties list's filters, read from the route's query (or the page's address), whitelisted. */
export function parsePropertyFilters(params: { get(key: string): string | null }): FilterState {
  const raw = readFilterState(params, PROPERTY_FILTER_FIELDS);
  const out: Record<string, FilterValue> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value.kind === "values" && UUID_FIELDS.includes(key)) {
      const ids = value.ids.filter((id) => id === NONE_VALUE || UUID.test(id));
      if (ids.length > 0) out[key] = { kind: "values", ids };
    } else {
      out[key] = value;
    }
  }
  return out;
}
