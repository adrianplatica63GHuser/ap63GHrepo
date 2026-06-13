"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AdvancedMarker,
  Circle,
  InfoWindow,
  Map,
  Polygon,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Corner = { lat: number; lon: number };

type MapProperty = {
  id:       string;
  code:     string;
  nickname: string | null;
  corners:  Corner[];
};

type MapResponse = { items: MapProperty[] };

type LatLng = { lat: number; lng: number };

type Selected = {
  id:       string;
  position: LatLng;
  label:    string;
};

type PixelPoint = { x: number; y: number };

// ---------------------------------------------------------------------------
// Data fetch
// ---------------------------------------------------------------------------

async function fetchMapData(): Promise<MapResponse> {
  const res = await fetch("/api/properties/map");
  if (!res.ok) throw new Error(`Failed to load map data (${res.status})`);
  return res.json();
}

async function batchDeleteProperties(ids: string[]): Promise<{ deleted: number }> {
  const res = await fetch("/api/properties/batch-delete", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ ids }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Delete failed (${res.status})${text ? `: ${text}` : ""}`);
  }
  return res.json() as Promise<{ deleted: number }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function centroid(corners: Corner[]): LatLng {
  return {
    lat: corners.reduce((s, c) => s + c.lat, 0) / corners.length,
    lng: corners.reduce((s, c) => s + c.lon, 0) / corners.length,
  };
}

function toLatLng(corners: Corner[]): LatLng[] {
  return corners.map((c) => ({ lat: c.lat, lng: c.lon }));
}

/**
 * Convert a pixel position within the map container to a LatLng coordinate.
 * Uses linear interpolation against the map's current viewport bounds.
 * Accurate enough for the small geographic area this app covers (~1° × 1°).
 */
function pixelToLatLng(
  map:       google.maps.Map,
  container: HTMLDivElement,
  x:         number,
  y:         number,
): LatLng {
  const bounds = map.getBounds();
  if (!bounds) return { lat: 0, lng: 0 };
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  return {
    lat: ne.lat() - (y / container.clientHeight) * (ne.lat() - sw.lat()),
    lng: sw.lng() + (x / container.clientWidth)  * (ne.lng() - sw.lng()),
  };
}

/** True if at least one corner of `prop` lies within the lat/lng rectangle. */
function propertyInRect(
  prop:  MapProperty,
  swLat: number,
  swLng: number,
  neLat: number,
  neLng: number,
): boolean {
  return prop.corners.some(
    (c) => c.lat >= swLat && c.lat <= neLat && c.lon >= swLng && c.lon <= neLng,
  );
}

// ---------------------------------------------------------------------------
// Map-type toggle
// ---------------------------------------------------------------------------

type MapTypeId = "roadmap" | "hybrid";

function MapTypeToggle({
  value,
  onChange,
}: {
  value:    MapTypeId;
  onChange: (v: MapTypeId) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded shadow border border-wire bg-white">
      {(["roadmap", "hybrid"] as MapTypeId[]).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={[
            "px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors",
            value === t
              ? "bg-cta text-white"
              : "text-ink hover:bg-canvas",
          ].join(" ")}
        >
          {t === "roadmap" ? "STR" : "SAT"}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FitAllProperties — inner component (must live inside <Map>)
// ---------------------------------------------------------------------------
//
// On first render, once the map instance and core library are ready, expands
// the viewport to show ALL property corners with a 5 % margin on each edge.
// The `fitted` ref ensures this only runs once per map mount.

function FitAllProperties({ items }: { items: MapProperty[] }) {
  const map    = useMap();
  const core   = useMapsLibrary("core");
  const fitted = useRef(false);

  useEffect(() => {
    if (!map || !core || fitted.current) return;
    const allCorners = items.flatMap((p) => p.corners);
    if (allCorners.length === 0) return;

    const bounds = new core.LatLngBounds();
    allCorners.forEach((c) => bounds.extend({ lat: c.lat, lng: c.lon }));

    // Pad each edge by 5 % of the total span
    const ne     = bounds.getNorthEast();
    const sw     = bounds.getSouthWest();
    const latPad = (ne.lat() - sw.lat()) * 0.05;
    const lngPad = (ne.lng() - sw.lng()) * 0.05;

    const padded = new core.LatLngBounds(
      { lat: sw.lat() - latPad, lng: sw.lng() - lngPad },
      { lat: ne.lat() + latPad, lng: ne.lng() + lngPad },
    );

    map.fitBounds(padded, 0);
    fitted.current = true;
  }, [map, core, items]);

  return null;
}

// ---------------------------------------------------------------------------
// MapRefCapture — inner component (must live inside <Map>)
// ---------------------------------------------------------------------------
//
// Writes the underlying google.maps.Map instance into a ref owned by the
// outer component, so the mouse-event handlers (which run on a sibling div)
// can call map.getBounds() for pixel → LatLng conversion.

function MapRefCapture({
  mapRef,
}: {
  mapRef: React.MutableRefObject<google.maps.Map | null>;
}) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);
  return null;
}

// ---------------------------------------------------------------------------
// CornerMarker — constant-size red dot at a property corner
// ---------------------------------------------------------------------------
//
// AdvancedMarker renders as a DOM element overlaid on the map, so its size
// is always 10 × 10 px regardless of zoom level — even tiny properties remain
// clearly visible. Clicking the marker opens the InfoWindow for the property.

function CornerMarker({
  corner,
  onSelect,
}: {
  corner:   Corner;
  onSelect: () => void;
}) {
  return (
    <AdvancedMarker
      position={{ lat: corner.lat, lng: corner.lon }}
      onClick={(e) => { e.stop(); onSelect(); }}
    >
      <div
        style={{
          width:           10,
          height:          10,
          borderRadius:    "50%",
          backgroundColor: "#ef4444",
          border:          "2px solid white",
          boxShadow:       "0 1px 4px rgba(0,0,0,0.45)",
          cursor:          "pointer",
        }}
      />
    </AdvancedMarker>
  );
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Fallback center (Bragadiru, Ilfov) used before FitAllProperties fires.
const DEFAULT_CENTER: LatLng = { lat: 44.37, lng: 25.98 };
const DEFAULT_ZOOM            = 13;

// ---------------------------------------------------------------------------
// PropertyMap — main component
// ---------------------------------------------------------------------------

export default function PropertyMap() {
  const queryClient = useQueryClient();

  // Map display
  const [mapType,  setMapType]  = useState<MapTypeId>("roadmap");
  const [selected, setSelected] = useState<Selected | null>(null);

  // Selection mode
  const [selectMode,  setSelectMode]  = useState(false);
  const [dragStart,   setDragStart]   = useState<PixelPoint | null>(null);
  const [dragCurrent, setDragCurrent] = useState<PixelPoint | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Delete flow
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting,          setDeleting]          = useState(false);
  const [deleteError,       setDeleteError]       = useState<string | null>(null);

  // Refs shared between outer handlers and inner MapRefCapture
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<google.maps.Map | null>(null);

  // -------------------------------------------------------------------------
  // Data
  // -------------------------------------------------------------------------

  const { data, isLoading, isError } = useQuery<MapResponse>({
    queryKey: ["properties", "map"],
    queryFn:  fetchMapData,
  });

  const items        = data?.items ?? [];
  const withGeometry = items.filter((p) => p.corners.length >= 1);

  // -------------------------------------------------------------------------
  // Selection mode toggle
  // -------------------------------------------------------------------------

  const toggleSelectMode = useCallback(() => {
    setSelectMode((prev) => {
      if (!prev) setSelected(null); // entering select mode: close any open InfoWindow
      return !prev;
    });
    setSelectedIds(new Set());
    setDragStart(null);
    setDragCurrent(null);
  }, []);

  // -------------------------------------------------------------------------
  // Drag-to-select mouse handlers (on the transparent overlay div)
  // -------------------------------------------------------------------------

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!selectMode || !containerRef.current) return;
      e.preventDefault();
      const rect = containerRef.current.getBoundingClientRect();
      const pos  = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      setDragStart(pos);
      setDragCurrent(pos);
    },
    [selectMode],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!selectMode || !dragStart || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setDragCurrent({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    },
    [selectMode, dragStart],
  );

  const handleMouseUp = useCallback(() => {
    if (
      !selectMode ||
      !dragStart ||
      !dragCurrent ||
      !mapRef.current ||
      !containerRef.current
    ) {
      setDragStart(null);
      setDragCurrent(null);
      return;
    }

    const map       = mapRef.current;
    const container = containerRef.current;

    // Normalise the rectangle (drag can go in any direction)
    const minX = Math.min(dragStart.x, dragCurrent.x);
    const maxX = Math.max(dragStart.x, dragCurrent.x);
    const minY = Math.min(dragStart.y, dragCurrent.y);
    const maxY = Math.max(dragStart.y, dragCurrent.y);

    // Convert pixel corners to geographic coordinates
    const sw = pixelToLatLng(map, container, minX, maxY); // bottom-left of rect
    const ne = pixelToLatLng(map, container, maxX, minY); // top-right of rect

    // Collect properties that have at least one corner inside the rectangle
    const newSelected = new Set<string>();
    for (const prop of withGeometry) {
      if (propertyInRect(prop, sw.lat, sw.lng, ne.lat, ne.lng)) {
        newSelected.add(prop.id);
      }
    }

    setSelectedIds(newSelected);
    setDragStart(null);
    setDragCurrent(null);
  }, [selectMode, dragStart, dragCurrent, withGeometry]);

  const handleOverlayMouseLeave = useCallback(() => {
    if (dragStart) {
      setDragStart(null);
      setDragCurrent(null);
    }
  }, [dragStart]);

  // -------------------------------------------------------------------------
  // Batch delete
  // -------------------------------------------------------------------------

  const handleDeleteConfirm = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await batchDeleteProperties([...selectedIds]);
      setSelectedIds(new Set());
      setShowDeleteConfirm(false);
      setSelectMode(false);
      await queryClient.invalidateQueries({ queryKey: ["properties"] });
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setDeleting(false);
    }
  }, [selectedIds, queryClient]);

  // -------------------------------------------------------------------------
  // Loading / error states
  // -------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-950 text-zinc-400 text-sm">
        Loading map data…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-950 text-red-400 text-sm">
        Failed to load map data
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Selection rectangle CSS geometry
  // -------------------------------------------------------------------------

  const selectionRect =
    dragStart && dragCurrent
      ? {
          left:   Math.min(dragStart.x, dragCurrent.x),
          top:    Math.min(dragStart.y, dragCurrent.y),
          width:  Math.abs(dragCurrent.x - dragStart.x),
          height: Math.abs(dragCurrent.y - dragStart.y),
        }
      : null;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div ref={containerRef} className="relative w-full h-full">

      {/* Google Map */}
      <Map
        mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "DEMO_MAP_ID"}
        defaultCenter={DEFAULT_CENTER}
        defaultZoom={DEFAULT_ZOOM}
        mapTypeId={mapType}
        disableDefaultUI
        gestureHandling={selectMode ? "none" : "greedy"}
        style={{ width: "100%", height: "100%" }}
        onClick={() => { if (!selectMode) setSelected(null); }}
      >
        {/* Inner helpers that require useMap() / useMapsLibrary() */}
        <MapRefCapture mapRef={mapRef} />
        <FitAllProperties items={withGeometry} />

        {/* Polygons / circles (one pass) */}
        {withGeometry.map((prop) => {
          const isSelected  = selectedIds.has(prop.id);
          const strokeColor = isSelected ? "#ef4444" : "#3b82f6";
          const fillColor   = isSelected ? "#ef4444" : "#3b82f6";
          const fillOpacity = isSelected ? 0.30 : 0.15;
          const label       = prop.nickname ?? prop.code;
          const pos         = centroid(prop.corners);

          const handleClick = (e: { stop: () => void }) => {
            if (selectMode) return;
            e.stop();
            setSelected({ id: prop.id, position: pos, label });
          };

          return prop.corners.length >= 3 ? (
            <Polygon
              key={prop.id}
              paths={toLatLng(prop.corners)}
              strokeColor={strokeColor}
              strokeOpacity={1}
              strokeWeight={2}
              fillColor={fillColor}
              fillOpacity={fillOpacity}
              onClick={handleClick}
            />
          ) : (
            <Circle
              key={prop.id}
              center={{ lat: prop.corners[0].lat, lng: prop.corners[0].lon }}
              radius={25}
              strokeColor={strokeColor}
              strokeOpacity={1}
              strokeWeight={2}
              fillColor={fillColor}
              fillOpacity={isSelected ? 0.55 : 0.35}
              onClick={handleClick}
            />
          );
        })}

        {/* Corner markers — constant-size red dots (second pass) */}
        {withGeometry.flatMap((prop) => {
          const label = prop.nickname ?? prop.code;
          const pos   = centroid(prop.corners);
          return prop.corners.map((corner, idx) => (
            <CornerMarker
              key={`${prop.id}-c${idx}`}
              corner={corner}
              onSelect={() => {
                if (selectMode) return;
                setSelected({ id: prop.id, position: pos, label });
              }}
            />
          ));
        })}

        {/* InfoWindow for clicked property */}
        {selected && !selectMode && (
          <InfoWindow
            position={selected.position}
            onCloseClick={() => setSelected(null)}
          >
            <div className="flex flex-col gap-1 px-1 py-0.5">
              <span className="font-semibold text-sm text-zinc-900">
                {selected.label}
              </span>
              <Link
                href={`/properties/${selected.id}`}
                className="text-xs text-blue-600 hover:underline"
              >
                Open →
              </Link>
            </div>
          </InfoWindow>
        )}
      </Map>

      {/* ------------------------------------------------------------------ */}
      {/* Drag-to-select overlay                                               */}
      {/* pointer-events: none in pan mode → map works normally               */}
      {/* pointer-events: all in select mode → captures the drag gesture      */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="absolute inset-0 z-10"
        style={{
          pointerEvents: selectMode ? "all" : "none",
          cursor:        selectMode ? "crosshair" : "default",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleOverlayMouseLeave}
      >
        {/* Dashed red rectangle drawn live during the drag gesture */}
        {selectionRect && (
          <div
            style={{
              position:        "absolute",
              left:            selectionRect.left,
              top:             selectionRect.top,
              width:           selectionRect.width,
              height:          selectionRect.height,
              border:          "2px dashed #ef4444",
              backgroundColor: "rgba(239,68,68,0.07)",
              pointerEvents:   "none",
            }}
          />
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Toolbar — top-right: Select toggle + STR / SAT                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleSelectMode}
          title={
            selectMode
              ? "Exit selection mode"
              : "Enter selection mode — drag to select properties for deletion"
          }
          className={[
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded shadow border transition-colors",
            selectMode
              ? "bg-red-600 text-white border-red-600 hover:bg-red-700"
              : "bg-white text-ink border-wire hover:bg-canvas",
          ].join(" ")}
        >
          {selectMode ? "✕ Cancel select" : "⬚ Select"}
        </button>

        <MapTypeToggle value={mapType} onChange={setMapType} />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* "Delete all selected" button — bottom-centre                        */}
      {/* ------------------------------------------------------------------ */}
      {selectedIds.size > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
          <button
            type="button"
            onClick={() => { setDeleteError(null); setShowDeleteConfirm(true); }}
            className="px-5 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-lg shadow-lg hover:bg-red-700 active:bg-red-800 transition-colors border border-red-700"
          >
            Delete all selected ({selectedIds.size})
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Delete confirmation dialog                                           */}
      {/* ------------------------------------------------------------------ */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/45">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <p className="text-zinc-900 font-medium text-base leading-snug mb-4">
              This {selectedIds.size} of properties will be erased from the system.
            </p>

            {deleteError && (
              <p className="text-red-600 text-sm mb-3 rounded bg-red-50 px-3 py-2 border border-red-200">
                {deleteError}
              </p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                disabled={deleting}
                onClick={() => { setShowDeleteConfirm(false); setDeleteError(null); }}
                className="px-4 py-2 text-sm font-medium text-zinc-700 bg-zinc-100 rounded-lg hover:bg-zinc-200 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors min-w-[80px]"
              >
                {deleting ? "Deleting…" : "Approve"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
