/**
 * Lots in Stereo 70 metres — where the big seed draws its properties.           (Slice #39.21)
 *
 * PURE: no projection. A point is { n, e } — Northing and Easting, the axis order of Romanian cadastral
 * files (.claude/rules/maps-and-geo.md: stereo70ToWgs84(north, east)). seed.ts converts each corner to WGS84
 * only when it writes it, and the app's computeCornerGeometry measures it back, so what jest proves here —
 * shared edges, no overlaps, every lot inside Bragadiru's range, the six lots on Adrian's line — is a
 * statement about the corners that are stored.
 */

export type Pt = { n: number; e: number };
export type Poly = Pt[];

/** Bragadiru's Stereo 70 range (maps-and-geo.md). */
export const BRAGADIRU_RANGE = { nMin: 320_000, nMax: 325_000, eMin: 575_000, eMax: 585_000 };

/** Adrian's line, 2026-10-13: the six-lot cluster's north-east edges cover it, the lots run south-west. */
export const ADRIAN_LINE: readonly [Pt, Pt] = [
  { n: 320578.68, e: 578299.96 },
  { n: 320502.58, e: 578349.03 },
];

const rad = (deg: number) => (deg * Math.PI) / 180;
/** The unit step along a bearing measured clockwise from north. */
export const step = (bearingDeg: number): Pt => ({ n: Math.cos(rad(bearingDeg)), e: Math.sin(rad(bearingDeg)) });
export const add = (a: Pt, b: Pt, k = 1): Pt => ({ n: a.n + b.n * k, e: a.e + b.e * k });
export const dist = (a: Pt, b: Pt): number => Math.hypot(a.n - b.n, a.e - b.e);
/** Bearing from a to b, degrees clockwise from north, in [0, 360). */
export function bearing(a: Pt, b: Pt): number {
  const d = (Math.atan2(b.e - a.e, b.n - a.n) * 180) / Math.PI;
  return (d + 360) % 360;
}

/** Shoelace area in m². */
export function area(p: Poly): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    s += a.e * b.n - b.e * a.n;
  }
  return Math.abs(s) / 2;
}

export const centroid = (p: Poly): Pt => ({ n: p.reduce((s, x) => s + x.n, 0) / p.length, e: p.reduce((s, x) => s + x.e, 0) / p.length });

export const inRange = (p: Poly, r = BRAGADIRU_RANGE): boolean => p.every((x) => x.n >= r.nMin && x.n <= r.nMax && x.e >= r.eMin && x.e <= r.eMax);

/**
 * A row of lots side by side along a front line from `origin` at `frontBearing`, running back at `backBearing`.
 * `widths[i]` is lot i's front; `depths[j]` the length of side line j (there is one more side than lots), so
 * neighbours share their side edge EXACTLY — the same two points — and a lot is a quadrilateral whose back edge
 * need not be parallel to its front.
 */
export function rowOfLots(origin: Pt, frontBearing: number, backBearing: number, widths: number[], depths: number[]): Poly[] {
  if (depths.length !== widths.length + 1) throw new Error("rowOfLots: one more depth than widths");
  const f = step(frontBearing);
  const b = step(backBearing);
  const front: Pt[] = [origin];
  for (const w of widths) front.push(add(front[front.length - 1], f, w));
  const back = front.map((p, j) => add(p, b, depths[j]));
  return widths.map((_, i) => [front[i], front[i + 1], back[i + 1], back[i]]);
}

/**
 * The six lots on Adrian's line: equal fronts covering it from point 1 to point 2, each running perpendicular
 * to it towards the south-west, all `depth` deep.
 */
export function lineCluster(depth: number, count = 6, line: readonly [Pt, Pt] = ADRIAN_LINE): Poly[] {
  const [p1, p2] = line;
  const len = dist(p1, p2);
  const along = bearing(p1, p2);
  // the perpendicular on the south-west side: of along ± 90°, the one closer to 225°
  const cands = [(along + 90) % 360, (along + 270) % 360];
  const sw = cands.sort((x, y) => angDiff(x, 225) - angDiff(y, 225))[0];
  const widths = Array(count).fill(len / count);
  const lots = rowOfLots(p1, along, sw, widths, Array(count + 1).fill(depth));
  // the last front corner IS point 2, not a point a rounding error away from it
  lots[count - 1][1] = { ...p2 };
  return lots;
}

export const angDiff = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

// ---------------------------------------------------------------------------
// Overlap — touching is allowed (neighbours share an edge), overlapping is not
// ---------------------------------------------------------------------------

function cross(o: Pt, a: Pt, b: Pt): number {
  return (a.e - o.e) * (b.n - o.n) - (a.n - o.n) * (b.e - o.e);
}

/** Do segments ab and cd cross at a point inside both (not merely touch)? */
function properlyCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

export function pointInPolygon(p: Pt, poly: Poly): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.n > p.n !== b.n > p.n && p.e < ((b.e - a.e) * (p.n - a.n)) / (b.n - a.n) + a.e) inside = !inside;
  }
  return inside;
}

/** The polygon pulled `m` metres in towards its centroid — so an edge two lots share no longer touches. */
function shrink(p: Poly, m: number): Poly {
  const c = centroid(p);
  return p.map((x) => {
    const d = dist(x, c);
    return d <= m ? c : add(c, { n: x.n - c.n, e: x.e - c.e }, (d - m) / d);
  });
}

/** Whether two lots overlap by more than a sliver. Sharing an edge or a corner is not overlapping. */
export function overlaps(a: Poly, b: Poly, tolerance = 0.05): boolean {
  const A = shrink(a, tolerance);
  const B = shrink(b, tolerance);
  // quick reject on bounding boxes
  const box = (p: Poly) => ({ n0: Math.min(...p.map((x) => x.n)), n1: Math.max(...p.map((x) => x.n)), e0: Math.min(...p.map((x) => x.e)), e1: Math.max(...p.map((x) => x.e)) });
  const ba = box(A);
  const bb = box(B);
  if (ba.n1 < bb.n0 || bb.n1 < ba.n0 || ba.e1 < bb.e0 || bb.e1 < ba.e0) return false;
  for (let i = 0; i < A.length; i++) {
    for (let j = 0; j < B.length; j++) {
      if (properlyCross(A[i], A[(i + 1) % A.length], B[j], B[(j + 1) % B.length])) return true;
    }
  }
  return A.some((p) => pointInPolygon(p, B)) || B.some((p) => pointInPolygon(p, A));
}

/** Do the two lots share an edge — the same two corners, either way round? */
export function sharesEdge(a: Poly, b: Poly, eps = 1e-6): boolean {
  const same = (p: Pt, q: Pt) => dist(p, q) < eps;
  for (let i = 0; i < a.length; i++) {
    const [p, q] = [a[i], a[(i + 1) % a.length]];
    for (let j = 0; j < b.length; j++) {
      const [r, s] = [b[j], b[(j + 1) % b.length]];
      if ((same(p, r) && same(q, s)) || (same(p, s) && same(q, r))) return true;
    }
  }
  return false;
}

/** Distance from p to the segment ab. */
export function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const l2 = (b.n - a.n) ** 2 + (b.e - a.e) ** 2;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.n - a.n) * (b.n - a.n) + (p.e - a.e) * (b.e - a.e)) / l2));
  return dist(p, { n: a.n + t * (b.n - a.n), e: a.e + t * (b.e - a.e) });
}

/** Which side of the directed line a→b a point is on: > 0 right (clockwise), < 0 left. */
export const sideOf = (p: Pt, a: Pt, b: Pt): number => -cross(a, b, p);

/**
 * The lots that stand on the line: one edge with both ends on it (within `tol` metres), every other corner on
 * the south-west side of it, and together their edges on the line covering it end to end.
 */
export function lotsOnLine(polys: Poly[], line: readonly [Pt, Pt] = ADRIAN_LINE, tol = 0.5): { lots: number; covered: number; length: number } {
  const [a, b] = line;
  // which side is south-west: the side a point stepped from the line's middle at 225° falls on
  const mid = { n: (a.n + b.n) / 2, e: (a.e + b.e) / 2 };
  const swSign = Math.sign(sideOf(add(mid, step(225), 10), a, b));
  let covered = 0;
  let lots = 0;
  for (const p of polys) {
    const onIdx = p.map((x) => distToSegment(x, a, b) <= tol);
    const edges = p.map((_, i) => onIdx[i] && onIdx[(i + 1) % p.length]);
    const k = edges.indexOf(true);
    if (k < 0) continue;
    const rest = p.filter((_, i) => !onIdx[i]);
    if (rest.length === 0 || !rest.every((x) => Math.sign(sideOf(x, a, b)) === swSign)) continue;
    lots++;
    covered += dist(p[k], p[(k + 1) % p.length]);
  }
  return { lots, covered, length: dist(a, b) };
}
