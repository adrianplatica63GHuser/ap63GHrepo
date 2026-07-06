"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Controller,
  type FieldPath,
  type UseFormRegister,
  useForm,
} from "react-hook-form";
import { AddressBlock } from "@/components/address/address-block";
import { safeMutate } from "@/lib/api/safe-mutate";
import { NavArrowIcon } from "@/components/back-arrow";
import { UnsavedChangesBanner } from "@/components/unsaved-changes-banner";
import { useUnsavedChangesGuard } from "@/components/providers/unsaved-changes-provider";
import {
  VersionNavControls,
  type VersionNavView,
} from "@/components/version-nav-controls";
import { FieldPulseContext, usePulseRing } from "@/components/versioning/field-pulse";
import { highlightRingClass } from "@/lib/versioning/highlight-ring";
import type { HighlightColor } from "@/lib/versioning/field-diff";
import type { NaturalPersonSnapshot } from "@/lib/persons/validation";
import {
  computeFieldHighlights,
  emptyFormValues,
  formSchema,
  formValuesEqual,
  type FormValues,
  type NaturalFieldHighlights,
  snapshotToFormValues,
  toApiPayload,
  versionLabelColor,
} from "./form-schema";

type IdCardLink = { id: string; code: string } | null;

/** Compute age in whole years from an ISO date string (YYYY-MM-DD). */
function calculateAge(dob: string): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

type Props = {
  /** "create" — POST /api/people; "edit" — PATCH /api/people/[personId]; "view" — read-only display */
  mode: "create" | "edit" | "view";
  /** For edit/view mode: the person UUID to PATCH/DELETE. */
  personId?: string;
  /** For edit/view mode: the system-generated public code (PERS00001), shown read-only. */
  personCode?: string;
  /** Pre-filled form values; defaults to emptyFormValues for create. */
  initialValues?: FormValues;
  /** The person's CARTE_IDENTITATE Document, if one is linked (edit/view only). */
  linkedIdCard?: IdCardLink;
  /** Slice #18.05 — header DOM node to portal the version-nav controls into,
   *  so they render on the person-name line. */
  versionNavSlot?: HTMLElement | null;
};

// ---------------------------------------------------------------------------
// Version history fetch (Slice #18.05)
// ---------------------------------------------------------------------------

type VersionItem = {
  versionNumber: number;
  snapshot:      NaturalPersonSnapshot;
  createdAt:     string;
};

async function fetchVersions(personId: string): Promise<VersionItem[]> {
  const res = await fetch(`/api/people/${encodeURIComponent(personId)}/versions`);
  if (!res.ok) throw new Error(`Failed to load versions (HTTP ${res.status})`);
  const body = await res.json();
  return (body.items ?? []) as VersionItem[];
}

function useCitizenshipOptions(): { value: string; label: string }[] {
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/value-lists/citizenships")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data: { items?: { id: string; name: string }[] }) => {
        if (cancelled) return;
        setOptions((data.items ?? []).map((r) => ({ value: r.id, label: r.name })));
      })
      .catch(() => {
        // Leave options empty — the select still renders with just "—".
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return options;
}

// Slice #18.16.VL: Professional Type dropdown (lookup_person_type).
function usePersonTypeOptions(): { value: string; label: string }[] {
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/value-lists/person-types")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data: { items?: { id: string; name: string }[] }) => {
        if (cancelled) return;
        setOptions((data.items ?? []).map((r) => ({ value: r.id, label: r.name })));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return options;
}

export function NaturalPersonForm({
  mode,
  personId,
  personCode,
  initialValues,
  linkedIdCard,
  versionNavSlot,
}: Props) {
  const t = useTranslations("naturalPerson");
  const router = useRouter();
  const queryClient = useQueryClient();
  const citizenshipOptions = useCitizenshipOptions();
  // Slice #18.16.VL:
  const personTypeOptions = usePersonTypeOptions();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialValues ?? emptyFormValues,
    mode: "onChange",
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmMakeCurrent, setConfirmMakeCurrent] = useState(false);

  const isCreate = mode === "create";
  // Subscribe to value changes so the edit-dirty check recomputes live.
  // form.watch() is intentionally not memoizable; this is the documented usage.
  // eslint-disable-next-line react-hooks/incompatible-library
  const watchedValues = form.watch();

  // Derived display values (recalculate on every render since watchedValues is live).
  const calculatedAge = calculateAge(watchedValues.dateOfBirth);
  const idValidUntilDate = watchedValues.idValidUntil
    ? new Date(watchedValues.idValidUntil)
    : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const idValidUntilExpired = idValidUntilDate !== null && idValidUntilDate < today;
  const idValidUntilDaysLeft =
    idValidUntilDate !== null && !idValidUntilExpired
      ? Math.ceil((idValidUntilDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      : null;
  const idValidUntilExpiringSoon =
    idValidUntilDaysLeft !== null && idValidUntilDaysLeft <= 90;

  // --- Version history (Slice #18.05) ------------------------------------
  const versionsQuery = useQuery({
    queryKey: ["person-versions", personId],
    queryFn: () => fetchVersions(personId!),
    enabled: !isCreate && !!personId,
    // staleTime 0 so reopening after a save refetches and shows the newly
    // appended version (doSave also invalidates this key).
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

  // Which version is currently displayed. null = follow the latest.
  const [viewingVersion, setViewingVersion] = useState<number | null>(null);
  const effectiveVersion: number | null = viewingVersion ?? latestVersion;
  const isOnLatest = latestVersion === null || effectiveVersion === latestVersion;

  // Baseline = the latest saved state. Initialised from the server props at page
  // load, updated in place after an edit-save. editDirty compares to this — not
  // RHF's isDirty, which version navigation's form.reset() would clear.
  const [baseline, setBaseline] = useState<{ values: FormValues }>(
    () => ({ values: initialValues ?? emptyFormValues }),
  );

  // Bug 1 (Slice #18.15.bugs): transient pulse of the latest version's
  // N-1 -> N change. Set when the user navigates onto the latest from a
  // different version (or restores via "Make current"); cleared after ~2.6s.
  const [pulse, setPulse] = useState<NaturalFieldHighlights | null>(null);
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

  // Any non-latest version is strictly read-only; only the latest is editable
  // (or stays "view" if opened read-only). Create mode is unaffected.
  const effectiveMode: "create" | "edit" | "view" =
    isCreate ? "create" : isOnLatest ? mode : "view";

  // Has the editable latest copy diverged from the loaded baseline?
  const editDirty =
    !isCreate && isOnLatest && !formValuesEqual(watchedValues, baseline.values);

  // Navigate to a version. Locked while the latest has unsaved edits, so a
  // dirty draft is never stranded on a read-only historical view.
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

  // Highlights show only on a read-only historical version (>= 1). The editable
  // latest is the working copy (no frames); version 0 has no predecessor.
  const showHighlights =
    !isCreate && !isOnLatest && effectiveVersion !== null && effectiveVersion >= 1;
  const currSnap =
    effectiveVersion !== null ? versionByNumber.get(effectiveVersion)?.snapshot : undefined;
  const prevSnap =
    effectiveVersion !== null && effectiveVersion >= 1
      ? versionByNumber.get(effectiveVersion - 1)?.snapshot
      : undefined;
  const fieldHighlights: NaturalFieldHighlights | null =
    showHighlights && currSnap ? computeFieldHighlights(prevSnap ?? null, currSnap) : null;

  // What the fields actually frame: the historical diff on a past version, or
  // the transient pulse on the latest. `pulsing` swaps the static ring for the
  // animated pulse class (Bug 1).
  const displayHighlights: NaturalFieldHighlights | null = fieldHighlights ?? pulse;
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

  // Save button disabled if: form invalid, currently submitting, or (edit mode,
  // on the latest) the form hasn't diverged from the baseline.
  const saveDisabled =
    submitting ||
    !form.formState.isValid ||
    (mode === "edit" && isOnLatest && !editDirty);

  // doSave performs the API call only (no navigation) so it can be reused by
  // the Save button (onSubmit), the unsaved-changes guard, and "Make Current".
  const doSave = async (values: FormValues): Promise<boolean> => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = toApiPayload(values);
      const url =
        mode === "create"
          ? "/api/people"
          : `/api/people/${encodeURIComponent(personId!)}`;
      const method = mode === "create" ? "POST" : "PATCH";
      await safeMutate(
        url,
        { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
        t,
      );
      await queryClient.invalidateQueries({ queryKey: ["people"] });
      // The unified /persons list (Slice #15.09) caches under ["persons"];
      // invalidate it too so a created/edited/deleted person shows without a
      // manual browser refresh (Slice #18.13).
      await queryClient.invalidateQueries({ queryKey: ["persons"] });
      // Slice #18.05: a save appended a new version — drop the cached list so
      // reopening shows it (and the ◀/▶ nav enables / advances).
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
      router.push("/natural-persons");
      router.refresh();
      return;
    }

    // Slice #18.05: edit mode stays on the person so the freshly-appended
    // version is visible. Reset the clean baseline to the just-saved state (so
    // Save disables and version nav unlocks), follow the new latest, and
    // refresh server-rendered bits (e.g. the page title if the name changed).
    setBaseline({ values });
    setViewingVersion(null);
    router.refresh();
  };

  // "Make this version current": re-save the currently-viewed historical
  // snapshot (the form was reset to it on navigation) as a brand-new version,
  // via the normal edit-save path. updateNaturalPerson appends it as the new
  // latest (it differs from the current latest); we then follow it.
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
        `/api/people/${encodeURIComponent(personId!)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body?.error ?? `${t("deleteError")} (HTTP ${res.status})`,
        );
      }
      await queryClient.invalidateQueries({ queryKey: ["people"] });
      // The unified /persons list (Slice #15.09) caches under ["persons"];
      // invalidate it too so a created/edited/deleted person shows without a
      // manual browser refresh (Slice #18.13).
      await queryClient.invalidateQueries({ queryKey: ["persons"] });
      router.push("/natural-persons");
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
      setConfirmDelete(false);
    }
  };

  const onCancel = () => {
    router.push("/natural-persons");
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
      {/* Slice #20.13: sticky "Modificări nesalvate" banner — visible whenever
          the form has unsaved edits, even when Save is below the fold. */}
      <UnsavedChangesBanner show={editDirty} />

      {/* Slice #18.05: version controls portalled into the detail-tabs header
          so they sit on the person-name line. Only for an existing person once
          its versions have loaded, and only when the header provided a slot. */}
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

      {/* Wrap all fields in a disabled fieldset when read-only (view mode or a
          historical version). The version nav lives in the header (portalled),
          outside this fieldset, so its buttons stay clickable. */}
      <fieldset disabled={effectiveMode === "view"} className="flex flex-col gap-4 border-0 m-0 p-0 min-w-0">

      {/* Identity — core biographical data */}
      <section className="rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">
          {t("sections.identity")}
          {mode !== "create" && personCode && (
            <span className="font-mono text-xs font-normal normal-case text-fade dark:text-zinc-500">
              {personCode}
            </span>
          )}
        </h2>
        <div className="flex flex-col gap-2">
          {/* Row 1 (3-col): Last Name | First Name | Nickname */}
          <div className="grid grid-cols-3 gap-2">
            <Field
              label={t("fields.lastName")}
              name="lastName"
              register={register}
              error={errors.lastName?.message}
              highlight={displayHighlights?.fields.lastName}
            />
            <Field
              label={t("fields.firstName")}
              name="firstName"
              register={register}
              error={errors.firstName?.message}
              highlight={displayHighlights?.fields.firstName}
            />
            <Field
              label={t("fields.nickname")}
              name="nickname"
              register={register}
              error={errors.nickname?.message}
              highlight={displayHighlights?.fields.nickname}
            />
          </div>
          {/* Row 2 (3-col): Age (calc) | CNP | Professional Type */}
          <div className="grid grid-cols-3 gap-2">
            <ReadOnlyField
              label={t("fields.age")}
              value={calculatedAge !== null ? String(calculatedAge) : "—"}
            />
            <Field
              label={t("fields.cnp")}
              name="cnp"
              register={register}
              error={errors.cnp?.message}
              highlight={displayHighlights?.fields.cnp}
            />
            <SelectField
              label={t("fields.physicalPersonTypeId")}
              name="physicalPersonTypeId"
              register={register}
              error={errors.physicalPersonTypeId?.message}
              options={[{ value: "", label: "—" }, ...personTypeOptions]}
              highlight={displayHighlights?.fields.physicalPersonTypeId}
            />
          </div>
          {/* Row 3 (3-col): Gender | Place of Birth | Date of Birth */}
          <div className="grid grid-cols-3 gap-2">
            <SelectField
              label={t("fields.gender")}
              name="gender"
              register={register}
              error={errors.gender?.message}
              options={[
                { value: "", label: "—" },
                { value: "MALE", label: t("options.gender.MALE") },
                { value: "FEMALE", label: t("options.gender.FEMALE") },
              ]}
              highlight={displayHighlights?.fields.gender}
            />
            <Field
              label={t("fields.placeOfBirth")}
              name="placeOfBirth"
              register={register}
              error={errors.placeOfBirth?.message}
              highlight={displayHighlights?.fields.placeOfBirth}
            />
            <Field
              label={t("fields.dateOfBirth")}
              name="dateOfBirth"
              type="date"
              register={register}
              error={errors.dateOfBirth?.message}
              highlight={displayHighlights?.fields.dateOfBirth}
            />
          </div>
          {/* Row 4: Notes — full width */}
          <Field
            label={t("fields.notes")}
            name="notes"
            register={register}
            error={errors.notes?.message}
            highlight={displayHighlights?.fields.notes}
          />
        </div>
      </section>

      {/* Contact — phones and emails */}
      <section className="rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">
          {t("sections.contact")}
        </h2>
        <div className="flex flex-col gap-2">
          {/* Row 1 (3-col): Personal Phone 1 | Personal Phone 2 | Work Phone */}
          <div className="grid grid-cols-3 gap-2">
            <Field
              label={t("fields.personalPhone1")}
              name="personalPhone1"
              register={register}
              error={errors.personalPhone1?.message}
              highlight={displayHighlights?.fields.personalPhone1}
            />
            <Field
              label={t("fields.personalPhone2")}
              name="personalPhone2"
              register={register}
              error={errors.personalPhone2?.message}
              highlight={displayHighlights?.fields.personalPhone2}
            />
            <Field
              label={t("fields.workPhone")}
              name="workPhone"
              register={register}
              error={errors.workPhone?.message}
              highlight={displayHighlights?.fields.workPhone}
            />
          </div>
          {/* Row 2 (3-col): Personal Email 1 | Personal Email 2 | Work Email */}
          <div className="grid grid-cols-3 gap-2">
            <Field
              label={t("fields.personalEmail1")}
              name="personalEmail1"
              register={register}
              error={errors.personalEmail1?.message}
              highlight={displayHighlights?.fields.personalEmail1}
            />
            <Field
              label={t("fields.personalEmail2")}
              name="personalEmail2"
              register={register}
              error={errors.personalEmail2?.message}
              highlight={displayHighlights?.fields.personalEmail2}
            />
            <Field
              label={t("fields.workEmail")}
              name="workEmail"
              register={register}
              error={errors.workEmail?.message}
              highlight={displayHighlights?.fields.workEmail}
            />
          </div>
        </div>
      </section>

      {/* ID Card — official document data; populated manually or via scanner */}
      <section className="rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">
          {t("sections.idCard")}
        </h2>
        <div className="flex flex-col gap-2">
          {/* Row 1 (3-col): ID Doc Type | ID Doc Number | Citizenship */}
          <div className="grid grid-cols-3 gap-2">
            <SelectField
              label={t("fields.idDocumentType")}
              name="idDocumentType"
              register={register}
              error={errors.idDocumentType?.message}
              options={[
                { value: "", label: "—" },
                { value: "ID_CARD", label: t("options.idDoc.ID_CARD") },
                { value: "PASSPORT", label: t("options.idDoc.PASSPORT") },
              ]}
              highlight={displayHighlights?.fields.idDocumentType}
            />
            <Field
              label={t("fields.idDocumentNumber")}
              name="idDocumentNumber"
              register={register}
              error={errors.idDocumentNumber?.message}
              highlight={displayHighlights?.fields.idDocumentNumber}
            />
            <SelectField
              label={t("fields.citizenship")}
              name="citizenshipId"
              register={register}
              error={errors.citizenshipId?.message}
              options={[{ value: "", label: "—" }, ...citizenshipOptions]}
              highlight={displayHighlights?.fields.citizenshipId}
            />
          </div>
          {/* Row 2 (3-col): ID Issuer | ID Card Number | (empty) */}
          <div className="grid grid-cols-3 gap-2">
            <Field
              label={t("fields.idIssuingAuthority")}
              name="idIssuingAuthority"
              register={register}
              error={errors.idIssuingAuthority?.message}
              highlight={displayHighlights?.fields.idIssuingAuthority}
            />
            <Field
              label={t("fields.idCardNumber")}
              name="idCardNumber"
              register={register}
              error={errors.idCardNumber?.message}
              highlight={displayHighlights?.fields.idCardNumber}
            />
          </div>
          {/* Row 3 (3-col): Valid From | Until (coloured border) | status annotation */}
          <div className="grid grid-cols-3 gap-2">
            <Field
              label={t("fields.idValidFrom")}
              name="idValidFrom"
              type="date"
              register={register}
              error={errors.idValidFrom?.message}
              highlight={displayHighlights?.fields.idValidFrom}
            />
            <Field
              label={t("fields.idValidUntil")}
              name="idValidUntil"
              type="date"
              register={register}
              error={errors.idValidUntil?.message}
              highlight={displayHighlights?.fields.idValidUntil}
              expired={idValidUntilExpired}
              expiringSoon={idValidUntilExpiringSoon}
            />
            {/* Third cell: validity status label shown to the right of the Until field */}
            <div className="flex items-center">
              {idValidUntilExpired && (
                <span className="text-xs font-bold uppercase text-red-600 dark:text-red-400">
                  {t("hints.idExpired")}
                </span>
              )}
              {!idValidUntilExpired && idValidUntilExpiringSoon && idValidUntilDaysLeft !== null && (
                <span className="text-xs font-bold uppercase text-orange-600 dark:text-orange-400">
                  {t("hints.idExpiringSoon", { n: idValidUntilDaysLeft })}
                </span>
              )}
              {!idValidUntilExpired && !idValidUntilExpiringSoon && idValidUntilDate !== null && (
                <span className="text-xs font-bold uppercase text-green-600 dark:text-green-400">
                  {t("hints.idValid")}
                </span>
              )}
            </div>
          </div>
          {/* MRZ Raw — full width */}
          <TextAreaField
            label={t("fields.idMrzRaw")}
            name="idMrzRaw"
            register={register}
            error={errors.idMrzRaw?.message}
            highlight={displayHighlights?.fields.idMrzRaw}
          />
          {mode !== "create" && (
            <div className="flex items-center gap-2 text-sm">
              <span className="w-[5.5rem] shrink-0 text-center font-medium text-ink dark:text-zinc-300">
                {t("fields.idLink")}
              </span>
              {linkedIdCard ? (
                <a
                  href={`/documents/${linkedIdCard.id}`}
                  className="text-cta hover:underline"
                >
                  {linkedIdCard.code} →
                </a>
              ) : (
                <span className="text-fade dark:text-zinc-500">{t("hints.idLinkNone")}</span>
              )}
            </div>
          )}
        </div>
      </section>

      <AddressBlock<FormValues>
        title={t("sections.homeAddress")}
        prefix="addresses.HOME"
        register={register}
        errors={errors.addresses?.HOME}
        highlights={displayHighlights?.addresses.HOME}
      />

      {/* ── Same-as-home checkbox — between the two address blocks ── */}
      <div className="flex items-center gap-2 px-1">
        <Controller
          control={form.control}
          name="correspondenceSameAsHome"
          render={({ field }) => (
            <label
              className={[
                "flex cursor-pointer items-center gap-2 rounded-md text-sm select-none",
                watchedValues.correspondenceSameAsHome
                  ? "font-bold text-ink dark:text-zinc-200"
                  : "font-normal text-fade dark:text-zinc-400",
                displayHighlights?.fields.correspondenceSameAsHome
                  ? "px-1 " + highlightRingClass(displayHighlights.fields.correspondenceSameAsHome, pulsing)
                  : "",
              ].join(" ")}
            >
              <input
                type="checkbox"
                checked={field.value}
                onChange={(e) => {
                  field.onChange(e.target.checked);
                  if (e.target.checked) {
                    const home = form.getValues("addresses.HOME");
                    form.setValue("addresses.CORRESPONDENCE", { ...home }, { shouldDirty: true });
                  }
                }}
                className="accent-cta"
                aria-label={t("fields.correspondenceSameAsHome")}
              />
              {t("fields.correspondenceSameAsHome")}
            </label>
          )}
        />
      </div>

      {/* CORRESPONDENCE address — only when not same as home */}
      {!watchedValues.correspondenceSameAsHome && (
        <AddressBlock<FormValues>
          title={t("sections.correspondenceAddress")}
          prefix="addresses.CORRESPONDENCE"
          register={register}
          errors={errors.addresses?.CORRESPONDENCE}
          highlights={displayHighlights?.addresses.CORRESPONDENCE}
        />
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
    </form>
    </FieldPulseContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Local presentational helpers
// ---------------------------------------------------------------------------

type FieldProps = {
  label: string;
  name: FieldPath<FormValues>;
  type?: string;
  register: UseFormRegister<FormValues>;
  error?: string;
  hint?: string;
  highlight?: HighlightColor;
  /** Adds a red border — used for expired dates. */
  expired?: boolean;
  /** Adds an orange border — used for dates expiring within 3 months. */
  expiringSoon?: boolean;
};

function Field({ label, name, type = "text", register, error, hint, highlight, expired, expiringSoon }: FieldProps) {
  const ring = usePulseRing(highlight);
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="w-[5.5rem] shrink-0 text-center font-medium text-ink dark:text-zinc-300">{label}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <input
          type={type}
          {...register(name)}
          aria-invalid={error ? true : undefined}
          className={[
            "w-full rounded-md border bg-white px-2 py-1 shadow-sm focus:outline-none disabled:bg-canvas disabled:text-fade disabled:cursor-default dark:bg-zinc-950 dark:disabled:bg-zinc-800",
            error || expired
              ? "border-red-500 focus:border-red-600"
              : expiringSoon
                ? "border-orange-500 focus:border-orange-600"
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
      <span className="w-[5.5rem] shrink-0 pt-1 text-center font-medium text-ink dark:text-zinc-300">{label}</span>
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
      <span className="w-[5.5rem] shrink-0 text-center font-medium text-ink dark:text-zinc-300">{label}</span>
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
          <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
        )}
      </div>
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-[5.5rem] shrink-0 text-center font-medium text-ink dark:text-zinc-300">{label}</span>
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
