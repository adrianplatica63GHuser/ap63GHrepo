"use client";

import "leaflet/dist/leaflet.css";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { MapContainer, Polygon, Popup, TileLayer, CircleMarker } from "react-leaflet";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Corner = { lat: number; lon: number };

type MapProperty = {
  id:       string;
  code:     string;
  nickname: string | null;
  corners:  Corner[];
};

type MapResponse = { items: MapProperty[] };

// ---------------------------------------------------------------------------
// Data fetch
// ---------------------------------------------------------------------------

async function fetchMapData(): Promise<MapResponse> {
  const res = await fetch("/api/properties/map");
  if (!res.ok) throw new Error(`Failed to load map data (${res.status})`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Centroid of a polygon's vertices (simple average). */
function centroid(corners: Corner[]): [number, number] {
  const lat = corners.reduce((s, c) => s + c.lat, 0) / corners.length;
  const lon = corners.reduce((s, c) => s + c.lon, 0) / corners.length;
  return [lat, lon];
}

/** react-leaflet expects [lat, lon] tuples. */
function toLatLng(corners: Corner[]): [number, number][] {
  return corners.map((c) => [c.lat, c.lon]);
}

// ---------------------------------------------------------------------------
// Default map view — centred on Bragadiru, Ilfov
// ---------------------------------------------------------------------------

const DEFAULT_CENTER: [number, number] = [44.37, 25.98];
const DEFAULT_ZOOM = 13;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PropertyMap() {
  const { data, isLoading, isError } = useQuery<MapResponse>({
    queryKey: ["properties", "map"],
    queryFn:  fetchMapData,
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-950 text-zinc-400 text-sm">
        Loading map data…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-950 text-red-400 text-sm">
        Failed to load map data
      </div>
    );
  }

  const items = data?.items ?? [];
  // Properties that have enough corners to render something
  const withGeometry = items.filter((p) => p.corners.length >= 1);

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      style={{ width: "100%", height: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {withGeometry.map((prop) => {
        const label = prop.nickname ?? prop.code;
        const center = centroid(prop.corners);

        return prop.corners.length >= 3 ? (
          // Polygon for parcels with ≥3 corners
          <Polygon
            key={prop.id}
            positions={toLatLng(prop.corners)}
            pathOptions={{
              color:       "#3b82f6",   // blue-500
              fillColor:   "#3b82f6",
              fillOpacity: 0.15,
              weight:      2,
            }}
          >
            <Popup>
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-sm">{label}</span>
                <span className="text-xs text-zinc-500 font-mono">{prop.code}</span>
                <Link
                  href={`/properties/${prop.id}`}
                  className="mt-1 text-xs text-blue-600 hover:underline"
                >
                  Open →
                </Link>
              </div>
            </Popup>
          </Polygon>
        ) : (
          // Circle marker for parcels with 1–2 corners
          <CircleMarker
            key={prop.id}
            center={center}
            radius={8}
            pathOptions={{
              color:       "#3b82f6",
              fillColor:   "#3b82f6",
              fillOpacity: 0.5,
              weight:      2,
            }}
          >
            <Popup>
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-sm">{label}</span>
                <span className="text-xs text-zinc-500 font-mono">{prop.code}</span>
                <Link
                  href={`/properties/${prop.id}`}
                  className="mt-1 text-xs text-blue-600 hover:underline"
                >
                  Open →
                </Link>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
