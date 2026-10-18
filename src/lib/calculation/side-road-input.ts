/**
 * „Calcul drum lateral" — what the screen's first step gathers, and its checks       (Slice #39.79)
 *
 * Pure (no I/O): the screen runs it as the user types, to say what is wrong and to enable the button, and the server
 * runs it again on what the body names, from the database — so the two can never disagree about what is acceptable.
 * It replaces #38.23's three-section file (parse.ts, retired with its suite): the parcel is now a property already in
 * the archive, the owners persons already in it, and the road's width typed.
 *
 * - **The corners are the property's own** `property_corner` rows, in their stored order (Ask first 2). „Exactly four"
 *   counts those rows; a property with none gets a message of its own. Their numbers are the rows' original index
 *   (the number the cadastral file gave each corner) when every row has one and no two share it, otherwise their
 *   place, 1 to 4 — a label must name one corner.
 * - **At least two owners, each a different person** (Ask first 5), each with a share written with a decimal comma or
 *   point and at most two decimals (Ask first 8): a third decimal is refused, never rounded.
 * - **The shares add up to 100% or 99.99%**, summed in hundredths so 33,33 × 3 is exactly 99,99.
 * - **The road is wider than 0 and narrower than 15 m.**
 *
 * As parse.ts did, the result is either an input or EVERY problem at once, as codes and values; the screen words them.
 */

import { quadIsSimple, type S70Point } from "./geometry";

/** The widest road, exclusive (the request: „below 15 meters"). */
export const MAX_ROAD_WIDTH = 15;

export type InputCorner = S70Point & {
  /** The label the screen and the new properties' corners carry: „17". */
  number: string;
};

export type InputOwner = {
  personId: string;
  /** The person's display name, as the archive holds it. */
  name: string;
  /** Two decimals at most, above 0. */
  percent: number;
};

/** What the computation needs: the same shape #38.23's file was read into. */
export type SideRoadInput = {
  /** Exactly four, in the property's order. */
  corners: InputCorner[];
  /** In the order they were entered; at least two. */
  owners: InputOwner[];
  /** Metres, above 0 and under 15. */
  roadWidth: number;
  /** The shares summed to two decimals: 100 or 99.99. */
  percentTotal: number;
};

export type InputProblem =
  | { code: "noCorners" }
  | { code: "cornerCount"; values: { count: number } }
  | { code: "cornersCross" }
  | { code: "ownerCount"; values: { count: number } }
  | { code: "repeatedOwner"; values: { name: string } }
  | { code: "shareFormat"; values: { name: string; share: string } }
  | { code: "percentTotal"; values: { total: number } }
  | { code: "widthFormat"; values: { width: string } }
  | { code: "roadWidth"; values: { width: number } };

export class InputRejected extends Error {
  constructor(readonly problems: InputProblem[]) {
    super(`The calculation's input was rejected: ${problems.map((p) => p.code).join(", ")}`);
    this.name = "InputRejected";
  }
}

/** A share: up to three whole digits, a decimal comma or point, at most two decimals; above 0 and at most 100. */
const SHARE = /^(\d{1,3})(?:[.,](\d{1,2}))?$/;
/** A width in metres: digits, a decimal comma or point, at most two decimals. */
const WIDTH = /^(\d{1,3})(?:[.,](\d{1,2}))?$/;

/** „33,33" → 3333 hundredths; null for anything else — a third decimal included. */
export function shareHundredths(text: string): number | null {
  const m = SHARE.exec(text.trim());
  if (!m) return null;
  const hundredths = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return hundredths > 0 && hundredths <= 10000 ? hundredths : null;
}

/** „4" or „4,5" → metres; null for anything else. Whether it is under 15 is `checkSideRoadInput`'s. */
export function parseWidth(text: string): number | null {
  const m = WIDTH.exec(text.trim());
  if (!m) return null;
  return Number(m[1]) + Number((m[2] ?? "").padEnd(2, "0")) / 100;
}

/** A property's corner rows as the calculation labels them (see the header). */
export function cornerLabels(rows: readonly { sequenceNo: number; originalIndex: number | null }[]): string[] {
  const originals = rows.map((r) => r.originalIndex);
  const usable = originals.every((o) => o !== null) && new Set(originals).size === originals.length;
  return rows.map((r, i) => (usable ? String(r.originalIndex) : String(i + 1)));
}

/** The corners' own problems: none, not four, or four whose sides cross. */
export function cornerProblems(corners: readonly InputCorner[]): InputProblem[] {
  if (corners.length === 0) return [{ code: "noCorners" }];
  if (corners.length !== 4) return [{ code: "cornerCount", values: { count: corners.length } }];
  return quadIsSimple([...corners]) ? [] : [{ code: "cornersCross" }];
}

export type DraftOwner = { personId: string; name: string; share: string };

/**
 * Check what the screen holds; the corners are the property's (null while no property is chosen — the screen's
 * button stays off, and the server never calls this without them).
 */
export function checkSideRoadInput(draft: {
  corners: readonly InputCorner[] | null;
  owners: readonly DraftOwner[];
  width: string;
}): { ok: true; input: SideRoadInput } | { ok: false; problems: InputProblem[] } {
  const problems: InputProblem[] = [];
  if (draft.corners) problems.push(...cornerProblems(draft.corners));

  if (draft.owners.length < 2) problems.push({ code: "ownerCount", values: { count: draft.owners.length } });
  const seen = new Set<string>();
  for (const o of draft.owners) {
    if (seen.has(o.personId)) problems.push({ code: "repeatedOwner", values: { name: o.name } });
    seen.add(o.personId);
  }
  const hundredths = draft.owners.map((o) => shareHundredths(o.share));
  draft.owners.forEach((o, i) => {
    if (hundredths[i] === null) problems.push({ code: "shareFormat", values: { name: o.name, share: o.share.trim() } });
  });
  const total = hundredths.reduce<number>((s, h) => s + (h ?? 0), 0);
  if (draft.owners.length > 0 && hundredths.every((h) => h !== null) && total !== 10000 && total !== 9999) {
    problems.push({ code: "percentTotal", values: { total: total / 100 } });
  }

  const width = parseWidth(draft.width);
  if (width === null) problems.push({ code: "widthFormat", values: { width: draft.width.trim() } });
  else if (!(width > 0 && width < MAX_ROAD_WIDTH)) problems.push({ code: "roadWidth", values: { width } });

  if (problems.length > 0 || !draft.corners || width === null) return { ok: false, problems };
  return {
    ok: true,
    input: {
      corners: draft.corners.map((c) => ({ number: c.number, north: c.north, east: c.east })),
      owners: draft.owners.map((o, i) => ({ personId: o.personId, name: o.name, percent: hundredths[i]! / 100 })),
      roadWidth: width,
      percentTotal: total / 100,
    },
  };
}
