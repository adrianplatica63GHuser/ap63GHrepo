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
 * PURE — no DOM, no React; `tile-positions.test.ts` covers it.
 */
import { freeUnder, overlaps, packTiles, topUnder, type PackBox, type Placed } from "./tile-packing";

/** A box's stored place: its first column (0-based) and its top in px. */
export interface StoredPlace {
  col: number;
  top: number;
}

export type StoredPlaces = Readonly<Record<string, StoredPlace>>;

/** The step a dragged tile snaps to down the screen, in px (half a PANEL_GAP). */
export const ROW_STEP = 8;

/** The largest top a stored place may have, in px: past it the entry is out of range. */
export const MAX_TOP = 100_000;

/** Where a screen's arrangement is kept: beside `tileStorageKey(entity)`. */
export function tilePositionsKey(entity: string): string {
  return `ga40-tile-positions-${entity}-v1`;
}

/** The window event „Implicit" sends, so a screen whose tiles did not change lays itself out afresh. */
export const TILE_POSITIONS_RESET = "ga40-tile-positions-reset";

/** Is this box's place ever stored? A preview's is not, nor a banner's (a box of no tile, „box#n"). */
export function isStorable(id: string): boolean {
  return !id.startsWith("preview") && !id.startsWith("box#");
}

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
  if (!me) return false;
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
  let top = Math.max(0, ...placed.filter((p) => !p.rowEnd).map((p) => p.top + p.height + gap));
  for (const end of placed.filter((p) => p.rowEnd)) {
    end.top = top;
    top += end.height + gap;
  }
  return placed;
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
 * With nothing stored this is exactly `packTiles`.
 */
export function placeWithStored(
  boxes: readonly PackBox[],
  stored: StoredPlaces,
  columns: number,
  gap: number,
): { placed: Placed[]; fallback: string[]; lead: number } {
  const cols = Math.max(1, Math.floor(columns));
  // The banners before every tile: at the top, the stored places counted from under them.
  const leading: PackBox[] = [];
  for (const b of boxes) {
    if (b.full) leading.push(b);
    else if (!b.rowEnd) break;
  }
  const lead = leading.reduce((h, b) => h + b.height + gap, 0);
  const usable = boxes.filter((b) => !b.rowEnd && !b.full && stored[b.id] && stored[b.id].col + Math.min(Math.round(b.units), cols) <= cols);
  if (usable.length === 0) {
    return { placed: packTiles(boxes, cols, gap), fallback: boxes.filter((b) => stored[b.id]).map((b) => b.id), lead };
  }
  const fallback = new Set(boxes.filter((b) => stored[b.id] && !usable.includes(b)).map((b) => b.id));
  const placed: Placed[] = [];
  let bannerTop = 0;
  for (const b of leading) {
    placed.push({ id: b.id, col: 0, units: cols, top: bannerTop, height: b.height });
    bannerTop += b.height + gap;
  }
  // The stored ones first, top to bottom: each at its place, pushed down when a taller tile above now reaches into it.
  for (const box of [...usable].sort((a, b) => stored[a.id].top - stored[b.id].top || stored[a.id].col - stored[b.id].col)) {
    const units = Math.max(1, Math.min(Math.round(box.units), cols));
    const col = stored[box.id].col;
    const top = stored[box.id].top + lead;
    const rect = { col, units, top, height: box.height };
    const blockers = placed.filter((p) => overlaps(p, rect, gap));
    if (blockers.length === 0) {
      placed.push({ id: box.id, col, units, top, height: box.height });
    } else if (blockers.every((p) => p.top < top)) {
      placed.push({ id: box.id, col, units, top: firstFree(placed, col, units, box.height, top, gap), height: box.height });
    } else {
      fallback.add(box.id); // its place is taken
    }
  }
  // The rest by #37.75's rule — columns from the line-by-line order, risen under the boxes the rule placed — and never into a stored one.
  const flow: Placed[] = [];
  const ends: PackBox[] = [];
  let next = 0;
  for (const box of boxes) {
    if (placed.some((p) => p.id === box.id)) continue;
    if (box.rowEnd) {
      ends.push(box);
      continue;
    }
    const units = box.full ? cols : Math.max(1, Math.min(Math.round(box.units), cols));
    const all = [...placed, ...flow];
    const anchor = box.anchor ? all.find((p) => p.id === box.anchor) : undefined;
    if (anchor) {
      const at = freeUnder(all, anchor, units, box.height, cols, gap);
      flow.push({ id: box.id, col: at.col, units, top: at.top, height: box.height });
      continue;
    }
    if (next > 0 && next + units > cols) next = 0;
    const col = next;
    const top = firstFree(all, col, units, box.height, topUnder(flow, col, units, gap), gap);
    flow.push({ id: box.id, col, units, top, height: box.height });
    next = col + units >= cols ? 0 : col + units;
  }
  const out = [...placed, ...flow];
  // Back in the boxes' order, so the DOM's order and the placed order agree.
  const order = new Map(boxes.map((b, i) => [b.id, i]));
  out.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  let top = out.length ? Math.max(...out.map((p) => p.top + p.height)) + gap : 0;
  for (const box of ends) {
    out.push({ id: box.id, col: 0, units: cols, top, height: box.height, rowEnd: true });
    top += box.height + gap;
  }
  return { placed: out, fallback: [...fallback], lead };
}

/**
 * What a drop writes: every storable box's place as it now stands, counted
 * from under the banners (`lead`), but an entry this visit could not use is
 * kept as it was (`fallback`), and an entry for a tile not on screen
 * (unticked) is kept too.
 */
export function placesToStore(placed: readonly Placed[], previous: StoredPlaces, fallback: readonly string[], dropped: string, lead = 0): Record<string, StoredPlace> {
  const out: Record<string, StoredPlace> = { ...previous };
  for (const p of placed) {
    if (p.rowEnd || !isStorable(p.id)) continue;
    if (fallback.includes(p.id) && p.id !== dropped) continue;
    out[p.id] = { col: p.col, top: Math.max(0, Math.round(p.top - lead)) };
  }
  return out;
}
