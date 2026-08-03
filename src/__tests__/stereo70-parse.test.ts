/**
 * Unit tests for src/lib/geo/stereo70-parse.ts
 *
 * This module is the single source of truth for reading a Romanian cadastral
 * coordinate line, shared by /api/properties/parse-text and
 * /api/documents/[id]/process. Both routes turn its output straight into
 * property corners, so a silent change in what it accepts or rejects is a
 * silent change in the geometry the whole app stores.
 *
 * The axis convention under test is the Romanian geodetic one — the file's
 * "X [m]" column is the NORTHING and "Y [m]" is the EASTING, the opposite of
 * GDAL/PostGIS order. See the axis-order gotcha in CLAUDE.md.
 */

import { isStereo, parseLine } from "@/lib/geo/stereo70-parse";

// ---------------------------------------------------------------------------
// isStereo
// ---------------------------------------------------------------------------

describe("isStereo", () => {
  it("accepts the six-digit Stereo 70 range", () => {
    expect(isStereo(100_000)).toBe(true);
    expect(isStereo(999_999)).toBe(true);
    // Real Bragadiru/Ilfov values from the project area.
    expect(isStereo(321_762.117)).toBe(true);
    expect(isStereo(584_000.25)).toBe(true);
  });

  it("compares on the integer part, so a fractional top end still passes", () => {
    expect(isStereo(999_999.9)).toBe(true);
  });

  it("rejects values outside the range", () => {
    expect(isStereo(99_999)).toBe(false);
    expect(isStereo(1_000_000)).toBe(false);
    // Corner index tokens are exactly what this guard exists to reject.
    expect(isStereo(1)).toBe(false);
    expect(isStereo(0)).toBe(false);
  });

  it("ignores sign (documents the Math.abs behaviour)", () => {
    // No Romanian Stereo 70 coordinate is negative, so this is a quirk rather
    // than a feature — pinned so a future sign-sensitive rewrite is a visible
    // decision rather than an accident.
    expect(isStereo(-321_762)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// parseLine — 3-column form (<index> <X> <Y>)
// ---------------------------------------------------------------------------

describe("parseLine — 3-column form", () => {
  it("reads index, northing and easting", () => {
    expect(parseLine("1 321762.117 584000.250")).toEqual({
      northing: 321_762.117,
      easting: 584_000.25,
      originalIndex: 1,
    });
  });

  it("maps the X column to northing and the Y column to easting", () => {
    // The whole point of the Romanian convention: the FIRST coordinate is the
    // Northing. Getting this backwards puts every property in the wrong place.
    const parsed = parseLine("1 321762.117 584000.250");
    expect(parsed?.northing).toBe(321_762.117);
    expect(parsed?.easting).toBe(584_000.25);
  });

  it("accepts every supported delimiter", () => {
    const expected = {
      northing: 321_762.117,
      easting: 584_000.25,
      originalIndex: 1,
    };
    expect(parseLine("1 321762.117 584000.250")).toEqual(expected);
    expect(parseLine("1\t321762.117\t584000.250")).toEqual(expected);
    expect(parseLine("1,321762.117,584000.250")).toEqual(expected);
    expect(parseLine("1;321762.117;584000.250")).toEqual(expected);
    expect(parseLine("1|321762.117|584000.250")).toEqual(expected);
  });

  it("tolerates leading, trailing and repeated whitespace", () => {
    expect(parseLine("  12   321762.117   584000.250  ")).toEqual({
      northing: 321_762.117,
      easting: 584_000.25,
      originalIndex: 12,
    });
  });

  it("captures originalIndex rather than using it for ordering", () => {
    // originalIndex survives a later reorder of the corners array (the bow-tie
    // fix, Slice #15.17); corner ORDER comes from line order, never from this.
    expect(parseLine("7 321762.117 584000.250")?.originalIndex).toBe(7);
    expect(parseLine("999 321762.117 584000.250")?.originalIndex).toBe(999);
  });

  it("rejects a leading token of 1000 or more", () => {
    // The "< 1 000" test is what separates an index token from a coordinate.
    expect(parseLine("1000 321762.117 584000.250")).toBeNull();
  });

  it("rejects a non-numeric leading token", () => {
    // An OCR label row ("SE A 321762.117 ...") must not parse as a corner.
    expect(parseLine("X 321762.117 584000.250")).toBeNull();
  });

  it("rejects coordinates outside the Stereo 70 range", () => {
    expect(parseLine("1 99999.0 584000.250")).toBeNull();
    expect(parseLine("1 321762.117 9999999.0")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseLine — 2-column form (<X> <Y>)
// ---------------------------------------------------------------------------

describe("parseLine — 2-column form", () => {
  it("reads a bare coordinate pair with a null index", () => {
    expect(parseLine("321762.117 584000.250")).toEqual({
      northing: 321_762.117,
      easting: 584_000.25,
      originalIndex: null,
    });
  });

  it("is selected when the first token is itself in Stereo 70 range", () => {
    expect(parseLine("321762.117,584000.250")?.originalIndex).toBeNull();
  });

  it("rejects a pair whose second value is out of range", () => {
    expect(parseLine("321762.117 250")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseLine — rejection cases
// ---------------------------------------------------------------------------

describe("parseLine — rejections", () => {
  it("returns null for blank and whitespace-only lines", () => {
    expect(parseLine("")).toBeNull();
    expect(parseLine("   ")).toBeNull();
    expect(parseLine("\t\t")).toBeNull();
  });

  it("returns null for a single token", () => {
    expect(parseLine("321762.117")).toBeNull();
  });

  it("returns null for a header row", () => {
    // Header rows are rejected by range checks, not by keyword filtering —
    // OCR sometimes merges a header into the first data row, and a keyword
    // filter would then discard real coordinates (CLAUDE.md OCR gotcha).
    expect(parseLine("Nr X[m] Y[m]")).toBeNull();
    expect(parseLine("Nr. Pct. Coordonate")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseLine — decimal separator
// ---------------------------------------------------------------------------

describe("parseLine — decimal separator", () => {
  it("accepts a dot decimal separator", () => {
    expect(parseLine("1 321762.117 584000.250")).not.toBeNull();
  });

  /**
   * A COMMA decimal separator does NOT work, despite what the module's header
   * comment claimed before Slice #23.03.Import.
   *
   * Comma is in the delimiter class, so "321762,117" is split into the two
   * tokens "321762" and "117" before the `.replace(",", ".")` normalisation is
   * ever reached — that replace only ever sees single tokens, which by then
   * cannot contain a comma. The result is a rejected line, not a misread one,
   * so the failure is safe (no wrong coordinate is stored) but total.
   *
   * This is pinned as current behaviour rather than fixed, because the two
   * readings genuinely conflict: "1,321762.117,584000.250" is a real
   * comma-DELIMITED row that parses correctly today, and teaching the parser
   * to read comma as a decimal point would break it. Resolving that needs a
   * per-file separator decision, which is its own slice.
   */
  it("does NOT accept a comma decimal separator (documented limitation)", () => {
    expect(parseLine("321762,117 584000,250")).toBeNull();
    expect(parseLine("1 321762,117 584000,250")).toBeNull();
  });

  it("still reads a comma-DELIMITED row correctly", () => {
    expect(parseLine("1,321762.117,584000.250")).toEqual({
      northing: 321_762.117,
      easting: 584_000.25,
      originalIndex: 1,
    });
  });
});

// ---------------------------------------------------------------------------
// parseLine — whole-file shape
// ---------------------------------------------------------------------------

describe("parseLine — driving a whole file", () => {
  it("keeps corner order as line order and skips unparseable lines", () => {
    const file = [
      "Nr. Pct.   X [m]        Y [m]",
      "1          321762.117   584000.250",
      "",
      "2          321800.000   584050.500",
      "-- comment --",
      "3          321850.250   584100.750",
    ];

    const corners = file
      .map((line) => parseLine(line))
      .filter((c): c is NonNullable<typeof c> => c !== null);

    expect(corners).toHaveLength(3);
    expect(corners.map((c) => c.originalIndex)).toEqual([1, 2, 3]);
    expect(corners[0].northing).toBe(321_762.117);
    expect(corners[2].easting).toBe(584_100.75);
  });
});
