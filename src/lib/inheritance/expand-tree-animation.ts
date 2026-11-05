/**
 * „Deschide arborele întreg" opens as „Hartă extinsă" does, and closes the same way back.            (Slice 41.87)
 *
 * Adrian, 2026-11-05: „On a Natural Person's screen, when I want to expand the Inheritance tree tile to the „full
 * screen" (or when I want to collapse it to the current tile) the animation should happen similarly to what is
 * currently happening for the Map tile of a Property".
 *
 * Part 1 (`map_expand_grow`, Ask first 2): the panel grows from the tile's drawing — its header just above it — to the
 * expanded rectangle, the backdrop fading in; the drawing keeps the tile's scale while the person travels on a straight
 * line from where they stand on the tile to the middle of the panel's drawing. Part 2 (`map_expand_zoom_out`): the
 * scale goes from the tile's to the whole tree's opening on a person (`FOCUS_SCALE`, the near level — today's
 * `?focus=` view), the person held in the middle, on a log scale so each level takes as long as the next.
 *
 * The way back (Ask first 3, as 41.77's): when the view is not where the opening ended — another level, the person
 * more than 2 % of the drawing off its middle, another person searched, or the opening stopped part way — a return
 * first: the drawing's centre glides there while the scale rides 41.76's parabola (`parabolaZoom`, the map's
 * `map_search_flight` and `map_search_arc`), in levels of log2(scale). Then part 2 backwards and part 1 backwards
 * into the tile where it stands now. A tile that cannot be measured gets the return alone.
 *
 * Pure: no DOM, no React. `TreeView` is the drawing's transform in its own box (tile-size.ts): a drawing point (x, y)
 * stands at (tx + x · scale, ty + y · scale) from the box's top-left.
 */
import { MIN_RISE, flightMs, parabolaZoom } from "@/lib/geo/map-search";
import {
  COLLAPSE_RETURN_TOLERANCE,
  bodyOf,
  centreOf,
  easeInOut,
  expandedRect,
  growProgress,
  lerp,
  lerpPoint,
  lerpRect,
  openingClockBack,
  panelOverTile,
  partTwoProgress,
  type Point,
  type Rect,
} from "@/lib/ui/expand-animation";
import { levelAt } from "@/lib/inheritance/layout";
import type { TreeView } from "@/lib/inheritance/tile-size";

/** The whole tree's view of one person — the search's and `?focus=`'s: near enough to read (level 3). */
export const FOCUS_SCALE = 1.3;

export type TreeExpandInput = {
  /** The tile's drawing on screen, as the button was pressed. */
  tileBox: Rect;
  viewport: { w: number; h: number };
  /** The panel's header, above its drawing. */
  headerPx: number;
  /** The tile's scale, and where its person stands on screen. */
  tileScale: number;
  personOnScreen: Point;
  /** The person in the whole tree's drawing. */
  person: Point;
  growMs: number;
  zoomMs: number;
  reducedMotion: boolean;
};

export type TreeExpandPlan = {
  from: Rect;
  to: Rect;
  headerPx: number;
  person: Point;
  /** Where the person stands on screen at the start, and the scales at both ends. */
  start: Point;
  startScale: number;
  endScale: number;
  growMs: number;
  zoomMs: number;
};

export function planTreeExpand(i: TreeExpandInput): TreeExpandPlan {
  const off = i.reducedMotion;
  const startScale = i.tileScale > 0 ? i.tileScale : FOCUS_SCALE;
  return {
    from: panelOverTile(i.tileBox, i.headerPx),
    to: expandedRect(i.viewport),
    headerPx: i.headerPx,
    person: i.person,
    start: i.personOnScreen,
    startScale,
    endScale: FOCUS_SCALE,
    growMs: off ? 0 : Math.max(0, i.growMs),
    // Already at the near level's scale: nothing to zoom.
    zoomMs: off || Math.abs(Math.log2(FOCUS_SCALE / startScale)) < 0.01 ? 0 : Math.max(0, i.zoomMs),
  };
}

export function treeExpandTotalMs(p: TreeExpandPlan): number {
  return p.growMs + p.zoomMs;
}

/** The panel at `t` ms. */
export function treePanelAt(t: number, p: TreeExpandPlan): Rect {
  return lerpRect(p.from, p.to, growProgress(t, p.growMs));
}

/** The panel's drawing at `t`: the panel less its header. */
export function treeBoxAt(t: number, p: TreeExpandPlan): Rect {
  return bodyOf(treePanelAt(t, p), p.headerPx);
}

/** The backdrop's opacity at `t`: in with part 1. */
export function treeBackdropAt(t: number, p: TreeExpandPlan): number {
  return growProgress(t, p.growMs);
}

/** The drawing's scale at `t`: the tile's through part 1, then on a log scale to the near level's. */
export function treeScaleAt(t: number, p: TreeExpandPlan): number {
  if (t < p.growMs) return p.startScale;
  const z = partTwoProgress(t, p.growMs, p.zoomMs);
  return p.startScale * (p.endScale / p.startScale) ** z;
}

/** The view the panel's drawing shows at `t`, in its own box. */
export function treeViewAt(t: number, p: TreeExpandPlan): TreeView {
  const box = treeBoxAt(t, p);
  const scale = treeScaleAt(t, p);
  if (t < p.growMs) {
    // The person's screen point on the straight line from the tile to the middle of the drawing as it will be.
    const end = centreOf(treeBoxAt(p.growMs, p));
    const s = lerpPoint(p.start, end, growProgress(t, p.growMs));
    return { scale, tx: s.x - box.x - p.person.x * scale, ty: s.y - box.y - p.person.y * scale };
  }
  return centredOn(p.person, scale, box);
}

/** The view that holds `at` in the middle of `box` at `scale`. */
export function centredOn(at: Point, scale: number, box: { w: number; h: number }): TreeView {
  return { scale, tx: box.w / 2 - at.x * scale, ty: box.h / 2 - at.y * scale };
}

/** The drawing point at the middle of `box` under `v`. */
export function middleOf(v: TreeView, box: { w: number; h: number }): Point {
  return { x: (box.w / 2 - v.tx) / v.scale, y: (box.h / 2 - v.ty) / v.scale };
}

// ---------------------------------------------------------------------------
// The way back
// ---------------------------------------------------------------------------

export type TreeCollapseInput = Omit<TreeExpandInput, "tileBox" | "personOnScreen"> & {
  /** The tile's drawing now, and its person there; null when the tile cannot be measured. */
  tileBox: Rect | null;
  personOnScreen: Point | null;
  /** The view as the way back starts. */
  current: TreeView;
  flightMs: number;
  arc: number;
  openingCut: boolean;
  /** Another person was searched since the opening. */
  searched: boolean;
};

export type TreeCollapsePlan = {
  expand: TreeExpandPlan;
  current: TreeView;
  end: TreeView;
  returnMs: number;
  rise: number;
  arc: number;
  zoomMs: number;
  growMs: number;
};

/** Whether `current` stands where the opening ended: the same level, the person within 2 % of the drawing's middle. */
export function atTreeOpeningEnd(current: TreeView, end: TreeView, person: Point, box: { w: number; h: number }): boolean {
  if (levelAt(current.scale) !== levelAt(end.scale)) return false;
  const x = current.tx + person.x * current.scale;
  const y = current.ty + person.y * current.scale;
  return Math.abs(x - box.w / 2) <= COLLAPSE_RETURN_TOLERANCE * box.w && Math.abs(y - box.h / 2) <= COLLAPSE_RETURN_TOLERANCE * box.h;
}

/** R, in levels of log2(scale): enough to see both middles in the drawing, at least `MIN_RISE` (the map's rule). */
export function treeFlightRise(from: TreeView, to: TreeView, box: { w: number; h: number }): number {
  const a = middleOf(from, box);
  const b = middleOf(to, box);
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  const seeBoth = Math.min(dx > 0 ? (0.8 * box.w) / dx : Infinity, dy > 0 ? (0.8 * box.h) / dy : Infinity);
  const low = Math.min(Math.log2(from.scale), Math.log2(to.scale));
  const peak = Number.isFinite(seeBoth) ? Math.min(low, Math.log2(seeBoth)) : low;
  return Math.max(MIN_RISE, low - peak);
}

export function planTreeCollapse(i: TreeCollapseInput): TreeCollapsePlan {
  const measured = i.tileBox !== null && i.personOnScreen !== null;
  const panel = expandedRect(i.viewport);
  const body = bodyOf(panel, i.headerPx);
  const expand = planTreeExpand({
    ...i,
    tileBox: i.tileBox ?? body,
    personOnScreen: i.personOnScreen ?? centreOf(body),
    growMs: measured ? i.growMs : 0,
    zoomMs: measured ? i.zoomMs : 0,
  });
  const end = centredOn(i.person, expand.endScale, body);
  const back = i.openingCut || i.searched || !atTreeOpeningEnd(i.current, end, i.person, body);
  return {
    expand,
    current: i.current,
    end,
    returnMs: back ? flightMs(i.reducedMotion, i.flightMs) : 0,
    rise: treeFlightRise(i.current, end, body),
    arc: i.arc,
    zoomMs: expand.zoomMs,
    growMs: expand.growMs,
  };
}

export function treeCollapseTotalMs(c: TreeCollapsePlan): number {
  return c.returnMs + c.zoomMs + c.growMs;
}

/** The view at `t` into the way back. */
export function treeCollapseViewAt(t: number, c: TreeCollapsePlan): TreeView {
  const o = openingClockBack(t, c.returnMs, c.expand.growMs, c.zoomMs);
  if (o !== null) return treeViewAt(o, c.expand);
  const box = treeBoxAt(c.expand.growMs, c.expand);
  const x = easeInOut(Math.max(0, t) / c.returnMs);
  const a = middleOf(c.current, box);
  const b = middleOf(c.end, box);
  const scale = 2 ** parabolaZoom(x, Math.log2(c.current.scale), Math.log2(c.end.scale), c.rise, c.arc);
  return centredOn({ x: lerp(a.x, b.x, x), y: lerp(a.y, b.y, x) }, scale, box);
}

/** The panel at `t`: the expanded one until part 1 starts back, then down to the tile. */
export function treeCollapsePanelAt(t: number, c: TreeCollapsePlan): Rect {
  const o = openingClockBack(t, c.returnMs, c.expand.growMs, c.zoomMs);
  return treePanelAt(o === null ? c.expand.growMs : o, c.expand);
}

export function treeCollapseBackdropAt(t: number, c: TreeCollapsePlan): number {
  const o = openingClockBack(t, c.returnMs, c.expand.growMs, c.zoomMs);
  return treeBackdropAt(o === null ? c.expand.growMs : o, c.expand);
}
