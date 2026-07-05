"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

// ── Types ─────────────────────────────────────────────────────────────────────

type RoleRow = {
  id:          string;
  name:        string;
  description: string | null;
  sortOrder:   number;
};

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchRoles(): Promise<RoleRow[]> {
  const res = await fetch("/api/admin/property-property-roles");
  if (!res.ok) throw new Error(`Failed to load (${res.status})`);
  return ((await res.json()).items as RoleRow[]);
}

async function createRole(name: string, description: string): Promise<RoleRow> {
  const res = await fetch("/api/admin/property-property-roles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description: description || null }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Error ${res.status}`);
  }
  return res.json();
}

async function patchRole(id: string, name: string, description: string): Promise<void> {
  const res = await fetch(`/api/admin/property-property-roles/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description: description || null }),
  });
  if (!res.ok) throw new Error(`Patch failed (${res.status})`);
}

async function deleteRole(id: string): Promise<void> {
  const res = await fetch(`/api/admin/property-property-roles/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) throw new Error(`Delete failed (${res.status})`);
}

// ── Inline form (add / edit) ──────────────────────────────────────────────────

function RoleForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial?: RoleRow;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const t  = useTranslations("valueList.propertyPropertyRoles");
  const qc = useQueryClient();
  const [name, setName]               = useState(initial?.name ?? "");
  const [desc, setDesc]               = useState(initial?.description ?? "");
  const [error, setError]             = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      initial
        ? patchRole(initial.id, name.trim(), desc.trim())
        : createRole(name.trim(), desc.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["property-property-roles"] });
      onSaved();
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleSubmit() {
    if (!name.trim()) { setError(t("errorNameRequired")); return; }
    setError(null);
    mutation.mutate();
  }

  return (
    <div className="mb-4 rounded-md border border-card-rim bg-card p-4 dark:border-zinc-700 dark:bg-zinc-800">
      <h3 className="mb-3 text-sm font-semibold text-ink dark:text-zinc-100">
        {initial ? t("editTitle") : t("addTitle")}
      </h3>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink dark:text-zinc-400">
            {t("colName")}<span className="ml-0.5 text-red-500">*</span>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink dark:text-zinc-400">
            {t("colDescription")}
          </label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={2}
            className="rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={mutation.isPending}
          className="inline-flex items-center rounded-md bg-cta px-3 py-1.5 text-xs font-medium text-white hover:bg-cta-d disabled:opacity-50"
        >
          {mutation.isPending ? t("saving") : t("save")}
        </button>
        <button
          onClick={onCancel}
          className="inline-flex items-center rounded-md border border-wire bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-canvas dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export function PropertyPropertyModal({ onClose }: { onClose: () => void }) {
  const t      = useTranslations("valueList.propertyPropertyRoles");
  const tModal = useTranslations("valueList.modal");
  const qc     = useQueryClient();

  const [showAdd,         setShowAdd]         = useState(false);
  const [editRow,         setEditRow]         = useState<RoleRow | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const listQuery = useQuery<RoleRow[]>({
    queryKey: ["property-property-roles"],
    queryFn:  fetchRoles,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRole(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ["property-property-roles"] });
      setConfirmDeleteId(null);
    },
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (confirmDeleteId) { setConfirmDeleteId(null); return; }
      if (editRow)         { setEditRow(null);         return; }
      if (showAdd)         { setShowAdd(false);        return; }
      onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmDeleteId, editRow, showAdd, onClose]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-x-4 top-[5%] z-50 mx-auto max-w-3xl rounded-xl border border-card-rim bg-card shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-card-rim px-5 py-4 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-ink dark:text-zinc-100">{t("title")}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-fade hover:bg-cap hover:text-ink dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            aria-label={tModal("close")}
          >✕</button>
        </div>

        {/* Body */}
        <div className="flex max-h-[80vh] flex-col overflow-hidden">
          <div className="overflow-y-auto p-5">
            {/* Add / edit form */}
            {showAdd && !editRow && (
              <RoleForm onCancel={() => setShowAdd(false)} onSaved={() => setShowAdd(false)} />
            )}
            {editRow && (
              <RoleForm
                initial={editRow}
                onCancel={() => setEditRow(null)}
                onSaved={() => setEditRow(null)}
              />
            )}

            {/* Toolbar */}
            <div className="mb-3 flex items-center justify-between">
              <button
                onClick={() => { setShowAdd(true); setEditRow(null); }}
                disabled={showAdd || !!editRow}
                className="inline-flex items-center rounded-md bg-cta px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-cta-d disabled:opacity-40"
              >
                + {t("add")}
              </button>
              {listQuery.data && (
                <span className="text-xs text-fade dark:text-zinc-400">
                  {t("count", { count: listQuery.data.length })}
                </span>
              )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-md border border-card-rim dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-cap text-left text-xs font-medium uppercase tracking-wide text-ink dark:bg-zinc-800 dark:text-zinc-300">
                  <tr>
                    <th className="px-4 py-2">{t("colName")}</th>
                    <th className="px-4 py-2">{t("colDescription")}</th>
                    <th className="w-28 px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-crease bg-white dark:divide-zinc-800 dark:bg-zinc-900">
                  {listQuery.isLoading && (
                    <tr><td colSpan={3} className="px-4 py-6 text-center text-fade">{t("loading")}</td></tr>
                  )}
                  {listQuery.isError && (
                    <tr><td colSpan={3} className="px-4 py-6 text-center text-red-600">{t("error")}</td></tr>
                  )}
                  {listQuery.data?.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-6 text-center text-fade">{t("empty")}</td></tr>
                  )}
                  {listQuery.data?.map((row) => (
                    <tr key={row.id} className="hover:bg-cta-pale dark:hover:bg-zinc-800/50">
                      <td className="px-4 py-2 font-medium text-ink dark:text-zinc-300">{row.name}</td>
                      <td className="max-w-xs px-4 py-2 text-fade dark:text-zinc-400">
                        <span className="block truncate" title={row.description ?? undefined}>
                          {row.description ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1">
                          <button
                            onClick={() => { setEditRow(row); setShowAdd(false); }}
                            className="rounded border border-wire bg-white px-2 py-0.5 text-xs text-ink hover:bg-canvas dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                          >
                            {t("edit")}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(row.id)}
                            className="rounded border border-red-200 bg-white px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 dark:border-red-900 dark:bg-zinc-900 dark:hover:bg-red-950"
                          >
                            {t("delete")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirm */}
      {confirmDeleteId && (
        <>
          <div className="fixed inset-0 z-60 bg-black/50" aria-hidden />
          <div role="alertdialog" className="fixed inset-x-4 top-1/3 z-60 mx-auto max-w-sm rounded-xl border border-card-rim bg-card p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <p className="mb-4 text-sm text-ink dark:text-zinc-300">{t("confirmDelete")}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => deleteMutation.mutate(confirmDeleteId)}
                disabled={deleteMutation.isPending}
                className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? t("deleting") : t("delete")}
              </button>
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-md border border-wire bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-canvas dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
