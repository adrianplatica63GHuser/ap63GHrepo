/**
 * The properties map, opened on one Property                    (Slice #37.38)
 *
 * With a Property form open, „Proprietăți — Hartă" in the sidebar opens the
 * properties map centred on that Property, at the zoom its mini-map tile
 * shows, and blinks its polygon green three times. This module is the part of
 * that which needs no React and no Google Maps: the link, the reading of the
 * link, the zoom a fitBounds would give, and the blink's curve.
 *
 * ⚠️ **THE FOCUS TRAVELS IN THE QUERY STRING, NOT IN BROWSER STORAGE** (Adrian,
 * 2026-10-01): `/properties/map?focus=<id>&z=<zoom>`. The map reads it once on
 * arrival and removes it with `router.replace`, so a reload or a later visit
 * opens the ordinary map.
 *
 * PURE MODULE — no React, no DOM, no `google.maps`. Unit-tested directly in
 * `src/__tests__/map-focus.test.ts`.
 */

export type FocusCorner = { lat: number; lon: number };
export type LatLngLiteral = { lat: number; lng: number };

/** The route of the properties map. */
export const PROPERTY_MAP_PATH = "/properties/map";

/** What the map is asked to focus: a Property, and the zoom to show it at. */
export type MapFocus = { id: string; zoom: number | null };

// ---------------------------------------------------------------------------
// The blink
// ---------------------------------------------------------------------------

/**
 * ⚠️ **THE SAME NUMBERS AS `.ga-vpulse-green` IN `globals.css`**, the pulse on
 * the latest version's change (#18.15.bugs): a 0.8 s ease-in-out cycle in
 * rgb(34, 197, 94), whose keyframes go transparent → 0.95 → transparent with a
 * 0.45 glow. The map blinks THREE cycles where the form pulses four, so 2.4 s.
 * A Google polygon is not a DOM element, so the CSS cannot be applied to it;
 * the curve is computed instead (`blinkIntensity`), and
 * `map-focus.test.ts` reads `globals.css` to hold the two to the same numbers.
 *
 * The duplicate-polygon blink in property-map.tsx (pink, a 1 s toggle) is a
 * different signal and does not use this.
 */
export const FOCUS_BLINK = {
  cycleMs:     800,
  cycles:      3,
  totalMs:     2400,
  rgb:         "rgb(34, 197, 94)",
  /** The keyframe peak's outline alpha → the polygon's stroke opacity. */
  peakStroke:  0.95,
  /** The keyframe peak's glow alpha → the polygon's fill opacity. */
  peakFill:    0.45,
} as const;

/**
 * CSS `ease-in-out` — `cubic-bezier(0.42, 0, 0.58, 1)` — at progress `x`.
 * Solved for the curve's parameter by bisection, which is exact enough for an
 * opacity and cannot fail to converge.
 */
export function easeInOut(x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const x1 = 0.42, x2 = 0.58; // y1 = 0, y2 = 1
  const bx = (s: number) => 3 * (1 - s) * (1 - s) * s * x1 + 3 * (1 - s) * s * s * x2 + s * s * s;
  const by = (s: number) => 3 * (1 - s) * s * s + s * s * s;
  let lo = 0, hi = 1, s = x;
  for (let i = 0; i < 40; i++) {
    s = (lo + hi) / 2;
    if (bx(s) < x) lo = s; else hi = s;
  }
  return by(s);
}

/**
 * How green the polygon is `elapsedMs` after the blink started: 0 (its normal
 * colour) to 1 (the keyframe's peak), and `null` once the blink is over.
 *
 * Each 0.8 s cycle is the CSS keyframes 0% → 50% → 100% (0 → 1 → 0), with
 * `ease-in-out` applied to each half, which is what a CSS animation does with
 * a timing function: it applies per keyframe interval. Under
 * `prefers-reduced-motion` it is a steady 1 for the same 2.4 s, as
 * `.ga-vpulse-green` is a steady outline there.
 */
export function blinkIntensity(elapsedMs: number, reducedMotion = false): number | null {
  if (!(elapsedMs >= 0) || elapsedMs >= FOCUS_BLINK.totalMs) return null;
  if (reducedMotion) return 1;
  const p = (elapsedMs % FOCUS_BLINK.cycleMs) / FOCUS_BLINK.cycleMs;
  return p < 0.5 ? easeInOut(p * 2) : 1 - easeInOut((p - 0.5) * 2);
}

// ---------------------------------------------------------------------------
// Centre and zoom
// ---------------------------------------------------------------------------

/** The Google Maps world is 256 px wide at zoom 0. */
const WORLD_PX = 256;
/** The highest zoom the road and satellite maps offer here. */
export const MAX_FOCUS_ZOOM = 21;
/** fitBounds' padding in property-mini-map-inner.tsx. */
export const MINI_MAP_FIT_PADDING_PX = 40;

/** The centre of the corners' bounding box — what the map centres on. */
export function cornersBoundsCenter(corners: readonly FocusCorner[]): LatLngLiteral | null {
  if (corners.length === 0) return null;
  let s = Infinity, n = -Infinity, w = Infinity, e = -Infinity;
  for (const c of corners) {
    s = Math.min(s, c.lat); n = Math.max(n, c.lat);
    w = Math.min(w, c.lon); e = Math.max(e, c.lon);
  }
  return { lat: (s + n) / 2, lng: (w + e) / 2 };
}

/** Web Mercator y of a latitude, in radians/2 — the projection Google draws in. */
function mercatorY(lat: number): number {
  const sin = Math.sin((lat * Math.PI) / 180);
  const y = Math.log((1 + sin) / (1 - sin)) / 2;
  return Math.max(Math.min(y, Math.PI), -Math.PI) / 2;
}

/**
 * The zoom `map.fitBounds(<corners' bounds>, padding)` gives in a map box of
 * `widthPx` × `heightPx` — used when the mini-map is not mounted (its tile is
 * off), so there is no live zoom to read. The largest whole zoom at which the
 * bounds fit inside the box less the padding on each side, as Google's own
 * fitBounds picks it; one corner, or corners on one spot, fit at any zoom and
 * get the highest. `null` when there are no corners.
 */
export function zoomToFitCorners(
  corners: readonly FocusCorner[],
  widthPx: number,
  heightPx: number,
  paddingPx = MINI_MAP_FIT_PADDING_PX,
): number | null {
  if (corners.length === 0) return null;
  const lats = corners.map((c) => c.lat);
  const lons = corners.map((c) => c.lon);
  const latFraction = (mercatorY(Math.max(...lats)) - mercatorY(Math.min(...lats))) / Math.PI;
  const lngDiff = Math.max(...lons) - Math.min(...lons);
  const lngFraction = lngDiff / 360;
  const w = Math.max(1, widthPx - 2 * paddingPx);
  const h = Math.max(1, heightPx - 2 * paddingPx);
  const zoomFor = (px: number, fraction: number) =>
    fraction > 0 ? Math.floor(Math.log2(px / WORLD_PX / fraction)) : MAX_FOCUS_ZOOM;
  const z = Math.min(zoomFor(h, latFraction), zoomFor(w, lngFraction), MAX_FOCUS_ZOOM);
  return Math.max(0, z);
}

// ---------------------------------------------------------------------------
// The link, and reading it
// ---------------------------------------------------------------------------

/** A zoom as it travels in the link: at most two decimals, never `-0`. */
function zoomParam(zoom: number): string {
  return String(Math.round(zoom * 100) / 100 + 0);
}

/** `/properties/map?focus=<id>&z=<zoom>` — or the plain map when there is no zoom to carry. */
export function mapFocusHref(id: string, zoom: number | null): string {
  const q = new URLSearchParams({ focus: id });
  if (zoom !== null && Number.isFinite(zoom)) q.set("z", zoomParam(zoom));
  return `${PROPERTY_MAP_PATH}?${q.toString()}`;
}

/** A Property id as the routes spell it: a uuid. Anything else is not a focus. */
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The focus in a query string, or `null` when there is none worth acting on.
 * A `focus` that is not a uuid is ignored outright; a `z` that is missing, not
 * a number, or outside 0–22 is dropped and the map uses the fitted zoom.
 */
export function parseMapFocus(search: string | URLSearchParams): MapFocus | null {
  const q = typeof search === "string" ? new URLSearchParams(search) : search;
  const id = q.get("focus")?.trim() ?? "";
  if (!ID_RE.test(id)) return null;
  const raw = q.get("z");
  const z = raw === null || raw.trim() === "" ? NaN : Number(raw);
  return { id, zoom: Number.isFinite(z) && z >= 0 && z <= 22 ? z : null };
}

/**
 * The Property id in a pathname that is a Property's own form —
 * `/properties/<id>` exactly (every tile of the form is that one route) — or
 * `null`. „Adaugă nou" (`/properties/new`), the map and the association
 * screens under the id are not the form.
 */
export function propertyIdFromPath(pathname: string | null | undefined): string | null {
  const m = /^\/properties\/([^/?#]+)\/?$/.exec(pathname ?? "");
  return m && ID_RE.test(m[1]) ? m[1] : null;
}

// ---------------------------------------------------------------------------
// The form's side: what the sidebar link reads
// ---------------------------------------------------------------------------

/**
 * What an open Property form offers the sidebar link. Functions rather than
 * values, so the link reads them at the moment it is pressed — the mini-map's
 * zoom is whatever the user has zoomed to since the form opened.
 */
export type MapFocusSource = {
  propertyId: string;
  /** The LATEST saved corners — even while the form shows a historical version (the map draws only current polygons). */
  latestCorners: () => readonly FocusCorner[];
  /** The mini-map tile's live zoom, or `null` when the tile is not mounted. */
  miniMapZoom: () => number | null;
  /** The mini-map box, for the fitted zoom when the tile is off. */
  boxPx: { width: number; height: number };
};

let source: MapFocusSource | null = null;

/**
 * The form registers itself while it is mounted; the returned function
 * unregisters it, and only if it is still the registered one, so a form that
 * unmounts after the next one mounted cannot clear the next one's source.
 */
export function setMapFocusSource(next: MapFocusSource): () => void {
  source = next;
  return () => {
    if (source === next) source = null;
  };
}

/** The href „Proprietăți — Hartă" navigates to from `pathname`, at this moment. */
export function propertyMapHref(pathname: string | null | undefined): string {
  const id = propertyIdFromPath(pathname);
  if (!id || !source || source.propertyId !== id) return PROPERTY_MAP_PATH;
  const corners = source.latestCorners();
  if (corners.length === 0) return PROPERTY_MAP_PATH;
  const zoom =
    source.miniMapZoom() ?? zoomToFitCorners(corners, source.boxPx.width, source.boxPx.height);
  return mapFocusHref(id, zoom);
}
