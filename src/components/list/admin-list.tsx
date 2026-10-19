"use client";

/**
 * The groups' and the stamps' lists — one piece where the two are the same shape.                 (Slice #39.89)
 *
 * Adrian, 2026-10-18: „for the groups the gap is too small; The groups should also have a scroll bar because the tile
 * is too tall; and the groups should have searched by code or words in the description next please perform the same
 * treatment for the stamps". So, on „Grupuri" and on „Ștampile":
 *   - the list stands Reference Data's standard gap from its tile's edges (#39.88, `REFERENCE_GAP_REM`, 21 px): the
 *     panel's padding is p-5, not p-3, and the list fills what that leaves. Its table is the frame's width, the
 *     description's column taking what the others leave (`adminListTable`) — so when the frame scrolls down, its scroll
 *     bar comes out of the description rather than pushing the buttons out sideways (measured on „Ștampile" with the
 *     table at a fixed width: 14 px of sideways scroll, FU-356's shape);
 *   - the list is never taller than two thirds of the window and scrolls inside its tile, its header row kept at the
 *     top — the tarla page's big lists (#39.77);
 *   - a search box beside „+ Adaugă" filters what is loaded, in the browser (`filterByWords`): the code, or every word
 *     typed in the description, in any order, with or without diacritics, an exact code first. No new route. While
 *     something is typed the count reads „n din m".
 */
import type { ReactNode } from "react";
import { ListSearchBox } from "@/components/list/list-search";
import { columnStyle, type ColumnName } from "@/lib/ui/field-widths";

/** The list's tile: Reference Data's standard gap — the 1-px border and p-5. */
export const ADMIN_LIST_PANEL =
  "flex flex-col gap-3 rounded-md border border-card-rim bg-card p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900";

/** The table's frame: the tile's width inside the gap, at most two thirds of the window tall, scrolling inside. */
export const ADMIN_LIST_FRAME =
  "w-full max-h-[66vh] overflow-auto rounded-md border border-card-rim bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900";

/** The header row, kept at the top of the frame as it scrolls. */
export const ADMIN_LIST_HEAD =
  "sticky top-0 z-10 bg-cap text-left text-xs font-medium uppercase tracking-wide text-ink dark:bg-zinc-800 dark:text-zinc-300";

/** The `<table>`'s props: fixed layout, the frame's whole width. */
export function adminListTable(columns: readonly ColumnName[]) {
  return { className: "w-full table-fixed text-sm", "data-width-table": columns.join(" ") };
}

/** The `<colgroup>`: each column at its `COLUMN` width but `fill`, which takes what the frame leaves. */
export function AdminListColumns({ columns, fill }: { columns: readonly ColumnName[]; fill: ColumnName }) {
  return (
    <colgroup>
      {columns.map((name, i) => (
        <col key={`${name}-${i}`} style={name === fill ? undefined : columnStyle(name)} data-fill-column={name === fill ? "" : undefined} />
      ))}
    </colgroup>
  );
}

/**
 * The list's top row: „+ Adaugă", the search box beside it, and the count at the right. The box keeps the principal
 * lists' 16rem: „+ Adaugă" is an icon on these two lists, too narrow to give the box its width (#39.85's rule).
 */
export function AdminListToolbar({
  add,
  search,
  onSearch,
  explanation,
  count,
}: {
  add: ReactNode;
  search: string;
  onSearch: (next: string) => void;
  /** What the search reads, in the column headers' words. */
  explanation: string;
  /** „5 grupuri", or „2 din 5" while something is typed. */
  count: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3" data-admin-list-toolbar="">
      <div className="flex items-center gap-3">
        {add}
        <ListSearchBox value={search} onChange={onSearch} explanation={explanation} />
      </div>
      {count !== null && <span className="text-xs text-fade dark:text-zinc-400" data-admin-list-count="">{count}</span>}
    </div>
  );
}
