/**
 * „Calcul drum lateral" — the three-section data file            (Slice #38.23)
 *
 * Pure parser (no I/O). Replaces the five-section, English-headed file of
 * #18.10 (corners, H/V, „Name - 33%", SW/NW/SE/NE, width): none of that is kept.
 *
 * The file, as Adrian's request gives it (src/lib/calculation/side-road-sample.txt
 * is the same corners and shares under `TC-` names):
 *
 *   Sectiunea de Colturi (numai 4 colturi, nu 3, nu 5)
 *   121	321015.423	572425.587          <number> <X = North> <Y = East>
 *   …
 *   Sectiunea de Proprietari (…)
 *   Mateescu	24,33%                      <name, spaces allowed> <percent>
 *   …
 *   Sectiunea de Latime Drum (in metri)
 *   7                                     <metres>, „7" or „7 m"
 *
 * - A header is a line starting „Sectiunea de" / „Secțiunea de" and naming the
 *   section; case and diacritics do not matter, and anything else on the line
 *   (the sample's notes in brackets) is ignored.
 * - Blank lines and lines made only of „*" are ignored. Every other line must
 *   be read — a line before the first header too.
 * - Columns are tabs or spaces; every number may use a decimal comma or point.
 *
 * ⚠️ **THE RESULT IS EITHER A FILE OR EVERY PROBLEM IN IT, NEVER THE FIRST
 * ONE.** The header asks for all of them at once, so `parseSideRoadFile` keeps
 * reading after a bad line and throws `FileRejected` with the whole list at the
 * end. A problem is a code and its values, not a sentence: the screen words it
 * in Romanian or English (`calculation.problems.*`), and the jest suite asserts
 * codes, so rewording a message never breaks a test.
 */

import { isStereo } from "@/lib/geo/stereo70-parse";
import { quadIsSimple, type S70Point } from "./geometry";

export type SectionKey = "corners" | "owners" | "width";

export type FileProblem =
  | { code: "missingSection"; values: { section: SectionKey } }
  | { code: "repeatedSection"; values: { section: SectionKey } }
  | { code: "cornerCount"; values: { count: number } }
  | { code: "ownerCount"; values: { count: number } }
  | { code: "percentTotal"; values: { total: number } }
  | { code: "roadWidth"; values: { width: number } }
  | { code: "widthCount"; values: { count: number } }
  | { code: "repeatedCorner"; values: { number: string } }
  | { code: "cornersCross" }
  | { code: "unreadableLine"; values: { section: SectionKey | "none"; lineNumber: number; line: string } };

export class FileRejected extends Error {
  constructor(readonly problems: FileProblem[]) {
    super(`The data file was rejected: ${problems.map((p) => p.code).join(", ")}`);
    this.name = "FileRejected";
  }
}

export type FileCorner = S70Point & {
  /** The corner's number as written in the file — „121". Kept as text: it is a label. */
  number: string;
};

export type FileOwner = {
  /** As written, spaces kept. */
  name: string;
  /** As written, e.g. 24.33. */
  percent: number;
};

export type SideRoadFile = {
  /** Exactly four, in file order: the ring the parcel is drawn from. */
  corners: FileCorner[];
  /** In file order; at least two. */
  owners: FileOwner[];
  /** Metres, above 0 and under 15. */
  roadWidth: number;
  /** The shares summed to two decimals: 100 or 99.99. */
  percentTotal: number;
};

/** The widest road the file may ask for, exclusive (the request: „under 15 metres"). */
export const MAX_ROAD_WIDTH = 15;

/** A number with a decimal comma or point — and nothing else. */
const NUMBER = String.raw`[0-9]+(?:[.,][0-9]+)?`;

function num(token: string): number {
  return Number(token.replace(",", "."));
}

/** Lower case, diacritics gone (ș/ş/ț/ţ/ă/â/î and the rest), spaces folded. */
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Which section a header line opens, or null when the line is not a header. */
export function sectionOf(line: string): SectionKey | null {
  const f = fold(line);
  if (!f.startsWith("sectiunea de ")) return null;
  const rest = f.slice("sectiunea de ".length);
  if (rest.startsWith("colturi")) return "corners";
  if (rest.startsWith("proprietari")) return "owners";
  if (rest.startsWith("latime drum")) return "width";
  return null;
}

const CORNER_LINE = new RegExp(String.raw`^(\S+)\s+(${NUMBER})\s+(${NUMBER})$`);
const OWNER_LINE = new RegExp(String.raw`^(.*\S)\s+(${NUMBER})\s*%?$`);
const WIDTH_LINE = new RegExp(String.raw`^(${NUMBER})\s*(?:m|metri)?$`, "i");


export function parseSideRoadFile(text: string): SideRoadFile {
  const problems: FileProblem[] = [];
  const seen = new Set<SectionKey>();
  const corners: FileCorner[] = [];
  const owners: FileOwner[] = [];
  const widths: number[] = [];
  let current: SectionKey | "none" = "none";

  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (line === "" || /^\*+$/.test(line)) return;
    const lineNumber = i + 1;

    const header = sectionOf(line);
    if (header) {
      if (seen.has(header)) problems.push({ code: "repeatedSection", values: { section: header } });
      seen.add(header);
      current = header;
      return;
    }

    const unreadable = () =>
      problems.push({ code: "unreadableLine", values: { section: current, lineNumber, line } });

    if (current === "corners") {
      const m = line.match(CORNER_LINE);
      const north = m ? num(m[2]) : NaN;
      const east = m ? num(m[3]) : NaN;
      if (!m || !isStereo(north) || !isStereo(east)) return void unreadable();
      corners.push({ number: m[1], north, east });
    } else if (current === "owners") {
      const m = line.match(OWNER_LINE);
      const percent = m ? num(m[2]) : NaN;
      if (!m || !(percent > 0)) return void unreadable();
      owners.push({ name: m[1].trim(), percent });
    } else if (current === "width") {
      const m = line.match(WIDTH_LINE);
      if (!m) return void unreadable();
      widths.push(num(m[1]));
    } else {
      unreadable();
    }
  });

  for (const section of ["corners", "owners", "width"] as const) {
    if (!seen.has(section)) problems.push({ code: "missingSection", values: { section } });
  }

  // A section with a line that could not be read is not counted or summed:
  // „the file has 3 corners" beside „line 4 cannot be read" names one fault
  // twice, and the second time wrongly — the file HAS four corner lines.
  const unread = new Set(
    problems.flatMap((p) => (p.code === "unreadableLine" ? [p.values.section] : [])),
  );

  if (seen.has("corners") && !unread.has("corners") && corners.length !== 4) {
    problems.push({ code: "cornerCount", values: { count: corners.length } });
  }
  const numbers = new Set<string>();
  for (const c of corners) {
    if (numbers.has(c.number)) problems.push({ code: "repeatedCorner", values: { number: c.number } });
    numbers.add(c.number);
  }
  if (corners.length === 4 && !unread.has("corners") && !quadIsSimple(corners)) problems.push({ code: "cornersCross" });

  if (seen.has("owners") && !unread.has("owners") && owners.length < 2) {
    problems.push({ code: "ownerCount", values: { count: owners.length } });
  }
  // Summed, THEN rounded to two decimals — so 24.33 + 25.66 + 15 + 35, which is
  // 99.99000000000001 in floating point, is 9999 hundredths, and three shares
  // of 33.333 are 100 rather than three roundings' 99.99.
  const totalHundredths = Math.round(owners.reduce((s, o) => s + o.percent, 0) * 100);
  if (owners.length > 0 && !unread.has("owners") && totalHundredths !== 10000 && totalHundredths !== 9999) {
    problems.push({ code: "percentTotal", values: { total: totalHundredths / 100 } });
  }

  if (seen.has("width") && !unread.has("width") && widths.length !== 1) {
    problems.push({ code: "widthCount", values: { count: widths.length } });
  }
  const roadWidth = widths[0] ?? NaN;
  if (widths.length === 1 && !(roadWidth > 0 && roadWidth < MAX_ROAD_WIDTH)) {
    problems.push({ code: "roadWidth", values: { width: roadWidth } });
  }

  if (problems.length > 0) throw new FileRejected(problems);
  return { corners, owners, roadWidth, percentTotal: totalHundredths / 100 };
}
