/**
 * „Calcul drum lateral", step 4 — what „Creează proprietățile" will create  (Slice #38.25)
 *
 * The commit route's decisions, apart from its writes, so the suite can hold
 * them without a database:
 *
 * - **The server recomputes.** The body brings the file's text and the user's
 *   three choices — the order, the road's corner and its side — and nothing
 *   drawn: any polygon, area or corner in the body is never read.
 * - **The road is always created**, beside one property per owner (the request:
 *   „the road plus the owners").
 * - **Corner numbers survive.** A new property's corner that IS one of the
 *   parcel's carries that corner's number from the file; every other corner
 *   has none. The geometry knows which point is which (`cornerIndex`), so
 *   nothing is matched by distance. A number that is not a whole number
 *   („121a") cannot go in `originalIndex`, which is an integer, so that corner
 *   goes in without one.
 * - **The run can be read and re-run**: `inputParams` holds the text and the
 *   three choices, `stepsLog` the figures the screen showed, under
 *   algorithm_type 'SIDE_ROAD' — so the history tells new runs from #18.10's
 *   'PARCEL_DIVISION' ones without parsing anything.
 */

import { computeSlicesFromFile, type SlicesComputation } from "./compute";
import type { RoadSide } from "./geometry";

export const SIDE_ROAD_ALGORITHM = "SIDE_ROAD";

/** #18.10's default, kept. */
export const DEFAULT_ROAD_NICKNAME = "Drum comun";

export type SideRoadInputParams = {
  text: string;
  order: number[];
  road: { corner: number; side: RoadSide };
  options: { groupDescription: string; roadNickname: string };
};

export type PlannedCorner = { lat: number; lon: number; originalIndex: number | null };

export type PlannedProperty = {
  role: "OWNER_PARCEL" | "ROAD_PARCEL";
  nickname: string;
  surfaceAreaMp: number;
  corners: PlannedCorner[];
};

export type CommitPlan = {
  computation: SlicesComputation;
  /** The owners in the order chosen, then the road. */
  properties: PlannedProperty[];
  inputParams: SideRoadInputParams;
};

/** A body the route cannot act on — 400, with `error` naming what is missing. */
export class CommitRequestInvalid extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommitRequestInvalid";
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** „121" → 121; anything that is not a whole number → null (`originalIndex` is an integer). */
export function originalIndexOf(number: string | null): number | null {
  if (number === null || !/^\d{1,9}$/.test(number)) return null;
  return Number(number);
}

/**
 * Read the body, recompute, and say what to create. Throws `FileRejected`,
 * `RoadRejected` or `DivisionError` from the computation for choices that do
 * not fit the file, and `CommitRequestInvalid` for a body that is not one.
 */
export function planSideRoadCommit(body: unknown): CommitPlan {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.text !== "string" || b.text.trim().length === 0) {
    throw new CommitRequestInvalid("No file text provided");
  }
  if (typeof b.groupDescription !== "string" || b.groupDescription.trim().length === 0) {
    throw new CommitRequestInvalid("A group description is required");
  }
  // The order and the road are the user's choices, and nothing is created
  // without both: a missing one is never filled in (a random order, no road).
  if (!Array.isArray(b.order)) throw new CommitRequestInvalid("The order of the owners is required");
  if (b.road === undefined || b.road === null) throw new CommitRequestInvalid("The road's corner and side are required");

  const computation = computeSlicesFromFile(b.text, b.order, Math.random, b.road);
  const road = computation.road;
  if (!road) throw new CommitRequestInvalid("The road's corner and side are required");

  const roadNickname =
    typeof b.roadNickname === "string" && b.roadNickname.trim().length > 0 ? b.roadNickname.trim() : DEFAULT_ROAD_NICKNAME;
  const groupDescription = b.groupDescription.trim().slice(0, 500);

  const cornersOf = (corners: { lat: number; lon: number }[], numbers: (string | null)[]): PlannedCorner[] =>
    corners.map((c, v) => ({ lat: c.lat, lon: c.lon, originalIndex: originalIndexOf(numbers[v] ?? null) }));

  const properties: PlannedProperty[] = [
    ...computation.slices.map((s) => ({
      role: "OWNER_PARCEL" as const,
      nickname: s.name,
      surfaceAreaMp: round2(s.area),
      corners: cornersOf(s.corners, s.cornerNumbers),
    })),
    {
      role: "ROAD_PARCEL" as const,
      nickname: roadNickname,
      surfaceAreaMp: round2(road.area),
      corners: cornersOf(road.corners, road.cornerNumbers),
    },
  ];

  return {
    computation,
    properties,
    inputParams: {
      text: b.text,
      order: computation.order,
      road: { corner: road.corner, side: road.side },
      options: { groupDescription, roadNickname },
    },
  };
}
