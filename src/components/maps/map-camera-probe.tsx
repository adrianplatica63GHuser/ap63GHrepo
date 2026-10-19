"use client";

import { useEffect, type RefObject } from "react";
import { useMap } from "@vis.gl/react-google-maps";

/**
 * Where a Google map is looking, written where a page can read it.
 *                                                              (Slice #37.38)
 *
 * Lives inside a `<Map>`. Each time the map comes to rest (`idle`) it writes
 * its centre and zoom onto `target` as `data-map-center="<lat>,<lng>"` and
 * `data-map-zoom="<zoom>"` — so the e2e case can check that the properties map
 * opened on the Property it was sent to, and at the mini-map's zoom, without
 * reaching into Google's objects — and it hands the zoom to `onZoom` on every
 * change, which is how the mini-map's live zoom reaches the sidebar link.
 * `onZoom(null)` on unmount: a tile that is off has no zoom to offer.
 *
 * Slice #39.94: `onCenter` is handed the centre each time the map comes to
 * rest, and `null` on unmount — where „Hartă extinsă" opens a property that
 * has no corners to centre on.
 */
export function MapCameraProbe({
  target,
  onZoom,
  onCenter,
}: {
  target?:   RefObject<HTMLElement | null>;
  onZoom?:   (zoom: number | null) => void;
  onCenter?: (center: { lat: number; lng: number } | null) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const write = () => {
      const c = map.getCenter();
      const z = map.getZoom();
      const el = target?.current;
      if (el && c) el.dataset.mapCenter = `${c.lat().toFixed(7)},${c.lng().toFixed(7)}`;
      if (el && z !== undefined) el.dataset.mapZoom = String(z);
      if (c) onCenter?.({ lat: c.lat(), lng: c.lng() });
    };
    const report = () => onZoom?.(map.getZoom() ?? null);
    report();
    const idle = map.addListener("idle", write);
    const zoom = map.addListener("zoom_changed", report);
    return () => {
      idle.remove();
      zoom.remove();
      onZoom?.(null);
      onCenter?.(null);
    };
  }, [map, target, onZoom, onCenter]);

  return null;
}
