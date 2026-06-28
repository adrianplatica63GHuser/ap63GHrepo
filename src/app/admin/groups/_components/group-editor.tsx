"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { GroupTargetType } from "@/lib/groups/validation";

// ── Types (mirror GroupDetail from src/lib/groups/queries.ts) ────────────────

type MemberItem = {
  propertyId: string;
  position:   number;
  code:       string;
  nickname:   string | null;
};
type Candidate = {
  id:              string;
  code:            string;
  nickname:        string | null;
  otherGroupCount: number;
};
type GroupDetail = {
  id:          string;
  code:        string;
  targetType:  GroupTargetType;
  description: string;
  members:     MemberItem[];
  candidates:  Candidate[] | null;
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
}: {
  groupId: string;
  initialDetail: GroupDetail;
}) {
  const t = useTranslations("group");
  const qc = useQueryClient();

  const { data: detail } = useQuery<GroupDetail>({
    queryKey: ["group", groupId],
    queryFn: () => fetchDetail(groupId),
    initialData: initialDetail,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const isProperty = detail.targetType === "PROPERTY";

  // Baselines — the last saved state. Reset after a successful save.
  const [baseDescription, setBaseDescription] = useState(detail.description);
  const [baseMemberIds, setBaseMemberIds] = useState<string[]>(
    () => detail.members.map((m) => m.propertyId),
  );

  // Working copy.
  const [description, setDescription] = useState(detail.description);
  const [memberIds, setMemberIds] = useState<Set<string>>(
    () => new Set(detail.members.map((m) => m.propertyId)),
  );

  const [showItems, setShowItems] = useState(true);
  const [search, setSearch] = useState("");
  const [selAvailable, setSelAvailable] = useState<Set<string>>(() => new Set());
  const [selMembers, setSelMembers] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);

  // Lookups built from the server detail.
  const infoById = useMemo(() => {
    const map = new Map<string, { code: string; nickname: string | null }>();
    for (const m of detail.members) map.set(m.propertyId, { code: m.code, nickname: m.nickname });
    for (const c of detail.candidates ?? []) map.set(c.id, { code: c.code, nickname: c.nickname });
    return map;
  }, [detail]);

  const originalPositionById = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of detail.members) map.set(m.propertyId, m.position);
    return map;
  }, [detail]);

  // Pool of properties that can appear on the left (available) panel:
  // server candidates + the original members (so a removed member reappears).
  const poolIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of detail.candidates ?? []) ids.add(c.id);
    for (const m of detail.members) ids.add(m.propertyId);
    return ids;
  }, [detail]);

  const label = (id: string): string => {
    const info = infoById.get(id);
    return info?.nickname?.trim() || info?.code || id;
  };

  // Left panel = pool minus current members, filtered by search, sorted by label.
  const availableRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...poolIds]
      .filter((id) => !memberIds.has(id))
      .filter((id) => {
        if (!q) return true;
        const info = infoById.get(id);
        return (
          (info?.nickname?.toLowerCase().includes(q) ?? false) ||
          (info?.code?.toLowerCase().includes(q) ?? false)
        );
      })
      .sort((a, b) => label(a).localeCompare(label(b)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolIds, memberIds, search, infoById]);

  // Right panel = current members: saved ones (with position) first by
  // position, then staged additions (no position yet) by label.
  const memberRows = useMemo(() => {
    const ids = [...memberIds];
    const withPos = ids
      .filter((id) => originalPositionById.has(id))
      .sort((a, b) => originalPositionById.get(a)! - originalPositionById.get(b)!);
    const staged = ids
      .filter((id) => !originalPositionById.has(id))
      .sort((a, b) => label(a).localeCompare(label(b)));
    return [...withPos, ...staged];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberIds, originalPositionById, infoById]);

  // Dirty check vs baseline.
  const memberSetChanged = useMemo(() => {
    if (memberIds.size !== baseMemberIds.length) return true;
    for (const id of baseMemberIds) if (!memberIds.has(id)) return true;
    return false;
  }, [memberIds, baseMemberIds]);

  const dirty = description.trim() !== baseDescription || memberSetChanged;
  const descriptionValid = description.trim().length > 0;

  // ── Move actions ───────────────────────────────────────────────────────────

  function addSelected() {
    setMemberIds((prev) => {
      const next = new Set(prev);
      for (const id of selAvailable) next.add(id);
      return next;
    });
    setSelAvailable(new Set());
  }

  function removeSelected() {
    setMemberIds((prev) => {
      const next = new Set(prev);
      for (const id of selMembers) next.delete(id);
      return next;
    });
    setSelMembers(new Set());
  }

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  const mutation = useMutation({
    mutationFn: () => {
      const body: { description?: string; memberIds?: string[] } = {
        description: description.trim(),
      };
      if (isProperty) body.memberIds = [...memberIds];
      return saveGroup(groupId, body);
    },
    onSuccess: (updated) => {
      qc.setQueryData(["group", groupId], updated);
      qc.invalidateQueries({ queryKey: ["groups"] });
      setBaseDescription(updated.description);
      setBaseMemberIds(updated.members.map((m) => m.propertyId));
      setDescription(updated.description);
      setMemberIds(new Set(updated.members.map((m) => m.propertyId)));
      setSelAvailable(new Set());
      setSelMembers(new Set());
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message === "__SESSION__" ? t("saveErrorSession") : err.message);
    },
  });

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {/* Area A — read-only target + code, editable description, Add items */}
      <section className="rounded-md border border-card-rim bg-card p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[200px_140px_1fr_auto] md:items-start">
          {/* Target (read-only) */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-fade dark:text-zinc-400">
              {t("fields.target")}
            </span>
            <div className="rounded-md border border-wire bg-canvas px-3 py-1.5 text-sm text-ink dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {t(`targets.${detail.targetType}`)}
            </div>
          </div>

          {/* Code (read-only) */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-fade dark:text-zinc-400">
              {t("fields.code")}
            </span>
            <div className="rounded-md border border-wire bg-canvas px-3 py-1.5 font-mono text-sm font-semibold text-ink dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
              {detail.code}
            </div>
          </div>

          {/* Description (editable) */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-fade dark:text-zinc-400">
              {t("fields.description")}
              <span className="ml-0.5 text-red-500">*</span>
            </span>
            <textarea
              rows={2}
              maxLength={DESCRIPTION_MAX}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 resize-y"
            />
            <span className="text-xs text-fade dark:text-zinc-500">
              {t("descriptionCount", {
                count: description.trim().length,
                max: DESCRIPTION_MAX,
              })}
            </span>
          </div>

          {/* Add items toggle (PROPERTY only) */}
          {isProperty && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-transparent select-none">.</span>
              <button
                type="button"
                onClick={() => setShowItems((v) => !v)}
                className="inline-flex items-center rounded-md border border-wire bg-white px-3 py-1.5 text-sm font-medium text-ink shadow-sm hover:bg-canvas dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              >
                {showItems ? t("hideItems") : t("addItems")}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Areas B + C — member editor (PROPERTY only) */}
      {isProperty && showItems && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Panel B — available */}
          <Panel
            title={t("panels.available")}
            rows={availableRows}
            renderRow={(id) => (
              <MemberRow
                key={id}
                label={label(id)}
                checked={selAvailable.has(id)}
                onToggle={() => toggle(selAvailable, setSelAvailable, id)}
              />
            )}
            empty={t("panels.availableEmpty")}
            toolbar={
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("searchPlaceholder")}
                aria-label={t("searchPlaceholder")}
                className="w-full rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm placeholder:text-fade focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
              />
            }
            footer={
              <button
                type="button"
                onClick={addSelected}
                disabled={selAvailable.size === 0}
                className="inline-flex items-center rounded-md bg-cta px-3 py-1.5 text-xs font-medium text-white hover:bg-cta-d disabled:opacity-40"
              >
                {t("addToGroup", { count: selAvailable.size })}
              </button>
            }
          />

          {/* Panel C — in group */}
          <Panel
            title={t("panels.inGroup")}
            rows={memberRows}
            renderRow={(id) => {
              const pos = originalPositionById.get(id);
              return (
                <MemberRow
                  key={id}
                  label={label(id)}
                  position={pos !== undefined ? `[${pad2(pos)}]` : t("pendingPosition")}
                  checked={selMembers.has(id)}
                  onToggle={() => toggle(selMembers, setSelMembers, id)}
                />
              );
            }}
            empty={t("panels.inGroupEmpty")}
            footer={
              <button
                type="button"
                onClick={removeSelected}
                disabled={selMembers.size === 0}
                className="inline-flex items-center rounded-md border border-wire bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-red-950/30"
              >
                {t("removeFromGroup", { count: selMembers.size })}
              </button>
            }
          />
        </div>
      )}

      {/* Not-implemented notice for non-PROPERTY targets */}
      {!isProperty && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          {t("notImplemented")}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {/* Save */}
      <div className="flex items-center gap-3 border-t border-crease pt-4 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={!dirty || !descriptionValid || mutation.isPending}
          className="inline-flex items-center rounded-md bg-cta px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-cta-d disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mutation.isPending ? t("saving") : t("saveGroup")}
        </button>
        {dirty && (
          <span className="text-xs text-fade dark:text-zinc-500">
            {t("unsavedChanges")}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Presentational helpers ────────────────────────────────────────────────────

function Panel({
  title,
  rows,
  renderRow,
  empty,
  toolbar,
  footer,
}: {
  title: string;
  rows: string[];
  renderRow: (id: string) => React.ReactNode;
  empty: string;
  toolbar?: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-md border border-card-rim bg-card shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-card-rim px-4 py-2 dark:border-zinc-800">
        <span className="text-sm font-semibold text-ink dark:text-zinc-100">{title}</span>
        <span className="text-xs text-fade dark:text-zinc-400">{rows.length}</span>
      </div>
      {toolbar && <div className="border-b border-card-rim p-3 dark:border-zinc-800">{toolbar}</div>}
      <ul className="max-h-[360px] flex-1 divide-y divide-crease overflow-y-auto dark:divide-zinc-800">
        {rows.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-fade">{empty}</li>
        ) : (
          rows.map((id) => renderRow(id))
        )}
      </ul>
      <div className="border-t border-card-rim p-3 dark:border-zinc-800">{footer}</div>
    </section>
  );
}

function MemberRow({
  label,
  position,
  checked,
  onToggle,
}: {
  label: string;
  position?: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-cta-pale dark:hover:bg-zinc-800/50">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        aria-label={label}
        className="h-4 w-4 rounded border-wire accent-cta"
      />
      <span className="flex-1 truncate text-ink dark:text-zinc-200">{label}</span>
      {position && (
        <span className="font-mono text-xs text-fade dark:text-zinc-400">{position}</span>
      )}
    </li>
  );
}
