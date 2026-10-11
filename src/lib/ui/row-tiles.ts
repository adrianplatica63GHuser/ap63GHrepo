/**
 * A LIST ROW'S THREE TOGGLES — which row, and which of its tiles.     (Slice #39.04)
 *
 * On the four principal lists a row's first three buttons — the magnifier („Previzualizare"), the eye
 * („Incursiune") and the chain link („Legături") — are independent toggles on ONE row at a time:
 *   - pressed, each opens its tile and reads pressed; pressed again, it closes it;
 *   - any subset of the three may be open on that row;
 *   - while any is open, the three on every other row are disabled (`isLocked`) — „Deschide" never is;
 *   - the open tiles stand in one column, ALWAYS in this order whatever order they were pressed in:
 *     „Previzualizare", „Legături", „Incursiune" (`ROW_TILE_ORDER`);
 *   - a tile's „Închide" releases its button; the last one closed frees the list.
 * It replaces, on the lists, #38.71's two previews from any rows and #38.72/#38.76's one eye-or-chain-link
 * choice. A detail screen's previews (`usePreviews`, two at most) are not this module's.
 *
 * PURE — no React; `row-tiles.test.ts` covers it.
 */
import { previewKey, type PreviewTarget } from "@/lib/ui/previews";

/** The three tiles. „peek" is the eye's Incursiune, „links" the chain link's Legături (#38.76's names). */
export type RowTile = "preview" | "links" | "peek";

/** Top to bottom in the column, fixed. */
export const ROW_TILE_ORDER: readonly RowTile[] = ["preview", "links", "peek"];

export interface RowTiles {
  /** The row whose tiles are open, or none. Only its kind and id: an `anchor` means nothing on a list. */
  row: PreviewTarget | null;
  /** Its open tiles, in `ROW_TILE_ORDER`. Empty exactly when `row` is null. */
  open: readonly RowTile[];
}

export const NO_ROW_TILES: RowTiles = { row: null, open: [] };

const sameRow = (a: PreviewTarget | null, b: PreviewTarget): boolean => a !== null && previewKey(a) === previewKey(b);

/** In the column's order. */
function ordered(tiles: Iterable<RowTile>): RowTile[] {
  const set = new Set(tiles);
  return ROW_TILE_ORDER.filter((t) => set.has(t));
}

/**
 * A row's button pressed. On the open row (or with none open) it opens or closes that tile; on another row it
 * does nothing — those buttons are disabled, and this holds even if a click slips through.
 */
export function toggleRowTile(state: RowTiles, target: PreviewTarget, tile: RowTile): RowTiles {
  if (state.row !== null && !sameRow(state.row, target)) return state;
  const isOpen = state.open.includes(tile);
  const open = ordered(isOpen ? state.open.filter((t) => t !== tile) : [...state.open, tile]);
  return open.length === 0 ? NO_ROW_TILES : { row: { kind: target.kind, id: target.id }, open };
}

/** A tile's „Închide": its button released; the last one frees every row. */
export function closeRowTile(state: RowTiles, tile: RowTile): RowTiles {
  if (!state.open.includes(tile)) return state;
  const open = state.open.filter((t) => t !== tile);
  return open.length === 0 ? NO_ROW_TILES : { row: state.row, open };
}

/** Is this row's `tile` open — its button reads pressed. */
export function isRowTileOpen(state: RowTiles, target: PreviewTarget, tile: RowTile): boolean {
  return sameRow(state.row, target) && state.open.includes(tile);
}

/** Are this row's three disabled — another row has a tile open. */
export function isLocked(state: RowTiles, target: PreviewTarget): boolean {
  return state.row !== null && !sameRow(state.row, target);
}
