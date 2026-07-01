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
  body: Record<string, unknown>,
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

// Slice #19.02: values are unknown (string for text fields, boolean for
// checkboxes) so we can serialize booleans correctly in JSON.
type FormState = {
  id: string | null; // null = adding
  values: Record<string, unknown>;
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
  const [values, setValues] = useState<Record<string, unknown>>(state.values);
  const [error, setError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => saveRow(listKey, state.id, values),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["value-list", listKey] });
      // "document-types" is also fetched directly (bare key, no "value-list"
      // prefix) by several consumers elsewhere — the Document form's type
      // dropdown, the sidebar's dynamic Documents nav section, and the
      // Admin Import classify panels. Their cached results would otherwise
      // miss a just-added/edited/removed type until staleTime lapses or a
      // hard reload happens. Invalidate that key too so they refresh in step.
      if (listKey === "document-types") {
        qc.invalidateQueries({ queryKey: ["document-types"] });
      }
      // "property-types" is also fetched by the Property form's type dropdown.
      if (listKey === "property-types") {
        qc.invalidateQueries({ queryKey: ["property-types"] });
      }
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
        {meta.fields.map((f, i) => {
          // Slice #19.02: checkbox field
          if (f.type === "checkbox") {
            return (
              <label
                key={f.key}
                className="flex items-center gap-2 text-sm text-ink dark:text-zinc-300 cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={Boolean(values[f.key])}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [f.key]: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-wire accent-cta"
                />
                <span className="font-medium">{f.labelText ?? t(`fields.${f.labelKey}`)}</span>
              </label>
            );
          }

          // Text / textarea field
          return (
            <div
              key={f.key}
              className={`flex flex-col gap-1 ${f.multiline ? "w-full" : "min-w-48"}`}
            >
              <label className="text-xs font-medium text-ink dark:text-zinc-400">
                {f.labelText ?? t(`fields.${f.labelKey}`)}
                {f.required && <span className="ml-0.5 text-red-500">*</span>}
              </label>
              {f.multiline ? (
                <textarea
                  rows={3}
                  value={String(values[f.key] ?? "")}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [f.key]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    // Allow Enter inside textarea; only Escape closes
                    if (e.key === "Escape") onClose();
                  }}
                  className="rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 resize-y"
                />
              ) : (
                <input
                  ref={i === 0 ? firstInputRef : undefined}
                  type="text"
                  value={String(values[f.key] ?? "")}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [f.key]: e.target.value }))
                  }
                  onKeyDown={handleKey}
                  className="rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
                />
              )}
            </div>
          );
        })}
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
      // See matching comment in EditForm's mutation above.
      if (listKey === "document-types") {
        qc.invalidateQueries({ queryKey: ["document-types"] });
      }
      if (listKey === "property-types") {
        qc.invalidateQueries({ queryKey: ["property-types"] });
      }
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
    const blank: Record<string, unknown> = {};
    for (const f of meta.fields) {
      // Slice #19.02: checkbox fields start unchecked (false); text fields blank.
      blank[f.key] = f.type === "checkbox" ? false : "";
    }
    setForm({ id: null, values: blank });
  }

  function startEdit(row: Row) {
    const vals: Record<string, unknown> = {};
    for (const f of meta.fields) {
      if (f.type === "checkbox") {
        vals[f.key] = Boolean(row[f.key]);
      } else {
        vals[f.key] = String(row[f.key] ?? "");
      }
    }
    setForm({ id: row.id, values: vals });
  }

  // Slice #19.02: for property-types, surface a richer delete warning when
  // the type is referenced by existing properties. The list query already
  // includes a `usageCount` for property-types rows via a correlated subquery.
  const confirmDeleteRow = confirmDeleteId
    ? query.data?.find((r) => r.id === confirmDeleteId)
    : null;
  const deleteUsageCount =
    listKey === "property-types" && typeof confirmDeleteRow?.usageCount === "number"
      ? (confirmDeleteRow.usageCount as number)
      : 0;

  // Column headers — text fields only; checkbox fields appear inline in the
  // edit form but are shown as a ✓/– symbol in the row display.
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
                        {f.labelText ?? t(`fields.${f.labelKey}`)}
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
                        <td
                          key={f.key}
                          className={`px-4 py-2 text-ink dark:text-zinc-300 ${f.multiline ? "max-w-[240px] truncate" : ""}`}
                          title={f.multiline ? String(row[f.key] ?? "") : undefined}
                        >
                          {/* Slice #19.02: render checkboxes as ✓ / – symbols */}
                          {f.type === "checkbox"
                            ? (row[f.key] ? "✓" : "–")
                            : String(row[f.key] ?? "")}
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
              {/* Slice #19.02: richer warning when the property type is in use */}
              {deleteUsageCount > 0
                ? t("confirm.deletePropertyTypeUsed", { count: deleteUsageCount })
                : t("confirm.deleteBody")}
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
