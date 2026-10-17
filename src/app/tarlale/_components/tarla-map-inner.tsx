"use client";

/**
 * A tarla's map: its outline — the drawn corners, else the shape around its properties — and its properties under
 * it, light blue.                                                                        (Slice #39.68)
 *
 * The outline follows the page's corner editor as it is edited, before „Salvează". Nothing here is clickable: the
 * tarla is the page itself. Fitted once to the outline (or, with none, to the properties) when the data arrives.
 */
import { useEffect, useRef } from "react";
import { Map, Polygon, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { useTranslations } from "next-intl";
import { mapRenderingType } from "@/lib/ui/map-rendering";
import { TarlaLayer } from "@/components/maps/tarla-layer";
import { tarlaOutline, type LatLon } from "@/lib/geo/tarla-outline";

const DEFAULT_CENTER = { lat: 44.37, lng: 25.98 };
const DEFAULT_ZOOM = 13;

function FitOnce({ points }: { points: readonly LatLon[] }) {
  const map = useMap();
  const core = useMapsLibrary("core");
  const done = useRef(false);
  useEffect(() => {
    if (!map || !core || done.current || points.length === 0) return;
    const bounds = new core.LatLngBounds();
    for (const p of points) bounds.extend({ lat: p.lat, lng: p.lon });
    map.fitBounds(bounds, 40);
    done.current = true;
  }, [map, core, points]);
  return null;
}

export default function TarlaMapInner({
  id,
  indicativ,
  locality,
  own,
  properties,
}: {
  id: string;
  indicativ: string;
  locality: string | null;
  own: readonly LatLon[];
  properties: readonly { id: string; corners: readonly LatLon[] }[];
}) {
  const t = useTranslations("tarla.detail");
  const outline = tarlaOutline(own, properties.map((p) => p.corners));
  const fitTo = outline.kind !== "none" ? outline.path : properties.flatMap((p) => p.corners);
  return (
    <div className="relative h-full w-full" data-tarla-map="" data-tarla-map-outline={outline.kind}>
      <Map
        defaultCenter={DEFAULT_CENTER}
        defaultZoom={DEFAULT_ZOOM}
        mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "DEMO_MAP_ID"}
        renderingType={mapRenderingType()}
        gestureHandling="greedy"
        disableDefaultUI
        zoomControl
        style={{ width: "100%", height: "100%" }}
      >
        <FitOnce points={fitTo} />
        {properties
          .filter((p) => p.corners.length >= 3)
          .map((p) => (
            <Polygon
              key={p.id}
              paths={p.corners.map((c) => ({ lat: c.lat, lng: c.lon }))}
              strokeColor="#3b82f6"
              strokeOpacity={0.8}
              strokeWeight={1}
              fillColor="#3b82f6"
              fillOpacity={0.12}
              clickable={false}
            />
          ))}
        {outline.kind !== "none" && <TarlaLayer tarlale={[{ id, indicativ, locality, outline }]} labelsAlways />}
      </Map>
      {outline.kind === "none" && (
        <p className="absolute inset-x-0 top-2 mx-3 rounded bg-white/90 px-2 py-1 text-xs text-fade" role="status">
          {t("mapNone")}
        </p>
      )}
    </div>
  );
}
