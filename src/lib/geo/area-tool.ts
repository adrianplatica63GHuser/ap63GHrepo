/**
 * THE MAP'S AREA TOOLS — the polygon, its area and its label.          (Slices #39.07, #39.08)
 *
 * On the map of all properties two toggles measure an area without writing anything:
 *   - „Suprafața unei zone delimitate" (#39.07, mode "delimited"): click existing property corners one after another
 *     — each the nearest corner within SNAP_PX, exactly as the Ruler snaps (#18.14) — and a polygon is drawn
 *     through them;
 *   - „Suprafața unei zone oarecare" (#39.08, mode "free"): the polygon is drawn freely, as a new property's is.
 * Both draw the same light violet (mauve) polygon and write its area inside it, and while either is pressed nothing
 * else on the map can be done (only panning and zooming). This module is what they share, and it is pure.
 *
 * THE AREA IS A PARCEL'S AREA: Stereo 70 metres through the Ruler's local affine fit (`applyAffine`), then
 * `shoelaceAreaM2` — exactly the property form's computation, never the degree-space `polygonAreaDeg` the map uses
 * to order its InfoWindow. An order whose sides cross is MARKED (`polygonSelfIntersects`, #32.14) instead of
 * showing a meaningless number.
 */
import { applyAffine, type AffineWgs84ToStereo70, type LatLon } from "@/lib/geo/ruler";
import { polygonSelfIntersects, shoelaceAreaM2 } from "@/lib/properties/area";

export type AreaMode = "delimited" | "free";

/** The light violet (mauve) of both tools — Tailwind's violet-300 fill under a violet-500 stroke. */
export const AREA_FILL = "#c4b5fd";
export const AREA_STROKE = "#8b5cf6";
/** The label: violet-950 on the mauve, ≥ 4.5 : 1 (`contrastRatio` below; area-tool.test.ts holds it), haloed white. */
export const AREA_INK = "#2e1065";
export const AREA_FILL_OPACITY = 0.35;

/** What the tools show for a polygon: its area in m², null under three corners, or the crossing mark. */
export type AreaReading = { kind: "none" } | { kind: "area"; m2: number } | { kind: "crossing" };

/** The polygon's area through the local Stereo 70 fit — or the mark when its sides cross. */
export function readArea(aff: AffineWgs84ToStereo70, corners: readonly LatLon[]): AreaReading {
  if (corners.length < 3) return { kind: "none" };
  const planar = corners.map((c) => applyAffine(aff, c));
  if (polygonSelfIntersects(planar)) return { kind: "crossing" };
  const m2 = shoelaceAreaM2(planar);
  return m2 === null ? { kind: "none" } : { kind: "area", m2 };
}

/**
 * Romanian formatting, „12.345 m² (1,2345 ha)" (#39.07's Ask first 2): whole square metres grouped by „.", hectares
 * to four decimals with „,". Written out rather than through Intl, whose Romanian grouping of four-digit numbers
 * depends on the ICU the browser ships.
 */
export function formatAreaRo(m2: number): string {
  const safe = Number.isFinite(m2) && m2 > 0 ? m2 : 0;
  const whole = Math.round(safe);
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const [intPart, frac] = (safe / 10_000).toFixed(4).split(".");
  return `${grouped} m² (${intPart},${frac} ha)`;
}

/** The label's font: 10 % of the smaller side of the polygon's on-screen box, between 11 and 48 px (Ask first 1). */
export const LABEL_MIN_PX = 11;
export const LABEL_MAX_PX = 48;
export function labelFontPx(box: { width: number; height: number }): number {
  const side = Math.min(Math.abs(box.width), Math.abs(box.height));
  const px = Math.round(side * 0.1);
  return Math.min(LABEL_MAX_PX, Math.max(LABEL_MIN_PX, Number.isFinite(px) ? px : LABEL_MIN_PX));
}

/** The on-screen box of a list of pixel points. */
export function pixelBox(points: readonly { x: number; y: number }[]): { width: number; height: number } {
  if (points.length === 0) return { width: 0, height: 0 };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

/**
 * Where the label stands: the polygon's area centroid (shoelace), which is inside any convex polygon; the vertices'
 * mean when the area is degenerate. In degrees — over a parcel's few hundred metres that is the planar centroid.
 */
export function labelPoint(corners: readonly LatLon[]): LatLon | null {
  if (corners.length === 0) return null;
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < corners.length; i++) {
    const p = corners[i]!;
    const q = corners[(i + 1) % corners.length]!;
    const cross = p.lon * q.lat - q.lon * p.lat;
    a += cross;
    cx += (p.lon + q.lon) * cross;
    cy += (p.lat + q.lat) * cross;
  }
  if (Math.abs(a) < 1e-18) {
    return {
      lat: corners.reduce((s, c) => s + c.lat, 0) / corners.length,
      lon: corners.reduce((s, c) => s + c.lon, 0) / corners.length,
    };
  }
  return { lat: cy / (3 * a), lon: cx / (3 * a) };
}

const same = (a: LatLon, b: LatLon) => a.lat === b.lat && a.lon === b.lon;

/** „Delimited": a corner clicked joins the list — unless it is the last one again (a double click). */
export function addCorner(corners: readonly LatLon[], corner: LatLon): readonly LatLon[] {
  const last = corners[corners.length - 1];
  return last && same(last, corner) ? corners : [...corners, corner];
}

/** Backspace removes the last corner (Ask first 3). */
export function removeLastCorner(corners: readonly LatLon[]): readonly LatLon[] {
  return corners.slice(0, -1);
}

/** Pressing a tool's button: on → that tool (the other released, its polygon gone); pressed again → none. */
export function nextAreaMode(current: AreaMode | null, pressed: AreaMode): AreaMode | null {
  return current === pressed ? null : pressed;
}

/** WCAG contrast ratio of two #rrggbb colours — the label's 4.5 : 1 is held against the mauve. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = hex.replace("#", "");
    const [r, g, bl] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** The polygon's extent in Stereo 70 metres — east to west, north to south — for the label's size. */
export function metresBox(aff: AffineWgs84ToStereo70, corners: readonly LatLon[]): { width: number; height: number } {
  if (corners.length === 0) return { width: 0, height: 0 };
  const pts = corners.map((c) => applyAffine(aff, c));
  const easts = pts.map((p) => p.east);
  const norths = pts.map((p) => p.north);
  return { width: Math.max(...easts) - Math.min(...easts), height: Math.max(...norths) - Math.min(...norths) };
}

/** Web Mercator's screen pixels per ground metre at `zoom`, at latitude `lat` (256-pixel tiles). */
export function pixelsPerMetre(zoom: number, lat: number): number {
  return (256 * 2 ** zoom) / (40_075_016.686 * Math.cos((lat * Math.PI) / 180));
}
