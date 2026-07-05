"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RecencyBadge } from "@/components/recency-badge";

const PAGE_SIZE = 15;
const LS_KEY    = "ga40-col-person";
const MAX_OPT   = 4;
const DEFAULT_COLS: string[] = [];

type NaturalPersonListItem = {
  id:          string;
  code:        string;
  displayName: string;
  nickname:    string | null;
  importance:  string | null;
  relevance:   string | null;
  provenance:  string | null;
  createdAt:   string;
  updatedAt:   string;
};

type ListResponse = {
  items:  NaturalPersonListItem[];
  total:  number;
  limit:  number;
  offset: number;
};

async function fetchNaturalPersons(
  q: string,
  page: number,
): Promise<ListResponse> {
  const url = new URL("/api/people", window.location.origin);
  if (q) url.searchParams.set("q", q);
  url.searchParams.set("limit",  String(PAGE_SIZE));
  url.searchParams.set("offset", String(page * PAGE_SIZE));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

async function callBatchDelete(ids: string[]): Promise<void> {
  const res = await fetch("/api/people/batch-delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
}

function ConfirmDialog({
  title, body, yesLabel, noLabel, onYes, onNo, busy,
}: {
  title:    string;
  body:     string;
  yesLabel: string;
  noLabel:  string;
  onYes:    () => void;
  onNo:     () => void;
  busy:     boolean;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-sm rounded-lg bg-card p-6 shadow-xl dark:bg-zinc-900">
        <h3 id="confirm-title" className="text-base font-semibold text-ink dark:text-zinc-100">
          {title}
        </h3>
        <p className="mt-2 text-sm text-fade dark:text-zinc-400">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onNo}
            disabled={busy}
            className="inline-flex items-center rounded-md border border-wire bg-white px-4 py-2 text-sm font-medium text-ink shadow-sm hover:bg-canvas disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            {noLabel}
          </button>
          <button
            type="button"
            onClick={onYes}
            disabled={busy}
            className="inline-flex items-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
          >
            {yesLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function readStoredCols(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_COLS;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]) : DEFAULT_COLS;
  } catch {
    return DEFAULT_COLS;
  }
}

export function NaturalPersonListView() {
  const t     = useTranslations("naturalPerson");
  const tPag  = useTranslations("shared.pagination");
  const tBulk = useTranslations("shared.bulkDelete");
  const router = useRouter();
  const queryClient = useQueryClient();

  const [searchInput,     setSearchInput]     = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage,     setCurrentPage]     = useState(0);

  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(() => new Set());
  const [confirmOpen,  setConfirmOpen]  = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [deleteError,  setDeleteError]  = useState<string | null>(null);

  // Column picker — lazy initializer reads localStorage on the client; falls back
  // to DEFAULT_COLS during SSR (no window). Avoids a separate mount effect.
  const [visibleCols, setVisibleCols] = useState<string[]>(() =>
    typeof window !== "undefined" ? readStoredCols() : DEFAULT_COLS
  );
  const [showColPicker, setShowColPicker] = useState(false);
  const colPickerRef = useRef<HTMLDivElement>(null);

  // Close col picker on outside click
  useEffect(() => {
    if (!showColPicker) return;
    function handler(e: MouseEvent) {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) {
        setShowColPicker(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showColPicker]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setCurrentPage(0);
    }, 250);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const query = useQuery<ListResponse>({
    queryKey: ["people", "list", debouncedSearch, currentPage],
    queryFn:  () => fetchNaturalPersons(debouncedSearch, currentPage),
  });

  const total      = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const paginate   = total > PAGE_SIZE;
  const items      = query.data?.items ?? [];

  const pageKey = `${debouncedSearch}|${currentPage}`;
  const [prevPageKey, setPrevPageKey] = useState(pageKey);
  if (prevPageKey !== pageKey) {
    setPrevPageKey(pageKey);
    if (selectedIds.size > 0) setSelectedIds(new Set());
  }

  const allOnPageSelected  = items.length > 0 && items.every((it) => selectedIds.has(it.id));
  const someOnPageSelected = items.some((it) => selectedIds.has(it.id));

  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someOnPageSelected && !allOnPageSelected;
    }
  }, [someOnPageSelected, allOnPageSelected]);

  function toggleAllOnPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        for (const it of items) next.delete(it.id);
      } else {
        for (const it of items) next.add(it.id);
      }
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleConfirmDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await callBatchDelete(Array.from(selectedIds));
      await queryClient.invalidateQueries({ queryKey: ["people"] });
      await queryClient.invalidateQueries({ queryKey: ["persons"] });
      setSelectedIds(new Set());
      setConfirmOpen(false);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : tBulk("error"));
    } finally {
      setDeleting(false);
    }
  }

  function toggleCol(key: string) {
    setVisibleCols((prev) => {
      let next: string[];
      if (prev.includes(key)) {
        next = prev.filter((k) => k !== key);
      } else if (prev.length < MAX_OPT) {
        next = [...prev, key];
      } else {
        return prev;
      }
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      return next;
    });
  }

  // Optional column definitions (ordered)
  const optionalCols = [
    { key: "importance", label: t("table.importance") },
    { key: "relevance",  label: t("table.relevance") },
    { key: "provenance", label: t("table.provenance") },
  ];

  function cellValue(item: NaturalPersonListItem, key: string): React.ReactNode {
    switch (key) {
      case "importance": return item.importance ?? "";
      case "relevance":  return item.relevance  ?? "";
      case "provenance": return item.provenance ?? "";
      default:           return null;
    }
  }

  const colCount = 4 + visibleCols.length; // checkbox + code + name + nickname + optionals + open

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="w-64 rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm placeholder:text-fade focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
        />

        {/* Choose fields (only shown when there are optional cols available) */}
        {optionalCols.length > 0 && (
          <div ref={colPickerRef} className="relative">
            <button
              type="button"
              onClick={() => setShowColPicker((v) => !v)}
              aria-haspopup="true"
              aria-expanded={showColPicker}
              className="inline-flex items-center gap-1.5 rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm hover:bg-canvas dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            >
              <span className="text-fade">{t("chooseFields")}</span>
              <span className="font-mono text-xs text-fade">{visibleCols.length}/{MAX_OPT}</span>
            </button>
            {showColPicker && (
              <div className="absolute z-20 mt-1 left-0 w-52 rounded-md border border-wire bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900 p-3">
                <p className="mb-2 text-xs text-fade dark:text-zinc-500">
                  {t("chooseFieldsHint", { max: MAX_OPT })}
                </p>
                {optionalCols.map((col) => {
                  const checked  = visibleCols.includes(col.key);
                  const disabled = !checked && visibleCols.length >= MAX_OPT;
                  return (
                    <label key={col.key} className="flex items-center gap-2 py-0.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleCol(col.key)}
                        className="h-4 w-4 rounded border-wire accent-cta disabled:opacity-40"
                      />
                      <span className="text-sm text-ink dark:text-zinc-100">{col.label}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="inline-flex items-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700"
            >
              {tBulk("deleteSelected", { count: selectedIds.size })}
            </button>
          )}
          <Link
            href="/natural-persons/new"
            className="inline-flex items-center rounded-md bg-cta px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-cta-d"
          >
            {t("addNew")}
          </Link>
        </div>
      </div>

      {deleteError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {deleteError}
        </p>
      )}

      {/* Results table */}
      <div className="overflow-x-auto rounded-md border border-card-rim bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-sm">
          <thead className="bg-cap text-left text-xs font-medium uppercase tracking-wide text-ink dark:bg-zinc-800 dark:text-zinc-300">
            <tr>
              <th className="w-10 px-4 py-2">
                <input
                  ref={headerCheckboxRef}
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={toggleAllOnPage}
                  disabled={items.length === 0}
                  aria-label={tBulk("selectAll")}
                  className="h-4 w-4 rounded border-wire accent-cta"
                />
              </th>
              <th className="px-4 py-2">{t("table.code")}</th>
              <th className="px-4 py-2">{t("table.name")}</th>
              <th className="px-4 py-2">{t("table.nickname")}</th>
              {visibleCols.map((key) => (
                <th key={key} className="px-4 py-2">
                  {optionalCols.find((c) => c.key === key)?.label ?? key}
                </th>
              ))}
              <th className="px-4 py-2 w-24" />
            </tr>
          </thead>
          <tbody className="divide-y divide-crease dark:divide-zinc-800">
            {query.isLoading && (
              <tr>
                <td colSpan={colCount} className="px-4 py-6 text-center text-fade">
                  {t("loading")}
                </td>
              </tr>
            )}
            {query.isError && (
              <tr>
                <td colSpan={colCount} className="px-4 py-6 text-center text-red-600">
                  {t("error")}
                </td>
              </tr>
            )}
            {query.data && query.data.items.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-4 py-6 text-center text-fade">
                  {t("empty")}
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr
                key={item.id}
                onDoubleClick={() => router.push(`/natural-persons/${item.id}`)}
                className="whitespace-nowrap hover:bg-cta-pale dark:hover:bg-zinc-800/50 cursor-pointer"
              >
                <td className="px-4 py-2" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                  <span className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleOne(item.id)}
                      aria-label={item.displayName || item.code}
                      className="h-4 w-4 rounded border-wire accent-cta"
                    />
                    <RecencyBadge createdAt={item.createdAt} updatedAt={item.updatedAt} />
                  </span>
                </td>
                <td className="px-4 py-2 font-mono text-xs text-fade">
                  {item.code}
                </td>
                <td className="px-4 py-2 font-medium">
                  {item.displayName || (
                    <span className="text-fade italic">—</span>
                  )}
                </td>
                <td className="px-4 py-2 text-fade dark:text-zinc-400">
                  {item.nickname || <span className="italic">—</span>}
                </td>
                {visibleCols.map((key) => (
                  <td key={key} className="px-4 py-2 text-fade dark:text-zinc-400">
                    {cellValue(item, key)}
                  </td>
                ))}
                <td className="px-4 py-2">
                  <Link
                    href={`/natural-persons/${item.id}`}
                    className="inline-flex items-center rounded-md border border-wire bg-white px-3 py-1 text-xs font-medium text-ink shadow-sm hover:bg-canvas dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                  >
                    {t("open")}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Counts + pagination */}
      {query.data && (
        <div className="flex items-center justify-between text-sm text-fade">
          <span>
            {t("counts", {
              shown: Math.min(items.length + currentPage * PAGE_SIZE, total),
              total,
            })}
          </span>
          {paginate && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="rounded px-2 py-1 text-xs hover:bg-crease disabled:opacity-40"
              >
                {tPag("prev")}
              </button>
              <span className="px-2">
                {tPag("page", { current: currentPage + 1, total: totalPages })}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
                className="rounded px-2 py-1 text-xs hover:bg-crease disabled:opacity-40"
              >
                {tPag("next")}
              </button>
            </div>
          )}
        </div>
      )}

      {confirmOpen && (
        <ConfirmDialog
          title={tBulk("title", { count: selectedIds.size })}
          body={tBulk("body", { count: selectedIds.size })}
          yesLabel={tBulk("yes")}
          noLabel={tBulk("no")}
          onYes={handleConfirmDelete}
          onNo={() => { setConfirmOpen(false); setDeleteError(null); }}
          busy={deleting}
        />
      )}
    </div>
  );
}
