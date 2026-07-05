"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

// ── Types ─────────────────────────────────────────────────────────────────────

type PersonPersonRoleRow = {
  id:                    string;
  personRoleId:          string;
  personRoleName:        string;
  personRoleDescription: string | null;
};

type LookupItem = { id: string; name: string; description: string | null };

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchPersonPersonRoles(): Promise<PersonPersonRoleRow[]> {
  const res = await fetch("/api/admin/person-person-roles");
  if (!res.ok) throw new Error(`Failed to load (${res.status})`);
  return ((await res.json()).items as PersonPersonRoleRow[]);
}

async function fetchAllPersonRoles(): Promise<LookupItem[]> {
  const res = await fetch("/api/admin/value-lists/person-roles");
  if (!res.ok) throw new Error(`Failed to load person roles (${res.status})`);
  const data = await res.json();
  return (data.items as Array<{ id: string; name: string; description?: string | null }>).map(
    (r) => ({ id: r.id, name: r.name, description: r.description ?? null }),
  );
}

async function addPersonPersonRole(personRoleId: string): Promise<PersonPersonRoleRow> {
  const res = await fetch("/api/admin/person-person-roles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ personRoleId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Error ${res.status}`);
  }
  return res.json();
}

async function removePersonPersonRole(id: string): Promise<void> {
  const res = await fetch(`/api/admin/person-person-roles/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) throw new Error(`Delete failed (${res.status})`);
}

// ── Add form ──────────────────────────────────────────────────────────────────

function AddForm({
  allRoles,
  alreadyAdded,
  onClose,
  onSaved,
}: {
  allRoles:     LookupItem[];
  alreadyAdded: Set<string>;
  onClose:      () => void;
  onSaved:      () => void;
}) {
  const t  = useTranslations("valueList.personPersonRoles");
  const qc = useQueryClient();
  const [roleId, setRoleId] = useState("");
  const [error,  setError]  = useState<string | null>(null);

  const available = allRoles.filter((r) => !alreadyAdded.has(r.id));

  const mutation = useMutation({
    mutationFn: () => addPersonPersonRole(roleId),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ["person-person-roles"] });
      onSaved();
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleSubmit() {
    if (!roleId) { setError(t("errorRequired")); return; }
    setError(null);
    mutation.mutate();
  }

  return (
    <div className="mb-4 rounded-md border border-card-rim bg-card p-4 dark:border-zinc-700 dark:bg-zinc-800">
      <h3 className="mb-3 text-sm font-semibold text-ink dark:text-zinc-100">{t("addTitle")}</h3>
      <div className="flex flex-wrap gap-3">
        <div className="flex min-w-72 flex-col gap-1">
          <label className="text-xs font-medium text-ink dark:text-zinc-400">
            {t("colPersonRole")}<span className="ml-0.5 text-red-500">*</span>
          </label>
          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            className="rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="">{t("selectPersonRole")}</option>
            {available.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="mt-3 text-xs text-fade dark:text-zinc-400">ℹ {t("hintPersonRole")}</p>
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={mutation.isPending || available.length === 0}
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

// ── Modal ─────────────────────────────────────────────────────────────────────

export function PersonPersonModal({ onClose }: { onClose: () => void }) {
  const t      = useTranslations("valueList.personPersonRoles");
  const tModal = useTranslations("valueList.modal");
  const qc     = useQueryClient();

  const [showAdd,         setShowAdd]         = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const listQuery = useQuery<PersonPersonRoleRow[]>({
    queryKey: ["person-person-roles"],
    queryFn:  fetchPersonPersonRoles,
  });

  const rolesQuery = useQuery<LookupItem[]>({
    queryKey: ["value-list", "person-roles"],
    queryFn:  fetchAllPersonRoles,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removePersonPersonRole(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ["person-person-roles"] });
      setConfirmDeleteId(null);
    },
  });

  const alreadyAdded = new Set((listQuery.data ?? []).map((r) => r.personRoleId));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (confirmDeleteId) { setConfirmDeleteId(null); return; }
      if (showAdd)         { setShowAdd(false);        return; }
      onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmDeleteId, showAdd, onClose]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-x-4 top-[5%] z-50 mx-auto max-w-3xl rounded-xl border border-card-rim bg-card shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between border-b border-card-rim px-5 py-4 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-ink dark:text-zinc-100">{t("title")}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-fade hover:bg-cap hover:text-ink dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            aria-label={tModal("close")}
          >✕</button>
        </div>

        <div className="flex max-h-[80vh] flex-col overflow-hidden">
          <div className="overflow-y-auto p-5">
            {showAdd && rolesQuery.data && (
              <AddForm
                allRoles={rolesQuery.data}
                alreadyAdded={alreadyAdded}
                onClose={() => setShowAdd(false)}
                onSaved={() => setShowAdd(false)}
              />
            )}

            <div className="mb-3 flex items-center justify-between">
              <button
                onClick={() => setShowAdd(true)}
                disabled={showAdd}
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

            <div className="overflow-x-auto rounded-md border border-card-rim dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-cap text-left text-xs font-medium uppercase tracking-wide text-ink dark:bg-zinc-800 dark:text-zinc-300">
                  <tr>
                    <th className="px-4 py-2">{t("colPersonRole")}</th>
                    <th className="px-4 py-2">{t("colDescription")}</th>
                    <th className="w-20 px-4 py-2" />
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
                      <td className="px-4 py-2 font-medium text-ink dark:text-zinc-300">
                        {row.personRoleName}
                      </td>
                      <td className="max-w-xs px-4 py-2 text-fade dark:text-zinc-400">
                        <span className="block truncate" title={row.personRoleDescription ?? undefined}>
                          {row.personRoleDescription ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => setConfirmDeleteId(row.id)}
                          className="rounded border border-red-200 bg-white px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 dark:border-red-900 dark:bg-zinc-900 dark:hover:bg-red-950"
                        >
                          {t("delete")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

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
