"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  type FieldPath,
  type UseFormRegister,
  useForm,
  useWatch,
  Controller,
} from "react-hook-form";
import { NavArrowIcon } from "@/components/back-arrow";
import { safeMutate } from "@/lib/api/safe-mutate";
import { PaginationControls } from "@/components/pagination-controls";
import { useUnsavedChangesGuard } from "@/components/providers/unsaved-changes-provider";
import {
  VersionNavControls,
  type VersionNavView,
} from "@/components/version-nav-controls";
import { FieldPulseContext, usePulseRing } from "@/components/versioning/field-pulse";
import { highlightRingClass } from "@/lib/versioning/highlight-ring";
import type { HighlightColor } from "@/lib/versioning/field-diff";
import type { JudicialPersonSnapshot } from "@/lib/judicial-persons/validation";
import {
  computeFieldHighlights,
  emptyFormValues,
  formSchema,
  formValuesEqual,
  type FormValues,
  type JudicialFieldHighlights,
  snapshotToFormValues,
  toApiPayload,
  versionLabelColor,
} from "./form-schema";

type Props = {
  mode: "create" | "edit" | "view";
  personId?: string;
  personCode?: string;
  initialValues?: FormValues;
  /** Slice #18.05 — header DOM node to portal the version-nav controls into. */
  versionNavSlot?: HTMLElement | null;
};

// ---------------------------------------------------------------------------
// Version history fetch (Slice #18.05)
// ---------------------------------------------------------------------------

type VersionItem = {
  versionNumber: number;
  snapshot:      JudicialPersonSnapshot;
  createdAt:     string;
};

async function fetchVersions(personId: string): Promise<VersionItem[]> {
  const res = await fetch(`/api/judicial-persons/${encodeURIComponent(personId)}/versions`);
  if (!res.ok) throw new Error(`Failed to load versions (HTTP ${res.status})`);
  const body = await res.json();
  return (body.items ?? []) as VersionItem[];
}

// ---------------------------------------------------------------------------
// Judicial Person Types dropdown — backed by Reference Data
// (lookup_judicial_person_type, Slice #15.07). Uses the SAME TanStack Query
// key (["value-list", "judicial-person-types"]) that the generic ValueListModal
// already invalidates on save/delete.
// ---------------------------------------------------------------------------

type JudicialPersonTypeOption = {
  id:   string;
  name: string;
};

async function fetchJudicialPersonTypes(): Promise<JudicialPersonTypeOption[]> {
  const res = await fetch("/api/admin/value-lists/judicial-person-types");
  if (!res.ok) throw new Error(`Failed to load judicial person types (HTTP ${res.status})`);
  const body = await res.json();
  return (body.items ?? []) as JudicialPersonTypeOption[];
}

export function JudicialPersonForm({
  mode,
  personId,
  personCode,
  initialValues,
  versionNavSlot,
}: Props) {
  const t = useTranslations("judicialPerson");
  const router = useRouter();
  const queryClient = useQueryClient();
  // Hoist here so they aren't called inside JSX (Rules of Hooks).
  const addressT = useAddressTranslations();
  const pickerT  = useContactPickerTranslations();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialValues ?? emptyFormValues,
    mode: "onChange",
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmMakeCurrent, setConfirmMakeCurrent] = useState(false);

  // Which contact-person picker is open: 1, 2, or null.
  const [pickerSlot, setPickerSlot] = useState<1 | 2 | null>(null);

  const isCreate = mode === "create";
  // Subscribe to all values so the edit-dirty check recomputes live.
  // form.watch() is intentionally not memoizable; this is the documented usage.
  // eslint-disable-next-line react-hooks/incompatible-library
  const watchedValues = form.watch();

  // Judicial Person Types — admin-managed (Slice #15.07).
  const { data: judicialPersonTypes } = useQuery({
    queryKey: ["value-list", "judicial-person-types"],
    queryFn: fetchJudicialPersonTypes,
    staleTime: 5 * 60 * 1000,
  });
  const judicialPersonTypeOptions = judicialPersonTypes ?? [];

  // --- Version history (Slice #18.05) ------------------------------------
  const versionsQuery = useQuery({
    queryKey: ["person-versions", personId],
    queryFn: () => fetchVersions(personId!),
    enabled: !isCreate && !!personId,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const versions = useMemo(() => versionsQuery.data ?? [], [versionsQuery.data]);
  const versionByNumber = useMemo(
    () => new Map(versions.map((v) => [v.versionNumber, v])),
    [versions],
  );
  const latestVersion: number | null =
    versions.length > 0 ? versions[versions.length - 1].versionNumber : null;

  const [viewingVersion, setViewingVersion] = useState<number | null>(null);
  const effectiveVersion: number | null = viewingVersion ?? latestVersion;
  const isOnLatest = latestVersion === null || effectiveVersion === latestVersion;

  const [baseline, setBaseline] = useState<{ values: FormValues }>(
    () => ({ values: initialValues ?? emptyFormValues }),
  );

  // Bug 1 (Slice #18.15.bugs): transient pulse of the latest version's
  // N-1 -> N change. Set when the user navigates onto the latest from a
  // different version (or restores via "Make current"); cleared after ~2.6s.
  const [pulse, setPulse] = useState<JudicialFieldHighlights | null>(null);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPulseRef = useRef<number | null>(null);

  const triggerLatestPulse = () => {
    if (latestVersion === null || latestVersion < 1) return;
    const curr = versionByNumber.get(latestVersion)?.snapshot;
    if (!curr) return;
    const prev = versionByNumber.get(latestVersion - 1)?.snapshot;
    setPulse(computeFieldHighlights(prev ?? null, curr));
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = setTimeout(() => setPulse(null), 3300);
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

  const effectiveMode: "create" | "edit" | "view" =
    isCreate ? "create" : isOnLatest ? mode : "view";

  const editDirty =
    !isCreate && isOnLatest && !formValuesEqual(watchedValues, baseline.values);

  const goToVersion = (target: number) => {
    const leaving = effectiveVersion;
    if (target === latestVersion) {
      form.reset(baseline.values);
      // Bug 1: arriving on the latest from a different version pulses N-1 -> N.
      if (leaving !== null && leaving !== latestVersion) triggerLatestPulse();
    } else {
      const snap = versionByNumber.get(target)?.snapshot;
      if (!snap) return;
      form.reset(snapshotToFormValues(snap));
      setPulse(null);
    }
    setViewingVersion(target);
  };

  const showHighlights =
    !isCreate && !isOnLatest && effectiveVersion !== null && effectiveVersion >= 1;
  const currSnap =
    effectiveVersion !== null ? versionByNumber.get(effectiveVersion)?.snapshot : undefined;
  const prevSnap =
    effectiveVersion !== null && effectiveVersion >= 1
      ? versionByNumber.get(effectiveVersion - 1)?.snapshot
      : undefined;
  const fieldHighlights: JudicialFieldHighlights | null =
    showHighlights && currSnap ? computeFieldHighlights(prevSnap ?? null, currSnap) : null;

  // What the fields actually frame: the historical diff on a past version, or
  // the transient pulse on the latest. `pulsing` swaps the static ring for the
  // animated pulse class (Bug 1).
  const displayHighlights: JudicialFieldHighlights | null = fieldHighlights ?? pulse;
  const pulsing = fieldHighlights === null && pulse !== null;

  const navLocked = isOnLatest && editDirty;
  const versionNav: VersionNavView | null =
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
          canMakeCurrent: !isOnLatest,
          onMakeCurrent: () => setConfirmMakeCurrent(true),
        }
      : null;

  const makeCurrentNextNumber = (latestVersion ?? 0) + 1;

  const saveDisabled =
    submitting ||
    !form.formState.isValid ||
    (mode === "edit" && isOnLatest && !editDirty);

  const doSave = async (values: FormValues): Promise<boolean> => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = toApiPayload(values);
      const url =
        mode === "create"
          ? "/api/judicial-persons"
          : `/api/judicial-persons/${encodeURIComponent(personId!)}`;
      const method = mode === "create" ? "POST" : "PATCH";
      await safeMutate(
        url,
        { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
        t,
      );
      await queryClient.invalidateQueries({ queryKey: ["judicial-persons"] });
      // The unified /persons list (Slice #15.09) caches under ["persons"];
      // invalidate it too so a created/edited/deleted person shows without a
      // manual browser refresh (Slice #18.13).
      await queryClient.invalidateQueries({ queryKey: ["persons"] });
      // Slice #18.05: a save appended a new version — refresh the nav.
      await queryClient.invalidateQueries({ queryKey: ["person-versions"] });
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
      router.push("/judicial-persons");
      router.refresh();
      return;
    }

    // Slice #18.05: edit mode stays on the person so the freshly-appended
    // version is visible.
    setBaseline({ values });
    setViewingVersion(null);
    router.refresh();
  };

  const handleMakeCurrent = async () => {
    const values = form.getValues();
    const ok = await doSave(values);
    if (!ok) {
      setConfirmMakeCurrent(false);
      return;
    }
    // Bug 1: pulse the restored change once the new version refetches in.
    pendingPulseRef.current = makeCurrentNextNumber;
    setBaseline({ values });
    setViewingVersion(null);
    setConfirmMakeCurrent(false);
    router.refresh();
  };

  useUnsavedChangesGuard({
    isDirty:
      effectiveMode === "view"
        ? false
        : isCreate
          ? form.formState.isDirty
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
        `/api/judicial-persons/${encodeURIComponent(personId!)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body?.error ?? `${t("deleteError")} (HTTP ${res.status})`,
        );
      }
      await queryClient.invalidateQueries({ queryKey: ["judicial-persons"] });
      // The unified /persons list (Slice #15.09) caches under ["persons"];
      // invalidate it too so a created/edited/deleted person shows without a
      // manual browser refresh (Slice #18.13).
      await queryClient.invalidateQueries({ queryKey: ["persons"] });
      router.push("/judicial-persons");
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
      setConfirmDelete(false);
    }
  };

  const onCancel = () => {
    router.push("/judicial-persons");
  };

  const { register, formState, control, setValue, getValues } = form;
  const errors = formState.errors;

  // Is CUI already set? Show lock hint in edit mode.
  const cuiIsLocked =
    mode === "edit" && Boolean(initialValues?.cuiNumber?.trim());

  // Watch the "same as" flag so the correspondence block reacts live.
  const correspondenceSameAsHq = useWatch({ control, name: "correspondenceSameAsHq" });

  const handleContactPersonSelected = (slot: 1 | 2, id: string, name: string) => {
    if (slot === 1) {
      setValue("contactPerson1Id", id, { shouldDirty: true, shouldValidate: true });
      setValue("contactPerson1Name", name, { shouldDirty: true });
    } else {
      setValue("contactPerson2Id", id, { shouldDirty: true, shouldValidate: true });
      setValue("contactPerson2Name", name, { shouldDirty: true });
    }
    setPickerSlot(null);
  };

  const handleClearContactPerson = (slot: 1 | 2) => {
    if (slot === 1) {
      setValue("contactPerson1Id", "", { shouldDirty: true, shouldValidate: true });
      setValue("contactPerson1Name", "", { shouldDirty: true });
    } else {
      setValue("contactPerson2Id", "", { shouldDirty: true, shouldValidate: true });
      setValue("contactPerson2Name", "", { shouldDirty: true });
    }
  };

  return (
    <FieldPulseContext.Provider value={pulsing}>
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
      noValidate
    >
      {/* Slice #18.05: version controls portalled onto the person-name line. */}
      {versionNavSlot && versionNav &&
        createPortal(
          <VersionNavControls
            nav={versionNav}
            labels={{
              versionLabel:    t("version.label", { n: versionNav.current }),
              historyChip:     t("version.historyChip", { n: versions.length }),
              prevVersion:     t("version.prev"),
              nextVersion:     t("version.next"),
              makeCurrent:     t("version.makeCurrent"),
              makeCurrentHint: t("version.makeCurrentHint"),
            }}
          />,
          versionNavSlot,
        )}

      <fieldset disabled={effectiveMode === "view"} className="flex flex-col gap-4 border-0 m-0 p-0 min-w-0">

      {/* Judicial Person identity section */}
      <section className="rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">
          {t("sections.identity")}
        </h2>
        <div className="flex flex-col gap-2">
          {/* Row 1: Name | Nickname */}
          <div className="grid grid-cols-2 gap-2">
            <Field
              label={t("fields.name")}
              name="name"
              register={register}
              error={errors.name?.message}
              highlight={displayHighlights?.fields.name}
            />
            <Field
              label={t("fields.nickname")}
              name="nickname"
              register={register}
              error={errors.nickname?.message}
              highlight={displayHighlights?.fields.nickname}
            />
          </div>
          {/* Row 2: ID (edit/view) | Type */}
          <div className="grid grid-cols-2 gap-2">
            {mode !== "create" && personCode && (
              <ReadOnlyField label={t("fields.code")} value={personCode} />
            )}
            <SelectField
              label={t("fields.judicialType")}
              name="judicialPersonTypeId"
              register={register}
              error={errors.judicialPersonTypeId?.message}
              options={[
                { value: "", label: "—" },
                ...judicialPersonTypeOptions.map((opt) => ({
                  value: opt.id,
                  label: opt.name,
                })),
              ]}
              highlight={displayHighlights?.fields.judicialPersonTypeId}
            />
          </div>
          {/* Row 3: CUI | Trade Register No. */}
          <div className="grid grid-cols-2 gap-2">
            <Field
              label={t("fields.cuiNumber")}
              name="cuiNumber"
              register={register}
              error={errors.cuiNumber?.message}
              hint={cuiIsLocked ? t("hints.cuiLocked") : undefined}
              highlight={displayHighlights?.fields.cuiNumber}
            />
            <Field
              label={t("fields.tradeRegisterNumber")}
              name="tradeRegisterNumber"
              register={register}
              error={errors.tradeRegisterNumber?.message}
              highlight={displayHighlights?.fields.tradeRegisterNumber}
            />
          </div>
          {/* Row 4: Notes */}
          <div className="grid grid-cols-2 gap-2">
            <Field
              label={t("fields.notes")}
              name="notes"
              register={register}
              error={errors.notes?.message}
              highlight={displayHighlights?.fields.notes}
            />
          </div>
        </div>
      </section>

      {/* ── Contact Persons ──────────────────────────────────────────────── */}
      <section className="rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">
          {t("sections.contactPersons")}
        </h2>
        <div className="flex flex-col gap-3">
          <ContactPersonRow
            label={t("fields.contactPerson1")}
            slot={1}
            control={control}
            mode={effectiveMode}
            onAdd={() => setPickerSlot(1)}
            onClear={() => handleClearContactPerson(1)}
            addLabel={t("actions.addContactPerson")}
            removeLabel={t("actions.removeContactPerson")}
            highlight={displayHighlights?.fields.contactPerson1Id}
          />
          <ContactPersonRow
            label={t("fields.contactPerson2")}
            slot={2}
            control={control}
            mode={effectiveMode}
            onAdd={() => setPickerSlot(2)}
            onClear={() => handleClearContactPerson(2)}
            addLabel={t("actions.addContactPerson")}
            removeLabel={t("actions.removeContactPerson")}
            highlight={displayHighlights?.fields.contactPerson2Id}
          />
          {/* Note: person must exist in system first */}
          <p className="text-xs text-fade dark:text-zinc-500 italic">
            {t("hints.contactPersonNotInSystem")}
          </p>
        </div>
      </section>

      {/* ── Registered Address ──────────────────────────────────────────────── */}
      <section className="rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">
          {t("sections.registeredAddress")}
        </h2>
        <AddressFields
          prefix="addresses.HEADQUARTERS"
          register={register}
          errors={errors.addresses?.HEADQUARTERS}
          t={addressT}
          highlights={displayHighlights?.addresses.HEADQUARTERS}
        />
      </section>

      {/* "Same as registered address" checkbox — between the two address cards */}
      <div className="flex items-center gap-2 px-1">
        <Controller
          control={control}
          name="correspondenceSameAsHq"
          render={({ field }) => (
            <label
              className={[
                "flex cursor-pointer items-center gap-2 rounded-md text-sm text-fade dark:text-zinc-400 select-none",
                displayHighlights?.fields.correspondenceSameAsHq
                  ? "px-1 " +
                    highlightRingClass(
                      displayHighlights.fields.correspondenceSameAsHq,
                      pulsing,
                    )
                  : "",
              ].join(" ")}
            >
              <input
                type="checkbox"
                checked={field.value}
                onChange={(e) => {
                  field.onChange(e.target.checked);
                  // When toggling to "same", copy HQ into correspondence so
                  // there's no stale data sitting in the hidden inputs.
                  if (e.target.checked) {
                    const hq = getValues("addresses.HEADQUARTERS");
                    setValue("addresses.CORRESPONDENCE", { ...hq }, { shouldDirty: true });
                  }
                }}
                className="accent-cta"
                aria-label={t("fields.sameAsRegistered")}
              />
              {t("fields.sameAsRegistered")}
            </label>
          )}
        />
      </div>

      {/* ── Correspondence Address — only when not same as registered ──────── */}
      {!correspondenceSameAsHq && (
        <section className="rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">
            {t("sections.correspondenceAddress")}
          </h2>
          <AddressFields
            prefix="addresses.CORRESPONDENCE"
            register={register}
            errors={errors.addresses?.CORRESPONDENCE}
            t={addressT}
            highlights={displayHighlights?.addresses.CORRESPONDENCE}
          />
        </section>
      )}

      </fieldset>{/* end disabled fieldset */}

      {submitError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {submitError}
        </p>
      )}

      <div className="flex items-center justify-center gap-3 border-t border-crease pt-6 dark:border-zinc-800">
        {mode === "view" ? (
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 rounded-md border border-wire bg-white px-5 py-2 text-[0.9375rem] font-semibold text-navy shadow-sm hover:bg-canvas dark:border-zinc-700 dark:bg-zinc-900 dark:text-blue-300 dark:hover:bg-zinc-800"
          >
            <NavArrowIcon dir="left" />
            <span>{t("buttons.cancel")}</span>
          </button>
        ) : effectiveMode === "view" ? null : (
          <>
            <button
              type="submit"
              disabled={saveDisabled}
              className="inline-flex items-center rounded-md bg-cta px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-cta-d disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("buttons.save")}
            </button>
            {mode === "edit" && (
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
              onClick={onCancel}
              disabled={submitting}
              className="inline-flex items-center rounded-md border border-wire bg-white px-5 py-2 text-sm font-medium text-ink shadow-sm hover:bg-canvas disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            >
              {t("buttons.cancel")}
            </button>
          </>
        )}
      </div>

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

      {/* Contact Person Picker modal */}
      {pickerSlot !== null && (
        <ContactPersonPickerDialog
          slot={pickerSlot}
          onSelect={handleContactPersonSelected}
          onClose={() => setPickerSlot(null)}
          t={pickerT}
        />
      )}
    </form>
    </FieldPulseContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// ContactPersonRow — single row in the Contact Persons panel
// ---------------------------------------------------------------------------

function ContactPersonRow({
  label,
  slot,
  control,
  mode,
  onAdd,
  onClear,
  addLabel,
  removeLabel,
  highlight,
}: {
  label: string;
  slot: 1 | 2;
  control: ReturnType<typeof useForm<FormValues>>["control"];
  mode: "create" | "edit" | "view";
  onAdd: () => void;
  onClear: () => void;
  addLabel: string;
  removeLabel: string;
  highlight?: HighlightColor;
}) {
  const idField   = slot === 1 ? "contactPerson1Id"   : "contactPerson2Id";
  const nameField = slot === 1 ? "contactPerson1Name" : "contactPerson2Name";

  const personId   = useWatch({ control, name: idField });
  const personName = useWatch({ control, name: nameField });

  const hasLink = Boolean(personId);
  // Static ring on a historical version; animated pulse on the latest (Bug 1).
  const ring = usePulseRing(highlight);

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-36 shrink-0 font-medium text-ink dark:text-zinc-300">
        {label}
      </span>
      <div
        className={[
          "flex flex-1 items-center gap-2 min-w-0 rounded-md",
          highlight ? "px-1 py-0.5 " + ring : "",
        ].join(" ")}
      >
        {hasLink ? (
          <>
            <Link
              href={`/natural-persons/${encodeURIComponent(personId as string)}?readonly=true`}
              className="text-cta underline hover:text-cta-d truncate"
            >
              {(personName as string) || personId}
            </Link>
            {mode !== "view" && (
              <button
                type="button"
                onClick={onClear}
                className="shrink-0 rounded border border-wire px-2 py-0.5 text-xs text-fade hover:bg-canvas hover:text-red-600 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                {removeLabel}
              </button>
            )}
          </>
        ) : (
          mode !== "view" && (
            <button
              type="button"
              onClick={onAdd}
              className="inline-flex items-center rounded-md border border-wire bg-white px-3 py-1 text-xs font-medium text-ink shadow-sm hover:bg-canvas dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            >
              + {addLabel}
            </button>
          )
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContactPersonPickerDialog
// ---------------------------------------------------------------------------

const PICKER_PAGE_SIZE = 15;

type PersonItem = { id: string; code: string; displayName: string };
type PickerT = {
  title: string;
  labelName: string;
  namePlaceholder: string;
  labelCode: string;
  codePlaceholder: string;
  colCode: string;
  colName: string;
  loading: string;
  error: string;
  resultsEmpty: string;
  select: string;
  cancel: string;
  note: string;
};

function ContactPersonPickerDialog({
  slot,
  onSelect,
  onClose,
  t,
}: {
  slot: 1 | 2;
  onSelect: (slot: 1 | 2, id: string, name: string) => void;
  onClose: () => void;
  t: PickerT;
}) {
  const [nameInput, setNameInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string>("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["contact-person-search", nameInput, codeInput, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        type: "NATURAL",
        limit: String(PICKER_PAGE_SIZE),
        offset: String(page * PICKER_PAGE_SIZE),
      });
      if (nameInput.trim()) params.set("name", nameInput.trim());
      if (codeInput.trim()) params.set("code", codeInput.trim());
      const res = await fetch(`/api/people/search?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return { items: data.items as PersonItem[], total: data.total as number };
    },
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const handleConfirm = () => {
    if (selectedId) {
      onSelect(slot, selectedId, selectedName);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
    >
      <div className="flex w-full max-w-lg flex-col gap-4 rounded-lg bg-card p-5 shadow-xl dark:bg-zinc-900">
        <h3 className="text-base font-semibold text-ink dark:text-zinc-100">
          {t.title}
        </h3>

        {/* Search filters */}
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="w-12 shrink-0 font-medium text-ink dark:text-zinc-300">
              {t.labelName}
            </span>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => { setNameInput(e.target.value); setPage(0); setSelectedId(null); }}
              placeholder={t.namePlaceholder}
              className="w-40 rounded-md border border-wire bg-white px-2 py-1 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
              autoFocus
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="w-12 shrink-0 font-medium text-ink dark:text-zinc-300">
              {t.labelCode}
            </span>
            <input
              type="text"
              value={codeInput}
              onChange={(e) => { setCodeInput(e.target.value); setPage(0); setSelectedId(null); }}
              placeholder={t.codePlaceholder}
              className="w-32 rounded-md border border-wire bg-white px-2 py-1 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
        </div>

        {/* Results table */}
        <div className="rounded-md border border-card-rim bg-white dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden">
          {isLoading ? (
            <p className="px-4 py-5 text-sm text-fade dark:text-zinc-400">{t.loading}</p>
          ) : isError ? (
            <p className="px-4 py-5 text-sm text-red-600 dark:text-red-400">{t.error}</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-5 text-sm text-fade dark:text-zinc-400">{t.resultsEmpty}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-rim dark:border-zinc-800">
                  <th className="w-8 px-3 py-2" aria-label="select" />
                  <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400">{t.colCode}</th>
                  <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400">{t.colName}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => { setSelectedId(p.id); setSelectedName(p.displayName); }}
                    className={[
                      "cursor-pointer border-b border-card-rim last:border-0 dark:border-zinc-800",
                      selectedId === p.id
                        ? "bg-cta-pale dark:bg-cta/10"
                        : "hover:bg-canvas dark:hover:bg-zinc-800/50",
                    ].join(" ")}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="radio"
                        checked={selectedId === p.id}
                        onChange={() => { setSelectedId(p.id); setSelectedName(p.displayName); }}
                        onClick={(e) => e.stopPropagation()}
                        className="accent-cta"
                        aria-label={p.displayName}
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-fade dark:text-zinc-400">{p.code}</td>
                    <td className="px-3 py-2 font-medium text-ink dark:text-zinc-100">{p.displayName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <PaginationControls
          page={page}
          total={total}
          pageSize={PICKER_PAGE_SIZE}
          onPrev={() => setPage((p) => p - 1)}
          onNext={() => setPage((p) => p + 1)}
        />

        {/* Note */}
        <p className="text-xs text-fade dark:text-zinc-500 italic">{t.note}</p>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-crease pt-3 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center rounded-md border border-wire bg-white px-4 py-2 text-sm font-medium text-ink shadow-sm hover:bg-canvas dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedId}
            className="inline-flex items-center rounded-md bg-cta px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-cta-d disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t.select}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddressFields — inline address fields (replaces AddressBlock for this form)
// ---------------------------------------------------------------------------
//
// We can't use the shared AddressBlock component here because this form needs
// the two address blocks to live inside a single section card (Office Address)
// rather than being separate cards. So we inline the fields directly.

type AddressT = {
  streetLine: string;
  postalCode: string;
  locality: string;
  county: string;
  country: string;
  notes: string;
};

type AddressHighlights =
  | Partial<Record<"streetLine" | "postalCode" | "locality" | "county" | "country" | "notes", HighlightColor>>
  | undefined;

function AddressFields({
  prefix,
  register,
  errors,
  t,
  highlights,
}: {
  prefix: string;
  register: UseFormRegister<FormValues>;
  errors?: {
    streetLine?: { message?: string };
    postalCode?: { message?: string };
    locality?: { message?: string };
    county?: { message?: string };
    country?: { message?: string };
    notes?: { message?: string };
  };
  t: AddressT;
  highlights?: AddressHighlights;
}) {
  const f = (sub: string) =>
    `${prefix}.${sub}` as FieldPath<FormValues>;

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <Field label={t.streetLine} name={f("streetLine")} register={register} error={errors?.streetLine?.message} highlight={highlights?.streetLine} />
        <Field label={t.notes}      name={f("notes")}      register={register} error={errors?.notes?.message}      highlight={highlights?.notes} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label={t.postalCode} name={f("postalCode")} register={register} error={errors?.postalCode?.message} highlight={highlights?.postalCode} />
        <Field label={t.locality}   name={f("locality")}   register={register} error={errors?.locality?.message}   highlight={highlights?.locality} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label={t.county}  name={f("county")}  register={register} error={errors?.county?.message}  highlight={highlights?.county} />
        <Field label={t.country} name={f("country")} register={register} error={errors?.country?.message} highlight={highlights?.country} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hooks to get translation objects in a stable shape for sub-components
// ---------------------------------------------------------------------------

function useAddressTranslations(): AddressT {
  const ta = useTranslations("address");
  return {
    streetLine: ta("streetLine"),
    postalCode: ta("postalCode"),
    locality:   ta("locality"),
    county:     ta("county"),
    country:    ta("country"),
    notes:      ta("notes"),
  };
}

function useContactPickerTranslations(): PickerT {
  const t = useTranslations("judicialPerson.contactPersonPicker");
  return {
    title:           t("title"),
    labelName:       t("labelName"),
    namePlaceholder: t("namePlaceholder"),
    labelCode:       t("labelCode"),
    codePlaceholder: t("codePlaceholder"),
    colCode:         t("colCode"),
    colName:         t("colName"),
    loading:         t("loading"),
    error:           t("error"),
    resultsEmpty:    t("resultsEmpty"),
    select:          t("select"),
    cancel:          t("cancel"),
    note:            t("note"),
  };
}

// ---------------------------------------------------------------------------
// Local presentational helpers (mirrors natural-person-form pattern)
// ---------------------------------------------------------------------------

type FieldProps = {
  label: string;
  name: FieldPath<FormValues>;
  type?: string;
  register: UseFormRegister<FormValues>;
  error?: string;
  hint?: string;
  highlight?: HighlightColor;
};

function Field({
  label,
  name,
  type = "text",
  register,
  error,
  hint,
  highlight,
}: FieldProps) {
  const ring = usePulseRing(highlight);
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="w-36 shrink-0 font-medium text-ink dark:text-zinc-300">
        {label}
      </span>
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
          <span className="text-xs text-red-600 dark:text-red-400">
            {error}
          </span>
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
      <span className="w-36 shrink-0 font-medium text-ink dark:text-zinc-300">
        {label}
      </span>
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
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {error && (
          <span className="text-xs text-red-600 dark:text-red-400">
            {error}
          </span>
        )}
      </div>
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-36 shrink-0 font-medium text-ink dark:text-zinc-300">
        {label}
      </span>
      <div className="flex-1 rounded-md border border-wire bg-canvas px-2 py-1 font-mono text-sm text-ink dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
        {value}
      </div>
    </div>
  );
}

function ConfirmDialog({
  title,
  body,
  yesLabel,
  noLabel,
  onYes,
  onNo,
  busy,
}: {
  title: string;
  body: string;
  yesLabel: string;
  noLabel: string;
  onYes: () => void;
  onNo: () => void;
  busy: boolean;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-sm rounded-lg bg-card p-6 shadow-xl dark:bg-zinc-900">
        <h3
          id="confirm-title"
          className="text-base font-semibold text-ink dark:text-zinc-100"
        >
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
