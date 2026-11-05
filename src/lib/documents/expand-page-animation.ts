/**
 * „Pagini extinse" opens as „Hartă extinsă" does, and „Restrânge" takes it back the same way.          (Slice 41.88)
 *
 * Adrian, 2026-11-05: „On a Document's screen, when I want to expand the Pages tile to the „full screen" (or when I
 * want to collapse it to the current tile) the animation should happen similarly to what is currently happening for
 * the Map tile of a Property".
 *
 * Part 1 (`map_expand_grow`, Ask first 1): the panel grows from the tile's viewer — its header above it — to the
 * expanded rectangle, the backdrop fading in, while the page shown travels from its place in the tile's viewer to the
 * middle of the panel's at the size it had on the tile, its turn kept. Part 2 (`map_expand_zoom_out`): the page from
 * that size to its fit in the panel (the big viewer's own fit — its scale 1). A PDF or a download prompt has no
 * page to move: its box grows with the panel, and there is no part 2.
 *
 * The way back (Ask first 2): when the big page was zoomed or panned, a return first, to its fit, on 41.76's parabola
 * for the map's search length and a (`returnViewAt`, the page's scale standing for the map's zoom); then part 2
 * backwards and part 1 backwards into the tile where it stands now. A tile that cannot be measured gets the return
 * alone.
 *
 * The page is moved by the big viewer's own transform (`PagesViewerBox`: scale, then translate, from its top-left).
 * While it plays the big viewer is held at its final size and place, and the panel is a window growing around it —
 * so the page's fitted rectangle (`fit`, measured on screen once) never moves, and the transform alone places it.
 * Pure: no DOM.
 */
import { flightMs } from "@/lib/geo/map-search";
import {
  COLLAPSE_RETURN_TOLERANCE,
  bodyOf,
  centreOf,
  expandedRect,
  growProgress,
  lerpPoint,
  lerpRect,
  openingClockBack,
  panelOverTile,
  partTwoProgress,
  returnViewAt,
  viewFlightRise,
  type Rect,
  type View,
} from "@/lib/ui/expand-animation";

/** The big viewer at rest: its fit. */
export const FIT_VIEW: View = { scale: 1, tx: 0, ty: 0 };

export type PageExpandInput = {
  /** The tile's viewer box on screen. */
  tileBox: Rect;
  /** The page as the tile shows it, on screen; null for a PDF, a download prompt, or nothing shown. */
  tilePage: Rect | null;
  viewport: { w: number; h: number };
  headerPx: number;
  /** The padding between the panel's body and its viewer (`p-3`). */
  padPx: number;
  /** The page at its fit in the big viewer, on screen, with the viewer at its final place; null as `tilePage`. */
  fit: Rect | null;
  growMs: number;
  zoomMs: number;
  reducedMotion: boolean;
};

export type PageExpandPlan = {
  from: Rect;
  to: Rect;
  headerPx: number;
  /** The big viewer at its final place. */
  viewer: Rect;
  tilePage: Rect | null;
  fit: Rect | null;
  /** The page's size on the tile as a share of its fit. */
  startScale: number;
  growMs: number;
  zoomMs: number;
};

const grow = (r: Rect, d: number): Rect => ({ x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d });

/** The big viewer inside a panel body: the body less its padding. */
export function viewerIn(body: Rect, padPx: number): Rect {
  return { x: body.x + padPx, y: body.y + padPx, w: Math.max(1, body.w - 2 * padPx), h: Math.max(1, body.h - 2 * padPx) };
}

export function planPageExpand(i: PageExpandInput): PageExpandPlan {
  const to = expandedRect(i.viewport);
  const page = i.tilePage && i.fit && i.tilePage.w > 0 && i.fit.w > 0 ? { tile: i.tilePage, fit: i.fit } : null;
  const startScale = page ? page.tile.w / page.fit.w : 1;
  const off = i.reducedMotion;
  return {
    // The panel's viewer starts exactly on the tile's: its body the tile's viewer and the padding, its header above.
    from: panelOverTile(grow(i.tileBox, i.padPx), i.headerPx),
    to,
    headerPx: i.headerPx,
    viewer: viewerIn(bodyOf(to, i.headerPx), i.padPx),
    tilePage: page?.tile ?? null,
    fit: page?.fit ?? null,
    startScale,
    growMs: off ? 0 : Math.max(0, i.growMs),
    zoomMs: off || !page || Math.abs(Math.log2(startScale)) < 0.01 ? 0 : Math.max(0, i.zoomMs),
  };
}

export function pageExpandTotalMs(p: PageExpandPlan): number {
  return p.growMs + p.zoomMs;
}

export function pagePanelAt(t: number, p: PageExpandPlan): Rect {
  return lerpRect(p.from, p.to, growProgress(t, p.growMs));
}

export function pageBackdropAt(t: number, p: PageExpandPlan): number {
  return growProgress(t, p.growMs);
}

/** The page's scale at `t`, as a share of its fit: the tile's through part 1, then on a log scale to 1. */
export function pageScaleAt(t: number, p: PageExpandPlan): number {
  if (t < p.growMs) return p.startScale;
  return p.startScale ** (1 - partTwoProgress(t, p.growMs, p.zoomMs));
}

/** The big viewer's transform at `t` (the fit with no page to move). */
export function pageViewAt(t: number, p: PageExpandPlan): View {
  if (!p.fit || !p.tilePage) return FIT_VIEW;
  const k = pageScaleAt(t, p);
  const fitMid = centreOf(p.fit);
  const mid = t < p.growMs ? lerpPoint(centreOf(p.tilePage), fitMid, growProgress(t, p.growMs)) : fitMid;
  // The viewer's transform scales from its top-left: a point q of the fit lands at viewer + T + k · (q − viewer).
  return { scale: k, tx: mid.x - p.viewer.x - k * (fitMid.x - p.viewer.x), ty: mid.y - p.viewer.y - k * (fitMid.y - p.viewer.y) };
}

/** Where the page stands on screen at `t`. */
export function pageRectAt(t: number, p: PageExpandPlan): Rect | null {
  if (!p.fit) return null;
  const v = pageViewAt(t, p);
  return {
    x: p.viewer.x + v.tx + v.scale * (p.fit.x - p.viewer.x),
    y: p.viewer.y + v.ty + v.scale * (p.fit.y - p.viewer.y),
    w: v.scale * p.fit.w,
    h: v.scale * p.fit.h,
  };
}

// ---------------------------------------------------------------------------
// The way back
// ---------------------------------------------------------------------------

export type PageCollapseInput = Omit<PageExpandInput, "tileBox"> & {
  /** The tile's viewer now; null when it cannot be measured (hidden through „Panouri", off the screen). */
  tileBox: Rect | null;
  /** The big viewer's transform as the way back starts. */
  current: View;
  flightMs: number;
  arc: number;
};

export type PageCollapsePlan = {
  expand: PageExpandPlan;
  current: View;
  returnMs: number;
  rise: number;
  arc: number;
  zoomMs: number;
  growMs: number;
};

/** Whether the big page stands at its fit: scale 1 (within 1 %), moved by no more than 2 % of the viewer. */
export function atFit(v: View, viewer: { w: number; h: number }): boolean {
  return Math.abs(Math.log2(v.scale)) < 0.015 && Math.abs(v.tx) <= COLLAPSE_RETURN_TOLERANCE * viewer.w && Math.abs(v.ty) <= COLLAPSE_RETURN_TOLERANCE * viewer.h;
}

export function planPageCollapse(i: PageCollapseInput): PageCollapsePlan {
  const measured = i.tileBox !== null;
  const panel = expandedRect(i.viewport);
  const body = bodyOf(panel, i.headerPx);
  const expand = planPageExpand({
    ...i,
    tileBox: i.tileBox ?? { x: body.x + i.padPx, y: body.y + i.padPx, w: body.w - 2 * i.padPx, h: body.h - 2 * i.padPx },
    tilePage: measured ? i.tilePage : null,
    growMs: measured ? i.growMs : 0,
    zoomMs: measured ? i.zoomMs : 0,
  });
  const back = !atFit(i.current, expand.viewer);
  return {
    expand,
    current: i.current,
    returnMs: back ? flightMs(i.reducedMotion, i.flightMs) : 0,
    rise: viewFlightRise(i.current, FIT_VIEW, expand.viewer),
    arc: i.arc,
    zoomMs: expand.zoomMs,
    growMs: expand.growMs,
  };
}

export function pageCollapseTotalMs(c: PageCollapsePlan): number {
  return c.returnMs + c.zoomMs + c.growMs;
}

export function pageCollapseViewAt(t: number, c: PageCollapsePlan): View {
  const o = openingClockBack(t, c.returnMs, c.expand.growMs, c.zoomMs);
  if (o !== null) return pageViewAt(o, c.expand);
  return returnViewAt(t, c.current, FIT_VIEW, c.expand.viewer, c.returnMs, c.rise, c.arc);
}

export function pageCollapsePanelAt(t: number, c: PageCollapsePlan): Rect {
  const o = openingClockBack(t, c.returnMs, c.expand.growMs, c.zoomMs);
  return pagePanelAt(o === null ? c.expand.growMs : o, c.expand);
}

export function pageCollapseBackdropAt(t: number, c: PageCollapsePlan): number {
  const o = openingClockBack(t, c.returnMs, c.expand.growMs, c.zoomMs);
  return pageBackdropAt(o === null ? c.expand.growMs : o, c.expand);
}
