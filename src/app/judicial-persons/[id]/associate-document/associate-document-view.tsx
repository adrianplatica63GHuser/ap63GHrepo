"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { PaginationControls } from "@/components/pagination-controls";

const PAGE_SIZE = 15;

type DocumentSearchItem = { id: string; code: string; typeName: string | null; title: string | null };
type SearchResponse = { items: DocumentSearchItem[]; total: number };
type RoleItem = { id: string; name: string };

type Props = { personId: string; personName: string; backBase: string };

async function searchDocuments(q: string, page: number): Promise<SearchResponse> {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  params.set("limit",  String(PAGE_SIZE));
  params.set("offset", String(page * PAGE_SIZE));
  const res = await fetch(`/api/documents/search?${params.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return { items: data.items as DocumentSearchItem[], total: data.total as number };
}

async function fetchValidRoles(documentId: string): Promise<RoleItem[]> {
  const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}/valid-person-roles`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.items as RoleItem[];
}

async function fetchDistinctRoles(): Promise<RoleItem[]> {
  const res = await fetch("/api/admin/doc-type-person-roles/distinct-roles");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.items as RoleItem[];
}

export function AssociateDocumentView({ personId, personName, backBase }: Props) {
  const t           = useTranslations("shared.associateDocument");
  const router      = useRouter();
  const queryClient = useQueryClient();

  const [qInput,         setQInput]         = useState("");
  const [page,           setPage]           = useState(0);
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set());
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [submitting,     setSubmitting]     = useState(false);
  const [submitError,    setSubmitError]    = useState<string | null>(null);

  // Derived: the single selected document ID, or null when 0 or 2+ are selected.
  const singleSelectedId = selectedIds.size === 1 ? Array.from(selectedIds)[0] : null;

  // Reset the role picker whenever the single-selection changes.
  // Uses "derived state during render" to avoid react-hooks/set-state-in-effect.
  const [prevSingleSelectedId, setPrevSingleSelectedId] = useState<string | null>(null);
  if (prevSingleSelectedId !== singleSelectedId) {
    setPrevSingleSelectedId(singleSelectedId);
    setSelectedRoleId("");
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ["document-search", qInput, page],
    queryFn:  () => searchDocuments(qInput, page),
  });

  // When exactly one document is selected, fetch roles specific to its type.
  const { data: singleDocRoles } = useQuery({
    queryKey: ["document-valid-roles", singleSelectedId],
    queryFn:  () => fetchValidRoles(singleSelectedId!),
    enabled:  singleSelectedId !== null,
  });

  // Always keep the full curated list ready for the 0-or-many case.
  const { data: allDocRoles } = useQuery({
    queryKey: ["doc-distinct-roles"],
    queryFn:  fetchDistinctRoles,
  });

  // Active role list: filtered by document type (single) or full list (multi).
  const roles: RoleItem[] = singleSelectedId !== null
    ? (singleDocRoles ?? [])
    : (allDocRoles ?? []);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleAssociate = async () => {
    if (selectedIds.size === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/people/${encodeURIComponent(personId)}/documents`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          documentIds:  Array.from(selectedIds),
          personRoleId: selectedRoleId || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      await queryClient.invalidateQueries({ queryKey: ["person-documents", personId] });
      router.push(`${backBase}/${encodeURIComponent(personId)}?tab=document`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  const handleCancel = () =>
    router.push(`${backBase}/${encodeURIComponent(personId)}?tab=document`);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-fade dark:text-zinc-400">{personName}</p>
      </header>

      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="w-16 shrink-0 font-medium text-ink dark:text-zinc-300">{t("labelSearch")}</span>
          <input
            type="text"
            value={qInput}
            onChange={(e) => { setQInput(e.target.value); setPage(0); setSelectedIds(new Set()); }}
            placeholder={t("searchPlaceholder")}
            className="w-64 rounded-md border border-wire bg-white px-2 py-1 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
      </div>

      <div className="rounded-md border border-card-rim bg-card shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {isLoading ? (
          <p className="px-4 py-6 text-sm text-fade dark:text-zinc-400">{t("loading")}</p>
        ) : isError ? (
          <p className="px-4 py-6 text-sm text-red-600 dark:text-red-400">{t("error")}</p>
        ) : items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-fade dark:text-zinc-400">{t("resultsEmpty")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-rim dark:border-zinc-800">
                <th className="w-8 px-3 py-2" aria-label="select" />
                <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400">{t("colCode")}</th>
                <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400">{t("colType")}</th>
                <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400">{t("colTitle")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => toggle(item.id)}
                  className={[
                    "cursor-pointer border-b border-card-rim last:border-0 dark:border-zinc-800",
                    selectedIds.has(item.id) ? "bg-cta-pale dark:bg-cta/10" : "hover:bg-canvas dark:hover:bg-zinc-800/50",
                  ].join(" ")}
                >
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggle(item.id)}
                      onClick={(e) => e.stopPropagation()} className="accent-cta" aria-label={item.title ?? item.code} />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-fade dark:text-zinc-400">{item.code}</td>
                  <td className="px-3 py-2 text-fade dark:text-zinc-400">{item.typeName ?? "—"}</td>
                  <td className="px-3 py-2 text-ink dark:text-zinc-100">{item.title ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <PaginationControls
        page={page} total={total} pageSize={PAGE_SIZE}
        onPrev={() => setPage((p) => p - 1)}
        onNext={() => setPage((p) => p + 1)}
      />

      {/* Role dropdown — filtered by document type when one doc selected; full list otherwise */}
      {roles.length > 0 && (
        <label className="flex items-center gap-2 text-sm">
          <span className="w-16 shrink-0 font-medium text-ink dark:text-zinc-300">{t("labelRole")}</span>
          <select
            value={selectedRoleId}
            onChange={(e) => setSelectedRoleId(e.target.value)}
            className="rounded-md border border-wire bg-white px-2 py-1 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          >
            <option value="">{t("rolePlaceholder")}</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </label>
      )}

      {submitError && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{submitError}</p>}

      <div className="flex items-center gap-3 border-t border-crease pt-4 dark:border-zinc-800">
        <button type="button" onClick={handleAssociate} disabled={submitting || selectedIds.size === 0}
          className="inline-flex items-center rounded-md bg-cta px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-cta-d disabled:cursor-not-allowed disabled:opacity-50">
          {submitting ? t("associating") : t("associate")}
        </button>
        <button type="button" onClick={handleCancel} disabled={submitting}
          className="inline-flex items-center rounded-md border border-wire bg-white px-5 py-2 text-sm font-medium text-ink shadow-sm hover:bg-canvas disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800">
          {t("cancel")}
        </button>
        {selectedIds.size === 0 && !isLoading && items.length > 0 && (
          <span className="text-xs text-fade dark:text-zinc-500">{t("noSelection")}</span>
        )}
      </div>
    <