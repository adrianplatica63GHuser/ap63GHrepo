/**
 * The two person lists' filter bars: the fields each takes, and the SQL each becomes.            (Slice #39.62)
 *
 * Rendered with `PgDialect`, no database in reach, as `property-list-filters.test.ts` does.
 */
import { PgDialect } from "drizzle-orm/pg-core";
import { and } from "drizzle-orm";
import {
  JUDICIAL_PERSON_COLUMN_FILTERS,
  JUDICIAL_PERSON_FILTER_FIELDS,
  NATURAL_PERSON_COLUMN_FILTERS,
  NATURAL_PERSON_FILTER_FIELDS,
  isPersonFacetField,
  parsePersonFilters,
  personFacetFields,
  personFilterFields,
} from "@/lib/persons/list-filters";
import { headOfficeLocality, personFacetSql, personFilterConditions } from "@/lib/persons/list-filter-sql";
import { NONE_VALUE, type FilterState } from "@/lib/list/filter-bar";
import type { PersonListKind } from "@/lib/persons/list-filters";

const U1 = "0f8fad5b-d9cb-469f-a165-70867728950e";
const dialect = new PgDialect();
const render = (kind: PersonListKind, f: FilterState) => dialect.sqlToQuery(and(...personFilterConditions(kind, f))!);

describe("the fields", () => {
  // Slice #39.82: Adrian's columns, in the chooser's order — was #39.62's named fields then every optional column.
  it("natural persons: Adrian's seven columns (#39.82), Locul nașterii a checklist", () => {
    expect(NATURAL_PERSON_FILTER_FIELDS.map((f) => `${f.key}:${f.kind}`)).toEqual([
      "dateOfBirth:dates", "age:range", "gender:values", "dateOfDeath:dates", "placeOfBirth:values", "professionalType:values", "relationship:values",
    ]);
    expect(personFacetFields("NATURAL")).toEqual(["gender", "placeOfBirth", "professionalType", "relationship"]);
  });
  it("juridical persons: Tip and Localitate (#39.82)", () => {
    expect(JUDICIAL_PERSON_FILTER_FIELDS.map((f) => `${f.key}:${f.kind}`)).toEqual(["judicialPersonType:values", "locality:values"]);
    expect(isPersonFacetField("JUDICIAL", "judicialPersonType")).toBe(true);
    expect(isPersonFacetField("JUDICIAL", "gender")).toBe(false);
  });
  // Adrian, 2026-10-18: „Please allow a natural person to be searched and found by CNP, but there should never be a
  // filter on CNP". The search box reads it (search-explanation.test.ts); no field, no funnel, no address key, no SQL.
  it("never a filter on CNP — on either list, by field, by column, by address or by SQL", () => {
    for (const kind of ["NATURAL", "JUDICIAL"] as const) {
      expect(personFilterFields(kind).map((f) => f.key.toLowerCase())).not.toContain("cnp");
      expect(parsePersonFilters(kind, new URLSearchParams("cnp=1960101123456"))).toEqual({});
      expect(personFilterConditions(kind, { cnp: { kind: "text", text: "1" }, CNP: { kind: "values", ids: ["1"] } })).toEqual([]);
    }
    expect(Object.keys(NATURAL_PERSON_COLUMN_FILTERS)).not.toContain("cnp");
    expect(Object.values(NATURAL_PERSON_COLUMN_FILTERS)).not.toContain("cnp");
  });

  it("each filter has its column, and only those columns show a funnel (#39.82)", () => {
    expect(NATURAL_PERSON_COLUMN_FILTERS).toEqual({
      dateOfBirth: "dateOfBirth", age: "age", gender: "gender", dateOfDeath: "dateOfDeath",
      placeOfBirth: "placeOfBirth", professionalType: "professionalType", relationships: "relationship",
    });
    expect(Object.values(NATURAL_PERSON_COLUMN_FILTERS)).toEqual(NATURAL_PERSON_FILTER_FIELDS.map((f) => f.key));
    expect(Object.values(JUDICIAL_PERSON_COLUMN_FILTERS)).toEqual(JUDICIAL_PERSON_FILTER_FIELDS.map((f) => f.key));
  });
});

describe("parsePersonFilters", () => {
  it("keeps uuids, genders and „(necompletat)”; drops the rest and the other list's keys", () => {
    const f = parsePersonFilters("NATURAL", new URLSearchParams(`professionalType=${U1},nope&gender=MALE,X,${NONE_VALUE}&judicialPersonType=${U1}`));
    expect(f).toEqual({
      professionalType: { kind: "values", ids: [U1] },
      gender: { kind: "values", ids: ["MALE", NONE_VALUE] },
    });
  });
  it("a retired key opens the list without it (#39.82's Ask first 4)", () => {
    expect(parsePersonFilters("NATURAL", new URLSearchParams(`deceased=deceased&cnp=1&documentRole=${U1}&locality=Bragadiru`))).toEqual({});
    expect(parsePersonFilters("JUDICIAL", new URLSearchParams("cuiNumber=1&tradeRegisterNumber=J&contactPerson=Pop"))).toEqual({});
  });
  it("„Locul nașterii” is a checklist of places, kept as typed (#39.82's Ask first 2)", () => {
    expect(parsePersonFilters("NATURAL", new URLSearchParams("placeOfBirth=Bucure%C8%99ti,Ploie%C8%99ti"))).toEqual({
      placeOfBirth: { kind: "values", ids: ["București", "Ploiești"] },
    });
  });
  it("dates are read as real calendar dates", () => {
    expect(parsePersonFilters("NATURAL", new URLSearchParams("dateOfBirth=1970-02-30..1980-01-01"))).toEqual({
      dateOfBirth: { kind: "dates", from: null, to: "1980-01-01" },
    });
  });
});

describe("the SQL", () => {
  it("„Localitate” on the juridical list is the HEADQUARTERS address — the column's own subquery (#39.82)", () => {
    const j = render("JUDICIAL", { locality: { kind: "values", ids: ["Bragadiru"] } });
    expect(j.sql).toContain("a_f.kind = $1");
    expect(j.params).toEqual(["HEADQUARTERS", "Bragadiru"]);
    expect(j.sql).toContain(dialect.sqlToQuery(headOfficeLocality()).sql);
    // The home locality left the natural persons' list with #39.82.
    expect(personFilterConditions("NATURAL", { locality: { kind: "values", ids: ["Bragadiru"] } })).toEqual([]);
  });
  it("„Locul nașterii” is IN the places, trimmed, OR empty with „(necompletat)”", () => {
    const q = render("NATURAL", { placeOfBirth: { kind: "values", ids: ["București", NONE_VALUE] } });
    expect(q.sql).toBe(`(nullif(trim("natural_person"."place_of_birth"), '') in ($1) or nullif(trim("natural_person"."place_of_birth"), '') IS NULL)`);
    expect(q.params).toEqual(["București"]);
    const facet = dialect.sqlToQuery(personFacetSql("NATURAL", "placeOfBirth", undefined)!);
    expect(facet.sql).toContain(`nullif(trim("natural_person"."place_of_birth"), '') AS id`);
  });
  it("„Vârstă” is the age the list shows: at death for the deceased, none for a deceased person with no date", () => {
    const q = render("NATURAL", { age: { kind: "range", from: 30, to: 50 } });
    expect(q.sql).toContain('age(coalesce("natural_person"."date_of_death", current_date), "natural_person"."date_of_birth")');
    expect(q.sql).toContain('AND "natural_person"."date_of_death" IS NULL THEN NULL');
    expect(q.params).toEqual([30, 50]);
  });
  it("dates compare as dates", () => {
    expect(render("NATURAL", { dateOfDeath: { kind: "dates", from: "2020-01-01", to: null } })).toMatchObject({
      sql: '"natural_person"."date_of_death" >= $1::date',
      params: ["2020-01-01"],
    });
  });
  it("a natural-person field on the juridical list adds nothing", () => {
    expect(personFilterConditions("JUDICIAL", { cnp: { kind: "text", text: "1" }, gender: { kind: "values", ids: ["MALE"] } })).toEqual([]);
    // Slice #39.82: the retired fields add nothing on either list.
    expect(personFilterConditions("NATURAL", { deceased: { kind: "choice", value: "deceased" }, documentRole: { kind: "values", ids: [U1] } })).toEqual([]);
    expect(personFilterConditions("JUDICIAL", { contactPerson: { kind: "text", text: "Pop" } })).toEqual([]);
  });
  it("„Relația cu firma” holds on any one ticked (Slice #39.70); „(necompletat)” on a person with none", () => {
    const q = render("NATURAL", { relationship: { kind: "values", ids: [U1, NONE_VALUE] } });
    expect(q.sql).toMatch(/^\(EXISTS \(/);
    expect(q.sql).toContain('npr_f.natural_person_id = "person"."id"');
    expect(q.sql).toContain("npr_f.relationship_id = ANY(ARRAY[$1]::uuid[])");
    expect(q.sql).toContain('NOT EXISTS (SELECT 1 FROM "natural_person_relationship" npr_n');
    expect(q.params).toEqual([U1]);
    expect(personFilterConditions("JUDICIAL", { relationship: { kind: "values", ids: [U1] } })).toEqual([]);
    const facet = dialect.sqlToQuery(personFacetSql("NATURAL", "relationship", undefined)!);
    expect(facet.sql).toContain('JOIN "lookup_person_relationship" r_fv');
    expect(facet.sql).toContain("UNION ALL");
  });
  it("a facet query keeps to its kind of person and counts persons, not links", () => {
    const q = dialect.sqlToQuery(personFacetSql("NATURAL", "relationship", undefined)!);
    expect(q.sql).toContain('"person"."type" = $1');
    expect(q.sql).toContain('count(DISTINCT "person"."id")');
    expect(q.sql).toContain("UNION ALL");
    expect(q.params[0]).toBe("NATURAL");
    expect(personFacetSql("JUDICIAL", "gender", undefined)).toBeNull();
    expect(personFacetSql("NATURAL", "documentRole", undefined)).toBeNull();
  });
});
