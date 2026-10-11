"use client";

/**
 * Drawing a polygon by hand on a Google map — the new property's way, shared.            (Slice #39.08)
 *
 * The state and the handlers the property's mini-map has had since #18 (`property-mini-map-inner.tsx`), moved here
 * unchanged so the map of all properties' „Suprafața unei zone oarecare" draws „identically" (Adrian's word). What
 * each event does to the corners is pure, in `@/lib/geo/polygon-draw`. Each map draws its corners and its line its
 * own way and in its own colour; this hook owns only the drawing state and the handlers.
 */
import { useCallback, useState } from "react";
import type { MapMouseEvent } from "@vis.gl/react-google-maps";
import {
  appendCorner,
  cornerClick,
  moveCorner,
  previewLine,
  type DrawCorner,
  type DrawPoint,
} from "@/lib/geo/polygon-draw";

export type { DrawCorner };

export function usePolygonDraw(corners: readonly DrawCorner[], onChange: (next: DrawCorner[]) => void) {
  const [drawing, setDrawing] = useState(false);
  const [hover, setHover] = useState<DrawPoint | null>(null);

  const startDraw = useCallback(() => setDrawing(true), []);
  const exitDraw = useCallback(() => {
    setDrawing(false);
    setHover(null);
  }, []);

  /** A click on the map adds a corner, while drawing. */
  const onMapClick = useCallback(
    (e: MapMouseEvent) => {
      if (!drawing) return;
      const ll = e.detail.latLng;
      if (!ll) return;
      onChange(appendCorner(corners, ll));
    },
    [drawing, corners, onChange],
  );

  /** The cursor, for the line from the last corner, while drawing. */
  const onMouseMove = useCallback(
    (e: MapMouseEvent) => {
      if (!drawing) return;
      setHover(e.detail.latLng);
    },
    [drawing],
  );

  /** A corner dragged to a new place (the markers are draggable only when not drawing). */
  const onDragEnd = useCallback(
    (idx: number, e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      onChange(moveCorner(corners, idx, { lat: e.latLng.lat(), lng: e.latLng.lng() }));
    },
    [corners, onChange],
  );

  /** A click on a corner while drawing: absorbed, so the map adds no corner on top; the first (3+) also closes. */
  const onCornerClick = useCallback(
    (idx: number, e: { stop: () => void }) => {
      if (!drawing) return;
      e.stop();
      if (cornerClick(idx, corners.length) === "close") exitDraw();
    },
    [drawing, corners.length, exitDraw],
  );

  return {
    drawing,
    hover,
    startDraw,
    exitDraw,
    onMapClick,
    onMouseMove,
    onDragEnd,
    onCornerClick,
    previewPath: previewLine(drawing, corners, hover),
  };
}
