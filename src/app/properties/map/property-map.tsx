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

// A single entry in the InfoWindow list.
type SelectedItem = { id: string; label: string };

// The current InfoWindow state: a click position + every property that
// overlaps it, sorted largest area first.
type Selected = { position: LatLng; items: SelectedItem[] };

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
// Geometry helpers
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
 * Shoelace formula — returns area in (degrees)² units.
 * Used only for relative sorting (larger value = larger polygon).
 */
function polygonAreaDeg(corners: Corner[]): number {
  if (corners.length < 3) return 0;
  let area = 0;
  const n = corners.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    area += (corners[j].lon + corners[i].lon) * (corners[j].lat - corners[i].lat);
  }
  return Math.abs(area) / 2;
}

/**
 * Ray-casting point-in-polygon test.
 * Works in lat/lon space — accurate enough for the ~1° × 1° area we cover.
 */
function pointInPolygon(pt: LatLng, corners: Corner[]): boolean {
  let inside = false;
  const n = corners.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = corners[i].lon, yi = corners[i].lat;
    const xj = corners[j].lon, yj = corners[j].lat;
    const intersect =
      yi > pt.lat !== yj > pt.lat &&
      pt.lng < ((xj - xi) * (pt.lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Returns true if `pt` is considered "inside" property `prop`.
 *
 * - ≥ 3 corners → standard point-in-polygon test.
 * - < 3 corners  → proximity check: within 0.001° of any corner
 *   (≈ 100 m, comfortably larger than the 25 m circle we draw on screen).
 */
function propertyContainsPoint(prop: MapProperty, pt: LatLng): boolean {
  if (prop.corners.length >= 3) {
    return pointInPolygon(pt, prop.corners);
  }
  const THRESHOLD = 0.001; // degrees
  return prop.corners.some(
    (c) =>
      Math.abs(c.lat - pt.lat) < THRESHOLD &&
      Math.abs(c.lon - pt.lng) < THRESHOLD,
  );
}

/**
 * Collect every property in `props` that contains `pt`, then sort the result
 * largest-area-first so the outermost (containing) polygon is listed first.
 */
function findOverlapping(props: MapProperty[], pt: LatLng): MapProperty[] {
  const hits = props.filter((p) => propertyContainsPoint(p, pt));
  hits.sort((a, b) => polygonAreaDeg(b.corners) - polygonAreaDeg(a.corners));
  return hits;
}

// ---------------------------------------------------------------------------
// Map pixel → LatLng conversion (for drag-to-select)
// ---------------------------------------------------------------------------

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
// clearly visible. Clicking the marker triggers onSelect with the corner's
// exact geographic coordinates as the click position.

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
  // Overlap-aware click handler
  // -------------------------------------------------------------------------
  //
  // Called by Polygon, Circle, and CornerMarker clicks with:
  //   ownId — the ID of the directly-clicked property (always shown first if
  //           the ray-cast misses it due to a boundary edge case)
  //   pos   — the geographic click position used for hit-testing all others
  //
  // The resulting InfoWindow shows every property that contains `pos`, ordered
  // largest-area-first (so surrounding parcels appear above inner ones).

  const handlePropClick = useCallback(
    (ownId: string, pos: LatLng) => {
      if (selectMode) return;

      // Find all properties that geometrically contain the click point
      const overlapping = findOverlapping(withGeometry, pos);

      // Guarantee the directly-clicked property is always in the list
      // (the ray-cast can miss a point exactly on a polygon boundary)
      if (!overlapping.some((p) => p.id === ownId)) {
        const own = withGeometry.find((p) => p.id === ownId);
        if (own) {
          // Insert it sorted by area — larger than every property it's bigger than
          const ownArea = polygonAreaDeg(own.corners);
          const idx = overlapping.findIndex(
            (p) => polygonAreaDeg(p.corners) < ownArea,
          );
          if (idx === -1) overlapping.push(own);
          else overlapping.splice(idx, 0, own);
        }
      }

      setSelected({
        position: pos,
        items:    overlapping.map((p) => ({ id: p.id, label: p.nickname ?? p.code })),
      });
    },
    [selectMode, withGeometry],
  );

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

          return prop.corners.length >= 3 ? (
            <Polygon
              key={prop.id}
              paths={toLatLng(prop.corners)}
              strokeColor={strokeColor}
              strokeOpacity={1}
              strokeWeight={2}
              fillColor={fillColor}
              fillOpacity={fillOpacity}
              onClick={(e) => {
                if (selectMode) return;
                e.stop();
                // Polygon fires native google.maps.PolyMouseEvent — latLng is a
                // LatLng object accessed via method calls, not e.detail.latLng.
                const pos = e.latLng
                  ? { lat: e.latLng.lat(), lng: e.latLng.lng() }
                  : centroid(prop.corners);
                handlePropClick(prop.id, pos);
              }}
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
              onClick={(e) => {
                if (selectMode) return;
                e.stop();
                const pos = e.latLng
                  ? { lat: e.latLng.lat(), lng: e.latLng.lng() }
                  : { lat: prop.corners[0].lat, lng: prop.corners[0].lon };
                handlePropClick(prop.id, pos);
              }}
            />
          );
        })}

        {/* Corner markers — constant-size red dots (second pass) */}
        {withGeometry.flatMap((prop) =>
          prop.corners.map((corner, idx) => (
            <CornerMarker
              key={`${prop.id}-c${idx}`}
              corner={corner}
              onSelect={() =>
                // Use the corner's exact coordinates as the click position —
                // reliable and avoids the need to extract from AdvancedMarkerClickEvent
                handlePropClick(prop.id, { lat: corner.lat, lng: corner.lon })
              }
            />
          )),
        )}

        {/* InfoWindow — lists ALL properties at the click position, */}
        {/* ordered largest area first (outermost parcel at the top).  */}
        {selected && !selectMode && (
          <InfoWindow
            position={selected.position}
            onCloseClick={() => setSelected(null)}
          >
            <div className="flex flex-col min-w-[160px] px-1 py-0.5 gap-0">
              {selected.items.map((item, idx) => (
                <div
                  key={item.id}
                  className={[
                    "flex flex-col gap-0.5 py-1.5",
                    idx > 0 ? "border-t border-zinc-200" : "",
                  ].join(" ")}
                >
                  <span className="font-semibold text-sm text-zinc-900 leading-tight">
                    {item.label}
                  </span>
                  <Link
                    href={`/properties/${item.id}`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Open →
                  </Link>
                </div>
              ))}
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
