"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ── Types ─────────────────────────────────────────────────────────────────────

type AssocRow = {
  id: string;
  documentTypeId: string;
  personRoleId: string;
  documentTypeName: string;
  personRoleName: string;
};

type LookupItem = { id: string; name: string };

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchAssociations(): Promise<AssocRow[]> {
  const res = await fetch("/api/admin/doc-type-person-roles");
  if (!res.ok) throw new Error(`Failed to load (${res.status})`);
  const data = await res.json();
  return data.items as AssocRow[];
}

async function fetchDocumentTypes(): Promise<LookupItem[]> {
  const res = await fetch("/api/admin/value-lists/document-types");
  if (!res.ok) throw new Error(`Failed to load document types (${res.status})`);
  const data = await res.json();
  return (data.items as Array<{ id: string; name: string }>).map((r) => ({
    id: r.id,
    name: r.name,
  }));
}

async function fetchPersonRoles(): Promise<LookupItem[]> {
  const res = await fetch("/api/admin/value-lists/person-roles");
  if (!res.ok) throw new Error(`Failed to load person roles (${res.status})`);
  const data = await res.json();
  return (data.items as Array<{ id: string; name: string }>).map((r) => ({
    id: r.id,
    name: r.name,
  }));
}

async function createAssociation(data: {
  documentTypeId: string;
  personRoleId: string;
}): Promise<AssocRow> {
  const res = await fetch("/api/admin/doc-type-person-roles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Error ${res.status}`);
  }
  return res.json();
}

async function removeAssociation(id: string): Promise<void> {
  const res = await fetch(`/api/admin/doc-type-person-roles/${id}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Delete failed (${res.status})`);
  }
}

// ── Add form ──────────────────────────────────────────────────────────────────

function AddForm({
  docTypes,
  personRoles,
  onClose,
  onSaved,
}: {
  docTypes: LookupItem[];
  personRoles: LookupItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("valueList.documentPersons");
  const qc = useQueryClient();
  const [docTypeId, setDocTypeId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createAssociation({ documentTypeId: docTypeId, personRoleId: roleId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doc-type-person-roles"] });
      onSaved();
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleSubmit() {
    if (!docTypeId || !roleId) {
      setError(t("errorBothRequired"));
      return;
    }
    setError(null);
    mutation.mutate();
  }

  return (
    <div className="mb-4 rounded-md border border-card-rim bg-card p-4 dark:border-zinc-700 dark:bg-zinc-800">
      <h3 className="mb-3 text-sm font-semibold text-ink dark:text-zinc-100">
        {t("addTitle")}
      </h3>

      <div className="flex flex-wrap gap-3">
        {/* Document Type dropdown */}
        <div className="flex min-w-56 flex-col gap-1">
          <label className="text-xs font-medium text-ink dark:text-zinc-400">
            {t("colDocType")}
            <span className="ml-0.5 text-red-500">*</span>
          </label>
          <select
            value={docTypeId}
            onChange={(e) => setDocTypeId(e.target.value)}
            className="rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="">{t("selectDocType")}</option>
            {docTypes.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {/* Person Role dropdown */}
        <div className="flex min-w-56 flex-col gap-1">
          <label className="text-xs font-medium text-ink dark:text-zinc-400">
            {t("colPersonRole")}
            <span className="ml-0.5 text-red-500">*</span>
          </label>
          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            className="rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="">{t("selectPersonRole")}</option>
            {personRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Hint text */}
      <div className="mt-3 space-y-1">
        <p className="text-xs text-fade dark:text-zinc-400">
          ℹ {t("hintDocType")}
        </p>
        <p className="text-xs text-fade dark:text-zinc-400">
          ℹ {t("hintPersonRole")}
        </p>
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={mutation.isPending}
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

export function DocumentPersonsModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("valueList.documentPersons");
  const tModal = useTranslations("valueList.modal");
  const qc = useQueryClient();

  const [showAdd, setShowAdd] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const assocQuery = useQuery<AssocRow[]>({
    queryKey: ["doc-type-person-roles"],
    queryFn: fetchAssociations,
  });

  const docTypesQuery = useQuery<LookupItem[]>({
    queryKey: ["value-list", "document-types"],
    queryFn: fetchDocumentTypes,
  });

  const rolesQuery = useQuery<LookupItem[]>({
    queryKey: ["value-list", "person-roles"],
    queryFn: fetchPersonRoles,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeAssociation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doc-type-person-roles"] });
      setConfirmDeleteId(null);
    },
  });

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (confirmDeleteId) { setConfirmDeleteId(null); return; }
        if (showAdd) { setShowAdd(false); return; }
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmDeleteId, showAdd, onClose]);

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-x-4 top-[5%] z-50 mx-auto max-w-3xl rounded-xl border border-card-rim bg-card shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-card-rim px-5 py-4 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-ink dark:text-zinc-100">
            {t("title")}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-fade hover:bg-cap hover:text-ink dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            aria-label={tModal("close")}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex max-h-[80vh] flex-col overflow-hidden">
          <div className="overflow-y-auto p-5">
            {/* Add form */}
            {showAdd && docTypesQuery.data && rolesQuery.data && (
              <AddForm
                docTypes={docTypesQuery.data}
                personRoles={rolesQuery.data}
                onClose={() => setShowAdd(false)}
                onSaved={() => setShowAdd(false)}
              />
            )}

            {/* Toolbar */}
            <div className="mb-3 flex items-center justify-between">
              <button
                onClick={() => setShowAdd(true)}
                disabled={showAdd}
                className="inline-flex items-center rounded-md bg-cta px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-cta-d disabled:opacity-40"
              >
                + {t("add")}
              </button>
              {assocQuery.data && (
                <span className="text-xs text-fade dark:text-zinc-400">
                  {t("count", { count: assocQuery.data.length })}
                </span>
              )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-md border border-card-rim dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-cap text-left text-xs font-medium uppercase tracking-wide text-ink dark:bg-zinc-800 dark:text-zinc-300">
                  <tr>
                    <th className="px-4 py-2">{t("colDocType")}</th>
                    <th className="px-4 py-2">{t("colPersonRole")}</th>
                    <th className="w-20 px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-crease bg-white dark:divide-zinc-800 dark:bg-zinc-900">
                  {assocQuery.isLoading && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-fade">
                        {t("loading")}
                      </td>
                    </tr>
                  )}
                  {assocQuery.isError && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-red-600">
                        {t("error")}
                      </td>
                    </tr>
                  )}
                  {assocQuery.data?.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-fade">
                        {t("empty")}
                      </td>
                    </tr>
                  )}
                  {assocQuery.data?.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-cta-pale dark:hover:bg-zinc-800/50"
                    >
                      <td className="px-4 py-2 text-ink dark:text-zinc-300">
                        {row.documentTypeName}
                      </td>
                      <td className="px-4 py-2 text-ink dark:text-zinc-300">
                        {row.personRoleName}
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

      {/* Delete confirm dialog */}
      {confirmDeleteId && (
        <>
          <div className="fixed inset-0 z-60 bg-black/50" aria-hidden />
          <div
            role="alertdialog"
            className="fixed inset-x-4 top-1/3 z-60 mx-auto max-w-sm rounded-xl border border-card-rim bg-card p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="mb-4 text-sm text-ink dark:text-zinc-300">
              {t("confirmDelete")}
            </p>
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
