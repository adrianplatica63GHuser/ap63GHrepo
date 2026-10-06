/**
 * „Calcul drum lateral" — the slices without a road                (Slice #38.23)
 *
 * Pure module. On the request's sample (far from a rectangle) and on a
 * near-rectangle: the slices sum to the parcel, each is its share to 0.01 m²,
 * the cuts are parallel, and a reorder keeps every area.
 */

import {
  cutIntoSlices,
  DivisionError,
  isOrderOf,
  longestSide,
  polygonArea,
  quadIsSimple,
  randomOrder,
  swapped,
  type S70Point,
} from "@/lib/calculation/geometry";

const SAMPLE: S70Point[] = [
  { north: 321015.423, east: 572425.587 },
  { north: 322135.856, east: 573339.077 },
  { north: 321372.274, east: 574609.524 },
  { north: 320175.1, east: 572897.684 },
];
const SAMPLE_SHARES = [0.2433, 0.2566, 0.15, 0.35];

/** #18.10's old sample: 25 m × 265 m, almost a rectangle. */
const NEAR_RECTANGLE: S70Point[] = [
  { north: 321839.5, east: 578826.01 },
  { north: 321863.241, east: 578810.34 },
  { north: 321986.114, east: 579044.036 },
  { north: 321963.18, east: 579061.26 },
];

/** Shoelace in exact-ish arithmetic, independent of the module's own frame. */
function referenceArea(poly: S70Point[]): number {
  const n0 = poly[0].north;
  const e0 = poly[0].east;
  let a = 0;
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length];
    a += (p.east - e0) * (q.north - n0) - (q.east - e0) * (p.north - n0);
  });
  return Math.abs(a) / 2;
}

/** The shared edge between slice k and k+1: the vertices both polygons carry. */
function cutDirection(a: S70Point[], b: S70Point[]): { east: number; north: number } {
  const near = (p: S70Point, q: S70Point) => Math.hypot(p.north - q.north, p.east - q.east) < 1e-6;
  const shared = a.filter((p) => b.some((q) => near(p, q)));
  expect(shared).toHaveLength(2);
  const [p, q] = shared;
  const len = Math.hypot(q.east - p.east, q.north - p.north);
  const d = { east: (q.east - p.east) / len, north: (q.north - p.north) / len };
  return d.east < 0 || (d.east === 0 && d.north < 0) ? { east: -d.east, north: -d.north } : d;
}

describe.each([
  ["the request's sample", SAMPLE, SAMPLE_SHARES],
  ["a near-rectangle", NEAR_RECTANGLE, [0.3333, 0.3333, 0.3334]],
])("%s", (_what, corners, shares) => {
  const result = cutIntoSlices(corners, shares);

  it("the parcel's area is the shoelace's", () => {
    expect(result.parcelArea).toBeCloseTo(referenceArea(corners), 4);
    expect(polygonArea(corners)).toBeCloseTo(referenceArea(corners), 4);
  });

  it("the slices sum to the parcel", () => {
    const sum = result.slices.reduce((s, x) => s + x.area, 0);
    expect(Math.abs(sum - result.parcelArea)).toBeLessThan(0.01);
  });

  it("each slice is its share to 0.01 m², measured on its own polygon", () => {
    result.slices.forEach((s, k) => {
      expect(Math.abs(referenceArea(s.polygon) - s.area)).toBeLessThan(0.001);
      if (k < shares.length - 1) expect(Math.abs(s.area - shares[k] * result.parcelArea)).toBeLessThan(0.01);
    });
  });

  it("the cuts are parallel, and perpendicular to the longest side", () => {
    const dirs = result.slices.slice(0, -1).map((s, k) => cutDirection(s.polygon, result.slices[k + 1].polygon));
    for (const d of dirs) {
      expect(Math.abs(d.east * dirs[0].north - d.north * dirs[0].east)).toBeLessThan(1e-9);
      expect(Math.abs(d.east * result.axis.east + d.north * result.axis.north)).toBeLessThan(1e-9);
    }
    const i = longestSide(corners);
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    const len = Math.hypot(b.east - a.east, b.north - a.north);
    expect(result.axis.east).toBeCloseTo((b.east - a.east) / len, 12);
    expect(result.axis.north).toBeCloseTo((b.north - a.north) / len, 12);
  });

  it("a reorder keeps every area, and moves the cuts", () => {
    const reversed = cutIntoSlices(corners, shares.slice().reverse());
    reversed.slices.forEach((s, k) => {
      const j = shares.length - 1 - k;
      if (k < shares.length - 1) expect(Math.abs(s.area - shares[j] * result.parcelArea)).toBeLessThan(0.01);
    });
    expect(reversed.slices[0].polygon).not.toEqual(result.slices[0].polygon);
  });
});

describe("the remainder", () => {
  it("at 99.99% the last slice takes the missing 0.01%", () => {
    const r = cutIntoSlices(SAMPLE, SAMPLE_SHARES);
    const last = r.slices[3];
    expect(last.targetArea).toBeCloseTo(0.35 * r.parcelArea, 6);
    expect(Math.abs(last.area - 0.3501 * r.parcelArea)).toBeLessThan(0.01);
  });

  it("a swap keeps every slice's area, the last one's remainder included", () => {
    const order = [0, 1, 2, 3];
    const swappedOrder = swapped(order, 0, 2);
    expect(swappedOrder).toEqual([2, 1, 0, 3]);
    const before = cutIntoSlices(SAMPLE, order.map((k) => SAMPLE_SHARES[k]));
    const after = cutIntoSlices(SAMPLE, swappedOrder.map((k) => SAMPLE_SHARES[k]));
    swappedOrder.forEach((owner, pos) => {
      const was = order.indexOf(owner);
      expect(Math.abs(after.slices[pos].area - before.slices[was].area)).toBeLessThan(0.01);
    });
  });
});

describe("refusals", () => {
  it("a bow tie is not a quadrilateral", () => {
    const bowTie = [SAMPLE[0], SAMPLE[2], SAMPLE[1], SAMPLE[3]];
    expect(quadIsSimple(SAMPLE)).toBe(true);
    expect(quadIsSimple(bowTie)).toBe(false);
    expect(() => cutIntoSlices(bowTie, [0.5, 0.5])).toThrow(DivisionError);
  });

  it("one share, or a share of 0", () => {
    expect(() => cutIntoSlices(SAMPLE, [1])).toThrow(DivisionError);
    expect(() => cutIntoSlices(SAMPLE, [0.5, 0, 0.5])).toThrow(DivisionError);
  });
});

describe("the order", () => {
  it("a random order is a permutation, and follows the generator it is given", () => {
    let seed = 7;
    const rng = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const order = randomOrder(6, rng);
    expect(isOrderOf(order, 6)).toBe(true);
    expect(randomOrder(4, () => 0)).toEqual([1, 2, 3, 0]);
  });

  it.each([
    [[0, 1, 2], 3, true],
    [[2, 0, 1], 3, true],
    [[0, 1], 3, false],
    [[0, 0, 1], 3, false],
    [[0, 1, 3], 3, false],
    [[0, 1.5, 2], 3, false],
    ["0,1,2", 3, false],
  ])("%j is an order of %i: %s", (order, n, ok) => {
    expect(isOrderOf(order, n)).toBe(ok);
  });
});
