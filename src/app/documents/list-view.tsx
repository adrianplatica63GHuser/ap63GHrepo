"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RecencyBadge } from "@/components/recency-badge";

const PAGE_SIZE = 15;

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

// Builds the "?documentTypeIds=" query string for a new set of checked type
// ids, mirroring the semantics DocumentListView already expects:
//   every type checked  → omit the param entirely (show all)
//   zero types checked  → "?documentTypeIds=" (empty — show "select a type" message)
//   some types checked  → "?documentTypeIds=uuid,uuid,..."
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
  const allChecked = types.length > 0 && checkedIds.size === allTypeIds.length;
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

type DocumentListItem = {
  id:               string;
  code:             string;
  documentTypeId:   string;
  documentTypeName: string | null;
  title:            string | null;
  nrDocument:       string | null;
  dateDocument:     string | null;
  institution:      string | null;
  createdAt:        string;
  updatedAt:        string;
};

type ListResponse = {
  items:  DocumentListItem[];
  total:  number;
  limit:  number;
  offset: number;
};

async function fetchDocuments(q: string, documentTypeIds: string[], page: number): Promise<ListResponse> {
  const url = new URL("/api/documents", window.location.origin);
  if (q)                    url.searchParams.set("q",               q);
  if (documentTypeIds.length) url.searchParams.set("documentTypeIds", documentTypeIds.join(","));
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

// initialDocumentTypeIds:
//   undefined → no ?documentTypeIds param in URL → show all documents
//   []        → ?documentTypeIds= (empty) in URL  → no types selected → show message
//   [...]     → ?documentTypeIds=uuid,uuid          → show only those types

export function DocumentListView({
  initialDocumentTypeIds,
}: {
  initialDocumentTypeIds?: string[];
}) {
  const t    = useTranslations("document");
  const tPag = useTranslations("shared.pagination");
  const tBulk = useTranslations("shared.bulkDelete");
  const router = useRouter();
  const queryClient = useQueryClient();

  const [searchInput,     setSearchInput]     = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage,     setCurrentPage]     = useState(0);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [confirmOpen,  setConfirmOpen]  = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [deleteError,  setDeleteError]  = useState<string | null>(null);

  const { data: documentTypes } = useQuery({
    queryKey: ["document-types"],
    queryFn:  fetchDocumentTypes,
    staleTime: 5 * 60 * 1000,
  });
  const typeOptions = documentTypes ?? [];

  // typeFilters is derived directly from initialDocumentTypeIds (the URL
  // ?documentTypeIds= param). The dropdown's checkboxes change the URL →
  // page.tsx re-renders with new initialDocumentTypeIds → this component
  // re-renders with the correct value. No local state copy is needed —
  // using initialDocumentTypeIds directly avoids the synchronous
  // setState-in-effect pattern flagged by react-hooks/set-state-in-effect.

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
    queryKey: ["documents", "list", debouncedSearch, typeFiltersKey, currentPage],
    queryFn:  () => fetchDocuments(debouncedSearch, initialDocumentTypeIds ?? [], currentPage),
    enabled:  !noTypesSelected,
  });

  const total      = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const paginate   = total > PAGE_SIZE;
  const items      = query.data?.items ?? [];

  // Derived-state-during-render reset: clear the selection whenever the
  // visible page changes (search, type filters, or page number) instead of
  // carrying stale ids over to a different set of rows. Avoids
  // react-hooks/set-state-in-effect.
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
          className="flex-1 min-w-48 max-w-md rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm placeholder:text-fade focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
        />
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
        /* Results table */
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
                  <th className="px-4 py-2">{t("table.nrDocument")}</th>
                  <th className="px-4 py-2">{t("table.dateDocument")}</th>
                  <th className="px-4 py-2 w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-crease dark:divide-zinc-800">
                {query.isLoading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-fade">
                      {t("loading")}
                    </td>
                  </tr>
                )}
                {query.isError && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-red-600">
                      {t("error")}
                    </td>
                  </tr>
                )}
                {query.data && query.data.items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-fade">
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
                    <td className="px-4 py-2 text-fade dark:text-zinc-400">
                      {item.nrDocument ?? ""}
                    </td>
                    <td className="px-4 py-2 text-fade dark:text-zinc-400">
                      {item.dateDocument ?? ""}
                    </td>
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
