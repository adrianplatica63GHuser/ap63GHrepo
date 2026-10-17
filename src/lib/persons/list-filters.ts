/**
 * The two person lists' filterable fields                                                        (Slice #39.62)
 *
 * Adrian, 2026-10-16: „I wish we could have the same level of functionality and convenience for natural persons
 * and judicial persons". Both lists take the 39.61 bar, with their named fields and every optional column:
 *   - Persoane fizice: Tip profesional, Rol în documente, Localitate (the HOME address), Decedat (toți / în viață /
 *     decedați), Gen, Vârstă, Data nașterii, Data decesului, CNP, Locul nașterii;
 *   - Persoane juridice: Tip, Rol în documente, Localitate (the HEADQUARTERS address), CUI, Nr. Registrul
 *     Comerțului, Persoană de contact.
 * „Tip profesional" and „Tip" read their value lists live, so 39.70's professions and 39.71's public-body types
 * reach the filters with no change here. Slice #39.70 adds „Relația cu firma" to the natural persons' bar, after
 * „Tip profesional": a person holds several, and is shown by any one ticked; „(necompletat)" is a person with none.
 *
 * ⚠️ **THE ROUTES READ ONLY THESE KEYS**, and a value-list id that is not a uuid is dropped before SQL.
 *
 * PURE — `person-list-filters.test.ts` covers it.
 */
import { NONE_VALUE, readFilterState, type FilterFieldDef, type FilterState, type FilterValue } from "@/lib/list/filter-bar";

export const DECEASED_OPTIONS = ["alive", "deceased"] as const;
export const GENDER_VALUES = ["MALE", "FEMALE"] as const;

export const NATURAL_PERSON_FILTER_FIELDS = [
  { key: "professionalType", kind: "values" },
  { key: "relationship",     kind: "values" }, // Slice #39.70
  { key: "documentRole",     kind: "values" },
  { key: "locality",         kind: "values" },
  { key: "deceased",         kind: "choice", options: DECEASED_OPTIONS },
  { key: "gender",           kind: "values" },
  { key: "age",              kind: "range" },
  { key: "dateOfBirth",      kind: "dates" },
  { key: "dateOfDeath",      kind: "dates" },
  { key: "cnp",              kind: "text" },
  { key: "placeOfBirth",     kind: "text" },
] as const satisfies readonly FilterFieldDef[];

export const JUDICIAL_PERSON_FILTER_FIELDS = [
  { key: "judicialPersonType",  kind: "values" },
  { key: "documentRole",        kind: "values" },
  { key: "locality",            kind: "values" },
  { key: "cuiNumber",           kind: "text" },
  { key: "tradeRegisterNumber", kind: "text" },
  { key: "contactPerson",       kind: "text" },
] as const satisfies readonly FilterFieldDef[];

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

const UUID_FIELDS: readonly string[] = ["professionalType", "relationship", "judicialPersonType", "documentRole"];
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
