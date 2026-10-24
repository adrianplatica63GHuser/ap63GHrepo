/**
 * A PRINCIPAL LIST'S ORDER.                                                                              (Slice 40.46)
 *
 * Adrian, 2026-10-24: a sort button on the four lists (Persoane fizice, Persoane juridice, Proprietăți, Acte), with
 * „Interacțiuni"'s icon — and, at 11:51, „Let's keep what it was before (and modify the caption of the button
 * accordingly)": every list still opens in the order it has had since #16.UX.01, the record added or changed last
 * first, `greatest(updatedAt, createdAt) desc`. That order now has a name, `changed`, so a list can say it and flip it.
 *
 *   - The order is the SERVER's (`sort`, `order` on the four routes — `order-sql.ts`), across every page: a list pages
 *     15 at a time, so an order applied in the browser would sort one page.
 *   - Each list may be ordered by the names in `LIST_SORTS` and nothing else; a route refuses any other (Ask first 1).
 *     40.47 adds the columns that sort.
 *   - In the list's address as `sort` and `order`, written only when they are not the default (Ask first 4), so a list
 *     opened from the menu or a link with neither opens as it always has; anything malformed there reads as the
 *     default — a list never refuses to open over its address (`list-address.ts`).
 *
 * PURE — `list-order.test.ts` covers it.
 */

export type SortDirection = "asc" | "desc";

export interface ListOrder {
  readonly sort: string;
  readonly order: SortDirection;
}

/** The record added or changed last first: `greatest(updatedAt, createdAt)` — the day it was added counting as one. */
export const CHANGED = "changed";

/** The order every list opens in, and the one a list's address need not say. */
export const DEFAULT_LIST_ORDER: ListOrder = Object.freeze({ sort: CHANGED, order: "desc" });

/** The address's and the routes' words. */
export const ORDER_PARAM = { sort: "sort", order: "order" } as const;
export const ORDER_KEYS: readonly string[] = [ORDER_PARAM.sort, ORDER_PARAM.order];

/** What each list may be ordered by. Anything else is refused by its route, and read as the default from its address. */
export const LIST_SORTS = {
  person: [CHANGED],
  company: [CHANGED],
  property: [CHANGED],
  document: [CHANGED],
} as const satisfies Record<string, readonly [string, ...string[]]>;

export type OrderedList = keyof typeof LIST_SORTS;

const DIRECTIONS: readonly string[] = ["asc", "desc"];

export function isDefaultOrder(o: ListOrder): boolean {
  return o.sort === DEFAULT_LIST_ORDER.sort && o.order === DEFAULT_LIST_ORDER.order;
}

/**
 * The order an address holds. No `sort` is `changed`; no `order` is `desc`. A `sort` the list does not offer, or an
 * `order` that is neither word, reads as the default whole.
 */
export function readListOrder(get: (key: string) => string | null | undefined, sorts: readonly string[]): ListOrder {
  const sort = get(ORDER_PARAM.sort) || CHANGED;
  const order = get(ORDER_PARAM.order) || "desc";
  if (!sorts.includes(sort) || !DIRECTIONS.includes(order)) return DEFAULT_LIST_ORDER;
  return { sort, order: order as SortDirection };
}

/**
 * The button's press: by the last change, newest ⇄ oldest; ordered by anything else (a column, from 40.47), back to the
 * default — as „Interacțiuni"'s `flipDateOrder` does.
 */
export function flipListOrder(o: ListOrder): ListOrder {
  if (o.sort !== CHANGED) return DEFAULT_LIST_ORDER;
  return { sort: CHANGED, order: o.order === "desc" ? "asc" : "desc" };
}

/** The address's patch: both words, or both removed for the default (`writeListAddress` drops an empty value). */
export function orderAddressPatch(o: ListOrder): Record<string, string> {
  return isDefaultOrder(o) ? { [ORDER_PARAM.sort]: "", [ORDER_PARAM.order]: "" } : { [ORDER_PARAM.sort]: o.sort, [ORDER_PARAM.order]: o.order };
}

/** A route's request: the two words, only when not the default — so a default request is the one it always was. */
export function appendOrderParams(params: URLSearchParams, o: ListOrder): void {
  if (isDefaultOrder(o)) return;
  params.set(ORDER_PARAM.sort, o.sort);
  params.set(ORDER_PARAM.order, o.order);
}

/** A string that changes exactly when the order does — for a query key and the address's signature. */
export function orderSignature(o: ListOrder): string {
  return `${o.sort}:${o.order}`;
}
