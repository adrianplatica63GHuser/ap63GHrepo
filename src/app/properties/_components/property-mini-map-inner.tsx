"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AdvancedMarker,
  Map,
  Polygon,
  Polyline,
  useMap,
  useMapsLibrary,
  type MapMouseEvent,
} from "@vis.gl/react-google-maps";
import type { Corner } from "./form-schema";
import {
  computePolygonAngles,
  arcSvgPath,
  arcLabelPosition,
  type AngleArcInfo,
} from "@/lib/geo/angles";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MapTypeId = "roadmap" | "hybrid";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CENTER = { lat: 44.37, lng: 25.98 };
const DEFAULT_ZOOM   = 14;

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

const ARC_RADIUS     = 20; // px
const ARC_LABEL_OFFSET = 8; // px beyond radius

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
        * 0×0 anchor div — AdvancedMarker places the bottom-centre of this div
        * at the lat/lng, which for a 0×0 element is exactly the point itself.
        * The SVG is absolutely positioned with overflow:visible so its (0,0)
        * coincides with the corner and the arc paths radiate outward.
        */}
      <div style={{ width: 0, height: 0, overflow: "visible" }}>
        <svg
          width={0}
          height={0}
          style={{ position: "absolute", overflow: "visible" }}
        >
          {/* Filled sector */}
          <path
            d={path}
            fill="rgba(34,197,94,0.35)"
            stroke="#16a34a"
            strokeWidth={1.5}
          />
          {/* Degree label with white halo for legibility */}
          <text
            x={lp.x}
            y={lp.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={9}
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
};

// ---------------------------------------------------------------------------
// Mini-map inner
// ---------------------------------------------------------------------------

export default function PropertyMiniMapInner({ corners, onChange, readOnly = false, hoveredCornerIdx, onCornerHover, showAngles = false }: Props) {
  const [mapType,     setMapType]     = useState<MapTypeId>("roadmap");
  const [drawing,     setDrawing]     = useState(false);
  const [hoverLatLng, setHoverLatLng] = useState<google.maps.LatLngLiteral | null>(null);

  const positions = corners.map((c) => ({ lat: c.lat, lng: c.lon }));

  // -------------------------------------------------------------------------
  // Exit draw mode
  // -------------------------------------------------------------------------

  const exitDraw = useCallback(() => {
    setDrawing(false);
    setHoverLatLng(null);
  }, []);

  // -------------------------------------------------------------------------
  // Drag an existing corner to a new position
  // -------------------------------------------------------------------------

  const handleDragEnd = useCallback(
    (idx: number, e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      onChange(
        corners.map((c, i) =>
          i === idx
            ? { lat: e.latLng!.lat(), lon: e.latLng!.lng() }
            : c,
        ),
      );
    },
    [corners, onChange],
  );

  // -------------------------------------------------------------------------
  // Map click — add a new corner when in draw mode
  // -------------------------------------------------------------------------

  const handleMapClick = useCallback(
    (e: MapMouseEvent) => {
      if (!drawing) return;
      const ll = e.detail.latLng;
      if (!ll) return;
      onChange([...corners, { lat: ll.lat, lon: ll.lng }]);
    },
    [drawing, corners, onChange],
  );

  // -------------------------------------------------------------------------
  // Mouse move — track cursor position for the draw-mode preview line
  // -------------------------------------------------------------------------

  const handleMouseMove = useCallback(
    (e: MapMouseEvent) => {
      if (!drawing) return;
      setHoverLatLng(e.detail.latLng);
    },
    [drawing],
  );

  // -------------------------------------------------------------------------
  // Preview polyline: last placed corner → cursor (only visible while drawing)
  // -------------------------------------------------------------------------

  const previewPath =
    drawing && corners.length > 0 && hoverLatLng
      ? [
          {
            lat: corners[corners.length - 1].lat,
            lng: corners[corners.length - 1].lon,
          },
          hoverLatLng,
        ]
      : null;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="relative w-full h-full">
      <Map
        defaultCenter={DEFAULT_CENTER}
        defaultZoom={DEFAULT_ZOOM}
        mapTypeId={mapType}
        // mapId is required for AdvancedMarker; use the official Google placeholder in dev
        mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "DEMO_MAP_ID"}
        disableDefaultUI
        gestureHandling="greedy"
        // crosshair cursor signals draw mode to the user
        draggableCursor={!readOnly && drawing ? "crosshair" : undefined}
        style={{ width: "100%", height: "100%" }}
        onClick={readOnly ? undefined : handleMapClick}
        onMousemove={readOnly ? undefined : handleMouseMove}
      >
        <FitBounds corners={corners} />

        {/* Closed polygon fill */}
        {corners.length >= 3 && (
          <Polygon
            paths={positions}
            strokeColor="#3b82f6"
            strokeOpacity={1}
            strokeWeight={2}
            fillColor="#3b82f6"
            fillOpacity={0.15}
          />
        )}

        {/* Corner markers — draggable when not drawing, clickable to close polygon when drawing */}
        {corners.map((c, idx) => {
          const isHighlighted = hoveredCornerIdx === idx;
          return (
            <AdvancedMarker
              key={idx}
              position={{ lat: c.lat, lng: c.lon }}
              // Disable dragging in draw mode or read-only view
              draggable={!readOnly && !drawing}
              onDragEnd={(e) => handleDragEnd(idx, e)}
              onClick={(e) => {
                if (!drawing) return;
                // Clicking the first corner (≥3 corners already placed) closes and exits draw mode
                if (idx === 0 && corners.length >= 3) {
                  e.stop(); // prevent map onClick from also firing
                  exitDraw();
                } else {
                  e.stop(); // absorb click — don't add a corner on top of an existing one
                }
              }}
            >
              {/* Custom dot marker: red normally, blue + ring when highlighted */}
              <div
                onMouseEnter={() => onCornerHover?.(idx)}
                onMouseLeave={() => onCornerHover?.(null)}
                style={{ position: "relative", width: 14, height: 14, cursor: "pointer" }}
              >
                {/* Emphasis ring — same blue, fades in on highlight */}
                <div
                  style={{
                    position:     "absolute",
                    top:          "50%",
                    left:         "50%",
                    transform:    "translate(-50%, -50%)",
                    width:        28,
                    height:       28,
                    borderRadius: "50%",
                    border:       "2.5px solid #3b82f6",
                    opacity:      isHighlighted ? 1 : 0,
                    transition:   "opacity 0.15s",
                    pointerEvents: "none",
                  }}
                />
                {/* Dot */}
                <div
                  style={{
                    width:           14,
                    height:          14,
                    borderRadius:    "50%",
                    backgroundColor: isHighlighted ? "#3b82f6" : "#ef4444",
                    border:          "2px solid white",
                    boxShadow:       "0 1px 4px rgba(0,0,0,0.5)",
                    transition:      "background-color 0.15s",
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
            strokeColor="#3b82f6"
            strokeOpacity={0.6}
            strokeWeight={2}
          />
        )}
      </Map>

      {/* ------------------------------------------------------------------ */}
      {/* STR / SAT toggle — top-right                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="absolute top-2 right-2 z-10 flex overflow-hidden rounded shadow border border-wire">
        {(["roadmap", "hybrid"] as MapTypeId[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setMapType(t)}
            className={[
              "px-2 py-1 text-xs font-semibold tracking-wide transition-colors",
              mapType === t
                ? "bg-cta text-white"
                : "bg-white text-ink hover:bg-canvas",
            ].join(" ")}
          >
            {t === "roadmap" ? "STR" : "SAT"}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Draw mode controls — bottom-left (hidden in read-only view)         */}
      {/* ------------------------------------------------------------------ */}
      {!readOnly && (
      <div className="absolute bottom-2 left-2 z-10 flex items-center gap-2">
        {!drawing ? (
          <button
            type="button"
            onClick={() => setDrawing(true)}
            className="rounded shadow border border-wire bg-white px-2.5 py-1 text-xs font-semibold text-ink hover:bg-canvas transition-colors"
          >
            ✏ Draw
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={exitDraw}
              className="rounded shadow border border-blue-500 bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              ✓ Done
            </button>
            <span className="rounded bg-black/50 px-2 py-0.5 text-xs text-white select-none">
              {corners.length === 0
                ? "Click map to place first corner"
                : corners.length < 3
                  ? "Click map to add corners"
                  : "Click map to add corners · click corner 1 to close"}
            </span>
          </>
        )}
      </div>
      )}
    </div>
  );
}
