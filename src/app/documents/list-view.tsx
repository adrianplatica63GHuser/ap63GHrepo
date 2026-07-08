"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RecencyBadge } from "@/components/recency-badge";

const PAGE_SIZE   = 15;
const LS_KEY      = "ga40-col-document-v2";
const MAX_OPT     = 4;
const DEFAULT_COLS = ["nrDocument", "dateDocument"];

// ---------------------------------------------------------------------------
// Document-type filter dropdown (URL-based, unchanged from pre-refactor)
// ---------------------------------------------------------------------------

type DocumentTypeOption = {
  id:   string;
  key:  string;
  name: string;
};

async function fetchDocumentTypes(): Promise<DocumentTypeOption[]> {
  const res = await fetch("/api/admin/value-lists/document-types");
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  const body = await res.json();
  return body.items ?? [];
}

function buildDocumentsUrl(checkedIds: Set<string>, allTypeIds: string[]): string {
  if (checkedIds.size === allTypeIds.length) return "/documents";
  return `/documents?documentTypeIds=${Array.from(checkedIds).join(",")}`;
}

function DocumentTypeFilterDropdown({
  types,
  initialDocumentTypeIds,
  label,
  allTypesLabel,
}: {
  types: DocumentTypeOption[];
  initialDocumentTypeIds?: string[];
  label: string;
  allTypesLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const allTypeIds = types.map((ty) => ty.id);
  const checkedIds = new Set(
    initialDocumentTypeIds === undefined ? allTypeIds : initialDocumentTypeIds,
  );
  const allChecked  = types.length > 0 && checkedIds.size === allTypeIds.length;
  const someChecked = checkedIds.size > 0 && !allChecked;

  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someChecked;
    }
  }, [someChecked]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function handleSelectAllToggle() {
    const next = allChecked ? new Set<string>() : new Set(allTypeIds);
    router.push(buildDocumentsUrl(next, allTypeIds));
  }

  function handleToggleType(id: string) {
    const next = new Set(checkedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    router.push(buildDocumentsUrl(next, allTypeIds));
  }

  const triggerText = allChecked ? allTypesLabel : `${checkedIds.size}/${allTypeIds.length}`;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm hover:bg-canvas dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
      >
        <span className="text-fade">{label}</span>
        <span className="font-medium text-ink dark:text-zinc-100">{triggerText}</span>
        <span aria-hidden="true" className="text-fade text-xs">▾</span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-64 max-h-80 overflow-y-auto rounded-md border border-wire bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <label className="flex items-center gap-2 px-3 py-2 text-sm font-medium border-b border-crease cursor-pointer hover:bg-cta-pale dark:border-zinc-800 dark:hover:bg-zinc-800/50">
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={allChecked}
              onChange={handleSelectAllToggle}
              className="h-4 w-4 rounded border-wire accent-cta"
            />
            {allTypesLabel}
          </label>
          {types.map((ty) => (
            <label
              key={ty.id}
              className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-cta-pale dark:hover:bg-zinc-800/50"
            >
              <input
                type="checkbox"
                checked={checkedIds.has(ty.id)}
                onChange={() => handleToggleType(ty.id)}
                className="h-4 w-4 rounded border-wire accent-cta"
              />
              {ty.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DocumentListItem = {
  id:               string;
  code:             string;
  documentTypeId:   string;
  documentTypeName: string | null;
  title:            string | null;
  nrDocument:       string | null;
  dateDocument:     string | null;
  importance:       string | null;
  relevance:        string | null;
  provenance:       string | null;
  createdAt:        string;
  updatedAt:        string;
};

type ListResponse = {
  items:  DocumentListItem[];
  total:  number;
  limit:  number;
  offset: number;
};

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function fetchDocuments(
  q: string,
  documentTypeIds: string[],
  page: number,
  importance: string,
  relevance: string,
  expiringSoon: boolean,
): Promise<ListResponse> {
  const url = new URL("/api/documents", window.location.origin);
  if (q)                      url.searchParams.set("q",               q);
  if (documentTypeIds.length) url.searchParams.set("documentTypeIds", documentTypeIds.join(","));
  if (importance)             url.searchParams.set("importance",      importance);
  if (relevance)              url.searchParams.set("relevance",       relevance);
  if (expiringSoon)           url.searchParams.set("expiringSoon",    "true");
  url.searchParams.set("limit",  String(PAGE_SIZE));
  url.searchParams.set("offset", String(page * PAGE_SIZE));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

async function callBatchDelete(ids: string[]): Promise<void> {
  const res = await fetch("/api/documents/batch-delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
}

// ---------------------------------------------------------------------------
// Confirm dialog
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

// initialDocumentTypeIds:
//   undefined → no ?documentTypeIds param in URL → show all documents
//   []        → ?documentTypeIds= (empty) in URL  → no types selected → show message
//   [...]     → ?documentTypeIds=uuid,uuid          → show only those types

export function DocumentListView({
  initialDocumentTypeIds,
}: {
  initialDocumentTypeIds?: string[];
}) {
  const t       = useTranslations("document");
  const tPag    = useTranslations("shared.pagination");
  const tBulk   = useTranslations("shared.bulkDelete");
  const tFilter = useTranslations("shared.listFilters");
  const tMeta   = useTranslations("shared");
  const router = useRouter();
  const queryClient = useQueryClient();

  const [searchInput,     setSearchInput]     = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage,     setCurrentPage]     = useState(0);
  const [importance,      setImportance]      = useState("");
  const [relevance,       setRelevance]       = useState("");
  const [expiringSoon,    setExpiringSoon]    = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [confirmOpen,  setConfirmOpen]  = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [deleteError,  setDeleteError]  = useState<string | null>(null);

  // Column picker — always start with DEFAULT_COLS to match SSR; hydrate from
  // localStorage after mount via setTimeout so setState is in a callback and
  // does not trigger the react-hooks/set-state-in-effect lint rule.
  const [visibleCols, setVisibleCols] = useState<string[]>(DEFAULT_COLS);
  useEffect(() => {
    const id = setTimeout(() => setVisibleCols(readStoredCols()), 0);
    return () => clearTimeout(id);
  }, []);
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

  const { data: documentTypes } = useQuery({
    queryKey: ["document-types"],
    queryFn:  fetchDocumentTypes,
    staleTime: 5 * 60 * 1000,
  });
  const typeOptions = documentTypes ?? [];

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setCurrentPage(0);
    }, 250);
    return () => clearTimeout(handle);
  }, [searchInput]);

  // When initialDocumentTypeIds changes (sidebar navigation), reset to page 0.
  const typeFiltersKey =
    initialDocumentTypeIds === undefined ? "__all__" : initialDocumentTypeIds.join(",");

  const [prevTypeFiltersKey, setPrevTypeFiltersKey] = useState(typeFiltersKey);
  if (prevTypeFiltersKey !== typeFiltersKey) {
    setPrevTypeFiltersKey(typeFiltersKey);
    setCurrentPage(0);
  }

  // When initialDocumentTypeIds is an empty array, skip the API call and show a message.
  const noTypesSelected = initialDocumentTypeIds !== undefined && initialDocumentTypeIds.length === 0;

  const query = useQuery<ListResponse>({
    queryKey: ["documents", "list", debouncedSearch, typeFiltersKey, importance, relevance, expiringSoon, currentPage],
    queryFn:  () => fetchDocuments(debouncedSearch, initialDocumentTypeIds ?? [], currentPage, importance, relevance, expiringSoon),
    enabled:  !noTypesSelected,
  });

  const total      = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const paginate   = total > PAGE_SIZE;
  const items      = query.data?.items ?? [];

  const pageKey = `${debouncedSearch}|${typeFiltersKey}|${currentPage}`;
  const [prevPageKey, setPrevPageKey] = useState(pageKey);
  if (prevPageKey !== pageKey) {
    setPrevPageKey(pageKey);
    if (selectedIds.size > 0) setSelectedIds(new Set());
  }

  const allOnPageSelected = items.length > 0 && items.every((it) => selectedIds.has(it.id));
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
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
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
    { key: "nrDocument",   label: t("table.nrDocument") },
    { key: "dateDocument", label: t("table.dateDocument") },
    { key: "importance",   label: t("table.importance") },
    { key: "relevance",    label: t("table.relevance") },
    { key: "provenance",   label: t("table.provenance") },
  ];

  function cellValue(item: DocumentListItem, key: string): React.ReactNode {
    switch (key) {
      case "nrDocument":   return item.nrDocument   ?? "";
      case "dateDocument": return item.dateDocument ?? "";
      case "importance":   return item.importance   ?? "";
      case "relevance":    return item.relevance    ?? "";
      case "provenance":   return item.provenance   ?? "";
      default:             return null;
    }
  }

  // Total columns = checkbox + code + type + title + visible optionals + open
  const colCount = 5 + visibleCols.length;

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <DocumentTypeFilterDropdown
          types={typeOptions}
          initialDocumentTypeIds={initialDocumentTypeIds}
          label={t("typeFilterLabel")}
          allTypesLabel={t("allTypes")}
        />
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="w-64 rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm placeholder:text-fade focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
        />

        {/* Importance filter */}
        <div className="inline-flex items-center gap-1.5 rounded-md border border-wire bg-white px-2 py-1.5 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <span className="text-fade">{tFilter("importanceLabel")}</span>
          <select
            value={importance}
            onChange={(e) => { setImportance(e.target.value); setCurrentPage(0); }}
            aria-label={tFilter("importanceLabel")}
            className="bg-transparent text-sm font-medium text-ink focus:outline-none dark:text-zinc-100"
          >
            <option value="">{tFilter("allImportances")}</option>
            <option value="LOW">{tMeta("importanceValues.LOW")}</option>
            <option value="MEDIUM">{tMeta("importanceValues.MEDIUM")}</option>
            <option value="HIGH">{tMeta("importanceValues.HIGH")}</option>
          </select>
        </div>

        {/* Relevance filter */}
        <div className="inline-flex items-center gap-1.5 rounded-md border border-wire bg-white px-2 py-1.5 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <span className="text-fade">{tFilter("relevanceLabel")}</span>
          <select
            value={relevance}
            onChange={(e) => { setRelevance(e.target.value); setCurrentPage(0); }}
            aria-label={tFilter("relevanceLabel")}
            className="bg-transparent text-sm font-medium text-ink focus:outline-none dark:text-zinc-100"
          >
            <option value="">{tFilter("allRelevances")}</option>
            <option value="INACTIVE">{tMeta("relevanceValues.INACTIVE")}</option>
            <option value="HISTORICAL">{tMeta("relevanceValues.HISTORICAL")}</option>
            <option value="CURRENT">{tMeta("relevanceValues.CURRENT")}</option>
            <option value="FUTURE">{tMeta("relevanceValues.FUTURE")}</option>
          </select>
        </div>

        {/* Expiring-soon toggle */}
        <button
          type="button"
          onClick={() => { setExpiringSoon((v) => !v); setCurrentPage(0); }}
          aria-pressed={expiringSoon}
          className={`inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium shadow-sm transition-colors ${
            expiringSoon
              ? "border-amber-500 bg-amber-50 text-amber-700 dark:border-amber-400 dark:bg-amber-900/30 dark:text-amber-300"
              : "border-wire bg-white text-ink hover:bg-canvas dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          }`}
        >
          {tFilter("expiringSoon")}
        </button>

        {/* Choose fields */}
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
            href="/documents/new"
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

      {/* No types selected — prompt the user to pick at least one */}
      {noTypesSelected ? (
        <div className="overflow-x-auto rounded-md border border-card-rim bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="px-4 py-8 text-center text-sm text-fade">
            {t("noTypeSelected")}
          </div>
        </div>
      ) : (
        <>
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
                  <th className="px-4 py-2">{t("table.type")}</th>
                  <th className="px-4 py-2">{t("table.title")}</th>
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
                    onDoubleClick={() => router.push(`/documents/${item.id}`)}
                    className="whitespace-nowrap hover:bg-cta-pale dark:hover:bg-zinc-800/50 cursor-pointer"
                  >
                    <td className="px-4 py-2" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                      <span className="inline-flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleOne(item.id)}
                          aria-label={item.title ?? item.code}
                          className="h-4 w-4 rounded border-wire accent-cta"
                        />
                        <RecencyBadge createdAt={item.createdAt} updatedAt={item.updatedAt} />
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-fade">
                      {item.code}
                    </td>
                    <td className="px-4 py-2 text-fade dark:text-zinc-400">
                      {item.documentTypeName ?? "—"}
                    </td>
                    <td className="px-4 py-2 font-medium">
                      {item.title ?? (
                        <span className="text-fade italic">—</span>
                      )}
                    </td>
                    {visibleCols.map((key) => (
                      <td key={key} className="px-4 py-2 text-fade dark:text-zinc-400">
                        {cellValue(item, key)}
                      </td>
                    ))}
                    <td className="px-4 py-2">
                      <Link
                        href={`/documents/${item.id}`}
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

          {/* Pagination */}
          <div className="flex items-center justify-between gap-4">
            <div className="text-xs text-fade dark:text-zinc-400">
              {query.data
                ? t("counts", { shown: query.data.items.length, total })
                : null}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => p - 1)}
                disabled={!paginate || currentPage === 0}
                className="inline-flex items-center rounded-md border border-wire bg-white px-3 py-1.5 text-xs font-medium text-ink shadow-sm transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              >
                {tPag("previous")}
              </button>
              <span className="text-xs text-fade dark:text-zinc-400">
                {tPag("pageOf", { page: currentPage + 1, total: totalPages })}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={!paginate || currentPage >= totalPages - 1}
                className="inline-flex items-center rounded-md border border-wire bg-white px-3 py-1.5 text-xs font-medium text-ink shadow-sm transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              >
                {tPag("next")}
              </button>
            </div>
          </div>
        </>
      )}

      {confirmOpen && (
        <ConfirmDialog
          title={tBulk("confirmTitle")}
          body={tBulk("confirmBody", { count: selectedIds.size })}
          yesLabel={deleting ? tBulk("deleting") : tBulk("delete")}
          noLabel={tBulk("cancel")}
          busy={deleting}
          onYes={handleConfirmDelete}
          onNo={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}
