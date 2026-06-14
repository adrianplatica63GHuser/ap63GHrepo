/**
 * POST /api/properties/parse-text
 *
 * Accepts a multipart/form-data upload with a single `file` field (plain-text
 * file exported from a Romanian cadastral system).
 *
 * File format (auto-detected, any delimiter):
 *   3-column: <token0> <X [m]> <Y [m]>  — token0 is any number < 1 000 (ignored;
 *                                          corner order is determined by line order)
 *   2-column: <X [m]> <Y [m]>            — no leading token
 *   Lines that don't match either pattern are ignored automatically.
 *
 * GIS.13.11 clarification: in some cadastral exports the first column is an
 * arbitrary numeric label (< 1 000) that does NOT represent the corner's
 * sequential position.  The parser ignores it; corner 1 = first matching line,
 * corner 2 = second, etc.
 *
 * Column mapping (Romanian geodetic convention — X = Northing, Y = Easting):
 *   X [m] = Northing  → `north` arg of stereo70ToWgs84
 *   Y [m] = Easting   → `east`  arg of stereo70ToWgs84
 *
 * Note: this is the OPPOSITE of GDAL/PostGIS axis order (X=Easting, Y=Northing).
 * See the "Coordinate axis order" gotcha in CLAUDE.md.
 *
 * Response shape:
 *   { corners: { lat: number; lon: number }[] }
 *
 * An empty corners array means no valid coordinate rows were found.
 *
 * Runtime: Node.js — required because stereo70ToWgs84 reads grid files from disk.
 */

export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { stereo70ToWgs84 }  from "@/lib/geo/transdatRO";

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/** True if n falls in the Stereo70 coordinate range (100 000 – 999 999). */
function isStereo(n: number): boolean {
  const i = Math.floor(Math.abs(n));
  return i >= 100_000 && i <= 999_999;
}

/**
 * Parse one data line and return { northing, easting } or null.
 *
 * Accepts whitespace, comma, semicolon, pipe, or tab as separators.
 *
 * Supported formats:
 *  3-column: <token0> <X [m]> <Y [m]>  — token0 is any finite number < 1 000
 *                                         (ignored; corner order = line order)
 *  2-column: <X [m]> <Y [m]>            — no leading token (auto-detected when
 *                                          token 0 is itself a Stereo70 value)
 *
 * Token mapping (Romanian geodetic convention — X = Northing, Y = Easting):
 *   X column → `northing`; Y column → `easting`
 */
function parseLine(line: string): { northing: number; easting: number } | null {
  const tokens = line
    .trim()
    .split(/[\s,;|\t]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (tokens.length < 2) return null;

  // --- 3-column format: leading token (< 1 000) + X + Y ---
  // token[0] is an arbitrary numeric label; it is ignored for sequencing.
  // Corner order is always determined by line order, not by this value.
  if (tokens.length >= 3) {
    const idx = parseFloat(tokens[0].replace(",", "."));
    if (Number.isFinite(idx) && idx < 1_000) {
      const northing = parseFloat(tokens[1].replace(",", "."));
      const easting  = parseFloat(tokens[2].replace(",", "."));
      if (!isNaN(northing) && isStereo(northing) && !isNaN(easting) && isStereo(easting)) {
        return { northing, easting };
      }
    }
  }

  // --- 2-column (or N-column) format: first token is itself a Stereo70 value ---
  const firstNum = parseFloat(tokens[0].replace(",", "."));
  if (!isNaN(firstNum) && isStereo(firstNum)) {
    const secondNum = parseFloat(tokens[1].replace(",", "."));
    if (!isNaN(secondNum) && isStereo(secondNum)) {
      return { northing: firstNum, easting: secondNum };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<Response> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const fileField = formData.get("file");
  if (!fileField || !(fileField instanceof File)) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  // Read as text (handles UTF-8 BOM automatically via TextDecoder)
  const raw   = await fileField.text();
  const lines = raw.split(/\r?\n/);

  const corners: { lat: number; lon: number }[] = [];

  for (const line of lines) {
    const parsed = parseLine(line);
    if (!parsed) continue;

    try {
      const wgs = stereo70ToWgs84(parsed.northing, parsed.easting);
      corners.push({ lat: wgs.lat, lon: wgs.lon });
    } catch {
      // Point outside grid coverage — skip this corner silently
    }
  }

  return Response.json({ corners });
}
