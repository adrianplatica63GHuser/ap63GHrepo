/**
 * The Documents list on the shared filter bar: the fields it adds, and the SQL each becomes.     (Slice #39.63)
 *
 * „Tip document", „Câmp specific" and „Expiră curând" keep their own parameters (`documentTypeIds`,
 * `customFieldKey`/`customFieldValue`, `expiringSoon`) — `document-custom-field-filter.test.ts` and
 * `document-type-filter.test.tsx` hold those. Rendered with `PgDialect`, no database in reach.
 */
import { PgDialect } from "drizzle-orm/pg-core";
import { and } from "drizzle-orm";
import { DOCUMENT_FILTER_FIELDS, isDocumentFacetField, parseDocumentFilters } from "@/lib/documents/list-filters";
import { DOCUMENT_COUNT_SQL, documentFacetSql, documentFilterConditions } from "@/lib/documents/list-filter-sql";
import { NONE_VALUE, type FilterState } from "@/lib/list/filter-bar";

const U1 = "0f8fad5b-d9cb-469f-a165-70867728950e";
const dialect = new PgDialect();
const render = (f: FilterState) => dialect.sqlToQuery(and(...documentFilterConditions(f))!);

describe("the fields", () => {
  it("every optional column, the institution a checklist", () => {
    expect(DOCUMENT_FILTER_FIELDS.map((f) => `${f.key}:${f.kind}`)).toEqual([
      "institution:values", "dateDocument:dates", "pageCount:range", "personCount:range", "propertyCount:range",
      "createdAt:dates", "nrDocument:text", "subject:text",
    ]);
    expect(isDocumentFacetField("institution")).toBe(true);
    expect(isDocumentFacetField("subject")).toBe(false);
  });
  it("the bar's keys are not the list's own, so links made before #39.63 read as they did", () => {
    const keys = DOCUMENT_FILTER_FIELDS.map((f) => f.key as string);
    for (const own of ["documentTypeIds", "expiring", "field", "value", "q", "page", "row", "tiles"]) expect(keys).not.toContain(own);
  });
  it("an institution id that is not a uuid is dropped", () => {
    expect(parseDocumentFilters(new URLSearchParams(`institution=${U1},x;y,${NONE_VALUE}&documentTypeIds=${U1}`))).toEqual({
      institution: { kind: "values", ids: [U1, NONE_VALUE] },
    });
  });
});

describe("the SQL", () => {
  it("the institution is IN its ids, OR empty with „(necompletat)”", () => {
    expect(render({ institution: { kind: "values", ids: [U1, NONE_VALUE] } })).toMatchObject({
      sql: '("document"."institution_id" in ($1) or "document"."institution_id" IS NULL)',
      params: [U1],
    });
  });
  it("the counts filter on the list's own count columns", () => {
    const q = render({ personCount: { kind: "range", from: 2, to: null } });
    expect(q.sql).toBe(`${dialect.sqlToQuery(DOCUMENT_COUNT_SQL.personCount).sql} >= $1`);
    expect(q.sql).toContain("count(DISTINCT pd_c.person_id)");
    expect(q.params).toEqual([2]);
  });
  it("„Adăugat la” compares the day the document was created", () => {
    expect(render({ createdAt: { kind: "dates", from: "2026-01-01", to: "2026-12-31" } })).toMatchObject({
      sql: '(("document"."created_at")::date >= $1::date and ("document"."created_at")::date <= $2::date)',
      params: ["2026-01-01", "2026-12-31"],
    });
  });
  it("the document's date and „contains” on its number and subject", () => {
    const q = render({ dateDocument: { kind: "dates", from: null, to: "2020-01-01" }, nrDocument: { kind: "text", text: "12" }, subject: { kind: "text", text: "vânz" } });
    expect(q.sql).toBe('("document"."date_document" <= $1::date and "document"."nr_document" ilike $2 and "document"."subject" ilike $3)');
    expect(q.params).toEqual(["2020-01-01", "%12%", "%vânz%"]);
  });
  it("the facet query counts documents per institution over the list's where", () => {
    const q = dialect.sqlToQuery(documentFacetSql("institution", undefined)!);
    expect(q.sql).toContain('count(DISTINCT "document"."id")');
    expect(q.sql).toContain("GROUP BY 1, 2");
    expect(documentFacetSql("subject", undefined)).toBeNull();
  });
});
