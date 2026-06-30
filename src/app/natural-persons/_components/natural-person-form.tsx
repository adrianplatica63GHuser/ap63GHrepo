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
import { AddressBlock } from "@/components/address/address-block";
import { NavArrowIcon } from "@/components/back-arrow";
import { useUnsavedChangesGuard } from "@/components/providers/unsaved-changes-provider";
import {
  VersionNavControls,
  type VersionNavView,
} from "@/components/version-nav-controls";
import { FieldPulseContext, usePulseRing } from "@/components/versioning/field-pulse";
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
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      // An expired session is redirected to /sign-in by the auth middleware;
      // fetch follows that as a 200, which would otherwise look like a
      // successful save and silently lose the change. Treat any redirect as
      // an auth failure.
      if (res.redirected) {
        throw new Error(t("saveErrorSession"));
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body?.error ?? `${t("saveError")} (HTTP ${res.status})`,
        );
      }
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
      {/* Slice #18.05: version controls portalled into the detail-tabs header
          so they sit on the person-name line. Only for an existing person once
          its versions have loaded, and only when the header provided a slot. */}
      {versionNavSlot && versionNav &&
        createPortal(
          <VersionNavControls
            nav={versionNav}
            labels={{
              versionLabel:    t("version.label", { n: versionNav.current }),
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
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">
          {t("sections.identity")}
        </h2>
        <div className="flex flex-col gap-2">
          {/* Row 1: Last Name | First Name */}
          <div className="grid grid-cols-2 gap-2">
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
          </div>
          {/* Row 2: Code (edit/view) | CNP */}
          <div className="grid grid-cols-2 gap-2">
            {mode !== "create" && personCode && (
              <ReadOnlyField label={t("fields.code")} value={personCode} />
            )}
            <Field
              label={t("fields.cnp")}
              name="cnp"
              register={register}
              error={errors.cnp?.message}
              highlight={displayHighlights?.fields.cnp}
            />
          </div>
          {/* Row 3: Gender | Date of Birth */}
          <div className="grid grid-cols-2 gap-2">
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
              label={t("fields.dateOfBirth")}
              name="dateOfBirth"
              type="date"
              register={register}
              error={errors.dateOfBirth?.message}
              highlight={displayHighlights?.fields.dateOfBirth}
            />
          </div>
          {/* Row 4: Place of Birth | Professional Type */}
          <div className="grid grid-cols-2 gap-2">
            <Field
              label={t("fields.placeOfBirth")}
              name="placeOfBirth"
              register={register}
              error={errors.placeOfBirth?.message}
              highlight={displayHighlights?.fields.placeOfBirth}
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
          {/* Row 5: Nickname | Notes */}
          <div className="grid grid-cols-2 gap-2">
            <Field
              label={t("fields.nickname")}
              name="nickname"
              register={register}
              error={errors.nickname?.message}
              highlight={displayHighlights?.fields.nickname}
            />
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

      {/* Contact — phones and emails */}
      <section className="rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">
          {t("sections.contact")}
        </h2>
        <div className="flex flex-col gap-2">
          {/* Row 1: Personal Phone 1 | Personal Email 1 */}
          <div className="grid grid-cols-2 gap-2">
            <Field
              label={t("fields.personalPhone1")}
              name="personalPhone1"
              register={register}
              error={errors.personalPhone1?.message}
              highlight={displayHighlights?.fields.personalPhone1}
            />
            <Field
              label={t("fields.personalEmail1")}
              name="personalEmail1"
              register={register}
              error={errors.personalEmail1?.message}
              highlight={displayHighlights?.fields.personalEmail1}
            />
          </div>
          {/* Row 2: Personal Phone 2 | Personal Email 2 */}
          <div className="grid grid-cols-2 gap-2">
            <Field
              label={t("fields.personalPhone2")}
              name="personalPhone2"
              register={register}
              error={errors.personalPhone2?.message}
              highlight={displayHighlights?.fields.personalPhone2}
            />
            <Field
              label={t("fields.personalEmail2")}
              name="personalEmail2"
              register={register}
              error={errors.personalEmail2?.message}
              highlight={displayHighlights?.fields.personalEmail2}
            />
          </div>
          {/* Row 3: Work Phone | Work Email */}
          <div className="grid grid-cols-2 gap-2">
            <Field
              label={t("fields.workPhone")}
              name="workPhone"
              register={register}
              error={errors.workPhone?.message}
              highlight={displayHighlights?.fields.workPhone}
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
          {/* Row 1: ID Doc Type | ID Doc Number */}
          <div className="grid grid-cols-2 gap-2">
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
          </div>
          {/* Row 2: Citizenship | Issuing Authority */}
          <div className="grid grid-cols-2 gap-2">
            <SelectField
              label={t("fields.citizenship")}
              name="citizenshipId"
              register={register}
              error={errors.citizenshipId?.message}
              options={[{ value: "", label: "—" }, ...citizenshipOptions]}
              highlight={displayHighlights?.fields.citizenshipId}
            />
            <Field
              label={t("fields.idIssuingAuthority")}
              name="idIssuingAuthority"
              register={register}
              error={errors.idIssuingAuthority?.message}
              highlight={displayHighlights?.fields.idIssuingAuthority}
            />
          </div>
          {/* Row 3: ID Card Number (half-width) */}
          <div className="grid grid-cols-2 gap-2">
            <Field
              label={t("fields.idCardNumber")}
              name="idCardNumber"
              register={register}
              error={errors.idCardNumber?.message}
              highlight={displayHighlights?.fields.idCardNumber}
            />
          </div>
          {/* Row 4: Valid From | Valid Until */}
          <div className="grid grid-cols-2 gap-2">
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
            />
          </div>
          <TextAreaField
            label={t("fields.idMrzRaw")}
            name="idMrzRaw"
            register={register}
            error={errors.idMrzRaw?.message}
            highlight={displayHighlights?.fields.idMrzRaw}
          />
          {mode !== "create" && (
            <div className="flex items-center gap-2 text-sm">
              <span className="w-36 shrink-0 font-medium text-ink dark:text-zinc-300">
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

      <AddressBlock<FormValues>
        title={t("sections.correspondenceAddress")}
        prefix="addresses.CORRESPONDENCE"
        register={register}
        errors={errors.addresses?.CORRESPONDENCE}
        highlights={displayHighlights?.addresses.CORRESPONDENCE}
      />

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
};

function Field({ label, name, type = "text", register, error, hint, highlight }: FieldProps) {
  const ring = usePulseRing(highlight);
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="w-36 shrink-0 font-medium text-ink dark:text-zinc-300">{label}</span>
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
      <span className="w-36 shrink-0 pt-1 font-medium text-ink dark:text-zinc-300">{label}</span>
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
      <span className="w-36 shrink-0 font-medium text-ink dark:text-zinc-300">{label}</span>
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
      <span className="w-36 shrink-0 font-medium text-ink dark:text-zinc-300">{label}</span>
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
