/**
 * Unit tests for the corner-geometry measurement (Slice #32.14).
 *
 * `computeCornerGeometry` is what both corner-write choke points call —
 * `createPropertyIn` sets the row from it, `updatePropertyIn` re-measures and
 * both sets AND CLEARS the flag from it — the clear direction needs no test of
 * its own, because it IS the simple-parcel case above: `updatePropertyIn`
 * writes whatever comes back, so a straighten-then-save clears the flag through
 * the same call that set it. It reads the real national grid file
 * through `wgs84ToStereo70`, so these are real projected coordinates rather
 * than planar fixtures; `process.cwd()` under Jest is the project root, which
 * is what makes the grid path resolve (same note as transdatRO.test.ts).
 *
 * ⚠️ WHAT THIS FILE CANNOT TEST, SAID PLAINLY. There is no database in this
 * suite, so it does not assert that `createPropertyIn` writes the column or
 * that `updatePropertyIn` clears it — it asserts the VALUE those two write,
 * from the same function they call, which is the whole of the decision they
 * make. The SQL either side of it is two `.set()` calls covered by the e2e run.
 */

import { computeCornerGeometry } from "@/lib/properties/corner-geometry";

/**
 * A 40 x 50 m rectangle near Clinceni, in WGS84 — 2000 m², the shape of
 * PROP01444's own declared surface. Listed anticlockwise, i.e. simple.
 *
 * Degrees per metre at this latitude: ~9.0e-6 lat, ~1.27e-5 lon.
 */
const SW = { lat: 44.370_000, lon: 25.960_000 };
const SE = { lat: 44.370_000, lon: 25.960_502 }; // ~40 m east
const NE = { lat: 44.370_450, lon: 25.960_502 }; // ~50 m north
const NW = { lat: 44.370_450, lon: 25.960_000 };

describe("computeCornerGeometry — a simple parcel", () => {
  it("measures an area and raises no marker", () => {
    const g = computeCornerGeometry([SW, SE, NE, NW]);

    expect(g.selfIntersects).toBe(false);
    expect(g.calculatedAreaMp).not.toBeNull();
    // Not asserted to the centimetre — the point is the order of magnitude the
    // parcel's papers would show, not the grid transformation's own accuracy,
    // which transdatRO.test.ts owns.
    expect(Number(g.calculatedAreaMp)).toBeGreaterThan(1800);
    expect(Number(g.calculatedAreaMp)).toBeLessThan(2200);
  });

  it("returns a 2 dp drizzle-numeric string, not a number", () => {
    const g = computeCornerGeometry([SW, SE, NE, NW]);
    expect(typeof g.calculatedAreaMp).toBe("string");
    expect(g.calculatedAreaMp).toMatch(/^\d+\.\d{2}$/);
  });
});

describe("computeCornerGeometry — PROP01444's shape", () => {
  // The same four corners in the order that broke it: 1, 2, 4, 3.
  const bowtie = [SW, SE, NW, NE];

  it("raises the marker", () => {
    expect(computeCornerGeometry(bowtie).selfIntersects).toBe(true);
  });

  it("still returns the area rather than refusing — the marker is what says it is meaningless", () => {
    // The bug was never that the number was missing. It was there, it was
    // 0.21 m², and nothing said why. #32.14 adds the saying, not a refusal.
    const g = computeCornerGeometry(bowtie);
    expect(g.calculatedAreaMp).not.toBeNull();
    expect(Number(g.calculatedAreaMp)).toBeLessThan(1);
  });
});

describe("computeCornerGeometry — nothing to measure", () => {
  it("is silent below 3 corners", () => {
    for (const corners of [[], [SW], [SW, SE]]) {
      expect(computeCornerGeometry(corners)).toEqual({
        calculatedAreaMp: null,
        selfIntersects: false,
      });
    }
  });

  it("never throws, and marks nothing, when the projection fails", () => {
    // ⚠️ BOTH CALLERS ARE INSIDE A SAVE. wgs84ToStereo70 throws outside the
    // grid's coverage, and a save must never be refused by a measurement.
    // Coordinates that cannot be projected also cannot support the claim that
    // their ORDER is wrong, so the marker is withheld rather than guessed.
    const offGrid = [
      { lat: 0, lon: 0 },
      { lat: 0, lon: 1 },
      { lat: 1, lon: 1 },
      { lat: 1, lon: 0 },
    ];
    let result;
    expect(() => {
      result = computeCornerGeometry(offGrid);
    }).not.toThrow();
    expect(result).toEqual({ calculatedAreaMp: null, selfIntersects: false });
  });
});
