"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { QueryResultItem } from "@/app/api/admin/global-search/route";
import { PROVENANCE_VALUES } from "@/lib/metadata/provenance";
import { buttonClass } from "@/lib/ui/button-styles";
import { DevOnly } from "@/components/dev-only";
import { PaginationControls } from "@/components/pagination-controls";
import {
  PER_TYPE_CAP,
  SEARCH_PAGE_SIZE,
  clampPage,
  pageSlice,
  type SearchEntityType,
} from "@/lib/search/interleave";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const IMPORTANCE_VALUES  = ["LOW", "MEDIUM", "HIGH"] as const;
const RELEVANCE_VALUES   = ["INACTIVE", "HISTORICAL", "CURRENT", "FUTURE"] as const;
// PROVENANCE_VALUES comes from @/lib/metadata/provenance (Slice #21.07.Import).
// It used to be a local literal here that had drifted away from the DB CHECK
// constraint entirely - SCAN_OCR / MANUAL_ENTRY / EXTERNAL_DB / OTHER are not
// and never were storable values, so those filter options could never match a
// single row.
const ENTITY_TYPES       = ["PERSON", "PROPERTY", "DOCUMENT"] as const;
const PERSON_SUBTYPES    = ["NATURAL", "JUDICIAL"] as const;

/** Shape of GET /api/admin/global-search. */
type SearchResponse = {
  results:        QueryResultItem[];
  truncatedTypes: SearchEntityType[];
  perTypeCap:     number;
};

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

/**
 * Read the filter set out of URL params.
 *
 * Note `page` is deliberately NOT part of Filters: it describes where you are
 * in a result set, not what you searched for, so it must never be sent to the
 * API and must never make the mount auto-run think a search was requested.
 */
function filtersFromParams(sp: URLSearchParams | ReadonlyURLSearchParamsLike): Filters {
  const get = (k: string) => sp.get(k) ?? "";
  return {
    entityType:    get("entityType"),
    personSubtype: get("personSubtype"),
    importance:    get("importance"),
    relevance:     get("relevance"),
    provenance:    get("provenance"),
    groupCode:     get("groupCode"),
    stampCode:     get("stampCode"),
    tag:           get("tag"),
    search:        get("search"),
    updatedFrom:   get("updatedFrom"),
    updatedTo:     get("updatedTo"),
    hasMetadata:   get("hasMetadata"),
  };
}

/** Minimal structural type so this helper works with Next's read-only params. */
type ReadonlyURLSearchParamsLike = { get(name: string): string | null };

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

const EMPTY_CELL = <span className="text-zinc-300 dark:text-zinc-600">—</span>;

/**
 * Group membership badges (Slice #23.11.search).
 *
 * Codes are GRP-001 style (Slice #20.08 simplified them from the original
 * two-letter scheme); `position` is the member's never-reused slot inside the
 * group. Without this column a group-filtered result gave no indication of
 * which group matched — or whether the filter had done anything at all.
 */
function groupTagCells(row: QueryResultItem) {
  if (row.groupTags.length === 0) return EMPTY_CELL;
  return (
    <span className="flex flex-wrap gap-1">
      {row.groupTags.map((g) => (
        <span
          key={`${g.code}-${g.position}`}
          className="inline-block rounded bg-indigo-100 px-1.5 py-0.5 font-mono text-xs font-medium text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300"
        >
          {g.code} {String(g.position).padStart(2, "0")}
        </span>
      ))}
    </span>
  );
}

/** Stamp code badges — STMP-AAA style, no position (membership is a plain set). */
function stampTagCells(row: QueryResultItem) {
  if (row.stampCodes.length === 0) return EMPTY_CELL;
  return (
    <span className="flex flex-wrap gap-1">
      {row.stampCodes.map((code) => (
        <span
          key={code}
          className="inline-block rounded bg-teal-100 px-1.5 py-0.5 font-mono text-xs font-medium text-teal-800 dark:bg-teal-900/30 dark:text-teal-300"
        >
          {code}
        </span>
      ))}
    </span>
  );
}

/**
 * Build the display label for a PROPERTY row.
 * Priority: tarla + parcela (combined) → nickname → cadastralNumber → "—"
 */
function propertyLabel(row: QueryResultItem): React.ReactNode {
  const tarla   = row.propertyTarlaSola?.trim();
  const parcela = row.propertyParcela?.trim();

  if (tarla || parcela) {
    // Show both when available, separated by " / "
    const parts = [tarla, parcela].filter(Boolean).join(" / ");
    return (
      <span>
        {parts}
        {row.propertyNickname && (
          <span className="ml-1.5 text-xs text-zinc-400 dark:text-zinc-500">
            ({row.propertyNickname})
          </span>
        )}
      </span>
    );
  }

  if (row.propertyNickname) return row.propertyNickname;

  if (row.propertyCadastralNumber) {
    return (
      <span className="font-mono text-xs">{row.propertyCadastralNumber}</span>
    );
  }

  return <span className="text-zinc-400 italic">—</span>;
}

/** Build a URLSearchParams from the active non-empty filter values. */
function filtersToParams(f: Filters): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(f)) {
    if (value) params.set(key, value);
  }
  return params;
}

/**
 * Join phrases the way the reader's language does ("a, b și c" in Romanian).
 * Falls back to a comma list if the runtime has no Intl.ListFormat.
 */
function formatList(locale: string, parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  try {
    return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(parts);
  } catch {
    return parts.join(", ");
  }
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
  const t = useTranslations("globalSearch");
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

        {/* Slice #23.10.dev: Importance / Relevance / Provenance / Has metadata
            are all read off entity_metadata, which a business user can neither
            see nor set now that the Metadata tab is developer-only. Global
            search itself stays — finding an entity by code, name, tag or date
            is exactly the kind of thing Ciprian needs. Only the four metadata
            filters and the five metadata result columns go.

            The filter STATE stays mounted and stays "" (the any-value
            default), so the query the page issues is unchanged. */}
        <DevOnly>
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
        </DevOnly>

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
          className={buttonClass({ variant: "primary", size: "lg" })}
        >
          {loading ? t("searching") : t("search")}
        </button>
        <button
          type="button"
          onClick={onReset}
          className={buttonClass({ variant: "secondary", size: "lg" })}
        >
          {t("reset")}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Truncation notice
// ---------------------------------------------------------------------------

/**
 * Names every entity type that was cut short (Slice #23.11.search).
 *
 * The screen's original defect was NOT the cap. It was that one global
 * "showing the first 200 results" line was simultaneously true and useless:
 * it read as "there are more results of this kind" when what had actually
 * happened was that every property and every person had been dropped from the
 * response entirely. A message that cannot distinguish those two situations is
 * worse than none, because it stops the reader looking further.
 */
function TruncationNotice({ types }: { types: SearchEntityType[] }) {
  const t      = useTranslations("globalSearch");
  const locale = useLocale();

  if (types.length === 0) return null;

  const phrases = types.map((type) =>
    t("truncatedFragment", { count: PER_TYPE_CAP, type: t(`truncatedTypes.${type}`) }),
  );

  return (
    <div
      role="status"
      className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
    >
      {t("truncatedNotice", { list: formatList(locale, phrases) })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Results table
// ---------------------------------------------------------------------------

type ResultsTableProps = {
  results:        QueryResultItem[];
  truncatedTypes: SearchEntityType[];
  searched:       boolean;
  page:           number;
  onPageChange:   (page: number) => void;
};

function ResultsTable({ results, truncatedTypes, searched, page, onPageChange }: ResultsTableProps) {
  const t = useTranslations("globalSearch");

  // A ?page= arriving from a shared link can point past the end of a result
  // set that has since shrunk, so clamp before anything is rendered.
  const safePage = clampPage(page, results.length);
  const visible  = pageSlice(results, safePage);

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
          {t("resultsCount", { count: results.length })}
        </span>
      </div>

      <TruncationNotice types={truncatedTypes} />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
              <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("table.code")}</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("table.type")}</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("table.name")}</th>
              {/* Slice #23.11.search — Grup / Stampile are NOT dev-only: they
                  exist so the group and stamp filters, which any user can set,
                  show which group or stamp actually matched. A filter with no
                  corresponding column is a filter you cannot check. */}
              <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("table.groups")}</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("table.stamps")}</th>
              {/* Slice #23.10.dev — header and cells are wrapped separately but
                  by the same predicate, so a row can never disagree with its
                  header about how many columns there are. <DevOnly> renders a
                  fragment, which is transparent inside <tr>. */}
              <DevOnly>
                <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("table.importance")}</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("table.relevance")}</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("table.provenance")}</th>
                {/* These two are metadata columns as well, which is not obvious
                    from their labels: BOTH are selected off entity_metadata in
                    /api/admin/global-search — updatedBy is
                    entity_metadata.updated_by (who last wrote the METADATA, not
                    the entity; the entity's own audit column of the same name is
                    never read here) and metadataUpdated is
                    entity_metadata.updated_at. Left visible they would be two
                    permanently-empty columns on a build where nobody can write a
                    metadata row. */}
                <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("table.updatedBy")}</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("table.metadataUpdated")}</th>
              </DevOnly>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
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
                  {row.entityType === "PROPERTY"
                    ? propertyLabel(row)
                    : (row.displayName || <span className="text-zinc-400 italic">—</span>)
                  }
                </td>
                <td className="px-4 py-2">{groupTagCells(row)}</td>
                <td className="px-4 py-2">{stampTagCells(row)}</td>
                <DevOnly>
                  <td className="px-4 py-2">{importanceBadge(row.importance) ?? EMPTY_CELL}</td>
                  <td className="px-4 py-2">{relevanceBadge(row.relevance) ?? EMPTY_CELL}</td>
                  <td className="px-4 py-2">
                    {row.provenance
                      ? <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">{row.provenance}</span>
                      : EMPTY_CELL
                    }
                  </td>
                  <td className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {row.updatedBy ?? EMPTY_CELL}
                  </td>
                  <td className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {row.metadataUpdatedAt
                      ? new Date(row.metadataUpdatedAt).toLocaleDateString()
                      : EMPTY_CELL
                    }
                  </td>
                </DevOnly>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Slice #23.11.search — paging is over the already-fetched capped set
          (at most 200 rows, one small response), so a page change is a slice,
          not a round trip. Server-side OFFSET paging would have to materialise
          the same capped 200 on every request anyway. */}
      <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-700">
        <PaginationControls
          page={safePage}
          total={results.length}
          pageSize={SEARCH_PAGE_SIZE}
          onPrev={() => onPageChange(safePage - 1)}
          onNext={() => onPageChange(safePage + 1)}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function GlobalSearchView() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  // Pre-fill filters from URL params — allows the sidebar quick-search and any
  // other deep-link to land with the filters already applied.
  const [filters, setFilters] = useState<Filters>(() => filtersFromParams(searchParams));

  // Page index is 0-based in state (matching PaginationControls) but 1-based in
  // the URL, where a human reads it. Slice #23.11.search introduces ?page= —
  // no other list actually carried it, despite CLAUDE.md's Slice #6.0 note.
  const [page, setPage] = useState<number>(() => {
    const raw = Number(searchParams.get("page"));
    return Number.isFinite(raw) && raw >= 2 ? Math.trunc(raw) - 1 : 0;
  });

  const [results, setResults]     = useState<QueryResultItem[]>([]);
  const [truncated, setTruncated] = useState<SearchEntityType[]>([]);
  const [loading, setLoading]     = useState(false);
  const [searched, setSearched]   = useState(false);
  const [error, setError]         = useState<string | null>(null);

  /** Mirror filters + page into the URL so a result is shareable. */
  const syncUrl = useCallback((f: Filters, p: number) => {
    const params = filtersToParams(f);
    // Omit page=1: the common case should not carry noise.
    if (p > 0) params.set("page", String(p + 1));
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }, [router]);

  const goToPage = useCallback((next: number) => {
    setPage(next);
    syncUrl(filters, next);
  }, [filters, syncUrl]);

  /**
   * A filter edit invalidates the page you are on, so reset to page 1 — the
   * same discipline every other list view applies in its filter onChange
   * handlers. Without it, changing a filter on page 9 strands the user on an
   * empty page.
   */
  const changeFilters = useCallback((next: Filters) => {
    setFilters(next);
    setPage(0);
  }, []);

  // runSearch is called from:
  //   (a) the Search button (user action — no cleanup needed)
  //   (b) the mount auto-run effect below
  const runSearch = useCallback(async (currentFilters: Filters) => {
    setLoading(true);
    setError(null);
    try {
      const params = filtersToParams(currentFilters);
      const res    = await fetch(`/api/admin/global-search?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data   = await res.json() as SearchResponse;
      setResults(data.results);
      setTruncated(data.truncatedTypes ?? []);
      setSearched(true);
      // A new result set always starts at page 1. This is the reset that
      // actually matters on this screen: unlike the entity lists, results here
      // change only when Search is pressed, not on every filter keystroke.
      setPage(0);
      syncUrl(currentFilters, 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [syncUrl]);

  // Auto-run on first mount when the URL already contains FILTER params —
  // e.g. navigated here from the sidebar quick-search bar.
  const didAutoRun = useRef(false);
  useEffect(() => {
    if (didAutoRun.current) return;
    const initialFilters = filtersFromParams(searchParams);
    // Check the parsed filters, not the raw params: a link carrying only
    // ?page=3 describes a position, not a query, and must not trigger a
    // full unfiltered search of every entity in the system.
    const hasFilters = Object.values(initialFilters).some((v) => v.trim() !== "");
    if (!hasFilters) return;
    didAutoRun.current = true;
    let cancelled = false;
    const doAutoSearch = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = filtersToParams(initialFilters);
        const res    = await fetch(`/api/admin/global-search?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data   = await res.json() as SearchResponse;
        if (!cancelled) {
          setResults(data.results);
          setTruncated(data.truncatedTypes ?? []);
          setSearched(true);
          // Deliberately does NOT reset the page — honouring ?page= is the
          // whole point of putting it in the URL.
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
    setTruncated([]);
    setPage(0);
    setSearched(false);
    setError(null);
    router.replace("?", { scroll: false });
  }, [router]);

  const onSearch = useMemo(() => () => void runSearch(filters), [runSearch, filters]);

  return (
    <div className="flex flex-col gap-6">
      <FilterForm
        filters={filters}
        onChange={changeFilters}
        onSearch={onSearch}
        onReset={reset}
        loading={loading}
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <ResultsTable
        results={results}
        truncatedTypes={truncated}
        searched={searched}
        page={page}
        onPageChange={goToPage}
      />
    </div>
  );
}
