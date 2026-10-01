"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  type Control,
  type FieldPath,
  type FieldErrors,
  type UseFormRegister,
  useForm,
  useWatch,
} from "react-hook-form";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import type { PropertySnapshot } from "@/lib/properties/validation";
import {
  polygonSelfIntersects,
  shoelaceAreaM2,
  straightenPolygonOrder,
} from "@/lib/properties/area";
import {
  cornersToS70Key,
  wgs84ToStereo70Batch,
  type Stereo70Point,
} from "@/lib/geo/convert-client";
import { streetLineFromGeocodeResult } from "@/lib/geo/reverse-geocode";
import { ArrowLeft, ArrowRight, Pencil, Save, Trash2, X } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { UnsavedChangesBanner } from "@/components/unsaved-changes-banner";
import { useUnsavedChangesGuard } from "@/components/providers/unsaved-changes-provider";
import {
  computeCornerDiff,
  computeFieldHighlights,
  emptyFormValues,
  formSchema,
  formValuesEqual,
  hasFormData,
  restoreBlockedBy,
  restoreDropsRecorded,
  snapshotLookupStates,
  type PropertyLookupField,
  type Corner,
  type CornerDiffEntry,
  type FieldHighlights,
  type FormValues,
  type HighlightColor,
  type VersionNav,
  cornersCentroid,
  cornersChanged,
  snapshotToCorners,
  snapshotToFormValues,
  toApiPayload,
  versionLabelColor,
} from "./form-schema";
import { CornersManager } from "./corners-manager";
import { StraightenDialog } from "./straighten-dialog";
import { PropertyMiniMap } from "./property-mini-map";
import { setMapFocusSource } from "@/lib/geo/map-focus";
import { StreetViewPanel } from "./street-view-panel";
import { HelpHint } from "@/components/help/help-hint";
import { ErrorBoundary, PanelError } from "@/components/error-boundary";
import { VersionNavControls } from "@/components/version-nav-controls";
import { AsyncSelect } from "@/components/forms/async-select";
import { GrowingText } from "@/components/forms/growing-text";
import {
  ADDRESS,
  MAP_BOX_HEIGHT_REM,
  MAP_BOX_STYLE,
  PANEL_GAP,
  PANEL_UNIT_INNER_REM,
  PANEL_UNIT_STYLE,
  PROPERTY as PROP,
  boxRem,
  boxStyle,
  rem,
  stackedBoxStyle,
  unitRowStyle,
  type FieldWidth,
} from "@/lib/ui/field-widths";
import { STACKED_FIELD_CLASS, STACKED_LABEL_CLASS, STACKED_ROW_CLASS } from "@/lib/ui/stacked";
import { SnapshotValue } from "@/components/versioning/snapshot-value";
import {
  snapshotReplacesPicker,
  type SnapshotLookupState,
} from "@/lib/versioning/snapshot-lookup";
import { FieldPulseContext, usePulseRing } from "@/components/versioning/field-pulse";
import { highlightRingClass } from "@/lib/versioning/highlight-ring";
import { SafeMutateError, safeMutate } from "@/lib/api/safe-mutate";
import { inferProvenance } from "@/lib/metadata/provenance-rules";
import { buttonClass } from "@/lib/ui/button-styles";
import { tabTrapMove } from "@/lib/ui/dialog-focus";
import { forgetRecentlyViewed } from "@/components/providers/navigation-history-provider";
import { propTileOfField, type PropTile } from "./property-tiles";
import { firstErrorPath } from "@/lib/ui/tiles";
import { RecordSyncNotice, useRecordSaveSync } from "@/components/record-save-sync";

// ---------------------------------------------------------------------------
// Version history fetch (Slice #18.02)
// ---------------------------------------------------------------------------

type VersionItem = {
  versionNumber: number;
  snapshot:      PropertySnapshot;
  createdAt:     string;
};

async function fetchVersions(propertyId: string): Promise<VersionItem[]> {
  const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/versions`);
  if (!res.ok) throw new Error(`Failed to load versions (HTTP ${res.status})`);
  const body = await res.json();
  return (body.items ?? []) as VersionItem[];
}

// ---------------------------------------------------------------------------
// Reference-Data dropdowns (Slice #15.16)
//
// Property Type and Use Category are admin-managed lookup tables
// (lookup_property_type / lookup_use_category). Both dropdowns fetch their
// options from the generic Value Lists API and use the SAME TanStack Query
// key (["value-list", listKey]) that the admin ValueListModal invalidates on
// save/delete — so they stay in sync with Reference Data edits without any
// extra cross-invalidation (same pattern as the judicial-person-type dropdown
// in Slice #15.07).
// ---------------------------------------------------------------------------

type LookupOption = { id: string; name: string };
// Slice #19.02: property types carry per-type panel-visibility flags from DB.
type PropertyTypeLookupOption = LookupOption & {
  key:              string | null;
  showTarlaParcela: boolean;
  showAddress:      boolean;
  showStreetView:   boolean;
};

// ⚠️ **`res.redirected` as well as `!res.ok`, and it is about the SHARED cache
// entry rather than about this form.**                          (Slice #34.04)
// An expired session answers with a redirect to the login page, whose HTML
// parses to `{}`, and `body.items ?? []` then reads as "the archive holds
// none" — so React Query caches a SUCCESSFUL EMPTY ARRAY. Every one of these
// keys is also read by the Reference Data modal (`value-list-modal.tsx` reads
// every list under `["value-list", listKey]`), so on a shared entry the WEAKEST
// fetcher defines the failure semantics for every reader: the modal then finds
// that empty array fresh, never refetches, and shows an empty list with no
// error for the 30 s staleTime. ⚠️ **The sharing is older than #34.04** — both
// forms have read the namespaced key since Slice #15.16, precisely so the admin
// modal's invalidation reaches them. This is fixed in passing with #34.04
// because that slice made this class of sharing its subject and measured the
// failure; it is not a hazard the slice introduced.
async function fetchValueList(listKey: string): Promise<LookupOption[]> {
  const res = await fetch(`/api/admin/value-lists/${listKey}`);
  if (res.redirected || !res.ok) throw new Error(`Failed to load ${listKey} (HTTP ${res.status})`);
  const body = await res.json();
  return (body.items ?? []) as LookupOption[];
}

async function fetchPropertyTypes(): Promise<PropertyTypeLookupOption[]> {
  const res = await fetch("/api/admin/value-lists/property-types");
  if (res.redirected || !res.ok) throw new Error(`Failed to load property-types (HTTP ${res.status})`);
  const body = await res.json();
  return (body.items ?? []) as PropertyTypeLookupOption[];
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  mode:              "create" | "edit" | "view";
  propertyId?:       string;
  propertyCode?:     string;
  initialValues?:    FormValues;
  initialCorners?:   Corner[];
  onBigMapChange?:   (val: boolean) => void;
  // Slice #18.UX.04 — DOM node in the page header to portal the version-nav
  // controls into, so they render centered on the property-title line.
  versionNavSlot?:   HTMLElement | null;
  /**
   * Slice #37.19: the screen's tiles, when the form is drawn as tiles (the
   * saved property's page). Absent on „Adaugă proprietate", which keeps its
   * plain panel row. The Natural Person's rules (#37.17), plus one of this
   * screen's own:
   *
   * ⚠️ **A FORM TILE THAT IS NOT SHOWN IS HIDDEN, NEVER UNMOUNTED** — the
   * cadastral data, the corners and the address hold the form's inputs (and
   * the corners table its row being edited). An unsaved change in a tile then
   * unticked is still saved by „Salvează", and the banner still guards it.
   *
   * ⚠️ **AN UNTICKED MAP COSTS NOTHING.** Hartă and Street View are NOT form
   * tiles: unticked, they are not mounted, so they make no Google Maps request
   * of their own. The map draws the `corners` it is given, so ticking it after
   * an edit shows the edited polygon, not the saved one. The corners table's
   * „Street View" button ticks the Street View tile.
   *
   * In tile mode the form, its panel row and the panels' fieldsets are
   * `display: contents` or tile items, so every panel is an item of the page's
   * tile row and the list tiles flow beside them; the action bar is
   * `order-last basis-full`, the row's last line.
   */
  tiles?: {
    shown: readonly PropTile[];
    labels: Readonly<Record<PropTile, string>>;
    /** Show a hidden tile for this visit — an error has been found in it. */
    onRevealTile: (tile: PropTile) => void;
    /** Tick or untick a tile, as its checkbox does (the Street View button). */
    onToggleTile: (tile: PropTile) => void;
  };
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** One property the create route found on the parcel (Slice #37.04, FU-016). */
type ParcelMatch = { id: string; code: string; nickname: string | null; tarla: string | null; parcela: string | null };

/**
 * The properties a 409 `PARCEL_EXISTS` names, or null for any other failure.
 * Recognised by `code`, never by the message — `safe-mutate.ts` says why. The
 * literal is written out, as `FOREIGN_KEY_VIOLATION` is there, so the route
 * module stays out of this bundle.
 */
function parcelMatchesOf(err: unknown): ParcelMatch[] | null {
  if (!(err instanceof SafeMutateError) || err.status !== 409) return null;
  const body = err.body as { code?: unknown; matches?: unknown } | null;
  if (body?.code !== "PARCEL_EXISTS" || !Array.isArray(body.matches)) return null;
  return body.matches as ParcelMatch[];
}

export function PropertyForm({
  mode,
  propertyId,
  propertyCode,
  initialValues,
  initialCorners = [],
  onBigMapChange,
  versionNavSlot,
  tiles,
}: Props) {
  const t       = useTranslations("property");
  // Slice #37.19 — tile mode, as the Natural Person's (#37.17). `tileProps`
  // marks a tile for the specs and hides a FORM tile when unticked; `hidden`
  // alone would lose to any display class, so the class goes with it. The
  // map tiles are mounted only while shown (`tileShown`).
  const tiled = tiles !== undefined;
  const tileShown = (tile: PropTile): boolean => !tiles || tiles.shown.includes(tile);
  const tileProps = (tile: PropTile) =>
    tiles
      ? { "data-tile": tile, role: "region", "aria-label": tiles.labels[tile], hidden: !tileShown(tile) }
      : {};
  const hiddenClass = (tile: PropTile): string => (tileShown(tile) ? "" : " hidden");
  const tShared = useTranslations("shared");
  const router = useRouter();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver:      zodResolver(formSchema),
    defaultValues: initialValues ?? emptyFormValues,
    mode:          "onChange",
  });

  // Reference-Data dropdown options (Slice #15.16). Shared query keys keep
  // these in sync with admin Reference-Data edits automatically.
  // Slice #19.02: typed as PropertyTypeLookupOption[] so the `key` slug is
  // available for getPropertyTypeConfig() below.
  const { data: propertyTypes } = useQuery<PropertyTypeLookupOption[]>({
    queryKey: ["value-list", "property-types"],
    queryFn:  fetchPropertyTypes,
    staleTime: 5 * 60 * 1000,
  });
  const { data: useCategories } = useQuery({
    queryKey: ["value-list", "use-categories"],
    queryFn:  () => fetchValueList("use-categories"),
    staleTime: 5 * 60 * 1000,
  });

  // Slice #18.16.VL — tarla dropdown. Slice #34.03: the option VALUE is the
  // row's `id` now, not its `indicativ` text; the four-word comment that used
  // to end this line, "no FK migration", is what that slice deleted.
  const { data: tarlaItems } = useQuery({
    queryKey: ["value-list", "tarla"],
    queryFn:  async () => {
      const res = await fetch("/api/admin/value-lists/tarla");
      if (res.redirected || !res.ok) throw new Error(`Failed to load tarla (HTTP ${res.status})`);
      const body = await res.json();
      return (body.items ?? []) as { id: string; indicativ: string; descriere?: string | null }[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const noneOption = { value: "", label: t("fields.noneOption") };
  const propertyTypeOptions = [
    noneOption,
    ...(propertyTypes ?? []).map((o) => ({ value: o.id, label: o.name })),
  ];
  const useCategoryOptions = [
    noneOption,
    ...(useCategories ?? []).map((o) => ({ value: o.id, label: o.name })),
  ];
  // Slice #34.03: the VALUE is the row's id, not its text. That one character
  // is the whole difference between a dropdown whose selection survives a
  // rename and one whose selection is a string that happens to match a label
  // today. The label is unchanged.
  const tarlaOptions = [
    noneOption,
    ...(tarlaItems ?? []).map((o) => ({
      value: o.id,
      label: o.descriere ? `${o.indicativ} — ${o.descriere}` : o.indicativ,
    })),
  ];

  const [corners,          setCorners]          = useState<Corner[]>(initialCorners);
  const [hoveredCornerIdx, setHoveredCornerIdx] = useState<number | null>(null);
  const [submitting,       setSubmitting]       = useState(false);
  const [submitError,      setSubmitError]      = useState<string | null>(null);
  // Slice #37.04 (FU-016): „Adaugă nou" named a parcel that already has a
  // property. The route wrote nothing and answered with what it found; the form
  // offers to open it instead of reporting a failure.
  const [parcelExists,     setParcelExists]     = useState<ParcelMatch[] | null>(null);
  const [confirmDelete,    setConfirmDelete]    = useState(false);
  const [confirmMakeCurrent, setConfirmMakeCurrent] = useState(false);
  // Slice #21.04.Import: an associated record (opened via ?readonly=true from
  // another record's association tab) starts read-only with a "Modify"
  // button; clicking it flips this on, which makes effectiveMode resolve to
  // "edit" below without ever changing the `mode` prop — `mode === "view"`
  // keeps meaning "this page's identity is an associated record" throughout,
  // which is what gates the cannot-delete-from-here dialog further down.
  const [associatedEditing, setAssociatedEditing] = useState(false);
  const [showCannotDelete,   setShowCannotDelete]   = useState(false);
  // Slice #34.17: the refusal dialog for a version whose lookup value cannot be
  // written back. An INFO dialog rather than a disabled button, and the reason
  // is the whole point of the slice: a disabled control is out of the tab order
  // and its `title` is not announced, so the one sentence naming the field
  // would reach nobody who did not happen to hover the mouse over it.
  const [showCannotRestore,  setShowCannotRestore]  = useState(false);
  const [bigMap,           setBigMap]           = useState(false);
  const [showStreetView,   setShowStreetView]   = useState(false);
  const [showAngles,       setShowAngles]       = useState(false);

  // Slice #20.16: Theater overlay — opens a portal full-screen map overlay.
  // No layout shift; the inline right-column map stays at 440px always.
  const handleToggleBigMap = () => {
    const next = !bigMap;
    setBigMap(next);
    onBigMapChange?.(next);
  };
  const handleCloseTheaterMap = () => { setBigMap(false); onBigMapChange?.(false); };

  // Close theater overlay on Escape key.
  useEffect(() => {
    if (!bigMap) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setBigMap(false); onBigMapChange?.(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bigMap, onBigMapChange]);

  // Slice #37.19: as tiles, Street View is a tile of its own, and the corners
  // table's button ticks it; „Adaugă proprietate" keeps the panel's own state.
  const handleToggleStreetView = () =>
    tiles ? tiles.onToggleTile("streetView") : setShowStreetView((v) => !v);
  const streetViewOpen = tiles ? tiles.shown.includes("streetView") : showStreetView;

  // Slice #18.03b: arithmetic-mean centroid of the displayed corners, used to
  // position the Street View panel. Recomputed only when corners change.
  const streetViewCentroid = useMemo(() => cornersCentroid(corners), [corners]);

  // Slice #18.12: "Fetch from Street View" reverse-geocodes the corners'
  // centroid and fills the Street View street-line field. The geocoding library
  // loads lazily (it is part of the Maps JS API already loaded for the mini-map);
  // a geocode request only fires on an explicit button click. The shared
  // postal/locality/county/country fields are intentionally left untouched —
  // only the street line is taken from Street View.
  const geocodingLib = useMapsLibrary("geocoding");
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const [fetchingStreetView, setFetchingStreetView] = useState(false);
  const [streetViewFetchError, setStreetViewFetchError] = useState<string | null>(null);

  const handleFetchStreetViewAddress = async () => {
    if (!streetViewCentroid || !geocodingLib) return;
    setFetchingStreetView(true);
    setStreetViewFetchError(null);
    try {
      const geocoder =
        geocoderRef.current ?? (geocoderRef.current = new geocodingLib.Geocoder());
      const { results } = await geocoder.geocode({
        location: { lat: streetViewCentroid.lat, lng: streetViewCentroid.lon },
      });
      const line = streetLineFromGeocodeResult(results?.[0]);
      if (line) {
        form.setValue("address.streetViewStreetLine", line, {
          shouldValidate: true,
          shouldDirty:    true,
        });
      } else {
        setStreetViewFetchError(t("streetViewAddress.fetchNoResult"));
      }
    } catch {
      setStreetViewFetchError(t("streetViewAddress.fetchError"));
    } finally {
      setFetchingStreetView(false);
    }
  };

  // Slice #18.09: live Calculated Area (m²) from the displayed corners. Reuses
  // the SAME query cache key as the corners table's Stereo 70 conversion, so
  // there's no extra network when that table is in Stereo 70 display mode. It
  // recomputes as corners are added / moved, and reflects whichever version's
  // corners are currently shown (live, not the stored snapshot value).
  const areaS70Query = useQuery({
    queryKey:             ["s70Conversion", cornersToS70Key(corners)],
    queryFn:              () => wgs84ToStereo70Batch(corners),
    enabled:              corners.length >= 3,
    staleTime:            Infinity,
    refetchOnWindowFocus: false,
  });
  const calculatedArea: number | null =
    corners.length >= 3 && areaS70Query.data
      ? shoelaceAreaM2(areaS70Query.data)
      : null;
  const calculatedAreaDisplay =
    corners.length < 3
      ? "—"
      : areaS70Query.isLoading
        ? "…"
        : areaS70Query.isError || calculatedArea == null
          ? "—"
          : calculatedArea.toFixed(2);

  // Slice #32.14: the bow-tie marker, computed LIVE from the same projected
  // points the area above uses — not read from the property row.
  //
  // ⚠️ THAT IS DELIBERATE AND IT IS WHY THE FLAG IS NOT IN THE VERSION
  // SNAPSHOT. The stored `corner_order_self_intersects` describes the CURRENT
  // corners; this form also renders historical versions, whose corners are a
  // different set. A marker wired to the stored flag would say "not a bow-tie"
  // beside a self-intersecting version-3 polygon and its meaningless area.
  // Recomputing costs nothing here — the projection is already in the cache,
  // shared with the corners table's Stereo 70 display mode — and it is right
  // on every version for free.
  // ⚠️ THE PROPOSAL CARRIES THE CORNER SET IT WAS COMPUTED FROM, AND EVERY
  // NUMBER IT WILL SHOW. An earlier version stored the bare permutation and
  // recomputed the areas from the live query on each render — and the dialog's
  // backdrop is not `inert`, so the corners table behind it stays tabbable.
  // Tab to a row's Delete and press Enter with the dialog open and the live
  // points are one shorter than the permutation indexes: `planarCorners[5]` is
  // undefined, `shoelaceAreaM2` throws DURING RENDER, and the whole property
  // page is replaced by the route error boundary with the user's unsaved edits
  // in it. The quieter half was worse: press a row's ↑ instead — same length,
  // so no crash — and the stale permutation applies to the swapped corners,
  // leaving a ring that still self-intersects and a marker still lit after the
  // press that was supposed to clear it.
  //
  // Snapshotting removes the class rather than the instance: nothing about the
  // dialog is recomputed from live data, and `cornersKey` gates both the render
  // and the apply, so a proposal can only ever be applied to the corners it was
  // computed for.
  type StraightenProposal = {
    contextKey: string;
    order: number[];
    points: Stereo70Point[];
    numbers: (number | null)[];
    currentAreaM2: number;
    proposedAreaM2: number;
    declaredAreaM2: number | null;
  };
  const [straightenProposal, setStraightenProposal] = useState<StraightenProposal | null>(null);
  const [straightenImpossible, setStraightenImpossible] = useState(false);

  const cornersKey = cornersToS70Key(corners);
  const planarCorners = areaS70Query.data ?? null;
  const cornersSelfIntersect =
    corners.length >= 3 && planarCorners != null
      ? polygonSelfIntersects(planarCorners)
      : false;


  // Slice #18.01: read via form.watch() (subscribes to value changes) so the
  // create gate and the edit-dirty check below recompute on every keystroke.
  // form.watch() is intentionally not memoizable; this is the documented usage.
  // eslint-disable-next-line react-hooks/incompatible-library
  const watchedValues = form.watch();
  const isCreate = mode === "create";

  // Slice #32.14: the declared surface area, used only to break a tie between
  // two corrected orders that are BOTH already simple. It lives here rather
  // than beside the marker above because `watchedValues` is declared here.
  //
  // ⚠️ `> 0` RATHER THAN A NULL CHECK. `surfaceAreaMp` is a string on the form
  // and `Number("")` is 0; `straightenPolygonOrder` refuses a zero for exactly
  // that reason, but a caller that hands one over anyway has said something it
  // did not mean, so it is filtered on the way out too.
  const declaredAreaRaw = Number(watchedValues.surfaceAreaMp);
  const declaredAreaM2 =
    Number.isFinite(declaredAreaRaw) && declaredAreaRaw > 0 ? declaredAreaRaw : null;

  function handleStraighten() {
    if (planarCorners == null || calculatedArea == null) return;

    const order = straightenPolygonOrder(planarCorners, declaredAreaM2);
    if (order == null) {
      // No order of these corners is a simple polygon, so there is nothing to
      // offer. Say so rather than leave a button that does nothing.
      setStraightenImpossible(true);
      return;
    }

    const proposedAreaM2 = shoelaceAreaM2(order.map((i) => planarCorners[i]));
    if (proposedAreaM2 == null) return;

    setStraightenProposal({
      contextKey: straightenContextKey,
      order,
      points: planarCorners,
      numbers: corners.map((c) => c.originalIndex ?? null),
      currentAreaM2: calculatedArea,
      proposedAreaM2,
      declaredAreaM2,
    });
  }

  function applyStraighten() {
    // The guard, not a formality: it is what makes a proposal computed against
    // one corner set unable to reach another.
    if (straightenProposal == null || straightenProposal.contextKey !== straightenContextKey) {
      setStraightenProposal(null);
      return;
    }
    // ⚠️ THE WHOLE CORNER OBJECT TRAVELS THROUGH THE PERMUTATION, which is what
    // keeps each corner's `originalIndex` bound to its own lat/lon rather than
    // renumbered — Adrian's requirement on this slice. This is the same
    // `setCorners` the up/down arrows reach through, so the change lands in the
    // form's dirty state and is written by the ordinary Save button. Nothing is
    // saved here, and nothing is ever reordered without this confirmation.
    setCorners(straightenProposal.order.map((i) => corners[i]));
    setStraightenProposal(null);
  }

  // Slice #19.02: panel visibility comes directly from the selected type's DB
  // flags (showTarlaParcela / showAddress / showStreetView). When no type is
  // selected, or while the list is loading, default to showing everything.
  const selectedType =
    (propertyTypes ?? []).find((o) => o.id === (watchedValues.propertyTypeId ?? "")) ?? null;
  const typeConfig = {
    hideTarlaParcela: selectedType ? !selectedType.showTarlaParcela : false,
    hideAddress:      selectedType ? !selectedType.showAddress      : false,
    hideStreetView:   selectedType ? !selectedType.showStreetView   : false,
  };

  // Slice #19.02: close the Street View panel when the selected type hides it.
  useEffect(() => {
    if (typeConfig.hideStreetView) setShowStreetView(false);
  }, [typeConfig.hideStreetView]);

  // --- Version history (Slice #18.02) ------------------------------------
  const versionsQuery = useQuery({
    queryKey: ["property-versions", propertyId],
    queryFn:  () => fetchVersions(propertyId!),
    enabled:  !isCreate && !!propertyId,
    // staleTime 0 so reopening a property after a save refetches and shows the
    // newly-appended version (the save also invalidates this key in doSave).
    // refetchOnWindowFocus is off to avoid redundant focus-triggered refetches.
    staleTime:            0,
    refetchOnWindowFocus: false,
  });
  const versions = useMemo(() => versionsQuery.data ?? [], [versionsQuery.data]);
  const versionByNumber = useMemo(
    () => new Map(versions.map((v) => [v.versionNumber, v])),
    [versions],
  );
  const latestVersion: number | null =
    versions.length > 0 ? versions[versions.length - 1].versionNumber : null;

  // Which version is currently displayed. null = follow the latest.
  const [viewingVersion, setViewingVersion] = useState<number | null>(null);
  const effectiveVersion: number | null = viewingVersion ?? latestVersion;
  const isOnLatest = latestVersion === null || effectiveVersion === latestVersion;

  // Baseline = the latest saved state. Initialised from the server-provided
  // props at page load, then updated in place after an edit-mode save (so the
  // form can stay on the property and be recognised as clean again). Comparing
  // to this baseline — rather than RHF's reset-sensitive isDirty — drives
  // editDirty and survives the form.reset() that version navigation performs.
  const [baseline, setBaseline] = useState<{ values: FormValues; corners: Corner[] }>(
    () => ({ values: initialValues ?? emptyFormValues, corners: initialCorners }),
  );

  // Slice #37.38: „Proprietăți — Hartă" in the sidebar opens the properties map
  // on this Property, at the zoom the „Hartă" tile shows when it is pressed.
  // The form offers that through a registry the sidebar reads at click time:
  // its id, its LATEST saved corners (the baseline — the map draws only current
  // polygons, so even a historical version on screen centres on the latest),
  // and the tile's live zoom, which the tile reports and clears when it is
  // unticked. A Property that is still „Adaugă nou" offers nothing.
  const miniMapZoomRef = useRef<number | null>(null);
  const handleMiniMapZoom = useCallback((zoom: number | null) => {
    miniMapZoomRef.current = zoom;
  }, []);
  const latestCornersRef = useRef<Corner[]>(baseline.corners);
  useEffect(() => {
    latestCornersRef.current = baseline.corners;
  }, [baseline.corners]);
  useEffect(() => {
    if (mode === "create" || !propertyId) return;
    return setMapFocusSource({
      propertyId,
      latestCorners: () => latestCornersRef.current,
      miniMapZoom:   () => miniMapZoomRef.current,
      // The map box inside its 1 px border (MAP_BOX_STYLE), at 16 px to the rem.
      boxPx: {
        width:  PANEL_UNIT_INNER_REM.property.map * 16 - 2,
        height: MAP_BOX_HEIGHT_REM * 16 - 2,
      },
    });
  }, [mode, propertyId]);

  // Bug 1 (Slice #18.15.bugs): transient pulse of the latest version's
  // N-1 -> N change. `pulse` carries the field frames; `cornersPulse` flags a
  // corner change (pulsed as a red ring on the corners section, since the
  // corners table on the latest stays interactive and can't render the
  // historical per-row diff). Both set when the user navigates onto the latest
  // from a different version (or restores via "Make current"); cleared ~2.6s.
  const [pulse, setPulse] = useState<FieldHighlights | null>(null);
  const [cornersPulse, setCornersPulse] = useState(false);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPulseRef = useRef<number | null>(null);

  const triggerLatestPulse = () => {
    if (latestVersion === null || latestVersion < 1) return;
    const curr = versionByNumber.get(latestVersion)?.snapshot;
    if (!curr) return;
    const prev = versionByNumber.get(latestVersion - 1)?.snapshot ?? null;
    setPulse(computeFieldHighlights(prev, curr));
    setCornersPulse(
      prev !== null &&
        cornersChanged(snapshotToCorners(prev), snapshotToCorners(curr)),
    );
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = setTimeout(() => {
      setPulse(null);
      setCornersPulse(false);
    }, 3300);
  };

  useEffect(
    () => () => {
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    },
    [],
  );

  // After a "Make current" restore, pulse the new version once it refetches in.
  useEffect(() => {
    const target = pendingPulseRef.current;
    if (target === null) return;
    if (latestVersion !== target) return;
    if (!versionByNumber.get(target)) return;
    pendingPulseRef.current = null;
    triggerLatestPulse();
    // triggerLatestPulse reads latestVersion/versionByNumber (current here).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestVersion, versionByNumber]);

  // Any non-latest version is strictly read-only; only the latest is editable
  // (or stays "view" if opened read-only, unless Modify was clicked — see
  // associatedEditing above). Create mode is unaffected.
  const effectiveMode: "create" | "edit" | "view" =
    isCreate
      ? "create"
      : !isOnLatest
        ? "view"
        : mode === "edit" || associatedEditing
          ? "edit"
          : "view";

  const createHasData = isCreate && hasFormData(watchedValues, corners);

  // Has the editable latest copy diverged from the loaded baseline?
  // ⚠️ THE PROPOSAL IS BOUND TO EVERYTHING IT WAS COMPUTED FROM, NOT JUST THE
  // CORNERS. A first fix keyed on the corner coordinates alone and two holes
  // survived it, both reached the same way — the dialog's backdrop is not
  // `inert`, so everything behind it stays tabbable:
  //
  //   - Tab to the version-nav and step back one version. Most version bumps
  //     change a name or a note and leave the corners alone, so the corner key
  //     is UNCHANGED, the dialog stays on screen over a read-only historical
  //     version, and confirming reorders corners that `editDirty` then refuses
  //     to mark dirty because `isOnLatest` is false. Save stays disabled and
  //     stepping back to the latest discards it: the press appears to work and
  //     is silently thrown away.
  //   - Tab to Official Surface Area and correct it. The corner key is again
  //     unchanged, so the dialog keeps showing — and keeps displaying the OLD
  //     declared area, next to a proposed order that the old value tie-broke.
  //     The one number the dialog exists to be compared against is stale.
  //
  // So the key spans the corners, the version, the mode and the declared area,
  // and the effect below CLEARS a diverged proposal rather than merely hiding
  // it — hiding leaves it able to reappear when the user undoes the change that
  // hid it, which is a dialog nobody asked for.
  const straightenContextKey = [
    cornersKey,
    effectiveMode,
    effectiveVersion ?? "latest",
    declaredAreaM2 ?? "",
  ].join("|");

  useEffect(() => {
    setStraightenProposal((current) =>
      current != null && current.contextKey !== straightenContextKey ? null : current,
    );
    setStraightenImpossible(false);
  }, [straightenContextKey]);

  const editDirty =
    !isCreate &&
    isOnLatest &&
    (!formValuesEqual(watchedValues, baseline.values) ||
      cornersChanged(corners, baseline.corners));

  // Navigate to a version. Disabled while the latest has unsaved edits (the
  // ◀/▶ buttons are locked in that state), so we never strand a dirty draft —
  // returning to the latest always restores the clean baseline.
  const goToVersion = (target: number) => {
    const leaving = effectiveVersion;
    // ⚠️ **Both make-current dialogs are about the version being LEFT.** #34.17
    // A review round walked out from under one: `ConfirmDialog` HAD no focus
    // trap and the ◀/▶ nav is portalled outside it, so Shift+Tab and Enter
    // stepped to another version with the dialog still up — and its sentence
    // then named fields from a version nobody was looking at, or, on the latest,
    // nothing at all („… scrisă înapoi: ."). The confirmation is the worse half:
    // it would have restored the version the user arrived at, not the one they
    // agreed to.
    //
    // ⚠️ **SLICE #34.28 GAVE `ConfirmDialog` A TRAP, AND THAT IS NOT A REASON TO
    // DELETE THESE TWO LINES.** An adversarial round asked precisely that, off
    // the paragraph above, which until #34.28 still said „has no focus trap" in
    // the present tense. The trap closes the TAB route to the nav. It does not
    // close the mouse route — a dialog inline in the form leaves the portalled
    // nav uncovered by its own backdrop — nor the history chip. So the two
    // guards answer different presses, and `confirm-dialog-focus.test.ts` holds
    // this statement in place.
    setShowCannotRestore(false);
    setConfirmMakeCurrent(false);
    if (target === latestVersion) {
      form.reset(baseline.values);
      setCorners(baseline.corners);
      // Bug 1: arriving on the latest from a different version pulses N-1 -> N.
      if (leaving !== null && leaving !== latestVersion) triggerLatestPulse();
    } else {
      const snap = versionByNumber.get(target)?.snapshot;
      if (!snap) return;
      form.reset(snapshotToFormValues(snap));
      setCorners(snapshotToCorners(snap));
      setPulse(null);
      setCornersPulse(false);
    }
    setViewingVersion(target);
  };

  // Highlights (field frames + corner diff) show only on a read-only
  // *historical* version (>= 1). The editable latest is the working copy and
  // shows no frames; version 0 has no predecessor to diff against.
  const showHighlights =
    !isCreate && !isOnLatest && effectiveVersion !== null && effectiveVersion >= 1;

  const currSnap =
    effectiveVersion !== null ? versionByNumber.get(effectiveVersion)?.snapshot : undefined;
  const prevSnap =
    effectiveVersion !== null && effectiveVersion >= 1
      ? versionByNumber.get(effectiveVersion - 1)?.snapshot
      : undefined;

  const fieldHighlights: FieldHighlights | null =
    showHighlights && currSnap ? computeFieldHighlights(prevSnap ?? null, currSnap) : null;

  // What the fields actually frame: the historical diff on a past version, or
  // the transient pulse on the latest. `pulsing` swaps the static ring for the
  // animated pulse class (Bug 1).
  const displayHighlights: FieldHighlights | null = fieldHighlights ?? pulse;
  const pulsing = fieldHighlights === null && pulse !== null;

  const cornerDiff: CornerDiffEntry[] | null =
    showHighlights && currSnap && prevSnap
      ? computeCornerDiff(snapshotToCorners(prevSnap), snapshotToCorners(currSnap))
      : null;

  // Slice #34.17: what the VIEWED VERSION recorded in its three lookup fields.
  //
  // ⚠️ **Each list is handed over ONLY once its query has data**, which is what
  // makes `undefined` mean "not read yet" rather than "holds no such row" — the
  // assembled `…Options` arrays are never undefined, because `noneOption` is
  // prepended to them unconditionally. Labelling an unread list's ids „valoare
  // ștearsă" would be a confident sentence about something nobody has read.
  //
  // The `isOnLatest` gate lives inside `snapshotLookupStates` rather than here;
  // its docblock says why.
  const snapshotLookups = snapshotLookupStates({
    snapshot:      currSnap,
    isOnLatest,
    propertyTypes: propertyTypes  ? propertyTypeOptions : undefined,
    useCategories: useCategories  ? useCategoryOptions  : undefined,
    tarla:         tarlaItems     ? tarlaOptions        : undefined,
  });

  // What "Make this version current" can and cannot do with this version.
  // `restoreBlocked` is fatal (a dangling id into a foreign key — a 23503 and
  // an English error string); `restoreDrops` is disclosed instead of blocked,
  // because the value cannot be carried back either way. Both are NAMED to the
  // user rather than merely counted: the tarla field is not even on screen for
  // an urban property type (`hideTarlaParcela`), so "a value" would be a reason
  // nobody could act on. `restoreBlockedBy` argues both halves.
  const restoreBlocked = restoreBlockedBy(snapshotLookups);
  const restoreDrops = restoreDropsRecorded(snapshotLookups);
  const lookupFieldLabels: Record<PropertyLookupField, string> = {
    propertyTypeId: t("fields.propertyType"),
    useCategoryId:  t("fields.useCategory"),
    tarlaId:        t("fields.tarlaSola"),
  };
  const namedFields = (fields: PropertyLookupField[]) =>
    fields.map((f) => lookupFieldLabels[f]).join(", ");

  // Version-nav controls (rendered on the corners-line) — only once versions
  // have loaded for an existing property.
  const navLocked = isOnLatest && editDirty;
  const versionNav: VersionNav | null =
    !isCreate && versions.length > 0 && effectiveVersion !== null
      ? {
          current: effectiveVersion,
          color: currSnap
            ? versionLabelColor(prevSnap ?? null, currSnap)
            : ("green" as HighlightColor),
          canPrev: effectiveVersion > 0 && !navLocked,
          canNext:
            latestVersion !== null && effectiveVersion < latestVersion && !navLocked,
          onPrev: () => goToVersion(effectiveVersion - 1),
          onNext: () => goToVersion(effectiveVersion + 1),
          // Enabled only while viewing a past version (disabled on the latest).
          // FU-067 (Slice #37.07): not in a read-only view opened from an
          // association tab — „Fă curentă" writes, and „Modifică" is how that
          // view is turned into one that may.
          canMakeCurrent: !isOnLatest && (mode !== "view" || associatedEditing),
          // Slice #34.17: a version that cannot be written back says so, in a
          // dialog. The button stays enabled on purpose — see
          // `showCannotRestore` above for why a disabled one would not do.
          onMakeCurrent: () =>
            restoreBlocked.length > 0
              ? setShowCannotRestore(true)
              : setConfirmMakeCurrent(true),
        }
      : null;

  // "Make this version current": save the currently-viewed historical snapshot
  // (the form was reset to it on navigation) as a brand-new version. This reuses
  // the exact stay-on-page edit-save path — updateProperty appends it as the new
  // latest (it differs from the current latest), and we follow that new version.
  const makeCurrentNextNumber = (latestVersion ?? 0) + 1;
  const handleMakeCurrent = async () => {
    // ⚠️ **The press is not the last word — this is.**               (#34.17)
    // A value list that resolves while the confirmation dialog is open turns a
    // `pending` field into a `deleted` one, and `onYes` still fires. Swapping
    // the dialogs rather than returning silently, because a press that was
    // legal a second ago deserves the reason rather than a dialog that just
    // disappears — and the alternative is a generic „o valoare … nu mai
    // există", which names no field. (It said „Foreign key violation", in
    // English, until Slice #34.28 translated that case in `safe-mutate.ts`.
    // Translated is not the same as answered: this refusal NAMES the fields and
    // the sentence behind it cannot, which is why #34.28 changed the message
    // and left this refusal exactly as wide as it was.)
    if (restoreBlocked.length > 0) {
      setConfirmMakeCurrent(false);
      setShowCannotRestore(true);
      return;
    }
    const values = form.getValues();
    const restoredCorners = corners;
    const ok = await doSave(values);
    if (!ok) {
      setConfirmMakeCurrent(false);
      return;
    }
    // Bug 1: pulse the restored change once the new version refetches in.
    pendingPulseRef.current = makeCurrentNextNumber;
    setBaseline({ values, corners: restoredCorners });
    setViewingVersion(null);
    setConfirmMakeCurrent(false);
    router.refresh();
  };

  // ⚠️ **Slice #37.19: as tiles, an invalid form does NOT disable „Salvează"**
  // (the Natural Person's rule, #37.17). The error may sit in a tile that is
  // not shown, and a disabled button says nothing about where. Pressing it runs
  // the validation (`onInvalid`), which shows that tile, scrolls to the field,
  // focuses it and pulses it; nothing is saved. „Adaugă proprietate" (no
  // tiles) keeps the old rule.
  const saveDisabled =
    submitting ||
    (!tiled && !form.formState.isValid) ||
    (isCreate && !createHasData) ||
    (!isCreate && isOnLatest && !editDirty);

  // Slice #37.21: the version a save starts from, the refusal of a stale one,
  // and the notices from this browser's other windows (record-save-sync.tsx).
  const recordSync = useRecordSaveSync({
    recordPath: mode === "create" || !propertyId ? null : `/api/properties/${encodeURIComponent(propertyId)}`,
    dirty: editDirty,
    latestVersion,
  });

  // doSave performs the API call only (no navigation) so it can be reused
  // both by the form's own Save button (onSubmit, which navigates after a
  // successful save) and by the unsaved-changes guard's onSave (which must
  // NOT navigate — the guard's pending action handles that separately).
  const doSave = async (values: FormValues): Promise<boolean> => {
    setSubmitting(true);
    setSubmitError(null);
    setParcelExists(null);
    try {
      const rawPayload = toApiPayload(values, corners);
      // Slice #19.02: when the selected type hides the address section, force
      // address: null regardless of any stale form-state from a prior type
      // selection (toApiPayload already does this when the address is empty; this
      // catches the edge case where an address WAS filled in before the type changed).
      const selectedTypeForSave =
        (propertyTypes ?? []).find((o) => o.id === (values.propertyTypeId ?? "")) ?? null;
      const hideAddressForSave = selectedTypeForSave ? !selectedTypeForSave.showAddress : false;
      const payload = hideAddressForSave ? { ...rawPayload, address: null } : rawPayload;
      const url =
        mode === "create"
          ? "/api/properties"
          : `/api/properties/${encodeURIComponent(propertyId!)}`;
      const method = mode === "create" ? "POST" : "PATCH";
      // Slice #21.07.Import — Adrian's rule: an entity created through the
      // "Add new" form has provenance MANUAL. Sent only on create; a PATCH must
      // never rewrite provenance, which the user owns from the References tab
      // once the record exists.
      const requestBody =
        mode === "create"
          ? { ...payload, provenance: inferProvenance("MANUAL_FORM") }
          : payload;
      // Slice #37.21: an edit says which version it started from; a stale one is refused 409.
      const saved = await safeMutate(
        url,
        {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mode === "create" ? requestBody : { ...requestBody, baseVersion: recordSync.baseVersion() }),
        },
        t,
      );
      await recordSync.remember(saved);
      await queryClient.invalidateQueries({ queryKey: ["properties"] });
      // Slice #18.02: a save appended a new version — drop the cached list so
      // reopening the property shows it (and the ◀/▶ nav enables).
      await queryClient.invalidateQueries({ queryKey: ["property-versions"] });
      return true;
    } catch (err) {
      // Slice #37.21: a save refused as stale writes nothing; the notice says so.
      if (recordSync.refused(err)) return false;
      const matches = parcelMatchesOf(err);
      if (matches) {
        setParcelExists(matches);
        return false;
      }
      setSubmitError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  // Slice #37.19 — an error in a hidden tile: show the tile (for this visit),
  // scroll to the field, focus it and pulse it (the Natural Person's
  // `onInvalid`, #37.17). A timeout rather than an animation frame, which a
  // browser does not run in a tab that is not in front.
  const onInvalid = (errs: FieldErrors<FormValues>) => {
    if (!tiles) return;
    const path = firstErrorPath(errs);
    if (!path) return;
    const tile = propTileOfField(path);
    if (!tiles.shown.includes(tile)) tiles.onRevealTile(tile);
    window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[name="${CSS.escape(path)}"]`);
      if (!el) return;
      el.scrollIntoView({ block: "center" });
      el.focus({ preventScroll: true });
      // The pulse goes on the field's row, not the box: the error re-renders
      // the box's className (its red border) and would wipe a class added here.
      const row = el.closest("label") ?? el.parentElement ?? el;
      row.classList.add("ga-vpulse-red");
      window.setTimeout(() => row.classList.remove("ga-vpulse-red"), 3300);
    }, 60);
  };

  const onSubmit = async (values: FormValues) => {
    const ok = await doSave(values);
    if (!ok) return;

    if (mode === "create") {
      router.push("/properties");
      router.refresh();
      return;
    }

    // Slice #18.02: edit mode stays on the property so the freshly-appended
    // version is visible. Reset the clean baseline to the just-saved state (so
    // Save disables and version nav unlocks), follow the new latest version,
    // and refresh server-rendered bits (e.g. the page title if the nickname
    // changed). doSave already invalidated ["property-versions"], so the nav
    // refetches and shows the new version.
    setBaseline({ values, corners });
    setViewingVersion(null);
    // Slice #21.04.Import: an associated record reverts to its read-only
    // presentation (Back to list + Modify) once the edit is saved — Modify
    // must be clicked again for a further change.
    if (mode === "view") setAssociatedEditing(false);
    router.refresh();
  };

  // Create mode derives isDirty from hasFormData (Slice #15.10/#18.01); edit
  // mode uses the baseline comparison (Slice #18.02) — which is also robust
  // to the form.reset() calls version navigation performs. A read-only
  // historical version is never dirty. Because nav is locked while the latest
  // is dirty, an unsaved edit always lives on the latest (effectiveMode edit),
  // so the page-leave guard still fires for it.
  useUnsavedChangesGuard({
    isDirty:
      effectiveMode === "view"
        ? false
        : isCreate
          ? createHasData
          : editDirty,
    onSave: async () => {
      const valid = await form.trigger();
      if (!valid) return false;
      return doSave(form.getValues());
    },
  });

  const onDelete = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(
        `/api/properties/${encodeURIComponent(propertyId!)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `${t("deleteError")} (HTTP ${res.status})`);
      }
      // FU-228 (Slice #37.07): the record is gone, so „RECENTE" forgets it.
      forgetRecentlyViewed(propertyId!);
      await queryClient.invalidateQueries({ queryKey: ["properties"] });
      router.push("/properties");
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
      setConfirmDelete(false);
    }
  };

  const { register, control, formState } = form;
  const errors = formState.errors;

  return (
    <FieldPulseContext.Provider value={pulsing}>
    <form
      onSubmit={form.handleSubmit(onSubmit, onInvalid)}
      // Slice #37.14: a whole number of panels wide, so the action bar below
      // them is as wide as they are (#37.12's rule). Slice #37.19: in tile
      // mode the page's tile row carries that width and the form itself is
      // `contents` (see `tiles`).
      className={tiled ? "contents" : "flex flex-col gap-4"}
      style={tiled ? undefined : unitRowStyle("property")}
      noValidate
    >
      {/* Slice #20.13: sticky "Modificări nesalvate" banner. */}
      <UnsavedChangesBanner show={editDirty} className={tiled ? "basis-full" : undefined} />
      <RecordSyncNotice sync={recordSync} dirty={editDirty} listHref="/properties" className={tiled ? "basis-full" : undefined} />

      {/* Version controls (Slice #18.UX.04) — portalled into the page header so
          they sit centered on the property-title line. Only rendered for an
          existing property once its versions have loaded (versionNav != null)
          and only when the header has provided a slot element. */}
      {versionNavSlot && versionNav &&
        createPortal(
          <VersionNavControls
            nav={versionNav}
            labels={{
              versionLabel:    t("corners.versionLabel", { n: versionNav.current }),
              historyChip:     t("corners.historyChip", { n: versions.length }),
              prevVersion:     t("corners.prevVersion"),
              nextVersion:     t("corners.nextVersion"),
              makeCurrent:     t("corners.makeCurrent"),
              makeCurrentHint: t("corners.makeCurrentHint"),
            }}
          />,
          versionNavSlot,
        )}

      {/* Slice #37.14: fixed-width panels — Date cadastrale, Puncte de contur,
          Adresă, Hartă and Street View — left-aligned, flowing and wrapping
          (#37.12's rule; `src/lib/ui/field-widths.ts`). This replaced the
          full-width cadastral grid, the 50/50 corners + address row and the
          full-width map of Slice #21.05.misc, all inside a centred 1040-pixel
          cap. The form itself is snapped to whole panels, so the action bar
          is as wide as they are. */}
      <div
        className={tiled ? "contents" : "flex flex-wrap items-start"}
        style={tiled ? undefined : { gap: PANEL_GAP }}
        data-panel-row
      >

        {/* Cadastral data. Slice #37.30: every label above its box, the rows
            of `SCREEN_ROWS.property.cadastral`, and the panel the fewest whole
            width units that hold its widest row (3). Nr. tarla / sola (S) and
            Nr. parcelă (M) are Adrian's later note (Stacked.txt), so the
            identifiers share one row (rule 14). They are hidden for urban
            types (Slice #19.02), and the row closes up to Cod alone. */}
        <fieldset disabled={effectiveMode === "view"} className={`m-0 border-0 p-0${hiddenClass("cadastral")}`} style={PANEL_UNIT_STYLE.property.cadastral} {...tileProps("cadastral")}>
          <section data-panel="cadastral" className="rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">
              {t("sections.cadastral")}
            </h2>
            <div className="flex flex-col gap-2">
              {(propertyCode || !typeConfig.hideTarlaParcela) && (
                <div className={STACKED_ROW_CLASS}>
                  {propertyCode && (
                    <ReadOnlyField label={t("fields.code")} value={propertyCode} width={PROP.code} field="code" />
                  )}
                  {/* Slice #34.03: an ORDINARY id-valued select — `property.tarla_id`
                      is a foreign key, so an unlisted value cannot exist. */}
                  {!typeConfig.hideTarlaParcela && (
                    <SelectField
                      label={t("fields.tarlaSola")}
                      name="tarlaId"
                      register={register}
                      control={control}
                      error={errors.tarlaId?.message}
                      options={tarlaOptions}
                      highlight={displayHighlights?.property.tarlaId}
                      snapshot={snapshotLookups.tarlaId}
                      width={PROP.tarlaId}
                    />
                  )}
                  {!typeConfig.hideTarlaParcela && (
                    <Field
                      label={t("fields.parcela")}
                      name="parcela"
                      register={register}
                      error={errors.parcela?.message}
                      highlight={displayHighlights?.property.parcela}
                      width={PROP.parcela}
                    />
                  )}
                </div>
              )}
              <Field
                label={t("fields.nickname")}
                name="nickname"
                register={register}
                error={errors.nickname?.message}
                highlight={displayHighlights?.property.nickname}
                width={PROP.nickname}
              />
              <div className={STACKED_ROW_CLASS}>
                <Field
                  label={t("fields.surfaceAreaMp")}
                  name="surfaceAreaMp"
                  type="number"
                  register={register}
                  error={errors.surfaceAreaMp?.message}
                  highlight={displayHighlights?.property.surfaceAreaMp}
                  width={PROP.surfaceAreaMp}
                />
                {/* Slice #18.09: system-computed area from the corners — read-only,
                    live (not registered with RHF). Blank until 3+ corners exist. */}
                <ReadOnlyField
                  label={t("fields.calculatedAreaMp")}
                  value={calculatedAreaDisplay}
                  hint={<HelpHint hintKey="calculated-area-auto" />}
                  width={PROP.calculatedAreaMp}
                  field="calculatedAreaMp"
                />
              </div>
              {/* Slice #32.14: the marker sits under the number it explains,
                  because the number is the only symptom the user ever saw.
                  Slice #37.30 (rule 15): on the line under the two areas, inside
                  the panel, with „Îndreaptă" beside it. */}
              {cornersSelfIntersect && (
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="text-xs font-semibold text-amber-600 dark:text-amber-500"
                    title={t("bowTie.markerHint")}
                  >
                    {t("bowTie.marker")}
                  </span>
                  {effectiveMode !== "view" && (
                    <button
                      type="button"
                      onClick={handleStraighten}
                      className={buttonClass({ variant: "secondary", size: "sm" })}
                    >
                      {t("bowTie.straighten")}
                    </button>
                  )}
                </div>
              )}
              <div className={STACKED_ROW_CLASS}>
                <Field
                  label={t("fields.carteFunciara")}
                  name="carteFunciara"
                  register={register}
                  error={errors.carteFunciara?.message}
                  highlight={displayHighlights?.property.carteFunciara}
                  width={PROP.carteFunciara}
                />
                <Field
                  label={t("fields.cadastralNumber")}
                  name="cadastralNumber"
                  register={register}
                  error={errors.cadastralNumber?.message}
                  highlight={displayHighlights?.property.cadastralNumber}
                  width={PROP.cadastralNumber}
                />
              </div>
              <div className={STACKED_ROW_CLASS}>
                <SelectField
                  label={t("fields.useCategory")}
                  name="useCategoryId"
                  register={register}
                  control={control}
                  error={errors.useCategoryId?.message}
                  options={useCategoryOptions}
                  highlight={displayHighlights?.property.useCategoryId}
                  snapshot={snapshotLookups.useCategoryId}
                  width={PROP.useCategoryId}
                />
                <SelectField
                  label={t("fields.propertyType")}
                  name="propertyTypeId"
                  register={register}
                  control={control}
                  error={errors.propertyTypeId?.message}
                  options={propertyTypeOptions}
                  highlight={displayHighlights?.property.propertyTypeId}
                  snapshot={snapshotLookups.propertyTypeId}
                  width={PROP.propertyTypeId}
                />
              </div>
              <Field
                label={t("fields.notes")}
                name="notes"
                register={register}
                error={errors.notes?.message}
                maxLength={300}
                highlight={displayHighlights?.property.notes}
                width={PROP.notes}
                fillRem={PANEL_UNIT_INNER_REM.property.cadastral}
              />
            </div>
          </section>
        </fieldset>

        {/* Corners table. Bug 1: a red pulse ring on the whole card flags a
            corner change in the just-navigated-to latest version (the
            interactive table can't show the historical per-row diff). It
            stays OUTSIDE any disabled <fieldset> (a disabled fieldset
            disables EVERY descendant control, including the version ◀/▶ nav
            buttons that live inside CornersManager's toolbar — Slice #18.02
            pitfall #4); it enforces its own read-only state via the readOnly
            prop instead. Its columns take their widths from the file. */}
        <section
          style={PANEL_UNIT_STYLE.property.corners}
          data-panel="corners"
          {...tileProps("corners")}
          className={[
            "rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900",
            cornersPulse ? "ga-vpulse-red" : "",
            tileShown("corners") ? "" : "hidden",
          ].join(" ")}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">
              {t("sections.corners")}
            </h2>
          </div>
          <CornersManager
            corners={corners}
            onChange={setCorners}
            readOnly={effectiveMode === "view"}
            hoveredCornerIdx={hoveredCornerIdx}
            onCornerHover={setHoveredCornerIdx}
            bigMap={bigMap}
            onToggleBigMap={handleToggleBigMap}
            streetView={streetViewOpen && !typeConfig.hideStreetView}
            onToggleStreetView={typeConfig.hideStreetView ? undefined : handleToggleStreetView}
            showAngles={showAngles}
            onToggleAngles={() => setShowAngles((v) => !v)}
            cornerDiff={cornerDiff ?? undefined}
          />
        </section>

        {/* Address — Slice #19.02: hidden for agricultural / forest types.
            Slice #37.30: labels above, the rows of `SCREEN_ROWS.property.address`
            — the shared address rows with the Street View street line after
            Stradă — 3 units. */}
        {!typeConfig.hideAddress && (
          <fieldset disabled={effectiveMode === "view"} className={`m-0 border-0 p-0${hiddenClass("address")}`} style={PANEL_UNIT_STYLE.property.address} {...tileProps("address")}>
            <section data-panel="address" className="rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">
                {t("sections.address")}
              </h2>
              <div className="flex flex-col gap-2">
                <Field
                  label={t("address.streetLine")}
                  name="address.streetLine"
                  register={register}
                  error={errors.address?.streetLine?.message}
                  highlight={displayHighlights?.address.streetLine}
                  width={ADDRESS.streetLine}
                />
                {/* Slice #18.12: Street View address — only the street line may
                    differ from the document-derived one above; the shared
                    postal/locality/county/country fields below apply to both.
                    The Fetch button reverse-geocodes the corners' centroid. In a
                    read-only historical version the whole address fieldset is
                    disabled, which also disables this button. Slice #37.30
                    (rule 15): the label above, „Preia din Street View" and its
                    help beside the box, the hint or the error under them. */}
                <label className={STACKED_FIELD_CLASS} style={{ width: rem(PANEL_UNIT_INNER_REM.property.address) }}>
                  <span className={STACKED_LABEL_CLASS}>
                    {t("streetViewAddress.label")}
                  </span>
                  <div className="flex items-start gap-2">
                    <GrowingText
                      registration={register("address.streetViewStreetLine")}
                      width={String(boxStyle(PROP.streetViewStreetLineBox).width)}
                      className={[
                        BOX_CLASS,
                        "border-wire focus:border-focus dark:border-zinc-700",
                        highlightRingClass(displayHighlights?.address.streetViewStreetLine, pulsing),
                      ].join(" ")}
                      data-width-field="address.streetViewStreetLine"
                      data-width-kind={PROP.streetViewStreetLineBox.kind}
                    />
                    <button
                      type="button"
                      onClick={handleFetchStreetViewAddress}
                      disabled={
                        fetchingStreetView || !streetViewCentroid || !geocodingLib
                      }
                      title={
                        !streetViewCentroid ? t("streetViewAddress.needsCorners") : undefined
                      }
                      className={buttonClass({ variant: "secondary", size: "xs", className: "mt-1 shrink-0" })}
                    >
                      {fetchingStreetView
                        ? t("streetViewAddress.fetching")
                        : t("streetViewAddress.fetch")}
                    </button>
                    <span className="mt-1 shrink-0">
                      <HelpHint hintKey="street-view-fetch-address" />
                    </span>
                  </div>
                  {streetViewFetchError ? (
                    <span className="text-xs text-red-600 dark:text-red-400" role="alert">
                      {streetViewFetchError}
                    </span>
                  ) : (
                    <span className="text-xs text-fade dark:text-zinc-400">
                      {t("streetViewAddress.hint")}
                    </span>
                  )}
                </label>
                <div className={STACKED_ROW_CLASS}>
                  <Field
                    label={t("address.postalCode")}
                    name="address.postalCode"
                    register={register}
                    error={errors.address?.postalCode?.message}
                    highlight={displayHighlights?.address.postalCode}
                    width={ADDRESS.postalCode}
                  />
                  <Field
                    label={t("address.locality")}
                    name="address.locality"
                    register={register}
                    error={errors.address?.locality?.message}
                    highlight={displayHighlights?.address.locality}
                    width={ADDRESS.locality}
                  />
                </div>
                <div className={STACKED_ROW_CLASS}>
                  <Field
                    label={t("address.county")}
                    name="address.county"
                    register={register}
                    error={errors.address?.county?.message}
                    highlight={displayHighlights?.address.county}
                    width={ADDRESS.county}
                  />
                  <Field
                    label={t("address.country")}
                    name="address.country"
                    register={register}
                    error={errors.address?.country?.message}
                    highlight={displayHighlights?.address.country}
                    width={ADDRESS.country}
                  />
                </div>
                {/* Slice #37.04 (FU-013): a blank „Țară" is saved as „România".
                    Slice #37.30 (rule 15): under Țară's row, inside the panel. */}
                <p className="text-xs text-fade">{t("address.countryDefault")}</p>
                <Field
                  label={t("address.notes")}
                  name="address.notes"
                  register={register}
                  error={errors.address?.notes?.message}
                  highlight={displayHighlights?.address.notes}
                  width={ADDRESS.notes}
                  fillRem={PANEL_UNIT_INNER_REM.property.address}
                />
              </div>
            </section>
          </fieldset>
        )}

        {/* The mini-map — a panel of its own at a fixed size (Field.Widths.v02:
            it fills a small tile), with or without a polygon, so nothing jumps
            when the first corner is added. The polygon is fitted into it with
            fitBounds (property-mini-map-inner.tsx), so a parcel of any size
            fits at the default zoom. „Hartă extinsă" still opens the
            full-screen theater overlay. */}
        {/* Slice #37.19: as tiles, the map is mounted only while „Hartă" is
            ticked — an unticked map makes no Google Maps request of its own. */}
        {tileShown("map") && (
        <section
          style={PANEL_UNIT_STYLE.property.map}
          data-panel="map"
          {...tileProps("map")}
          className="rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div
            className="relative overflow-hidden rounded-md border border-card-rim dark:border-zinc-800"
            style={MAP_BOX_STYLE}
            data-width-field="map"
            data-width-kind="fixed"
          >
            <div className="absolute inset-0">
              <ErrorBoundary fallback={<PanelError>{tShared("errorBoundary.map")}</PanelError>}>
                <PropertyMiniMap
                  corners={corners}
                  onChange={setCorners}
                  readOnly={effectiveMode === "view"}
                  hoveredCornerIdx={hoveredCornerIdx}
                  onCornerHover={setHoveredCornerIdx}
                  showAngles={showAngles}
                  onZoomChange={handleMiniMapZoom}
                />
              </ErrorBoundary>
            </div>
          </div>
        </section>
        )}

        {/* Slice #18.03b: Street View panel — mounted only while open so the
            (billed) panorama and Street View library never load on property
            open. The same fixed size as the map, beside it. */}
        {streetViewOpen && !typeConfig.hideStreetView && (
          <section
            style={PANEL_UNIT_STYLE.property.streetView}
            data-panel="street-view"
            {...tileProps("streetView")}
            className="rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div
              className="overflow-hidden rounded-md border border-card-rim dark:border-zinc-800"
              style={MAP_BOX_STYLE}
              data-width-field="streetView"
              data-width-kind="fixed"
            >
              <ErrorBoundary fallback={<PanelError>{tShared("errorBoundary.streetView")}</PanelError>}>
                <StreetViewPanel centroid={streetViewCentroid} />
              </ErrorBoundary>
            </div>
          </section>
        )}

      </div>{/* end Slice #37.14 panel row */}

      {/* Slice #37.19: in tile mode the error and the action bar are the tile
          row's last line (`order-last`), after the list tiles. */}
      <div className={tiled ? "order-last flex basis-full flex-col gap-4" : "contents"}>

      {/* Slice #20.16: Theater overlay — full-screen map portal. Rendered above
          everything via document.body so no layout shift occurs. Dismiss via
          the ✕ button, the backdrop, or the Escape key. */}
      {bigMap && createPortal(
        <div role="dialog" aria-modal="true" aria-label={t("corners.theaterTitle")}>
          {/* Backdrop — click to close */}
          <div
            className="fixed inset-0 z-50 bg-black/50"
            aria-hidden="true"
            onClick={handleCloseTheaterMap}
          />
          {/* Panel */}
          <div
            className="fixed inset-4 z-50 flex flex-col rounded-xl border border-card-rim bg-white shadow-2xl overflow-hidden dark:border-zinc-700 dark:bg-zinc-900"
            style={{ animation: "ga-theater-in 180ms ease" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-4 px-4 py-2 border-b border-crease dark:border-zinc-700 bg-white dark:bg-zinc-900">
              <span className="text-sm font-semibold text-ink dark:text-zinc-200">
                {t("corners.theaterTitle")}
              </span>
              <button
                type="button"
                onClick={handleCloseTheaterMap}
                aria-label={t("corners.theaterClose")}
                className={buttonClass({ variant: "secondary", size: "sm" })}
              >
                ✕ {t("corners.theaterClose")}
              </button>
            </div>
            {/* Map fills the rest */}
            <div className="relative flex-1 min-h-0">
              <div className="absolute inset-0">
                <ErrorBoundary fallback={<PanelError>{tShared("errorBoundary.map")}</PanelError>}>
                  <PropertyMiniMap
                    corners={corners}
                    onChange={setCorners}
                    readOnly={effectiveMode === "view"}
                    hoveredCornerIdx={hoveredCornerIdx}
                    onCornerHover={setHoveredCornerIdx}
                    showAngles={showAngles}
                  />
                </ErrorBoundary>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {submitError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {submitError}
        </p>
      )}

      {parcelExists && parcelExists.length > 0 && (
        <div
          role="alert"
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200"
        >
          <p className="font-medium">{t("parcelExists.title")}</p>
          <p className="mt-1">
            {t("parcelExists.body", {
              tarla: parcelExists[0].tarla ?? "—",
              parcela: parcelExists[0].parcela ?? "—",
            })}
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {parcelExists.map((m) => (
              <li key={m.id}>
                {/* #37.42 (A016): ArrowRight — with its words kept beside it, the
                    one A016 site that does: the words are the record's code and
                    nickname, and a column of bare arrows would not say which
                    property each one opens. */}
                <IconButton
                  href={`/properties/${m.id}`}
                  icon={ArrowRight}
                  label={t("parcelExists.open", { code: m.code, nickname: m.nickname ?? "" })}
                  showLabel
                  variant="secondary"
                  size="xs"
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action buttons. In true read-only view (opened via ?readonly=true from
          an association list) show a Back-to-list button (left) + Modify
          button (right). Once Modify is clicked (associatedEditing), it shows
          Back-to-list (left) + Save/Delete (right) — no Cancel (Back-to-list
          covers that). When effectiveMode is "view" only because an earlier
          historical version is being viewed (mode is still "edit"), show
          nothing here — the version nav arrows are the way back, matching the
          natural/judicial person forms' convention. */}
      {effectiveMode === "view" ? (
        mode === "view" && (
          <div className="flex items-center justify-between border-t border-crease pt-6 dark:border-zinc-800">
            <IconButton
              icon={ArrowLeft}
              label={tShared("readonlyView.backToList")}
              variant="secondary"
              size="lg"
              onClick={() => router.back()}
            />
            {/* Slice #32.15: on an older version this button used to be drawn,
                clickable and inert — setAssociatedEditing cannot beat !isOnLatest
                in the effectiveMode ternary above, so nothing unlocked. It is now
                disabled, and carries the reason in its title. */}
            <IconButton
              icon={Pencil}
              label={t("buttons.modify")}
              variant="secondary"
              size="lg"
              onClick={() => setAssociatedEditing(true)}
              disabled={!isOnLatest}
              note={!isOnLatest ? tShared("readonlyView.modifyNeedsLatest") : undefined}
            />
          </div>
        )
      ) : mode === "view" ? (
        <div className="flex items-center justify-between border-t border-crease pt-6 dark:border-zinc-800">
          <IconButton
            icon={ArrowLeft}
            label={tShared("readonlyView.backToList")}
            variant="secondary"
            size="lg"
            onClick={() => router.back()}
          />
          <div className="flex items-center gap-3">
            <IconButton
              icon={Save}
              label={t("buttons.save")}
              variant="primary"
              size="lg"
              type="submit"
              disabled={saveDisabled}
            />
            <IconButton
              icon={Trash2}
              label={t("buttons.delete")}
              variant="danger"
              size="lg"
              onClick={() => setShowCannotDelete(true)}
              disabled={submitting}
            />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-3 border-t border-crease pt-6 dark:border-zinc-800">
          <IconButton
            icon={Save}
            label={t("buttons.save")}
            variant="primary"
            size="lg"
            type="submit"
            disabled={saveDisabled}
          />
          {effectiveMode === "edit" && (
            <IconButton
              icon={Trash2}
              label={t("buttons.delete")}
              variant="danger"
              size="lg"
              onClick={() => setConfirmDelete(true)}
              disabled={submitting}
            />
          )}
          <IconButton
            icon={X}
            label={t("buttons.cancel")}
            variant="secondary"
            size="lg"
            onClick={() => router.push("/properties")}
            disabled={submitting}
          />
        </div>
      )}

      {/* Slice #32.14 — straighten the corner order. Neither dialog writes
          anything: the first hands the reordered corners to the form's own
          state, and the ordinary Save button does the rest. */}
      {straightenProposal != null && straightenProposal.contextKey === straightenContextKey && (
        <StraightenDialog
          points={straightenProposal.points}
          order={straightenProposal.order}
          numbers={straightenProposal.numbers}
          currentAreaM2={straightenProposal.currentAreaM2}
          proposedAreaM2={straightenProposal.proposedAreaM2}
          declaredAreaM2={straightenProposal.declaredAreaM2}
          onConfirm={applyStraighten}
          onCancel={() => setStraightenProposal(null)}
        />
      )}

      {straightenImpossible && (
        <ConfirmDialog
          title={t("bowTie.noFix.title")}
          body={t("bowTie.noFix.body")}
          yesLabel={t("bowTie.noFix.ok")}
          onYes={() => setStraightenImpossible(false)}
          busy={false}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={t("confirmDelete.title")}
          body={t("confirmDelete.body")}
          yesLabel={t("buttons.yes")}
          noLabel={t("buttons.no")}
          onYes={onDelete}
          onNo={() => setConfirmDelete(false)}
          busy={submitting}
        />
      )}

      {confirmMakeCurrent && (
        <ConfirmDialog
          title={t("makeCurrent.title")}
          body={
            t("makeCurrent.body", {
              viewed: effectiveVersion ?? 0,
              next: makeCurrentNextNumber,
            }) +
            // Slice #34.17: the one thing a restore cannot carry, named before
            // the press. Appended to the body rather than given its own line
            // because `ConfirmDialog` takes a plain string.
            //
            // ⚠️ It says the PROPERTY will be left without it, not "the new
            // version": when nothing else about the restored version differs
            // from the latest, `snapshotsEqual` writes no version row at all —
            // it compares `tarlaId`, null on both sides — so a sentence
            // promising a new version would be false in exactly that case. The
            // live column is cleared either way.
            (restoreDrops.length > 0
              ? " " + t("makeCurrent.dropsRecorded", { fields: namedFields(restoreDrops) })
              : "")
          }
          yesLabel={t("makeCurrent.ok")}
          noLabel={t("makeCurrent.cancel")}
          onYes={handleMakeCurrent}
          onNo={() => setConfirmMakeCurrent(false)}
          busy={submitting}
        />
      )}

      {/* Slice #34.17 — the refusal, with the fields named. `blockedTitle` is
          a statement rather than a question, and the single-button info shape
          is the one `cannotDeleteAssociated` has used since #21.04.Import. */}
      {/* `&& restoreBlocked.length > 0` so the dialog cannot outlive its own
          reason: it names fields, and a version list that empties under it
          would leave it saying „Câmpuri: ." — the degenerate sentence
          `goToVersion` closes it to avoid on the path that actually happens. */}
      {showCannotRestore && restoreBlocked.length > 0 && (
        <ConfirmDialog
          title={t("makeCurrent.blockedTitle")}
          body={t("makeCurrent.blocked", { fields: namedFields(restoreBlocked) })}
          yesLabel={t("makeCurrent.ok")}
          onYes={() => setShowCannotRestore(false)}
          busy={false}
        />
      )}

      {/* Slice #21.04.Import: an associated property can't be deleted from
          this (readonly-opened) page — it must be disassociated first, then
          deleted from its own page via the left navigation panel. Info-only
          dialog (no noLabel/onNo) — a single OK button dismisses it. */}
      {showCannotDelete && (
        <ConfirmDialog
          title={t("cannotDeleteAssociated.title")}
          body={t("cannotDeleteAssociated.body")}
          yesLabel={t("cannotDeleteAssociated.ok")}
          onYes={() => setShowCannotDelete(false)}
          busy={false}
        />
      )}
      </div>{/* end the action bar's line */}
    </form>
    </FieldPulseContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Shared presentational helpers (mirrors natural-person-form pattern)
// ---------------------------------------------------------------------------

type FieldProps = {
  label:      string;
  name:       FieldPath<FormValues>;
  type?:      string;
  register:   UseFormRegister<FormValues>;
  error?:     string;
  hint?:      string;
  highlight?: HighlightColor;
  /**
   * Slice #37.14: the box's width and kind, from `src/lib/ui/field-widths.ts`
   * — a GROWING kind renders `<GrowingText>`, every other an `<input>` as wide
   * as its step (#37.12's helper shape).
   */
  width:      FieldWidth;
  /** The most characters the box takes — the notes' 300. */
  maxLength?: number;
  /** Slice #37.30: the panel's inner width, for a box that `fill`s it (Note). */
  fillRem?: number;
};

/** The box's own look; its width is never a class here — it comes from `boxStyle`. */
const BOX_CLASS =
  "rounded-md border bg-white px-2 py-1 shadow-sm focus:outline-none disabled:bg-canvas disabled:text-fade disabled:cursor-default dark:bg-zinc-950 dark:disabled:bg-zinc-800";

function Field({ label, name, type = "text", register, error, hint, highlight, width, maxLength, fillRem }: FieldProps) {
  const ring = usePulseRing(highlight);
  const className = [
    BOX_CLASS,
    error
      ? "border-red-500 focus:border-red-600"
      : "border-wire focus:border-focus dark:border-zinc-700",
    ring,
  ].join(" ");
  const grows = width.kind === "grows" || width.kind === "lines";
  // Slice #37.30: the label ABOVE its box, the pair exactly as wide as the box
  // (or the panel, for a box that fills it) — a long label wraps inside it.
  const box = stackedBoxStyle(width, fillRem ?? boxRem(width));
  return (
    <label className={STACKED_FIELD_CLASS} style={box}>
      <span className={STACKED_LABEL_CLASS}>{label}</span>
      {grows ? (
        <GrowingText
          registration={register(name)}
          width={String(box.width)}
          lines={width.kind === "lines"}
          fold={width.fold}
          minRows={width.rows ?? 1}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          className={className}
          data-width-field={name}
          data-width-kind={width.kind}
        />
      ) : (
        <input
          type={type}
          {...register(name)}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          className={className}
          style={box}
          data-width-field={name}
          data-width-kind={width.kind}
        />
      )}
      {hint && !error && (
        <span className="text-xs text-fade dark:text-zinc-400">{hint}</span>
      )}
      {error && (
        <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
      )}
    </label>
  );
}

function SelectField({
  label,
  name,
  register,
  control,
  error,
  options,
  highlight,
  snapshot,
  width,
}: FieldProps & {
  control: Control<FormValues>;
  options: { value: string; label: string }[];
  /**
   * Slice #34.17: what the viewed VERSION recorded in this field.
   *
   * `empty` in create mode and on the latest — `snapshotLookupStates` returns
   * that for both — and `resolved` or `pending` on a version the list can still
   * answer for. All three render the `<select>` below exactly as it always has;
   * only `deleted` and `recorded` take the field over. Optional so a call site
   * that has no version to read (there is none today) can omit it.
   */
  snapshot?: SnapshotLookupState;
}) {
  const tShared = useTranslations("shared");
  const ring = usePulseRing(highlight);
  // Slice #37.14: the chosen option in full on hover when the box is narrower (#37.12).
  const current = useWatch({ control, name });
  const chosenLabel = options.find((o) => o.value === (current ?? ""))?.label;

  // A version whose lookup row an admin deleted, or whose tarla was recorded as
  // text before the column had an id, PRINTS what the snapshot holds instead of
  // offering a picker that has no option for it — which is the empty box both
  // rendered until this slice. Not a `<label>`: there is no control to
  // associate with it, exactly like `<ReadOnlyField>` further down.
  if (snapshot && snapshotReplacesPicker(snapshot)) {
    // `role="group"` + `aria-labelledby` because the value is no longer a
    // control for the `<label>` to point at, and a `<span>` beside a `<div>`
    // is nothing to a screen reader. `<ReadOnlyField>` below predated this and
    // had the same gap; Slice #34.28 closed it there with the same two
    // attributes — and had to hang the id on an INNER span, because that
    // component's label cell also carries a `<HelpHint>` whose button label,
    // and open hint text, `aria-labelledby` would otherwise fold into the name.
    // There is no `hint` here, which is why this one can name the span itself.
    const labelId = `${name}-version-label`;
    return (
      <div className={STACKED_FIELD_CLASS} style={boxStyle(width)} role="group" aria-labelledby={labelId}>
        <span id={labelId} className={STACKED_LABEL_CLASS}>{label}</span>
        <div className="flex flex-col gap-0.5" style={boxStyle(width)} data-width-field={name} data-width-kind={width.kind}>
          <SnapshotValue
            state={snapshot}
            deletedLabel={tShared("snapshotValue.deleted")}
            className={ring}
          />
        </div>
      </div>
    );
  }

  return (
    <label className={STACKED_FIELD_CLASS} style={boxStyle(width)}>
      <span className={STACKED_LABEL_CLASS}>{label}</span>
      <div className="flex flex-col gap-0.5" style={boxStyle(width)}>
        {/* Slice #32.13: the async-options idiom lives in <AsyncSelect> now.
            The key that used to be here was inert — `noneOption` is prepended
            unconditionally above, so `options.length` was never 0 and the
            `loaded`/`loading` ternary was a constant. Nothing ever remounted,
            so on any visit with a cold query cache every stored value on this
            form showed as "— niciunul —", and stayed there. (Within the
            queries' 5-minute staleTime the list is already in cache at mount
            and the field was right, which is why it looked intermittent.) */}
        <AsyncSelect
          name={name}
          control={control}
          register={register}
          options={options}
          aria-invalid={error ? true : undefined}
          className={[
            BOX_CLASS,
            error
              ? "border-red-500 focus:border-red-600"
              : "border-wire focus:border-focus dark:border-zinc-700",
            ring,
          ].join(" ")}
          style={boxStyle(width)}
          title={chosenLabel}
          widthField={name}
        />
        {error && (
          <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
        )}
      </div>
    </label>
  );
}

/**
 * A label beside a value that is not a control.
 *
 * ⚠️ **`role="group"` + `aria-labelledby`, FOR THE REASON THE PRINTED SNAPSHOT
 * BOX ABOVE GIVES.**                                            (Slice #34.28)
 * There is no control here for a `<label>` to point at, and a `<span>` beside a
 * `<div>` is nothing to a screen reader: the value was announced with no idea
 * what it was the value OF. This is the same two attributes `SelectField`'s
 * snapshot branch got in #34.17, arriving on the component that predates it.
 *
 * ⚠️ **THE ID IS ON AN INNER SPAN, AND THE OUTER ONE WOULD HAVE BEEN WRONG.**
 * The label cell also carries `hint` — a `<HelpHint>`, which renders a
 * `<button aria-label="…">` and, once opened, a `<p>` holding the whole hint
 * text. `aria-labelledby` takes the SUBTREE of what it names, so pointing it at
 * the outer span would have made this group's accessible name „Suprafață
 * calculată" plus the hint button's label — and, with the hint open, plus every
 * word of the hint. The snapshot box above has no `hint` and so did not have to
 * answer this.
 *
 * ⚠️ **`useId`, NOT A NAME-DERIVED ID.** `ReadOnlyField` takes no `name`, and
 * two of its call sites sit on the same screen; a label-derived id would
 * collide the day two read-only fields share a label, which is a bug that
 * announces the wrong field rather than failing.
 */
function ReadOnlyField({
  label,
  value,
  hint,
  width,
  field,
}: {
  label: string;
  value: string;
  /** Optional <HelpHint> — most callers have no hidden behaviour to explain. */
  hint?: React.ReactNode;
  /** Slice #37.14: the box's width, from `field-widths.ts`. */
  width: FieldWidth;
  /** Slice #37.14: its name for the e2e width check. */
  field: string;
}) {
  const labelId = useId();
  return (
    <div className={STACKED_FIELD_CLASS} style={boxStyle(width)} role="group" aria-labelledby={labelId}>
      <span className={`${STACKED_LABEL_CLASS} flex items-center gap-1`}>
        <span id={labelId}>{label}</span>
        {hint}
      </span>
      <div
        className="rounded-md border border-wire bg-canvas px-2 py-1 font-mono text-sm text-ink dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
        style={boxStyle(width)}
        data-width-field={field}
        data-width-kind={width.kind}
      >
        {value}
      </div>
    </div>
  );
}

/**
 * The five confirmations and refusals this form draws.
 *
 * ⚠️ **`aria-modal="true"` WAS A PROMISE NOTHING KEPT, AND #34.17 WATCHED IT
 * BREAK.**                                                      (Slice #34.28)
 * The backdrop stopped the mouse and nothing stopped the keyboard: Shift+Tab
 * walked out of the refusal dialog into the ◀/▶ version nav — which is
 * PORTALLED into the breadcrumb header, so it is not even underneath this
 * overlay in the DOM — and Enter there stepped to another version with the
 * dialog still up, naming fields from a version nobody was looking at. #34.17
 * closed that one consequence by having `goToVersion` shut both make-current
 * dialogs; the absence itself was older and untouched. This is the absence.
 *
 * ⚠️ **IN PLACE, COVERING ALL FIVE INSTANCES.** The trap and the Escape handler
 * live on the component, not on its call sites, so `straightenImpossible`,
 * `confirmDelete`, `confirmMakeCurrent`, `showCannotRestore` and
 * `showCannotDelete` get them without a prop and a sixth instance cannot be
 * added without them. The arithmetic is in `@/lib/ui/dialog-focus`, which says
 * why it is a separate module and why `inert` is not the mechanism here.
 *
 * ⚠️ **#34.10's THREE REGRESSIONS, CHECKED BY NAME, BECAUSE #34.20 RECORDED
 * THEM AS THE COST OF ADDING ESCAPE TO A DIALOG THAT NEVER HAD ONE.**
 *   1. *An Escape that closed the modal underneath.* Live here: the theater-map
 *      overlay in this same file registers its own `window` keydown for Escape,
 *      and regression 2 below explains how the two come to be open together.
 *      Both listeners would fire on one press, so the map would close under a
 *      dialog the user had not answered. The listener below is therefore
 *      registered in the CAPTURE phase and calls
 *      `stopPropagation`: window-capture runs before anything else in the
 *      dispatch, so the topmost dialog consumes the key and the map stays open.
 *      (Two `ConfirmDialog`s open at once would both close — `stopPropagation`
 *      does not stop other listeners on the same node. No pair of these five
 *      flags is set together today, and the two make-current ones are cleared
 *      in the same statement.)
 *   2. *A z-40/z-50 that painted under the panel the dialog had become a
 *      sibling of.* ⚠️ **REACHABLE, AND THE FIRST DRAFT OF THIS COMMENT WAVED IT
 *      THROUGH WITH A MOUSE ARGUMENT — an adversarial round caught that.** The
 *      theater map above renders through `createPortal` to `document.body`
 *      while these dialogs are inline in the form, so at an equal `z-50` the
 *      later-in-document portal paints ON TOP: a confirmation opened with the
 *      map up was trapping focus inside an overlay nobody could see, and the
 *      first Escape closed the invisible one. Saying that nothing under a
 *      `fixed inset-0` backdrop is clickable is a statement about the mouse, in
 *      a slice whose whole premise is that the keyboard gets through anyway —
 *      the Straighten button behind the map is still tabbable, and pressing it
 *      is what mounts `straightenImpossible` underneath. So this overlay is
 *      `z-60`, which is the value `value-list-modal.tsx` already uses for a
 *      confirmation over a modal, and it stays below
 *      `unsaved-changes-provider.tsx`'s `z-[100]`, which is correctly the
 *      outermost thing on the page. (The map having no trap of its own is the
 *      older, wider defect and is in the handover.)
 *   3. *The panel behind not being `inert`.* Replaced rather than added, for the
 *      two reasons `dialog-focus.ts` sets out — this dialog is a CHILD of the
 *      form, so `inert` on the form would silence the dialog too, and the
 *      version nav is outside the form anyway.
 *
 * ⚠️ **ESCAPE IS REFUSED WHILE `busy`**, which is `submitting` for the delete
 * and the make-current. `discover-review-dialog.tsx` and
 * `document-persons-modal.tsx` both carry the same guard and #29.13 wrote down
 * why: the mutation completes regardless, so an Escape mid-flight unmounts the
 * only place a refusal is ever reported, and a write that failed reads as one
 * the user cancelled.
 */
function ConfirmDialog({
  title, body, yesLabel, noLabel, onYes, onNo, busy,
}: {
  title:    string;
  body:     string;
  yesLabel: string;
  // Slice #21.04.Import: noLabel/onNo are optional — omitting both renders a
  // single-button info dialog (e.g. "can't delete from here") instead of a
  // yes/no confirmation.
  noLabel?: string;
  onYes:    () => void;
  onNo?:    () => void;
  busy:     boolean;
}) {
  const isConfirm = !!noLabel && !!onNo;
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  // Slice #34.28: `useId` rather than the literal `confirm-title` this carried
  // since #21.04.Import. Fixed in passing — `aria-labelledby` names an id, and
  // two of these mounted together would have given the document two nodes
  // called `confirm-title`, where the pointer resolves to the first in the
  // document and a dialog is announced with another dialog's heading.
  const titleId = useId();

  /**
   * Take focus on open, hand it back on close.
   *
   * The overlay carries `tabIndex={-1}` so it can be focused at all, and
   * `outline-none` because it is a container rather than a control — both
   * buttons inside keep their own ring. Reading `document.activeElement` here
   * rather than at the call site works because this effect runs before anything
   * has moved focus; `document-persons-modal.tsx` has to capture its opener in
   * the click handler instead, and only because the same commit marks its list
   * `inert` and the UA has already blurred the button by effect time. Nothing is
   * inert here.
   *
   * The `isConnected` guard is not defensive padding: `onDelete` navigates to
   * /properties and `handleMakeCurrent` calls `router.refresh()`, so by unmount
   * the button that opened this can be gone. Focus then stays where the browser
   * put it, which is no worse than the state before this slice.
   */
  useEffect(() => {
    openerRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => {
      const opener = openerRef.current;
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  /** Escape dismisses — cancelling a confirmation, acknowledging an info box. */
  const dismiss = useCallback(() => {
    if (busy) return;
    if (onNo) onNo();
    else onYes();
  }, [busy, onNo, onYes]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Consumed even while `busy`, where `dismiss` is a no-op: releasing it
      // would hand the key to the theater-map listener, and closing the map out
      // from under a save nobody can see the result of is the same failure by
      // another route.
      e.stopPropagation();
      dismiss();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [dismiss]);

  /** Keep Tab inside. The decision is in `@/lib/ui/dialog-focus`. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const move = tabTrapMove(panelRef.current, document.activeElement, e.shiftKey);
      if (move.preventDefault) e.preventDefault();
      move.focus?.focus();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 p-4 outline-none"
    >
      <div className="w-full max-w-sm rounded-lg bg-card p-6 shadow-xl dark:bg-zinc-900">
        <h3 id={titleId} className="text-base font-semibold text-ink dark:text-zinc-100">
          {title}
        </h3>
        <p className="mt-2 text-sm text-fade dark:text-zinc-400">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          {isConfirm && (
            <button
              type="button"
              onClick={onNo}
              disabled={busy}
              className={buttonClass({ variant: "secondary", size: "lg" })}
            >
              {noLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onYes}
            disabled={busy}
            className={buttonClass({
              variant: isConfirm ? "danger" : "primary",
              size: "lg",
            })}
          >
            {yesLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
