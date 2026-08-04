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
import { NavArrowIcon } from "@/components/back-arrow";
import { useUnsavedChangesGuard } from "@/components/providers/unsaved-changes-provider";
import { UnsavedChangesBanner } from "@/components/unsaved-changes-banner";
import { safeMutate } from "@/lib/api/safe-mutate";
import {
  VersionNavControls,
  type VersionNavView,
} from "@/components/version-nav-controls";
import { FieldPulseContext, usePulseRing } from "@/components/versioning/field-pulse";
import type { HighlightColor } from "@/lib/versioning/field-diff";
import type { DocumentSnapshot } from "@/lib/documents/validation";
import { PaginationControls } from "@/components/pagination-controls";
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
import { parseTemplateFields } from "@/lib/documents/template-fields";
import { PagesPanel, PagesViewerBox, usePagesPanelState } from "./pages-panel";
import { SuccessionPartiesPanel } from "./succession-parties-panel";
import { ErrorBoundary, PanelError } from "@/components/error-boundary";
import { inferProvenance } from "@/lib/metadata/provenance-rules";
import { HelpHint } from "@/components/help/help-hint";
import {
  AiPartyLinkerDialog,
  type AiExtractedParty,
  type AiPartyLinkerSummary,
} from "./ai-party-linker-dialog";
import { buttonClass } from "@/lib/ui/button-styles";
import { DevOnly } from "@/components/dev-only";

// ---------------------------------------------------------------------------
// Document type list — fetched dynamically from the admin-managed
// lookup_document_type table (Slice #15.05: no more hardcoded type enum).
// ---------------------------------------------------------------------------

type DocumentTypeOption = {
  id:   string;
  key:  string;
  name: string;
  // Slice #21.03.Import: raw jsonb — parsed via parseTemplateFields before use.
  templateFields?: unknown;
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
// Surveyor person search (Slice #19.03)
// ---------------------------------------------------------------------------

const SURVEYOR_PAGE_SIZE = 10;
type PersonType = "NATURAL" | "JUDICIAL";
type PersonSearchItem = { id: string; code: string; type: PersonType; displayName: string };

async function searchSurveyorPersons(
  name: string,
  code: string,
  type: PersonType,
  page: number,
): Promise<{ items: PersonSearchItem[]; total: number }> {
  const params = new URLSearchParams();
  if (name.trim()) params.set("name", name.trim());
  if (code.trim()) params.set("code", code.trim());
  params.set("type",   type);
  params.set("limit",  String(SURVEYOR_PAGE_SIZE));
  params.set("offset", String(page * SURVEYOR_PAGE_SIZE));
  const res = await fetch(`/api/people/search?${params.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return { items: data.items as PersonSearchItem[], total: data.total as number };
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
  /** Slice #21.02.Import: ISO string if AI-interpret has already run; null otherwise. */
  aiInterpretedAt?: string | null;
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
  aiInterpretedAt,
  onBigPageChange,
  versionNavSlot,
}: Props) {
  const t       = useTranslations("document");
  const tShared = useTranslations("shared");
  const router = useRouter();
  const queryClient = useQueryClient();

  // Shared Pages-panel state — lifted so the panel table and the theater
  // overlay viewer both read/write the same selected-page data.
  const pagesState = usePagesPanelState(documentId);
  const [bigPage, setBigPage] = useState(false);
  // Slice #20.16: Theater overlay — opens a portal full-screen pages viewer.
  const handleToggleBigPage = () => {
    const next = !bigPage;
    setBigPage(next);
    onBigPageChange?.(next);
  };
  const handleCloseTheaterPage = () => { setBigPage(false); onBigPageChange?.(false); };

  // Close theater overlay on Escape key.
  useEffect(() => {
    if (!bigPage) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setBigPage(false); onBigPageChange?.(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bigPage, onBigPageChange]);

  const { data: documentTypes } = useQuery({
    queryKey: ["document-types"],
    queryFn:  fetchDocumentTypes,
    staleTime: 5 * 60 * 1000,
  });
  // Slice #21.03.Import: memoized so the templateFields useMemo below (which
  // depends on typeOptions) doesn't recompute every render — `documentTypes ?? []`
  // would otherwise hand it a fresh array identity each time.
  const typeOptions = useMemo(() => documentTypes ?? [], [documentTypes]);

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
  // Slice #21.04.Import: an associated record (opened via ?readonly=true from
  // another record's association tab) starts read-only with a "Modify" button;
  // clicking it flips this on, which makes effectiveMode resolve to "edit"
  // below without ever changing the `mode` prop itself — `mode === "view"`
  // keeps meaning "this page's identity is an associated record" throughout,
  // which is what gates the cannot-delete-from-here dialog further down.
  const [associatedEditing, setAssociatedEditing] = useState(false);
  const [showCannotDelete,   setShowCannotDelete]   = useState(false);

  // Slice #21.02.Import: AI-Interpret button state.
  // `aiInterpreted` is true once the user has successfully run AI extraction in
  // this session (mirrors the server-side ai_interpreted_at stamp so the button
  // disables immediately without a refetch).
  const [aiInterpreted, setAiInterpreted]   = useState(false);
  const [aiExtracting,  setAiExtracting]    = useState(false);
  const [aiExtractMsg,  setAiExtractMsg]    = useState<string | null>(null);
  const [aiExtractErr,  setAiExtractErr]    = useState<string | null>(null);

  // Slice #21.10.Import: discover-mode state. Kept separate from aiExtracting
  // so the two buttons disable independently, but sharing aiExtractMsg /
  // aiExtractErr — they are the same feedback strip, and only one of the two
  // actions can be running at a time anyway.
  const [aiDiscovering, setAiDiscovering]   = useState(false);

  // Slice #21.04.Import (Slice 2) — parties extracted alongside the fields
  // above, pending admin confirm-or-create via AiPartyLinkerDialog. null =
  // no dialog open; [] never happens (handleAiInterpret only sets this when
  // parties.length > 0).
  const [pendingParties, setPendingParties] = useState<AiExtractedParty[] | null>(null);

  // Slice #19.03 — surveyor picker state
  const [surveyorPickerOpen, setSurveyorPickerOpen] = useState(false);

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

  // Slice #21.03.Import: the selected type's template fields, if any (Phase 3
  // — reintroduces type-specific fields as data, not hardcoded sections).
  const templateFields = useMemo(
    () => parseTemplateFields(
      typeOptions.find((opt) => opt.id === selectedDocumentTypeId)?.templateFields,
    ),
    [typeOptions, selectedDocumentTypeId],
  );

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
    submitting || ((mode === "edit" || associatedEditing) && isOnLatest && !editDirty);

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
    // Slice #21.04.Import: an associated record reverts to its read-only
    // presentation (Back to list + Modify) once the edit is saved — Modify
    // must be clicked again for a further change.
    if (mode === "view") setAssociatedEditing(false);
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

  // ── Slice #21.02.Import: AI-Interpret handler ────────────────────────────
  //
  // Calls the server-side route which reads the first uploaded page from
  // storage and calls Anthropic, then fills the form via form.setValue and
  // PATCHes ai_interpreted_at on the document record.
  const handleAiInterpret = async () => {
    if (!documentId) return;
    setAiExtracting(true);
    setAiExtractMsg(null);
    setAiExtractErr(null);
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}/ai-interpret`, {
        method: "POST",
      });
      if (res.redirected) throw new Error(t("saveErrorSession"));
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const { fields, customFields, notes, parties } = (await res.json()) as {
        fields: Record<string, string | null>;
        customFields: Record<string, string | null>;
        notes: string | null;
        // Slice #21.04.Import (Slice 2) — [] when partyRolesConfigured is
        // false, i.e. this document type has no roles set up yet.
        parties: AiExtractedParty[];
      };

      // Fill form fields from extracted data.
      // documentTypeId first so the form re-renders with the correct type config
      // (and template fields) before other fields are set.
      if (fields.documentTypeId)    form.setValue("documentTypeId",    fields.documentTypeId);
      if (fields.title)             form.setValue("title",             fields.title);
      if (fields.nrDocument)        form.setValue("nrDocument",        fields.nrDocument);
      if (fields.dateDocument)      form.setValue("dateDocument",      fields.dateDocument);
      if (fields.subject)           form.setValue("subject",           fields.subject);

      // Slice #21.03.Import: type-specific values extracted straight into the
      // active type's template fields (falls back to {} when the type has no
      // template yet — nothing to merge in that case).
      if (Object.keys(customFields).length > 0) {
        const current = form.getValues("customFields");
        const merged = { ...current };
        for (const [k, v] of Object.entries(customFields)) {
          if (v) merged[k] = v;
        }
        form.setValue("customFields", merged);
      }

      // Enhanced Notes (Slice #21.03.Import): anything the model couldn't map
      // to a known field (generic or template) is appended here, never
      // overwriting whatever notes were already there.
      if (notes) {
        const currentNotes = form.getValues("notes");
        form.setValue("notes", currentNotes?.trim() ? `${currentNotes.trim()}\n\n${notes}` : notes);
      }

      // Mark as interpreted on the server (non-versioned PATCH).
      await fetch(`/api/documents/${encodeURIComponent(documentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiInterpretedAt: new Date().toISOString() }),
      });

      setAiInterpreted(true);
      setAiExtractMsg(t("aiExtractSuccess"));

      // Slice #21.04.Import (Slice 2) — open the confirm-or-create stepper
      // for any parties the model found. Nothing is linked/created until the
      // admin confirms each one in the dialog.
      if (parties.length > 0) setPendingParties(parties);
    } catch (err) {
      setAiExtractErr(err instanceof Error ? err.message : t("aiExtractError"));
    } finally {
      setAiExtracting(false);
    }
  };

  // ── Slice #21.10.Import: AI-Discover handler ─────────────────────────────
  //
  // Same route as AI Interpret, with { mode: "discover" }. The useful output
  // is the block printed in the terminal running `npm run dev` — this handler
  // only reports the shape of what came back, so the user knows the run
  // finished and roughly what it found without leaving the page.
  //
  // Nothing is written to the form: discover mode reads a document the system
  // does not understand yet, so there are no fields to fill in. It also does
  // not set aiInterpreted — running it must never disable the real AI Interpret
  // button, and it can be re-run as often as needed.
  const handleAiDiscover = async () => {
    if (!documentId) return;
    setAiDiscovering(true);
    setAiExtractMsg(null);
    setAiExtractErr(null);
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}/ai-interpret`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "discover" }),
      });
      if (res.redirected) throw new Error(t("saveErrorSession"));
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const body = (await res.json()) as {
        recognised?:   unknown[];
        sections?:     unknown[];
        skippedPages?: unknown[];
        truncated?:    boolean;
      };
      const skipped = body.skippedPages?.length ?? 0;
      setAiExtractMsg(
        t("aiDiscoverSuccess", {
          pairs:    body.recognised?.length ?? 0,
          sections: body.sections?.length ?? 0,
        }) +
          (skipped > 0 ? ` ${t("aiDiscoverSkipped", { count: skipped })}` : "") +
          (body.truncated ? ` ${t("aiDiscoverTruncated")}` : ""),
      );
    } catch (err) {
      setAiExtractErr(err instanceof Error ? err.message : t("aiDiscoverError"));
    } finally {
      setAiDiscovering(false);
    }
  };

  // Slice #21.04.Import (Slice 2) — called once the dialog has stepped
  // through every party (or the admin closed it early). Refreshes the
  // Persons tab (if mounted) and appends a summary to the existing
  // AI-Interpret success message rather than replacing it.
  const handlePartyLinkerClose = (summary: AiPartyLinkerSummary) => {
    setPendingParties(null);
    if (summary.linked + summary.created > 0) {
      void queryClient.invalidateQueries({ queryKey: ["document-persons", documentId] });
    }
    const summaryText = t("aiPartyLinker.summary", {
      linked:  summary.linked,
      created: summary.created,
      skipped: summary.skipped,
    });
    const note = summary.linked + summary.created > 0 ? ` ${t("aiPartyLinker.addedNote")}` : "";
    setAiExtractMsg((prev) => (prev ? `${prev} ${summaryText}${note}` : `${summaryText}${note}`));
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

  // Slice #21.06.misc: the Pages panel moves into a right-hand column next
  // to the form (instead of stacking full-width below it), stretched to
  // match the left column's height — but only once there's a document to
  // show pages for; a brand-new "create" document has no id yet and no
  // pages, so it keeps the form at full width.
  const showPagesPanel = mode !== "create" && !!documentId;

  // ── Group-name recognition (Slice #21.06.misc) ─────────────────────────
  // The layout below gives three template-field group names special
  // treatment by exact text match (Romanian or English) — Financiar/Taxe și
  // onorarii pair up side by side at half width, Certificate și referințe
  // always renders full-width/auto-grow. Any other group name keeps the
  // generic 2-column rendering, unchanged from before this slice.
  const isFeesGroup = (label: string) => label === "Taxe și onorarii" || label === "Fees";
  const isFinancialGroup = (label: string) => label === "Financiar" || label === "Financial";
  const isCertificatesGroup = (label: string) =>
    label === "Certificate și referințe" || label === "Certificates and references";

  // Bucket the active type's custom fields by group — same first-appearance
  // ordering as before this slice — then pick out the three special-cased
  // groups so the JSX below can lay each out on its own terms.
  const customFieldGroups: { label: string; fields: typeof templateFields }[] = [];
  {
    const byLabel = new Map<string, typeof templateFields>();
    for (const f of templateFields) {
      const groupLabel = f.groupRo || f.groupEn || "";
      let bucket = byLabel.get(groupLabel);
      if (!bucket) {
        bucket = [];
        byLabel.set(groupLabel, bucket);
        customFieldGroups.push({ label: groupLabel, fields: bucket });
      }
      bucket.push(f);
    }
  }
  const feesGroup = customFieldGroups.find((g) => isFeesGroup(g.label));
  const financialGroup = customFieldGroups.find((g) => isFinancialGroup(g.label));
  const certificatesGroup = customFieldGroups.find((g) => isCertificatesGroup(g.label));
  const otherGroups = customFieldGroups.filter(
    (g) => g !== feesGroup && g !== financialGroup && g !== certificatesGroup,
  );

  // Renders one custom field's input — shared by every group below.
  // `forceFullWidthTextarea` is set for Certificate și referințe so every
  // field there gets Vecinătăți's exact full-width/auto-grow treatment,
  // regardless of that field's own configured `type`.
  const renderCustomField = (
    f: (typeof templateFields)[number],
    forceFullWidthTextarea = false,
  ) => {
    const name = `customFields.${f.key}` as unknown as FieldPath<FormValues>;
    const fieldLabel = f.labelRo || f.labelEn || f.key;
    return f.type === "textarea" || forceFullWidthTextarea ? (
      <TextAreaField
        key={f.key}
        label={fieldLabel}
        name={name}
        register={register}
        rows={1}
        watchValue={watchedValues.customFields?.[f.key]}
        fullWidth
      />
    ) : (
      <Field
        key={f.key}
        label={fieldLabel}
        name={name}
        type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
        register={register}
      />
    );
  };

  // ── Taxe și onorarii — always rendered (Slice #21.06.misc): the 3 fields
  // moved out of General (Notariat / Nr. act autentic / Data autentificării
  // — labels per type via cfg.labels), in the order a business user reads
  // them (who/what act, then when, then the fees tied to it), followed by
  // any custom fields the active type groups under "Taxe și onorarii" /
  // "Fees". Uses the matched group's own label when one exists (preserves
  // the admin's exact wording); falls back to the generic i18n title for
  // types with no such template group.
  const feesSection = (
    <Section key="fees" title={feesGroup?.label || t("sections.fees")} columns={1}>
      <SelectField
        label={cfg.labels.institution}
        name="institutionId"
        register={register}
        error={errors.institutionId?.message}
        options={institutionOptions}
        highlight={displayHighlights?.institutionId}
      />
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
      {feesGroup?.fields.map((f) => renderCustomField(f))}
    </Section>
  );

  // When the type also defines a "Financiar" group, the two panels pair up
  // side by side at half width each — the horizontal gap (gap-4) is the
  // same token as the vertical gap between stacked panels, so together they
  // align exactly with a regular full-width panel. Otherwise Taxe și
  // onorarii simply renders alone at full width.
  const feesOrPairedSection = financialGroup ? (
    <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2">
      <Section title={financialGroup.label} columns={1}>
        {financialGroup.fields.map((f) => renderCustomField(f))}
      </Section>
      {feesSection}
    </div>
  ) : (
    feesSection
  );

  const formElement = (
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
      {/* ── General — code shown inline on the heading line (Slice
          #21.06.misc: mirrors Person's Identity heading) + type / subject /
          title / notes. Nr. document / Date / Institution moved out to the
          always-present Taxe și onorarii panel below, for every document
          type. ──────────────────────────────────────────────────────────── */}
      <Section
        title={t("sections.general")}
        code={mode !== "create" ? documentCode : undefined}
        columns={1}
      >
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
        <Field
          label={t("fields.subject")}
          name="subject"
          register={register}
          error={errors.subject?.message}
          highlight={displayHighlights?.subject}
        />
        <Field
          label={t("fields.title")}
          name="title"
          register={register}
          error={errors.title?.message}
          highlight={displayHighlights?.title}
        />
        <TextAreaField
          label={t("fields.notes")}
          name="notes"
          register={register}
          error={errors.notes?.message}
          maxLength={4000}
          rows={1}
          highlight={displayHighlights?.notes}
          watchValue={watchedValues.notes}
        />
      </Section>

      {/* ── Taxe și onorarii (alone or paired with Financiar) ──────────── */}
      {feesOrPairedSection}

      {/* ── Certificate și referințe — every field forced full-width /
          auto-grow (Vecinătăți's exact treatment), whatever `type` is
          configured on it in Reference Data. ──────────────────────────── */}
      {certificatesGroup && (
        <Section title={certificatesGroup.label} columns={1}>
          {certificatesGroup.fields.map((f) => renderCustomField(f, true))}
        </Section>
      )}

      {/* ── Any other template groups — unchanged generic 2-column
          rendering, same as before this slice. ─────────────────────────── */}
      {otherGroups.map(({ label, fields }) => (
        <Section key={label || "_ungrouped"} title={label || t("sections.customFields")} columns={2}>
          {fields.map((f) => renderCustomField(f))}
        </Section>
      ))}

      </fieldset>

      {submitError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {submitError}
        </p>
      )}
    </form>
  );

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
            historyChip:     t("version.historyChip", { n: versions.length }),
            prevVersion:     t("version.prev"),
            nextVersion:     t("version.next"),
            makeCurrent:     t("version.makeCurrent"),
            makeCurrentHint: t("version.makeCurrentHint"),
          }}
        />,
        versionNavSlot,
      )}

    {/* Slice #20.13: sticky "Modificări nesalvate" banner. */}
    <UnsavedChangesBanner show={editDirty} />

    {/* Slice #21.06.misc: the document's own fields sit in the left column;
        once there's a document to show pages for, the Pages panel sits in a
        right-hand column stretched to match the left column's height. The
        "Pagini extinse" button still opens the full-screen theater overlay
        (portal) below — unchanged by this layout. id is used by the submit
        button's form="document-form" attribute, which lets the button live
        outside the <form> element while still submitting this form. */}
    {/* Slice #21.06.misc: left:right went from 2:1 to 3:2 (grid-cols-5,
        col-span-3/2) — combined with the wider outer container in
        document-detail-tabs.tsx, the left panels are ~50% wider and the
        Pages panel ~100% wider than before this change. */}
    {showPagesPanel ? (
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">{formElement}</div>
        <div className="flex flex-col lg:col-span-2">
          <ErrorBoundary fallback={<PanelError>{tShared("errorBoundary.pages")}</PanelError>}>
            <PagesPanel
              documentId={documentId}
              mode={mode === "view" && !associatedEditing ? "view" : "edit"}
              state={pagesState}
              onToggleBigPage={handleToggleBigPage}
              sidebar
            />
          </ErrorBoundary>
        </div>
      </div>
    ) : (
      formElement
    )}

    {/* ── Succession Parties panel (CERTIFICAT_MOSTENITOR only) ──────────
         Outside <form> + fieldset so TanStack Query state stays separate
         from React Hook Form. Only rendered once the document is saved. ── */}
    {mode !== "create" && documentId && isMostenitor && (
      <SuccessionPartiesPanel
        documentId={documentId}
        mode={mode === "view" && !associatedEditing ? "view" : "edit"}
      />
    )}

    {/* Slice #20.16: Theater overlay — full-screen pages viewer portal.
        Reads the same pagesState as the panel above, so selecting a page
        in the overlay immediately reflects in the panel. Dismiss via ✕,
        backdrop, or Escape. */}
    {bigPage && mode !== "create" && documentId && createPortal(
      <div role="dialog" aria-modal="true" aria-label={t("pages.theaterTitle")}>
        {/* Backdrop — click to close */}
        <div
          className="fixed inset-0 z-50 bg-black/50"
          aria-hidden="true"
          onClick={handleCloseTheaterPage}
        />
        {/* Panel */}
        <div
          className="fixed inset-4 z-50 flex flex-col rounded-xl border border-card-rim bg-white shadow-2xl overflow-hidden dark:border-zinc-700 dark:bg-zinc-900"
          style={{ animation: "ga-theater-in 180ms ease" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-4 px-4 py-2 border-b border-crease dark:border-zinc-700 bg-white dark:bg-zinc-900">
            <span className="text-sm font-semibold text-ink dark:text-zinc-200">
              {t("pages.theaterTitle")}
            </span>
            <button
              type="button"
              onClick={handleCloseTheaterPage}
              aria-label={t("pages.theaterClose")}
              className={buttonClass({ variant: "secondary", size: "sm" })}
            >
              ✕ {t("pages.theaterClose")}
            </button>
          </div>
          {/* Viewer fills the rest */}
          <div className="relative flex-1 min-h-0">
            <div className="absolute inset-0 p-3">
              <ErrorBoundary fallback={<PanelError>{tShared("errorBoundary.pages")}</PanelError>}>
                <PagesViewerBox state={pagesState} fill />
              </ErrorBoundary>
            </div>
          </div>
        </div>
      </div>,
      document.body
    )}

    {/* ── Action buttons — at the very bottom, full width. In true read-only
         view (opened via ?readonly=true from an association list) this shows
         a Back-to-list button (left) + Modify button (right). Once Modify is
         clicked (associatedEditing), it shows Back-to-list (left) + Save/
         Delete (right) — no Cancel (Back-to-list covers that) and no
         AI-Interpret (not offered on an associated record). When effectiveMode
         is "view" only because an earlier historical version is being viewed
         (mode is still "edit"), nothing renders here — the version nav arrows
         are the way back, matching the person/property forms. The submit
         button uses form="document-form" to target the <form> above. ── */}
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
          <button
            type="button"
            onClick={() => setAssociatedEditing(true)}
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
            form="document-form"
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
      <div className="flex flex-col items-center gap-2 border-t border-crease pt-6 dark:border-zinc-800">
        <div className="flex items-center justify-center gap-3">
          <button
            type="submit"
            form="document-form"
            disabled={saveDisabled}
            className={buttonClass({ variant: "primary", size: "lg" })}
          >
            {t("buttons.save")}
          </button>
          {mode === "edit" && (
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
            onClick={() => router.push("/documents")}
            disabled={submitting}
            className={buttonClass({ variant: "secondary", size: "lg" })}
          >
            {t("buttons.cancel")}
          </button>

          {/* Slice #21.02.Import: AI-Interpret button — only in edit mode on a
              saved document. Hidden entirely for text/coordinate files.
              Disabled with tooltip when no pages are uploaded;
              disabled (different label) once already processed. */}
          {mode === "edit" && documentId && (() => {
            const isAlreadyInterpreted = !!(aiInterpretedAt) || aiInterpreted;
            const hasPages = pagesState.pages.length > 0;
            // Text files (coordinate cadastral files) cannot be AI-interpreted.
            const hasTextOnlyPages = hasPages && pagesState.pages.every(
              (p) => p.fileName.toLowerCase().endsWith(".txt"),
            );
            // Slice #21.10.Import: either AI action locks both buttons — they
            // hit the same route and the same rate-limit bucket.
            const busy = aiExtracting || aiDiscovering;
            // Don't show button at all for text files
            if (hasTextOnlyPages) return null;
            if (isAlreadyInterpreted) {
              return (
                <button
                  type="button"
                  disabled
                  className={buttonClass({ variant: "secondary", size: "lg" })}
                >
                  {t("buttons.aiInterpreted")}
                </button>
              );
            }
            return (
              <span
                title={!hasPages ? t("hints.aiInterpretNoPages") : undefined}
                className="inline-flex"
              >
                <button
                  type="button"
                  disabled={!hasPages || busy}
                  onClick={handleAiInterpret}
                  className={buttonClass({ variant: "primary", size: "lg" })}
                >
                  {busy ? t("aiExtracting") : t("buttons.aiInterpret")}
                </button>
                <HelpHint hintKey="ai-interpret-once" />
              </span>
            );
          })()}

          {/* Slice #21.10.Import: AI-Discover — reads a document whose type the
              system does not understand yet and prints everything it can read
              to the dev-server console. Deliberately NOT gated on
              aiInterpretedAt the way AI Interpret is: it writes nothing, so
              re-running it is always safe and is often exactly what you want
              (e.g. after adding template fields, to see what is still
              unrecognised). Hidden for text-only documents for the same reason
              AI Interpret is — those pages can never reach the model. */}
          <DevOnly>
            {mode === "edit" && documentId && (() => {
              const hasPages = pagesState.pages.length > 0;
              const hasTextOnlyPages = hasPages && pagesState.pages.every(
                (p) => p.fileName.toLowerCase().endsWith(".txt"),
              );
              if (hasTextOnlyPages) return null;
              const busy = aiExtracting || aiDiscovering;
              return (
                <span
                  title={!hasPages ? t("hints.aiInterpretNoPages") : t("hints.aiDiscover")}
                  className="inline-flex"
                >
                  <button
                    type="button"
                    disabled={!hasPages || busy}
                    onClick={handleAiDiscover}
                    className={buttonClass({ variant: "secondary", size: "lg" })}
                  >
                    {aiDiscovering ? t("aiDiscovering") : t("buttons.aiDiscover")}
                  </button>
                </span>
              );
            })()}
          </DevOnly>
        </div>

        {/* Inline feedback for AI extraction */}
        {aiExtractMsg && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
          >
            <span className="mt-0.5 shrink-0">✓</span>
            <span>{aiExtractMsg}</span>
          </div>
        )}
        {aiExtractErr && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
          >
            <span className="mt-0.5 shrink-0 font-bold">!</span>
            <span>{aiExtractErr}</span>
          </div>
        )}
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

    {/* Slice #21.04.Import: an associated document can't be deleted from this
        (readonly-opened) page — it must be disassociated first, then deleted
        from its own page via the left navigation panel. Info-only dialog
        (no noLabel/onNo) — a single OK button dismisses it. */}
    {showCannotDelete && (
      <ConfirmDialog
        title={t("cannotDeleteAssociated.title")}
        body={t("cannotDeleteAssociated.body")}
        yesLabel={t("cannotDeleteAssociated.ok")}
        onYes={() => setShowCannotDelete(false)}
        busy={false}
      />
    )}

    {/* Slice #21.04.Import (Slice 2) — AI-detected party confirm-or-create
        stepper. Opens automatically once handleAiInterpret sees a non-empty
        parties array; nothing is linked or created until the admin confirms
        each party one at a time. */}
    {pendingParties && documentId && (
      <AiPartyLinkerDialog
        documentId={documentId}
        parties={pendingParties}
        onClose={handlePartyLinkerClose}
      />
    )}

    {/* Slice #19.03 — surveyor picker dialog */}
    {surveyorPickerOpen && (
      <SurveyorPickerDialog
        onSelect={(person) => {
          form.setValue("surveyorId",         person.id);
          form.setValue("surveyorName",       person.displayName);
          form.setValue("surveyorPersonType", person.type);
          setSurveyorPickerOpen(false);
        }}
        onClose={() => setSurveyorPickerOpen(false)}
        t={t}
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
  code,
  columns = 2,
  children,
}: {
  title:    string;
  /** Slice #21.06.misc: shown inline on the heading line, mirroring how
   *  Person's Identity section shows its personCode — used by General to
   *  show documentCode instead of as its own field row. */
  code?:    string | null;
  columns?: 1 | 2 | 3 | 4;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">
        {title}
        {code && (
          <span className="font-mono text-xs font-normal normal-case text-fade dark:text-zinc-500">
            {code}
          </span>
        )}
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
          // All content here is Romanian legal/notarial text — the browser's
          // spell-checker (English by default) flags most of it as errors.
          spellCheck={false}
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
  // Slice #21.06.misc: default dropped from 3 to 1 — `rows` is a hard
  // *minimum* height (the auto-grow effect can only grow scrollHeight
  // beyond it, never shrink below it), so a 3-row floor made every short
  // field look identically tall regardless of how little content it held.
  // 1 row lets a field genuinely shrink to fit a single short line too.
  rows = 1,
  highlight,
  watchValue,
  fullWidth,
}: FieldProps & { maxLength?: number; rows?: number; watchValue?: string | null; fullWidth?: boolean }) {
  const ring = usePulseRing(highlight);
  const registered = register(name);
  const elRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-grow to fit content instead of a fixed `rows` box with internal
  // scroll — full paragraphs (e.g. a boundary/vecinătăți description, or
  // Enhanced Notes after AI Interpret appends text) are fully visible
  // without scrolling inside a tiny box. Keyed on `watchValue` (passed by
  // the caller from form.watch()) rather than a native 'input' listener so
  // this also resizes when a field is filled programmatically via
  // form.setValue (AI Interpret), which doesn't dispatch a DOM input event.
  //
  // Slice #21.06.misc: a single mount-time measurement could come out wrong
  // (too small) and then stick forever, since this effect only re-runs when
  // `watchValue` changes again — not on its own. Two known causes: the
  // browser may still be showing a fallback font when this first runs (web
  // fonts load asynchronously; the real font can wrap text differently once
  // it swaps in), and the element's layout may not have fully settled yet
  // right after mount. Re-measuring once more on the next animation frame
  // and again once fonts finish loading fixes both without needing the user
  // to type something first to trigger a resize.
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const resize = () => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };
    resize();
    let cancelled = false;
    const raf = requestAnimationFrame(() => {
      if (!cancelled) resize();
    });
    if (typeof document !== "undefined" && document.fonts) {
      document.fonts.ready.then(() => {
        if (!cancelled) resize();
      });
    }
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [watchValue]);

  return (
    <label
      className={[
        "flex items-start gap-2 text-sm",
        // Span both columns of the enclosing 2-column grouped Section, so this
        // field renders at full section width instead of a half-width cell —
        // used for longer free-text fields (e.g. vecinătăți) that read better
        // as wide as Enhanced Notes rather than squeezed into one column.
        fullWidth ? "sm:col-span-2" : "",
      ].join(" ")}
    >
      <span className="w-36 shrink-0 pt-1 font-medium text-ink dark:text-zinc-300">{label}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <textarea
          {...registered}
          ref={(el) => {
            registered.ref(el);
            elRef.current = el;
          }}
          maxLength={maxLength}
          rows={rows}
          // Same rationale as Field above — Romanian text, English spell-checker.
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          className={[
            "w-full resize-none overflow-hidden rounded-md border bg-white px-2 py-1 shadow-sm focus:outline-none disabled:bg-canvas disabled:text-fade disabled:cursor-default dark:bg-zinc-950 dark:disabled:bg-zinc-800",
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
          // Bug fix: `options` loads asynchronously (useQuery). This <select>
          // is uncontrolled — react-hook-form's `register` assigns the DOM
          // element's initial value once, at mount/ref-attach time. If that
          // happens before `options` has arrived (e.g. a hard/direct
          // navigation with a cold query cache), no <option> matches the
          // real value yet, the browser silently drops the selection, and
          // once the real options are appended afterwards the browser
          // defaults to the first one — which visually looks like the field
          // got reset, even though the underlying form value never changed.
          // Keying on whether options have loaded forces a clean remount
          // once they arrive, so register's initial-value assignment runs
          // again against the now-populated list and the select displays the
          // correct option instead of the first list entry.
          key={options.length > 0 ? "loaded" : "loading"}
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

// ---------------------------------------------------------------------------
// Surveyor row + two-step picker dialog (Slice #19.03)
// ---------------------------------------------------------------------------

type TFunc = ReturnType<typeof useTranslations<"document">>;

// NOTE (Slice #21.03.Import): SurveyorRow (the trigger UI for the picker
// below) was removed here — its only caller was the Surveyor section dropped
// in Phase 1. SurveyorPickerDialog itself is left in place (still referenced
// via `{surveyorPickerOpen && <SurveyorPickerDialog .../>}` further up, even
// though nothing sets surveyorPickerOpen true anymore) as ready-to-reuse
// scaffolding if a future template field type wants a person-picker.

type SurveyorPickerStep = "choose-type" | "search";

function SurveyorPickerDialog({
  onSelect,
  onClose,
  t,
}: {
  onSelect: (person: PersonSearchItem) => void;
  onClose:  () => void;
  t:        TFunc;
}) {
  const [step,           setStep]           = useState<SurveyorPickerStep>("choose-type");
  const [personType,     setPersonType]     = useState<PersonType>("NATURAL");
  const [nameFilter,     setNameFilter]     = useState("");
  const [codeFilter,     setCodeFilter]     = useState("");
  const [page,           setPage]           = useState(0);

  const [debouncedName, setDebouncedName] = useState("");
  const [debouncedCode, setDebouncedCode] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedName(nameFilter), 300);
    return () => clearTimeout(id);
  }, [nameFilter]);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedCode(codeFilter), 300);
    return () => clearTimeout(id);
  }, [codeFilter]);

  const searchQuery = useQuery({
    queryKey:  ["surveyor-search", personType, debouncedName, debouncedCode, page],
    queryFn:   () => searchSurveyorPersons(debouncedName, debouncedCode, personType, page),
    enabled:   step === "search",
    staleTime: 30_000,
  });

  const handleChooseType = (type: PersonType) => {
    setPersonType(type);
    setPage(0);
    setNameFilter("");
    setCodeFilter("");
    setDebouncedName("");
    setDebouncedCode("");
    setStep("search");
  };

  const items = searchQuery.data?.items ?? [];
  const total = searchQuery.data?.total ?? 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="surveyor-picker-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="flex w-full max-w-lg flex-col gap-3 rounded-lg bg-card p-5 shadow-xl dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h3 id="surveyor-picker-title" className="text-base font-semibold text-ink dark:text-zinc-100">
            {t("surveyorPicker.title")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className={buttonClass({ variant: "bare", size: "md" })}
            aria-label={t("surveyorPicker.cancel")}
          >
            ✕
          </button>
        </div>

        {step === "choose-type" ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-fade dark:text-zinc-400">
              {t("surveyorPicker.stepChooseType")}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleChooseType("NATURAL")}
                className={buttonClass({ variant: "secondary", size: "lg", className: "flex-1" })}
              >
                {t("surveyorPicker.btnNatural")}
              </button>
              <button
                type="button"
                onClick={() => handleChooseType("JUDICIAL")}
                className={buttonClass({ variant: "secondary", size: "lg", className: "flex-1" })}
              >
                {t("surveyorPicker.btnJudicial")}
              </button>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className={buttonClass({ variant: "secondary", size: "lg" })}
              >
                {t("surveyorPicker.cancel")}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-xs font-medium text-ink dark:text-zinc-300">
                {t("surveyorPicker.labelName")}
                <input
                  type="text"
                  value={nameFilter}
                  onChange={(e) => { setNameFilter(e.target.value); setPage(0); }}
                  placeholder={t("surveyorPicker.namePlaceholder")}
                  className="rounded-md border border-wire bg-white px-2 py-1 text-sm shadow-sm focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-ink dark:text-zinc-300">
                {t("surveyorPicker.labelCode")}
                <input
                  type="text"
                  value={codeFilter}
                  onChange={(e) => { setCodeFilter(e.target.value); setPage(0); }}
                  placeholder={t("surveyorPicker.codePlaceholder")}
                  className="rounded-md border border-wire bg-white px-2 py-1 text-sm shadow-sm focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
            </div>

            <div className="max-h-64 overflow-y-auto rounded-md border border-wire dark:border-zinc-700">
              {searchQuery.isLoading ? (
                <p className="p-3 text-sm text-fade">{t("surveyorPicker.loading")}</p>
              ) : searchQuery.isError ? (
                <p className="p-3 text-sm text-red-600">{t("surveyorPicker.error")}</p>
              ) : items.length === 0 ? (
                <p className="p-3 text-sm text-fade">{t("surveyorPicker.resultsEmpty")}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-canvas dark:bg-zinc-800">
                    <tr>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-fade">{t("surveyorPicker.colCode")}</th>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-fade">{t("surveyorPicker.colName")}</th>
                      <th className="px-3 py-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr
                        key={item.id}
                        className="border-t border-wire hover:bg-canvas dark:border-zinc-700 dark:hover:bg-zinc-800"
                      >
                        <td className="px-3 py-1.5 font-mono text-xs text-fade">{item.code}</td>
                        <td className="px-3 py-1.5 text-ink dark:text-zinc-200">{item.displayName}</td>
                        <td className="px-3 py-1.5 text-right">
                          <button
                            type="button"
                            onClick={() => onSelect(item)}
                            className={buttonClass({ variant: "primary", size: "xs" })}
                          >
                            {t("surveyorPicker.select")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {total > SURVEYOR_PAGE_SIZE && (
              <PaginationControls
                page={page}
                pageSize={SURVEYOR_PAGE_SIZE}
                total={total}
                onPrev={() => setPage((p) => p - 1)}
                onNext={() => setPage((p) => p + 1)}
              />
            )}

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep("choose-type")}
                className={buttonClass({ variant: "secondary", size: "md" })}
              >
                {t("surveyorPicker.back")}
              </button>
              <button
                type="button"
                onClick={onClose}
                className={buttonClass({ variant: "secondary", size: "md" })}
              >
                {t("surveyorPicker.cancel")}
              </button>
            </div>
          </div>
        )}
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
