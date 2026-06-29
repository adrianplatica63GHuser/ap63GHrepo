/**
 * Diviz — 5-section data-file parser  (Slice #18.10.diviz)
 *
 * Pure parser (no I/O) for the division input file. The file has five sections,
 * each introduced by a "Section #n" header (any case; the "#" is optional):
 *
 *   Section #1   — big-polygon corners, one per line, tab/space/comma separated:
 *                    <index> <X> <Y>      (X = Northing, Y = Easting — the
 *                    Romanian geodetic convention; see the axis-order gotcha in
 *                    CLAUDE.md). <index> is the file's original corner label.
 *   Section #2   — orientation confirmation: "H" (horizontal) or "V" (vertical).
 *                    The polygon's orientation is also deduced from the corners;
 *                    this section just confirms a shared understanding.
 *   Section #3   — owners, one per line:  "<label> - <percent>%"
 *                    e.g. "Owner1 Platica - 33.33%". The nickname is the label
 *                    with any leading "OwnerN" positional prefix stripped
 *                    ("Platica"). Percentages are used exactly as written
 *                    (decimals allowed); NOT normalised — owner N absorbs any
 *                    remainder.
 *   Section #4   — road corner: SW / NW / SE / NE — the corner of the big polygon
 *                    the road shares and starts from. S/N picks the long side the
 *                    road runs along; W/E picks the end it starts from.
 *   Section #5   — road width in metres, e.g. "7 m".
 *
 * Owners are taken in file order; owner 1 is the one nearest the road's start
 * corner.
 */

import type { CornerCode, S70Point } from "./geometry";

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

export type ParsedOwner = {
  /** Full label as written, e.g. "Owner1 Platica". */
  rawLabel: string;
  /** Cleaned nickname used for the property, e.g. "Platica". */
  name: string;
  /** Percentage as written (e.g. 33 or 33.33). */
  percent: number;
  /** Fraction of 1 (percent / 100). */
  fraction: number;
};

export type ParsedDivisionFile = {
  corners: (S70Point & { originalIndex: number | null })[];
  /** Declared orientation from Section #2 (confirmed against the coordinates). */
  declaredOrientation: "HORIZONTAL" | "VERTICAL";
  owners: ParsedOwner[];
  /** Road corner / start corner from Section #4. */
  roadCorner: CornerCode;
  roadWidth: number;
  /** Sum of the owner percentages as written (for the preview's transparency). */
  percentTotal: number;
};

/** True if n is in the Stereo70 coordinate range (100 000 – 999 999). */
function isStereo(n: number): boolean {
  const i = Math.floor(Math.abs(n));
  return i >= 100_000 && i <= 999_999;
}

function num(token: string): number {
  return parseFloat(token.replace(",", "."));
}

/** Split the raw text into the numbered sections. */
function splitSections(text: string): Map<number, string[]> {
  const sections = new Map<number, string[]>();
  let current: number | null = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const header = line.match(/^section\s*#?\s*(\d+)/i);
    if (header) {
      current = parseInt(header[1], 10);
      sections.set(current, []);
      continue;
    }
    if (current != null) sections.get(current)!.push(line);
  }
  return sections;
}

function parseCorners(lines: string[]): ParsedDivisionFile["corners"] {
  const corners: ParsedDivisionFile["corners"] = [];
  for (const line of lines) {
    const tokens = line.split(/[\s,;|\t]+/).filter(Boolean);
    if (tokens.length < 2) continue;

    // 3-column: <index> <X=North> <Y=East>
    if (tokens.length >= 3) {
      const idx = num(tokens[0]);
      const north = num(tokens[1]);
      const east = num(tokens[2]);
      if (Number.isFinite(idx) && idx < 1_000 && isStereo(north) && isStereo(east)) {
        corners.push({ north, east, originalIndex: idx });
        continue;
      }
    }
    // 2-column: <X=North> <Y=East>
    const a = num(tokens[0]);
    const b = num(tokens[1]);
    if (isStereo(a) && isStereo(b)) {
      corners.push({ north: a, east: b, originalIndex: null });
    }
  }
  if (corners.length < 3) {
    throw new ParseError(
      `Section #1: expected at least 3 corner lines, found ${corners.length}.`,
    );
  }
  return corners;
}

function parseOrientation(lines: string[]): "HORIZONTAL" | "VERTICAL" {
  const w = (lines[0] ?? "").trim().toUpperCase();
  if (w === "H" || w === "HORIZONTAL" || w === "ORIZONTAL") return "HORIZONTAL";
  if (w === "V" || w === "VERTICAL") return "VERTICAL";
  throw new ParseError(
    `Section #2: orientation "${lines[0] ?? ""}" not recognised — use H (horizontal) or V (vertical).`,
  );
}

function parseOwners(lines: string[]): ParsedOwner[] {
  const owners: ParsedOwner[] = [];
  for (const line of lines) {
    // Split off the trailing "… - 33%" (last dash before the percentage).
    const m = line.match(/^(.*?)[-–—]\s*([\d.,]+)\s*%?\s*$/);
    if (!m) {
      throw new ParseError(
        `Section #3: could not read owner / percentage from "${line}". Expected "Name - 33%".`,
      );
    }
    const rawLabel = m[1].trim();
    const percent = num(m[2]);
    if (!Number.isFinite(percent) || percent <= 0) {
      throw new ParseError(`Section #3: invalid percentage in "${line}".`);
    }
    // Strip a leading "OwnerN" positional prefix to get the real name.
    const name = rawLabel.replace(/^owner\s*\d+\s*/i, "").trim() || rawLabel;
    owners.push({ rawLabel, name, percent, fraction: percent / 100 });
  }
  if (owners.length < 2) {
    throw new ParseError(`Section #3: at least two owners are required, found ${owners.length}.`);
  }
  return owners;
}

const CORNER_CODES: Record<string, CornerCode> = {
  SW: "SW",
  WS: "SW",
  NW: "NW",
  WN: "NW",
  SE: "SE",
  ES: "SE",
  NE: "NE",
  EN: "NE",
};

function parseRoadCorner(lines: string[]): CornerCode {
  const w = (lines[0] ?? "").trim().toUpperCase().replace(/[^A-Z]/g, "");
  const corner = CORNER_CODES[w];
  if (!corner) {
    throw new ParseError(
      `Section #4: road corner "${lines[0] ?? ""}" not recognised — use SW, NW, SE or NE.`,
    );
  }
  return corner;
}

function parseRoadWidth(lines: string[]): number {
  const m = (lines[0] ?? "").match(/([\d.,]+)/);
  const width = m ? num(m[1]) : NaN;
  if (!Number.isFinite(width) || width <= 0) {
    throw new ParseError(`Section #5: could not read a positive road width from "${lines[0] ?? ""}".`);
  }
  return width;
}

export function parseDivisionFile(text: string): ParsedDivisionFile {
  const sections = splitSections(text);
  for (const n of [1, 2, 3, 4, 5]) {
    if (!sections.has(n)) {
      throw new ParseError(`Missing "Section #${n}" in the data file.`);
    }
  }
  const owners = parseOwners(sections.get(3)!);
  return {
    corners: parseCorners(sections.get(1)!),
    declaredOrientation: parseOrientation(sections.get(2)!),
    owners,
    roadCorner: parseRoadCorner(sections.get(4)!),
    roadWidth: parseRoadWidth(sections.get(5)!),
    percentTotal: owners.reduce((s, o) => s + o.percent, 0),
  };
}
