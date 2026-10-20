"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RecencyBadge } from "@/components/recency-badge";
import { BowTieBadge } from "@/components/bow-tie-badge";
import { ArrowRight, ChevronLeft, ChevronRight, Map as MapIcon, Plus } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { FixedColumns, ONE_LINE, cellTitle, columnHead, fixedTable } from "@/components/table/fixed-columns";
import { LIST_FRAME, LIST_HEAD, useListFit } from "@/components/list/list-fit";
import { HiddenColumnSigns } from "@/components/list/hidden-column-signs";
import { LIST_TOOLBAR, useListEdge } from "@/components/table/list-edge";
import { ListHeadCell } from "@/components/table/list-head";
import { twoRowName } from "@/lib/ui/list-head";
import type { ColumnName } from "@/lib/ui/field-widths";
import { AddPropertyDialog } from "./_components/add-property-dialog";
import { newTabIfAsked } from "@/lib/ui/row-link";
import { ListPreviewRow, ListPreviews, PreviewButton } from "@/components/tiles/preview-tiles";
import { IncursionButton, LinksButton } from "@/components/tiles/incursion-button";
import { IncursionTile } from "@/app/_components/incursion-tile";
import { useListAddress, useListScrollMemory, useWriteListAddress } from "@/components/list/use-list-address";
import { FieldChooser, useFieldChooser, type ChooserField } from "@/components/list/field-chooser";
import { LIST_ADD, ListSearchBox } from "@/components/list/list-search";
import { LIST_COLUMN_CHOICE } from "@/lib/ui/list-columns";
import { FilterBar, FilterFunnel, type FilterBarField } from "@/components/list/filter-bar";
import {
  appendFilterParams,
  filterAddressPatch,
  filterSignature,
  type FacetValue,
  type FilterState,
} from "@/lib/list/filter-bar";
import { PROPERTY_COLUMN_FILTERS, PROPERTY_FILTER_FIELDS, PROPERTY_FILTER_KEYS, parsePropertyFilters } from "@/lib/properties/list-filters";

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
// Slice #39.61: the filter bar's filters, in the address's words (`appendFilterParams`).
async function fetchProperties(q: string, page: number, filters: FilterState): Promise<ListResponse> {
  const url = new URL("/api/properties", window.location.origin);
  if (q)          url.searchParams.set("q",          q);
  appendFilterParams(url.searchParams, filters, PROPERTY_FILTER_FIELDS);
  url.searchParams.set("limit",  String(PAGE_SIZE));
  url.searchParams.set("offset", String(page * PAGE_SIZE));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

/**
 * Slice #39.61 — a checklist's values, counted with the search and every other filter applied. The field's own
 * filter is sent too: the route leaves it out of the counts, and names a ticked value the list no longer holds.
 */
async function fetchFilterValues(field: string, q: string, filters: FilterState): Promise<FacetValue[]> {
  const url = new URL("/api/properties/filter-values", window.location.origin);
  url.searchParams.set("field", field);
  if (q) url.searchParams.set("q", q);
  appendFilterParams(url.searchParams, filters, PROPERTY_FILTER_FIELDS);
  const res = await fetch(url);
  if (res.redirected || !res.ok) throw new Error(`Request failed (${res.status})`);
  const body = (await res.json()) as { items?: FacetValue[] };
  return body.items ?? [];
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

export function PropertyListView() {
  const t       = useTranslations("property");
  const tPag    = useTranslations("shared.pagination");
  const router = useRouter();

  // Slice #39.26: the view starts from the list's address — Back from a record brings it back as it was left.
  const address = useListAddress(PROPERTY_FILTER_KEYS);
  const [searchInput,     setSearchInput]     = useState(address.search);
  // Slice #39.61: the filter bar — from the address, like the search; a change goes back to the first page.
  const [filters, setFilters] = useState<FilterState>(() => parsePropertyFilters({ get: (k) => address.filters[k] ?? null }));
  const [editingFilter, setEditingFilter] = useState<string | null>(null);
  const filterSig = filterSignature(filters, PROPERTY_FILTER_FIELDS);
  function changeFilters(next: FilterState) {
    setFilters(next);
    setCurrentPage(0);
  }
  const [debouncedSearch, setDebouncedSearch] = useState(address.search);
  const [currentPage,     setCurrentPage]     = useState(address.page);

  // Slice #32.20 — the Add Property dialog's first and only entry point.
  const [addOpen,      setAddOpen]      = useState(false);

  // Slice #39.26: only a search that changed goes back to the first page — on mount the address's page stands.
  useEffect(() => {
    const next = searchInput.trim();
    if (next === debouncedSearch) return;
    const handle = setTimeout(() => {
      setDebouncedSearch(next);
      setCurrentPage(0);
    }, 250);
    return () => clearTimeout(handle);
  }, [searchInput, debouncedSearch]);

  const query = useQuery<ListResponse>({
    queryKey: ["properties", "list", debouncedSearch, currentPage, filterSig],
    queryFn:  () => fetchProperties(debouncedSearch, currentPage, filters),
  });

  const total      = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const paginate   = total > PAGE_SIZE;
  const items      = query.data?.items ?? [];

  // Slice #39.26: the view, in the list's address; the scroll, in the session. The search as typed, not debounced:
  // a link that carries it (Acte's type filter) must not find the box's last word missing.
  useWriteListAddress(
    { search: searchInput, page: currentPage, filters: filterAddressPatch(filters, PROPERTY_FILTER_FIELDS) },
    `${searchInput}|${currentPage}|${filterSig}`,
  );
  useListScrollMemory(query.isSuccess);
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
  // Slice #39.82: the bar's fields are the columns that filter (`PROPERTY_COLUMN_FILTERS`), each named as its column
  // is in „Câmpuri afișate" — so a chip reads as the column it filters, shown or not.
  const filterFields: FilterBarField[] = PROPERTY_FILTER_FIELDS.map((f) => ({
    key: f.key,
    kind: f.kind,
    label: optionalCols.find((c) => PROPERTY_COLUMN_FILTERS[c.key] === f.key)?.label ?? f.key,
  }));
  const filterLabel = (key: string) => filterFields.find((f) => f.key === key)?.label ?? key;

  // Slice #37.84: the toolbar's group ends at the table frame's right edge, not the window's.
  // Slice #40.02: the frame takes what is left of the window and scrolls its rows; the band of names sticks. Its
  // vertical scroll bar counts in the list's edge, so „Adaugă …" and the pagination row still end where the frame does.
  const fit = useListFit();
  const edge = useListEdge(columns, fit.gutter);
  const colCount = columns.length;

  return (
    // Slice #38.75: the whole list — toolbar to pagination — so its Incursiune is as tall as all of it.
    <ListPreviews
      incursion={IncursionTile}
      rowIds={query.data?.items.map((i) => i.id)}
      address={{ kind: "property", row: address.row, tiles: address.tiles }}
    >
      {/* Toolbar */}
      <div className={`flex flex-wrap items-center gap-3 ${LIST_TOOLBAR}`} {...edge.toolbar}>
        {/* Slice #39.85: as wide as „Adaugă …", its whole explanation on hover. */}
        <ListSearchBox value={searchInput} onChange={setSearchInput} explanation={t("searchPlaceholder")} />

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
          {/* Slice #39.73: no „Șterge selecția" here any more — a property is deleted only from its own form (Adrian,
              2026-10-17: „a property should be deleted only from the property form"), so the ticks went with it. */}
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
          {/* Slice #39.85: measured, so the search box can take its width. */}
          <span className="inline-flex" {...LIST_ADD}>
            <IconButton
              icon={Plus}
              label={t("addNew")}
              showLabel
              variant="primary"
              size="lg"
              onClick={() => setAddOpen(true)}
            />
          </span>
        </div>
      </div>

      {/* Slice #39.61 — the filter bar, a row of its own under the toolbar: a chip per filter and „Șterge filtrele"
          (since #39.82 no „+ Filtru" — a filter opens from its column's funnel). Not in the toolbar, whose width is the table frame's (#37.84): chips that came and went
          there would widen the frame and stretch the columns. */}
      <FilterBar
        fields={filterFields}
        state={filters}
        onChange={changeFilters}
        editing={editingFilter}
        onEditing={setEditingFilter}
        loadValues={(key) => fetchFilterValues(key, debouncedSearch, filters)}
        valuesKey={(key) => ["properties", "filter-values", key, debouncedSearch, filterSig]}
      />

      {/* Table */}
      <ListPreviewRow>
        <div className={`${LIST_FRAME} rounded-md border border-card-rim bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900`} {...edge.frame} {...fit.frame}>
          {/* Slice #40.03: red „<" / „>" at the band's visible edges while columns are hidden that way. */}
          <HiddenColumnSigns />
          {/* Slice #38.57: the table fills its frame, which the toolbar may hold wider than the columns. */}
          <table {...fixedTable(columns, "text-sm min-w-full")}>
            <FixedColumns columns={columns} />
            <thead className={LIST_HEAD}>
              <tr>
                {/* Slice #39.73: the badges' column, without the select-all box — nothing on this list acts on a selection. */}
                <th className="px-4 py-2" {...columnHead("listBadges")} />
                <ListHeadCell column="listPropertyNickname" name={t("table.nickname")} />
                {shownCols.map((col) => {
                  const filterKey = PROPERTY_COLUMN_FILTERS[col.key];
                  return (
                    <ListHeadCell
                      key={col.key}
                      column={col.column}
                      name={col.label}
                      twoRows={twoRowName("property", col.key)}
                      // Slice #39.82: a funnel only on the columns that filter; it opens the filter under itself. #39.83: on row 3.
                      funnel={
                        filterKey ? (
                          <FilterFunnel
                            field={filterKey}
                            label={filterLabel(filterKey)}
                            active={filters[filterKey] !== undefined}
                            onOpen={() => setEditingFilter(filterKey)}
                          />
                        ) : undefined
                      }
                    />
                  );
                })}
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
                  <td className="px-4 py-2" onClick={(e) => e.stopPropagation()} data-spills-into-padding="">
                    {/* Slice #37.16 had „the badges wrap — „Încrucișat" takes a line of its own rather than widening
                        the column". Slice #38.57: one line per row — the column holds all three (`listBadges`).
                        Slice #39.24: the column is the box and 11 px (the gap to the nickname at 30 %, Adrian). „Nou!"
                        stays beside the box and runs into the padding — `data-spills-into-padding` tells the e2e width
                        guard so (#39.64); „Încrucișat", on the rare row that has it, takes a line under them again. */}
                    <span className="inline-flex flex-wrap items-center" data-select-badges="">
                      <span className="inline-flex flex-nowrap items-center">
                        {/* Slice #39.73: no tick box — the list's delete is gone (above). */}
                        <RecencyBadge createdAt={item.createdAt} updatedAt={item.updatedAt} />
                      </span>
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
                      {/* Slice #38.71/#38.72/#38.76: the magnifier („Previzualizare"), the eye („Incursiune"), the chain link („Legături"), the arrow („Deschide"). */}
                      <PreviewButton target={{ kind: "property", id: item.id }} />
                      <IncursionButton target={{ kind: "property", id: item.id }} />
                      <LinksButton target={{ kind: "property", id: item.id }} />
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
      </ListPreviewRow>

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

      {addOpen && <AddPropertyDialog onClose={() => setAddOpen(false)} />}
    </ListPreviews>
  );
}
