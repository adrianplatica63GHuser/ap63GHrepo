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
    declaredOrientation: "HORIZONTAL",
    roadCorner: "SW",
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
    expect(result.roadLength).toBeCloseTo(189.39, 0);
    expect(result.roadArea).toBeCloseTo(1328.14, 0);
  });

  it("makes the last owner border a perpendicular straight extension of the road cap", () => {
    // Every inter-owner border is perpendicular to the road; the border between
    // owner N-1 and owner N coincides with the road's perpendicular end cap, so
    // owner N is a clean quad (not a slanted pentagon).
    const ownerN = result.owners[result.owners.length - 1];
    expect(ownerN.polygon.length).toBe(4);
  });

  it("ends the road with a right-angle (perpendicular) cap", () => {
    // IMPORTANT invariant (Slice #18.10.diviz): the road's end side where it
    // meets owner N is perpendicular to the road's long sides. The OTHER end (the
    // start corner) just follows the polygon's slanted side. So exactly one of
    // the two short edges is perpendicular — assert the minimum is ~0. Keep this.
    const road = result.roadPolygon;
    expect(road.length).toBe(4); // clean strip

    const n = road.length;
    const edges = road.map((_, i) => {
      const a = road[i];
      const b = road[(i + 1) % n];
      return {
        dx: b.east - a.east,
        dy: b.north - a.north,
        len: Math.hypot(b.east - a.east, b.north - a.north),
      };
    });
    const longest = edges.reduce((a, b) => (b.len > a.len ? b : a));
    const dir = { x: longest.dx / longest.len, y: longest.dy / longest.len };
    const shorts = [...edges].sort((a, b) => a.len - b.len).slice(0, 2);
    // Perpendicular ⇒ the cap edge's component along the road direction is ~0.
    const capDot = Math.min(
      ...shorts.map((e) => Math.abs((e.dx * dir.x + e.dy * dir.y) / e.len)),
    );
    expect(capDot).toBeLessThan(0.02); // < ~1.1° off perpendicular
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
      // finalArea = fraction·(A_total − A_road) equals originalArea − roadParticipation
      // mathematically, but the two are computed in a different multiply/subtract
      // order, so compare at a tolerance that ignores float round-off.
      expect(o.finalArea).toBeCloseTo(o.originalArea - o.roadParticipation, 4);
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
    declaredOrientation: "HORIZONTAL",
    roadCorner: "SW",
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

describe("computeDivision — road corner (Section #4)", () => {
  const owners = [
    { name: "O1", fraction: 0.3333 },
    { name: "O2", fraction: 0.3333 },
    { name: "O3", fraction: 0.3333 },
  ];

  it("places owner 1 at the named start corner (SW)", () => {
    // The road shares the start corner (so the corner itself is on the common
    // road), and owner 1 — the first listed owner — sits right at it: owner 1 is
    // the owner nearest the Section-#4 corner.
    const SW = { north: 321839.5, east: 578826.01 }; // corner 101 of the sample
    const centroid = (poly: { north: number; east: number }[]) => {
      const n = poly.length;
      return {
        north: poly.reduce((s, p) => s + p.north, 0) / n,
        east: poly.reduce((s, p) => s + p.east, 0) / n,
      };
    };
    const distToSW = (poly: { north: number; east: number }[]) => {
      const c = centroid(poly);
      return Math.hypot(c.north - SW.north, c.east - SW.east);
    };

    const r = computeDivision({
      corners: SAMPLE_CORNERS,
      owners,
      declaredOrientation: "HORIZONTAL",
      roadCorner: "SW",
      roadWidth: 7,
    });
    const dists = r.owners.map((o) => distToSW(o.polygon));
    // Owner 1 (index 0) is the closest owner to the SW start corner.
    expect(Math.min(...dists)).toBe(dists[0]);

    // And with an EAST start corner (SE) owner 1 flips to the east end.
    const SE = { north: 321963.18, east: 579061.26 }; // corner 104
    const rSE = computeDivision({
      corners: SAMPLE_CORNERS,
      owners,
      declaredOrientation: "HORIZONTAL",
      roadCorner: "SE",
      roadWidth: 7,
    });
    const distsSE = rSE.owners.map((o) => {
      const c = centroid(o.polygon);
      return Math.hypot(c.north - SE.north, c.east - SE.east);
    });
    expect(Math.min(...distsSE)).toBe(distsSE[0]);
  });

  it("tiles and keeps a perpendicular cap for every start corner", () => {
    for (const corner of ["SW", "SE", "NW", "NE"] as const) {
      const r = computeDivision({
        corners: SAMPLE_CORNERS,
        owners,
        declaredOrientation: "HORIZONTAL",
        roadCorner: corner,
        roadWidth: 7,
      });
      expect(sumAreas(r.owners, r.roadArea)).toBeCloseTo(r.totalArea, 3);
      // Owners 1..N-1 get their exact final area regardless of which end starts.
      for (let i = 0; i < r.owners.length - 1; i++) {
        expect(r.owners[i].computedArea).toBeCloseTo(r.owners[i].finalArea, 1);
      }
      // The cap (one of the two short road edges) is perpendicular.
      const road = r.roadPolygon;
      const edges = road.map((_, i) => {
        const a = road[i];
        const b = road[(i + 1) % road.length];
        return { dx: b.east - a.east, dy: b.north - a.north, len: Math.hypot(b.east - a.east, b.north - a.north) };
      });
      const longest = edges.reduce((a, b) => (b.len > a.len ? b : a));
      const dir = { x: longest.dx / longest.len, y: longest.dy / longest.len };
      const shorts = [...edges].sort((a, b) => a.len - b.len).slice(0, 2);
      const capDot = Math.min(
        ...shorts.map((e) => Math.abs((e.dx * dir.x + e.dy * dir.y) / e.len)),
      );
      expect(capDot).toBeLessThan(0.02);
    }
  });
});

describe("computeDivision — guards", () => {
  it("rejects fewer than two owners", () => {
    expect(() =>
      computeDivision({
        corners: SAMPLE_CORNERS,
        owners: [{ name: "Solo", fraction: 1 }],
        declaredOrientation: "HORIZONTAL",
        roadCorner: "SW",
        roadWidth: 7,
      }),
    ).toThrow(DivisionError);
  });

  it("rejects an orientation mismatch (Section #2 disagrees with the coordinates)", () => {
    expect(() =>
      computeDivision({
        corners: SAMPLE_CORNERS, // actually horizontal
        owners: [
          { name: "A", fraction: 0.5 },
          { name: "B", fraction: 0.5 },
        ],
        declaredOrientation: "VERTICAL",
        roadCorner: "SW",
        roadWidth: 7,
      }),
    ).toThrow(DivisionError);
  });

});

describe("computeDivision — vertical polygon", () => {
  // A near-rectangular VERTICAL parcel: long sides ≈ N-S (~265 m), short sides
  // ≈ E-W (~28 m), slightly tilted. Long edges are the West/East sides.
  const VERTICAL_CORNERS = [
    { north: 320000, east: 575000 }, // SW
    { north: 320265, east: 575010 }, // NW
    { north: 320263, east: 575038 }, // NE
    { north: 319998, east: 575028 }, // SE
  ];
  const owners = [
    { name: "O1", fraction: 0.3333 },
    { name: "O2", fraction: 0.3333 },
    { name: "O3", fraction: 0.3333 },
  ];

  it("is detected as vertical", () => {
    const r = computeDivision({
      corners: VERTICAL_CORNERS,
      owners,
      declaredOrientation: "VERTICAL",
      roadCorner: "SW",
      roadWidth: 6,
    });
    expect(r.orientation).toBe("VERTICAL");
  });

  it("tiles, keeps a perpendicular cap and exact owner areas for every corner", () => {
    for (const corner of ["SW", "NW", "SE", "NE"] as const) {
      const r = computeDivision({
        corners: VERTICAL_CORNERS,
        owners,
        declaredOrientation: "VERTICAL",
        roadCorner: corner,
        roadWidth: 6,
      });
      expect(sumAreas(r.owners, r.roadArea)).toBeCloseTo(r.totalArea, 3);
      for (let i = 0; i < r.owners.length - 1; i++) {
        expect(r.owners[i].computedArea).toBeCloseTo(r.owners[i].finalArea, 1);
      }
      const road = r.roadPolygon;
      const edges = road.map((_, i) => {
        const a = road[i];
        const b = road[(i + 1) % road.length];
        return { dx: b.east - a.east, dy: b.north - a.north, len: Math.hypot(b.east - a.east, b.north - a.north) };
      });
      const longest = edges.reduce((a, b) => (b.len > a.len ? b : a));
      const dir = { x: longest.dx / longest.len, y: longest.dy / longest.len };
      const shorts = [...edges].sort((a, b) => a.len - b.len).slice(0, 2);
      const capDot = Math.min(
        ...shorts.map((e) => Math.abs((e.dx * dir.x + e.dy * dir.y) / e.len)),
      );
      expect(capDot).toBeLessThan(0.02);
    }
  });
});
