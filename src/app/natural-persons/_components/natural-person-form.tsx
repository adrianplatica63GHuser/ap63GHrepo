"use client";

import { useNameOr } from "@/components/record/use-name-or";
import { SystemIdCorner } from "@/components/record/system-id-corner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useTimeFrames, tfDays } from "@/hooks/use-time-frames";
import { useCitizenshipOptions, usePersonTypeOptions } from "@/hooks/use-lookup-options";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldErrors,
  type UseFormRegister,
  useForm,
  useWatch,
} from "react-hook-form";
import { AsyncSelect } from "@/components/forms/async-select";
import { GrowingText } from "@/components/forms/growing-text";
import {
  NATURAL_PERSON as NP,
  NP_PANEL_INNER_REM,
  NP_PANEL_STYLE,
  NP_VALIDITY_REM,
  PANEL_GAP,
  boxRem,
  boxStyle,
  npRowStyle,
  rem,
  stackedBoxStyle,
  type FieldWidth,
} from "@/lib/ui/field-widths";
import { AddressBlock } from "@/components/address/address-block";
import { refusalCode, safeMutate } from "@/lib/api/safe-mutate";
import { HintBubble } from "@/lib/ui/hint-bubble";
import { ArrowLeft, Pencil, Save, Trash2, X } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { UnsavedChangesBanner } from "@/components/unsaved-changes-banner";
import { useUnsavedChangesGuard } from "@/components/providers/unsaved-changes-provider";
import {
  VersionNavControls,
  type VersionNavView,
} from "@/components/version-nav-controls";
import { STACKED_FIELD_CLASS, STACKED_LABEL_CLASS, STACKED_ROW_CLASS } from "@/lib/ui/stacked";
import { FieldPulseContext, usePulseRing } from "@/components/versioning/field-pulse";
import { SnapshotValue } from "@/components/versioning/snapshot-value";
import {
  snapshotReplacesPicker,
  type SnapshotLookupState,
} from "@/lib/versioning/snapshot-lookup";
import { highlightRingClass } from "@/lib/versioning/highlight-ring";
import type { HighlightColor } from "@/lib/versioning/field-diff";
import type { NaturalPersonSnapshot } from "@/lib/persons/validation";
import { inferProvenance } from "@/lib/metadata/provenance-rules";
import {
  computeFieldHighlights,
  emptyFormValues,
  formSchema,
  formValuesEqual,
  type FormValues,
  type NaturalFieldHighlights,
  type NaturalLookupField,
  restoreBlockedBy,
  snapshotLookupStates,
  snapshotToFormValues,
  toApiPayload,
  versionLabelColor,
} from "./form-schema";
import { buttonClass } from "@/lib/ui/button-styles";
import { npTileOfField, type NpTile } from "./person-tiles";
import { firstErrorPath } from "@/lib/ui/tiles";
import { forgetRecentlyViewed } from "@/components/providers/navigation-history-provider";
import { RecordSyncNotice, useRecordSaveSync } from "@/components/record-save-sync";

import { ageFromDob } from "@/lib/persons/person-age";

type IdCardLink = { id: string; code: string; title: string | null } | null;

/** Age in whole years — the same function the Natural Persons list's „Vârstă" reads (Slice #37.60). */
const calculateAge = (dob: string): number | null => ageFromDob(dob);

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
  /**
   * Slice #37.17: the screen's tiles, when the form is drawn as tiles (the
   * saved person's page). Absent on „Adaugă persoană", which keeps its plain
   * panel row.
   *
   * ⚠️ **A FORM TILE THAT IS NOT SHOWN IS HIDDEN, NEVER UNMOUNTED** — the
   * document notebook's rule (#36.01), for the same reasons: react-hook-form's
   * values, `editDirty`, the version-diff highlights and the field pulses are
   * all computed over inputs that are on the page. An unsaved change in a tile
   * then unticked is still saved by „Salvează", and the banner still guards it.
   *
   * In tile mode the form, its fieldset and its panel row are `display:
   * contents`, so every panel is an item of the page's tile row and the list
   * tiles flow beside them; the action bar is `order-last basis-full`, the
   * row's last line.
   */
  tiles?: {
    shown: readonly NpTile[];
    labels: Readonly<Record<NpTile, string>>;
    /** Show a hidden tile for this visit — an error has been found in it. */
    onRevealTile: (tile: NpTile) => void;
  };
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

export function NaturalPersonForm({
  mode,
  personId,
  personCode,
  initialValues,
  linkedIdCard,
  versionNavSlot,
  tiles,
}: Props) {
  const t = useTranslations("naturalPerson");
  const nameOr = useNameOr(); // #37.57: a name, or words — never the system ID
  // Slice #37.17 — tile mode. `tileProps` marks a form tile for the specs and
  // hides it when unticked; `hidden` alone would lose to any display class, so
  // the class goes with it (the notebook's note in document-form.tsx).
  const tiled = tiles !== undefined;
  const tileShown = (tile: NpTile): boolean => !tiles || tiles.shown.includes(tile);
  const tileProps = (tile: NpTile) =>
    tiles
      ? { "data-tile": tile, role: "region", "aria-label": tiles.labels[tile], hidden: !tileShown(tile) }
      : {};
  const hiddenClass = (tile: NpTile): string => (tileShown(tile) ? "" : " hidden");
  // Shared read-only-view copy (Back to list button + edit hint) — reused
  // identically across all four entity forms.
  const tShared = useTranslations("shared.readonlyView");
  const router = useRouter();
  const queryClient = useQueryClient();
  // Slice #34.04: both lists are React Query keys now, so a rename or a delete
  // in Reference Data reaches these two selects, and a failed read says so on
  // screen instead of rendering as an empty archive. `useState` + `useEffect`
  // could be reached by neither.
  const { options: citizenshipOptions, listState: citizenshipListState } =
    useCitizenshipOptions();
  // Slice #18.16.VL:
  const { options: personTypeOptions, listState: personTypeListState } =
    usePersonTypeOptions();
  const { data: tf } = useTimeFrames();

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
    idValidUntilDaysLeft !== null && idValidUntilDaysLeft <= tfDays(tf, "id_card_expiring_soon");

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

  // Slice #34.27: what the VIEWED VERSION recorded in its two lookup fields.
  //
  // ⚠️ **Each list is handed over as `{ options, listState }` rather than as the
  // array alone, and that is the load-bearing part.** The hooks return
  // `options: data ?? NO_OPTIONS`, so an UNREAD list and a list that really
  // holds no rows are both `[]` here; `listState` is the only thing left that
  // separates them. Passing `citizenshipOptions` on its own would label every
  // historical citizenship „valoare ștearsă" for as long as the list was
  // unread, and for ever if it could not be read at all — a confident sentence
  // measured against nothing. `snapshotLookupStates` does that narrowing, so
  // the distinction is a unit test rather than a line of JSX nobody rereads.
  //
  // The `isOnLatest` gate lives inside `snapshotLookupStates` rather than here;
  // its docblock says why.
  const snapshotLookups = snapshotLookupStates({
    snapshot:     currSnap,
    isOnLatest,
    personTypes:  { options: personTypeOptions,  listState: personTypeListState },
    citizenships: { options: citizenshipOptions, listState: citizenshipListState },
  });

  // What "Make this version current" can do with this version. A `deleted` id is
  // still on the form — `goToVersion` reset the form to the snapshot — and its
  // column is a foreign key, so the restore would PATCH a dangling uuid and come
  // back 23503 as the English string „Foreign key violation". The press is
  // refused instead, in a dialog that NAMES the fields: „a value" would be a
  // reason nobody could act on, and the two fields sit in different sections of
  // this form. `restoreBlockedBy` argues the rest, including why `pending` does
  // not block.
  const restoreBlocked = restoreBlockedBy(snapshotLookups);
  const lookupFieldLabels: Record<NaturalLookupField, string> = {
    physicalPersonTypeId: t("fields.physicalPersonTypeId"),
    citizenshipId:        t("fields.citizenship"),
  };
  const namedFields = (fields: NaturalLookupField[]) =>
    fields.map((f) => lookupFieldLabels[f]).join(", ");

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

  // Save button disabled if: form invalid, currently submitting, or (edit mode,
  // on the latest) the form hasn't diverged from the baseline.
  //
  // ⚠️ **Slice #37.17: as tiles, an invalid form does NOT disable „Salvează".**
  // The error may sit in a tile that is not shown, and a disabled button says
  // nothing about where. Pressing it runs the validation (`onInvalid`), which
  // shows that tile, scrolls to the field, focuses it and pulses it; nothing is
  // saved. „Adaugă persoană" (no tiles) keeps the old rule.
  const saveDisabled =
    submitting ||
    (!tiled && !form.formState.isValid) ||
    ((mode === "edit" || associatedEditing) && isOnLatest && !editDirty);

  // Slice #37.21: the version a save starts from, the refusal of a stale one,
  // and the notices from this browser's other windows (record-save-sync.tsx).
  const recordSync = useRecordSaveSync({
    recordPath: mode === "create" || !personId ? null : `/api/people/${encodeURIComponent(personId)}`,
    dirty: editDirty,
    latestVersion,
  });

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
      // Slice #37.21: a save refused as stale writes nothing; the notice says so.
      if (recordSync.refused(err)) return false;
      // Slice #37.50: the lock's refusal is the trigger's English sentence; say it in Romanian.
      setSubmitError(
        refusalCode(err) === "CNP_LOCKED"
          ? t("hints.cnpLocked")
          : err instanceof Error ? err.message : String(err),
      );
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  // Slice #37.17 — an error in a hidden tile: show the tile (for this visit),
  // scroll to the field, focus it and pulse it. react-hook-form's own focus
  // cannot reach an input inside a `display: none` tile, which is why this
  // waits for the tile to be drawn first — a timeout rather than an animation
  // frame, which a browser does not run in a tab that is not in front.
  const onInvalid = (errs: FieldErrors<FormValues>) => {
    if (!tiles) return;
    const path = firstErrorPath(errs);
    if (!path) return;
    const tile = npTileOfField(path);
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
    // Slice #21.04.Import: an associated record reverts to its read-only
    // presentation (Back to list + Modify) once the edit is saved — Modify
    // must be clicked again for a further change.
    if (mode === "view") setAssociatedEditing(false);
    router.refresh();
  };

  // "Make this version current": re-save the currently-viewed historical
  // snapshot (the form was reset to it on navigation) as a brand-new version,
  // via the normal edit-save path. updateNaturalPerson appends it as the new
  // latest (it differs from the current latest); we then follow it.
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
      // FU-228 (Slice #37.07): the record is gone, so „RECENTE" forgets it.
      forgetRecentlyViewed(personId!);
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

  const { register, control, formState } = form;
  const errors = formState.errors;

  // Is the CNP already set? Show lock hint wherever the field is editable.
  //                                                          (Slice #32.18)
  // `natural_person_lock_cnp` (drizzle/0000_initial_schema.sql) rejects the
  // UPDATE outright, and src/lib/api/errors.ts turns that into a 400 — so
  // without this the only signal is a failed save. It copies `cuiIsLocked` in
  // judicial-person-form.tsx in the thing that matters, DOWN TO NOT DISABLING
  // THE INPUT: the hint is a caption, the field stays editable, and the
  // database is still what refuses. Making this one a client-side block would
  // make the two forms behave differently again, in the other direction.
  //
  // ⚠️ IT DIVERGES FROM THAT MODEL IN ONE PLACE, DELIBERATELY: the test is
  // `effectiveMode`, not the `mode` prop the judicial form uses. `mode` is what
  // the page passed; `effectiveMode` (:257) is what the <fieldset disabled> at
  // :511 actually obeys, and the two differ on the path the hint exists for —
  // a person opened read-only from another record's association tab, where
  // pressing Modify sets `associatedEditing` and unlocks the CNP input while
  // `mode` is still "view". Keying off `mode` there would leave exactly the
  // silent 400 this is meant to pre-empt. It also stops the hint appearing on
  // a historical version, which is never editable and where `initialValues`
  // holds the CURRENT row's CNP rather than the one on screen.
  // judicial-person-form.tsx has the same hole and is not this slice's to edit.
  const cnpIsLocked =
    effectiveMode === "edit" && Boolean(initialValues?.cnp?.trim());

  return (
    <FieldPulseContext.Provider value={pulsing}>
    <form
      onSubmit={form.handleSubmit(onSubmit, onInvalid)}
      // Slice #37.12: as wide as the panels, so the action bar below them is
      // as wide as they are and not as wide as the window (#37.26: `npRowStyle`,
      // the panels being of different widths now). Slice #37.17: in tile mode
      // the page's tile row carries that width and the form itself is
      // `contents` (see `tiles`).
      className={tiled ? "contents" : "flex flex-col gap-4"}
      style={tiled ? undefined : npRowStyle()}
      noValidate
    >
      {/* Slice #20.13: sticky "Modificări nesalvate" banner — visible whenever
          the form has unsaved edits, even when Save is below the fold. */}
      <UnsavedChangesBanner show={editDirty} className={tiled ? "basis-full" : undefined} />
      <RecordSyncNotice sync={recordSync} dirty={editDirty} listHref="/natural-persons" className={tiled ? "basis-full" : undefined} />

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
      <fieldset disabled={effectiveMode === "view"} className={tiled ? "contents" : "flex flex-col gap-4 border-0 m-0 p-0 min-w-0"}>

      {/* Slice #37.12: five panels of fixed width, left-aligned, flowing left
          to right and wrapping onto the next row. The window decides how many
          sit side by side, never how wide anything is: every box below takes
          its width from `field-widths.ts`. This replaced the two
          `flex-1 min-w-[720px]` stacks of Slice #21.08.misc, which grew with
          the window and took every field with them.
          Slice #37.26: every label sits ABOVE its box, the fields are in the
          rows `NP_ROWS` names, and each panel is as wide as its widest row
          (`NP_PANEL_STYLE`) rather than 32rem — since #37.27 rounded up to
          whole width units, so the tiles' edges line up. */}
      <div
        className={tiled ? "contents" : "flex flex-wrap items-start"}
        style={tiled ? undefined : { gap: PANEL_GAP }}
        data-panel-row
      >

      {/* Identity — core biographical data */}
      <section style={NP_PANEL_STYLE.identity} data-panel="identity" {...tileProps("identity")} className={`rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900${hiddenClass("identity")}`}>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">
          {t("sections.identity")}
          {/* Slice #37.57: the system ID's one place — this corner. */}
          {mode !== "create" && personCode && <SystemIdCorner code={personCode} />}
        </h2>
        {/* Slice #37.26 — the rows of `NP_ROWS.identity`. */}
        <div className="flex flex-col gap-2">
          <div className={STACKED_ROW_CLASS}>
            <Field
              label={t("fields.lastName")}
              name="lastName"
              register={register}
              error={errors.lastName?.message}
              highlight={displayHighlights?.fields.lastName}
              width={NP.lastName}
            />
            <Field
              label={t("fields.firstName")}
              name="firstName"
              register={register}
              error={errors.firstName?.message}
              highlight={displayHighlights?.fields.firstName}
              width={NP.firstName}
            />
          </div>
          <div className={STACKED_ROW_CLASS}>
            <Field
              label={t("fields.nickname")}
              name="nickname"
              register={register}
              error={errors.nickname?.message}
              highlight={displayHighlights?.fields.nickname}
              width={NP.nickname}
            />
            <Field
              label={t("fields.cnp")}
              name="cnp"
              register={register}
              error={errors.cnp?.message}
              bubble={cnpIsLocked ? t("hints.cnpLocked") : undefined}
              highlight={displayHighlights?.fields.cnp}
              width={NP.cnp}
            />
          </div>
          {/* The age beside the date it is worked out from, then the gender. */}
          <div className={STACKED_ROW_CLASS}>
            <Field
              label={t("fields.dateOfBirth")}
              name="dateOfBirth"
              type="date"
              register={register}
              error={errors.dateOfBirth?.message}
              highlight={displayHighlights?.fields.dateOfBirth}
              width={NP.dateOfBirth}
            />
            <ReadOnlyField
              label={t("fields.age")}
              value={calculatedAge !== null ? String(calculatedAge) : "—"}
              width={NP.age}
              field="age"
            />
            <SelectField
              label={t("fields.gender")}
              name="gender"
              register={register}
              control={control}
              error={errors.gender?.message}
              options={[
                { value: "", label: "—" },
                { value: "MALE", label: t("options.gender.MALE") },
                { value: "FEMALE", label: t("options.gender.FEMALE") },
              ]}
              highlight={displayHighlights?.fields.gender}
              width={NP.gender}
            />
          </div>
          <div className={STACKED_ROW_CLASS}>
            <Field
              label={t("fields.placeOfBirth")}
              name="placeOfBirth"
              register={register}
              error={errors.placeOfBirth?.message}
              highlight={displayHighlights?.fields.placeOfBirth}
              width={NP.placeOfBirth}
            />
            <SelectField
              label={t("fields.physicalPersonTypeId")}
              name="physicalPersonTypeId"
              register={register}
              control={control}
              error={errors.physicalPersonTypeId?.message}
              hint={personTypeListState === "failed" ? t("hints.personTypeListFailed") : undefined}
              options={[{ value: "", label: "—" }, ...personTypeOptions]}
              highlight={displayHighlights?.fields.physicalPersonTypeId}
              snapshot={snapshotLookups.physicalPersonTypeId}
              width={NP.physicalPersonTypeId}
            />
          </div>
          <Field
            label={t("fields.notes")}
            name="notes"
            register={register}
            error={errors.notes?.message}
            highlight={displayHighlights?.fields.notes}
            width={NP.notes}
            fillRem={NP_PANEL_INNER_REM.identity}
          />
        </div>
      </section>

      {/* ID Card — official document data; populated manually or via scanner */}
      <section style={NP_PANEL_STYLE.idCard} data-panel="id-card" {...tileProps("idCard")} className={`rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900${hiddenClass("idCard")}`}>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">
          {t("sections.idCard")}
        </h2>
        {/* Slice #37.26 — the rows of `NP_ROWS.idCard`. */}
        <div className="flex flex-col gap-2">
          <div className={STACKED_ROW_CLASS}>
            <SelectField
              label={t("fields.idDocumentType")}
              name="idDocumentType"
              register={register}
              control={control}
              error={errors.idDocumentType?.message}
              options={[
                { value: "", label: "—" },
                { value: "ID_CARD", label: t("options.idDoc.ID_CARD") },
                { value: "PASSPORT", label: t("options.idDoc.PASSPORT") },
              ]}
              highlight={displayHighlights?.fields.idDocumentType}
              width={NP.idDocumentType}
            />
            <Field
              label={t("fields.idDocumentNumber")}
              name="idDocumentNumber"
              register={register}
              error={errors.idDocumentNumber?.message}
              highlight={displayHighlights?.fields.idDocumentNumber}
              width={NP.idDocumentNumber}
            />
            <Field
              label={t("fields.idCardNumber")}
              name="idCardNumber"
              register={register}
              error={errors.idCardNumber?.message}
              highlight={displayHighlights?.fields.idCardNumber}
              width={NP.idCardNumber}
            />
          </div>
          {/* The two dates, then their validity status in the rest of the row,
              level with the boxes (an empty line where their labels are). */}
          <div className={STACKED_ROW_CLASS}>
            <Field
              label={t("fields.idValidFrom")}
              name="idValidFrom"
              type="date"
              register={register}
              error={errors.idValidFrom?.message}
              highlight={displayHighlights?.fields.idValidFrom}
              width={NP.idValidFrom}
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
              width={NP.idValidUntil}
            />
            <div className={STACKED_FIELD_CLASS} style={{ width: rem(NP_VALIDITY_REM) }} data-validity-status>
              <span aria-hidden="true" className={`invisible ${STACKED_LABEL_CLASS}`}>{" "}</span>
              <div className="flex min-h-[1.875rem] items-center leading-tight">
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
          </div>
          <div className={STACKED_ROW_CLASS}>
            <SelectField
              label={t("fields.citizenship")}
              name="citizenshipId"
              register={register}
              control={control}
              error={errors.citizenshipId?.message}
              hint={citizenshipListState === "failed" ? t("hints.citizenshipListFailed") : undefined}
              options={[{ value: "", label: "—" }, ...citizenshipOptions]}
              highlight={displayHighlights?.fields.citizenshipId}
              snapshot={snapshotLookups.citizenshipId}
              width={NP.citizenshipId}
            />
            <Field
              label={t("fields.idIssuingAuthority")}
              name="idIssuingAuthority"
              register={register}
              error={errors.idIssuingAuthority?.message}
              highlight={displayHighlights?.fields.idIssuingAuthority}
              width={NP.idIssuingAuthority}
            />
          </div>
          <Field
            label={t("fields.idMrzRaw")}
            name="idMrzRaw"
            register={register}
            error={errors.idMrzRaw?.message}
            highlight={displayHighlights?.fields.idMrzRaw}
            width={NP.idMrzRaw}
            fillRem={NP_PANEL_INNER_REM.idCard}
            mono
          />
          {mode !== "create" && (
            <div className="flex flex-col gap-0.5 text-sm">
              <span className="font-medium text-ink dark:text-zinc-300">
                {t("fields.idLink")}
              </span>
              {linkedIdCard ? (
                <a
                  href={`/documents/${linkedIdCard.id}`}
                  className="text-cta hover:underline"
                >
                  {/* #37.57: the card by its title, not its system ID. */}
                  {nameOr(linkedIdCard.title, "document")} →
                </a>
              ) : (
                <span className="text-fade dark:text-zinc-500">{t("hints.idLinkNone")}</span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Contact — phones and emails */}
      <section style={NP_PANEL_STYLE.contact} data-panel="contact" {...tileProps("contact")} className={`rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900${hiddenClass("contact")}`}>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">
          {t("sections.contact")}
        </h2>
        {/* Slice #37.26 — the rows of `NP_ROWS.contact`; the panel is as wide as the two phones. */}
        <div className="flex flex-col gap-2">
          <div className={STACKED_ROW_CLASS}>
            <Field
              label={t("fields.personalPhone1")}
              name="personalPhone1"
              register={register}
              error={errors.personalPhone1?.message}
              highlight={displayHighlights?.fields.personalPhone1}
              width={NP.personalPhone1}
            />
            <Field
              label={t("fields.personalPhone2")}
              name="personalPhone2"
              register={register}
              error={errors.personalPhone2?.message}
              highlight={displayHighlights?.fields.personalPhone2}
              width={NP.personalPhone2}
            />
          </div>
          <Field
            label={t("fields.workPhone")}
            name="workPhone"
            register={register}
            error={errors.workPhone?.message}
            highlight={displayHighlights?.fields.workPhone}
            width={NP.workPhone}
          />
          <Field
            label={t("fields.personalEmail1")}
            name="personalEmail1"
            register={register}
            error={errors.personalEmail1?.message}
            highlight={displayHighlights?.fields.personalEmail1}
            width={NP.personalEmail1}
          />
          <Field
            label={t("fields.personalEmail2")}
            name="personalEmail2"
            register={register}
            error={errors.personalEmail2?.message}
            highlight={displayHighlights?.fields.personalEmail2}
            width={NP.personalEmail2}
          />
          <Field
            label={t("fields.workEmail")}
            name="workEmail"
            register={register}
            error={errors.workEmail?.message}
            highlight={displayHighlights?.fields.workEmail}
            width={NP.workEmail}
          />
        </div>
      </section>

      {/* Slice #37.17: „Adrese" is one tile — the home address and, when it
          differs, the correspondence address — so they show and hide together.
          Slice #37.27: the same-as-home checkbox is the last line of the home
          address panel, so it never takes a panel's room of its own. */}
      <div {...tileProps("addresses")} className={tileShown("addresses") ? "contents" : "hidden"}>
      <AddressBlock<FormValues>
        title={t("sections.homeAddress")}
        prefix="addresses.HOME"
        register={register}
        errors={errors.addresses?.HOME}
        highlights={displayHighlights?.addresses.HOME}
        footer={
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
        }
      />

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
      </div>{/* end „Adrese" tile */}

      </div>{/* end panel row */}

      </fieldset>{/* end disabled fieldset */}

      {/* Slice #37.17: in tile mode the error and the action bar are the tile
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
            <IconButton
              icon={ArrowLeft}
              label={tShared("backToList")}
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
              note={!isOnLatest ? tShared("modifyNeedsLatest") : undefined}
            />
          </div>
        )
      ) : mode === "view" ? (
        <div className="flex items-center justify-between border-t border-crease pt-6 dark:border-zinc-800">
          <IconButton
            icon={ArrowLeft}
            label={tShared("backToList")}
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
        <div className="flex items-center justify-center gap-3 border-t border-crease pt-6 dark:border-zinc-800">
          <IconButton
            icon={Save}
            label={t("buttons.save")}
            variant="primary"
            size="lg"
            type="submit"
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
            onClick={onCancel}
            disabled={submitting}
          />
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

      {/* Slice #34.27 — the refusal, with the fields named. `blockedTitle` is a
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

      {/* Slice #21.04.Import: an associated person can't be deleted from this
          (readonly-opened) page — it must be disassociated first, then
          deleted from its own page via the left navigation panel. Info-only
          dialog (no noLabel/onNo) — a single OK button dismisses it. */}
      {showCannotDelete && (
        <ConfirmDialog
          title={t("cannotDeleteAssociated.title")}
          body={t("cannotDeleteAssociated.body")}
          yesLabel={t("cannotDeleteAssociated.ok")}
          onYes={() => setShowCannotDelete(false)}
          busy={false}
        />
      )}
      </div>{/* end the action bar's line */}
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
  /**
   * Slice #37.50: a sentence about the box, shown in a bubble while the mouse
   * is over the box or the focus is in it, and the box's description at all
   * times (`HintBubble`) — never printed under the field. The CNP's (CUI's)
   * lock note, the only one.
   */
  bubble?: string;
  highlight?: HighlightColor;
  /** Adds a red border — used for expired dates. */
  expired?: boolean;
  /** Adds an orange border — used for dates expiring within 3 months. */
  expiringSoon?: boolean;
  /**
   * Slice #37.12: the box's width and kind, from `src/lib/ui/field-widths.ts`.
   * A GROWING kind (`grows`, `lines`) renders `<GrowingText>`: fixed width,
   * height grows to show the whole value. Every other kind is an `<input>` as
   * wide as its step and no wider.
   */
  width: FieldWidth;
  /** Monospace text — the MRZ, whose columns line up. */
  mono?: boolean;
  /**
   * Slice #37.26: the panel's inner width, for a box that `fill`s it (Note,
   * the MRZ). Every other box ignores it and keeps its own width.
   */
  fillRem?: number;
};

/**
 * Slice #37.26 — THE LABEL SITS ABOVE ITS BOX, left-aligned, and the pair is
 * exactly as wide as the box: a long label wraps inside that width rather than
 * widening the row (`shrink-0` so a row can never squeeze a box either).
 */
// Slice #37.29 (rule 16): the stacked classes are shared (`@/lib/ui/stacked`), so a row's
// boxes start on one line whatever its labels wrap to — the Judicial Person draws the same.

/** The box's own look; its width is never a class here — it comes from `stackedBoxStyle`. */
const BOX_CLASS =
  "rounded-md border bg-white px-2 py-1 shadow-sm focus:outline-none disabled:bg-canvas disabled:text-fade disabled:cursor-default dark:bg-zinc-950 dark:disabled:bg-zinc-800";

function Field({ label, name, type = "text", register, error, bubble, highlight, expired, expiringSoon, width, mono, fillRem }: FieldProps) {
  const ring = usePulseRing(highlight);
  const className = [
    BOX_CLASS,
    error || expired
      ? "border-red-500 focus:border-red-600"
      : expiringSoon
        ? "border-orange-500 focus:border-orange-600"
        : "border-wire focus:border-focus dark:border-zinc-700",
    mono ? "font-mono" : "",
    ring,
  ].join(" ");
  const grows = width.kind === "grows" || width.kind === "lines";
  const bubbleId = useId();
  const describedBy = bubble ? bubbleId : undefined;
  // The bubble's text sits inside this <label>, so without a name of its own the
  // box would be NAMED by the sentence as well as described by it (#37.50).
  const labelId = useId();
  const labelledBy = bubble ? labelId : undefined;
  const box = stackedBoxStyle(width, fillRem ?? boxRem(width));
  const control = grows ? (
    <GrowingText
      registration={register(name)}
      width={String(box.width)}
      lines={width.kind === "lines"}
      fold={width.fold}
      minRows={width.rows ?? 1}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      aria-labelledby={labelledBy}
      className={className}
      data-width-field={name}
      data-width-kind={width.kind}
    />
  ) : (
    <input
      type={type}
      {...register(name)}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      aria-labelledby={labelledBy}
      className={className}
      style={box}
      data-width-field={name}
      data-width-kind={width.kind}
    />
  );
  return (
    <label className={STACKED_FIELD_CLASS} style={box}>
      <span id={labelId} className={STACKED_LABEL_CLASS}>{label}</span>
      {bubble ? (
        <HintBubble id={bubbleId} text={bubble}>
          {control}
        </HintBubble>
      ) : (
        control
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
  control,
  error,
  hint,
  options,
  highlight,
  snapshot,
  width,
}: FieldProps & {
  control: Control<FormValues>;
  options: { value: string; label: string }[];
  /** A list that failed to load, said under the picker (#37.50 moved Field's own hint to `bubble`). */
  hint?: string;
  /**
   * Slice #34.27: what the viewed VERSION recorded in this field.
   *
   * `empty` in create mode and on the latest — `snapshotLookupStates` returns
   * that for both — and `resolved` or `pending` on a version whose list can
   * still answer for it. All three render the picker below exactly as it always
   * has; only `deleted` takes the field over here, because a person snapshot
   * holds an id or nothing and can never reach `recorded`. Optional, so the two
   * static-option call sites on this form (gender, ID document type) omit it:
   * they have no list an admin can delete a row from.
   *
   * `error` is not rendered on the printed branch and `hint` is not either.
   * `hint` loses nothing by construction: it fires on `listState === "failed"`,
   * which lands the field in `pending`, which takes the picker branch below.
   * `error` is unreachable rather than lossless — a historical version resolves
   * `effectiveMode` to "view", `form.reset` clears errors, and neither of these
   * two fields carries a rule that could set one. The day one does, this branch
   * needs the error span the picker branch has.
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
  // Slice #37.12: NOTHING IS CUT OFF WITHOUT A WAY TO READ IT. The box is as
  // wide as its step; an option longer than that shows in full on hover.
  const current = useWatch({ control, name });
  const chosenLabel = options.find((o) => o.value === (current ?? ""))?.label;
  const box = boxStyle(width);

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
    // nothing to a screen reader. `hint` is not rendered here and loses
    // nothing: it says the list could not be read, and a list that could not be
    // read leaves this field in `pending`, which takes the picker branch below.
    const labelId = `${name}-version-label`;
    return (
      <div className={STACKED_FIELD_CLASS} style={box} role="group" aria-labelledby={labelId}>
        <span id={labelId} className={STACKED_LABEL_CLASS}>{label}</span>
        <div className="flex flex-col gap-0.5" style={box} data-width-field={name} data-width-kind={width.kind}>
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
    <label className={STACKED_FIELD_CLASS} style={box}>
      <span className={STACKED_LABEL_CLASS}>{label}</span>
      <div className="flex flex-col gap-0.5" style={box}>
        {/* Slice #32.13: this select had no remount key at all, so a stored
            Professional Type or Citizenship — both fed by fetches that resolve
            after mount — showed as "—" however long you waited. <AsyncSelect>
            is the single idiom, shared with the property and judicial-person
            forms. */}
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
          style={box}
          title={chosenLabel}
          widthField={name}
        />
        {/* Slice #34.04: `hint` was already on `FieldProps` and rendered by
            `Field`; this component took the prop's type and dropped it on the
            floor. It carries the one sentence a select can need that an
            `error` cannot say — the list behind the options could not be read,
            so „—" means "unknown", not "none". `role="alert"` because it
            appears after the field is on screen and describes something the
            user has to act on. */}
        {hint && !error && (
          <span role="alert" className="text-xs text-red-600 dark:text-red-400">{hint}</span>
        )}
        {error && (
          <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
        )}
      </div>
    </label>
  );
}

function ReadOnlyField({ label, value, width, field }: { label: string; value: string; width: FieldWidth; field: string }) {
  return (
    <div className={STACKED_FIELD_CLASS} style={boxStyle(width)}>
      <span className={STACKED_LABEL_CLASS}>{label}</span>
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
