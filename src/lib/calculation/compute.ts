/**
 * „Calcul drum lateral" — server-side orchestration  (Slice #18.10.diviz; #38.23)
 *
 * Ties the pure parser and geometry together and converts every polygon from
 * Stereo 70 to WGS84 for the map. Server-only: transdatRO reads the Stereo 70
 * correction grid from disk, so the geometry stays authoritative on the server
 * and the client sends only the file's text and the order of the slices.
 *
 * ⚠️ **THE `Division*` TYPES BELOW ARE #18.10'S, KEPT ONLY FOR THE RUNS ALREADY
 * STORED.** `runs.ts` reads a run's `stepsLog` as a `DivisionComputation`, and
 * „Istoricul calculelor" shows it. The function that produced them read the
 * five-section file, which #38.23 retired; #38.25 retires these types together
 * with the history's reading of old runs.
 */

import { stereo70ToWgs84 } from "@/lib/geo/transdatRO";
import { cutIntoSlices, DivisionError, isOrderOf, randomOrder, type S70Point } from "./geometry";
import { parseSideRoadFile } from "./parse";

export type ComputedCorner = {
  lat: number;
  lon: number;
  north: number;
  east: number;
};

export type ComputedOwner = {
  name: string;
  rawLabel: string;
  percent: number;
  fraction: number;
  originalArea: number;
  roadParticipation: number;
  finalArea: number;
  computedArea: number;
  corners: ComputedCorner[];
};

export type ComputedRoad = {
  area: number;
  length: number;
  corners: ComputedCorner[];
};

export type DivisionComputation = {
  orientation: "HORIZONTAL" | "VERTICAL";
  /** Declared orientation from Section #2 (always equals `orientation` here —
   *  a mismatch throws before we get this far). */
  declaredOrientation: "HORIZONTAL" | "VERTICAL";
  /** Road / owner-1 corner from Section #4 (SW / NW / SE / NE). */
  roadCorner: string;
  roadWidth: number;
  totalArea: number;
  lengthSide: number;
  widthSide: number;
  percentTotal: number;
  /** The original big-polygon outline (for the map). */
  bigPolygon: ComputedCorner[];
  owners: ComputedOwner[];
  road: ComputedRoad;
};

function toComputedCorner(p: S70Point): ComputedCorner {
  const { lat, lon } = stereo70ToWgs84(p.north, p.east);
  return { lat, lon, north: p.north, east: p.east };
}

// ---------------------------------------------------------------------------
// Step 2 — the parcel and its slices (#38.23)
// ---------------------------------------------------------------------------

export type ParcelCorner = ComputedCorner & { number: string };

export type ParcelSide = {
  /** The corner numbers at its two ends, in file order: „121", „122". */
  from: string;
  to: string;
  length: number;
};

export type SliceComputation = {
  /** The owner's place in the FILE (0-based) — what `order` lists. */
  owner: number;
  name: string;
  percent: number;
  /** percent × the parcel's area. */
  targetArea: number;
  /** The polygon's own area: the last slice holds the remainder. */
  area: number;
  corners: ComputedCorner[];
};

export type SlicesComputation = {
  corners: ParcelCorner[];
  sides: ParcelSide[];
  parcelArea: number;
  roadWidth: number;
  percentTotal: number;
  /** True when the shares sum to 99.99%: the last slice takes the 0.01%. */
  remainderToLast: boolean;
  /** order[k] is the file index of the owner in slice k. */
  order: number[];
  /** In slice order. */
  slices: SliceComputation[];
};

/**
 * Read the file and cut its parcel into slices in `order` — or, with no order,
 * in a random one (the request: „the order of the slices is random"). Throws
 * `FileRejected` with every problem in the file, or `DivisionError` for an
 * order that is not a permutation of the owners.
 */
export function computeSlicesFromFile(
  text: string,
  order?: unknown,
  random: () => number = Math.random,
): SlicesComputation {
  const file = parseSideRoadFile(text);
  const n = file.owners.length;
  if (order !== undefined && order !== null && !isOrderOf(order, n)) {
    throw new DivisionError(`The order must list each of the ${n} owners exactly once.`);
  }
  const chosen = order === undefined || order === null ? randomOrder(n, random) : order;

  const result = cutIntoSlices(
    file.corners,
    chosen.map((k) => file.owners[k].percent / 100),
  );

  return {
    corners: file.corners.map((c) => ({ ...toComputedCorner(c), number: c.number })),
    sides: file.corners.map((a, i) => {
      const b = file.corners[(i + 1) % file.corners.length];
      return { from: a.number, to: b.number, length: Math.hypot(b.north - a.north, b.east - a.east) };
    }),
    parcelArea: result.parcelArea,
    roadWidth: file.roadWidth,
    percentTotal: file.percentTotal,
    remainderToLast: file.percentTotal !== 100,
    order: chosen,
    slices: result.slices.map((s, k) => ({
      owner: chosen[k],
      name: file.owners[chosen[k]].name,
      percent: file.owners[chosen[k]].percent,
      targetArea: s.targetArea,
      area: s.area,
      corners: s.polygon.map(toComputedCorner),
    })),
  };
}
