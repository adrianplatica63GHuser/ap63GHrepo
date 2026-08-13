"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
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
import {
  isCertificatesGroup,
  isFeesGroup,
  isFinancialGroup,
} from "@/lib/documents/template-groups";
import {
  documentTypeNeedsFormHint,
  documentTypeOptionLabel,
} from "@/lib/documents/status";
import { PagesPanel, PagesViewerBox, usePagesPanelState } from "./pages-panel";
import { SuccessionPartiesPanel } from "./succession-parties-panel";
import { ErrorBoundary, PanelError } from "@/components/error-boundary";
import { inferProvenance } from "@/lib/metadata/provenance-rules";
import { buttonClass } from "@/lib/ui/button-styles";
import {
  DiscoverReviewDialog,
  type DiscoverReviewPair,
  type NewTypeProgress,
} from "./discover-review-dialog";

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
  /**
   * ⚠️ Kept in the contract and no longer READ here.   (Slice #26.09)
   *
   * It gated the AI Interpret button, and that button is gone: all AI
   * interpretation happens automatically during an import run now. The prop
   * stays because the page still passes it and #26.12 derives a document's
   * status from exactly this stamp — removing it and putting it back is churn
   * with a rename hiding in it.
   */
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
  // Slice #27.04: the names alone, for the review dialog's duplicate-name
  // refusal. Memoized because it is a prop of a dialog that must not re-render
  // more than it has to while a three-write save is in flight — not because
  // anything downstream memoizes on its identity.
  const typeNames = useMemo(() => typeOptions.map((opt) => opt.name), [typeOptions]);
  /**
   * Every `template_fields` key any document type declares.      (Slice #27.04)
   *
   * Read by `valuesForSave` to tell an orphaned custom-field value — one that
   * belongs to a template this document has moved off — from a value whose key
   * no template mentions, which is either freshly accepted and not yet in this
   * cache or left behind by a field an administrator removed. The first is
   * dropped on a re-type; the second two are the user's and are kept.
   */
  const someTypeDeclares = useMemo(
    () =>
      new Set(
        typeOptions.flatMap((opt) => parseTemplateFields(opt.templateFields).map((f) => f.key)),
      ),
    [typeOptions],
  );

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

  // Slice #21.10.Import: discover-mode state. Slice #26.09 removed the AI
  // Interpret button beside it — all AI interpretation now happens
  // automatically during an import run — so `aiExtracting`, `aiInterpreted` and
  // the pending-parties queue went with it, and this feedback strip has one
  // writer left rather than two.
  const [aiDiscovering, setAiDiscovering]   = useState(false);
  // Slice #26.11: the last discovery run, held until its review dialog is
  // closed. Non-null IS the open flag — a separate boolean would be a second
  // piece of state saying the same thing, free to drift out of step with the
  // data the dialog renders.
  const [discoverResult, setDiscoverResult] = useState<{
    pairs:          DiscoverReviewPair[];
    // Slice #27.04: the model's own short Romanian name for what it read. The
    // route has returned it since #21.10 and this component discarded it; it is
    // what the review step pre-fills the new-type name box with.
    documentLabel:  string | null;
    partyRoleNames: string[];
    skippedPages:   number;
    truncated:      boolean;
  } | null>(null);
  const [aiExtractMsg,  setAiExtractMsg]    = useState<string | null>(null);
  const [aiExtractErr,  setAiExtractErr]    = useState<string | null>(null);
  /**
   * A document type the review dialog created on the server, and whether it
   * also managed to move this document onto it.                 (Slice #27.04)
   *
   * ⚠️ **Applied on close, never while the dialog is mounted.** The dialog's
   * React `key` is the selected type id, so writing the new id into the form
   * field would unmount it mid-save and take every tick, rename and in-flight
   * write with it. A ref rather than state for the same reason: this must not
   * repaint anything until the dialog is gone.
   *
   * Every status other than `moved` is a real and reachable state, and none of
   * them touches the form: the document is still on its old type, or nobody
   * can say which type it is on. They are still worth carrying — the type list
   * has to learn about a row that exists, and the warning has to outlive the
   * dialog that is about to be closed on top of it.
   */
  const pendingNewTypeRef = useRef<NewTypeProgress | null>(null);
  /**
   * Custom-field keys the review step has just accepted onto the type, not yet
   * visible in the cached type list.                            (Slice #27.04)
   *
   * ⚠️ **`valuesForSave` must never strip one of these, and "no type declares
   * it" is not a good enough test for that.** Discovery slugs keys from printed
   * Romanian labels — `suprafata`, `notar`, `valoare` — which collide across
   * types in this archive, so a freshly accepted key can be declared by some
   * unrelated third type while the type being saved has not caught up yet. That
   * made the value the user had just confirmed against the page vanish from the
   * patch, and then from the form, under a green tick. Remembering the keys is
   * exact where the cache is only approximate. Cleared on a successful save,
   * after which the refetched template speaks for them.
   *
   * ⚠️ **Scoped to the type they were accepted ONTO, and that is the whole
   * point of the object.** A bare set of keys is an exemption from the orphan
   * rule that outlives the type it belongs to: accept fields onto type A, then
   * pick type B in the dropdown and save, and A's keys ride into B's
   * `custom_fields` — the exact orphaning this exemption sits inside a guard
   * against.
   */
  const justAcceptedKeysRef = useRef<{ typeId: string; keys: Set<string> } | null>(null);
  /**
   * The document may or may not have been re-typed, and nothing here can tell.
   *                                                             (Slice #27.04)
   *
   * While it is set, `doSave` leaves `documentTypeId` and `customFields` out of
   * the patch: every value the form could send for them is a guess, and one of
   * the two guesses silently reverts a write the server already made.
   *
   * ⚠️ **While it is set, the type dropdown and every custom-field input are
   * DISABLED**, so the user cannot make an edit to those two that this form
   * would then have to refuse or drop. That is what lets the rest of the form
   * go on saving normally, and what makes "save and leave" through the
   * unsaved-changes guard safe: there is never a contested edit to lose.
   *
   * ⚠️ **It does NOT survive this component being unmounted, and a review round
   * argued both sides of that.** Parking it in the query cache so it survived
   * the tab strip's unmount latched on states it had no business locking — a
   * later legitimate re-type re-armed it for the rest of the session, with the
   * banner explaining it long gone — and expired on its own after react-query's
   * five-minute GC regardless. `router.refresh()` in `applyPendingNewType` is
   * the real answer: it makes the server's own row the thing a remount reads.
   * The residual window — a tab switch inside that round-trip — is in the
   * handover.
   */
  const [typeMoveUnresolved, setTypeMoveUnresolved] = useState(false);

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
  // Slice #27.02: ONE lookup, memoized. Three separate `.find()` calls already
  // asked three questions about the same row, and this slice's question — does
  // this type have a form? — would have been the fourth. That is the point at
  // which a repetition has become a pattern worth removing.
  const selectedType = useMemo(
    () => typeOptions.find((opt) => opt.id === selectedDocumentTypeId),
    [typeOptions, selectedDocumentTypeId],
  );
  const selectedTypeKey = selectedType?.key;
  const cfg = getTypeConfig(selectedTypeKey);
  // True only for CERTIFICAT_MOSTENITOR — drives the merged Succession Details section.
  const isMostenitor = selectedTypeKey === "CERTIFICAT_MOSTENITOR";

  // Slice #21.03.Import: the selected type's template fields, if any (Phase 3
  // — reintroduces type-specific fields as data, not hardcoded sections).
  const templateFields = useMemo(
    () => parseTemplateFields(selectedType?.templateFields),
    [selectedType],
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

  // Slice #27.02: a document whose pages are ALL .txt never reaches the model,
  // so #26.11 hides the Descoperire AI button for it. Hoisted out of that
  // button's own IIFE by a review round, because the hint below has to answer
  // the same question and two copies of it would eventually disagree — the hint
  // would name a control the page deliberately does not render.
  const hasTextOnlyPages = pagesState.pages.length > 0
    && pagesState.pages.every((p) => p.fileName.toLowerCase().endsWith(".txt"));

  // Slice #27.02: does the SELECTED type have no custom form — and is this a
  // screen where saying so helps?
  //
  // ⚠️ `templateFields.length > 0` is the same answer computed a second time,
  // and a second computation is exactly what #26.12 wrote `documentTypeHasForm`
  // to prevent: the Reference Data label, the colour beside it and this hint are
  // one decision. `documentTypeNeedsFormHint` is that decision, inverted once,
  // in the module that owns it — including the part that says a MISSING row is
  // not a formless one.
  //
  // ⚠️ **Everything in front of it is about the SCREEN, not the type.** The
  // line the conditions draw, after three review rounds, is *not* "only where
  // the Descoperire AI button is rendered" — create mode has no button and
  // keeps the hint deliberately. It is: **suppress it where the feature is
  // unreachable from this document at all, show it everywhere the user is one
  // ordinary step away.**
  //
  //   `effectiveMode !== "view"`  — nothing here is editable. This covers an
  //     earlier version (where the action row at the bottom of this file renders
  //     NOTHING: its ternary is `effectiveMode === "view" ? (mode === "view" &&
  //     <Back/Modifică>) : mode === "view" ? (<Back/Save/Delete>) :
  //     (<Save/Delete/Cancel/Descoperire AI>)`, and an earlier version takes the
  //     first arm with `mode === "edit"`, so it renders `false`) and an
  //     associated record before Modifică. Round two. **This is why the whole
  //     block lives HERE, below `effectiveMode`:** reading it before its `const`
  //     is a TDZ crash on every render, not a lint warning.
  //     There is deliberately no `mode !== "view"` beside it. Round three showed
  //     it was subsumed in five of six states and wrong in the sixth — an
  //     associated record AFTER Modifică is an editable picker, and it was
  //     marking the options while withholding the sentence that explains them.
  //   `!pagesState.isLoading`     — until the pages arrive, "not text-only" is a
  //     guess. This does NOT remove the reflow (the hint still inserts when the
  //     answer lands, as it already did when the type list landed); what it
  //     removes is a sentence that renders and then turns out to have been
  //     wrong.
  //   `!hasTextOnlyPages`         — the model cannot read this document at all,
  //     ever, so #26.11 hides the button permanently. The one case where the
  //     feature is genuinely unreachable rather than one step away.
  //
  // A document with NO pages keeps the hint, and that is the same decision as
  // create mode rather than an oversight: the button is there and disabled, one
  // upload away, and its own tooltip says so ("Adăugați pagini pentru a folosi
  // AI"). Round three would rather the sentence named that step; that is a copy
  // decision for Ciprian, not a gate.
  const showNoFormHint = effectiveMode !== "view"
    && !pagesState.isLoading
    && !hasTextOnlyPages
    && documentTypeNeedsFormHint(selectedType);

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
          // Slice #27.04: version navigation is frozen while nobody can say
          // which type this document is on. Not because reading an old version
          // is unsafe — it is a read — but because the AI feedback strip that
          // explains the lock is only rendered on the latest version, so one
          // press of ◀ took the explanation away and left "Fă versiunea
          // curentă" greyed out with nothing on the page saying why.
          canPrev: effectiveVersion > 0 && !navLocked && !typeMoveUnresolved,
          canNext:
            latestVersion !== null &&
            effectiveVersion < latestVersion &&
            !navLocked &&
            !typeMoveUnresolved,
          onPrev: () => goToVersion(effectiveVersion - 1),
          onNext: () => goToVersion(effectiveVersion + 1),
          // Slice #27.04: "Make current" is a third door into `doSave`, and it
          // re-saves a HISTORICAL snapshot — including that snapshot's
          // `documentTypeId`, which is by definition the old type. Blocked for
          // as long as nobody can say which type this document is on.
          canMakeCurrent: !isOnLatest && !typeMoveUnresolved,
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

  /**
   * The values a save would actually send, once a re-type has been accounted
   * for.                                                        (Slice #27.04)
   *
   * ⚠️ **`custom_fields` is written WHOLE by `toApiPayload`, and the form
   * keeps whatever the PREVIOUS type's template put there.** So changing the
   * type in the dropdown and pressing Save carried the old type's keys onto the
   * new one: persisted, snapshotted into every later `document_version`,
   * rendered on no screen and editable from none. It is the same orphaning
   * `runAiInterpret` clears on its own re-type and the one this slice's review
   * step clears on its — the dropdown is the third door into that column, and
   * it was the one still open. A review round found it by noticing that this
   * slice's own recovery message ("pick the new type and save") walked the user
   * straight into it.
   *
   * ⚠️ **Only when the type CHANGED since the last saved state, and a
   * later review round is why.** Filtering on every save looked tidier and was
   * wrong: it deleted the values of a field an administrator had removed under
   * #27.03 — recoverable until then by re-adding the field — on the next
   * unrelated save of every document of the type. Gated on the re-type, an
   * ordinary save sends the column exactly as it found it.
   *
   * ⚠️ **And only keys that some OTHER document type declares, which is
   * narrower again.** "Not on the new type" is not the same question as "left
   * over from another type", and the difference is two real flows. A user who
   * changes the type by hand and THEN runs discovery has freshly accepted keys
   * in the form that the cached `templateFields` will not carry until the type
   * list refetches; and a field an administrator removed under #27.03 leaves
   * values whose key no template mentions at all. Both belong to no template as
   * far as this component can see, and emptying them would delete — under a
   * banner saying they had just been filled in, in the first case — exactly
   * what the user had confirmed against the page. A key that some type in the
   * list DOES declare, and the selected one does not, is the orphan.
   *
   * ⚠️ **Every type in the list, not just the last saved one.** Keyed on the
   * type this document was saved under, a second change before a save escaped:
   * A → B (fill in B's fields) → C → Save wrote B's keys into C's
   * `custom_fields`, because B was neither the type left nor the type joined.
   *
   * Filtered, not emptied: a user who switches type and then fills in the NEW
   * type's fields before saving keeps everything they typed.
   *
   * ⚠️ **`selectedType` must be loaded.** `templateFields` is derived from
   * the document-types query, and is `[]` for every type while that is in
   * flight; filtering against it then would empty the column.
   */
  const valuesForSave = (values: FormValues): FormValues => {
    // ⚠️ Create mode is IN, not out. `baseline.values.documentTypeId` is "" on
    // /documents/new, so the first pick makes this true and every later change
    // of mind is caught — and it needs to be: `shouldUnregister` is off, so the
    // template fields of a type the user filled in and then moved away from are
    // still in `_formValues` when Save fires, and would be written into the
    // brand-new document's `custom_fields` and its first version snapshot.
    const retypedByHand = values.documentTypeId !== baseline.values.documentTypeId;
    // ⚠️ **A flip BACK to the saved type is a re-type too.** Change the
    // dropdown to A, accept fields onto A through the review step, then change
    // it back to B and save: `retypedByHand` is false, nothing is filtered, and
    // A's keys land in a B document's `custom_fields` with real values in them.
    // The accepted keys carry the type they were accepted onto, so the question
    // "is this document still on that type?" is answerable exactly.
    const acceptedElsewhere =
      justAcceptedKeysRef.current !== null &&
      justAcceptedKeysRef.current.typeId !== values.documentTypeId;
    if ((!retypedByHand && !acceptedElsewhere) || !selectedType) return values;
    return {
      ...values,
      customFields: Object.fromEntries(
        Object.entries(values.customFields).filter(
          ([key]) =>
          !someTypeDeclares.has(key) ||
          (justAcceptedKeysRef.current?.typeId === values.documentTypeId &&
            justAcceptedKeysRef.current.keys.has(key)) ||
          templateFields.some((f) => f.key === key),
        ),
      ),
    };
  };

  // doSave performs the API call only (no navigation) so it can be reused by
  // the Save button (onSubmit), the unsaved-changes guard, and "Make Current".
  //
  // Slice #27.04: returns the values it SENT rather than a bare boolean, so the
  // callers that reset `baseline` record what the server actually has. Handing
  // them the unfiltered values instead left the form permanently dirty against
  // a column it had just stripped.
  const doSave = async (values: FormValues): Promise<FormValues | null> => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      /**
       * The two columns nobody can vouch for.                    (Slice #27.04)
       *
       * After a `moveUnresolved` ending the server may or may not have re-typed
       * this document and cleared its `custom_fields`, and this form cannot
       * tell — so whichever value it holds for those two is a guess, and one of
       * the two guesses silently reverts a write that landed.
       *
       * ⚠️ **Always left OUT of the patch, and never reported as saved.** Three
       * review rounds pushed this around and both extremes were wrong. Blocking
       * every save stranded Titlu / Subiect / Note edits behind a button whose
       * only escapes threw them away — and, because this dialog opens on the
       * SELECTED type, a user who had changed the dropdown before running
       * discovery was blocked on every save from then on, under two banners
       * promising the other fields still saved. Sending the reduced patch and
       * then baselining the form as if it had all gone was worse: the contested
       * edit vanished with every signal saying it had been written.
       *
       * What is honest is neither: the unrelated work is saved, the two
       * uncertain columns are not sent, and `baseline` KEEPS ITS OLD VALUES for
       * them — so if the user has changed either, the form stays visibly dirty
       * on exactly that change and Save stays lit, which is true. It is unsaved,
       * and it stays unsaved until the reload the banner asks for settles which
       * type this document is on.
       *
       * `documentUpdateSchema` is a partial and `updateDocument` writes only the
       * keys present, so an omitted column keeps whatever the server has.
       * Make-current and Descoperire AI stay blocked outright: both are about
       * the type itself, and neither has anything else to save.
       */
      const uncertainColumns = typeMoveUnresolved && mode !== "create";
      const valuesToSave = valuesForSave(values);
      const fullPayload = toApiPayload(valuesToSave);
      // Destructured rather than `delete`d: both keys are required on the
      // payload type, and `documentTypeId` is the one field a CREATE cannot do
      // without — which `uncertainColumns` already excludes.
      const {
        documentTypeId: _uncertainType,
        customFields:   _uncertainFields,
        ...withoutUncertainColumns
      } = fullPayload;
      void _uncertainType;
      void _uncertainFields;
      const payload = uncertainColumns ? withoutUncertainColumns : fullPayload;
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
      // Keep the form itself in step with what was sent. Without this the
      // stripped keys stay in React Hook Form, `editDirty` compares them
      // against a baseline that no longer has them, and Save stays lit for ever
      // over a difference the user cannot see or act on.
      //
      // ⚠️ **The stripped keys are REMOVED; the survivors are left alone.**
      // Writing `valuesToSave.customFields` back whole would replace the record
      // with a snapshot taken before the request went out — and the inputs stay
      // live throughout a PATCH and two awaited invalidations, so anything
      // typed in that window would vanish, with `setBaseline` marking the form
      // clean over the top of it. Removing only what was dropped leaves an
      // in-flight edit intact and correctly dirty.
      if (valuesToSave !== values && !uncertainColumns) {
        const live = form.getValues("customFields");
        form.setValue(
          "customFields",
          Object.fromEntries(
            Object.entries(live).filter(([key]) => key in valuesToSave.customFields),
          ),
          { shouldDirty: false },
        );
      }
      // The refetched template speaks for them from here on.
      justAcceptedKeysRef.current = null;
      // ⚠️ What the SERVER now has, which is what the callers baseline against.
      // The two omitted columns were not written, so the baseline keeps the
      // values it already had for them — reporting the form's instead would
      // mark a change clean that never left the browser.
      return uncertainColumns
        ? {
            ...valuesToSave,
            documentTypeId: baseline.values.documentTypeId,
            customFields:   baseline.values.customFields,
          }
        : valuesToSave;
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    const saved = await doSave(values);
    if (!saved) return;

    if (mode === "create") {
      router.push("/documents");
      router.refresh();
      return;
    }

    // Slice #18.06: edit mode stays on the document so the freshly-appended
    // version is visible. Reset the clean baseline to the just-saved state (so
    // version nav unlocks), follow the new latest, and refresh server-rendered
    // bits (e.g. the page title if the document's label changed).
    setBaseline({ values: saved });
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
    const saved = await doSave(values);
    if (!saved) {
      setConfirmMakeCurrent(false);
      return;
    }
    // Bug 1: pulse the restored change once the new version refetches in.
    pendingPulseRef.current = makeCurrentNextNumber;
    setBaseline({ values: saved });
    setViewingVersion(null);
    setConfirmMakeCurrent(false);
    router.refresh();
  };

  // ── Slice #26.09: the AI-Interpret handler is gone ──────────────────────
  //
  // It called the same route AI Discover does, in its default "extract" mode,
  // filled the form from the answer, stamped `aiInterpretedAt` and opened the
  // party stepper. All of that now happens during the import run itself —
  // `src/lib/import/ai-interpret-run.ts` — so the button here would be a second
  // way to do one thing, which is how two answers to one question start to
  // drift. AI Discover stays: it writes nothing, and #26.11 makes it the way a
  // document type gets its custom form.

  // ── Slice #21.10.Import: AI-Discover handler ─────────────────────────────
  //
  // Same route as AI Interpret, with { mode: "discover" }. The useful output
  // is the block printed in the terminal running `npm run dev` — this handler
  // only reports the shape of what came back, so the user knows the run
  // finished and roughly what it found without leaving the page.
  //
  // Nothing is written to the form: discover mode reads a document the system
  // does not understand yet, so there are no fields to fill in. Nothing is
  // stamped either, so it can be re-run as often as needed — which #26.11
  // relies on, and which is why the AI Interpret button's once-per-document
  // rule never applied to it even while that button existed.
  const handleAiDiscover = async () => {
    if (!documentId) return;
    setAiDiscovering(true);
    setAiExtractMsg(null);
    setAiExtractErr(null);
    // Drop the previous run before starting a new one: without this, a second
    // run would leave the dialog showing the FIRST run's rows while claiming to
    // be the second's. (The reason given here used to be that nothing in this
    // app traps focus. Untrue since #26.11 — the review dialog does — but the
    // line still has to be here for the ordinary case where the dialog is
    // closed and the button is simply pressed twice.)
    setDiscoverResult(null);
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}/ai-interpret`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "discover" }),
      });
      // ⚠️ NOTHING FROM THE SERVER IS SHOWN VERBATIM.   (Slice #26.11)
      //
      // This route serves an API and most of its failures are English, some of
      // them Anthropic's own words: "ANTHROPIC_API_KEY is not configured on the
      // server", "Anthropic API returned no text", a 529 overload. That was
      // fine while the button was <DevOnly> and a developer was the only
      // reader. It is Ciprian's screen now, so every branch lands on copy from
      // this namespace, and the generic one is the default rather than the
      // unreachable fallback it used to be (a thrown Error is always an Error,
      // so the old `err instanceof Error` ternary never chose the Romanian).
      if (res.redirected) {
        setAiExtractErr(t("saveErrorSession"));
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { code?: string };
        if (res.status === 429 || body.code === "rate_limited_local") {
          setAiExtractErr(t("aiDiscoverErrorBusy"));
        } else if (body.code === "no_pages") {
          setAiExtractErr(t("aiDiscoverErrorNoPages"));
        } else if (body.code === "unsupported_file_type") {
          setAiExtractErr(t("aiDiscoverErrorUnreadable"));
        } else if (body.code === "no_api_key") {
          setAiExtractErr(t("aiDiscoverErrorNotConfigured"));
        } else {
          setAiExtractErr(t("aiDiscoverError"));
        }
        return;
      }
      const body = (await res.json()) as {
        recognised?:     DiscoverReviewPair[];
        sections?:       unknown[];
        skippedPages?:   unknown[];
        truncated?:      boolean;
        partyRoleNames?: unknown[];
        // Slice #27.04 — read at last. See `documentLabel` on discoverResult.
        documentLabel?:  unknown;
      };
      const skipped = body.skippedPages?.length ?? 0;
      // Slice #26.11: the pairs no longer stop at a console report — they open
      // the review step that turns them into this type's form. A run that found
      // nothing has nothing to review, so it stays a one-line message; the
      // skipped/truncated warnings ride along with whichever of the two the
      // user actually sees.
      const pairs = (body.recognised ?? []).filter(
        (p): p is DiscoverReviewPair => !!p && typeof p.name === "string",
      );
      if (pairs.length === 0) {
        setAiExtractMsg(
          t("aiDiscoverNothing") +
            (skipped > 0 ? ` ${t("aiDiscoverSkipped", { count: skipped })}` : "") +
            (body.truncated ? ` ${t("aiDiscoverTruncated")}` : ""),
        );
      } else {
        setDiscoverResult({
          pairs,
          // Slice #27.04: the schema allows null and the model may return an
          // empty string, so anything that is not a usable name becomes null and
          // the review step opens with an empty box rather than a blank name it
          // would then have to reject.
          documentLabel:
            typeof body.documentLabel === "string" && body.documentLabel.trim()
              ? body.documentLabel.trim()
              : null,
          // The type's person roles. The review step shows a row matching one
          // as already captured rather than offering it as free text — the
          // import links those to real Person records, and a second editable
          // copy of a name and CNP on every document of the type is the thing
          // src/lib/import/id-card.ts exists to refuse.
          partyRoleNames: (body.partyRoleNames ?? []).filter(
            (n): n is string => typeof n === "string",
          ),
          skippedPages: skipped,
          truncated:    body.truncated === true,
        });
      }
    } catch {
      // A dropped connection or a gateway timeout rejects the fetch itself,
      // whose message is the browser's own "Failed to fetch".
      setAiExtractErr(t("aiDiscoverError"));
    } finally {
      setAiDiscovering(false);
    }
  };

  /**
   * Bring the form into line with what the review dialog already wrote.
   *                                                             (Slice #27.04)
   *
   * Called from `onClose` and from `onSaved` — after the dialog has been told
   * to unmount, never before. Returns what it applied so the caller can name
   * the type in its message, or null when there was nothing pending.
   *
   * ⚠️ **The new row is written into the cache before the refetch is asked
   * for.** `documentTypeId` is about to point at a type the cached list does
   * not contain, and until the refetch lands `selectedType` would be
   * `undefined` — a type dropdown showing nothing selected and a custom-fields
   * section with no fields, directly under a message saying the type was
   * created. Seeding the row costs one line and closes that window; the
   * invalidate right after it replaces the guess with the server's answer.
   *
   * ⚠️ **`customFields` is cleared here too, and not clearing it is a data
   * bug rather than a cosmetic one.** The server has already emptied
   * `document.custom_fields` — the values belonged to the OLD type's template.
   * The values in React Hook Form did not go anywhere, and this form writes the
   * column WHOLE on save (`toApiPayload`), so leaving them would put the old
   * type's keys straight back on the next Save, on a document that no longer
   * has a form to show them in.
   *
   * ⚠️ **`shouldDirty: false`, and the baseline moves with them.** Both writes
   * have already happened on the server, so they are not a pending edit: marking
   * them dirty would arm the unsaved-changes guard over a change the user
   * cannot discard, and leaving the baseline behind would keep Save lit for ever
   * on a document nobody had edited.
   */
  const applyPendingNewType = (): NewTypeProgress | null => {
    const pending = pendingNewTypeRef.current;
    if (!pending) return null;
    pendingNewTypeRef.current = null;
    /**
     * ⚠️ **`router.refresh()` on every ending, and it is load-bearing.**
     *
     * This component is unmounted by its own tab strip — `document-detail-
     * tabs.tsx` renders it only while the Details tab is showing — and on
     * remount `baseline` re-initialises from `initialValues`, a SERVER-RENDERED
     * prop. Nothing else in this slice refreshes that prop, so a click on
     * Persoane and back reinstated the pre-re-type document: the corrections
     * written below were gone, the red banner was gone, and the next ordinary
     * Save PATCHed the old `documentTypeId` and the old `custom_fields` back
     * over a re-type the server had made. Refreshing makes the server's answer
     * the one a remount reads, whichever ending this is — including
     * `moveUnresolved`, where the server is the only thing that knows.
     */
    router.refresh();
    if (pending.status === "unresolved") {
      // A type that MIGHT exist. Refresh the list so the user can go and look,
      // which is what the message tells them to do; assume nothing else.
      queryClient.invalidateQueries({ queryKey: ["document-types"] });
      return pending;
    }
    const type = pending.type;
    // The row exists on the server whether or not the document reached it, so
    // the dropdown must be able to offer it either way — that is what the
    // failure message tells the user to go and do.
    queryClient.setQueryData<DocumentTypeOption[]>(["document-types"], (prev) =>
      prev && !prev.some((opt) => opt.id === type.id)
        ? [...prev, { id: type.id, key: type.key, name: type.name, templateFields: [] }]
        : prev,
    );
    queryClient.invalidateQueries({ queryKey: ["document-types"] });
    // ⚠️ `moved` AND `movedFieldsUnknown` write into the form; the other two do
    // not. The two that do are the two where the re-type itself is CERTAIN —
    // `movedFieldsUnknown` is only ever reported after write 2 returned moved,
    // and doubts write 3 alone. `created` means the document is still on its old
    // type; `moveUnresolved` means nobody knows which type it is on, and writing
    // a guess there is how the wrong `documentTypeId` gets PATCHed back by the
    // next ordinary Save — which is exactly what leaving `movedFieldsUnknown`
    // out of this branch did: the form kept the old type over a document the
    // server had already moved.
    if (pending.status !== "moved" && pending.status !== "movedFieldsUnknown") return pending;
    form.setValue("documentTypeId", type.id, { shouldDirty: false });
    form.setValue("customFields",   {},      { shouldDirty: false });
    setBaseline((prev) => ({
      values: { ...prev.values, documentTypeId: type.id, customFields: {} },
    }));
    // The document list and this document's version history both moved. Not
    // awaited — nothing here depends on them.
    queryClient.invalidateQueries({ queryKey: ["documents"] });
    queryClient.invalidateQueries({ queryKey: ["document-versions"] });
    return pending;
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
      // Slice #27.04: no special case. While `typeMoveUnresolved` is set the two
      // uncertain columns are disabled AND reset to the baseline (see where the
      // state is set), so there is never a pending edit to them for this door to
      // drop — and a refusal here would have rendered as the provider's generic
      // "could not save", blocking the Titlu / Note work the banner beside it
      // promises still saves.
      const valid = await form.trigger();
      if (!valid) return false;
      return (await doSave(form.getValues())) !== null;
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
  //
  // Slice #27.03: the three names moved to `@/lib/documents/template-groups`
  // and the local arrow functions became imports. Nothing about the matching
  // changed — it is the same exact-text test on the same six strings. What
  // changed is that Reference Data → Document Types now lets an administrator
  // put a field in one of these groups from a keyboard, and it offers them BY
  // NAME from that module. Had the names stayed spelled out here, the picker
  // would have been a second copy of them, and a copy that drifted by one
  // diacritic would cost a type this layout with nothing to see in a diff.

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
    // Slice #27.04: the type-specific inputs are the second half of what a
    // `moveUnresolved` ending cannot save — see `typeMoveUnresolved`.
    return f.type === "textarea" || forceFullWidthTextarea ? (
      <TextAreaField
        key={f.key}
        label={fieldLabel}
        name={name}
        register={register}
        rows={1}
        watchValue={watchedValues.customFields?.[f.key]}
        fullWidth
        disabled={typeMoveUnresolved}
      />
    ) : (
      <Field
        key={f.key}
        label={fieldLabel}
        name={name}
        type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
        register={register}
        disabled={typeMoveUnresolved}
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
          // Slice #27.04: not while nobody can say which type this document is
          // already on — a change here could not be saved, and swallowing it
          // silently was the worse of the two answers a review round tried.
          disabled={typeMoveUnresolved}
          error={errors.documentTypeId?.message}
          options={typeOptions.map((opt) => ({
            value: opt.id,
            // Slice #27.02: the types that HAVE a form say so; every other
            // option is its own name, unchanged. Which way round that goes, and
            // why, is argued in `documentTypeOptionLabel` — it is not a detail
            // to re-decide here.
            //
            // ⚠️ **Every option, with no carve-out, and two review rounds went
            // round the houses before settling there.** Both carve-outs that
            // were tried are recorded here so the next round does not re-try
            // them:
            //
            //   `effectiveMode === "view" ? opt.name : …` — meant to keep the
            //     mark out of a read-only document's Tip field. It covered the
            //     two rare screens and left the ordinary document page, which is
            //     `mode="edit"`, marked exactly as before.
            //   `opt.id === selectedDocumentTypeId ? opt.name : …` — meant to
            //     keep it out of the CLOSED control, since a native <select>
            //     renders the chosen option's label as its own text. But the
            //     same <option> is the highlighted row in the OPEN list, so it
            //     opted the user's own type out of the scheme: on a document
            //     whose type HAS a form, every other form-having type read
            //     "(are formular)" and theirs read as though it had none.
            //
            // The requirement is about picking — "a user picking a document type
            // can see which types have a custom form" — so the picker has to be
            // consistent, and that decides it. What the mark then also does in
            // the closed field is not pollution but the positive half of this
            // slice: the hint below speaks only when there is NO form, so
            // "(are formular)" is the only place a user is told there IS one.
            label: documentTypeOptionLabel(
              opt.name,
              opt.templateFields,
              (name) => t("typeForm.optionHasForm", { name }),
            ),
          }))}
          highlight={displayHighlights?.documentTypeId}
          // Slice #27.02: shown for a type with no custom form, wherever the
          // feature is reachable — see `showNoFormHint` for the line that draws.
          // In create mode the Descoperire AI button is not on the page yet, and
          // the hint shows anyway: the goal is that the user is told BEFORE the
          // first save, so the sentence names the feature rather than pointing
          // at a control.
          hint={showNoFormHint ? t("typeForm.noFormHint") : undefined}
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

          {/* Slice #21.10.Import: AI-Discover — reads a document whose type the
              system does not understand yet and reports everything it can
              read. The run itself still writes nothing (the full report also
              still goes to the dev-server console), so re-running it is always
              safe and is often exactly what you want — e.g. after accepting a
              form, to see what is STILL unrecognised. Nothing is persisted
              until the review dialog below is accepted, which is why this
              button is not gated on `aiInterpretedAt` and must not become so.
              Hidden for text-only documents: those pages never reach the
              model.

              Slice #26.09 removed the AI Interpret button that stood beside it,
              and #26.11 took this one out of `DevOnly`: it is no longer a
              developer diagnostic but the only way a USER can give a document
              type a custom form — the other writer of `template_fields` is a
              deliberate admin API call, which is Adrian with a terminal — so a
              business user must be able to reach it. The
              route's own dev-tools 404 went with the wrapper — a hidden button
              and a missing endpoint were one decision, and it is reversed
              here in one place, not two. */}
          {mode === "edit" && documentId && (() => {
            const hasPages = pagesState.pages.length > 0;
            // Slice #27.02: `hasTextOnlyPages` moved up to the component body —
            // the type field's hint has to answer the same question, and it must
            // answer it the same way.
            if (hasTextOnlyPages) return null;
            // One writer since #26.09 — see the state block. It stays a named
            // `busy` rather than being inlined because the disabled test also
            // carries `!hasPages`, and two conditions read better apart.
            const busy = aiDiscovering;
            return (
              <span
                title={!hasPages ? t("hints.aiInterpretNoPages") : t("hints.aiDiscover")}
                className="inline-flex"
              >
                <button
                  type="button"
                  // Slice #27.04: also blocked while nobody can say which type
                  // this document is on. A re-run would open the review step on
                  // `selectedDocumentTypeId` — which in that state is the type
                  // the document was being rescued FROM — and its first press
                  // clears the very banner explaining why not to.
                  disabled={!hasPages || busy || typeMoveUnresolved}
                  onClick={handleAiDiscover}
                  className={buttonClass({ variant: "secondary", size: "lg" })}
                >
                  {aiDiscovering ? t("aiDiscovering") : t("buttons.aiDiscover")}
                </button>
              </span>
            );
          })()}
        </div>

        {/* Inline feedback for AI Discover — its only writer since #26.09. */}
        {aiExtractMsg && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
          >
            <span className="mt-0.5 shrink-0">✓</span>
            <span>{aiExtractMsg}</span>
          </div>
        )}
        {/* Slice #26.11: the review step. Rendered from `discoverResult`, so it
            appears the moment a run comes back with something and disappears
            when the user decides — there is no third state to get wrong.

            The type it writes to is the one SELECTED IN THE FORM, not the one
            stored on the document, and the dialog names it in its own title
            for exactly that reason: a user who changed the dropdown without
            saving is told which type is about to gain a form. Discover mode
            never sends the type to the model (see the route's comment on
            typeHintText), so nothing about the read depends on this choice. */}
        {discoverResult && selectedDocumentTypeId && documentId && (
          <DiscoverReviewDialog
            key={selectedDocumentTypeId}
            pairs={discoverResult.pairs}
            documentId={documentId}
            documentLabel={discoverResult.documentLabel}
            typeId={selectedDocumentTypeId}
            typeName={selectedType?.name ?? ""}
            // Slice #27.04: so an exact duplicate name is refused before the
            // type is created. The list is already in hand — the form renders
            // its dropdown from it.
            existingTypeNames={typeNames}
            existing={templateFields}
            partyRoleNames={discoverResult.partyRoleNames}
            skippedPages={discoverResult.skippedPages}
            truncated={discoverResult.truncated}
            onTypesChanged={() => {
              queryClient.invalidateQueries({ queryKey: ["document-types"] });
            }}
            // Slice #27.04: recorded, not applied — see pendingNewTypeRef.
            onNewTypeProgress={(progress) => {
              pendingNewTypeRef.current = progress;
            }}
            onClose={() => {
              setDiscoverResult(null);
              // ⚠️ Reaching close with something pending means the run stopped
              // PART WAY — a complete one goes through onSaved. The dialog said
              // so in red and has just been unmounted, so the page has to say
              // it again, and as a failure: the green tick beside "the type was
              // created" would read as a finished job on a document whose
              // fields were discarded and whose form is empty.
              const applied = applyPendingNewType();
              if (applied) {
                if (applied.status === "moveUnresolved") {
                  setTypeMoveUnresolved(true);
                  // ⚠️ Put the two uncertain columns back to the last saved
                  // state, and say so in the message below. An edit to either
                  // that was pending when this ending arrived cannot be written
                  // — `doSave` leaves both columns out of the patch — so leaving
                  // it on screen, in a control that is now disabled, would show
                  // the user a value they can neither save nor revert, and hand
                  // the unsaved-changes guard something to silently drop on the
                  // way out. Undone here, while the reason is on screen.
                  form.setValue("documentTypeId", baseline.values.documentTypeId, {
                    shouldDirty: false,
                  });
                  // ⚠️ Every key the form currently HOLDS, not just the ones the
                  // baseline has. React Hook Form pushes an object `setValue`
                  // into the DOM key by key over the object it is GIVEN, so a
                  // key absent from the baseline — every field accepted in an
                  // earlier discovery run and left unsaved — would keep its
                  // value on screen while leaving form state, in a disabled
                  // input, under a banner saying it had been undone.
                  const cleared: Record<string, string> = {};
                  for (const key of Object.keys(form.getValues("customFields"))) cleared[key] = "";
                  form.setValue(
                    "customFields",
                    { ...cleared, ...baseline.values.customFields },
                    { shouldDirty: false },
                  );
                  justAcceptedKeysRef.current = null;
                }
                setAiExtractErr(
                  applied.status === "moved"
                    ? t("aiDiscoverNewTypeNoFields",   { type: applied.type.name })
                    : applied.status === "created"
                      ? t("aiDiscoverNewTypeNotMoved", { type: applied.type.name })
                      : applied.status === "moveUnresolved"
                        ? t("aiDiscoverNewTypeMoveUnknown", { type: applied.type.name })
                        : applied.status === "movedFieldsUnknown"
                          ? t("aiDiscoverNewTypeFieldsUnknown", { type: applied.type.name })
                          : t("aiDiscoverNewTypeUnknown", { type: applied.name }),
                );
              }
            }}
            onSaved={(savedFieldCount, values) => {
              setDiscoverResult(null);
              // Only a `moved` progress can reach here — the other three all
              // stop the save — but the message is built from the status rather
              // than from its existence, so a future fourth cannot slip a
              // half-finished run under a green tick.
              const applied = applyPendingNewType();
              setAiExtractMsg(
                (applied?.status === "moved" || applied?.status === "movedFieldsUnknown"
                  ? `${t("aiDiscoverNewType", { type: applied.type.name })} `
                  : "") + t("aiDiscoverSaved", { count: savedFieldCount }),
              );
              // The form renders its custom section from this query's payload,
              // so refetching is what makes the new fields appear without a
              // reload — and it is an invalidate rather than a local patch
              // because the server renumbered `order` and may have dropped a
              // duplicate key, so its answer is the truth, not ours.
              queryClient.invalidateQueries({ queryKey: ["document-types"] });
              // ⚠️ AND FILL THEM IN, on THIS document.
              //
              // Without this the document that produced the discovery is the
              // one document of its type that nothing can fill: the
              // per-document AI-Interpret button went in #26.09, and
              // `runAiInterpret` only runs inside an import. The user would
              // have read each value on screen, accepted it, and been handed
              // the same values back as empty boxes to retype.
              //
              // Left UNSAVED on purpose — this marks the form dirty and the
              // user still presses Save, which is the same confirmation every
              // other edit on this page gets. `shouldDirty` is explicit for
              // that reason.
              justAcceptedKeysRef.current = {
                // The type they landed on: the one this run wrote to, which is
                // the new one when the run created it and the selected one
                // otherwise.
                typeId:
                  applied?.status === "moved" || applied?.status === "movedFieldsUnknown"
                    ? applied.type.id
                    : selectedDocumentTypeId,
                keys:   new Set(Object.keys(values)),
              };
              for (const [key, value] of Object.entries(values)) {
                form.setValue(
                  `customFields.${key}` as unknown as FieldPath<FormValues>,
                  value,
                  { shouldDirty: true },
                );
              }
            }}
          />
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
  /**
   * Slice #27.04: read-only for a reason the page states elsewhere. Used for
   * the document-type select and the type-specific inputs while
   * `typeMoveUnresolved` is set — the two things this form cannot save then, so
   * the honest move is not to let them be edited rather than to swallow the
   * edit afterwards. Every control here already carries `disabled:` styling.
   */
  disabled?:  boolean;
};

function Field({ label, name, type = "text", register, error, highlight, disabled }: FieldProps) {
  const ring = usePulseRing(highlight);
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="w-36 shrink-0 font-medium text-ink dark:text-zinc-300">{label}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <input
          type={type}
          {...register(name)}
          disabled={disabled}
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
  disabled,
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
          disabled={disabled}
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
  hint,
  disabled,
}: FieldProps & {
  options: { value: string; label: string }[];
  /**
   * Slice #27.02: a plain statement about the chosen option, rendered under the
   * control. NOT a validation message — it is muted body text with no icon and
   * no colour, because the only caller uses it to say a document type has no
   * custom form, which is the correct and permanent answer for several types.
   */
  hint?: string;
}) {
  const ring = usePulseRing(highlight);
  // Slice #27.02: an explicit id, and a <label htmlFor> instead of a <label>
  // wrapping the whole field. Two things a review round caught, both fixed by
  // the same change:
  //   • Everything inside a wrapping <label> is the control's ACCESSIBLE NAME.
  //     The error text already joined it; a full sentence of hint would have
  //     made the field announce itself as its own help text. Named by the label
  //     alone now, described by the hint and the error.
  //   • A click anywhere inside a wrapping <label> activates the control, so in
  //     Chrome selecting the hint text to read it pops the dropdown open over
  //     the form. Outside the label, the sentence is just a sentence.
  const fieldId = useId();
  const hintId  = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");
  return (
    // `items-start` once a hint is present, so the label sits on the select's
    // line instead of drifting to the middle of a two-line block — the same
    // treatment TextAreaField above gives its own taller control.
    <div className={`flex gap-2 text-sm ${hint ? "items-start" : "items-center"}`}>
      <label
        htmlFor={fieldId}
        className={`w-36 shrink-0 font-medium text-ink dark:text-zinc-300${hint ? " pt-1" : ""}`}
      >
        {label}
      </label>
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
          // Keying on the options forces a clean remount when they change, so
          // register's initial-value assignment runs again against the
          // now-populated list and the select displays the correct option
          // instead of the first list entry.
          //
          // ⚠️ **Slice #27.04: keyed on the COUNT, not on loaded-vs-loading.**
          // The original key only remounted on 0 → N. #27.04 added an N → N+1
          // case: creating a document type from the discovery review seeds the
          // new row into the query cache and writes its id into this field in
          // the same handler, before React has appended the `<option>`. The
          // select's `selectedIndex` goes to −1, and when the option arrives the
          // browser resets the selection to the FIRST entry — so the field
          // showed an unrelated type under a banner announcing the new one,
          // with `_formValues` correct all along. Counting closes it: any change
          // to the list remounts, and register re-assigns against the real list.
          key={options.length}
          id={fieldId}
          {...register(name)}
          disabled={disabled}
          // Slice #27.02: the hint AND the error, in that order. Before this the
          // error was announced only because it happened to fall inside the
          // wrapping <label>; naming the field properly would have silently
          // dropped it, which is how an accessibility fix becomes a regression.
          aria-describedby={describedBy || undefined}
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
        {hint && (
          <span id={hintId} className="text-xs text-fade dark:text-zinc-400">{hint}</span>
        )}
        {error && (
          <span id={errorId} className="text-xs text-red-600 dark:text-red-400">{error}</span>
        )}
      </div>
    </div>
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
