/**
 * A TILE DRAGGED TO FREE SPACE, AND REMEMBERED.                  (Slice #37.76)
 *
 * On the four record screens a tile is moved by pressing on its unused space
 * and dragging it (`use-tile-packing.ts` draws it). This is the pure half.
 *
 * THE FREE-SPACE RULE (`canDrop`). A tile is dropped only where its whole
 * rectangle is free: inside the row's units, at or below the top, and at
 * least PANEL_GAP from every other tile. A drop never pushes another: to put
 * it where another tile stands, the user HOLDS it there — the outline still
 * for `MAKE_ROOM_DELAY_MS` — and that tile slides down out of the way
 * (`makeRoom`, Slice 39.91), or first moves that one away by hand. Until
 * 39.91 this read: „It never pushes another — to put it where another tile
 * stands, the user first moves that one away." The space under the lowest
 * tile is always free; the form's action bar is not a tile, it stands under
 * everything wherever the tiles are.
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
 * A TILE HELD OVER ANOTHER MAKES ROOM (Slice 39.91). Adrian: „that tile
 * should slide down until it finds an available spot, large enough, to make
 * room for me to drop off the tile I am moving". While a tile is dragged and
 * its snapped outline has stood still over other tiles for the make-room
 * delay (`MAKE_ROOM_DELAY_MS`, read by the hook through one function), every
 * tile the outline overlaps slides DOWN, top to bottom, never sideways, each
 * to the first place below it in its own columns where its whole rectangle is
 * free — at least PANEL_GAP from every other tile and from the outline —
 * jumping past the tiles under it rather than pushing them (`makeRoom`). The
 * dragged tile's own place counts as taken, so nothing slides into it and Esc
 * still sends it home. A fixed box — a right-column tile, a banner, a wrapped
 * column tile (`still`) — never slides: an outline over one stays red however
 * long it is held. The row ends go under everything, as after a drop. The
 * hook undoes every slide of a drag on Esc or a refused release, and stores
 * them with the drop.
 *
 * THE RIGHT-HAND TILES MOVE (Slice 40.32). The tiles #37.79 made fixed are,
 * on the four record screens, boxes with a starting place (`PackBox.start`):
 * with nothing stored for one, it stands there — against the row's right edge,
 * as the column stood — and the flow keeps to the units left of it; once it is
 * dropped somewhere, that place is stored under its own tile name like any
 * other, and „Implicit" sends it back. An arrangement stored before 40.32 has
 * no entry for them, so they open at their starting places and nothing stored
 * is lost.
 *
 * „TOATE SUS" (Slice 40.40): every tile risen, then the tile columns evened — `allUp`, at the end of this file.
 *
 * PURE — no DOM, no React; `tile-positions.test.ts` covers it.
 */
import { endsTop, fixedBoxes, freeUnder, overlaps, packTiles, startBoxes, topUnder, type PackBox, type Placed } from "./tile-packing";

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
  /**
   * Slice 41.17: its width in units, set by dragging its right edge. Absent, the width its screen gives it — every
   * entry stored before 41.17 — so no arrangement stored earlier needs rewriting (no -v2). Units, not px, so a unit
   * changed on „Setări" (41.16) keeps every count.
   */
  units?: number;
}

export type StoredPlaces = Readonly<Record<string, StoredPlace>>;

/** The step a dragged tile snaps to down the screen, in px (half a PANEL_GAP). */
export const ROW_STEP = 8;

/**
 * How long a dragged tile's outline must stand still over other tiles before
 * they make room (Slice 39.91), in ms. Read only through `makeRoomDelayMs()`
 * (`src/components/tiles/make-room-delay.ts`), which 39.92 points at „Setări".
 */
export const MAKE_ROOM_DELAY_MS = 1000;

/** How long a tile takes to slide out of the way, or back (ms); instant under prefers-reduced-motion. */
export const MAKE_ROOM_SLIDE_MS = 200;

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
    // 41.17: a corrupt width is the screen's own width — the place itself still holds.
    const { units } = v as { units?: unknown };
    if (Number.isInteger(units) && (units as number) >= 1 && (units as number) <= MAX_UNITS) out[id].units = units as number;
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

/**
 * A TILE HELD OVER ANOTHER MAKES ROOM (Slice 39.91): the arrangement after
 * the tiles under box `id`'s outline at `place` slide down out of its way —
 * each, top to bottom, in its own columns, to the first place below it where
 * its whole rectangle is free of every other box, of the outline and of the
 * dragged box's own place (PANEL_GAP from each), jumping past the boxes under
 * it rather than pushing them. Nothing slides sideways or up; the row ends go
 * under everything. `still` names boxes that never slide beside the fixed
 * ones (the banners, the wrapped column's tiles). `null` when there is no room
 * to make: the outline overlaps nothing, reaches past the row's units, or
 * overlaps a box that never slides.
 */
export function makeRoom(
  placed: readonly Placed[],
  id: string,
  place: StoredPlace,
  columns: number,
  gap: number,
  still: ReadonlySet<string> = new Set(),
): { placed: Placed[]; slid: string[] } | null {
  const me = placed.find((p) => p.id === id);
  if (!me || me.fixed || me.rowEnd) return null;
  if (place.col < 0 || place.top < 0 || place.col + me.units > columns) return null;
  const outline: Placed = { id: "(outline)", col: place.col, units: me.units, top: place.top, height: me.height };
  const under = placed.filter((p) => p.id !== id && !p.rowEnd && overlaps(p, outline, gap));
  if (under.length === 0 || under.some((p) => p.fixed || still.has(p.id))) return null;
  const next = placed.map((p) => ({ ...p }));
  // Taken while it slides: every other box where it now stands — the dragged one at its own place — and the outline.
  const taken: Placed[] = [...next.filter((p) => !p.rowEnd), outline];
  const order = [...under].sort((a, b) => a.top - b.top || a.col - b.col);
  for (const u of order) {
    const box = next.find((p) => p.id === u.id)!;
    box.top = firstFree(taken.filter((p) => p !== box), box.col, box.units, box.height, box.top, gap);
  }
  return { placed: withRowEnds(next, gap), slid: order.map((u) => u.id) };
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
  // 40.32: a right-hand tile with nothing stored (or nothing this visit can hold) at its starting place.
  placed.push(...startBoxes(boxes.filter((b) => b.start && !usable.includes(b))));
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
  let floor = -1; // #38.46: under every tile, once the wrapped column's line has started
  for (const box of boxes) {
    if (placed.some((p) => p.id === box.id)) continue;
    if (box.rowEnd) {
      ends.push(box);
      continue;
    }
    if (box.under && floor < 0) {
      floor = endsTop([...placed, ...flow].filter((p) => !boxes.find((b) => b.id === p.id)?.under), gap);
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
    // A wrapped column tile goes under every tile, a stored one too (#38.46).
    const top = firstFree(all, col, units, box.height, box.under ? Math.max(floor, topUnder(all, col, units, gap)) : topUnder(flow, col, units, gap), gap);
    flow.push({ id: box.id, col, units, top, height: box.height });
    next = col + units >= fcols ? 0 : col + units;
  }
  // #38.16: then every tile rises into the empty space above it; the banners stay where they stand.
  // #38.45: a stored tile only by what the tiles above it gave up — the space the user left above it stays.
  const space = Object.fromEntries(usable.filter((b) => !fallback.has(b.id)).map((b) => [b.id, stored[b.id].space ?? 0]));
  // The wrapped column's tiles do not rise either: they stand under every tile (#38.46).
  const out = riseIntoGaps([...placed, ...flow], gap, lead, new Set(boxes.filter((b) => b.full || b.under).map((b) => b.id)), space);
  // Back in the boxes' order, so the DOM's order and the placed order agree.
  const order = new Map(boxes.map((b, i) => [b.id, i]));
  out.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  let top = endsTop(out, gap);
  for (const box of ends) {
    out.push({ id: box.id, col: 0, units: cols, top, height: box.height, rowEnd: true }); // #38.47: the whole row
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
 * kept too. `dropped` is the box the user moved — or, since 39.91, the boxes:
 * the dropped one and every tile that made room for it, all written as they
 * stand, a fallback among them too.
 */
export function placesToStore(
  placed: readonly Placed[],
  previous: StoredPlaces,
  fallback: readonly string[],
  dropped: string | readonly string[],
  lead = 0,
  gap = DEFAULT_GAP_PX,
): Record<string, StoredPlace> {
  const out: Record<string, StoredPlace> = { ...previous };
  const moved: readonly string[] = typeof dropped === "string" ? [dropped] : dropped;
  for (const p of placed) {
    if (p.rowEnd || p.fixed || !isStorable(p.id)) continue;
    if (fallback.includes(p.id) && !moved.includes(p.id)) continue;
    // 41.17: a place written anew keeps the width stored with it — a width is changed only by its own edge.
    const units = previous[p.id]?.units;
    out[p.id] = units === undefined ? storedPlaceOf(placed, p, gap, lead) : { ...storedPlaceOf(placed, p, gap, lead), units };
  }
  return out;
}

// ---- a tile's width, dragged by its right edge (Slice 41.17) --------------------------------------------------------

/**
 * Adrian, 2026-10-31: „I would like to be able to adjust the width of any tile by grabbing its right edge and moving
 * it left or right; however, for the case of the tiles the width of the tile will snap into place at the next size
 * possible for that tile - which is an integer number of units … If I grab the right edge of a 3 unit tile and I move
 * it left it will snap into place as a 2 unit tile; but if I move it right it will snap into place as a 4 unit tile".
 */

/** The widest a stored width may be, in units — as wide as a stored column may start. */
export const MAX_UNITS = 64;

/** How far past its edge a drag must go to move a tile one unit that way: a quarter of a unit (Ask first 2). */
export const WIDTH_SNAP_AT = 0.25;

/**
 * The width a tile of `from` units takes when its edge is let go `dxPx` from where it was pressed: the nearest whole
 * number of units — except that a quarter of a unit in one direction always moves it at least one unit that way —
 * and never past `min` or `max`.
 */
export function snapUnits(from: number, dxPx: number, unitPx: number, gapPx: number, min: number, max: number): number {
  const steps = dxPx / (unitPx + gapPx);
  let n = from + Math.round(steps);
  if (steps >= WIDTH_SNAP_AT) n = Math.max(n, from + 1);
  if (steps <= -WIDTH_SNAP_AT) n = Math.min(n, from - 1);
  return Math.min(max, Math.max(min, n));
}

/** The fewest units `px` wide or wider — never under one. */
export function unitsAtLeast(px: number, unitPx: number, gapPx: number): number {
  return Math.max(1, Math.ceil((px + gapPx) / (unitPx + gapPx) - 1e-6));
}

export interface WidthLimits {
  /** Never narrower: the tile's widest row of fixed boxes, as its screen measured it — and never under one unit. */
  min: number;
  /** Never wider: the row's right end on this window, and never across a box that stands still (37.79). */
  max: number;
}

/**
 * The widths tile `id` may take (Ask first 4): from `contentUnits` — the fewest units in which every fixed box keeps its
 * size and its row — to the row's end on this window, stopping short of a fixed box or one that holds still beside it.
 * Its own width is always inside them.
 */
export function widthLimits(
  placed: readonly Placed[],
  id: string,
  contentUnits: number,
  columns: number,
  gap: number,
  still: ReadonlySet<string> = new Set(),
): WidthLimits {
  const me = placed.find((p) => p.id === id);
  if (!me) return { min: 1, max: 1 };
  let max = Math.max(1, Math.floor(columns) - me.col);
  for (let n = me.units + 1; n <= max; n++) {
    const rect = { col: me.col, units: n, top: me.top, height: me.height };
    if (placed.some((p) => p.id !== id && !p.rowEnd && (p.fixed || still.has(p.id)) && overlaps(p, rect, gap))) {
      max = n - 1;
      break;
    }
  }
  const min = Math.max(1, Math.min(contentUnits, me.units));
  return { min, max: Math.max(max, me.units) };
}

/**
 * Tile `id` at `units` wide, where it stands (Ask first 5): the tiles it now overlaps slide down out of its way, as a
 * held tile makes room (`makeRoom`), never sideways; a narrower tile leaves its space, which the next layout's
 * `riseIntoGaps` fills.
 */
export function resizeTile(
  placed: readonly Placed[],
  id: string,
  units: number,
  columns: number,
  gap: number,
  still: ReadonlySet<string> = new Set(),
): { placed: Placed[]; slid: string[] } {
  const next = placed.map((p) => (p.id === id ? { ...p, units } : { ...p }));
  const me = next.find((p) => p.id === id);
  if (!me) return { placed: next, slid: [] };
  return makeRoom(next, id, { col: me.col, top: me.top }, columns, gap, still) ?? { placed: withRowEnds(next, gap), slid: [] };
}

/** `stored` with tile `id`'s width set to `units` — or forgotten, `undefined`, when it is the screen's own again. */
export function withStoredWidth(stored: StoredPlaces, id: string, units: number | undefined): Record<string, StoredPlace> {
  const out: Record<string, StoredPlace> = { ...stored };
  const place = out[id];
  if (!place) return out;
  const { units: _was, ...rest } = place;
  out[id] = units === undefined ? rest : { ...rest, units };
  return out;
}

/**
 * „TOATE SUS" (Slice 40.40). Adrian, 2026-10-23: „all the tiles - starting from the top - will slide up until they
 * reach either the edge of the screen, or the tile above; after this action, if we still have a big difference in the
 * height of the tile columns please take the bottom tiles from the tallest tile column and move it to the shortest tile
 * column, so we can obtain a balanced height of the tile columns on the screen".
 *
 * THE RISE (Ask first 1) is `riseIntoGaps` with no space kept: every tile that is not a banner (`still`) nor the action
 * bar, taken by its top edge (then left to right), rises in its own columns — never sideways — to right under the
 * lowest tile already settled above it, or the top under the banners; so a tile risen first is the ceiling of those
 * under it. The right-hand tiles rise like the rest (40.32 made them boxes).
 *
 * THE EVENING (Ask first 2, `evenColumns`): a tile column is the set of tiles sharing a left edge, its height its lowest
 * tile's bottom. While there are two columns or more, the tallest column's bottom tile goes to the bottom of the
 * shortest column (PANEL_GAP under it) where it fits across — its units at that column's left edge, inside the row,
 * overlapping nothing — or, when it does not, of the next shortest; the move is made only when it leaves the lowest
 * bottom on the screen strictly higher than before, and the evening stops at the first step that cannot do that. A
 * tile that fits nowhere stays.
 *
 * The result is stored as one arrangement, as a drop is (the hook's `store`), and „Implicit" still goes back to the
 * default. A press with nothing to move moves nothing (`allUp` gives `null`).
 */

/** The window event „Toate sus" sends, the record kind's entity as its detail (like `TILE_POSITIONS_RESET`). */
export const TILES_ALL_UP = "ga40-tiles-all-up";

/** The tiles that share a left edge, and how low the lowest of them reaches. */
export interface TileColumn {
  col: number;
  bottom: number;
  boxes: Placed[];
}

/** The tile columns of an arrangement, left to right — every box but the row ends. */
export function tileColumns(placed: readonly Placed[]): TileColumn[] {
  const byCol = new Map<number, Placed[]>();
  for (const p of placed) {
    if (p.rowEnd) continue;
    const list = byCol.get(p.col) ?? [];
    list.push(p);
    byCol.set(p.col, list);
  }
  return [...byCol.entries()]
    .map(([col, boxes]) => ({ col, boxes, bottom: Math.max(...boxes.map((b) => b.top + b.height)) }))
    .sort((a, b) => a.col - b.col);
}

/** The lowest bottom on the screen, the row ends left out. */
function lowestBottom(placed: readonly Placed[]): number {
  return placed.reduce((m, p) => (p.rowEnd ? m : Math.max(m, p.top + p.height)), 0);
}

/** The columns evened, as above. `columns`: the row's units. Fixed boxes, `still` ones and the row ends never move. */
export function evenColumns(placed: readonly Placed[], columns: number, gap: number, still: ReadonlySet<string> = new Set()): Placed[] {
  let out = placed.map((p) => ({ ...p }));
  const moves = (p: Placed): boolean => !p.fixed && !p.rowEnd && !still.has(p.id);
  // Each step moves one tile and lowers the lowest bottom; there cannot be more steps than tiles.
  for (let step = 0; step < out.length; step++) {
    const cols = tileColumns(out);
    if (cols.length < 2) break;
    const tallest = cols.reduce((a, b) => (b.bottom > a.bottom ? b : a));
    const me = tallest.boxes.reduce((a, b) => (b.top + b.height > a.top + a.height ? b : a));
    if (!moves(me)) break;
    const before = lowestBottom(out);
    let next: Placed[] | null = null;
    for (const target of cols.filter((c) => c !== tallest).sort((a, b) => a.bottom - b.bottom || a.col - b.col)) {
      if (target.col + me.units > columns) continue;
      const rect = { col: target.col, units: me.units, top: target.bottom + gap, height: me.height };
      if (out.some((p) => p.id !== me.id && !p.rowEnd && overlaps(p, rect, gap))) continue;
      const moved = out.map((p) => (p.id === me.id ? { ...p, col: rect.col, top: rect.top } : p));
      if (lowestBottom(moved) < before - 0.5) {
        next = moved;
        break;
      }
    }
    if (!next) break;
    out = next;
  }
  return withRowEnds(out, gap);
}

/**
 * „Toate sus": the rise, then the evening. `null` when nothing would move. `moved` names every box whose place
 * changed — the hook slides them and stores them as one arrangement.
 */
export function allUp(
  placed: readonly Placed[],
  columns: number,
  gap: number,
  lead = 0,
  still: ReadonlySet<string> = new Set(),
): { placed: Placed[]; moved: string[] } | null {
  const even = evenColumns(riseIntoGaps(placed, gap, lead, still), columns, gap, still);
  const was = new Map(placed.map((p) => [p.id, p]));
  const moved = even
    .filter((p) => !p.rowEnd)
    .filter((p) => {
      const w = was.get(p.id);
      return !w || w.col !== p.col || Math.abs(w.top - p.top) > 0.5;
    })
    .map((p) => p.id);
  if (moved.length === 0) return null;
  // Back in the arrangement's own order, so the DOM's order and the placed order agree.
  const order = new Map(placed.map((p, i) => [p.id, i]));
  even.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return { placed: even, moved };
}
