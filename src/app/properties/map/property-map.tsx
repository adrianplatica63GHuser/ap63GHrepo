"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  AdvancedMarker,
  Circle,
  InfoWindow,
  Map,
  Polygon,
  Polyline,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";

import { isPropertyVisibleForGroups } from "@/lib/groups/map-filter";
import { wgs84ToStereo70Batch } from "@/lib/geo/convert-client";
import {
  fitAffine,
  rulerDistanceM,
  formatMeters,
  nearestCornerWithinPx,
  SNAP_PX,
  type AffineWgs84ToStereo70,
} from "@/lib/geo/ruler";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Corner = { lat: number; lon: number };

type MapProperty = {
  id:         string;
  code:       string;
  nickname:   string | null;
  corners:    Corner[];
  // PROPERTY-group codes this property belongs to (Slice #18.08). Empty when
  // it belongs to no group.
  groupCodes: string[];
};

type MapResponse = {
  items: MapProperty[];
  // Every PROPERTY-target group code — the Groups panel's checkbox list.
  allGroupCodes: string[];
};

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

function CornerMarker({
  corner,
  color = "#ef4444",
}: {
  corner: Corner;
  color?: string;
}) {
  return (
    <AdvancedMarker position={{ lat: corner.lat, lng: corner.lon }}>
      <div
        style={{
          width:           10,
          height:          10,
          borderRadius:    "50%",
          backgroundColor: color,
          border:          "2px solid white",
          boxShadow:       "0 1px 4px rgba(0,0,0,0.45)",
          pointerEvents:   "none",
        }}
      />
    </AdvancedMarker>
  );
}

// ---------------------------------------------------------------------------
// Ruler tool — inner components + helpers  (Slice #18.14.ruler)
// ---------------------------------------------------------------------------

// Ruler glyph: a horizontal bar crossed by short tick marks (shown on the
// toolbar button). The cursor uses the same shape as a data-URI (below).
function RulerIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="8" width="20" height="8" rx="1" />
      <line x1="7" y1="8" x2="7" y2="12" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="17" y1="8" x2="17" y2="12" />
    </svg>
  );
}

// Custom cursor — a small white ruler so the pointer "turns into" the tool.
const RULER_CURSOR_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26' viewBox='0 0 26 26'>" +
  "<rect x='2' y='9' width='22' height='8' rx='1' fill='#ffffff' stroke='#111111' stroke-width='1.5'/>" +
  "<line x1='7' y1='9' x2='7' y2='13' stroke='#111111' stroke-width='1.2'/>" +
  "<line x1='12' y1='9' x2='12' y2='13' stroke='#111111' stroke-width='1.2'/>" +
  "<line x1='17' y1='9' x2='17' y2='13' stroke='#111111' stroke-width='1.2'/>" +
  "</svg>";
const RULER_CURSOR = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  RULER_CURSOR_SVG,
)}") 4 13, crosshair`;

const RULER_GREEN = "#22c55e";
const RULER_LINE  = "#15803d";

/**
 * 2-point polyline for the ruler segment. The library's <Polyline> keeps the
 * line latLng-anchored so it tracks pan/zoom automatically — no pixel-space
 * recompute needed.
 */
function RulerSegment({ start, end }: { start: LatLng; end: LatLng }) {
  return (
    <Polyline
      path={[start, end]}
      strokeColor={RULER_LINE}
      strokeOpacity={1}
      strokeWeight={2}
      clickable={false}
    />
  );
}

/**
 * Re-fits the local affine WGS84 -> Stereo 70 transform whenever the ruler is
 * active: once on activation and again each time the map settles ("idle") after
 * a pan/zoom, so the readout stays grid-accurate across the current viewport.
 */
function RulerCalibrator({
  active,
  onCalibrate,
}: {
  active:      boolean;
  onCalibrate: () => void;
}) {
  const map = useMap();
  useEffect(() => {
    if (!active || !map) return;
    onCalibrate(); // initial fit
    const listener = map.addListener("idle", onCalibrate);
    return () => listener.remove();
  }, [active, map, onCalibrate]);
  return null;
}

/**
 * Snap affordance shown when the cursor is within SNAP_PX of a corner: the
 * corner dot turns green and a green ring is drawn concentrically around it.
 * The outer box matches CornerMarker's bottom-centre anchoring so the green dot
 * sits exactly over the red corner dot; the ring is centred on that dot.
 */
function RulerSnapRing({ corner }: { corner: LatLng }) {
  return (
    <AdvancedMarker position={corner}>
      <div style={{ position: "relative", width: 10, height: 10, pointerEvents: "none" }}>
        <div
          style={{
            position:        "absolute",
            inset:           0,
            borderRadius:    "50%",
            backgroundColor: RULER_GREEN,
            border:          "2px solid white",
            boxShadow:       "0 1px 4px rgba(0,0,0,0.45)",
          }}
        />
        <div
          style={{
            position:     "absolute",
            left:         "50%",
            top:          "50%",
            width:        28,
            height:       28,
            marginLeft:   -14,
            marginTop:    -14,
            borderRadius: "50%",
            border:       `2px solid ${RULER_GREEN}`,
            boxShadow:    "0 0 0 3px rgba(34,197,94,0.18)",
          }}
        />
      </div>
    </AdvancedMarker>
  );
}

/**
 * Distance read-out bubble. Anchored at a 0x0 point so it can be offset cleanly:
 * live → up-and-right of the cursor; frozen → centred above the segment midpoint.
 */
function RulerDistanceLabel({
  position,
  text,
  frozen,
}: {
  position: LatLng;
  text:     string;
  frozen:   boolean;
}) {
  return (
    <AdvancedMarker position={position}>
      <div style={{ position: "relative", width: 0, height: 0, pointerEvents: "none" }}>
        <div
          style={{
            position:        "absolute",
            left:            frozen ? 0 : 14,
            top:             frozen ? 0 : -10,
            transform:       frozen ? "translate(-50%, -160%)" : "none",
            whiteSpace:      "nowrap",
            backgroundColor: RULER_LINE,
            color:           "white",
            fontSize:        11,
            fontWeight:      600,
            lineHeight:      1.2,
            padding:         "2px 6px",
            borderRadius:    4,
            boxShadow:       "0 1px 4px rgba(0,0,0,0.45)",
          }}
        >
          {text}
        </div>
      </div>
    </AdvancedMarker>
  );
}

/** Container-pixel position of a lat/lng — inverse of pixelToLatLng. */
function latLngToPixel(
  map:       google.maps.Map,
  container: HTMLDivElement,
  lat:       number,
  lng:       number,
): PixelPoint | null {
  const bounds = map.getBounds();
  if (!bounds) return null;
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  return {
    x: ((lng - sw.lng()) / (ne.lng() - sw.lng())) * container.clientWidth,
    y: ((ne.lat() - lat) / (ne.lat() - sw.lat())) * container.clientHeight,
  };
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
  const router      = useRouter();

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

  // Groups filter (Slice #18.08) — panel open state + the set of UNCHECKED
  // group codes. Tracking unchecked (rather than checked) means "all checked"
  // is the empty-set default, so no async init from the loaded code list.
  const [groupsPanelOpen, setGroupsPanelOpen] = useState(false);
  const [uncheckedGroups, setUncheckedGroups] = useState<Set<string>>(new Set());

  // Ruler tool (Slice #18.14.ruler) — mutually exclusive with select mode.
  // rulerStart/rulerEnd are committed endpoints; rulerCursor is the live
  // (uncommitted) endpoint that follows the mouse; rulerSnap is the corner the
  // cursor is currently snapping to (drives the green ring). rulerAffine is the
  // local WGS84 -> Stereo 70 transform used to measure the distance.
  const [rulerMode,   setRulerMode]   = useState(false);
  const [rulerStart,  setRulerStart]  = useState<LatLng | null>(null);
  const [rulerEnd,    setRulerEnd]    = useState<LatLng | null>(null);
  const [rulerCursor, setRulerCursor] = useState<LatLng | null>(null);
  const [rulerSnap,   setRulerSnap]   = useState<LatLng | null>(null);
  const [rulerAffine, setRulerAffine] = useState<AffineWgs84ToStereo70 | null>(null);

  // Refs read inside the container-level ruler listeners so their closures
  // always see the latest values without re-binding on every change.
  const rulerStartRef   = useRef<LatLng | null>(null);
  const rulerEndRef     = useRef<LatLng | null>(null);
  const rulerCornersRef = useRef<LatLng[]>([]);

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
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<google.maps.Map | null>(null);

  // Refs used inside the document-level drag-to-select listeners so the
  // closure always sees the latest values without needing them in the
  // dependency array.
  const withGeometryRef = useRef<MapProperty[]>([]);
  const activeTabRef    = useRef<ActiveTab>("all");

  // -------------------------------------------------------------------------
  // Data
  // -------------------------------------------------------------------------

  const { data, isLoading, isError } = useQuery<MapResponse>({
    queryKey: ["properties", "map"],
    queryFn:  fetchMapData,
  });

  const items         = data?.items ?? [];
  const allGroupCodes = useMemo(() => data?.allGroupCodes ?? [], [data?.allGroupCodes]);
  const withGeometry  = items.filter((p) => p.corners.length >= 1);

  // Group filter — applied only on the "all" tab. A property is hidden only
  // when every group it belongs to is unchecked (see isPropertyVisibleForGroups).
  const groupFiltered = withGeometry.filter((p) =>
    isPropertyVisibleForGroups(p.groupCodes, uncheckedGroups),
  );

  // Items shown on the current tab — filtered to selected IDs on the "selected"
  // tab; group-filtered on the "all" tab.
  const displayItems =
    activeTab === "selected"
      ? withGeometry.filter((p) => selectedIds.has(p.id))
      : groupFiltered;

  // Whether every group is currently checked (drives the master checkbox).
  const allGroupsChecked =
    allGroupCodes.length > 0 && allGroupCodes.every((c) => !uncheckedGroups.has(c));

  // Properties whose corner set is identical to at least one other property.
  const duplicateIds = findDuplicateIds(withGeometry);

  // Keep refs in sync after every render.
  useEffect(() => {
    withGeometryRef.current = displayItems;
    activeTabRef.current    = activeTab;
    rulerStartRef.current   = rulerStart;
    rulerEndRef.current     = rulerEnd;
    rulerCornersRef.current = displayItems.flatMap((p) =>
      p.corners.map((c) => ({ lat: c.lat, lng: c.lon })),
    );
  });

  // -------------------------------------------------------------------------
  // Click / double-click → hit-test → InfoWindow (Slice #15.12)
  // -------------------------------------------------------------------------
  //
  // Single click: hit-test the click position against every loaded property
  // and show the InfoWindow listing all overlapping matches (largest area
  // first), exactly as the old hover-based InfoWindow did. Clicking on empty
  // map space (no match) closes any open InfoWindow.
  //
  // Double click: same hit-test. If it resolves to EXACTLY one property —
  // and we're not in select mode on the "all" tab (where double-click should
  // not bypass the Select/Unselect affordance) — navigate straight to that
  // property's detail page, the same action as the "Open →" link. If the
  // click is ambiguous (0 or ≥2 matches), double-click does nothing beyond
  // what single click already did (show/refresh the InfoWindow) — it must
  // never auto-navigate when more than one property overlaps the click.

  const handleMapClick = useCallback((pos: LatLng | null) => {
    if (!pos) {
      setSelected(null);
      return;
    }
    const overlapping = findOverlapping(withGeometryRef.current, pos);
    if (overlapping.length === 0) {
      setSelected(null);
      return;
    }
    setSelected({
      position: pos,
      items:    overlapping.map((p) => ({ id: p.id, label: p.nickname ?? p.code })),
    });
  }, []);

  const handleMapDblClick = useCallback((pos: LatLng | null) => {
    if (!pos) return;
    const overlapping = findOverlapping(withGeometryRef.current, pos);

    if (overlapping.length === 1 && !(selectMode && activeTabRef.current === "all")) {
      router.push(`/properties/${overlapping[0].id}`);
      return;
    }

    // Ambiguous (0 or ≥2 matches), or navigation is suppressed in select
    // mode — fall back to the same behaviour as a single click.
    handleMapClick(pos);
  }, [router, selectMode, handleMapClick]);

  // -------------------------------------------------------------------------
  // Selection mode toggle
  // -------------------------------------------------------------------------

  const toggleSelectMode = useCallback(() => {
    setSelectMode((prev) => {
      if (!prev) {
        // Entering select mode: close any open InfoWindow + exit ruler mode.
        setSelected(null);
        setRulerMode(false);
        setRulerStart(null);
        setRulerEnd(null);
        setRulerCursor(null);
        setRulerSnap(null);
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
  // Ruler tool (Slice #18.14.ruler)
  // -------------------------------------------------------------------------

  // Re-fit the local affine WGS84 -> Stereo 70 transform across the current
  // viewport. Samples three spanning, non-collinear corners of the visible
  // bounds and converts them via the existing batch endpoint, then fits.
  const recalibrateRuler = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = map.getBounds();
    if (!bounds) return;
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const samples = [
      { lat: sw.lat(), lon: sw.lng() },
      { lat: ne.lat(), lon: sw.lng() },
      { lat: sw.lat(), lon: ne.lng() },
    ];
    try {
      const s70 = await wgs84ToStereo70Batch(samples);
      const aff = fitAffine(
        samples.map((s, i) => ({
          lat:   s.lat,
          lon:   s.lon,
          north: s70[i].north,
          east:  s70[i].east,
        })),
      );
      if (aff) setRulerAffine(aff);
    } catch {
      // Leave the previous transform in place; the read-out shows "…" until the
      // next successful fit.
    }
  }, []);

  // Nearest visible corner within SNAP_PX of a container-pixel point, or null.
  const computeRulerSnap = useCallback((px: PixelPoint): LatLng | null => {
    const map       = mapRef.current;
    const container = containerRef.current;
    if (!map || !container) return null;
    const corners = rulerCornersRef.current;
    if (corners.length === 0) return null;
    const pixels = corners.map(
      (c) => latLngToPixel(map, container, c.lat, c.lng) ?? { x: -1e9, y: -1e9 },
    );
    const idx = nearestCornerWithinPx(px, pixels, SNAP_PX);
    return idx === null ? null : corners[idx];
  }, []);

  const resetRuler = useCallback(() => {
    setRulerMode(false);
    setRulerStart(null);
    setRulerEnd(null);
    setRulerCursor(null);
    setRulerSnap(null);
  }, []);

  // A genuine click on the map while the ruler is active. Placement order:
  // none -> start; start -> end (freeze); frozen -> reset (and exit ruler mode).
  const handleRulerClick = useCallback((px: PixelPoint) => {
    // Frozen: any further click clears the segment and leaves ruler mode.
    if (rulerEndRef.current) {
      resetRuler();
      return;
    }
    const map       = mapRef.current;
    const container = containerRef.current;
    if (!map || !container) return;

    const snap = computeRulerSnap(px);
    const point: LatLng =
      snap ??
      (() => {
        const ll = pixelToLatLng(map, container, px.x, px.y);
        return { lat: ll.lat, lng: ll.lng };
      })();

    if (!rulerStartRef.current) {
      setRulerStart(point);
      setRulerCursor(point);
    } else {
      setRulerEnd(point);
      setRulerSnap(null);
    }
  }, [computeRulerSnap, resetRuler]);

  const toggleRulerMode = useCallback(() => {
    setRulerMode((prev) => {
      const next = !prev;
      if (next) {
        // Entering ruler mode: close InfoWindow + exit select mode.
        setSelected(null);
        setSelectMode(false);
        setSelectedIds(new Set());
        setDragStart(null);
        setDragCurrent(null);
        setShowTabs(false);
        setActiveTab("all");
      }
      return next;
    });
    // Clear any previous measurement on either toggle direction.
    setRulerStart(null);
    setRulerEnd(null);
    setRulerCursor(null);
    setRulerSnap(null);
  }, []);

  // Container-level listeners for the ruler. Mirrors the drag-select effect: a
  // genuine click (no >5px movement) places/clears points; a drag pans the map
  // and never affects the ruler. Right-click cancels. UI controls and the
  // Maps InfoWindow are excluded so their clicks are never captured.
  useEffect(() => {
    if (!rulerMode) return;
    const container = containerRef.current;
    if (!container) return;

    let downPx: PixelPoint | null = null;
    let moved = false;

    const isUi = (e: Event) =>
      !!(e.target as Element).closest?.("[data-map-ui],.gm-style-iw,.gmnoprint");

    const onMouseDown = (e: MouseEvent) => {
      if (isUi(e)) return;
      const rect = container.getBoundingClientRect();
      downPx = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      moved = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      const map = mapRef.current;
      if (!map) return;
      const rect = container.getBoundingClientRect();
      const px = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      if (downPx && Math.hypot(px.x - downPx.x, px.y - downPx.y) > 5) moved = true;
      // Frozen: the segment stays put — ignore movement entirely.
      if (rulerEndRef.current) return;
      if (isUi(e)) return;
      const snap = computeRulerSnap(px);
      const ll   = pixelToLatLng(map, container, px.x, px.y);
      setRulerSnap(snap);
      setRulerCursor(snap ?? { lat: ll.lat, lng: ll.lng });
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!downPx) return;
      const rect = container.getBoundingClientRect();
      const px = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const isClick = !moved && Math.hypot(px.x - downPx.x, px.y - downPx.y) <= 5;
      downPx = null;
      moved = false;
      if (isClick) handleRulerClick(px);
    };

    const onContextMenu = (e: MouseEvent) => {
      if (isUi(e)) return;
      e.preventDefault();
      resetRuler();
    };

    container.addEventListener("mousedown",   onMouseDown);
    container.addEventListener("mousemove",    onMouseMove);
    document.addEventListener("mouseup",       onMouseUp);
    container.addEventListener("contextmenu",  onContextMenu);
    return () => {
      container.removeEventListener("mousedown",  onMouseDown);
      container.removeEventListener("mousemove",   onMouseMove);
      document.removeEventListener("mouseup",      onMouseUp);
      container.removeEventListener("contextmenu", onContextMenu);
    };
  }, [rulerMode, computeRulerSnap, handleRulerClick, resetRuler]);

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
  // Groups filter — toggle a single code / select-all-deselect-all (Slice #18.08)
  // -------------------------------------------------------------------------

  const toggleGroupChecked = useCallback((code: string) => {
    setUncheckedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

  const toggleAllGroups = useCallback(() => {
    // If every code is currently checked, uncheck all; otherwise check all.
    setUncheckedGroups((prev) => {
      const everyChecked = allGroupCodes.every((c) => !prev.has(c));
      return everyChecked ? new Set(allGroupCodes) : new Set();
    });
  }, [allGroupCodes]);

  // -------------------------------------------------------------------------
  // Drag-to-select — container-level DOM listeners
  // -------------------------------------------------------------------------
  //
  // The overlay div is purely visual (pointer-events: none).  We listen on the
  // container element directly so that clicks inside the Google Maps InfoWindow
  // (which render at a high z-index inside the Maps DOM) are never intercepted.
  // We skip drag initiation when the mousedown target is inside .gm-style-iw
  // (InfoWindow wrapper) or any other Google Maps UI control.

  useEffect(() => {
    if (!selectMode) return;

    const container = containerRef.current;
    if (!container) return;

    let startPx:  PixelPoint | null = null;
    let isDrag = false;

    const onMouseDown = (e: MouseEvent) => {
      if (activeTabRef.current !== "all") return;
      // Let InfoWindow button clicks pass through — never start a drag here.
      if ((e.target as Element).closest?.(".gm-style-iw")) return;
      const rect = container.getBoundingClientRect();
      startPx   = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      isDrag    = false;
      setDragStart(startPx);
      setDragCurrent(startPx);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!startPx) return;
      const rect = container.getBoundingClientRect();
      const cur  = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      if (Math.hypot(cur.x - startPx.x, cur.y - startPx.y) > 5) isDrag = true;
      if (isDrag) setDragCurrent(cur);
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!startPx) return;
      if (isDrag && mapRef.current) {
        const rect = container.getBoundingClientRect();
        const end  = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        const map  = mapRef.current;
        const minX = Math.min(startPx.x, end.x);
        const maxX = Math.max(startPx.x, end.x);
        const minY = Math.min(startPx.y, end.y);
        const maxY = Math.max(startPx.y, end.y);
        const sw   = pixelToLatLng(map, container as HTMLDivElement, minX, maxY);
        const ne   = pixelToLatLng(map, container as HTMLDivElement, maxX, minY);
        const next = new Set<string>();
        for (const prop of withGeometryRef.current) {
          if (propertyInRect(prop, sw.lat, sw.lng, ne.lat, ne.lng)) next.add(prop.id);
        }
        setSelectedIds(next);
      }
      startPx = null;
      isDrag  = false;
      setDragStart(null);
      setDragCurrent(null);
    };

    container.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove",  onMouseMove);
    document.addEventListener("mouseup",    onMouseUp);
    return () => {
      container.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove",  onMouseMove);
      document.removeEventListener("mouseup",    onMouseUp);
    };
  }, [selectMode]); // withGeometry always accessed via withGeometryRef

  // -------------------------------------------------------------------------
  // Batch delete
  // -------------------------------------------------------------------------

  // Plain function (not useCallback): with the React Compiler enabled, manual
  // memoization here can't be preserved (react-hooks/preserve-manual-memoization)
  // and the compiler memoizes it for us. Nothing depends on its identity.
  const handleDeleteConfirm = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await batchDeleteProperties([...selectedIds]);
      setSelectedIds(new Set());
      setShowDeleteConfirm(false);
      setSelectMode(false);
      setDragStart(null);
      setDragCurrent(null);
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
  };

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
  // Ruler derived render values
  // -------------------------------------------------------------------------
  //
  // liveEnd is the second endpoint: the frozen end once set, otherwise the live
  // cursor. The distance read-out uses the affine transform (shown as "…" while
  // calibration is pending). The label sits at the segment midpoint when frozen,
  // else near the cursor.
  const rulerLiveEnd = rulerEnd ?? rulerCursor;
  const rulerHasSegment = rulerMode && !!rulerStart && !!rulerLiveEnd;

  const rulerDistanceText =
    rulerHasSegment && rulerStart && rulerLiveEnd
      ? rulerAffine
        ? formatMeters(
            rulerDistanceM(
              rulerAffine,
              { lat: rulerStart.lat, lon: rulerStart.lng },
              { lat: rulerLiveEnd.lat, lon: rulerLiveEnd.lng },
            ),
          )
        : "…"
      : null;

  const rulerLabelPos: LatLng | null =
    rulerHasSegment && rulerStart && rulerLiveEnd
      ? rulerEnd
        ? {
            lat: (rulerStart.lat + rulerEnd.lat) / 2,
            lng: (rulerStart.lng + rulerEnd.lng) / 2,
          }
        : rulerLiveEnd
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
      <div
        ref={containerRef}
        className="flex-1 min-h-0 relative"
        style={{
          cursor: rulerMode
            ? RULER_CURSOR
            : (selectMode && activeTab === "all")
              ? "crosshair"
              : undefined,
        }}
      >

        {/* Google Map */}
        {/* Street View Pegman (Slice #18.03a): `disableDefaultUI` is a master  */}
        {/* switch that hides every default control, including the Pegman.       */}
        {/* Individual controls can be turned back on over it — here we re-enable */}
        {/* only `streetViewControl` so the rest (fullscreen / zoom / map-type)  */}
        {/* stay suppressed. Its default position is the bottom-right corner,    */}
        {/* clear of the top-right toolbar and bottom-centre action buttons. The */}
        {/* dragged Pegman uses the map's built-in default panorama overlay,     */}
        {/* which (like the Pegman itself) is not billed.                        */}
        <Map
          mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "DEMO_MAP_ID"}
          defaultCenter={DEFAULT_CENTER}
          defaultZoom={DEFAULT_ZOOM}
          mapTypeId={mapType}
          disableDefaultUI
          streetViewControl
          gestureHandling={selectMode && activeTab === "all" ? "none" : "greedy"}
          draggableCursor={rulerMode ? RULER_CURSOR : undefined}
          draggingCursor={rulerMode ? RULER_CURSOR : undefined}
          style={{ width: "100%", height: "100%" }}
          onClick={(e) => { if (!rulerMode) handleMapClick(e.detail.latLng); }}
          onDblclick={(e) => { if (!rulerMode) handleMapDblClick(e.detail.latLng); }}
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

          {/* Ruler tool overlays (Slice #18.14.ruler) */}
          {rulerMode && (
            <RulerCalibrator active={rulerMode} onCalibrate={recalibrateRuler} />
          )}
          {rulerHasSegment && rulerStart && rulerLiveEnd && (
            <RulerSegment start={rulerStart} end={rulerLiveEnd} />
          )}
          {rulerMode && !rulerEnd && rulerSnap && (
            <RulerSnapRing corner={rulerSnap} />
          )}
          {rulerMode && rulerStart && (
            <CornerMarker
              corner={{ lat: rulerStart.lat, lon: rulerStart.lng }}
              color={RULER_GREEN}
            />
          )}
          {rulerMode && rulerEnd && (
            <CornerMarker
              corner={{ lat: rulerEnd.lat, lon: rulerEnd.lng }}
              color={RULER_GREEN}
            />
          )}
          {rulerDistanceText && rulerLabelPos && (
            <RulerDistanceLabel
              position={rulerLabelPos}
              text={rulerDistanceText}
              frozen={!!rulerEnd}
            />
          )}

          {/* InfoWindow — shown on click in both normal and select modes.     */}
          {/* Double-click navigates straight to "Open →" when the click      */}
          {/* resolves to exactly one property (see handleMapDblClick).       */}
          {/* Normal mode: label + "Open →" link.                             */}
          {/* Select mode (all tab): label + red Select / green Unselect btn. */}
          {/* Selected tab: label + "Open →" link (no select actions).        */}
          {selected && (
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

                    {selectMode && activeTab === "all" ? (
                      // Select mode: show Select / Unselect toggle button
                      <button
                        type="button"
                        onClick={() => togglePropertySelected(item.id)}
                        className={[
                          "text-xs font-semibold text-left underline cursor-pointer",
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
        {/* Drag-to-select overlay — visual only (pointer-events: none)     */}
        {/* Drag logic lives in a container-level useEffect so InfoWindow   */}
        {/* button clicks are never intercepted by the overlay.             */}
        {/* ---------------------------------------------------------------- */}
        {selectionRect && activeTab === "all" && (
          <div
            className="absolute inset-0 z-10"
            style={{ pointerEvents: "none" }}
          >
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
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Toolbar — top-right: Select toggle + STR / SAT                   */}
        {/* Only shown on the "all properties" tab                           */}
        {/* ---------------------------------------------------------------- */}
        {activeTab === "all" && (
          <div data-map-ui className="absolute top-3 right-3 z-20 flex items-start gap-2">
            {/* Ruler — measure real ground distance (Slice #18.14.ruler).      */}
            {/* Sits to the left of Groups; depressed while active.             */}
            <button
              type="button"
              onClick={toggleRulerMode}
              aria-pressed={rulerMode}
              title={t("map.rulerHint")}
              className={[
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded shadow border transition-colors",
                rulerMode
                  ? "bg-cta text-white border-cta"
                  : "bg-white text-ink border-wire hover:bg-canvas",
              ].join(" ")}
            >
              <RulerIcon />
              {t("map.rulerButton")}
            </button>

            {/* Groups filter — button + dropdown panel (Slice #18.08).        */}
            {/* Panel is anchored under the button (left-0 right-0 → exactly    */}
            {/* the button's width) and lists each group code with a checkbox;  */}
            {/* all checked by default. Unchecking a group hides properties     */}
            {/* whose every group is unchecked.                                 */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setGroupsPanelOpen((o) => !o)}
                aria-expanded={groupsPanelOpen}
                title={t("map.groupsButton")}
                className={[
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded shadow border transition-colors",
                  groupsPanelOpen
                    ? "bg-cta text-white border-cta"
                    : "bg-white text-ink border-wire hover:bg-canvas",
                ].join(" ")}
              >
                {t("map.groupsButton")}
              </button>

              {groupsPanelOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 rounded shadow-lg border border-wire bg-white overflow-hidden">
                  {allGroupCodes.length === 0 ? (
                    <div className="px-2 py-1.5 text-[11px] text-fade whitespace-nowrap">
                      {t("map.groupsEmpty")}
                    </div>
                  ) : (
                    <>
                      {/* Select all / deselect all */}
                      <label className="flex items-center gap-1.5 px-2 py-1.5 border-b border-crease cursor-pointer hover:bg-cta-pale">
                        <input
                          type="checkbox"
                          checked={allGroupsChecked}
                          onChange={toggleAllGroups}
                          className="h-3.5 w-3.5 shrink-0 rounded border-wire accent-cta"
                        />
                        <span className="text-[11px] font-semibold text-ink truncate">
                          {allGroupsChecked
                            ? t("map.groupsDeselectAll")
                            : t("map.groupsSelectAll")}
                        </span>
                      </label>

                      {/* Group list — 5 rows tall, then scrolls */}
                      <div className="max-h-[150px] overflow-y-auto">
                        {allGroupCodes.map((code) => (
                          <label
                            key={code}
                            className="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer hover:bg-cta-pale"
                          >
                            <input
                              type="checkbox"
                              checked={!uncheckedGroups.has(code)}
                              onChange={() => toggleGroupChecked(code)}
                              className="h-3.5 w-3.5 shrink-0 rounded border-wire accent-cta"
                            />
                            <span className="font-mono text-xs text-ink">{code}</span>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

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
