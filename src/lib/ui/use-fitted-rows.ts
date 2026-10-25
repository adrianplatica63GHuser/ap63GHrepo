"use client";

/**
 * As many rows a page as the window holds — never fewer than 10.                                    (Slice 40.67)
 *
 * The four principal lists showed 15 rows a page whatever the window: on a tall screen a third of the frame stood
 * empty, on a short one the rows scrolled inside it. Now the frame's height (`useListFit`, #40.02: from its top to
 * the window's bottom, less the pagination row under it) is divided by one row's measured height, the band of column
 * names taken off first: `fittedRows`. Recomputed when the window is resized, about 150 ms after it settles.
 *
 * ⚠️ **A RESIZE NEVER JUMPS TO UNRELATED RECORDS.** When the count changes, the page shown becomes the one holding
 * the first row that was on screen (`firstRowPage`): row 31 of 15-row pages is on page 3 (index 2); at 20 a page it
 * is on page 2 (index 1). The address keeps `page` and gains no size (Ask first 3): the row count belongs to the
 * window, not to the link.
 *
 * The association pickers and search's interleave keep their 15 (Ask first 1).
 */
import { useState, type Dispatch, type SetStateAction } from "react";
import type { QueryKey } from "@tanstack/react-query";

/** The fewest rows a page shows, whatever the window. */
export const MIN_PAGE_ROWS = 10;

/** How long a resize must have settled before the count changes, in ms. */
export const FITTED_ROWS_SETTLE_MS = 150;

/**
 * The rows a frame `frame` px tall holds: its band of names (`band`) and its two 1-px borders taken off, then whole
 * rows of `row` px — never fewer than `min`. PURE — `use-fitted-rows.test.ts`.
 */
export function fittedRows({ frame, band, row }: { frame: number; band: number; row: number }, min = MIN_PAGE_ROWS): number {
  if (!(row > 0) || !(frame > 0)) return min;
  return Math.max(min, Math.floor((frame - Math.max(0, band) - 2) / row));
}

/** The page (0-based) holding the first row of page `page` at `from` rows a page, at `to` rows a page. */
export function firstRowPage(page: number, from: number, to: number): number {
  if (!(from > 0) || !(to > 0)) return page;
  return Math.floor((page * from) / to);
}

/**
 * The list's page, and the rows a page holds. `rows` is `useListFit().rows` — null until the frame is first measured,
 * and the list waits for it rather than ask for 15 and then for its own count. When `rows` changes, the page follows
 * the first row on screen (React's „adjusting state when a prop changes", during render — no effect, no extra paint).
 */
export function useFittedPage(initialPage: number, rows: number | null): [number, Dispatch<SetStateAction<number>>, number | null] {
  const [page, setPage] = useState(initialPage);
  const [size, setSize] = useState<number | null>(rows);
  if (rows !== size) {
    setSize(rows);
    if (rows !== null && size !== null) setPage(firstRowPage(page, size, rows));
  }
  return [page, setPage, rows];
}

/**
 * The list's query's `placeholderData`: while only the row count changed (a resize — the count is the key's last
 * word), the rows on screen stay until the new page arrives, instead of a „Se încarcă…" line for a moment. Anything
 * else that changed (a search, a filter, the order, the page) shows the loading line as before.
 */
export function keepRowsWhileResized<T>(pageSize: number | null) {
  return (previous: T | undefined, previousQuery: { queryKey: QueryKey } | undefined): T | undefined =>
    previousQuery !== undefined && previousQuery.queryKey[previousQuery.queryKey.length - 1] !== pageSize ? previous : undefined;
}
