/**
 * The two person lists' filter bars: the fields each takes, and the SQL each becomes.            (Slice #39.62)
 *
 * Rendered with `PgDialect`, no database in reach, as `property-list-filters.test.ts` does.
 */
import { PgDialect } from "drizzle-orm/pg-core";
import { and } from "drizzle-orm";
import {
  JUDICIAL_PERSON_FILTER_FIELDS,
  NATURAL_PERSON_FILTER_FIELDS,
  isPersonFacetField,
  parsePersonFilters,
  personFacetFields,
} from "@/lib/persons/list-filters";
import { personFacetSql, personFilterConditions } from "@/lib/persons/list-filter-sql";
import { NONE_VALUE, type FilterState } from "@/lib/list/filter-bar";
import type { PersonListKind } from "@/lib/persons/list-filters";

const U1 = "0f8fad5b-d9cb-469f-a165-70867728950e";
const dialect = new PgDialect();
const render = (kind: PersonListKind, f: FilterState) => dialect.sqlToQuery(and(...personFilterConditions(kind, f))!);

describe("the fields", () => {
  // Slice #39.70: „Relația cu firma" after „Tip profesional" — was the four named, without `relationship`.
  it("natural persons: the five named, then every optional column", () => {
    expect(NATURAL_PERSON_FILTER_FIELDS.map((f) => f.key)).toEqual([
      "professionalType", "relationship", "documentRole", "locality", "deceased", "gender", "age", "dateOfBirth", "dateOfDeath", "cnp", "placeOfBirth",
    ]);
    expect(personFacetFields("NATURAL")).toEqual(["professionalType", "relationship", "documentRole", "locality", "gender"]);
  });
  it("juridical persons: the three named, then every optional column", () => {
    expect(JUDICIAL_PERSON_FILTER_FIELDS.map((f) => f.key)).toEqual([
      "judicialPersonType", "documentRole", "locality", "cuiNumber", "tradeRegisterNumber", "contactPerson",
    ]);
    expect(isPersonFacetField("JUDICIAL", "judicialPersonType")).toBe(true);
    expect(isPersonFacetField("JUDICIAL", "gender")).toBe(false);
  });
});

describe("parsePersonFilters", () => {
  it("keeps uuids, genders and „(necompletat)”; drops the rest and the other list's keys", () => {
    const f = parsePersonFilters("NATURAL", new URLSearchParams(`professionalType=${U1},nope&gender=MALE,X,${NONE_VALUE}&judicialPersonType=${U1}&deceased=deceased`));
    expect(f).toEqual({
      professionalType: { kind: "values", ids: [U1] },
      gender: { kind: "values", ids: ["MALE", NONE_VALUE] },
      deceased: { kind: "choice", value: "deceased" },
    });
  });
  it("„Decedat” takes only alive or deceased; anything else is „toți”", () => {
    expect(parsePersonFilters("NATURAL", new URLSearchParams("deceased=maybe"))).toEqual({});
  });
  it("dates are read as real calendar dates", () => {
    expect(parsePersonFilters("NATURAL", new URLSearchParams("dateOfBirth=1970-02-30..1980-01-01"))).toEqual({
      dateOfBirth: { kind: "dates", from: null, to: "1980-01-01" },
    });
  });
});

describe("the SQL", () => {
  it("„Rol în documente” holds on at least one document (Ask first 1); „(necompletat)” on none", () => {
    const q = render("NATURAL", { documentRole: { kind: "values", ids: [U1, NONE_VALUE] } });
    expect(q.sql).toMatch(/^\(EXISTS \(/);
    expect(q.sql).toContain('pd_f.person_id = "person"."id"');
    expect(q.sql).toContain("pd_f.person_role_id = ANY(ARRAY[$1]::uuid[])");
    expect(q.sql).toContain("pd_n.person_role_id IS NOT NULL");
    expect(q.params).toEqual([U1]);
  });
  it("„Localitate” is the HOME address for a natural person, the HEADQUARTERS for a juridical one (Ask first 3)", () => {
    const n = render("NATURAL", { locality: { kind: "values", ids: ["Bragadiru"] } });
    expect(n.sql).toContain("a_f.kind = $1");
    expect(n.params).toEqual(["HOME", "Bragadiru"]);
    const j = render("JUDICIAL", { locality: { kind: "values", ids: ["Bragadiru"] } });
    expect(j.params).toEqual(["HEADQUARTERS", "Bragadiru"]);
  });
  it("„Decedat” is the flag, a missing flag counted as alive (Ask first 2)", () => {
    expect(render("NATURAL", { deceased: { kind: "choice", value: "deceased" } })).toMatchObject({
      sql: 'coalesce("natural_person"."is_deceased", false) = $1',
      params: [true],
    });
    expect(render("NATURAL", { deceased: { kind: "choice", value: "alive" } }).params).toEqual([false]);
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
  it("„Persoană de contact” is either contact whose name contains the text", () => {
    const q = render("JUDICIAL", { contactPerson: { kind: "text", text: "Pop" } });
    expect(q.sql).toContain('c_f.id IN ("judicial_person"."contact_person_1_id", "judicial_person"."contact_person_2_id")');
    expect(q.params).toEqual(["%Pop%"]);
  });
  it("a natural-person field on the juridical list adds nothing", () => {
    expect(personFilterConditions("JUDICIAL", { cnp: { kind: "text", text: "1" }, gender: { kind: "values", ids: ["MALE"] } })).toEqual([]);
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
    const q = dialect.sqlToQuery(personFacetSql("NATURAL", "documentRole", undefined)!);
    expect(q.sql).toContain('"person"."type" = $1');
    expect(q.sql).toContain('count(DISTINCT "person"."id")');
    expect(q.sql).toContain("UNION ALL");
    expect(q.params[0]).toBe("NATURAL");
    expect(personFacetSql("JUDICIAL", "gender", undefined)).toBeNull();
  });
});
