/**
 * Where a record screen's tiles stand, told to whoever draws them small.                             (Slice 40.42)
 *
 * The packing hook (`use-tile-packing.ts`) places every box; the tiles diagram beside the bar (tiles-diagram.tsx) draws
 * them as rectangles. After each layout, drop, double-click rise, „Toate sus", tick or untick and width change — never
 * during a drag — the hook publishes what it placed under the record kind's entity: a window event for a diagram already
 * listening, and the last one kept for a diagram drawn after it (40.42's Ask first 4).
 */
export const TILES_PLACED = "ga40-tiles-placed";

/** One placed box: its id (a tile's name, a panel's `tile#n`, a preview's `preview…`), units across, px down. */
export interface PlacedBox {
  id: string;
  col: number;
  units: number;
  top: number;
  height: number;
}

export interface PlacedSnapshot {
  entity: string;
  /** The row's units. */
  columns: number;
  /** The minimum gap between tiles, in px (PANEL_GAP). */
  gap: number;
  /** Every tile box — no banner, no action bar. */
  boxes: PlacedBox[];
}

const last = new Map<string, PlacedSnapshot>();

export function publishPlaced(snapshot: PlacedSnapshot): void {
  last.set(snapshot.entity, snapshot);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<PlacedSnapshot>(TILES_PLACED, { detail: snapshot }));
}

export function lastPlaced(entity: string): PlacedSnapshot | undefined {
  return last.get(entity);
}
