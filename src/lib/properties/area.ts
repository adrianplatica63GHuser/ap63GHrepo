/**
 * Pure polygon helpers for a Property's corner ring (Slice #18.09; extended by
 * Slice #32.14).
 *
 * `shoelaceAreaM2` computes the interior area of a simple polygon from its
 * ordered planar vertices (Stereo 70 metres). Coordinate units are metres, so
 * the result is square metres. No projection / I/O here — callers project WGS84
 * corners to Stereo 70 first (server: wgs84ToStereo70 from @/lib/geo/transdatRO;
 * client: the /api/geo/convert batch endpoint), then pass the resulting
 * { north, east } points in.
 *
 * The polygon is treated as implicitly closed (the last vertex connects back to
 * the first); the corner list must NOT repeat the first point at the end. The
 * result is winding-independent (absolute value), so clockwise and
 * counter-clockwise corner orders give the same area.
 *
 * Returns null for fewer than 3 points (no enclosed area).
 *
 * ---------------------------------------------------------------------------
 * ⚠️ THIS HEADER USED TO SAY THE OPPOSITE, AND SLICE #32.14 REVERSES IT.
 * ---------------------------------------------------------------------------
 * The sentence that stood here from #18.09 until #32.14 was:
 *
 *   "Self-intersecting (bow-tie) corner orders produce a
 *    mathematically-correct-but-meaningless shoelace value — the corner order
 *    is the user's responsibility, same as the map polygon rendering."
 *
 * That was a decision, not an oversight, and a real parcel falsified it.
 * PROP01444 was imported with its corners in file order; the order
 * self-intersects, so the shoelace value came out at 0.21 m² on a parcel whose
 * own name says 2000. Nothing in the application said so. The only symptom was
 * an area wrong by four orders of magnitude, sitting in a field the user has no
 * reason to distrust, and it took a manuals run to notice it.
 *
 * The half of that sentence that survives is "the corner order is the user's
 * responsibility": #32.14 does NOT reorder anything, ever, on any path. What it
 * withdraws is the silence. `polygonSelfIntersects` below detects the condition
 * so a caller can MARK it, and `straightenPolygonOrder` computes a corrected
 * order so the user can APPLY it deliberately, seeing the area before and after.
 * Both are pure; neither is wired to anything from this file.
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

// ---------------------------------------------------------------------------
// Segment geometry (Slice #32.14)
// ---------------------------------------------------------------------------
//
// x = east, y = north throughout, matching the shoelace above.
//
// ⚠️ THE COLLINEARITY TEST IS A SINE, NOT A RAW CROSS PRODUCT, AND THAT IS THE
// WHOLE ROBUSTNESS STORY. `orient` subtracts before it multiplies, so the raw
// cross product is of order L² in the EDGE length, not in the coordinate — but
// the ERROR in it is not, because each subtraction of two ~5.8e5 values carries
// that magnitude's own representation error. On a long boundary the two do not
// scale together: measured, three points exactly collinear to the centimetre,
// 844 m apart at Stereo 70, give a raw cross product of 5.2e-8 — fifty times a
// 1e-9 gate, so a raw test calls a straight boundary bent. Dividing by the two
// vector lengths turns it into the sine of the angle between them:
// dimensionless, scale-free, and 1.5e-13 on that same triple. There is a test
// carrying those exact coordinates.

/**
 * Angular tolerance for "these three points are in a straight line", in radians.
 *
 * Measured floor, recorded so nobody re-derives it: a double's representation
 * error at easting 5.8e5 is ~6e-11 m, so the angular error of a collinearity
 * test on an edge of length L is ~6e-11 / L. At L = 3 cm that is 2e-9 — above
 * this gate — and an exactly-collinear triple on a 3 cm edge is missed; from
 * about 6 cm upward it is detected, at every position along the edge and out to
 * 500 m. A cadastral corner is never 3 cm from its neighbour, so the floor is
 * below the data, but it IS a floor. Loosening the gate to reach it would cost
 * the property that matters far more: over 100,000 random rings at spreads from
 * 5 cm to 400 m, checked against an exact integer reference, this value
 * produces ZERO false positives — and a false positive is a marker on a correct
 * parcel that the user cannot clear.
 */
const COLLINEAR_SIN = 1e-9;

/** Distance below which two corners are treated as the same point, in metres. */
const SAME_POINT_M = 1e-6;

function samePoint(a: PlanarPoint, b: PlanarPoint): boolean {
  return Math.hypot(a.east - b.east, a.north - b.north) <= SAME_POINT_M;
}

/**
 * Every point is present and carries two finite numbers.
 *
 * ⚠️ THIS GUARD IS LOAD-BEARING AND IT IS NOT DEFENSIVE PROGRAMMING. Both
 * exported entry points below run on the server's write path, over whatever the
 * projection handed back for whatever the row held — and a corner that is null,
 * or whose easting is NaN, is a real shape in this archive. Without the guard:
 * a NaN easting makes every comparison false, so the ring reads as SIMPLE and
 * nothing is marked while the area comes out NaN; a null easting is coerced to
 * 0 by the arithmetic, putting the corner 5.8e5 m from the parcel and again
 * reading as simple; and a missing element throws a TypeError out of the
 * dedupe, from inside a save.
 *
 * The answer to all three is the same and it is the honest one: coordinates
 * that cannot be read cannot support a claim that the order crosses itself, so
 * say nothing. The marker is withheld, the straighten offers nothing, and — the
 * point of the whole slice — no save is refused.
 */
function allPointsUsable(points: PlanarPoint[]): boolean {
  if (!Array.isArray(points)) return false;
  for (const p of points) {
    if (p == null) return false;
    if (!Number.isFinite(p.east) || !Number.isFinite(p.north)) return false;
  }
  return true;
}

/**
 * Sign of the turn a → b → c: +1 left (counter-clockwise), -1 right, 0
 * collinear. Returns 0 when either vector is degenerate (a === b or a === c),
 * which is the correct answer — a zero-length vector has no side.
 */
function orient(a: PlanarPoint, b: PlanarPoint, c: PlanarPoint): -1 | 0 | 1 {
  const abx = b.east - a.east;
  const aby = b.north - a.north;
  const acx = c.east - a.east;
  const acy = c.north - a.north;

  const scale = Math.hypot(abx, aby) * Math.hypot(acx, acy);
  if (scale === 0) return 0;

  const sin = (abx * acy - aby * acx) / scale;
  if (sin > COLLINEAR_SIN) return 1;
  if (sin < -COLLINEAR_SIN) return -1;
  return 0;
}

/** True when `p` lies on segment `a`–`b`, endpoints included. Assumes collinearity. */
function withinSegment(a: PlanarPoint, b: PlanarPoint, p: PlanarPoint): boolean {
  const minE = Math.min(a.east, b.east) - SAME_POINT_M;
  const maxE = Math.max(a.east, b.east) + SAME_POINT_M;
  const minN = Math.min(a.north, b.north) - SAME_POINT_M;
  const maxN = Math.max(a.north, b.north) + SAME_POINT_M;
  return p.east >= minE && p.east <= maxE && p.north >= minN && p.north <= maxN;
}

/**
 * True when segments a–b and c–d share at least one point. Touching counts:
 * a T-junction and a collinear overlap both return true, because both make the
 * polygon's boundary non-simple and both make its shoelace area a statement
 * about two lobes rather than one parcel.
 */
export function segmentsIntersect(
  a: PlanarPoint,
  b: PlanarPoint,
  c: PlanarPoint,
  d: PlanarPoint,
): boolean {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);

  // Proper crossing: each segment has the other's endpoints strictly on
  // opposite sides.
  if (o1 * o2 < 0 && o3 * o4 < 0) return true;

  // Touching / collinear-overlap: an endpoint of one lies on the other.
  if (o1 === 0 && withinSegment(a, b, c)) return true;
  if (o2 === 0 && withinSegment(a, b, d)) return true;
  if (o3 === 0 && withinSegment(c, d, a)) return true;
  if (o4 === 0 && withinSegment(c, d, b)) return true;

  return false;
}

/** True when segments a–b and c–d cross at a single interior point of each. */
function segmentsProperlyCross(
  a: PlanarPoint,
  b: PlanarPoint,
  c: PlanarPoint,
  d: PlanarPoint,
): boolean {
  return (
    orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0
  );
}

// ---------------------------------------------------------------------------
// Self-intersection (Slice #32.14)
// ---------------------------------------------------------------------------

/**
 * True when the closed ring through `points`, in the order given, is not a
 * simple polygon — the bow-tie condition.
 *
 * What counts, and why each one does:
 *
 *   - Two non-adjacent edges crossing. The classic bow-tie. The shoelace value
 *     becomes lobe-minus-lobe and can be near zero on a large parcel, which is
 *     exactly what PROP01444 did.
 *   - Two non-adjacent edges TOUCHING without crossing — a corner sitting on a
 *     far edge, or two corners at the same position. The boundary is still not
 *     simple and the area is still the sum of two lobes rather than one parcel,
 *     so it is marked. It is reported honestly rather than quietly: the user
 *     sees the marker and the area, and decides.
 *   - The ring doubling back along the edge it just walked. Detected by the
 *     same non-adjacent scan — see the note at the adjacency skip below.
 *
 * What does NOT count:
 *
 *   - Fewer than 4 points. A triangle cannot self-intersect and a 2-gon is not
 *     a polygon. Returns false.
 *   - Consecutive edges meeting at their shared corner. That is what a corner
 *     IS.
 *   - Three collinear corners in a row (a redundant corner on a straight side).
 *   - A repeated CONSECUTIVE corner, or a list that closes itself by repeating
 *     its first point last. Both are data-entry artefacts, and reordering
 *     cannot fix either, so marking them would leave the user a flag he has no
 *     way to clear.
 *
 * ⚠️ THE DUPLICATES ARE COLLAPSED BEFORE THE SCAN, NOT SKIPPED DURING IT, AND
 * THE DIFFERENCE IS A FALSE POSITIVE. Merely skipping a zero-length edge leaves
 * its two NEIGHBOURS in the scan as a non-adjacent pair — and they meet at the
 * duplicated corner, so the touch test fires and every duplicated corner in the
 * archive reads as a bow-tie. Collapsing the run first restores their
 * adjacency, which is what they actually have.
 *
 * Pure and O(n²); a parcel has tens of corners, not thousands.
 */
export function polygonSelfIntersects(points: PlanarPoint[]): boolean {
  if (!allPointsUsable(points)) return false;

  const ring = dedupeConsecutive(points);
  const n = ring.length;
  if (n < 4) return false;

  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];

    for (let j = i + 1; j < n; j++) {
      const c = ring[j];
      const d = ring[(j + 1) % n];

      // Consecutive edges share exactly one endpoint by construction, and
      // meeting there is what a corner IS. Nothing else needs checking:
      //
      // ⚠️ AN EARLIER DRAFT HAD A `sharedEndpointOverlap` HELPER HERE FOR THE
      // DOUBLED-BACK CASE, AND IT WAS DEAD CODE. If the far endpoint of edge
      // i+1 lies on edge i, then that same point is also an endpoint of edge
      // i+2 — and for every n >= 4, edges i and i+2 are NOT adjacent, so the
      // non-adjacent branch below catches it. An adversarial round proved it by
      // exhaustion: forcing the helper to return false left the verdict
      // byte-identical over all 4- and 5-point rings on a 4x4 lattice, 1.1M
      // cases. It is gone. Do not add it back — add a failing test first.
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;

      if (segmentsIntersect(a, b, c, d)) return true;
    }
  }

  return false;
}

/**
 * Collapse runs of coincident points, treating the list as a closed ring — so a
 * final point equal to the first is dropped too. Returns a new array; the input
 * is untouched.
 */
function dedupeConsecutive(points: PlanarPoint[]): PlanarPoint[] {
  const out: PlanarPoint[] = [];
  for (const p of points) {
    if (out.length === 0 || !samePoint(out[out.length - 1], p)) out.push(p);
  }
  while (out.length > 1 && samePoint(out[0], out[out.length - 1])) out.pop();
  return out;
}

// ---------------------------------------------------------------------------
// Straightening (Slice #32.14)
// ---------------------------------------------------------------------------
//
// ⚠️ NOTHING IN THIS FILE CALLS THIS. It returns a permutation and never a
// polygon, precisely so the CALLER moves its own corner objects through it —
// which is what keeps `property_corner.original_index` bound to the corner's
// lat/lon instead of being renumbered. That is Adrian's own requirement on this
// slice: corners 4,5,13,14 reordered become rows 5,4,13,14, never 4,5,13,14.

/** Guard on the untangle loop. Each pass is O(n²); this bounds the passes. */
const MAX_UNTANGLE_PASSES = 1000;

/**
 * Compute an order of the same points whose ring does not self-intersect.
 *
 * Returns a permutation of `[0 … n-1]` — indices INTO the input — or `null`
 * when there is nothing to offer:
 *
 *   - fewer than 4 points;
 *   - a coordinate that cannot be read (see `allPointsUsable`);
 *   - the order is already simple;
 *   - neither strategy below reached a simple ring. Nothing is offered rather
 *     than something that does not fix it.
 *
 * `preferAreaM2` is an optional hint — the parcel's declared surface area in
 * m² — used only to choose between two rings that are both already simple. See
 * the note further down.
 *
 * ── HOW, PART ONE: 2-OPT ─────────────────────────────────────────────────────
 * Find two edges that properly cross, reverse the run of points between them,
 * repeat. Each reversal replaces the two crossing chords with the two
 * non-crossing ones on the same four points, which is strictly shorter by the
 * triangle inequality — so the total perimeter strictly decreases, no order can
 * repeat, and the loop terminates. Left to itself it terminates with no proper
 * crossings left, because a ring that has one always admits another reversal.
 *
 * `MAX_UNTANGLE_PASSES` caps it anyway, and the cap is reachable: measured, a
 * tangled ring uses 8 passes at n=8, 29 at n=20, 94 at n=50 and 247 at n=100,
 * so it would bind somewhere near n≈200 — far past any parcel. A capped run is
 * harmless rather than wrong, because the `simple()` check below turns it into
 * a refusal and never into a bad answer.
 *
 * It is preferred to sorting the corners by angle for two reasons. Angular sort
 * discards the user's order wholesale even when a single swap was wrong, and it
 * is only guaranteed simple when the centroid can see every corner, which an
 * L-shaped parcel's cannot.
 *
 * ⚠️ WHAT 2-OPT DOES NOT PROMISE, AND WHY THIS FUNCTION TAKES A HINT. It
 * reverses at the FIRST crossing it finds and stops when none remain; it does
 * not search for the correction closest to the user's order, and where two
 * corrections move the same number of rows it has no preference between them.
 * Measured over every single-pair corner swap of an L-shaped 1250 m² parcel:
 * 2-opt returns a DIFFERENT polygon from the angular order in ten of them, and
 * lands on 1225, 1375 or 1400 m² where the angular order gets 1250 every time.
 * On a U-shaped parcel it is the other way round — 2-opt gets 1500 where the
 * angular order gets 1400. Both are always legitimate polygons on those
 * corners, and no amount of geometry in this file can know which the user
 * meant.
 *
 * But the APPLICATION knows something geometry does not: `surface_area_mp`,
 * the area written on the parcel's own papers. So `preferAreaM2` lets a caller
 * hand that over, and when both strategies reach a simple ring the one closer
 * to it wins. The hint can only ever choose BETWEEN two rings that are already
 * simple — it cannot produce a self-intersecting answer, and it is ignored when
 * absent, non-finite, or when only one strategy succeeded. It is a
 * tie-breaker, not a constraint: a declared area is user-entered and is
 * sometimes the very thing that is wrong.
 *
 * ⚠️ AND THE HINT BLUNTS THE VERY SAFETY NET IT LEANS ON, WHICH THE CONFIRM
 * DIALOG HAS TO BE BUILT AROUND. Choosing on area converts some "wrong ring,
 * visibly wrong area" into "wrong ring, area exactly as declared" — a wrong
 * answer that looks right in a dialog showing two numbers. Measured against a
 * brute-force permutation oracle over 1200 random parcels: the hint raises
 * correct rings from 397 to 472, and ALSO raises right-area-wrong-ring from 66
 * to 95. It is a good trade — 75 more corrections for 29 more undetectable
 * ones, and the previous order is recoverable from the version history either
 * way — but only if the dialog shows the SHAPE and not merely the numbers. The
 * corners are unchanged by a straighten; it is their sequence that moves, and a
 * wrong sequence is obvious on a map and invisible in a figure.
 *
 * ── HOW, PART TWO, AND AN EARLIER DRAFT OF THIS FILE SHIPPED WITHOUT IT ──────
 * ⚠️ 2-OPT ALONE IS NOT ENOUGH, AND IT FAILS ON EXACTLY THE SHAPE THIS ARCHIVE
 * IS MADE OF. The first version of this function stopped after the loop above
 * and returned null if anything was left, on the reasoning — written into the
 * comment — that a ring whose only defect is a TOUCH rather than a crossing is
 * unfixable by reordering. That reasoning is false, and an adversarial round
 * measured how false: over random rings, 21% of genuinely-fixable bow-ties were
 * being refused, and the cases refused were the collinear and coincident ones,
 * which is to say the axis-aligned Romanian parcel with a mid-side corner.
 *
 * The worked counter-example, a 40 × 50 m parcel with one corner mid-way up its
 * west boundary — an ordinary boundary point shared with the neighbour — read
 * in the order SW, W-MID, SE, NE, NW:
 *
 *     shoelace 1500 m² on a 2000 m² parcel, correctly marked, and the button
 *     said there was nothing it could do. The order [SW, W-MID, NW, NE, SE] is
 *     simple, is two rows away, and is exactly 2000.
 *
 * There is no proper crossing anywhere in that ring — edge SW→W-MID lies INSIDE
 * edge NW→SW, sharing corner SW — so 2-opt never fires at all.
 *
 * So when 2-opt leaves the ring non-simple, fall back to the angular order
 * about the centroid, and 2-opt THAT in turn. It is the strategy rejected above
 * for the general case, and it is the right one here: it is blind to the
 * degeneracies 2-opt cannot see, it puts coincident corners next to each other
 * where `dedupeConsecutive` collapses them, and its weakness — a parcel whose
 * centroid cannot see all of its corners — is a weakness on shapes 2-opt has
 * already handled. It is a fallback and not the first move because it does not
 * preserve the user's order; the normalisation below recovers what it can.
 */
export function straightenPolygonOrder(
  points: PlanarPoint[],
  preferAreaM2?: number | null,
): number[] | null {
  // The guard comes FIRST — before `points.length` — so a null list is a null
  // answer and not a TypeError out of a save.
  if (!allPointsUsable(points)) return null;
  const n = points.length;
  if (n < 4) return null;
  if (!polygonSelfIntersects(points)) return null;

  const simple = (order: number[]) =>
    !polygonSelfIntersects(order.map((i) => points[i]));

  // Order matters: 2-opt first, so it wins any tie. It is the one that changes
  // the user's order least.
  const candidates: number[][] = [];
  const twoOpt = untangleProperCrossings(points, points.map((_, i) => i));
  if (simple(twoOpt)) candidates.push(twoOpt);
  const angular = untangleProperCrossings(points, angularOrder(points));
  if (simple(angular)) candidates.push(angular);

  if (candidates.length === 0) return null;

  let chosen = candidates[0];

  // ⚠️ `> 0` IS THE LOAD-BEARING CLAUSE AND IT IS NOT A SANITY CHECK. A hint of
  // zero passes every other test and makes `Math.abs(area - 0)` the area
  // itself, so the chooser silently inverts into "always take the SMALLEST
  // ring" — and zero is exactly what an ABSENT declared area produces, because
  // `surface_area_mp` is `string | null` in this app and both `Number(null)`
  // and `Number("")` are 0. Measured before the fix: on the U parcel, the comb
  // parcel and an L with a mid-side corner, a zero hint destroyed EVERY
  // otherwise-correct answer (13/13, 26/26, 11/11). A negative hint does the
  // same. The other two clauses are for the reader; this one is for the user.
  const hintUsable =
    preferAreaM2 != null && Number.isFinite(preferAreaM2) && preferAreaM2 > 0;

  if (candidates.length > 1 && hintUsable) {
    let bestGap = Infinity;
    for (const candidate of candidates) {
      const area = shoelaceAreaM2(candidate.map((i) => points[i]));
      if (area == null) continue;
      const gap = Math.abs(area - preferAreaM2);
      // Strictly closer only, so a tie still leaves 2-opt's answer standing.
      if (gap < bestGap) {
        bestGap = gap;
        chosen = candidate;
      }
    }
  }

  return normaliseRingRepresentation(chosen, n);
}

/**
 * Reverse runs between properly-crossing edges until none remain. Returns a new
 * permutation; `order` is not modified.
 */
function untangleProperCrossings(
  points: PlanarPoint[],
  order: number[],
): number[] {
  const n = order.length;
  const out = [...order];
  const at = (k: number) => points[out[k]];

  for (let pass = 0; pass < MAX_UNTANGLE_PASSES; pass++) {
    let reversed = false;

    outer: for (let i = 0; i < n; i++) {
      for (let j = i + 2; j < n; j++) {
        // Edges i and j are adjacent when j === i+1 (excluded by the loop
        // bound) or when they are the first and last, which share point 0.
        if (i === 0 && j === n - 1) continue;

        if (segmentsProperlyCross(at(i), at(i + 1), at(j), at((j + 1) % n))) {
          // Reverse the run strictly between the two crossing edges.
          for (let lo = i + 1, hi = j; lo < hi; lo++, hi--) {
            [out[lo], out[hi]] = [out[hi], out[lo]];
          }
          reversed = true;
          break outer;
        }
      }
    }

    if (!reversed) break;
  }

  return out;
}

/**
 * Indices sorted by bearing about the arithmetic centroid.
 *
 * The `radius` tie-break is not decoration: two DISTINCT corners on the same
 * bearing — one directly behind the other from the centroid — must be visited
 * near-then-far or the ring doubles back over itself. Measured, dropping it
 * changes the answer on 9,377 of 300,000 random non-simple rings, and dropping
 * the whole chain also turns some fixable rings into a refusal the user cannot
 * clear. `a.i` is redundant with `Array.prototype.sort` being stable since
 * ES2019, and is kept so the determinism does not have to be inferred.
 */
function angularOrder(points: PlanarPoint[]): number[] {
  const n = points.length;
  let cEast = 0;
  let cNorth = 0;
  for (const p of points) {
    cEast += p.east;
    cNorth += p.north;
  }
  cEast /= n;
  cNorth /= n;

  return points
    .map((p, i) => ({
      i,
      angle: Math.atan2(p.north - cNorth, p.east - cEast),
      radius: Math.hypot(p.north - cNorth, p.east - cEast),
    }))
    .sort((a, b) => a.angle - b.angle || a.radius - b.radius || a.i - b.i)
    .map((e) => e.i);
}

/**
 * Pick the array representation of the ring `order` that differs from the
 * identity order in the fewest positions; ties go to the representation whose
 * changed positions come earliest.
 *
 * The identity order is the input's own order, so "fewest positions" is
 * literally "fewest rows the user sees move".
 */
function normaliseRingRepresentation(order: number[], n: number): number[] {
  const reversed = [...order].reverse();

  let best: number[] | null = null;
  let bestChanged: number[] | null = null;

  for (const base of [order, reversed]) {
    for (let start = 0; start < n; start++) {
      const candidate = Array.from({ length: n }, (_, k) => base[(start + k) % n]);

      const changed: number[] = [];
      for (let k = 0; k < n; k++) if (candidate[k] !== k) changed.push(k);

      if (bestChanged === null || betterChangeSet(changed, bestChanged)) {
        best = candidate;
        bestChanged = changed;
      }
    }
  }

  return best ?? order;
}

/** Fewer changed positions wins; on a tie, the lexicographically earlier set wins. */
function betterChangeSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return a.length < b.length;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}
