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
  useWatch,
} from "react-hook-form";
import { useUnsavedChangesGuard } from "@/components/providers/unsaved-changes-provider";
import {
  VersionNavControls,
  type VersionNavView,
} from "@/components/version-nav-controls";
import { FieldPulseContext, usePulseRing } from "@/components/versioning/field-pulse";
import type { HighlightColor } from "@/lib/versioning/field-diff";
import type { DocumentSnapshot } from "@/lib/documents/validation";
import {
  computeFieldHighlights,
  type DocumentFieldHighlights,
  emptyFormValues,
  formSchema,
  formValuesEqual,
  type FormValues,
  snapshotToFormValues,
  toApiPayload,
  versionLabelColor,
} from "./form-schema";
import { getTypeConfig } from "@/lib/documents/type-config";
import { PagesPanel, PagesViewerBox, usePagesPanelState } from "./pages-panel";
import { SuccessionPartiesPanel } from "./succession-parties-panel";

// ---------------------------------------------------------------------------
// Document type list — fetched dynamically from the admin-managed
// lookup_document_type table (Slice #15.05: no more hardcoded type enum).
// ---------------------------------------------------------------------------

type DocumentTypeOption = {
  id:   string;
  key:  string;
  name: string;
};

async function fetchDocumentTypes(): Promise<DocumentTypeOption[]> {
  const res = await fetch("/api/admin/value-lists/document-types");
  if (!res.ok) throw new Error(`Failed to load document types (HTTP ${res.status})`);
  const body = await res.json();
  return (body.items ?? []) as DocumentTypeOption[];
}

// ---------------------------------------------------------------------------
// Institution list — fetched from admin-managed lookup_institution table
// (Slice #18.16.VL: replaces free-text institution field)
// ---------------------------------------------------------------------------

type InstitutionOption = { id: string; value: string; label: string };

async function fetchInstitutions(): Promise<InstitutionOption[]> {
  const res = await fetch("/api/admin/value-lists/institutions");
  if (!res.ok) throw new Error(`Failed to load institutions (HTTP ${res.status})`);
  const body = await res.json();
  // lookup_institution rows: { id, name, institutionType, sortOrder, ... }
  return (body.items ?? []).map((item: { id: string; name: string; institutionType?: string | null }) => ({
    id:    item.id,
    value: item.id,   // SelectField value = the UUID (FK stored in institution_id)
    label: item.institutionType ? `${item.name} (${item.institutionType})` : item.name,
  }));
}

// ---------------------------------------------------------------------------
// Version history fetch (Slice #18.06)
// ---------------------------------------------------------------------------

type VersionItem = {
  versionNumber: number;
  snapshot:      DocumentSnapshot;
  createdAt:     string;
};

async function fetchVersions(documentId: string): Promise<VersionItem[]> {
  const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}/versions`);
  if (!res.ok) throw new Error(`Failed to load versions (HTTP ${res.status})`);
  const body = await res.json();
  return (body.items ?? []) as VersionItem[];
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  mode:             "create" | "edit" | "view";
  documentId?:      string;
  documentCode?:    string;
  initialValues?:   FormValues;
  /** Notified whenever the "Show Big Page" toggle changes, so the parent
   *  (DocumentDetailTabs) can widen the page's outer container — mirrors
   *  PropertyForm's onBigMapChange. */
  onBigPageChange?: (bigPage: boolean) => void;
  /** Slice #18.06 — header DOM node to portal the version-nav controls into,
   *  so they render on the document-name line. */
  versionNavSlot?:  HTMLElement | null;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DocumentForm({
  mode,
  documentId,
  documentCode,
  initialValues,
  onBigPageChange,
  versionNavSlot,
}: Props) {
  const t = useTranslations("document");
  const router = useRouter();
  const queryClient = useQueryClient();

  // Shared Pages-panel state (Slice #15.13) — lifted up here, exactly like
  // PropertyForm lifts `corners` state, so the table (left column) and the
  // detached big viewer (right column) both read/write the same data.
  const pagesState = usePagesPanelState(documentId);
  const [bigPage, setBigPage] = useState(false);
  const handleToggleBigPage = () => {
    const next = !bigPage;
    setBigPage(next);
    onBigPageChange?.(next);
  };

  const { data: documentTypes } = useQuery({
    queryKey: ["document-types"],
    queryFn:  fetchDocumentTypes,
    staleTime: 5 * 60 * 1000,
  });
  const typeOptions = documentTypes ?? [];

  // Slice #18.16.VL — institution dropdown
  const { data: institutions } = useQuery({
    queryKey: ["institutions"],
    queryFn:  fetchInstitutions,
    staleTime: 5 * 60 * 1000,
  });
  const institutionOptions: { value: string; label: string }[] = [
    { value: "", label: "—" },
    ...(institutions ?? []).map((i) => ({ value: i.value, label: i.label })),
  ];

  const form = useForm<FormValues>({
    resolver:      zodResolver(formSchema),
    defaultValues: initialValues ?? emptyFormValues,
    mode:          "onChange",
  });

  const [submitting,        setSubmitting]        = useState(false);
  const [submitError,       setSubmitError]       = useState<string | null>(null);
  const [confirmDelete,     setConfirmDelete]     = useState(false);
  const [confirmMakeCurrent, setConfirmMakeCurrent] = useState(false);

  const isCreate = mode === "create";
  // Subscribe to all values so the edit-dirty check recomputes live.
  // form.watch() is intentionally not memoizable; this is the documented usage.
  // eslint-disable-next-line react-hooks/incompatible-library
  const watchedValues = form.watch();

  // Watch `documentTypeId` so the form re-renders when the user changes the type.
  // Conditional sections key off the *key* string (e.g. "TITLU_PROPRIETATE"),
  // not the uuid, so we resolve it via the fetched type list.
  const selectedDocumentTypeId = useWatch({ control: form.control, name: "documentTypeId" });
  const selectedTypeKey = typeOptions.find((opt) => opt.id === selectedDocumentTypeId)?.key;
  const cfg = getTypeConfig(selectedTypeKey);
  // True only for CERTIFICAT_MOSTENITOR — drives the merged Succession Details section.
  const isMostenitor = selectedTypeKey === "CERTIFICAT_MOSTENITOR";

  // --- Version history (Slice #18.06) ------------------------------------
  const versionsQuery = useQuery({
    queryKey: ["document-versions", documentId],
    queryFn: () => fetchVersions(documentId!),
    enabled: !isCreate && !!documentId,
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
  const [pulse, setPulse] = useState<DocumentFieldHighlights | null>(null);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Version number to pulse once the post-restore refetch has delivered it.
  const pendingPulseRef = useRef<number | null>(null);

  // Pulse the latest version's change (latest vs latest-1). No-op for a single
  // version (nothing to diff). Replaces any in-flight pulse + its timer.
  const triggerLatestPulse = () => {
    if (latestVersion === null || latestVersion < 1) return;
    const curr = versionByNumber.get(latestVersion)?.snapshot;
    if (!curr) return;
    const prev = versionByNumber.get(latestVersion - 1)?.snapshot;
    setPulse(computeFieldHighlights(prev ?? null, curr));
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = setTimeout(() => setPulse(null), 3300);
  };

  // Clear the pulse timer on unmount.
  useEffect(
    () => () => {
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    },
    [],
  );

  // After a "Make current" restore, the new version arrives via refetch; pulse
  // it once it's present (and is the expected new latest), then disarm.
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
      // Bug 1: arriving on the latest from a different version pulses the
      // N-1 -> N change. (Stepping within history clears any stale pulse.)
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
  const fieldHighlights: DocumentFieldHighlights | null =
    showHighlights && currSnap ? computeFieldHighlights(prevSnap ?? null, currSnap) : null;

  // What the fields actually frame: the historical diff on a past version, or
  // the transient pulse on the latest. `pulsing` swaps the static ring for the
  // animated pulse class (Bug 1).
  const displayHighlights: DocumentFieldHighlights | null = fieldHighlights ?? pulse;
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

  // Bug 3 (Slice #18.15.bugs): in edit mode, Save disables once the form
  // matches the saved baseline — so after a save (which resets the baseline)
  // the button greys out until the next edit. Page uploads/deletes save
  // immediately via their own API calls (they don't touch RHF state and have
  // nothing pending here), so gating the field-Save on `editDirty` is exactly
  // right. Create mode keeps Save available (zodResolver blocks an invalid
  // submit); view / historical versions hide the button entirely.
  const saveDisabled =
    submitting || (mode === "edit" && isOnLatest && !editDirty);

  // doSave performs the API call only (no navigation) so it can be reused by
  // the Save button (onSubmit), the unsaved-changes guard, and "Make Current".
  const doSave = async (values: FormValues): Promise<boolean> => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = toApiPayload(values);
      const url =
        mode === "create"
          ? "/api/documents"
          : `/api/documents/${encodeURIComponent(documentId!)}`;
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
        throw new Error(body?.error ?? `${t("saveError")} (HTTP ${res.status})`);
      }
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      // Slice #18.06: a save appended a new version — drop the cached list so
      // reopening shows it (and the ◀/▶ nav enables / advances).
      await queryClient.invalidateQueries({ queryKey: ["document-versions"] });
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
      router.push("/documents");
      router.refresh();
      return;
    }

    // Slice #18.06: edit mode stays on the document so the freshly-appended
    // version is visible. Reset the clean baseline to the just-saved state (so
    // version nav unlocks), follow the new latest, and refresh server-rendered
    // bits (e.g. the page title if the document's label changed).
    setBaseline({ values });
    setViewingVersion(null);
    router.refresh();
  };

  // "Make this version current": re-save the currently-viewed historical
  // snapshot (the form was reset to it on navigation) as a brand-new version,
  // via the normal edit-save path. updateDocument appends it as the new latest
  // (it differs from the current latest); we then follow it.
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

  // Page uploads/deletes save immediately via their own API calls (see
  // PagesPanel), so they don't need this guard — only unsaved React Hook
  // Form field edits do. A read-only historical version is never dirty.
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
        `/api/documents/${encodeURIComponent(documentId!)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `${t("deleteError")} (HTTP ${res.status})`);
      }
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      router.push("/documents");
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
    <div className="flex flex-col gap-4">
    {/* Slice #18.06: version controls portalled into the detail-tabs header so
        they sit on the document-name line. Only for an existing document once
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

    {/* Two-column layout when "Show Big Page" is active (Slice #15.13) —
        mirrors PropertyForm's "Show Big Map" mechanism exactly: the left
        column (form + panels) keeps a fixed width, and a tall right column
        hosts the detached page viewer. In normal mode this wrapper is a
        no-op ("contents") so the original single-column flow is unchanged. */}
    <div className={bigPage ? "flex flex-row gap-4 items-stretch" : "contents"}>
    <div className={bigPage ? "w-[540px] flex-none flex flex-col gap-4" : "contents"}>
    {/* id is used by the submit button's form="document-form" attribute below,
        which lets the button live outside the <form> element (after PagesPanel)
        while still submitting this form. */}
    <form
      id="document-form"
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
      noValidate
    >
      {/* Slice #18.06: the disabled fieldset wraps ONLY the editable input
          sections; the version nav lives in the header (portalled), outside
          this fieldset, so its ◀/▶ buttons stay clickable on read-only
          historical versions. */}
      <fieldset disabled={effectiveMode === "view"} className="contents">
      {/* ── General (merged: type selector + common fields + notes) ───── */}
      <Section title={t("sections.general")} columns={1}>
        {/* Row 1: Code (half) | Type (half) */}
        <div className="grid grid-cols-2 gap-2">
          {mode === "edit" && documentCode && (
            <ReadOnlyField label={t("fields.code")} value={documentCode} />
          )}
          <SelectField
            label={t("fields.type")}
            name="documentTypeId"
            register={register}
            error={errors.documentTypeId?.message}
            options={typeOptions.map((opt) => ({
              value: opt.id,
              label: opt.name,
            }))}
            highlight={displayHighlights?.documentTypeId}
          />
        </div>
        {/* Row 2: Nr. doc (half) | Date (half) */}
        <div className="grid grid-cols-2 gap-2">
          <Field
            label={cfg.labels.nrDocument}
            name="nrDocument"
            register={register}
            error={errors.nrDocument?.message}
            highlight={displayHighlights?.nrDocument}
          />
          <Field
            label={cfg.labels.dateDocument}
            name="dateDocument"
            type="date"
            register={register}
            error={errors.dateDocument?.message}
            highlight={displayHighlights?.dateDocument}
          />
        </div>
        {/* Row 3: Institution dropdown (Slice #18.16.VL: was free-text) */}
        <SelectField
          label={cfg.labels.institution}
          name="institutionId"
          register={register}
          error={errors.institutionId?.message}
          options={institutionOptions}
          highlight={displayHighlights?.institutionId}
        />
        {/* Row 4: Short Label (right before Notes) */}
        <Field
          label={t("fields.title")}
          name="title"
          register={register}
          error={errors.title?.message}
          highlight={displayHighlights?.title}
        />
        {/* Row 5: Notes (compact) */}
        <TextAreaField
          label={t("fields.notes")}
          name="notes"
          register={register}
          error={errors.notes?.message}
          maxLength={1000}
          rows={2}
          highlight={displayHighlights?.notes}
        />
      </Section>

      {/* ── Titlu de Proprietate specific ────────────────────────────── */}
      {cfg.showTitlu && (
        <Section title={t("sections.titlu")} columns={2}>
          <Field
            label={t("fields.emitent")}
            name="emitent"
            register={register}
            error={errors.emitent?.message}
            highlight={displayHighlights?.emitent}
          />
          <Field
            label={t("fields.bazaLegala")}
            name="bazaLegala"
            register={register}
            error={errors.bazaLegala?.message}
            highlight={displayHighlights?.bazaLegala}
          />
          <Field
            label={t("fields.uatProprietate")}
            name="uatProprietate"
            register={register}
            error={errors.uatProprietate?.message}
            highlight={displayHighlights?.uatProprietate}
          />
          <Field
            label={t("fields.uatProprietar")}
            name="uatProprietar"
            register={register}
            error={errors.uatProprietar?.message}
            highlight={displayHighlights?.uatProprietar}
          />
          <Field
            label={t("fields.suprafata")}
            name="suprafata"
            type="number"
            register={register}
            error={errors.suprafata?.message}
            highlight={displayHighlights?.suprafata}
          />
        </Section>
      )}

      {/* ── Certificat de Moștenitor — merged Succession Details ──────
           Combines the succession-specific fields, the free-text party
           fields, and (outside the fieldset below) the linked-person list.
      ────────────────────────────────────────────────────────────────── */}
      {isMostenitor && (
        <Section title={t("sections.mostenitor")} columns={1}>
          {/* Succession-specific fields in a 2-col row */}
          <div className="grid grid-cols-2 gap-2">
            <Field
              label={t("fields.nrDosarSuccesoral")}
              name="nrDosarSuccesoral"
              register={register}
              error={errors.nrDosarSuccesoral?.message}
              highlight={displayHighlights?.nrDosarSuccesoral}
            />
            <Field
              label={t("fields.nrCertificatDeces")}
              name="nrCertificatDeces"
              register={register}
              error={errors.nrCertificatDeces?.message}
              highlight={displayHighlights?.nrCertificatDeces}
            />
            <Field
              label={t("fields.dataDecesului")}
              name="dataDecesului"
              type="date"
              register={register}
              error={errors.dataDecesului?.message}
              highlight={displayHighlights?.dataDecesului}
            />
            <Field
              label={t("fields.ultimulDomiciliu")}
              name="ultimulDomiciliu"
              register={register}
              error={errors.ultimulDomiciliu?.message}
              highlight={displayHighlights?.ultimulDomiciliu}
            />
          </div>
          {/* Free-text party fields — kept alongside linked persons */}
          <TextAreaField
            label={t("fields.defunctText")}
            name="defunctText"
            register={register}
            error={errors.defunctText?.message}
            rows={2}
            highlight={displayHighlights?.defunctText}
          />
          <TextAreaField
            label={t("fields.partiesBText")}
            name="partiesBText"
            register={register}
            error={errors.partiesBText?.message}
            rows={2}
            highlight={displayHighlights?.partiesBText}
          />
        </Section>
      )}

      {/* ── Standard Succession Details (all other types) ────────────── */}
      {cfg.showMostenitor && !isMostenitor && (
        <Section title={t("sections.mostenitor")} columns={2}>
          <Field
            label={t("fields.nrDosarSuccesoral")}
            name="nrDosarSuccesoral"
            register={register}
            error={errors.nrDosarSuccesoral?.message}
            highlight={displayHighlights?.nrDosarSuccesoral}
          />
          <Field
            label={t("fields.nrCertificatDeces")}
            name="nrCertificatDeces"
            register={register}
            error={errors.nrCertificatDeces?.message}
            highlight={displayHighlights?.nrCertificatDeces}
          />
          <Field
            label={t("fields.dataDecesului")}
            name="dataDecesului"
            type="date"
            register={register}
            error={errors.dataDecesului?.message}
            highlight={displayHighlights?.dataDecesului}
          />
          <Field
            label={t("fields.ultimulDomiciliu")}
            name="ultimulDomiciliu"
            register={register}
            error={errors.ultimulDomiciliu?.message}
            highlight={displayHighlights?.ultimulDomiciliu}
          />
        </Section>
      )}

      {/* ── Contract period (date range) ─────────────────────────────── */}
      {cfg.showDateRange && (
        <Section title={t("sections.dateRange")} columns={2}>
          <Field
            label={t("fields.dateStart")}
            name="dateStart"
            type="date"
            register={register}
            error={errors.dateStart?.message}
            highlight={displayHighlights?.dateStart}
          />
          <Field
            label={t("fields.dateEnd")}
            name="dateEnd"
            type="date"
            register={register}
            error={errors.dateEnd?.message}
            highlight={displayHighlights?.dateEnd}
          />
        </Section>
      )}

      {/* ── Parties (Titular / Defunct / Vânzători–Cumpărători / etc.) ── */}
      {/* ── Parties — CERTIFICAT_MOSTENITOR handled above in merged section ── */}
      {(cfg.showParties || cfg.showDefunct) && !isMostenitor && (
        <Section title={t("sections.parties")} columns={1}>
          {cfg.showDefunct && (
            <TextAreaField
              label={cfg.labels.defunctText ?? t("fields.defunctText")}
              name="defunctText"
              register={register}
              error={errors.defunctText?.message}
              rows={2}
              highlight={displayHighlights?.defunctText}
            />
          )}
          {/* Titular only shows for TITLU_PROPRIETATE */}
          {selectedTypeKey === "TITLU_PROPRIETATE" && (
            <TextAreaField
              label={t("fields.titularText")}
              name="titularText"
              register={register}
              error={errors.titularText?.message}
              rows={2}
              highlight={displayHighlights?.titularText}
            />
          )}
          {cfg.showParties && cfg.labels.partiesAText && (
            <TextAreaField
              label={cfg.labels.partiesAText}
              name="partiesAText"
              register={register}
              error={errors.partiesAText?.message}
              rows={2}
              highlight={displayHighlights?.partiesAText}
            />
          )}
          {cfg.showParties && cfg.labels.partiesBText && (
            <TextAreaField
              label={cfg.labels.partiesBText}
              name="partiesBText"
              register={register}
              error={errors.partiesBText?.message}
              rows={2}
              highlight={displayHighlights?.partiesBText}
            />
          )}
        </Section>
      )}
      </fieldset>

      {submitError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {submitError}
        </p>
      )}
    </form>

    {/* ── Succession Parties panel (CERTIFICAT_MOSTENITOR only) ──────────
         Outside <form> + fieldset so TanStack Query state stays separate
         from React Hook Form. Only rendered once the document is saved. ── */}
    {mode !== "create" && documentId && isMostenitor && (
      <SuccessionPartiesPanel
        documentId={documentId}
        mode={mode === "view" ? "view" : "edit"}
      />
    )}

    {/* ── Pages panel — outside <form> so its TanStack Query re-renders
         never interfere with React Hook Form state. Only shown once the
         document has been saved (documentId present). In big-page mode this
         renders the table/controls only — the viewer moves to the right
         column below. ──────────────────────────────────────────────────── */}
    {mode !== "create" && documentId && (
      <PagesPanel
        documentId={documentId}
        mode={mode === "view" ? "view" : "edit"}
        state={pagesState}
        bigPage={bigPage}
        onToggleBigPage={handleToggleBigPage}
      />
    )}
    </div>

    {/* ── Big-page viewer column — only rendered while "Show Big Page" is
         active. Reads from the same `pagesState` the table above writes to,
         so selecting a row on the left immediately updates the viewer on
         the right. Mirrors PropertyMiniMap's "absolute inset-0" bounding
         box trick for giving its content a concrete pixel height. ──────── */}
    {bigPage && mode !== "create" && documentId && (
      <div className="relative flex-1 min-w-0 overflow-hidden rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="absolute inset-3">
          <PagesViewerBox state={pagesState} fill />
        </div>
      </div>
    )}
    </div>

    {/* ── Action buttons — at the very bottom, full width regardless of
         big-page mode. Hidden in view mode (incl. any read-only historical
         version). The submit button uses form="document-form" so it targets
         the <form> above even though it lives outside it (standard HTML5). ── */}
    {effectiveMode !== "view" && (
      <div className="flex items-center justify-center gap-3 border-t border-crease pt-6 dark:border-zinc-800">
        <button
          type="submit"
          form="document-form"
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
          onClick={() => router.push("/documents")}
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
    </div>
    </FieldPulseContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Shared presentational helpers (same pattern as PropertyForm)
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
  highlight?: HighlightColor;
};

function Field({ label, name, type = "text", register, error, highlight }: FieldProps) {
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
  rows = 3,
  highlight,
}: FieldProps & { maxLength?: number; rows?: number }) {
  const ring = usePulseRing(highlight);
  return (
    <label className="flex items-start gap-2 text-sm">
      <span className="w-36 shrink-0 pt-1 font-medium text-ink dark:text-zinc-300">{label}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <textarea
          {...register(name)}
          maxLength={maxLength}
          rows={rows}
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
          <option value="" disabled hidden />
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
      <span className="w-36 shrink-0 font-medium text-ink dark:text-zinc-300">{label}</span>
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
