"use client";

/**
 * The tarlale on a map: each outline as a dashed grey-green line with no fill, labelled with its code.
 *                                                                                        (Slice #39.68)
 *
 * Drawn on the big map as the „Tarlale" layer (off by default) and on a tarla's page. The outline is
 * `tarla-outline.ts`'s: the tarla's own corners when drawn, else the hull of its properties'. A click on the line or
 * on the label opens the tarla (`onOpen`); nothing else here is clickable, so a click inside a tarla still reaches
 * the properties under it. Labels appear from `TARLA_LABEL_MIN_ZOOM` in (Ask first 2: „from about 6 km down").
 */
import { useEffect, useState } from "react";
import { AdvancedMarker, Polyline, useMap } from "@vis.gl/react-google-maps";
import {
  TARLA_LABEL_MIN_ZOOM,
  TARLA_STROKE,
  TARLA_STROKE_WEIGHT,
  closedRing,
  labelAt,
  type TarlaOutline,
} from "@/lib/geo/tarla-outline";

export type TarlaOnMap = { id: string; indicativ: string; locality: string | null; outline: TarlaOutline };

/** A dashed line: the stroke itself hidden, a short dash repeated along it (the Maps API's own idiom). */
const DASH = {
  icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeColor: TARLA_STROKE, strokeWeight: TARLA_STROKE_WEIGHT, scale: 3 },
  offset: "0",
  repeat: "14px",
};

export function TarlaLayer({
  tarlale,
  onOpen,
  labelsAlways = false,
}: {
  tarlale: readonly TarlaOnMap[];
  onOpen?: (id: string) => void;
  /** A tarla's own page shows its one label at any zoom. */
  labelsAlways?: boolean;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState<number>(() => map?.getZoom() ?? 0);
  useEffect(() => {
    if (!map) return;
    const read = () => setZoom(map.getZoom() ?? 0);
    read();
    const l = map.addListener("zoom_changed", read);
    return () => l.remove();
  }, [map]);
  const showLabels = labelsAlways || zoom >= TARLA_LABEL_MIN_ZOOM;

  return (
    <>
      {tarlale.map((t) => {
        const ring = closedRing(t.outline.path).map((c) => ({ lat: c.lat, lng: c.lon }));
        const at = labelAt(t.outline.path);
        return (
          <span key={t.id} data-tarla-outline={t.indicativ} data-tarla-outline-kind={t.outline.kind} hidden>
            <Polyline
              path={ring}
              strokeOpacity={0}
              strokeWeight={TARLA_STROKE_WEIGHT}
              icons={[DASH]}
              clickable={Boolean(onOpen)}
              onClick={onOpen ? () => onOpen(t.id) : undefined}
              zIndex={1}
            />
            {showLabels && at && (
              <AdvancedMarker
                position={{ lat: at.lat, lng: at.lon }}
                onClick={onOpen ? () => onOpen(t.id) : undefined}
                zIndex={2}
              >
                <div
                  data-tarla-label={t.indicativ}
                  style={{
                    transform: "translateY(-4px)",
                    padding: "1px 6px",
                    borderRadius: 4,
                    border: `1px solid ${TARLA_STROKE}`,
                    background: "rgba(255,255,255,0.85)",
                    color: TARLA_STROKE,
                    fontSize: 12,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    cursor: onOpen ? "pointer" : "default",
                  }}
                >
                  {t.indicativ}
                </div>
              </AdvancedMarker>
            )}
          </span>
        );
      })}
    </>
  );
}
