"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RecencyBadge } from "@/components/recency-badge";
import { BowTieBadge } from "@/components/bow-tie-badge";
import { ArrowRight, ChevronLeft, ChevronRight, Map as MapIcon, Plus } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { ONE_LINE, cellTitle, columnHead } from "@/components/table/fixed-columns";
import { FixedTable } from "@/components/table/column-resize";
import { LIST_FRAME, LIST_HEAD, useListFit } from "@/components/list/list-fit";
import { HiddenColumnSigns } from "@/components/list/hidden-column-signs";
import { LIST_TOOLBAR, useListEdge } from "@/components/table/list-edge";
import { ListHeadCell } from "@/components/table/list-head";
import { FirstCellText } from "@/components/list/first-cell";
import type { ColumnName } from "@/lib/ui/field-widths";
import { addedOn } from "@/lib/persons/person-age";
import { AddPropertyDialog } from "./_components/add-property-dialog";
import { newTabIfAsked } from "@/lib/ui/row-link";
import { ListPreviewRow, ListPreviews, PreviewButton } from "@/components/tiles/preview-tiles";
import { IncursionButton, LinksButton } from "@/components/tiles/incursion-button";
import { IncursionTile } from "@/app/_components/incursion-tile";
import { useListAddress, useListScrollMemory, useWriteListAddress } from "@/components/list/use-list-address";
import { FieldChooser, useFieldChooser, type ChooserField } from "@/components/list/field-chooser";
import { LIST_ADD, ListSearchBox } from "@/components/list/list-search";
import { domainIcon } from "@/components/sidebar/nav-config";
import { LIST_COLUMN_CHOICE, LIST_COLUMN_ORDER } from "@/lib/ui/list-columns";
import { useColumnDrag, useColumnOrder } from "@/components/list/column-order";
import { FilterBar, FilterFunnel, type FilterBarField } from "@/components/list/filter-bar";
import { ListSortButton } from "@/components/list/list-sort-button";
import { DEFAULT_LIST_ORDER, LIST_SORTS, ORDER_KEYS, appendOrderParams, orderAddressPatch, orderSignature, readListOrder, type ListOrder } from "@/lib/list/list-order";
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
async function fetchProperties(q: string, page: number, filters: FilterState, order: ListOrder = DEFAULT_LIST_ORDER): Promise<ListResponse> {
  const url = new URL("/api/properties", window.location.origin);
  if (q)          url.searchParams.set("q",          q);
  appendFilterParams(url.searchParams, filters, PROPERTY_FILTER_FIELDS);
  appendOrderParams(url.searchParams, order);
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

/** Slice 40.46: the filter bar's keys and the list's order (`sort`, `order`) — what the list reads from its address. */
const FILTER_KEYS = [...PROPERTY_FILTER_KEYS, ...ORDER_KEYS];

export function PropertyListView() {
  const t       = useTranslations("property");
  // Slice 40.20: the band's and „Câmpuri afișate"'s short names (Adrian, 2026-10-21); the forms keep `t`'s.
  const tHead   = useTranslations("property.listHeads");
  const tOrder  = useTranslations("shared.columnOrder");
  const tPag    = useTranslations("shared.pagination");
  const router = useRouter();

  // Slice #39.26: the view starts from the list's address — Back from a record brings it back as it was left.
  const address = useListAddress(FILTER_KEYS);
  const [searchInput,     setSearchInput]     = useState(address.search);
  // Slice #39.61: the filter bar — from the address, like the search; a change goes back to the first page.
  const [filters, setFilters] = useState<FilterState>(() => parsePropertyFilters({ get: (k) => address.filters[k] ?? null }));
  const [editingFilter, setEditingFilter] = useState<string | null>(null);
  const filterSig = filterSignature(filters, PROPERTY_FILTER_FIELDS);
  function changeFilters(next: FilterState) {
    setFilters(next);
    setCurrentPage(0);
  }
  // Slice 40.46: the list's order — the server's, from the address like the filters; a change goes back to the first page.
  const [listOrder, setListOrder] = useState<ListOrder>(() => readListOrder((k) => address.filters[k], LIST_SORTS.property));
  const orderSig = orderSignature(listOrder);
  function changeListOrder(next: ListOrder) {
    setListOrder(next);
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
    queryKey: ["properties", "list", debouncedSearch, currentPage, filterSig, orderSig],
    queryFn:  () => fetchProperties(debouncedSearch, currentPage, filters, listOrder),
  });

  const total      = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const paginate   = total > PAGE_SIZE;
  const items      = query.data?.items ?? [];

  // Slice #39.26: the view, in the list's address; the scroll, in the session. The search as typed, not debounced:
  // a link that carries it (Acte's type filter) must not find the box's last word missing.
  useWriteListAddress(
    { search: searchInput, page: currentPage, filters: { ...filterAddressPatch(filters, PROPERTY_FILTER_FIELDS), ...orderAddressPatch(listOrder) } },
    `${searchInput}|${currentPage}|${filterSig}|${orderSig}`,
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
    { key: "tarlaSola",        label: tHead("tarlaSola"), full: t("table.tarlaSola"),        column: "listTarla" },
    { key: "parcela",          label: tHead("parcela"), full: t("table.parcela"),          column: "listParcela" },
    { key: "surfaceAreaMp",    label: tHead("surfaceAreaMp"), full: t("table.surfaceAreaMp"),    column: "listArea" },
    { key: "calculatedAreaMp", label: tHead("calculatedAreaMp"), full: t("table.calculatedAreaMp"), column: "listArea" },
    { key: "carteFunciara",    label: tHead("carteFunciara"), full: t("table.carteFunciara"),    column: "listCarteFunciara" },
    { key: "cadastralNumber",  label: tHead("cadastralNumber"), full: t("table.cadastralNumber"),  column: "listCadastral" },
    // Slice #37.72: the two the chooser lacked, labelled as on the form.
    { key: "useCategory",      label: tHead("useCategory"), full: t("fields.useCategory"),     column: "listUseCategory" },
    { key: "propertyType",     label: tHead("propertyType"), full: t("fields.propertyType"),    column: "listPropertyType" },
    { key: "locality",         label: tHead("locality"), full: t("table.locality"),         column: "listLocality" },
    // Slice 40.45: „Adăugat la", as on Acte — the day the record was added; its short name is its whole one.
    { key: "createdAt",        label: tHead("createdAt"), full: tHead("createdAt"),        column: "listDate" },
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
      case "createdAt":        return addedOn(item.createdAt);
      default:                 return null;
    }
  }

  // Slice #37.16: the columns shown, in order — checkbox, code, the ticked
  // optionals, open — each a fixed width, so ticking one widens the table. A
  // stored key this build has no column for stays in storage and is not drawn.
  const chooser = useFieldChooser(LIST_COLUMN_CHOICE.property.storageKey, optionalCols.map((c) => c.key), MAX_OPT, LIST_COLUMN_CHOICE.property.defaults);
  const shownCols = chooser.visible.flatMap((key) => optionalCols.filter((c) => c.key === key));
  // Slice #37.72: Poreclă always, the first after the checkbox. Slice #38.57: the list's own columns, one line each.
  // Slice 40.24: no badges' column before the nickname — „Nou!" and „Încrucișat" are in its cell (`FirstCellText`).
  // Slice 40.25: every named column in the order dragged, Poreclă included; the row buttons' column stays last.
  const FIXED_COLUMNS: ColumnName[] = ["listPropertyNickname"];
  const fixedKeys = ["nickname"];
  const order = useColumnOrder(LIST_COLUMN_ORDER.property, [...fixedKeys, ...shownCols.map((c) => c.key)]);
  const headName = (key: string) => (fixedKeys.includes(key) ? tHead(key) : shownCols.find((c) => c.key === key)?.label ?? key);
  const drag = useColumnDrag({ keys: order.keys, names: Object.fromEntries(order.keys.map((k) => [k, headName(k)])), onMove: order.move });
  const columnOf = (key: string): ColumnName =>
    fixedKeys.includes(key) ? FIXED_COLUMNS[fixedKeys.indexOf(key)] : (shownCols.find((c) => c.key === key)?.column ?? "listRowActions");
  const columns: ColumnName[] = [...order.keys.map(columnOf), "listRowActions"];
  // Slice #39.82: the bar's fields are the columns that filter (`PROPERTY_COLUMN_FILTERS`), each named as its column
  // is in „Câmpuri afișate" — so a chip reads as the column it filters, shown or not.
  const filterFields: FilterBarField[] = PROPERTY_FILTER_FIELDS.map((f) => ({
    key: f.key,
    kind: f.kind,
    // Slice 40.20: a filter keeps the field's whole label, not the band's short one.
    label: optionalCols.find((c) => PROPERTY_COLUMN_FILTERS[c.key] === f.key)?.full ?? f.key,
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
      {/* Slice 40.30: the toolbar one step down — „Adaugă …" md, the other buttons sm, the search box 30 px, 8-px gaps. */}
      <div className={`flex flex-wrap items-center gap-2 ${LIST_TOOLBAR}`} {...edge.toolbar}>
        {/* Slice #39.85: as wide as „Adaugă …", its whole explanation on hover. */}
        <ListSearchBox value={searchInput} onChange={setSearchInput} explanation={t("searchPlaceholder")} small list="property" />

        {/* Slice #37.61: no „Importanță" or „Relevanță" filter; „Câmpuri afișate" is the
            shared chooser, its fields today's less importance, relevance and provenance. */}
        <FieldChooser
          label={t("chooseFields")}
          hint={t("chooseFieldsHint", { max: MAX_OPT })}
          fields={optionalCols}
          visible={chooser.visible}
          max={MAX_OPT}
          // Slice 40.25: an unticked column leaves the dragged order, so it comes back at the end.
          onToggle={(key) => { if (chooser.visible.includes(key)) order.forget(key); chooser.toggle(key); }}
          onResetOrder={order.custom ? order.reset : undefined}
          resetOrderLabel={tOrder("defaultOrder")}
        />

        {/* Slice 40.46: the sort button, right after „Câmpuri afișate" — the record changed last first by default. */}
        <ListSortButton order={listOrder} onChange={changeListOrder} />

        <div className="ml-auto flex items-center gap-2">
          {/* Slice #37.92: the whole-properties map's door, now the sidebar
              has one „Proprietăți" — at the left of the group, the Map icon
              with its words shown, like „Adaugă proprietate". */}
          <IconButton
            icon={MapIcon}
            label={t("wholeMap")}
            showLabel
            variant="secondary"
            size="md"
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
          {/* Slice #39.85: measured, so the search box could take its width; 40.37: „+ Nou" and the list's Domeniu icon, its
              name and tooltip the whole „Adaugă …", the search box pinned at the old width (LIST_SEARCH_REM). */}
          <span className="inline-flex" {...LIST_ADD}>
            <IconButton
              icon={Plus}
              label={t("newCaption")}
              fullName={t("addNew")}
              trailingIcon={domainIcon("propertyList")}
              showLabel
              variant="primary"
              size="md"
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
          {drag.layer}
          {/* Slice #38.57: the table fills its frame, which the toolbar may hold wider than the columns. */}
          <FixedTable id="properties" columns={columns} className="text-sm min-w-full">
            <thead className={LIST_HEAD}>
              <tr>
                {/* Slice 40.25: in the order dragged, each name cell its column's handle. */}
                {order.keys.map((key) => {
                  if (key === "nickname") return <ListHeadCell key={key} column="listPropertyNickname" name={tHead("nickname")} full={t("table.nickname")} drag={drag.headProps(key)} />;
                  const col = shownCols.find((c) => c.key === key);
                  if (!col) return null;
                  const filterKey = PROPERTY_COLUMN_FILTERS[col.key];
                  return (
                    <ListHeadCell
                      key={col.key}
                      column={col.column}
                      name={col.label}
                      full={col.full}
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
                      drag={drag.headProps(col.key)}
                    />
                  );
                })}
                <th className="px-4 py-[2.5px]" {...columnHead("listRowActions")} />
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
                  {order.keys.map((key) =>
                    key === "nickname" ? (
                      <td key={key} className={`px-4 py-1 text-fade dark:text-zinc-400 ${ONE_LINE}`} data-col="nickname" title={cellTitle(item.nickname)}>
                        <FirstCellText
                          badges={
                            <>
                              <RecencyBadge createdAt={item.createdAt} updatedAt={item.updatedAt} />
                              <BowTieBadge selfIntersects={item.cornerOrderSelfIntersects} />
                            </>
                          }
                        >
                          {item.nickname ?? <span className="text-fade italic">—</span>}
                        </FirstCellText>
                      </td>
                    ) : (
                      <td key={key} className={`px-4 py-1 text-fade dark:text-zinc-400 ${ONE_LINE}`} title={cellTitle(cellValue(item, key))}>
                        {cellValue(item, key)}
                      </td>
                    ),
                  )}
                  <td className="px-4 py-1" onClick={(e) => e.stopPropagation()}>
                    {/* Slice #38.57: side by side, always. */}
                    <span className="flex flex-nowrap gap-1.5" data-row-actions="">
                      {/* Slice #38.71/#38.72/#38.76: the magnifier („Previzualizare"), the eye („Incursiune"), the chain link („Legături"), the arrow („Deschide"). */}
                      <PreviewButton target={{ kind: "property", id: item.id }} square="row" />
                      <IncursionButton target={{ kind: "property", id: item.id }} square="row" />
                      <LinksButton target={{ kind: "property", id: item.id }} square="row" />
                      <IconButton
                        href={`/properties/${item.id}`}
                        icon={ArrowRight}
                        label={t("open")}
                        variant="secondary"
                        size="xs"
                        square="row"
                      />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </FixedTable>
        </div>
      </ListPreviewRow>

      {/* Pagination — Slice 40.30: „‹" and „›" xs (they were sm), as on the person lists. */}
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
            size="xs"
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
            size="xs"
            onClick={() => setCurrentPage((p) => p + 1)}
            disabled={!paginate || currentPage >= totalPages - 1}
          />
        </div>
      </div>

      {addOpen && <AddPropertyDialog onClose={() => setAddOpen(false)} />}
    </ListPreviews>
  );
}
