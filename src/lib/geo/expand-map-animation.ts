/**
 * „Hartă extinsă" opens as an animation, in two parts.                                                (Slice 41.75)
 *
 * Adrian, 2026-11-03: „The map tile become bigger up to the maximum size of expanded map; during the same interval the
 * polygon of the property will travel from initial position to the centre of the screen; after this time interval we
 * have the expanded map … the polygon of the property in the middle of the screen having the same size as when we
 * started; now we should start zooming out during another time interval … until the property polygon height becomes
 * about 10% of the screen height".
 *
 * Part 1, „the tile grows" (Ask first 1): the panel starts on the tile's own map, its header just above it, and grows
 * to the expanded map's rectangle (inset 16 px), eased in-out. The map keeps the tile's zoom, so the polygon keeps its
 * size on screen, and the camera's centre moves so that the polygon's centre travels on a straight line from where it
 * was on the tile to the middle of the map, arriving as the panel arrives.
 *
 * Part 2, „zooming out" (Ask first 2): from the tile's zoom to the one at which the corners' box is a tenth of the
 * map's height — its width kept inside the map — eased, the polygon held in the middle. One rule both ways: a polygon
 * already smaller than that zooms in to it; within half a zoom level the part is skipped.
 *
 * Each part's length is a setting (`map_expand_grow`, `map_expand_zoom_out`, 3,0 s each); 0 skips that part, and
 * under prefers-reduced-motion both are 0 — the overlay opens at the end at once (Ask first 3).
 *
 * Pure: no Google object, no DOM. The overlay (property-form.tsx) and its animator (expand-map-animator.tsx) draw it.
 */

export type LatLng = { lat: number; lng: number };
export type Corner = { lat: number; lon: number };
export type Rect = { x: number; y: number; w: number; h: number };
export type Camera = { center: LatLng; zoom: number };

/** The two settings, in milliseconds (time_frame_setting, migration_127). */
export const EXPAND_GROW_KEY = "map_expand_grow";
export const EXPAND_ZOOM_OUT_KEY = "map_expand_zoom_out";
export const EXPAND_DEFAULT_MS = 3000;
/** The range „Setări" and the API accept for each, in ms: 0 (the part skipped) to 10 s. */
export const EXPAND_MIN_MS = 0;
export const EXPAND_MAX_MS = 10_000;

/** The polygon's height at the end, as a share of the map's; and how much of the map's width it may take. */
export const EXPAND_HEIGHT_FRACTION = 0.1;
export const EXPAND_WIDTH_LIMIT = 0.9;
/** Closer than this, in zoom levels, the zoom-out is skipped. */
export const EXPAND_SKIP_ZOOM = 0.5;
/** The expanded map's margin to the window: the panel's `inset-4`. */
export const EXPAND_INSET_PX = 16;
/** The highest zoom the maps offer here (map-focus.ts's MAX_FOCUS_ZOOM). */
export const EXPAND_MAX_ZOOM = 21;

const WORLD_PX = 256;

/** Web Mercator, in world pixels at `zoom`. */
function toWorld(p: LatLng, zoom: number): { x: number; y: number } {
  const size = WORLD_PX * 2 ** zoom;
  const sin = Math.min(Math.max(Math.sin((p.lat * Math.PI) / 180), -0.9999), 0.9999);
  return { x: ((p.lng + 180) / 360) * size, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size };
}

function fromWorld(w: { x: number; y: number }, zoom: number): LatLng {
  const size = WORLD_PX * 2 ** zoom;
  const n = Math.PI - (2 * Math.PI * w.y) / size;
  return { lat: (Math.atan(Math.sinh(n)) * 180) / Math.PI, lng: (w.x / size) * 360 - 180 };
}

/** Ease-in-out (cubic): slow at both ends. */
export function easeInOut(s: number): number {
  const x = Math.min(1, Math.max(0, s));
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

const lerp = (a: number, b: number, s: number) => a + (b - a) * s;
const lerpRect = (a: Rect, b: Rect, s: number): Rect => ({ x: lerp(a.x, b.x, s), y: lerp(a.y, b.y, s), w: lerp(a.w, b.w, s), h: lerp(a.h, b.h, s) });
const centreOf = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** The centre of the corners' box (map-focus.ts's `cornersBoundsCenter`), or null with no corners. */
export function cornersCentre(corners: readonly Corner[]): LatLng | null {
  if (corners.length === 0) return null;
  const lats = corners.map((c) => c.lat);
  const lons = corners.map((c) => c.lon);
  return { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lng: (Math.min(...lons) + Math.max(...lons)) / 2 };
}

/**
 * The zoom at which the corners' box is `fraction` of the map's height, its width at most `widthLimit` of the map's.
 * One corner, or corners on one spot, have no height: `null`, and the zoom-out is skipped.
 */
export function zoomForHeightFraction(
  corners: readonly Corner[],
  mapW: number,
  mapH: number,
  fraction = EXPAND_HEIGHT_FRACTION,
  widthLimit = EXPAND_WIDTH_LIMIT,
): number | null {
  if (corners.length === 0) return null;
  const north = Math.max(...corners.map((c) => c.lat));
  const south = Math.min(...corners.map((c) => c.lat));
  const east = Math.max(...corners.map((c) => c.lon));
  const west = Math.min(...corners.map((c) => c.lon));
  // At zoom 0, in world pixels.
  const hPx = toWorld({ lat: south, lng: 0 }, 0).y - toWorld({ lat: north, lng: 0 }, 0).y;
  const wPx = toWorld({ lat: 0, lng: east }, 0).x - toWorld({ lat: 0, lng: west }, 0).x;
  if (!(hPx > 0) && !(wPx > 0)) return null;
  const byHeight = hPx > 0 ? Math.log2((Math.max(1, mapH) * fraction) / hPx) : Infinity;
  const byWidth = wPx > 0 ? Math.log2((Math.max(1, mapW) * widthLimit) / wPx) : Infinity;
  return Math.max(0, Math.min(byHeight, byWidth, EXPAND_MAX_ZOOM));
}

export type ExpandInput = {
  /** The tile's map on screen, as the button was pressed. */
  tileMap: Rect;
  /** The window. */
  viewport: { w: number; h: number };
  /** The overlay's header, above its map. */
  headerPx: number;
  /** Where the tile's map looks: its centre and zoom. */
  tileCenter: LatLng;
  zoom: number;
  corners: readonly Corner[];
  growMs: number;
  zoomMs: number;
  reducedMotion: boolean;
};

export type ExpandPlan = {
  /** The panel — header and map — at the start and at the end. */
  from: Rect;
  to: Rect;
  headerPx: number;
  zoom: number;
  tileCenter: LatLng;
  /** What travels to the middle: the corners' box centre (the tile's centre for a property with no corners). */
  target: LatLng;
  endZoom: number;
  growMs: number;
  zoomMs: number;
};

/** A setting's value as a part's length: whole ms in 0..10 s, the default for anything else. */
export function usableExpandMs(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= EXPAND_MIN_MS && value <= EXPAND_MAX_MS ? value : EXPAND_DEFAULT_MS;
}

export function planExpand(i: ExpandInput): ExpandPlan {
  const to: Rect = {
    x: EXPAND_INSET_PX,
    y: EXPAND_INSET_PX,
    w: Math.max(1, i.viewport.w - 2 * EXPAND_INSET_PX),
    h: Math.max(1, i.viewport.h - 2 * EXPAND_INSET_PX),
  };
  // The panel's map starts exactly on the tile's map; its header just above it.
  const from: Rect = { x: i.tileMap.x, y: i.tileMap.y - i.headerPx, w: i.tileMap.w, h: i.tileMap.h + i.headerPx };
  const target = cornersCentre(i.corners) ?? i.tileCenter;
  const fit = zoomForHeightFraction(i.corners, to.w, to.h - i.headerPx);
  const endZoom = fit === null || Math.abs(fit - i.zoom) < EXPAND_SKIP_ZOOM ? i.zoom : fit;
  const off = i.reducedMotion;
  return {
    from,
    to,
    headerPx: i.headerPx,
    zoom: i.zoom,
    tileCenter: i.tileCenter,
    target,
    endZoom,
    growMs: off ? 0 : Math.max(0, i.growMs),
    zoomMs: off || endZoom === i.zoom ? 0 : Math.max(0, i.zoomMs),
  };
}

/** How long the whole opening lasts. */
export function expandTotalMs(p: ExpandPlan): number {
  return p.growMs + p.zoomMs;
}

/** Part 1's progress at `t`, eased: 0 at the start, 1 once the panel has arrived. */
function growProgress(t: number, p: ExpandPlan): number {
  return p.growMs <= 0 || t >= p.growMs ? 1 : easeInOut(Math.max(0, t) / p.growMs);
}

/** The panel's rectangle at `t` ms. */
export function panelRectAt(t: number, p: ExpandPlan): Rect {
  return lerpRect(p.from, p.to, growProgress(t, p));
}

/** The panel's map at `t`: the panel less its header. */
export function mapRectAt(t: number, p: ExpandPlan): Rect {
  const r = panelRectAt(t, p);
  return { x: r.x, y: r.y + p.headerPx, w: r.w, h: Math.max(1, r.h - p.headerPx) };
}

/** The backdrop's opacity at `t`: it fades in with part 1. */
export function backdropAt(t: number, p: ExpandPlan): number {
  return growProgress(t, p);
}

/** The camera at `t` ms. */
export function expandCameraAt(t: number, p: ExpandPlan): Camera {
  if (t < p.growMs) {
    const e = growProgress(t, p);
    const scaleWorld = (q: LatLng) => toWorld(q, p.zoom);
    const tw = scaleWorld(p.target);
    const cw = scaleWorld(p.tileCenter);
    const m0 = centreOf(mapRectAt(0, p));
    const m1 = centreOf(mapRectAt(p.growMs, p));
    // Where the polygon's centre is on screen: on the tile at the start, the map's middle at the end.
    const s0 = { x: m0.x + (tw.x - cw.x), y: m0.y + (tw.y - cw.y) };
    const s = { x: lerp(s0.x, m1.x, e), y: lerp(s0.y, m1.y, e) };
    const m = centreOf(mapRectAt(t, p));
    return { center: fromWorld({ x: tw.x + (m.x - s.x), y: tw.y + (m.y - s.y) }, p.zoom), zoom: p.zoom };
  }
  const z = p.zoomMs <= 0 || t >= p.growMs + p.zoomMs ? 1 : easeInOut((t - p.growMs) / p.zoomMs);
  return { center: p.target, zoom: lerp(p.zoom, p.endZoom, z) };
}

/** Where the overlay's map is created: the camera at the start (the end, when both parts are 0). */
export function expandStartView(p: ExpandPlan): Camera {
  return expandCameraAt(0, p);
}
