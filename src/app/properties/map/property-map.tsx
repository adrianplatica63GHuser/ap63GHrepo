"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Circle,
  InfoWindow,
  Map,
  Polygon,
} from "@vis.gl/react-google-maps";

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

type LatLng = { lat: number; lng: number };

/** Simple centroid: average of all corner coordinates. */
function centroid(corners: Corner[]): LatLng {
  return {
    lat: corners.reduce((s, c) => s + c.lat, 0) / corners.length,
    lng: corners.reduce((s, c) => s + c.lon, 0) / corners.length,
  };
}

function toLatLng(corners: Corner[]): LatLng[] {
  return corners.map((c) => ({ lat: c.lat, lng: c.lon }));
}

// ---------------------------------------------------------------------------
// Map-type toggle
// ---------------------------------------------------------------------------

type MapTypeId = "roadmap" | "hybrid";

function MapTypeToggle({
  value,
  onChange,
}: {
  value:    MapTypeId;
  onChange: (v: MapTypeId) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded shadow border border-zinc-300 bg-white">
      {(["roadmap", "hybrid"] as MapTypeId[]).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={[
            "px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors",
            value === t
              ? "bg-zinc-900 text-white"
              : "text-zinc-700 hover:bg-zinc-100",
          ].join(" ")}
        >
          {t === "roadmap" ? "STR" : "SAT"}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CENTER: LatLng = { lat: 44.37, lng: 25.98 };
const DEFAULT_ZOOM = 13;

// ---------------------------------------------------------------------------
// Selected-property state
// ---------------------------------------------------------------------------

type Selected = {
  id:       string;
  position: LatLng;
  label:    string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PropertyMap() {
  const [mapType,  setMapType]  = useState<MapTypeId>("roadmap");
  const [selected, setSelected] = useState<Selected | null>(null);

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

  const items        = data?.items ?? [];
  const withGeometry = items.filter((p) => p.corners.length >= 1);

  return (
    <div className="relative w-full h-full">
      <Map
        defaultCenter={DEFAULT_CENTER}
        defaultZoom={DEFAULT_ZOOM}
        mapTypeId={mapType}
        disableDefaultUI
        gestureHandling="greedy"
        style={{ width: "100%", height: "100%" }}
        onClick={() => setSelected(null)}
      >
        {withGeometry.map((prop) => {
          const label = prop.nickname ?? prop.code;
          const pos   = centroid(prop.corners);

          return prop.corners.length >= 3 ? (
            // Polygon for parcels with ≥3 corners
            <Polygon
              key={prop.id}
              paths={toLatLng(prop.corners)}
              strokeColor="#3b82f6"
              strokeOpacity={1}
              strokeWeight={2}
              fillColor="#3b82f6"
              fillOpacity={0.15}
              onClick={(e) => {
                e.stop();
                setSelected({ id: prop.id, position: pos, label });
              }}
            />
          ) : (
            // Circle marker for parcels with 1–2 corners
            <Circle
              key={prop.id}
              center={{ lat: prop.corners[0].lat, lng: prop.corners[0].lon }}
              radius={25}
              strokeColor="#3b82f6"
              strokeOpacity={1}
              strokeWeight={2}
              fillColor="#3b82f6"
              fillOpacity={0.5}
              onClick={(e) => {
                e.stop();
                setSelected({ id: prop.id, position: pos, label });
              }}
            />
          );
        })}

        {selected && (
          <InfoWindow
            position={selected.position}
            onCloseClick={() => setSelected(null)}
          >
            <div className="flex flex-col gap-1 px-1 py-0.5">
              <span className="font-semibold text-sm text-zinc-900">
                {selected.label}
              </span>
              <Link
                href={`/properties/${selected.id}`}
                className="text-xs text-blue-600 hover:underline"
              >
                Open →
              </Link>
            </div>
          </InfoWindow>
        )}
      </Map>

      {/* Map-type toggle — STR / SAT */}
      <div className="absolute top-3 right-3 z-10">
        <MapTypeToggle value={mapType} onChange={setMapType} />
      </div>
    </div>
  );
}
