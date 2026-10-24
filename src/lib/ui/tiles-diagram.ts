/**
 * THE SMALL DIAGRAM OF THE TILES BESIDE THE BAR.                                                      (Slice 40.42)
 *
 * Adrian, 2026-10-23: „a small and simple diagram … small rectangles that have no caption or label And that are
 * coloured in the same hue as the tiles displayed … stacked in the same manner as the real tiles … The height of the
 * rectangle is the same for all rectangles; The width of the rectangle is proportional to the width of its tile … If the
 * tiles on the screen are positioned so the gaps between them are minimal, Then the gaps between the corresponding
 * rectangles will also be minimal which shall be about half of the minimal gap between tiles; If the tiles … are not
 * positioned so the gaps between them are minimal, then the gaps … will be bigger, but not more than double the minimal
 * gap between tiles; we should be … mindful of the total height of this diagram".
 *
 * `tilesDiagram` turns the placed boxes into rectangles (40.42's Ask first 2):
 *   - ACROSS, on the tiles' own grid: a rectangle starts where its tile's first unit does and is as wide as its units,
 *     each unit `unit` px and the gap between two units `across` px — half the minimum gap between tiles (8 px) unless
 *     the room is short, when both shrink; so two or three columns read as on the screen, and a tile two units wide is
 *     twice a one-unit tile and the gap.
 *   - DOWN, every rectangle the same height; above each, half the gap above its tile — between the minimum gap's half
 *     (8 px) and double the minimum gap (32 px) — under the lowest rectangle above it in its units, or the diagram's top
 *     (half the space above a tile with nothing above it, at most 32 px). The height is the largest that fits the
 *     tallest stack into the room; when even the smallest rectangles with those gaps do not fit, the gaps shrink with
 *     them.
 *
 * PURE — no DOM; `tiles-diagram.test.ts` covers it. The component is `src/components/tiles/tiles-diagram.tsx`.
 */
import type { TileGroup } from "./tiles";

/** One placed tile, as the packing hook placed it: units across, px down. */
export interface DiagramTile {
  id: string;
  group: TileGroup;
  col: number;
  units: number;
  top: number;
  height: number;
}

export interface DiagramRect {
  id: string;
  group: TileGroup;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Diagram {
  rects: DiagramRect[];
  width: number;
  height: number;
}

/** The diagram's own sizes, in px. */
export const DIAGRAM = {
  /** A unit's width when there is room: small. */
  unit: 12,
  /** The smallest a unit is drawn, however short the room. */
  minUnit: 3,
  /** The smallest rectangle height before the gaps shrink too. */
  minHeight: 4,
} as const;

/** The gap above a rectangle: half the gap above its tile, between half the minimum tile gap and double it. */
export function diagramGap(tileGapPx: number, minTileGapPx: number, first: boolean): number {
  const half = Math.max(0, tileGapPx) / 2;
  const most = 2 * minTileGapPx;
  return first ? Math.min(half, most) : Math.min(Math.max(half, minTileGapPx / 2), most);
}

/** Each tile's gap above it on the screen (px), and whether anything stands above it — in the order of their tops. */
function stacking(tiles: readonly DiagramTile[]): { tile: DiagramTile; above: DiagramTile[]; gap: number }[] {
  const order = [...tiles].sort((a, b) => a.top - b.top || a.col - b.col);
  return order.map((t) => {
    const above = order.filter(
      (p) => p !== t && p.top + p.height <= t.top + 0.5 && p.col < t.col + t.units && t.col < p.col + p.units,
    );
    const ceiling = above.reduce((m, p) => Math.max(m, p.top + p.height), 0);
    return { tile: t, above, gap: t.top - ceiling };
  });
}

/**
 * The rectangles. `tileGap`: the minimum gap between tiles (PANEL_GAP, 16 px); `height`: the room down; `maxWidth`: the
 * room across; `columns`: the row's units (the diagram is as wide as the row's units would be).
 */
export function tilesDiagram(
  tiles: readonly DiagramTile[],
  { tileGap, height, maxWidth, columns }: { tileGap: number; height: number; maxWidth: number; columns: number },
): Diagram {
  if (tiles.length === 0 || height <= 0 || maxWidth <= 0) return { rects: [], width: 0, height: 0 };
  const cols = Math.max(1, columns, ...tiles.map((t) => t.col + t.units));
  // Across: a unit and the gap between units, both shrunk together when the room is short.
  const across0 = tileGap / 2;
  const want = cols * DIAGRAM.unit + (cols - 1) * across0;
  const k = Math.min(1, maxWidth / want);
  const unit = Math.max(DIAGRAM.minUnit, Math.floor(DIAGRAM.unit * k * 100) / 100);
  const across = Math.max(1, Math.floor(across0 * k * 100) / 100);
  const stack = stacking(tiles);
  const place = (h: number, f: number): DiagramRect[] => {
    const at = new Map<string, DiagramRect>();
    for (const { tile, above, gap } of stack) {
      const g = diagramGap(gap, tileGap, above.length === 0) * f;
      const y = above.length ? Math.max(...above.map((p) => at.get(p.id)!.y + h)) + g : g;
      at.set(tile.id, {
        id: tile.id,
        group: tile.group,
        x: tile.col * (unit + across),
        y,
        w: tile.units * unit + (tile.units - 1) * across,
        h,
      });
    }
    return tiles.map((t) => at.get(t.id)!);
  };
  const tall = (rs: readonly DiagramRect[]) => rs.reduce((m, r) => Math.max(m, r.y + r.h), 0);
  // The tallest rectangles that fit, the gaps as the rule gives them…
  let lo = 0;
  let hi = height;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (tall(place(mid, 1)) <= height) lo = mid;
    else hi = mid;
  }
  let h = Math.floor(lo * 100) / 100;
  let f = 1;
  // …and when even the smallest do not fit, the gaps shrink with them.
  if (h < DIAGRAM.minHeight) {
    h = DIAGRAM.minHeight;
    let a = 0;
    let b = 1;
    for (let i = 0; i < 40; i++) {
      const mid = (a + b) / 2;
      if (tall(place(h, mid)) <= height) a = mid;
      else b = mid;
    }
    f = a;
    // Not even with no gaps: the rectangles share the height among the deepest stack.
    if (tall(place(h, f)) > height) {
      f = 0;
      h = Math.max(1, Math.floor((height / Math.max(1, tall(place(1, 0)))) * 100) / 100);
    }
  }
  const rects = place(h, f);
  return { rects, width: cols * unit + (cols - 1) * across, height: tall(rects) };
}
