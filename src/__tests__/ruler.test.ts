/**
 * Unit tests for the Properties-Map ruler helpers (Slice #18.14.ruler).
 *
 * All pure functions — no DB / React. Covers the 3x3 solver, the local affine
 * WGS84 -> Stereo 70 fit + apply, planar/ruler distance, 1 cm formatting, and
 * pixel-radius corner snapping.
 */

import {
  solve3x3,
  fitAffine,
  applyAffine,
  planarDistanceM,
  rulerDistanceM,
  formatMeters,
  nearestCornerWithinPx,
  type AffineSample,
} from "@/lib/geo/ruler";

// A synthetic-but-realistic local transform around the project area
// (Bragadiru, ~44.37 N, 25.98 E). Magnitudes mirror Stereo 70 metres.
const REF_LAT = 44.37;
const REF_LON = 25.98;
function trueNorth(lat: number, lon: number): number {
  return 111_000 * (lat - REF_LAT) + 2 * (lon - REF_LON) + 320_000;
}
function trueEast(lat: number, lon: number): number {
  return 1 * (lat - REF_LAT) + 78_000 * (lon - REF_LON) + 580_000;
}
function sampleAt(lat: number, lon: number): AffineSample {
  return { lat, lon, north: trueNorth(lat, lon), east: trueEast(lat, lon) };
}

describe("solve3x3", () => {
  it("solves a simple system", () => {
    // x + y + z = 6 ; 2y + 5z = -4 ; 2x + 5y - z = 27  -> x=5, y=3, z=-2
    const x = solve3x3(
      [
        [1, 1, 1],
        [0, 2, 5],
        [2, 5, -1],
      ],
      [6, -4, 27],
    );
    expect(x).not.toBeNull();
    expect(x![0]).toBeCloseTo(5, 9);
    expect(x![1]).toBeCloseTo(3, 9);
    expect(x![2]).toBeCloseTo(-2, 9);
  });

  it("returns null for a singular matrix", () => {
    expect(
      solve3x3(
        [
          [1, 2, 3],
          [2, 4, 6], // 2x row 0 — linearly dependent
          [1, 0, 1],
        ],
        [1, 2, 3],
      ),
    ).toBeNull();
  });
});

describe("fitAffine / applyAffine", () => {
  it("recovers a known affine transform from 3 well-spread samples", () => {
    const samples = [
      sampleAt(REF_LAT, REF_LON),
      sampleAt(REF_LAT + 0.01, REF_LON),
      sampleAt(REF_LAT, REF_LON + 0.01),
    ];
    const aff = fitAffine(samples);
    expect(aff).not.toBeNull();

    // Apply to a fresh point and compare to the ground truth.
    const p = { lat: REF_LAT + 0.004, lon: REF_LON + 0.007 };
    const got = applyAffine(aff!, p);
    expect(got.north).toBeCloseTo(trueNorth(p.lat, p.lon), 4);
    expect(got.east).toBeCloseTo(trueEast(p.lat, p.lon), 4);
  });

  it("is robust with more than 3 samples (least squares)", () => {
    const samples = [
      sampleAt(REF_LAT, REF_LON),
      sampleAt(REF_LAT + 0.01, REF_LON),
      sampleAt(REF_LAT, REF_LON + 0.01),
      sampleAt(REF_LAT + 0.008, REF_LON + 0.006),
    ];
    const aff = fitAffine(samples);
    expect(aff).not.toBeNull();
    const p = { lat: REF_LAT + 0.002, lon: REF_LON + 0.009 };
    const got = applyAffine(aff!, p);
    expect(got.north).toBeCloseTo(trueNorth(p.lat, p.lon), 3);
    expect(got.east).toBeCloseTo(trueEast(p.lat, p.lon), 3);
  });

  it("returns null for fewer than 3 samples", () => {
    expect(fitAffine([])).toBeNull();
    expect(fitAffine([sampleAt(REF_LAT, REF_LON)])).toBeNull();
    expect(
      fitAffine([sampleAt(REF_LAT, REF_LON), sampleAt(REF_LAT + 0.01, REF_LON)]),
    ).toBeNull();
  });

  it("returns null for collinear samples", () => {
    const collinear = [
      sampleAt(REF_LAT, REF_LON),
      sampleAt(REF_LAT + 0.01, REF_LON + 0.01),
      sampleAt(REF_LAT + 0.02, REF_LON + 0.02),
    ];
    expect(fitAffine(collinear)).toBeNull();
  });
});

describe("planarDistanceM", () => {
  it("computes a 3-4-5 distance", () => {
    expect(
      planarDistanceM({ north: 0, east: 0 }, { north: 4, east: 3 }),
    ).toBeCloseTo(5, 9);
  });

  it("is zero for identical points", () => {
    expect(
      planarDistanceM({ north: 100, east: 200 }, { north: 100, east: 200 }),
    ).toBe(0);
  });
});

describe("rulerDistanceM", () => {
  it("measures true ground distance under the fitted transform", () => {
    const aff = fitAffine([
      sampleAt(REF_LAT, REF_LON),
      sampleAt(REF_LAT + 0.01, REF_LON),
      sampleAt(REF_LAT, REF_LON + 0.01),
    ])!;
    const a = { lat: REF_LAT, lon: REF_LON };
    const b = { lat: REF_LAT + 0.001, lon: REF_LON };
    // North scale is 111 000 m/deg, so 0.001 deg of latitude ≈ 111 m.
    expect(rulerDistanceM(aff, a, b)).toBeCloseTo(111, 2);
  });
});

describe("formatMeters", () => {
  it("renders 1 cm precision with a unit", () => {
    expect(formatMeters(12.3)).toBe("12.30 m");
    expect(formatMeters(5.678)).toBe("5.68 m"); // third decimal 7 rounds up
    expect(formatMeters(0)).toBe("0.00 m");
    expect(formatMeters(1234.5)).toBe("1234.50 m");
  });

  it("guards non-finite / negative input", () => {
    expect(formatMeters(NaN)).toBe("0.00 m");
    expect(formatMeters(-5)).toBe("0.00 m");
    expect(formatMeters(Infinity)).toBe("0.00 m");
  });
});

describe("nearestCornerWithinPx", () => {
  const corners = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 50, y: 50 },
  ];

  it("returns the nearest corner within the threshold", () => {
    expect(nearestCornerWithinPx({ x: 4, y: 3 }, corners, 12)).toBe(0);
    expect(nearestCornerWithinPx({ x: 96, y: 0 }, corners, 12)).toBe(1);
  });

  it("returns null when no corner is within the threshold", () => {
    expect(nearestCornerWithinPx({ x: 25, y: 25 }, corners, 12)).toBeNull();
  });

  it("picks the lowest index on an exact tie", () => {
    // Equidistant from corner 0 (0,0) and corner 1 (100,0) at x=50.
    const twoCorners = [
      { x: 0, y: 0 },
      { x: 8, y: 0 },
    ];
    expect(nearestCornerWithinPx({ x: 4, y: 0 }, twoCorners, 12)).toBe(0);
  });

  it("uses SNAP_PX by default", () => {
    expect(nearestCornerWithinPx({ x: 10, y: 0 }, corners)).toBe(0); // 10 <= 12
    expect(nearestCornerWithinPx({ x: 13, y: 0 }, corners)).toBeNull(); // 13 > 12
  });
});
