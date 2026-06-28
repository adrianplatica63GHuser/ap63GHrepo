/**
 * Unit tests for the Diviz 4-section file parser (Slice #18.10.diviz).
 *
 * Pure function — no DB / React. Uses the sample file shape supplied by Adrian.
 */

import { parseDivisionFile, ParseError } from "@/lib/calculation/parse";

const SAMPLE = `Section #1
101\t321839.500\t578826.010
102\t321863.241\t578810.340
103\t321986.114\t579044.036
104\t321963.180\t579061.260

Section #2
Owner1 Platica - 33%
Owner2 Prisecaru - 33%
Owner3 Radoi - 33%

Section #3
South

Section #4
7 m
`;

describe("parseDivisionFile", () => {
  it("parses the four sections of the sample file", () => {
    const parsed = parseDivisionFile(SAMPLE);

    expect(parsed.corners).toHaveLength(4);
    expect(parsed.corners[0]).toEqual({
      north: 321839.5,
      east: 578826.01,
      originalIndex: 101,
    });

    expect(parsed.owners).toHaveLength(3);
    expect(parsed.owners.map((o) => o.name)).toEqual([
      "Platica",
      "Prisecaru",
      "Radoi",
    ]);
    expect(parsed.owners[0].rawLabel).toBe("Owner1 Platica");
    expect(parsed.owners[0].percent).toBe(33);
    expect(parsed.owners[0].fraction).toBeCloseTo(0.33, 6);

    expect(parsed.roadSide).toBe("South");
    expect(parsed.roadWidth).toBe(7);
    expect(parsed.percentTotal).toBeCloseTo(99, 6);
  });

  it("accepts decimal percentages and comma-separated coordinates", () => {
    const text = `Section #1
1, 321839.500, 578826.010
2, 321863.241, 578810.340
3, 321986.114, 579044.036
4, 321963.180, 579061.260
Section #2
A - 33.33%
B - 33.33%
C - 33.34%
Section #3
Nord
Section #4
7,5 m`;
    const parsed = parseDivisionFile(text);
    expect(parsed.owners[0].percent).toBeCloseTo(33.33, 6);
    expect(parsed.percentTotal).toBeCloseTo(100, 6);
    expect(parsed.roadSide).toBe("North"); // "Nord" → North
    expect(parsed.roadWidth).toBeCloseTo(7.5, 6);
  });

  it("throws on a missing section", () => {
    const text = `Section #1
1 321839.500 578826.010
2 321863.241 578810.340
3 321986.114 579044.036
Section #2
A - 50%
B - 50%
Section #3
South`;
    expect(() => parseDivisionFile(text)).toThrow(ParseError);
  });

  it("throws when an owner line has no percentage", () => {
    const text = `Section #1
1 321839.500 578826.010
2 321863.241 578810.340
3 321986.114 579044.036
Section #2
A
B - 50%
Section #3
South
Section #4
7 m`;
    expect(() => parseDivisionFile(text)).toThrow(ParseError);
  });
});
