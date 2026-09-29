"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { PaginationControls } from "@/components/pagination-controls";
import { buttonClass } from "@/lib/ui/button-styles";
import { FixedColumns, TABLE_FRAME, columnHead, fixedTable } from "@/components/table/fixed-columns";
import { LABEL_STYLE, SCREEN_COLUMN, SCREEN_COLUMN_STYLE, screenBox, type ColumnName } from "@/lib/ui/field-widths";

/** The results table, at #37.16's column widths (Slice #37.22). */
const COLUMNS: readonly ColumnName[] = ["select", "code", "documentType", "documentTitle"];

const PAGE_SIZE = 15;

type DocumentSearchItem = { id: string; code: string; typeName: string | null; title: string | null };
type SearchResponse = { items: DocumentSearchItem[]; total: number };

type Props = { propertyId: string; propertyName: string };

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

export function AssociateDocumentView({ propertyId, propertyName }: Props) {
  const t           = useTranslations("property.associateDocument");
  const router      = useRouter();
  const queryClient = useQueryClient();

  const [qInput,      setQInput]      = useState("");
  const [page,        setPage]        = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["document-search", qInput, page],
    queryFn:  () => searchDocuments(qInput, page),
  });

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
      const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/documents`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ documentIds: Array.from(selectedIds) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      await queryClient.invalidateQueries({ queryKey: ["property-documents", propertyId] });
      router.push(`/properties/${encodeURIComponent(propertyId)}?tab=document`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  const handleCancel = () => router.push(`/properties/${encodeURIComponent(propertyId)}?tab=document`);

  return (
    <div className={`${SCREEN_COLUMN} gap-6`} style={SCREEN_COLUMN_STYLE}>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-fade dark:text-zinc-400">{propertyName}</p>
      </header>

      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span style={LABEL_STYLE} className="shrink-0 font-medium text-ink dark:text-zinc-300">{t("labelSearch")}</span>
          <input {...screenBox("searchText")}
            type="text"
            value={qInput}
            onChange={(e) => { setQInput(e.target.value); setPage(0); setSelectedIds(new Set()); }}
            placeholder={t("searchPlaceholder")}
            className="rounded-md border border-wire bg-white px-2 py-1 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
      </div>

      <div className={`${TABLE_FRAME} rounded-md border border-card-rim bg-card shadow-sm dark:border-zinc-800 dark:bg-zinc-900`}>
        {isLoading ? (
          <p className="px-4 py-6 text-sm text-fade dark:text-zinc-400">{t("loading")}</p>
        ) : isError ? (
          <p className="px-4 py-6 text-sm text-red-600 dark:text-red-400">{t("error")}</p>
        ) : items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-fade dark:text-zinc-400">{t("resultsEmpty")}</p>
        ) : (
          <table {...fixedTable(COLUMNS)}>
            <FixedColumns columns={COLUMNS} />
            <thead>
              <tr className="border-b border-card-rim dark:border-zinc-800">
                <th className="px-3 py-2" aria-label="select" {...columnHead("select")} />
                <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400" {...columnHead("code")}>{t("colCode")}</th>
                <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400" {...columnHead("documentType")}>{t("colType")}</th>
                <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400" {...columnHead("documentTitle")}>{t("colTitle")}</th>
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
                  <td className="px-3 py-2 break-words text-fade dark:text-zinc-400">{item.typeName ?? "—"}</td>
                  <td className="px-3 py-2 break-words text-ink dark:text-zinc-100">{item.title ?? "—"}</td>
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

      {submitError && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{submitError}</p>}

      <div className="flex items-center gap-3 border-t border-crease pt-4 dark:border-zinc-800">
        <button type="button" onClick={handleAssociate} disabled={submitting || selectedIds.size === 0}
          className={buttonClass({ variant: "primary", size: "lg" })}>
          {submitting ? t("associating") : t("associate")}
        </button>
        <button type="button" onClick={handleCancel} disabled={submitting}
          className={buttonClass({ variant: "secondary", size: "lg" })}>
          {t("cancel")}
        </button>
        {selectedIds.size === 0 && !isLoading && items.length > 0 && (
          <span className="text-xs text-fade dark:text-zinc-500">{t("noSelection")}</span>
        )}
      </div>
    </div>
  );
}
