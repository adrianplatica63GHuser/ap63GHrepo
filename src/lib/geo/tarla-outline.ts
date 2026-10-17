/**
 * A tarla's outline — its own corners when they are drawn, otherwise the shape around all its properties.
 *                                                                                        (Slice #39.68)
 *
 * No public source gives tarla boundaries (the box on every tarla page says so), so the outline comes from the
 * archive's own data, at no cost: the convex hull of every corner of every property on the tarla. It grows as the
 * archive grows. A tarla whose corners were entered on its page (`tarla_corner`, #39.67) shows those instead — a drawn
 * outline is a person's statement and wins over a computed one. Concave outlines are out of scope (Ask first 1: the
 * convex hull, computed in the browser from the corners the map already loads).
 *
 * PURE: no React, no maps library. The map draws `path`; the label stands at `labelAt`.
 */

export type LatLon = { lat: number; lon: number };

export type TarlaOutline =
  | { kind: "drawn"; path: LatLon[] }
  | { kind: "hull"; path: LatLon[] }
  | { kind: "none"; path: [] };

/** Ask first 3: a dashed grey-green line, no fill, so it never reads as a property (properties are blue). */
export const TARLA_STROKE = "#5f7f62";
export const TARLA_STROKE_WEIGHT = 2;
/** Ask first 2: labels „from about 6 km down" — at zoom 14 a 1000-px map shows about 7 km at 44° N. */
export const TARLA_LABEL_MIN_ZOOM = 14;

function cross(o: LatLon, a: LatLon, b: LatLon): number {
  return (a.lon - o.lon) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lon - o.lon);
}

/**
 * The convex hull, counter-clockwise, without repeating the first point; collinear points on an edge dropped.
 * Andrew's monotone chain on (lon, lat) — at a tarla's size the plane is close enough to the sphere for a shape that
 * is drawn, never measured. Fewer than three distinct points: those points (a hull of nothing is nothing).
 */
export function convexHull(points: readonly LatLon[]): LatLon[] {
  const seen = new Set<string>();
  const pts: LatLon[] = [];
  for (const p of points) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) continue;
    const k = `${p.lat},${p.lon}`;
    if (seen.has(k)) continue;
    seen.add(k);
    pts.push({ lat: p.lat, lon: p.lon });
  }
  if (pts.length < 3) return pts;
  pts.sort((a, b) => a.lon - b.lon || a.lat - b.lat);
  const lower: LatLon[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: LatLon[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** The outline: the drawn corners (three or more), else the hull of the properties' corners (three or more). */
export function tarlaOutline(own: readonly LatLon[], propertyCorners: readonly (readonly LatLon[])[]): TarlaOutline {
  if (own.length >= 3) return { kind: "drawn", path: own.map((c) => ({ lat: c.lat, lon: c.lon })) };
  const hull = convexHull(propertyCorners.flat());
  return hull.length >= 3 ? { kind: "hull", path: hull } : { kind: "none", path: [] };
}

/** The closed ring the map draws as a line: the path with its first point repeated at the end. */
export function closedRing(path: readonly LatLon[]): LatLon[] {
  return path.length === 0 ? [] : [...path, path[0]];
}

/** Where the code is written: the outline's northernmost point, so the label sits on the line, above the plots. */
export function labelAt(path: readonly LatLon[]): LatLon | null {
  if (path.length === 0) return null;
  return path.reduce((top, p) => (p.lat > top.lat ? p : top), path[0]);
}

/** The outlines of every tarla, from each tarla's own corners and the corners of the properties on it. */
export function tarlaOutlines<T extends { id: string; corners: readonly LatLon[] }>(
  tarlale: readonly T[],
  properties: readonly { tarlaId: string | null; corners: readonly LatLon[] }[],
): { tarla: T; outline: TarlaOutline }[] {
  const byTarla = new Map<string, LatLon[][]>();
  for (const p of properties) {
    if (!p.tarlaId || p.corners.length === 0) continue;
    const list = byTarla.get(p.tarlaId) ?? [];
    list.push([...p.corners]);
    byTarla.set(p.tarlaId, list);
  }
  return tarlale
    .map((tarla) => ({ tarla, outline: tarlaOutline(tarla.corners, byTarla.get(tarla.id) ?? []) }))
    .filter((o) => o.outline.kind !== "none");
}
