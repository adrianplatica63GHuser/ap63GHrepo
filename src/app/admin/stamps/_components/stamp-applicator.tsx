"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
  GROUP_TARGET_TYPES,
  type StampTargetType,
} from "@/lib/stamps/validation";

// ── Types ────────────────────────────────────────────────────────────────────

type StampMemberItem = {
  memberId:     string;
  displayLabel: string;
};
type StampCandidate = {
  id:           string;
  displayLabel: string;
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
}: {
  stampId:       string;
  initialDetail: StampDetail;
}) {
  const t  = useTranslations("stamp");
  const qc = useQueryClient();

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
  const [selAvailable, setSelAvailable] = useState<Set<string>>(() => new Set());
  const [selStamped, setSelStamped]     = useState<Set<string>>(() => new Set());

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
  const labelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of detail?.members   ?? []) map.set(m.memberId, m.displayLabel);
    for (const c of detail?.candidates ?? []) map.set(c.id,       c.displayLabel);
    return map;
  }, [detail]);

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

  function applySelected() {
    updateChanges(selectedType, (c) => {
      const toAdd    = new Set(c.toAdd);
      const toRemove = new Set(c.toRemove);
      for (const id of selAvailable) {
        toAdd.add(id);
        toRemove.delete(id);
      }
      return { toAdd, toRemove };
    });
    setSelAvailable(new Set());
  }

  function removeSelected() {
    updateChanges(selectedType, (c) => {
      const toAdd    = new Set(c.toAdd);
      const toRemove = new Set(c.toRemove);
      for (const id of selStamped) {
        toRemove.add(id);
        toAdd.delete(id);
      }
      return { toAdd, toRemove };
    });
    setSelStamped(new Set());
  }

  function toggleAvailable(id: string) {
    const next = new Set(selAvailable);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelAvailable(next);
  }

  function toggleStamped(id: string) {
    const next = new Set(selStamped);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelStamped(next);
  }

  // ── Type switch ───────────────────────────────────────────────────────────

  function switchType(type: StampTargetType) {
    setSelectedType(type);
    setSelAvailable(new Set());
    setSelStamped(new Set());
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
      setSelAvailable(new Set());
      setSelStamped(new Set());
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
    <div className="flex flex-col gap-4">
      {/* Area A — code (read-only), short description (read-only), notes (editable) */}
      <section className="rounded-md border border-card-rim bg-card p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[auto_1fr]">
          {/* Code + short description */}
          <div className="flex flex-col gap-1 md:max-w-[220px]">
            <span className="text-xs font-medium text-fade dark:text-zinc-400">
              {t("fields.code")}
            </span>
            <div className="rounded-md border border-wire bg-canvas px-3 py-1.5 font-mono text-sm font-semibold text-ink dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
              {detail?.code ?? initialDetail.code}
            </div>
            <div className="mt-1 text-sm text-ink dark:text-zinc-300">
              {detail?.shortDescription ?? initialDetail.shortDescription}
            </div>
          </div>

          {/* Notes (editable) */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-fade dark:text-zinc-400">
              {t("fields.notes")}
            </span>
            <textarea
              rows={2}
              maxLength={NOTES_MAX}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 resize-y"
            />
          </div>
        </div>
      </section>

      {/* Area B — target type selector */}
      <section className="rounded-md border border-card-rim bg-card p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-ink dark:text-zinc-300">
            {t("applicator.targetTypeLabel")}
          </label>
          <select
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

          {hasStagedForType && (
            <span className="text-xs italic text-amber-600 dark:text-amber-400">
              {t("applicator.unsavedChangesForType")}
            </span>
          )}
        </div>

        {/* Info note */}
        <p className="mt-2 text-xs italic text-fade dark:text-zinc-500">
          {t("applicator.typeNote")}
        </p>
      </section>

      {/* Areas C + D — Available / Stamped panels */}
      {isLoading && (
        <p className="text-sm text-fade dark:text-zinc-400">{t("applicator.loading")}</p>
      )}
      {isError && (
        <p className="text-sm text-red-600 dark:text-red-400">{t("applicator.loadError")}</p>
      )}

      {!isLoading && !isError && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Panel C — Available */}
          <Panel
            title={t("applicator.available")}
            count={availableRows.length}
            toolbar={
              <input
                type="search"
                value={searchAvailable}
                onChange={(e) => setSearchAvailable(e.target.value)}
                placeholder={t("applicator.searchPlaceholder")}
                aria-label={t("applicator.searchAvailable")}
                className="w-full rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm placeholder:text-fade focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
              />
            }
            rows={availableRows}
            renderRow={(id) => (
              <ItemRow
                key={id}
                label={label(id)}
                checked={selAvailable.has(id)}
                onToggle={() => toggleAvailable(id)}
                staged={staged.toAdd.has(id) ? "add" : undefined}
              />
            )}
            empty={t("applicator.availableEmpty")}
            footer={
              <button
                type="button"
                onClick={applySelected}
                disabled={selAvailable.size === 0}
                className="inline-flex items-center rounded-md bg-cta px-3 py-1.5 text-xs font-medium text-white hover:bg-cta-d disabled:opacity-40"
              >
                {t("applicator.applyStamp", { count: selAvailable.size })}
              </button>
            }
          />

          {/* Panel D — Stamped */}
          <Panel
            title={t("applicator.stamped")}
            count={stampedRows.length}
            toolbar={
              <input
                type="search"
                value={searchStamped}
                onChange={(e) => setSearchStamped(e.target.value)}
                placeholder={t("applicator.searchPlaceholder")}
                aria-label={t("applicator.searchStamped")}
                className="w-full rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm placeholder:text-fade focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
              />
            }
            rows={stampedRows}
            renderRow={(id) => (
              <ItemRow
                key={id}
                label={label(id)}
                checked={selStamped.has(id)}
                onToggle={() => toggleStamped(id)}
                staged={staged.toRemove.has(id) ? "remove" : undefined}
              />
            )}
            empty={t("applicator.stampedEmpty")}
            footer={
              <button
                type="button"
                onClick={removeSelected}
                disabled={selStamped.size === 0}
                className="inline-flex items-center rounded-md border border-wire bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-red-950/30"
              >
                {t("applicator.removeStamp", { count: selStamped.size })}
              </button>
            }
          />
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
          disabled={!dirty || mutation.isPending}
          className="inline-flex items-center rounded-md bg-cta px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-cta-d disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mutation.isPending ? t("saving") : t("applicator.saveStamps")}
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
  count,
  toolbar,
  rows,
  renderRow,
  empty,
  footer,
}: {
  title:      string;
  count:      number;
  toolbar?:   React.ReactNode;
  rows:       string[];
  renderRow:  (id: string) => React.ReactNode;
  empty:      string;
  footer:     React.ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-md border border-card-rim bg-card shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-card-rim px-4 py-2 dark:border-zinc-800">
        <span className="text-sm font-semibold text-ink dark:text-zinc-100">{title}</span>
        <span className="text-xs text-fade dark:text-zinc-400">{count}</span>
      </div>
      {toolbar && (
        <div className="border-b border-card-rim p-3 dark:border-zinc-800">{toolbar}</div>
      )}
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

function ItemRow({
  label,
  checked,
  onToggle,
  staged,
}: {
  label:    string;
  checked:  boolean;
  onToggle: () => void;
  staged?:  "add" | "remove";
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
      {staged === "add" && (
        <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-300">
          +
        </span>
      )}
      {staged === "remove" && (
        <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
          −
        </span>
      )}
    </li>
  );
}
