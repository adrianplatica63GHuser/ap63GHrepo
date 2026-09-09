/**
 * Filtering the documents list on a value inside `custom_fields`.
 *                                                              (Slice #34.10)
 *
 * WHY THIS SUITE EXISTS
 * ---------------------
 * D-01 is settled and the answer is no subtype level: CONTRACT_VANZARE gets ONE
 * union form plus one hand-written field carrying the flavour, with Adrian's
 * own five descriptions as its values. Half of that answer needed no code. The
 * other half did, and it was a real gap: nothing anywhere read `custom_fields`
 * for search or for filtering. `listDocument` searched three columns —
 * `document.code`, `document.title`, `document.nrDocument` — and the structured
 * filters were type, importance, relevance and expiry. So a flavour could be
 * captured on every document and never grouped by, and D-01's answer was
 * complete on paper only.
 *
 * ⚠️ **THIS RUNS THE SQL BUILDER RATHER THAN GREPPING FOR IT, AND THAT IS THE
 * POINT OF THE SUITE.** Every other filter in `listDocument` is an `eq()` or an
 * `inArray()` whose meaning drizzle carries. This one is hand-written SQL with
 * two operators and a cast, and every way it can be subtly wrong type-checks:
 *
 *   - `->` instead of `->>` returns `jsonb`, so the comparison is against
 *     `"Vânzare"` WITH the quotes and matches nothing, silently;
 *   - a missing `::text` leaves `jsonb ->> ?` ambiguous between its `text` and
 *     `integer` overloads, so a numeric-looking key becomes an array index;
 *   - one term instead of two turns "documents holding this value" into
 *     "documents that have this field", which is a different feature.
 *
 * None of those is visible to `tsc`, none to ESLint, and a source-text
 * assertion would pin the spelling rather than the meaning. `PgDialect` renders
 * a drizzle `SQL` chunk to its statement and its parameters with no database in
 * reach — the same purity argument `discover-log.ts` was validated under in
 * #21.10 — so the operator, the cast and the parameter ORDER are asserted as
 * facts.
 *
 * ⚠️ **WHAT THIS SUITE CANNOT DO, SAID PLAINLY.** It does not execute the
 * statement, so "returns the documents holding that value and no others" is
 * established here as a statement about the WHERE clause, not as a row count
 * off a live table. What makes that worth having anyway is where the clause
 * goes: `listDocument` builds ONE `where` with `and(...)` and hands the same
 * object to both the items query and the count query, so a predicate that is
 * right here is right for both, and a page of results cannot disagree with its
 * own total.
 */

import { PgDialect } from "drizzle-orm/pg-core";

import { customFieldFilter } from "@/lib/documents/queries";
import { documentListQuerySchema } from "@/lib/documents/validation";

const dialect = new PgDialect();

/** The rendered statement and its parameters, or `null` when there is no filter. */
function render(opts: { customFieldKey?: string; customFieldValue?: string }) {
  const chunk = customFieldFilter(opts);
  if (chunk === undefined) return null;
  const { sql, params } = dialect.sqlToQuery(chunk);
  return { sql, params };
}

const FLAVOUR = "tip_vanzare";
const TEREN = "Vânzare teren";

describe("the custom-field filter's SQL", () => {
  it("reads the key out of the jsonb column as TEXT, and compares it to the value", () => {
    const out = render({ customFieldKey: FLAVOUR, customFieldValue: TEREN });
    expect(out).not.toBeNull();

    // ⚠️ `->>` and not `->`. Asserted on the rendered statement, so a change
    // that reaches the same spelling by a different route still passes and a
    // change of operator cannot.
    expect(out!.sql).toContain('"custom_fields" ->> ');
    expect(out!.sql).not.toContain('"custom_fields" -> $');

    // ⚠️ The cast, on the KEY side. Without it Postgres picks between the
    // `text` and `integer` overloads of `->>` for an untyped parameter.
    expect(out!.sql).toContain("::text = ");

    // ⚠️ **Parameter ORDER, which is the assertion a spelling test cannot
    // make.** Key then value. Swapped, the statement still renders, still
    // type-checks, and asks whether the field named "Vânzare teren" holds the
    // value "tip_vanzare" — which is false for every row in the archive, so the
    // list is simply empty and nothing says why.
    expect(out!.params).toEqual([FLAVOUR, TEREN]);

    // Both values are bound, never interpolated. A key is whatever a person
    // typed into a template, and it reaches here off a query string.
    expect(out!.sql).not.toContain(FLAVOUR);
    expect(out!.sql).not.toContain(TEREN);
  });

  it("⚠️ is inert unless BOTH halves are present", () => {
    // The rule the schema, the fetch helper and `listDocument` all apply with
    // the same `&&`. A key alone would be "documents that HAVE this field" and
    // a value alone "any field holding this string" — two different features,
    // neither of which this is, and both of which would arrive by accident.
    expect(render({})).toBeNull();
    expect(render({ customFieldKey: FLAVOUR })).toBeNull();
    expect(render({ customFieldValue: TEREN })).toBeNull();
    expect(render({ customFieldKey: FLAVOUR, customFieldValue: "" })).toBeNull();
    expect(render({ customFieldKey: "", customFieldValue: TEREN })).toBeNull();
  });

  it("⚠️ treats an EMPTY value as no filter, not as 'the field is empty'", () => {
    // Chosen rather than inherited, and stated here because the alternative is
    // defensible and wrong. `customFieldsEqual` treats `null`, `""`, an absent
    // key and `undefined` as all equivalent, so "the value is empty" is not one
    // state in the data — a filter for it would have to pick one of the four
    // and be wrong for the other three, on rows written by two different
    // paths (the form blanks `""` to `null`; the AI extractor writes neither).
    //
    // So this filter answers exactly one question: which documents hold THIS
    // value. An empty half asks nothing, and the list is unfiltered rather than
    // narrowed to a set nobody can predict.
    expect(render({ customFieldKey: FLAVOUR, customFieldValue: "" })).toBeNull();
  });

  it("keeps a key with a digit in it a KEY", () => {
    // The case the `::text` cast exists for. Hand-written templates use
    // camelCase and the distillation engine mints snake_case slugs, so a key
    // like `art2` or `2024` is ordinary — and it is the one that turns into an
    // array subscript when the parameter's type is left to Postgres.
    const out = render({ customFieldKey: "2024", customFieldValue: TEREN });
    expect(out!.sql).toContain("::text = ");
    expect(out!.params).toEqual(["2024", TEREN]);
  });
});

describe("the query schema carries the filter to the builder", () => {
  it("accepts the pair and trims the key", () => {
    const parsed = documentListQuerySchema.safeParse({
      customFieldKey: `  ${FLAVOUR}  `,
      customFieldValue: TEREN,
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.customFieldKey).toBe(FLAVOUR);
    expect(parsed.success && parsed.data.customFieldValue).toBe(TEREN);
  });

  it("accepts a request with neither, which is every other visit to the list", () => {
    const parsed = documentListQuerySchema.safeParse({});
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.customFieldKey).toBeUndefined();
    expect(parsed.success && parsed.data.customFieldValue).toBeUndefined();
  });

  it("⚠️ refuses a key that is only whitespace, rather than storing one", () => {
    // `.trim().min(1)` — a blank key would sail through as a string, reach
    // `customFieldFilter`, and be dropped there by the falsy test. That is the
    // right end state by luck rather than by rule, and the rule belongs at the
    // door: a request naming no field is a malformed request, not an unfiltered
    // list that happens to look the same.
    expect(documentListQuerySchema.safeParse({ customFieldKey: "   " }).success).toBe(false);
  });

  it("bounds both, because neither is a uuid or an enum", () => {
    expect(documentListQuerySchema.safeParse({ customFieldKey: "k".repeat(65) }).success).toBe(false);
    expect(documentListQuerySchema.safeParse({ customFieldKey: "k".repeat(64) }).success).toBe(true);
    expect(documentListQuerySchema.safeParse({ customFieldValue: "v".repeat(501) }).success).toBe(false);
    expect(documentListQuerySchema.safeParse({ customFieldValue: "v".repeat(500) }).success).toBe(true);
  });
});
