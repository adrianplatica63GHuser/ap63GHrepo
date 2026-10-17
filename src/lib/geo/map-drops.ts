/**
 * The big map's drops and numbered drops                          (Slice #39.60)
 *
 * On the map of all properties a property is its polygon while that polygon is large enough to read, and a drop —
 * a solid pin in the polygon's blue, the same size at every zoom — once it is not. Drops that crowd each other merge
 * into a numbered drop counting every property it covers, and zooming in undoes each step. This module is the part
 * of that which needs no React and no Google Maps: where a property sits on screen at a zoom, whether it is a drop
 * there, how drops merge, and what a numbered drop's click does.
 *
 * Adrian, 2026-10-16 (the research doc „GA40 research: map, juridical persons, tarla, lists"): drops merge „when they
 * are within about 40 px, not at 25% overlap" — the overlap rule left 69 numbered drops at about 15 km on the dev
 * data, still overlapping; 40 px left 36 — and „let's make it a setting" (`MERGE_DISTANCE`, kept per browser by
 * `use-merge-distance.ts`). A numbered drop's click zooms in, „agree with recommended".
 *
 * ⚠️ **NOT A CLUSTERING LIBRARY** (#39.60's Ask first 1). supercluster merges once per whole zoom on its own grid and
 * @googlemaps/markerclusterer's algorithms are grid or supercluster approximations; neither can say „merge,
 * repeatedly, until no two drops are closer than N px" at the map's fractional zoom, which is the rule agreed. So
 * `mergeDrops` is that rule written out, and its test holds it to it.
 *
 * PURE MODULE — no React, no DOM, no `google.maps`. Unit-tested in `src/__tests__/map-drops.test.ts`.
 */

import { MAX_FOCUS_ZOOM, zoomToFitCorners } from "@/lib/geo/map-focus";

export type DropCorner = { lat: number; lon: number };

/** A property's bounding box, in degrees. */
export type DropBox = { south: number; west: number; north: number; east: number };

/** A point in Google's world pixels at a given zoom (256 px for the whole world at zoom 0). */
export type WorldPoint = { x: number; y: number };

/**
 * Below this many pixels for the LARGER side of its bounding box, a property is a drop. A constant, not a setting
 * (#39.60's Ask first 3). Decided per property, on its own size: a large field stays a polygon long after a small
 * lot beside it has become a drop.
 */
export const DROP_SWITCH_PX = 24;

/** The merge distance — drops closer than this many pixels merge. The setting „Setări hartă" holds it, per browser. */
export const MERGE_DISTANCE = { min: 20, max: 80, step: 5, default: 40 } as const;

/** A drop and a numbered drop, in CSS pixels, the same at every zoom. */
export const DROP_SIZE = { single: { w: 22, h: 30 }, numbered: { w: 30, h: 40 } } as const;

/** A polygon's corner: a dot of the polygon's own colour, no ring (Adrian: „4 px, not 2.4 px"). */
export const CORNER_DOT_PX = 4;

/**
 * A property of fewer than three corners is drawn as a circle of this radius around its first corner (property-map
 * .tsx, since #15.12), so its box is that circle's, and it is a drop only while the circle is small on screen.
 */
export const POINT_RADIUS_M = 25;

const WORLD_PX = 256;
const M_PER_DEG_LAT = 111_320;

/** The world point of a latitude and longitude at `zoom` — Web Mercator, as Google draws. */
export function worldPoint(lat: number, lon: number, zoom: number): WorldPoint {
  const scale = WORLD_PX * 2 ** zoom;
  const sin = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  return {
    x: ((lon + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

/** The latitude and longitude of a world point at `zoom` — `worldPoint`'s inverse. */
export function worldToLatLon(p: WorldPoint, zoom: number): DropCorner {
  const scale = WORLD_PX * 2 ** zoom;
  const n = Math.PI - (2 * Math.PI * p.y) / scale;
  return {
    lat: (180 / Math.PI) * Math.atan(Math.sinh(n)),
    lon: (p.x / scale) * 360 - 180,
  };
}

/**
 * The box a property is drawn in: its corners' bounding box, or, below three corners, the box of the circle drawn
 * around its first. `null` with no corners.
 */
export function shapeBox(corners: readonly DropCorner[]): DropBox | null {
  if (corners.length === 0) return null;
  if (corners.length < 3) {
    const { lat, lon } = corners[0];
    const dLat = POINT_RADIUS_M / M_PER_DEG_LAT;
    const dLon = POINT_RADIUS_M / (M_PER_DEG_LAT * Math.max(Math.cos((lat * Math.PI) / 180), 1e-6));
    return { south: lat - dLat, west: lon - dLon, north: lat + dLat, east: lon + dLon };
  }
  let south = Infinity, north = -Infinity, west = Infinity, east = -Infinity;
  for (const c of corners) {
    south = Math.min(south, c.lat); north = Math.max(north, c.lat);
    west = Math.min(west, c.lon); east = Math.max(east, c.lon);
  }
  return { south, west, north, east };
}

/** The box's centre — where the property's drop stands (its tip). For a circle, the corner it is drawn around. */
export function boxCentre(box: DropBox): DropCorner {
  return { lat: (box.south + box.north) / 2, lon: (box.west + box.east) / 2 };
}

/** The box around several boxes — what a numbered drop's click fits. `null` with none. */
export function unionBox(boxes: readonly DropBox[]): DropBox | null {
  if (boxes.length === 0) return null;
  return boxes.reduce((u, b) => ({
    south: Math.min(u.south, b.south),
    west:  Math.min(u.west, b.west),
    north: Math.max(u.north, b.north),
    east:  Math.max(u.east, b.east),
  }));
}

/** The larger side of the box on screen at `zoom`, in pixels. */
export function boxSidePx(box: DropBox, zoom: number): number {
  const a = worldPoint(box.south, box.west, zoom);
  const b = worldPoint(box.north, box.east, zoom);
  return Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
}

/** Whether a property in this box is drawn as a drop at `zoom`. */
export function isDrop(box: DropBox, zoom: number): boolean {
  return boxSidePx(box, zoom) < DROP_SWITCH_PX;
}

/**
 * A stored or typed merge distance, made one the setting allows: a number, on the step, between min and max.
 * Anything unreadable is the default.
 */
export function clampMergeDistance(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return MERGE_DISTANCE.default;
  const stepped = Math.round(n / MERGE_DISTANCE.step) * MERGE_DISTANCE.step;
  return Math.min(MERGE_DISTANCE.max, Math.max(MERGE_DISTANCE.min, stepped));
}

export type DropPoint<T> = { x: number; y: number; item: T };
export type DropCluster<T> = { x: number; y: number; items: T[] };

/**
 * Drops closer than `distancePx` merge, repeatedly, so counts add up: a merged drop stands at its members' centre
 * (each member weighing one) and may then be close enough to merge again. Ends when no two drops are closer than
 * `distancePx` — the postcondition the test holds it to. Deterministic: the same points give the same drops.
 *
 * Each pass sorts by x and compares a drop only with those less than `distancePx` to its right, so it is close to
 * linear for drops spread over a map; a pass that merges nothing ends it, and every other pass removes a drop, so
 * there are at most as many passes as points.
 */
export function mergeDrops<T>(points: readonly DropPoint<T>[], distancePx: number): DropCluster<T>[] {
  let clusters: DropCluster<T>[] = points.map((p) => ({ x: p.x, y: p.y, items: [p.item] }));
  if (!(distancePx > 0)) return clusters;
  for (let pass = 0; pass <= points.length; pass++) {
    clusters.sort((a, b) => a.x - b.x || a.y - b.y);
    const used = new Array<boolean>(clusters.length).fill(false);
    const out: DropCluster<T>[] = [];
    let changed = false;
    for (let i = 0; i < clusters.length; i++) {
      if (used[i]) continue;
      let c = clusters[i];
      // `c.x` only moves right as members join (every later drop has x ≥ clusters[i].x), so once a drop is
      // `distancePx` to its right in x, every drop after it is too.
      for (let j = i + 1; j < clusters.length && clusters[j].x - c.x < distancePx; j++) {
        if (used[j]) continue;
        const o = clusters[j];
        if (Math.hypot(o.x - c.x, o.y - c.y) >= distancePx) continue;
        const n1 = c.items.length, n2 = o.items.length;
        c = {
          x: (c.x * n1 + o.x * n2) / (n1 + n2),
          y: (c.y * n1 + o.y * n2) / (n1 + n2),
          items: [...c.items, ...o.items],
        };
        used[j] = true;
        changed = true;
      }
      out.push(c);
    }
    clusters = out;
    if (!changed) break;
  }
  return clusters;
}

/** What a drop's colour says, strongest first: one of its properties is selected; is a duplicate; neither. */
export type DropTone = "selected" | "duplicate" | "normal";

export function dropTone(ids: readonly string[], isSelected: (id: string) => boolean, isDuplicate: (id: string) => boolean): DropTone {
  if (ids.some(isSelected)) return "selected";
  if (ids.some(isDuplicate)) return "duplicate";
  return "normal";
}

/**
 * The zoom a numbered drop's click goes to: the largest whole zoom at which its properties' boxes fit the map box
 * less `paddingPx` on each side, capped at the map's closest. `null` with no boxes.
 */
export function numberedDropZoom(boxes: readonly DropBox[], widthPx: number, heightPx: number, paddingPx = 60): number | null {
  if (boxes.length === 0) return null;
  const corners: DropCorner[] = boxes.flatMap((b) => [
    { lat: b.south, lon: b.west },
    { lat: b.north, lon: b.east },
  ]);
  return zoomToFitCorners(corners, widthPx, heightPx, paddingPx);
}

/**
 * A numbered drop's click (Adrian: „zoom in (recommended)"): it zooms to fit its properties — unless the map is
 * already at its closest, or fitting them would not take it closer, and then it opens the list of them, the bubble a
 * polygon's click opens.
 */
export function numberedDropAction(currentZoom: number, targetZoom: number | null): "zoom" | "list" {
  if (currentZoom >= MAX_FOCUS_ZOOM - 1e-6) return "list";
  if (targetZoom === null || targetZoom <= currentZoom + 1e-6) return "list";
  return "zoom";
}
