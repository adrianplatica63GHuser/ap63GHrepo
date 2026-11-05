/**
 * The big map's search: one place, found and flown to.                                              (Slice 41.70)
 *
 * Adrian, 2026-11-03: „On the Big Map we should have a Search button with the icon of a Magnifier that opens a Search
 * box where we can type one of the following: an address, a name on the map, or the number part of the system ID for
 * the property; The system should identify the item using the best available precision or granularity – best guess -
 * and then it should zoom in slowly (over a 4 seconds animation) to display that item in the middle of the map with the
 * size around 10% of the big map size".
 *
 * PURE — no Maps API here, so every rule is tested on plain objects (`map-search.test.ts`); property-map.tsx does the
 * look-up and moves the camera. What the box understands, best guess first (Ask first 1):
 *   (a) only digits, or „PROP" and digits → the property whose code has that number (42 → PROP00042);
 *   (b) otherwise a property's nickname, then a tarla's indicativ, on the map's own data — exact, then starts with,
 *       then contains, ignoring case and diacritics (`rankMapMatches`) — no Google call;
 *   (c) otherwise one Google Geocoder look-up, read by `readGeocodeResult` into a point or an area.
 * „The item" and its size (Ask first 2): a property or a tarla → its corners' box at a tenth of the map's width or
 * height, whichever binds first (`zoomForBoxFraction`); a geocoded point → zoom 18 (`POINT_ZOOM`); a geocoded area →
 * its viewport filling the map. The flight (Ask first 3): 4 s, ease-in-out, centre and zoom together, zooming out
 * first when the two ends do not both fit in the view (`flightPeak`, `cameraAt`).
 *
 * Slice 41.76 (Adrian: „the observer of the map moves on a parabola up from the current location (zoom out) and towards
 * the new location and then zooms in to the new location … the duration of the transition and “a” coefficient of the
 * parabola"): the zoom is no longer a V down to `flightPeak` and back. The observer's height, in zoom levels, is the
 * straight line from the start's to the end's plus a · R · 4x(1 − x) — x the share of the way, eased; R the climb that
 * brings both places into one view, at least one level (`flightRise`). a = 0 is a straight glide, a = 1 tops out where
 * both places just show, a = 2 climbs twice that. Its length and a are settings (`map_search_flight`,
 * `map_search_arc`, „Setări" → „Hărți").
 */

export type LatLng = { lat: number; lng: number };
export type Corner = { lat: number; lon: number };
export type Bounds = { north: number; south: number; east: number; west: number };

/** The map's own records the box searches (GET /api/properties/map). */
export type MapSearchProperty = { id: string; code: string; nickname: string | null; corners: readonly Corner[] };
export type MapSearchTarla = { id: string; indicativ: string; corners: readonly Corner[] };

/** A record the box found, with the corners the camera frames. */
export type MapSearchHit = { kind: "property" | "tarla"; id: string; label: string; corners: readonly Corner[] };

/** What the text is, before anything is looked up. */
export type MapSearchQuery = { kind: "empty" } | { kind: "code"; code: string } | { kind: "text"; text: string };

/** The flight's length, Adrian's „over a 4 seconds animation" — since 41.76 the default of `map_search_flight`. */
export const FLIGHT_MS = 4000;
/** 41.76: the parabola's coefficient a, by default — `map_search_arc`, stored in hundredths (100). */
export const FLIGHT_ARC = 1;
/** 41.76: the least the observer rises, in zoom levels, so a short hop still climbs. */
export const MIN_RISE = 1;
/** A geocoded street address: centred at this zoom (Ask first 2). */
export const POINT_ZOOM = 18;
/** The share of the map's width or height a found record's box takes on landing. */
export const ITEM_FRACTION = 0.1;
/** The highest zoom the camera lands on — a tiny lot's tenth would otherwise be past the map's last zoom. */
export const MAX_SEARCH_ZOOM = 21;
const WORLD_PX = 256;

/** A property's code from its number, as queries.ts spells it: 'PROP' || lpad(n, 5, '0'). */
export function propertyCode(n: number): string {
  return `PROP${String(n).padStart(5, "0")}`;
}

/** Case and diacritics folded away: „Ștefănești" and „stefanesti" are one text. */
export function foldText(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** (a) digits, with or without „PROP" before them, are a property's number; anything else is text. */
export function classifySearch(raw: string): MapSearchQuery {
  const text = raw.trim();
  if (!text) return { kind: "empty" };
  const m = /^(?:prop)?0*(\d{1,9})$/i.exec(text.replace(/\s+/g, ""));
  if (m) {
    const n = Number(m[1]);
    if (n > 0) return { kind: "code", code: propertyCode(n) };
  }
  return { kind: "text", text };
}

/** The property a code names, when it is on the map. */
export function findByCode(code: string, properties: readonly MapSearchProperty[]): MapSearchHit | null {
  const p = properties.find((x) => x.code.toUpperCase() === code && x.corners.length > 0);
  // The label is for ranking only; a record with no name is never named by its code (system-id-one-place).
  return p ? { kind: "property", id: p.id, label: p.nickname ?? "", corners: p.corners } : null;
}

/** 0 exact, 1 starts with, 2 contains, -1 no match — on folded text. */
function tier(name: string, q: string): number {
  const n = foldText(name);
  if (!n || !q) return -1;
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  return n.includes(q) ? 2 : -1;
}

/**
 * (b) the map's own matches, best first: by how well the name matches (exact, then starts with, then contains) and,
 * at one level, a property's nickname before a tarla's indicativ, then by name. Records without corners are skipped:
 * the camera could not frame them.
 */
export function rankMapMatches(text: string, properties: readonly MapSearchProperty[], tarlale: readonly MapSearchTarla[]): MapSearchHit[] {
  const q = foldText(text);
  const ranked: { t: number; k: number; hit: MapSearchHit }[] = [];
  for (const p of properties) {
    if (!p.nickname || p.corners.length === 0) continue;
    const t = tier(p.nickname, q);
    if (t >= 0) ranked.push({ t, k: 0, hit: { kind: "property", id: p.id, label: p.nickname, corners: p.corners } });
  }
  for (const tl of tarlale) {
    if (tl.corners.length === 0) continue;
    const t = tier(tl.indicativ, q);
    if (t >= 0) ranked.push({ t, k: 1, hit: { kind: "tarla", id: tl.id, label: tl.indicativ, corners: tl.corners } });
  }
  ranked.sort((a, b) => a.t - b.t || a.k - b.k || a.hit.label.localeCompare(b.hit.label, "ro"));
  return ranked.map((r) => r.hit);
}

// ---------------------------------------------------------------------------
// (c) the geocoder's answer
// ---------------------------------------------------------------------------

type LatLngLike = LatLng | { lat(): number; lng(): number };
type BoundsLike = Bounds | { toJSON(): Bounds };

/** The subset of a `google.maps.GeocoderResult` read here — structural, so a test passes plain objects. */
export type GeocoderResultLike = {
  geometry: { location: LatLngLike; location_type?: string; viewport?: BoundsLike };
};

/** Where a geocoded answer lands: a point at `POINT_ZOOM`, or an area whose viewport fills the map. */
export type GeocodeTarget = { kind: "point"; at: LatLng } | { kind: "area"; bounds: Bounds };

const latLngOf = (l: LatLngLike): LatLng => (typeof l.lat === "function" ? { lat: (l as { lat(): number }).lat(), lng: (l as { lng(): number }).lng() } : (l as LatLng));
const boundsOf = (b: BoundsLike): Bounds => ("toJSON" in b && typeof b.toJSON === "function" ? b.toJSON() : (b as Bounds));

/**
 * A street address (ROOFTOP, RANGE_INTERPOLATED) is a point; a street, a locality, a county (GEOMETRIC_CENTER,
 * APPROXIMATE) is an area — a whole locality at a tenth of the map would show nothing useful (Ask first 2).
 */
export function readGeocodeResult(result: GeocoderResultLike | null | undefined): GeocodeTarget | null {
  if (!result?.geometry?.location) return null;
  const at = latLngOf(result.geometry.location);
  if (!Number.isFinite(at.lat) || !Number.isFinite(at.lng)) return null;
  const type = result.geometry.location_type;
  if (type === "ROOFTOP" || type === "RANGE_INTERPOLATED" || !result.geometry.viewport) return { kind: "point", at };
  return { kind: "area", bounds: boundsOf(result.geometry.viewport) };
}

// ---------------------------------------------------------------------------
// The camera
// ---------------------------------------------------------------------------

/** Web Mercator y of a latitude, in radians/2 — the projection Google draws in (map-focus.ts's). */
function mercatorY(lat: number): number {
  const sin = Math.sin((lat * Math.PI) / 180);
  const y = Math.log((1 + sin) / (1 - sin)) / 2;
  return Math.max(Math.min(y, Math.PI), -Math.PI) / 2;
}

function latOfMercatorY(y: number): number {
  return (Math.atan(Math.sinh(y * 2)) * 180) / Math.PI;
}

/** The box around some corners. */
export function cornersBounds(corners: readonly Corner[]): Bounds {
  let south = Infinity, north = -Infinity, west = Infinity, east = -Infinity;
  for (const c of corners) {
    south = Math.min(south, c.lat); north = Math.max(north, c.lat);
    west = Math.min(west, c.lon); east = Math.max(east, c.lon);
  }
  return { north, south, east, west };
}

/** A box's centre, in the projection (so a tall box's centre is where the map draws it). */
export function boundsCenter(b: Bounds): LatLng {
  return { lat: latOfMercatorY((mercatorY(b.north) + mercatorY(b.south)) / 2), lng: (b.east + b.west) / 2 };
}

/**
 * The zoom at which a box takes `fraction` of the map's width or height, whichever binds first — the other side then
 * takes less. Continuous (a vector map takes a fractional zoom; a raster one rounds it). A box of no size — one corner,
 * a point property — gets `maxZoom`.
 */
export function zoomForBoxFraction(b: Bounds, widthPx: number, heightPx: number, fraction = ITEM_FRACTION, maxZoom = MAX_SEARCH_ZOOM): number {
  const latFraction = (mercatorY(b.north) - mercatorY(b.south)) / Math.PI;
  let lngSpan = b.east - b.west;
  if (lngSpan < 0) lngSpan += 360;
  const lngFraction = lngSpan / 360;
  const zoomFor = (px: number, f: number) => (f > 0 ? Math.log2((Math.max(1, px) * fraction) / WORLD_PX / f) : maxZoom);
  return Math.max(0, Math.min(zoomFor(heightPx, latFraction), zoomFor(widthPx, lngFraction), maxZoom));
}

export type Camera = { center: LatLng; zoom: number };

/** Where a found record lands: its box centred, at a tenth of the map. */
export function cameraForCorners(corners: readonly Corner[], widthPx: number, heightPx: number): Camera {
  const b = cornersBounds(corners);
  const point = b.north === b.south && b.east === b.west;
  return { center: boundsCenter(b), zoom: point ? POINT_ZOOM : zoomForBoxFraction(b, widthPx, heightPx) };
}

/** Where a geocoded answer lands: a point at zoom 18, an area's viewport filling the map. */
export function cameraForGeocode(target: GeocodeTarget, widthPx: number, heightPx: number): Camera {
  if (target.kind === "point") return { center: target.at, zoom: POINT_ZOOM };
  return { center: boundsCenter(target.bounds), zoom: zoomForBoxFraction(target.bounds, widthPx, heightPx, 1) };
}

/** Ease-in-out (cubic): slow at both ends, „zoom in slowly". */
export function easeInOut(s: number): number {
  const x = Math.min(1, Math.max(0, s));
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

/**
 * The lowest zoom of the flight: the camera zooms out first when the start and the target do not both fit in the
 * view at the lower of their two zooms, so the path between them is seen (Ask first 3). Never higher than either end.
 */
export function flightPeak(from: Camera, to: Camera, widthPx: number, heightPx: number): number {
  const both: Bounds = {
    north: Math.max(from.center.lat, to.center.lat),
    south: Math.min(from.center.lat, to.center.lat),
    east: Math.max(from.center.lng, to.center.lng),
    west: Math.min(from.center.lng, to.center.lng),
  };
  const seeBoth = zoomForBoxFraction(both, widthPx, heightPx, 0.8);
  return Math.min(from.zoom, to.zoom, seeBoth);
}

/** The flight's length: the setting's (4 s by default), none under prefers-reduced-motion — the camera jumps. */
export function flightMs(reducedMotion: boolean, durationMs = FLIGHT_MS): number {
  return reducedMotion ? 0 : Math.max(0, durationMs);
}

const lerp = (a: number, b: number, s: number) => a + (b - a) * s;

/**
 * 41.76: R — how many zoom levels the observer must climb above the lower end for both places to show (`flightPeak`),
 * and at least `MIN_RISE`, so a short hop still rises (Ask first 1).
 */
export function flightRise(from: Camera, to: Camera, peak: number): number {
  return Math.max(MIN_RISE, Math.min(from.zoom, to.zoom) - peak);
}

/**
 * The camera `tMs` into the flight. The centre eased in Mercator, as 41.70 did; the zoom on the parabola (41.76): the
 * straight line from the start's zoom to the end's, less a · R · 4x(1 − x) — x the share of the way, eased — so the
 * top, half way, is a · R above the line. Never below zoom 0.
 */
export function cameraAt(tMs: number, from: Camera, to: Camera, peak: number, durationMs = FLIGHT_MS, arc = FLIGHT_ARC): Camera {
  if (durationMs <= 0 || tMs >= durationMs) return to;
  const x = easeInOut(Math.max(0, tMs) / durationMs);
  const center = {
    lat: latOfMercatorY(lerp(mercatorY(from.center.lat), mercatorY(to.center.lat), x)),
    lng: lerp(from.center.lng, to.center.lng, x),
  };
  return { center, zoom: Math.max(0, parabolaZoom(x, from.zoom, to.zoom, flightRise(from, to, peak), arc)) };
}

/**
 * 41.87: the observer's height on 41.76's parabola, shared by every flight that is not a map's (the whole tree's
 * return, 41.87; the big page's, 41.88): the straight line from `z0` to `z1` less a · R · 4x(1 − x), x the eased
 * share of the way. Unclamped — a map's zoom stops at 0, a drawing's scale below 1 is a negative level.
 */
export function parabolaZoom(x: number, z0: number, z1: number, rise: number, arc = FLIGHT_ARC): number {
  return lerp(z0, z1, x) - Math.max(0, arc) * rise * 4 * x * (1 - x);
}

/** „Căutare globală" with the typed text, which it reads from `?search=` (global-search-view.tsx). */
export function globalSearchHref(text: string): string {
  const t = text.trim();
  return t ? `/admin/global-search?search=${encodeURIComponent(t)}` : "/admin/global-search";
}
