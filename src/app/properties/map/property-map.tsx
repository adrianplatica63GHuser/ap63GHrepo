"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
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

// Which tab is currently shown in the map view.
type ActiveTab = "all" | "selected";

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
// Duplicate-polygon detection
// ---------------------------------------------------------------------------

/**
 * Returns a canonical string key for a set of corners that is invariant to
 * rotation, starting-corner choice, and winding direction.
 */
function cornerSetKey(corners: Corner[]): string {
  return corners
    .map((c) => `${c.lat.toFixed(6)},${c.lon.toFixed(6)}`)
    .sort()
    .join("|");
}

/**
 * Returns the set of property IDs whose corner geometry exactly matches at
 * least one other property.
 */
function findDuplicateIds(props: MapProperty[]): Set<string> {
  const keyToIds: Record<string, string[]> = {};
  for (const p of props) {
    if (p.corners.length === 0) continue;
    const key = cornerSetKey(p.corners);
    if (keyToIds[key]) keyToIds[key].push(p.id);
    else keyToIds[key] = [p.id];
  }
  const result = new Set<string>();
  for (const ids of Object.values(keyToIds)) {
    if (ids.length > 1) ids.forEach((id) => result.add(id));
  }
  return result;
}

// ---------------------------------------------------------------------------
// Map pixel → LatLng conversion (for drag-to-select)
// ---------------------------------------------------------------------------

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
// `tabKey` prop resets the `fitted` guard whenever the active tab changes so
// the viewport refits to the (possibly filtered) item set on each tab switch.

function FitAllProperties({
  items,
  tabKey,
}: {
  items:   MapProperty[];
  tabKey:  string;
}) {
  const map    = useMap();
  const core   = useMapsLibrary("core");
  const fitted = useRef(false);

  // Reset the guard when the tab changes so we refit on every tab switch.
  useEffect(() => {
    fitted.current = false;
  }, [tabKey]);

  useEffect(() => {
    if (!map || !core || fitted.current) return;
    const allCorners = items.flatMap((p) => p.corners);
    if (allCorners.length === 0) return;

    const bounds = new core.LatLngBounds();
    allCorners.forEach((c) => bounds.extend({ lat: c.lat, lng: c.lon }));

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
  }, [map, core, items, tabKey]);

  return null;
}

// ---------------------------------------------------------------------------
// MapRefCapture — inner component (must live inside <Map>)
// ---------------------------------------------------------------------------

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

function CornerMarker({ corner }: { corner: Corner }) {
  return (
    <AdvancedMarker position={{ lat: corner.lat, lng: corner.lon }}>
      <div
        style={{
          width:           10,
          height:          10,
          borderRadius:    "50%",
          backgroundColor: "#ef4444",
          border:          "2px solid white",
          boxShadow:       "0 1px 4px rgba(0,0,0,0.45)",
          pointerEvents:   "none",
        }}
      />
    </AdvancedMarker>
  );
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CENTER: LatLng = { lat: 44.37, lng: 25.98 };
const DEFAULT_ZOOM            = 13;

// ---------------------------------------------------------------------------
// PropertyMap — main component
// ---------------------------------------------------------------------------

export default function PropertyMap() {
  const t           = useTranslations("property");
  const queryClient = useQueryClient();

  // Map display
  const [mapType,  setMapType]  = useState<MapTypeId>("roadmap");
  const [selected, setSelected] = useState<Selected | null>(null);

  // Selection mode
  const [selectMode,  setSelectMode]  = useState(false);
  const [dragStart,   setDragStart]   = useState<PixelPoint | null>(null);
  const [dragCurrent, setDragCurrent] = useState<PixelPoint | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Tab state — showTabs becomes true when "Display all selected" is clicked
  const [showTabs,  setShowTabs]  = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("all");

  // Delete flow
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting,          setDeleting]          = useState(false);
  const [deleteError,       setDeleteError]       = useState<string | null>(null);

  // Blink state for duplicate-polygon highlighting — toggled every 1 s.
  const [blinkOn, setBlinkOn] = useState(true);
  useEffect(() => {
    const timer = setInterval(() => setBlinkOn((b) => !b), 1000);
    return () => clearInterval(timer);
  }, []);

  // Refs shared between outer handlers and inner MapRefCapture
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<google.maps.Map | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs used inside the document mousemove listener so the closure always
  // sees the latest values without needing them in the dependency array.
  const withGeometryRef = useRef<MapProperty[]>([]);
  const selectModeRef   = useRef(false);
  const activeTabRef    = useRef<ActiveTab>("all");

  // IDs of properties currently displayed in the InfoWindow.
  const shownIdsRef = useRef<Set<string>>(new Set());
  // Fixed anchor for the InfoWindow.
  const anchorRef   = useRef<LatLng | null>(null);

  // -------------------------------------------------------------------------
  // Data
  // -------------------------------------------------------------------------

  const { data, isLoading, isError } = useQuery<MapResponse>({
    queryKey: ["properties", "map"],
    queryFn:  fetchMapData,
  });

  const items        = data?.items ?? [];
  const withGeometry = items.filter((p) => p.corners.length >= 1);

  // Items shown on the current tab — filtered to selected IDs on the "selected" tab.
  const displayItems =
    activeTab === "selected"
      ? withGeometry.filter((p) => selectedIds.has(p.id))
      : withGeometry;

  // Properties whose corner set is identical to at least one other property.
  const duplicateIds = findDuplicateIds(withGeometry);

  // Keep refs in sync after every render.
  useEffect(() => {
    withGeometryRef.current = displayItems;
    selectModeRef.current   = selectMode;
    activeTabRef.current    = activeTab;
  });

  // -------------------------------------------------------------------------
  // Document-level mousemove → hit-test → InfoWindow
  // -------------------------------------------------------------------------
  //
  // Runs in both normal and select modes so the InfoWindow can appear while
  // the cursor hovers over a property during selection.
  //
  // In select mode the InfoWindow shows Select / Unselect links instead of
  // "Open →".  In the "selected" tab the InfoWindow shows "Open →" as usual.

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      // In select mode on the "all" tab, show hover InfoWindow with Select/Unselect.
      // In the "selected" tab (no drag overlay), show normal hover InfoWindow.
      const container = containerRef.current;
      const map       = mapRef.current;
      if (!container || !map) return;

      const rect = container.getBoundingClientRect();
      const x    = e.clientX - rect.left;
      const y    = e.clientY - rect.top;

      // Cursor left the map container — start the close timer.
      if (x < 0 || x > rect.width || y < 0 || y > rect.height) {
        if (shownIdsRef.current.size > 0 && !closeTimerRef.current) {
          closeTimerRef.current = setTimeout(() => {
            setSelected(null);
            shownIdsRef.current = new Set();
            anchorRef.current   = null;
          }, 2000);
        }
        return;
      }

      const pos         = pixelToLatLng(map, container, x, y);
      const overlapping = findOverlapping(withGeometryRef.current, pos);

      if (overlapping.length > 0) {
        if (closeTimerRef.current) {
          clearTimeout(closeTimerRef.current);
          closeTimerRef.current = null;
        }

        const newProps = overlapping.filter((p) => !shownIdsRef.current.has(p.id));

        if (newProps.length > 0) {
          newProps.forEach((p) => shownIdsRef.current.add(p.id));

          const allShown = ([...shownIdsRef.current] as string[])
            .map((id) => withGeometryRef.current.find((p) => p.id === id))
            .filter((p): p is MapProperty => !!p);
          allShown.sort((a, b) => polygonAreaDeg(b.corners) - polygonAreaDeg(a.corners));

          if (!anchorRef.current) {
            anchorRef.current = centroid(allShown[0].corners);
          }

          setSelected({
            position: anchorRef.current,
            items:    allShown.map((p) => ({ id: p.id, label: p.nickname ?? p.code })),
          });
        }
      } else {
        if (shownIdsRef.current.size > 0 && !closeTimerRef.current) {
          closeTimerRef.current = setTimeout(() => {
            setSelected(null);
            shownIdsRef.current = new Set();
            anchorRef.current   = null;
          }, 2000);
        }
      }
    };

    document.addEventListener("mousemove", onMove);
    return () => document.removeEventListener("mousemove", onMove);
  }, []); // intentionally empty — all mutable values accessed via refs

  // -------------------------------------------------------------------------
  // Selection mode toggle
  // -------------------------------------------------------------------------

  const toggleSelectMode = useCallback(() => {
    setSelectMode((prev) => {
      if (!prev) {
        // Entering select mode: close any open InfoWindow.
        setSelected(null);
      } else {
        // Exiting select mode: clear selection + hide tabs.
        setShowTabs(false);
        setActiveTab("all");
      }
      return !prev;
    });
    setSelectedIds(new Set());
    setDragStart(null);
    setDragCurrent(null);
  }, []);

  // -------------------------------------------------------------------------
  // Individual property select / unselect (via InfoWindow in select mode)
  // -------------------------------------------------------------------------

  const togglePropertySelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

    const minX = Math.min(dragStart.x, dragCurrent.x);
    const maxX = Math.max(dragStart.x, dragCurrent.x);
    const minY = Math.min(dragStart.y, dragCurrent.y);
    const maxY = Math.max(dragStart.y, dragCurrent.y);

    const sw = pixelToLatLng(map, container, minX, maxY);
    const ne = pixelToLatLng(map, container, maxX, minY);

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
      setShowTabs(false);
      setActiveTab("all");
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
    // Outer flex column: header row + map row.
    <div className="flex flex-col h-full">

      {/* ------------------------------------------------------------------ */}
      {/* Header — title when no tabs, tab bar when showTabs is true          */}
      {/* ------------------------------------------------------------------ */}
      <header className="flex items-center justify-center px-4 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0 min-h-[40px]">
        {!showTabs ? (
          <h1 className="text-sm font-semibold text-zinc-100 tracking-tight">
            {t("mapTitle")}
          </h1>
        ) : (
          <div className="flex gap-0 rounded overflow-hidden border border-zinc-700">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={[
                "px-4 py-1.5 text-xs font-semibold tracking-wide transition-colors",
                activeTab === "all"
                  ? "bg-zinc-100 text-zinc-900"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100",
              ].join(" ")}
            >
              {t("mapTitle")}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("selected")}
              className={[
                "px-4 py-1.5 text-xs font-semibold tracking-wide transition-colors border-l border-zinc-700",
                activeTab === "selected"
                  ? "bg-zinc-100 text-zinc-900"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100",
              ].join(" ")}
            >
              {t("map.selectedPropertiesTab")}
              <span className="ml-1.5 text-[10px] font-bold bg-red-600 text-white rounded-full px-1.5 py-0.5">
                {selectedIds.size}
              </span>
            </button>
          </div>
        )}
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Map container — containerRef anchors all absolute children          */}
      {/* ------------------------------------------------------------------ */}
      <div ref={containerRef} className="flex-1 min-h-0 relative">

        {/* Google Map */}
        <Map
          mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "DEMO_MAP_ID"}
          defaultCenter={DEFAULT_CENTER}
          defaultZoom={DEFAULT_ZOOM}
          mapTypeId={mapType}
          disableDefaultUI
          gestureHandling={selectMode && activeTab === "all" ? "none" : "greedy"}
          style={{ width: "100%", height: "100%" }}
          onClick={() => { if (!selectMode) setSelected(null); }}
        >
          {/* Inner helpers that require useMap() / useMapsLibrary() */}
          <MapRefCapture mapRef={mapRef} />
          <FitAllProperties items={displayItems} tabKey={activeTab} />

          {/* Polygons / circles */}
          {/* Colour: selected (red) > duplicate (blinking pink) > normal (blue) */}
          {displayItems.map((prop) => {
            const isSelected  = selectedIds.has(prop.id);
            // In "selected" tab, show all items in normal blue (they're all "selected"
            // and red would be confusing when everything is red).
            const effectiveSelected = isSelected && activeTab === "all";
            const isDuplicate = duplicateIds.has(prop.id);

            const strokeColor =
              effectiveSelected ? "#ef4444" :
              isDuplicate       ? "#ec4899" :
                                  "#3b82f6";

            const fillColor =
              effectiveSelected ? "#ef4444" :
              isDuplicate       ? "#ec4899" :
                                  "#3b82f6";

            const fillOpacity =
              effectiveSelected ? 0.30 :
              isDuplicate       ? (blinkOn ? 0.45 : 0) :
                                  0.15;

            return prop.corners.length >= 3 ? (
              <Polygon
                key={prop.id}
                paths={toLatLng(prop.corners)}
                strokeColor={strokeColor}
                strokeOpacity={1}
                strokeWeight={2}
                fillColor={fillColor}
                fillOpacity={fillOpacity}
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
                fillOpacity={
                  effectiveSelected ? 0.55 :
                  isDuplicate       ? (blinkOn ? 0.55 : 0) :
                                      0.35
                }
              />
            );
          })}

          {/* Corner markers — constant-size red dots */}
          {displayItems.flatMap((prop) =>
            prop.corners.map((corner, idx) => (
              <CornerMarker
                key={`${prop.id}-c${idx}`}
                corner={corner}
              />
            )),
          )}

          {/* InfoWindow — shown on hover in both normal and select modes.    */}
          {/* Normal mode: label + "Open →" link.                             */}
          {/* Select mode (all tab): label + red Select / green Unselect btn. */}
          {/* Selected tab: label + "Open →" link (no select actions).        */}
          {selected && (
            <InfoWindow
              position={selected.position}
              onCloseClick={() => {
                setSelected(null);
                shownIdsRef.current = new Set();
                anchorRef.current   = null;
              }}
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

                    {selectMode && activeTab === "all" ? (
                      // Select mode: show Select / Unselect toggle button
                      <button
                        type="button"
                        onClick={() => togglePropertySelected(item.id)}
                        className={[
                          "text-xs font-semibold text-left",
                          selectedIds.has(item.id)
                            ? "text-green-600 hover:text-green-700"
                            : "text-red-600 hover:text-red-700",
                        ].join(" ")}
                      >
                        {selectedIds.has(item.id)
                          ? t("map.unselectLink")
                          : t("map.selectLink")}
                      </button>
                    ) : (
                      // Normal / selected-tab: show "Open →" link
                      <Link
                        href={`/properties/${item.id}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Open →
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </InfoWindow>
          )}
        </Map>

        {/* ---------------------------------------------------------------- */}
        {/* Drag-to-select overlay — only active in "all" tab + select mode  */}
        {/* ---------------------------------------------------------------- */}
        <div
          className="absolute inset-0 z-10"
          style={{
            pointerEvents: (selectMode && activeTab === "all") ? "all" : "none",
            cursor:        (selectMode && activeTab === "all") ? "crosshair" : "default",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleOverlayMouseLeave}
        >
          {selectionRect && activeTab === "all" && (
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

        {/* ---------------------------------------------------------------- */}
        {/* Toolbar — top-right: Select toggle + STR / SAT                   */}
        {/* Only shown on the "all properties" tab                           */}
        {/* ---------------------------------------------------------------- */}
        {activeTab === "all" && (
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
        )}

        {/* STR/SAT toggle alone on the "selected" tab (no select-mode button) */}
        {activeTab === "selected" && (
          <div className="absolute top-3 right-3 z-20">
            <MapTypeToggle value={mapType} onChange={setMapType} />
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Bottom action buttons — visible when properties are selected      */}
        {/* ---------------------------------------------------------------- */}
        {selectedIds.size > 0 && activeTab === "all" && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3">
            {/* Delete all selected */}
            <button
              type="button"
              onClick={() => { setDeleteError(null); setShowDeleteConfirm(true); }}
              className="px-5 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-lg shadow-lg hover:bg-red-700 active:bg-red-800 transition-colors border border-red-700"
            >
              Delete all selected ({selectedIds.size})
            </button>

            {/* Display all selected — shows / switches to the "selected" tab */}
            <button
              type="button"
              onClick={() => { setShowTabs(true); setActiveTab("selected"); }}
              className="px-5 py-2.5 bg-white text-zinc-900 text-sm font-semibold rounded-lg shadow-lg hover:bg-zinc-100 active:bg-zinc-200 transition-colors border border-zinc-300"
            >
              {t("map.displayAllSelected")} ({selectedIds.size})
            </button>
          </div>
        )}

        {/* Delete button also shown on the "selected" tab */}
        {selectedIds.size > 0 && activeTab === "selected" && (
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

        {/* ---------------------------------------------------------------- */}
        {/* Delete confirmation dialog                                        */}
        {/* ---------------------------------------------------------------- */}
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
    </div>
  );
}
