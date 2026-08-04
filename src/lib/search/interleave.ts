/**
 * Global search result shaping — per-type caps, round-robin interleave and
 * client-side paging  (Slice #23.11.search)
 *
 * WHY THIS EXISTS
 *   Until this slice the search route ran three queries (person / property /
 *   document), each `.limit(200)`, concatenated them, sorted the merged array
 *   by `code.localeCompare(...)` and then took `.slice(0, 200)`.
 *
 *   Entity codes carry a type prefix — DOC…, JPERS…, PPERS…, PROP… — and
 *   lexicographically DOC < JPERS < PPERS < PROP. So that final slice kept
 *   documents first and dropped whole entity types off the end: as soon as
 *   200 documents matched, the response contained no property and no person
 *   at all, and the UI's single "capped at 200" line never said so — it read
 *   as "there are more results of this kind". A search that silently answers
 *   a different question than the one asked is worse than one that returns
 *   nothing.
 *
 *   The fix has two halves and BOTH are needed:
 *     - `capBucket` gives each type its own budget, so the loss is impossible;
 *     - `interleaveByType` makes the result usable. With a per-type cap but a
 *       plain code sort, pages 1-3 would still be nothing but documents, so
 *       someone searching for a person's name would page four times before
 *       seeing a person. The cap fixes the data; the interleave fixes the
 *       experience.
 *
 * PURE MODULE — no React, no DB, no next/*. Unit-tested directly, following
 * src/lib/versioning/field-diff.ts and src/lib/import/coordinate-file.ts.
 */

/**
 * The four independently-capped result types.
 *
 * Note this is finer-grained than `principal_object.object_type`, which has
 * only PERSON / PROPERTY / DOCUMENT. Natural and judicial persons carry
 * different code prefixes (PPERS / JPERS) and are separate populations a user
 * searches for separately, so they get separate budgets — three caps with a
 * shared person budget would let 50 judicial persons crowd out every natural
 * person, which is the same defect one level down.
 */
export type SearchEntityType =
  | "DOCUMENT"
  | "JUDICIAL_PERSON"
  | "NATURAL_PERSON"
  | "PROPERTY";

/**
 * Rotation order for `interleaveByType`, and the order `truncatedTypes`
 * reports in. Deliberately matches the code-prefix sort
 * (DOC < JPERS < PPERS < PROP) so that within a single round the results
 * still read in code order — the interleave changes which rows are adjacent,
 * not the order of a type's own rows.
 */
export const SEARCH_ENTITY_TYPES = [
  "DOCUMENT",
  "JUDICIAL_PERSON",
  "NATURAL_PERSON",
  "PROPERTY",
] as const satisfies readonly SearchEntityType[];

/** Rows kept per entity type. Fetch `PER_TYPE_CAP + 1` to detect truncation. */
export const PER_TYPE_CAP = 50;

/** Rows per page — matches PAGE_SIZE on every other list since Slice #6.0. */
export const SEARCH_PAGE_SIZE = 15;

/** Largest result set the route can return: 4 x 50. */
export const MAX_RESULTS = PER_TYPE_CAP * SEARCH_ENTITY_TYPES.length;

/**
 * 200 / 15 = 13.3 -> 14. If the UI ever shows a higher page count, a cap is
 * not being applied — that is the cheapest available assertion that this
 * module is actually in the path.
 */
export const MAX_PAGES = Math.ceil(MAX_RESULTS / SEARCH_PAGE_SIZE);

export type SearchBucket<T> = {
  type: SearchEntityType;
  /** At most `cap` rows, in the order the query returned them. */
  items: T[];
  /** True when the query had more rows than the cap allowed. */
  truncated: boolean;
};

/**
 * Apply one type's cap and detect truncation, using the limit + 1 trick.
 *
 * Call the query with `LIMIT cap + 1`. If `cap + 1` rows come back, there is
 * at least one more match than we are showing, so the type is truncated; the
 * extra row is discarded. This costs nothing and needs no COUNT — and an
 * accurate COUNT across four filtered queries with correlated EXISTS
 * subqueries is the expensive part of this screen, not the rows themselves.
 */
export function capBucket<T>(
  type: SearchEntityType,
  rows: readonly T[],
  cap: number = PER_TYPE_CAP,
): SearchBucket<T> {
  if (!Number.isInteger(cap) || cap < 0) {
    throw new Error(`capBucket: cap must be a non-negative integer, got ${cap}`);
  }
  return {
    type,
    items: rows.slice(0, cap),
    truncated: rows.length > cap,
  };
}

/**
 * Round-robin merge: one row of each type per round, in SEARCH_ENTITY_TYPES
 * order, until every bucket is exhausted. A type with fewer rows than the
 * others simply drops out of the rotation as it runs dry — it does not leave
 * a gap and it does not stop the rotation.
 *
 * Each type's own rows keep the order they arrived in (the queries sort by
 * code), so the result is "code order within a type, types interleaved".
 *
 * Passing two buckets of the same type concatenates them rather than letting
 * the later one shadow the earlier — the function stays total, and a caller
 * that splits one type across queries still gets all its rows.
 */
export function interleaveByType<T>(buckets: readonly SearchBucket<T>[]): T[] {
  const byType = new Map<SearchEntityType, T[]>();
  for (const bucket of buckets) {
    const existing = byType.get(bucket.type);
    if (existing) existing.push(...bucket.items);
    else byType.set(bucket.type, [...bucket.items]);
  }

  const ordered = SEARCH_ENTITY_TYPES.map((type) => byType.get(type) ?? []);
  const longest = ordered.reduce((max, list) => Math.max(max, list.length), 0);

  const out: T[] = [];
  for (let i = 0; i < longest; i++) {
    for (const list of ordered) {
      if (i < list.length) out.push(list[i]);
    }
  }
  return out;
}

/**
 * Which types were cut short, in canonical order and de-duplicated.
 *
 * The UI must NAME these. The original defect was not the cap itself — it was
 * that a single global "showing the first 200 results" line was true and
 * useless: it could not distinguish "there are more documents" from "every
 * property you searched for is missing from this table".
 */
export function truncatedTypes<T>(
  buckets: readonly SearchBucket<T>[],
): SearchEntityType[] {
  const flagged = new Set(
    buckets.filter((b) => b.truncated).map((b) => b.type),
  );
  return SEARCH_ENTITY_TYPES.filter((type) => flagged.has(type));
}

/** Page count for a result set; always at least 1, so an empty set is page 1 of 1. */
export function pageCount(
  total: number,
  pageSize: number = SEARCH_PAGE_SIZE,
): number {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error(`pageCount: pageSize must be a positive integer, got ${pageSize}`);
  }
  return Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
}

/**
 * Clamp a page index into range.
 *
 * The page number lives in the URL so a result is shareable, which means it
 * arrives as untrusted input: `?page=9` on a link whose result set has since
 * shrunk would otherwise strand the reader on an empty table with no way back
 * except editing the address bar. Non-numeric, negative and past-the-end all
 * collapse to a real page.
 *
 * NaN is the one value that needs its own branch — it survives Math.trunc and
 * loses every comparison, so Math.min/Math.max would propagate it. Infinities
 * do not: they clamp to the last page and to page 0 on their own.
 */
export function clampPage(
  page: number,
  total: number,
  pageSize: number = SEARCH_PAGE_SIZE,
): number {
  if (Number.isNaN(page)) return 0;
  const last = pageCount(total, pageSize) - 1;
  return Math.min(Math.max(Math.trunc(page), 0), last);
}

/** The rows to display for `page`, with the page index clamped first. */
export function pageSlice<T>(
  items: readonly T[],
  page: number,
  pageSize: number = SEARCH_PAGE_SIZE,
): T[] {
  const start = clampPage(page, items.length, pageSize) * pageSize;
  return items.slice(start, start + pageSize);
}
