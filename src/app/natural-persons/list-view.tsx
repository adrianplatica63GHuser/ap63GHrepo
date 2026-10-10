"use client";

import { useNameOr } from "@/components/record/use-name-or";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RecencyBadge } from "@/components/recency-badge";
import { HelpHint } from "@/components/help/help-hint";
import { buttonClass } from "@/lib/ui/button-styles";
import { ArrowRight, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { FixedColumns, ONE_LINE, TABLE_FRAME, cellTitle, columnHead, fixedTable } from "@/components/table/fixed-columns";
import { LIST_TOOLBAR, useListEdge } from "@/components/table/list-edge";
import type { ColumnName } from "@/lib/ui/field-widths";
import { newTabIfAsked } from "@/lib/ui/row-link";
import { ListPreviewRow, ListPreviews, PreviewButton } from "@/components/tiles/preview-tiles";
import { IncursionButton, LinksButton } from "@/components/tiles/incursion-button";
import { IncursionTile } from "@/app/_components/incursion-tile";
import { FieldChooser, useFieldChooser, type ChooserField } from "@/components/list/field-chooser";
import { LIST_COLUMN_CHOICE } from "@/lib/ui/list-columns";
import { ageFromDob, dmyFromIso } from "@/lib/persons/person-age";

const PAGE_SIZE = 15;
// Slice #37.94: the key and the defaults (none) are LIST_COLUMN_CHOICE.person.
const MAX_OPT   = 4;

type NaturalPersonListItem = {
  id:          string;
  code:        string;
  displayName: string;
  nickname:    string | null;
  // Slice #37.60 — „Câmpuri afișate": the „Identitate" fields.
  cnp:              string | null;
  dateOfBirth:      string | null;
  gender:           "MALE" | "FEMALE" | null;
  placeOfBirth:     string | null;
  professionalType: string | null;
  createdAt:   string;
  updatedAt:   string;
};

type ListResponse = {
  items:  NaturalPersonListItem[];
  total:  number;
  limit:  number;
  offset: number;
};

// Slice #37.60: no importance or relevance filter any more — the route still
// takes both parameters, and nothing here sends them.
async function fetchNaturalPersons(q: string, page: number): Promise<ListResponse> {
  const url = new URL("/api/people", window.location.origin);
  if (q)          url.searchParams.set("q",          q);
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
            className={buttonClass({ variant: "secondary", size: "lg" })}
          >
            {noLabel}
          </button>
          <button
            type="button"
            onClick={onYes}
            disabled={busy}
            className={buttonClass({ variant: "danger", size: "lg" })}
          >
            {yesLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function NaturalPersonListView() {
  const t       = useTranslations("naturalPerson");
  const nameOr      = useNameOr(); // #37.57: a name, or words — never the system ID
  const tPag    = useTranslations("shared.pagination");
  const tBulk   = useTranslations("shared.bulkDelete");
  const router = useRouter();
  const queryClient = useQueryClient();

  const [searchInput,     setSearchInput]     = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage,     setCurrentPage]     = useState(0);

  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(() => new Set());
  const [confirmOpen,  setConfirmOpen]  = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [deleteError,  setDeleteError]  = useState<string | null>(null);

  // Slice #37.60 — „Câmpuri afișate", the shared chooser (`field-chooser.tsx`).
  const optionalCols: ChooserField[] = [
    { key: "cnp",              label: t("fields.cnp"),                  column: "listCnp" },
    { key: "dateOfBirth",      label: t("fields.dateOfBirth"),          column: "listDate" },
    { key: "age",              label: t("fields.age"),                  column: "listAge" },
    { key: "gender",           label: t("fields.gender"),               column: "listGender" },
    { key: "placeOfBirth",     label: t("fields.placeOfBirth"),         column: "listBirthPlace" },
    { key: "professionalType", label: t("fields.physicalPersonTypeId"), column: "listProfessionalType" },
  ];
  const chooser = useFieldChooser(LIST_COLUMN_CHOICE.person.storageKey, optionalCols.map((c) => c.key), MAX_OPT, LIST_COLUMN_CHOICE.person.defaults);

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

  // Slice #32.15: this key must carry every value the query key above carries.
  // A filter that is missing here leaves ticks set on rows the filter has just
  // taken off the screen, and the bulk delete then acts on records nobody can see.
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

  /** Slice #37.60: a ticked „Identitate" field's cell — as the form shows it. */
  function cellValue(item: NaturalPersonListItem, key: string): React.ReactNode {
    switch (key) {
      case "cnp":              return item.cnp;
      case "dateOfBirth":      return dmyFromIso(item.dateOfBirth);
      case "age":              return ageFromDob(item.dateOfBirth);
      case "gender":           return item.gender === "MALE" ? t("options.gender.MALE") : item.gender === "FEMALE" ? t("options.gender.FEMALE") : null;
      case "placeOfBirth":     return item.placeOfBirth;
      case "professionalType": return item.professionalType;
      default:                 return null;
    }
  }

  // Slice #37.16: the columns shown, in order — each a fixed width from
  // `COLUMN`, so an optional column ticked in „Câmpuri afișate" widens the
  // table rather than squeezing the others.
  // A stored key this build has no column for stays in storage and is not drawn.
  const shownCols = chooser.visible.flatMap((key) => optionalCols.filter((c) => c.key === key));
  // Slice #38.57: the list's own columns, one line each.
  const columns: ColumnName[] = ["selectNew", "listPersonName", "listPersonNickname", ...shownCols.map((c) => c.column), "listRowActions"];
  // Slice #37.84: the toolbar's group ends at the table frame's right edge, not the window's.
  const edge = useListEdge(columns);
  const colCount = columns.length;

  return (
    // Slice #38.75: the whole list — toolbar to pagination — so its Incursiune is as tall as all of it.
    <ListPreviews incursion={IncursionTile}>
      {/* Toolbar */}
      <div className={`flex flex-wrap items-center gap-3 ${LIST_TOOLBAR}`} {...edge.toolbar}>
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="w-64 rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm placeholder:text-fade focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
        />

        {/* Slice #37.60: no „Importanță" or „Relevanță" filter; „Câmpuri afișate" offers
            the „Identitate" fields. */}
        <FieldChooser
          label={t("chooseFields")}
          hint={t("chooseFieldsHint", { max: MAX_OPT })}
          fields={optionalCols}
          visible={chooser.visible}
          max={MAX_OPT}
          onToggle={chooser.toggle}
        />

        <div className="ml-auto flex items-center gap-2">
          {selectedIds.size > 0 && (
            <IconButton
              icon={Trash2}
              label={tBulk("deleteSelected", { count: selectedIds.size })}
              count={selectedIds.size}
              variant="danger"
              size="lg"
              onClick={() => setConfirmOpen(true)}
            />
          )}
          <HelpHint hintKey="select-all-page-only" />
          <IconButton
            href="/natural-persons/new"
            icon={Plus}
            label={t("addNew")}
            showLabel
            variant="primary"
            size="lg"
          />
        </div>
      </div>

      {deleteError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {deleteError}
        </p>
      )}

      {/* Results table */}
      <ListPreviewRow>
        <div className={`${TABLE_FRAME} rounded-md border border-card-rim bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900`} {...edge.frame}>
          {/* Slice #38.57: the table fills its frame, which the toolbar may hold wider than the columns. */}
          <table {...fixedTable(columns, "text-sm min-w-full")}>
            <FixedColumns columns={columns} />
            <thead className="bg-cap text-left text-xs font-medium uppercase tracking-wide text-ink dark:bg-zinc-800 dark:text-zinc-300">
              <tr>
                <th className="px-4 py-2" {...columnHead("selectNew")}>
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
                <th className="px-4 py-2" {...columnHead("listPersonName")}>{t("table.name")}</th>
                <th className="px-4 py-2" {...columnHead("listPersonNickname")}>{t("table.nickname")}</th>
                {shownCols.map((col) => (
                  <th key={col.key} className="px-4 py-2" {...columnHead(col.column)}>
                    {col.label}
                  </th>
                ))}
                <th className="px-4 py-2" {...columnHead("listRowActions")} />
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
                  // Slice #37.21: Ctrl/⌘+click or a middle-click opens the record in a new tab.
                  onClick={(e) => {
                    if (newTabIfAsked(e, `/natural-persons/${item.id}`)) return;
                    router.push(`/natural-persons/${item.id}`);
                  }}
                  onAuxClick={(e) => newTabIfAsked(e, `/natural-persons/${item.id}`)}
                  className="align-top hover:bg-cta-pale dark:hover:bg-zinc-800/50 cursor-pointer"
                >
                  <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                    <span className="inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleOne(item.id)}
                        aria-label={nameOr(item.displayName, "person")}
                        className="h-4 w-4 rounded border-wire accent-cta"
                      />
                      <RecencyBadge createdAt={item.createdAt} updatedAt={item.updatedAt} />
                    </span>
                  </td>
                  <td className={`px-4 py-2 font-medium ${ONE_LINE}`} title={cellTitle(item.displayName)}>
                    {item.displayName || (
                      <span className="text-fade italic">—</span>
                    )}
                  </td>
                  <td className={`px-4 py-2 text-fade dark:text-zinc-400 ${ONE_LINE}`} title={cellTitle(item.nickname)}>
                    {item.nickname || <span className="italic">—</span>}
                  </td>
                  {shownCols.map((col) => (
                    <td key={col.key} className={`px-4 py-2 text-fade dark:text-zinc-400 ${ONE_LINE}`} title={cellTitle(cellValue(item, col.key))}>
                      {cellValue(item, col.key) ?? <span className="italic">—</span>}
                    </td>
                  ))}
                  <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                    {/* Slice #38.57: side by side, always. */}
                    <span className="flex flex-nowrap gap-2" data-row-actions="">
                      {/* Slice #38.71/#38.72/#38.76: the magnifier („Previzualizare"), the eye („Incursiune"), the chain link („Legături"), the arrow („Deschide"). */}
                      <PreviewButton target={{ kind: "person", id: item.id }} />
                      <IncursionButton target={{ kind: "person", id: item.id }} />
                      <LinksButton target={{ kind: "person", id: item.id }} />
                      <IconButton
                        href={`/natural-persons/${item.id}`}
                        icon={ArrowRight}
                        label={t("open")}
                        variant="secondary"
                        size="xs"
                      />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ListPreviewRow>

      {/* Counts + pagination */}
      {query.data && (
        <div className="flex w-fit max-w-full items-center justify-between text-sm text-fade" {...edge.frame}>
          <span>
            {t("counts", {
              shown: Math.min(items.length + currentPage * PAGE_SIZE, total),
              total,
            })}
          </span>
          {paginate && (
            <div className="flex items-center gap-1">
              <IconButton
                icon={ChevronLeft}
                label={tPag("previous")}
                variant="secondary"
                size="xs"
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
              />
              <span className="px-2">
                {tPag("pageOf", { page: currentPage + 1, total: totalPages })}
              </span>
              <IconButton
                icon={ChevronRight}
                label={tPag("next")}
                variant="secondary"
                size="xs"
                onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
              />
            </div>
          )}
        </div>
      )}

      {confirmOpen && (
        <ConfirmDialog
          title={tBulk("confirmTitle")}
          body={tBulk("confirmBody", { count: selectedIds.size })}
          yesLabel={deleting ? tBulk("deleting") : tBulk("delete")}
          noLabel={tBulk("cancel")}
          onYes={handleConfirmDelete}
          onNo={() => { setConfirmOpen(false); setDeleteError(null); }}
          busy={deleting}
        />
      )}
    </ListPreviews>
  );
}
