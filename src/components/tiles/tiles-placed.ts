/**
 * Where a record screen's tiles stand, told to whoever draws them small.                             (Slice 40.42)
 *
 * The packing hook (`use-tile-packing.ts`) places every box; the tiles diagram beside the bar (tiles-diagram.tsx) draws
 * them as rectangles. After each layout, drop, double-click rise, „Toate sus", tick or untick and width change — never
 * during a drag, except one the diagram started (40.53), whose tiles making room the diagram shows as they slide — the
 * hook publishes what it placed under the record kind's entity: a window event for a diagram already
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
  /** Slice 40.53: a unit's width, in px — what turns the diagram's units back into the screen's. */
  unit: number;
  /** Every tile box — no banner, no action bar. */
  boxes: PlacedBox[];
  /** Slice 40.53: while a drag the diagram started runs, the tile dragged and whether it may drop where it is. */
  drag?: { id: string; free: boolean };
}

/**
 * Slice 40.53 — a drag the tiles diagram starts, told to the packing hook, which runs it as its own (Ask first 1: one
 * drag, the hook's — the same free-space rule, make-room delay, drop and store). `dx`, `dy`: how far the tile has moved
 * from where it stood, in the screen's px; `drop` keeps it where it is, `cancel` puts everything back.
 */
export const TILE_DIAGRAM_DRAG = "ga40-tile-diagram-drag";

export interface DiagramDrag {
  entity: string;
  id: string;
  phase: "start" | "move" | "drop" | "cancel";
  dx: number;
  dy: number;
}

export function dragFromDiagram(detail: DiagramDrag): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<DiagramDrag>(TILE_DIAGRAM_DRAG, { detail }));
}

const last = new Map<string, PlacedSnapshot>();

export function publishPlaced(snapshot: PlacedSnapshot): void {
  last.set(snapshot.entity, snapshot);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<PlacedSnapshot>(TILES_PLACED, { detail: snapshot }));
}

export function lastPlaced(entity: string): PlacedSnapshot | undefined {
  return last.get(entity);
}
