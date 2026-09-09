/**
 * The documents list's `custom_fields` filter — a PURE module.  (Slice #34.10)
 *
 * ⚠️ **IT LIVES HERE RATHER THAN IN `queries.ts`, AND `npx jest` IS WHY.** The
 * first version of this slice put it beside `listDocument`, which is where it
 * is used — and that made its own suite impossible to run: `queries.ts` imports
 * `db` from `@/db`, which imports `pg`, which reaches for `TextEncoder` at
 * module scope. Under jsdom that is not defined, so
 * `document-custom-field-filter.test.ts` died with `Test suite failed to run`
 * before a single assertion — while a sandbox harness that had stubbed `@/db`
 * reported it green. The suite was testing a pure function and paying for a
 * database driver to do it.
 *
 * ⚠️ **`@/db/schema` IS SAFE TO IMPORT AND `@/db` IS NOT — that is the whole
 * distinction.** The schema module imports `drizzle-orm` and nothing else; it
 * is table definitions. `@/db` is the pool. A pure module may name a column
 * without opening a connection, and this one names exactly one.
 *
 * The same rule the sibling guards already keep — `document-type-match.ts`,
 * `id-card.ts`, `type-form-gate.ts`, `catch-all-form-guard.ts` all say "pure
 * module — no DB, no React, no next/*" in their own headers, and all four are
 * unit-tested for it.
 */

import { sql, type SQL } from "drizzle-orm";

import { document } from "@/db/schema";

/**
 * One structured filter that reads `custom_fields`.           (Slice #34.10)
 *
 * ⚠️ **THE HALF OF D-01 THAT NEEDS CODE.** D-01 settled that
 * CONTRACT_VANZARE gets ONE union form plus one hand-written field carrying
 * the flavour, rather than a subtype level — and that answer is only half
 * an answer while nothing anywhere can read `custom_fields`. Until this
 * line the search matched three columns (`code`, `title`, `nrDocument`) and
 * the structured filters were type, importance, relevance and expiry, so a
 * flavour recorded as a form field could be captured and never grouped by.
 *
 * ⚠️ **`->>` RATHER THAN `->`, so the comparison is against `text`.**
 * `custom_fields` is `jsonb` typed `Record<string, string | null>` — flat,
 * one level, string values — so `->>` yields the value directly and there
 * is nothing to traverse. `->` would return a `jsonb` and compare
 * `"Vânzare"` (with the quotes) against a bare string, matching nothing and
 * failing silently.
 *
 * ⚠️ **`${key}::text` IS NOT DECORATION.** `jsonb ->> ?` has two overloads,
 * `text` and `integer`, and an untyped bind parameter leaves Postgres to
 * choose — which it resolves as `integer` for a numeric-looking key,
 * turning a key lookup into an array index against an object and erroring
 * at runtime rather than at review. `snake_case` and `camelCase` keys are
 * both legal here by design (`discover-to-template.ts` says so at length),
 * so a key is whatever a person typed.
 *
 * ⚠️ **BOTH terms or NEITHER — and the empty-value rule is chosen rather
 * than inherited.** `customFieldsEqual` treats `null`, `""`, an absent key
 * and `undefined` as all equivalent, so "the value is empty" is not one
 * state in the data. Rather than pick one and be wrong for the other three,
 * an empty value means NO FILTER at all: this filter answers "which
 * documents hold THIS value", never "which are missing it". The route and
 * the schema say the same thing, so there is one rule.
 *
 * No join, and nothing to add to the count query at the caller: the column is
 * on
 * `document` itself and this predicate goes into the `where` both share.
 *
 * ⚠️ **A NAMED FUNCTION RATHER THAN A TERM INSIDE `listDocument`'s `and(...)`,
 * so that it can be TESTED rather than only grepped.** Every other filter there
 * is a `eq()` or an `inArray()` whose meaning is carried by drizzle; this one is
 * hand-written SQL with two operators and a cast in it, and the ways it can be
 * subtly wrong — `->` for `->>`, a missing cast, one term instead of two — all
 * type-check and all fail at runtime or, worse, silently match nothing.
 * `PgDialect().sqlToQuery` renders it with no database in reach, which is what
 * lets `document-custom-field-filter.test.ts` assert the operator, the cast and
 * the parameter order as facts rather than as source text.
 *
 * Returns `undefined` — which `and()` drops — when the filter is not in play.
 */
export function customFieldFilter(opts: {
  customFieldKey?: string;
  customFieldValue?: string;
}): SQL | undefined {
  if (!opts.customFieldKey || !opts.customFieldValue) return undefined;
  return sql`${document.customFields} ->> ${opts.customFieldKey}::text = ${opts.customFieldValue}`;
}
