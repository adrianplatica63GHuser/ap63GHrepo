"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Circle, Polygon, useMap } from "@vis.gl/react-google-maps";
import { useNameOr } from "@/components/record/use-name-or";
import { useMergeDistance } from "@/components/maps/use-merge-distance";
import { PropertyCornerDot, PropertyDrop, SHAPE_COLOR, type PlacedDrop } from "@/components/maps/property-shapes";
import { POINT_RADIUS_M, placeShapes } from "@/lib/geo/map-drops";

/**
 * „Hartă extinsă"'s other properties                                                      (Slice #39.94)
 *
 * Adrian, 2026-10-19: „I would like also to see all the properties on the expanded map". Inside the property form's
 * full-screen map, every property but the one on the form, drawn as „Proprietăți — Hartă" draws a property that is
 * neither selected nor a duplicate: a blue polygon with 4 px corner dots while it is large enough to read, a drop
 * once it is not, crowded drops merged into a numbered drop (`placeShapes`, at the map's own zoom and the browser's
 * „Setări hartă" merge distance). Nothing here takes a click — no bubble, no selection, no zooming drop — so a click
 * passes through to the form's own map, which is where this property's corners are drawn and moved.
 *
 * Loaded when the overlay opens, once per opening (`gcTime: 0`, so the next opening asks again); the „Hartă" tile
 * loads nothing new. A failed load draws no other property and leaves the form's map as it was.
 *
 * Lives inside a `<Map>` — it is handed to `PropertyMiniMap` as its children.
 */

type OtherCorner = { lat: number; lon: number };
type OtherProperty = { id: string; code: string; nickname: string | null; corners: OtherCorner[] };

async function fetchOthers(): Promise<OtherProperty[]> {
  const res = await fetch("/api/properties/map");
  if (!res.ok) throw new Error(`GET /api/properties/map: HTTP ${res.status}`);
  const body = (await res.json()) as { items: OtherProperty[] };
  return body.items;
}

/** The fill a normal property has on „Proprietăți — Hartă": a polygon, and the circle drawn for under three corners. */
const NORMAL_FILL = { polygon: 0.15, circle: 0.35 } as const;

export default function TheaterOthersLayer({ excludeId }: { excludeId?: string | null }) {
  const map = useMap();
  const t = useTranslations("property");
  const nameOr = useNameOr();
  const [mergeDistance] = useMergeDistance();

  // Polygon or drop is decided at the zoom shown, so every zoom change recomputes them.
  const [zoom, setZoom] = useState<number | null>(null);
  useEffect(() => {
    if (!map) return;
    const read = () => setZoom(map.getZoom() ?? null);
    read();
    const listener = map.addListener("zoom_changed", read);
    return () => listener.remove();
  }, [map]);

  const { data } = useQuery<OtherProperty[]>({
    queryKey:             ["properties", "map", "theater-others"],
    queryFn:              fetchOthers,
    staleTime:            0,
    gcTime:               0,
    refetchOnWindowFocus: false,
  });
  const others = useMemo(
    () => (data ?? []).filter((p) => p.id !== excludeId && p.corners.length > 0),
    [data, excludeId],
  );

  if (zoom === null || others.length === 0) return null;
  const placed = placeShapes(others, zoom, mergeDistance);
  const color = SHAPE_COLOR.normal;
  const drops: PlacedDrop<OtherProperty>[] = placed.drops.map((cl) => {
    const ids = cl.items.map((p) => p.id);
    return {
      key:      `${[...ids].sort()[0]}:${ids.length}`,
      items:    cl.items,
      position: { lat: cl.at.lat, lng: cl.at.lon },
      tone:     "normal",
    };
  });

  return (
    <>
      {placed.polygons.map((p) =>
        p.corners.length >= 3 ? (
          <Polygon
            key={p.id}
            paths={p.corners.map((c) => ({ lat: c.lat, lng: c.lon }))}
            strokeColor={color}
            strokeOpacity={1}
            strokeWeight={2}
            fillColor={color}
            fillOpacity={NORMAL_FILL.polygon}
            clickable={false}
          />
        ) : (
          <Circle
            key={p.id}
            center={{ lat: p.corners[0].lat, lng: p.corners[0].lon }}
            radius={POINT_RADIUS_M}
            strokeColor={color}
            strokeOpacity={1}
            strokeWeight={2}
            fillColor={color}
            fillOpacity={NORMAL_FILL.circle}
            clickable={false}
          />
        ),
      )}
      {placed.polygons.flatMap((p) =>
        p.corners.map((corner, idx) => <PropertyCornerDot key={`${p.id}-c${idx}`} corner={corner} color={color} />),
      )}
      {drops.map((drop) => (
        <PropertyDrop
          key={drop.key}
          drop={drop}
          title={
            drop.items.length === 1
              ? nameOr(drop.items[0].nickname, "property")
              : t("corners.theaterOthers", { count: drop.items.length })
          }
          blinkOn
          clickable={false}
        />
      ))}
    </>
  );
}
