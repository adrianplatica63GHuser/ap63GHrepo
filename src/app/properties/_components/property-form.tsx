"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  type FieldPath,
  type UseFormRegister,
  useForm,
} from "react-hook-form";
import type { PropertySnapshot } from "@/lib/properties/validation";
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
  cornersChanged,
  snapshotToCorners,
  snapshotToFormValues,
  toApiPayload,
  versionLabelColor,
} from "./form-schema";
import { CornersManager } from "./corners-manager";
import { PropertyMiniMap } from "./property-mini-map";

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

async function fetchValueList(listKey: string): Promise<LookupOption[]> {
  const res = await fetch(`/api/admin/value-lists/${listKey}`);
  if (!res.ok) throw new Error(`Failed to load ${listKey} (HTTP ${res.status})`);
  const body = await res.json();
  return (body.items ?? []) as LookupOption[];
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
  const { data: propertyTypes } = useQuery({
    queryKey: ["value-list", "property-types"],
    queryFn:  () => fetchValueList("property-types"),
    staleTime: 5 * 60 * 1000,
  });
  const { data: useCategories } = useQuery({
    queryKey: ["value-list", "use-categories"],
    queryFn:  () => fetchValueList("use-categories"),
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

  const [corners,          setCorners]          = useState<Corner[]>(initialCorners);
  const [hoveredCornerIdx, setHoveredCornerIdx] = useState<number | null>(null);
  const [submitting,       setSubmitting]       = useState(false);
  const [submitError,      setSubmitError]      = useState<string | null>(null);
  const [confirmDelete,    setConfirmDelete]    = useState(false);
  const [confirmMakeCurrent, setConfirmMakeCurrent] = useState(false);
  const [bigMap,           setBigMap]           = useState(false);

  const handleToggleBigMap = () => {
    const next = !bigMap;
    setBigMap(next);
    onBigMapChange?.(next);
  };

  // Slice #18.01: read via form.watch() (subscribes to value changes) so the
  // create gate and the edit-dirty check below recompute on every keystroke.
  const watchedValues = form.watch();
  const isCreate = mode === "create";

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
    if (target === latestVersion) {
      form.reset(baseline.values);
      setCorners(baseline.corners);
    } else {
      const snap = versionByNumber.get(target)?.snapshot;
      if (!snap) return;
      form.reset(snapshotToFormValues(snap));
      setCorners(snapshotToCorners(snap));
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
      const payload = toApiPayload(values, corners);
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
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
      noValidate
    >
      {/* Layout wrapper: flex-row in big-map mode, transparent (contents) in normal mode */}
      <div className={bigMap ? "flex flex-row gap-4 items-stretch" : "contents"}>

        {/* Left panels: transparent in normal mode, 45% fixed column in big-map mode */}
        <div className={bigMap ? "w-[540px] flex-none flex flex-col gap-4" : "contents"}>

          {/* Slice #18.02: the disabled fieldset wraps ONLY the editable input
              sections (cadastral + address). The corners section below is
              intentionally OUTSIDE it — a disabled <fieldset> disables EVERY
              descendant control (including the version ◀/▶ nav buttons, which
              cannot be re-enabled per-button), and CornersManager enforces its
              own read-only state via the readOnly prop. */}
          <fieldset disabled={effectiveMode === "view"} className="contents">

          {/* Cadastral data — 4-col normally, 2-col in big-map */}
          <Section title={t("sections.cadastral")} columns={bigMap ? 2 : 4}>
            {propertyCode && (
              <ReadOnlyField label={t("fields.code")} value={propertyCode} />
            )}
            <SelectField
              label={t("fields.propertyType")}
              name="propertyTypeId"
              register={register}
              error={errors.propertyTypeId?.message}
              options={propertyTypeOptions}
              highlight={fieldHighlights?.property.propertyTypeId}
            />
            <Field
              label={t("fields.nickname")}
              name="nickname"
              register={register}
              error={errors.nickname?.message}
              highlight={fieldHighlights?.property.nickname}
            />
            <Field
              label={t("fields.tarlaSola")}
              name="tarlaSola"
              register={register}
              error={errors.tarlaSola?.message}
              highlight={fieldHighlights?.property.tarlaSola}
            />
            <Field
              label={t("fields.parcela")}
              name="parcela"
              register={register}
              error={errors.parcela?.message}
              highlight={fieldHighlights?.property.parcela}
            />
            <Field
              label={t("fields.cadastralNumber")}
              name="cadastralNumber"
              register={register}
              error={errors.cadastralNumber?.message}
              highlight={fieldHighlights?.property.cadastralNumber}
            />
            <Field
              label={t("fields.carteFunciara")}
              name="carteFunciara"
              register={register}
              error={errors.carteFunciara?.message}
              highlight={fieldHighlights?.property.carteFunciara}
            />
            <SelectField
              label={t("fields.useCategory")}
              name="useCategoryId"
              register={register}
              error={errors.useCategoryId?.message}
              options={useCategoryOptions}
              highlight={fieldHighlights?.property.useCategoryId}
            />
            <Field
              label={t("fields.surfaceAreaMp")}
              name="surfaceAreaMp"
              type="number"
              register={register}
              error={errors.surfaceAreaMp?.message}
              highlight={fieldHighlights?.property.surfaceAreaMp}
            />
            <div className={bigMap ? "col-span-2" : "col-span-2 md:col-span-4"}>
              <TextAreaField
                label={t("fields.notes")}
                name="notes"
                register={register}
                error={errors.notes?.message}
                maxLength={300}
                highlight={fieldHighlights?.property.notes}
              />
            </div>
          </Section>

          {/* Address */}
          <section className="rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">
              {t("sections.address")}
            </h2>
            <div className="flex flex-col gap-2">
              {bigMap ? (
                <>
                  {/* Big-map: each item stacked, bottom pairs split 2+2 */}
                  <Field
                    label={t("address.streetLine")}
                    name="address.streetLine"
                    register={register}
                    error={errors.address?.streetLine?.message}
                    highlight={fieldHighlights?.address.streetLine}
                  />
                  <Field
                    label={t("address.notes")}
                    name="address.notes"
                    register={register}
                    error={errors.address?.notes?.message}
                    highlight={fieldHighlights?.address.notes}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Field
                      label={t("address.postalCode")}
                      name="address.postalCode"
                      register={register}
                      error={errors.address?.postalCode?.message}
                      highlight={fieldHighlights?.address.postalCode}
                    />
                    <Field
                      label={t("address.locality")}
                      name="address.locality"
                      register={register}
                      error={errors.address?.locality?.message}
                      highlight={fieldHighlights?.address.locality}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field
                      label={t("address.county")}
                      name="address.county"
                      register={register}
                      error={errors.address?.county?.message}
                      highlight={fieldHighlights?.address.county}
                    />
                    <Field
                      label={t("address.country")}
                      name="address.country"
                      register={register}
                      error={errors.address?.country?.message}
                      highlight={fieldHighlights?.address.country}
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* Normal: Row 1 — Street line + Notes (2 cols) */}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Field
                      label={t("address.streetLine")}
                      name="address.streetLine"
                      register={register}
                      error={errors.address?.streetLine?.message}
                      highlight={fieldHighlights?.address.streetLine}
                    />
                    <Field
                      label={t("address.notes")}
                      name="address.notes"
                      register={register}
                      error={errors.address?.notes?.message}
                      highlight={fieldHighlights?.address.notes}
                    />
                  </div>
                  {/* Normal: Row 2 — Postal Code, City, County, Country (4 cols) */}
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    <Field
                      label={t("address.postalCode")}
                      name="address.postalCode"
                      register={register}
                      error={errors.address?.postalCode?.message}
                      highlight={fieldHighlights?.address.postalCode}
                    />
                    <Field
                      label={t("address.locality")}
                      name="address.locality"
                      register={register}
                      error={errors.address?.locality?.message}
                      highlight={fieldHighlights?.address.locality}
                    />
                    <Field
                      label={t("address.county")}
                      name="address.county"
                      register={register}
                      error={errors.address?.county?.message}
                      highlight={fieldHighlights?.address.county}
                    />
                    <Field
                      label={t("address.country")}
                      name="address.country"
                      register={register}
                      error={errors.address?.country?.message}
                      highlight={fieldHighlights?.address.country}
                    />
                  </div>
                </>
              )}
            </div>
          </section>
          </fieldset>{/* end editable-inputs fieldset (cadastral + address) */}

          {/* Corners + mini-map — OUTSIDE the disabled fieldset so the version
              ◀/▶ nav buttons stay clickable on read-only historical versions;
              CornersManager enforces its own read-only state via readOnly. */}
          <section className="rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">
              {t("sections.corners")}
            </h2>
            <div className="flex flex-col gap-2">
              <CornersManager
                corners={corners}
                onChange={setCorners}
                readOnly={effectiveMode === "view"}
                hoveredCornerIdx={hoveredCornerIdx}
                onCornerHover={setHoveredCornerIdx}
                bigMap={bigMap}
                onToggleBigMap={handleToggleBigMap}
                cornerDiff={cornerDiff ?? undefined}
                versionNav={versionNav ?? undefined}
              />
              {!bigMap && (
                <div className="rounded-md border border-card-rim overflow-hidden dark:border-zinc-800" style={{ height: "360px" }}>
                  <PropertyMiniMap
                    corners={corners}
                    onChange={setCorners}
                    readOnly={effectiveMode === "view"}
                    hoveredCornerIdx={hoveredCornerIdx}
                    onCornerHover={setHoveredCornerIdx}
                  />
                </div>
              )}
            </div>
          </section>

        </div>{/* end left panels */}

        {/* Right map column — only in big-map mode */}
        {bigMap && (
          <div className="flex-1 min-w-0 relative rounded-md border border-card-rim overflow-hidden dark:border-zinc-800">
            <div className="absolute inset-0">
              <PropertyMiniMap
                corners={corners}
                onChange={setCorners}
                readOnly={effectiveMode === "view"}
                hoveredCornerIdx={hoveredCornerIdx}
                onCornerHover={setHoveredCornerIdx}
              />
            </div>
          </div>
        )}

      </div>{/* end layout wrapper */}

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

// Slice #18.02: green/red highlight frame for a field that changed in the
// version currently being viewed (green = added, red = modified/deleted).
function highlightRing(h?: HighlightColor): string {
  return h === "green"
    ? "ring-2 ring-green-500"
    : h === "red"
      ? "ring-2 ring-red-500"
      : "";
}

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
            highlightRing(highlight),
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
            highlightRing(highlight),
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
            highlightRing(highlight),
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
