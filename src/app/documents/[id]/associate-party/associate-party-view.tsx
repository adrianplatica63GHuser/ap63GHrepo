"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { PaginationControls } from "@/components/pagination-controls";

const PAGE_SIZE = 15;

type PersonSearchItem = {
  id:          string;
  code:        string;
  type:        "NATURAL" | "JUDICIAL";
  displayName: string;
};

type SearchResponse = { items: PersonSearchItem[]; total: number };

type Quality = "DEFUNCT" | "MOSTENITOR";

type Props = { documentId: string; documentName: string };

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function searchPersons(name: string, code: string, page: number): Promise<SearchResponse> {
  const params = new URLSearchParams();
  if (name.trim()) params.set("name", name.trim());
  if (code.trim()) params.set("code", code.trim());
  params.set("limit",  String(PAGE_SIZE));
  params.set("offset", String(page * PAGE_SIZE));
  const res = await fetch(`/api/people/search?${params.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return { items: data.items as PersonSearchItem[], total: data.total as number };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AssociatePartyView({ documentId, documentName }: Props) {
  const t           = useTranslations("document.associateParty");
  const router      = useRouter();
  const queryClient = useQueryClient();

  const [nameInput,   setNameInput]   = useState("");
  const [codeInput,   setCodeInput]   = useState("");
  const [page,        setPage]        = useState(0);
  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  const [quality,     setQuality]     = useState<Quality | null>(null);
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["person-search-party", nameInput, codeInput, page],
    queryFn:  () => searchPersons(nameInput, codeInput, page),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const canConfirm = selectedId !== null && quality !== null && !submitting;

  const handleConfirm = async () => {
    if (!selectedId || !quality) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}/persons`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ personIds: [selectedId], quality }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      await queryClient.invalidateQueries({ queryKey: ["document-persons", documentId] });
      router.push(`/documents/${encodeURIComponent(documentId)}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  const handleCancel = () =>
    router.push(`/documents/${encodeURIComponent(documentId)}`);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-fade dark:text-zinc-400">{documentName}</p>
      </header>

      {/* ── Search filters ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="w-16 shrink-0 font-medium text-ink dark:text-zinc-300">{t("labelName")}</span>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => { setNameInput(e.target.value); setPage(0); setSelectedId(null); }}
            placeholder={t("namePlaceholder")}
            className="w-48 rounded-md border border-wire bg-white px-2 py-1 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="w-16 shrink-0 font-medium text-ink dark:text-zinc-300">{t("labelCode")}</span>
          <input
            type="text"
            value={codeInput}
            onChange={(e) => { setCodeInput(e.target.value); setPage(0); setSelectedId(null); }}
            placeholder={t("codePlaceholder")}
            className="w-32 rounded-md border border-wire bg-white px-2 py-1 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
      </div>

      {/* ── Person list — single-select ─────────────────────────────────── */}
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
                <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400">{t("colName")}</th>
                <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400">{t("colType")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => setSelectedId(item.id === selectedId ? null : item.id)}
                  className={[
                    "cursor-pointer border-b border-card-rim last:border-0 dark:border-zinc-800",
                    item.id === selectedId
                      ? "bg-cta-pale dark:bg-cta/10"
                      : "hover:bg-canvas dark:hover:bg-zinc-800/50",
                  ].join(" ")}
                >
                  <td className="px-3 py-2">
                    <input
                      type="radio"
                      name="selected-party"
                      checked={item.id === selectedId}
                      onChange={() => setSelectedId(item.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="accent-cta"
                      aria-label={item.displayName}
                    />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-fade dark:text-zinc-400">{item.code}</td>
                  <td className="px-3 py-2 font-medium text-ink dark:text-zinc-100">{item.displayName}</td>
                  <td className="px-3 py-2 text-fade dark:text-zinc-400">
                    {item.type === "NATURAL" ? t("typeNatural") : t("typeJudicial")}
                  </td>
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

      {/* ── Quality selector ─────────────────────────────────────────────── */}
      <div className="rounded-md border border-card-rim bg-card p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="mb-3 text-sm font-medium text-ink dark:text-zinc-200">{t("qualityLabel")}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setQuality("DEFUNCT")}
            className={[
              "rounded-md border px-4 py-2 text-sm font-medium shadow-sm transition-colors",
              quality === "DEFUNCT"
                ? "border-red-500 bg-red-50 text-red-700 dark:border-red-400 dark:bg-red-900/20 dark:text-red-300"
                : "border-wire bg-white text-ink hover:bg-canvas dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800",
            ].join(" ")}
          >
            {t("qualityDefunct")}
          </button>
          <button
            type="button"
            onClick={() => setQuality("MOSTENITOR")}
            className={[
              "rounded-md border px-4 py-2 text-sm font-medium shadow-sm transition-colors",
              quality === "MOSTENITOR"
                ? "border-green-500 bg-green-50 text-green-700 dark:border-green-400 dark:bg-green-900/20 dark:text-green-300"
                : "border-wire bg-white text-ink hover:bg-canvas dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800",
            ].join(" ")}
          >
            {t("qualityMostenitor")}
          </button>
        </div>
      </div>

      {/* ── Validation hint + error ──────────────────────────────────────── */}
      {selectedId === null && !isLoading && items.length > 0 && (
        <p className="text-xs text-fade dark:text-zinc-500">{t("noSelection")}</p>
      )}
      {selectedId !== null && quality === null && (
        <p className="text-xs text-fade dark:text-zinc-500">{t("noQuality")}</p>
      )}
      {submitError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">{submitError}</p>
      )}

      {/* ── Action buttons ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 border-t border-crease pt-4 dark:border-zinc-800">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!canConfirm}
          className="inline-flex items-center rounded-md bg-cta px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-cta-d disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? t("confirming") : t("confirm")}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={submitting}
          className="inline-flex items-center rounded-md border border-wire bg-white px-5 py-2 text-sm font-medium text-ink shadow-sm hover:bg-canvas disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
