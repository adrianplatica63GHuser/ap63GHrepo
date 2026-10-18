/**
 * @jest-environment node
 *
 * „Calcul drum lateral", step 1's checks — side-road-input.ts                       (Slice #39.79)
 *
 * The same function decides on the screen and on the server, so this suite is what both answer to: four corners (none
 * has its own message, Ask first 2), at least two different owners (Ask first 5), shares with at most two decimals and
 * a third refused rather than rounded (Ask first 8), a total of 100% or 99.99%, and a road over 0 and under 15 m. Every
 * problem at once, as codes.
 */

import {
  checkSideRoadInput,
  cornerLabels,
  cornerProblems,
  MAX_ROAD_WIDTH,
  parseWidth,
  shareHundredths,
  type DraftOwner,
  type InputCorner,
} from "@/lib/calculation/side-road-input";

/** TC-PROP-03's four corners (TC-CALC-01's parcel), three decimals, in their order. */
const FOUR: InputCorner[] = [
  { number: "16", north: 318693.706, east: 573578.558 },
  { number: "17", north: 318675.77, east: 573554.698 },
  { number: "18", north: 318659.521, east: 573567.196 },
  { number: "19", north: 318677.456, east: 573591.056 },
];
const owner = (id: string, share: string): DraftOwner => ({ personId: id, name: `TC ${id}`, share });
const THREE = [owner("A", "33,33"), owner("B", "33,33"), owner("C", "33,33")];
const codes = (r: ReturnType<typeof checkSideRoadInput>) => (r.ok ? [] : r.problems.map((p) => p.code));

describe("a share: a decimal comma or point, two decimals at most", () => {
  it.each([
    ["33,33", 3333],
    ["33.33", 3333],
    ["25", 2500],
    ["25,5", 2550],
    [" 15 ", 1500],
    ["100", 10000],
    ["0,01", 1],
  ])("%j → %i hundredths", (text, want) => {
    expect(shareHundredths(text)).toBe(want);
  });
  it.each([["33,333"], ["33.335"], ["0"], ["0,00"], ["100,01"], ["101"], ["-5"], ["33%"], ["a"], [""], ["1 000"], ["33,"]])(
    "%j is refused — a third decimal is never rounded",
    (text) => {
      expect(shareHundredths(text)).toBeNull();
    },
  );
});

describe("the road's width", () => {
  it.each([
    ["4", 4],
    ["4,5", 4.5],
    ["3.25", 3.25],
    ["14,99", 14.99],
  ])("%j → %d m", (text, want) => {
    expect(parseWidth(text)).toBe(want);
  });
  it.each([["4 m"], ["4,555"], ["x"], [""]])("%j is not a width", (text) => {
    expect(parseWidth(text)).toBeNull();
  });
  it("is under 15 m, exclusive", () => {
    expect(MAX_ROAD_WIDTH).toBe(15);
  });
});

describe("the corners: the property's own rows, in their order", () => {
  it("are labelled by their original index when every row has one and no two share it", () => {
    expect(cornerLabels([{ sequenceNo: 1, originalIndex: 16 }, { sequenceNo: 2, originalIndex: 17 }, { sequenceNo: 3, originalIndex: 18 }, { sequenceNo: 4, originalIndex: 19 }])).toEqual(["16", "17", "18", "19"]);
  });
  it("by their place otherwise — one missing, or two alike", () => {
    expect(cornerLabels([{ sequenceNo: 1, originalIndex: 16 }, { sequenceNo: 2, originalIndex: null }, { sequenceNo: 3, originalIndex: 18 }, { sequenceNo: 4, originalIndex: 19 }])).toEqual(["1", "2", "3", "4"]);
    expect(cornerLabels([{ sequenceNo: 1, originalIndex: 7 }, { sequenceNo: 2, originalIndex: 7 }, { sequenceNo: 3, originalIndex: 8 }, { sequenceNo: 4, originalIndex: 9 }])).toEqual(["1", "2", "3", "4"]);
  });
  it("none has a message of its own; not four counts them; four that cross are refused", () => {
    expect(cornerProblems([])).toEqual([{ code: "noCorners" }]);
    expect(cornerProblems(FOUR.slice(0, 3))).toEqual([{ code: "cornerCount", values: { count: 3 } }]);
    expect(cornerProblems([...FOUR, { number: "20", north: 318680, east: 573580 }])).toEqual([{ code: "cornerCount", values: { count: 5 } }]);
    expect(cornerProblems([FOUR[0]!, FOUR[2]!, FOUR[1]!, FOUR[3]!])).toEqual([{ code: "cornersCross" }]);
    expect(cornerProblems(FOUR)).toEqual([]);
  });
});

describe("checkSideRoadInput — the screen's and the server's one decision", () => {
  it("three owners at 33,33% and a 4 m road on four corners: the input, 99.99% in all", () => {
    const r = checkSideRoadInput({ corners: FOUR, owners: THREE, width: "4" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.percentTotal).toBe(99.99);
    expect(r.input.roadWidth).toBe(4);
    expect(r.input.owners).toEqual([
      { personId: "A", name: "TC A", percent: 33.33 },
      { personId: "B", name: "TC B", percent: 33.33 },
      { personId: "C", name: "TC C", percent: 33.33 },
    ]);
    expect(r.input.corners.map((c) => c.number)).toEqual(["16", "17", "18", "19"]);
  });

  it("100% is accepted too", () => {
    expect(checkSideRoadInput({ corners: FOUR, owners: [owner("A", "60"), owner("B", "40")], width: "3,5" }).ok).toBe(true);
  });

  it("98% is refused with its total", () => {
    const r = checkSideRoadInput({ corners: FOUR, owners: [owner("A", "33,33"), owner("B", "33,33"), owner("C", "31,34")], width: "4" });
    expect(r.ok ? [] : r.problems).toEqual([{ code: "percentTotal", values: { total: 98 } }]);
  });

  it("a third decimal is refused by name, and the total is not summed over it", () => {
    const r = checkSideRoadInput({ corners: FOUR, owners: [owner("A", "33,333"), owner("B", "33,33"), owner("C", "33,33")], width: "4" });
    expect(r.ok ? [] : r.problems).toEqual([{ code: "shareFormat", values: { name: "TC A", share: "33,333" } }]);
  });

  it("one owner is not enough; the same person twice is refused", () => {
    expect(codes(checkSideRoadInput({ corners: FOUR, owners: [owner("A", "100")], width: "4" }))).toEqual(["ownerCount"]);
    expect(codes(checkSideRoadInput({ corners: FOUR, owners: [owner("A", "50"), owner("A", "50")], width: "4" }))).toEqual(["repeatedOwner"]);
  });

  it.each([
    ["15", "roadWidth"],
    ["0", "roadWidth"],
    ["15,5", "roadWidth"],
    ["patru", "widthFormat"],
    ["", "widthFormat"],
  ])("a road of %j is refused (%s)", (width, code) => {
    expect(codes(checkSideRoadInput({ corners: FOUR, owners: THREE, width }))).toEqual([code]);
  });

  it("every problem at once", () => {
    const r = checkSideRoadInput({ corners: FOUR.slice(0, 3), owners: [owner("A", "33,333")], width: "15" });
    expect(codes(r)).toEqual(["cornerCount", "ownerCount", "shareFormat", "roadWidth"]);
  });

  it("no property chosen yet: never an input, and no corner problem to show", () => {
    const r = checkSideRoadInput({ corners: null, owners: THREE, width: "4" });
    expect(r.ok).toBe(false);
    expect(codes(r)).toEqual([]);
  });
});
