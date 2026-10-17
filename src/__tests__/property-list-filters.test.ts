/**
 * The Properties list's filter bar: the fields it takes, and the SQL each becomes.               (Slice #39.61)
 *
 * The route reads only the declared keys and drops an id that is not a uuid before it reaches SQL. The conditions
 * are rendered with `PgDialect`, with no database in reach, as `document-custom-field-filter.test.ts` does: what is
 * asserted is the WHERE clause and its parameters, not a row count off a live table.
 */
import { PgDialect } from "drizzle-orm/pg-core";
import { and } from "drizzle-orm";
import { PROPERTY_FACET_FIELDS, PROPERTY_FILTER_KEYS, isPropertyFacetField, parsePropertyFilters } from "@/lib/properties/list-filters";
import { propertyFilterConditions } from "@/lib/properties/list-filter-sql";
import { NONE_VALUE, type FilterState } from "@/lib/list/filter-bar";

const U1 = "0f8fad5b-d9cb-469f-a165-70867728950e";
const U2 = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const dialect = new PgDialect();
const render = (f: FilterState) => dialect.sqlToQuery(and(...propertyFilterConditions(f))!);

describe("the fields", () => {
  it("are #39.61's: six checklists, two from / to, three „contains”, in the bar's order", () => {
    expect(PROPERTY_FILTER_KEYS).toEqual([
      "propertyType", "useCategory", "tarla", "locality", "county", "group",
      "surfaceAreaMp", "calculatedAreaMp", "cadastralNumber", "carteFunciara", "parcela",
    ]);
    expect(PROPERTY_FACET_FIELDS).toEqual(["propertyType", "useCategory", "tarla", "locality", "county", "group"]);
    expect(isPropertyFacetField("group")).toBe(true);
    expect(isPropertyFacetField("parcela")).toBe(false);
    expect(isPropertyFacetField("__proto__")).toBe(false);
  });
});

describe("parsePropertyFilters", () => {
  it("keeps a value list's uuids and „(necompletat)”, and drops anything else", () => {
    const f = parsePropertyFilters(new URLSearchParams(`propertyType=${U1},xyz,${NONE_VALUE}&tarla=1;drop table&other=1`));
    expect(f).toEqual({ propertyType: { kind: "values", ids: [U1, NONE_VALUE] } });
  });
  it("keeps text values as typed — a locality, a group code", () => {
    const f = parsePropertyFilters(new URLSearchParams("locality=Bragadiru,M%C4%83gurele&group=AA"));
    expect(f).toEqual({ locality: { kind: "values", ids: ["Bragadiru", "Măgurele"] }, group: { kind: "values", ids: ["AA"] } });
  });
});

describe("the SQL", () => {
  it("a checklist is IN its values, OR empty with „(necompletat)”", () => {
    const q = render({ propertyType: { kind: "values", ids: [U1, U2, NONE_VALUE] } });
    expect(q.sql).toBe('("property"."property_type_id" in ($1, $2) or "property"."property_type_id" IS NULL)');
    expect(q.params).toEqual([U1, U2]);
  });
  it("a locality is compared trimmed, and empty text counts as „(necompletat)”", () => {
    const q = render({ locality: { kind: "values", ids: [NONE_VALUE] } });
    expect(q.sql).toBe(`nullif(trim("property_address"."locality"), '') IS NULL`);
  });
  it("a group is EXISTS a PROPERTY group with that code, and „(necompletat)” NOT EXISTS any", () => {
    const q = render({ group: { kind: "values", ids: ["AA", NONE_VALUE] } });
    expect(q.sql).toMatch(/^\(EXISTS \(/);
    expect(q.sql).toContain("g_fb.code = ANY(ARRAY[$1]::text[])");
    expect(q.sql).toContain("NOT EXISTS (");
    expect(q.sql.match(/target_type = 'PROPERTY'/g)).toHaveLength(2);
    expect(q.params).toEqual(["AA"]);
  });
  it("a from / to is >= and <=, either alone", () => {
    expect(render({ surfaceAreaMp: { kind: "range", from: 100, to: 500 } })).toMatchObject({
      sql: '("property"."surface_area_mp" >= $1 and "property"."surface_area_mp" <= $2)',
      params: [100, 500],
    });
    expect(render({ calculatedAreaMp: { kind: "range", from: null, to: 9 } }).sql).toBe('"property"."calculated_area_mp" <= $1');
  });
  it("„contains” is ILIKE, with %, _ and \\ escaped so they match themselves", () => {
    const q = render({ cadastralNumber: { kind: "text", text: "12%_\\3" } });
    expect(q.sql).toBe('"property"."cadastral_number" ilike $1');
    expect(q.params).toEqual(["%12\\%\\_\\\\3%"]);
  });
  it("fields AND together; a key the list does not have adds nothing", () => {
    const q = render({
      useCategory: { kind: "values", ids: [U1] },
      parcela: { kind: "text", text: "7" },
      nope: { kind: "text", text: "x" },
    } as FilterState);
    expect(q.sql).toBe('("property"."use_category_id" in ($1) and "property"."parcela" ilike $2)');
  });
});
