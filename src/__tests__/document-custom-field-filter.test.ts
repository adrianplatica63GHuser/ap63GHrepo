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

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PgDialect, QueryBuilder } from "drizzle-orm/pg-core";
import { and, count, inArray, sql } from "drizzle-orm";

import { document } from "@/db/schema";

import { customFieldFilter } from "@/lib/documents/custom-field-filter";
import { documentListQuerySchema } from "@/lib/documents/validation";
// ⚠️ **`@/lib/dev/strip-comments`, NOT a local two-regex copy — and Slice
// #34.10's first draft wrote the copy, in three files at once.** That module
// exists because #34.06's own review deleted exactly this shape from
// `upload-file-types.test.ts`: a regex stripper is provably wrong on `//`
// inside a string or a regex literal (`accept="image/*"`,
// `p.replace(/https?:\/\//, "")`), and OVER-stripping turns a NEGATIVE
// assertion green — a false pass, which is the worst direction for a guard.
// Measured by an adversarial round on this slice: the regex and the lexer
// disagree on 105 of 566 files under `src/`, by up to 8,817 characters.
import { stripComments } from "@/lib/dev/strip-comments";

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

// ---------------------------------------------------------------------------
// The filter is actually WIRED IN
// ---------------------------------------------------------------------------

const QUERIES = join("src", "lib", "documents", "queries.ts");
const FILTER_MODULE = join("src", "lib", "documents", "custom-field-filter.ts");
const LIST_VIEW = join("src", "app", "documents", "list-view.tsx");
const VALUES_ROUTE = join("src", "app", "api", "documents", "custom-field-values", "route.ts");

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

describe("⚠️ the filter reaches the query the list actually runs", () => {
  it("is a term in `listDocument`'s shared `where`", () => {
    // ⚠️ **AN ADVERSARIAL ROUND ADDED THIS, AND THE GAP IT FOUND IS THE ONE
    // THIS WHOLE SUITE IS MOST EXPOSED TO.** Everything above tests
    // `customFieldFilter` in isolation. The reviewer replaced the call to it
    // inside `listDocument` with `undefined` — unwiring the entire feature —
    // and every test above stayed green. A unit suite for a predicate proves
    // the predicate; it says nothing about whether anything asks it.
    //
    // This is also what makes this suite's own header honest. That header
    // justifies not executing the statement on the grounds that `listDocument`
    // builds ONE `where` and hands it to both the items query and the count
    // query — a claim it was making and not checking.
    const code = stripComments(read(QUERIES));
    expect(code).toContain("customFieldFilter(opts)");
    // ⚠️ **And the predicate stays OUT of `queries.ts`.** It moved to its own
    // pure module after `npx jest` found what living beside `db` costs: this
    // suite loaded `@/db` → `pg` → `TextEncoder`, which jsdom does not define,
    // and died before its first assertion. A sandbox harness that had stubbed
    // `@/db` reported it green, which is exactly how the gap survived to a full
    // run. Importing it back here would restore that.
    expect(stripComments(read(FILTER_MODULE))).toContain("export function customFieldFilter(");
    expect(code).not.toContain("export function customFieldFilter(");

    // …inside `listDocument`, not merely somewhere in the file. `const where =`
    // is the object both queries below it are given.
    const whereStart = code.indexOf("const where = and(");
    expect(whereStart).toBeGreaterThan(0);
    const whereBlock = code.slice(whereStart, code.indexOf("\n  );", whereStart));
    expect(whereBlock).toContain("customFieldFilter(opts)");

    // …and that one object really is what both queries use. Two `.where(where)`
    // calls: the page of items, and the total. A filter applied to one and not
    // the other is a page that disagrees with its own count.
    const body = code.slice(code.indexOf("export async function listDocument("));
    const listBody = body.slice(0, body.indexOf("\nexport "));
    expect([...listBody.matchAll(/\.where\(where\)/g)]).toHaveLength(2);
  });

  it("is carried by the route and by the list, under one name", () => {
    // A query-string key spelled two ways is a filter that silently never
    // applies: the client sets `customFieldKey`, the route reads `fieldKey`,
    // zod drops the unknown member, and `listDocument` sees `undefined`.
    for (const [what, file] of [
      ["route", join("src", "app", "api", "documents", "route.ts")],
      ["list view", LIST_VIEW],
    ] as const) {
      const code = stripComments(read(file));
      expect([what, code.includes("customFieldKey")]).toEqual([what, true]);
      expect([what, code.includes("customFieldValue")]).toEqual([what, true]);
    }
  });

  it("⚠️ clears the tick boxes when it changes", () => {
    // `record-list-agreement.test.ts` enforces this across all four lists and
    // is the authority; it is restated here because THIS is the slice that adds
    // the filter, and the failure is not visible on screen: rows stay selected
    // that the filter has just taken away, and the bulk delete then acts on
    // records nobody can see.
    const code = stripComments(read(LIST_VIEW));
    const pageKey = /const pageKey = `([^`]*)`/.exec(code)?.[1] ?? "";
    expect(pageKey).toContain("${customFieldKey}");
    expect(pageKey).toContain("${customFieldValue}");
  });
});

// ---------------------------------------------------------------------------
// The values query: ordinals, and why
// ---------------------------------------------------------------------------

describe("⚠️ the values query groups by ORDINAL, not by the expression", () => {
  it("renders valid SQL when the key is bound in four places", () => {
    // ⚠️ **THE BUG AN ADVERSARIAL ROUND FOUND, TURNED INTO A TEST.** The
    // obvious spelling builds the `->>` expression once as a `const` and hands
    // that chunk to `select`, `where`, `groupBy` and `orderBy`. It reads as one
    // expression reused. Drizzle appends the bind parameter on EVERY emission,
    // so the renders carry `$1`, `$2`, `$3`, `$4` — and Postgres matches a
    // select-list expression against a GROUP BY item with `equal()`, which
    // compares `paramid`. The match fails, the walker finds the ungrouped
    // `document.custom_fields`, and the statement is rejected with 42803.
    //
    // ⚠️ **It would have failed in SILENCE.** The route answers 500, the query
    // errors, `valueOptions` falls back to `[]`, and the dropdown renders
    // enabled with one option and no error — a filter that looks present and
    // never works. Neither `tsc` nor ESLint sees a well-typed builder chain.
    //
    // ⚠️ **THIS TEST IS A GUARD ON DRIZZLE, NOT ON `queries.ts`, AND SAYING SO
    // IS THE POINT.** It builds its own query, so no mutation of the production
    // module can turn it red — an adversarial round confirmed that across seven
    // of them. What it is worth is the thing nothing else checks: that
    // `sql`1`` really emits a LITERAL `1` and not a bind parameter. `GROUP BY
    // $n` is a constant, not an ordinal, and would fold the whole archive into
    // one row silently; if a drizzle upgrade ever started binding it, this goes
    // red and the companion below does not. The companion is what pins the
    // production statement to this shape.
    const key = "tip_vanzare";
    const q = new QueryBuilder()
      .select({
        value: sql<string>`${document.customFields} ->> ${key}::text`,
        count: count(),
      })
      .from(document)
      .where(
        and(
          inArray(document.documentTypeId, ["11111111-1111-1111-1111-111111111111"]),
          sql`${document.customFields} ->> ${key}::text IS NOT NULL`,
          sql`${document.customFields} ->> ${key}::text <> ''`,
        ),
      )
      .groupBy(sql`1`)
      .orderBy(sql`2 desc`, sql`1 asc`)
      .limit(200);

    const rendered = new PgDialect().sqlToQuery(q.getSQL());
    // The two clauses that reject the expression form.
    expect(rendered.sql).toContain("group by 1");
    expect(rendered.sql).toContain("order by 2 desc, 1 asc");
    // ⚠️ And NOT the expression, under any placeholder — which is the whole
    // point: an ordinal cannot be compared against the select list and fail.
    expect(rendered.sql).not.toContain("group by \"document\".\"custom_fields\"");
    expect(rendered.sql).not.toContain("order by \"document\".\"custom_fields\"");
    // The key really is bound more than once. Without this the test above
    // would pass over a version that had simply stopped filtering.
    expect(rendered.params.filter((p) => p === key).length).toBeGreaterThan(1);
  });

  it("…and that is the shape `listDocumentCustomFieldValues` uses", () => {
    // ⚠️ **A SOURCE GUARD, AND WHAT IT CANNOT PROVE IS SAID PLAINLY.** The
    // production function takes `db`, so it cannot be rendered here the way
    // `customFieldFilter` can, and no Postgres is reachable from the sandbox.
    // What is asserted is that it uses the ordinal form the test above proves
    // valid, and that it does NOT reuse a single expression chunk — the exact
    // spelling that produced the invalid statement.
    const code = stripComments(read(QUERIES));
    const start = code.indexOf("export async function listDocumentCustomFieldValues(");
    expect(start).toBeGreaterThan(0);
    const body = code.slice(start, code.indexOf("\nexport ", start + 1));

    expect(body).toContain(".groupBy(sql`1`)");
    expect(body).toContain(".orderBy(sql`2 desc`, sql`1 asc`)");

    // ⚠️ **AND THE SELECT-LIST ORDER, because an ordinal is POSITIONAL.**
    // `1` and `2` mean "the first and second things selected". Insert a third
    // column ahead of `value` and the query groups by the wrong expression and
    // orders by the wrong one — no error, a dropdown of wrong flavours with
    // wrong counts, which is the same silent-failure class the ordinals were
    // adopted to escape. An adversarial round pointed out that neither guard
    // above catches a reorder. This one does.
    const select = body.slice(body.indexOf(".select({"), body.indexOf(".from(document)"));
    expect(select.indexOf("value:")).toBeGreaterThan(0);
    expect(select.indexOf("value:")).toBeLessThan(select.indexOf("count:"));
    // Exactly two, so a third column cannot be appended unnoticed either.
    //
    // ⚠️ **`\s*`, NOT `\s{6}`.** The first version pinned the current six
    // spaces of indentation, so a pure re-indent — no semantic change at all —
    // turned it red with `got 0 want 2`, a message naming neither whitespace
    // nor the real subject. A guard that fires on formatting is a guard people
    // learn to edit rather than read. Verified by an adversarial round, which
    // re-indented the select and watched it fail.
    expect([...select.matchAll(/^\s*\w+:/gm)]).toHaveLength(2);
    // ⚠️ The regression guard. `const value = sql...` then `groupBy(value)` is
    // the version that renders 42803.
    expect(body).not.toMatch(/const\s+value\s*=\s*sql/);
    expect(body).not.toContain("groupBy(value)");

    // Empty is not a value: `NULL` and `''` are the two ways `custom_fields`
    // records "nothing captured" and neither is a flavour anyone groups by.
    expect(body).toContain("IS NOT NULL");
    expect(body).toContain("<> ''");
    // The same explicit-empty short-circuit `listDocument` makes: `IN ()` is a
    // syntax error, not an empty result.
    expect(body).toContain("opts.documentTypeIds.length === 0) return []");
  });

  it("the values route parses documentTypeIds in three states, like the list", () => {
    // Absent → every type. Present-but-empty → nothing selected. Otherwise the
    // list. A `?? undefined` shorthand collapses the middle into the first and
    // offers values off the whole archive on a screen showing no rows at all.
    const code = stripComments(read(VALUES_ROUTE));
    expect(code).toContain('idsRaw === null ? undefined : idsRaw === "" ? [] : idsRaw.split(",")');
  });
});

// ---------------------------------------------------------------------------
// The copy the filter draws
// ---------------------------------------------------------------------------

const FILTER_KEYS = [
  "customFieldLabel",
  "allCustomFields",
  "customFieldValueLabel",
  "allCustomFieldValues",
  "customFieldValuesLoading",
  "customFieldValueOption",
] as const;

function listFilters(locale: string): Record<string, string> {
  const raw = JSON.parse(read(join("messages", `${locale}.json`))) as {
    shared: { listFilters: Record<string, string> };
  };
  return raw.shared.listFilters;
}

describe("⚠️ the filter's copy, in both locales", () => {
  // An adversarial round pointed out that these six keys shipped with no copy
  // suite at all, on a project where `DEFAULT_LOCALE` is `ro-RO` and a missing
  // key renders the raw key path into the shipping UI.
  it.each(["ro-RO", "en-GB"])("%s carries every string the toolbar asks for", (locale) => {
    const copy = listFilters(locale);
    const missing = FILTER_KEYS.filter(
      (k) => typeof copy[k] !== "string" || copy[k].trim() === "",
    );
    expect([locale, missing]).toEqual([locale, []]);
  });

  it("⚠️ asks for nothing the toolbar does not ask for, and vice versa", () => {
    // The same both-directions scrape `import-types-blocked-copy.test.ts` uses,
    // narrowed to this slice's keys: a `tFilter("…")` the locale files do not
    // carry ships a dotted key path into Romanian, and a key nobody draws is
    // dead copy that goes stale unnoticed.
    const code = stripComments(read(LIST_VIEW));
    const asked = new Set(
      [...code.matchAll(/tFilter\(\s*"([^"]+)"/g)].map((m) => m[1]),
    );
    for (const key of FILTER_KEYS) {
      expect([key, asked.has(key)]).toEqual([key, true]);
    }
  });

  it("counts documents with a plural, and lets Romanian have its third form", () => {
    // Romanian changes form again at 20 — „# documente" up to 19, „# de
    // documente" from 20 — so `few` is not optional here. #26.02 shipped this
    // exact bug once.
    const ro = listFilters("ro-RO").customFieldValueOption;
    const en = listFilters("en-GB").customFieldValueOption;
    for (const [locale, text] of [["ro-RO", ro], ["en-GB", en]] as const) {
      expect([locale, text.includes("{value}")]).toEqual([locale, true]);
      expect([locale, text.includes("{count, plural,")]).toEqual([locale, true]);
    }
    for (const arm of ["one {", "few {", "other {"]) {
      expect([arm, ro.includes(arm)]).toEqual([arm, true]);
    }
    expect(ro).toContain("de documente");
  });

  it("says something different in Romanian than in English", () => {
    // Romanian is the shipping locale and English the development convenience;
    // identical strings mean the Romanian was never written.
    const ro = listFilters("ro-RO");
    const en = listFilters("en-GB");
    const same = FILTER_KEYS.filter((k) => ro[k] === en[k]);
    expect(same).toEqual([]);
  });
});
