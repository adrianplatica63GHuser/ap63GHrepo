/**
 * „Calcul drum lateral" — server-side orchestration  (Slice #18.10.diviz; #38.23)
 *
 * Ties the pure parser and geometry together and converts every polygon from
 * Stereo 70 to WGS84 for the map. Server-only: transdatRO reads the Stereo 70
 * correction grid from disk, so the geometry stays authoritative on the server
 * and the client sends only the file's text and the order of the slices.
 *
 * #18.10's `Division*` types left with #38.25: a stored 'PARCEL_DIVISION' run
 * is read by the history screen's own mirror of them, and nothing here makes
 * one any more.
 */

import { stereo70ToWgs84 } from "@/lib/geo/transdatRO";
import {
  cutIntoSlices,
  cutWithRoad,
  DivisionError,
  isOrderOf,
  randomOrder,
  RoadRefused,
  sideEnds,
  type RoadRefusal,
  type RoadSide,
  type S70Point,
} from "./geometry";
import { parseSideRoadFile } from "./parse";

export type ComputedCorner = {
  lat: number;
  lon: number;
  north: number;
  east: number;
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
  /** As written in the file. */
  percent: number;
  /**
   * The share the slice is cut to, as a fraction of 1: the file's percent —
   * and, for the last slice of a 99.99% file, plus the missing 0.01%
   * (#38.23's Ask first 3), so its figures add up like everybody else's.
   */
  fraction: number;
  /** fraction × the parcel's area. */
  originalArea: number;
  /** fraction × the road's area; 0 before there is a road. */
  roadShare: number;
  /** What the slice was cut to: fraction × (parcel − road). */
  targetArea: number;
  /** The polygon's own area. */
  area: number;
  corners: ComputedCorner[];
  /**
   * For each of `corners`, the number the file gave it when it IS a corner of
   * the parcel, or null (#38.25). „Creează proprietățile" keeps it on the new
   * property's corner; every other corner has none.
   */
  cornerNumbers: (string | null)[];
};

/** The road, once the user has chosen its corner and side (#38.24). */
export type RoadComputation = {
  /** The chosen corner, by index and by its number in the file. */
  corner: number;
  cornerNumber: string;
  side: RoadSide;
  /** The side it runs along, by its two corners' numbers: „121", „122". */
  from: string;
  to: string;
  width: number;
  length: number;
  area: number;
  corners: ComputedCorner[];
  /** As a slice's (#38.25). */
  cornerNumbers: (string | null)[];
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
  /** Null until the road is chosen. */
  road: RoadComputation | null;
  /** In slice order. */
  slices: SliceComputation[];
};

/** A road that cannot be built — with the owner it fails named, where there is one. */
export class RoadRejected extends Error {
  constructor(readonly refusal: RoadRefusal & { name?: string }) {
    super(`The road cannot be built: ${refusal.code}`);
    this.name = "RoadRejected";
  }
}

export type RoadRequest = { corner: number; side: RoadSide };

function isRoadRequest(x: unknown): x is RoadRequest {
  const r = x as RoadRequest;
  return (
    typeof x === "object" && x !== null &&
    Number.isInteger(r.corner) && r.corner >= 0 && r.corner < 4 &&
    (r.side === "next" || r.side === "previous")
  );
}

/**
 * Read the file and cut its parcel into slices in `order` — or, with no order,
 * in a random one (the request: „the order of the slices is random") — and,
 * when `road` is given, lay the road along that corner's side and turn the
 * slices to meet it (#38.24). Throws `FileRejected` with every problem in the
 * file, `RoadRejected` for a road that cannot be built, or `DivisionError` for
 * a request that is not one.
 */
export function computeSlicesFromFile(
  text: string,
  order?: unknown,
  random: () => number = Math.random,
  road?: unknown,
): SlicesComputation {
  const file = parseSideRoadFile(text);
  const n = file.owners.length;
  if (order !== undefined && order !== null && !isOrderOf(order, n)) {
    throw new DivisionError(`The order must list each of the ${n} owners exactly once.`);
  }
  if (road !== undefined && road !== null && !isRoadRequest(road)) {
    throw new DivisionError("The road must name one of the four corners and the next or previous side.");
  }
  const chosen = order === undefined || order === null ? randomOrder(n, random) : order;

  // The last slice takes whatever the shares leave over (0 at 100%, 0.01% at 99.99%).
  const fractions = chosen.map((k) => file.owners[k].percent / 100);
  fractions[n - 1] = 1 - fractions.slice(0, -1).reduce((s, f) => s + f, 0);

  const corners: ParcelCorner[] = file.corners.map((c) => ({ ...toComputedCorner(c), number: c.number }));
  const base = {
    corners,
    sides: file.corners.map((a, i) => {
      const b = file.corners[(i + 1) % file.corners.length];
      return { from: a.number, to: b.number, length: Math.hypot(b.north - a.north, b.east - a.east) };
    }),
    roadWidth: file.roadWidth,
    percentTotal: file.percentTotal,
    remainderToLast: file.percentTotal !== 100,
    order: chosen,
  };
  const numbers = (indexes: (number | null)[]) => indexes.map((i) => (i === null ? null : file.corners[i].number));
  const sliceOf = (
    k: number,
    s: { fraction: number; targetArea: number; area: number; polygon: S70Point[]; cornerIndex: (number | null)[] },
    parcelArea: number,
    roadShare: number,
  ): SliceComputation => ({
    owner: chosen[k],
    name: file.owners[chosen[k]].name,
    percent: file.owners[chosen[k]].percent,
    fraction: s.fraction,
    originalArea: s.fraction * parcelArea,
    roadShare,
    targetArea: s.targetArea,
    area: s.area,
    corners: s.polygon.map(toComputedCorner),
    cornerNumbers: numbers(s.cornerIndex),
  });

  if (road === undefined || road === null) {
    const result = cutIntoSlices(file.corners, fractions);
    return {
      ...base,
      parcelArea: result.parcelArea,
      road: null,
      slices: result.slices.map((s, k) => sliceOf(k, s, result.parcelArea, 0)),
    };
  }

  let result;
  try {
    result = cutWithRoad(file.corners, fractions, { corner: road.corner, side: road.side, width: file.roadWidth });
  } catch (e) {
    if (e instanceof RoadRefused) {
      const r = e.refusal;
      throw new RoadRejected(r.code === "ownerMissesRoad" ? { ...r, name: file.owners[chosen[r.values.position]].name } : r);
    }
    throw e;
  }
  const [ci, ei] = sideEnds(4, road.corner, road.side);
  return {
    ...base,
    parcelArea: result.parcelArea,
    road: {
      corner: road.corner,
      cornerNumber: file.corners[ci].number,
      side: road.side,
      from: file.corners[ci].number,
      to: file.corners[ei].number,
      width: result.road.width,
      length: result.road.length,
      area: result.road.area,
      corners: result.road.polygon.map(toComputedCorner),
      cornerNumbers: numbers(result.road.cornerIndex),
    },
    slices: result.slices.map((s, k) => sliceOf(k, s, result.parcelArea, s.roadShare)),
  };
}
