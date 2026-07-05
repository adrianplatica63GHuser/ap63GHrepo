"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  type FieldPath,
  type UseFormRegister,
  useForm,
} from "react-hook-form";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import type { PropertySnapshot } from "@/lib/properties/validation";
import { shoelaceAreaM2 } from "@/lib/properties/area";
import { cornersToS70Key, wgs84ToStereo70Batch } from "@/lib/geo/convert-client";
import { streetLineFromGeocodeResult } from "@/lib/geo/reverse-geocode";
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
import { PropertyMiniMap } from "./property-mini-map";
import { StreetViewPanel } from "./street-view-panel";
import { VersionNavControls } from "@/components/version-nav-controls";
import { FieldPulseContext, usePulseRing } from "@/components/versioning/field-pulse";
import { highlightRingClass } from "@/lib/versioning/highlight-ring";

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

type GroupTag = { code: string; position: number };

type Props = {
  mode:              "create" | "edit" | "view";
  propertyId?:       string;
  propertyCode?:     string;
  initialValues?:    FormValues;
  initialCorners?:   Corner[];
  groupTags?:        GroupTag[];
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
  groupTags = [],
  onBigMapChange,
  versionNavSlot,
}: Props) {
  const t  = useTranslations("property");
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
  const [bigMap,           setBigMap]           = useState(false);
  const [showStreetView,   setShowStreetView]   = useState(false);
  const [showAngles,       setShowAngles]       = useState(false);

  // Slice #18.UX.04: remembers whether Street View was open before Big Map
  // hid it, so switching back to the small map can auto-restore it.
  const streetViewBeforeBigRef = useRef(false);

  const handleToggleBigMap = () => {
    const next = !bigMap;
    setBigMap(next);
    onBigMapChange?.(next);
    if (next) {
      // Entering Big Map: remember Street View's state, then hide it (the big
      // map takes over the right column) — mirrors a manual "Hide Street View".
      streetViewBeforeBigRef.current = showStreetView;
      setShowStreetView(false);
    } else {
      // Returning to the small map: auto-restore Street View if it was open
      // before (or if it was manually turned on while in Big Map).
      setShowStreetView((cur) => cur || streetViewBeforeBigRef.current);
    }
  };

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

  // Slice #18.01: read via form.watch() (subscribes to value changes) so the
  // create gate and the edit-dirty check below recompute on every keystroke.
  // form.watch() is intentionally not memoizable; this is the documented usage.
  // eslint-disable-next-line react-hooks/incompatible-library
  const watchedValues = form.watch();
  const isCreate = mode === "create";

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
  // (or stays "view" if opened read-only). Create mode is unaffected.
  const effectiveMode: "create" | "edit" | "view" =
    isCreate ? "create" : isOnLatest ? mode : "view";

  const createHasData = isCreate && hasFormData(watchedValues, corners);

  // Has the editable latest copy diverged from the loaded baseline?
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
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      // An expired session is redirected to /sign-in by the auth middleware;
      // fetch silently follows that redirect and yields a 200 (the sign-in
      // HTML), which would otherwise look like a successful save and lose the
      // change. Treat any redirected response as an auth failure so the user
      // gets a clear "sign in again" message instead of a silent no-op.
      if (res.redirected) {
        throw new Error(t("saveErrorSession"));
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `${t("saveError")} (HTTP ${res.status})`);
      }
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

  const { register, formState } = form;
  const errors = formState.errors;

  return (
    <FieldPulseContext.Provider value={pulsing}>
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
      noValidate
    >
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
              prevVersion:     t("corners.prevVersion"),
              nextVersion:     t("corners.nextVersion"),
              makeCurrent:     t("corners.makeCurrent"),
              makeCurrentHint: t("corners.makeCurrentHint"),
            }}
          />,
          versionNavSlot,
        )}

      {/* Two-column layout (Slice #18.UX.04): a frozen 540px left column
          (cadastral + address + corners table) and a right column holding the
          map + Street View. The Big/Small Map toggle only changes the page
          shell's width cap (full vs ~1040px) — never this structure. */}
      <div className="flex flex-row flex-wrap gap-4 items-start">

        {/* Left column — frozen 540px */}
        <div className="w-[540px] max-w-full flex-none flex flex-col gap-4">

          {/* Slice #18.02: the disabled fieldset wraps ONLY the editable input
              sections (cadastral + address). The corners section below is
              intentionally OUTSIDE it — a disabled <fieldset> disables EVERY
              descendant control (including the version ◀/▶ nav buttons, which
              cannot be re-enabled per-button), and CornersManager enforces its
              own read-only state via the readOnly prop. */}
          <fieldset disabled={effectiveMode === "view"} className="contents">

          {/* Cadastral data — always 2-col in the narrow (540px) left column */}
          <Section title={t("sections.cadastral")} columns={2}>
            {propertyCode && (
              <ReadOnlyField label={t("fields.code")} value={propertyCode} />
            )}
            <SelectField
              label={t("fields.propertyType")}
              name="propertyTypeId"
              register={register}
              error={errors.propertyTypeId?.message}
              options={propertyTypeOptions}
              highlight={displayHighlights?.property.propertyTypeId}
            />
            <Field
              label={t("fields.nickname")}
              name="nickname"
              register={register}
              error={errors.nickname?.message}
              highlight={displayHighlights?.property.nickname}
            />
            {/* Slice #19.02: Tarla/Parcela hidden for urban property types. */}
            {!typeConfig.hideTarlaParcela && (
              <>
                {/* Slice #18.16.VL: was free-text Field; now a lookup dropdown */}
                <SelectField
                  label={t("fields.tarlaSola")}
                  name="tarlaSola"
                  register={register}
                  error={errors.tarlaSola?.message}
                  options={tarlaSolaOptions}
                  highlight={displayHighlights?.property.tarlaSola}
                />
                <Field
                  label={t("fields.parcela")}
                  name="parcela"
                  register={register}
                  error={errors.parcela?.message}
                  highlight={displayHighlights?.property.parcela}
                />
              </>
            )}
            <Field
              label={t("fields.cadastralNumber")}
              name="cadastralNumber"
              register={register}
              error={errors.cadastralNumber?.message}
              highlight={displayHighlights?.property.cadastralNumber}
            />
            <Field
              label={t("fields.carteFunciara")}
              name="carteFunciara"
              register={register}
              error={errors.carteFunciara?.message}
              highlight={displayHighlights?.property.carteFunciara}
            />
            <SelectField
              label={t("fields.useCategory")}
              name="useCategoryId"
              register={register}
              error={errors.useCategoryId?.message}
              options={useCategoryOptions}
              highlight={displayHighlights?.property.useCategoryId}
            />
            <Field
              label={t("fields.surfaceAreaMp")}
              name="surfaceAreaMp"
              type="number"
              register={register}
              error={errors.surfaceAreaMp?.message}
              highlight={displayHighlights?.property.surfaceAreaMp}
            />
            {/* Slice #18.09: system-computed area from the corners — read-only,
                live (not registered with RHF). Blank until 3+ corners exist. */}
            <ReadOnlyField
              label={t("fields.calculatedAreaMp")}
              value={calculatedAreaDisplay}
            />
            <div className="col-span-2">
              <TextAreaField
                label={t("fields.notes")}
                name="notes"
                register={register}
                error={errors.notes?.message}
                maxLength={300}
                highlight={displayHighlights?.property.notes}
              />
            </div>
          </Section>

          {/* Address — Slice #19.02: hidden for agricultural / forest types. */}
          {!typeConfig.hideAddress && <section className="rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">
              {t("sections.address")}
            </h2>
            {/* Always stacked for the narrow (540px) left column: street + notes
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
                      className="inline-flex shrink-0 items-center rounded-md border border-wire bg-white px-2 py-1 text-xs font-medium text-ink shadow-sm hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                    >
                      {fetchingStreetView
                        ? t("streetViewAddress.fetching")
                        : t("streetViewAddress.fetch")}
                    </button>
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
          </section>}
          </fieldset>{/* end editable-inputs fieldset (cadastral + address) */}

          {/* Corners table — OUTSIDE the disabled fieldset. The map and Street
              View now live in the right column; only the table stays here.
              Bug 1: a red pulse ring on the whole card flags a corner change in
              the just-navigated-to latest version (the interactive table can't
              show the historical per-row diff). */}
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
              {/* Slice #18.07: group membership badges — [code position], up to 3. */}
              {groupTags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  {groupTags.map((g) => (
                    <span
                      key={g.code}
                      title={t("groupBadgeTitle", { code: g.code, position: g.position })}
                      className="rounded border border-cta/40 bg-cta-pale px-1.5 py-0.5 font-mono text-xs font-medium text-cta dark:border-cta/30 dark:bg-cta/10"
                    >
                      [{g.code} {String(g.position).padStart(2, "0")}]
                    </span>
                  ))}
                </div>
              )}
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

        </div>{/* end left column */}

        {/* Right column — map + Street View. The Big/Small Map toggle only
            changes the map height (and the shell's container width cap); the
            column is flex-1 in both modes, so its on-screen width follows the
            shell's max-width (≈480px capped vs full-width). */}
        <div className="flex-1 min-w-[320px] flex flex-col gap-4">
          <div
            className="relative rounded-md border border-card-rim overflow-hidden dark:border-zinc-800"
            style={{ height: bigMap ? "calc(100vh - 220px)" : "440px" }}
          >
            <div className="absolute inset-0">
              <PropertyMiniMap
                corners={corners}
                onChange={setCorners}
                readOnly={effectiveMode === "view"}
                hoveredCornerIdx={hoveredCornerIdx}
                onCornerHover={setHoveredCornerIdx}
                showAngles={showAngles}
              />
            </div>
          </div>
          {/* Slice #18.03b: Street View panel — mounted only while open so the
              (billed) panorama and Street View library never load on property
              open. */}
          {showStreetView && !typeConfig.hideStreetView && (
            <div className="rounded-md border border-card-rim overflow-hidden dark:border-zinc-800" style={{ height: "360px" }}>
              <StreetViewPanel centroid={streetViewCentroid} />
            </div>
          )}
        </div>

      </div>{/* end two-column layout */}

      {submitError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {submitError}
        </p>
      )}

      {/* Action buttons — hidden in view mode (incl. any read-only historical version) */}
      {effectiveMode !== "view" && (
        <div className="flex items-center justify-center gap-3 border-t border-crease pt-6 dark:border-zinc-800">
          <button
            type="submit"
            disabled={saveDisabled}
            className="inline-flex items-center rounded-md bg-cta px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-cta-d disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("buttons.save")}
          </button>
          {effectiveMode === "edit" && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={submitting}
              className="inline-flex items-center rounded-md border border-wire bg-white px-5 py-2 text-sm font-medium text-red-600 shadow-sm hover:bg-red-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-red-950/30"
            >
              {t("buttons.delete")}
            </button>
          )}
          <button
            type="button"
            onClick={() => router.push("/properties")}
            disabled={submitting}
            className="inline-flex items-center rounded-md border border-wire bg-white px-5 py-2 text-sm font-medium text-ink shadow-sm hover:bg-canvas disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            {t("buttons.cancel")}
          </button>
        </div>
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
    </form>
    </FieldPulseContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Shared presentational helpers (mirrors natural-person-form pattern)
// ---------------------------------------------------------------------------

const COLUMNS_CLASS: Record<1 | 2 | 3 | 4, string> = {
  1: "grid grid-cols-1 gap-2",
  2: "grid grid-cols-1 gap-2 sm:grid-cols-2",
  3: "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid grid-cols-2 gap-2 md:grid-cols-4",
};

function Section({
  title,
  columns = 2,
  children,
}: {
  title:    string;
  columns?: 1 | 2 | 3 | 4;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">
        {title}
      </h2>
      <div className={COLUMNS_CLASS[columns]}>
        {children}
      </div>
    </section>
  );
}

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
  error,
  options,
  highlight,
}: FieldProps & { options: { value: string; label: string }[] }) {
  const ring = usePulseRing(highlight);
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="w-24 shrink-0 font-medium text-ink dark:text-zinc-300">{label}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <select
          {...register(name)}
          aria-invalid={error ? true : undefined}
          className={[
            "w-full rounded-md border bg-white px-2 py-1 shadow-sm focus:outline-none disabled:bg-canvas disabled:text-fade disabled:cursor-default dark:bg-zinc-950 dark:disabled:bg-zinc-800",
            error
              ? "border-red-500 focus:border-red-600"
              : "border-wire focus:border-focus dark:border-zinc-700",
            ring,
          ].join(" ")}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {error && (
          <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
        )}
      </div>
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-24 shrink-0 font-medium text-ink dark:text-zinc-300">{label}</span>
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
  noLabel:  string;
  onYes:    () => void;
  onNo:     () => void;
  busy:     boolean;
}) {
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
          <button
            type="button"
            onClick={onNo}
            disabled={busy}
            className="inline-flex items-center rounded-md border border-wire bg-white px-4 py-2 text-sm font-medium text-ink shadow-sm hover:bg-canvas disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            {noLabel}
          </button>
          <button
            type="button"
            onClick={onYes}
            disabled={busy}
            className="inline-flex items-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
          >
            {yesLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
