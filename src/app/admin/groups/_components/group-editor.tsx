"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ListMinus, ListPlus, Save } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { useTranslations } from "next-intl";
import { unnamedKindOf } from "@/lib/ui/unnamed";
import { useId, useMemo, useState } from "react";
import type { GroupTargetType } from "@/lib/groups/validation";
import { HelpHint } from "@/components/help/help-hint";
import { screenBox, screenPanel, tileInner, unitsInnerRem } from "@/lib/ui/field-widths";
import { GrowingText } from "@/components/forms/growing-text";
import { TwoLists, type TwoListRow } from "@/components/screen/two-lists";
import { WorkflowsTile } from "@/components/screen/workflows-tile";
import { TileUnitRow } from "@/components/screen/tile-unit-row";
import { TileTitle } from "@/components/screen/tile-title";
import { GROUP_REGISTRY, GROUP_SCREEN, IDENTITY_UNITS, TWO_LISTS_UNITS } from "@/lib/ui/screen-tiles";
import { AdminTilesBar, tilesParam, useAdminTiles } from "@/components/screen/admin-tiles";

/** Slice #37.35: every tile of the editor is 3 units (#37.22's panel on the unit). */

// ── Types (mirror GroupDetail from src/lib/groups/queries.ts) ────────────────
// Normalised shapes: memberId is the FK id for the group's target type.

type MemberItem = {
  memberId:     string;
  position:     number;
  displayLabel: string | null;
};
type Candidate = {
  id:              string;
  displayLabel:    string | null;
  otherGroupCount: number;
};
type GroupDetail = {
  id:          string;
  code:        string;
  targetType:  GroupTargetType;
  description: string;
  members:     MemberItem[];
  candidates:  Candidate[];
};

const DESCRIPTION_MAX = 500;

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

// ── API helpers ──────────────────────────────────────────────────────────────

async function fetchDetail(id: string): Promise<GroupDetail> {
  const res = await fetch(`/api/groups/${id}`);
  if (!res.ok) throw new Error(`Failed to load (${res.status})`);
  return res.json();
}

async function saveGroup(
  id: string,
  body: { description?: string; memberIds?: string[] },
): Promise<GroupDetail> {
  const res = await fetch(`/api/groups/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  // An expired session redirects mutations to /sign-in; fetch follows it as a
  // 200 (the sign-in HTML) which would look like a fake success. Treat any
  // redirect as an auth failure. (Same guard as the property/person forms.)
  if (res.redirected) throw new Error("__SESSION__");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Error ${res.status}`);
  }
  return res.json();
}

// ── Component ────────────────────────────────────────────────────────────────

export function GroupEditor({
  groupId,
  initialDetail,
  onlyTiles,
}: {
  groupId: string;
  initialDetail: GroupDetail;
  /** 41.45: the page's `?tiles=` — opened from a record, only these tiles for this visit. */
  onlyTiles?: string;
}) {
  const t = useTranslations("group");
  const tiles = useAdminTiles(GROUP_REGISTRY, tilesParam(onlyTiles, GROUP_REGISTRY.all));
  const tUnnamed = useTranslations("shared.unnamed");
  const qc = useQueryClient();
  // FU-219 (Slice #37.07): the description's caption is its label.
  const descriptionId = useId();
  const identityTitleId = useId();
  const membersTitleId = useId();

  const { data: detail } = useQuery<GroupDetail>({
    queryKey: ["group", groupId],
    queryFn: () => fetchDetail(groupId),
    initialData: initialDetail,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  // Baselines — the last saved state. Reset after a successful save.
  const [baseDescription, setBaseDescription] = useState(detail.description);
  const [baseMemberIds, setBaseMemberIds] = useState<string[]>(
    () => detail.members.map((m) => m.memberId),
  );

  // Working copy.
  const [description, setDescription] = useState(detail.description);
  const [memberIds, setMemberIds] = useState<Set<string>>(
    () => new Set(detail.members.map((m) => m.memberId)),
  );

  // 41.67: a search over each list — the in-group members' and the available ones' — as the stamp's screen has.
  const [searchMembers, setSearchMembers] = useState("");
  const [searchAvailable, setSearchAvailable] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Lookups: memberId → displayLabel (from both members and candidates).
  // Slice #37.57: a member with no name is named in words, never by its system ID.
  const labelById = useMemo(() => {
    const unnamed = tUnnamed(unnamedKindOf(detail.targetType));
    const map = new Map<string, string>();
    for (const m of detail.members)   map.set(m.memberId, m.displayLabel ?? unnamed);
    for (const c of detail.candidates) map.set(c.id,       c.displayLabel ?? unnamed);
    return map;
  }, [detail, tUnnamed]);

  const originalPositionById = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of detail.members) map.set(m.memberId, m.position);
    return map;
  }, [detail]);

  // Pool of items that can appear on the left (available) panel:
  // server candidates + the original members (so a removed member reappears).
  const poolIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of detail.candidates) ids.add(c.id);
    for (const m of detail.members)    ids.add(m.memberId);
    return ids;
  }, [detail]);

  const label = (id: string): string => labelById.get(id) ?? id;

  // „Membri disponibili" (the right list since 41.42) = pool minus current members, filtered by its search, sorted by label.
  const availableRows = useMemo(() => {
    const q = searchAvailable.trim().toLowerCase();
    return [...poolIds]
      .filter((id) => !memberIds.has(id))
      .filter((id) => {
        if (!q) return true;
        return label(id).toLowerCase().includes(q);
      })
      .sort((a, b) => label(a).localeCompare(label(b)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolIds, memberIds, searchAvailable, labelById]);

  // „Deja în grup" (the left list since 41.42) = current members: saved ones (with position) first by
  // position, then staged additions (no position yet) by label. 41.67: filtered by its own search, the order kept.
  const memberRows = useMemo(() => {
    const q = searchMembers.trim().toLowerCase();
    const ids = [...memberIds].filter((id) => !q || label(id).toLowerCase().includes(q));
    const withPos = ids
      .filter((id) => originalPositionById.has(id))
      .sort((a, b) => originalPositionById.get(a)! - originalPositionById.get(b)!);
    const staged = ids
      .filter((id) => !originalPositionById.has(id))
      .sort((a, b) => label(a).localeCompare(label(b)));
    return [...withPos, ...staged];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberIds, originalPositionById, searchMembers, labelById]);

  // Dirty check vs baseline.
  const memberSetChanged = useMemo(() => {
    if (memberIds.size !== baseMemberIds.length) return true;
    for (const id of baseMemberIds) if (!memberIds.has(id)) return true;
    return false;
  }, [memberIds, baseMemberIds]);

  const dirty = description.trim() !== baseDescription || memberSetChanged;
  const descriptionValid = description.trim().length > 0;

  // ── Move actions ───────────────────────────────────────────────────────────

  // 41.42: the two lists' moves — pending until „Salvează grupul", as the buttons' were.
  function include(ids: string[]) {
    setMemberIds((prev) => new Set([...prev, ...ids]));
  }

  function takeOut(ids: string[]) {
    setMemberIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }

  const baseMembers = useMemo(() => new Set(baseMemberIds), [baseMemberIds]);
  // A member's position once saved; a moved row is marked „în așteptare" until then (41.42 Ask first 4).
  const leftRows: TwoListRow[] = memberRows.map((id) => {
    const pos = baseMembers.has(id) ? originalPositionById.get(id) : undefined;
    return { id, label: label(id), note: pos !== undefined ? `[${pad2(pos)}]` : undefined, pending: !baseMembers.has(id) };
  });
  const rightRows: TwoListRow[] = availableRows.map((id) => ({ id, label: label(id), pending: baseMembers.has(id) }));

  const mutation = useMutation({
    mutationFn: () =>
      saveGroup(groupId, {
        description: description.trim(),
        memberIds: [...memberIds],
      }),
    onSuccess: (updated) => {
      qc.setQueryData(["group", groupId], updated);
      qc.invalidateQueries({ queryKey: ["groups"] });
      setBaseDescription(updated.description);
      setBaseMemberIds(updated.members.map((m) => m.memberId));
      setDescription(updated.description);
      setMemberIds(new Set(updated.members.map((m) => m.memberId)));
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message === "__SESSION__" ? t("saveErrorSession") : err.message);
    },
  });

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    // Slice #38.12: the screen's tiles on the record forms' packing and drag (`TileUnitRow`), under the group screen's own
    // key. 41.42: two of them — the identity (2 units) and the members' two lists (7), side by side where 9 units fit.
    <>
    {/* Slice 41.41: the screen's tiles chosen with „Panouri" (in the page bar); „Implicit" there puts the places back. */}
    <AdminTilesBar registry={GROUP_REGISTRY} labels={{ identity: t("panels.identity"), members: t("panels.members"), workflows: t("workflows.title") }} tiles={tiles} allUp />
    <TileUnitRow screen={GROUP_SCREEN}>
      {/* „Identitatea grupului" — 41.42: compact, 2 units: the code and the target on one line, the description, „Salvează grupul". */}
      <section
        hidden={!tiles.choice.isShown("identity")}
        aria-labelledby={identityTitleId}
        {...screenPanel("group", IDENTITY_UNITS)}
        data-tile="identity"
        className="flex flex-col rounded-md border border-card-rim bg-card shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <TileTitle id={identityTitleId} title={t("panels.identity")} admin />
        <div className="flex flex-col gap-1 p-3">
          <p className="text-sm text-ink dark:text-zinc-200" data-group-identity-line="">
            <span className="font-mono font-semibold" title={t("fields.code")}>{detail.code}</span>
            {" · "}
            <span title={t("fields.target")}>{t(`targets.${detail.targetType}`)}</span>
          </p>
          <label htmlFor={descriptionId} className="mt-1 text-xs font-medium text-fade dark:text-zinc-400">
            {t("fields.description")}
            <span className="ml-0.5 text-red-500">*</span>
          </label>
          <GrowingText
            id={descriptionId}
            value={description}
            onValueChange={setDescription}
            width={tileInner(unitsInnerRem(IDENTITY_UNITS))}
            lines
            minRows={1}
            maxLength={DESCRIPTION_MAX}
            data-width-field="groupDescription"
            className="rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
          />
          <span className="text-xs text-fade dark:text-zinc-500">
            {t("descriptionCount", { count: description.trim().length, max: DESCRIPTION_MAX })}
          </span>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}

          {/* „Salvează grupul" at the tile's foot */}
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-crease pt-3 dark:border-zinc-800" data-group-save="">
            <IconButton
              icon={Save}
              label={t("saveGroup")}
              busy={mutation.isPending}
              busyLabel={t("saving")}
              variant="primary"
              size="md"
              onClick={() => mutation.mutate()}
              disabled={!dirty || !descriptionValid || mutation.isPending}
            />
            <HelpHint hintKey="group-staged-members" />
            {dirty && (
              <span className="text-xs text-fade dark:text-zinc-500">
                {t("unsavedChanges")}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* „Membrii grupului" — 41.42: „Deja în grup" and „Membri disponibili pentru includere" as one tile of two lists. */}
      <section
        hidden={!tiles.choice.isShown("members")}
        aria-labelledby={membersTitleId}
        {...screenPanel("members", TWO_LISTS_UNITS)}
        data-tile="members"
        className="flex flex-col rounded-md border border-card-rim bg-card shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <TileTitle id={membersTitleId} title={t("panels.members")} admin />
        <div className="p-3">
          <TwoLists
            left={{
              name: "in-group",
              title: t("panels.inGroup"),
              hint: <HelpHint hintKey="group-pending-position" />,
              rows: leftRows,
              empty: t("panels.inGroupEmpty"),
              // 41.67, Adrian: „please add the search box to the list on the left […] So both lists will look very
              // similar With the exception of their titles and counts" — the right box's twin, its own state.
              toolbar: (
                <input
                  type="search"
                  value={searchMembers}
                  onChange={(e) => setSearchMembers(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  aria-label={t("searchInGroup")}
                  data-member-search="in-group"
                  {...screenBox("memberSearch", { width: "100%" })}
                  className="rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm placeholder:text-fade focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
                />
              ),
            }}
            right={{
              name: "available",
              title: t("panels.available"),
              rows: rightRows,
              empty: t("panels.availableEmpty"),
              toolbar: (
                <input
                  type="search"
                  value={searchAvailable}
                  onChange={(e) => setSearchAvailable(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  aria-label={t("searchAvailable")}
                  data-member-search="available"
                  {...screenBox("memberSearch", { width: "100%" })}
                  className="rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm placeholder:text-fade focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
                />
              ),
            }}
            includeLabel={(count) => t("include", { count })}
            takeOutLabel={(count) => t("takeOut", { count })}
            includeIcon={ListPlus}
            takeOutIcon={ListMinus}
            onInclude={include}
            onTakeOut={takeOut}
          />
        </div>
      </section>

      {/* 41.44: „Cum lucrezi cu grupurile" */}
      <WorkflowsTile kind="group" hidden={!tiles.choice.isShown("workflows")} />
    </TileUnitRow>
    </>
  );
}
