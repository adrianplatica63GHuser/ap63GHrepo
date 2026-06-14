/**
 * POST /api/properties/scan-image
 *
 * Accepts a multipart/form-data upload with a single `image` field.
 * Runs Tesseract OCR on the image, parses Stereo70 coordinate pairs and labels,
 * converts corners to WGS84, and returns structured data for the UI.
 *
 * Response shape:
 *   {
 *     properties: { corners: { lat: number; lon: number }[] }[]
 *     labels:     string[]
 *   }
 *
 * – `properties` is ordered as detected top-to-bottom in the image.
 *   An empty array means no valid corner groups were found.
 * – `labels` contains all non-coordinate text tokens (deduplicated).
 *
 * Runtime: Node.js (required — Tesseract.js and transdatRO both need fs access).
 */

export const runtime    = "nodejs";
export const maxDuration = 60; // Tesseract can be slow on cold start

import path                 from "path";
import type { NextRequest } from "next/server";
import { createWorker }     from "tesseract.js";
import { stereo70ToWgs84 }  from "@/lib/geo/transdatRO";

// When Next.js/Turbopack bundles server code, __dirname resolves to a virtual
// path (e.g. "C:\ROOT\...") instead of the real node_modules location.
// Explicitly resolve the worker script from the project root so tesseract.js
// can spawn its child process regardless of how the module was required.
// Note: serverExternalPackages in next.config.ts already prevents bundling;
// this is a belt-and-suspenders fallback.
const TESSERACT_WORKER_PATH = path.join(
  process.cwd(),
  "node_modules/tesseract.js/src/worker-script/node/index.js",
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParsedCorner {
  lat: number;
  lon: number;
}

interface ParsedProperty {
  corners: ParsedCorner[];
}

interface ScanResult {
  properties: ParsedProperty[];
  labels:     string[];
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the token looks like a Stereo70 coordinate component.
 * Stereo70 Northing for Romania: ~300 000 – 850 000
 * Stereo70 Easting  for Romania: ~200 000 – 800 000
 * We accept any 5–7 digit number (possibly with comma/dot decimal separator)
 * in the range 100 000 – 999 999 to cover rounding/OCR artefacts.
 */
function isStereoToken(token: string): boolean {
  const clean = token.replace(",", ".");
  const n = parseFloat(clean);
  if (isNaN(n)) return false;
  const intPart = Math.floor(Math.abs(n));
  return intPart >= 100_000 && intPart <= 999_999;
}

function parseStereoValue(token: string): number {
  return parseFloat(token.replace(",", "."));
}

// ---------------------------------------------------------------------------
// Romanian number normalisation + project-area range checks  (Slice GIS.13.10)
// ---------------------------------------------------------------------------

/**
 * Normalise a coordinate token that may use Romanian number formatting:
 *
 *   "321234.56"   → 321234.56  (plain)
 *   "321234,56"   → 321234.56  (comma as decimal — common in Romanian docs)
 *   "321.234,56"  → 321234.56  (dot-thousands, comma-decimal — Romanian formal)
 *   "321,234.56"  → 321234.56  (comma-thousands, dot-decimal — US style)
 *   "321 234.56"  → 321234.56  (space as thousands separator)
 *
 * Returns null if the string cannot be parsed as a finite number.
 */
function normalizeCoordToken(token: string): number | null {
  let s = token.trim();
  if (!s) return null;

  // Remove spaces used as thousands separators
  s = s.replace(/\s+/g, "");

  const lastDot   = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");

  if (lastDot !== -1 && lastComma !== -1) {
    if (lastDot < lastComma) {
      // "321.234,56" — dot = thousands, comma = decimal (Romanian)
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // "321,234.56" — comma = thousands, dot = decimal (US)
      s = s.replace(/,/g, "");
    }
  } else if (lastComma !== -1) {
    // Only comma present: treat as decimal separator → "321234,56"
    s = s.replace(",", ".");
  }
  // Only dot or no separator: already parseable

  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}

/**
 * True if n is a plausible Stereo70 Northing (X) for the project area.
 * Per the table-format spec: "starts with 32".
 * Accepts 310 000–339 999 to absorb slight OCR or measurement variations.
 */
function isProjectNorthing(n: number): boolean {
  const ip = Math.floor(Math.abs(n));
  return ip >= 310_000 && ip <= 339_999;
}

/**
 * True if n is a plausible Stereo70 Easting (Y) for the project area.
 * Per the table-format spec: "starts with 57".
 * Accepts 560 000–589 999 to absorb slight OCR or measurement variations.
 */
function isProjectEasting(n: number): boolean {
  const ip = Math.floor(Math.abs(n));
  return ip >= 560_000 && ip <= 589_999;
}

// ---------------------------------------------------------------------------
// Table-aware primary parser  (Slice GIS.13.10)
// ---------------------------------------------------------------------------

/** Keywords on area/perimeter rows that should be skipped. */
const SKIP_LINE_RE = /suprafat|perimetr|\barea\b|\bperim\b/i;

/**
 * Primary parser tuned to the specific Romanian cadastral table format:
 *
 *   [corner_index]  X_Northing  Y_Easting  [irrelevant …]
 *
 * Rules:
 * - 1–2 title rows are skipped automatically (no valid coord tokens).
 * - Lines matching SKIP_LINE_RE (area/perimeter rows) are skipped.
 * - Corner index (small integer) may be present but is not required.
 * - X (Northing) is the first token in the range 310 000–339 999.
 * - Y (Easting)  is the first token in the range 560 000–589 999.
 * - OCR-merged tokens like "1321762.117" (index fused with X) are rescued
 *   by stripping the leading digit via trySplitMergedToken.
 * - Romanian number formats (e.g. "321.234,56") are normalised first.
 *
 * Returns [] if fewer than 3 valid corners are found.
 */
function parseTableFormat(rawText: string): { north: number; east: number }[] {
  const corners: { north: number; east: number }[] = [];

  for (const rawLine of rawText.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (SKIP_LINE_RE.test(line)) continue;

    // Split on whitespace and pipe/semicolon.
    // Do NOT split on dots or commas — they may be decimal separators.
    const tokens = line.split(/[\s|;]+/).map((t) => t.trim()).filter(Boolean);
    if (tokens.length < 2) continue;

    let northVal: number | null = null;
    let eastVal:  number | null = null;

    for (const tok of tokens) {
      // Short tokens cannot be 6-digit coordinates
      if (tok.length < 4) continue;

      // 1. Try Romanian-normalised parse of the token as-is
      let n = normalizeCoordToken(tok);

      // 2. If the parsed value is outside project ranges, try the
      //    merged-token rescue: "1321762.117" → strip leading "1" → "321762.117"
      if (n === null || (!isProjectNorthing(n) && !isProjectEasting(n))) {
        const rescued = trySplitMergedToken(tok);
        if (rescued !== null) {
          const rn = normalizeCoordToken(rescued);
          if (rn !== null) n = rn;
        }
      }

      if (n === null) continue;

      if (northVal === null && isProjectNorthing(n)) {
        northVal = n;
      } else if (eastVal === null && isProjectEasting(n)) {
        eastVal = n;
      }

      // Both found — no need to examine more tokens on this line
      if (northVal !== null && eastVal !== null) break;
    }

    if (northVal !== null && eastVal !== null) {
      corners.push({ north: northVal, east: eastVal });
    }
  }

  return corners;
}

// ---------------------------------------------------------------------------
// Label extraction helper
// ---------------------------------------------------------------------------

/**
 * Collect unique non-numeric text tokens from the OCR output.
 * Used to populate the property notes field.
 */
function extractLabels(rawText: string): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const tok of rawText.split(/[\s\n\r|;]+/).filter(Boolean)) {
    const clean = tok.trim();
    if (clean.length < 2) continue;
    if (/^\d+([.,]\d+)?$/.test(clean)) continue; // skip pure numbers
    if (seen.has(clean)) continue;
    seen.add(clean);
    labels.push(clean);
  }
  return labels;
}

/**
 * OCR sometimes merges the row sequence number with the X coordinate, e.g.
 * the table row "1  321762.117  …" is read as "1321762.117".  The integer
 * part (1 321 762) falls outside the Stereo70 range so isStereoToken rejects
 * it, causing the first corner to be silently dropped.
 *
 * If a token's integer part is in [1 000 000, 9 999 999], strip the leading
 * digit and check whether the remaining 6 digits form a valid Stereo70 value.
 * When they do, return the corrected token string (with the decimal preserved);
 * otherwise return null.
 */
function trySplitMergedToken(token: string): string | null {
  const clean = token.replace(",", ".");
  const n = parseFloat(clean);
  if (isNaN(n)) return null;
  const intPart = Math.floor(Math.abs(n));
  if (intPart < 1_000_000 || intPart > 9_999_999) return null;

  // Strip exactly one leading digit
  const intStr   = String(intPart);
  const stripped = intStr.slice(1);           // e.g. "1321762" → "321762"
  const remNum   = parseInt(stripped, 10);
  if (remNum < 100_000 || remNum > 999_999) return null;

  // Re-attach decimal part if the original token had one
  const dec = clean.match(/\.(\d+)$/);
  return dec ? `${stripped}.${dec[1]}` : stripped;
}

/**
 * Extract all Stereo70 values from a raw token list.
 * Tries direct match first; falls back to trySplitMergedToken for tokens that
 * look like a sequence number fused with a coordinate.
 */
function extractStereoValues(tokens: string[]): string[] {
  const result: string[] = [];
  for (const tok of tokens) {
    if (isStereoToken(tok)) {
      result.push(tok);
    } else {
      const rescued = trySplitMergedToken(tok);
      if (rescued) result.push(rescued);
    }
  }
  return result;
}

/**
 * Parse the raw OCR text into coordinate groups and label tokens.
 *
 * Strategy — three passes:
 *
 * Pass 0 (table-aware, Slice GIS.13.10):
 *  - Specifically targets the Romanian cadastral table format:
 *      [corner_index]  X_Northing(32x)  Y_Easting(57x)  [...]
 *  - Handles Romanian number formats (e.g. "321.234,56").
 *  - Skips title rows and area/perimeter rows automatically.
 *  - If ≥3 corners found here, returns immediately without running Pass 1/2.
 *
 * Pass 1 (line-by-line generic):
 *  - Lines with ≥2 Stereo70 tokens contribute a (North, East) corner.
 *  - Non-coordinate lines are tolerated up to CLOSE_THRESHOLD consecutive
 *    occurrences before a group is closed. This handles OCR artefacts and
 *    table-border characters that appear between coordinate rows.
 *
 * Pass 2 (sequential fallback):
 *  - If Pass 1 found fewer corners than there are Stereo70 token pairs in the
 *    full text, OCR likely split some coordinate rows across multiple lines
 *    (one line for X, another for Y). In that case every two consecutive
 *    Stereo70 numbers in the entire text are paired as (North, East).
 *    This works because all Stereo70 numbers in a cadastral plan are
 *    coordinates — side lengths, areas and parcel numbers are always outside
 *    the 100 000–999 999 range.
 */
function parseOcrText(rawText: string): ScanResult {
  // ── Pass 0: table-aware parser (Slice GIS.13.10) ─────────────────────────
  // Try the specific Romanian cadastral table format first.
  // If it yields ≥3 corners, convert and return without running Pass 1/2.
  const tableCorners = parseTableFormat(rawText);
  if (tableCorners.length >= 3) {
    const corners: ParsedCorner[] = [];
    let conversionFailed = false;

    for (const { north, east } of tableCorners) {
      try {
        const wgs = stereo70ToWgs84(north, east);
        corners.push({ lat: wgs.lat, lon: wgs.lon });
      } catch {
        conversionFailed = true;
        break;
      }
    }

    if (!conversionFailed && corners.length >= 3) {
      return {
        properties: [{ corners }],
        labels:     extractLabels(rawText),
      };
    }
  }

  // ── Pass 1 + 2: generic parser (existing) ────────────────────────────────
  const lines = rawText.split("\n");

  const cornerGroups: { north: number; east: number }[][] = [];
  let   currentGroup: { north: number; east: number }[]   = [];
  const rawLabels: string[] = [];

  // How many consecutive non-coordinate lines are tolerated before the current
  // corner group is closed.  Set to 3 to absorb OCR table-border artefacts.
  const CLOSE_THRESHOLD = 3;
  let nonCoordStreak = 0;

  const closeGroup = () => {
    if (currentGroup.length >= 3) cornerGroups.push([...currentGroup]);
    currentGroup = [];
    nonCoordStreak = 0;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Empty line counts toward the streak
    if (!trimmed) {
      nonCoordStreak++;
      if (nonCoordStreak >= CLOSE_THRESHOLD) closeGroup();
      continue;
    }

    // Split on whitespace, commas, pipes, semicolons, tabs
    const tokens = trimmed.split(/[\s,|;]+/).map(t => t.trim()).filter(Boolean);

    // extractStereoValues also rescues tokens where OCR merged a sequence
    // number with the coordinate (e.g. "1321762.117" → "321762.117").
    const stereoTokens  = extractStereoValues(tokens);
    const nonStereoToks = tokens.filter(t => !isStereoToken(t) && !trySplitMergedToken(t));

    if (stereoTokens.length >= 2) {
      // Coordinate line — reset the streak and accumulate the corner
      nonCoordStreak = 0;
      const north = parseStereoValue(stereoTokens[0]);
      const east  = parseStereoValue(stereoTokens[1]);
      currentGroup.push({ north, east });

      for (const tok of nonStereoToks) {
        if (/^\d{1,3}$/.test(tok)) continue; // skip sequence numbers
        rawLabels.push(tok);
      }
    } else {
      // Non-coordinate line — increment streak, close if threshold reached
      nonCoordStreak++;
      if (nonCoordStreak >= CLOSE_THRESHOLD) closeGroup();

      for (const tok of tokens) {
        if (/^\d{1,3}$/.test(tok)) continue;
        rawLabels.push(tok);
      }
    }
  }

  // Flush the last group
  closeGroup();

  // ── Pass 2: sequential fallback ──────────────────────────────────────────
  // Count all Stereo70 numbers across the entire text.  If Pass 1 found fewer
  // corners than there are pairs of Stereo70 numbers, OCR must have split some
  // rows — fall back to pairing every two consecutive Stereo70 numbers.
  const allStereoNums: number[] = extractStereoValues(
    rawText.split(/[\s\n\r,|;]+/).filter(Boolean)
  ).map(parseStereoValue);

  const expectedPairs = Math.floor(allStereoNums.length / 2);
  const foundCorners  = cornerGroups.reduce((s, g) => s + g.length, 0);

  if (expectedPairs >= 3 && foundCorners < expectedPairs) {
    // Replace partial results with the sequentially-paired fallback group
    cornerGroups.splice(0);
    const fallback: { north: number; east: number }[] = [];
    for (let i = 0; i + 1 < allStereoNums.length; i += 2) {
      fallback.push({ north: allStereoNums[i], east: allStereoNums[i + 1] });
    }
    if (fallback.length >= 3) cornerGroups.push(fallback);
  }

  // Convert Stereo70 → WGS84 for each group
  const properties: ParsedProperty[] = [];
  for (const group of cornerGroups) {
    const corners: ParsedCorner[] = [];
    let conversionFailed = false;

    for (const { north, east } of group) {
      try {
        const wgs = stereo70ToWgs84(north, east);
        corners.push({ lat: wgs.lat, lon: wgs.lon });
      } catch {
        // Point outside grid coverage — skip entire group
        conversionFailed = true;
        break;
      }
    }

    if (!conversionFailed && corners.length >= 3) {
      properties.push({ corners });
    }
  }

  // Deduplicate and clean labels
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const tok of rawLabels) {
    const clean = tok.trim();
    if (clean.length < 2) continue;
    if (seen.has(clean)) continue;
    seen.add(clean);
    labels.push(clean);
  }

  return { properties, labels };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<Response> {
  // Parse multipart form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const imageField = formData.get("image");
  if (!imageField || !(imageField instanceof File)) {
    return Response.json({ error: "No image file provided" }, { status: 400 });
  }

  // Convert File → Buffer (Tesseract.js accepts Buffer)
  const buffer = Buffer.from(await imageField.arrayBuffer());

  // Run OCR — Romanian + English to cover both alphabets on cadastral plans
  const worker = await createWorker(["ron", "eng"], 1, {
    workerPath: TESSERACT_WORKER_PATH,
  });
  let rawText: string;
  try {
    const { data } = await worker.recognize(buffer);
    rawText = data.text;
  } catch (err) {
    console.error("[scan-image] OCR error:", err);
    return Response.json({ error: "OCR processing failed" }, { status: 500 });
  } finally {
    await worker.terminate();
  }

  const result = parseOcrText(rawText);
  return Response.json(result);
}
