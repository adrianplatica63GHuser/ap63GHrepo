"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eraser, Save, Stamp } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { useTranslations } from "next-intl";
import { unnamedKindOf } from "@/lib/ui/unnamed";
import { useId, useMemo, useState } from "react";
import {
  GROUP_TARGET_TYPES,
  type StampTargetType,
} from "@/lib/stamps/validation";
import { HelpHint } from "@/components/help/help-hint";
import { NOTE_FOLD_LINES, screenBox, screenPanel, tileInner, unitsInnerRem } from "@/lib/ui/field-widths";
import { TwoLists, type TwoListRow } from "@/components/screen/two-lists";
import { WorkflowsTile } from "@/components/screen/workflows-tile";
import { GrowingText } from "@/components/forms/growing-text";
import { TileUnitRow } from "@/components/screen/tile-unit-row";
import { TileTitle } from "@/components/screen/tile-title";
import { IDENTITY_UNITS, STAMP_REGISTRY, STAMP_SCREEN, TWO_LISTS_UNITS } from "@/lib/ui/screen-tiles";
import { AdminTilesBar, tilesParam, useAdminTiles } from "@/components/screen/admin-tiles";


// ── Types ────────────────────────────────────────────────────────────────────

type StampMemberItem = {
  memberId:     string;
  displayLabel: string | null;
};
type StampCandidate = {
  id:           string;
  displayLabel: string | null;
};
type StampDetail = {
  id:               string;
  code:             string;
  shortDescription: string;
  notes:            string | null;
  targetType:       StampTargetType;
  members:          StampMemberItem[];
  candidates:       StampCandidate[];
};

// Staged changes — keyed by target type.
type PerTypeChanges = {
  toAdd:    Set<string>;
  toRemove: Set<string>;
};

function emptyChanges(): PerTypeChanges {
  return { toAdd: new Set(), toRemove: new Set() };
}

const NOTES_MAX = 2000;

// ── API helpers ──────────────────────────────────────────────────────────────

async function fetchDetail(
  id: string,
  targetType: StampTargetType,
): Promise<StampDetail> {
  const res = await fetch(`/api/stamps/${id}?targetType=${targetType}`);
  if (!res.ok) throw new Error(`Failed to load (${res.status})`);
  return res.json();
}

async function saveStamp(
  id: string,
  body: {
    shortDescription?: string;
    notes?: string | null;
    memberChanges?: {
      targetType: StampTargetType;
      toAdd:      string[];
      toRemove:   string[];
    }[];
  },
): Promise<void> {
  const res = await fetch(`/api/stamps/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.redirected) throw new Error("__SESSION__");
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Error ${res.status}`);
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function StampApplicator({
  stampId,
  initialDetail,
  onlyTiles,
}: {
  stampId:       string;
  initialDetail: StampDetail;
  /** 41.45: the page's `?tiles=` — opened from a record, only these tiles for this visit. */
  onlyTiles?:    string;
}) {
  const t  = useTranslations("stamp");
  const tiles = useAdminTiles(STAMP_REGISTRY, tilesParam(onlyTiles, STAMP_REGISTRY.all));
  const tUnnamed = useTranslations("shared.unnamed");
  const qc = useQueryClient();
  // Slice #38.13: the two tiles that are not lists are regions named by their titles.
  const descriptionTitleId = useId();
  const recordsTitleId = useId();
  const notesId = useId();

  // Which target type is currently being viewed / edited.
  const [selectedType, setSelectedType] = useState<StampTargetType>(
    initialDetail.targetType,
  );

  // Staged changes — keyed by target type. Committed together on "Save stamps".
  const [changes, setChanges] = useState<Map<StampTargetType, PerTypeChanges>>(
    () => new Map(),
  );

  // Editable notes.
  const [baseNotes, setBaseNotes] = useState(initialDetail.notes ?? "");
  const [notes, setNotes] = useState(initialDetail.notes ?? "");

  // Selection state for both panels.

  // Per-panel search.
  const [searchAvailable, setSearchAvailable] = useState("");
  const [searchStamped, setSearchStamped]     = useState("");

  const [error, setError] = useState<string | null>(null);

  // ── Remote data for the currently-selected type ───────────────────────────

  const queryKey = ["stamp", stampId, selectedType];
  const { data: detail, isLoading, isError } = useQuery<StampDetail>({
    queryKey,
    queryFn: () => fetchDetail(stampId, selectedType),
    initialData: initialDetail.targetType === selectedType ? initialDetail : undefined,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  // Get or create the staged changes map entry for the current type.
  function getChanges(type: StampTargetType): PerTypeChanges {
    return changes.get(type) ?? emptyChanges();
  }

  // ── Derived panels ────────────────────────────────────────────────────────

  const staged = getChanges(selectedType);

  // memberId → displayLabel (from server data for this type).
  // Slice #37.57: a member with no name is named in words, never by its system ID.
  const labelById = useMemo(() => {
    const unnamed = tUnnamed(unnamedKindOf(selectedType));
    const map = new Map<string, string>();
    for (const m of detail?.members   ?? []) map.set(m.memberId, m.displayLabel ?? unnamed);
    for (const c of detail?.candidates ?? []) map.set(c.id,       c.displayLabel ?? unnamed);
    return map;
  }, [detail, selectedType, tUnnamed]);

  const label = (id: string) => labelById.get(id) ?? id;

  // Server members for this type.
  const serverMemberIds = useMemo(
    () => new Set((detail?.members ?? []).map((m) => m.memberId)),
    [detail],
  );

  // Effective stamped set = server members + staged adds − staged removes.
  const stampedIds = useMemo(() => {
    const s = new Set(serverMemberIds);
    for (const id of staged.toAdd)    s.add(id);
    for (const id of staged.toRemove) s.delete(id);
    return s;
  }, [serverMemberIds, staged]);

  // Pool of available items = server candidates + server members
  // (so a staged-removed item reappears on the left).
  const poolIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of detail?.candidates ?? []) ids.add(c.id);
    for (const m of detail?.members    ?? []) ids.add(m.memberId);
    return ids;
  }, [detail]);

  // Left panel = pool − stamped, filtered by search.
  const availableRows = useMemo(() => {
    const q = searchAvailable.trim().toLowerCase();
    return [...poolIds]
      .filter((id) => !stampedIds.has(id))
      .filter((id) => !q || label(id).toLowerCase().includes(q))
      .sort((a, b) => label(a).localeCompare(label(b)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolIds, stampedIds, searchAvailable, labelById]);

  // Right panel = stamped set, filtered by search.
  const stampedRows = useMemo(() => {
    const q = searchStamped.trim().toLowerCase();
    return [...stampedIds]
      .filter((id) => !q || label(id).toLowerCase().includes(q))
      .sort((a, b) => label(a).localeCompare(label(b)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stampedIds, searchStamped, labelById]);

  // ── Dirty check ────────────────────────────────────────────────────────────

  const anyChanges = useMemo(() => {
    for (const c of changes.values()) {
      if (c.toAdd.size > 0 || c.toRemove.size > 0) return true;
    }
    return false;
  }, [changes]);

  const notesDirty = notes.trim() !== baseNotes;
  const dirty = anyChanges || notesDirty;

  // ── Move actions ──────────────────────────────────────────────────────────

  function updateChanges(
    type: StampTargetType,
    fn: (c: PerTypeChanges) => PerTypeChanges,
  ) {
    setChanges((prev) => {
      const next = new Map(prev);
      next.set(type, fn(next.get(type) ?? emptyChanges()));
      return next;
    });
  }

  // 41.43: the two lists' moves — staged per type, as the buttons' were, until „Salvează ștampilele".
  function apply(ids: string[]) {
    updateChanges(selectedType, (c) => {
      const toAdd    = new Set(c.toAdd);
      const toRemove = new Set(c.toRemove);
      for (const id of ids) {
        if (serverMemberIds.has(id)) toRemove.delete(id);
        else toAdd.add(id);
      }
      return { toAdd, toRemove };
    });
  }

  function remove(ids: string[]) {
    updateChanges(selectedType, (c) => {
      const toAdd    = new Set(c.toAdd);
      const toRemove = new Set(c.toRemove);
      for (const id of ids) {
        if (serverMemberIds.has(id)) toRemove.add(id);
        else toAdd.delete(id);
      }
      return { toAdd, toRemove };
    });
  }

  function switchType(type: StampTargetType) {
    setSelectedType(type);
    setSearchAvailable("");
    setSearchStamped("");
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  const mutation = useMutation({
    mutationFn: async () => {
      const memberChanges: {
        targetType: StampTargetType;
        toAdd:      string[];
        toRemove:   string[];
      }[] = [];

      for (const [type, c] of changes.entries()) {
        if (c.toAdd.size > 0 || c.toRemove.size > 0) {
          memberChanges.push({
            targetType: type,
            toAdd:      [...c.toAdd],
            toRemove:   [...c.toRemove],
          });
        }
      }

      await saveStamp(stampId, {
        ...(notesDirty ? { notes: notes.trim() || null } : {}),
        ...(memberChanges.length > 0 ? { memberChanges } : {}),
      });
    },
    onSuccess: () => {
      setBaseNotes(notes.trim());
      setChanges(new Map());
      setError(null);
      // Refetch the current type view.
      qc.invalidateQueries({ queryKey: ["stamp", stampId] });
    },
    onError: (err: Error) => {
      setError(err.message === "__SESSION__" ? t("saveErrorSession") : err.message);
    },
  });

  // ── Render ────────────────────────────────────────────────────────────────

  const stagedForType = changes.get(selectedType);
  const hasStagedForType =
    (stagedForType?.toAdd.size ?? 0) > 0 ||
    (stagedForType?.toRemove.size ?? 0) > 0;

  return (
    // Slice #38.13: the four tiles on the record forms' packing and drag
    // (`TileUnitRow`, #38.12), under the stamp screen's own key. In reading
    // order — „Descrierea ștampilei", „Tip element" where they stood, then
    // „Elemente deja ștampilate" under the first and „Elemente disponibile
    // pentru ștampilare" under the second (`STAMP_SCREEN.flowUnits`).
    <>
    {/* Slice 41.41: the screen's tiles chosen with „Panouri" (in the page bar); „Implicit" there puts the places back. */}
    <AdminTilesBar
      registry={STAMP_REGISTRY}
      labels={{ description: t("applicator.descriptionTile"), records: t("applicator.records"), workflows: t("workflows.title") }}
      tiles={tiles}
      allUp
    />
    <TileUnitRow screen={STAMP_SCREEN}>
      {/* „Descrierea ștampilei" — 41.43: compact, 2 units: the code and the short description, the notes, „Salvează ștampilele". */}
      <section
        hidden={!tiles.choice.isShown("description")}
        aria-labelledby={descriptionTitleId}
        {...screenPanel("stamp", IDENTITY_UNITS)}
        data-tile="description"
        className="flex flex-col rounded-md border border-card-rim bg-card shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <TileTitle id={descriptionTitleId} title={t("applicator.descriptionTile")} admin />
        <div className="flex flex-col gap-1 p-3">
          <p className="text-sm text-ink dark:text-zinc-200" data-stamp-identity-line="">
            <span className="font-mono font-semibold" title={t("fields.code")}>{detail?.code ?? initialDetail.code}</span>
            {" · "}
            {detail?.shortDescription ?? initialDetail.shortDescription}
          </p>
          <label htmlFor={notesId} className="mt-1 text-xs font-medium text-fade dark:text-zinc-400">
            {t("fields.notes")}
          </label>
          {/* Slice #37.40: a GrowingText folding at five lines; 41.43: as wide as the compact tile. */}
          <GrowingText
            id={notesId}
            value={notes}
            onValueChange={setNotes}
            width={tileInner(unitsInnerRem(IDENTITY_UNITS))}
            lines
            minRows={1}
            fold={NOTE_FOLD_LINES}
            maxLength={NOTES_MAX}
            data-width-field="groupDescription"
            className="rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
          />
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}

          {/* „Salvează ștampilele" at the tile's foot */}
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-crease pt-3 dark:border-zinc-800" data-stamp-save="">
            <IconButton
              icon={Save}
              label={t("applicator.saveStamps")}
              busy={mutation.isPending}
              busyLabel={t("saving")}
              variant="primary"
              size="md"
              onClick={() => mutation.mutate()}
              disabled={!dirty || mutation.isPending}
            />
            <HelpHint hintKey="stamp-staged-changes" />
            {dirty && (
              <span className="text-xs text-fade dark:text-zinc-500">
                {t("unsavedChanges")}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* „Elementele ștampilei" — 41.43: „Tip element" over the two lists, the stamped on the left, the available on the right. */}
      <section
        hidden={!tiles.choice.isShown("records")}
        aria-labelledby={recordsTitleId}
        {...screenPanel("records", TWO_LISTS_UNITS)}
        data-tile="records"
        className="flex flex-col rounded-md border border-card-rim bg-card shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <TileTitle id={recordsTitleId} title={t("applicator.records")} admin />
        <div className="p-3">
          <TwoLists
            head={
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <label htmlFor="stamp-target-type" className="text-sm font-medium text-ink dark:text-zinc-200">
                    {t("applicator.targetTypeLabel")}
                  </label>
                  <select
                    {...screenBox("groupTarget")}
                    id="stamp-target-type"
                    value={selectedType}
                    onChange={(e) => switchType(e.target.value as StampTargetType)}
                    className="rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    {GROUP_TARGET_TYPES.map((tt) => (
                      <option key={tt} value={tt}>
                        {t(`targets.${tt}`)}
                      </option>
                    ))}
                  </select>
                  <HelpHint hintKey="stamp-type-switch-keeps-changes" />
                  {hasStagedForType && (
                    <span className="text-xs italic text-amber-600 dark:text-amber-400">
                      {t("applicator.unsavedChangesForType")}
                    </span>
                  )}
                </div>
                <p className="text-xs italic text-fade dark:text-zinc-500">{t("applicator.typeNote")}</p>
                {isLoading && <p className="text-sm text-fade dark:text-zinc-400">{t("applicator.loading")}</p>}
                {isError && <p className="text-sm text-red-600 dark:text-red-400">{t("applicator.loadError")}</p>}
              </div>
            }
            left={{
              name: "stamped",
              title: t("applicator.stamped"),
              rows: isLoading || isError ? [] : stampedRows.map((id): TwoListRow => ({ id, label: label(id), pending: staged.toAdd.has(id) })),
              empty: t("applicator.stampedEmpty"),
              toolbar: (
                <input
                  type="search"
                  value={searchStamped}
                  onChange={(e) => setSearchStamped(e.target.value)}
                  placeholder={t("applicator.searchPlaceholder")}
                  aria-label={t("applicator.searchStamped")}
                  {...screenBox("memberSearch", { width: "100%" })}
                  className="rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm placeholder:text-fade focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
                />
              ),
            }}
            right={{
              name: "available",
              title: t("applicator.available"),
              rows: isLoading || isError ? [] : availableRows.map((id): TwoListRow => ({ id, label: label(id), pending: staged.toRemove.has(id) })),
              empty: t("applicator.availableEmpty"),
              toolbar: (
                <input
                  type="search"
                  value={searchAvailable}
                  onChange={(e) => setSearchAvailable(e.target.value)}
                  placeholder={t("applicator.searchPlaceholder")}
                  aria-label={t("applicator.searchAvailable")}
                  {...screenBox("memberSearch", { width: "100%" })}
                  className="rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm placeholder:text-fade focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
                />
              ),
            }}
            includeLabel={(count) => t("applicator.applyStamp", { count })}
            takeOutLabel={(count) => t("applicator.removeStamp", { count })}
            includeIcon={Stamp}
            takeOutIcon={Eraser}
            onInclude={apply}
            onTakeOut={remove}
          />
        </div>
      </section>

      {/* 41.44: „Cum lucrezi cu ștampilele" */}
      <WorkflowsTile kind="stamp" hidden={!tiles.choice.isShown("workflows")} />
    </TileUnitRow>
    </>
  );
}
