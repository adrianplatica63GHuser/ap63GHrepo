/**
 * The Properties list's filterable fields                                                         (Slice #39.61)
 *
 * Every field the list shows or the property is found by, as #39.61's header names them: type, use category,
 * tarla, locality, county and group as checklists; the official and the calculated surface (m²) as from / to; the
 * cadastral number, the carte funciară and the parcel as „contains". The order is the bar's „+ Filtru" order.
 *
 * ⚠️ **THE ROUTE READS ONLY THESE KEYS** (`parsePropertyFilters`): a key the list did not declare is not a filter,
 * and an id that is not a uuid is dropped before it reaches SQL — a hand-edited address filters nothing it should
 * not, and never errors.
 *
 * PURE — `property-list-filters.test.ts` covers it.
 */
import { NONE_VALUE, readFilterState, type FilterFieldDef, type FilterState, type FilterValue } from "@/lib/list/filter-bar";

export const PROPERTY_FILTER_FIELDS = [
  { key: "propertyType",     kind: "values" },
  { key: "useCategory",      kind: "values" },
  { key: "tarla",            kind: "values" },
  { key: "locality",         kind: "values" },
  { key: "county",           kind: "values" },
  { key: "group",            kind: "values" },
  { key: "surfaceAreaMp",    kind: "range" },
  { key: "calculatedAreaMp", kind: "range" },
  { key: "cadastralNumber",  kind: "text" },
  { key: "carteFunciara",    kind: "text" },
  { key: "parcela",          kind: "text" },
] as const satisfies readonly FilterFieldDef[];

export type PropertyFilterKey = (typeof PROPERTY_FILTER_FIELDS)[number]["key"];
export const PROPERTY_FILTER_KEYS: readonly PropertyFilterKey[] = PROPERTY_FILTER_FIELDS.map((f) => f.key);

/** The checklists, whose values come from `/api/properties/filter-values`. */
export type PropertyFacetField = Extract<(typeof PROPERTY_FILTER_FIELDS)[number], { kind: "values" }>["key"];
export const PROPERTY_FACET_FIELDS: readonly PropertyFacetField[] = PROPERTY_FILTER_FIELDS.filter(
  (f): f is Extract<(typeof PROPERTY_FILTER_FIELDS)[number], { kind: "values" }> => f.kind === "values",
).map((f) => f.key);

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
