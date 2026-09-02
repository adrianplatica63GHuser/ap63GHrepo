/**
 * Unit tests for the Property polygon helpers (Slice #18.09; extended by
 * Slice #32.14).
 *
 * Pure functions — no DB / React. Verifies the shoelace area over planar
 * Stereo 70 metres, including the <3-points null case and winding
 * independence; then the bow-tie detector and the straightener #32.14 adds.
 */

import {
  polygonSelfIntersects,
  segmentsIntersect,
  shoelaceAreaM2,
  straightenPolygonOrder,
  type PlanarPoint,
} from "@/lib/properties/area";

/** east/north shorthand, so a shape below reads as a shape. */
const p = (east: number, north: number): PlanarPoint => ({ east, north });

describe("shoelaceAreaM2", () => {
  it("returns null for fewer than 3 points", () => {
    expect(shoelaceAreaM2([])).toBeNull();
    expect(shoelaceAreaM2([{ north: 0, east: 0 }])).toBeNull();
    expect(
      shoelaceAreaM2([
        { north: 0, east: 0 },
        { north: 10, east: 0 },
      ]),
    ).toBeNull();
  });

  it("computes the area of a 10x10 metre square as 100 m²", () => {
    const square: PlanarPoint[] = [
      { east: 0, north: 0 },
      { east: 10, north: 0 },
      { east: 10, north: 10 },
      { east: 0, north: 10 },
    ];
    expect(shoelaceAreaM2(square)).toBeCloseTo(100, 6);
  });

  it("computes the area of a right triangle as base*height/2", () => {
    const triangle: PlanarPoint[] = [
      { east: 0, north: 0 },
      { east: 6, north: 0 },
      { east: 0, north: 8 },
    ];
    expect(shoelaceAreaM2(triangle)).toBeCloseTo(24, 6);
  });

  it("is winding-independent (CW and CCW give the same area)", () => {
    const ccw: PlanarPoint[] = [
      { east: 0, north: 0 },
      { east: 4, north: 0 },
      { east: 4, north: 4 },
      { east: 0, north: 4 },
    ];
    const cw = [...ccw].reverse();
    expect(shoelaceAreaM2(cw)).toBeCloseTo(shoelaceAreaM2(ccw)!, 6);
    expect(shoelaceAreaM2(cw)).toBeCloseTo(16, 6);
  });

  it("does not require the first point to be repeated at the end", () => {
    const open: PlanarPoint[] = [
      { east: 0, north: 0 },
      { east: 10, north: 0 },
      { east: 10, north: 5 },
      { east: 0, north: 5 },
    ];
    const closed: PlanarPoint[] = [...open, { east: 0, north: 0 }];
    // The closed form repeats the first vertex, which adds a zero-area segment.
    expect(shoelaceAreaM2(open)).toBeCloseTo(50, 6);
    expect(shoelaceAreaM2(closed)).toBeCloseTo(50, 6);
  });

  it("computes an L-shaped (non-convex) polygon correctly", () => {
    // L-shape: 3x3 square with a 1x1 bite removed from the top-right → 8 m².
    const lshape: PlanarPoint[] = [
      { east: 0, north: 0 },
      { east: 3, north: 0 },
      { east: 3, north: 2 },
      { east: 2, north: 2 },
      { east: 2, north: 3 },
      { east: 0, north: 3 },
    ];
    expect(shoelaceAreaM2(lshape)).toBeCloseTo(8, 6);
  });
});

// ---------------------------------------------------------------------------
// Slice #32.14 — segment intersection
// ---------------------------------------------------------------------------

describe("segmentsIntersect", () => {
  it("finds a proper crossing", () => {
    expect(segmentsIntersect(p(0, 0), p(4, 4), p(0, 4), p(4, 0))).toBe(true);
  });

  it("finds a T-junction (an endpoint resting on the other segment)", () => {
    expect(segmentsIntersect(p(0, 0), p(4, 0), p(2, 0), p(2, 3))).toBe(true);
  });

  it("finds a T-junction the OTHER way round — the first segment's end on the second", () => {
    // ⚠️ FOUR TOUCH BRANCHES, AND THIS PINS THE FOURTH. The case above is
    // caught by the first (`c` on `a–b`); this one can only be caught by the
    // last (`b` on `c–d`). They are not interchangeable at ring level, because
    // `polygonSelfIntersects` enumerates edge pairs with i < j only — so the
    // fourth branch is the SOLE detector whenever the far end of an earlier
    // edge rests on a later one. Deleting it left the whole suite green and
    // flipped the verdict on 4,057 of 200,000 random parcel-scale rings.
    expect(segmentsIntersect(p(0, 0), p(2, 0), p(2, -1), p(2, 1))).toBe(true);
  });

  it("finds a shared endpoint", () => {
    expect(segmentsIntersect(p(0, 0), p(4, 0), p(4, 0), p(4, 3))).toBe(true);
  });

  it("finds a collinear overlap", () => {
    expect(segmentsIntersect(p(0, 0), p(4, 0), p(2, 0), p(6, 0))).toBe(true);
  });

  it("finds a collinear containment", () => {
    expect(segmentsIntersect(p(0, 0), p(6, 0), p(2, 0), p(4, 0))).toBe(true);
  });

  it("rejects collinear but disjoint segments", () => {
    expect(segmentsIntersect(p(0, 0), p(1, 0), p(2, 0), p(3, 0))).toBe(false);
  });

  it("rejects parallel segments", () => {
    expect(segmentsIntersect(p(0, 0), p(4, 0), p(0, 1), p(4, 1))).toBe(false);
  });

  it("rejects segments whose infinite lines cross outside both", () => {
    expect(segmentsIntersect(p(0, 0), p(1, 1), p(3, 0), p(4, 1))).toBe(false);
  });

  it("works unchanged at Stereo 70 magnitudes", () => {
    const E = 578_800;
    const N = 321_800;
    expect(
      segmentsIntersect(
        p(E, N), p(E + 40, N + 50),
        p(E, N + 50), p(E + 40, N),
      ),
    ).toBe(true);
    expect(
      segmentsIntersect(
        p(E, N), p(E + 40, N),
        p(E, N + 50), p(E + 40, N + 50),
      ),
    ).toBe(false);
  });

  it("sees a corner exactly on a long oblique boundary — the raw cross product does not", () => {
    // ⚠️ THIS TEST EXISTS TO PIN ONE LINE: the division by both vector lengths
    // in `orient`. These three coordinates are exactly collinear on the
    // centimetre grid, 844 m apart at Stereo 70. Their raw cross product is
    // 5.2e-8 — fifty times the 1e-9 gate, so an implementation that dropped the
    // normalisation would call this boundary bent and miss the corner sitting
    // on it. Normalised, the sine is 1.5e-13.
    //
    // The earlier Stereo 70 test above cannot catch that: it is a 40 m
    // axis-aligned box, where both formulations agree.
    const boundaryStart = p(578_914.42, 321_972.21);
    const onTheBoundary = p(578_616.96, 322_271.48);
    const boundaryEnd = p(578_319.5, 322_570.75);

    expect(segmentsIntersect(
      boundaryStart, boundaryEnd,
      onTheBoundary, p(578_600, 321_700),
    )).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Slice #32.14 — bow-tie detection
// ---------------------------------------------------------------------------

describe("polygonSelfIntersects", () => {
  it("returns false below 4 points — a triangle cannot self-intersect", () => {
    expect(polygonSelfIntersects([])).toBe(false);
    expect(polygonSelfIntersects([p(0, 0)])).toBe(false);
    expect(polygonSelfIntersects([p(0, 0), p(1, 0)])).toBe(false);
    expect(polygonSelfIntersects([p(0, 0), p(4, 0), p(0, 3)])).toBe(false);
  });

  it("returns false for a simple square", () => {
    expect(
      polygonSelfIntersects([p(0, 0), p(4, 0), p(4, 4), p(0, 4)]),
    ).toBe(false);
  });

  it("returns true for the classic bow-tie (corners 1, 2, 4, 3)", () => {
    expect(
      polygonSelfIntersects([p(0, 0), p(4, 0), p(0, 4), p(4, 4)]),
    ).toBe(true);
  });

  it("returns false for an L-shaped (non-convex but simple) polygon", () => {
    expect(
      polygonSelfIntersects([
        p(0, 0), p(3, 0), p(3, 2), p(2, 2), p(2, 3), p(0, 3),
      ]),
    ).toBe(false);
  });

  it("returns false for an irregular simple parcel", () => {
    // Not the square again — every vertex here is an oblique corner, so a
    // regression that flags ordinary corners cannot hide behind right angles.
    expect(
      polygonSelfIntersects([
        p(0, 0), p(6, 1), p(8, 5), p(4, 8), p(-1, 6), p(-2, 2),
      ]),
    ).toBe(false);
  });

  it("says nothing when a coordinate cannot be read", () => {
    // A marker asserts that the ORDER is wrong. Coordinates that cannot be read
    // support no such claim, and this runs on the save path — so it is false,
    // and never a throw.
    const bowtie = [p(0, 0), p(4, 0), p(0, 4), p(4, 4)];
    expect(polygonSelfIntersects(bowtie)).toBe(true);

    expect(polygonSelfIntersects([{ east: NaN, north: 0 }, ...bowtie.slice(1)])).toBe(false);
    expect(polygonSelfIntersects([{ east: Infinity, north: 0 }, ...bowtie.slice(1)])).toBe(false);
    // Both halves of the guard, not just `east` — a corner whose NORTH is
    // unreadable is the same corner. Left untested, a ring with a null north
    // raises a marker and offers a reorder on coordinates nobody can read.
    expect(polygonSelfIntersects([...bowtie, { east: 2, north: NaN }])).toBe(false);
    expect(
      polygonSelfIntersects([
        ...bowtie,
        { east: 2, north: null as unknown as number },
      ]),
    ).toBe(false);
    expect(
      polygonSelfIntersects([...bowtie, { north: 2 } as unknown as PlanarPoint]),
    ).toBe(false);
    // A null easting coerces to 0 in arithmetic, which would silently move the
    // corner 578 km; Number.isFinite does not coerce, which is why it is used.
    expect(
      polygonSelfIntersects([
        { east: null as unknown as number, north: 0 },
        ...bowtie.slice(1),
      ]),
    ).toBe(false);
    expect(
      polygonSelfIntersects([
        undefined as unknown as PlanarPoint,
        ...bowtie.slice(1),
      ]),
    ).toBe(false);
  });

  it("returns false for three collinear corners in a row (a redundant corner)", () => {
    expect(
      polygonSelfIntersects([
        p(0, 0), p(2, 0), p(4, 0), p(4, 4), p(0, 4),
      ]),
    ).toBe(false);
  });

  it("returns true when the ring doubles back along the edge it just walked", () => {
    // Consecutive edges overlapping collinearly: (0,0)->(4,0) then (4,0)->(2,0).
    expect(
      polygonSelfIntersects([p(0, 0), p(4, 0), p(2, 0), p(2, 3)]),
    ).toBe(true);
  });

  it("returns true when the ring touches itself at a vertex without crossing", () => {
    // Two lobes meeting at (1,1). Nothing crosses; the boundary is still not
    // simple and the shoelace value is still two lobes rather than one parcel.
    expect(
      polygonSelfIntersects([
        p(0, 0), p(2, 0), p(1, 1), p(2, 2), p(0, 2), p(1, 1),
      ]),
    ).toBe(true);
  });

  it("returns true when a corner rests on a far edge", () => {
    expect(
      polygonSelfIntersects([
        p(0, 0), p(4, 0), p(4, 4), p(0, 4), p(2, 0),
      ]),
    ).toBe(true);
  });

  it("returns false for a repeated CONSECUTIVE corner (a zero-length edge)", () => {
    // The duplicate's two neighbours meet at it. Collapsing the run first is
    // what stops that reading as a self-touch — a false positive the user
    // could not clear by reordering.
    expect(
      polygonSelfIntersects([
        p(0, 0), p(4, 0), p(4, 0), p(4, 4), p(0, 4),
      ]),
    ).toBe(false);
  });

  it("returns false for a list that closes itself by repeating the first point", () => {
    expect(
      polygonSelfIntersects([
        p(0, 0), p(4, 0), p(4, 4), p(0, 4), p(0, 0),
      ]),
    ).toBe(false);
  });

  it("catches a corner of an EARLIER edge resting on a later one", () => {
    // The ring-level half of the fourth-touch-branch test above: corner v1
    // sits on edge v2->v3. The (edge1, edge2) pair is adjacent and skipped, so
    // only the (edge0, edge2) pair can see it, and only through that branch.
    const E = 578_800;
    const N = 321_800;
    expect(
      polygonSelfIntersects([
        p(E, N + 30),
        p(E + 10, N), // on the edge from (E, N) to (E + 20, N)
        p(E, N),
        p(E + 20, N),
        p(E + 20, N + 20),
      ]),
    ).toBe(true);
  });

  it("catches a corner exactly on a long oblique boundary", () => {
    // The polygon-level half of the `orient` normalisation test above: the
    // marker itself, not just the segment predicate.
    const ring = [
      p(578_914.42, 321_972.21),
      p(578_319.5, 322_570.75),
      p(578_600, 321_700),
      p(578_616.96, 322_271.48), // exactly on the first edge, 844 m long
    ];
    expect(polygonSelfIntersects(ring)).toBe(true);
  });

  it("does not flag a small parcel whose corners merely come CLOSE to collinear", () => {
    // ⚠️ THE OTHER DIRECTION, AND THE ONE THAT COSTS A USER SOMETHING. Loosening
    // COLLINEAR_SIN to reach shorter edges buys false positives, and a false
    // positive is a marker on a correct parcel that no amount of reordering
    // will clear. This ring is simple — verified against an exact
    // integer-arithmetic reference — and is flagged at a 1e-3 gate.
    const nearlyStraight = [
      p(578_804.01, 321_803.26),
      p(578_804.76, 321_803.6),
      p(578_801.38, 321_800.12),
      p(578_801.52, 321_802.37),
      p(578_801.53, 321_800.28),
    ];
    expect(polygonSelfIntersects(nearlyStraight)).toBe(false);
  });

  it("distinguishes a corner ON a far edge from one a centimetre off it", () => {
    // Pins the bbox pad in `withinSegment` (SAME_POINT_M, one micrometre)
    // against being widened to anything the 2 dp data grid can reach. One
    // centimetre is a real distance in this archive; it must not read as zero.
    //
    // It bounds the value from BELOW only: below a centimetre the pad has no
    // observable effect at parcel scale — an adversarial round found none at
    // 1e-3 or at 0 — because its whole job is exact-duplicate detection with a
    // whisker for float noise. The test below it bounds it from above.
    const E = 578_800;
    const N = 321_800;
    const square = [p(E, N), p(E + 40, N), p(E + 40, N + 50), p(E, N + 50)];

    expect(polygonSelfIntersects([...square, p(E + 20, N)])).toBe(true);
    expect(polygonSelfIntersects([...square, p(E + 20, N + 0.01)])).toBe(false);
  });

  it("does not merge two corners a centimetre apart", () => {
    // ⚠️ THIS IS WHAT BOUNDS SAME_POINT_M FROM ABOVE, AND THE TEST ABOVE DOES
    // NOT. That one is decided entirely by COLLINEAR_SIN — the sine of a 1 cm
    // offset over a 40 m edge is 5e-4, so `orient` never returns 0 and the pad
    // is never consulted. An adversarial round measured the consequence: the
    // whole suite stayed green with the pad widened to HALF A METRE, which
    // silently swallows real bow-ties by collapsing genuinely distinct corners
    // (17 of them over 60,000 random rings at parcel scale).
    //
    // Here the pad is the only thing that decides. The two middle corners are
    // one MILLIMETRE apart and CONSECUTIVE, so any pad at or above that
    // collapses them — and the ring is a bow-tie precisely because of the short
    // edge between them: it crosses the parcel's south boundary. Collapse them
    // and it reads simple.
    //
    // A millimetre rather than a centimetre on purpose. The claim worth pinning
    // is not "the pad is under the data grid" but "it is orders of magnitude
    // under it". Measured: this bounds the pad below about 1e-3 m, a thousand
    // times under the centimetre the archive records — where the centimetre
    // version left everything up to half a metre passing. At the separation
    // itself the comparison is a knife-edge float noise decides, which is
    // exactly why the shipped value is 1e-6 and not "just under the grid".
    // Nothing bounds it from BELOW, deliberately: an adversarial round found
    // no observable difference at 1e-3 or at 0, because the pad's only job is
    // exact-duplicate detection with a whisker for float noise.
    const E = 578_800;
    const N = 321_800;
    const ring = [
      p(E, N),
      p(E + 40, N),
      p(E + 20, N + 0.0005),
      p(E + 20, N - 0.0005), // 1 mm from the corner before it
      p(E + 40, N + 50),
      p(E, N + 50),
    ];

    expect(polygonSelfIntersects(ring)).toBe(true);
    // ...and the collapsed version really is simple, so the assertion above is
    // load-bearing rather than incidentally true.
    const collapsed = [...ring.slice(0, 3), ...ring.slice(4)];
    expect(polygonSelfIntersects(collapsed)).toBe(false);
  });

  it("catches PROP01444's shape at Stereo 70 magnitudes", () => {
    // A 40 x 50 m parcel — 2000 m², the number the parcel's own name says.
    const E = 578_800;
    const N = 321_800;
    const A = p(E, N);
    const B = p(E + 40, N);
    const C = p(E + 40, N + 50);
    const D = p(E, N + 50);

    expect(polygonSelfIntersects([A, B, C, D])).toBe(false);
    expect(shoelaceAreaM2([A, B, C, D])).toBeCloseTo(2000, 3);

    // File order 1, 2, 4, 3: the shoelace value collapses to ~0 and says
    // nothing about it. That is the bug.
    expect(polygonSelfIntersects([A, B, D, C])).toBe(true);
    expect(shoelaceAreaM2([A, B, D, C])!).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// Slice #32.14 — straightening
// ---------------------------------------------------------------------------

describe("straightenPolygonOrder", () => {
  it("returns null below 4 points", () => {
    expect(straightenPolygonOrder([])).toBeNull();
    expect(straightenPolygonOrder([p(0, 0), p(4, 0), p(0, 3)])).toBeNull();
  });

  it("returns null when the order is already simple", () => {
    expect(
      straightenPolygonOrder([p(0, 0), p(4, 0), p(4, 4), p(0, 4)]),
    ).toBeNull();
  });

  it("straightens the classic bow-tie into a simple ring", () => {
    const bowtie = [p(0, 0), p(4, 0), p(0, 4), p(4, 4)];
    const order = straightenPolygonOrder(bowtie);

    // Asserted exactly, not just "some simple ring": the 2-opt path and the
    // angular fallback both reach a simple answer here, and an assertion that
    // accepts either lets one of them be deleted without a test going red.
    expect(order).toEqual([1, 0, 2, 3]);

    const fixed = order!.map((i) => bowtie[i]);
    expect(polygonSelfIntersects(fixed)).toBe(false);
    expect(shoelaceAreaM2(fixed)).toBeCloseTo(16, 6);
  });

  it("straightens a 6-corner tangle and leaves it simple", () => {
    // A convex hexagon read in a scrambled order — two crossings, so the
    // untangle takes more than one pass.
    const hexagon = [
      p(0, 0), p(6, 1), p(8, 5), p(4, 8), p(-1, 6), p(-2, 2),
    ];
    const tangled = [0, 2, 1, 4, 3, 5].map((i) => hexagon[i]);
    expect(polygonSelfIntersects(tangled)).toBe(true);

    const order = straightenPolygonOrder(tangled);

    // 2-opt's own answer, asserted exactly — the angular fallback reaches a
    // simple ring here too, so anything weaker leaves 2-opt untested.
    expect(order).toEqual([2, 0, 5, 3, 4, 1]);
    expect(polygonSelfIntersects(order!.map((i) => tangled[i]))).toBe(false);
    // And it is the convex hull's own area, not merely some simple ring.
    expect(shoelaceAreaM2(order!.map((i) => tangled[i]))).toBeCloseTo(
      shoelaceAreaM2(hexagon)!,
      6,
    );
  });

  it("returns null when there is no list at all", () => {
    // The guard runs before `points.length`, so a null list is a null answer
    // rather than a TypeError out of a save.
    const nothing = [null, undefined, 42, { length: 4 }];
    for (const bad of nothing) {
      expect(straightenPolygonOrder(bad as unknown as PlanarPoint[])).toBeNull();
      expect(polygonSelfIntersects(bad as unknown as PlanarPoint[])).toBe(false);
    }
  });

  it("returns null when a coordinate cannot be read", () => {
    expect(
      straightenPolygonOrder([
        { east: NaN, north: 0 }, p(4, 0), p(0, 4), p(4, 4),
      ]),
    ).toBeNull();
    expect(
      straightenPolygonOrder([
        undefined as unknown as PlanarPoint, p(4, 0), p(0, 4), p(4, 4),
      ]),
    ).toBeNull();
  });

  it("straightens a ring that only TOUCHES itself, with no crossing anywhere", () => {
    // Two lobes meeting at (1,1). 2-opt is blind to this — there is no proper
    // crossing to reverse — so the angular fallback is the only thing that
    // fixes it, and an earlier draft returned null here.
    const touching = [
      p(0, 0), p(2, 0), p(1, 1), p(2, 2), p(0, 2), p(1, 1),
    ];
    expect(polygonSelfIntersects(touching)).toBe(true);

    const order = straightenPolygonOrder(touching);
    // Exact, because this is the fallback's own answer AND it pins the
    // angular tie-break: the two coincident corners (indices 2 and 5) land
    // ADJACENT, which is what lets dedupeConsecutive collapse them.
    expect(order).toEqual([0, 1, 2, 5, 3, 4]);
    expect(polygonSelfIntersects(order!.map((i) => touching[i]))).toBe(false);
  });

  it("straightens a corner that rests on a far edge", () => {
    const resting = [p(0, 0), p(4, 0), p(4, 4), p(0, 4), p(2, 0)];
    expect(polygonSelfIntersects(resting)).toBe(true);

    const order = straightenPolygonOrder(resting)!;
    expect(order).not.toBeNull();
    const fixed = order.map((i) => resting[i]);
    expect(polygonSelfIntersects(fixed)).toBe(false);
    // The far-edge corner becomes a redundant corner on the bottom side.
    expect(shoelaceAreaM2(fixed)).toBeCloseTo(16, 6);
  });

  it("straightens the axis-aligned parcel with a mid-side corner (regression)", () => {
    // The shape an adversarial round used to falsify a 2-opt-only straightener:
    // a 40 x 50 m parcel with an ordinary boundary point half-way up its west
    // side, read SW, W-MID, SE, NE, NW. Its only defect is a collinear overlap,
    // so nothing properly crosses and 2-opt alone finds nothing to do.
    const E = 578_800;
    const N = 321_800;
    const parcel = [
      p(E, N),           // SW
      p(E, N + 25),      // W-MID
      p(E + 40, N),      // SE
      p(E + 40, N + 50), // NE
      p(E, N + 50),      // NW
    ];

    expect(polygonSelfIntersects(parcel)).toBe(true);
    expect(shoelaceAreaM2(parcel)).toBeCloseTo(1500, 3);

    const order = straightenPolygonOrder(parcel);
    expect(order).toEqual([1, 0, 2, 3, 4]);

    const fixed = order!.map((i) => parcel[i]);
    expect(polygonSelfIntersects(fixed)).toBe(false);
    expect(shoelaceAreaM2(fixed)).toBeCloseTo(2000, 3);
    // Two rows move, not five.
    expect(order!.filter((v, k) => v !== k).length).toBe(2);
  });

  it("prefers the ring nearer the declared area, and 2-opt's when there is no hint", () => {
    // ⚠️ THIS IS THE ONLY TEST THAT DISTINGUISHES THE TWO STRATEGIES, AND IT IS
    // HERE BECAUSE EVERY OTHER ONE FAILED TO. On a convex point set there is
    // exactly ONE simple ring, so 2-opt and the angular fallback agree and
    // either can be deleted without a test going red. This L-shaped parcel is
    // where they disagree.
    //
    // 1250 m² L-parcel at Stereo 70, corners 1 and 3 swapped by the user:
    // 2-opt straightens it to 1225 m², the angular order to 1250. Both are
    // legitimate polygons on those five corners. `surface_area_mp` is what
    // settles it, and the archive has that number.
    const E = 578_800;
    const N = 321_800;
    const lShape = [
      [0, 0], [40, 0], [40, 20], [15, 20], [15, 50], [0, 50],
    ].map(([e, n]) => p(E + e, N + n));
    expect(shoelaceAreaM2(lShape)).toBeCloseTo(1250, 6);

    const swapped = [...lShape];
    [swapped[1], swapped[3]] = [swapped[3], swapped[1]];
    expect(polygonSelfIntersects(swapped)).toBe(true);

    // No hint: 2-opt's answer, which moves the fewest rows and is 25 m² short.
    const noHint = straightenPolygonOrder(swapped);
    expect(noHint).toEqual([0, 1, 3, 2, 4, 5]);
    expect(shoelaceAreaM2(noHint!.map((i) => swapped[i]))).toBeCloseTo(1225, 6);

    // With the declared area: the fallback's answer, at the declared 1250.
    //
    // ⚠️ AND IT IS *NOT* THE ORIGINAL RING — an earlier version of this comment
    // claimed it was. It is a different simple hexagon on the same six corners
    // that happens to have the same area. That is the hint's whole hazard in
    // one line, and it is why the confirm dialog has to show the shape.
    const hinted = straightenPolygonOrder(swapped, 1250);
    expect(hinted).toEqual([1, 0, 3, 2, 4, 5]);
    expect(shoelaceAreaM2(hinted!.map((i) => swapped[i]))).toBeCloseTo(1250, 6);

    // A hint that matches neither, or is unusable, leaves 2-opt's answer alone.
    expect(straightenPolygonOrder(swapped, null)).toEqual(noHint);
    expect(straightenPolygonOrder(swapped, NaN)).toEqual(noHint);
    // ...and a hint nearer 2-opt's answer keeps it.
    expect(straightenPolygonOrder(swapped, 1220)).toEqual(noHint);
    // An exact tie — 1237.5 is equidistant from 1225 and 1250 — leaves the
    // minimal-change answer standing. That is why the comparison is `<`.
    expect(straightenPolygonOrder(swapped, 1237.5)).toEqual(noHint);

    // Unusable hints leave 2-opt's answer alone. (Zero and negative get their
    // own test below, on a parcel where honouring them would show.)
    expect(straightenPolygonOrder(swapped, 0)).toEqual(noHint);
    expect(straightenPolygonOrder(swapped, -500)).toEqual(noHint);
    expect(straightenPolygonOrder(swapped, Infinity)).toEqual(noHint);
  });

  it("ignores a zero or negative hint — a blank declared area is a zero", () => {
    // ⚠️ THE MOST CONSEQUENTIAL ASSERTION IN THIS FILE. `surface_area_mp` is
    // `string | null`, and BOTH `Number(null)` and `Number("")` are 0. So the
    // hint arrives as zero for every property whose declared area is blank —
    // and `Math.abs(area - 0)` is the area itself, which turns the chooser into
    // "always take the SMALLEST ring". Not a wrong guess on one parcel: a
    // systematic preference for the wrong polygon across the archive.
    //
    // This U-shaped 1500 m² parcel is where it shows. The L-shaped parcel above
    // cannot catch it — there the smallest candidate happens to be the one
    // 2-opt returns anyway, so honouring a zero changes nothing.
    const E = 578_800;
    const N = 321_800;
    const uShape = [
      [0, 0], [50, 0], [50, 40], [35, 40], [35, 15], [15, 15], [15, 40], [0, 40],
    ].map(([e, n]) => p(E + e, N + n));
    expect(shoelaceAreaM2(uShape)).toBeCloseTo(1500, 6);

    const swapped = [...uShape];
    [swapped[0], swapped[5]] = [swapped[5], swapped[0]];
    expect(polygonSelfIntersects(swapped)).toBe(true);

    // 2-opt recovers the parcel here; the angular candidate is 1400 m² and is
    // what a honoured zero would select.
    const noHint = straightenPolygonOrder(swapped);
    expect(noHint).toEqual([5, 1, 2, 3, 4, 0, 6, 7]);
    expect(shoelaceAreaM2(noHint!.map((i) => swapped[i]))).toBeCloseTo(1500, 6);

    expect(straightenPolygonOrder(swapped, 0)).toEqual(noHint);
    expect(straightenPolygonOrder(swapped, -500)).toEqual(noHint);
    expect(straightenPolygonOrder(swapped, -0)).toEqual(noHint);
  });

  it("offers nothing when the fallback's own ring is not simple either", () => {
    // ⚠️ PINS `if (simple(angular))`. Without that guard the function returns
    // the angular candidate unchecked — and the test below, despite its name,
    // cannot catch it: on the L parcel BOTH candidates are already simple, so
    // the guard never runs there. Removing it returns a still-crossing
    // "straightening" on 94 of ~60,000 random non-simple rings, which is a
    // confirm dialog offering to fix a bow-tie with a bow-tie.
    const E = 578_800;
    const N = 321_800;
    const neither = [
      [3, 1], [2, 3], [4, 2], [3, 4], [3, 0], [3, 2],
    ].map(([e, n]) => p(E + e, N + n));

    expect(polygonSelfIntersects(neither)).toBe(true);
    expect(straightenPolygonOrder(neither)).toBeNull();
    expect(straightenPolygonOrder(neither, 1)).toBeNull();
  });

  it("never lets the hint produce a self-intersecting ring", () => {
    // The hint chooses between rings that are already simple; it can never
    // introduce a crossing, however wrong the declared area is.
    const E = 578_800;
    const N = 321_800;
    const lShape = [
      [0, 0], [40, 0], [40, 20], [15, 20], [15, 50], [0, 50],
    ].map(([e, n]) => p(E + e, N + n));
    const swapped = [...lShape];
    [swapped[1], swapped[3]] = [swapped[3], swapped[1]];

    for (const hint of [0, 1, 999_999, -500]) {
      const order = straightenPolygonOrder(swapped, hint)!;
      expect(order).not.toBeNull();
      expect(polygonSelfIntersects(order.map((i) => swapped[i]))).toBe(false);
    }
  });

  it("visits two corners on one bearing near-then-far", () => {
    // ⚠️ PINS `angularOrder`'s RADIUS TIE-BREAK, WHICH NOTHING ELSE DOES. When
    // two DISTINCT corners share a bearing from the centroid, visiting the far
    // one first makes the ring double back over itself. The coincident-corner
    // test above cannot catch it: sort is stable, so those two keep their input
    // order with or without the tie-break. Dropping it changes the answer on
    // 9,377 of 300,000 random non-simple rings, and sometimes turns a fixable
    // ring into a refusal.
    const E = 578_800;
    const N = 321_800;
    const ring = [
      [1, 0], [1, 2], [0, 1], [0, 1], [1, 3], [3, 3], [1, 3], [2, 3], [0, 3],
    ].map(([e, n]) => p(E + e, N + n));

    expect(polygonSelfIntersects(ring)).toBe(true);

    const order = straightenPolygonOrder(ring);
    expect(order).toEqual([6, 8, 2, 3, 1, 0, 5, 7, 4]);
    expect(polygonSelfIntersects(order!.map((i) => ring[i]))).toBe(false);
    expect(shoelaceAreaM2(order!.map((i) => ring[i]))).toBeCloseTo(4.5, 6);
  });

  it("never renumbers: Adrian's own 4,5,13,14 in, 5,4,13,14 out", () => {
    // Adrian, on finding 5: "if before the fix the original corners numbers
    // were 4,5,13,14 and we switch the first two to get rid of the bow-tie,
    // then we should have these rows in the corner table: 5,4,13,14".
    //
    // The corner OBJECTS travel through the permutation, which is why
    // original_index stays bound to its own lat/lon. The helper returns
    // indices and never points, exactly so a caller cannot do it any other way.
    type Corner = PlanarPoint & { originalIndex: number };

    const corners: Corner[] = [
      { originalIndex: 4, east: 1, north: 0 },
      { originalIndex: 5, east: 0, north: 0 },
      { originalIndex: 13, east: 1, north: 1 },
      { originalIndex: 14, east: 0, north: 1 },
    ];

    expect(corners.map((c) => c.originalIndex)).toEqual([4, 5, 13, 14]);
    expect(polygonSelfIntersects(corners)).toBe(true);
    // The bow-tie's two lobes cancel exactly — 0 m² on a 1 m² parcel.
    expect(shoelaceAreaM2(corners)).toBeCloseTo(0, 9);

    const order = straightenPolygonOrder(corners);
    expect(order).not.toBeNull();

    const fixed = order!.map((i) => corners[i]);

    expect(fixed.map((c) => c.originalIndex)).toEqual([5, 4, 13, 14]);
    expect(polygonSelfIntersects(fixed)).toBe(false);
    expect(shoelaceAreaM2(fixed)).toBeCloseTo(1, 9);
  });

  it("returns the representation of its own answer that moves the fewest rows", () => {
    // A ring has 2n array representations and they are all the same polygon.
    // The one shown to the user is the one that leaves the most rows alone —
    // otherwise a two-row fix reads as "everything moved".
    //
    // Checked by re-deriving the 2n representations here, so this asserts
    // minimality rather than restating whatever the implementation chose.
    const corners = [
      { originalIndex: 4, east: 1, north: 0 },
      { originalIndex: 5, east: 0, north: 0 },
      { originalIndex: 13, east: 1, north: 1 },
      { originalIndex: 14, east: 0, north: 1 },
    ];
    const order = straightenPolygonOrder(corners)!;
    const n = order.length;

    const moves = (o: number[]) => o.filter((v, k) => v !== k).length;

    let minimum = moves(order);
    for (const base of [order, [...order].reverse()]) {
      for (let start = 0; start < n; start++) {
        const rotated = Array.from({ length: n }, (_, k) => base[(start + k) % n]);
        minimum = Math.min(minimum, moves(rotated));
      }
    }

    expect(moves(order)).toBe(minimum);
    expect(moves(order)).toBe(2);
  });
});
