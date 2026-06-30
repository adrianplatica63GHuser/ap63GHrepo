"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GroupsFilterDropdown } from "@/components/groups-filter-dropdown";
import { RecencyBadge } from "@/components/recency-badge";

const PAGE_SIZE = 15;

const ALL_PERSON_TYPES = ["NATURAL", "JUDICIAL"] as const;
type PersonType = (typeof ALL_PERSON_TYPES)[number];

// Builds the "?personTypes=" query string for a new set of checked types,
// mirroring the Documents ?documentTypeIds= semantics:
//   every type checked  → omit the param entirely (show all)
//   zero types checked  → "?personTypes=" (empty — show "select a type" message)
//   some types checked  → "?personTypes=NATURAL,JUDICIAL"
function buildPersonsUrl(checkedTypes: Set<string>): string {
  if (checkedTypes.size === ALL_PERSON_TYPES.length) return "/persons";
  return `/persons?personTypes=${Array.from(checkedTypes).join(",")}`;
}

function PersonTypeFilterDropdown({
  initialPersonTypes,
  label,
  allTypesLabel,
  typeLabels,
}: {
  initialPersonTypes?: string[];
  label: string;
  allTypesLabel: string;
  typeLabels: Record<PersonType, string>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const checkedTypes = new Set(
    initialPersonTypes === undefined ? ALL_PERSON_TYPES : initialPersonTypes,
  );
  const allChecked = checkedTypes.size === ALL_PERSON_TYPES.length;
  const someChecked = checkedTypes.size > 0 && !allChecked;

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
    const next = allChecked ? new Set<string>() : new Set<string>(ALL_PERSON_TYPES);
    router.push(buildPersonsUrl(next));
  }

  function handleToggleType(type: PersonType) {
    const next = new Set(checkedTypes);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    router.push(buildPersonsUrl(next));
  }

  const triggerText = allChecked
    ? allTypesLabel
    : `${checkedTypes.size}/${ALL_PERSON_TYPES.length}`;

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
        <div className="absolute z-20 mt-1 w-56 rounded-md border border-wire bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
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
          {ALL_PERSON_TYPES.map((type) => (
            <label
              key={type}
              className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-cta-pale dark:hover:bg-zinc-800/50"
            >
              <input
                type="checkbox"
                checked={checkedTypes.has(type)}
                onChange={() => handleToggleType(type)}
                className="h-4 w-4 rounded border-wire accent-cta"
              />
              {typeLabels[type]}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

type PersonListItem = {
  id:          string;
  code:        string;
  type:        PersonType;
  displayName: string;
  createdAt:   string;
  updatedAt:   string;
};

type ListResponse = {
  items:  PersonListItem[];
  total:  number;
  limit:  number;
  offset: number;
};

async function fetchPersons(
  q: string,
  personTypes: string[],
  page: number,
  groupCodes?: string[],
): Promise<ListResponse> {
  const url = new URL("/api/persons", window.location.origin);
  if (q)                  url.searchParams.set("q",           q);
  if (personTypes.length) url.searchParams.set("personTypes", personTypes.join(","));
  if (groupCodes !== undefined) url.searchParams.set("groupCodes", groupCodes.join(","));
  url.searchParams.set("limit",  String(PAGE_SIZE));
  url.searchParams.set("offset", String(page * PAGE_SIZE));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

async function fetchPersonGroupCodes(): Promise<string[]> {
  // Fetch PHYSICAL_PERSON + JUDICIAL_PERSON groups combined (one call, no targetType filter).
  const res = await fetch("/api/groups");
  if (!res.ok) return [];
  const body = await res.json();
  return ((body.items ?? []) as { code: string; targetType: string }[])
    .filter((g) => g.targetType === "PHYSICAL_PERSON" || g.targetType === "JUDICIAL_PERSON")
    .map((g) => g.code)
    .sort();
}

// Shared across Natural + Judicial — `person` is the common base table, so
// one soft-delete endpoint already handles both kinds.
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

// initialPersonTypes:
//   undefined → no ?personTypes param in URL → show both Natural + Judicial
//   []        → ?personTypes= (empty) in URL  → no types selected → show message
//   [...]     → ?personTypes=NATURAL,JUDICIAL → show only those types

export function PersonListView({
  initialPersonTypes,
}: {
  initialPersonTypes?: string[];
}) {
  const t     = useTranslations("person");
  const tPag  = useTranslations("shared.pagination");
  const tBulk = useTranslations("shared.bulkDelete");
  const router = useRouter();
  const queryClient = useQueryClient();

  const [searchInput,     setSearchInput]     = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage,     setCurrentPage]     = useState(0);

  // Slice #18.17: Groups filter (component state, server-side).
  const [groupCodesFilter, setGroupCodesFilter] = useState<string[] | undefined>(undefined);
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [confirmOpen,  setConfirmOpen]  = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [deleteError,  setDeleteError]  = useState<string | null>(null);

  // Fetch available person group codes for the dropdown (PHYSICAL_PERSON + JUDICIAL_PERSON).
  const { data: availableGroupCodes = [] } = useQuery<string[]>({
    queryKey: ["groups", "codes", "PERSON"],
    queryFn:  fetchPersonGroupCodes,
    staleTime: 5 * 60 * 1000,
  });

  const typeLabels: Record<PersonType, string> = {
    NATURAL:  t("typeNatural"),
    JUDICIAL: t("typeJudicial"),
  };

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setCurrentPage(0);
    }, 250);
    return () => clearTimeout(handle);
  }, [searchInput]);

  // When initialPersonTypes changes (dropdown selection), reset to page 0.
  const typeFiltersKey =
    initialPersonTypes === undefined ? "__all__" : initialPersonTypes.join(",");

  const [prevTypeFiltersKey, setPrevTypeFiltersKey] = useState(typeFiltersKey);
  if (prevTypeFiltersKey !== typeFiltersKey) {
    setPrevTypeFiltersKey(typeFiltersKey);
    setCurrentPage(0);
  }

  // When initialPersonTypes is an empty array, skip the API call and show a message.
  const noTypesSelected = initialPersonTypes !== undefined && initialPersonTypes.length === 0;

  // Reset page when group filter changes.
  const groupCodesKey =
    groupCodesFilter === undefined ? "__all__" : groupCodesFilter.join(",");
  const [prevGroupKey, setPrevGroupKey] = useState(groupCodesKey);
  if (prevGroupKey !== groupCodesKey) {
    setPrevGroupKey(groupCodesKey);
    setCurrentPage(0);
  }

  const query = useQuery<ListResponse>({
    queryKey: ["persons", "list", debouncedSearch, typeFiltersKey, currentPage, groupCodesKey],
    queryFn:  () => fetchPersons(debouncedSearch, initialPersonTypes ?? [], currentPage, groupCodesFilter),
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

  function detailHref(item: PersonListItem): string {
    return item.type === "JUDICIAL" ? `/judicial-persons/${item.id}` : `/natural-persons/${item.id}`;
  }

  async function handleConfirmDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await callBatchDelete(Array.from(selectedIds));
      await queryClient.invalidateQueries({ queryKey: ["persons"] });
      // Natural/Judicial list pages cache under their own query keys —
      // invalidate those too so they don't show stale rows if visited next.
      await queryClient.invalidateQueries({ queryKey: ["people"] });
      await queryClient.invalidateQueries({ queryKey: ["judicial-persons"] });
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
        <PersonTypeFilterDropdown
          initialPersonTypes={initialPersonTypes}
          label={t("typeFilterLabel")}
          allTypesLabel={t("allTypes")}
          typeLabels={typeLabels}
        />
        {availableGroupCodes.length > 0 && (
          <GroupsFilterDropdown
            availableCodes={availableGroupCodes}
            selectedCodes={groupCodesFilter}
            label={t("groupsFilterLabel")}
            allLabel={t("groupsFilterAll")}
            open={groupDropdownOpen}
            onOpenChange={setGroupDropdownOpen}
            onChange={(codes) => { setGroupCodesFilter(codes); setGroupDropdownOpen(false); }}
          />
        )}
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
            href="/natural-persons/new"
            className="inline-flex items-center rounded-md bg-cta px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-cta-d"
          >
            {t("addNewNatural")}
          </Link>
          <Link
            href="/judicial-persons/new"
            className="inline-flex items-center rounded-md bg-cta px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-cta-d"
          >
            {t("addNewJudicial")}
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
                  <th className="px-4 py-2">{t("table.name")}</th>
                  <th className="px-4 py-2">{t("table.type")}</th>
                  <th className="px-4 py-2 w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-crease dark:divide-zinc-800">
                {query.isLoading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-fade">
                      {t("loading")}
                    </td>
                  </tr>
                )}
                {query.isError && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-red-600">
                      {t("error")}
                    </td>
                  </tr>
                )}
                {query.data && query.data.items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-fade">
                      {t("empty")}
                    </td>
                  </tr>
                )}
                {items.map((item) => (
                  <tr
                    key={item.id}
                    onDoubleClick={() => router.push(detailHref(item))}
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
                      {typeLabels[item.type]}
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        href={detailHref(item)}
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
