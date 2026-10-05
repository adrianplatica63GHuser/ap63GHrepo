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
import { FixedColumns, TABLE_FRAME, WRAPS, columnHead, fixedTable, wrapsIf } from "@/components/table/fixed-columns";
import { LIST_TOOLBAR, useListEdge } from "@/components/table/list-edge";
import { newTabIfAsked } from "@/lib/ui/row-link";
import { ListPreviews, PreviewButton } from "@/components/tiles/preview-tiles";
import { FieldChooser, useFieldChooser, type ChooserField } from "@/components/list/field-chooser";
import { LIST_COLUMN_CHOICE } from "@/lib/ui/list-columns";
import { screenBox, type ColumnName } from "@/lib/ui/field-widths";

const PAGE_SIZE = 15;
/** Slice #37.16: the list's columns, each a fixed width from `COLUMN` — the optional ones (#37.60) between the nickname and the buttons. */
// Slice #37.94: the key and the defaults (none) are LIST_COLUMN_CHOICE.company.
// Slice #37.71: four, so all four fields can be shown, as on the other lists.
const MAX_OPT = 4;

type JudicialPersonListItem = {
  id:          string;
  code:        string;
  displayName: string;
  nickname:    string | null;
  // Slice #37.60 — „Câmpuri afișate": the rest of „Persoană juridică" (Tip, CUI, Nr. Reg. Com.).
  judicialPersonType:  string | null;
  cuiNumber:           string | null;
  tradeRegisterNumber: string | null;
  /** Slice #37.71 — the first filled contact slot's name: slot 1, or slot 2 when the first is empty. */
  contactPerson:       string | null;
  createdAt:   string;
  updatedAt:   string;
};

type ListResponse = {
  items:  JudicialPersonListItem[];
  total:  number;
  limit:  number;
  offset: number;
};

// Slice #37.71: no „Grupuri" filter — the search box is the list's only filter.
async function fetchJudicialPersons(q: string, page: number): Promise<ListResponse> {
  const url = new URL("/api/judicial-persons", window.location.origin);
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

export function JudicialPersonListView() {
  const t     = useTranslations("judicialPerson");
  const nameOr      = useNameOr(); // #37.57: a name, or words — never the system ID
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

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setCurrentPage(0);
    }, 250);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const query = useQuery<ListResponse>({
    queryKey: ["judicial-persons", "list", debouncedSearch, currentPage],
    queryFn:  () => fetchJudicialPersons(debouncedSearch, currentPage),
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
      await queryClient.invalidateQueries({ queryKey: ["judicial-persons"] });
      setSelectedIds(new Set());
      setConfirmOpen(false);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : tBulk("error"));
    } finally {
      setDeleting(false);
    }
  }

  // Slice #37.60 — „Câmpuri afișate", the same chooser the Natural Persons list draws.
  const optionalCols: ChooserField[] = [
    { key: "judicialPersonType",  label: t("fields.judicialType"),        column: "companyType" },
    { key: "cuiNumber",           label: t("fields.cuiNumber"),           column: "cui" },
    { key: "tradeRegisterNumber", label: t("fields.tradeRegisterNumber"), column: "tradeRegister" },
    // Slice #37.71: the company's contact person — the first, when it has two.
    { key: "contactPerson",       label: t("fields.contactPerson"),       column: "contactPerson" },
  ];
  const chooser = useFieldChooser(LIST_COLUMN_CHOICE.company.storageKey, optionalCols.map((c) => c.key), MAX_OPT, LIST_COLUMN_CHOICE.company.defaults);
  const shownCols = chooser.visible.flatMap((key) => optionalCols.filter((c) => c.key === key));
  const COLUMNS: ColumnName[] = ["selectNew", "personName", "personNickname", ...shownCols.map((c) => c.column), "openPreview"];
  // Slice #37.84: the toolbar's group ends at the table frame's right edge, not the window's.
  const edge = useListEdge(COLUMNS);
  const colCount = COLUMNS.length;
  const cellValue = (item: JudicialPersonListItem, key: string): string | null =>
    key === "judicialPersonType" ? item.judicialPersonType
      : key === "cuiNumber" ? item.cuiNumber
        : key === "tradeRegisterNumber" ? item.tradeRegisterNumber
          : key === "contactPerson" ? item.contactPerson
            : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className={`flex flex-wrap items-center gap-3 ${LIST_TOOLBAR}`} {...edge.toolbar}>
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          {...screenBox("listSearch")}
          className="rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm placeholder:text-fade focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
        />
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
            href="/judicial-persons/new"
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

      {/* Results table — Slice #37.16: fixed columns from `COLUMN`, the table
          as wide as they are. */}
      <ListPreviews>
        <div className={`${TABLE_FRAME} rounded-md border border-card-rim bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900`} {...edge.frame}>
          <table {...fixedTable(COLUMNS)}>
            <FixedColumns columns={COLUMNS} />
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
                <th className="px-4 py-2" {...columnHead("personName")}>{t("table.name")}</th>
                <th className="px-4 py-2" {...columnHead("personNickname")}>{t("table.nickname")}</th>
                {shownCols.map((col) => (
                  <th key={col.key} className="px-4 py-2" {...columnHead(col.column)}>{col.label}</th>
                ))}
                <th className="px-4 py-2" {...columnHead("openPreview")} />
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
                    if (newTabIfAsked(e, `/judicial-persons/${item.id}`)) return;
                    router.push(`/judicial-persons/${item.id}`);
                  }}
                  onAuxClick={(e) => newTabIfAsked(e, `/judicial-persons/${item.id}`)}
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
                  <td className={`px-4 py-2 font-medium ${WRAPS}`}>
                    {item.displayName || (
                      <span className="text-fade italic">—</span>
                    )}
                  </td>
                  <td className={`px-4 py-2 text-fade dark:text-zinc-400 ${WRAPS}`}>
                    {item.nickname || <span className="italic">—</span>}
                  </td>
                  {shownCols.map((col) => (
                    <td key={col.key} className={`px-4 py-2 text-fade dark:text-zinc-400 ${wrapsIf(col.column)}`}>
                      {cellValue(item, col.key) ?? <span className="italic">—</span>}
                    </td>
                  ))}
                  <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                    <span className="flex gap-2">
                      <IconButton
                        href={`/judicial-persons/${item.id}`}
                        icon={ArrowRight}
                        label={t("open")}
                        variant="secondary"
                        size="xs"
                      />
                      <PreviewButton target={{ kind: "company", id: item.id }} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ListPreviews>

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
    </div>
  );
}
