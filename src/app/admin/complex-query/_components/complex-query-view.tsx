"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { QueryResultItem } from "@/app/api/admin/metadata-query/route";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const IMPORTANCE_VALUES  = ["LOW", "MEDIUM", "HIGH"] as const;
const RELEVANCE_VALUES   = ["INACTIVE", "HISTORICAL", "CURRENT", "FUTURE"] as const;
const PROVENANCE_VALUES  = [
  "TEXT_FILE",
  "ALGORITHM",
  "SCAN_OCR",
  "MANUAL_ENTRY",
  "EXTERNAL_DB",
  "OTHER",
] as const;
const ENTITY_TYPES       = ["PERSON", "PROPERTY", "DOCUMENT"] as const;
const PERSON_SUBTYPES    = ["NATURAL", "JUDICIAL"] as const;

// ---------------------------------------------------------------------------
// Filter state type
// ---------------------------------------------------------------------------

type Filters = {
  entityType:    string;
  personSubtype: string;  // NATURAL | JUDICIAL | "" = both (only used when entityType=PERSON or "")
  importance:    string;
  relevance:     string;
  provenance:    string;
  groupCode:     string;
  stampCode:     string;
  tag:           string;
  search:        string;
  updatedFrom:   string;
  updatedTo:     string;
  hasMetadata:   string;
};

const EMPTY_FILTERS: Filters = {
  entityType:    "",
  personSubtype: "",
  importance:    "",
  relevance:     "",
  provenance:    "",
  groupCode:     "",
  stampCode:     "",
  tag:           "",
  search:        "",
  updatedFrom:   "",
  updatedTo:     "",
  hasMetadata:   "",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function entityHref(row: QueryResultItem): string {
  if (row.entityType === "PERSON") {
    const base = row.personType === "JUDICIAL" ? "/judicial-persons" : "/natural-persons";
    return `${base}/${row.entityId}`;
  }
  if (row.entityType === "PROPERTY") return `/properties/${row.entityId}`;
  if (row.entityType === "DOCUMENT") return `/documents/${row.entityId}`;
  return "#";
}

function badgeClass(type: string): string {
  if (type === "PERSON")   return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
  if (type === "PROPERTY") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
  if (type === "DOCUMENT") return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
  return "bg-zinc-100 text-zinc-800";
}

function personTypeBadge(personType: string | null) {
  if (!personType) return null;
  const cls = personType === "JUDICIAL"
    ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
    : "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300";
  const label = personType === "JUDICIAL" ? "Juridic" : "Fizic";
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function importanceBadge(v: string | null) {
  if (!v) return null;
  const cls =
    v === "HIGH"   ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" :
    v === "MEDIUM" ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" :
                     "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
  return <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}>{v}</span>;
}

function relevanceBadge(v: string | null) {
  if (!v) return null;
  const cls =
    v === "CURRENT"    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" :
    v === "FUTURE"     ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" :
    v === "HISTORICAL" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" :
                         "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400";
  return <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}>{v}</span>;
}

/** Build a URLSearchParams from the active non-empty filter values. */
function filtersToParams(f: Filters): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(f)) {
    if (value) params.set(key, value);
  }
  return params;
}

// ---------------------------------------------------------------------------
// Filter form
// ---------------------------------------------------------------------------

type FilterFormProps = {
  filters:  Filters;
  onChange: (f: Filters) => void;
  onSearch: () => void;
  onReset:  () => void;
  loading:  boolean;
};

function FilterForm({ filters, onChange, onSearch, onReset, loading }: FilterFormProps) {
  const t = useTranslations("complexQuery");
  const set = (key: keyof Filters) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onChange({ ...filters, [key]: e.target.value });

  // Person subtype is only meaningful when entityType is PERSON (or empty = all,
  // but we only send it when it has a value so it still gets filtered server-side).
  const showPersonSubtype =
    filters.entityType === "" || filters.entityType === "PERSON";

  return (
    <form
      className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
      onSubmit={(e) => { e.preventDefault(); onSearch(); }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">

        {/* Entity type */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("filters.entityType")}</label>
          <select
            className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            value={filters.entityType}
            onChange={(e) => {
              // Clear personSubtype when switching away from PERSON
              const next = e.target.value;
              onChange({
                ...filters,
                entityType:    next,
                personSubtype: next !== "PERSON" ? "" : filters.personSubtype,
              });
            }}
          >
            <option value="">{t("filters.any")}</option>
            {ENTITY_TYPES.map((v) => (
              <option key={v} value={v}>{t(`entityTypes.${v}`)}</option>
            ))}
          </select>
        </div>

        {/* Person subtype — shown when entity type is PERSON or "any" */}
        {showPersonSubtype && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("filters.personSubtype")}</label>
            <select
              className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
              value={filters.personSubtype}
              onChange={set("personSubtype")}
            >
              <option value="">{t("filters.any")}</option>
              {PERSON_SUBTYPES.map((v) => (
                <option key={v} value={v}>{t(`personSubtypeValues.${v}`)}</option>
              ))}
            </select>
          </div>
        )}

        {/* Search */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("filters.search")}</label>
          <input
            type="text"
            className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            placeholder={t("filters.searchPlaceholder")}
            value={filters.search}
            onChange={set("search")}
          />
        </div>

        {/* Group code */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("filters.groupCode")}</label>
          <input
            type="text"
            className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm font-mono uppercase dark:border-zinc-600 dark:bg-zinc-800"
            placeholder={t("filters.groupCodePlaceholder")}
            value={filters.groupCode}
            onChange={set("groupCode")}
          />
        </div>

        {/* Stamp code */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("filters.stampCode")}</label>
          <input
            type="text"
            className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm font-mono uppercase dark:border-zinc-600 dark:bg-zinc-800"
            placeholder={t("filters.stampCodePlaceholder")}
            value={filters.stampCode}
            onChange={set("stampCode")}
          />
        </div>

        {/* Importance */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("filters.importance")}</label>
          <select
            className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            value={filters.importance}
            onChange={set("importance")}
          >
            <option value="">{t("filters.any")}</option>
            {IMPORTANCE_VALUES.map((v) => (
              <option key={v} value={v}>{t(`importanceValues.${v}`)}</option>
            ))}
          </select>
        </div>

        {/* Relevance */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("filters.relevance")}</label>
          <select
            className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            value={filters.relevance}
            onChange={set("relevance")}
          >
            <option value="">{t("filters.any")}</option>
            {RELEVANCE_VALUES.map((v) => (
              <option key={v} value={v}>{t(`relevanceValues.${v}`)}</option>
            ))}
          </select>
        </div>

        {/* Provenance */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("filters.provenance")}</label>
          <select
            className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            value={filters.provenance}
            onChange={set("provenance")}
          >
            <option value="">{t("filters.any")}</option>
            {PROVENANCE_VALUES.map((v) => (
              <option key={v} value={v}>{t(`provenanceValues.${v}`)}</option>
            ))}
          </select>
        </div>

        {/* Has metadata */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("filters.hasMetadata")}</label>
          <select
            className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            value={filters.hasMetadata}
            onChange={set("hasMetadata")}
          >
            <option value="">{t("filters.any")}</option>
            <option value="yes">{t("filters.hasMetadataYes")}</option>
            <option value="no">{t("filters.hasMetadataNo")}</option>
          </select>
        </div>

        {/* Tag */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("filters.tag")}</label>
          <input
            type="text"
            className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            placeholder={t("filters.tagPlaceholder")}
            value={filters.tag}
            onChange={set("tag")}
          />
        </div>

        {/* Updated from */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("filters.updatedFrom")}</label>
          <input
            type="date"
            className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            value={filters.updatedFrom}
            onChange={set("updatedFrom")}
          />
        </div>

        {/* Updated to */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("filters.updatedTo")}</label>
          <input
            type="date"
            className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            value={filters.updatedTo}
            onChange={set("updatedTo")}
          />
        </div>

      </div>

      {/* Actions */}
      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {loading ? t("searching") : t("search")}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {t("reset")}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Results table
// ---------------------------------------------------------------------------

function ResultsTable({ results, searched }: { results: QueryResultItem[]; searched: boolean }) {
  const t = useTranslations("complexQuery");

  if (!searched) return null;

  if (results.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
        {t("noResults")}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-700">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {results.length === 200
            ? t("resultsCapped", { count: 200 })
            : t("resultsCount", { count: results.length })}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
              <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("table.code")}</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("table.type")}</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("table.name")}</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("table.importance")}</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("table.relevance")}</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("table.provenance")}</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("table.updatedBy")}</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("table.metadataUpdated")}</th>
            </tr>
          </thead>
          <tbody>
            {results.map((row) => (
              <tr
                key={row.principalObjectId}
                className="border-b border-zinc-50 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/30"
              >
                <td className="px-4 py-2">
                  <Link
                    href={entityHref(row)}
                    className="font-mono text-xs font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
                  >
                    {row.code}
                  </Link>
                </td>
                <td className="px-4 py-2">
                  <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${badgeClass(row.entityType)}`}>
                    {row.entityType}
                  </span>
                  {row.entityType === "PERSON" && (
                    <span className="ml-1">
                      {personTypeBadge(row.personType)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">
                  {row.displayName || <span className="text-zinc-400 italic">—</span>}
                </td>
                <td className="px-4 py-2">{importanceBadge(row.importance) ?? <span className="text-zinc-300 dark:text-zinc-600">—</span>}</td>
                <td className="px-4 py-2">{relevanceBadge(row.relevance) ?? <span className="text-zinc-300 dark:text-zinc-600">—</span>}</td>
                <td className="px-4 py-2">
                  {row.provenance
                    ? <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">{row.provenance}</span>
                    : <span className="text-zinc-300 dark:text-zinc-600">—</span>
                  }
                </td>
                <td className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {row.updatedBy ?? <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                </td>
                <td className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {row.metadataUpdatedAt
                    ? new Date(row.metadataUpdatedAt).toLocaleDateString()
                    : <span className="text-zinc-300 dark:text-zinc-600">—</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function ComplexQueryView() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  // Pre-fill filters from URL params — allows the sidebar quick-search and any
  // other deep-link to land with the filters already applied.
  const [filters, setFilters] = useState<Filters>(() => ({
    entityType:    searchParams.get("entityType")    ?? "",
    personSubtype: searchParams.get("personSubtype") ?? "",
    importance:    searchParams.get("importance")    ?? "",
    relevance:     searchParams.get("relevance")     ?? "",
    provenance:    searchParams.get("provenance")    ?? "",
    groupCode:     searchParams.get("groupCode")     ?? "",
    stampCode:     searchParams.get("stampCode")     ?? "",
    tag:           searchParams.get("tag")           ?? "",
    search:        searchParams.get("search")        ?? "",
    updatedFrom:   searchParams.get("updatedFrom")   ?? "",
    updatedTo:     searchParams.get("updatedTo")     ?? "",
    hasMetadata:   searchParams.get("hasMetadata")   ?? "",
  }));

  const [results, setResults]   = useState<QueryResultItem[]>([]);
  const [loading, setLoading]   = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // runSearch is called from:
  //   (a) the Search button (user action — no cleanup needed)
  //   (b) the mount auto-run effect below
  const runSearch = useCallback(async (currentFilters: Filters) => {
    setLoading(true);
    setError(null);
    try {
      const params = filtersToParams(currentFilters);
      const res    = await fetch(`/api/admin/metadata-query?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data   = await res.json() as { results: QueryResultItem[] };
      setResults(data.results);
      setSearched(true);
      // Mirror the active filters into the URL so results are shareable /
      // back-navigable (replace so it doesn't pollute browser history).
      router.replace(`?${params.toString()}`, { scroll: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Auto-run on first mount when the URL already contains query params —
  // e.g. navigated here from the sidebar quick-search bar.
  const didAutoRun = useRef(false);
  useEffect(() => {
    if (didAutoRun.current) return;
    const hasParams = [...searchParams.entries()].some(([, v]) => v.trim() !== "");
    if (!hasParams) return;
    didAutoRun.current = true;
    let cancelled = false;
    const initialFilters: Filters = {
      entityType:    searchParams.get("entityType")    ?? "",
      personSubtype: searchParams.get("personSubtype") ?? "",
      importance:    searchParams.get("importance")    ?? "",
      relevance:     searchParams.get("relevance")     ?? "",
      provenance:    searchParams.get("provenance")    ?? "",
      groupCode:     searchParams.get("groupCode")     ?? "",
      stampCode:     searchParams.get("stampCode")     ?? "",
      tag:           searchParams.get("tag")           ?? "",
      search:        searchParams.get("search")        ?? "",
      updatedFrom:   searchParams.get("updatedFrom")   ?? "",
      updatedTo:     searchParams.get("updatedTo")     ?? "",
      hasMetadata:   searchParams.get("hasMetadata")   ?? "",
    };
    const doAutoSearch = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = filtersToParams(initialFilters);
        const res    = await fetch(`/api/admin/metadata-query?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data   = await res.json() as { results: QueryResultItem[] };
        if (!cancelled) {
          setResults(data.results);
          setSearched(true);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void doAutoSearch();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount only

  const reset = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setResults([]);
    setSearched(false);
    setError(null);
    router.replace("?", { scroll: false });
  }, [router]);

  return (
    <div className="flex flex-col gap-6">
      <FilterForm
        filters={filters}
        onChange={setFilters}
        onSearch={() => runSearch(filters)}
        onReset={reset}
        loading={loading}
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <ResultsTable results={results} searched={searched} />
    </div>
  );
}
