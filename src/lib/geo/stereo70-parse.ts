/**
 * Shared Stereo 70 coordinate-line parser.
 *
 * Single source of truth for `isStereo` and `parseLine`.
 * Imported by both /api/properties/parse-text and /api/documents/[id]/process
 * so that bug-fixes and format extensions need to be made in only one place.
 *
 * Romanian geodetic convention (X = Northing, Y = Easting):
 *   X column → `northing`; Y column → `easting`
 * This is the OPPOSITE of GDAL/PostGIS axis order — see CLAUDE.md gotcha.
 */

// ---------------------------------------------------------------------------
// isStereo
// ---------------------------------------------------------------------------

/**
 * Returns true when `n` falls inside the valid Stereo 70 coordinate range
 * (100 000 – 999 999 inclusive) after discarding the fractional part.
 * Used to reject index tokens and other small numbers that appear in the
 * cadastral file format alongside the real coordinates.
 */
export function isStereo(n: number): boolean {
  const i = Math.floor(Math.abs(n));
  return i >= 100_000 && i <= 999_999;
}

// ---------------------------------------------------------------------------
// parseLine
// ---------------------------------------------------------------------------

/**
 * Parse a single data line from a Romanian cadastral coordinate text file.
 * Returns `{ northing, easting, originalIndex }` or `null` if the line does
 * not contain a recognisable Stereo 70 coordinate pair.
 *
 * Accepted delimiters: whitespace, comma, semicolon, pipe, or tab (any mix).
 * Decimal separator: dot or comma (both normalised to dot before parsing).
 *
 * Supported formats
 * -----------------
 * 3-column  <token0> <X [m]> <Y [m]>
 *   token0 is an arbitrary numeric label (< 1 000) that identifies this corner
 *   in the cadastral file.  It is captured as `originalIndex` so it survives
 *   later reordering of the corners array (Slice #15.17).  Corner order is
 *   determined purely by the ORDER OF LINES in the file, not by this value.
 *
 * 2-column  <X [m]> <Y [m]>
 *   No leading token.  Auto-detected when the first token is itself in the
 *   valid Stereo 70 range.  `originalIndex` is null for these corners.
 */
export function parseLine(
  line: string,
): { northing: number; easting: number; originalIndex: number | null } | null {
  const tokens = line
    .trim()
    .split(/[\s,;|\t]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (tokens.length < 2) return null;

  // ── 3-column: leading token (< 1 000) + X + Y ──────────────────────────
  // token[0] is the cadastral corner label; captured as originalIndex.
  // Corner ORDER is always determined by line order, not by this value.
  if (tokens.length >= 3) {
    const idx = parseFloat(tokens[0].replace(",", "."));
    if (Number.isFinite(idx) && idx < 1_000) {
      const northing = parseFloat(tokens[1].replace(",", "."));
      const easting  = parseFloat(tokens[2].replace(",", "."));
      if (
        !isNaN(northing) && isStereo(northing) &&
        !isNaN(easting)  && isStereo(easting)
      ) {
        return { northing, easting, originalIndex: idx };
      }
    }
  }

  // ── 2-column: first token is itself a Stereo 70 Northing ────────────────
  const firstNum = parseFloat(tokens[0].replace(",", "."));
  if (!isNaN(firstNum) && isStereo(firstNum)) {
    const secondNum = parseFloat(tokens[1].replace(",", "."));
    if (!isNaN(secondNum) && isStereo(secondNum)) {
      return { northing: firstNum, easting: secondNum, originalIndex: null };
    }
  }

  return null;
}
