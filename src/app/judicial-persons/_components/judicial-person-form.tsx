"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  type Control,
  type FieldPath,
  type FieldErrors,
  type UseFormRegister,
  useForm,
  useWatch,
  Controller,
} from "react-hook-form";
import { AsyncSelect } from "@/components/forms/async-select";
import { AddressBlock } from "@/components/address/address-block";
import { GrowingText } from "@/components/forms/growing-text";
import {
  JUDICIAL_PERSON as JP,
  PANEL_GAP,
  PANEL_UNIT_INNER_REM,
  PANEL_UNIT_STYLE,
  boxRem,
  boxStyle,
  stackedBoxStyle,
  unitRowStyle,
  type FieldWidth,
} from "@/lib/ui/field-widths";
import { STACKED_FIELD_CLASS, STACKED_LABEL_CLASS, STACKED_ROW_CLASS } from "@/lib/ui/stacked";
import { NavArrowIcon } from "@/components/back-arrow";
import { safeMutate } from "@/lib/api/safe-mutate";
import { PaginationControls } from "@/components/pagination-controls";
import { UnsavedChangesBanner } from "@/components/unsaved-changes-banner";
import { useUnsavedChangesGuard } from "@/components/providers/unsaved-changes-provider";
import {
  VersionNavControls,
  type VersionNavView,
} from "@/components/version-nav-controls";
import { FieldPulseContext, usePulseRing } from "@/components/versioning/field-pulse";
import { SnapshotValue } from "@/components/versioning/snapshot-value";
import {
  snapshotReplacesPicker,
  type SnapshotLookupState,
} from "@/lib/versioning/snapshot-lookup";
import { highlightRingClass } from "@/lib/versioning/highlight-ring";
import type { HighlightColor } from "@/lib/versioning/field-diff";
import type { JudicialPersonSnapshot } from "@/lib/judicial-persons/validation";
import { inferProvenance } from "@/lib/metadata/provenance-rules";
import {
  computeFieldHighlights,
  emptyFormValues,
  formSchema,
  formValuesEqual,
  type FormValues,
  type JudicialFieldHighlights,
  type JudicialLookupField,
  restoreBlockedBy,
  snapshotLookupStates,
  snapshotToFormValues,
  toApiPayload,
  versionLabelColor,
} from "./form-schema";
import { buttonClass } from "@/lib/ui/button-styles";
import { forgetRecentlyViewed } from "@/components/providers/navigation-history-provider";
import { jpTileOfField, type JpTile } from "./person-tiles";
import { firstErrorPath } from "@/lib/ui/tiles";
import { RecordSyncNotice, useRecordSaveSync } from "@/components/record-save-sync";

type Props = {
  mode: "create" | "edit" | "view";
  personId?: string;
  personCode?: string;
  initialValues?: FormValues;
  /** Slice #18.05 — header DOM node to portal the version-nav controls into. */
  versionNavSlot?: HTMLElement | null;
  /**
   * Slice #37.18: the screen's tiles, when the form is drawn as tiles (the
   * saved company's page). Absent on „Adaugă persoană juridică", which keeps
   * its plain panel row. The Natural Person's rules (#37.17), unchanged:
   *
   * ⚠️ **A FORM TILE THAT IS NOT SHOWN IS HIDDEN, NEVER UNMOUNTED** — the
   * document notebook's rule (#36.01): react-hook-form's values, `editDirty`,
   * the version-diff highlights and the field pulses are all computed over
   * inputs that are on the page. An unsaved change in a tile then unticked is
   * still saved by „Salvează", and the banner still guards it.
   *
   * In tile mode the form, its fieldset and its panel row are `display:
   * contents`, so every panel is an item of the page's tile row and the list
   * tiles flow beside them; the action bar is `order-last basis-full`, the
   * row's last line.
   */
  tiles?: {
    shown: readonly JpTile[];
    labels: Readonly<Record<JpTile, string>>;
    /** Show a hidden tile for this visit — an error has been found in it. */
    onRevealTile: (tile: JpTile) => void;
  };
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

// ⚠️ **`res.redirected` as well as `!res.ok`, and it is about the SHARED cache
// entry rather than about this form.**                          (Slice #34.04)
// An expired session answers with a redirect to the login page, whose HTML
// parses to `{}`, and `body.items ?? []` then reads as "the archive holds
// none" — so React Query caches a SUCCESSFUL EMPTY ARRAY. Every one of these
// keys is also read by the Reference Data modal (`value-list-modal.tsx` reads
// every list under `["value-list", listKey]`), so on a shared entry the WEAKEST
// fetcher defines the failure semantics for every reader: the modal then finds
// that empty array fresh, never refetches, and shows an empty list with no
// error for the 30 s staleTime. ⚠️ **The sharing is older than #34.04** — both
// forms have read the namespaced key since Slice #15.16, precisely so the admin
// modal's invalidation reaches them. This is fixed in passing with #34.04
// because that slice made this class of sharing its subject and measured the
// failure; it is not a hazard the slice introduced.
async function fetchJudicialPersonTypes(): Promise<JudicialPersonTypeOption[]> {
  const res = await fetch("/api/admin/value-lists/judicial-person-types");
  if (res.redirected || !res.ok) throw new Error(`Failed to load judicial person types (HTTP ${res.status})`);
  const body = await res.json();
  return (body.items ?? []) as JudicialPersonTypeOption[];
}

export function JudicialPersonForm({
  mode,
  personId,
  personCode,
  initialValues,
  versionNavSlot,
  tiles,
}: Props) {
  const t = useTranslations("judicialPerson");
  // Slice #37.18 — tile mode, as the Natural Person's (#37.17). `tileProps`
  // marks a form tile for the specs and hides it when unticked; `hidden` alone
  // would lose to any display class, so the class goes with it.
  const tiled = tiles !== undefined;
  const tileShown = (tile: JpTile): boolean => !tiles || tiles.shown.includes(tile);
  const tileProps = (tile: JpTile) =>
    tiles
      ? { "data-tile": tile, role: "region", "aria-label": tiles.labels[tile], hidden: !tileShown(tile) }
      : {};
  const hiddenClass = (tile: JpTile): string => (tileShown(tile) ? "" : " hidden");
  // Shared read-only-view copy (Back to list button + edit hint) — reused
  // identically across all four entity forms.
  const tShared = useTranslations("shared.readonlyView");
  const router = useRouter();
  const queryClient = useQueryClient();
  // Hoist here so they aren't called inside JSX (Rules of Hooks).
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
  // Slice #21.04.Import: an associated record (opened via ?readonly=true from
  // another record's association tab) starts read-only with a "Modify"
  // button; clicking it flips this on, which makes effectiveMode resolve to
  // "edit" below without ever changing the `mode` prop — `mode === "view"`
  // keeps meaning "this page's identity is an associated record" throughout,
  // which is what gates the cannot-delete-from-here dialog further down.
  const [associatedEditing, setAssociatedEditing] = useState(false);
  const [showCannotDelete, setShowCannotDelete] = useState(false);
  // Slice #34.27: the refusal dialog for a version that cannot be written back.
  const [showCannotRestore, setShowCannotRestore] = useState(false);

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
  // Hoisted out of the JSX so the picker and the version view read the SAME
  // array. The none-option is prepended unconditionally, which is why the
  // assembled array is never `undefined` and why `snapshotLookupStates` below
  // is gated on the QUERY's data instead — see its docblock.
  const judicialPersonTypeSelectOptions = [
    { value: "", label: "—" },
    ...judicialPersonTypeOptions.map((opt) => ({ value: opt.id, label: opt.name })),
  ];

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

  const editDirty =
    !isCreate && isOnLatest && !formValuesEqual(watchedValues, baseline.values);

  const goToVersion = (target: number) => {
    const leaving = effectiveVersion;
    // ⚠️ **Both make-current dialogs are about the version being LEFT.** #34.27
    // `ConfirmDialog` has no focus trap and the ◀/▶ nav is portalled outside it
    // (`versionNavSlot`), so Shift+Tab and Enter step to another version with a
    // dialog still up — and the refusal's sentence then names fields from a
    // version nobody is looking at, or opens again, unpressed, on the next
    // blocked version it lands on. The confirmation is the worse half: it would
    // restore the version the user arrived at, not the one they agreed to.
    // `property-form.tsx` has cleared both here since #34.17.
    setShowCannotRestore(false);
    setConfirmMakeCurrent(false);
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

  // Slice #34.27: what the VIEWED VERSION recorded in its lookup field.
  //
  // ⚠️ **The list is handed over ONLY once its query has data**, which is what
  // makes `undefined` mean "not read yet" rather than "holds no such row" — the
  // assembled array above is never undefined, because the none-option is
  // prepended to it unconditionally. Labelling an unread list's id „valoare
  // ștearsă" would be a confident sentence about something nobody has read.
  //
  // The `isOnLatest` gate lives inside `snapshotLookupStates` rather than here;
  // its docblock says why.
  const snapshotLookups = snapshotLookupStates({
    snapshot:      currSnap,
    isOnLatest,
    judicialTypes: judicialPersonTypes ? judicialPersonTypeSelectOptions : undefined,
  });

  // What "Make this version current" can do with this version. A `deleted` id is
  // still on the form — `goToVersion` reset the form to the snapshot — and the
  // column is a foreign key, so the restore would PATCH a dangling uuid and come
  // back 23503 as the English string „Foreign key violation". The press is
  // refused instead, in a dialog that NAMES the field. `restoreBlockedBy` argues
  // the rest, including why `pending` does not block.
  const restoreBlocked = restoreBlockedBy(snapshotLookups);
  const lookupFieldLabels: Record<JudicialLookupField, string> = {
    judicialPersonTypeId: t("fields.judicialType"),
  };
  const namedFields = (fields: JudicialLookupField[]) =>
    fields.map((f) => lookupFieldLabels[f]).join(", ");
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
          // FU-067 (Slice #37.07): not in a read-only view opened from an
          // association tab — „Fă curentă" writes, and „Modifică" is how that
          // view is turned into one that may.
          canMakeCurrent: !isOnLatest && (mode !== "view" || associatedEditing),
          // Slice #34.27: a version that cannot be written back says so, in a
          // dialog. The button stays enabled on purpose — a disabled one puts
          // its reason in a `title`, on a control out of the tab order.
          onMakeCurrent: () =>
            restoreBlocked.length > 0
              ? setShowCannotRestore(true)
              : setConfirmMakeCurrent(true),
        }
      : null;

  const makeCurrentNextNumber = (latestVersion ?? 0) + 1;

  // ⚠️ **Slice #37.18: as tiles, an invalid form does NOT disable „Salvează"**
  // (the Natural Person's rule, #37.17). The error may sit in a tile that is
  // not shown, and a disabled button says nothing about where. Pressing it runs
  // the validation (`onInvalid`), which shows that tile, scrolls to the field,
  // focuses it and pulses it; nothing is saved. „Adaugă persoană juridică" (no
  // tiles) keeps the old rule.
  const saveDisabled =
    submitting ||
    (!tiled && !form.formState.isValid) ||
    ((mode === "edit" || associatedEditing) && isOnLatest && !editDirty);

  // Slice #37.21: the version a save starts from, the refusal of a stale one,
  // and the notices from this browser's other windows (record-save-sync.tsx).
  const recordSync = useRecordSaveSync({
    recordPath: mode === "create" || !personId ? null : `/api/judicial-persons/${encodeURIComponent(personId)}`,
    dirty: editDirty,
    latestVersion,
  });

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
      await queryClient.invalidateQueries({ queryKey: ["judicial-persons"] });
      // The unified /persons list (Slice #15.09) caches under ["persons"];
      // invalidate it too so a created/edited/deleted person shows without a
      // manual browser refresh (Slice #18.13).
      await queryClient.invalidateQueries({ queryKey: ["persons"] });
      // Slice #18.05: a save appended a new version — refresh the nav.
      await queryClient.invalidateQueries({ queryKey: ["person-versions"] });
      return true;
    } catch (err) {
      // Slice #37.21: a save refused as stale writes nothing; the notice says so.
      if (recordSync.refused(err)) return false;
      setSubmitError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  // Slice #37.18 — an error in a hidden tile: show the tile (for this visit),
  // scroll to the field, focus it and pulse it (the Natural Person's
  // `onInvalid`, #37.17). react-hook-form's own focus cannot reach an input
  // inside a `display: none` tile, which is why this waits for the tile to be
  // drawn first — a timeout rather than an animation frame, which a browser
  // does not run in a tab that is not in front.
  const onInvalid = (errs: FieldErrors<FormValues>) => {
    if (!tiles) return;
    const path = firstErrorPath(errs);
    if (!path) return;
    const tile = jpTileOfField(path);
    if (!tiles.shown.includes(tile)) tiles.onRevealTile(tile);
    window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[name="${CSS.escape(path)}"]`);
      if (!el) return;
      el.scrollIntoView({ block: "center" });
      el.focus({ preventScroll: true });
      // The pulse goes on the field's row, not the box: the error re-renders
      // the box's className (its red border) and would wipe a class added here.
      const row = el.closest("label") ?? el.parentElement ?? el;
      row.classList.add("ga-vpulse-red");
      window.setTimeout(() => row.classList.remove("ga-vpulse-red"), 3300);
    }, 60);
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
    // Slice #21.04.Import: an associated record reverts to its read-only
    // presentation (Back to list + Modify) once the edit is saved — Modify
    // must be clicked again for a further change.
    if (mode === "view") setAssociatedEditing(false);
    router.refresh();
  };

  const handleMakeCurrent = async () => {
    // ⚠️ **The press is not the last word — this is.**             (#34.27)
    // A value list that resolves while the confirmation dialog is open turns a
    // `pending` field into a `deleted` one, and `onYes` still fires. Swapping
    // the dialogs rather than returning silently, because a press that was
    // legal a second ago deserves the reason — and „Foreign key violation" is
    // what the alternative says.
    if (restoreBlocked.length > 0) {
      setConfirmMakeCurrent(false);
      setShowCannotRestore(true);
      return;
    }
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
      // FU-228 (Slice #37.07): the record is gone, so „RECENTE" forgets it.
      forgetRecentlyViewed(personId!);
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
      onSubmit={form.handleSubmit(onSubmit, onInvalid)}
      // Slice #37.13: a whole number of panels wide, so the action bar below
      // them is as wide as they are (#37.12's rule). Slice #37.18: in tile
      // mode the page's tile row carries that width and the form itself is
      // `contents` (see `tiles`).
      className={tiled ? "contents" : "flex flex-col gap-4"}
      style={tiled ? undefined : unitRowStyle("judicialPerson")}
      noValidate
    >
      {/* Slice #20.13: sticky "Modificări nesalvate" banner. */}
      <UnsavedChangesBanner show={editDirty} className={tiled ? "basis-full" : undefined} />
      <RecordSyncNotice sync={recordSync} dirty={editDirty} listHref="/judicial-persons" className={tiled ? "basis-full" : undefined} />

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

      <fieldset disabled={effectiveMode === "view"} className={tiled ? "contents" : "flex flex-col gap-4 border-0 m-0 p-0 min-w-0"}>

      {/* Slice #37.13: four panels of one fixed width, left-aligned, flowing and
          wrapping — the rule #37.12 set for the Natural Person
          (`src/lib/ui/field-widths.ts`, `.claude/rules/styling-and-buttons.md`).
          This replaced a stack of full-width sections inside the page's
          centred 768-pixel cap. */}
      <div
        className={tiled ? "contents" : "flex flex-wrap items-start"}
        style={tiled ? undefined : { gap: PANEL_GAP }}
        data-panel-row
      >

      {/* Judicial Person identity section. Slice #37.29: every label above its
          box, the rows of `SCREEN_ROWS.judicialPerson.identity`, and the panel
          the fewest whole width units that hold its widest row (3). */}
      <section style={PANEL_UNIT_STYLE.judicialPerson.identity} data-panel="identity" {...tileProps("identity")} className={`rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900${hiddenClass("identity")}`}>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">
          {t("sections.identity")}
        </h2>
        <div className="flex flex-col gap-2">
          <Field
            label={t("fields.name")}
            name="name"
            register={register}
            error={errors.name?.message}
            highlight={displayHighlights?.fields.name}
            width={JP.name}
            fillRem={PANEL_UNIT_INNER_REM.judicialPerson.identity}
          />
          <div className={STACKED_ROW_CLASS}>
            <Field
              label={t("fields.nickname")}
              name="nickname"
              register={register}
              error={errors.nickname?.message}
              highlight={displayHighlights?.fields.nickname}
              width={JP.nickname}
            />
            <SelectField
              label={t("fields.judicialType")}
              name="judicialPersonTypeId"
              register={register}
              control={control}
              error={errors.judicialPersonTypeId?.message}
              options={judicialPersonTypeSelectOptions}
              highlight={displayHighlights?.fields.judicialPersonTypeId}
              snapshot={snapshotLookups.judicialPersonTypeId}
              width={JP.judicialPersonTypeId}
            />
          </div>
          {/* Rule 14: the identifiers together — the app's own code (a saved
              company only) beside the two registry numbers. Rule 15: the CUI
              lock hint sits under CUI, inside its width. */}
          <div className={STACKED_ROW_CLASS}>
            {mode !== "create" && personCode && (
              <ReadOnlyField label={t("fields.code")} value={personCode} width={JP.code} field="code" />
            )}
            <Field
              label={t("fields.cuiNumber")}
              name="cuiNumber"
              register={register}
              error={errors.cuiNumber?.message}
              hint={cuiIsLocked ? t("hints.cuiLocked") : undefined}
              highlight={displayHighlights?.fields.cuiNumber}
              width={JP.cuiNumber}
            />
            <Field
              label={t("fields.tradeRegisterNumber")}
              name="tradeRegisterNumber"
              register={register}
              error={errors.tradeRegisterNumber?.message}
              highlight={displayHighlights?.fields.tradeRegisterNumber}
              width={JP.tradeRegisterNumber}
            />
          </div>
          <Field
            label={t("fields.notes")}
            name="notes"
            register={register}
            error={errors.notes?.message}
            highlight={displayHighlights?.fields.notes}
            width={JP.notes}
            fillRem={PANEL_UNIT_INNER_REM.judicialPerson.identity}
          />
        </div>
      </section>

      {/* ── Contact Persons ──────────────────────────────────────────────── */}
      <section style={PANEL_UNIT_STYLE.judicialPerson.contactPersons} data-panel="contact-persons" {...tileProps("contactPersons")} className={`rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900${hiddenClass("contactPersons")}`}>
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

      {/* Slice #37.18: „Adrese" is one tile of two panels — the registered
          address and the correspondence panel — so they show and hide together. */}
      <div {...tileProps("addresses")} className={tileShown("addresses") ? "contents" : "hidden"}>
      {/* ── Registered Address — the shared block, stacked (#37.29) ──
          „Aceeași cu adresa sediului social" is its last line (the block's
          `footer`), as on the Natural Person, so nothing floats between panels
          (rule 6) and the loose correspondence panel is gone. */}
      <AddressBlock<FormValues>
        title={t("sections.registeredAddress")}
        prefix="addresses.HEADQUARTERS"
        register={register}
        errors={errors.addresses?.HEADQUARTERS}
        highlights={displayHighlights?.addresses.HEADQUARTERS}
        footer={
          <Controller
            control={control}
            name="correspondenceSameAsHq"
            render={({ field }) => (
              <label
                className={[
                  "flex cursor-pointer items-center gap-2 rounded-md text-sm select-none",
                  field.value
                    ? "font-bold text-ink dark:text-zinc-200"
                    : "font-normal text-fade dark:text-zinc-400",
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
        }
      />

      {/* ── Correspondence Address — only when not same as registered: its own
          3-unit panel, as on the Natural Person. ── */}
      {!correspondenceSameAsHq && (
        <AddressBlock<FormValues>
          title={t("sections.correspondenceAddress")}
          prefix="addresses.CORRESPONDENCE"
          register={register}
          errors={errors.addresses?.CORRESPONDENCE}
          highlights={displayHighlights?.addresses.CORRESPONDENCE}
        />
      )}
      </div>{/* end „Adrese" tile */}

      </div>{/* end panel row */}

      </fieldset>{/* end disabled fieldset */}

      {/* Slice #37.18: in tile mode the error and the action bar are the tile
          row's last line (`order-last`), after the list tiles. */}
      <div className={tiled ? "order-last flex basis-full flex-col gap-4" : "contents"}>

      {submitError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {submitError}
        </p>
      )}

      {/* Slice #21.04.Import: in true read-only view (opened via ?readonly=true
          from an association list) show Back-to-list (left) + Modify (right).
          Once Modify is clicked (associatedEditing), show Back-to-list (left)
          + Save/Delete (right) — no Cancel (Back-to-list covers that). When
          effectiveMode is "view" only because an earlier historical version
          is being viewed (mode is still "edit"), render nothing — the
          version nav arrows are the way back. */}
      {effectiveMode === "view" ? (
        mode === "view" && (
          <div className="flex items-center justify-between border-t border-crease pt-6 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-1.5 rounded-md border border-wire bg-white px-5 py-2 text-[0.9375rem] font-semibold text-navy shadow-sm hover:bg-canvas dark:border-zinc-700 dark:bg-zinc-900 dark:text-blue-300 dark:hover:bg-zinc-800"
            >
              <NavArrowIcon dir="left" />
              <span>{tShared("backToList")}</span>
            </button>
            {/* Slice #32.15: on an older version this button used to be drawn,
                clickable and inert — setAssociatedEditing cannot beat !isOnLatest
                in the effectiveMode ternary above, so nothing unlocked. It is now
                disabled, and carries the reason in its title. */}
            <button
              type="button"
              onClick={() => setAssociatedEditing(true)}
              disabled={!isOnLatest}
              title={!isOnLatest ? tShared("modifyNeedsLatest") : undefined}
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
            <span>{tShared("backToList")}</span>
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
            onClick={onCancel}
            disabled={submitting}
            className={buttonClass({ variant: "secondary", size: "lg" })}
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

      {/* Slice #34.27 — the refusal, with the field named. `blockedTitle` is a
          statement rather than a question, and the single-button info shape is
          the one `cannotDeleteAssociated` has used since #21.04.Import.
          `&& restoreBlocked.length > 0` so the dialog cannot outlive its own
          reason: it names fields, and a list that resolved under it would
          otherwise leave it saying „Câmpuri: ." */}
      {showCannotRestore && restoreBlocked.length > 0 && (
        <ConfirmDialog
          title={t("makeCurrent.blockedTitle")}
          body={t("makeCurrent.blocked", { fields: namedFields(restoreBlocked) })}
          yesLabel={t("makeCurrent.ok")}
          onYes={() => setShowCannotRestore(false)}
          busy={false}
        />
      )}

      {/* Slice #21.04.Import: an associated judicial person can't be deleted
          from this (readonly-opened) page — it must be disassociated first,
          then deleted from its own page via the left navigation panel.
          Info-only dialog (no noLabel/onNo) — a single OK button dismisses it. */}
      {showCannotDelete && (
        <ConfirmDialog
          title={t("cannotDeleteAssociated.title")}
          body={t("cannotDeleteAssociated.body")}
          yesLabel={t("cannotDeleteAssociated.ok")}
          onYes={() => setShowCannotDelete(false)}
          busy={false}
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
      </div>{/* end the action bar's line */}
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

  // Slice #37.13: the chosen person's name is a GROWING value — the box is
  // `JP.contactPerson` wide and a long name wraps onto more lines, never cut.
  // Slice #37.29: the label above it, the pair as wide as the box.
  return (
    <div className={STACKED_FIELD_CLASS} style={boxStyle(JP.contactPerson)} role="group" aria-label={label}>
      <span className={STACKED_LABEL_CLASS}>
        {label}
      </span>
      <div
        className={[
          "flex items-start gap-2 rounded-md py-1",
          highlight ? "px-1 " + ring : "",
        ].join(" ")}
        style={boxStyle(JP.contactPerson)}
        data-width-field={`contactPerson${slot}`}
        data-width-kind={JP.contactPerson.kind}
      >
        {hasLink ? (
          <>
            <Link
              href={`/natural-persons/${encodeURIComponent(personId as string)}?readonly=true`}
              className="min-w-0 break-words text-cta underline hover:text-cta-d"
            >
              {(personName as string) || personId}
            </Link>
            {mode !== "view" && (
              <button
                type="button"
                onClick={onClear}
                className={buttonClass({ variant: "danger", size: "xs", className: "shrink-0" })}
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
              className={buttonClass({ variant: "secondary", size: "sm" })}
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
            className={buttonClass({ variant: "secondary", size: "lg" })}
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedId}
            className={buttonClass({ variant: "primary", size: "lg" })}
          >
            {t.select}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hooks to get translation objects in a stable shape for sub-components
// ---------------------------------------------------------------------------

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
  /**
   * Slice #37.13: the box's width and kind, from `src/lib/ui/field-widths.ts`
   * — a GROWING kind renders `<GrowingText>`, every other an `<input>` as wide
   * as its step. The same helper shape as the Natural Person's (#37.12).
   */
  width: FieldWidth;
  /** Slice #37.29: the panel's inner width, for a box that `fill`s it (Denumire, Note). */
  fillRem?: number;
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
  hint,
  highlight,
  width,
  fillRem,
}: FieldProps) {
  const ring = usePulseRing(highlight);
  const className = [
    BOX_CLASS,
    error
      ? "border-red-500 focus:border-red-600"
      : "border-wire focus:border-focus dark:border-zinc-700",
    ring,
  ].join(" ");
  const grows = width.kind === "grows" || width.kind === "lines";
  // Slice #37.29: the label ABOVE its box, the pair exactly as wide as the box
  // (or the panel, for a box that fills it) — a long label wraps inside it.
  const box = stackedBoxStyle(width, fillRem ?? boxRem(width));
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
          aria-invalid={error ? true : undefined}
          className={className}
          data-width-field={name}
          data-width-kind={width.kind}
        />
      ) : (
        <input
          type={type}
          {...register(name)}
          aria-invalid={error ? true : undefined}
          className={className}
          style={box}
          data-width-field={name}
          data-width-kind={width.kind}
        />
      )}
      {hint && !error && (
        <span className="text-xs text-fade dark:text-zinc-400">{hint}</span>
      )}
      {error && (
        <span className="text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
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
  highlight,
  snapshot,
  width,
}: FieldProps & {
  control: Control<FormValues>;
  options: { value: string; label: string }[];
  /**
   * Slice #34.27: what the viewed VERSION recorded in this field.
   *
   * `empty` in create mode and on the latest — `snapshotLookupStates` returns
   * that for both — and `resolved` or `pending` on a version whose list can
   * still answer for it. All three render the picker below exactly as it always
   * has; only `deleted` takes the field over here, because a person snapshot
   * holds an id or nothing and can never reach `recorded`. Optional because the
   * prop is for call sites whose options come from an admin-managed list; this
   * form has exactly one `SelectField` and it does pass `snapshot`, so nothing
   * omits it today.
   *
   * `error` is not rendered on the printed branch. It is unreachable there
   * rather than dropped — a historical version resolves `effectiveMode` to
   * "view", `form.reset` clears errors, and this field carries no rule that
   * could set one. The day it does, this branch needs the error span the picker
   * branch has.
   */
  snapshot?: SnapshotLookupState;
}) {
  // ⚠️ **`tSnapshot`, NOT a second `tShared`, AND `record-list-agreement.test.ts`
  // IS WHY.** This file's component-scope `tShared` binds
  // `shared.readonlyView`; that suite reads the FIRST `const tShared =
  // useTranslations("…")` in a file and then requires every `tShared("key")` in
  // it to resolve under that one namespace. A second `tShared` bound to
  // `shared` made the identifier mean two things in one file — unreadable to the
  // guard and to a reader — and composed `shared.readonlyView.snapshotValue.
  // deleted`, which does not exist. `property-form.tsx` reuses the name legally
  // because BOTH of its bindings are `shared`; here the name is already taken
  // for something else, so the label gets its own.
  const tSnapshot = useTranslations("shared");
  const ring = usePulseRing(highlight);
  // Slice #37.13: the chosen option in full on hover when the box is narrower (#37.12).
  const current = useWatch({ control, name });
  const chosenLabel = options.find((o) => o.value === (current ?? ""))?.label;

  // A version whose lookup row an admin deleted PRINTS what the snapshot holds
  // instead of offering a picker that has no option for it — which is the empty
  // box it rendered until this slice. ⚠️ **Not `optionsWithUnlistedValues`
  // coming back:** that function (deleted in Slice #34.03 with the
  // `allowUnlistedValue` prop) synthesised an `<option>` inside a LIVE picker,
  // so an unlisted value stayed selectable and could be saved back. Nothing
  // here is selectable and nothing here is written — the dangling id never
  // enters the DOM at all. Not a `<label>`: there is no control to associate
  // with, exactly like `<ReadOnlyField>` further down.
  if (snapshot && snapshotReplacesPicker(snapshot)) {
    // `role="group"` + `aria-labelledby` because the value is no longer a
    // control for the `<label>` to point at, and a `<span>` beside a `<div>` is
    // nothing to a screen reader.
    const labelId = `${name}-version-label`;
    return (
      <div className={STACKED_FIELD_CLASS} style={boxStyle(width)} role="group" aria-labelledby={labelId}>
        <span id={labelId} className={STACKED_LABEL_CLASS}>
          {label}
        </span>
        <div className="flex flex-col gap-0.5" style={boxStyle(width)} data-width-field={name} data-width-kind={width.kind}>
          <SnapshotValue
            state={snapshot}
            deletedLabel={tSnapshot("snapshotValue.deleted")}
            className={ring}
          />
        </div>
      </div>
    );
  }

  return (
    <label className={STACKED_FIELD_CLASS} style={boxStyle(width)}>
      <span className={STACKED_LABEL_CLASS}>
        {label}
      </span>
      <div className="flex flex-col gap-0.5" style={boxStyle(width)}>
        {/* Slice #32.13: this select had no remount key at all, so a stored
            Judicial Person Type — the options come from a useQuery that
            resolves after mount — showed as "—" however long you waited.
            <AsyncSelect> is the single idiom, shared with the property and
            natural-person forms. */}
        <AsyncSelect
          name={name}
          control={control}
          register={register}
          options={options}
          aria-invalid={error ? true : undefined}
          className={[
            BOX_CLASS,
            error
              ? "border-red-500 focus:border-red-600"
              : "border-wire focus:border-focus dark:border-zinc-700",
            ring,
          ].join(" ")}
          style={boxStyle(width)}
          title={chosenLabel}
          widthField={name}
        />
        {error && (
          <span className="text-xs text-red-600 dark:text-red-400">
            {error}
          </span>
        )}
      </div>
    </label>
  );
}

function ReadOnlyField({ label, value, width, field }: { label: string; value: string; width: FieldWidth; field: string }) {
  return (
    <div className={STACKED_FIELD_CLASS} style={boxStyle(width)}>
      <span className={STACKED_LABEL_CLASS}>
        {label}
      </span>
      <div
        className="rounded-md border border-wire bg-canvas px-2 py-1 font-mono text-sm text-ink dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
        style={boxStyle(width)}
        data-width-field={field}
        data-width-kind={width.kind}
      >
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
  // Slice #21.04.Import: noLabel/onNo are optional — omitting both renders a
  // single-button info dialog (e.g. "can't delete from here") instead of a
  // yes/no confirmation.
  noLabel?: string;
  onYes: () => void;
  onNo?: () => void;
  busy: boolean;
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
        <h3
          id="confirm-title"
          className="text-base font-semibold text-ink dark:text-zinc-100"
        >
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
