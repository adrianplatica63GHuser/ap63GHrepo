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

// ---------------------------------------------------------------------------
// Step 3 — the road, and the slices turned to meet it (#38.24)
// ---------------------------------------------------------------------------

/** Which side of the chosen corner the road runs along: to the next corner in the file, or the previous. */
export type RoadSide = "next" | "previous";

export type RoadChoice = {
  /** Index into the corners, in file order. */
  corner: number;
  side: RoadSide;
  /** Metres. */
  width: number;
};

/** Why a road cannot be built — never drawn wrong instead. */
export type RoadRefusal =
  | { code: "roadTooLong"; values: { length: number; side: number } }
  | { code: "roadLeavesParcel" }
  | { code: "ownerMissesRoad"; values: { position: number } }
  | { code: "noRoom" };

export class RoadRefused extends Error {
  constructor(readonly refusal: RoadRefusal) {
    super(`The road cannot be built: ${refusal.code}`);
    this.name = "RoadRefused";
  }
}

export type RoadSlice = Slice & {
  /** fraction × the road's area. */
  roadShare: number;
  /** fraction × the parcel's area: what own slice + road share must equal. */
  originalArea: number;
};

export type RoadResult = {
  parcelArea: number;
  road: { polygon: S70Point[]; area: number; length: number; width: number };
  /** In the order asked for: slices[0] sits at the road's start corner. */
  slices: RoadSlice[];
  /** The fixed-point iterations it took (the suite reads it). */
  iterations: number;
};

/** The two corners at the ends of a side of corner i. */
export function sideEnds(n: number, corner: number, side: RoadSide): [number, number] {
  return [corner, side === "next" ? (corner + 1) % n : (corner + n - 1) % n];
}

/** The interval of the line v = c that lies inside the polygon (its outermost crossings). */
function chordOn(poly: P[], v: (p: P) => number, u: (p: P) => number, c: number): [number, number] | null {
  const hits: number[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const va = v(a) - c;
    const vb = v(b) - c;
    if ((va <= 0 && vb > 0) || (va > 0 && vb <= 0)) {
      const t = va / (va - vb);
      hits.push(u(a) + t * (u(b) - u(a)));
    }
  }
  if (hits.length < 2) return null;
  return [Math.min(...hits), Math.max(...hits)];
}

function contains(poly: P[], p: P, tolerance: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  if (inside) return true;
  // On the boundary, within tolerance.
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / len2));
    if (Math.hypot(a.x + t * (b.x - a.x) - p.x, a.y + t * (b.y - a.y) - p.y) <= tolerance) return true;
  }
  return false;
}

/** How close a border may come to the road's end before an owner is said to miss it. */
const TOUCH = 0.01;

/**
 * Lay the road along `choice.side` from `choice.corner`, and cut the parcel
 * into one slice per fraction by lines perpendicular to it.
 *
 * - The road is the parcel's band within `width` of the chosen side, from
 *   wherever the parcel's own side at the corner starts it, to a cap
 *   perpendicular to the side at distance L along it.
 * - Owners 1…N-1 take the parcel beyond the band, cut at right angles to the
 *   road; the last cut is the road's cap, extended across the parcel, and the
 *   last owner takes everything beyond it, the band's end included.
 * - Each owner's own slice is fraction × (parcel − road); the road's area
 *   depends on L and L on the slices, so L is found by fixed-point iteration
 *   (#18.10's step 5), which converges in a handful of rounds because the road
 *   is a sliver of the parcel.
 * - `fractions` must sum to 1 — the caller has already handed the last owner
 *   any remainder (#38.23's Ask first 3).
 */
export function cutWithRoad(corners: S70Point[], fractions: number[], choice: RoadChoice): RoadResult {
  if (!quadIsSimple(corners)) throw new DivisionError("The four corners do not draw a quadrilateral.");
  if (fractions.length < 2 || fractions.some((f) => !(f > 0))) {
    throw new DivisionError("At least two positive shares are needed.");
  }
  if (!(choice.width > 0)) throw new DivisionError("The road needs a width above 0.");
  const n = corners.length;
  if (!Number.isInteger(choice.corner) || choice.corner < 0 || choice.corner >= n) {
    throw new DivisionError("The road's corner is not one of the parcel's.");
  }

  const { toP, toS70 } = frame(corners);
  const poly = corners.map(toP);
  const parcelArea = area(poly);
  const [ci, ei] = sideEnds(n, choice.corner, choice.side);
  const C = poly[ci];
  const E = poly[ei];
  const sideLength = Math.hypot(E.x - C.x, E.y - C.y);
  const ux = (E.x - C.x) / sideLength;
  const uy = (E.y - C.y) / sideLength;
  // v points into the parcel: the side of the line its centroid is on.
  const mid = { x: poly.reduce((s, p) => s + p.x, 0) / n, y: poly.reduce((s, p) => s + p.y, 0) / n };
  const sign = Math.sign(-(mid.x - C.x) * uy + (mid.y - C.y) * ux) || 1;
  const u = (p: P) => (p.x - C.x) * ux + (p.y - C.y) * uy;
  const v = (p: P) => sign * (-(p.x - C.x) * uy + (p.y - C.y) * ux);
  const fromUV = (a: number, b: number): P => ({ x: C.x + a * ux - sign * b * uy, y: C.y + a * uy + sign * b * ux });
  const w = choice.width;

  const band = clip(poly, (p) => w - v(p));
  const beyond = clip(poly, (p) => v(p) - w);
  const beyondArea = area(beyond);
  const uMin = Math.min(...poly.map(u));
  const uMax = Math.max(...poly.map(u));
  const roadUpTo = (L: number) => clip(band, (p) => L - u(p));
  const beyondUpTo = (c: number) => area(clip(beyond, (p) => c - u(p)));

  const N = fractions.length;
  let roadArea = 0;
  let cuts: number[] = [];
  let iterations = 0;
  for (; iterations < 100; iterations++) {
    const net = parcelArea - roadArea;
    cuts = [];
    let cumulative = 0;
    for (let k = 0; k < N - 1; k++) {
      cumulative += fractions[k] * net;
      if (cumulative > beyondArea) throw new RoadRefused({ code: "noRoom" });
      let lo = k === 0 ? uMin : cuts[k - 1];
      let hi = uMax;
      for (let it = 0; it < BISECTIONS; it++) {
        const m = (lo + hi) / 2;
        if (beyondUpTo(m) < cumulative) lo = m;
        else hi = m;
      }
      cuts.push((lo + hi) / 2);
    }
    const next = area(roadUpTo(cuts[N - 2]));
    if (Math.abs(next - roadArea) < 1e-9) {
      roadArea = next;
      iterations++;
      break;
    }
    roadArea = next;
  }
  const L = cuts[N - 2];

  // Refusals: the road must stay on its side, keep its width to its cap, and
  // every owner but the last must reach it.
  if (L > sideLength + 1e-6) {
    throw new RoadRefused({ code: "roadTooLong", values: { length: L, side: sideLength } });
  }
  if (!contains(poly, fromUV(L, w), 1e-6)) throw new RoadRefused({ code: "roadLeavesParcel" });
  const outer = chordOn(poly, v, u, w);
  if (!outer) throw new RoadRefused({ code: "roadLeavesParcel" });
  for (let k = 0; k < N - 1; k++) {
    const lo = k === 0 ? uMin : cuts[k - 1];
    const hi = cuts[k];
    const touch = Math.min(hi, outer[1], L) - Math.max(lo, outer[0]);
    if (!(touch > TOUCH)) throw new RoadRefused({ code: "ownerMissesRoad", values: { position: k } });
  }

  const roadPoly = tidy(roadUpTo(L));
  const slices: RoadSlice[] = fractions.map((fraction, k) => {
    const piece =
      k < N - 1
        ? tidy(clip(clip(beyond, (p) => u(p) - (k === 0 ? uMin : cuts[k - 1])), (p) => cuts[k] - u(p)))
        : tidy(clip(poly, (p) => u(p) - L));
    return {
      fraction,
      targetArea: fraction * (parcelArea - roadArea),
      area: area(piece),
      polygon: piece.map(toS70),
      roadShare: fraction * roadArea,
      originalArea: fraction * parcelArea,
    };
  });

  return {
    parcelArea,
    road: { polygon: roadPoly.map(toS70), area: roadArea, length: L, width: w },
    slices,
    iterations,
  };
}
