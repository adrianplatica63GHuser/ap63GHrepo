"use client";

/**
 * The map's area tools on the map: the light violet (mauve) polygon, its chosen corners and its area written inside
 * it.                                                                     (Slices #39.07, #39.08)
 *
 * ONE layer for both tools (#39.07 builds it; #39.08 adds only the drawing): `corners` are the polygon's, in order;
 * `provisional` is #39.08's cursor while the polygon is still open — counted as a corner from the third on, so the
 * area grows as the mouse moves (its Ask first 1). Under three corners it draws the chosen dots and the line between
 * them, and no area. The label stands at the polygon's centroid, its font 10 % of the polygon's smaller side on
 * screen — read from its ground extent and the map's zoom, so a zoom resizes it (#39.07's Ask first 1). A crossing
 * order is marked in words, never measured. Nothing here is clickable, and nothing is written.
 */
import { useEffect, useState } from "react";
import { AdvancedMarker, Polygon, Polyline, useMap } from "@vis.gl/react-google-maps";
import {
  AREA_FILL,
  AREA_FILL_OPACITY,
  AREA_INK,
  AREA_STROKE,
  LABEL_MIN_PX,
  formatAreaRo,
  labelFontPx,
  labelPoint,
  metresBox,
  pixelsPerMetre,
  readArea,
  type AreaReading,
} from "@/lib/geo/area-tool";
import type { AffineWgs84ToStereo70, LatLon } from "@/lib/geo/ruler";

export function AreaLayer({
  corners,
  provisional = null,
  affine,
  crossingText,
  showCorners = true,
}: {
  corners: readonly LatLon[];
  provisional?: LatLon | null;
  affine: AffineWgs84ToStereo70 | null;
  crossingText: string;
  /** #39.08 draws its own draggable corners; #39.07 shows the chosen ones here. */
  showCorners?: boolean;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState<number>(() => map?.getZoom() ?? 15);
  useEffect(() => {
    if (!map) return;
    const read = () => setZoom(map.getZoom() ?? 15);
    read();
    const l = map.addListener("zoom_changed", read);
    return () => l.remove();
  }, [map]);

  const shape = provisional && corners.length >= 2 ? [...corners, provisional] : corners;
  const path = shape.map((c) => ({ lat: c.lat, lng: c.lon }));
  const reading: AreaReading = affine ? readArea(affine, shape) : { kind: "none" };
  const at = shape.length >= 3 ? labelPoint(shape) : null;
  let font = LABEL_MIN_PX;
  if (affine && at) {
    const box = metresBox(affine, shape);
    const ppm = pixelsPerMetre(zoom, at.lat);
    font = labelFontPx({ width: box.width * ppm, height: box.height * ppm });
  }

  return (
    <>
      {shape.length >= 3 ? (
        <Polygon
          paths={path}
          strokeColor={AREA_STROKE}
          strokeOpacity={1}
          strokeWeight={2}
          fillColor={AREA_FILL}
          fillOpacity={AREA_FILL_OPACITY}
          clickable={false}
        />
      ) : shape.length === 2 ? (
        <Polyline path={path} strokeColor={AREA_STROKE} strokeOpacity={1} strokeWeight={2} clickable={false} />
      ) : null}
      {showCorners &&
        corners.map((c, i) => (
          <AdvancedMarker key={`${c.lat},${c.lon},${i}`} position={{ lat: c.lat, lng: c.lon }}>
            <div
              data-area-corner={i}
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                backgroundColor: AREA_STROKE,
                border: "2px solid white",
                boxShadow: "0 1px 4px rgba(0,0,0,0.45)",
                pointerEvents: "none",
              }}
            />
          </AdvancedMarker>
        ))}
      {at && reading.kind !== "none" && (
        <AdvancedMarker position={{ lat: at.lat, lng: at.lon }}>
          <div style={{ position: "relative", width: 0, height: 0, pointerEvents: "none" }}>
            <div
              data-area-label={reading.kind}
              data-area-m2={reading.kind === "area" ? reading.m2.toFixed(2) : undefined}
              data-area-font={font}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                transform: "translate(-50%, -50%)",
                whiteSpace: "nowrap",
                color: AREA_INK,
                fontSize: font,
                fontWeight: 700,
                lineHeight: 1.1,
                textShadow: "0 0 3px #fff, 0 0 3px #fff, 0 0 2px #fff",
              }}
            >
              {reading.kind === "area" ? formatAreaRo(reading.m2) : crossingText}
            </div>
          </div>
        </AdvancedMarker>
      )}
    </>
  );
}
