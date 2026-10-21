/**
 * „Calcul drum lateral", step 4 — what „Creează proprietățile" will create  (Slice #38.25)
 *
 * The commit route's decisions, apart from its writes, so the suite can hold
 * them without a database:
 *
 * - **The server recomputes.** The body brings the property, the owners and
 *   the width (#39.79; read from the archive by side-road-source.ts) and the
 *   user's three choices — the order, the road's corner and its side — and
 *   nothing drawn: any polygon, area or corner in the body is never read.
 * - **The road is always created**, beside one property per owner (the request:
 *   „the road plus the owners").
 * - **Corner numbers survive.** A new property's corner that IS one of the
 *   parcel's carries that corner's number from the file; every other corner
 *   has none. The geometry knows which point is which (`cornerIndex`), so
 *   nothing is matched by distance. A number that is not a whole number
 *   („121a") cannot go in `originalIndex`, which is an integer, so that corner
 *   goes in without one.
 * - **Each owner's property names its owner** (#39.79, Ask first 3): the plan
 *   carries the person, and the route links them as „Proprietar". The nickname
 *   stays the owner's name, as before.
 * - **The run can be read and re-run**: `inputParams` holds the property, the
 *   corners used, the owners and the width (`source: "property"`, Ask first 6)
 *   and the three choices, `stepsLog` the figures the screen showed, under
 *   algorithm_type 'SIDE_ROAD'. A run made from #38.23's file holds `text`
 *   instead: the history reads it, and it re-runs no more (Ask first 1).
 */

import { computeSlices, type SlicesComputation } from "./compute";
import type { RoadSide } from "./geometry";
import type { SideRoadInput } from "./side-road-input";
import type { SideRoadSource } from "./side-road-source";

export const SIDE_ROAD_ALGORITHM = "SIDE_ROAD";

/** #18.10's default, kept. */
export const DEFAULT_ROAD_NICKNAME = "Drum comun";

/**
 * Slice 40.26 — Adrian, 2026-10-21: „the nickname assigned to the property should be the name of the person (like
 * today) followed by "(dupa divizare)" (which means "after split"); please use romanian diacritics". One space, lower
 * case, with its ă, and in Romanian whatever the interface's language: it is data in the archive, not a label (Ask
 * first 1). Only properties created from now on carry it; none is renamed (Ask first 3).
 */
export const AFTER_SPLIT_SUFFIX = " (după divizare)";

/** An owner's new property's nickname: the owner's name, then „(după divizare)". */
export function ownerParcelNickname(ownerName: string): string {
  return `${ownerName}${AFTER_SPLIT_SUFFIX}`;
}

export type SideRoadInputParams = SideRoadSource & {
  order: number[];
  road: { corner: number; side: RoadSide };
  options: { groupDescription: string; roadNickname: string };
};

export type PlannedCorner = { lat: number; lon: number; originalIndex: number | null };

export type PlannedProperty = {
  role: "OWNER_PARCEL" | "ROAD_PARCEL";
  /** #39.79: the owner, linked to the new property as „Proprietar"; null for the road. */
  personId: string | null;
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
 * Read the body's choices, recompute from the resolved input, and say what to
 * create. Throws `RoadRejected` or `DivisionError` from the computation for
 * choices that do not fit the parcel, and `CommitRequestInvalid` for a body
 * that is not one. The input has been read and checked by
 * `resolveSideRoadRequest` (side-road-source.ts).
 */
export function planSideRoadCommit(resolved: { input: SideRoadInput; source: SideRoadSource }, body: unknown): CommitPlan {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.groupDescription !== "string" || b.groupDescription.trim().length === 0) {
    throw new CommitRequestInvalid("A group description is required");
  }
  // The order and the road are the user's choices, and nothing is created
  // without both: a missing one is never filled in (a random order, no road).
  if (!Array.isArray(b.order)) throw new CommitRequestInvalid("The order of the owners is required");
  if (b.road === undefined || b.road === null) throw new CommitRequestInvalid("The road's corner and side are required");

  const computation = computeSlices(resolved.input, b.order, Math.random, b.road);
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
      personId: s.personId,
      nickname: ownerParcelNickname(s.name), // Slice 40.26: „<owner> (după divizare)"
      surfaceAreaMp: round2(s.area),
      corners: cornersOf(s.corners, s.cornerNumbers),
    })),
    {
      role: "ROAD_PARCEL" as const,
      personId: null,
      nickname: roadNickname,
      surfaceAreaMp: round2(road.area),
      corners: cornersOf(road.corners, road.cornerNumbers),
    },
  ];

  return {
    computation,
    properties,
    inputParams: {
      ...resolved.source,
      order: computation.order,
      road: { corner: road.corner, side: road.side },
      options: { groupDescription, roadNickname },
    },
  };
}
