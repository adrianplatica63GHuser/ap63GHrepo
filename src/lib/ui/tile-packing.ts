/**
 * WHERE EACH TILE STANDS: RIGHT UNDER THE TILE ABOVE IT.         (Slice #37.75)
 *
 * The tile row used to be a flex-wrap: tiles in the registry's order wrapped
 * into lines, each line as tall as its tallest tile, so a short tile left a
 * hole under it and the next line started under the tallest — on a Natural
 * Person „Clasificări" waited under „Corelate" instead of standing
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
 * corespondență" back on the left, and „Clasificări" under the
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
 * A FIXED BOX (Slice #37.79) is a tile of the right column — the Property's
 * map, corners and Street View, the Document's page image — standing where it
 * stands, against the row's right edge: it is placed exactly there, and no
 * flow, no growth and no stored place ever moves it. The FLOW keeps to the
 * left area's columns (`flowColumns`), so a screen opens as before, the column
 * alone on the right; the space under the lowest fixed box is free for a
 * DRAGGED tile (`canDrop` sees the row's whole width). A fixed box that grows
 * pushes the boxes under it down, as any box does. The action bar stands under
 * every box that is not fixed: the column beside it is not in its way.
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
  /** Slice #37.79: a right-column tile, at this place and never moved. */
  fixed?: { col: number; top: number };
}

/** A placed box: its first column (0-based), its units, its top and height in px. */
export interface Placed {
  id: string;
  col: number;
  units: number;
  top: number;
  height: number;
  rowEnd?: boolean;
  /** Slice #37.79: a right-column tile — never moved, never stored. */
  fixed?: boolean;
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
export function packTiles(boxes: readonly PackBox[], columns: number, gap: number, flowColumns = columns): Placed[] {
  const cols = Math.max(1, Math.floor(Math.min(flowColumns, columns)));
  const placed: Placed[] = fixedBoxes(boxes);
  const ends: PackBox[] = [];
  let next = 0; // the first free column of the current line
  for (const box of boxes) {
    if (box.fixed) continue;
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
  let top = endsTop(placed, gap);
  for (const box of ends) {
    placed.push({ id: box.id, col: 0, units: cols, top, height: box.height, rowEnd: true });
    top += box.height + gap;
  }
  return placed;
}

/** The fixed boxes, at their places (Slice #37.79). */
export function fixedBoxes(boxes: readonly PackBox[]): Placed[] {
  return boxes
    .filter((b) => b.fixed)
    .map((b) => ({ id: b.id, col: b.fixed!.col, units: Math.max(1, Math.round(b.units)), top: b.fixed!.top, height: b.height, fixed: true }));
}

/** Where the row-end boxes start: under every box but the fixed ones and the row ends. */
export function endsTop(placed: readonly Placed[], gap: number): number {
  const body = placed.filter((p) => !p.rowEnd && !p.fixed);
  return body.length ? Math.max(...body.map(bottom)) + gap : 0;
}

/**
 * A box changed height. Growing, it pushes every box it now overlaps down by
 * as much as it overlaps, and so on down the screen; shrinking, nothing moves.
 * Row-end boxes always stay under everything.
 */
export function grow(placed: readonly Placed[], id: string, height: number, gap: number): Placed[] {
  const me = placed.find((p) => p.id === id);
  return me ? settle(placed, id, me.top, height, gap) : placed.map((p) => ({ ...p }));
}

/**
 * A box now stands at `top`, `height` tall (Slice #37.79: a fixed tile that a
 * tile above it in the column pushed down, or that grew). Reaching lower than
 * it did, it pushes the boxes it now overlaps down, and so on down the screen;
 * a fixed box is never pushed.
 */
export function settle(placed: readonly Placed[], id: string, top: number, height: number, gap: number): Placed[] {
  const next = placed.map((p) => ({ ...p }));
  const me = next.find((p) => p.id === id);
  if (!me) return next;
  const lower = top + height > bottom(me);
  me.top = top;
  me.height = height;
  if (lower) {
    // Settle top to bottom: a moved box can push the ones under it in turn.
    const queue: Placed[] = [me];
    while (queue.length) {
      const mover = queue.shift()!;
      for (const other of next) {
        if (other === mover || other.rowEnd || other.fixed || other.top < mover.top) continue;
        if (overlaps(mover, other, gap)) {
          other.top = bottom(mover) + gap;
          queue.push(other);
        }
      }
    }
  }
  let endTop = endsTop(next, gap);
  for (const end of next.filter((p) => p.rowEnd)) {
    end.top = endTop;
    endTop += end.height + gap;
  }
  return next;
}

/** How tall the row must be to hold every box. The fixed boxes stand outside it (#37.79) unless `withFixed`. */
export function packedHeight(placed: readonly Placed[], withFixed = false): number {
  return placed.reduce((m, p) => (p.fixed && !withFixed ? m : Math.max(m, bottom(p))), 0);
}

/** How many whole units a row of `width` px holds, a unit being `unitPx` and the gap `gapPx`. */
export function columnsIn(width: number, unitPx: number, gapPx: number): number {
  return Math.max(1, Math.floor((width + gapPx + 0.5) / (unitPx + gapPx)));
}

/** How many units a box `width` px wide takes (a non-unit box, e.g. a compact preview, takes the next whole one). */
export function unitsOf(width: number, unitPx: number, gapPx: number): number {
  return Math.max(1, Math.ceil((width + gapPx - 0.5) / (unitPx + gapPx)));
}
