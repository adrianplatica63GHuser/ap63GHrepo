"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Polygon,
  TileLayer,
  useMap,
} from "react-leaflet";
import type { Corner } from "./form-schema";

const DEFAULT_CENTER: [number, number] = [44.37, 25.98];
const DEFAULT_ZOOM = 14;

function FitBounds({ corners }: { corners: Corner[] }) {
  const map = useMap();
  useEffect(() => {
    if (corners.length === 0) return;
    const bounds = L.latLngBounds(corners.map((c) => [c.lat, c.lon] as [number, number]));
    map.fitBounds(bounds, { padding: [24, 24] });
  }, [corners, map]);
  return null;
}

export default function PropertyMiniMapInner({ corners }: { corners: Corner[] }) {
  const positions: [number, number][] = corners.map((c) => [c.lat, c.lon]);

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      style={{ width: "100%", height: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds corners={corners} />
      {corners.length >= 3 && (
        <Polygon
          positions={positions}
          pathOptions={{
            color: "#3b82f6",
            fillColor: "#3b82f6",
            fillOpacity: 0.15,
            weight: 2,
          }}
        />
      )}
      {corners.map((c, i) => (
        <CircleMarker
          key={i}
          center={[c.lat, c.lon]}
          radius={5}
          pathOptions={{
            color: "#1d4ed8",
            fillColor: "#3b82f6",
            fillOpacity: 0.9,
            weight: 1.5,
          }}
        />
      ))}
    </MapContainer>
  );
}
