"use client";

import { useNameOr } from "@/components/record/use-name-or";
import { ArrowRight, Check, DraftingCompass, Fence, FolderPlus, Group, Plus, RotateCcw, Ruler, ScanEye, Settings2, Square, SquareCheck, SquareDashedMousePointer, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  AdvancedMarker,
  AdvancedMarkerAnchorPoint,
  Circle,
  InfoWindow,
  Map,
  Polygon,
  Polyline,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { mapRenderingType } from "@/lib/ui/map-rendering";

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
import {
  computeVertexAngles,
  arcSvgPath,
  arcLabelPosition,
  type AngleArcInfo,
} from "@/lib/geo/angles";
import { HelpHint } from "@/components/help/help-hint";
import { MapCameraProbe } from "@/components/maps/map-camera-probe";
import { IconButton } from "@/lib/ui/icon-button";
import { MAP_BOX_HEIGHT_REM, PANEL_UNIT_INNER_REM } from "@/lib/ui/field-widths";
import { AREA_STROKE, addCorner, nextAreaMode, removeLastCorner, type AreaMode } from "@/lib/geo/area-tool";
import { AreaDelimitedIcon, AreaFreeIcon } from "@/components/icons/area-icons";
import { usePolygonDraw } from "@/components/maps/use-polygon-draw";
import { AREA_PULSE_CLASS, readAreaPulse, useAreaPulse } from "@/lib/ui/area-pulse";
import { AreaLayer } from "./area-layer";
import { TarlaLayer } from "@/components/maps/tarla-layer";
import { tarlaOutlines } from "@/lib/geo/tarla-outline";
import { NavigateButton } from "@/components/maps/navigate-dialog";
import {
  FOCUS_BLINK,
  PROPERTY_MAP_PATH,
  blinkIntensity,
  cornersBoundsCenter,
  parseMapFocus,
  zoomToFitCorners,
} from "@/lib/geo/map-focus";
import {
  CORNER_DOT_PX,
  DROP_SIZE,
  MERGE_DISTANCE,
  boxCentre,
  dropTone,
  isDrop,
  mergeDrops,
  numberedDropAction,
  numberedDropZoom,
  shapeBox,
  unionBox,
  worldPoint,
  worldToLatLon,
  type DropBox,
  type DropPoint,
  type DropTone,
} from "@/lib/geo/map-drops";
import { useMergeDistance } from "@/components/maps/use-merge-distance";
import { useToast } from "@/components/toast";
import { GROUPS_FROM_MAP_PATH, forgetNewGroup, readMapSelection, readNewGroup, writeMapSelection } from "@/lib/groups/map-selection";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Corner = { lat: number; lon: number };

type MapProperty = {
  id:         string;
  code:       string;
  nickname:   string | null;
  // Slice #39.68: the property's tarla — its corners make the tarla's outline when the tarla has none drawn.
  tarlaId:    string | null;
  corners:    Corner[];
  // PROPERTY-group codes this property belongs to (Slice #18.08). Empty when
  // it belongs to no group.
  groupCodes: string[];
};

type MapResponse = {
  items: MapProperty[];
  // Every PROPERTY-target group code — the Groups panel's checkbox list.
  allGroupCodes: string[];
  // Slice #39.68: every tarla, with its own (drawn) corners — the „Tarlale" layer.
  tarlale?: { id: string; indicativ: string; locality: string | null; corners: Corner[] }[];
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

// Slice #39.73 — the map deletes nothing. „Selectează" picks properties for a property group instead; a property is
// deleted only from its own form (Adrian, 2026-10-17: „a property should be deleted only from the property form").

type PickerGroup = { id: string; code: string; description: string; memberCount: number };

async function fetchPropertyGroups(): Promise<PickerGroup[]> {
  const res = await fetch("/api/groups?targetType=PROPERTY");
  if (!res.ok) throw new Error(`Failed to load groups (${res.status})`);
  const data = (await res.json()) as { items: PickerGroup[] };
  return data.items;
}

/** Why an add failed: the three-groups cap (409), or anything else. */
class AddToGroupError extends Error {
  constructor(readonly status: number, detail: string) {
    super(`Add to group failed (${status})${detail ? `: ${detail}` : ""}`);
    this.name = "AddToGroupError";
  }
}

/** PATCH /api/groups/[id] with `addMemberIds`: the selection joins the group; one already in it stays as it is. */
async function addToGroup(groupId: string, ids: string[]): Promise<{ code: string; memberCount: number }> {
  const res = await fetch(`/api/groups/${groupId}`, {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ addMemberIds: ids }),
  });
  if (!res.ok) throw new AddToGroupError(res.status, await res.text().catch(() => ""));
  const detail = (await res.json()) as { code: string; members: unknown[] };
  return { code: detail.code, memberCount: detail.members.length };
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
// Map pixel → LatLng conversion (the ruler, the angles and the area tools)
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
  // ⚠️ The loop variable used to be called `t`, shadowing nothing at the time
  // because this component had no translator — which is exactly how a later
  // `t("map.typeStreet")` in here would have compiled and called a MapTypeId.
  // It is `id` now, and the translator is the only `t` in scope.
  const t = useTranslations("property");
  return (
    <div className="flex overflow-hidden rounded shadow border border-wire bg-white">
      {(["roadmap", "hybrid"] as MapTypeId[]).map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={[
            "px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors",
            value === id
              ? "bg-cta text-white"
              : "text-ink hover:bg-canvas",
          ].join(" ")}
        >
          {id === "roadmap" ? t("map.typeStreet") : t("map.typeSatellite")}
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
//
// Slice #37.38: THE FIRST FIT YIELDS TO A FOCUS. When the map was opened on a
// Property (`?focus=`), `holdInitial` keeps the first fit back until the data
// says whether that Property is on the map, and `initialView` then replaces it:
// the camera goes to the Property's centre at the mini-map's zoom, and nothing
// refits over it. A later tab change by the user refits as before.

type InitialView = { center: LatLng; zoom: number };

function FitAllProperties({
  items,
  tabKey,
  holdInitial = false,
  initialView = null,
  onInitialView,
}: {
  items:   MapProperty[];
  tabKey:  string;
  holdInitial?: boolean;
  initialView?: InitialView | null;
  onInitialView?: () => void;
}) {
  const map    = useMap();
  const core   = useMapsLibrary("core");
  const fitted = useRef(false);
  const firstDone = useRef(false);

  // Reset the guard when the tab changes so we refit on every tab switch.
  // Slice #37.38: only on a REAL change of tab. The effect also re-runs with
  // the same tab — a Fast Refresh, a Strict Mode replay — and a refit then
  // undid the focus; measured on the first drive of TC-MAP-01.
  const lastTab = useRef(tabKey);
  useEffect(() => {
    if (lastTab.current === tabKey) return;
    lastTab.current = tabKey;
    fitted.current  = false;
  }, [tabKey]);

  useEffect(() => {
    if (!map || !core || fitted.current) return;
    if (!firstDone.current) {
      if (holdInitial) return;
      if (initialView) {
        map.moveCamera({ center: initialView.center, zoom: initialView.zoom });
        fitted.current    = true;
        firstDone.current = true;
        onInitialView?.();
        return;
      }
    }
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
    fitted.current    = true;
    firstDone.current = true;
  }, [map, core, items, tabKey, holdInitial, initialView, onInitialView]);

  return null;
}

// ---------------------------------------------------------------------------
// FocusBlink — the focused Property blinks green three times (Slice #37.38)
// ---------------------------------------------------------------------------
//
// A second shape drawn over the Property's own, in the green of
// `.ga-vpulse-green`, whose opacity follows that pulse's curve
// (`blinkIntensity`: 0.8 s ease-in-out cycles, three of them). At 0 it is
// invisible and the Property shows its normal colour beneath; after 2.4 s it
// is gone. Its own component, so only it re-renders on each animation frame —
// not the whole map with every polygon on it. Not clickable, so a click goes
// through to the map's own hit-test as on any other polygon.

function FocusBlink({ prop, onDone }: { prop: MapProperty; onDone: () => void }) {
  const [level, setLevel] = useState(0);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      // A frame's timestamp is when the frame BEGAN, which can be a little
      // before `start` was read — measured on the first drive of TC-MAP-01: a
      // negative elapsed time, read as "over", ended the blink before it began.
      const i = blinkIntensity(Math.max(0, now - start), reduced);
      if (i === null) {
        setLevel(0);
        onDoneRef.current();
        return;
      }
      setLevel(i);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const common = {
    strokeColor:   FOCUS_BLINK.rgb,
    strokeOpacity: FOCUS_BLINK.peakStroke * level,
    strokeWeight:  3,
    fillColor:     FOCUS_BLINK.rgb,
    fillOpacity:   FOCUS_BLINK.peakFill * level,
    clickable:     false,
    zIndex:        1000,
  };
  return prop.corners.length >= 3 ? (
    <Polygon paths={toLatLng(prop.corners)} {...common} />
  ) : (
    <Circle center={{ lat: prop.corners[0].lat, lng: prop.corners[0].lon }} radius={25} {...common} />
  );
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
        // Slice #39.07: where the corner is, for the area tool's spec (TC-MAP-02) to click it.
        data-corner-marker={`${corner.lat},${corner.lon}`}
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
// The big map's corners, drops and numbered drops  (Slice #39.60)
// ---------------------------------------------------------------------------
//
// Adrian, 2026-10-16: corners „much smaller … with the colour of the sides (Blue, not red and white)" — 4 px, the
// polygon's own colour, no ring, drawn only while the polygon is; and, zoomed out, „each Polygon replaced with the
// symbol of an upside down drop … just one solid colour", the same size at every zoom, crowded drops merged into
// one „that has a number inside (in white fonts)". What is a drop, and what merges, is `src/lib/geo/map-drops.ts`.
// The Ruler keeps its own green corners (CornerMarker, above).

const SHAPE_COLOR: Record<DropTone, string> = { selected: "#ef4444", duplicate: "#ec4899", normal: "#3b82f6" };

/** A property polygon's corner: a dot centred ON the corner. `data-corner-marker` is where TC-MAP-02 clicks. */
function PropertyCornerDot({ corner, color }: { corner: Corner; color: string }) {
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
type PlacedDrop = { key: string; items: MapProperty[]; position: LatLng; tone: DropTone };

/**
 * A drop, its tip on the property's centre (AdvancedMarker's own bottom-centre anchor), or a numbered drop with the
 * count in white. Clickable only when no tool that takes clicks is pressed; otherwise a click goes through to the map.
 */
function PropertyDrop({
  drop,
  title,
  blinkOn,
  clickable,
  onClick,
}: {
  drop:      PlacedDrop;
  title:     string;
  blinkOn:   boolean;
  clickable: boolean;
  onClick:   (drop: PlacedDrop) => void;
}) {
  const count = drop.items.length;
  const size = count > 1 ? DROP_SIZE.numbered : DROP_SIZE.single;
  const fontPx = count >= 100 ? 11 : count >= 10 ? 13 : 14;
  return (
    <AdvancedMarker
      position={drop.position}
      title={title}
      zIndex={count > 1 ? 3 : 2}
      onClick={clickable ? () => onClick(drop) : undefined}
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
            stroke="#fff"
            strokeWidth={1.4}
          />
        </svg>
        {count > 1 && (
          <span
            aria-hidden="true"
            style={{
              position:      "absolute",
              left:          0,
              top:           0,
              width:         size.w,
              height:        size.w,
              lineHeight:    `${size.w}px`,
              textAlign:     "center",
              color:         "#fff",
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

/**
 * „Setări hartă" — the merge distance, kept per browser (#39.60's Ask first 2). A slider on the 5 px step, the value
 * beside it, what it does in words, and the way back to the default.
 */
function MapSettingsPanel({ value, onChange }: { value: number; onChange: (px: number) => void }) {
  const t = useTranslations("property");
  return (
    <div
      data-map-settings
      className="absolute right-0 top-full mt-1 w-72 rounded shadow-lg border border-wire bg-white p-3 flex flex-col gap-2"
    >
      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-ink">{t("map.mergeDistanceLabel")}</span>
        <span className="flex items-center gap-2">
          <input
            type="range"
            min={MERGE_DISTANCE.min}
            max={MERGE_DISTANCE.max}
            step={MERGE_DISTANCE.step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="flex-1 accent-cta"
            aria-valuetext={t("map.mergeDistanceValue", { px: value })}
          />
          <span className="w-12 text-right font-mono text-xs text-ink tabular-nums" data-map-merge-distance={value}>
            {t("map.mergeDistanceValue", { px: value })}
          </span>
          <IconButton
            icon={RotateCcw}
            label={t("map.mergeDistanceReset", { px: MERGE_DISTANCE.default })}
            variant="secondary"
            size="xs"
            disabled={value === MERGE_DISTANCE.default}
            onClick={() => onChange(MERGE_DISTANCE.default)}
          />
        </span>
      </label>
      <p className="text-[11px] leading-snug text-fade">{t("map.mergeDistanceHelp")}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ruler tool — inner components + helpers  (Slice #18.14.ruler)
// ---------------------------------------------------------------------------

// The toolbar's own glyphs (angles, groups, ruler) were hand-drawn SVGs here
// until #37.45; the buttons draw Lucide's DraftingCompass, Group and Ruler now.

// ---------------------------------------------------------------------------
// Angles tool — corner-pixel → neighbor collection → arc computation (pure)
// ---------------------------------------------------------------------------

/**
 * For every polygon corner in `items` that coincides with `snap` (within
 * CORNER_TOL degrees), collect its two polygon neighbours. Then delegate to
 * computeVertexAngles to determine the displayable arc sectors.
 *
 * The snap LatLng is taken directly from the stored corner data, so the
 * tolerance is kept near-zero (1e-9°) to ensure only the exact snapped
 * corner matches — not nearby corners from thin polygons or other properties.
 * Using a wide tolerance (e.g. 0.0001° ≈ 10 m) causes false matches when
 * two polygon corners are close together, producing spurious extra sectors.
 */
const CORNER_TOL = 1e-9; // near-exact: snap returns the stored LatLng value

function computeAnglesAtSnap(snap: LatLng, items: MapProperty[]): AngleArcInfo[] {
  const neighbors: Corner[] = [];
  for (const prop of items) {
    const n = prop.corners.length;
    if (n < 2) continue;
    for (let i = 0; i < n; i++) {
      const c = prop.corners[i];
      if (
        Math.abs(c.lat - snap.lat) < CORNER_TOL &&
        Math.abs(c.lon - snap.lng) < CORNER_TOL
      ) {
        // This corner matches the snapped point — collect its neighbours.
        neighbors.push(prop.corners[(i - 1 + n) % n]);
        neighbors.push(prop.corners[(i + 1) % n]);
      }
    }
  }
  return computeVertexAngles({ lat: snap.lat, lon: snap.lng }, neighbors);
}

// ---------------------------------------------------------------------------
// MapAngleArcOverlay — renders the angle arc(s) for one snapped corner
// ---------------------------------------------------------------------------

const MAP_ARC_RADIUS       = 24;
const MAP_ARC_LABEL_OFFSET = 10;
// SVG canvas large enough to hold arc + label, centred on the corner point.
const MAP_ARC_HALF = 50;
const MAP_ARC_SIZE = MAP_ARC_HALF * 2;

function MapAngleArcOverlay({
  corner,
  arcs,
}: {
  corner: LatLng;
  arcs:   AngleArcInfo[];
}) {
  return (
    <>
      {arcs.map((info, i) => {
        const path  = arcSvgPath(info, MAP_ARC_RADIUS);
        const lp    = arcLabelPosition(info, MAP_ARC_RADIUS, MAP_ARC_LABEL_OFFSET);
        const label = `${Math.round(info.angleDeg)}°`;
        return (
          <AdvancedMarker key={i} position={corner}>
            {/*
              * 0×0 position:relative anchor — AdvancedMarker's bottom-centre
              * on a 0×0 element is exactly the corner point. The SVG is
              * absolutely positioned and offset by half its size so its (0,0)
              * aligns with the anchor. The centred viewBox makes SVG (0,0) =
              * the corner on screen, matching the M 0 0 start of every arc path.
              */}
            <div style={{ position: "relative", width: 0, height: 0, pointerEvents: "none" }}>
              <svg
                width={MAP_ARC_SIZE}
                height={MAP_ARC_SIZE}
                viewBox={`${-MAP_ARC_HALF} ${-MAP_ARC_HALF} ${MAP_ARC_SIZE} ${MAP_ARC_SIZE}`}
                style={{
                  position: "absolute",
                  top: -MAP_ARC_HALF,
                  left: -MAP_ARC_HALF,
                  overflow: "visible",
                  pointerEvents: "none",
                }}
              >
                <path
                  d={path}
                  fill="rgba(34,197,94,0.35)"
                  stroke="#16a34a"
                  strokeWidth={1.5}
                />
                <text
                  x={lp.x}
                  y={lp.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={20}
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
      })}
    </>
  );
}

// Custom cursor — a sniper-scope crosshair (28×28, hot-spot at centre 14 14).
const RULER_CURSOR_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'>" +
  "<line x1='14' y1='0' x2='14' y2='28' stroke='#111111' stroke-width='1.5'/>" +
  "<line x1='0' y1='14' x2='28' y2='14' stroke='#111111' stroke-width='1.5'/>" +
  "<circle cx='14' cy='14' r='4' fill='none' stroke='#111111' stroke-width='1.5'/>" +
  "</svg>";
const RULER_CURSOR = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  RULER_CURSOR_SVG,
)}") 14 14, crosshair`;

// Angles-tool cursor — a filled green right-angle triangle (20×20, hot-spot at
// the right-angle vertex: bottom-left, pixel 2 18).
const ANGLES_CURSOR_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'>" +
  "<polygon points='2,18 2,2 18,18' fill='rgba(34,197,94,0.75)' stroke='#15803d' stroke-width='1.5' stroke-linejoin='round'/>" +
  "<polyline points='2,14 6,14 6,18' fill='none' stroke='#15803d' stroke-width='1.2'/>" +
  "</svg>";
const ANGLES_CURSOR = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  ANGLES_CURSOR_SVG,
)}") 2 18, crosshair`;

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

export default function PropertyMap({ canEditGroups }: { canEditGroups: boolean }) {
  const t           = useTranslations("property");
  const nameOr      = useNameOr();
  const queryClient = useQueryClient();
  const router      = useRouter();

  // Map display
  const [mapType,  setMapType]  = useState<MapTypeId>("roadmap");
  const [selected, setSelected] = useState<Selected | null>(null);

  // Selection mode — Slice #39.73: a click on a property adds it or takes it out; the selection goes to a group.
  // Read once from this tab's storage (map-selection.ts), so the round trip to „Grupuri" keeps it. Client-only
  // component (map-view.tsx), so `window` is there for the initialisers.
  const [stored] = useState(readMapSelection);
  const [selectMode,  setSelectMode]  = useState(stored.selecting);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(stored.ids));
  // The group picker — open on arrival when „Grup nou…" left it open; the group just made there, chosen.
  const [pickerOpen, setPickerOpen] = useState(stored.selecting && stored.pickerOpen);
  const [pickedGroup, setPickedGroup] = useState<string | null>(() => (stored.selecting ? readNewGroup() : null));
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const { toast, show: showToast } = useToast();

  // Tab state — showTabs becomes true when "Display all selected" is clicked
  const [showTabs,  setShowTabs]  = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("all");
  // Slice #39.09: the map's address, read for ?area (below, by the toolbar's pulse).
  const searchParams = useSearchParams();
  const [areaTabSeen, setAreaTabSeen] = useState(false);

  // Groups filter (Slice #18.08) — panel open state + the set of UNCHECKED
  // group codes. Tracking unchecked (rather than checked) means "all checked"
  // is the empty-set default, so no async init from the loaded code list.
  const [groupsPanelOpen, setGroupsPanelOpen] = useState(false);
  // Slice #39.68: the „Tarlale" layer — off by default (Ask first 2).
  const [showTarlale, setShowTarlale] = useState(false);
  const [uncheckedGroups, setUncheckedGroups] = useState<Set<string>>(new Set());
  const mapGroupsMasterRef = useRef<HTMLInputElement>(null);

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

  // Angles tool (Slice #19.05) — mutually exclusive with ruler + select mode.
  // anglesSnap is the corner being hovered (drives the snap ring).
  // anglesDisplay is the committed result of a corner click.
  const [anglesMode,    setAnglesMode]    = useState(false);
  const [anglesSnap,    setAnglesSnap]    = useState<LatLng | null>(null);
  const [anglesDisplay, setAnglesDisplay] = useState<{ corner: LatLng; arcs: AngleArcInfo[] } | null>(null);

  // The area tools (Slices #39.07, #39.08) — „Suprafața unei zone delimitate" and „… oarecare". While either is
  // pressed nothing else on the map works (the other tools are disabled, a click opens no InfoWindow, the bottom
  // bar is hidden); panning and zooming do. Nothing is written. `areaCorners` is the polygon, in order; `areaSnap`
  // the property corner the cursor is snapping to (the Ruler's ring).
  const [areaMode,    setAreaMode]    = useState<AreaMode | null>(null);
  const [areaCorners, setAreaCorners] = useState<readonly { lat: number; lon: number }[]>([]);
  const [areaSnap,    setAreaSnap]    = useState<LatLng | null>(null);
  const areaOn = areaMode !== null;
  // #39.08: „… oarecare" draws exactly as a new property's polygon is drawn — the mini-map's own hook, shared.
  const freeDraw = usePolygonDraw(areaCorners, setAreaCorners);
  const { startDraw: startFreeDraw, exitDraw: exitFreeDraw } = freeDraw;

  // Refs read inside the container-level ruler listeners so their closures
  // always see the latest values without re-binding on every change.
  const rulerStartRef   = useRef<LatLng | null>(null);
  const rulerEndRef     = useRef<LatLng | null>(null);
  const rulerCornersRef = useRef<LatLng[]>([]);
  const anglesSnapRef   = useRef<LatLng | null>(null);

  // Slice #39.60 — the map's zoom (what decides polygon or drop, and what merges) and the merge distance setting.
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [mergeDistance, setMergeDistance] = useMergeDistance();
  const [settingsOpen, setSettingsOpen] = useState(false);
  // When a drop took a click: the map's own click, if Google sends it too, must not close the bubble it opened.
  const dropClickAt = useRef(-Infinity);

  // Blink state for duplicate-polygon highlighting — toggled every 1 s.
  const [blinkOn, setBlinkOn] = useState(true);
  useEffect(() => {
    const timer = setInterval(() => setBlinkOn((b) => !b), 1000);
    return () => clearInterval(timer);
  }, []);

  // Slice #37.38 — the focus, read ONCE from the link that opened the map
  // (`?focus=<id>&z=<zoom>`, sent by „Proprietăți — Hartă" from a Property's
  // form) and then removed from the URL, so a reload or a later visit opens
  // the ordinary map. Read from `window.location` rather than
  // `useSearchParams`: this component is client-only (map-view.tsx), and a
  // value needed once on arrival is not one to re-render on.
  const [focus] = useState(() =>
    typeof window === "undefined" ? null : parseMapFocus(window.location.search),
  );
  useEffect(() => {
    if (focus) router.replace(PROPERTY_MAP_PATH, { scroll: false });
  }, [focus, router]);
  // "on" while the focused Property blinks, then "done" — read by TC-MAP-01.
  const [focusBlink, setFocusBlink] = useState<"on" | "done" | null>(null);
  const startFocusBlink = useCallback(() => setFocusBlink("on"), []);
  const endFocusBlink   = useCallback(() => setFocusBlink("done"), []);

  // Refs shared between outer handlers and inner MapRefCapture
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<google.maps.Map | null>(null);

  // Refs used inside the document-level drag-to-select listeners so the
  // closure always sees the latest values without needing them in the
  // dependency array.
  const withGeometryRef = useRef<MapProperty[]>([]);
  const activeTabRef    = useRef<ActiveTab>("all");
  const selectModeRef   = useRef(false);

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
  // #39.35: „Navighează" in the bubble takes the property's corners from here.
  const cornersById   = useMemo(() => new globalThis.Map((data?.items ?? []).map((p) => [p.id, p.corners] as const)), [data?.items]);
  // Slice #39.68: each tarla's outline — its drawn corners, else the hull of its properties' — computed once per load.
  const tarlaOnMap    = useMemo(
    () =>
      tarlaOutlines(data?.tarlale ?? [], data?.items ?? []).map(({ tarla, outline }) => ({
        id: tarla.id,
        indicativ: tarla.indicativ,
        locality: tarla.locality,
        outline,
      })),
    [data?.tarlale, data?.items],
  );

  // Group filter — applied only on the "all" tab. A property is hidden only
  // when every group it belongs to is unchecked (see isPropertyVisibleForGroups).
  const groupFiltered = withGeometry.filter((p) =>
    isPropertyVisibleForGroups(p.groupCodes, uncheckedGroups),
  );

  // Slice #32.15: a tick must correspond to a polygon that is actually drawn. Unticking a group in the Groups panel
  // drops the selected properties it has taken off the map — and only those (#21.10: `selectedIds` is not owned by
  // any one tool). An id that is not in `withGeometry` at all is left alone, so a refetch that briefly has no rows
  // cannot be mistaken for a filter change. Since #39.73 the selection goes to a group, not to a delete, but adding
  // properties nobody can see is the same mistake. Not while an add is in flight: it captured its ids at the click.
  if (!adding && selectedIds.size > 0) {
    const hiddenIds = new Set(
      withGeometry
        .filter(
          (p) =>
            selectedIds.has(p.id) &&
            !isPropertyVisibleForGroups(p.groupCodes, uncheckedGroups),
        )
        .map((p) => p.id),
    );
    if (hiddenIds.size > 0) {
      const kept = new Set([...selectedIds].filter((id) => !hiddenIds.has(id)));
      setSelectedIds(kept);
      if (kept.size === 0) {
        // An empty "Selected" tab is a blank map with no way back except the other tab. Select mode is deliberately
        // NOT exited — the user is still selecting.
        setShowTabs(false);
        setActiveTab("all");
      }
    }
  }

  // Items shown on the current tab — filtered to selected IDs on the "selected"
  // tab; group-filtered on the "all" tab.
  const displayItems =
    activeTab === "selected"
      ? withGeometry.filter((p) => selectedIds.has(p.id))
      : groupFiltered;

  // Whether every group is currently checked (drives the master checkbox).
  // All = "Not in a group" checked AND every code checked.
  const allGroupsChecked =
    !uncheckedGroups.has("_ungrouped") &&
    (allGroupCodes.length === 0 || allGroupCodes.every((c) => !uncheckedGroups.has(c)));
  const someGroupsChecked =
    !allGroupsChecked &&
    (!uncheckedGroups.has("_ungrouped") || allGroupCodes.some((c) => !uncheckedGroups.has(c)));

  // Properties whose corner set is identical to at least one other property.
  const duplicateIds = findDuplicateIds(withGeometry);

  // Slice #39.60 — at this zoom, which properties are polygons and where the drops stand. Each property is decided on
  // its own size on screen; the drops then merge (map-drops.ts). Recomputed on every zoom, so zooming in undoes it.
  const toneOf = (ids: readonly string[]): DropTone =>
    dropTone(ids, (id) => selectedIds.has(id) && activeTab === "all", (id) => duplicateIds.has(id));
  const polygonIds = new Set<string>();
  const dropPoints: DropPoint<MapProperty>[] = [];
  for (const prop of displayItems) {
    const box = shapeBox(prop.corners);
    if (!box) continue;
    if (!isDrop(box, zoom)) {
      polygonIds.add(prop.id);
      continue;
    }
    const c = boxCentre(box);
    const w = worldPoint(c.lat, c.lon, zoom);
    dropPoints.push({ x: w.x, y: w.y, item: prop });
  }
  const drops: PlacedDrop[] = mergeDrops(dropPoints, mergeDistance).map((cl) => {
    const ids = cl.items.map((p) => p.id);
    const at = worldToLatLon(cl, zoom);
    return {
      key:      `${[...ids].sort()[0]}:${ids.length}`,
      items:    cl.items,
      position: { lat: at.lat, lng: at.lon },
      tone:     toneOf(ids),
    };
  });
  const dropsClickable = !rulerMode && !anglesMode && !areaOn;

  // Slice #37.38 — the focused Property, once the data says whether it is on
  // the map. Until then the first fit is held back (FitAllProperties).
  const focusProp = focus && data ? withGeometry.find((p) => p.id === focus.id) ?? null : null;
  const focusMissing = focus !== null && data !== undefined && focusProp === null;
  const focusCenter = focusProp ? cornersBoundsCenter(focusProp.corners) : null;
  const focusZoom = focusProp
    ? focus?.zoom ??
      zoomToFitCorners(
        focusProp.corners,
        PANEL_UNIT_INNER_REM.property.map * 16 - 2,
        MAP_BOX_HEIGHT_REM * 16 - 2,
      )
    : null;
  // A new object each render is harmless: FitAllProperties uses it once, on
  // its first fit, and returns early on every render after that.
  const focusView: InitialView | null =
    focusCenter && focusZoom !== null ? { center: focusCenter, zoom: focusZoom } : null;
  // Never a silent no-op: a focus the map cannot show says which id it was.
  useEffect(() => {
    if (focusMissing && focus) {
      console.warn(
        `[properties map] focus=${focus.id} is not on the map (deleted since, or no polygon drawn); opening the whole map.`,
      );
    }
  }, [focusMissing, focus]);

  // Keep refs in sync after every render.
  useEffect(() => {
    withGeometryRef.current = displayItems;
    activeTabRef.current    = activeTab;
    selectModeRef.current   = selectMode;
    rulerStartRef.current   = rulerStart;
    rulerEndRef.current     = rulerEnd;
    anglesSnapRef.current   = anglesSnap;
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

  // -------------------------------------------------------------------------
  // Individual property select / unselect (a click in select mode, or the bubble of a numbered drop's list)
  // -------------------------------------------------------------------------

  const togglePropertySelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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
    // Slice #39.73: selecting, a click adds the property under it, or takes it out. Where shapes overlap it is the
    // smallest — the one the click is most surely on (`findOverlapping` sorts largest first).
    if (selectModeRef.current && activeTabRef.current === "all") {
      setSelected(null);
      togglePropertySelected(overlapping[overlapping.length - 1].id);
      return;
    }
    setSelected({
      position: pos,
      // #37.57: a property by its nickname, or words — never its system ID.
      items:    overlapping.map((p) => ({ id: p.id, label: nameOr(p.nickname, "property") })),
    });
  }, [nameOr, togglePropertySelected]);

  const handleMapDblClick = useCallback((pos: LatLng | null) => {
    if (!pos) return;
    // Slice #39.73: selecting, the double click's two clicks have already done their work (each added or took out).
    if (selectMode && activeTabRef.current === "all") return;
    const overlapping = findOverlapping(withGeometryRef.current, pos);

    if (overlapping.length === 1) {
      router.push(`/properties/${overlapping[0].id}`);
      return;
    }

    // Ambiguous (0 or ≥2 matches) — fall back to the same behaviour as a single click.
    handleMapClick(pos);
  }, [router, selectMode, handleMapClick]);

  // Slice #39.60 — a drop's click opens the bubble its polygon opens. A numbered drop's zooms to fit its properties;
  // at the closest zoom, or when fitting them would not go closer, it opens the bubble listing them instead.
  const handleDropClick = useCallback((drop: PlacedDrop) => {
    dropClickAt.current = performance.now();
    const openList = () =>
      setSelected({
        position: drop.position,
        items:    drop.items.map((p) => ({ id: p.id, label: nameOr(p.nickname, "property") })),
      });
    if (drop.items.length === 1) {
      // Slice #39.73: selecting, a drop is its property — the click adds it or takes it out, as on its polygon.
      if (selectModeRef.current && activeTabRef.current === "all") {
        setSelected(null);
        togglePropertySelected(drop.items[0].id);
        return;
      }
      openList();
      return;
    }
    const map = mapRef.current;
    const box = containerRef.current;
    const boxes = drop.items.map((p) => shapeBox(p.corners)).filter((b): b is DropBox => b !== null);
    const target = box ? numberedDropZoom(boxes, box.clientWidth, box.clientHeight) : null;
    const all = unionBox(boxes);
    if (!map || !all || target === null || numberedDropAction(map.getZoom() ?? DEFAULT_ZOOM, target) === "list") {
      openList();
      return;
    }
    setSelected(null);
    const c = boxCentre(all);
    map.moveCamera({ center: { lat: c.lat, lng: c.lon }, zoom: target });
  }, [nameOr, togglePropertySelected]);

  // -------------------------------------------------------------------------
  // Selection mode toggle
  // -------------------------------------------------------------------------

  // Slice #21.10.help.rollout bugfix: switching between Select / Ruler /
  // Angles used to silently discard whatever properties were selected,
  // because every "entering this tool" branch called
  // setSelectedIds(new Set()) even though selectedIds isn't owned by any one
  // tool — it's read by the polygon highlighting and the bottom action bar
  // regardless of which tool (if any) is active. The three toggle functions
  // now clear only the OUTGOING tool's own overlay state (ruler points,
  // angle readout, the in-progress drag rectangle) and leave selectedIds
  // alone. The one place selectedIds is still cleared is the Select button's
  // own "Cancel select" action — its label promises that, so it must.
  const toggleSelectMode = useCallback(() => {
    setSelectMode((prev) => {
      if (!prev) {
        // Entering select mode: close any open InfoWindow + exit ruler/angles
        // modes. Property selection is preserved.
        setSelected(null);
        setRulerMode(false);
        setRulerStart(null);
        setRulerEnd(null);
        setRulerCursor(null);
        setRulerSnap(null);
        setAnglesMode(false);
        setAnglesSnap(null);
        setAnglesDisplay(null);
      } else {
        // Exiting select mode via its own "Cancel select" button: this is the
        // one legitimate place selection is cleared — with the bar's „Anulează" (cancelSelection), which is the same.
        setShowTabs(false);
        setActiveTab("all");
        setSelectedIds(new Set());
        setPickerOpen(false);
      }
      return !prev;
    });
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
        // Entering ruler mode: close InfoWindow + exit select + angles modes.
        // Property selection is preserved — see the note on
        // toggleSelectMode above.
        setSelected(null);
        setSelectMode(false);
        setAnglesMode(false);
        setAnglesSnap(null);
        setAnglesDisplay(null);
      }
      return next;
    });
    // Clear any previous measurement on either toggle direction.
    setRulerStart(null);
    setRulerEnd(null);
    setRulerCursor(null);
    setRulerSnap(null);
  }, []);

  // -------------------------------------------------------------------------
  // Angles tool (Slice #19.05)
  // -------------------------------------------------------------------------

  const computeAnglesSnap = useCallback((px: PixelPoint): LatLng | null => {
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

  const resetAngles = useCallback(() => {
    setAnglesMode(false);
    setAnglesSnap(null);
    setAnglesDisplay(null);
  }, []);

  const toggleAnglesMode = useCallback(() => {
    setAnglesMode((prev) => {
      const next = !prev;
      if (next) {
        // Entering angles mode: close InfoWindow + exit ruler + select modes.
        // Property selection is preserved — see the note on
        // toggleSelectMode above.
        setSelected(null);
        setRulerMode(false);
        setRulerStart(null);
        setRulerEnd(null);
        setRulerCursor(null);
        setRulerSnap(null);
        setSelectMode(false);
      }
      return next;
    });
    setAnglesSnap(null);
    setAnglesDisplay(null);
  }, []);

  // -------------------------------------------------------------------------
  // Area tools (Slices #39.07, #39.08)
  // -------------------------------------------------------------------------

  /** A tool's button: on → that tool, the other released and its polygon gone; pressed again → none, all gone. */
  const toggleAreaMode = useCallback((pressed: AreaMode) => {
    const next = nextAreaMode(areaMode, pressed);
    setAreaMode(next);
    if (next) {
      // Nothing else works while it is pressed: leave every other tool, close the InfoWindow and the groups panel.
      setSelected(null);
      setRulerMode(false);
      setRulerStart(null);
      setRulerEnd(null);
      setRulerCursor(null);
      setRulerSnap(null);
      setAnglesMode(false);
      setAnglesSnap(null);
      setAnglesDisplay(null);
      setSelectMode(false);
      setGroupsPanelOpen(false);
    }
    setAreaCorners([]);
    setAreaSnap(null);
    // #39.08: „… oarecare" is drawing from the moment it is pressed, as a new property's „Desenează" is.
    if (next === "free") startFreeDraw();
    else exitFreeDraw();
  }, [areaMode, startFreeDraw, exitFreeDraw]);

  // #39.07: a click chooses the property corner nearest it within SNAP_PX — the Ruler's snap — and a click with no
  // corner near does nothing. A drag pans. Backspace takes the last corner back (Ask first 3).
  useEffect(() => {
    if (areaMode !== "delimited") return;
    const container = containerRef.current;
    if (!container) return;
    let downPx: PixelPoint | null = null;
    let moved = false;
    const isUi = (e: Event) => !!(e.target as Element).closest?.("[data-map-ui],.gm-style-iw,.gmnoprint");
    const at = (e: MouseEvent): PixelPoint => {
      const rect = container.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onMouseDown = (e: MouseEvent) => {
      if (isUi(e)) return;
      downPx = at(e);
      moved = false;
    };
    const onMouseMove = (e: MouseEvent) => {
      const px = at(e);
      if (downPx && Math.hypot(px.x - downPx.x, px.y - downPx.y) > 5) moved = true;
      if (isUi(e)) return;
      setAreaSnap(computeRulerSnap(px));
    };
    const onMouseUp = (e: MouseEvent) => {
      if (!downPx) return;
      const px = at(e);
      const isClick = !moved && Math.hypot(px.x - downPx.x, px.y - downPx.y) <= 5;
      downPx = null;
      moved = false;
      if (!isClick || isUi(e)) return;
      const snap = computeRulerSnap(px);
      if (snap) setAreaCorners((list) => addCorner(list, { lat: snap.lat, lon: snap.lng }));
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Backspace") return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      e.preventDefault();
      setAreaCorners((list) => removeLastCorner(list));
    };
    container.addEventListener("mousedown", onMouseDown);
    container.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      container.removeEventListener("mousedown", onMouseDown);
      container.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [areaMode, computeRulerSnap]);

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

  // Container-level listeners for the angles tool — mirrors the ruler listener
  // pattern. mousemove snaps; click on a snapped corner commits the arcs; click
  // on empty space clears the display (keeps mode active); right-click exits.
  useEffect(() => {
    if (!anglesMode) return;
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
      const rect = container.getBoundingClientRect();
      const px = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      if (downPx && Math.hypot(px.x - downPx.x, px.y - downPx.y) > 5) moved = true;
      if (isUi(e)) return;
      setAnglesSnap(computeAnglesSnap(px));
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!downPx) return;
      const rect  = container.getBoundingClientRect();
      const px    = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const isClick = !moved && Math.hypot(px.x - downPx.x, px.y - downPx.y) <= 5;
      downPx = null;
      moved  = false;
      if (!isClick || isUi(e)) return;

      const snap = anglesSnapRef.current;
      if (!snap) {
        // Click on empty map — clear the committed display but stay in mode.
        setAnglesDisplay(null);
      } else {
        const arcs = computeAnglesAtSnap(snap, withGeometryRef.current);
        setAnglesDisplay({ corner: snap, arcs });
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      if (isUi(e)) return;
      e.preventDefault();
      resetAngles();
    };

    container.addEventListener("mousedown",   onMouseDown);
    container.addEventListener("mousemove",   onMouseMove);
    document.addEventListener("mouseup",      onMouseUp);
    container.addEventListener("contextmenu", onContextMenu);
    return () => {
      container.removeEventListener("mousedown",   onMouseDown);
      container.removeEventListener("mousemove",   onMouseMove);
      document.removeEventListener("mouseup",      onMouseUp);
      container.removeEventListener("contextmenu", onContextMenu);
    };
  }, [anglesMode, computeAnglesSnap, resetAngles]);

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
    // If everything is currently checked, uncheck all; otherwise check all.
    setUncheckedGroups((prev) => {
      const everyChecked =
        !prev.has("_ungrouped") && allGroupCodes.every((c) => !prev.has(c));
      return everyChecked ? new Set(["_ungrouped", ...allGroupCodes]) : new Set();
    });
  }, [allGroupCodes]);

  // Indeterminate state on the map groups master checkbox.
  useEffect(() => {
    if (mapGroupsMasterRef.current) {
      mapGroupsMasterRef.current.indeterminate = someGroupsChecked;
    }
  }, [someGroupsChecked]);

  // -------------------------------------------------------------------------
  // The selection: kept for this tab, cancelled, added to a group (Slice #39.73)
  // -------------------------------------------------------------------------

  // Written through on every change, so leaving for „Grupuri" (or anywhere) and coming back finds it. Not selecting
  // and nothing selected removes it.
  useEffect(() => {
    writeMapSelection({ selecting: selectMode || selectedIds.size > 0, ids: [...selectedIds], pickerOpen });
  }, [selectMode, selectedIds, pickerOpen]);

  /** The bar's „Anulează": no selection, no mode, nothing kept. */
  const cancelSelection = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
    setPickerOpen(false);
    setPickedGroup(null);
    forgetNewGroup();
    setAddError(null);
    setShowTabs(false);
    setActiveTab("all");
  };

  const groupsQuery = useQuery<PickerGroup[]>({
    queryKey: ["groups", "PROPERTY"],
    queryFn:  fetchPropertyGroups,
    enabled:  pickerOpen,
    // Coming back from „Grup nou…", the list must hold the group just created.
    refetchOnMount: "always",
  });

  /** „Grup nou…": „Grupuri" with its add form open; the selection and the open picker stay in this tab's storage. */
  const goCreateGroup = () => {
    writeMapSelection({ selecting: true, ids: [...selectedIds], pickerOpen: true });
    router.push(GROUPS_FROM_MAP_PATH);
  };

  const handleAddToGroup = async () => {
    const group = groupsQuery.data?.find((g) => g.id === pickedGroup);
    if (!group || selectedIds.size === 0) return;
    setAdding(true);
    setAddError(null);
    try {
      const after = await addToGroup(group.id, [...selectedIds]);
      showToast(t("map.addedToGroup", { added: Math.max(0, after.memberCount - group.memberCount), code: after.code }));
      cancelSelection();
      await queryClient.invalidateQueries({ queryKey: ["properties"] });
      await queryClient.invalidateQueries({ queryKey: ["groups"] });
    } catch (err) {
      // The message files say what happened; the console keeps the status and the server's own words.
      console.error("[property-map] add to group failed", err);
      setAddError(err instanceof AddToGroupError && err.status === 409 ? t("map.groupPicker.tooManyGroups") : t("map.groupPicker.failed"));
    } finally {
      setAdding(false);
    }
  };

  // -------------------------------------------------------------------------
  // Loading / error states
  // -------------------------------------------------------------------------

  // Slice #39.09 — „Instrumente → Calcul suprafață" opens this map with ?area=1: the „Toate" tab, where the toolbar
  // is drawn, and the two area buttons pulse for three seconds (`useAreaPulse`) — counted from when the toolbar is
  // drawn, not from the arrival, so a slow list does not eat the pulse. Nothing is pressed. The parameter stays in
  // the address, so a reload points them out again.
  const areaAsked = readAreaPulse(searchParams?.toString() ?? "");
  const areaPulse = useAreaPulse(areaAsked && !isLoading);
  if (areaAsked !== areaTabSeen) {
    setAreaTabSeen(areaAsked);
    if (areaAsked) setActiveTab("all");
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-950 text-zinc-400 text-sm">
        {t("map.loading")}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-950 text-red-400 text-sm">
        {t("map.loadError")}
      </div>
    );
  }

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
        data-property-map
        data-focus-blink={focusBlink ?? undefined}
        className="flex-1 min-h-0 relative"
        style={{
          cursor: anglesMode
            ? ANGLES_CURSOR
            : rulerMode || areaMode === "delimited"
              ? RULER_CURSOR
              : freeDraw.drawing
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
          // No WebGL 2 → raster up front, not a failed vector attempt and a console.error (FU-275).
          renderingType={mapRenderingType()}
          defaultCenter={DEFAULT_CENTER}
          defaultZoom={DEFAULT_ZOOM}
          mapTypeId={mapType}
          disableDefaultUI
          streetViewControl
          // Slice #39.73: selecting is by clicks, so the map pans and zooms as always; the pointer says a click picks.
          gestureHandling="greedy"
          draggableCursor={anglesMode ? ANGLES_CURSOR : rulerMode || areaMode === "delimited" ? RULER_CURSOR : freeDraw.drawing ? "crosshair" : selectMode && activeTab === "all" ? "pointer" : undefined}
          draggingCursor={anglesMode ? ANGLES_CURSOR : rulerMode || areaMode === "delimited" ? RULER_CURSOR : undefined}
          style={{ width: "100%", height: "100%" }}
          // Slice #39.07: and no InfoWindow while an area tool is pressed.
          // Slice #39.08: „… oarecare" takes the map's clicks and the cursor, as the new property's mini-map does.
          onClick={(e) => { if (performance.now() - dropClickAt.current < 400) return; if (areaMode === "free") freeDraw.onMapClick(e); else if (!rulerMode && !anglesMode && !areaOn) handleMapClick(e.detail.latLng); }}
          // Slice #39.60: polygon or drop is decided at the zoom shown, so every zoom change recomputes them.
          onZoomChanged={(e) => setZoom(e.detail.zoom)}
          onMousemove={areaMode === "free" ? freeDraw.onMouseMove : undefined}
          onDblclick={(e) => { if (!rulerMode && !anglesMode && !areaOn) handleMapDblClick(e.detail.latLng); }}
        >
          {/* Inner helpers that require useMap() / useMapsLibrary() */}
          <MapRefCapture mapRef={mapRef} />
          <MapCameraProbe target={containerRef} />
          <FitAllProperties
            items={displayItems}
            tabKey={activeTab}
            holdInitial={focus !== null && data === undefined && !isError}
            initialView={focusView}
            onInitialView={startFocusBlink}
          />

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

            // Slice #39.60: too small on screen to read — drawn as a drop instead (below).
            if (!polygonIds.has(prop.id)) return null;

            return prop.corners.length >= 3 ? (
              <Polygon
                key={prop.id}
                paths={toLatLng(prop.corners)}
                strokeColor={strokeColor}
                strokeOpacity={1}
                strokeWeight={2}
                fillColor={fillColor}
                fillOpacity={fillOpacity}
                // #39.27: never clickable — a click passes through a property to the map, whose own hit-test opens the
                // bubble (#15.12) or, with an area tool pressed, takes the corner. #39.08 wrote `clickable={!areaOn}`,
                // which made every property clickable whenever no tool was pressed: a clickable shape with no handler
                // of its own swallows the click (@vis.gl/react-google-maps infers `clickable` from `onClick` only
                // when it is not given), so the map never heard it and no bubble opened.
                clickable={false}
              />
            ) : (
              <Circle
                key={prop.id}
                center={{ lat: prop.corners[0].lat, lng: prop.corners[0].lon }}
                radius={25}
                // #39.27: never clickable, as the polygon above.
                clickable={false}
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

          {/* Slice #37.38 — the focused Property blinks green, over its own shape */}
          {focusProp && focusBlink === "on" && (
            <FocusBlink prop={focusProp} onDone={endFocusBlink} />
          )}

          {/* Slice #39.60 — corners: 4-px dots in the polygon's own colour, only while the polygon is drawn */}
          {displayItems.flatMap((prop) =>
            polygonIds.has(prop.id)
              ? prop.corners.map((corner, idx) => (
                  <PropertyCornerDot
                    key={`${prop.id}-c${idx}`}
                    corner={corner}
                    color={SHAPE_COLOR[toneOf([prop.id])]}
                  />
                ))
              : [],
          )}

          {/* Slice #39.60 — drops and numbered drops, for the properties too small to read as polygons */}
          {drops.map((drop) => (
            <PropertyDrop
              key={drop.key}
              drop={drop}
              title={
                drop.items.length === 1
                  ? nameOr(drop.items[0].nickname, "property")
                  : t("map.dropMany", { count: drop.items.length })
              }
              blinkOn={blinkOn}
              clickable={dropsClickable}
              onClick={handleDropClick}
            />
          ))}

          {/* Ruler tool overlays (Slice #18.14.ruler) */}
          {(rulerMode || areaOn) && (
            // Slice #39.07: the area tools measure through the Ruler's local Stereo 70 fit, refitted on every settle.
            <RulerCalibrator active={rulerMode || areaOn} onCalibrate={recalibrateRuler} />
          )}
          {/* Slice #39.68 — the „Tarlale" layer: each outline dashed, labelled from about 6 km down; a click opens it */}
          {showTarlale && activeTab === "all" && (
            <TarlaLayer tarlale={tarlaOnMap} onOpen={(id) => router.push(`/tarlale/${id}`)} />
          )}
          {/* Slices #39.07/#39.08 — the area tools' polygon, its corners and its area */}
          {areaOn && (
            <AreaLayer
              corners={areaCorners}
              // #39.08's Ask first 1: while drawing, the cursor counts as a corner from the third on.
              provisional={areaMode === "free" && freeDraw.hover ? { lat: freeDraw.hover.lat, lon: freeDraw.hover.lng } : null}
              affine={rulerAffine}
              crossingText={t("map.areaCrossing")}
              showCorners={areaMode !== "free"}
            />
          )}
          {/* Slice #39.08 — „… oarecare"'s corners: clickable while drawing (the first closes), draggable after. */}
          {areaMode === "free" &&
            areaCorners.map((c, idx) => (
              <AdvancedMarker
                key={`area-free-${idx}`}
                position={{ lat: c.lat, lng: c.lon }}
                draggable={!freeDraw.drawing}
                onDragEnd={(e) => freeDraw.onDragEnd(idx, e)}
                onClick={(e) => freeDraw.onCornerClick(idx, e)}
              >
                <div
                  data-area-draw-corner={idx}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    backgroundColor: AREA_STROKE,
                    border: "2px solid white",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
                    cursor: "pointer",
                  }}
                />
              </AdvancedMarker>
            ))}
          {areaMode === "free" && freeDraw.previewPath && (
            <Polyline path={freeDraw.previewPath} strokeColor={AREA_STROKE} strokeOpacity={0.6} strokeWeight={2} clickable={false} />
          )}
          {areaMode === "delimited" && areaSnap && <RulerSnapRing corner={areaSnap} />}
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

          {/* Angles tool overlays (Slice #19.05) */}
          {anglesMode && anglesSnap && (
            <RulerSnapRing corner={anglesSnap} />
          )}
          {anglesMode && anglesDisplay && anglesDisplay.arcs.length > 0 && (
            <MapAngleArcOverlay
              corner={anglesDisplay.corner}
              arcs={anglesDisplay.arcs}
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
                      // #37.45 (A064): a toggle. SquareCheck and the cta fill
                      // while the property is selected, Square while it is
                      // not; the name says what a press does, as the words did.
                      <IconButton
                        icon={selectedIds.has(item.id) ? SquareCheck : Square}
                        label={selectedIds.has(item.id) ? t("map.unselectLink") : t("map.selectLink")}
                        variant={selectedIds.has(item.id) ? "primary" : "secondary"}
                        size="xs"
                        aria-pressed={selectedIds.has(item.id)}
                        onClick={() => togglePropertySelected(item.id)}
                      />
                    ) : (
                      // Normal / selected-tab: „Deschide" — ArrowRight since #37.42 (A016) — and, #39.35, „Navighează"
                      // beside it: directions in Google Maps to the property's shape, with a QR code for the phone.
                      <div className="flex items-center gap-1.5">
                        <IconButton
                          href={`/properties/${item.id}`}
                          icon={ArrowRight}
                          label={t("map.openLink")}
                          variant="secondary"
                          size="xs"
                        />
                        <NavigateButton target={{ corners: cornersById.get(item.id) ?? [], address: null }} name={item.label} size="xs" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </InfoWindow>
          )}
        </Map>

        {/* ---------------------------------------------------------------- */}
        {/* Toolbar — top-right: Select toggle + map-type toggle                   */}
        {/* Only shown on the "all properties" tab                           */}
        {/* ---------------------------------------------------------------- */}
        {/* `flex-wrap` + `max-w` (Slice #32.16): every label in this row is a   */}
        {/* message now, and Romanian is the DEFAULT locale, so the row is      */}
        {/* ~90px wider here than the English it was laid out against —         */}
        {/* „HARTĂ"/„SATELIT" for STR/SAT, and a longer Cancel-select label.    */}
        {/* The cap is `100% - 6rem` and NOT a percentage: this container is    */}
        {/* `data-map-ui`, which `isUi()` reads to decide whether a click       */}
        {/* belongs to the ruler and angles tools, so any max-width WIDER than  */}
        {/* the content turns the empty gutter beside it into a dead zone for   */}
        {/* those two tools. 6rem is where the hint cluster at `top-3 left-3`   */}
        {/* actually ends, so the box only ever clamps at the collision it is   */}
        {/* here to prevent, and at every ordinary window width it does not     */}
        {/* clamp at all — English and Romanian both lay out exactly as before. */}
        {activeTab === "all" && (
          <div data-map-ui className="absolute top-3 right-3 z-20 flex flex-wrap justify-end items-start gap-2 max-w-[calc(100%-6rem)]">
            {/* Angles tool — show interior angles at corners (Slice #19.05).   */}
            {/* Sits to the left of Ruler; depressed while active.              */}
            {/* #37.45 (A058, A057, A061, A063): icons. Angles, ruler and   */}
            {/* groups are toggles — the cta fill and aria-pressed (groups:   */}
            {/* aria-expanded) while on; the hints their `title` carried are  */}
            {/* the tooltip's second line.                                    */}
            <IconButton
              icon={DraftingCompass}
              label={t("map.anglesButton")}
              note={t("map.anglesHint")}
              variant={anglesMode ? "primary" : "secondary"}
              size="sm"
              aria-pressed={anglesMode}
              disabled={areaOn}
              onClick={toggleAnglesMode}
            />
            <HelpHint hintKey="angles-click-corner" />

            {/* Ruler — measure real ground distance (Slice #18.14.ruler).      */}
            {/* Sits to the left of Groups; depressed while active.             */}
            <IconButton
              icon={Ruler}
              label={t("map.rulerButton")}
              note={areaOn ? t("map.areaLocked") : t("map.rulerHint")}
              variant={rulerMode ? "primary" : "secondary"}
              size="sm"
              aria-pressed={rulerMode}
              disabled={areaOn}
              onClick={toggleRulerMode}
            />
            <HelpHint hintKey="ruler-two-clicks" />

            {/* Slice #39.07 — „Suprafața unei zone delimitate": property corners, one after another, and the area of */}
            {/* the polygon through them. After the Ruler, before „Grupuri"; a toggle, like them.                   */}
            <IconButton
              icon={AreaDelimitedIcon}
              label={t("map.areaDelimitedButton")}
              note={t("map.areaDelimitedHint")}
              variant={areaMode === "delimited" ? "primary" : "secondary"}
              size="sm"
              aria-pressed={areaMode === "delimited"}
              data-area-tool="delimited"
              className={areaPulse ? AREA_PULSE_CLASS : undefined}
              onClick={() => toggleAreaMode("delimited")}
            />

            {/* Slice #39.08 — „Suprafața unei zone oarecare": a polygon drawn freely, as a new property's is. Pressed, */}
            {/* it is drawing; „Gata" (the mini-map's) or a click on the first corner closes it, then corners drag.     */}
            <IconButton
              icon={AreaFreeIcon}
              label={t("map.areaFreeButton")}
              note={t("map.areaFreeHint")}
              variant={areaMode === "free" ? "primary" : "secondary"}
              size="sm"
              aria-pressed={areaMode === "free"}
              data-area-tool="free"
              className={areaPulse ? AREA_PULSE_CLASS : undefined}
              onClick={() => toggleAreaMode("free")}
            />
            {areaMode === "free" && freeDraw.drawing && (
              <IconButton
                icon={Check}
                label={t("map.miniMap.done")}
                note={
                  areaCorners.length === 0
                    ? t("map.miniMap.hintFirst")
                    : areaCorners.length < 3
                      ? t("map.miniMap.hintMore")
                      : t("map.miniMap.hintClose")
                }
                variant="primary"
                size="sm"
                onClick={freeDraw.exitDraw}
              />
            )}

            {/* Slice #39.68 — „Tarlale": the tarla outlines, a toggle beside Grupuri, off by default. */}
            <IconButton
              icon={Fence}
              label={t("map.tarlaleButton")}
              note={t("map.tarlaleHint")}
              variant={showTarlale ? "primary" : "secondary"}
              size="sm"
              aria-pressed={showTarlale}
              data-map-layer="tarlale"
              onClick={() => setShowTarlale((on) => !on)}
            />

            {/* Groups filter — button + dropdown panel (Slice #18.08).        */}
            {/* Panel is anchored under the button (left-0 right-0 → exactly    */}
            {/* the button's width) and lists each group code with a checkbox;  */}
            {/* all checked by default. Unchecking a group hides properties     */}
            {/* whose every group is unchecked.                                 */}
            <div className="relative">
              <IconButton
                icon={Group}
                label={t("map.groupsButton")}
                variant={groupsPanelOpen ? "primary" : "secondary"}
                size="sm"
                aria-expanded={groupsPanelOpen}
                disabled={areaOn}
                onClick={() => setGroupsPanelOpen((o) => !o)}
              />

              {groupsPanelOpen && (
                <div className="absolute left-0 top-full mt-1 w-52 rounded shadow-lg border border-wire bg-white overflow-hidden">
                  {/* Master: All (in groups or not) */}
                  <label className="flex items-center gap-1.5 px-2 py-1.5 border-b border-crease cursor-pointer hover:bg-cta-pale">
                    <input
                      ref={mapGroupsMasterRef}
                      type="checkbox"
                      checked={allGroupsChecked}
                      onChange={toggleAllGroups}
                      className="h-3.5 w-3.5 shrink-0 rounded border-wire accent-cta"
                    />
                    <span className="text-[11px] font-semibold text-ink truncate">
                      {t("map.groupsAll")}
                    </span>
                  </label>

                  {/* Not in a group */}
                  <label className="flex items-center gap-1.5 px-2 py-1.5 border-b border-crease cursor-pointer hover:bg-cta-pale">
                    <input
                      type="checkbox"
                      checked={!uncheckedGroups.has("_ungrouped")}
                      onChange={() => toggleGroupChecked("_ungrouped")}
                      className="h-3.5 w-3.5 shrink-0 rounded border-wire accent-cta"
                    />
                    <span className="text-[11px] italic text-fade truncate">
                      {t("map.groupsNotInGroup")}
                    </span>
                  </label>

                  {/* Group code list — scrollable */}
                  {allGroupCodes.length === 0 ? (
                    <div className="px-2 py-1.5 text-[11px] text-fade">
                      {t("map.groupsEmpty")}
                    </div>
                  ) : (
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
                  )}
                </div>
              )}
            </div>

            {/* „⬚" and „✕" were glyphs in the messages, standing in for     */}
            {/* the icons; the messages lost them, as #37.42's „→" did.        */}
            <IconButton
              icon={selectMode ? X : SquareDashedMousePointer}
              label={selectMode ? t("map.cancelSelect") : t("map.select")}
              note={selectMode ? t("map.selectExitTitle") : t("map.selectEnterTitle")}
              variant={selectMode ? "danger" : "secondary"}
              size="sm"
              disabled={areaOn}
              onClick={toggleSelectMode}
            />
            <HelpHint hintKey="drag-select" />

            {/* Slice #39.60 — „Setări hartă": the distance at which drops merge, kept per browser. */}
            <div className="relative">
              <IconButton
                icon={Settings2}
                label={t("map.settingsButton")}
                note={t("map.settingsHint")}
                variant={settingsOpen ? "primary" : "secondary"}
                size="sm"
                aria-expanded={settingsOpen}
                onClick={() => setSettingsOpen((o) => !o)}
              />
              {settingsOpen && <MapSettingsPanel value={mergeDistance} onChange={setMergeDistance} />}
            </div>

            <MapTypeToggle value={mapType} onChange={setMapType} />
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Top-left info cluster — hints with no single button to anchor to */}
        {/* ---------------------------------------------------------------- */}
        {activeTab === "all" && (
          <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 rounded bg-white/90 px-2 py-1 shadow border border-wire">
            <HelpHint hintKey="map-double-click-open" />
            <HelpHint hintKey="map-blinking-duplicates" />
          </div>
        )}

        {/* Map-type toggle alone on the "selected" tab (no select-mode button) */}
        {activeTab === "selected" && (
          <div className="absolute top-3 right-3 z-20">
            <MapTypeToggle value={mapType} onChange={setMapType} />
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Slice #39.73 — the selection bar: while selecting, on both tabs.  */}
        {/* The count, „Afișează selecția", „Adaugă la grup…", „Anulează".     */}
        {/* Nothing here deletes.                                            */}
        {/* ---------------------------------------------------------------- */}
        {(selectMode || selectedIds.size > 0) && !areaOn && (
          <div
            data-map-ui
            data-select-bar
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 rounded-xl border border-wire bg-white/95 px-4 py-2 shadow-lg"
          >
            <span data-select-count={selectedIds.size} className="text-sm font-medium text-ink whitespace-nowrap">
              {t("map.selectBar.count", { count: selectedIds.size })}
            </span>
            {activeTab === "all" && (
              <>
                {/* #37.45 (A065): ScanEye with the count as a badge — today's „Proprietăți Selectate" tab. */}
                <IconButton
                  icon={ScanEye}
                  label={t("map.displayAllSelected")}
                  count={selectedIds.size}
                  variant="secondary"
                  size="lg"
                  disabled={selectedIds.size === 0}
                  onClick={() => { setShowTabs(true); setActiveTab("selected"); }}
                />
                <HelpHint hintKey="map-selected-tab" />
              </>
            )}
            {/* Ask first 4: PATCH /api/groups/[id] is full access only, so without it the button is greyed and says why. */}
            <IconButton
              icon={FolderPlus}
              label={t("map.addToGroup")}
              note={canEditGroups ? undefined : t("map.addToGroupDenied")}
              variant="primary"
              size="lg"
              disabled={!canEditGroups || selectedIds.size === 0}
              onClick={() => { setAddError(null); setPickerOpen(true); }}
            />
            <IconButton
              icon={X}
              label={t("map.selectBar.cancel")}
              variant="secondary"
              size="lg"
              onClick={cancelSelection}
            />
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Slice #39.73 — „Adaugă la grup…": the property groups, „Grup nou…" */}
        {/* at their end. A property already in the group stays as it is.     */}
        {/* ---------------------------------------------------------------- */}
        {pickerOpen && canEditGroups && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/45">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="map-group-picker-title"
              data-group-picker
              className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 flex flex-col gap-4"
            >
              <h2 id="map-group-picker-title" className="text-zinc-900 font-semibold text-base leading-snug">
                {t("map.groupPicker.title", { count: selectedIds.size })}
              </h2>

              {groupsQuery.isLoading && <p className="text-sm text-fade">{t("map.groupPicker.loading")}</p>}
              {groupsQuery.isError && <p className="text-sm text-red-600">{t("map.groupPicker.loadError")}</p>}
              {groupsQuery.data && (
                <fieldset className="flex flex-col gap-1 max-h-72 overflow-y-auto">
                  <legend className="sr-only">{t("map.groupPicker.title", { count: selectedIds.size })}</legend>
                  {groupsQuery.data.length === 0 && <p className="text-sm text-fade">{t("map.groupPicker.empty")}</p>}
                  {groupsQuery.data.map((g) => (
                    <label
                      key={g.id}
                      className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm text-ink hover:bg-cta-pale cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="map-group-picker"
                        value={g.id}
                        checked={pickedGroup === g.id}
                        onChange={() => setPickedGroup(g.id)}
                        className="mt-0.5"
                      />
                      <span className="flex flex-col">
                        <span>
                          <span className="font-mono font-semibold">{g.code}</span>{" "}
                          <span className="text-fade">({t("map.groupPicker.members", { count: g.memberCount })})</span>
                        </span>
                        <span className="text-xs text-fade">{g.description}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}

              <div>
                <IconButton
                  icon={Plus}
                  label={t("map.groupPicker.newGroup")}
                  variant="secondary"
                  size="sm"
                  showLabel
                  onClick={goCreateGroup}
                />
              </div>

              {addError && (
                <p role="alert" className="text-red-600 text-sm rounded bg-red-50 px-3 py-2 border border-red-200">
                  {addError}
                </p>
              )}

              <div className="flex gap-3 justify-end">
                <IconButton
                  icon={X}
                  label={t("map.groupPicker.cancel")}
                  variant="secondary"
                  size="lg"
                  disabled={adding}
                  onClick={() => { setPickerOpen(false); setAddError(null); }}
                />
                <IconButton
                  icon={FolderPlus}
                  label={t("map.groupPicker.add")}
                  busy={adding}
                  busyLabel={t("map.groupPicker.adding")}
                  variant="primary"
                  size="lg"
                  showLabel
                  disabled={adding || selectedIds.size === 0 || !groupsQuery.data?.some((g) => g.id === pickedGroup)}
                  onClick={handleAddToGroup}
                />
              </div>
            </div>
          </div>
        )}
        {toast}
      </div>
    </div>
  );
}
