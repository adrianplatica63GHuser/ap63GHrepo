"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  type Control,
  type FieldPath,
  type UseFormRegister,
  useForm,
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
import { NavArrowIcon } from "@/components/back-arrow";
import { UnsavedChangesBanner } from "@/components/unsaved-changes-banner";
import { useUnsavedChangesGuard } from "@/components/providers/unsaved-changes-provider";
import {
  computeCornerDiff,
  computeFieldHighlights,
  emptyFormValues,
  formSchema,
  formValuesEqual,
  hasFormData,
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
import { StreetViewPanel } from "./street-view-panel";
import { HelpHint } from "@/components/help/help-hint";
import { ErrorBoundary, PanelError } from "@/components/error-boundary";
import { VersionNavControls } from "@/components/version-nav-controls";
import { AsyncSelect } from "@/components/forms/async-select";
import { FieldPulseContext, usePulseRing } from "@/components/versioning/field-pulse";
import { highlightRingClass } from "@/lib/versioning/highlight-ring";
import { safeMutate } from "@/lib/api/safe-mutate";
import { inferProvenance } from "@/lib/metadata/provenance-rules";
import { buttonClass } from "@/lib/ui/button-styles";

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

async function fetchValueList(listKey: string): Promise<LookupOption[]> {
  const res = await fetch(`/api/admin/value-lists/${listKey}`);
  if (!res.ok) throw new Error(`Failed to load ${listKey} (HTTP ${res.status})`);
  const body = await res.json();
  return (body.items ?? []) as LookupOption[];
}

async function fetchPropertyTypes(): Promise<PropertyTypeLookupOption[]> {
  const res = await fetch("/api/admin/value-lists/property-types");
  if (!res.ok) throw new Error(`Failed to load property-types (HTTP ${res.status})`);
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
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PropertyForm({
  mode,
  propertyId,
  propertyCode,
  initialValues,
  initialCorners = [],
  onBigMapChange,
  versionNavSlot,
}: Props) {
  const t       = useTranslations("property");
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

  // Slice #18.16.VL — tarla dropdown (value = indicativ text, no FK migration)
  const { data: tarlaItems } = useQuery({
    queryKey: ["value-list", "tarla"],
    queryFn:  async () => {
      const res = await fetch("/api/admin/value-lists/tarla");
      if (!res.ok) throw new Error(`Failed to load tarla (HTTP ${res.status})`);
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
  const tarlaSolaOptions = [
    noneOption,
    ...(tarlaItems ?? []).map((o) => ({
      value: o.indicativ,
      label: o.descriere ? `${o.indicativ} — ${o.descriere}` : o.indicativ,
    })),
  ];

  const [corners,          setCorners]          = useState<Corner[]>(initialCorners);
  const [hoveredCornerIdx, setHoveredCornerIdx] = useState<number | null>(null);
  const [submitting,       setSubmitting]       = useState(false);
  const [submitError,      setSubmitError]      = useState<string | null>(null);
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

  const handleToggleStreetView = () => setShowStreetView((v) => !v);

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
          canMakeCurrent: !isOnLatest,
          onMakeCurrent: () => setConfirmMakeCurrent(true),
        }
      : null;

  // "Make this version current": save the currently-viewed historical snapshot
  // (the form was reset to it on navigation) as a brand-new version. This reuses
  // the exact stay-on-page edit-save path — updateProperty appends it as the new
  // latest (it differs from the current latest), and we follow that new version.
  const makeCurrentNextNumber = (latestVersion ?? 0) + 1;
  const handleMakeCurrent = async () => {
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

  const saveDisabled =
    submitting ||
    !form.formState.isValid ||
    (isCreate && !createHasData) ||
    (!isCreate && isOnLatest && !editDirty);

  // doSave performs the API call only (no navigation) so it can be reused
  // both by the form's own Save button (onSubmit, which navigates after a
  // successful save) and by the unsaved-changes guard's onSave (which must
  // NOT navigate — the guard's pending action handles that separately).
  const doSave = async (values: FormValues): Promise<boolean> => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const rawPayload = toApiPayload(values, corners);
      // Slice #19.02: when the selected type hides the address section, force
      // address: null regardless of any stale form-state from a prior type
      // selection (toApiPayload already does this when country is blank; this
      // catches the edge case where country WAS filled in before the type changed).
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
      await safeMutate(
        url,
        { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody) },
        t,
      );
      await queryClient.invalidateQueries({ queryKey: ["properties"] });
      // Slice #18.02: a save appended a new version — drop the cached list so
      // reopening the property shows it (and the ◀/▶ nav enables).
      await queryClient.invalidateQueries({ queryKey: ["property-versions"] });
      return true;
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setSubmitting(false);
    }
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
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
      noValidate
    >
      {/* Slice #20.13: sticky "Modificări nesalvate" banner. */}
      <UnsavedChangesBanner show={editDirty} />

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

      {/* Slice #21.05.misc: full-width Cadastral panel on top, Corners +
          Address side by side (50/50) underneath, and the map (+ Street View)
          full width at the bottom. The Big/Small Map toggle only changes the
          page shell's width cap (full vs ~1040px) — never this structure. */}
      <div className="flex flex-col gap-4">

        {/* Cadastral data — full width, explicit 4-column / 3-row grid. Every
            field is pinned with row-start/col-start (rather than relying on
            grid auto-placement) so hidden fields (Tarla/Sola + Parcela on
            urban types) leave a visible gap instead of shifting later fields
            into the wrong cell. */}
        <fieldset disabled={effectiveMode === "view"}>
          <section className="rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">
              {t("sections.cadastral")}
            </h2>
            <div className="grid grid-cols-4 gap-2">
              {/* Row 1: Code · Parcela · Tarla/Sola · Nickname */}
              {propertyCode && (
                <div className="row-start-1 col-start-1">
                  <ReadOnlyField label={t("fields.code")} value={propertyCode} />
                </div>
              )}
              {/* Slice #19.02: Tarla/Parcela hidden for urban property types —
                  Code and Nickname stay pinned to columns 1 and 4, leaving a
                  visible gap in columns 2-3 rather than collapsing together. */}
              {!typeConfig.hideTarlaParcela && (
                <>
                  <div className="row-start-1 col-start-2">
                    <Field
                      label={t("fields.parcela")}
                      name="parcela"
                      register={register}
                      error={errors.parcela?.message}
                      highlight={displayHighlights?.property.parcela}
                    />
                  </div>
                  {/* Slice #18.16.VL: was free-text Field; now a lookup dropdown */}
                  <div className="row-start-1 col-start-3">
                    {/* Slice #32.13: allowUnlistedValue, because tarla is free
                        text and not an FK — a property can hold a tarla
                        `lookup_tarla` has never had, and it must be shown
                        rather than blanked. */}
                    <SelectField
                      label={t("fields.tarlaSola")}
                      name="tarlaSola"
                      register={register}
                      control={control}
                      allowUnlistedValue
                      error={errors.tarlaSola?.message}
                      options={tarlaSolaOptions}
                      highlight={displayHighlights?.property.tarlaSola}
                    />
                  </div>
                </>
              )}
              <div className="row-start-1 col-start-4">
                <Field
                  label={t("fields.nickname")}
                  name="nickname"
                  register={register}
                  error={errors.nickname?.message}
                  highlight={displayHighlights?.property.nickname}
                />
              </div>

              {/* Row 2: Official Surface Area · Calculated Area · Carte Funciara · Cadastral No. */}
              <div className="row-start-2 col-start-1">
                <Field
                  label={t("fields.surfaceAreaMp")}
                  name="surfaceAreaMp"
                  type="number"
                  register={register}
                  error={errors.surfaceAreaMp?.message}
                  highlight={displayHighlights?.property.surfaceAreaMp}
                />
              </div>
              {/* Slice #18.09: system-computed area from the corners — read-only,
                  live (not registered with RHF). Blank until 3+ corners exist. */}
              <div className="row-start-2 col-start-2">
                <ReadOnlyField
                  label={t("fields.calculatedAreaMp")}
                  value={calculatedAreaDisplay}
                  hint={<HelpHint hintKey="calculated-area-auto" />}
                />
                {/* Slice #32.14: the marker sits under the number it explains,
                    because the number is the only symptom the user ever saw. */}
                {cornersSelfIntersect && (
                  <div className="mt-1 flex flex-wrap items-center gap-2 pl-[6.5rem]">
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
              </div>
              <div className="row-start-2 col-start-3">
                <Field
                  label={t("fields.carteFunciara")}
                  name="carteFunciara"
                  register={register}
                  error={errors.carteFunciara?.message}
                  highlight={displayHighlights?.property.carteFunciara}
                />
              </div>
              <div className="row-start-2 col-start-4">
                <Field
                  label={t("fields.cadastralNumber")}
                  name="cadastralNumber"
                  register={register}
                  error={errors.cadastralNumber?.message}
                  highlight={displayHighlights?.property.cadastralNumber}
                />
              </div>

              {/* Row 3: Use Category · Property Type · Notes (double width) */}
              <div className="row-start-3 col-start-1">
                <SelectField
                  label={t("fields.useCategory")}
                  name="useCategoryId"
                  register={register}
                  control={control}
                  error={errors.useCategoryId?.message}
                  options={useCategoryOptions}
                  highlight={displayHighlights?.property.useCategoryId}
                />
              </div>
              <div className="row-start-3 col-start-2">
                <SelectField
                  label={t("fields.propertyType")}
                  name="propertyTypeId"
                  register={register}
                  control={control}
                  error={errors.propertyTypeId?.message}
                  options={propertyTypeOptions}
                  highlight={displayHighlights?.property.propertyTypeId}
                />
              </div>
              <div className="row-start-3 col-start-3 col-span-2">
                <TextAreaField
                  label={t("fields.notes")}
                  name="notes"
                  register={register}
                  error={errors.notes?.message}
                  maxLength={300}
                  highlight={displayHighlights?.property.notes}
                />
              </div>
            </div>
          </section>
        </fieldset>

        {/* Corners (left) + Address (right) — 50/50 under Cadastral. Corners
            stays OUTSIDE any disabled <fieldset> (a disabled fieldset disables
            EVERY descendant control, including the version ◀/▶ nav buttons
            that live inside CornersManager's toolbar — Slice #18.02 pitfall
            #4); it enforces its own read-only state via the readOnly prop
            instead. Address keeps its own fieldset so it still locks in
            read-only historical versions. When Address is hidden (Slice
            #19.02, agricultural/forest types), Corners stays at its normal
            half-width slot rather than expanding into the gap. */}
        <div className="flex flex-row flex-wrap gap-4 items-start">

          {/* Corners table. Bug 1: a red pulse ring on the whole card flags a
              corner change in the just-navigated-to latest version (the
              interactive table can't show the historical per-row diff). */}
          <div className="flex-1 min-w-[320px]">
            <section
              className={[
                "rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900",
                cornersPulse ? "ga-vpulse-red" : "",
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
                streetView={showStreetView && !typeConfig.hideStreetView}
                onToggleStreetView={typeConfig.hideStreetView ? undefined : handleToggleStreetView}
                showAngles={showAngles}
                onToggleAngles={() => setShowAngles((v) => !v)}
                cornerDiff={cornerDiff ?? undefined}
              />
            </section>
          </div>

          {/* Address — Slice #19.02: hidden for agricultural / forest types. */}
          {!typeConfig.hideAddress && (
            <fieldset disabled={effectiveMode === "view"} className="flex-1 min-w-[320px]">
              <section className="rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">
                  {t("sections.address")}
                </h2>
                {/* Stacked within the half-width column: street + notes
                    full-width, then postal/city and county/country in 2-col pairs. */}
                <div className="flex flex-col gap-2">
                  <Field
                    label={t("address.streetLine")}
                    name="address.streetLine"
                    register={register}
                    error={errors.address?.streetLine?.message}
                    highlight={displayHighlights?.address.streetLine}
                  />
                  {/* Slice #18.12: Street View address — only the street line may
                      differ from the document-derived one above; the shared
                      postal/locality/county/country fields below apply to both.
                      The Fetch button reverse-geocodes the corners' centroid. In a
                      read-only historical version the whole address fieldset is
                      disabled, which also disables this button. */}
                  <label className="flex items-start gap-2 text-sm">
                    <span className="w-24 shrink-0 pt-1 font-medium text-ink dark:text-zinc-300">
                      {t("streetViewAddress.label")}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          {...register("address.streetViewStreetLine")}
                          className={[
                            "min-w-0 flex-1 rounded-md border bg-white px-2 py-1 shadow-sm focus:outline-none disabled:bg-canvas disabled:text-fade disabled:cursor-default dark:bg-zinc-950 dark:disabled:bg-zinc-800",
                            "border-wire focus:border-focus dark:border-zinc-700",
                            highlightRingClass(displayHighlights?.address.streetViewStreetLine, pulsing),
                          ].join(" ")}
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
                          className={buttonClass({ variant: "secondary", size: "xs" })}
                        >
                          {fetchingStreetView
                            ? t("streetViewAddress.fetching")
                            : t("streetViewAddress.fetch")}
                        </button>
                        <HelpHint hintKey="street-view-fetch-address" />
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
                    </div>
                  </label>
                  <Field
                    label={t("address.notes")}
                    name="address.notes"
                    register={register}
                    error={errors.address?.notes?.message}
                    highlight={displayHighlights?.address.notes}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Field
                      label={t("address.postalCode")}
                      name="address.postalCode"
                      register={register}
                      error={errors.address?.postalCode?.message}
                      highlight={displayHighlights?.address.postalCode}
                    />
                    <Field
                      label={t("address.locality")}
                      name="address.locality"
                      register={register}
                      error={errors.address?.locality?.message}
                      highlight={displayHighlights?.address.locality}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field
                      label={t("address.county")}
                      name="address.county"
                      register={register}
                      error={errors.address?.county?.message}
                      highlight={displayHighlights?.address.county}
                    />
                    <Field
                      label={t("address.country")}
                      name="address.country"
                      register={register}
                      error={errors.address?.country?.message}
                      highlight={displayHighlights?.address.country}
                    />
                  </div>
                </div>
              </section>
            </fieldset>
          )}

        </div>{/* end Corners + Address row */}

        {/* Map — full width. Always 440px tall; the "Hartă extinsă" button
            opens a full-screen theater overlay instead of changing this
            layout. */}
        <div
          className="relative rounded-md border border-card-rim overflow-hidden dark:border-zinc-800"
          style={{ height: "440px" }}
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
              />
            </ErrorBoundary>
          </div>
        </div>
        {/* Slice #18.03b: Street View panel — mounted only while open so the
            (billed) panorama and Street View library never load on property
            open. Full width, directly under the map. */}
        {showStreetView && !typeConfig.hideStreetView && (
          <div className="rounded-md border border-card-rim overflow-hidden dark:border-zinc-800" style={{ height: "360px" }}>
            <ErrorBoundary fallback={<PanelError>{tShared("errorBoundary.streetView")}</PanelError>}>
              <StreetViewPanel centroid={streetViewCentroid} />
            </ErrorBoundary>
          </div>
        )}

      </div>{/* end Slice #21.05.misc layout */}

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
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-1.5 rounded-md border border-wire bg-white px-5 py-2 text-[0.9375rem] font-semibold text-navy shadow-sm hover:bg-canvas dark:border-zinc-700 dark:bg-zinc-900 dark:text-blue-300 dark:hover:bg-zinc-800"
            >
              <NavArrowIcon dir="left" />
              <span>{tShared("readonlyView.backToList")}</span>
            </button>
            {/* Slice #32.15: on an older version this button used to be drawn,
                clickable and inert — setAssociatedEditing cannot beat !isOnLatest
                in the effectiveMode ternary above, so nothing unlocked. It is now
                disabled, and carries the reason in its title. */}
            <button
              type="button"
              onClick={() => setAssociatedEditing(true)}
              disabled={!isOnLatest}
              title={!isOnLatest ? tShared("readonlyView.modifyNeedsLatest") : undefined}
              className={buttonClass({ variant: "secondary", size: "lg" })}
            >
              {t("buttons.modify")}
            </button>
          </div>
        )
      ) : mode === "view" ? (
        <div className="flex items-center justify-between border-t border-crease pt-6 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 rounded-md border border-wire bg-white px-5 py-2 text-[0.9375rem] font-semibold text-navy shadow-sm hover:bg-canvas dark:border-zinc-700 dark:bg-zinc-900 dark:text-blue-300 dark:hover:bg-zinc-800"
          >
            <NavArrowIcon dir="left" />
            <span>{tShared("readonlyView.backToList")}</span>
          </button>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saveDisabled}
              className={buttonClass({ variant: "primary", size: "lg" })}
            >
              {t("buttons.save")}
            </button>
            <button
              type="button"
              onClick={() => setShowCannotDelete(true)}
              disabled={submitting}
              className={buttonClass({ variant: "danger", size: "lg" })}
            >
              {t("buttons.delete")}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-3 border-t border-crease pt-6 dark:border-zinc-800">
          <button
            type="submit"
            disabled={saveDisabled}
            className={buttonClass({ variant: "primary", size: "lg" })}
          >
            {t("buttons.save")}
          </button>
          {effectiveMode === "edit" && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={submitting}
              className={buttonClass({ variant: "danger", size: "lg" })}
            >
              {t("buttons.delete")}
            </button>
          )}
          <button
            type="button"
            onClick={() => router.push("/properties")}
            disabled={submitting}
            className={buttonClass({ variant: "secondary", size: "lg" })}
          >
            {t("buttons.cancel")}
          </button>
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
          body={t("makeCurrent.body", {
            viewed: effectiveVersion ?? 0,
            next: makeCurrentNextNumber,
          })}
          yesLabel={t("makeCurrent.ok")}
          noLabel={t("makeCurrent.cancel")}
          onYes={handleMakeCurrent}
          onNo={() => setConfirmMakeCurrent(false)}
          busy={submitting}
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
};

function Field({ label, name, type = "text", register, error, hint, highlight }: FieldProps) {
  const ring = usePulseRing(highlight);
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="w-24 shrink-0 font-medium text-ink dark:text-zinc-300">{label}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <input
          type={type}
          {...register(name)}
          aria-invalid={error ? true : undefined}
          className={[
            "w-full rounded-md border bg-white px-2 py-1 shadow-sm focus:outline-none disabled:bg-canvas disabled:text-fade disabled:cursor-default dark:bg-zinc-950 dark:disabled:bg-zinc-800",
            error
              ? "border-red-500 focus:border-red-600"
              : "border-wire focus:border-focus dark:border-zinc-700",
            ring,
          ].join(" ")}
        />
        {hint && !error && (
          <span className="text-xs text-fade dark:text-zinc-400">{hint}</span>
        )}
        {error && (
          <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
        )}
      </div>
    </label>
  );
}

function TextAreaField({
  label,
  name,
  register,
  error,
  maxLength,
  highlight,
}: FieldProps & { maxLength?: number }) {
  const ring = usePulseRing(highlight);
  return (
    <label className="flex items-start gap-2 text-sm">
      <span className="w-24 shrink-0 pt-1 font-medium text-ink dark:text-zinc-300">{label}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <textarea
          {...register(name)}
          maxLength={maxLength}
          rows={3}
          aria-invalid={error ? true : undefined}
          className={[
            "w-full rounded-md border bg-white px-2 py-1 shadow-sm focus:outline-none disabled:bg-canvas disabled:text-fade disabled:cursor-default dark:bg-zinc-950 dark:disabled:bg-zinc-800",
            error
              ? "border-red-500 focus:border-red-600"
              : "border-wire focus:border-focus dark:border-zinc-700",
            ring,
          ].join(" ")}
        />
        {error && (
          <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
        )}
      </div>
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
  allowUnlistedValue,
  highlight,
}: FieldProps & {
  control: Control<FormValues>;
  options: { value: string; label: string }[];
  allowUnlistedValue?: boolean;
}) {
  const ring = usePulseRing(highlight);
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="w-24 shrink-0 font-medium text-ink dark:text-zinc-300">{label}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
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
          allowUnlistedValue={allowUnlistedValue}
          aria-invalid={error ? true : undefined}
          className={[
            "w-full rounded-md border bg-white px-2 py-1 shadow-sm focus:outline-none disabled:bg-canvas disabled:text-fade disabled:cursor-default dark:bg-zinc-950 dark:disabled:bg-zinc-800",
            error
              ? "border-red-500 focus:border-red-600"
              : "border-wire focus:border-focus dark:border-zinc-700",
            ring,
          ].join(" ")}
        />
        {error && (
          <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
        )}
      </div>
    </label>
  );
}

function ReadOnlyField({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  /** Optional <HelpHint> — most callers have no hidden behaviour to explain. */
  hint?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-24 shrink-0 font-medium text-ink dark:text-zinc-300 flex items-center gap-1">
        {label}
        {hint}
      </span>
      <div className="flex-1 rounded-md border border-wire bg-canvas px-2 py-1 font-mono text-sm text-ink dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
        {value}
      </div>
    </div>
  );
}

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
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-sm rounded-lg bg-card p-6 shadow-xl dark:bg-zinc-900">
        <h3 id="confirm-title" className="text-base font-semibold text-ink dark:text-zinc-100">
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
