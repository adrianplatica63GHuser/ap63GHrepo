"use client";

import { useNameOr } from "@/components/record/use-name-or";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RecencyBadge } from "@/components/recency-badge";
import { BowTieBadge } from "@/components/bow-tie-badge";
import { HelpHint } from "@/components/help/help-hint";
import { buttonClass } from "@/lib/ui/button-styles";
import { ArrowRight, ChevronLeft, ChevronRight, Map as MapIcon, Plus, Trash2 } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { FixedColumns, ONE_LINE, TABLE_FRAME, cellTitle, columnHead, fixedTable } from "@/components/table/fixed-columns";
import { LIST_TOOLBAR, useListEdge } from "@/components/table/list-edge";
import type { ColumnName } from "@/lib/ui/field-widths";
import { AddPropertyDialog } from "./_components/add-property-dialog";
import { newTabIfAsked } from "@/lib/ui/row-link";
import { ListPreviews, PreviewButton } from "@/components/tiles/preview-tiles";
import { FieldChooser, useFieldChooser, type ChooserField } from "@/components/list/field-chooser";
import { LIST_COLUMN_CHOICE } from "@/lib/ui/list-columns";

const PAGE_SIZE = 15;
// Slice #37.94: the key and the defaults (Tarla/Solă, Parcelă) are LIST_COLUMN_CHOICE.property.
const MAX_OPT   = 4;
// Slice #37.72: Poreclă is always shown, so it is no longer a default — or a choice.

type PropertyListItem = {
  id:               string;
  code:             string;
  nickname:         string | null;
  /**
   * Slice #34.03: the tarla CODE, read through `property.tarla_id`. Renamed
   * from `tarlaSola` because it is no longer a column on `property` — it is
   * `lookup_tarla.indicativ`, so a rename in Reference Data changes what this
   * shows on the next load.
   */
  tarla:            string | null;
  parcela:          string | null;
  cadastralNumber:  string | null;
  carteFunciara:    string | null;
  surfaceAreaMp:    string | null;
  calculatedAreaMp: string | null;
  /** Slice #37.72 — the value lists' names, not their ids. */
  useCategory:      string | null;
  propertyType:     string | null;
  // Slice #32.14: the corner order self-intersects, so calculatedAreaMp above
  // is meaningless. Badged beside the checkbox, never a toggleable column.
  cornerOrderSelfIntersects: boolean;
  locality:         string | null;
  county:           string | null;
  createdAt:        string;
  updatedAt:        string;
};

type ListResponse = {
  items:  PropertyListItem[];
  total:  number;
  limit:  number;
  offset: number;
};

// Slice #37.61: no importance or relevance filter any more — the route still
// takes both parameters, and nothing here sends them.
async function fetchProperties(q: string, page: number): Promise<ListResponse> {
  const url = new URL("/api/properties", window.location.origin);
  if (q)          url.searchParams.set("q",          q);
  url.searchParams.set("limit",  String(PAGE_SIZE));
  url.searchParams.set("offset", String(page * PAGE_SIZE));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

async function callBatchDelete(ids: string[]): Promise<void> {
  const res = await fetch("/api/properties/batch-delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
}

function formatArea(raw: string | null): string {
  if (raw == null) return "";
  const n = parseFloat(raw);
  if (isNaN(n)) return raw;
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
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


export function PropertyListView() {
  const t       = useTranslations("property");
  const nameOr      = useNameOr(); // #37.57: a name, or words — never the system ID
  const tPag    = useTranslations("shared.pagination");
  const tBulk   = useTranslations("shared.bulkDelete");
  const router = useRouter();
  const queryClient = useQueryClient();

  const [searchInput,     setSearchInput]     = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage,     setCurrentPage]     = useState(0);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [confirmOpen,  setConfirmOpen]  = useState(false);
  // Slice #32.20 — the Add Property dialog's first and only entry point.
  const [addOpen,      setAddOpen]      = useState(false);
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
    queryKey: ["properties", "list", debouncedSearch, currentPage],
    queryFn:  () => fetchProperties(debouncedSearch, currentPage),
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
      await queryClient.invalidateQueries({ queryKey: ["properties"] });
      setSelectedIds(new Set());
      setConfirmOpen(false);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : tBulk("error"));
    } finally {
      setDeleting(false);
    }
  }

  // Optional column definitions (ordered)
  //
  // Slice #37.16: each carries the `COLUMN` that gives its width. The KEY is
  // what localStorage stores and stays as it was — "nickname" is drawn in the
  // `propertyNickname` column, which is the only one whose name differs.
  // Slice #37.72: Poreclă is a fixed column (the first after the checkbox) and
  // is not offered; the chooser lists every field of „Date cadastrale" but
  // Poreclă and Note, in that panel's order (SCREEN_ROWS.property.cadastral),
  // then Localitate. A browser whose stored choice names "nickname" simply
  // loses it from the choice (`field-chooser.tsx`); the column is there anyway.
  const optionalCols: ChooserField[] = [
    // ⚠️ The column KEY stays "tarlaSola" while the field beside it is now
    // `tarla`, and that is deliberate rather than an oversight: these keys are
    // persisted per user in localStorage (`LIST_COLUMN_CHOICE.property`), so renaming one
    // silently drops that column from the saved choices of anyone who had it
    // on. The key is a UI identifier; the field is the data.  (Slice #34.03)
    { key: "tarlaSola",        label: t("table.tarlaSola"),        column: "listTarla" },
    { key: "parcela",          label: t("table.parcela"),          column: "listParcela" },
    { key: "surfaceAreaMp",    label: t("table.surfaceAreaMp"),    column: "listArea" },
    { key: "calculatedAreaMp", label: t("table.calculatedAreaMp"), column: "listArea" },
    { key: "carteFunciara",    label: t("table.carteFunciara"),    column: "listCarteFunciara" },
    { key: "cadastralNumber",  label: t("table.cadastralNumber"),  column: "listCadastral" },
    // Slice #37.72: the two the chooser lacked, labelled as on the form.
    { key: "useCategory",      label: t("fields.useCategory"),     column: "listUseCategory" },
    { key: "propertyType",     label: t("fields.propertyType"),    column: "listPropertyType" },
    { key: "locality",         label: t("table.locality"),         column: "listLocality" },
    // Slice #37.61: importance, relevance and provenance are no longer offered; a
    // browser that remembers one simply loses it (`field-chooser.tsx`).
  ];

  function cellValue(item: PropertyListItem, key: string): React.ReactNode {
    switch (key) {
      case "parcela":          return item.parcela ?? "";
      case "tarlaSola":        return item.tarla ?? "";
      case "cadastralNumber":  return item.cadastralNumber ?? "";
      case "carteFunciara":    return item.carteFunciara ?? "";
      case "surfaceAreaMp":    return formatArea(item.surfaceAreaMp);
      case "calculatedAreaMp": return formatArea(item.calculatedAreaMp);
      case "useCategory":      return item.useCategory ?? "";
      case "propertyType":     return item.propertyType ?? "";
      case "locality":         return [item.locality, item.county].filter(Boolean).join(", ");
      default:                 return null;
    }
  }

  // Slice #37.16: the columns shown, in order — checkbox, code, the ticked
  // optionals, open — each a fixed width, so ticking one widens the table. A
  // stored key this build has no column for stays in storage and is not drawn.
  const chooser = useFieldChooser(LIST_COLUMN_CHOICE.property.storageKey, optionalCols.map((c) => c.key), MAX_OPT, LIST_COLUMN_CHOICE.property.defaults);
  const shownCols = chooser.visible.flatMap((key) => optionalCols.filter((c) => c.key === key));
  // Slice #37.72: Poreclă always, the first after the checkbox. Slice #38.57: the list's own columns, one line each.
  const columns: ColumnName[] = ["listBadges", "listPropertyNickname", ...shownCols.map((c) => c.column), "listRowActions"];
  // Slice #37.84: the toolbar's group ends at the table frame's right edge, not the window's.
  const edge = useListEdge(columns);
  const colCount = columns.length;

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
          className="w-64 rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm placeholder:text-fade focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
        />

        {/* Slice #37.61: no „Importanță" or „Relevanță" filter; „Câmpuri afișate" is the
            shared chooser, its fields today's less importance, relevance and provenance. */}
        <FieldChooser
          label={t("chooseFields")}
          hint={t("chooseFieldsHint", { max: MAX_OPT })}
          fields={optionalCols}
          visible={chooser.visible}
          max={MAX_OPT}
          onToggle={chooser.toggle}
        />

        <div className="ml-auto flex items-center gap-2">
          {/* Slice #37.92: the whole-properties map's door, now the sidebar
              has one „Proprietăți" — at the left of the group, the Map icon
              with its words shown, like „Adaugă proprietate". */}
          <IconButton
            icon={MapIcon}
            label={t("wholeMap")}
            showLabel
            variant="secondary"
            size="lg"
            onClick={() => router.push("/properties/map")}
          />
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
          {/*
            Slice #32.20 — this was a plain <Link href="/properties/new">, which
            is the FIRST of the four ways <AddPropertyDialog> offers to add a
            property. The other three — a photographed coordinate table, a
            single .txt of index/X/Y rows, and a folder of them — were built,
            translated and then reachable from no button, menu or link anywhere
            in the application. The link is REPLACED rather than joined by a
            second control: the dialog's own "Manual data entry" card navigates
            to exactly /properties/new, so nothing is lost, and two Add buttons
            side by side would be a worse screen than one.

            A real <button> rather than a styled <a>, which also lets it take
            buttonClass() — :enabled / :disabled do not match an anchor, so the
            hand-rolled class it used to carry had no focus ring.
          */}
          <IconButton
            icon={Plus}
            label={t("addNew")}
            showLabel
            variant="primary"
            size="lg"
            onClick={() => setAddOpen(true)}
          />
        </div>
      </div>

      {deleteError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {deleteError}
        </p>
      )}

      {/* Table */}
      <ListPreviews>
        <div className={`${TABLE_FRAME} rounded-md border border-card-rim bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900`} {...edge.frame}>
          {/* Slice #38.57: the table fills its frame, which the toolbar may hold wider than the columns. */}
          <table {...fixedTable(columns, "text-sm min-w-full")}>
            <FixedColumns columns={columns} />
            <thead className="bg-cap text-left text-xs font-medium uppercase tracking-wide text-ink dark:bg-zinc-800 dark:text-zinc-300">
              <tr>
                <th className="px-4 py-2" {...columnHead("listBadges")}>
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
                <th className="px-4 py-2" {...columnHead("listPropertyNickname")}>
                  {t("table.nickname")}
                </th>
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
                    if (newTabIfAsked(e, `/properties/${item.id}`)) return;
                    router.push(`/properties/${item.id}`);
                  }}
                  onAuxClick={(e) => newTabIfAsked(e, `/properties/${item.id}`)}
                  className="align-top hover:bg-cta-pale dark:hover:bg-zinc-800/50 cursor-pointer"
                >
                  <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                    {/* Slice #37.16 had „the badges wrap — „Încrucișat" takes a line of its own rather than widening
                        the column". Slice #38.57: one line per row — the column holds all three (`listBadges`). */}
                    <span className="inline-flex flex-nowrap items-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleOne(item.id)}
                        aria-label={nameOr(item.nickname, "property")}
                        className="h-4 w-4 rounded border-wire accent-cta"
                      />
                      <RecencyBadge createdAt={item.createdAt} updatedAt={item.updatedAt} />
                      <BowTieBadge selfIntersects={item.cornerOrderSelfIntersects} />
                    </span>
                  </td>
                  <td className={`px-4 py-2 text-fade dark:text-zinc-400 ${ONE_LINE}`} data-col="nickname" title={cellTitle(item.nickname)}>
                    {item.nickname ?? <span className="text-fade italic">—</span>}
                  </td>
                  {shownCols.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-2 text-fade dark:text-zinc-400 ${ONE_LINE}`}
                      title={cellTitle(cellValue(item, col.key))}
                    >
                      {cellValue(item, col.key)}
                    </td>
                  ))}
                  <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                    {/* Slice #38.57: side by side, always. */}
                    <span className="flex flex-nowrap gap-2" data-row-actions="">
                      {/* Slice #38.71: the magnifier first, „Deschide" last (#38.72 puts the eye between them). */}
                      <PreviewButton target={{ kind: "property", id: item.id }} />
                      <IconButton
                        href={`/properties/${item.id}`}
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
      </ListPreviews>

      {/* Pagination */}
      <div className="flex w-fit max-w-full items-center justify-between gap-4" {...edge.frame}>
        <div className="text-xs text-fade dark:text-zinc-400">
          {query.data
            ? t("counts", { shown: query.data.items.length, total })
            : null}
        </div>
        <div className="flex items-center gap-3">
          <IconButton
            icon={ChevronLeft}
            label={tPag("previous")}
            variant="secondary"
            size="sm"
            onClick={() => setCurrentPage((p) => p - 1)}
            disabled={!paginate || currentPage === 0}
          />
          <span className="text-xs text-fade dark:text-zinc-400">
            {tPag("pageOf", { page: currentPage + 1, total: totalPages })}
          </span>
          <IconButton
            icon={ChevronRight}
            label={tPag("next")}
            variant="secondary"
            size="sm"
            onClick={() => setCurrentPage((p) => p + 1)}
            disabled={!paginate || currentPage >= totalPages - 1}
          />
        </div>
      </div>

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

      {addOpen && <AddPropertyDialog onClose={() => setAddOpen(false)} />}
    </div>
  );
}
