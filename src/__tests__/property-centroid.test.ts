/**
 * Unit tests for the Property Street-View centroid helper (Slice #18.03b).
 *
 * Pure function — no DB / React. Verifies the arithmetic-mean centroid used to
 * position the Street View panel, including the no-corners null case.
 */

import {
  cornersCentroid,
  type Corner,
} from "@/app/properties/_components/form-schema";

describe("cornersCentroid", () => {
  it("returns null for an empty corner set", () => {
    expect(cornersCentroid([])).toBeNull();
  });

  it("returns the single corner unchanged for a one-corner set", () => {
    const corners: Corner[] = [{ lat: 44.37, lon: 25.98 }];
    expect(cornersCentroid(corners)).toEqual({ lat: 44.37, lon: 25.98 });
  });

  it("averages lat/lon across the corner set", () => {
    const corners: Corner[] = [
      { lat: 44.0, lon: 25.0 },
      { lat: 46.0, lon: 27.0 },
    ];
    expect(cornersCentroid(corners)).toEqual({ lat: 45.0, lon: 26.0 });
  });

  it("computes the centroid of a square as its centre", () => {
    const corners: Corner[] = [
      { lat: 44.0, lon: 25.0 },
      { lat: 44.0, lon: 26.0 },
      { lat: 45.0, lon: 26.0 },
      { lat: 45.0, lon: 25.0 },
    ];
    const c = cornersCentroid(corners);
    expect(c).not.toBeNull();
    expect(c!.lat).toBeCloseTo(44.5, 10);
    expect(c!.lon).toBeCloseTo(25.5, 10);
  });

  it("ignores originalIndex and only uses lat/lon", () => {
    const corners: Corner[] = [
      { lat: 10, lon: 20, originalIndex: 3 },
      { lat: 30, lon: 40, originalIndex: null },
    ];
    expect(cornersCentroid(corners)).toEqual({ lat: 20, lon: 30 });
  });
});
