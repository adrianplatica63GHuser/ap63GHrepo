/**
 * Pure polygon-area helper (Slice #18.09).
 *
 * Computes the interior area of a simple polygon from its ordered planar
 * vertices (Stereo 70 metres) via the shoelace formula. Coordinate units are
 * metres, so the result is square metres. No projection / I/O here — callers
 * project WGS84 corners to Stereo 70 first (server: wgs84ToStereo70 from
 * @/lib/geo/transdatRO; client: the /api/geo/convert batch endpoint), then pass
 * the resulting { north, east } points in.
 *
 * The polygon is treated as implicitly closed (the last vertex connects back to
 * the first); the corner list must NOT repeat the first point at the end. The
 * result is winding-independent (absolute value), so clockwise and
 * counter-clockwise corner orders give the same area.
 *
 * Returns null for fewer than 3 points (no enclosed area). Self-intersecting
 * (bow-tie) corner orders produce a mathematically-correct-but-meaningless
 * shoelace value — the corner order is the user's responsibility, same as the
 * map polygon rendering.
 */

export type PlanarPoint = { north: number; east: number };

export function shoelaceAreaM2(points: PlanarPoint[]): number | null {
  if (points.length < 3) return null;

  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    // x = east, y = north: sum of (x_i * y_{i+1} - x_{i+1} * y_i).
    sum += a.east * b.north - b.east * a.north;
  }

  return Math.abs(sum) / 2;
}
