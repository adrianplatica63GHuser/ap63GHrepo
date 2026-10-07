"use client";

import { useEffect, useState } from "react";
import {
  Map,
  Polygon,
  Polyline,
  AdvancedMarker,
  AdvancedMarkerAnchorPoint,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { mapRenderingType } from "@/lib/ui/map-rendering";
import { CALC_MAP_STYLE } from "@/lib/ui/field-widths";
import { ROAD_COLOR, ownerColor } from "@/lib/calculation/owner-colors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Corner = { lat: number; lon: number };

export type PreviewOwner = {
  label: string;
  corners: Corner[];
  /**
   * The owner's colour (#38.27), from @/lib/calculation/owner-colors — decided
   * by the owner's line in the file, so it travels with the owner on a swap.
   * Left out (a run made before #38.23), the slice's place decides it.
   */
  color?: string;
};

/** A corner of the parcel with the number the data file gave it (#38.23). */
export type NumberedCorner = Corner & { number: string };

type Props = {
  bigPolygon: Corner[];
  owners: PreviewOwner[];
  /** The road, where there is one: #18.10's stored runs have it; #38.23's step 2 has none yet. */
  road?: Corner[];
  /** Write each corner's number beside it (#38.23). */
  numberedCorners?: NumberedCorner[];
  /**
   * Dropping slice `from` on slice `to` (#38.23, drag-to-swap). Given, the
   * owner polygons can be dragged; left out (the history's map), they cannot.
   */
  onSwap?: (from: number, to: number) => void;
  /** The map's accessible name. */
  label?: string;
  /**
   * Step 3's first click (#38.24): given, the corner numbers are buttons on the
   * map and a click on one picks it, by its index in `numberedCorners`.
   */
  onCornerClick?: (corner: number) => void;
  /**
   * Step 3's second click (#38.24): given, every side of the parcel is a line
   * that can be clicked; side i runs from corner i to corner i + 1.
   */
  onSideClick?: (side: number) => void;
  /** The corner already chosen, ringed. */
  chosenCorner?: number | null;
  /** The sides that may be chosen next, drawn thicker. */
  offeredSides?: number[];
};

// The owners' colours and the road's grey live in @/lib/calculation/owner-colors (#38.27).
const ROAD_OUTLINE = "#ffffff";

function toPaths(corners: Corner[]) {
  return corners.map((c) => ({ lat: c.lat, lng: c.lon }));
}

function centroid(corners: Corner[]): { lat: number; lng: number } | null {
  if (corners.length === 0) return null;
  let lat = 0;
  let lng = 0;
  for (const c of corners) {
    lat += c.lat;
    lng += c.lon;
  }
  return { lat: lat / corners.length, lng: lng / corners.length };
}

/**
 * Ray casting, in degrees: over a parcel a few kilometres wide the plane is
 * exact enough to tell which slice a drop landed in.
 */
export function containsPoint(corners: Corner[], lat: number, lon: number): boolean {
  let inside = false;
  for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
    const a = corners[i];
    const b = corners[j];
    if (a.lat > lat !== b.lat > lat && lon < ((b.lon - a.lon) * (lat - a.lat)) / (b.lat - a.lat) + a.lon) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * The side of the ring nearest to a point, when the point is near enough to
 * one to mean it (#38.24): within 4% of the parcel's diagonal. Side i runs from
 * corner i to corner i + 1. Planar, with longitude scaled by cos(latitude).
 */
export function nearestSide(corners: Corner[], lat: number, lon: number): number | null {
  if (corners.length < 2) return null;
  const k = Math.cos((lat * Math.PI) / 180);
  const xy = (c: { lat: number; lon: number }) => ({ x: c.lon * k, y: c.lat });
  const p = xy({ lat, lon });
  const pts = corners.map(xy);
  const xs = pts.map((q) => q.x);
  const ys = pts.map((q) => q.y);
  const reach = 0.04 * Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  let best: number | null = null;
  let bestDistance = Infinity;
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length];
    const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / len2));
    const d = Math.hypot(a.x + t * (b.x - a.x) - p.x, a.y + t * (b.y - a.y) - p.y);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  });
  return bestDistance <= reach ? best : null;
}

/**
 * The owner's colour beside the name (#38.27), so the table and the map read
 * together. Decorative: the name beside it is what the screen reader says.
 */
export function OwnerSwatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      data-owner-color={color}
      className="mr-2 inline-block h-3 w-3 shrink-0 rounded-sm border border-black/20 align-middle dark:border-white/30"
      style={{ backgroundColor: color }}
    />
  );
}

// ---------------------------------------------------------------------------
// Fit-to-bounds helper (must live inside <Map>)
// ---------------------------------------------------------------------------

function FitBounds({ corners }: { corners: Corner[] }) {
  const map = useMap();
  const core = useMapsLibrary("core");
  useEffect(() => {
    if (!map || !core || corners.length === 0) return;
    const bounds = new core.LatLngBounds();
    corners.forEach((c) => bounds.extend({ lat: c.lat, lng: c.lon }));
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const latPad = (ne.lat() - sw.lat()) * 0.08 || 0.0005;
    const lngPad = (ne.lng() - sw.lng()) * 0.08 || 0.0005;
    map.fitBounds(
      new core.LatLngBounds(
        { lat: sw.lat() - latPad, lng: sw.lng() - lngPad },
        { lat: ne.lat() + latPad, lng: ne.lng() + lngPad },
      ),
      0,
    );
  }, [map, core, corners]);
  return null;
}

// ---------------------------------------------------------------------------
// Preview map
// ---------------------------------------------------------------------------

export function PreviewMap({
  bigPolygon,
  owners,
  road = [],
  numberedCorners = [],
  onSwap,
  label,
  onCornerClick,
  onSideClick,
  chosenCorner = null,
  offeredSides = [],
}: Props) {
  // Fit to the PARCEL only: a reorder redraws the slices inside the same
  // outline, and refitting on every swap would jump the map under the user.
  const fitCorners = bigPolygon.length > 0 ? bigPolygon : owners.flatMap((o) => o.corners);

  // ⚠️ **A DRAGGED POLYGON KEEPS WHERE IT WAS DROPPED** — google.maps moves
  // its path itself, and `paths` only re-applies when the prop changes. A drop
  // that lands nowhere (outside every slice, or back on itself) changes no
  // prop, so the slice would stay displaced. Bumping this remounts the
  // polygons at their computed paths after every drop.
  const [dropCount, setDropCount] = useState(0);
  const [dragging, setDragging] = useState<number | null>(null);

  function drop(from: number, e: google.maps.MapMouseEvent) {
    setDragging(null);
    setDropCount((n) => n + 1);
    const at = e.latLng;
    if (!onSwap || !at) return;
    const to = owners.findIndex((o) => containsPoint(o.corners, at.lat(), at.lng()));
    if (to >= 0 && to !== from) onSwap(from, to);
  }

  return (
    <div
      style={CALC_MAP_STYLE}
      data-panel="preview-map"
      role="region"
      aria-label={label}
      className="relative overflow-hidden rounded-md border border-card-rim dark:border-zinc-700"
    >
      <div className="absolute inset-0">
        <Map
          mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "DEMO_MAP_ID"}
          // No WebGL 2 → raster up front, not a failed vector attempt and a console.error (FU-275).
          renderingType={mapRenderingType()}
          defaultCenter={{ lat: 44.37, lng: 25.98 }}
          defaultZoom={15}
          mapTypeId="hybrid"
          disableDefaultUI
          gestureHandling="greedy"
          style={{ width: "100%", height: "100%" }}
          // Step 3's second click (#38.24) has two routes, because neither
          // reaches the map alone everywhere: the side lines below take a
          // click on themselves (while a side is chosen the slices and their
          // names give up the mouse — they sat on the edges and took it); and
          // a click on the map near a side counts too, within reach — but in
          // a raster map (headless Chromium has no WebGL) the markers' layer
          // covers the map and the map's own click never fires.
          onClick={
            onSideClick
              ? (e) => {
                  const at = e.detail.latLng;
                  const side = at ? nearestSide(numberedCorners, at.lat, at.lng) : null;
                  if (side !== null) onSideClick(side);
                }
              : undefined
          }
        >
          <FitBounds corners={fitCorners} />

          {/* Big polygon outline (no fill) */}
          {bigPolygon.length >= 3 && (
            <Polygon
              paths={toPaths(bigPolygon)}
              strokeColor="#111827"
              strokeOpacity={0.9}
              strokeWeight={2}
              fillOpacity={0}
              clickable={false}
            />
          )}



          {/* Owner parcels — draggable onto one another when onSwap is given */}
          {owners.map((o, i) => {
            const color = o.color ?? ownerColor(i);
            return o.corners.length >= 3 ? (
              <Polygon
                key={`${i}-${dropCount}`}
                paths={toPaths(o.corners)}
                strokeColor={color}
                strokeOpacity={1}
                strokeWeight={2}
                fillColor={color}
                fillOpacity={dragging === i ? 0.6 : 0.35}
                // ⚠️ `clickable` must be said: vis.gl infers it from `onClick`
                // alone, and a polygon that is not clickable gets no mouse at
                // all — so `draggable` did nothing and the drag panned the map.
                clickable={Boolean(onSwap)}
                draggable={Boolean(onSwap)}
                zIndex={dragging === i ? 2 : 1}
                onDragStart={() => setDragging(i)}
                onDragEnd={(e) => drop(i, e)}
              />
            ) : null;
          })}

          {/* Road — over the slices, and outlined thick: a 7 m road on a parcel
              a kilometre or more across is a pixel wide, and a grey pixel on
              satellite imagery is nothing at all (#38.24). */}
          {road.length >= 3 && (
            <Polygon
              paths={toPaths(road)}
              strokeColor={ROAD_OUTLINE}
              strokeOpacity={1}
              strokeWeight={4}
              fillColor={ROAD_COLOR}
              fillOpacity={0.9}
              zIndex={4}
              clickable={false}
            />
          )}

          {/* Owner labels at centroids — a second handle for the same drag:
              the name is where a hand reaches for, and the marker sits over
              the polygon, so without this a drag started on it panned the map. */}
          {owners.map((o, i) => {
            const c = centroid(o.corners);
            return c ? (
              <AdvancedMarker
                key={`lbl-${i}-${dropCount}`}
                position={c}
                // Centred ON the point (#38.24). The default anchor is the
                // content's bottom centre, and the old translate(-50%, -50%)
                // left every badge a badge-height above its point — so the
                // corner numbers did not sit on their corners.
                anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
                draggable={Boolean(onSwap)}
                onDragStart={() => setDragging(i)}
                onDragEnd={(e) => drop(i, e)}
              >
                <div
                  style={{
                    background: "rgba(17,24,39,0.85)",
                    color: "white",
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 6px",
                    borderRadius: 4,
                    whiteSpace: "nowrap",
                    cursor: onSwap ? "grab" : undefined,
                    // Only while it is a drag handle. While a side is being
                    // chosen (#38.24) a name sitting on that side — a thin
                    // slice's centroid can — would take the click from the map.
                    pointerEvents: onSwap ? "auto" : "none",
                  }}
                >
                  {o.label}
                </div>
              </AdvancedMarker>
            ) : null;
          })}

          {/* The parcel's sides while step 3's second click is awaited (#38.24):
              the two that may be chosen thicker and yellow, every one of them
              a click target (a wrong one is refused with the right two named). */}
          {onSideClick &&
            numberedCorners.map((c, i) => {
              const next = numberedCorners[(i + 1) % numberedCorners.length];
              const offered = offeredSides.includes(i);
              return (
                <Polyline
                  key={`side-${i}`}
                  path={[{ lat: c.lat, lng: c.lon }, { lat: next.lat, lng: next.lon }]}
                  strokeColor={offered ? "#facc15" : "#ffffff"}
                  strokeOpacity={offered ? 1 : 0.6}
                  strokeWeight={offered ? 8 : 5}
                  zIndex={5}
                  onClick={() => onSideClick(i)}
                />
              );
            })}

          {/* …and each side's name at its middle, a marker — the one click
              target every rendering delivers: the corner badges are markers
              too, and they were the only clicks that reached the screen in
              both the vector and the raster map (#38.24). */}
          {onSideClick &&
            numberedCorners.map((c, i) => {
              const next = numberedCorners[(i + 1) % numberedCorners.length];
              const offered = offeredSides.includes(i);
              return (
                <AdvancedMarker
                  key={`side-name-${i}`}
                  position={{ lat: (c.lat + next.lat) / 2, lng: (c.lon + next.lon) / 2 }}
                  anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
                  zIndex={9}
                  onClick={() => onSideClick(i)}
                >
                  <div
                    style={{
                      background: offered ? "#facc15" : "rgba(255,255,255,0.85)",
                      color: "#111827",
                      border: "1px solid #111827",
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "1px 6px",
                      borderRadius: 4,
                      whiteSpace: "nowrap",
                      cursor: "pointer",
                    }}
                  >
                    {`${c.number}–${next.number}`}
                  </div>
                </AdvancedMarker>
              );
            })}

          {/* The parcel's corners, by the numbers the file gave them (#38.23) —
              buttons for step 3's first click when onCornerClick is given (#38.24). */}
          {numberedCorners.map((c, i) => {
            const chosen = chosenCorner === i;
            return (
              <AdvancedMarker
                key={`corner-${c.number}`}
                position={{ lat: c.lat, lng: c.lon }}
                anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
                zIndex={10}
                onClick={onCornerClick ? () => onCornerClick(i) : undefined}
              >
                <div
                  style={{
                    background: chosen ? "#facc15" : "white",
                    color: "#111827",
                    border: `${chosen ? 3 : 2}px solid #111827`,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "1px 5px",
                    borderRadius: 9999,
                    whiteSpace: "nowrap",
                    cursor: onCornerClick ? "pointer" : undefined,
                    pointerEvents: onCornerClick ? "auto" : "none",
                  }}
                >
                  {c.number}
                </div>
              </AdvancedMarker>
            );
          })}
        </Map>
      </div>
    </div>
  );
}
