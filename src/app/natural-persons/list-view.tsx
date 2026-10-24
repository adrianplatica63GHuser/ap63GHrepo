"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RecencyBadge } from "@/components/recency-badge";
import { ArrowRight, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { ONE_LINE, cellTitle, columnHead } from "@/components/table/fixed-columns";
import { FixedTable } from "@/components/table/column-resize";
import { LIST_FRAME, LIST_HEAD, useListFit } from "@/components/list/list-fit";
import { HiddenColumnSigns } from "@/components/list/hidden-column-signs";
import { LIST_TOOLBAR, useListEdge } from "@/components/table/list-edge";
import { ListHeadCell } from "@/components/table/list-head";
import { FirstCellText } from "@/components/list/first-cell";
import type { ColumnName } from "@/lib/ui/field-widths";
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
import { appendFilterParams, filterAddressPatch, filterSignature, type FacetValue, type FilterState } from "@/lib/list/filter-bar";
import { NATURAL_PERSON_COLUMN_FILTERS, NATURAL_PERSON_FILTER_FIELDS, parsePersonFilters, personFilterKeys } from "@/lib/persons/list-filters";
import { addedOn, dmyFromIso, personAgeText } from "@/lib/persons/person-age";
import { DeceasedMark } from "@/components/persons/deceased-mark";

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
  // Slice #39.30
  isDeceased:       boolean;
  dateOfDeath:      string | null;
  gender:           "MALE" | "FEMALE" | null;
  placeOfBirth:     string | null;
  professionalType: string | null;
  // Slice #39.70: „Relația cu firma", joined.
  relationships:    string | null;
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
// Slice #39.62: the filter bar's filters, in the address's words (`appendFilterParams`).
async function fetchNaturalPersons(q: string, page: number, filters: FilterState, order: ListOrder = DEFAULT_LIST_ORDER): Promise<ListResponse> {
  const url = new URL("/api/people", window.location.origin);
  appendFilterParams(url.searchParams, filters, NATURAL_PERSON_FILTER_FIELDS);
  appendOrderParams(url.searchParams, order);
  if (q)          url.searchParams.set("q",          q);
  url.searchParams.set("limit",  String(PAGE_SIZE));
  url.searchParams.set("offset", String(page * PAGE_SIZE));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

/** Slice #39.62 — a checklist's values, counted with the search and every other filter applied (#39.61's route). */
async function fetchFilterValues(field: string, q: string, filters: FilterState): Promise<FacetValue[]> {
  const url = new URL("/api/people/filter-values", window.location.origin);
  url.searchParams.set("field", field);
  if (q) url.searchParams.set("q", q);
  appendFilterParams(url.searchParams, filters, NATURAL_PERSON_FILTER_FIELDS);
  const res = await fetch(url);
  if (res.redirected || !res.ok) throw new Error(`Request failed (${res.status})`);
  const body = (await res.json()) as { items?: FacetValue[] };
  return body.items ?? [];
}

/** Slice #39.62 — the filter keys, read from the address. */
const FILTER_KEYS = [...personFilterKeys("NATURAL"), ...ORDER_KEYS];

export function NaturalPersonListView() {
  const t       = useTranslations("naturalPerson");
  // Slice 40.20: the band's and „Câmpuri afișate"'s short names (Adrian, 2026-10-21); the forms keep `t`'s.
  const tHead   = useTranslations("naturalPerson.listHeads");
  const tOrder  = useTranslations("shared.columnOrder");
  const tPag    = useTranslations("shared.pagination");
  const router = useRouter();

  // Slice #39.26: the view starts from the list's address — Back from a record brings it back as it was left.
  const address = useListAddress(FILTER_KEYS);
  const [searchInput,     setSearchInput]     = useState(address.search);
  // Slice #39.62: the filter bar — from the address, like the search; a change goes back to the first page.
  const [filters, setFilters] = useState<FilterState>(() => parsePersonFilters("NATURAL", { get: (k) => address.filters[k] ?? null }));
  const [editingFilter, setEditingFilter] = useState<string | null>(null);
  const filterSig = filterSignature(filters, NATURAL_PERSON_FILTER_FIELDS);
  function changeFilters(next: FilterState) {
    setFilters(next);
    setCurrentPage(0);
  }
  // Slice 40.46: the list's order — the server's, from the address like the filters; a change goes back to the first page.
  const [listOrder, setListOrder] = useState<ListOrder>(() => readListOrder((k) => address.filters[k], LIST_SORTS.person));
  const orderSig = orderSignature(listOrder);
  function changeListOrder(next: ListOrder) {
    setListOrder(next);
    setCurrentPage(0);
  }
  const [debouncedSearch, setDebouncedSearch] = useState(address.search);
  const [currentPage,     setCurrentPage]     = useState(address.page);


  // Slice #37.60 — „Câmpuri afișate", the shared chooser (`field-chooser.tsx`).
  const optionalCols: ChooserField[] = [
    { key: "cnp",              label: tHead("cnp"), full: t("fields.cnp"),                  column: "listCnp" },
    { key: "dateOfBirth",      label: tHead("dateOfBirth"), full: t("fields.dateOfBirth"),          column: "listDate" },
    { key: "age",              label: tHead("age"), full: t("fields.age"),                  column: "listAge" },
    { key: "gender",           label: tHead("gender"), full: t("fields.gender"),               column: "listGender" },
    // Slice #39.30: „Data decesului" — „Decedat" itself is the „†" after the name.
    { key: "dateOfDeath",      label: tHead("dateOfDeath"), full: t("fields.dateOfDeath"),          column: "listDate" },
    { key: "placeOfBirth",     label: tHead("placeOfBirth"), full: t("fields.placeOfBirth"),         column: "listBirthPlace" },
    { key: "professionalType", label: tHead("professionalType"), full: t("fields.physicalPersonTypeId"), column: "listProfessionalType" },
    // Slice #39.70
    { key: "relationships",    label: tHead("relationships"), full: t("fields.relationships"),        column: "listRelationship" },
    // Slice 40.45: „Adăugat la", as on Acte — the day the record was added; its short name is its whole one.
    { key: "createdAt",        label: tHead("createdAt"), full: tHead("createdAt"),            column: "listDate" },
  ];
  const chooser = useFieldChooser(LIST_COLUMN_CHOICE.person.storageKey, optionalCols.map((c) => c.key), MAX_OPT, LIST_COLUMN_CHOICE.person.defaults);

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
    queryKey: ["people", "list", debouncedSearch, currentPage, filterSig, orderSig],
    queryFn:  () => fetchNaturalPersons(debouncedSearch, currentPage, filters, listOrder),
  });

  const total      = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const paginate   = total > PAGE_SIZE;
  const items      = query.data?.items ?? [];

  // Slice #39.26: the view, in the list's address; the scroll, in the session. The search as typed, not debounced:
  // a link that carries it (Acte's type filter) must not find the box's last word missing.
  useWriteListAddress(
    { search: searchInput, page: currentPage, filters: { ...filterAddressPatch(filters, NATURAL_PERSON_FILTER_FIELDS), ...orderAddressPatch(listOrder) } },
    `${searchInput}|${currentPage}|${filterSig}|${orderSig}`,
  );
  useListScrollMemory(query.isSuccess);

  /** Slice #37.60: a ticked „Identitate" field's cell — as the form shows it. */
  function cellValue(item: NaturalPersonListItem, key: string): React.ReactNode {
    switch (key) {
      case "cnp":              return item.cnp;
      case "dateOfBirth":      return dmyFromIso(item.dateOfBirth);
      // Slice #39.30: stopped at the death and marked „78 †"; „Decedat" for a dead person with no date.
      case "age":              return personAgeText(item, t("fields.isDeceased"));
      case "dateOfDeath":      return dmyFromIso(item.dateOfDeath);
      case "gender":           return item.gender === "MALE" ? t("options.gender.MALE") : item.gender === "FEMALE" ? t("options.gender.FEMALE") : null;
      case "placeOfBirth":     return item.placeOfBirth;
      case "professionalType": return item.professionalType;
      case "relationships":    return item.relationships;
      case "createdAt":        return addedOn(item.createdAt);
      default:                 return null;
    }
  }

  // Slice #37.16: the columns shown, in order — each a fixed width from
  // `COLUMN`, so an optional column ticked in „Câmpuri afișate" widens the
  // table rather than squeezing the others.
  // A stored key this build has no column for stays in storage and is not drawn.
  const shownCols = chooser.visible.flatMap((key) => optionalCols.filter((c) => c.key === key));
  // Slice #38.57: the list's own columns, one line each.
  // Slice 40.24: no badges' column before the name — „Nou!" is in the name's cell (`FirstCellText`).
  // Slice 40.25: every named column in the order dragged, the fixed ones included; the row buttons' column stays last.
  const FIXED_COLUMNS: ColumnName[] = ["listPersonName", "listPersonNickname"];
  const fixedKeys = ["name", "nickname"];
  const order = useColumnOrder(LIST_COLUMN_ORDER.person, [...fixedKeys, ...shownCols.map((c) => c.key)]);
  const headName = (key: string) => (fixedKeys.includes(key) ? tHead(key) : shownCols.find((c) => c.key === key)?.label ?? key);
  const drag = useColumnDrag({ keys: order.keys, names: Object.fromEntries(order.keys.map((k) => [k, headName(k)])), onMove: order.move });
  const columnOf = (key: string): ColumnName =>
    fixedKeys.includes(key) ? FIXED_COLUMNS[fixedKeys.indexOf(key)] : (shownCols.find((c) => c.key === key)?.column ?? "listRowActions");
  const columns: ColumnName[] = [...order.keys.map(columnOf), "listRowActions"];
  // Slice #39.82: the bar's fields are the columns that filter (`NATURAL_PERSON_COLUMN_FILTERS`), each named as its
  // column is in „Câmpuri afișate" — so a chip reads as the column it filters, shown or not.
  const filterFields: FilterBarField[] = NATURAL_PERSON_FILTER_FIELDS.map((f) => ({
    key: f.key,
    kind: f.kind,
    // Slice 40.20: a filter keeps the field's whole label, not the band's short one.
    label: optionalCols.find((c) => NATURAL_PERSON_COLUMN_FILTERS[c.key] === f.key)?.full ?? f.key,
    ...(f.key === "gender" ? { valueLabel: (id: string) => (id === "MALE" ? t("options.gender.MALE") : id === "FEMALE" ? t("options.gender.FEMALE") : id) } : {}),
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
      address={{ kind: "person", row: address.row, tiles: address.tiles }}
    >
      {/* Toolbar */}
      {/* Slice 40.30: the toolbar one step down — „Adaugă …" md, the other buttons sm, the search box 30 px, 8-px gaps. */}
      <div className={`flex flex-wrap items-center gap-2 ${LIST_TOOLBAR}`} {...edge.toolbar}>
        {/* Slice #39.85: as wide as „Adaugă …", its whole explanation on hover. */}
        <ListSearchBox value={searchInput} onChange={setSearchInput} explanation={t("searchPlaceholder")} small list="naturalPerson" />

        {/* Slice #37.60: no „Importanță" or „Relevanță" filter; „Câmpuri afișate" offers
            the „Identitate" fields. */}
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
          {/* Slice #39.85: measured, so the search box could take its width; 40.37: „+ Nou" and the list's Domeniu icon, its
              name and tooltip the whole „Adaugă …", the search box pinned at the old width (LIST_SEARCH_REM). */}
          <span className="inline-flex" {...LIST_ADD}>
            <IconButton
              href="/natural-persons/new"
              icon={Plus}
              label={t("newCaption")}
              fullName={t("addNew")}
              trailingIcon={domainIcon("naturalPeople")}
              showLabel
              variant="primary"
              size="md"
            />
          </span>
        </div>
      </div>

      {/* Slice #39.62 — the filter bar, a row of its own under the toolbar, as on Proprietăți (#39.61). */}
      <FilterBar
        fields={filterFields}
        state={filters}
        onChange={changeFilters}
        editing={editingFilter}
        onEditing={setEditingFilter}
        loadValues={(key) => fetchFilterValues(key, debouncedSearch, filters)}
        valuesKey={(key) => ["people", "filter-values", key, debouncedSearch, filterSig]}
      />


      {/* Results table */}
      <ListPreviewRow>
        <div className={`${LIST_FRAME} rounded-md border border-card-rim bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900`} {...edge.frame} {...fit.frame}>
          {/* Slice #40.03: red „<" / „>" at the band's visible edges while columns are hidden that way. */}
          <HiddenColumnSigns />
          {drag.layer}
          {/* Slice #38.57: the table fills its frame, which the toolbar may hold wider than the columns. */}
          <FixedTable id="natural-persons" columns={columns} className="text-sm min-w-full">
            <thead className={LIST_HEAD}>
              <tr>
                {/* Slice 40.25: in the order dragged, each name cell its column's handle. */}
                {order.keys.map((key) => {
                  if (key === "name") return <ListHeadCell key={key} column="listPersonName" name={tHead("name")} full={t("table.name")} drag={drag.headProps(key)} />;
                  if (key === "nickname") return <ListHeadCell key={key} column="listPersonNickname" name={tHead("nickname")} full={t("table.nickname")} drag={drag.headProps(key)} />;
                  const col = shownCols.find((c) => c.key === key);
                  if (!col) return null;
                  const filterKey = NATURAL_PERSON_COLUMN_FILTERS[col.key];
                  return (
                    <ListHeadCell
                      key={col.key}
                      column={col.column}
                      name={col.label}
                      full={col.full}
                      // Slice #39.82: a funnel only on the columns that filter; it opens the filter under itself. #39.83: on row 3.
                      funnel={filterKey ? <FilterFunnel field={filterKey} label={filterLabel(filterKey)} active={filters[filterKey] !== undefined} onOpen={() => setEditingFilter(filterKey)} /> : undefined}
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
                    if (newTabIfAsked(e, `/natural-persons/${item.id}`)) return;
                    router.push(`/natural-persons/${item.id}`);
                  }}
                  onAuxClick={(e) => newTabIfAsked(e, `/natural-persons/${item.id}`)}
                  className="align-top hover:bg-cta-pale dark:hover:bg-zinc-800/50 cursor-pointer"
                >
                  {order.keys.map((key) =>
                    key === "name" ? (
                      <td key={key} className={`px-4 py-1 font-medium ${ONE_LINE}`} title={cellTitle(item.displayName)}>
                        <FirstCellText badges={<RecencyBadge createdAt={item.createdAt} updatedAt={item.updatedAt} />}>
                          {item.displayName || (
                            <span className="text-fade italic">—</span>
                          )}
                          {item.isDeceased && <DeceasedMark />}
                        </FirstCellText>
                      </td>
                    ) : key === "nickname" ? (
                      <td key={key} className={`px-4 py-1 text-fade dark:text-zinc-400 ${ONE_LINE}`} title={cellTitle(item.nickname)}>
                        {item.nickname || <span className="italic">—</span>}
                      </td>
                    ) : (
                      <td key={key} className={`px-4 py-1 text-fade dark:text-zinc-400 ${ONE_LINE}`} title={cellTitle(cellValue(item, key))}>
                        {cellValue(item, key) ?? <span className="italic">—</span>}
                      </td>
                    ),
                  )}
                  <td className="px-4 py-1" onClick={(e) => e.stopPropagation()}>
                    {/* Slice #38.57: side by side, always. */}
                    <span className="flex flex-nowrap gap-1.5" data-row-actions="">
                      {/* Slice #38.71/#38.72/#38.76: the magnifier („Previzualizare"), the eye („Incursiune"), the chain link („Legături"), the arrow („Deschide"). */}
                      <PreviewButton target={{ kind: "person", id: item.id }} square="row" />
                      <IncursionButton target={{ kind: "person", id: item.id }} square="row" />
                      <LinksButton target={{ kind: "person", id: item.id }} square="row" />
                      <IconButton
                        href={`/natural-persons/${item.id}`}
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

    </ListPreviews>
  );
}
