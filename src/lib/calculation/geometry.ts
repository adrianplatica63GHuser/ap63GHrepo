/**
 * Diviz — pure geometry core  (Slice #18.10.diviz)
 *
 * Divides a big, near-rectangular cadastral polygon between N owners according
 * to their ownership fractions, after carving out a shared "road" strip along
 * one long side. This module is PURE (no DB, no I/O, no coordinate-system
 * conversion) so it can be unit-tested in isolation; coordinates in and out are
 * Stereo 70 metres ({ north, east }). The caller (src/lib/calculation/compute.ts)
 * converts the resulting polygons to WGS84 for storage / map display.
 *
 * ---------------------------------------------------------------------------
 * The reasoning (kept here so the algorithm is self-documenting and reusable
 * for any conforming file and any number of owners)
 * ---------------------------------------------------------------------------
 *
 * 1.  The big polygon is approximated to FOUR sides, almost parallel two-by-two
 *     (extra near-duplicate corners are collapsed via Visvalingam). The longer
 *     pair are the "Length" sides, the shorter pair the "Width" sides.
 *
 * 2.  Orientation: if the Length direction is closer to the East-West axis than
 *     to the North-South axis the polygon is HORIZONTAL, otherwise VERTICAL.
 *     BOTH are supported, for all four start corners (Section #4 = SW/NW/SE/NE).
 *     The road always runs along the LONG edge that contains the start corner:
 *     for a HORIZONTAL polygon the long edges are South/North (the S/N letter
 *     picks the side, W/E the start end); for a VERTICAL polygon the long edges
 *     are West/East (the W/E letter picks the side, S/N the start end). Owner 1
 *     sits at the start corner; owners are laid out in file order away from it.
 *     Everything below works in a frame rotated so u runs along the road edge,
 *     so it is orientation-agnostic once the road edge + start corner are chosen.
 *
 * 3.  Total area A_total is the shoelace area of the polygon (in Stereo 70 m²).
 *     Each owner's "Original Area" = fraction × A_total.
 *
 * 4.  The road is a strip of the given Width (section 4) along the road-side
 *     long edge. It is common property, NOT divided: each owner owns a "Road
 *     Participation" = fraction × road area, but the road stays in one piece.
 *     "Final Area" = Original Area − Road Participation = fraction × (A_total −
 *     road area).
 *
 * 5.  The road only needs to serve owners 1…N-1, so it stops at the boundary
 *     between owner N-1 and owner N: its length L equals the position of that
 *     last cut. Because the road area depends on L and the final areas depend
 *     on the road area, L is found by a short fixed-point iteration.
 *
 * 6.  Borders between owners 1…N-2 are perpendicular to the road. Walking from
 *     the start corner, each owner's far border is placed so the area of its
 *     slice (beyond the road strip) equals its Final Area. Owner N-1's far
 *     border instead runs parallel to the polygon's end/width sides through the
 *     road's far corner (slope fixed, position solved for owner N-1's exact Final
 *     Area). Owner N takes the whole full-height remainder beyond the road end —
 *     so any tiny rounding in the fractions (e.g. 33.33 % × 3 = 99.99 %) is
 *     absorbed by owner N. The road's far end (where it meets owner N) is a true
 *     right-angle cap; its start end follows the polygon's existing slanted side.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type S70Point = { north: number; east: number };

export type OwnerInput = { name: string; fraction: number };

/**
 * Which corner of the big polygon the road shares and starts from (Section #4).
 * The first letter (S/N) selects the long side the road runs along; the second
 * (W/E) selects the end the road starts from (owner 1 is nearest that corner).
 */
export type CornerCode = "SW" | "NW" | "SE" | "NE";

export type DivisionInput = {
  /** Big-polygon corners in file order (Stereo 70 metres). */
  corners: S70Point[];
  /** Owners in file order; owner 1 is the one nearest the road's start corner. */
  owners: OwnerInput[];
  /** Declared orientation (Section #2) — confirmed against the coordinates. */
  declaredOrientation: "HORIZONTAL" | "VERTICAL";
  /** Corner the road shares / starts from (Section #4): SW / NW / SE / NE. */
  roadCorner: CornerCode;
  /** Road width in metres (Section #5). */
  roadWidth: number;
};

export type OwnerResult = {
  name: string;
  fraction: number;
  originalArea: number;
  roadParticipation: number;
  /** Target final area = fraction × (A_total − road area). */
  finalArea: number;
  /** Actual area of the computed polygon (owner N = the true remainder). */
  computedArea: number;
  /** Ordered polygon vertices (Stereo 70). */
  polygon: S70Point[];
};

export type DivisionResult = {
  orientation: "HORIZONTAL" | "VERTICAL";
  totalArea: number;
  lengthSide: number;
  widthSide: number;
  roadLength: number;
  roadArea: number;
  roadPolygon: S70Point[];
  owners: OwnerResult[];
};

export class DivisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DivisionError";
  }
}

// ---------------------------------------------------------------------------
// Internal 2-D helpers — work in cartesian { x: east, y: north }
// ---------------------------------------------------------------------------

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

function polyArea(poly: P[]): number {
  return poly.length < 3 ? 0 : Math.abs(signedArea(poly));
}

function centroid(poly: P[]): P {
  let x = 0;
  let y = 0;
  for (const p of poly) {
    x += p.x;
    y += p.y;
  }
  return { x: x / poly.length, y: y / poly.length };
}

/**
 * Sutherland-Hodgman clip of a convex polygon against the half-plane
 * { p : f(p) >= 0 }. The big polygon and all intermediate strips are convex,
 * so the result stays a simple convex polygon.
 */
function clipHalfPlane(poly: P[], f: (p: P) => number): P[] {
  const out: P[] = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const cur = poly[i];
    const nxt = poly[(i + 1) % n];
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

/**
 * Collapse a polygon to exactly 4 corners using Visvalingam-Whyatt: repeatedly
 * drop the vertex whose triangle with its two neighbours has the smallest area
 * (the "least significant" corner). This turns a 5- or 6-corner polygon whose
 * extra corners are very close to the real ones into a clean quad. Input is
 * assumed to already be in boundary (ring) order.
 */
function simplifyToQuad(poly: P[]): P[] {
  let pts = dedupeConsecutive(poly);
  while (pts.length > 4) {
    let minArea = Infinity;
    let minIdx = -1;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i - 1 + pts.length) % pts.length];
      const b = pts[i];
      const c = pts[(i + 1) % pts.length];
      const tri = Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
      if (tri < minArea) {
        minArea = tri;
        minIdx = i;
      }
    }
    pts = pts.filter((_, i) => i !== minIdx);
  }
  return pts;
}

function dedupeConsecutive(poly: P[]): P[] {
  const out: P[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const prev = out[out.length - 1];
    if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y) > 1e-6) out.push(p);
  }
  // also collapse wrap-around duplicate
  if (
    out.length > 1 &&
    Math.hypot(out[0].x - out[out.length - 1].x, out[0].y - out[out.length - 1].y) <= 1e-6
  ) {
    out.pop();
  }
  return out;
}

/** Drop vertices that are collinear with their neighbours (within ~1e-6 m). */
function removeCollinear(poly: P[]): P[] {
  if (poly.length < 4) return poly;
  const out: P[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[(i - 1 + poly.length) % poly.length];
    const b = poly[i];
    const c = poly[(i + 1) % poly.length];
    const cross = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
    const base = Math.max(Math.hypot(b.x - a.x, b.y - a.y), Math.hypot(c.x - b.x, c.y - b.y)) || 1;
    if (Math.abs(cross) / base > 1e-6) out.push(b); // keep only genuine corners
  }
  return out.length >= 3 ? out : poly;
}

/**
 * Merge two convex polygons (both CCW) that share exactly one full edge into a
 * single ring. Used to assemble owner N (the road-band part east of the
 * perpendicular road cap + the north-band part east of the slanted border),
 * which together form an L-shaped / pentagonal parcel. Returns null if no shared
 * edge is found.
 */
function mergeAlongSharedEdge(lower: P[], upper: P[]): P[] | null {
  const eq = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-6;
  const indexOfPt = (poly: P[], pt: P) => poly.findIndex((q) => eq(q, pt));
  const n = lower.length;
  const m = upper.length;
  for (let i = 0; i < n; i++) {
    const a = lower[i];
    const b = lower[(i + 1) % n];
    const ja = indexOfPt(upper, a);
    const jb = indexOfPt(upper, b);
    if (ja >= 0 && jb >= 0) {
      const res: P[] = [];
      // Walk lower from b around to a (inclusive).
      for (let k = 0; k < n; k++) {
        const v = lower[(i + 1 + k) % n];
        res.push(v);
        if (eq(v, a)) break;
      }
      // Walk upper from a's next vertex around until reaching b (exclusive).
      for (let k = 1; k < m; k++) {
        const v = upper[(ja + k) % m];
        if (eq(v, b)) break;
        res.push(v);
      }
      return dedupeConsecutive(res);
    }
  }
  return null;
}

const toP = (s: S70Point): P => ({ x: s.east, y: s.north });
const toS70 = (p: P): S70Point => ({ north: p.y, east: p.x });

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export function computeDivision(input: DivisionInput): DivisionResult {
  const { owners, roadCorner, roadWidth, declaredOrientation } = input;

  if (owners.length < 2) {
    throw new DivisionError("At least two owners are required.");
  }
  if (owners.some((o) => !(o.fraction > 0))) {
    throw new DivisionError("Every owner must have a positive ownership fraction.");
  }
  if (!(roadWidth > 0)) {
    throw new DivisionError("Road width must be a positive number of metres.");
  }

  // Big polygon → cartesian, CCW, simplified to a quad.
  let poly = input.corners.map(toP);
  if (poly.length < 3) {
    throw new DivisionError("The polygon needs at least three corners.");
  }
  if (signedArea(poly) < 0) poly = poly.slice().reverse();
  const quad = simplifyToQuad(poly);
  if (quad.length !== 4) {
    throw new DivisionError(
      `Could not reduce the polygon to four sides (got ${quad.length}). Check the coordinates.`,
    );
  }
  if (signedArea(quad) < 0) quad.reverse();

  const A_total = polyArea(quad);

  // Edges + opposite-pair classification → Length (longer pair) / Width.
  const edges = quad.map((a, i) => {
    const b = quad[(i + 1) % quad.length];
    return {
      a,
      b,
      len: Math.hypot(b.x - a.x, b.y - a.y),
      dir: Math.atan2(b.y - a.y, b.x - a.x),
      midN: (a.y + b.y) / 2, // mid north
      midE: (a.x + b.x) / 2, // mid east
    };
  });
  const pair02 = (edges[0].len + edges[2].len) / 2;
  const pair13 = (edges[1].len + edges[3].len) / 2;
  const lengthEdges = pair02 >= pair13 ? [edges[0], edges[2]] : [edges[1], edges[3]];
  const widthEdges = pair02 >= pair13 ? [edges[1], edges[3]] : [edges[0], edges[2]];
  const lengthSide = (lengthEdges[0].len + lengthEdges[1].len) / 2;
  const widthSide = (widthEdges[0].len + widthEdges[1].len) / 2;

  // Orientation from the length (long-side) direction.
  const angToEW =
    (Math.atan2(Math.abs(Math.sin(lengthEdges[0].dir)), Math.abs(Math.cos(lengthEdges[0].dir))) *
      180) /
    Math.PI;
  const orientation: "HORIZONTAL" | "VERTICAL" = angToEW < 45 ? "HORIZONTAL" : "VERTICAL";

  // Section #2 is a confirmation: the declared orientation must agree with what
  // the coordinates actually describe.
  if (declaredOrientation !== orientation) {
    throw new DivisionError(
      `Section #2 declares the polygon as ${declaredOrientation === "HORIZONTAL" ? "Horizontal (H)" : "Vertical (V)"}, but the coordinates describe a ${orientation === "HORIZONTAL" ? "Horizontal" : "Vertical"} polygon. Please check.`,
    );
  }
  // Section #4 corner code (SW / NW / SE / NE). The road runs along the LONG
  // edge that contains this corner and starts AT it:
  //   - HORIZONTAL: the long edges run East-West, so the S/N letter picks the
  //     side (south/north long edge) and the W/E letter picks the start end.
  //   - VERTICAL: the long edges run North-South, so the W/E letter picks the
  //     side (west/east long edge) and the S/N letter picks the start end.
  const hasSouth = roadCorner.includes("S");
  const hasWest = roadCorner.includes("W");

  // Pick the road's long edge (the side the road runs along) and the start
  // corner (one endpoint of that edge).
  let roadEdgeReal: (typeof lengthEdges)[number];
  let startPt: P;
  let farPt: P;
  if (orientation === "HORIZONTAL") {
    // Side = S/N by real-north midpoint.
    roadEdgeReal = hasSouth
      ? lengthEdges[0].midN < lengthEdges[1].midN
        ? lengthEdges[0]
        : lengthEdges[1]
      : lengthEdges[0].midN > lengthEdges[1].midN
        ? lengthEdges[0]
        : lengthEdges[1];
    // Start end = W/E by east coordinate.
    const westEnd = roadEdgeReal.a.x <= roadEdgeReal.b.x ? roadEdgeReal.a : roadEdgeReal.b;
    const eastEnd = roadEdgeReal.a.x <= roadEdgeReal.b.x ? roadEdgeReal.b : roadEdgeReal.a;
    startPt = hasWest ? westEnd : eastEnd;
    farPt = hasWest ? eastEnd : westEnd;
  } else {
    // VERTICAL — side = W/E by real-east midpoint.
    roadEdgeReal = hasWest
      ? lengthEdges[0].midE < lengthEdges[1].midE
        ? lengthEdges[0]
        : lengthEdges[1]
      : lengthEdges[0].midE > lengthEdges[1].midE
        ? lengthEdges[0]
        : lengthEdges[1];
    // Start end = S/N by north coordinate.
    const southEnd = roadEdgeReal.a.y <= roadEdgeReal.b.y ? roadEdgeReal.a : roadEdgeReal.b;
    const northEnd = roadEdgeReal.a.y <= roadEdgeReal.b.y ? roadEdgeReal.b : roadEdgeReal.a;
    startPt = hasSouth ? southEnd : northEnd;
    farPt = hasSouth ? northEnd : southEnd;
  }

  // Align the working frame to the ROAD edge itself (u along the road edge),
  // oriented so u increases AWAY from the road's start corner (so owner 1, the
  // first listed owner, sits at the start). This makes the road's two long sides
  // exactly parallel (both constant v) so the perpendicular road-end cap
  // (constant u) is a true right angle to them; the opposite long edge may be
  // slightly non-parallel (owners' far boundary follows it), and the road's
  // START end follows the polygon's existing (slanted) side, not a right angle.
  const ang = Math.atan2(farPt.y - startPt.y, farPt.x - startPt.x);
  const ca = Math.cos(-ang);
  const sa = Math.sin(-ang);
  const toUV = (p: P): P => ({ x: p.x * ca - p.y * sa, y: p.x * sa + p.y * ca });
  const fromUVtoP = (q: P): P => {
    const c2 = Math.cos(ang);
    const s2 = Math.sin(ang);
    return { x: q.x * c2 - q.y * s2, y: q.x * s2 + q.y * c2 };
  };
  let Q = quad.map(toUV);
  if (signedArea(Q) < 0) Q = Q.slice().reverse();

  const roadEdgeMidUV = toUV({
    x: (roadEdgeReal.a.x + roadEdgeReal.b.x) / 2,
    y: (roadEdgeReal.a.y + roadEdgeReal.b.y) / 2,
  });
  const vRoad = roadEdgeMidUV.y;
  const interiorSign = Math.sign(centroid(Q).y - vRoad) || 1;
  const sdist = (p: P) => interiorSign * (p.y - vRoad); // perpendicular dist from road edge, >=0 inside
  const inRoadBand = (p: P) => roadWidth - sdist(p); // >=0 : within road width of the road edge
  const beyondRoad = (p: P) => sdist(p) - roadWidth; // >=0 : owner strip (past the road)

  // Start of the road = the road-edge endpoint at the smaller u (the start corner
  // maps to min u because u is oriented away from it).
  const uRoadStart = Math.min(toUV(roadEdgeReal.a).x, toUV(roadEdgeReal.b).x);
  const uMax = Math.max(...Q.map((p) => p.x));

  const N = owners.length;

  // Width-side direction in the (u,v) frame. Owner N-1's east border (and the
  // road's east end) run PARALLEL to the parcel's end/width sides, passing
  // through the road's NE corner — not strictly perpendicular to the road. For a
  // true rectangle this is exactly vertical (= perpendicular); for the usual
  // near-rectangle it is the slight tilt of the existing side boundaries. The
  // slope is fixed (parallel to the width sides) and only the line's POSITION is
  // solved for owner N-1's area, so owner N-1 still gets its exact final area
  // and owner N takes the remainder.
  const widthDirUV = (() => {
    let du = 0;
    let dv = 0;
    for (const e of widthEdges) {
      const a = toUV(e.a);
      const b = toUV(e.b);
      let eu = b.x - a.x;
      let ev = b.y - a.y;
      if (ev < 0) {
        eu = -eu;
        ev = -ev;
      } // orient toward +v (north)
      const len = Math.hypot(eu, ev) || 1;
      du += eu / len;
      dv += ev / len;
    }
    const len = Math.hypot(du, dv) || 1;
    return { wu: du / len, wv: dv / len };
  })();
  const { wu, wv } = widthDirUV;

  // Road-top line T: the horizontal line at perpendicular distance w from the
  // road edge (v = vT). The slanted boundary pivots about R_NE = (cutN, vT).
  const vT = vRoad + interiorSign * roadWidth;

  const roadBand = clipHalfPlane(Q, inRoadBand); // full-length road band (all u)
  const northBand = clipHalfPlane(Q, beyondRoad); // owner strip (all u)
  const uWest = Math.min(...northBand.map((p) => p.x));

  // Owner N-1's east border = the line through R_NE = (cutN, vT) parallel to the
  // width direction (the slanted parcel boundary). The ROAD's east end is a
  // SEPARATE, perpendicular cap at u = cutN (a right angle to the road's long
  // sides), meeting the slanted border exactly at the shared corner R_NE.
  const eastOfSlant = (cutN: number) => (p: P) =>
    (p.x - cutN) * wv - (p.y - vT) * wu;
  const westOfSlant = (cutN: number) => (p: P) =>
    -((p.x - cutN) * wv - (p.y - vT) * wu);

  // Road area: the band WEST of the perpendicular cap (u <= cutN) — right-angled
  // end, NOT cut by the slant.
  const roadAreaFor = (cutN: number) =>
    polyArea(clipHalfPlane(roadBand, (p) => cutN - p.x));
  const northStrip = (lo: number, hi: number) =>
    polyArea(clipHalfPlane(clipHalfPlane(northBand, (p) => p.x - lo), (p) => hi - p.x));
  // Owner N-1: north-of-road, east of c_{N-2}, west of the slanted line.
  const ownerN1AreaFor = (cLast: number, cutN: number) =>
    polyArea(
      clipHalfPlane(clipHalfPlane(northBand, (p) => p.x - cLast), westOfSlant(cutN)),
    );

  // Fixed-point on the road area: owners 1..N-2 are perpendicular strips; owner
  // N-1's slanted boundary position (cutN) is solved for its final area; the road
  // ends at the perpendicular cap at u = cutN. Iterate until the road area settles.
  let A_road = 0;
  let cutN = uMax;
  let cuts: number[] = [uWest];
  let finals: number[] = [];
  for (let iter = 0; iter < 100; iter++) {
    finals = owners.map((o) => o.fraction * (A_total - A_road));
    cuts = [uWest];
    let lo = uWest;
    for (let i = 0; i < N - 2; i++) {
      const target = finals[i];
      const c = bisect((c2) => northStrip(lo, c2) - target, lo, uMax);
      cuts.push(c);
      lo = c;
    }
    const cLast = cuts[cuts.length - 1]; // west border of owner N-1
    cutN = bisect((c) => ownerN1AreaFor(cLast, c) - finals[N - 2], cLast, uMax);
    const newRoad = roadAreaFor(cutN);
    if (Math.abs(newRoad - A_road) < 1e-7) {
      A_road = newRoad;
      break;
    }
    A_road = newRoad;
  }
  const cLast = cuts[cuts.length - 1];

  // Build the owner polygons (in the road-aligned frame, then back to Stereo 70).
  const toResultPoly = (uv: P[]): S70Point[] =>
    removeCollinear(uv).map((p) => toS70(fromUVtoP(p)));

  const ownerResults: OwnerResult[] = [];
  for (let i = 0; i < N; i++) {
    let uvPoly: P[];
    if (i < N - 2) {
      // Owners 1..N-2: perpendicular strips north of the road.
      uvPoly = clipHalfPlane(
        clipHalfPlane(northBand, (p) => p.x - cuts[i]),
        (p) => cuts[i + 1] - p.x,
      );
    } else if (i === N - 2) {
      // Owner N-1: east of its perpendicular west border, west of the slanted line.
      uvPoly = clipHalfPlane(
        clipHalfPlane(northBand, (p) => p.x - cLast),
        westOfSlant(cutN),
      );
    } else {
      // Owner N: the full-height remainder east of the boundary — the road-band
      // part east of the perpendicular cap PLUS the north-band part east of the
      // slanted border, merged into one (pentagonal) ring along their shared
      // edge on the road-top line.
      const lower = clipHalfPlane(roadBand, (p) => p.x - cutN); // road band, u >= cutN
      const upper = clipHalfPlane(northBand, eastOfSlant(cutN)); // north band, east of slant
      uvPoly = mergeAlongSharedEdge(lower, upper) ?? upper;
    }
    ownerResults.push({
      name: owners[i].name,
      fraction: owners[i].fraction,
      originalArea: owners[i].fraction * A_total,
      roadParticipation: owners[i].fraction * A_road,
      finalArea: finals[i],
      computedArea: polyArea(uvPoly),
      polygon: toResultPoly(uvPoly),
    });
  }

  // Road polygon: band west of the perpendicular cap (right-angled east end).
  const roadUV = clipHalfPlane(roadBand, (p) => cutN - p.x);

  return {
    orientation,
    totalArea: A_total,
    lengthSide,
    widthSide,
    roadLength: cutN - uRoadStart,
    roadArea: A_road,
    roadPolygon: toResultPoly(roadUV),
    owners: ownerResults,
  };
}

/**
 * Bisection root-finder for a monotonically increasing function g on [lo, hi].
 * Used to place each owner cut so the slice area hits its target.
 */
function bisect(g: (x: number) => number, lo: number, hi: number): number {
  let a = lo;
  let b = hi;
  let m = (a + b) / 2;
  for (let i = 0; i < 100; i++) {
    m = (a + b) / 2;
    if (g(m) < 0) a = m;
    else b = m;
  }
  return m;
}
