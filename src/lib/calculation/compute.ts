/**
 * Diviz — server-side orchestration  (Slice #18.10.diviz)
 *
 * Ties the pure parser + geometry core together and converts every computed
 * polygon from Stereo 70 back to WGS84 (lat/lon) for storage and map display.
 *
 * Server-only: imports transdatRO, which reads the Stereo 70 correction grid
 * from disk. Both the preview and commit API routes call computeDivisionFromFile
 * so the geometry is always computed authoritatively on the server (the client
 * only supplies the raw file text).
 */

import { stereo70ToWgs84 } from "@/lib/geo/transdatRO";
import { computeDivision, type S70Point } from "./geometry";
import { parseDivisionFile } from "./parse";

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
  roadSide: string;
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

export function computeDivisionFromFile(text: string): DivisionComputation {
  const parsed = parseDivisionFile(text);

  const result = computeDivision({
    corners: parsed.corners.map((c) => ({ north: c.north, east: c.east })),
    owners: parsed.owners.map((o) => ({ name: o.name, fraction: o.fraction })),
    roadSide: parsed.roadSide,
    roadWidth: parsed.roadWidth,
  });

  const owners: ComputedOwner[] = result.owners.map((o, i) => ({
    name: o.name,
    rawLabel: parsed.owners[i].rawLabel,
    percent: parsed.owners[i].percent,
    fraction: o.fraction,
    originalArea: o.originalArea,
    roadParticipation: o.roadParticipation,
    finalArea: o.finalArea,
    computedArea: o.computedArea,
    corners: o.polygon.map(toComputedCorner),
  }));

  return {
    orientation: result.orientation,
    roadSide: parsed.roadSide,
    roadWidth: parsed.roadWidth,
    totalArea: result.totalArea,
    lengthSide: result.lengthSide,
    widthSide: result.widthSide,
    percentTotal: parsed.percentTotal,
    bigPolygon: parsed.corners.map((c) => toComputedCorner({ north: c.north, east: c.east })),
    owners,
    road: {
      area: result.roadArea,
      length: result.roadLength,
      corners: result.roadPolygon.map(toComputedCorner),
    },
  };
}
