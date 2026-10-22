"use client";

import { Check, DraftingCompass, Maximize, PenTool } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  AdvancedMarker,
  AdvancedMarkerAnchorPoint,
  Map,
  Polygon,
  Polyline,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { mapRenderingType } from "@/lib/ui/map-rendering";
import type { Corner } from "./form-schema";
import {
  computePolygonAngles,
  arcSvgPath,
  arcLabelPosition,
  type AngleArcInfo,
} from "@/lib/geo/angles";
import { HelpHint } from "@/components/help/help-hint";
import { MapCameraProbe } from "@/components/maps/map-camera-probe";
import { usePolygonDraw } from "@/components/maps/use-polygon-draw";
import { SHAPE_COLOR } from "@/components/maps/property-shapes";
import { CORNER_DOT_PX } from "@/lib/geo/map-drops";
import type { MapView } from "@/lib/geo/map-focus";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MapTypeId = "roadmap" | "hybrid";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CENTER = { lat: 44.37, lng: 25.98 };
const DEFAULT_ZOOM   = 14;

/**
 * Slice #39.94 — a corner is the big map's dot (Adrian, 2026-10-19: „just the smaller blue dot like on the expanded
 * map"): CORNER_DOT_PX, centred on the corner, in the polygon's colour. Around it a transparent box of the old 14 px
 * dot's size takes the hover, the drag and the closing click, so a 4 px dot is no harder to hit; and a ring of this
 * size, in the dot's colour, singles out the corner whose row is hovered in the corners table.
 */
const CORNER_GRAB_PX = 14;
const CORNER_RING_PX = 12;
/** The polygon's fill, as the big map fills a normal and a selected property. */
const FILL_OPACITY = { normal: 0.15, selected: 0.3 } as const;

// ---------------------------------------------------------------------------
// FitBounds — auto-fits the viewport to the initial corner set on first render
// ---------------------------------------------------------------------------

function FitBounds({ corners }: { corners: Corner[] }) {
  const map    = useMap();
  const core   = useMapsLibrary("core");
  const fitted = useRef(false);

  useEffect(() => {
    if (!map || !core || corners.length === 0 || fitted.current) return;
    const bounds = new core.LatLngBounds();
    corners.forEach((c) => bounds.extend({ lat: c.lat, lng: c.lon }));
    map.fitBounds(bounds, 40);
    fitted.current = true;
  }, [map, core, corners]);

  return null;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// AngleArcMarker — renders one angle arc as an SVG overlay at a corner
// ---------------------------------------------------------------------------

const ARC_RADIUS       = 40; // px  (doubled for readability)
const ARC_LABEL_OFFSET = 16; // px beyond radius (doubled)
// SVG canvas for the arc overlay — large enough to hold arc + label,
// centered on the corner point.
const ARC_HALF = 80;  // half-size in px (doubled to match larger arc)
const ARC_SIZE = ARC_HALF * 2;

function AngleArcMarker({
  corner,
  info,
}: {
  corner: Corner;
  info:   AngleArcInfo;
}) {
  const path  = arcSvgPath(info, ARC_RADIUS);
  const lp    = arcLabelPosition(info, ARC_RADIUS, ARC_LABEL_OFFSET);
  const label = `${Math.round(info.angleDeg)}°`;

  return (
    <AdvancedMarker position={{ lat: corner.lat, lng: corner.lon }}>
      {/*
        * 0×0 anchor div (position:relative) — AdvancedMarker's bottom-centre
        * anchor on a 0×0 element is just the single point at the corner's
        * lat/lng. The SVG is absolutely positioned so its centre (half-size
        * offsets) aligns with that point, giving us (0,0) in SVG coordinates
        * = the corner on screen. The viewBox is centred at (0,0) so the arc
        * paths that start from M 0 0 radiate in the correct direction.
        */}
      <div style={{ position: "relative", width: 0, height: 0, pointerEvents: "none" }}>
        <svg
          width={ARC_SIZE}
          height={ARC_SIZE}
          viewBox={`${-ARC_HALF} ${-ARC_HALF} ${ARC_SIZE} ${ARC_SIZE}`}
          style={{
            position: "absolute",
            top: -ARC_HALF,
            left: -ARC_HALF,
            overflow: "visible",
            pointerEvents: "none",
          }}
        >
          {/* Filled sector */}
          <path
            d={path}
            fill="rgba(34,197,94,0.35)"
            stroke="#16a34a"
            strokeWidth={1.5}
          />
          {/* Degree label — white halo via stroke painted behind fill */}
          <text
            x={lp.x}
            y={lp.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={18}
            fontWeight="bold"
            fill="#15803d"
            stroke="white"
            strokeWidth={2.5}
            paintOrder="stroke"
          >
            {label}
          </text>
        </svg>
      </div>
    </AdvancedMarker>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  corners:           Corner[];
  onChange:          (next: Corner[]) => void;
  readOnly?:         boolean;
  hoveredCornerIdx?: number | null;
  onCornerHover?:    (idx: number | null) => void;
  /** When true, renders a green angle-arc overlay at each polygon corner. */
  showAngles?:       boolean;
  /**
   * Slice #37.38: told the map's zoom on every change, and `null` when the map
   * unmounts. Given only by the form's „Hartă" tile — not by „Hartă extinsă" —
   * so „Proprietăți — Hartă" opens the big map at the tile's zoom.
   */
  onZoomChange?:     (zoom: number | null) => void;
  /**
   * Slice #37.91: given only by the form's „Hartă" tile — the full-screen map
   * opens from the button it draws at the left of the top row, and is the
   * theater overlay in property-form.tsx. The overlay's own map is not given
   * it, so it draws no second door: „Restrânge" and Escape close it.
   */
  onFullScreen?:     () => void;
  /**
   * Slice #38.09: „Arată Unghiuri" / „Ascunde Unghiuri" stands in the map's top
   * row, between „Desenează" and „Străzi | Satelit" — it was in the corners
   * tile's toolbar. Given by both maps, the tile's and „Hartă extinsă"'s, so one
   * state (`showAngles`, the form's) drives it wherever it is drawn. Drawn from
   * three corners, and in view mode too: it changes no data.
   */
  onToggleAngles?:   () => void;
  /**
   * Slice #39.94: the polygon's and its corners' colour — blue on the tile, red („selected", the big map's colour for
   * the property picked out) in „Hartă extinsă", where every other property is drawn blue around it.
   */
  tone?:             "normal" | "selected";
  /**
   * Slice #39.94: where the map opens — „Hartă extinsă" opens on the property at the tile's zoom (`theaterOpenView`).
   * Without it the map fits the corners, as the tile always has.
   */
  initialView?:      MapView | null;
  /** Slice #39.94: the tile's centre each time it comes to rest, `null` when it unmounts. The form's tile only. */
  onCenterChange?:   (center: { lat: number; lng: number } | null) => void;
  /** Slice #39.94: more layers inside the map, drawn under this property — „Hartă extinsă"'s other properties. */
  children?:         ReactNode;
  /**
   * Slice 40.35: „Navighează", on the top row after „Arată unghiuri" (or „Desenează" while there are fewer than three
   * corners) and before „HARTĂ | SATELIT" — it had a row of its own under the map. Given by the form's tile only, not
   * by „Hartă extinsă".
   */
  navigate?:         ReactNode;
};

// ---------------------------------------------------------------------------
// Mini-map inner
// ---------------------------------------------------------------------------

export default function PropertyMiniMapInner({ corners, onChange, readOnly = false, hoveredCornerIdx, onCornerHover, showAngles = false, onZoomChange, onFullScreen, onToggleAngles, tone = "normal", initialView, onCenterChange, children, navigate }: Props) {
  // Slice #32.16: this file had no translator at all, so every one of its
  // controls was English on the Romanian interface. The namespace is
  // `property` rather than `property.map.miniMap` because the STR/SAT toggle
  // is shared word-for-word with the full map (`property.map.type*`) and a
  // second `useTranslations` for two keys is not worth the indirection.
  const t = useTranslations("property");

  const [mapType,     setMapType]     = useState<MapTypeId>("roadmap");
  // Slice #39.08: the drawing — a click adds a corner, a line follows the cursor, the first corner or „Gata" closes,
  // then the corners drag — is shared with the map's „Suprafața unei zone oarecare", unchanged (usePolygonDraw).
  const draw = usePolygonDraw(corners, onChange);
  const { drawing, exitDraw, previewPath } = draw;

  const positions = corners.map((c) => ({ lat: c.lat, lng: c.lon }));
  // Slice #37.38: the box the camera probe writes the centre and zoom onto.
  const boxRef = useRef<HTMLDivElement>(null);
  const shapeColor = SHAPE_COLOR[tone];

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div ref={boxRef} className="relative w-full h-full" data-mini-map>
      <Map
        defaultCenter={initialView?.center ?? DEFAULT_CENTER}
        defaultZoom={initialView?.zoom ?? DEFAULT_ZOOM}
        mapTypeId={mapType}
        // mapId is required for AdvancedMarker; use the official Google placeholder in dev
        mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "DEMO_MAP_ID"}
        // No hardware WebGL 2 → raster up front, not a failed vector attempt and a console.error (FU-275).
        renderingType={mapRenderingType()}
        disableDefaultUI
        gestureHandling="greedy"
        // crosshair cursor signals draw mode to the user
        draggableCursor={!readOnly && drawing ? "crosshair" : undefined}
        style={{ width: "100%", height: "100%" }}
        onClick={readOnly ? undefined : draw.onMapClick}
        onMousemove={readOnly ? undefined : draw.onMouseMove}
      >
        {!initialView && <FitBounds corners={corners} />}
        <MapCameraProbe target={boxRef} onZoom={onZoomChange} onCenter={onCenterChange} />

        {/* Slice #39.94: other layers first, so this property is drawn over them. */}
        {children}

        {/* Closed polygon fill */}
        {corners.length >= 3 && (
          <Polygon
            paths={positions}
            strokeColor={shapeColor}
            strokeOpacity={1}
            strokeWeight={2}
            fillColor={shapeColor}
            fillOpacity={FILL_OPACITY[tone]}
            // A click passes through to the map: while drawing it adds a corner, as before.
            clickable={false}
          />
        )}

        {/* Corner markers — draggable when not drawing, clickable to close polygon when drawing.
            Slice #39.94: the big map's 4 px dot, centred on the corner, in a 14 px grab area. */}
        {corners.map((c, idx) => {
          const isHighlighted = hoveredCornerIdx === idx;
          return (
            <AdvancedMarker
              key={idx}
              position={{ lat: c.lat, lng: c.lon }}
              anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
              zIndex={10}
              // Disable dragging in draw mode or read-only view
              draggable={!readOnly && !drawing}
              onDragEnd={(e) => draw.onDragEnd(idx, e)}
              // While drawing: the first corner (≥3 placed) closes and exits draw mode; any click is absorbed, so the
              // map adds no corner on top of an existing one.
              onClick={(e) => draw.onCornerClick(idx, e)}
            >
              <div
                data-mini-map-corner={idx}
                onMouseEnter={() => onCornerHover?.(idx)}
                onMouseLeave={() => onCornerHover?.(null)}
                style={{ position: "relative", width: CORNER_GRAB_PX, height: CORNER_GRAB_PX, cursor: "pointer" }}
              >
                {/* Emphasis ring — the dot's colour, fades in while the corner's row is hovered */}
                <div
                  style={{
                    position:      "absolute",
                    top:           "50%",
                    left:          "50%",
                    transform:     "translate(-50%, -50%)",
                    width:         CORNER_RING_PX,
                    height:        CORNER_RING_PX,
                    borderRadius:  "50%",
                    border:        `2px solid ${shapeColor}`,
                    opacity:       isHighlighted ? 1 : 0,
                    transition:    "opacity 0.15s",
                    pointerEvents: "none",
                  }}
                />
                {/* Dot */}
                <div
                  data-mini-map-dot=""
                  style={{
                    position:        "absolute",
                    top:             "50%",
                    left:            "50%",
                    transform:       "translate(-50%, -50%)",
                    width:           CORNER_DOT_PX,
                    height:          CORNER_DOT_PX,
                    borderRadius:    "50%",
                    backgroundColor: shapeColor,
                    pointerEvents:   "none",
                  }}
                />
              </div>
            </AdvancedMarker>
          );
        })}

        {/* Angle arc overlays — rendered when showAngles is active */}
        {showAngles && corners.length >= 3 &&
          computePolygonAngles(corners).map((info, idx) => (
            <AngleArcMarker key={`angle-${idx}`} corner={corners[idx]} info={info} />
          ))
        }

        {/* Draw-mode preview line: last corner → mouse cursor */}
        {previewPath && (
          <Polyline
            path={previewPath}
            strokeColor={shapeColor}
            strokeOpacity={0.6}
            strokeWeight={2}
          />
        )}
      </Map>

      {/* ------------------------------------------------------------------ */}
      {/* The top row, right-aligned (Slice #37.91): [full screen] [draw]     */}
      {/* [angles] (#38.09) [navigate] (40.35)                                */}
      {/* [Străzi | Satelit]. While drawing, „Gata" takes „Desenează"'s place */}
      {/* and its hint stands right under the row, which a 440 px tile could  */}
      {/* not hold on one line with it.                                       */}
      {/* ------------------------------------------------------------------ */}
      <div className="absolute top-2 right-2 z-10 flex max-w-[calc(100%-1rem)] flex-col items-end gap-1" data-map-top-row>
        <div className="flex items-center gap-2">
          {/* The help bubbles first, so the three controls stand together. */}
          {!readOnly && !drawing && (
            <>
              <HelpHint hintKey="map-draw-corners" />
              {corners.length > 0 && <HelpHint hintKey="map-drag-corner" />}
            </>
          )}
          {!readOnly && drawing && corners.length >= 3 && <HelpHint hintKey="map-close-polygon" />}
          {/* Lucide's Maximize — corner brackets, Street View's full-screen look. */}
          {onFullScreen && (
            <IconButton
              icon={Maximize}
              label={t("map.miniMap.fullScreen")}
              variant="secondary"
              size="sm"
              onClick={onFullScreen}
            />
          )}
          {/* #37.45 (A066): PenTool / Check, icon-only, the words as the name
              and tooltip. Hidden in read-only view. */}
          {!readOnly && (!drawing ? (
            <IconButton
              icon={PenTool}
              label={t("map.miniMap.draw")}
              variant="secondary"
              size="sm"
              onClick={draw.startDraw}
            />
          ) : (
            <IconButton
              icon={Check}
              label={t("map.miniMap.done")}
              variant="primary"
              size="sm"
              onClick={exitDraw}
            />
          ))}
          {/* Slice #38.09 — #37.45 (A058): DraftingCompass, a toggle — the cta fill
              and `aria-pressed` while the angles show; the name and tooltip follow
              the state. It moved here from the corners tile, with its 3-corner rule. */}
          {onToggleAngles && corners.length >= 3 && (
            <IconButton
              icon={DraftingCompass}
              label={showAngles ? t("corners.hideAngles") : t("corners.showAngles")}
              variant={showAngles ? "primary" : "secondary"}
              size="sm"
              aria-pressed={showAngles}
              onClick={onToggleAngles}
            />
          )}
          {/* Slice 40.35: „Navighează", icon-only and sm like its neighbours, before the map-type switch. */}
          {navigate}
          <div className="flex overflow-hidden rounded shadow border border-wire">
            {/* The loop variable is `id`, not `t`: `t` is the translator now, and a
                `t("…")` written in here against the old name would have compiled
                and called a MapTypeId. */}
            {(["roadmap", "hybrid"] as MapTypeId[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setMapType(id)}
                className={[
                  "px-2 py-1 text-xs font-semibold tracking-wide transition-colors",
                  mapType === id
                    ? "bg-cta text-white"
                    : "bg-white text-ink hover:bg-canvas",
                ].join(" ")}
              >
                {id === "roadmap" ? t("map.typeStreet") : t("map.typeSatellite")}
              </button>
            ))}
          </div>
        </div>
        {!readOnly && drawing && (
          <span className="rounded bg-black/50 px-2 py-0.5 text-right text-xs text-white select-none" data-map-draw-hint>
            {corners.length === 0
              ? t("map.miniMap.hintFirst")
              : corners.length < 3
                ? t("map.miniMap.hintMore")
                : t("map.miniMap.hintClose")}
          </span>
        )}
      </div>
    </div>
  );
}
