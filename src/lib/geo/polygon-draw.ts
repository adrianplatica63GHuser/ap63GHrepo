/**
 * Drawing a polygon by hand on a Google map — the rules, pure.              (Slice #39.08)
 *
 * The new property's mini-map has drawn this way since #18 (`property-mini-map-inner.tsx`); #39.08 moved the
 * behaviour out, unchanged, so the map of all properties' „Suprafața unei zone oarecare" draws „identically"
 * (Adrian's word). The state and the handlers are `usePolygonDraw` (src/components/maps/use-polygon-draw.ts); what
 * each event does to the corner list is here, so jest holds it:
 *   - while drawing, a click on the map adds a corner, and a line follows the cursor from the last corner;
 *   - a click on the first corner, with three or more placed, closes the polygon and ends drawing;
 *   - a click on any other corner is absorbed — no corner on top of a corner;
 *   - „Gata" ends drawing; afterwards a corner can be dragged.
 */

export type DrawCorner = { lat: number; lon: number };
export type DrawPoint = { lat: number; lng: number };

/** A click on the map while drawing: one more corner, at the end. */
export function appendCorner(corners: readonly DrawCorner[], at: DrawPoint): DrawCorner[] {
  return [...corners, { lat: at.lat, lon: at.lng }];
}

/** A corner dragged to `to`; every other corner is the same object. */
export function moveCorner(corners: readonly DrawCorner[], idx: number, to: DrawPoint): DrawCorner[] {
  return corners.map((c, i) => (i === idx ? { lat: to.lat, lon: to.lng } : c));
}

/** A click on corner `idx` while drawing: the first, with three or more placed, closes; any other is absorbed. */
export function cornerClick(idx: number, count: number): "close" | "absorb" {
  return idx === 0 && count >= 3 ? "close" : "absorb";
}

/** The line from the last corner to the cursor — only while drawing, with a corner placed and the cursor known. */
export function previewLine(drawing: boolean, corners: readonly DrawCorner[], cursor: DrawPoint | null): DrawPoint[] | null {
  const last = corners[corners.length - 1];
  return drawing && last && cursor ? [{ lat: last.lat, lng: last.lon }, cursor] : null;
}
