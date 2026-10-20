/**
 * A list's column widths as the user dragged them — the pure part.                                  (Slice 40.12)
 *
 * Adrian, 2026-10-20: „the lists for the principal objects must have a vertical divider similar to the horizontal
 * dividers between rows and we should be able to grab this divider on the title bar Move it left or right to change
 * the width of the column; This should apply to all the lists and tables that are similar to the lists of principal
 * objects". The line, its handle and the table that keeps the width are `src/components/table/column-resize.tsx`;
 * this file is what they decide with:
 *   - a column is never narrower than `MIN_COLUMN_REM` — room for the funnel and a few letters — and has no upper
 *     limit, but on a table that fills its tile it never grows by more than the fill column can give (Ask first 4, 5);
 *   - the widths are kept per table and per column, in rem, in this browser's localStorage beside „Câmpuri afișate"'s
 *     choice (Ask first 6). A column that is not shown keeps its width for when it comes back; removing a column's
 *     width gives it `COLUMN`'s again;
 *   - a table that fills its tile keeps the tile's width: its fill column takes what the others leave, and never goes
 *     under 3 rem — or under what it had before anything was dragged, when that was already less (Ask first 5).
 *
 * #37.12's rule holds: the window still never sets a width. Only the user's drag does, and only on the columns dragged.
 */
import { columnRem, type ColumnName } from "@/lib/ui/field-widths";

/** No column is narrower: the funnel and a few letters. */
export const MIN_COLUMN_REM = 3;

/** Left and Right on a focused handle change the width by this much. */
export const COLUMN_STEP_REM = 0.5;

/** A table's stored widths: column name → rem. */
export type StoredWidths = Readonly<Record<string, number>>;

export const NO_WIDTHS: StoredWidths = Object.freeze({});

const KEY_PREFIX = "ga40-colw-v1:";

/** The localStorage key for one table's widths. */
export function columnWidthsKey(table: string): string {
  return KEY_PREFIX + table;
}

/** Whether a localStorage key is one of these. */
export function isColumnWidthsKey(key: string | null): boolean {
  return key === null || key.startsWith(KEY_PREFIX);
}

/** A stored value read back: anything that is not a width of at least `MIN_COLUMN_REM` is dropped. */
export function parseColumnWidths(raw: string | null | undefined): StoredWidths {
  if (!raw) return NO_WIDTHS;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return NO_WIDTHS;
    const out: Record<string, number> = {};
    for (const [name, rem] of Object.entries(value)) {
      if (typeof rem === "number" && Number.isFinite(rem) && rem >= MIN_COLUMN_REM) out[name] = rem;
    }
    return Object.keys(out).length ? out : NO_WIDTHS;
  } catch {
    return NO_WIDTHS;
  }
}

/** What is written: `null` when nothing is stored, so the key goes away. */
export function serializeColumnWidths(widths: StoredWidths): string | null {
  return Object.keys(widths).length ? JSON.stringify(widths) : null;
}

/** One column's width set (`rem`) or given back to `COLUMN`'s (`null`); every other column's is kept. */
export function withColumnWidth(widths: StoredWidths, name: string, rem: number | null): StoredWidths {
  const next: Record<string, number> = { ...widths };
  if (rem === null) delete next[name];
  else next[name] = Math.round(rem * 1000) / 1000;
  return Object.keys(next).length ? next : NO_WIDTHS;
}

/**
 * The width a drag or a key asks for, limited: never under `MIN_COLUMN_REM`, and never more than `roomRem` wider than
 * where it started — what a tile's fill column can still give. A column already under the minimum is not pushed up.
 */
export function limitColumnRem(startRem: number, wantedRem: number, roomRem = Number.POSITIVE_INFINITY): number {
  const floor = Math.min(MIN_COLUMN_REM, startRem);
  const ceiling = startRem + Math.max(0, roomRem);
  return Math.max(floor, Math.min(wantedRem, ceiling));
}

/** A table that fills its tile: which column takes what the others leave, and the table's width. */
export type FillRem = { column: ColumnName; tableRem: number };

export type ResolvedWidths = {
  /** Each column's width, in the order given. */
  rems: number[];
  /** The table's width: the columns' sum, or the tile's width. */
  tableRem: number;
  /** How far the fill column is over its floor — how much more the others may take. Infinite without a fill. */
  roomRem: number;
};

/** Every column's width: its stored one, else `COLUMN`'s; on a tile, the fill column's from what the others leave. */
export function resolveColumnRems(columns: readonly ColumnName[], stored: StoredWidths, fill?: FillRem): ResolvedWidths {
  const base = columns.map((name) => stored[name] ?? columnRem(name));
  if (!fill || !columns.includes(fill.column)) {
    return { rems: base, tableRem: base.reduce((sum, w) => sum + w, 0), roomRem: Number.POSITIVE_INFINITY };
  }
  const othersOf = (widths: readonly number[]) =>
    widths.reduce((sum, w, i) => (columns[i] === fill.column ? sum : sum + w), 0);
  const asDrawn = fill.tableRem - othersOf(columns.map((name) => columnRem(name)));
  const floor = Math.min(MIN_COLUMN_REM, asDrawn);
  const others = othersOf(base);
  const fillRem = Math.max(floor, fill.tableRem - others);
  return {
    rems: columns.map((name, i) => (name === fill.column ? fillRem : base[i])),
    tableRem: others + fillRem,
    roomRem: fillRem - floor,
  };
}

/** Read one table's widths from this browser; nothing when storage is not there. */
export function readStoredWidthsRaw(table: string): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(columnWidthsKey(table));
  } catch {
    return null;
  }
}

/** Write one table's widths; `false` when storage refused (a private window, a full quota). */
export function writeStoredWidths(table: string, widths: StoredWidths): boolean {
  try {
    const raw = serializeColumnWidths(widths);
    if (raw === null) window.localStorage.removeItem(columnWidthsKey(table));
    else window.localStorage.setItem(columnWidthsKey(table), raw);
    return true;
  } catch {
    return false;
  }
}
