/**
 * „Calcul drum lateral", step 4 — what „Creează proprietățile" creates  (Slice #38.25)
 *
 * planSideRoadCommit is the commit route without its writes. On the request's
 * sample, for a road from every corner: one property per owner and the road;
 * every corner of a new property that IS a parcel corner keeps the file's
 * number, and no other corner has one; the server's own computation is what
 * counts — polygons in the body are never read; and choices that do not fit
 * the file are refused.
 */

import { readFileSync } from "fs";
import { join } from "path";
import {
  CommitRequestInvalid,
  DEFAULT_ROAD_NICKNAME,
  originalIndexOf,
  planSideRoadCommit,
} from "@/lib/calculation/commit-plan";
import { RoadRejected } from "@/lib/calculation/compute";
import { DivisionError, type RoadSide } from "@/lib/calculation/geometry";
import { FileRejected } from "@/lib/calculation/parse";

const SAMPLE = readFileSync(join(__dirname, "..", "lib", "calculation", "side-road-sample.txt"), "utf8");
const NUMBERS = [121, 122, 123, 124];
const ORDER = [3, 1, 0, 2];

/** A body for a road from `corner` along `side`. */
const body = (corner: number, side: RoadSide, extra: Record<string, unknown> = {}) => ({
  text: SAMPLE,
  order: ORDER,
  road: { corner, side },
  groupDescription: "TC grup",
  ...extra,
});

/** The first side of `corner` that builds a road with ORDER, as the screen would find it. */
function buildable(corner: number): RoadSide {
  for (const side of ["next", "previous"] as RoadSide[]) {
    try {
      planSideRoadCommit(body(corner, side));
      return side;
    } catch (e) {
      if (!(e instanceof RoadRejected)) throw e;
    }
  }
  throw new Error(`no road from corner ${corner}`);
}

describe.each([0, 1, 2, 3])("a road from corner %i of the sample", (corner) => {
  const side = buildable(corner);
  const plan = planSideRoadCommit(body(corner, side));

  it("plans one property per owner, in the order chosen, and the road, always", () => {
    expect(plan.properties.map((p) => p.role)).toEqual(["OWNER_PARCEL", "OWNER_PARCEL", "OWNER_PARCEL", "OWNER_PARCEL", "ROAD_PARCEL"]);
    expect(plan.properties.slice(0, 4).map((p) => p.nickname)).toEqual(["TC-Delta", "TC-Beta", "TC-Alfa", "TC-Gama"]);
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

  it("records what re-runs it: the file and the three choices", () => {
    expect(plan.inputParams).toEqual({
      text: SAMPLE,
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
    const clean = planSideRoadCommit(body(0, side));
    const forged = planSideRoadCommit(
      body(0, side, {
        slices: [{ corners: [{ lat: 0, lon: 0 }], area: 1 }],
        properties: [{ nickname: "X", surfaceAreaMp: 1, corners: [] }],
        computation: { parcelArea: 1 },
      }),
    );
    expect(forged.properties).toEqual(clean.properties);
  });

  it("a road nickname given is used, trimmed; the group description is trimmed", () => {
    const plan = planSideRoadCommit(body(0, buildable(0), { roadNickname: "  TC drum  ", groupDescription: "  TC g  " }));
    expect(plan.properties[4].nickname).toBe("TC drum");
    expect(plan.inputParams.options).toEqual({ groupDescription: "TC g", roadNickname: "TC drum" });
  });
});

describe("choices that do not fit the file are refused", () => {
  it.each([
    ["no text", { text: "" }],
    ["no group description", { groupDescription: "  " }],
    ["no order", { order: undefined }],
    ["no road", { road: undefined }],
  ])("%s", (_what, extra) => {
    expect(() => planSideRoadCommit(body(0, "next", extra))).toThrow(CommitRequestInvalid);
  });

  it.each([
    ["an order of three for four owners", { order: [0, 1, 2] }],
    ["an owner twice", { order: [0, 0, 1, 2] }],
    ["a fifth corner", { road: { corner: 4, side: "next" } }],
    ["a side that is neither", { road: { corner: 0, side: "across" } }],
  ])("%s", (_what, extra) => {
    expect(() => planSideRoadCommit(body(0, "next", extra))).toThrow(DivisionError);
  });

  it("a road that cannot be built", () => {
    // On the near-rectangle, a road along a 25 m end side cannot reach every owner.
    const narrow = `Sectiunea de Colturi
101 321839.500 578826.010
102 321863.241 578810.340
103 321986.114 579044.036
104 321963.180 579061.260
Sectiunea de Proprietari
A 33,33%
B 33,33%
C 33,34%
Sectiunea de Latime Drum
7
`;
    expect(() => planSideRoadCommit({ ...body(0, "next"), text: narrow, order: [0, 1, 2] })).toThrow(RoadRejected);
  });

  it("a file the screen would have rejected", () => {
    expect(() => planSideRoadCommit({ ...body(0, "next"), text: SAMPLE.replace("15%", "14%") })).toThrow(FileRejected);
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
