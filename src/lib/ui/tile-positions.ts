/**
 * A TILE DRAGGED TO FREE SPACE, AND REMEMBERED.                  (Slice #37.76)
 *
 * On the four record screens a tile is moved by pressing on its unused space
 * and dragging it (`use-tile-packing.ts` draws it). This is the pure half.
 *
 * THE FREE-SPACE RULE (`canDrop`). A tile is dropped only where its whole
 * rectangle is free: inside the row's units, at or below the top, and at
 * least PANEL_GAP from every other tile. It never pushes another — to put
 * it where another tile stands, the user first moves that one away. The
 * space under the lowest tile is always free; the form's action bar is not a
 * tile, it stands under everything wherever the tiles are.
 *
 * SNAPPED (`snapPlace`): whole units across, `ROW_STEP` down.
 *
 * REMEMBERED per browser and per kind of record — per document type — under
 * `tilePositionsKey(entity)`, beside the tile choice's key, as
 * `{ [box id]: { col, top } }`. `placeWithStored` reads it back:
 *   - a stored place the window cannot hold (fewer units across) is placed
 *     by #37.75's rule for that visit, and not written over (`fallback`);
 *   - a tile taller than the one the arrangement was made on pushes the
 *     tiles under it down — #37.75's growth rule;
 *   - a tile ticked again goes back to its stored place if that is free,
 *     otherwise by #37.75's rule (its place is taken: `fallback`);
 *   - a corrupt or out-of-range entry is ignored (`parseStoredPlaces`);
 *   - the form's banners („Modificări nesalvate", the sync notice — `full`
 *     boxes before every tile) stand at the top, and the stored places are
 *     counted from under them (`lead`), so a banner moves every tile down by
 *     its height and back, as in #37.75, and is never stored.
 * Previews are never stored. „Implicit" forgets the arrangement with the
 * tile choice (#37.76's Ask first).
 *
 * UNDER THE RIGHT COLUMN (Slice #37.79). The right column's tiles are FIXED
 * boxes (`PackBox.fixed`, id `fixed:<tile>`): placed where they stand, moved by
 * nothing, never stored. `columns` is the row's whole width and
 * `flowColumns` the left area's, so the flow places tiles as before and a drag
 * may put one in the free space under the column — or, a tile wider than the
 * column, under it and reaching into the left area. A stored place under the
 * column that this visit cannot hold (the column wrapped under the left area,
 * so there is no space beside it, or fewer units) falls back, not written
 * over; one a grown fixed tile now reaches into is pushed down.
 *
 * THE COLUMN WRAPPED (Slice #38.46). #37.79 read „While the column is wrapped
 * under the left area there are no fixed boxes" and left it at that: the
 * column then stood outside the packing, under the left area, so a tile
 * dropped „under" it landed in the left area and pushed it down again. Now its
 * tiles are boxes of the row (`WRAPPED_PREFIX`, `PackBox.under`), placed
 * under the left tiles and stored like tiles, so a tile dropped under one
 * stays there after a reload.
 *
 * RISEN INTO THE GAPS (Slice #38.16). A stored arrangement is laid out on
 * records it was not made on: a tile above may be unticked, shorter or empty,
 * and its stored places then leave holes — a tile the user put under two
 * tiles kept its top when one of those two was gone. So once the stored
 * places and the fallbacks are placed, `riseIntoGaps` moves every tile up, in
 * its own columns, toward the tile above it (PANEL_GAP below it) or the top of
 * the row, under the banners (`lead`) — the place #37.75's flow gives a
 * freshly opened screen. Top to bottom, so each column keeps its order; never
 * sideways, never lower. Fixed boxes, banners and the action bar never rise;
 * the action bar is then placed under everything. With nothing stored
 * `placeWithStored` is `packTiles` and nothing rises: the flow already stands
 * each tile right under the one above it. The STORED places are not rewritten
 * by a layout — the rise is what this visit shows.
 *
 * A GAP LEFT ON PURPOSE IS KEPT (Slice #38.45). #38.16 said „Every gap closes,
 * not only large ones (#38.16's Ask first 1)", and „a drop stores the places
 * as they stand after it, the dropped tile risen too (#38.16's Ask first 2)".
 * Both are reversed: Adrian rearranges by moving a tile away to make room, and
 * the room closed under him at once. Now a drop moves only the dropped tile
 * (`dropAt`), and what is stored with each place is the empty space the user
 * left above it (`StoredPlace.space`: its top minus `ceilingOf` — right under
 * the lowest tile above it in its columns). A layout rises a tile only by what
 * a tile above it gave up since then — unticked, shorter or empty — so the gap
 * the user left stays at its stored size (#38.45's Ask first 1). An entry
 * stored before #38.45 has no `space` and closes every gap, as it did. A
 * DOUBLE-CLICK on a tile's unused space rises that one tile, alone, to its
 * ceiling (`riseOne`); nothing else moves, and it is stored like a drop.
 *
 * PURE — no DOM, no React; `tile-positions.test.ts` covers it.
 */
import { endsTop, fixedBoxes, freeUnder, overlaps, packTiles, topUnder, type PackBox, type Placed } from "./tile-packing";

/** A box's stored place: its first column (0-based) and its top in px. */
export interface StoredPlace {
  col: number;
  top: number;
  /**
   * The empty space left above it on purpose, in px past PANEL_GAP: its top
   * minus `ceilingOf` when it was stored (#38.45). Absent, none — every entry
   * stored before #38.45 — and the layout closes the gap above it.
   */
  space?: number;
}

export type StoredPlaces = Readonly<Record<string, StoredPlace>>;

/** The step a dragged tile snaps to down the screen, in px (half a PANEL_GAP). */
export const ROW_STEP = 8;

/** The largest top a stored place may have, in px: past it the entry is out of range. */
export const MAX_TOP = 100_000;

/**
 * PANEL_GAP in px at the browser's default 16-px rem (`PANEL_GAP_REM` = 1):
 * what `placesToStore` measures the stored space with when it is not told.
 * The hook always tells it the gap it measured.
 */
export const DEFAULT_GAP_PX = 16;

/** Where a screen's arrangement is kept: beside `tileStorageKey(entity)`. */
export function tilePositionsKey(entity: string): string {
  return `ga40-tile-positions-${entity}-v1`;
}

/** The window event „Implicit" sends, so a screen whose tiles did not change lays itself out afresh. */
export const TILE_POSITIONS_RESET = "ga40-tile-positions-reset";

/** Is this box's place ever stored? A preview's is not, nor a banner's (a box of no tile, „box#n"). */
export function isStorable(id: string): boolean {
  return !id.startsWith("preview") && !id.startsWith("box#") && !id.startsWith(FIXED_PREFIX);
}

/** A right-column tile's box id (Slice #37.79): `fixed:<tile>`. */
export const FIXED_PREFIX = "fixed:";

/**
 * A right-column tile's box id while the column is wrapped under the left
 * area (Slice #38.46): `wrapped:<tile>`. Placed and stored like a tile, so a
 * tile dropped under it stays there after a reload; never dragged. Beside, the
 * same tile is `fixed:<tile>`, and its wrapped entry is kept for next time.
 */
export const WRAPPED_PREFIX = "wrapped:";

/** The stored places, each checked; anything corrupt or out of range is left out. */
export function parseStoredPlaces(raw: string | null | undefined): Record<string, StoredPlace> {
  if (!raw) return {};
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const out: Record<string, StoredPlace> = {};
  for (const [id, v] of Object.entries(data as Record<string, unknown>)) {
    if (!isStorable(id) || !v || typeof v !== "object") continue;
    const { col, top } = v as { col?: unknown; top?: unknown };
    if (!Number.isInteger(col) || (col as number) < 0 || (col as number) > 64) continue;
    if (typeof top !== "number" || !Number.isFinite(top) || top < 0 || top > MAX_TOP) continue;
    out[id] = { col: col as number, top: Math.round(top) };
    // #38.45: a corrupt space is no space — the place itself still holds.
    const { space } = v as { space?: unknown };
    if (typeof space === "number" && Number.isFinite(space) && space >= 1 && space <= MAX_TOP) out[id].space = Math.round(space);
  }
  return out;
}

/** The nearest place on the grid to a box whose top-left corner is at `x`, `y` px in the row. */
export function snapPlace(x: number, y: number, unitPx: number, gapPx: number, step = ROW_STEP): StoredPlace {
  return { col: Math.max(0, Math.round(x / (unitPx + gapPx))), top: Math.max(0, Math.round(y / step) * step) };
}

/** May box `id` stand at `place`? Its whole rectangle free, inside the row's units. */
export function canDrop(placed: readonly Placed[], id: string, place: StoredPlace, columns: number, gap: number): boolean {
  const me = placed.find((p) => p.id === id);
  if (!me || me.fixed || me.rowEnd) return false;
  if (place.col < 0 || place.top < 0 || place.col + me.units > columns) return false;
  const rect = { col: place.col, units: me.units, top: place.top, height: me.height };
  return placed.every((p) => p.id === id || p.rowEnd || !overlaps(p, rect, gap));
}

/** The arrangement after box `id` is dropped at `place` (checked by `canDrop` first). Nothing else moves. */
export function dropAt(placed: readonly Placed[], id: string, place: StoredPlace, gap: number): Placed[] {
  const next = placed.map((p) => (p.id === id ? { ...p, col: place.col, top: place.top } : { ...p }));
  return withRowEnds(next, gap);
}

/** The row-end boxes (the action bar) re-placed under everything. */
function withRowEnds(placed: Placed[], gap: number): Placed[] {
  let top = endsTop(placed, gap);
  for (const end of placed.filter((p) => p.rowEnd)) {
    end.top = top;
    top += end.height + gap;
  }
  return placed;
}

/**
 * The highest box `me` may stand in its own columns (#38.45): right under the
 * lowest box above it there, PANEL_GAP below it, or the top of the row under
 * the banners (`lead`). Only what stands above it counts: a fixed tile lower
 * in its columns is not a ceiling, and a row end is never one.
 */
export function ceilingOf(placed: readonly Placed[], me: Placed, gap: number, lead = 0): number {
  const above = placed.filter((p) => p.id !== me.id && !p.rowEnd && p.top < me.top);
  return Math.max(lead, topUnder(above, me.col, me.units, gap));
}

/**
 * Every box that is not fixed, not a banner (`still`) and not a row end
 * risen, top to bottom (then left to right), toward the highest place in its
 * own columns (`ceilingOf` the boxes already settled), and stopped `space`
 * px short of it — the gap the user left above it (#38.45; none, it closes).
 * Never lower than it stood, never sideways; the row ends then go under
 * everything. (#38.16)
 */
export function riseIntoGaps(
  placed: readonly Placed[],
  gap: number,
  lead = 0,
  still: ReadonlySet<string> = new Set(),
  space: Readonly<Record<string, number>> = {},
): Placed[] {
  const out = placed.map((p) => ({ ...p }));
  const moves = (p: Placed): boolean => !p.fixed && !p.rowEnd && !still.has(p.id);
  const settled = out.filter((p) => !p.rowEnd && !moves(p));
  for (const me of out.filter(moves).sort((a, b) => a.top - b.top || a.col - b.col)) {
    me.top = Math.min(me.top, ceilingOf(settled, me, gap, lead) + (space[me.id] ?? 0));
    settled.push(me);
  }
  return withRowEnds(out, gap);
}

/**
 * A DOUBLE-CLICK's rise (#38.45): box `id` alone, in its own columns, up to
 * its ceiling — right under the lowest box above it (PANEL_GAP below), or
 * `lead`. Never sideways; nothing else moves but the row ends, which go under
 * everything. `null` when it cannot rise: already there, fixed, a row end, or
 * not placed.
 */
export function riseOne(placed: readonly Placed[], id: string, gap: number, lead = 0): Placed[] | null {
  const me = placed.find((p) => p.id === id);
  if (!me || me.fixed || me.rowEnd) return null;
  const top = ceilingOf(placed, me, gap, lead);
  if (top >= me.top - 0.5) return null;
  return dropAt(placed, id, { col: me.col, top }, gap);
}

/** The first top at or below `from` where a box of `units` × `height` at `col` is free. */
function firstFree(placed: readonly Placed[], col: number, units: number, height: number, from: number, gap: number): number {
  const tops = [...new Set([from, ...placed.map((p) => p.top + p.height + gap).filter((t) => t >= from)])].sort((a, b) => a - b);
  for (const top of tops) if (placed.every((p) => !overlaps(p, { col, units, top, height }, gap))) return top;
  return placed.reduce((m, p) => Math.max(m, p.top + p.height + gap), from);
}

/**
 * Every box placed, the stored ones at their stored places, the rest by
 * #37.75's rule around them. `fallback` names the boxes whose stored place
 * could not be used this visit — a later drop must not write over it.
 * With nothing stored this is exactly `packTiles`. `columns` is the row's
 * width, `flowColumns` the left area's (#37.79): the flow keeps to the left
 * area, a stored place may stand anywhere in the row that is free.
 */
export function placeWithStored(
  boxes: readonly PackBox[],
  stored: StoredPlaces,
  columns: number,
  gap: number,
  flowColumns = columns,
): { placed: Placed[]; fallback: string[]; lead: number } {
  const cols = Math.max(1, Math.floor(columns));
  const fcols = Math.max(1, Math.min(cols, Math.floor(flowColumns)));
  // The banners before every tile: at the top, the stored places counted from under them.
  const leading: PackBox[] = [];
  for (const b of boxes) {
    if (b.full) leading.push(b);
    else if (!b.rowEnd) break;
  }
  const lead = leading.reduce((h, b) => h + b.height + gap, 0);
  const usable = boxes.filter((b) => !b.rowEnd && !b.full && !b.fixed && stored[b.id] && stored[b.id].col + Math.min(Math.round(b.units), cols) <= cols);
  if (usable.length === 0) {
    return { placed: packTiles(boxes, cols, gap, fcols), fallback: boxes.filter((b) => stored[b.id]).map((b) => b.id), lead };
  }
  const fallback = new Set(boxes.filter((b) => stored[b.id] && !usable.includes(b)).map((b) => b.id));
  const placed: Placed[] = [];
  let bannerTop = 0;
  for (const b of leading) {
    placed.push({ id: b.id, col: 0, units: fcols, top: bannerTop, height: b.height });
    bannerTop += b.height + gap;
  }
  // The right column's tiles, where they stand: nothing moves them (#37.79).
  placed.push(...fixedBoxes(boxes));
  // The stored ones first, top to bottom: each at its place, pushed down when a taller tile above now reaches into it.
  for (const box of [...usable].sort((a, b) => stored[a.id].top - stored[b.id].top || stored[a.id].col - stored[b.id].col)) {
    const units = Math.max(1, Math.min(Math.round(box.units), cols));
    const col = stored[box.id].col;
    const top = stored[box.id].top + lead;
    const rect = { col, units, top, height: box.height };
    const blockers = placed.filter((p) => overlaps(p, rect, gap));
    if (blockers.length === 0) {
      placed.push({ id: box.id, col, units, top, height: box.height });
    } else if (blockers.every((p) => p.fixed || p.top < top)) {
      // A fixed tile is never „taken" ground: one that now reaches into the place pushes the tile under it —
      // also when it starts exactly where the tile does, which a risen tile under the column always does (#38.16).
      placed.push({ id: box.id, col, units, top: firstFree(placed, col, units, box.height, top, gap), height: box.height });
    } else {
      fallback.add(box.id); // its place is taken
    }
  }
  // The rest by #37.75's rule — columns from the line-by-line order, risen under the boxes the rule placed — and never into a stored one.
  const flow: Placed[] = [];
  const ends: PackBox[] = [];
  let next = 0;
  let under = false; // #38.46: the wrapped column's line has started
  for (const box of boxes) {
    if (placed.some((p) => p.id === box.id)) continue;
    if (box.rowEnd) {
      ends.push(box);
      continue;
    }
    if (box.under && !under) {
      under = true;
      next = 0;
    }
    const units = box.full ? fcols : Math.max(1, Math.min(Math.round(box.units), fcols));
    const all = [...placed, ...flow];
    const anchor = box.anchor ? all.find((p) => p.id === box.anchor) : undefined;
    if (anchor) {
      const at = freeUnder(all, anchor, units, box.height, fcols, gap);
      flow.push({ id: box.id, col: at.col, units, top: at.top, height: box.height });
      continue;
    }
    if (next > 0 && next + units > fcols) next = 0;
    const col = next;
    // A wrapped column tile goes under every box above it in its columns, a stored one too (#38.46).
    const top = firstFree(all, col, units, box.height, topUnder(box.under ? all : flow, col, units, gap), gap);
    flow.push({ id: box.id, col, units, top, height: box.height });
    next = col + units >= fcols ? 0 : col + units;
  }
  // #38.16: then every tile rises into the empty space above it; the banners stay where they stand.
  // #38.45: a stored tile only by what the tiles above it gave up — the space the user left above it stays.
  const space = Object.fromEntries(usable.filter((b) => !fallback.has(b.id)).map((b) => [b.id, stored[b.id].space ?? 0]));
  const out = riseIntoGaps([...placed, ...flow], gap, lead, new Set(boxes.filter((b) => b.full).map((b) => b.id)), space);
  // Back in the boxes' order, so the DOM's order and the placed order agree.
  const order = new Map(boxes.map((b, i) => [b.id, i]));
  out.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  let top = endsTop(out, gap);
  for (const box of ends) {
    out.push({ id: box.id, col: 0, units: fcols, top, height: box.height, rowEnd: true });
    top += box.height + gap;
  }
  return { placed: out, fallback: [...fallback], lead };
}

/**
 * Box `p`'s place as it now stands, counted from under the banners (`lead`),
 * with the empty space above it (#38.45) when there is any.
 */
export function storedPlaceOf(placed: readonly Placed[], p: Placed, gap: number, lead = 0): StoredPlace {
  const place: StoredPlace = { col: p.col, top: Math.max(0, Math.round(p.top - lead)) };
  const space = Math.round(p.top - ceilingOf(placed, p, gap, lead));
  if (space >= 1) place.space = space;
  return place;
}

/**
 * What a drop — or a double-click's rise — writes: every storable box's place
 * as it now stands (`storedPlaceOf`), but an entry this visit could not use is kept
 * as it was (`fallback`), and an entry for a tile not on screen (unticked) is
 * kept too.
 */
export function placesToStore(
  placed: readonly Placed[],
  previous: StoredPlaces,
  fallback: readonly string[],
  dropped: string,
  lead = 0,
  gap = DEFAULT_GAP_PX,
): Record<string, StoredPlace> {
  const out: Record<string, StoredPlace> = { ...previous };
  for (const p of placed) {
    if (p.rowEnd || p.fixed || !isStorable(p.id)) continue;
    if (fallback.includes(p.id) && p.id !== dropped) continue;
    out[p.id] = storedPlaceOf(placed, p, gap, lead);
  }
  return out;
}
