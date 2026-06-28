/**
 * Unit tests for the Diviz geometry core (Slice #18.10.diviz).
 *
 * Pure function — no DB / React. Numbers cross-checked against a standalone
 * reference implementation run on the same sample input.
 */

import {
  computeDivision,
  DivisionError,
  type DivisionInput,
} from "@/lib/calculation/geometry";

// The sample big polygon (Stereo 70 north/east) from Adrian's data file.
const SAMPLE_CORNERS = [
  { north: 321839.5, east: 578826.01 },
  { north: 321863.241, east: 578810.34 },
  { north: 321986.114, east: 579044.036 },
  { north: 321963.18, east: 579061.26 },
];

function sumAreas(owners: { computedArea: number }[], roadArea: number): number {
  return owners.reduce((s, o) => s + o.computedArea, 0) + roadArea;
}

describe("computeDivision — sample file", () => {
  const input: DivisionInput = {
    corners: SAMPLE_CORNERS,
    owners: [
      { name: "Platica", fraction: 0.33 },
      { name: "Prisecaru", fraction: 0.33 },
      { name: "Radoi", fraction: 0.33 },
    ],
    roadSide: "South",
    roadWidth: 7,
  };

  const result = computeDivision(input);

  it("detects a horizontal polygon", () => {
    expect(result.orientation).toBe("HORIZONTAL");
  });

  it("computes the total area (~7499.5 m²)", () => {
    expect(result.totalArea).toBeCloseTo(7499.54, 1);
  });

  it("identifies the long and short sides", () => {
    expect(result.lengthSide).toBeGreaterThan(result.widthSide);
    expect(result.lengthSide).toBeCloseTo(264.9, 0);
    expect(result.widthSide).toBeCloseTo(28.5, 0);
  });

  it("computes a road that fits within the polygon length", () => {
    expect(result.roadLength).toBeGreaterThan(0);
    expect(result.roadLength).toBeLessThan(result.lengthSide);
    expect(result.roadLength).toBeCloseTo(189.38, 0);
    expect(result.roadArea).toBeCloseTo(1327.87, 0);
  });

  it("gives owners 1..N-1 exactly their final area", () => {
    for (let i = 0; i < result.owners.length - 1; i++) {
      expect(result.owners[i].computedArea).toBeCloseTo(result.owners[i].finalArea, 1);
    }
  });

  it("lets owner N absorb the remainder (slightly more than its final area)", () => {
    const last = result.owners[result.owners.length - 1];
    // 33%*3 = 99% → last owner gets ~1% more than its nominal final area.
    expect(last.computedArea).toBeGreaterThan(last.finalArea);
  });

  it("tiles the whole polygon (owners + road = total)", () => {
    expect(sumAreas(result.owners, result.roadArea)).toBeCloseTo(result.totalArea, 3);
  });

  it("relates original / road participation / final areas correctly", () => {
    for (const o of result.owners) {
      expect(o.roadParticipation).toBeCloseTo(o.fraction * result.roadArea, 6);
      expect(o.finalArea).toBeCloseTo(o.originalArea - o.roadParticipation, 6);
    }
  });

  it("produces a valid polygon (>=3 corners) for every owner and the road", () => {
    for (const o of result.owners) expect(o.polygon.length).toBeGreaterThanOrEqual(3);
    expect(result.roadPolygon.length).toBeGreaterThanOrEqual(3);
  });
});

describe("computeDivision — perfect rectangle", () => {
  // 300 m (E-W) x 30 m (N-S) rectangle, three equal owners, road south, 6 m.
  const input: DivisionInput = {
    corners: [
      { north: 320000, east: 575000 },
      { north: 320000, east: 575300 },
      { north: 320030, east: 575300 },
      { north: 320030, east: 575000 },
    ],
    owners: [
      { name: "A", fraction: 1 / 3 },
      { name: "B", fraction: 1 / 3 },
      { name: "C", fraction: 1 / 3 },
    ],
    roadSide: "South",
    roadWidth: 6,
  };
  const result = computeDivision(input);

  it("has total area 9000 m² and is horizontal", () => {
    expect(result.orientation).toBe("HORIZONTAL");
    expect(result.totalArea).toBeCloseTo(9000, 3);
  });

  it("tiles exactly with equal fractions", () => {
    expect(sumAreas(result.owners, result.roadArea)).toBeCloseTo(9000, 3);
  });

  it("gives each of the first two owners their final area", () => {
    expect(result.owners[0].computedArea).toBeCloseTo(result.owners[0].finalArea, 2);
    expect(result.owners[1].computedArea).toBeCloseTo(result.owners[1].finalArea, 2);
  });
});

describe("computeDivision — guards", () => {
  it("rejects fewer than two owners", () => {
    expect(() =>
      computeDivision({
        corners: SAMPLE_CORNERS,
        owners: [{ name: "Solo", fraction: 1 }],
        roadSide: "South",
        roadWidth: 7,
      }),
    ).toThrow(DivisionError);
  });

  it("rejects a vertical polygon", () => {
    // 30 m (E-W) x 300 m (N-S) → long side runs N-S → vertical.
    expect(() =>
      computeDivision({
        corners: [
          { north: 320000, east: 575000 },
          { north: 320000, east: 575030 },
          { north: 320300, east: 575030 },
          { north: 320300, east: 575000 },
        ],
        owners: [
          { name: "A", fraction: 0.5 },
          { name: "B", fraction: 0.5 },
        ],
        roadSide: "South",
        roadWidth: 7,
      }),
    ).toThrow(DivisionError);
  });
});
