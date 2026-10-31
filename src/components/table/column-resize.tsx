"use client";

/**
 * The line between a list's columns, and the handle in its band of names that changes a column's width.  (Slice 40.12)
 *
 * Adrian, 2026-10-20: „the lists for the principal objects must have a vertical divider similar to the horizontal
 * dividers between rows and we should be able to grab this divider on the title bar Move it left or right to change
 * the width of the column; This should apply to all the lists and tables that are similar to the lists of principal
 * objects". One piece for every such table (Ask first 9) — `FixedTable` for the tables whose columns come from
 * `COLUMN` (the four lists, the associate screens, „Căutare globală", the users, „Calcul", the reference data's value
 * lists and form editor, the dashboard) and `AdminListTable` (`src/components/list/admin-list.tsx`) for „Grupuri" and
 * „Ștampile":
 *   - the line: 1 px in the rows' own colour (`divide-crease`, zinc-800 in dark mode) on the right of every cell but
 *     the last, through the band and every row (`COLUMN_LINES`, Ask first 2). It is an inset shadow, not a border, so
 *     no column gains or loses a pixel by it;
 *   - the handle: in the band only, an 8-px strip centred on the line — inside the last column, for the last one —
 *     with the col-resize cursor and a darker line while the mouse is on it or it is dragged. A drag changes the width
 *     of the column on its left by the distance dragged, live; the table grows or shrinks with it and the frame
 *     scrolls sideways as before (Ask first 3). A table that fills its tile keeps its width: the change is taken from
 *     its fill column, which has no handle of its own — its width is what the others leave (Ask first 5);
 *   - a double-click gives the column its usual width back; so does Home on the focused handle, and Left and Right
 *     change it by half a rem. The handle is a focusable separator named „Lățimea coloanei {name}" — „Lățimea coloanei
 *     nr. {n}" for a column whose band cell shows no name, the badges' or the buttons' (Ask first 7);
 *   - the handle holds the pointer while it is dragged, so a drag that ends over a funnel or a name presses nothing
 *     (Ask first 8);
 *   - the widths are kept per table in this browser (`src/lib/ui/column-widths.ts`, Ask first 6).
 *
 * The handles live in the table's `<caption>`, a strip with no height above the band: it sticks to the frame's top
 * with the band when the band sticks (the four lists, „Grupuri", „Ștampile") and stays put when it does not, so the
 * handles are always over the band and scroll sideways with the columns. Where each one sits is read from the band's
 * cells, again whenever the table or its band changes size.
 */
import { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { columnRem, rem, tileExtraCss, tileTableRem, type ColumnName } from "@/lib/ui/field-widths";
import { IconTooltip } from "@/lib/ui/icon-button";
import {
  COLUMN_STEP_REM,
  MIN_COLUMN_REM,
  NO_WIDTHS,
  isColumnWidthsKey,
  limitColumnRem,
  parseColumnWidths,
  readStoredWidthsRaw,
  resolveColumnRems,
  serializeColumnWidths,
  withColumnWidth,
  writeStoredWidths,
  type StoredWidths,
} from "@/lib/ui/column-widths";
import type { TileFill } from "@/components/table/fixed-columns";

/** The line between two columns: on the right of every cell of every row but the last cell, band included. */
export const COLUMN_LINES =
  "[&>*>tr>*:not(:last-child)]:shadow-[inset_-1px_0_0_var(--color-crease)] " +
  "dark:[&>*>tr>*:not(:last-child)]:shadow-[inset_-1px_0_0_var(--color-zinc-800)]";

// ---- the store: localStorage, with a memory of its own where the browser refuses it ----------------------------

const listeners = new Set<() => void>();
const refused = new Map<string, string | null>();
const cache = new Map<string, { raw: string | null; value: StoredWidths }>();

function snapshot(table: string): StoredWidths {
  const raw = refused.has(table) ? (refused.get(table) ?? null) : readStoredWidthsRaw(table);
  const hit = cache.get(table);
  if (hit && hit.raw === raw) return hit.value;
  const value = parseColumnWidths(raw);
  cache.set(table, { raw, value });
  return value;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (isColumnWidthsKey(e.key)) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

const serverSnapshot = () => NO_WIDTHS;

/** One table's stored widths, and the setter that writes one column's (`null` gives it back). */
export function useColumnWidths(table: string): [StoredWidths, (name: ColumnName, rem: number | null) => void] {
  const stored = useSyncExternalStore(
    subscribe,
    () => snapshot(table),
    serverSnapshot,
  );
  const setWidth = useCallback(
    (name: ColumnName, remValue: number | null) => {
      const next = withColumnWidth(snapshot(table), name, remValue);
      if (writeStoredWidths(table, next)) refused.delete(table);
      else refused.set(table, serializeColumnWidths(next));
      listeners.forEach((l) => l());
    },
    [table],
  );
  return [stored, setWidth];
}

// ---- the handles ----------------------------------------------------------------------------------------------

type Edge = { left: number; width: number; name: string };

function rootPx(): number {
  return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
}

/** The band's cells: where each one's right edge is, from the table's left, and the name it shows. */
function readEdges(table: HTMLTableElement): { edges: Edge[]; bandPx: number; sticky: boolean } {
  const head = table.tHead;
  const row = head?.rows[0];
  if (!head || !row) return { edges: [], bandPx: 0, sticky: false };
  const origin = table.getBoundingClientRect().left;
  const edges = Array.from(row.cells, (cell) => {
    const r = cell.getBoundingClientRect();
    return { left: r.left - origin, width: r.width, name: (cell.textContent ?? "").replace(/\s+/g, " ").trim() };
  });
  return { edges, bandPx: head.getBoundingClientRect().height, sticky: getComputedStyle(head).position === "sticky" };
}

function sameEdges(a: readonly Edge[], b: readonly Edge[]): boolean {
  return a.length === b.length && a.every((e, i) => Math.abs(e.left - b[i].left) < 0.5 && Math.abs(e.width - b[i].width) < 0.5 && e.name === b[i].name);
}

const HANDLE_PX = 8;

export function ColumnHandles({
  columns,
  rems,
  fill,
  roomRem,
  setWidth,
}: {
  columns: readonly ColumnName[];
  /** Each column's width in rem, in order; `undefined` for a column that takes what the others leave. */
  rems: readonly (number | undefined)[];
  /** The column that takes what the others leave: it has no handle. */
  fill?: ColumnName;
  /** How much wider the others may grow, read when a drag or a key starts. */
  roomRem: () => number;
  setWidth: (name: ColumnName, rem: number | null) => void;
}) {
  const t = useTranslations("shared.columnWidth");
  const [band, setBand] = useState<{ edges: Edge[]; bandPx: number; sticky: boolean }>({ edges: [], bandPx: 0, sticky: false });
  const [dragging, setDragging] = useState<ColumnName | null>(null);
  const drag = useRef<{ name: ColumnName; startX: number; startRem: number; room: number; px: number } | null>(null);
  const columnsKey = columns.join(" ");
  // The caption's own ref: a child's layout effect runs before its table's ref is attached.
  const captionRef = useRef<HTMLTableCaptionElement>(null);

  const read = useCallback(() => {
    const table = captionRef.current?.parentElement;
    if (!(table instanceof HTMLTableElement)) return;
    setBand((prev) => {
      const next = readEdges(table);
      return sameEdges(prev.edges, next.edges) && prev.bandPx === next.bandPx && prev.sticky === next.sticky ? prev : next;
    });
  }, []);

  useLayoutEffect(() => {
    const table = captionRef.current?.parentElement;
    if (!(table instanceof HTMLTableElement)) return;
    read();
    const sizes = new ResizeObserver(read);
    sizes.observe(table);
    if (table.tHead) sizes.observe(table.tHead);
    // The band's cells change without the table changing size: a column swapped for one as wide, a name translated.
    const cells = new MutationObserver(read);
    if (table.tHead) cells.observe(table.tHead, { childList: true, subtree: true, characterData: true });
    return () => {
      sizes.disconnect();
      cells.disconnect();
    };
  }, [columnsKey, read]);

  // A width just set moves the handles at once — not on the size observer's next frame, which a page drawn in the
  // background never reaches.
  const remsKey = rems.join(" ");
  useLayoutEffect(read, [remsKey, read]);

  const widthOf = (i: number): number => rems[i] ?? columnRem(columns[i]);

  const end = () => {
    drag.current = null;
    setDragging(null);
  };

  return (
    <caption
      ref={captionRef}
      className={`${band.sticky ? "sticky" : "relative"} top-0 z-[15] h-0 p-0 caption-top`}
      data-column-handles=""
    >
      {band.edges.map((edge, i) => {
        const name = columns[i];
        if (!name || name === fill || rems[i] === undefined) return null;
        const last = i === band.edges.length - 1;
        const right = edge.left + edge.width;
        const widthRem = widthOf(i);
        const step = (next: number) => setWidth(name, limitColumnRem(widthRem, next, roomRem()));
        return (
          <div
            key={`${name}-${i}`}
            className="absolute top-0"
            style={{ left: right - (last ? HANDLE_PX : HANDLE_PX / 2), height: band.bandPx }}
          >
            <IconTooltip label={t("hint")} className="h-full">
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label={edge.name ? t("label", { name: edge.name }) : t("labelNumber", { n: i + 1 })}
                aria-valuenow={Math.round(edge.width)}
                aria-valuemin={Math.round(Math.min(MIN_COLUMN_REM * 16, edge.width))}
                tabIndex={0}
                data-column-handle={name}
                data-dragging={dragging === name ? "" : undefined}
                className="group flex h-full cursor-col-resize touch-none justify-center outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
                style={{ width: HANDLE_PX }}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {
                    // A pointer the browser no longer tracks: the drag still follows the moves that reach the handle.
                  }
                  drag.current = { name, startX: e.clientX, startRem: widthRem, room: roomRem(), px: rootPx() };
                  setDragging(name);
                }}
                onPointerMove={(e) => {
                  const d = drag.current;
                  if (!d || d.name !== name) return;
                  setWidth(name, limitColumnRem(d.startRem, d.startRem + (e.clientX - d.startX) / d.px, d.room));
                }}
                onPointerUp={end}
                onPointerCancel={end}
                onLostPointerCapture={end}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setWidth(name, null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight") step(widthRem + COLUMN_STEP_REM);
                  else if (e.key === "ArrowLeft") step(widthRem - COLUMN_STEP_REM);
                  else if (e.key === "Home") setWidth(name, null);
                  else return;
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <span
                  aria-hidden="true"
                  className="h-full w-px bg-transparent group-hover:bg-fade group-focus-visible:bg-fade group-data-[dragging]:bg-ink dark:group-hover:bg-zinc-400 dark:group-focus-visible:bg-zinc-400 dark:group-data-[dragging]:bg-zinc-200"
                />
              </div>
            </IconTooltip>
          </div>
        );
      })}
    </caption>
  );
}

// ---- the tables ------------------------------------------------------------------------------------------------

/**
 * A table at fixed column widths (#37.16's `fixedTable` and `FixedColumns`, one piece since 40.12): `table-fixed`, its
 * `<colgroup>` from `COLUMN` — or the widths the user dragged — and exactly as wide as its columns; on a tile
 * (`fill`), the tile's width, its fill column taking what the others leave. `id` names the table in the store: one
 * per table, not per screen.
 */
/** How much a table's fill column, drawn at whatever the frame left it, is over `MIN_COLUMN_REM` — in rem. */
export function measuredRoomRem(table: HTMLTableElement | null, columns: readonly ColumnName[], fill: ColumnName): number {
  const i = columns.indexOf(fill);
  const cell = i < 0 ? undefined : table?.tHead?.rows[0]?.cells[i];
  if (!cell) return 0;
  return Math.max(0, cell.getBoundingClientRect().width / rootPx() - MIN_COLUMN_REM);
}

export function FixedTable({
  id,
  columns,
  className = "text-sm",
  fill,
  children,
}: {
  id: string;
  columns: readonly ColumnName[];
  className?: string;
  fill?: TileFill;
  children: ReactNode;
}) {
  const [stored, setWidth] = useColumnWidths(id);
  const tile = fill ? { column: fill.column, tableRem: fill.tableRem ?? tileTableRem(fill.units) } : undefined;
  const { rems, tableRem, roomRem } = resolveColumnRems(columns, stored, tile);
  // 41.16: a table that fills a tile of whole units follows the tile as drawn on the live unit — the table and its
  // fill column both gain what the tile is wider than on 119 px (`tileExtraCss`, nothing at the default unit).
  const extra = fill && fill.tableRem === undefined ? tileExtraCss(fill.units) : null;
  const fillAt = fill ? columns.indexOf(fill.column) : -1;
  // 41.17: a tile made narrower by its edge takes from the fill column down to a column's least width, no further —
  // past that the table is wider than its tile and scrolls inside its frame.
  const fillCss =
    extra && fillAt >= 0 ? `max(${rem(Math.min(MIN_COLUMN_REM, rems[fillAt]))}, calc(${rem(rems[fillAt])} + ${extra}))` : null;
  return (
    <table
      className={`table-fixed ${className} ${COLUMN_LINES}`}
      style={{ width: fillCss ? `calc(${rem(tableRem - rems[fillAt])} + ${fillCss})` : rem(tableRem) }}
      data-width-table={columns.join(" ")}
      data-resize-table={id}
    >
      <ColumnHandles
        columns={columns}
        rems={rems}
        fill={fill?.column}
        roomRem={() => roomRem}
        setWidth={setWidth}
      />
      <colgroup>
        {columns.map((name, i) => (
          <col
            key={`${name}-${i}`}
            style={{ width: fillCss && i === fillAt ? fillCss : rem(rems[i]) }}
            data-fill-gain={fill && name === fill.column ? rems[i] - columnRem(name) : undefined}
            data-fill-base={fillCss && i === fillAt ? columnRem(name) : undefined}
            data-width-stored={stored[name] !== undefined && name !== fill?.column ? "" : undefined}
          />
        ))}
      </colgroup>
      {children}
    </table>
  );
}
