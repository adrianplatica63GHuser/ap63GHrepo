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
 *   - DOWN, since Slice 40.52 (Adrian, 2026-10-24: „The height of the small rectangles will be proportional to the
 *     actual height of the tile; Of course, we must make sure that any manner of stacking these rectangles will still
 *     fit in the space allocated for this tiles map"): each rectangle its tile's height × one scale for all — the
 *     largest that fits the deepest stack into the room — and never under `DIAGRAM.minHeight` (3 px), so a one-line
 *     tile beside a tall one stays visible (Ask first 1, 2). Above each, half the gap above its tile — between the
 *     minimum gap's half (8 px) and double the minimum gap (32 px), in px, not scaled with the tiles — under the lowest
 *     rectangle above it in its units, or the diagram's top (half the space above a tile with nothing above it, at most
 *     32 px). When even the floor with those gaps does not fit, the gaps shrink first, then the floor (40.42's order).
 *     40.42 gave every rectangle one height, the largest that fitted.
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
  /** Slice 40.53: a unit's width and the gap between two units, across, in the diagram's px. */
  unit: number;
  across: number;
  /** Slice 40.53: the diagram's px per screen px, down (40.52's one scale); 0 where the floor took over. */
  scale: number;
}

/**
 * Slice 40.53 — how far a tile moves on the screen when its rectangle, which stood at `from` in the diagram, is moved to
 * `at` (the rectangle's top-left, in the diagram's px). Across: the screen's unit-and-gap per the diagram's. Down, by
 * the diagram as it stood at the press — not one scale, since the diagram's gaps are 40.52's px and not scaled: in the
 * columns the rectangle now covers, a top inside a rectangle lands in proportion inside that tile, a top in a gap lands
 * in proportion in the gap between those tiles on the screen, and a top under them all goes on at the diagram's scale.
 * So the rectangle laid on another's top-left puts its tile on that tile's, which is the drop the user sees.
 */
export function moveOnScreen(
  at: { x: number; y: number },
  moving: { id: string },
  diagram: Pick<Diagram, "rects" | "unit" | "across" | "scale">,
  tiles: readonly { id: string; col: number; units: number; top: number; height: number }[],
  screen: { unit: number; gap: number },
): { dx: number; dy: number } {
  const byId = new Map(tiles.map((t) => [t.id, t]));
  const me = byId.get(moving.id);
  const mine = diagram.rects.find((r) => r.id === moving.id);
  if (!me || !mine) return { dx: 0, dy: 0 };
  const pitch = Math.max(0.01, diagram.unit + diagram.across);
  const left = (at.x / pitch) * (screen.unit + screen.gap);
  // Down past every rectangle: the diagram's scale, or where the floor took over, the rectangle's own over its tile's.
  const down = diagram.scale > 0 ? 1 / diagram.scale : Math.max(1, me.height) / Math.max(0.5, mine.h);
  const col = Math.max(0, Math.round(at.x / pitch));
  const refs = diagram.rects
    .map((r) => ({ r, t: byId.get(r.id) }))
    .filter((x): x is { r: DiagramRect; t: NonNullable<typeof x.t> } => !!x.t && x.t.col < col + me.units && col < x.t.col + x.t.units)
    .sort((a, b) => a.r.y - b.r.y);
  let top: number | null = null;
  if (at.y <= 0) top = at.y * down;
  let prevD = 0;
  let prevS = 0;
  for (const { r, t } of refs) {
    if (top !== null) break;
    if (at.y < r.y) {
      top = prevS + ((at.y - prevD) * (t.top - prevS)) / Math.max(0.01, r.y - prevD);
    } else if (at.y <= r.y + r.h) {
      top = t.top + ((at.y - r.y) * t.height) / Math.max(0.5, r.h);
    } else {
      prevD = Math.max(prevD, r.y + r.h);
      prevS = Math.max(prevS, t.top + t.height);
    }
  }
  if (top === null) top = prevS + (at.y - prevD) * down;
  return { dx: left - me.col * (screen.unit + screen.gap), dy: top - me.top };
}

/** The diagram's own sizes, in px. */
export const DIAGRAM = {
  /** A unit's width when there is room: small. */
  unit: 12,
  /** The smallest a unit is drawn, however short the room. */
  minUnit: 3,
  /** The smallest a rectangle is drawn, however short its tile (40.52; 40.42's equal heights had 4 before the gaps shrank). */
  minHeight: 3,
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
  if (tiles.length === 0 || height <= 0 || maxWidth <= 0) return { rects: [], width: 0, height: 0, unit: 0, across: 0, scale: 0 };
  const cols = Math.max(1, columns, ...tiles.map((t) => t.col + t.units));
  // Across: a unit and the gap between units, both shrunk together when the room is short.
  const across0 = tileGap / 2;
  const want = cols * DIAGRAM.unit + (cols - 1) * across0;
  const k = Math.min(1, maxWidth / want);
  const unit = Math.max(DIAGRAM.minUnit, Math.floor(DIAGRAM.unit * k * 100) / 100);
  const across = Math.max(1, Math.floor(across0 * k * 100) / 100);
  const stack = stacking(tiles);
  // A rectangle's height: its tile's × the scale `sc`, never under the floor `floor` (40.52).
  const place = (sc: number, f: number, floor: number = DIAGRAM.minHeight): DiagramRect[] => {
    const at = new Map<string, DiagramRect>();
    for (const { tile, above, gap } of stack) {
      const g = diagramGap(gap, tileGap, above.length === 0) * f;
      const y = above.length ? Math.max(...above.map((p) => at.get(p.id)!.y + at.get(p.id)!.h)) + g : g;
      at.set(tile.id, {
        id: tile.id,
        group: tile.group,
        x: tile.col * (unit + across),
        y,
        w: tile.units * unit + (tile.units - 1) * across,
        // Rounded here, before the next one is placed under it, so the gaps stay exactly the rule's.
        h: Math.floor(Math.max(floor, Math.max(0, tile.height) * sc) * 100) / 100,
      });
    }
    return tiles.map((t) => at.get(t.id)!);
  };
  const tall = (rs: readonly DiagramRect[]) => rs.reduce((m, r) => Math.max(m, r.y + r.h), 0);
  const fits = (rs: readonly DiagramRect[]) => tall(rs) <= height;
  // The largest scale that fits the deepest stack, the gaps as the rule gives them: no rectangle can be taller than the
  // room, so the scale is at most the room over the tallest tile.
  const tallest = Math.max(1, ...tiles.map((t) => t.height));
  let scale = 0;
  let f = 1;
  let floor: number = DIAGRAM.minHeight;
  if (fits(place(0, 1))) {
    let lo = 0;
    let hi = height / tallest;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (fits(place(mid, 1))) lo = mid;
      else hi = mid;
    }
    scale = Math.floor(lo * 1e6) / 1e6;
  } else {
    // Even the floor with those gaps does not fit: the gaps shrink first…
    let a = 0;
    let b = 1;
    for (let i = 0; i < 40; i++) {
      const mid = (a + b) / 2;
      if (fits(place(0, mid))) a = mid;
      else b = mid;
    }
    f = a;
    // …then, with no gaps at all, the floor: the rectangles share the height among the deepest stack.
    if (!fits(place(0, f))) {
      f = 0;
      floor = Math.max(0.5, Math.floor((height / Math.max(1, tall(place(0, 0, 1)))) * 100) / 100);
    }
  }
  const rects = place(scale, f, floor);
  return { rects, width: cols * unit + (cols - 1) * across, height: tall(rects), unit, across, scale };
}
