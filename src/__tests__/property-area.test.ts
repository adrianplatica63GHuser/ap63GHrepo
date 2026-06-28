/**
 * Unit tests for the Property polygon-area helper (Slice #18.09).
 *
 * Pure function — no DB / React. Verifies the shoelace area over planar
 * Stereo 70 metres, including the <3-points null case and winding independence.
 */

import { shoelaceAreaM2, type PlanarPoint } from "@/lib/properties/area";

describe("shoelaceAreaM2", () => {
  it("returns null for fewer than 3 points", () => {
    expect(shoelaceAreaM2([])).toBeNull();
    expect(shoelaceAreaM2([{ north: 0, east: 0 }])).toBeNull();
    expect(
      shoelaceAreaM2([
        { north: 0, east: 0 },
        { north: 10, east: 0 },
      ]),
    ).toBeNull();
  });

  it("computes the area of a 10x10 metre square as 100 m²", () => {
    const square: PlanarPoint[] = [
      { east: 0, north: 0 },
      { east: 10, north: 0 },
      { east: 10, north: 10 },
      { east: 0, north: 10 },
    ];
    expect(shoelaceAreaM2(square)).toBeCloseTo(100, 6);
  });

  it("computes the area of a right triangle as base*height/2", () => {
    const triangle: PlanarPoint[] = [
      { east: 0, north: 0 },
      { east: 6, north: 0 },
      { east: 0, north: 8 },
    ];
    expect(shoelaceAreaM2(triangle)).toBeCloseTo(24, 6);
  });

  it("is winding-independent (CW and CCW give the same area)", () => {
    const ccw: PlanarPoint[] = [
      { east: 0, north: 0 },
      { east: 4, north: 0 },
      { east: 4, north: 4 },
      { east: 0, north: 4 },
    ];
    const cw = [...ccw].reverse();
    expect(shoelaceAreaM2(cw)).toBeCloseTo(shoelaceAreaM2(ccw)!, 6);
    expect(shoelaceAreaM2(cw)).toBeCloseTo(16, 6);
  });

  it("does not require the first point to be repeated at the end", () => {
    const open: PlanarPoint[] = [
      { east: 0, north: 0 },
      { east: 10, north: 0 },
      { east: 10, north: 5 },
      { east: 0, north: 5 },
    ];
    const closed: PlanarPoint[] = [...open, { east: 0, north: 0 }];
    // The closed form repeats the first vertex, which adds a zero-area segment.
    expect(shoelaceAreaM2(open)).toBeCloseTo(50, 6);
    expect(shoelaceAreaM2(closed)).toBeCloseTo(50, 6);
  });

  it("computes an L-shaped (non-convex) polygon correctly", () => {
    // L-shape: 3x3 square with a 1x1 bite removed from the top-right → 8 m².
    const lshape: PlanarPoint[] = [
      { east: 0, north: 0 },
      { east: 3, north: 0 },
      { east: 3, north: 2 },
      { east: 2, north: 2 },
      { east: 2, north: 3 },
      { east: 0, north: 3 },
    ];
    expect(shoelaceAreaM2(lshape)).toBeCloseTo(8, 6);
  });
});
