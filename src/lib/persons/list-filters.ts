/**
 * The two person lists' filterable fields                                                        (Slice #39.62)
 *
 * Adrian, 2026-10-16: „I wish we could have the same level of functionality and convenience for natural persons
 * and judicial persons". Both lists take the 39.61 bar. Since Slice #39.82 they filter by their columns, and only
 * the columns Adrian named (2026-10-18) filter:
 *   - Persoane fizice: Data nașterii, Vârstă, Gen, Data decesului, Locul nașterii, Tip profesional, Relația cu
 *     firma — the dates and the age as from / to, the rest as checklists (multiple choice). Locul nașterii is a
 *     checklist of the places in use, as a locality is (#39.82's Ask first 2; it was „contains");
 *   - Persoane juridice: Tip and Localitate (the HEADQUARTERS address), both checklists.
 * Rol în documente, Decedat, CNP and the home locality on natural persons, and Rol în documente, CUI, Nr. Registrul
 * Comerțului and Persoană de contact on juridical persons, left with #39.82 (its Ask first 4): an old link carrying
 * one opens the list without it. „Tip profesional" and „Tip" read their value lists live; „Relația cu firma"
 * (#39.70): a person holds several, and is shown by any one ticked; „(necompletat)" is a person with none.
 *
 * ⚠️ **THE ROUTES READ ONLY THESE KEYS**, and a value-list id that is not a uuid is dropped before SQL.
 *
 * PURE — `person-list-filters.test.ts` covers it.
 */
import { NONE_VALUE, readFilterState, type FilterFieldDef, type FilterState, type FilterValue } from "@/lib/list/filter-bar";

export const GENDER_VALUES = ["MALE", "FEMALE"] as const;

export const NATURAL_PERSON_FILTER_FIELDS = [
  { key: "dateOfBirth",      kind: "dates" },
  { key: "age",              kind: "range" },
  { key: "gender",           kind: "values" },
  { key: "dateOfDeath",      kind: "dates" },
  { key: "placeOfBirth",     kind: "values" }, // Slice #39.82: a checklist, as a locality
  { key: "professionalType", kind: "values" },
  { key: "relationship",     kind: "values" }, // Slice #39.70
] as const satisfies readonly FilterFieldDef[];

export const JUDICIAL_PERSON_FILTER_FIELDS = [
  { key: "judicialPersonType", kind: "values" },
  { key: "locality",           kind: "values" }, // the HEADQUARTERS address; its column since #39.82
] as const satisfies readonly FilterFieldDef[];

/**
 * Slice #39.82 — the column whose funnel opens each filter: the chooser's key (what a browser stores) to the
 * filter's. Every filter has its column; a column not named here shows no funnel. „relationships" is the column's
 * stored key (#39.70), the filter is `relationship`.
 */
export const NATURAL_PERSON_COLUMN_FILTERS: Readonly<Record<string, string>> = {
  dateOfBirth:      "dateOfBirth",
  age:              "age",
  gender:           "gender",
  dateOfDeath:      "dateOfDeath",
  placeOfBirth:     "placeOfBirth",
  professionalType: "professionalType",
  relationships:    "relationship",
};
export const JUDICIAL_PERSON_COLUMN_FILTERS: Readonly<Record<string, string>> = {
  judicialPersonType: "judicialPersonType",
  locality:           "locality",
};

export type PersonListKind = "NATURAL" | "JUDICIAL";

export function personFilterFields(kind: PersonListKind): readonly FilterFieldDef[] {
  return kind === "NATURAL" ? NATURAL_PERSON_FILTER_FIELDS : JUDICIAL_PERSON_FILTER_FIELDS;
}
export function personFilterKeys(kind: PersonListKind): string[] {
  return personFilterFields(kind).map((f) => f.key);
}

/** The checklists of a list, whose values come from its `filter-values` route. */
export function personFacetFields(kind: PersonListKind): string[] {
  return personFilterFields(kind).filter((f) => f.kind === "values").map((f) => f.key);
}
export function isPersonFacetField(kind: PersonListKind, key: string): boolean {
  return personFacetFields(kind).includes(key);
}

const UUID_FIELDS: readonly string[] = ["professionalType", "relationship", "judicialPersonType"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENDERS: readonly string[] = GENDER_VALUES;

/** A list's filters, read from its route's query (or the page's address), whitelisted. */
export function parsePersonFilters(kind: PersonListKind, params: { get(key: string): string | null }): FilterState {
  const raw = readFilterState(params, personFilterFields(kind));
  const out: Record<string, FilterValue> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value.kind === "values" && (UUID_FIELDS.includes(key) || key === "gender")) {
      const ok = (id: string) => id === NONE_VALUE || (key === "gender" ? GENDERS.includes(id) : UUID.test(id));
      const ids = value.ids.filter(ok);
      if (ids.length > 0) out[key] = { kind: "values", ids };
    } else {
      out[key] = value;
    }
  }
  return out;
}
