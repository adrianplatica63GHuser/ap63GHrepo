"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  GROUP_TARGET_TYPES,
  type GroupTargetType,
} from "@/lib/groups/validation";

// ── Types ───────────────────────────────────────────────────────────────────

type GroupListItem = {
  id:          string;
  code:        string;
  targetType:  GroupTargetType;
  description: string;
  memberCount: number;
  createdAt:   string;
};

// ── API helpers ─────────────────────────────────────────────────────────────

async function fetchGroups(): Promise<GroupListItem[]> {
  const res = await fetch("/api/groups");
  if (!res.ok) throw new Error(`Failed to load (${res.status})`);
  const data = await res.json();
  return data.items as GroupListItem[];
}

async function createGroup(body: {
  targetType: GroupTargetType;
  description: string;
}): Promise<GroupListItem> {
  const res = await fetch("/api/groups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Error ${res.status}`);
  }
  return res.json();
}

async function deleteGroup(id: string): Promise<void> {
  const res = await fetch(`/api/groups/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Delete failed (${res.status})`);
  }
}

const DESCRIPTION_MAX = 500;

// ── Add form ─────────────────────────────────────────────────────────────────

function AddForm({ onClose }: { onClose: () => void }) {
  const t = useTranslations("group");
  const qc = useQueryClient();

  const [targetType, setTargetType] = useState<GroupTargetType>("PROPERTY");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const firstRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  const mutation = useMutation({
    mutationFn: () =>
      createGroup({ targetType, description: description.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups"] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const canSave = description.trim().length > 0 && !mutation.isPending;

  return (
    <div className="mb-4 rounded-md border border-card-rim bg-card p-4 dark:border-zinc-700 dark:bg-zinc-800">
      <h3 className="mb-3 text-sm font-semibold text-ink dark:text-zinc-100">
        {t("addTitle")}
      </h3>

      <div className="flex flex-col gap-3">
        {/* Target type */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink dark:text-zinc-400">
            {t("fields.target")}
            <span className="ml-0.5 text-red-500">*</span>
          </label>
          <select
            ref={firstRef}
            value={targetType}
            onChange={(e) => setTargetType(e.target.value as GroupTargetType)}
            className="max-w-xs rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
          >
            {GROUP_TARGET_TYPES.map((tt) => (
              <option key={tt} value={tt}>
                {t(`targets.${tt}`)}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink dark:text-zinc-400">
            {t("fields.description")}
            <span className="ml-0.5 text-red-500">*</span>
          </label>
          <textarea
            rows={3}
            maxLength={DESCRIPTION_MAX}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 resize-y"
          />
          <span className="text-xs text-fade dark:text-zinc-500">
            {t("descriptionCount", {
              count: description.trim().length,
              max: DESCRIPTION_MAX,
            })}
          </span>
        </div>

        {/* Code (system-assigned) */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink dark:text-zinc-400">
            {t("fields.code")}
          </label>
          <div className="max-w-xs rounded-md border border-wire bg-canvas px-3 py-1.5 text-sm italic text-fade dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
            {t("codeAssignedOnSave")}
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => mutation.mutate()}
          disabled={!canSave}
          className="inline-flex items-center rounded-md bg-cta px-3 py-1.5 text-xs font-medium text-white hover:bg-cta-d disabled:opacity-50"
        >
          {mutation.isPending ? t("saving") : t("save")}
        </button>
        <button
          onClick={onClose}
          className="inline-flex items-center rounded-md border border-wire bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-canvas dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}

// ── List ─────────────────────────────────────────────────────────────────────

export function GroupsListView() {
  const t = useTranslations("group");
  const qc = useQueryClient();

  const [adding, setAdding] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const query = useQuery<GroupListItem[]>({
    queryKey: ["groups"],
    queryFn: fetchGroups,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteGroup(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups"] });
      setConfirmDeleteId(null);
    },
  });

  return (
    <div className="flex flex-col gap-3">
      {adding && <AddForm onClose={() => setAdding(false)} />}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setAdding(true)}
          disabled={adding}
          className="inline-flex items-center rounded-md bg-cta px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-cta-d disabled:opacity-40"
        >
          + {t("add")}
        </button>
        {query.data && (
          <span className="text-xs text-fade dark:text-zinc-400">
            {t("count", { count: query.data.length })}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border border-card-rim bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-sm">
          <thead className="bg-cap text-left text-xs font-medium uppercase tracking-wide text-ink dark:bg-zinc-800 dark:text-zinc-300">
            <tr>
              <th className="px-4 py-2">{t("table.code")}</th>
              <th className="px-4 py-2">{t("table.description")}</th>
              <th className="w-28 px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-crease dark:divide-zinc-800">
            {query.isLoading && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-fade">
                  {t("table.loading")}
                </td>
              </tr>
            )}
            {query.isError && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-red-600">
                  {t("table.error")}
                </td>
              </tr>
            )}
            {query.data?.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-fade">
                  {t("table.empty")}
                </td>
              </tr>
            )}
            {query.data?.map((g) => (
              <tr key={g.id} className="hover:bg-cta-pale dark:hover:bg-zinc-800/50">
                <td className="px-4 py-2">
                  <span className="font-mono font-semibold text-ink dark:text-zinc-100">
                    {g.code}
                  </span>{" "}
                  <span className="text-fade dark:text-zinc-400">
                    ({g.memberCount})
                  </span>
                  <div className="text-xs text-fade dark:text-zinc-500">
                    {t(`targets.${g.targetType}`)}
                  </div>
                </td>
                <td className="px-4 py-2 text-ink dark:text-zinc-300">
                  {g.description}
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-2">
                    <Link
                      href={`/admin/groups/${g.id}`}
                      className="rounded border border-wire bg-white px-2 py-0.5 text-xs text-ink hover:bg-canvas dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                    >
                      {t("table.edit")}
                    </Link>
                    <button
                      onClick={() => setConfirmDeleteId(g.id)}
                      className="rounded border border-red-200 bg-white px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 dark:border-red-900 dark:bg-zinc-900 dark:hover:bg-red-950"
                    >
                      {t("table.delete")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete confirm */}
      {confirmDeleteId && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" aria-hidden />
          <div
            role="alertdialog"
            className="fixed inset-x-4 top-1/3 z-50 mx-auto max-w-sm rounded-xl border border-card-rim bg-card p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="mb-4 text-sm text-ink dark:text-zinc-300">
              {t("confirm.deleteBody")}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => deleteMutation.mutate(confirmDeleteId)}
                disabled={deleteMutation.isPending}
                className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? t("confirm.deleting") : t("confirm.delete")}
              </button>
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-md border border-wire bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-canvas dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              >
                {t("confirm.cancel")}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
