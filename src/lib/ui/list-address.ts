/**
 * A PRINCIPAL LIST'S VIEW, IN ITS ADDRESS.                             (Slice #39.26)
 *
 * Adrian, 2026-10-13: „I expect the back button will take me to the exactly the same screen I was on" — the list's
 * page, search and filters, and the tiles open on its row. They lived in React state and died with the page, so a
 * record opened from the list and left with Back came back to a bare list.
 *
 * So the four lists (Persoane fizice, Persoane juridice, Proprietăți, Acte) write what is on screen into their own
 * address as it changes — replacing the history entry, never adding one — and read it back when they mount
 * (Ask first #1): Back restores it by construction, a reload keeps it, and a copied link reproduces it. Opened
 * fresh from the menu, a list's address carries none of it, so it opens clean (Ask first #2). A row that is gone,
 * or no longer matches, simply opens no tile: `ListPreviews` closes tiles whose row is not on the page (#39.04,
 * Ask first #3).
 *
 *   ?q=<search>&page=<n, from 1>&row=<id>&tiles=preview,links,peek   and a list's own filters (Acte's three).
 *
 * The scroll position is not here — an address should not carry it — but in the session, by history slot
 * (`keepScroll`, `use-list-address.ts`).
 * Acte's „Tip document" was already in the address (`documentTypeIds`, #15.08) and is left as it is.
 *
 * PURE — `list-address.test.ts` covers it.
 */
import { ROW_TILE_ORDER, type RowTile } from "@/lib/ui/row-tiles";

/** The address's own keys. */
export const LIST_PARAM = { search: "q", page: "page", row: "row", tiles: "tiles" } as const;

/** What a list keeps in its address. `page` counts from 0, as the lists do; the address counts from 1. */
export interface ListAddress {
  search: string;
  page: number;
  /** A list's own filters, by key — empty when unset. */
  filters: Readonly<Record<string, string>>;
  /** The row whose tiles are open, and which, in the column's order. */
  row: string | null;
  tiles: readonly RowTile[];
}

/** The longest search kept — an address is not a store. */
export const MAX_SEARCH = 200;

function pageOf(raw: string | null): number {
  if (raw === null || !/^\d{1,6}$/.test(raw)) return 0;
  const n = Number(raw);
  return n >= 1 ? n - 1 : 0;
}

function tilesOf(raw: string | null): RowTile[] {
  if (!raw) return [];
  const asked = new Set(raw.split(","));
  return ROW_TILE_ORDER.filter((t) => asked.has(t));
}

/** What an address holds. Anything malformed reads as unset: a list never refuses to open over its address. */
export function readListAddress(params: URLSearchParams, filterKeys: readonly string[] = []): ListAddress {
  const filters: Record<string, string> = {};
  for (const k of filterKeys) {
    const v = params.get(k);
    if (v) filters[k] = v;
  }
  const row = params.get(LIST_PARAM.row)?.trim() || null;
  const tiles = row ? tilesOf(params.get(LIST_PARAM.tiles)) : [];
  return {
    search: (params.get(LIST_PARAM.search) ?? "").slice(0, MAX_SEARCH),
    page: pageOf(params.get(LIST_PARAM.page)),
    filters,
    row: tiles.length > 0 ? row : null,
    tiles,
  };
}

/**
 * `params` with `patch` written into it: a value set, an empty one (or page 0, or no tiles) removed. Keys the patch
 * does not name — another part's, or an address key that is not the list's (`documentTypeIds`) — are left alone.
 */
export function writeListAddress(params: URLSearchParams, patch: Partial<ListAddress>): URLSearchParams {
  const next = new URLSearchParams(params);
  const put = (k: string, v: string) => (v ? next.set(k, v) : next.delete(k));
  if (patch.search !== undefined) put(LIST_PARAM.search, patch.search.trim().slice(0, MAX_SEARCH));
  if (patch.page !== undefined) put(LIST_PARAM.page, patch.page > 0 ? String(patch.page + 1) : "");
  if (patch.filters !== undefined) for (const [k, v] of Object.entries(patch.filters)) put(k, v);
  if (patch.row !== undefined || patch.tiles !== undefined) {
    const tiles = ROW_TILE_ORDER.filter((t) => (patch.tiles ?? []).includes(t));
    const row = tiles.length > 0 ? (patch.row ?? "") : "";
    put(LIST_PARAM.row, row);
    put(LIST_PARAM.tiles, row ? tiles.join(",") : "");
  }
  return next;
}

/**
 * What a new filter's address keeps of the current one: the search and the list's own filters — not the page, not
 * the open tiles, and not any other key (Acte's type filter writes its own `documentTypeIds` after).
 */
export function carryListAddress(params: URLSearchParams, filterKeys: readonly string[] = []): URLSearchParams {
  const kept = new URLSearchParams();
  for (const k of [LIST_PARAM.search, ...filterKeys]) {
    const v = params.get(k);
    if (v) kept.set(k, v);
  }
  return kept;
}

/** `?…` for a query string, or nothing when it is empty. */
export function queryOf(params: URLSearchParams): string {
  const s = params.toString();
  return s ? `?${s}` : "";
}

/**
 * The lists' scroll positions, newest last: `[<pathname>#<history slot>, top]`. Kept short — one slot per list
 * visit, and only a Back to a recent one restores anything.
 */
export type ScrollMemory = readonly (readonly [string, number])[];
export const MAX_SCROLL_MEMORY = 30;

/** The position kept for `at`, or null. */
export function scrollFor(memory: ScrollMemory, at: string): number | null {
  const hit = memory.find(([k]) => k === at);
  return hit && Number.isFinite(hit[1]) && hit[1] >= 0 ? hit[1] : null;
}

/** `memory` with `at` at `top`, moved to the end, the oldest dropped past `MAX_SCROLL_MEMORY`. */
export function keepScroll(memory: ScrollMemory, at: string, top: number): ScrollMemory {
  const next = [...memory.filter(([k]) => k !== at), [at, Math.max(0, Math.round(top))] as const];
  return next.length > MAX_SCROLL_MEMORY ? next.slice(next.length - MAX_SCROLL_MEMORY) : next;
}
