"use client";

import { SystemIdCorner } from "@/components/record/system-id-corner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { RightColumn } from "@/components/tiles/tile-areas";
import { tileSurface } from "@/lib/ui/tile-surface";
import {
  type FieldPath,
  type FieldErrors,
  type UseFormRegister,
  useForm,
  useWatch,
} from "react-hook-form";
import { ArrowLeft, Building2, Minimize2, MousePointerClick, Pencil, Save, Trash2, User, X } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
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
import { parseTemplateFields, selectOptionsForValue } from "@/lib/documents/template-fields";
import {
  isCertificatesGroup,
  isFeesGroup,
  isFinancialGroup,
} from "@/lib/documents/template-groups";
import {
  feesPairStaysTogether,
  tabIndexOfFeesPair,
  tabIndexOfPanel,
  templateTabsOf,
} from "@/lib/documents/template-tabs";
import {
  documentTypeNeedsFormHint,
  documentTypeOptionLabel,
} from "@/lib/documents/status";
import { typeMayHoldAForm } from "@/lib/import/discover-run";
import { documentTypeIsIdCard } from "@/lib/import/id-card";
import { PagesPanel, PagesViewerBox, usePagesPanelState } from "./pages-panel";
import { SuccessionPartiesPanel } from "./succession-parties-panel";
import { ErrorBoundary, PanelError } from "@/components/error-boundary";
import { inferProvenance } from "@/lib/metadata/provenance-rules";
import { buttonClass } from "@/lib/ui/button-styles";
import { GrowingText } from "@/components/forms/growing-text";
import {
  DOCUMENT as DOC,
  PAGES_PANEL_STYLE,
  PANEL_GAP,
  PANEL_UNITS,
  PANEL_UNIT_INNER_REM,
  boxRem,
  boxStyle,
  packFieldRows,
  rem,
  rowRem,
  stackedBoxStyle,
  templateFieldWidth,
  unitRowStyle,
  unitStyle,
  unitsInnerRem,
  type FieldWidth,
} from "@/lib/ui/field-widths";
import { STACKED_FIELD_CLASS, STACKED_LABEL_CLASS, STACKED_ROW_CLASS } from "@/lib/ui/stacked";
import { forgetRecentlyViewed } from "@/components/providers/navigation-history-provider";
import { firstErrorPath } from "@/lib/ui/tiles";
import { panelSubtitle } from "@/lib/ui/panel-subtitle";
import { tileOfTabIndex, type DocumentLayout } from "./document-tiles";
import { RecordSyncNotice, useRecordSaveSync } from "@/components/record-save-sync";

/**
 * Slice #37.20 — the `order` a panel takes in the page's tile row. A notebook
 * tile is `display: contents` around its panels, so the tile itself cannot
 * carry an order: each of its panels does, read from here. Undefined outside
 * tile mode, where nothing is reordered.
 */
const PanelOrderContext = createContext<number | undefined>(undefined);

/**
 * Slice #37.31 — inside a notebook tile's frame. A notebook tile is ONE frame
 * titled with its tab's name, holding its panels as sections; a `Section` in
 * here draws no border of its own and is its units' inner width, so the frame
 * (`w-fit`) comes out exactly as many whole units as its widest panel.
 */
const FrameContext = createContext(false);

/** The fees panel's own fields — where a highlight or an error on them is shown. */
const FEES_FIELDS: ReadonlySet<string> = new Set(["institutionId", "nrDocument", "dateDocument"]);

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

// ⚠️ **`res.redirected` as well as `!res.ok`.**                 (Slice #34.04)
// An expired session answers with a redirect to the login page, whose HTML
// parses to `{}` — and `body.items ?? []` then reads as "the archive holds
// none", so React Query caches a SUCCESSFUL EMPTY ARRAY and the dropdown is
// silently empty with no error for the length of its staleTime. Fixed in
// passing: #34.04 made this class of failure its subject and measured it on the
// keys it shares, and `person-role-flags.test.ts` now asserts the guard on
// EVERY read of the value-lists endpoint rather than on the ones it happened
// to touch.
async function fetchDocumentTypes(): Promise<DocumentTypeOption[]> {
  const res = await fetch("/api/admin/value-lists/document-types");
  if (res.redirected || !res.ok) throw new Error(`Failed to load document types (HTTP ${res.status})`);
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
  if (res.redirected || !res.ok) throw new Error(`Failed to load institutions (HTTP ${res.status})`);
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
  /**
   * Slice #37.85: the reader is a superuser — the one reader told that a type
   * has no form, and where to build one. Decided on the server
   * (`canConfigureRoles()`), as the role-configuration note decides its own.
   */
  isSuperuser?:     boolean;
  /** Notified whenever the "Show Big Page" toggle changes, so the parent
   *  (DocumentDetailTiles) can widen the page's outer container — mirrors
   *  PropertyForm's onBigMapChange. */
  onBigPageChange?: (bigPage: boolean) => void;
  /** Slice #18.06 — header DOM node to portal the version-nav controls into,
   *  so they render on the document-name line. */
  versionNavSlot?:  HTMLElement | null;
  /**
   * Slice #37.20: the screen's tiles, when the form is drawn as tiles (the
   * saved document's page, `document-detail-tiles.tsx`). Absent on „Adaugă
   * act", which keeps its notebook.
   *
   * As tiles there is no notebook strip: the general data is one tile, each
   * notebook tab another (a type with none: one tile for its own fields), the
   * page image and — on a Certificat de Moștenitor — the parties one each. The
   * notebook's own rules (`templateTabsOf`, the fees pair) still decide which
   * tile a panel is on: a tile is a tab drawn beside the others.
   *
   * ⚠️ **A TILE THAT IS NOT SHOWN IS HIDDEN, NEVER UNMOUNTED** — the
   * notebook's rule since #36.01, for its reasons: react-hook-form values,
   * `editDirty`, the version-diff highlights and the field pulses are computed
   * over inputs that are on the page.
   *
   * The form reports what only it knows — the type on screen and which tiles
   * hold a framed field — through `onLayout`; the page builds the tile row from
   * that.
   */
  tiles?: {
    shown: readonly string[];
    labels: Readonly<Record<string, string>>;
    /** A tile's place in the row (its `order`). */
    order: (tile: string) => number;
    /** Show a hidden tile for this visit — an error has been found in it. */
    onRevealTile: (tile: string) => void;
    onLayout: (layout: DocumentLayout, highlightedTiles: string[]) => void;
    /** Slice #37.56: the right-hand column — the page image is placed there (`<TileAreas>`). */
    right?: RightColumn;
  };
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DocumentForm({
  mode,
  documentId,
  documentCode,
  initialValues,
  isSuperuser = false,
  onBigPageChange,
  versionNavSlot,
  tiles,
}: Props) {
  const t       = useTranslations("document");
  // Slice #37.20 — tile mode. `tileProps` marks a tile for the specs and hides
  // it when unticked; `hidden` alone would lose to a display class, so the
  // class goes with it (`tileClass`).
  const tiled = tiles !== undefined;
  const tileShown = (tile: string): boolean => !tiles || tiles.shown.includes(tile);
  // Slice #37.56: a tile that stands in the right column is rendered here, as
  // before, and placed in its slot there; nothing until the slot exists.
  const placeTile = (tile: string, node: React.ReactNode): React.ReactNode => {
    if (!tiles?.right?.has(tile)) return node;
    const slot = tiles.right.slot(tile);
    return slot ? createPortal(node, slot) : null;
  };
  const tileProps = (tile: string) =>
    tiles
      ? { "data-tile": tile, role: "region", "aria-label": tiles.labels[tile] ?? tile, hidden: !tileShown(tile) }
      : {};
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

  const { data: documentTypes, isFetched: documentTypesFetched } = useQuery({
    queryKey: ["document-types"],
    queryFn:  fetchDocumentTypes,
    staleTime: 5 * 60 * 1000,
  });
  // Slice #21.03.Import: memoized so the templateFields useMemo below (which
  // depends on typeOptions) doesn't recompute every render — `documentTypes ?? []`
  // would otherwise hand it a fresh array identity each time.
  const typeOptions = useMemo(() => documentTypes ?? [], [documentTypes]);
  /**
   * Every `template_fields` key any document type declares.      (Slice #27.04)
   *
   * Read by `valuesForSave` to tell an orphaned custom-field value — one that
   * belongs to a template this document has moved off — from a value whose key
   * no template mentions, left behind by a field an administrator removed.
   * The first is dropped on a re-type; the second is the user's and is kept.
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
  /**
   * Which notebook page is open.                                (Slice #36.01)
   *
   * Declared here, with the rest of the state, because it is a hook: the
   * notebook exists only for a type whose fields carry tabs, but the hook has
   * to run on every render of every type regardless. Read through `activeTab`
   * below, which clamps it against the type actually selected.
   */
  const [activeTabRaw, setActiveTabRaw] = useState(0);
  /** Stable id prefix for the notebook's `aria-controls` / `aria-labelledby` pairs. */
  const formTabsId = useId();

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

  // Slice #37.85: a type's form is never made from ONE document — a notarial
  // deed has no printed labels, so a one-document read names fields after its
  // prose. „Descoperire AI" left this form, and the sentence that advertised it
  // left with it. Under „Tip document" a type with no form says so only to a
  // superuser, the one reader who can act on it, with the way to build one
  // („Distilare Tipizate", 10–20 samples); and never on a type that may not hold
  // a form at all — the identity card and the catch-all, which
  // `typeMayHoldAForm` decides, as it does for the engine's picker.
  //
  // `documentTypeNeedsFormHint` keeps its own rule: a MISSING row (the list
  // still loading) is not a formless one.
  const showNoFormHint = isSuperuser
    && effectiveMode !== "view"
    && selectedType !== undefined
    && documentTypeNeedsFormHint(selectedType)
    && typeMayHoldAForm({
      typeId: selectedType.id,
      typeKey: selectedType.key ?? null,
      typeName: selectedType.name ?? null,
      // The catch-all is caught by its key and name inside; this form holds no
      // separate id for it.
      fallbackTypeId: null,
      typeIsIdCard: documentTypeIsIdCard(selectedType),
    });

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
            latestVersion !== null &&
            effectiveVersion < latestVersion &&
            !navLocked,
          onPrev: () => goToVersion(effectiveVersion - 1),
          onNext: () => goToVersion(effectiveVersion + 1),
          // FU-067 (Slice #37.07): not in a read-only view opened from an
          // association tab — „Fă curentă" writes, and „Modifică" is how that
          // view is turned into one that may.
          canMakeCurrent: !isOnLatest && (mode !== "view" || associatedEditing),
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
   * over from another type": a field an administrator removed under #27.03
   * leaves values whose key no template mentions at all, and emptying them would
   * delete what can still be recovered by re-adding the field. A key that some
   * type in the list DOES declare, and the selected one does not, is the orphan.
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
    if (!retypedByHand || !selectedType) return values;
    return {
      ...values,
      customFields: Object.fromEntries(
        Object.entries(values.customFields).filter(
          ([key]) =>
          !someTypeDeclares.has(key) ||
          templateFields.some((f) => f.key === key),
        ),
      ),
    };
  };

  // Slice #37.21: the version a save starts from, the refusal of a stale one,
  // and the notices from this browser's other windows (record-save-sync.tsx).
  const recordSync = useRecordSaveSync({
    recordPath: mode === "create" || !documentId ? null : `/api/documents/${encodeURIComponent(documentId)}`,
    dirty: editDirty,
    latestVersion,
  });

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
      const valuesToSave = valuesForSave(values);
      const payload = toApiPayload(valuesToSave);
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
      if (valuesToSave !== values) {
        const live = form.getValues("customFields");
        form.setValue(
          "customFields",
          Object.fromEntries(
            Object.entries(live).filter(([key]) => key in valuesToSave.customFields),
          ),
          { shouldDirty: false },
        );
      }
      // What the SERVER now has, which is what the callers baseline against.
      return valuesToSave;
    } catch (err) {
      // Slice #37.21: a save refused as stale writes nothing; the notice says so.
      if (recordSync.refused(err)) return null;
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
      // FU-228 (Slice #37.07): the record is gone, so „RECENTE" forgets it.
      forgetRecentlyViewed(documentId!);
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

  // ── The notebook ─────────────────────────────────── (Slice #36.01) ──
  //
  // A type whose fields carry `tabRo`/`tabEn` renders its Details tab as a
  // notebook; a type whose fields carry none renders EXACTLY as it did before
  // this slice — `tabs` is `[]`, `notebook` is false, and every branch below
  // falls through to the single-column stack that has been here since #27.03.
  // That is the compatibility guarantee every existing type depends on, and
  // `template-tabs.test.ts` pins it on the module rather than on this JSX.
  //
  // ⚠️ **EVERY TAB'S PANELS STAY MOUNTED; the inactive ones are HIDDEN.**
  // Unmounting them would be the obvious implementation and it is the wrong
  // one on this form: react-hook-form values, `editDirty` against the
  // baseline snapshot, the version-diff highlights and the field pulses are
  // all computed over inputs that are on the page. A validation error on a
  // page nobody is looking at would also be an error nobody can see. Hiding
  // costs one `hidden` attribute and keeps all of that exactly as it is.
  const tabs = templateTabsOf(templateFields);
  const notebook = tabs.length > 0;
  // Clamped on read rather than reset in an effect: the type can change under
  // this component (`applyTypeChange`), and a stale index must not blank the
  // page while an effect catches up.
  const activeTab = notebook ? Math.min(activeTabRaw, tabs.length - 1) : 0;
  const feesFields = feesGroup?.fields ?? [];
  const financialFields = financialGroup?.fields ?? [];
  const feesPaired = !!financialGroup && feesPairStaysTogether(feesFields, financialFields, tabs);
  const feesUnitTab = feesPaired
    ? tabIndexOfFeesPair(feesFields, financialFields, tabs)
    : tabIndexOfPanel(feesFields, tabs);
  const financialSoloTab = tabIndexOfPanel(financialFields, tabs);
  const certificatesTab = tabIndexOfPanel(certificatesGroup?.fields ?? [], tabs);

  // ── Slice #37.20: the tiles ─────────────────────────────────────────────
  // The tile a field is on is the tile of its notebook page, by the notebook's
  // own rules above — nothing here decides a place of its own.
  const tabOfCustomField = (key: string): number => {
    const group = customFieldGroups.find((g) => g.fields.some((f) => f.key === key));
    if (!group) return 0;
    if (group === feesGroup) return feesUnitTab;
    if (group === financialGroup) return feesPaired ? feesUnitTab : financialSoloTab;
    if (group === certificatesGroup) return certificatesTab;
    return tabIndexOfPanel(group.fields, tabs);
  };
  const tileOfPath = (path: string): string => {
    const [root, key] = path.split(".");
    if (root === "customFields") return tileOfTabIndex(tabs, tabOfCustomField(key ?? ""));
    if (FEES_FIELDS.has(root)) return tileOfTabIndex(tabs, feesUnitTab);
    return "general";
  };
  // What the page needs to build the row: the type on screen, and the tiles
  // holding a framed field (HIGHLIGHTS ARE NOT LOST IN A HIDDEN TILE — the page
  // marks a hidden one). Sent as one signature so an unchanged render sends
  // nothing.
  const onTileLayout = tiles?.onLayout;
  const tileLayoutSig = JSON.stringify({
    layout: { typeKey: selectedTypeKey ?? null, tabs, succession: isMostenitor, pages: showPagesPanel, ready: documentTypesFetched },
    highlighted: Object.entries(displayHighlights ?? {})
      .filter(([, colour]) => !!colour)
      .map(([field]) => tileOfPath(field)),
  });
  useEffect(() => {
    if (!onTileLayout) return;
    const { layout, highlighted } = JSON.parse(tileLayoutSig) as { layout: DocumentLayout; highlighted: string[] };
    onTileLayout(layout, highlighted);
  }, [onTileLayout, tileLayoutSig]);
  // Wraps one tile's panels: `display: contents` while shown, so each fixed
  // panel flows in the row by itself, and every panel takes the tile's order.
  const tileBlock = (tile: string, children: React.ReactNode) => (
    <PanelOrderContext.Provider value={tiles?.order(tile)}>
      <div {...tileProps(tile)} className={tileShown(tile) ? "contents" : "hidden"}>
        {children}
      </div>
    </PanelOrderContext.Provider>
  );
  // Slice #37.31: a notebook tile — or „Câmpuri specifice" for a type with no
  // notebook — is ONE frame, titled with the tab's name, its panels sections
  // inside it in the notebook's order, the frame as wide as its widest panel.
  // Hidden, never unmounted, like every form tile (#37.20).
  const frameBlock = (tile: string, title: string, children: React.ReactNode) => (
    <section
      {...tileProps(tile)}
      data-frame={tile}
      className={`w-fit max-w-full rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900${tileShown(tile) ? "" : " hidden"}`}
      style={tiles ? { order: tiles.order(tile) } : undefined}
    >
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">{title}</h2>
      <FrameContext.Provider value={true}>
        <div className="flex flex-col gap-4">{children}</div>
      </FrameContext.Provider>
    </section>
  );

  // An error in a hidden tile: show the tile (for this visit), scroll to the
  // field, focus it and pulse it — the Natural Person's `onInvalid` (#37.17).
  // A timeout rather than an animation frame, which a browser does not run in
  // a tab that is not in front.
  const onInvalid = (errs: FieldErrors<FormValues>) => {
    if (!tiles) return;
    const path = firstErrorPath(errs);
    if (!path) return;
    const tile = tileOfPath(path);
    if (!tiles.shown.includes(tile)) tiles.onRevealTile(tile);
    window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[name="${CSS.escape(path)}"]`);
      if (!el) return;
      el.scrollIntoView({ block: "center" });
      el.focus({ preventScroll: true });
      const row = el.closest("label") ?? el.parentElement ?? el;
      row.classList.add("ga-vpulse-red");
      window.setTimeout(() => row.classList.remove("ga-vpulse-red"), 3300);
    }, 60);
  };

  // Renders one custom field's input — shared by every group below.
  // `forceFullWidthTextarea` is set for Certificate și referințe so every
  // field there gets Vecinătăți's exact full-width/auto-grow treatment,
  // regardless of that field's own configured `type`.
  /**
   * Slice #37.31: a custom field's width, by `templateFieldWidth` exactly as
   * #37.15 sized it — read by the packing rule (rule 18) as well as by the
   * field itself, so the rows are worked out from the widths that are drawn.
   */
  const customFieldWidth = (
    f: (typeof templateFields)[number],
    forceFullWidthTextarea = false,
  ): FieldWidth & { capped?: boolean } => {
    if (f.type === "select" && f.options && f.options.length > 0) {
      const options = selectOptionsForValue(f.options, watchedValues.customFields?.[f.key]);
      return templateFieldWidth(f, [t("fields.customSelectEmpty"), ...options.map((o) => o.label)]);
    }
    return templateFieldWidth(
      { type: f.type === "select" ? "text" : f.type, width: f.width },
      [],
      forceFullWidthTextarea,
    );
  };

  /**
   * A group's fields in the rows the packing rule gives them (rule 18), and
   * the panel's units: fields flow in form order into rows of the panel's
   * inner width; a textarea — and every Certificate și referințe field — takes
   * a row of its own at the panel's whole width. `baseRowsRem`: the widest of
   * the rows the panel draws before them (the fees panel's own three fields).
   */
  const packCustomFields = (
    fields: readonly (typeof templateFields)[number][],
    forceFullWidthTextarea = false,
    baseRowsRem = 0,
  ): { units: number; nodes: React.ReactNode[] } => {
    const items = fields.map((f) => {
      const width = customFieldWidth(f, forceFullWidthTextarea);
      const isSelect = f.type === "select" && !!f.options && f.options.length > 0;
      return { key: f.key, width, full: !isSelect && (forceFullWidthTextarea || width.kind === "lines") };
    });
    const { units, rows } = packFieldRows(items, { baseRowsRem });
    const inner = unitsInnerRem(units);
    const byKey = new Map(fields.map((f) => [f.key, f] as const));
    const full = new Set(items.filter((i) => i.full).map((i) => i.key));
    // Slice #37.54: a field alone in its row is a row too, so rule 19 (a label
    // with nothing to its right does not wrap — `STACKED_ROW_CLASS`) reaches it:
    // „Taxă timbru și publicitate", last and alone among the fees, on one line.
    // A `full` field fills the panel and keeps its own width, as before.
    const nodes = rows.map((row) =>
      row.length === 1 && full.has(row[0]) ? (
        renderCustomField(byKey.get(row[0])!, forceFullWidthTextarea, inner)
      ) : (
        <div key={row.join("|")} className={STACKED_ROW_CLASS}>
          {row.map((k) => renderCustomField(byKey.get(k)!, forceFullWidthTextarea))}
        </div>
      ),
    );
    return { units, nodes };
  };

  const renderCustomField = (
    f: (typeof templateFields)[number],
    forceFullWidthTextarea = false,
    fillRem?: number,
  ) => {
    const name = `customFields.${f.key}` as unknown as FieldPath<FormValues>;
    const fieldLabel = f.labelRo || f.labelEn || f.key;

    // ── select ───────────────────────────────────────── (Slice #36.01) ──
    //
    // ⚠️ **A STORED VALUE THAT IS NO LONGER AN OPTION IS APPENDED AS ITS OWN
    // CHOICE, and that is not a nicety.** A `<select>` whose value matches no
    // `<option>` shows the first entry instead, so the form would display one
    // clause state while `custom_fields` held another — the document would
    // read differently from the deed it was captured off, with nothing on
    // screen saying so. An option list is editable, so this happens the first
    // time anyone tidies one.
    //
    // ⚠️ **Not forced full width, even under Certificate și referințe.** That
    // group's treatment exists to give prose room to grow; a dropdown of three
    // words does not grow, and a full-width one reads as a broken text box.
    if (f.type === "select" && f.options && f.options.length > 0) {
      const options = selectOptionsForValue(f.options, watchedValues.customFields?.[f.key]);
      const emptyLabel = t("fields.customSelectEmpty");
      return (
        <SelectField
          key={f.key}
          label={fieldLabel}
          name={name}
          register={register}
          options={options}
          // Slice #37.15: as wide as its longest option — the blank one too —
          // from S to XXL, by rule (`templateFieldWidth`).
          width={customFieldWidth(f, forceFullWidthTextarea)}
          watchValue={watchedValues.customFields?.[f.key]}
          // The blank choice is SELECTABLE here, unlike the type picker's
          // hidden placeholder: a clause ticked by mistake has to be
          // untickable, and "" is what `customFieldsEqual` already treats as
          // unset.
          emptyOptionLabel={emptyLabel}
        />
      );
    }

    // Slice #37.15: the width is the RULE's (`templateFieldWidth`) — text grows
    // at XL, a textarea and every field under Certificate și referințe at the
    // panel's width with its line breaks, a date or number is a fixed M — or
    // the step the field's own `width` names. A `select` with no options is a
    // text box here, so it is sized as one.
    const width = customFieldWidth(f, forceFullWidthTextarea);
    return (
      <Field
        key={f.key}
        label={fieldLabel}
        name={name}
        type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
        register={register}
        width={width}
        fillRem={fillRem}
      />
    );
  };

  // ── Taxe și onorarii — always rendered (Slice #21.06.misc): the 3 fields
  // moved out of General (Notariat / Nr. act autentic / Data autentificării
  // — labels per type via cfg.labels, which since Slice #32.16 hold message
  // KEY PATHS under the `document` namespace rather than Romanian strings, so
  // the three read the interface language like everything else on the form),
  // in the order a business user reads
  // them (who/what act, then when, then the fees tied to it), followed by
  // any custom fields the active type groups under "Taxe și onorarii" /
  // "Fees". Uses the matched group's own label when one exists (preserves
  // the admin's exact wording); falls back to the generic i18n title for
  // types with no such template group.
  // Slice #37.31: Instituție / Notariat, the panel's whole width — Nr. document
  // | Data (rule 14: a number and its date) — then the fees group's own
  // fields, packed (rule 18). The panel is the fewest units that hold the
  // widest of all of them: 3 with Instituție at XXL.
  const feesBaseRem = Math.max(rowRem([DOC.institutionId]), rowRem([DOC.nrDocument, DOC.dateDocument]));
  const feesPacked = packCustomFields(feesGroup?.fields ?? [], false, feesBaseRem);
  const feesSection = (
    <Section key="fees" panel="fees" units={Math.max(PANEL_UNITS.document.fees, feesPacked.units)} title={feesGroup?.label || t("sections.issue")}>
      <SelectField
        label={t(cfg.labels.institution)}
        name="institutionId"
        register={register}
        error={errors.institutionId?.message}
        options={institutionOptions}
        highlight={displayHighlights?.institutionId}
        width={DOC.institutionId}
        watchValue={watchedValues.institutionId}
      />
      <div className={STACKED_ROW_CLASS}>
        <Field
          label={t(cfg.labels.nrDocument)}
          name="nrDocument"
          register={register}
          error={errors.nrDocument?.message}
          highlight={displayHighlights?.nrDocument}
          width={DOC.nrDocument}
        />
        <Field
          label={t(cfg.labels.dateDocument)}
          name="dateDocument"
          type="date"
          register={register}
          error={errors.dateDocument?.message}
          highlight={displayHighlights?.dateDocument}
          width={DOC.dateDocument}
        />
      </div>
      {feesPacked.nodes}
    </Section>
  );

  // When the type also defines a "Financiar" group, the two panels sit next
  // to each other, Financiar first. Slice #37.15: they are two ordinary fixed
  // panels in the flow now, not two halves of a full-width row — side by side
  // where two panels fit, one under the other where one does.
  //
  // ⚠️ **Slice #36.01 made the test `feesPaired`, not `financialGroup`, and
  // that is a correctness fix rather than a tidy-up.** With a notebook, a
  // Financiar group whose fields sit on another page renders as its own panel
  // THERE — so a condition of "does the type have a Financiar group" would
  // have drawn its fields twice, once inside this pair and once on the other
  // page, with two sets of inputs registered under the same names. With no
  // notebook `feesPaired` is `!!financialGroup` exactly (`feesPairStaysTogether`
  // returns true whenever `tabs` is empty), so nothing about the pre-#36.01
  // rendering changes.
  const financialPacked = packCustomFields(financialGroup?.fields ?? []);
  const feesOrPairedSection = feesPaired && financialGroup ? (
    <>
      <Section panel="financial" units={financialPacked.units} title={financialGroup.label}>
        {financialPacked.nodes}
      </Section>
      {feesSection}
    </>
  ) : (
    feesSection
  );

  // ── General ───────────────────────────────────────────────────────────
  // Code shown inline on the heading line (Slice #21.06.misc: mirrors Person's
  // Identity heading) + type / subject / title / notes. Nr. document / Date /
  // Institution moved out to the always-present Taxe și onorarii panel below,
  // for every document type.
  //
  // Slice #36.01 hoisted it out of the JSX into this const so the notebook can
  // place it. It is always on the FIRST page: it is what the document IS — its
  // type, its subject, its title — and a notebook page that could hide the type
  // picker while another page edits that type's own fields is a page that can
  // contradict itself.
  const generalSection = (
      <Section
        panel="general"
        units={PANEL_UNITS.document.general}
        title={t("sections.general")}
        code={mode !== "create" ? documentCode : undefined}
      >
        <SelectField
          label={t("fields.type")}
          name="documentTypeId"
          register={register}
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
          width={DOC.documentTypeId}
          watchValue={watchedValues.documentTypeId}
          // Slice #37.85: see `showNoFormHint` — a superuser only, linking to
          // the engine with this type already chosen.
          hint={
            showNoFormHint && selectedType
              ? t.rich("typeForm.noFormHint", {
                  link: (chunks) => (
                    <Link
                      href={`/admin/doc-type-engine?type=${encodeURIComponent(selectedType.id)}`}
                      className="underline underline-offset-2 hover:text-ink dark:hover:text-zinc-200"
                    >
                      {chunks}
                    </Link>
                  ),
                })
              : undefined
          }
        />
        {/* Slice #37.31: Etichetă scurtă moves up next to Tip document — what
            the document is, then what it is called, then what it is about —
            each the panel's whole width. */}
        <Field
          label={t("fields.title")}
          name="title"
          register={register}
          error={errors.title?.message}
          highlight={displayHighlights?.title}
          width={DOC.title}
          fillRem={PANEL_UNIT_INNER_REM.document.general}
        />
        <Field
          label={t("fields.subject")}
          name="subject"
          register={register}
          error={errors.subject?.message}
          highlight={displayHighlights?.subject}
          width={DOC.subject}
          fillRem={PANEL_UNIT_INNER_REM.document.general}
        />
        <Field
          label={t("fields.notes")}
          name="notes"
          register={register}
          error={errors.notes?.message}
          maxLength={4000}
          highlight={displayHighlights?.notes}
          width={DOC.notes}
          fillRem={PANEL_UNIT_INNER_REM.document.general}
        />
      </Section>
  );

  /**
   * The panels that belong on notebook page `tab`.              (Slice #36.01)
   *
   * With no notebook this is called once with 0, `tabs` is `[]`, and every
   * index below is 0 — so the output is the same stack, in the same order, as
   * before this slice: General, the fees panel (alone or paired), Certificate
   * și referințe, then every other group in first-appearance order.
   */
  const panelsOf = (tab: number) => (
    <>
      {/* Slice #37.20: as tiles, the general data is a tile of its own. */}
      {tab === 0 && !tiled && generalSection}

      {/* ── Taxe și onorarii (alone or paired with Financiar) ──────────── */}
      {feesUnitTab === tab && feesOrPairedSection}

      {/* Slice #36.01: a Financiar group whose fields sit on a different page
          from the fees panel's cannot pair with it — half a pair drawn on each
          page would be the same panel twice. It renders alone there instead. */}
      {!feesPaired && financialGroup && financialSoloTab === tab && (
        <Section panel="financial" units={financialPacked.units} title={financialGroup.label}>
          {financialPacked.nodes}
        </Section>
      )}

      {/* ── Certificate și referințe — every field forced full-width /
          auto-grow (Vecinătăți's exact treatment), whatever `type` is
          configured on it in Reference Data. ──────────────────────────── */}
      {certificatesGroup && certificatesTab === tab && (() => {
        const packed = packCustomFields(certificatesGroup.fields, true);
        return (
          <Section panel="certificates" units={packed.units} title={certificatesGroup.label}>
            {packed.nodes}
          </Section>
        );
      })()}

      {/* ── Any other template groups — one fixed panel each (Slice #37.15:
          the fields flow two to a row where their widths fit, one where they
          do not, instead of a 2-column grid). ───────────────────────────── */}
      {otherGroups
        .filter(({ fields }) => tabIndexOfPanel(fields, tabs) === tab)
        .map(({ label, fields }) => {
          const packed = packCustomFields(fields);
          return (
            <Section key={label || "_ungrouped"} panel={`group:${label || "_ungrouped"}`} units={packed.units} title={label || undefined}>
              {packed.nodes}
            </Section>
          );
        })}
    </>
  );

  const formElement = (
    <form
      id="document-form"
      onSubmit={form.handleSubmit(onSubmit, onInvalid)}
      // Slice #37.20: as tiles the form is `contents`, its panels items of the
      // page's tile row.
      className={tiled ? "contents" : "flex flex-col gap-4"}
      noValidate
    >
      {/* Slice #37.15: the panels FLOW — each a fixed 32rem, as many to a row
          as the form's width holds (see the row this form sits in, below),
          left-aligned, wrapping. */}
      {/* Slice #18.06: the disabled fieldset wraps ONLY the editable input
          sections; the version nav lives in the header (portalled), outside
          this fieldset, so its ◀/▶ buttons stay clickable on read-only
          historical versions. */}
      <fieldset disabled={effectiveMode === "view"} className="contents">
      {/* ── The page stack, and the notebook that may hold it ─────────────
          Slice #36.01. `panelsOf(tab)` returns the panels that belong on one
          notebook page; with no notebook there is exactly one call, with
          `tabs` empty, and every `=== tab` test below is `0 === 0` — which is
          how the no-tab rendering stays what it was rather than becoming a
          special case of the new one. ──────────────────────────────────── */}
      {tiled ? (
        <>
          {/* Slice #37.20: every notebook page is a tile, drawn beside the
              others; a type with none has one tile for its own fields. */}
          {tileBlock("general", generalSection)}
          {notebook
            ? tabs.map((label, i) => (
                <div key={label} className="contents">
                  {frameBlock(tileOfTabIndex(tabs, i), label, panelsOf(i))}
                </div>
              ))
            : frameBlock(tileOfTabIndex(tabs, 0), tiles?.labels[tileOfTabIndex(tabs, 0)] ?? t("tiles.fields"), panelsOf(0))}
        </>
      ) : notebook ? (
        <>
          {/* A real tablist: roving arrow keys, one stop in the tab order,
              `aria-controls` onto the page each button opens. */}
          <div
            role="tablist"
            aria-label={t("notebook.tablistLabel")}
            className="flex flex-wrap gap-1 border-b border-crease dark:border-zinc-700"
            onKeyDown={(e) => {
              const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
              if (delta === 0) return;
              e.preventDefault();
              const next = (activeTab + delta + tabs.length) % tabs.length;
              setActiveTabRaw(next);
              document.getElementById(`${formTabsId}-tab-${next}`)?.focus();
            }}
          >
            {tabs.map((label, i) => (
              <button
                key={label}
                id={`${formTabsId}-tab-${i}`}
                type="button"
                role="tab"
                aria-selected={i === activeTab}
                aria-controls={`${formTabsId}-panel-${i}`}
                tabIndex={i === activeTab ? 0 : -1}
                onClick={() => setActiveTabRaw(i)}
                className={[
                  "-mb-px rounded-t-md border-b-2 px-3 py-2 text-sm font-medium",
                  i === activeTab
                    ? "border-focus text-ink dark:text-zinc-100"
                    : "border-transparent text-fade hover:text-ink dark:text-zinc-400 dark:hover:text-zinc-100",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
          {tabs.map((label, i) => (
            <div
              key={label}
              id={`${formTabsId}-panel-${i}`}
              role="tabpanel"
              aria-labelledby={`${formTabsId}-tab-${i}`}
              // ⚠️ **BOTH the attribute and the class, and the class is what
              //     actually hides it.** `[hidden]` is a UA rule, and any
              //     author `display` utility on the same element beats the UA
              //     sheet outright — a page left with `flex` here stays
              //     visible with `hidden` set, which is every tab drawn at
              //     once. The attribute stays because it is what assistive
              //     technology and find-in-page read.
              hidden={i !== activeTab}
              className={i === activeTab ? "flex flex-wrap items-start" : "hidden"}
              style={{ gap: PANEL_GAP }}
            >
              {panelsOf(i)}
            </div>
          ))}
        </>
      ) : (
        <div className="flex flex-wrap items-start" style={{ gap: PANEL_GAP }}>
          {panelsOf(0)}
        </div>
      )}

      </fieldset>

      {submitError && (
        <p className={`text-sm text-red-600 dark:text-red-400${tiled ? " order-last basis-full" : ""}`} role="alert">
          {submitError}
        </p>
      )}
    </form>
  );

  return (
    <FieldPulseContext.Provider value={pulsing}>
    {/* Slice #37.15: THE WINDOW DECIDES HOW MANY PANELS FIT, NEVER HOW WIDE
        ANYTHING IS. This column is snapped to whole panels — and, once there
        are pages, to whole panels plus the page panel — so the action bar at
        its foot is exactly as wide as what sits above it. */}
    <div
      // Slice #37.20: as tiles the page's tile row carries the snap.
      className={tiled ? "contents" : "flex flex-col gap-4"}
      style={tiled ? undefined : unitRowStyle("document")}
    >
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
    <UnsavedChangesBanner show={editDirty} className={tiled ? "order-first basis-full" : undefined} />
      <RecordSyncNotice sync={recordSync} dirty={editDirty} listHref="/documents" className={tiled ? "order-first basis-full" : undefined} />

    {/* Slice #21.06.misc: the document's own fields sit in the left column;
        once there's a document to show pages for, the Pages panel sits in a
        right-hand column stretched to match the left column's height. The
        "Pagini extinse" button still opens the full-screen theater overlay
        (portal) below — unchanged by this layout. id is used by the submit
        button's form="document-form" attribute, which lets the button live
        outside the <form> element while still submitting this form. */}
    {/* Slice #37.15: the 3:2 grid of a centred 93rem block (#21.06.misc) is
        gone. The fields take whole panels; the page image is a fixed
        PAGES_PANEL_STYLE (40rem) beside them — not narrower than the
        two-fifths it was in a 1920-pixel window — stretched to their height.
        Where one panel and the page image do not fit side by side, the page
        panel wraps under the fields. */}
    {tiled ? (
      <>
        {formElement}
        {/* Slice #37.20: the page image is a tile — hidden, not unmounted, so
            an upload in progress survives unticking it. */}
        {showPagesPanel && placeTile("pages",
          // No `role="region"` here: PagesPanel is itself the region „Pagini",
          // and two regions of one name are one too many for a screen reader.
          // Slice #37.56: placed in the right-hand column (`placeTile`).
          <div
            data-tile="pages"
            hidden={!tileShown("pages")}
            className={tileShown("pages") ? "flex flex-col" : "hidden"}
            style={{ ...PAGES_PANEL_STYLE, order: tiles?.order("pages") }}
            data-panel="pages"
          >
            <ErrorBoundary fallback={<PanelError>{tShared("errorBoundary.pages")}</PanelError>}>
              <PagesPanel
                documentId={documentId}
                mode={effectiveMode === "view" ? "view" : "edit"}
                state={pagesState}
                onToggleBigPage={handleToggleBigPage}
                sidebar
                surface={tileSurface(!!tiles?.right?.has("pages"))}
              />
            </ErrorBoundary>
          </div>,
        )}
      </>
    ) : showPagesPanel ? (
      <div className="flex flex-wrap items-stretch" style={{ gap: PANEL_GAP }}>
        <div className="min-w-0">{formElement}</div>
        <div className="flex flex-col" style={PAGES_PANEL_STYLE} data-panel="pages">
          <ErrorBoundary fallback={<PanelError>{tShared("errorBoundary.pages")}</PanelError>}>
            <PagesPanel
              documentId={documentId}
              mode={effectiveMode === "view" ? "view" : "edit"}
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
      // Slice #37.20: as tiles, „Părți" is a tile, offered only here — hidden,
      // not unmounted, like the panel it was.
      <div
        {...tileProps("succession")}
        className={tileShown("succession") ? "" : "hidden"}
        style={tiles ? { order: tiles.order("succession") } : undefined}
      >
        <SuccessionPartiesPanel
          documentId={documentId}
          mode={effectiveMode === "view" ? "view" : "edit"}
        />
      </div>
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
            {/* #37.44 (A028): Minimize2 in place of „✕ Restrânge"; „Restrânge" its name and tooltip. */}
            <IconButton icon={Minimize2} label={t("pages.theaterClose")} variant="secondary" size="sm" onClick={handleCloseTheaterPage} />
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
    {/* Slice #37.20: as tiles, the action bar is the tile row's last line. */}
    <div className={tiled ? "order-last flex basis-full flex-col gap-4" : "contents"}>
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
            form="document-form"
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
      <div className="flex flex-col items-center gap-2 border-t border-crease pt-6 dark:border-zinc-800">
        <div className="flex items-center justify-center gap-3">
          <IconButton
            icon={Save}
            label={t("buttons.save")}
            variant="primary"
            size="lg"
            type="submit"
            form="document-form"
            disabled={saveDisabled}
          />
          {mode === "edit" && (
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
            onClick={() => router.push("/documents")}
            disabled={submitting}
          />
        </div>
      </div>
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

/**
 * A titled panel, a whole number of width units.      (Slice #37.15; #37.31)
 *
 * Its children are its rows: a stacked field alone, or a `STACKED_ROW_CLASS`
 * row of several (rule 16 keeps their boxes on one line). `units` comes from
 * `PANEL_UNITS.document` for the general and fee panels and from the packing
 * rule (`packFieldRows`) for a type's own groups.
 *
 * Inside a notebook tile's frame (`FrameContext`) it is a section of that
 * frame — no border, its units' inner width, `data-section` rather than
 * `data-panel` — so the frame is the tile and the tile is whole units.
 */
function Section({
  title,
  code,
  panel,
  units,
  children,
}: {
  /**
   * Slice #37.52: optional — a type's fields with no group sit under no
   * heading, the tile's own name („Detalii act") already saying whose they are.
   */
  title?:   string;
  /** Slice #21.06.misc: shown inline on the heading line, mirroring how
   *  Person's Identity section shows its personCode — used by General to
   *  show documentCode instead of as its own field row. */
  code?:    string | null;
  /** Slice #37.15: the panel's name for the e2e width check (`data-panel`). */
  panel:    string;
  /** Slice #37.31: the panel's width in units. */
  units:    number;
  children: React.ReactNode;
}) {
  // Slice #37.20: as tiles, a panel takes its tile's place in the row.
  const order = useContext(PanelOrderContext);
  const framed = useContext(FrameContext);
  const heading = title === undefined ? null : (
    <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">
      {/* Slice #37.90: inside a tile, a panel's subtitle reads in square brackets. */}
      {framed ? panelSubtitle(title) : title}
      {/* Slice #37.57: the system ID's one place — this corner. */}
      {code && <SystemIdCorner code={code} />}
    </h2>
  );
  if (framed) {
    return (
      <section data-section={panel} style={{ width: rem(unitsInnerRem(units)) }}>
        {heading}
        <div className="flex flex-col gap-2">{children}</div>
      </section>
    );
  }
  return (
    <section
      style={order === undefined ? unitStyle(units) : { ...unitStyle(units), order }}
      data-panel={panel}
      className="rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      {heading}
      <div className="flex flex-col gap-2">{children}</div>
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
  /** Read-only. Every control here already carries `disabled:` styling. */
  disabled?:  boolean;
  /**
   * Slice #37.15: the box's width and kind, from `src/lib/ui/field-widths.ts`
   * — `DOCUMENT` for the general and fee fields, `templateFieldWidth` for a
   * type's own. A GROWING kind renders `<GrowingText>` (its height follows the
   * value; `lines` keeps line breaks), every other an `<input>` as wide as its
   * step. This replaces the old TextAreaField and its auto-grow effect.
   */
  width:      FieldWidth;
  /** Slice #37.31: the panel's inner width, for a box that fills it. */
  fillRem?:   number;
};

/** The box's own look; its width is never a class here — it comes from `boxStyle`. */
const BOX_CLASS =
  "rounded-md border bg-white px-2 py-1 shadow-sm focus:outline-none disabled:bg-canvas disabled:text-fade disabled:cursor-default dark:bg-zinc-950 dark:disabled:bg-zinc-800";

function Field({
  label,
  name,
  type = "text",
  register,
  error,
  highlight,
  disabled,
  width,
  fillRem,
  maxLength,
}: FieldProps & { maxLength?: number }) {
  const ring = usePulseRing(highlight);
  const className = [
    BOX_CLASS,
    error
      ? "border-red-500 focus:border-red-600"
      : "border-wire focus:border-focus dark:border-zinc-700",
    ring,
  ].join(" ");
  const grows = width.kind === "grows" || width.kind === "lines";
  // Slice #37.31: the label ABOVE its box, the pair as wide as the box — or
  // the panel, for a box that fills it — and a long label wraps inside it.
  const box = stackedBoxStyle(fillRem !== undefined ? { ...width, fill: true } : width, fillRem ?? boxRem(width));
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
          disabled={disabled}
          // All content here is Romanian legal/notarial text — the browser's
          // spell-checker (English by default) flags most of it as errors.
          spellCheck={false}
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
          disabled={disabled}
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          className={className}
          style={box}
          data-width-field={name}
          data-width-kind={width.kind}
        />
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
  error,
  options,
  highlight,
  hint,
  disabled,
  emptyOptionLabel,
  width,
  watchValue,
}: Omit<FieldProps, "width"> & {
  /** Slice #37.15: `capped` — the rule stopped at XXL and the option shows in full on hover only. */
  width: FieldWidth & { capped?: boolean };
  /** The chosen value, so the box can show that option in full on hover (#37.12). */
  watchValue?: string | null;
  options: { value: string; label: string }[];
  /**
   * Slice #36.01: when set, the blank choice is a REAL, selectable option
   * carrying this caption, instead of the hidden disabled placeholder below.
   * Used by template `select` fields, where "no value" is an answer a user has
   * to be able to give back — a clause ticked by mistake must be untickable,
   * and `customFieldsEqual` already reads "" as unset. Omitted everywhere
   * else, so every pre-existing caller renders exactly as before.
   */
  emptyOptionLabel?: string;
  /**
   * Slice #27.02: a plain statement about the chosen option, rendered under the
   * control. NOT a validation message — it is muted body text with no icon and
   * no colour, because the only caller uses it to say a document type has no
   * custom form, which is the correct and permanent answer for several types.
   */
  hint?: React.ReactNode;
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
  const chosenLabel = options.find((o) => o.value === (watchValue ?? ""))?.label;
  return (
    // `items-start`, so the label sits on the select's line instead of
    // drifting to the middle of a two-line block when a hint is present.
    // Slice #37.15 made it unconditional, with the label's pt-1 — the line
    // every Field on this form now keeps, since any of them may grow.
    // Slice #37.31: the label above the box, the pair as wide as the box.
    <div className={STACKED_FIELD_CLASS} style={boxStyle(width)}>
      <label
        htmlFor={fieldId}
        className={STACKED_LABEL_CLASS}
      >
        {label}
      </label>
      <div className="flex flex-col gap-0.5" style={boxStyle(width)}>
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
          // The original key only remounted on 0 → N; any change to the list
          // (a type added elsewhere and refetched) has the same hazard — the
          // select's `selectedIndex` goes to −1 and the browser falls back to
          // the FIRST entry. Counting closes it: any change to the list
          // remounts, and register re-assigns against the real list.
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
          title={chosenLabel}
          style={boxStyle(width)}
          data-width-field={name}
          data-width-kind="select"
          data-width-capped={width.capped ? "true" : undefined}
          className={[
            BOX_CLASS,
            error
              ? "border-red-500 focus:border-red-600"
              : "border-wire focus:border-focus dark:border-zinc-700",
            ring,
          ].join(" ")}
        >
          {emptyOptionLabel !== undefined ? (
            <option value="" data-blank="">{emptyOptionLabel}</option>
          ) : (
            <option value="" disabled hidden />
          )}
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
          <IconButton
            icon={X}
            label={t("surveyorPicker.cancel")}
            variant="bare"
            size="md"
            onClick={onClose}
          />
        </div>

        {step === "choose-type" ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-fade dark:text-zinc-400">
              {t("surveyorPicker.stepChooseType")}
            </p>
            <div className="flex gap-3">
              <IconButton
                icon={User}
                label={t("surveyorPicker.btnNatural")}
                showLabel
                variant="secondary"
                size="lg"
                className="flex-1"
                onClick={() => handleChooseType("NATURAL")}
              />
              <IconButton
                icon={Building2}
                label={t("surveyorPicker.btnJudicial")}
                showLabel
                variant="secondary"
                size="lg"
                className="flex-1"
                onClick={() => handleChooseType("JUDICIAL")}
              />
            </div>
            <div className="flex justify-end">
              <IconButton
                icon={X}
                label={t("surveyorPicker.cancel")}
                variant="secondary"
                size="lg"
                onClick={onClose}
              />
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
                        <td className="px-3 py-1.5 text-ink dark:text-zinc-200">{item.displayName}</td>
                        <td className="px-3 py-1.5 text-right">
                          <IconButton
                            icon={MousePointerClick}
                            label={t("surveyorPicker.select")}
                            variant="primary"
                            size="xs"
                            onClick={() => onSelect(item)}
                          />
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
              <IconButton
                icon={ArrowLeft}
                label={t("surveyorPicker.back")}
                variant="secondary"
                size="md"
                onClick={() => setStep("choose-type")}
              />
              <IconButton
                icon={X}
                label={t("surveyorPicker.cancel")}
                variant="secondary"
                size="md"
                onClick={onClose}
              />
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
