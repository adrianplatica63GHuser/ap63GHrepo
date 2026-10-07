/**
 * „Calcul drum lateral" — the road, and the slices turned to meet it (#38.24)
 *
 * Pure module. Every corner with each of its two sides, on the request's
 * sample and on a near-rectangle, in two orders: the road's width is exact,
 * its sides parallel and its cap square; every border is perpendicular to the
 * road; every owner but the last touches it; own slice + road share =
 * share × parcel to 0.01 m²; and everything sums to the parcel.
 */

import {
  cutWithRoad,
  RoadRefused,
  sideEnds,
  type RoadSide,
  type S70Point,
} from "@/lib/calculation/geometry";

const SAMPLE: S70Point[] = [
  { north: 321015.423, east: 572425.587 },
  { north: 322135.856, east: 573339.077 },
  { north: 321372.274, east: 574609.524 },
  { north: 320175.1, east: 572897.684 },
];
/** The request's shares, the last taking the 0.01% (#38.23's Ask first 3). */
const SAMPLE_SHARES = [0.2433, 0.2566, 0.15, 0.3501];

/** 25 m × 265 m, almost a rectangle (#18.10's sample). */
const NEAR_RECTANGLE: S70Point[] = [
  { north: 321839.5, east: 578826.01 },
  { north: 321863.241, east: 578810.34 },
  { north: 321986.114, east: 579044.036 },
  { north: 321963.18, east: 579061.26 },
];
const NEAR_SHARES = [0.3333, 0.3333, 0.3334];

type V = { e: number; n: number };
const sub = (a: S70Point, b: S70Point): V => ({ e: a.east - b.east, n: a.north - b.north });
const dot = (a: V, b: V) => a.e * b.e + a.n * b.n;
const len = (a: V) => Math.hypot(a.e, a.n);

function shoelace(poly: S70Point[]): number {
  const o = poly[0];
  let s = 0;
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length];
    s += (p.east - o.east) * (q.north - o.north) - (q.east - o.east) * (p.north - o.north);
  });
  return Math.abs(s) / 2;
}

/** Distance from p to the line through a with unit direction d. */
function off(p: S70Point, a: S70Point, d: V): number {
  const r = sub(p, a);
  return Math.abs(r.e * d.n - r.n * d.e);
}

const CASES: [string, S70Point[], number[], number][] = [];
for (const [name, corners, shares] of [
  ["the sample", SAMPLE, SAMPLE_SHARES],
  ["a near-rectangle", NEAR_RECTANGLE, NEAR_SHARES],
] as const) {
  for (let c = 0; c < 4; c++) CASES.push([name, corners as S70Point[], shares as number[], c]);
}

describe.each(CASES)("%s, corner %i", (_name, corners, shares, corner) => {
  describe.each([["next"], ["previous"]] as [RoadSide][])("along the %s side", (side) => {
    for (const order of [shares, shares.slice().reverse()]) {
      const tag = order === shares ? "in file order" : "reversed";
      let result: ReturnType<typeof cutWithRoad> | null = null;
      let refused: RoadRefused | null = null;
      try {
        result = cutWithRoad(corners, order, { corner, side, width: 7 });
      } catch (e) {
        if (e instanceof RoadRefused) refused = e;
        else throw e;
      }

      const [ci, ei] = sideEnds(4, corner, side);
      const sideLength = Math.hypot(corners[ei].east - corners[ci].east, corners[ei].north - corners[ci].north);
      // Every side of the sample is long enough. The near-rectangle's short
      // sides (25–29 m) are not: owners cut square to a 28 m road cannot all
      // reach it, so those are refused — with a reason, never drawn wrong.
      const buildable = sideLength > 100;

      it(`${tag}: ${buildable ? "built" : "refused, with a reason"}`, () => {
        if (buildable) expect(refused?.refusal ?? null).toBe(null);
        else expect(["roadTooLong", "ownerMissesRoad"]).toContain(refused?.refusal.code);
      });
      if (!result) continue;
      const r = result;
      const C = corners[ci];
      const d0 = sub(corners[ei], C);
      const d = { e: d0.e / len(d0), n: d0.n / len(d0) };

      it(`${tag}: the road is 7 m wide, on the side, and squared off at its far end`, () => {
        const offs = r.road.polygon.map((p) => off(p, C, d));
        expect(Math.min(...offs)).toBeLessThan(1e-6);
        expect(Math.abs(Math.max(...offs) - 7)).toBeLessThan(1e-6);
        // Every vertex on one of its two long sides, except where the start end meets the parcel.
        for (const o of offs) expect(Math.abs(o) < 1e-6 || Math.abs(o - 7) < 1e-6).toBe(true);
        // The cap: two vertices at u = L, one on each side.
        const atCap = r.road.polygon.filter((p) => Math.abs(dot(sub(p, C), d) - r.road.length) < 1e-6);
        expect(atCap).toHaveLength(2);
        expect(r.road.length).toBeLessThanOrEqual(len(d0) + 1e-6);
      });

      it(`${tag}: every border is perpendicular to the road, and every owner but the last touches it`, () => {
        r.slices.slice(0, -1).forEach((s, k) => {
          // The far border: the vertices at the slice's largest u.
          const us = s.polygon.map((p) => dot(sub(p, C), d));
          const far = Math.max(...us);
          const onBorder = s.polygon.filter((p) => Math.abs(dot(sub(p, C), d) - far) < 1e-6);
          expect(onBorder.length).toBeGreaterThanOrEqual(2);
          // Touches the road: two of its vertices 7 m off the side, apart along it.
          const onRoad = s.polygon.filter((p) => Math.abs(off(p, C, d) - 7) < 1e-6).map((p) => dot(sub(p, C), d));
          expect(Math.max(...onRoad) - Math.min(...onRoad)).toBeGreaterThan(0.01);
          if (k === r.slices.length - 2) expect(Math.abs(far - r.road.length)).toBeLessThan(1e-6);
        });
      });

      it(`${tag}: own slice + road share = share × parcel, to 0.01 m²; the whole sums to the parcel`, () => {
        for (const s of r.slices) {
          expect(Math.abs(shoelace(s.polygon) - s.area)).toBeLessThan(0.001);
          expect(Math.abs(s.area + s.roadShare - s.originalArea)).toBeLessThan(0.01);
        }
        const total = r.slices.reduce((t, s) => t + s.area, 0) + r.road.area;
        expect(Math.abs(total - r.parcelArea)).toBeLessThan(0.01);
        expect(Math.abs(shoelace(r.road.polygon) - r.road.area)).toBeLessThan(0.001);
      });
    }
  });
});

describe("refusals", () => {
  it("a road wider than the parcel leaves no room for the owners", () => {
    expect(() => cutWithRoad(NEAR_RECTANGLE, NEAR_SHARES, { corner: 0, side: "previous", width: 30 })).toThrow(RoadRefused);
  });
  it("a road along a short side that the owners would need more of than it has", () => {
    let code = "";
    try {
      cutWithRoad(NEAR_RECTANGLE, NEAR_SHARES, { corner: 0, side: "next", width: 7 });
    } catch (e) {
      if (e instanceof RoadRefused) code = e.refusal.code;
    }
    expect(["roadTooLong", "roadLeavesParcel", "ownerMissesRoad"]).toContain(code);
  });
});
