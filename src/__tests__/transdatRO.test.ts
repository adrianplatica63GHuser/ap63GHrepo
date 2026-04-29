/**
 * Tests for the coordinate conversion library (TransDatRO port).
 *
 * Covers:
 *  - DMS helpers (decimalToDMS, dmsToDecimal, formatDMS) — pure math, no grid
 *  - wgs84ToStereo70 + stereo70ToWgs84 — grid-corrected round-trip
 *
 * The .GRD grid file is read lazily on the first conversion call.
 * process.cwd() in Jest = project root, so the path resolves correctly.
 */

import {
  decimalToDMS,
  dmsToDecimal,
  formatDMS,
} from "@/lib/geo/dms";
import {
  wgs84ToStereo70,
  stereo70ToWgs84,
} from "@/lib/geo/transdatRO";

// ---------------------------------------------------------------------------
// DMS helpers
// ---------------------------------------------------------------------------

describe("decimalToDMS", () => {
  it("converts a positive latitude correctly", () => {
    const d = decimalToDMS(44.37, true);
    expect(d.deg).toBe(44);
    expect(d.min).toBe(22);
    expect(d.sec).toBeCloseTo(12.0, 3);
    expect(d.dir).toBe("N");
  });

  it("assigns S for negative latitude", () => {
    const d = decimalToDMS(-10.5, true);
    expect(d.dir).toBe("S");
    expect(d.deg).toBe(10);
    expect(d.min).toBe(30);
    expect(d.sec).toBeCloseTo(0, 5);
  });

  it("assigns E for positive longitude", () => {
    const d = decimalToDMS(25.98, false);
    expect(d.dir).toBe("E");
    expect(d.deg).toBe(25);
    expect(d.min).toBe(58);
    expect(d.sec).toBeCloseTo(48.0, 1);
  });

  it("assigns W for negative longitude", () => {
    expect(decimalToDMS(-73.935, false).dir).toBe("W");
  });

  it("handles 0° exactly", () => {
    const d = decimalToDMS(0, true);
    expect(d.deg).toBe(0);
    expect(d.min).toBe(0);
    expect(d.sec).toBeCloseTo(0, 5);
    // 0° latitude: dir is N (>= 0)
    expect(d.dir).toBe("N");
  });
});

describe("dmsToDecimal", () => {
  it("converts 44°22'12\" back to ~44.37°", () => {
    const dec = dmsToDecimal({ deg: 44, min: 22, sec: 12.0 });
    expect(dec).toBeCloseTo(44.37, 5);
  });

  it("converts 0°0'0\" to 0", () => {
    expect(dmsToDecimal({ deg: 0, min: 0, sec: 0 })).toBe(0);
  });

  it("is the inverse of decimalToDMS (round-trip)", () => {
    const original = 44.3754321;
    const dms = decimalToDMS(original, true);
    const back = dmsToDecimal(dms);
    expect(back).toBeCloseTo(original, 7);
  });
});

describe("formatDMS", () => {
  it("produces a correctly formatted latitude string", () => {
    const s = formatDMS(44.37, true);
    // e.g. "44°22'12.00\"N"
    expect(s).toMatch(/^44°22'/);
    expect(s).toMatch(/N$/);
  });

  it("produces a correctly formatted longitude string", () => {
    const s = formatDMS(25.98, false);
    expect(s).toMatch(/^25°58'/);
    expect(s).toMatch(/E$/);
  });

  it("uses W for negative longitude", () => {
    expect(formatDMS(-73.935, false)).toMatch(/W$/);
  });
});

// ---------------------------------------------------------------------------
// Stereo70 ↔ WGS84 conversion (grid-corrected)
// ---------------------------------------------------------------------------

// Tolerance for round-trip: 0.000001° ≈ 10 cm on the ground
const ROUND_TRIP_TOL = 1e-6;

describe("wgs84ToStereo70 / stereo70ToWgs84 round-trip", () => {
  // Points spread across Romania to exercise different grid cells.
  const wgs84Points = [
    { lat: 44.3754, lon: 25.9823, label: "Bragadiru 1"  },
    { lat: 44.3762, lon: 25.9840, label: "Bragadiru 2"  },
    { lat: 44.4268, lon: 26.1025, label: "Bucharest"    },
    { lat: 45.7489, lon: 21.2087, label: "Timișoara"    },
    { lat: 46.7712, lon: 23.6236, label: "Cluj-Napoca"  },
    { lat: 45.6582, lon: 25.6012, label: "Brașov"       },
    { lat: 47.0458, lon: 21.9189, label: "Oradea"       },
    { lat: 44.1598, lon: 28.6348, label: "Constanța"    },
  ];

  wgs84Points.forEach(({ lat, lon, label }) => {
    it(`round-trip WGS84 → Stereo70 → WGS84 for ${label}`, () => {
      const stereo = wgs84ToStereo70(lat, lon);
      // Stereo70 outputs should be in plausible Romanian range
      expect(stereo.north).toBeGreaterThan(100_000);
      expect(stereo.north).toBeLessThan(900_000);
      expect(stereo.east).toBeGreaterThan(100_000);
      expect(stereo.east).toBeLessThan(900_000);

      const back = stereo70ToWgs84(stereo.north, stereo.east);
      expect(back.lat).toBeCloseTo(lat, 6);
      expect(back.lon).toBeCloseTo(lon, 6);
    });
  });

  it("round-trip Stereo70 → WGS84 → Stereo70 (Bragadiru)", () => {
    const north = 332_500;
    const east  = 582_200;
    const wgs84 = stereo70ToWgs84(north, east);
    const back  = wgs84ToStereo70(wgs84.lat, wgs84.lon);
    expect(back.north).toBeCloseTo(north, 2); // within 1 cm
    expect(back.east).toBeCloseTo(east,  2);
  });
});

describe("wgs84ToStereo70 — boundary checks", () => {
  it("throws for a point clearly outside Romania (e.g. London)", () => {
    expect(() => wgs84ToStereo70(51.5074, -0.1278)).toThrow();
  });
});
