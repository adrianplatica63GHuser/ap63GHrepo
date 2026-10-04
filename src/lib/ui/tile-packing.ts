/**
 * WHERE EACH TILE STANDS: RIGHT UNDER THE TILE ABOVE IT.         (Slice #37.75)
 *
 * The tile row used to be a flex-wrap: tiles in the registry's order wrapped
 * into lines, each line as tall as its tallest tile, so a short tile left a
 * hole under it and the next line started under the tallest — on a Natural
 * Person „Clasificare subiectivă" waited under „Corelate" instead of standing
 * under the two address boxes; on a company a preview opened far below the
 * „Corelate" it came from (Adrian, 2026-10-03).
 *
 * THE RULE. Each box takes its COLUMNS as the wrapping row gave them — the
 * registry's order, left to right, a new line when the next box's units no
 * longer fit — and then RISES to the highest place in those columns that is
 * free: right under the lowest box above it, PANEL_GAP below. So a box stands
 * right under the tile above it, never under the tallest tile of the line
 * before, and the boxes keep the arrangement the user reads them in.
 *
 * ⚠️ **NOT „THE HIGHEST FREE PLACE ANYWHERE".** That reading of #37.75's
 * header moves a box to whatever column ends highest: at 1920 px it put
 * „Adresă domiciliu" under „Contact" on the far right, „Adresă
 * corespondență" back on the left, and „Clasificare subiectivă" under the
 * identity card rather than under the address boxes — the opposite of the
 * header's own expected result. Measured on #37.75's synthetic person, and
 * `tile-packing.test.ts` keeps both fixtures.
 *
 * A box marked `full` (the form's „Modificări nesalvate" banner and its sync
 * notice — `basis-full`) is a line of its own, the row's whole width. A box
 * marked `rowEnd` (the form's action bar — `order-last basis-full`) is the
 * row's last line, under everything.
 *
 * A PREVIEW opens at the highest free place under the tile its
 * „Previzualizare" was pressed in, in that tile's columns; if its width is not
 * free there, at the first free place below that holds it (`freeUnder`). With
 * no such tile on the screen it flows like a tile.
 *
 * A TILE THAT GROWS — a list fills, a field wraps, a tag is added — moves the
 * boxes under it down by as much as it now overlaps them (`grow`). That is
 * the only way a box moves by itself; one that shrinks leaves its place, so
 * nothing jumps while the user types.
 *
 * POSITIONS ARE DATA: a column in units and a place down the screen in px.
 * The screens measure and draw (`use-tile-packing.ts`); #37.76 stores
 * positions in place of what this computes, and falls back to it.
 *
 * PURE — no DOM, no React; `tile-packing.test.ts` covers it.
 */

/** One box to place. `units` is its width in whole units; `height` in px. */
export interface PackBox {
  id: string;
  units: number;
  height: number;
  /** A preview: the id of the box its „Previzualizare" was pressed in. */
  anchor?: string;
  /** A line of its own, the row's whole width (a banner). */
  full?: boolean;
  /** The row's last line, full width, under everything (the action bar). */
  rowEnd?: boolean;
}

/** A placed box: its first column (0-based), its units, its top and height in px. */
export interface Placed {
  id: string;
  col: number;
  units: number;
  top: number;
  height: number;
  rowEnd?: boolean;
}

type Rect = Pick<Placed, "col" | "units" | "top" | "height">;

const bottom = (p: Rect): number => p.top + p.height;

/** Do two boxes share a column? */
function across(a: Pick<Placed, "col" | "units">, b: Pick<Placed, "col" | "units">): boolean {
  return a.col < b.col + b.units && b.col < a.col + a.units;
}

/** Do two boxes share a column and come within `gap` of each other down the screen? */
export function overlaps(a: Rect, b: Rect, gap: number): boolean {
  if (!across(a, b)) return false;
  return !(b.top >= a.top + a.height + gap || a.top >= b.top + b.height + gap);
}

/** The highest top in columns `col`…`col + units - 1`: under the lowest box placed there, or 0. */
export function topUnder(placed: readonly Placed[], col: number, units: number, gap: number): number {
  return placed.reduce((top, p) => (across(p, { col, units }) ? Math.max(top, bottom(p) + gap) : top), 0);
}

/** Under `anchor`, in its columns: the first free place at or below its bottom that holds the box. */
export function freeUnder(placed: readonly Placed[], anchor: Placed, units: number, height: number, columns: number, gap: number): { col: number; top: number } {
  const span = Math.min(units, columns);
  const col = Math.max(0, Math.min(anchor.col, columns - span));
  const from = bottom(anchor) + gap;
  const tops = [...new Set([from, ...placed.map((p) => bottom(p) + gap).filter((t) => t >= from)])].sort((a, b) => a - b);
  for (const top of tops) {
    if (placed.every((p) => !overlaps(p, { col, units: span, top, height }, gap))) return { col, top };
  }
  // Unreachable — under every box is always free — but a total function is safer than a throw.
  return { col, top: placed.reduce((m, p) => Math.max(m, bottom(p) + gap), from) };
}

/**
 * Every box placed by the rule, in the order given (the registry's — the
 * DOM's, or the CSS `order` a screen gives its tiles). Row-end boxes last.
 */
export function packTiles(boxes: readonly PackBox[], columns: number, gap: number): Placed[] {
  const cols = Math.max(1, Math.floor(columns));
  const placed: Placed[] = [];
  const ends: PackBox[] = [];
  let next = 0; // the first free column of the current line
  for (const box of boxes) {
    if (box.rowEnd) {
      ends.push(box);
      continue;
    }
    const units = box.full ? cols : Math.max(1, Math.min(Math.round(box.units), cols));
    const anchor = box.anchor ? placed.find((p) => p.id === box.anchor) : undefined;
    if (anchor) {
      const at = freeUnder(placed, anchor, units, box.height, cols, gap);
      placed.push({ id: box.id, col: at.col, units, top: at.top, height: box.height });
      continue;
    }
    if (next > 0 && next + units > cols) next = 0;
    const col = next;
    placed.push({ id: box.id, col, units, top: topUnder(placed, col, units, gap), height: box.height });
    next = col + units >= cols ? 0 : col + units;
  }
  let top = placed.length ? Math.max(...placed.map(bottom)) + gap : 0;
  for (const box of ends) {
    placed.push({ id: box.id, col: 0, units: cols, top, height: box.height, rowEnd: true });
    top += box.height + gap;
  }
  return placed;
}

/**
 * A box changed height. Growing, it pushes every box it now overlaps down by
 * as much as it overlaps, and so on down the screen; shrinking, nothing moves.
 * Row-end boxes always stay under everything.
 */
export function grow(placed: readonly Placed[], id: string, height: number, gap: number): Placed[] {
  const next = placed.map((p) => ({ ...p }));
  const me = next.find((p) => p.id === id);
  if (!me) return next;
  const grew = height > me.height;
  me.height = height;
  if (grew) {
    // Settle top to bottom: a moved box can push the ones under it in turn.
    const queue: Placed[] = [me];
    while (queue.length) {
      const mover = queue.shift()!;
      for (const other of next) {
        if (other === mover || other.rowEnd || other.top < mover.top) continue;
        if (overlaps(mover, other, gap)) {
          other.top = bottom(mover) + gap;
          queue.push(other);
        }
      }
    }
  }
  let top = Math.max(0, ...next.filter((p) => !p.rowEnd).map((p) => bottom(p) + gap));
  for (const end of next.filter((p) => p.rowEnd)) {
    end.top = top;
    top += end.height + gap;
  }
  return next;
}

/** How tall the row must be to hold every box. */
export function packedHeight(placed: readonly Placed[]): number {
  return placed.reduce((m, p) => Math.max(m, bottom(p)), 0);
}

/** How many whole units a row of `width` px holds, a unit being `unitPx` and the gap `gapPx`. */
export function columnsIn(width: number, unitPx: number, gapPx: number): number {
  return Math.max(1, Math.floor((width + gapPx + 0.5) / (unitPx + gapPx)));
}

/** How many units a box `width` px wide takes (a non-unit box, e.g. a compact preview, takes the next whole one). */
export function unitsOf(width: number, unitPx: number, gapPx: number): number {
  return Math.max(1, Math.ceil((width + gapPx - 0.5) / (unitPx + gapPx)));
}
