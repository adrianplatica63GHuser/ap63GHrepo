"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { LIST_META, type ListKey } from "@/lib/admin/value-lists/config";

// ── API helpers ───────────────────────────────────────────────────────────────

type Row = Record<string, unknown> & { id: string };

async function fetchRows(listKey: ListKey): Promise<Row[]> {
  const res = await fetch(`/api/admin/value-lists/${listKey}`);
  if (!res.ok) throw new Error(`Failed to load (${res.status})`);
  const data = await res.json();
  return data.items as Row[];
}

async function saveRow(
  listKey: ListKey,
  id: string | null,
  body: Record<string, string>,
): Promise<Row> {
  const url = id
    ? `/api/admin/value-lists/${listKey}/${id}`
    : `/api/admin/value-lists/${listKey}`;
  const method = id ? "PUT" : "POST";
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Error ${res.status}`);
  }
  return res.json();
}

async function removeRow(listKey: ListKey, id: string): Promise<void> {
  const res = await fetch(`/api/admin/value-lists/${listKey}/${id}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Delete failed (${res.status})`);
  }
}

// ── Inline edit/add form ──────────────────────────────────────────────────────

type FormState = {
  id: string | null; // null = adding
  values: Record<string, string>;
};

function EditForm({
  listKey,
  state,
  onClose,
  onSaved,
}: {
  listKey: ListKey;
  state: FormState;
  onClose: () => void;
  onSaved: (row: Row) => void;
}) {
  const t = useTranslations("valueList");
  const meta = LIST_META[listKey];
  const [values, setValues] = useState<Record<string, string>>(state.values);
  const [error, setError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => saveRow(listKey, state.id, values),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["value-list", listKey] });
      onSaved(row);
    },
    onError: (err: Error) => setError(err.message),
  });

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") mutation.mutate();
    if (e.key === "Escape") onClose();
  }

  return (
    <div className="mb-4 rounded-md border border-card-rim bg-card p-4 dark:border-zinc-700 dark:bg-zinc-800">
      <h3 className="mb-3 text-sm font-semibold text-ink dark:text-zinc-100">
        {state.id ? t("form.editTitle") : t("form.addTitle")}
      </h3>

      <div className="flex flex-wrap gap-3">
        {meta.fields.map((f, i) => (
          <div key={f.key} className="flex flex-col gap-1 min-w-48">
            <label className="text-xs font-medium text-ink dark:text-zinc-400">
              {t(`fields.${f.labelKey}`)}
              {f.required && <span className="ml-0.5 text-red-500">*</span>}
            </label>
            <input
              ref={i === 0 ? firstInputRef : undefined}
              type="text"
              value={values[f.key] ?? ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [f.key]: e.target.value }))
              }
              onKeyDown={handleKey}
              className="rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="inline-flex items-center rounded-md bg-cta px-3 py-1.5 text-xs font-medium text-white hover:bg-cta-d disabled:opacity-50"
        >
          {mutation.isPending ? t("form.saving") : t("form.save")}
        </button>
        <button
          onClick={onClose}
          className="inline-flex items-center rounded-md border border-wire bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-canvas dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          {t("form.cancel")}
        </button>
      </div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export function ValueListModal({
  listKey,
  onClose,
}: {
  listKey: ListKey;
  onClose: () => void;
}) {
  const t = useTranslations("valueList");
  const meta = LIST_META[listKey];
  const qc = useQueryClient();

  const [form, setForm] = useState<FormState | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const query = useQuery<Row[]>({
    queryKey: ["value-list", listKey],
    queryFn: () => fetchRows(listKey),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeRow(listKey, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["value-list", listKey] });
      setConfirmDeleteId(null);
    },
  });

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (confirmDeleteId) { setConfirmDeleteId(null); return; }
        if (form) { setForm(null); return; }
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmDeleteId, form, onClose]);

  function startAdd() {
    const blank = Object.fromEntries(meta.fields.map((f) => [f.key, ""]));
    setForm({ id: null, values: blank });
  }

  function startEdit(row: Row) {
    const vals = Object.fromEntries(
      meta.fields.map((f) => [f.key, String(row[f.key] ?? "")]),
    );
    setForm({ id: row.id, values: vals });
  }

  // Column headers = ID + all payload fields (without sortOrder/timestamps)
  const displayFields = meta.fields;

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
        className="fixed inset-x-4 top-[10%] z-50 mx-auto max-w-2xl rounded-xl border border-card-rim bg-card shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-card-rim px-5 py-4 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-ink dark:text-zinc-100">
            {t(`lists.${meta.titleKey}`)}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-fade hover:bg-cap hover:text-ink dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            aria-label={t("modal.close")}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex max-h-[70vh] flex-col overflow-hidden">
          <div className="overflow-y-auto p-5">
            {/* Add/Edit form */}
            {form && (
              <EditForm
                listKey={listKey}
                state={form}
                onClose={() => setForm(null)}
                onSaved={() => setForm(null)}
              />
            )}

            {/* Toolbar */}
            <div className="mb-3 flex items-center justify-between">
              <button
                onClick={startAdd}
                disabled={!!form}
                className="inline-flex items-center rounded-md bg-cta px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-cta-d disabled:opacity-40"
              >
                + {t("toolbar.add")}
              </button>
              {query.data && (
                <span className="text-xs text-fade dark:text-zinc-400">
                  {t("toolbar.count", { count: query.data.length })}
                </span>
              )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-md border border-card-rim dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-cap text-left text-xs font-medium uppercase tracking-wide text-ink dark:bg-zinc-800 dark:text-zinc-300">
                  <tr>
                    {displayFields.map((f) => (
                      <th key={f.key} className="px-4 py-2">
                        {t(`fields.${f.labelKey}`)}
                      </th>
                    ))}
                    <th className="w-28 px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-crease bg-white dark:divide-zinc-800 dark:bg-zinc-900">
                  {query.isLoading && (
                    <tr>
                      <td
                        colSpan={displayFields.length + 1}
                        className="px-4 py-6 text-center text-fade"
                      >
                        {t("table.loading")}
                      </td>
                    </tr>
                  )}
                  {query.isError && (
                    <tr>
                      <td
                        colSpan={displayFields.length + 1}
                        className="px-4 py-6 text-center text-red-600"
                      >
                        {t("table.error")}
                      </td>
                    </tr>
                  )}
                  {query.data?.length === 0 && (
                    <tr>
                      <td
                        colSpan={displayFields.length + 1}
                        className="px-4 py-6 text-center text-fade"
                      >
                        {t("table.empty")}
                      </td>
                    </tr>
                  )}
                  {query.data?.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-cta-pale dark:hover:bg-zinc-800/50"
                    >
                      {displayFields.map((f) => (
                        <td key={f.key} className="px-4 py-2 text-ink dark:text-zinc-300">
                          {String(row[f.key] ?? "")}
                        </td>
                      ))}
                      <td className="px-4 py-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(row)}
                            disabled={!!form}
                            className="rounded border border-wire bg-white px-2 py-0.5 text-xs text-ink hover:bg-canvas disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                          >
                            {t("table.edit")}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(row.id)}
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
              {t("confirm.deleteBody")}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => deleteMutation.mutate(confirmDeleteId)}
                disabled={deleteMutation.isPending}
                className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending
                  ? t("confirm.deleting")
                  : t("confirm.delete")}
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
    </>
  );
}
