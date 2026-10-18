/**
 * „Calcul drum lateral", step 4 — what „Creează proprietățile" creates  (Slice #38.25; #39.79)
 *
 * planSideRoadCommit is the commit route without its writes. On the request's
 * sample parcel and owners (#38.23's file, as the checked input #39.79 builds
 * from a property and persons), for a road from every corner: one property per
 * owner, each naming its owner's person, and the road; every corner of a new
 * property that IS a parcel corner keeps its number, and no other corner has
 * one; the server's own computation is what counts — polygons in the body are
 * never read; and choices that do not fit the parcel are refused.
 */

import {
  CommitRequestInvalid,
  DEFAULT_ROAD_NICKNAME,
  originalIndexOf,
  planSideRoadCommit,
} from "@/lib/calculation/commit-plan";
import { RoadRejected } from "@/lib/calculation/compute";
import { DivisionError, type RoadSide } from "@/lib/calculation/geometry";
import type { SideRoadInput } from "@/lib/calculation/side-road-input";
import type { SideRoadSource } from "@/lib/calculation/side-road-source";

/** The request's sample (#38.23's side-road-sample.txt, retired with its parser in #39.79), as checked input. */
const CORNERS = [
  { number: "121", north: 321015.423, east: 572425.587 },
  { number: "122", north: 322135.856, east: 573339.077 },
  { number: "123", north: 321372.274, east: 574609.524 },
  { number: "124", north: 320175.1, east: 572897.684 },
];
const OWNERS = [
  { personId: "p-alfa", name: "TC-Alfa", percent: 24.33 },
  { personId: "p-beta", name: "TC-Beta", percent: 25.66 },
  { personId: "p-gama", name: "TC-Gama", percent: 15 },
  { personId: "p-delta", name: "TC-Delta", percent: 35 },
];
const INPUT: SideRoadInput = { corners: CORNERS, owners: OWNERS, roadWidth: 7, percentTotal: 99.99 };
const SOURCE: SideRoadSource = {
  source: "property",
  propertyId: "prop-1",
  propertyCode: "PROP00123",
  corners: CORNERS,
  owners: OWNERS.map((o, i) => ({ personId: o.personId, name: o.name, code: `PPERS0000${i + 1}`, type: "NATURAL" as const, share: o.percent })),
  width: 7,
};
const RESOLVED = { input: INPUT, source: SOURCE };
const NUMBERS = [121, 122, 123, 124];
const ORDER = [3, 1, 0, 2];

/** A body for a road from `corner` along `side`. */
const body = (corner: number, side: RoadSide, extra: Record<string, unknown> = {}) => ({
  propertyId: "prop-1",
  order: ORDER,
  road: { corner, side },
  groupDescription: "TC grup",
  ...extra,
});

/** The first side of `corner` that builds a road with ORDER, as the screen would find it. */
function buildable(corner: number): RoadSide {
  for (const side of ["next", "previous"] as RoadSide[]) {
    try {
      planSideRoadCommit(RESOLVED, body(corner, side));
      return side;
    } catch (e) {
      if (!(e instanceof RoadRejected)) throw e;
    }
  }
  throw new Error(`no road from corner ${corner}`);
}

describe.each([0, 1, 2, 3])("a road from corner %i of the sample", (corner) => {
  const side = buildable(corner);
  const plan = planSideRoadCommit(RESOLVED, body(corner, side));

  it("plans one property per owner, in the order chosen, and the road, always", () => {
    expect(plan.properties.map((p) => p.role)).toEqual(["OWNER_PARCEL", "OWNER_PARCEL", "OWNER_PARCEL", "OWNER_PARCEL", "ROAD_PARCEL"]);
    expect(plan.properties.slice(0, 4).map((p) => p.nickname)).toEqual(["TC-Delta", "TC-Beta", "TC-Alfa", "TC-Gama"]);
    // #39.79, Ask first 3: each owner's property names its person, for the „Proprietar" link; the road names nobody.
    expect(plan.properties.map((p) => p.personId)).toEqual(["p-delta", "p-beta", "p-alfa", "p-gama", null]);
    expect(plan.properties[4].nickname).toBe(DEFAULT_ROAD_NICKNAME);
    const sum = plan.properties.reduce((s, p) => s + p.surfaceAreaMp, 0);
    expect(Math.abs(sum - plan.computation.parcelArea)).toBeLessThan(0.05);
  });

  it("keeps a parcel corner's number on every new corner that is one, and gives no other corner a number", () => {
    const parcel = plan.computation.corners;
    const numbered = new Set<number>();
    for (const p of plan.properties) {
      p.corners.forEach((c) => {
        const at = parcel.findIndex((q) => Math.abs(q.lat - c.lat) < 1e-9 && Math.abs(q.lon - c.lon) < 1e-9);
        if (c.originalIndex === null) {
          expect(at).toBe(-1);
        } else {
          expect(at).toBeGreaterThan(-1);
          expect(c.originalIndex).toBe(NUMBERS[at]);
          numbered.add(c.originalIndex);
        }
      });
    }
    expect([...numbered].sort()).toEqual(NUMBERS);
    // The road starts at the chosen corner, so it carries that corner's number.
    expect(plan.properties[4].corners.map((c) => c.originalIndex)).toContain(NUMBERS[corner]);
  });

  it("records what re-runs it: the property, the corners used, the owners, the width and the three choices (Ask first 6)", () => {
    expect(plan.inputParams).toEqual({
      ...SOURCE,
      order: ORDER,
      road: { corner, side },
      options: { groupDescription: "TC grup", roadNickname: DEFAULT_ROAD_NICKNAME },
    });
    expect(plan.computation.road?.corner).toBe(corner);
  });
});

describe("the server's computation is the only one that counts", () => {
  it("polygons, areas and names in the body are never read", () => {
    const side = buildable(0);
    const clean = planSideRoadCommit(RESOLVED, body(0, side));
    const forged = planSideRoadCommit(
      RESOLVED,
      body(0, side, {
        corners: [{ number: "1", north: 0, east: 0 }],
        owners: [{ personId: "x", share: "100" }],
        slices: [{ corners: [{ lat: 0, lon: 0 }], area: 1 }],
        properties: [{ nickname: "X", surfaceAreaMp: 1, corners: [] }],
        computation: { parcelArea: 1 },
      }),
    );
    expect(forged.properties).toEqual(clean.properties);
  });

  it("a road nickname given is used, trimmed; the group description is trimmed", () => {
    const plan = planSideRoadCommit(RESOLVED, body(0, buildable(0), { roadNickname: "  TC drum  ", groupDescription: "  TC g  " }));
    expect(plan.properties[4].nickname).toBe("TC drum");
    expect(plan.inputParams.options).toEqual({ groupDescription: "TC g", roadNickname: "TC drum" });
  });
});

describe("choices that do not fit the parcel are refused", () => {
  it.each([
    ["no group description", { groupDescription: "  " }],
    ["no order", { order: undefined }],
    ["no road", { road: undefined }],
  ])("%s", (_what, extra) => {
    expect(() => planSideRoadCommit(RESOLVED, body(0, "next", extra))).toThrow(CommitRequestInvalid);
  });

  it.each([
    ["an order of three for four owners", { order: [0, 1, 2] }],
    ["an owner twice", { order: [0, 0, 1, 2] }],
    ["a fifth corner", { road: { corner: 4, side: "next" } }],
    ["a side that is neither", { road: { corner: 0, side: "across" } }],
  ])("%s", (_what, extra) => {
    expect(() => planSideRoadCommit(RESOLVED, body(0, "next", extra))).toThrow(DivisionError);
  });

  it("a road that cannot be built", () => {
    // On the near-rectangle, a road along a 25 m end side cannot reach every owner.
    const narrow: SideRoadInput = {
      corners: [
        { number: "101", north: 321839.5, east: 578826.01 },
        { number: "102", north: 321863.241, east: 578810.34 },
        { number: "103", north: 321986.114, east: 579044.036 },
        { number: "104", north: 321963.18, east: 579061.26 },
      ],
      owners: [
        { personId: "a", name: "A", percent: 33.33 },
        { personId: "b", name: "B", percent: 33.33 },
        { personId: "c", name: "C", percent: 33.34 },
      ],
      roadWidth: 7,
      percentTotal: 100,
    };
    expect(() => planSideRoadCommit({ input: narrow, source: SOURCE }, { ...body(0, "next"), order: [0, 1, 2] })).toThrow(RoadRejected);
  });
});

describe("originalIndexOf", () => {
  it.each([
    ["121", 121],
    ["7", 7],
    ["121a", null],
    ["", null],
    [null, null],
    ["1234567890", null],
  ])("%s → %s", (n, expected) => {
    expect(originalIndexOf(n)).toBe(expected);
  });
});
