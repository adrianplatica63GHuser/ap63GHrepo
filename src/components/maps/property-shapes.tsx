"use client";

import { AdvancedMarker, AdvancedMarkerAnchorPoint } from "@vis.gl/react-google-maps";
import { CORNER_DOT_PX, DROP_SIZE, type DropTone } from "@/lib/geo/map-drops";

/**
 * How a property is drawn on a map: its corners, its drop and numbered drop.          (Slice #39.60; shared #39.94)
 *
 * Adrian, 2026-10-16: corners „much smaller … with the colour of the sides (Blue, not red and white)" — 4 px, the
 * polygon's own colour, no ring, drawn only while the polygon is; and, zoomed out, „each Polygon replaced with the
 * symbol of an upside down drop … just one solid colour", the same size at every zoom, crowded drops merged into one
 * „that has a number inside (in white fonts)". What is a drop, and what merges, is `src/lib/geo/map-drops.ts`.
 *
 * Written for „Proprietăți — Hartă" (property-map.tsx) and lifted here by #39.94, when the property form's
 * „Hartă extinsă" began drawing every other property the same way — one drawing, not two copies of it.
 */

/**
 * A shape's colour by what it says, strongest first: selected (red), a duplicate (pink), neither (green) — its sides,
 * its corner dots and its drop.
 *
 * Slice 41.69 — Adrian, 2026-11-03: „the blue hues used for borders and for the area of the property will be replaced
 * with a similar shade of green (darker for sides, lighter for the inside) […] The bubbles […] will change their color
 * from current blue to the shade of green that is now used for the sides of the property; and the white that is used
 * for the contour of the bubbles and for showing the count of properties behind the bubble will be replaced with a hue
 * of Champagne". So the sides are #15803D (green-700, the app's success green) and the inside #22C55E (green-500, the
 * counterpart of the blue-500 it replaces), at the opacities the blue had. Not 41.47's property green #00A84C: champagne
 * on it is 2.6:1 and the count would not read; on #15803D it is 4.1:1 (white on the old #3b82f6 was 3.7:1). Red and
 * pink are unchanged. This is the ONE source: the big map, the „Hartă" tile and „Hartă extinsă" all read it.
 */
export const SHAPE_COLOR: Record<DropTone, string> = { selected: "#ef4444", duplicate: "#ec4899", normal: "#15803D" };

/** Slice 41.69: a shape's inside — lighter than its sides for a normal property; red and pink fill in their own colour. */
export const SHAPE_FILL: Record<DropTone, string> = { selected: "#ef4444", duplicate: "#ec4899", normal: "#22C55E" };

/** Slice 41.69: a drop's outline and its count — champagne on the green, white on the red and the pink as before. */
export const DROP_INK: Record<DropTone, string> = { selected: "#fff", duplicate: "#fff", normal: "#F7E7CE" };

type DotCorner = { lat: number; lon: number };

/** A property polygon's corner: a dot centred ON the corner. `data-corner-marker` is where TC-MAP-02 clicks. */
export function PropertyCornerDot({ corner, color }: { corner: DotCorner; color: string }) {
  return (
    <AdvancedMarker position={{ lat: corner.lat, lng: corner.lon }} anchorPoint={AdvancedMarkerAnchorPoint.CENTER}>
      <div
        data-corner-marker={`${corner.lat},${corner.lon}`}
        style={{
          width:           CORNER_DOT_PX,
          height:          CORNER_DOT_PX,
          borderRadius:    "50%",
          backgroundColor: color,
          pointerEvents:   "none",
        }}
      />
    </AdvancedMarker>
  );
}

/** A drop placed on the map: the properties it covers (one, or a numbered drop's many) and where its tip stands. */
export type PlacedDrop<T extends { id: string }> = {
  key:      string;
  items:    T[];
  position: { lat: number; lng: number };
  tone:     DropTone;
};

/**
 * A drop, its tip on the property's centre (AdvancedMarker's own bottom-centre anchor), or a numbered drop with the
 * count in its ink (`DROP_INK`: champagne on a normal drop since 41.69, white on the red and the pink). Clickable only when the map says so; otherwise a click goes through to the map.
 */
export function PropertyDrop<T extends { id: string }>({
  drop,
  title,
  blinkOn,
  clickable,
  onClick,
}: {
  drop:      PlacedDrop<T>;
  title:     string;
  blinkOn:   boolean;
  clickable: boolean;
  onClick?:  (drop: PlacedDrop<T>) => void;
}) {
  const count = drop.items.length;
  const size = count > 1 ? DROP_SIZE.numbered : DROP_SIZE.single;
  const fontPx = count >= 100 ? 11 : count >= 10 ? 13 : 14;
  return (
    <AdvancedMarker
      position={drop.position}
      title={title}
      zIndex={count > 1 ? 3 : 2}
      onClick={clickable && onClick ? () => onClick(drop) : undefined}
    >
      <div
        data-map-drop={count}
        // The properties it covers — TC-MAP-05 finds its own lots' drops by id.
        data-map-drop-ids={drop.items.map((p) => p.id).join(" ")}
        data-map-drop-tone={drop.tone}
        style={{
          position:      "relative",
          width:         size.w,
          height:        size.h,
          cursor:        clickable ? "pointer" : undefined,
          pointerEvents: clickable ? "auto" : "none",
          filter:        "drop-shadow(0 1px 1.5px rgba(0,0,0,0.35))",
        }}
      >
        <svg width={size.w} height={size.h} viewBox="0 0 24 32" aria-hidden="true" style={{ display: "block" }}>
          <path
            d="M12 0.8C5.8 0.8 0.8 5.8 0.8 12c0 8.4 11.2 19.2 11.2 19.2S23.2 20.4 23.2 12C23.2 5.8 18.2 0.8 12 0.8z"
            fill={SHAPE_COLOR[drop.tone]}
            // A duplicate blinks as its polygon does (#39.60: „pink applies to the drop as it does to the polygon").
            fillOpacity={drop.tone === "duplicate" && !blinkOn ? 0.35 : 1}
            stroke={DROP_INK[drop.tone]}
            strokeWidth={1.4}
            data-map-drop-ink=""
          />
        </svg>
        {count > 1 && (
          <span
            aria-hidden="true"
            data-map-drop-count=""
            style={{
              position:      "absolute",
              left:          0,
              top:           0,
              width:         size.w,
              height:        size.w,
              lineHeight:    `${size.w}px`,
              textAlign:     "center",
              color:         DROP_INK[drop.tone],
              fontWeight:    700,
              fontSize:      fontPx,
              pointerEvents: "none",
            }}
          >
            {count}
          </span>
        )}
      </div>
    </AdvancedMarker>
  );
}
