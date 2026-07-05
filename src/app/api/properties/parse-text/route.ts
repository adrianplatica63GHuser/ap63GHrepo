/**
 * POST /api/properties/parse-text
 *
 * Accepts a multipart/form-data upload with a single `file` field (plain-text
 * file exported from a Romanian cadastral system).
 *
 * File format (auto-detected, any delimiter):
 *   3-column: <token0> <X [m]> <Y [m]>  — token0 is any number < 1 000, the
 *                                          file's "original index" for this
 *                                          corner. It does NOT determine corner
 *                                          order (that's still line order) —
 *                                          it is captured and carried along
 *                                          permanently with this corner's
 *                                          lat/lon, so it survives reordering
 *                                          later (e.g. fixing a bow-tie
 *                                          polygon via the up/down arrows).
 *   2-column: <X [m]> <Y [m]>            — no leading token; originalIndex is
 *                                          null for these corners.
 *   Lines that don't match either pattern are ignored automatically.
 *
 * GIS.13.11 clarification: in some cadastral exports the first column is an
 * arbitrary numeric label (< 1 000) that does NOT represent the corner's
 * sequential position. Corner 1 = first matching line, corner 2 = second,
 * etc., regardless of what this label says (Slice #15.15 — the label itself
 * is now kept as `originalIndex` rather than discarded).
 *
 * Corner order (Slice #15.12): the order of valid lines in the file IS the
 * corner order — the very first matching line becomes corner 1, the second
 * matching line becomes corner 2, and so on. The corners array is returned
 * exactly in that order; it is never reordered/resorted.
 *
 * Column mapping (Romanian geodetic convention — X = Northing, Y = Easting):
 *   X [m] = Northing  → `north` arg of stereo70ToWgs84
 *   Y [m] = Easting   → `east`  arg of stereo70ToWgs84
 *
 * Note: this is the OPPOSITE of GDAL/PostGIS axis order (X=Easting, Y=Northing).
 * See the "Coordinate axis order" gotcha in CLAUDE.md.
 *
 * Response shape:
 *   { corners: { lat: number; lon: number; originalIndex: number | null }[] }
 *
 * An empty corners array means no valid coordinate rows were found.
 *
 * Runtime: Node.js — required because stereo70ToWgs84 reads grid files from disk.
 */

export const runtime = "nodejs";

import type { NextRequest }   from "next/server";
import { NextResponse }       from "next/server";
import { stereo70ToWgs84 }    from "@/lib/geo/transdatRO";
import { createServerClient } from "@/lib/supabase/server";
import { checkOcrRateLimit }  from "@/lib/rate-limit/ocr";

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/** True if n falls in the Stereo70 coordinate range (100 000 – 999 999). */
function isStereo(n: number): boolean {
  const i = Math.floor(Math.abs(n));
  return i >= 100_000 && i <= 999_999;
}

/**
 * Parse one data line and return { northing, easting, originalIndex } or null.
 *
 * Accepts whitespace, comma, semicolon, pipe, or tab as separators.
 *
 * Supported formats:
 *  3-column: <token0> <X [m]> <Y [m]>  — token0 is any finite number < 1 000,
 *                                         captured as `originalIndex`. Corner
 *                                         order is still determined by line
 *                                         order, not by this value.
 *  2-column: <X [m]> <Y [m]>            — no leading token (auto-detected when
 *                                          token 0 is itself a Stereo70 value);
 *                                          `originalIndex` is null.
 *
 * Token mapping (Romanian geodetic convention — X = Northing, Y = Easting):
 *   X column → `northing`; Y column → `easting`
 */
function parseLine(
  line: string,
): { northing: number; easting: number; originalIndex: number | null } | null {
  const tokens = line
    .trim()
    .split(/[\s,;|\t]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (tokens.length < 2) return null;

  // --- 3-column format: leading token (< 1 000) + X + Y ---
  // token[0] is an arbitrary numeric label, captured as originalIndex.
  // Corner order is always determined by line order, not by this value.
  if (tokens.length >= 3) {
    const idx = parseFloat(tokens[0].replace(",", "."));
    if (Number.isFinite(idx) && idx < 1_000) {
      const northing = parseFloat(tokens[1].replace(",", "."));
      const easting  = parseFloat(tokens[2].replace(",", "."));
      if (!isNaN(northing) && isStereo(northing) && !isNaN(easting) && isStereo(easting)) {
        return { northing, easting, originalIndex: idx };
      }
    }
  }

  // --- 2-column (or N-column) format: first token is itself a Stereo70 value ---
  const firstNum = parseFloat(tokens[0].replace(",", "."));
  if (!isNaN(firstNum) && isStereo(firstNum)) {
    const secondNum = parseFloat(tokens[1].replace(",", "."));
    if (!isNaN(secondNum) && isStereo(secondNum)) {
      return { northing: firstNum, easting: secondNum, originalIndex: null };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<Response> {
  // ── Rate limiting (10 OCR requests / minute per user) ─────────────────────
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const rl = checkOcrRateLimit(user?.id ?? "anonymous");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Prea multe cereri. Încercați din nou în curând." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

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

  const corners: { lat: number; lon: number; originalIndex: number | null }[] = [];

  for (const line of lines) {
    const parsed = parseLine(line);
    if (!parsed) continue;

    try {
      const wgs = stereo70ToWgs84(parsed.northing, parsed.easting);
      corners.push({ lat: wgs.lat, lon: wgs.lon, originalIndex: parsed.originalIndex });
    } catch {
      // Point outside grid coverage — skip this corner silently
    }
  }

  // Corner order is exactly the order valid lines appeared in the file —
  // never reordered/resorted (Slice #15.12).
  return Response.json({ corners });
}
