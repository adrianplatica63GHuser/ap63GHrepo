"use client";

import { SystemIdCorner } from "@/components/record/system-id-corner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useTimeFrames, tfDays } from "@/hooks/use-time-frames";
import { useCitizenshipOptions, usePersonRelationshipOptions, usePersonTypeOptions } from "@/hooks/use-lookup-options";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useCallback, type CSSProperties } from "react";
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
import { ALWAYS_SHOWN_FIELDS,
  NATURAL_PERSON as NP,
  NP_PANEL_INNER_REM,
  NP_PANEL_STYLE,
  PANEL_GAP,
  boxRem,
  boxStyle,
  npRowStyle,
  stackedBoxStyle,
  type FieldWidth,
} from "@/lib/ui/field-widths";
import { AddressBlock, AddressLine } from "@/components/address/address-block";
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
import { EMPTY_MARK, FIELD_BOX, FIELD_LABEL, FIELD_READONLY, fieldBorder } from "@/lib/ui/field-box";
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

import { personAgeText } from "@/lib/persons/person-age";
import { ParentsFold } from "@/components/persons/parents-fold";
import { TileTitle } from "@/components/tiles/tile-title";
import { EmptyTileLine, useEmptyTiles } from "@/components/tiles/empty-tile";
import type { PersonIdentityDocument } from "@/lib/identity-documents/person-list";
import { PersonIdentityDocuments } from "./person-identity-documents";
import { EmptyFieldsLink, HiddenFieldsContext, hiddenFieldStyle, useEmptyFields, useFieldHidden } from "@/components/tiles/empty-fields";
import {
  ReadModeContext,
  ReadValue,
  TILE_EDITING_CLASS,
  TileEditBar,
  TileEditButton,
  onTileKeyDown,
  readText,
  useFieldRead,
  useTileEditing,
  type ReadMode,
} from "@/components/tiles/read-edit-tile";
import { tileIsEmpty, valueAt } from "@/lib/ui/empty-tile";
import { ParentsResolution } from "@/components/persons/parents-resolution";
import {
  blankDrafts,
  followHolderSurname,
  incompleteParents,
  parentOutcomeSentences,
  parentsToCreate,
  type ParentDraft,
  type ParentOutcome,
} from "@/lib/import/id-card-parents";



type Props = {
  /** "create" — POST /api/people; "edit" — PATCH /api/people/[personId]; "view" — read-only display */
  mode: "create" | "edit" | "view";
  /** For edit/view mode: the person UUID to PATCH/DELETE. */
  personId?: string;
  /** For edit/view mode: the system-generated public code (PERS00001), shown read-only. */
  personCode?: string;
  /** Pre-filled form values; defaults to emptyFormValues for create. */
  initialValues?: FormValues;
  /**
   * Slice #39.70 — „Relația cu firma", by id. Held beside the form's values rather than in them: the person's
   * versions do not record it (as they do not record tags), so a version's `form.reset` must not touch it. It is
   * saved with the person, and it makes the form dirty like any field.
   */
  initialRelationshipIds?: string[];
  /** Slice 40.85: the identity documents the person holds, unordered (edit/view only) — „Acte de identitate". */
  identityDocuments?: readonly PersonIdentityDocument[];
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

/**
 * Slice 40.64: the fields of each form tile that can fold to one line, for `tileIsEmpty`. „Identitate" never folds —
 * it holds the record's name and its system ID; „Adrese" is its two panels, each folding on its own.
 */
type NpEmptyTile = "contact" | "home" | "correspondence";
const ADDRESS_PARTS = ["streetLine", "postalCode", "locality", "county", "country", "notes"] as const;
const NP_EMPTY_TILE_FIELDS: Record<NpEmptyTile, readonly string[]> = {
  contact: ["personalPhone1", "personalPhone2", "workPhone", "personalEmail1", "personalEmail2", "workEmail"],
  home: ADDRESS_PARTS.map((part) => `addresses.HOME.${part}`),
  correspondence: ADDRESS_PARTS.map((part) => `addresses.CORRESPONDENCE.${part}`),
};

/**
 * Slice 40.71: the fields of each form tile, in the order they are drawn, for „Arată N câmpuri goale"
 * (src/components/tiles/empty-fields.tsx). „Vârstă" follows „Data nașterii"; „Relația cu firma" and the ID card's link
 * are not fields and always show.
 */
type NpFieldTile = "identity" | "contact" | "home" | "correspondence";
const NP_FIELD_TILES: Record<NpFieldTile, readonly string[]> = {
  // 41.04: in the rows' new order — CNP, Cetățenie, then the birth row.
  identity: ["lastName", "firstName", "nickname", "cnp", "citizenshipId", "dateOfBirth", "gender", "isDeceased", "dateOfDeath", "placeOfBirth", "physicalPersonTypeId", "notes"],
  contact: NP_EMPTY_TILE_FIELDS.contact,
  home: NP_EMPTY_TILE_FIELDS.home,
  correspondence: NP_EMPTY_TILE_FIELDS.correspondence,
};
/** A field's label key where it is not `fields.<name>`. */
const NP_LABEL_KEY: Readonly<Record<string, string>> = { citizenshipId: "citizenship" };

/**
 * Slice 40.72: on a saved person the four form tiles read as text and edit one at a time
 * (src/components/tiles/read-edit-tile.tsx). What each tile's „Salvează" sends — its own fields and nothing else; the
 * route takes a partial update, and one save makes one version.
 */
type NpEditTile = "identity" | "contact" | "addresses";
const NP_EDIT_PAYLOAD: Record<NpEditTile, readonly (keyof ReturnType<typeof toApiPayload>)[]> = {
  identity: ["lastName", "firstName", "nickname", "cnp", "citizenshipId", "gender", "dateOfBirth", "isDeceased", "dateOfDeath", "placeOfBirth", "physicalPersonTypeId", "notes"],
  contact: ["personalPhone1", "personalPhone2", "workPhone", "personalEmail1", "personalEmail2", "workEmail"],
  addresses: ["addresses", "correspondenceSameAsHome"],
};
/**
 * Where each tile's first field is, for the focus „Editează" puts there: the tile's `data-panel`. Kept as the bare
 * name, not as a selector, so the only `data-panel="…"` in this file is the tile itself — tiles.test and
 * cnp-lock-hint.test cut the form into its tiles at those attributes.
 */
const NP_EDIT_PANEL: Record<NpEditTile, string> = {
  identity: "identity",
  contact: "contact",
  addresses: "addresses.HOME",
};
/** The tile 40.64's one-line panels and 40.71's links belong to. */
const NP_EDIT_OF: Readonly<Record<string, NpEditTile>> = {
  identity: "identity",
  contact: "contact",
  home: "addresses",
  correspondence: "addresses",
};

export function NaturalPersonForm({
  mode,
  personId,
  personCode,
  initialValues,
  initialRelationshipIds,
  identityDocuments,
  versionNavSlot,
  tiles,
}: Props) {
  const t = useTranslations("naturalPerson");
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
  // Slice #39.70:
  const { options: relationshipOptions, listState: relationshipListState } = usePersonRelationshipOptions();
  const { data: tf } = useTimeFrames();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialValues ?? emptyFormValues,
    mode: "onChange",
  });

  const [submitting, setSubmitting] = useState(false);
  /**
   * Slice #38.29 — on „Adaugă nou", with a „Carte de identitate", the holder's
   * father and mother: offered unticked, created or linked after the save, and
   * nothing about them stored on the holder's own record.
   */
  const [parentDrafts, setParentDrafts] = useState<ParentDraft[]>(() => blankDrafts(""));
  const [parentsStage, setParentsStage] = useState<{ holderId: string; parents: ParentDraft[] } | null>(null);
  /** A parent that did not make it, said before leaving the screen. */
  const [parentsReport, setParentsReport] = useState<ParentOutcome[] | null>(null);
  const createdIdRef = useRef<string | null>(null);
  const tParents = useTranslations("parentsFromIdCard") as unknown as (
    key: string,
    values?: Record<string, string>,
  ) => string;
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
  // Slice #38.29 — the parents' fold: a new person whose ID document is a „Carte de identitate".
  const offerParents = mode === "create";
  const shownParents = followHolderSurname(parentDrafts, watchedValues.lastName ?? "");

  // Derived display values (recalculate on every render since watchedValues is live).
  // Slice #37.60 / #39.30: the age the Natural Persons list's „Vârstă" shows — counted to today, or stopped at the
  // death and marked „†"; a dead person with no date has none (the tick beside it says „Decedat").
  const calculatedAge = personAgeText(
    { dateOfBirth: watchedValues.dateOfBirth, isDeceased: watchedValues.isDeceased, dateOfDeath: watchedValues.dateOfDeath },
    "—",
  );

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
  // Slice #39.70 — „Relația cu firma" and its saved state, sorted so the comparison is by set.
  const [relationshipIds, setRelationshipIds] = useState<string[]>(() => [...(initialRelationshipIds ?? [])].sort());
  const [relationshipBaseline, setRelationshipBaseline] = useState<string[]>(() => [...(initialRelationshipIds ?? [])].sort());
  const relationshipsDirty = relationshipIds.join(",") !== relationshipBaseline.join(",");

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
  // Slice #39.70: or „Relația cu firma" differs from what was saved.
  const editDirty =
    !isCreate && isOnLatest && (!formValuesEqual(watchedValues, baseline.values) || relationshipsDirty);

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
  const doSave = async (values: FormValues, tile?: NpEditTile): Promise<boolean> => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Slice #39.70: „Relația cu firma" travels with the person; the server keeps it outside the version.
      const full = { ...toApiPayload(values), relationshipIds };
      // Slice 40.72: a tile's „Salvează" sends that tile's fields only; „Relația cu firma" is on „Identitate".
      const payload = tile
        ? {
            ...Object.fromEntries(NP_EDIT_PAYLOAD[tile].map((key) => [key, full[key]])),
            ...(tile === "identity" ? { relationshipIds } : {}),
          }
        : full;
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
      // Slice #38.29 — the new holder's id, for its parents.
      if (mode === "create") {
        const created = (await saved.clone().json().catch(() => null)) as { person?: { id?: string } } | null;
        createdIdRef.current = created?.person?.id ?? null;
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
      // Slice #37.21: a save refused as stale writes nothing; the notice says so.
      if (recordSync.refused(err)) return false;
      // Slice #37.50: the lock's refusal is the trigger's English sentence; say it in Romanian.
      // Slice #39.30: „Data decesului" refused by the route's own rule (the form checks the same one first).
      const code = refusalCode(err);
      setSubmitError(
        refusalCode(err) === "CNP_LOCKED"
          ? t("hints.cnpLocked")
          : code === "DEATH_WITHOUT_DECEASED" || code === "DEATH_BEFORE_BIRTH" || code === "DEATH_IN_FUTURE"
            ? t(`hints.death.${code}`)
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
    // Slice #38.29 — a ticked parent without both names stops the save, and says why.
    const parentsShown = offerParents ? followHolderSurname(parentDrafts, values.lastName ?? "") : [];
    if (incompleteParents(parentsShown).length > 0) {
      setSubmitError(tParents("missingName"));
      return;
    }
    const ok = await doSave(values);
    if (!ok) return;

    if (mode === "create") {
      const ticked = parentsToCreate(parentsShown);
      if (ticked.length > 0 && createdIdRef.current) {
        setParentsStage({ holderId: createdIdRef.current, parents: ticked });
        return;
      }
      router.push("/natural-persons");
      router.refresh();
      return;
    }

    // Slice #18.05: edit mode stays on the person so the freshly-appended
    // version is visible. Reset the clean baseline to the just-saved state (so
    // Save disables and version nav unlocks), follow the new latest, and
    // refresh server-rendered bits (e.g. the page title if the name changed).
    setBaseline({ values });
    setRelationshipBaseline(relationshipIds);
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
          ? form.formState.isDirty || relationshipIds.length > 0
          : editDirty,
    onSave: async () => {
      // Slice 40.72: on a saved person the changed tile is the open one, and it saves itself.
      if (perTile && tileEditing.open) return saveTile(tileEditing.open);
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

  // Slice 40.64: a form tile with nothing in it is one line — its title, a short state and „Adaugă"
  // (src/components/tiles/empty-tile.tsx). Empty means empty as loaded — a version's `form.reset` included — AND empty
  // now: emptying a box while typing never folds the tile away under the cursor, and a value the screen fills in on
  // opening (Acte's „Descrierea obiectului") keeps its tile open. Drawn whole
  // while a version marks a field in it, or a field in it carries an error; never folded on a new record.
  const emptyTiles = useEmptyTiles({ active: !isCreate, canAdd: effectiveMode === "edit" });
  const marked = (path: string): boolean =>
    !!valueAt(errors, path) ||
    !!(path.startsWith("addresses.")
      ? valueAt(displayHighlights?.addresses, path.slice("addresses.".length))
      : (displayHighlights?.fields as Record<string, unknown> | undefined)?.[path]);
  const folded = (tile: NpEmptyTile, alsoFull = false): boolean =>
    emptyTiles.collapsed(
      tile,
      !alsoFull && tileIsEmpty(formState.defaultValues, NP_EMPTY_TILE_FIELDS[tile], emptyFormValues) && tileIsEmpty(watchedValues, NP_EMPTY_TILE_FIELDS[tile], emptyFormValues),
      // 40.72: a tile open for editing is drawn whole.
      NP_EMPTY_TILE_FIELDS[tile].some(marked) || editingTile === NP_EDIT_OF[tile],
    );
  // Slice 40.72 — the read view. On a saved person each form tile reads as text; „Editează" opens one at a time, its
  // „Salvează" saves that tile alone (one version), „Renunță" and Esc put it back. A new person is one form, as before;
  // a version being viewed reads as text with no „Editează".
  const perTile = tiled && !isCreate;
  const canEditTiles = perTile && effectiveMode === "edit";
  const baselineRef = useRef(baseline);
  const relationshipBaselineRef = useRef(relationshipBaseline);
  useEffect(() => {
    baselineRef.current = baseline;
    relationshipBaselineRef.current = relationshipBaseline;
  }, [baseline, relationshipBaseline]);
  const discardEdits = useCallback(() => {
    form.reset(baselineRef.current.values);
    setRelationshipIds(relationshipBaselineRef.current);
    setSubmitError(null);
  }, [form]);
  const tileEditing = useTileEditing<NpEditTile>({ dirty: editDirty, discard: discardEdits });
  const editingTile: NpEditTile | null = canEditTiles ? tileEditing.open : null;
  const reading = (tile: NpEditTile): boolean => perTile && editingTile !== tile;
  const readMode: ReadMode = {
    reading: (name) => perTile && npTileOfField(name) !== editingTile,
    value: (name) => valueAt(watchedValues, name),
  };
  const saveTile = async (tile: NpEditTile): Promise<boolean> => {
    // The whole record is checked: the other tiles are as saved, and every rule ties fields of one tile.
    const valid = await form.trigger();
    if (!valid) return false;
    const values = form.getValues();
    const ok = await doSave(values, tile);
    if (!ok) return false;
    baselineRef.current = { values };
    relationshipBaselineRef.current = relationshipIds;
    setBaseline({ values });
    setRelationshipBaseline(relationshipIds);
    setViewingVersion(null);
    // As loaded, now: 40.64's and 40.71's „empty as loaded" read the saved values.
    form.reset(values);
    // An associated record („?readonly=true", „Modifică") goes back to its read-only presentation once saved, as the
    // whole save did (#21.04.Import).
    if (mode === "view") setAssociatedEditing(false);
    tileEditing.close();
    router.refresh();
    return true;
  };
  const editTile = (tile: NpEditTile) => tileEditing.edit(tile, `[data-panel="${NP_EDIT_PANEL[tile]}"]`);
  const editButton = (tile: NpEditTile, title: string) =>
    canEditTiles && editingTile !== tile ? <TileEditButton tile={tile} title={title} onEdit={() => editTile(tile)} /> : null;
  const editBar = (tile: NpEditTile) =>
    editingTile === tile ? (
      <TileEditBar
        tile={tile}
        onSave={() => void saveTile(tile)}
        onCancel={tileEditing.cancel}
        saving={submitting}
        canSave={editDirty}
        error={submitError}
      />
    ) : null;
  const editingClass = (tile: NpEditTile): string => (editingTile === tile ? ` ${TILE_EDITING_CLASS}` : "");
  const editKeys = (tile: NpEditTile) => onTileKeyDown(editingTile === tile, tileEditing.escape);
  const tRead = useTranslations("shared.readEdit");
  const ageYears = Number.parseInt(calculatedAge ?? "", 10);
  const birthDateSuffix = Number.isNaN(ageYears) ? "" : ` (${tRead("age", { count: ageYears })}${calculatedAge?.includes("†") ? " †" : ""})`;

  // Slice 40.64's „Adaugă" opens its tile in edit on a saved person (40.72, Ask first 3).
  const addTo = (tile: NpEmptyTile, panel: string) =>
    emptyTiles.canAdd
      ? () => {
          emptyTiles.open(tile, `[data-panel="${panel}"]`);
          if (canEditTiles) tileEditing.edit(NP_EDIT_OF[tile], `[data-panel="${panel}"]`);
        }
      : undefined;
  // Slice 40.71: in a tile that holds some values, the empty fields hide behind „Arată N câmpuri goale" — not on a new
  // record, not in a tile a version marks or a field in error is in, and not once the link was pressed.
  const emptyFields = useEmptyFields({
    active: !isCreate,
    loaded: formState.defaultValues,
    now: watchedValues,
    defaults: emptyFormValues,
    always: ALWAYS_SHOWN_FIELDS.naturalPerson,
  });
  const tAddress = useTranslations("address");
  const npHidden = Object.fromEntries(
    (Object.keys(NP_FIELD_TILES) as NpFieldTile[]).map((tile) => [
      tile,
      // 40.72: an open tile shows every field.
      emptyFields.hide(tile, NP_FIELD_TILES[tile], NP_FIELD_TILES[tile].some(marked) || editingTile === NP_EDIT_OF[tile]),
    ]),
  ) as Record<NpFieldTile, string[]>;
  const hiddenFields: ReadonlySet<string> = new Set(Object.values(npHidden).flat());
  const fieldLabel = (path: string): string =>
    path.startsWith("addresses.") ? tAddress(path.split(".")[2]) : t(`fields.${NP_LABEL_KEY[path] ?? path}`);
  const emptyFieldsLink = (tile: NpFieldTile) => (
    <EmptyFieldsLink tile={tile} labels={npHidden[tile].map(fieldLabel)} onShow={() => emptyFields.show(tile)} />
  );
  const contactFolded = folded("contact");
  const homeFolded = folded("home");
  const correspondenceFolded = folded("correspondence");

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
    <HiddenFieldsContext.Provider value={hiddenFields}>
    <ReadModeContext.Provider value={readMode}>
    <form
      onSubmit={
        perTile
          ? (e) => {
              // Slice 40.72: Enter in an open tile is its „Salvează"; there is no record-level save.
              e.preventDefault();
              if (editingTile) void saveTile(editingTile);
            }
          : form.handleSubmit(onSubmit, onInvalid)
      }
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
      <section style={NP_PANEL_STYLE.identity} data-panel="identity" {...tileProps("identity")} onKeyDown={editKeys("identity")} className={`rounded-md border border-card-rim bg-card p-3 shadow-sm${hiddenClass("identity")}${editingClass("identity")}`}>
        {/* Slice #38.30: the tile's title and the line saying what it holds — in every mode, so „Adaugă nou" reads as the record does. */}
        <TileTitle title={t("tiles.identity")} subtitle={t("tileSubtitles.identity")} action={editButton("identity", t("tiles.identity"))}>
          {/* Slice #37.57: the system ID's one place — this corner. */}
          {mode !== "create" && personCode && <SystemIdCorner code={personCode} />}
        </TileTitle>
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
          {/* Slice 41.04 — Adrian: Poreclă „the only field on the second line"; CNP down to a new third line, Cetățenie
              beside it. */}
          <div className={STACKED_ROW_CLASS}>
            <Field
              label={t("fields.nickname")}
              name="nickname"
              register={register}
              error={errors.nickname?.message}
              highlight={displayHighlights?.fields.nickname}
              width={NP.nickname}
            />
          </div>
          <div className={STACKED_ROW_CLASS}>
            <Field
              label={t("fields.cnp")}
              name="cnp"
              register={register}
              error={errors.cnp?.message}
              bubble={cnpIsLocked ? t("hints.cnpLocked") : undefined}
              highlight={displayHighlights?.fields.cnp}
              width={NP.cnp}
            />
            {/* Slice 41.04: Cetățenie at CNP's right (Adrian's „the right side of CNP"); 40.85 had it after Locul nașterii. */}
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
              readSuffix={birthDateSuffix}
            />
            <ReadOnlyField
              label={t("fields.age")}
              value={calculatedAge ?? "—"}
              width={NP.age}
              field="age"
              hiddenWith="dateOfBirth"
              readHides={reading("identity")}
            />
            <SelectField
              label={t("fields.gender")}
              name="gender"
              register={register}
              control={control}
              error={errors.gender?.message}
              options={[
                { value: "", label: "—" },
                // Slice 40.79: „M" / „F" in a box of XS, the whole word on hover and to a screen reader.
                { value: "MALE", label: t("options.genderShort.MALE"), title: t("options.gender.MALE") },
                { value: "FEMALE", label: t("options.genderShort.FEMALE"), title: t("options.gender.FEMALE") },
              ]}
              highlight={displayHighlights?.fields.gender}
              width={NP.gender}
            />
          </div>
          {/* Slice #39.30 — „Decedat", off by default; „Data decesului" only while it is ticked, and optional. */}
          <div className={STACKED_ROW_CLASS}>
            <CheckField
              label={t("fields.isDeceased")}
              name="isDeceased"
              control={control}
              highlight={displayHighlights?.fields.isDeceased}
              width={NP.isDeceased}
              onTurnOff={() => form.setValue("dateOfDeath", "", { shouldDirty: true, shouldValidate: true })}
            />
            <Field
              label={t("fields.dateOfDeath")}
              name="dateOfDeath"
              type="date"
              register={register}
              error={errors.dateOfDeath?.message}
              highlight={displayHighlights?.fields.dateOfDeath}
              width={NP.dateOfDeath}
              disabled={!watchedValues.isDeceased}
            />
          </div>
          {/* Slice 41.04 — Locul nașterii alone, at TILE (Adrian: „Make place of birth to be tile size"). */}
          <div className={STACKED_ROW_CLASS}>
            <Field
              label={t("fields.placeOfBirth")}
              name="placeOfBirth"
              register={register}
              error={errors.placeOfBirth?.message}
              highlight={displayHighlights?.fields.placeOfBirth}
              width={NP.placeOfBirth}
              fillRem={NP_PANEL_INNER_REM.identity}
            />
          </div>
          <div className={STACKED_ROW_CLASS}>
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
          {/* Slice #39.70 — „Relația cu firma": several at once, saved with the person, never versioned. */}
          <RelationshipsField
            label={t("fields.relationships")}
            style={stackedBoxStyle(NP.relationships, NP_PANEL_INNER_REM.identity)}
            options={relationshipOptions}
            value={relationshipIds}
            onChange={setRelationshipIds}
            reading={reading("identity")}
            hint={
              relationshipListState === "failed"
                ? t("hints.relationshipListFailed")
                : !isOnLatest
                  ? t("hints.relationshipsNotVersioned")
                  : undefined
            }
          />
          <Field
            label={t("fields.notes")}
            name="notes"
            register={register}
            error={errors.notes?.message}
            highlight={displayHighlights?.fields.notes}
            width={NP.notes}
            fillRem={NP_PANEL_INNER_REM.identity}
          />
          {/* Slice #38.29 / 40.85: on „Adaugă persoană", the holder's father and mother, unticked. Offered beside
              „Tip document: Carte de identitate" until 40.85 took the card's fields off the person; now always, as
              a fold nothing is created from until a row is ticked. */}
          {offerParents && (
            <ParentsFold
              drafts={shownParents}
              onChange={setParentDrafts}
              hint={tParents("foldHintManual")}
              disabled={submitting}
            />
          )}
          {emptyFieldsLink("identity")}
          {editBar("identity")}
        </div>
      </section>

      {/* Slice 40.85: „Acte de identitate" — the identity documents the person holds, read-only, each opening its
          document; „Adaugă act de identitate" starts a new one with the person as holder. Not on „Adaugă persoană":
          there is no person yet to hold one. The tile keeps its key, `idCard`, so a saved choice of tiles holds. */}
      {!isCreate && (
        <section style={NP_PANEL_STYLE.idCard} data-panel="id-card" {...tileProps("idCard")} className={`rounded-md border border-card-rim bg-card p-3 shadow-sm${hiddenClass("idCard")}`}>
          <PersonIdentityDocuments
            personId={personId ?? ""}
            documents={identityDocuments ?? []}
            soonDays={tfDays(tf, "id_card_expiring_soon")}
            legacy={isOnLatest ? null : (currSnap?.natural ?? null)}
            title={t("tiles.idCard")}
            subtitle={t("tileSubtitles.idCard")}
            canAdd={effectiveMode === "edit" && isOnLatest}
          />
        </section>
      )}

      {/* Contact — phones and emails */}
      <section style={NP_PANEL_STYLE.contact} data-panel="contact" {...tileProps("contact")} onKeyDown={editKeys("contact")} className={`rounded-md border border-card-rim bg-card p-3 shadow-sm${hiddenClass("contact")}${editingClass("contact")}`}>
        {contactFolded && <EmptyTileLine tile="contact" title={t("tiles.contact")} onAdd={addTo("contact", "contact")} />}
        <div className={contactFolded ? "hidden" : "contents"}>
        <TileTitle title={t("tiles.contact")} subtitle={t("tileSubtitles.contact")} action={editButton("contact", t("tiles.contact"))} />
        {/* Slice #37.26 — the rows of `NP_ROWS.contact`. Slice 41.05: the tile is 2 units, so the two phones are one to
            a row and the e-mails take the panel's whole width. */}
        <div className="flex flex-col gap-2">
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
            fillRem={NP_PANEL_INNER_REM.contact}
          />
          <Field
            label={t("fields.personalEmail2")}
            name="personalEmail2"
            register={register}
            error={errors.personalEmail2?.message}
            highlight={displayHighlights?.fields.personalEmail2}
            width={NP.personalEmail2}
            fillRem={NP_PANEL_INNER_REM.contact}
          />
          <Field
            label={t("fields.workEmail")}
            name="workEmail"
            register={register}
            error={errors.workEmail?.message}
            highlight={displayHighlights?.fields.workEmail}
            width={NP.workEmail}
            fillRem={NP_PANEL_INNER_REM.contact}
          />
          {emptyFieldsLink("contact")}
          {editBar("contact")}
        </div>
        </div>
      </section>

      {/* Slice #37.17: „Adrese" is one tile — the home address and, when it
          differs, the correspondence address — so they show and hide together.
          Slice #37.27: the same-as-home checkbox is the last line of the home
          address panel, so it never takes a panel's room of its own. */}
      <div {...tileProps("addresses")} className={tileShown("addresses") ? "contents" : "hidden"}>
      <AddressBlock<FormValues>
        title={t("sections.homeAddress")}
        subtitle={t("tileSubtitles.addresses")}
        prefix="addresses.HOME"
        register={register}
        errors={errors.addresses?.HOME}
        highlights={displayHighlights?.addresses.HOME}
        collapsed={homeFolded ? { tile: "home", onAdd: addTo("home", "addresses.HOME") } : undefined}
        emptyFields={emptyFieldsLink("home")}
        titleAction={editButton("addresses", t("tiles.addresses"))}
        after={editBar("addresses")}
        sectionClassName={editingClass("addresses").trim()}
        onKeyDown={editKeys("addresses")}
        footer={reading("addresses") ? undefined : (
            <Controller
              control={form.control}
              name="correspondenceSameAsHome"
              render={({ field }) => (
                <label
                  className={[
                    "flex cursor-pointer items-center gap-2 rounded-md text-sm select-none",
                    watchedValues.correspondenceSameAsHome
                      ? "font-bold text-ink"
                      : "font-normal text-fade",
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
                      } else {
                        // Slice 40.64: unticked to give it its own address — the panel opens, the focus in it.
                        emptyTiles.open("correspondence", '[data-panel="addresses.CORRESPONDENCE"]');
                      }
                    }}
                    className="accent-cta"
                    aria-label={t("fields.correspondenceSameAsHome")}
                  />
                  {t("fields.correspondenceSameAsHome")}
                </label>
              )}
            />
        )}
      />

      {/* CORRESPONDENCE address — only when not same as home. Slice 40.64: on a saved record, the same as home reads
          as one line, „aceeași cu domiciliul", whose „Adaugă" unticks the box and opens the panel. */}
      {watchedValues.correspondenceSameAsHome && !isCreate && (
        <AddressLine
          prefix="addresses.CORRESPONDENCE"
          tile="correspondence"
          title={t("sections.correspondenceAddress")}
          state="sameAsHome"
          onAdd={
            emptyTiles.canAdd
              ? () => {
                  // 40.72: on a saved person „Adaugă" opens „Adrese" in edit first, then gives it its own address.
                  if (canEditTiles) tileEditing.edit("addresses", '[data-panel="addresses.CORRESPONDENCE"]');
                  form.setValue("correspondenceSameAsHome", false, { shouldDirty: true });
                  emptyTiles.open("correspondence", '[data-panel="addresses.CORRESPONDENCE"]');
                }
              : undefined
          }
        />
      )}
      {!watchedValues.correspondenceSameAsHome && (
        <AddressBlock<FormValues>
          title={t("sections.correspondenceAddress")}
          prefix="addresses.CORRESPONDENCE"
          register={register}
          errors={errors.addresses?.CORRESPONDENCE}
          highlights={displayHighlights?.addresses.CORRESPONDENCE}
          collapsed={correspondenceFolded ? { tile: "correspondence", onAdd: addTo("correspondence", "addresses.CORRESPONDENCE") } : undefined}
          emptyFields={emptyFieldsLink("correspondence")}
          sectionClassName={editingClass("addresses").trim()}
          onKeyDown={editKeys("addresses")}
        />
      )}
      </div>{/* end „Adrese" tile */}

      </div>{/* end panel row */}

      </fieldset>{/* end disabled fieldset */}

      {/* Slice #37.17: in tile mode the error and the action bar are the tile
          row's last line (`order-last`), after the list tiles. */}
      <div className={tiled ? "order-last flex basis-full flex-col gap-4" : "contents"}>

      {/* Slice 40.72: an open tile says its own refusal, under its „Salvează". */}
      {submitError && !editingTile && (
        <p className="text-sm text-alert" role="alert">
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
          <div className="flex items-center justify-between border-t border-crease pt-6">
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
        <div className="flex items-center justify-between border-t border-crease pt-6">
          <IconButton
            icon={ArrowLeft}
            label={tShared("backToList")}
            variant="secondary"
            size="lg"
            onClick={() => router.back()}
          />
          <div className="flex items-center gap-3">
            {/* Slice 40.72: on a saved person each tile saves itself. */}
            {!perTile && (
              <IconButton
                icon={Save}
                label={t("buttons.save")}
                variant="primary"
                size="lg"
                type="submit"
                disabled={saveDisabled}
              />
            )}
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
        <div className="flex items-center justify-center gap-3 border-t border-crease pt-6">
          {/* Slice 40.72: on a saved person each tile saves itself — Delete and the way back stay. */}
          {!perTile && (
            <IconButton
              icon={Save}
              label={t("buttons.save")}
              variant="primary"
              size="lg"
              type="submit"
              disabled={saveDisabled}
            />
          )}
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
    {/* Slice #38.29 — the holder is saved; its ticked parents, one after the other.
        Outside the <form>, so no button in it can submit the form again. */}
    {parentsStage && (
      <ParentsResolution
        holderId={parentsStage.holderId}
        parents={parentsStage.parents}
        onDone={(outcomes) => {
          setParentsStage(null);
          if (outcomes.some((o) => o.result === "failed")) {
            setParentsReport(outcomes);
            return;
          }
          router.push("/natural-persons");
          router.refresh();
        }}
      />
    )}
    {parentsReport && (
      <ConfirmDialog
        title={tParents("foldTitle")}
        body={tParents("manualDone", { list: parentOutcomeSentences(parentsReport, tParents).join("; ") })}
        yesLabel={tParents("ok")}
        onYes={() => {
          setParentsReport(null);
          router.push("/natural-persons");
          router.refresh();
        }}
        busy={false}
      />
    )}
    </ReadModeContext.Provider>
    </HiddenFieldsContext.Provider>
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
  /** Slice #39.30: a box that cannot be filled yet („Data decesului" until „Decedat" is ticked). */
  disabled?: boolean;
};

/**
 * Slice #37.26 — THE LABEL SITS ABOVE ITS BOX, left-aligned, and the pair is
 * exactly as wide as the box: a long label wraps inside that width rather than
 * widening the row (`shrink-0` so a row can never squeeze a box either).
 */
// Slice #37.29 (rule 16): the stacked classes are shared (`@/lib/ui/stacked`), so a row's
// boxes start on one line whatever its labels wrap to — the Judicial Person draws the same.


function Field({ label, name, type = "text", register, error, bubble, highlight, expired, expiringSoon, width, mono, fillRem, disabled, readSuffix }: FieldProps & {
  /** Slice 40.72: after the value in the read view — the age beside the birth date. */
  readSuffix?: string;
}) {
  const hiddenEmpty = useFieldHidden(name); // Slice 40.71: behind its tile's „Arată N câmpuri goale"
  const read = useFieldRead(name);
  const ring = usePulseRing(highlight);
  const className = [
    FIELD_BOX,
    fieldBorder(Boolean(error || expired), Boolean(expiringSoon)),
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
  // Slice 40.72: the read view — the value as text, at the box's width.
  if (read.reading) {
    const text = readText(read.value, type === "date" ? "date" : "text");
    return (
      <div className={STACKED_FIELD_CLASS} style={hiddenFieldStyle(hiddenEmpty, box)} data-empty-hidden={hiddenEmpty || undefined}>
        <span className={STACKED_LABEL_CLASS}>{label}</span>
        <ReadValue
          name={name}
          kind={width.kind}
          text={text === "" ? "" : `${text}${readSuffix ?? ""}`}
          style={box}
          className={[ring, mono ? "font-mono" : "", expired ? "text-alert" : expiringSoon ? "text-warning" : ""].join(" ")}
        />
      </div>
    );
  }
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
      placeholder={EMPTY_MARK}
      data-width-field={name}
      data-width-kind={width.kind}
    />
  ) : (
    <input
      type={type}
      {...register(name)}
      disabled={disabled || undefined}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      aria-labelledby={labelledBy}
      className={className}
      placeholder={EMPTY_MARK}
      style={box}
      data-width-field={name}
      data-width-kind={width.kind}
    />
  );
  return (
    <label className={STACKED_FIELD_CLASS} style={hiddenFieldStyle(hiddenEmpty, box)} data-empty-hidden={hiddenEmpty || undefined}>
      <span id={labelId} className={STACKED_LABEL_CLASS}>{label}</span>
      {bubble ? (
        <HintBubble id={bubbleId} text={bubble}>
          {control}
        </HintBubble>
      ) : (
        control
      )}
      {error && (
        <span className="text-xs text-alert">{error}</span>
      )}
    </label>
  );
}

/**
 * „Relația cu firma" — a box per value, ticked for each one the person holds.                     (Slice #39.70)
 *
 * Inside the form's fieldset, so it is read-only wherever the form is. On a past version it shows the person's
 * relationships as they are now — the versions do not record them — and its hint says so.
 */
function RelationshipsField({
  label,
  options,
  value,
  onChange,
  hint,
  reading = false,
  style,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: readonly string[];
  onChange: (next: string[]) => void;
  hint?: string;
  /** Slice 40.79: TILE — the panel's whole inner width (`NP.relationships`). */
  style: CSSProperties;
  /** Slice 40.72: the read view — the ticked ones as a short list („Client, Cumpărător"). */
  reading?: boolean;
}) {
  const labelId = useId();
  if (reading) {
    return (
      <div className="flex flex-col gap-y-0.5 text-sm" style={style} data-np-relationships="">
        <span className={FIELD_LABEL}>{label}</span>
        <ReadValue
          name="relationships"
          kind="grows"
          text={options.filter((o) => value.includes(o.value)).map((o) => o.label).join(", ")}
        />
      </div>
    );
  }
  const toggle = (id: string, on: boolean) =>
    onChange((on ? [...value, id] : value.filter((v) => v !== id)).sort());
  return (
    <div className="flex flex-col gap-y-0.5 text-sm" style={style} role="group" aria-labelledby={labelId} data-np-relationships="" data-width-field="relationships" data-width-kind={NP.relationships.kind}>
      {/* The stacked label's look without its `self-end`, which in a column would push it to the right. */}
      <span id={labelId} className={FIELD_LABEL}>
        {label}
      </span>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {options.map((o) => (
          <label key={o.value} className="inline-flex items-center gap-1.5 text-sm text-ink">
            <input
              type="checkbox"
              checked={value.includes(o.value)}
              onChange={(e) => toggle(o.value, e.target.checked)}
            />
            {o.label}
          </label>
        ))}
      </div>
      {hint && <span className="text-xs text-fade">{hint}</span>}
    </div>
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
  /** `title`: the whole word behind a short label („Masculin" behind „M", 40.79). */
  options: { value: string; label: string; title?: string }[];
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
  const hiddenEmpty = useFieldHidden(name); // Slice 40.71: behind its tile's „Arată N câmpuri goale"
  const read = useFieldRead(name);
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
  // Slice 40.78: the box is as wide as its step, and a chosen option longer than that wraps onto a second line
  // (`WrappingSelect`, inside `AsyncSelect`); the read view writes the same words.
  const current = useWatch({ control, name });
  const chosenOption = options.find((o) => o.value === (current ?? ""));
  const chosenLabel = chosenOption?.label;
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
      <div className={STACKED_FIELD_CLASS} style={hiddenFieldStyle(hiddenEmpty, box)} data-empty-hidden={hiddenEmpty || undefined} role="group" aria-labelledby={labelId}>
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

  // Slice 40.72: the read view — the chosen option's words.
  if (read.reading) {
    return (
      <div className={STACKED_FIELD_CLASS} style={hiddenFieldStyle(hiddenEmpty, box)} data-empty-hidden={hiddenEmpty || undefined}>
        <span className={STACKED_LABEL_CLASS}>{label}</span>
        <ReadValue name={name} kind={width.kind} text={current ? (chosenLabel ?? "") : ""} full={chosenOption?.title} style={box} className={ring} />
      </div>
    );
  }

  return (
    <label className={STACKED_FIELD_CLASS} style={hiddenFieldStyle(hiddenEmpty, box)} data-empty-hidden={hiddenEmpty || undefined}>
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
            FIELD_BOX,
            fieldBorder(Boolean(error)),
            ring,
          ].join(" ")}
          style={box}
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
          <span role="alert" className="text-xs text-alert">{hint}</span>
        )}
        {error && (
          <span className="text-xs text-alert">{error}</span>
        )}
      </div>
    </label>
  );
}

/**
 * Slice #39.30 — a tick with its label above it, like the boxes beside it: „Decedat". Turning it off calls
 * `onTurnOff`, which clears „Data decesului" (the pattern's rule: unticking clears the date).
 */
function CheckField({
  label,
  name,
  control,
  highlight,
  width,
  onTurnOff,
}: {
  label: string;
  name: "isDeceased";
  control: Control<FormValues>;
  highlight?: HighlightColor;
  width: FieldWidth;
  onTurnOff: () => void;
}) {
  const hiddenEmpty = useFieldHidden(name); // Slice 40.71: behind its tile's „Arată N câmpuri goale"
  const read = useFieldRead(name);
  const tRead = useTranslations("shared.readEdit");
  const ring = usePulseRing(highlight);
  const box = boxStyle(width);
  // Slice 40.72: the read view — „Da" when ticked.
  if (read.reading) {
    return (
      <div className={STACKED_FIELD_CLASS} style={hiddenFieldStyle(hiddenEmpty, box)} data-empty-hidden={hiddenEmpty || undefined}>
        <span className={STACKED_LABEL_CLASS}>{label}</span>
        <ReadValue name={name} kind={width.kind} text={read.value === true ? tRead("yes") : ""} style={box} className={ring} />
      </div>
    );
  }
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <label className={STACKED_FIELD_CLASS} style={hiddenFieldStyle(hiddenEmpty, box)} data-empty-hidden={hiddenEmpty || undefined}>
          <span className={STACKED_LABEL_CLASS}>{label}</span>
          <span className={`flex h-[1.875rem] items-center rounded-md ${ring}`} style={box} data-width-field={name} data-width-kind={width.kind}>
            <input
              type="checkbox"
              name={name}
              checked={field.value}
              onChange={(e) => {
                field.onChange(e.target.checked);
                if (!e.target.checked) onTurnOff();
              }}
              onBlur={field.onBlur}
              className="h-4 w-4 accent-cta"
            />
          </span>
        </label>
      )}
    />
  );
}

function ReadOnlyField({ label, value, width, field, hiddenWith, readHides = false }: { label: string; value: string; width: FieldWidth; field: string; hiddenWith?: string; readHides?: boolean }) {
  // Slice 40.71: „Vârstă" hides with „Data nașterii", the date it is worked out from; 40.72's read view writes it
  // beside the date, so there it hides too.
  const hiddenEmpty = useFieldHidden(hiddenWith ?? "") || readHides;
  return (
    <div className={STACKED_FIELD_CLASS} style={hiddenFieldStyle(hiddenEmpty, boxStyle(width))} data-empty-hidden={hiddenEmpty || undefined}>
      <span className={STACKED_LABEL_CLASS}>{label}</span>
      <div
        className={FIELD_READONLY}
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/40 p-4"
    >
      <div className="w-full max-w-sm rounded-lg bg-card p-6 shadow-xl">
        <h3
          id="confirm-title"
          className="text-base font-semibold text-ink"
        >
          {title}
        </h3>
        <p className="mt-2 text-sm text-fade">{body}</p>
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
