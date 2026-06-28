"use client";

import { useEffect } from "react";
import { Map, Polygon, AdvancedMarker, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Corner = { lat: number; lon: number };

export type PreviewOwner = {
  label: string;
  corners: Corner[];
};

type Props = {
  bigPolygon: Corner[];
  owners: PreviewOwner[];
  road: Corner[];
};

// Distinct fill colours for the owner parcels (cycled if there are more).
const OWNER_COLORS = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#a855f7", // purple
  "#ec4899", // pink
  "#14b8a6", // teal
  "#ef4444", // red
  "#6366f1", // indigo
];

const ROAD_COLOR = "#6b7280"; // gray

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

export function PreviewMap({ bigPolygon, owners, road }: Props) {
  const allCorners = [
    ...bigPolygon,
    ...owners.flatMap((o) => o.corners),
    ...road,
  ];

  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-md border border-card-rim dark:border-zinc-700">
      <div className="absolute inset-0">
        <Map
          mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "DEMO_MAP_ID"}
          defaultCenter={{ lat: 44.37, lng: 25.98 }}
          defaultZoom={15}
          mapTypeId="hybrid"
          disableDefaultUI
          gestureHandling="greedy"
          style={{ width: "100%", height: "100%" }}
        >
          <FitBounds corners={allCorners} />

          {/* Big polygon outline (no fill) */}
          {bigPolygon.length >= 3 && (
            <Polygon
              paths={toPaths(bigPolygon)}
              strokeColor="#111827"
              strokeOpacity={0.9}
              strokeWeight={2}
              fillOpacity={0}
            />
          )}

          {/* Road */}
          {road.length >= 3 && (
            <Polygon
              paths={toPaths(road)}
              strokeColor={ROAD_COLOR}
              strokeOpacity={1}
              strokeWeight={2}
              fillColor={ROAD_COLOR}
              fillOpacity={0.55}
            />
          )}

          {/* Owner parcels */}
          {owners.map((o, i) => {
            const color = OWNER_COLORS[i % OWNER_COLORS.length];
            return o.corners.length >= 3 ? (
              <Polygon
                key={i}
                paths={toPaths(o.corners)}
                strokeColor={color}
                strokeOpacity={1}
                strokeWeight={2}
                fillColor={color}
                fillOpacity={0.35}
              />
            ) : null;
          })}

          {/* Owner labels at centroids */}
          {owners.map((o, i) => {
            const c = centroid(o.corners);
            return c ? (
              <AdvancedMarker key={`lbl-${i}`} position={c}>
                <div
                  style={{
                    transform: "translate(-50%, -50%)",
                    background: "rgba(17,24,39,0.85)",
                    color: "white",
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 6px",
                    borderRadius: 4,
                    whiteSpace: "nowrap",
                    pointerEvents: "none",
                  }}
                >
                  {o.label}
                </div>
              </AdvancedMarker>
            ) : null;
          })}
        </Map>
      </div>
    </div>
  );
}
