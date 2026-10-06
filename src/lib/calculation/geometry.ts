/**
 * „Calcul drum lateral" — pure geometry                            (Slice #38.23)
 *
 * No DB, no I/O, no coordinate-system conversion: Stereo 70 metres in and out
 * ({ north, east }), so the jest suite drives it directly. compute.ts converts
 * what comes out to WGS84 on the server.
 *
 * Step 2 of the request: the parcel cut by parallel lines into one slice per
 * owner, each slice's area the owner's share of the parcel's.
 *
 * - **The cuts are perpendicular to the parcel's longest side.** (38.24 turns
 *   them perpendicular to the road instead; the clipping below does not care
 *   which direction it is handed.)
 * - **A general four-corner polygon, never a rectangle.** The request's sample
 *   is far from one. Each cut is a half-plane clip of the parcel, and its
 *   position is found by bisection on the clipped area: the area on the near
 *   side of a cut only grows as the cut moves away, so bisection cannot miss.
 *   Each cut is placed against the CUMULATIVE target (the first i shares), not
 *   against the previous cut, so no slice inherits the one before it's error.
 * - **The last slice is the remainder.** With shares summing to 100% that is
 *   its own share; with 99.99% it also takes the missing 0.01% — #18.10's
 *   „ultimul proprietar preia diferența", kept (Ask first 3, #38.23).
 * - **Coordinates are moved to a local origin first.** Stereo 70 values are
 *   ~5·10⁵ m; a shoelace over them multiplies 10¹¹-sized terms and loses the
 *   centimetres the suite asserts.
 *
 * What carries over from #18.10's reasoning, for 38.24: borders perpendicular
 * to the road, the last border being the road's end cap, and the road's start
 * end following the parcel's own side.
 */

export type S70Point = { north: number; east: number };

export class DivisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DivisionError";
  }
}

/** Cartesian, x = east, y = north, relative to a local origin. */
type P = { x: number; y: number };

function signedArea(poly: P[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

function area(poly: P[]): number {
  return poly.length < 3 ? 0 : Math.abs(signedArea(poly));
}

/**
 * Clip a polygon to the half-plane { p : f(p) >= 0 } (Sutherland–Hodgman).
 * For a convex polygon the result is the exact piece. For a concave one it may
 * carry zero-width bridges along the cut line, which add no area — and area is
 * all the bisection reads.
 */
function clip(poly: P[], f: (p: P) => number): P[] {
  const out: P[] = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const nxt = poly[(i + 1) % poly.length];
    const fc = f(cur);
    const fn = f(nxt);
    if (fc >= 0) out.push(cur);
    if (fc >= 0 !== fn >= 0) {
      const t = fc / (fc - fn);
      out.push({ x: cur.x + t * (nxt.x - cur.x), y: cur.y + t * (nxt.y - cur.y) });
    }
  }
  return out;
}

/** Drop consecutive duplicates, which a clip through a vertex produces. */
function tidy(poly: P[]): P[] {
  const out: P[] = [];
  for (const p of poly) {
    const prev = out[out.length - 1];
    if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y) > 1e-9) out.push(p);
  }
  if (out.length > 1 && Math.hypot(out[0].x - out[out.length - 1].x, out[0].y - out[out.length - 1].y) <= 1e-9) {
    out.pop();
  }
  return out;
}

function cross(o: P, a: P, b: P): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function segmentsCross(a: P, b: P, c: P, d: P): boolean {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** The parcel's frame: a local origin, so the arithmetic keeps its centimetres. */
function frame(corners: S70Point[]) {
  const n = corners.length || 1;
  const origin = {
    north: corners.reduce((s, c) => s + c.north, 0) / n,
    east: corners.reduce((s, c) => s + c.east, 0) / n,
  };
  const toP = (c: S70Point): P => ({ x: c.east - origin.east, y: c.north - origin.north });
  const toS70 = (p: P): S70Point => ({ north: p.y + origin.north, east: p.x + origin.east });
  return { toP, toS70 };
}

/**
 * True when the four corners, in the order given, draw a quadrilateral whose
 * sides do not cross and whose area is not nil. A file whose corners are listed
 * out of ring order (121, 123, 122, 124) draws a bow tie and is refused.
 */
export function quadIsSimple(corners: S70Point[]): boolean {
  if (corners.length !== 4) return false;
  const { toP } = frame(corners);
  const [a, b, c, d] = corners.map(toP);
  if (segmentsCross(a, b, c, d) || segmentsCross(b, c, d, a)) return false;
  return area([a, b, c, d]) > 1e-6;
}

/** The area of a polygon in m² (shoelace, in a local frame). */
export function polygonArea(corners: S70Point[]): number {
  const { toP } = frame(corners);
  return area(corners.map(toP));
}

/** The index i of the longest side, corners[i] → corners[i + 1] (wrapping). */
export function longestSide(corners: S70Point[]): number {
  let best = 0;
  let bestLen = -1;
  corners.forEach((a, i) => {
    const b = corners[(i + 1) % corners.length];
    const len = Math.hypot(b.north - a.north, b.east - a.east);
    if (len > bestLen) {
      best = i;
      bestLen = len;
    }
  });
  return best;
}

export type Slice = {
  /** Its share of the parcel, as a fraction of 1 (24.33% → 0.2433). */
  fraction: number;
  /** fraction × the parcel's area — what the slice was cut to. */
  targetArea: number;
  /** The area of the polygon actually cut. The last slice: the remainder. */
  area: number;
  polygon: S70Point[];
};

export type SlicesResult = {
  parcelArea: number;
  /** The direction the cuts are measured along: the longest side, a unit vector (east, north). */
  axis: { east: number; north: number };
  /** In the order asked for: slices[0] sits at the start of the axis. */
  slices: Slice[];
};

const BISECTIONS = 80;

/**
 * Cut the parcel into one slice per fraction, in the order given, by lines
 * perpendicular to its longest side.
 */
export function cutIntoSlices(corners: S70Point[], fractions: number[]): SlicesResult {
  if (!quadIsSimple(corners)) {
    throw new DivisionError("The four corners do not draw a quadrilateral.");
  }
  if (fractions.length < 2 || fractions.some((f) => !(f > 0))) {
    throw new DivisionError("At least two positive shares are needed.");
  }

  const { toP, toS70 } = frame(corners);
  const poly = corners.map(toP);
  const parcelArea = area(poly);

  // Measure along the longest side, from its first corner to its second.
  const i = longestSide(corners);
  const a = poly[i];
  const b = poly[(i + 1) % poly.length];
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const u = (p: P) => p.x * ux + p.y * uy;
  const uMin = Math.min(...poly.map(u));
  const uMax = Math.max(...poly.map(u));

  const below = (c: number) => clip(poly, (p) => c - u(p));
  const between = (lo: number, hi: number) => clip(clip(poly, (p) => u(p) - lo), (p) => hi - u(p));

  // The cuts: cuts[k] has the first k slices before it.
  const cuts: number[] = [uMin];
  let cumulative = 0;
  for (let k = 0; k < fractions.length - 1; k++) {
    cumulative += fractions[k] * parcelArea;
    let lo = cuts[k];
    let hi = uMax;
    for (let it = 0; it < BISECTIONS; it++) {
      const mid = (lo + hi) / 2;
      if (area(below(mid)) < cumulative) lo = mid;
      else hi = mid;
    }
    cuts.push((lo + hi) / 2);
  }
  cuts.push(uMax);

  const slices: Slice[] = fractions.map((fraction, k) => {
    const piece = tidy(between(cuts[k], cuts[k + 1]));
    return {
      fraction,
      targetArea: fraction * parcelArea,
      area: area(piece),
      polygon: piece.map(toS70),
    };
  });

  return { parcelArea, axis: { east: ux, north: uy }, slices };
}

// ---------------------------------------------------------------------------
// The order of the slices — pure, so the screen uses the same rules
// ---------------------------------------------------------------------------

/** A random order of n owners (Fisher–Yates). `random` is injectable for the suite. */
export function randomOrder(n: number, random: () => number = Math.random): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** True when `order` lists every index 0…n-1 exactly once. */
export function isOrderOf(order: unknown, n: number): order is number[] {
  if (!Array.isArray(order) || order.length !== n) return false;
  const seen = new Set<number>();
  for (const k of order) {
    if (!Number.isInteger(k) || k < 0 || k >= n || seen.has(k)) return false;
    seen.add(k);
  }
  return true;
}

/**
 * The order with the slices at positions a and b exchanged — what dropping one
 * slice on another does (Ask first 2, #38.23: a swap, so on the map exactly the
 * two slices that change move). Every slice keeps its area; the cuts move.
 */
export function swapped(order: readonly number[], a: number, b: number): number[] {
  const next = order.slice();
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}
