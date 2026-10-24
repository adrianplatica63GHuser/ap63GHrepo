"use client";

import { documentTypeShortName } from "@/lib/documents/type-short-name";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { RecencyBadge } from "@/components/recency-badge";
import { buttonClass } from "@/lib/ui/button-styles";
import { ArrowRight, CalendarClock, ChevronDown, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { ONE_LINE, cellTitle, columnHead } from "@/components/table/fixed-columns";
import { FixedTable } from "@/components/table/column-resize";
import { LIST_FRAME, LIST_HEAD, useListFit } from "@/components/list/list-fit";
import { HiddenColumnSigns } from "@/components/list/hidden-column-signs";
import { LIST_TOOLBAR, useListEdge } from "@/components/table/list-edge";
import { ListHeadCell } from "@/components/table/list-head";
import { FirstCellText } from "@/components/list/first-cell";
import type { ColumnName } from "@/lib/ui/field-widths";
import { customFieldValueLabel } from "@/lib/documents/custom-field-options";
import { customFieldFilter, customFieldState, typeFilterTrigger, typesMatching } from "@/lib/documents/type-filter";
import { CustomFieldSign } from "@/components/documents/custom-field-sign";
import { newTabIfAsked } from "@/lib/ui/row-link";
import { ListPreviewRow, ListPreviews, PreviewButton } from "@/components/tiles/preview-tiles";
import { IncursionButton, LinksButton } from "@/components/tiles/incursion-button";
import { IncursionTile } from "@/app/_components/incursion-tile";
import { ownListAddress, useListAddress, useListScrollMemory, useWriteListAddress } from "@/components/list/use-list-address";
import { LIST_PARAM, carryListAddress } from "@/lib/ui/list-address";
import { FieldChooser, useFieldChooser, type ChooserField } from "@/components/list/field-chooser";
import { LIST_ADD, ListSearchBox } from "@/components/list/list-search";
import { domainIcon } from "@/components/sidebar/nav-config";
import { LIST_COLUMN_CHOICE, LIST_COLUMN_ORDER } from "@/lib/ui/list-columns";
import { useColumnDrag, useColumnOrder } from "@/components/list/column-order";
import { HintBubble } from "@/lib/ui/hint-bubble";
import { addedOn, dmyFromIso } from "@/lib/persons/person-age";
import { FilterBar, FilterFunnel, type FilterBarField } from "@/components/list/filter-bar";
import { ListSortButton } from "@/components/list/list-sort-button";
import { DEFAULT_LIST_ORDER, LIST_SORTS, ORDER_KEYS, appendOrderParams, orderAddressPatch, orderSignature, readListOrder, type ListOrder } from "@/lib/list/list-order";
import { appendFilterParams, filterAddressPatch, filterSignature, type FacetValue, type FilterState } from "@/lib/list/filter-bar";
import { DOCUMENT_COLUMN_FILTERS, DOCUMENT_FILTER_FIELDS, DOCUMENT_FILTER_KEYS, parseDocumentFilters } from "@/lib/documents/list-filters";

const PAGE_SIZE   = 15;
// Slice #37.94: the key and the defaults (none) are LIST_COLUMN_CHOICE.document.
const MAX_OPT     = 4;

// ---------------------------------------------------------------------------
// Document-type filter dropdown (URL-based, unchanged from pre-refactor)
// ---------------------------------------------------------------------------

type DocumentTypeOption = {
  id:   string;
  key:  string;
  name: string;
  /**
   * The raw `template_fields` jsonb.                           (Slice #34.10)
   *
   * ⚠️ **DECLARED, NOT ADDED — the rows have always carried it.** The comment
   * below spells out at length that `fetchDocumentTypes` must keep returning
   * `body.items` RAW because the document form reads this very column off the
   * shared cache. This type named three of the columns and the omission was
   * itself the trap that comment warns about: the obvious tidy-up it forbids
   * (`.map(({ id, name }) => …)`) is exactly what a reader would conclude was
   * safe from a type that says the other columns are not there.
   *
   * `unknown`, and read only through `parseTemplateFields` — the contract every
   * other holder of this column keeps, and the reason a template that parses to
   * no usable field cannot read as a form here.
   */
  templateFields?: unknown;
};

/**
 * ⚠️ **Shares the react-query key `["document-types"]` with the document form's
 * own copy of this function** (`_components/document-form.tsx`), so whichever
 * page loads first fills the cache both of them read.   (Slice #27.02)
 *
 * That is fine only because both return `body.items` RAW. The form reads
 * `templateFields` off those rows to mark the types that have a custom form and
 * to decide whether to show its "this type has no form" hint; the day this
 * function starts projecting (`.map(({ id, name }) => …)`, an obvious tidy given
 * the type below names three fields), a user who arrives via the Documents list
 * gets a form that marks nothing and tells them every type is formless —
 * including the ones that are not. Project here and the form must stop sharing
 * the key, or read the column it needs from somewhere else.
 */
// ⚠️ **`res.redirected` as well as `!res.ok`.**                 (Slice #34.04)
// An expired session answers with a redirect to the login page, whose HTML
// parses to `{}` — and `body.items ?? []` then reads as "the archive holds
// none", so React Query caches a SUCCESSFUL EMPTY ARRAY and the dropdown is
// silently empty with no error for the length of its staleTime. Fixed in
// passing: #34.04 made this class of failure its subject and measured it on the
// keys it shares, and `person-role-flags.test.ts` now asserts the guard on
// EVERY read of the value-lists endpoint rather than on the ones it happened
// to touch.
async function fetchDocumentTypes(): Promise<DocumentTypeOption[]> {
  const res = await fetch("/api/admin/value-lists/document-types");
  if (res.redirected || !res.ok) throw new Error(`Request failed (${res.status})`);
  const body = await res.json();
  return body.items ?? [];
}

/**
 * The values one custom field holds, for the types on screen.  (Slice #34.10)
 *
 * ⚠️ **`documentTypeIds` is sent as the three-state parameter the documents
 * endpoint already defines** — omitted for "every type", empty for "nothing
 * selected". `?? []` would collapse the two and offer values off the whole
 * archive on a screen showing no rows.
 *
 * ⚠️ **`res.redirected` as well as `!res.ok`, for the reason
 * `fetchDocumentTypes` above states at length**: an expired session answers
 * with a redirect whose HTML parses to `{}`, and `body.items ?? []` then reads
 * as "this field holds no values" — a silently empty dropdown, cached, with no
 * error, for the length of its staleTime.
 */
async function fetchCustomFieldValues(
  key: string,
  documentTypeIds: string[] | undefined,
): Promise<{ value: string; count: number }[]> {
  const url = new URL("/api/documents/custom-field-values", window.location.origin);
  url.searchParams.set("key", key);
  if (documentTypeIds !== undefined) {
    url.searchParams.set("documentTypeIds", documentTypeIds.join(","));
  }
  const res = await fetch(url);
  if (res.redirected || !res.ok) throw new Error(`Request failed (${res.status})`);
  const body = await res.json();
  return body.items ?? [];
}

/** Slice 40.31: the „Tip" column's funnel — its `data-filter-funnel` and the filter bar's `editing` while open. */
const TYPE_FUNNEL = "documentType";

/** Slice #39.26: Acte's own filters in its address — „Expiră curând" and the custom field's key and value. */
const DOCUMENT_ADDRESS_FILTERS = ["expiring", "field", "value"] as const;
/** Slice #39.63: and the shared bar's fields — every key the list reads from, and carries in, its address. */
// Slice 40.46: and the list's order (`sort`, `order`) — carried by a new set of types like the filters.
const FILTER_KEYS = [...DOCUMENT_ADDRESS_FILTERS, ...DOCUMENT_FILTER_KEYS, ...ORDER_KEYS];

function buildDocumentsUrl(checkedIds: Set<string>, allTypeIds: string[]): string {
  // Slice #39.26: the search and the list's own filters ride along in the address — a new set of types keeps them,
  // as it did while they were React state; the page starts over (`carryListAddress`, and the list's own reset on
  // `typeFiltersKey`).
  const carried = carryListAddress(new URLSearchParams(window.location.search), FILTER_KEYS);
  const current = new URLSearchParams(window.location.search);
  // Slice #39.96: the list is no longer started over under a tick (`ownListAddress`, below), so a preview open beside
  // it stays open — and stays in the address, which says so.
  for (const k of [LIST_PARAM.row, LIST_PARAM.tiles]) {
    const v = current.get(k);
    if (v) carried.set(k, v);
  }
  if (checkedIds.size !== allTypeIds.length) carried.set("documentTypeIds", Array.from(checkedIds).join(","));
  const qs = carried.toString();
  // Slice #39.96: the list's own navigation, not one from outside — so the „Tip document:" checklist stays open.
  return ownListAddress(qs ? `/documents?${qs}` : "/documents");
}

/**
 * The checklist of document types — „Toate tipurile", the search box, a box per type — writing `documentTypeIds`
 * into the address (`buildDocumentsUrl`). Slice 40.31: its own component, so the toolbar's „Tip document:" and the
 * funnel on the „Tip" column open the very same control: the two always show the one choice.
 */
function TypeChecklist({
  types,
  initialDocumentTypeIds,
  allTypesLabel,
  searchPlaceholder,
  searchEmptyLabel,
  onEscape,
}: {
  types: DocumentTypeOption[];
  initialDocumentTypeIds?: string[];
  allTypesLabel: string;
  searchPlaceholder: string;
  searchEmptyLabel: string;
  /** Esc in the search box (the toolbar's dropdown closes on it; under the funnel the filter bar does). */
  onEscape?: () => void;
}) {
  const router = useRouter();
  // Slice #38.48: the search box — focused when the checklist opens; a fresh one each time it does.
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    searchRef.current?.focus();
  }, []);
  const shownTypes = typesMatching(types, query);

  const allTypeIds = types.map((ty) => ty.id);
  const checkedIds = new Set(
    initialDocumentTypeIds === undefined ? allTypeIds : initialDocumentTypeIds,
  );
  const allChecked  = types.length > 0 && checkedIds.size === allTypeIds.length;
  const someChecked = checkedIds.size > 0 && !allChecked;

  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someChecked;
    }
  }, [someChecked]);

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

  return (
    <>
      {/* The two top rows stay in view while the checklist scrolls under them. */}
      <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900">
      <label className="flex items-center gap-2 px-3 py-2 text-sm font-medium cursor-pointer hover:bg-cta-pale dark:hover:bg-zinc-800/50">
        <input
          ref={selectAllRef}
          type="checkbox"
          checked={allChecked}
          onChange={handleSelectAllToggle}
          className="h-4 w-4 rounded border-wire accent-cta"
        />
        {allTypesLabel}
      </label>
      {/* Slice #38.48: under „Toate tipurile", above the divider (this row's border-b), as wide as the
          dropdown's w-64 less its px-3 — a fixed width, never w-full (layout-guard). Searching
          only hides rows; „Toate tipurile" still ticks and unticks the whole list. Esc closes. */}
      <div className="border-b border-crease px-3 pb-2 dark:border-zinc-800">
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onEscape?.();
          }}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          autoComplete="off"
          data-type-search=""
          className="w-[13.5rem] rounded-md border border-wire bg-white px-2 py-1 text-sm text-ink placeholder:text-fade focus:outline-none focus:ring-2 focus:ring-cta dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>
      </div>
      {/* Only once there are types to search: while they load, the list is simply empty. */}
      {types.length > 0 && shownTypes.length === 0 && (
        <p className="px-3 py-2 text-sm italic text-fade" data-type-search-empty="">
          {searchEmptyLabel}
        </p>
      )}
      {shownTypes.map((ty) => (
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
    </>
  );
}

/** Slice 40.31: every type ticked — the address names none — or not; the funnel on „Tip" is filled while not. */
function typesNarrowed(types: DocumentTypeOption[], initialDocumentTypeIds?: string[]): boolean {
  return initialDocumentTypeIds !== undefined && !(types.length > 0 && types.every((ty) => initialDocumentTypeIds.includes(ty.id)));
}

function DocumentTypeFilterDropdown({
  types,
  initialDocumentTypeIds,
  label,
  allTypesLabel,
  noTypesLabel,
  typesShownLabel,
  searchPlaceholder,
  searchEmptyLabel,
}: {
  types: DocumentTypeOption[];
  initialDocumentTypeIds?: string[];
  label: string;
  allTypesLabel: string;
  /** Slice #38.07: „Niciun tip". */
  noTypesLabel: string;
  /** Slice #38.07: „{count} tipuri afișate". */
  typesShownLabel: (count: number) => string;
  /** Slice #38.48: the search box's placeholder and name, „Caută un tip…". */
  searchPlaceholder: string;
  /** Slice #38.48: „Niciun tip nu se potrivește." */
  searchEmptyLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);

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

  // Slice #38.07: all — „Toate tipurile"; one — its name; several — „{n} tipuri afișate"; none — „Niciun tip".
  const trigger = typeFilterTrigger(types, initialDocumentTypeIds);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={buttonClass({ variant: "secondary", size: "sm", className: "gap-1.5" })}
      >
        <span className="text-fade">{label}</span>
        {/* Slice #40.01: the words one width in every state — the 14 rem a type's name had — so ticking types never
            moves the toolbar's row, now that the button stands on it, nor the frame that follows the toolbar (#37.84;
            TC-LAYOUT-02 step 8). Slice 40.46: 12 rem, so the row, with the sort button after „Câmp specific", is still
            narrow enough at 1920 px for the 640-px Incursiune beside the list (TC-TILES-11 step 9); a longer name ends
            in „…", whole on hover. */}
        {trigger.kind === "one" ? (
          <span className="w-48 truncate text-left font-medium text-ink dark:text-zinc-100" title={trigger.name} data-type-trigger="one">
            {trigger.name}
          </span>
        ) : trigger.kind === "all" ? (
          <span className="w-48 truncate text-left font-medium text-ink dark:text-zinc-100" data-type-trigger="all">{allTypesLabel}</span>
        ) : (
          <span className="w-48 truncate text-left font-medium italic text-ink dark:text-zinc-100" data-type-trigger={trigger.kind}>
            {trigger.kind === "none" ? noTypesLabel : typesShownLabel(trigger.count)}
          </span>
        )}
        {/* #37.42 (A015): Lucide's ChevronDown in place of the „▾" glyph —
            decoration inside a button that has its words, so no name of its own. */}
        <ChevronDown size={16} aria-hidden="true" className="shrink-0 text-fade" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-64 max-h-80 overflow-y-auto rounded-md border border-wire bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <TypeChecklist
            types={types}
            initialDocumentTypeIds={initialDocumentTypeIds}
            allTypesLabel={allTypesLabel}
            searchPlaceholder={searchPlaceholder}
            searchEmptyLabel={searchEmptyLabel}
            onEscape={close}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DocumentListItem = {
  id:               string;
  code:             string;
  documentTypeId:   string;
  documentTypeName: string | null;
  documentTypeShortName: string | null;
  title:            string | null;
  nrDocument:       string | null;
  dateDocument:     string | null;
  // Slice #37.62 — „Câmpuri afișate": fields every document has.
  institutionName:  string | null;
  subject:          string | null;
  pageCount:        number;
  personCount:      number;
  propertyCount:    number;
  createdAt:        string;
  updatedAt:        string;
};

type ListResponse = {
  items:  DocumentListItem[];
  total:  number;
  limit:  number;
  offset: number;
};

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function fetchDocuments(
  q: string,
  documentTypeIds: string[],
  page: number,
  expiringSoon: boolean,
  customFieldKey: string,
  customFieldValue: string,
  filters: FilterState = {},
  order: ListOrder = DEFAULT_LIST_ORDER,
): Promise<ListResponse> {
  const url = new URL("/api/documents", window.location.origin);
  // Slice #39.63: the shared bar's filters, in the address's words.
  appendFilterParams(url.searchParams, filters, DOCUMENT_FILTER_FIELDS);
  // Slice 40.46: the order, only when it is not the default.
  appendOrderParams(url.searchParams, order);
  if (q)                      url.searchParams.set("q",               q);
  if (documentTypeIds.length) url.searchParams.set("documentTypeIds", documentTypeIds.join(","));
  if (expiringSoon)           url.searchParams.set("expiringSoon",    "true");
  // ⚠️ **Both or neither — Slice #34.10.** The same `&&` the schema and
  // `listDocument` apply, applied here too so a half-chosen filter never even
  // becomes a request: a key with no value would ask the server a question
  // ("documents that HAVE this field") that nothing on this screen offers.
  if (customFieldKey && customFieldValue) {
    url.searchParams.set("customFieldKey",   customFieldKey);
    url.searchParams.set("customFieldValue", customFieldValue);
  }
  url.searchParams.set("limit",  String(PAGE_SIZE));
  url.searchParams.set("offset", String(page * PAGE_SIZE));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

/**
 * Slice #39.63 — the institution checklist's values, counted over the list on screen: its types (the three-state
 * `documentTypeIds`), „Expiră curând", the custom field and the search, and every other bar filter.
 */
async function fetchFilterValues(
  field: string,
  q: string,
  documentTypeIds: string[] | undefined,
  expiringSoon: boolean,
  customFieldKey: string,
  customFieldValue: string,
  filters: FilterState,
): Promise<FacetValue[]> {
  const url = new URL("/api/documents/filter-values", window.location.origin);
  url.searchParams.set("field", field);
  if (q) url.searchParams.set("q", q);
  if (documentTypeIds !== undefined) url.searchParams.set("documentTypeIds", documentTypeIds.join(","));
  if (expiringSoon) url.searchParams.set("expiringSoon", "true");
  if (customFieldKey && customFieldValue) {
    url.searchParams.set("customFieldKey", customFieldKey);
    url.searchParams.set("customFieldValue", customFieldValue);
  }
  appendFilterParams(url.searchParams, filters, DOCUMENT_FILTER_FIELDS);
  const res = await fetch(url);
  if (res.redirected || !res.ok) throw new Error(`Request failed (${res.status})`);
  const body = (await res.json()) as { items?: FacetValue[] };
  return body.items ?? [];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// „Adăugat la" (#37.62) is `addedOn`, shared with the other three lists since 40.45 (`person-age.ts`).

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

// initialDocumentTypeIds:
//   undefined → no ?documentTypeIds param in URL → show all documents
//   []        → ?documentTypeIds= (empty) in URL  → no types selected → show message
//   [...]     → ?documentTypeIds=uuid,uuid          → show only those types

export function DocumentListView({
  initialDocumentTypeIds,
}: {
  initialDocumentTypeIds?: string[];
}) {
  const t       = useTranslations("document");
  // Slice 40.20: the band's and „Câmpuri afișate"'s short names (Adrian, 2026-10-21); the forms keep `t`'s.
  const tHead   = useTranslations("document.listHeads");
  const tOrder  = useTranslations("shared.columnOrder");
  const tPag    = useTranslations("shared.pagination");
  const tFilter = useTranslations("shared.listFilters");
  const router = useRouter();

  // Slice #39.26: the view starts from the list's address — Back from a record brings it back as it was left.
  const address = useListAddress(FILTER_KEYS);
  const [searchInput,     setSearchInput]     = useState(address.search);
  const [debouncedSearch, setDebouncedSearch] = useState(address.search);
  const [currentPage,     setCurrentPage]     = useState(address.page);
  const [expiringSoon,    setExpiringSoon]    = useState(address.filters.expiring === "1");
  // ── Slice #34.10: the custom-field filter, the half of D-01 that needs code.
  //
  // TWO pieces of state and not one `{key, value}` object: until Slice 40.10 `record-list-agreement.test.ts` required
  // every `queryKey` entry to be a bare identifier found in `pageKey`, because `pageKey` cleared the tick boxes when a
  // filter changed. The tick boxes and that rule are gone; the two values stay apart, and both are in the address.
  const [customFieldKey,   setCustomFieldKey]   = useState(address.filters.field ?? "");
  const [customFieldValue, setCustomFieldValue] = useState(address.filters.value ?? "");
  // Slice #39.63: the shared bar — from the address, like the rest; a change goes back to the first page.
  const [filters, setFilters] = useState<FilterState>(() => parseDocumentFilters({ get: (k) => address.filters[k] ?? null }));
  const [editingFilter, setEditingFilter] = useState<string | null>(null);
  const filterSig = filterSignature(filters, DOCUMENT_FILTER_FIELDS);
  function changeFilters(next: FilterState) {
    setFilters(next);
    setCurrentPage(0);
  }
  // Slice 40.46: the list's order — the server's, from the address like the filters; a change goes back to the first page.
  const [listOrder, setListOrder] = useState<ListOrder>(() => readListOrder((k) => address.filters[k], LIST_SORTS.document));
  const orderSig = orderSignature(listOrder);
  function changeListOrder(next: ListOrder) {
    setListOrder(next);
    setCurrentPage(0);
  }


  const { data: documentTypes } = useQuery({
    queryKey: ["document-types"],
    queryFn:  fetchDocumentTypes,
    staleTime: 5 * 60 * 1000,
  });
  /**
   * ⚠️ **`useMemo` so `customFieldOptions` below is not rebuilt on every
   * render — a performance fix, and this comment used to claim more than that.
   *                                                            (Slice #34.10)**
   * `documentTypes ?? []` builds a fresh array each render, which ESLint's
   * `react-hooks/exhaustive-deps` named as making the memo under it useless.
   * That is the whole of it.
   *
   * ⚠️ **The first version of this comment said it was a CORRECTNESS fix —
   * that an unmemoised array would make the reconciliation below `setState` on
   * every render, a loop. That was wrong, and an adversarial round caught it.**
   * The reconciliation compares a STRING signature, and an unmemoised array
   * produces an identical signature, so no loop was ever possible. The rescue
   * was already in place two hooks down; this hook is the tidy one.
   *
   * Left in, that sentence would have been a rationale the next reader reasons
   * from — "the memo is load-bearing, do not touch it" — which is exactly the
   * class of thing this project's rules call out: a comment that describes what
   * the system does must be derived from the code that does it.
   */
  const typeOptions = useMemo(() => documentTypes ?? [], [documentTypes]);

  /**
   * The custom-field keys the types ON SCREEN define.           (Slice #34.10)
   *
   * ⚠️ **Off the TEMPLATES, not off the data.** A key that exists in some
   * document's `custom_fields` but in no template is an orphan — a field that
   * was removed from the type since — and offering it would be offering a
   * filter for a column the archive has stopped filling. `parseTemplateFields`
   * is the one reader of that column, and it already drops entries with a blank
   * key and sorts by `order`, so the list is in the order the form draws them.
   *
   * ⚠️ **Narrowed by the type filter, deduped, and labelled in ROMANIAN.** Two
   * types can define the same key — that is the whole point of a shared key —
   * and `labelRo` is the word the person captured the value under. Where two
   * types label one key differently the first wins, which is the same order the
   * dropdown above shows the types in; the alternative is printing one key
   * twice under two names and filtering identically from both.
   *
   * ⚠️ **`initialDocumentTypeIds === undefined` MEANS EVERY TYPE, not none.**
   * That is this file's existing convention (see `typeFiltersKey`), and reading
   * it the other way would empty this control on the default view — the one
   * where the whole archive is on screen and grouping is most useful.
   */
  //
  // ⚠️ **ONLY FIELDS WITH A CLOSED LIST OF VALUES — `select` fields.** (Slice #37.73)
  // A text, number or date field holds a value per document, so a filter on it
  // finds one document, which the search box does better; and the Antecontract's
  // prose-made fields („suma de", „Anul") were all text. The rule and the value
  // labels are `custom-field-options.ts`.
  //
  // ⚠️ **Slice #38.07: ONLY FOR EXACTLY ONE TYPE, AND ONLY ONE THAT HAS SUCH A
  // FIELD** (`customFieldFilter`). With every type, several, or one without a
  // closed-list field, the control is drawn disabled and offers nothing — so a
  // chosen key is cleared by the reconciliation below, as before.
  const customField = useMemo(
    () => customFieldFilter(typeOptions, initialDocumentTypeIds),
    [typeOptions, initialDocumentTypeIds],
  );
  // Slice #38.18: the same rule with its reason, for the sign between „Tip document:" and „Câmp specific:".
  const fieldState = useMemo(
    () => customFieldState(typeOptions, initialDocumentTypeIds),
    [typeOptions, initialDocumentTypeIds],
  );
  const customFieldOptions = customField.options;
  const chosenCustomField = customFieldOptions.find((o) => o.key === customFieldKey);

  /**
   * ⚠️ **A chosen key that the types on screen no longer define is CLEARED.**
   * The type filter lives in the URL and this state does not, so navigating
   * from "Contract de vânzare" to "Plan cadastral" leaves a key behind that the
   * new selection has no field for — and the list would then show nothing, with
   * a filter naming a field that is not in its own dropdown. Clearing it is the
   * honest recovery: the rows come back and the control returns to "Toate".
   *
   * Written as a render-phase reconciliation rather than an effect, the same
   * shape `prevTypeFiltersKey` above uses for the page reset — an effect would
   * paint one frame of an empty list first.
   */
  //
  // ⚠️ **Compared as a STRING, not by array identity, and this is the line that
  // makes the whole reconciliation safe rather than the `useMemo` above.** An
  // identity comparison would be only as correct as every input's memoisation,
  // and the failure when one of them slips is not a slow render: it is
  // `setState` from every render, which is a loop. A signature cannot fail that
  // way whatever anybody upstream does — which is why the memo above is a
  // tidiness fix and this is the guard. `typeFiltersKey` above already sets the
  // precedent for exactly the same reconciliation.
  //
  // Slice #39.26: the key can now come from the ADDRESS — Back, or a type change that carries it — and the types may
  // already be cached, so the signature would never change and a key the types on screen do not define would stay.
  // So the first render with the types loaded checks too: `prevKeysSignature` starts as null, the types-not-yet-
  // loaded signature is null as well, and a key is never judged against a list of types that has not arrived.
  const customFieldKeysSignature = documentTypes === undefined ? null : customFieldOptions.map((o) => o.key).join("\u0000");
  const [prevKeysSignature, setPrevKeysSignature] = useState<string | null>(null);
  if (prevKeysSignature !== customFieldKeysSignature) {
    setPrevKeysSignature(customFieldKeysSignature);
    if (customFieldKey && !customFieldOptions.some((o) => o.key === customFieldKey)) {
      setCustomFieldKey("");
      setCustomFieldValue("");
      setCurrentPage(0);
    }
  }


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

  // When initialDocumentTypeIds changes (sidebar navigation), reset to page 0.
  const typeFiltersKey =
    initialDocumentTypeIds === undefined ? "__all__" : initialDocumentTypeIds.join(",");

  const [prevTypeFiltersKey, setPrevTypeFiltersKey] = useState(typeFiltersKey);
  if (prevTypeFiltersKey !== typeFiltersKey) {
    setPrevTypeFiltersKey(typeFiltersKey);
    setCurrentPage(0);
  }

  /**
   * The values that key actually holds, with counts.            (Slice #34.10)
   *
   * ⚠️ **`enabled` on the key, so nothing is fetched until one is chosen** —
   * the `GROUP BY` behind this reads a column no index covers, and firing it on
   * every visit to the Documents list to populate a control nobody has touched
   * is the shape this codebase's own comments keep calling a billed read nobody
   * asked for.
   *
   * ⚠️ **`typeFiltersKey` is in the query key, and the request carries the same
   * ids the list does.** Values scoped to a different set of types than the
   * rows on screen is a dropdown offering options that return nothing.
   */
  const valuesQuery = useQuery({
    queryKey: ["documents", "custom-field-values", customFieldKey, typeFiltersKey],
    queryFn:  () => fetchCustomFieldValues(customFieldKey, initialDocumentTypeIds),
    enabled:  customFieldKey !== "",
    staleTime: 60 * 1000,
  });
  const valueOptions = valuesQuery.data ?? [];

  // When initialDocumentTypeIds is an empty array, skip the API call and show a message.
  const noTypesSelected = initialDocumentTypeIds !== undefined && initialDocumentTypeIds.length === 0;

  const query = useQuery<ListResponse>({
    queryKey: ["documents", "list", debouncedSearch, typeFiltersKey, expiringSoon, customFieldKey, customFieldValue, filterSig, orderSig, currentPage],
    queryFn:  () => fetchDocuments(debouncedSearch, initialDocumentTypeIds ?? [], currentPage, expiringSoon, customFieldKey, customFieldValue, filters, listOrder),
    enabled:  !noTypesSelected,
  });

  const total      = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const paginate   = total > PAGE_SIZE;
  const items      = query.data?.items ?? [];

  // Slice #32.15 made this key carry every value the query key carries, for the ticks it cleared; since 40.10
  // there are no ticks, and it is the list's address key alone.
  const pageKey = `${debouncedSearch}|${typeFiltersKey}|${expiringSoon}|${customFieldKey}|${customFieldValue}|${filterSig}|${orderSig}|${currentPage}`;
  // Slice #39.26: the view, in the list's address; the scroll, in the session. The search as typed, not debounced:
  // the type filter carries it, and measured in TC-DOC-08 a box emptied just before a tick came back with its old word.
  useWriteListAddress(
    { search: searchInput, page: currentPage, filters: {
      expiring: expiringSoon ? "1" : "", field: customFieldKey, value: customFieldValue, ...filterAddressPatch(filters, DOCUMENT_FILTER_FIELDS), ...orderAddressPatch(listOrder),
    } },
    `${searchInput}|${pageKey}`,
  );
  useListScrollMemory(query.isSuccess);

  // Optional column definitions (ordered).
  //
  // Slice #37.62 — fields EVERY document has: „Date generale" and „Date de
  // emitere" are on every type's form (#37.52), and the archive knows the rest
  // of every document — its pages, the persons and properties associated with
  // it, the day it was added. Importance, relevance and provenance are no longer
  // offered; a browser that remembers one simply loses it (`field-chooser.tsx`).
  //
  // ⚠️ **„Valabil până la" is NOT here**, though `date_valid_until` is on every
  // row and „Expiră în curând" reads it: the form has not drawn it on any type
  // since #21.03, so a column of it would show a value no screen lets a person
  // see or correct.
  //
  // ⚠️ The keys are persisted per browser (`LIST_COLUMN_CHOICE.document`); renaming one silently
  // drops it from every stored choice.
  const optionalCols: ChooserField[] = [
    { key: "nrDocument",    label: tHead("nrDocument"), full: t("table.nrDocument"),    column: "listNrDocument" },
    { key: "dateDocument",  label: tHead("dateDocument"), full: t("table.dateDocument"),  column: "listDate" },
    { key: "institution",   label: tHead("institution"), full: t("table.institution"),   column: "listInstitution" },
    { key: "subject",       label: tHead("subject"), full: t("table.subject"),       column: "listSubject" },
    { key: "pageCount",     label: tHead("pageCount"), full: t("table.pageCount"),     column: "listPageCount" },
    { key: "personCount",   label: tHead("personCount"), full: t("table.personCount"),   column: "listPersonCount" },
    { key: "propertyCount", label: tHead("propertyCount"), full: t("table.propertyCount"), column: "listPropertyCount" },
    { key: "createdAt",     label: tHead("createdAt"), full: t("table.createdAt"),     column: "listDate" },
  ];

  function cellValue(item: DocumentListItem, key: string): React.ReactNode {
    switch (key) {
      case "nrDocument":    return item.nrDocument ?? "";
      case "dateDocument":  return dmyFromIso(item.dateDocument) ?? "";
      case "institution":   return item.institutionName ?? "";
      case "subject":       return item.subject ?? "";
      case "pageCount":     return item.pageCount;
      case "personCount":   return item.personCount;
      case "propertyCount": return item.propertyCount;
      case "createdAt":     return addedOn(item.createdAt);
      default:              return null;
    }
  }

  // Total columns = checkbox + type + title + visible optionals + open
  //
  // Slice #37.16: the columns shown, in order, each a fixed width from
  // `COLUMN` — a ticked optional column widens the table. A stored key this
  // build has no column for is dropped on read (`useFieldChooser`).
  const chooser = useFieldChooser(LIST_COLUMN_CHOICE.document.storageKey, optionalCols.map((c) => c.key), MAX_OPT, LIST_COLUMN_CHOICE.document.defaults);
  const shownCols = chooser.visible.flatMap((key) => optionalCols.filter((c) => c.key === key));
  // Slice #38.57: the list's own columns, one line each.
  // Slice 40.24: no badges' column before the type — „Nou!" is in its cell (`FirstCellText`).
  // Slice 40.25: every named column in the order dragged, Tip and Titlu included; the row buttons' column stays last.
  const FIXED_COLUMNS: ColumnName[] = ["listDocumentType", "listDocumentTitle"];
  const fixedKeys = ["type", "title"];
  const order = useColumnOrder(LIST_COLUMN_ORDER.document, [...fixedKeys, ...shownCols.map((c) => c.key)]);
  const headName = (key: string) => (fixedKeys.includes(key) ? tHead(key) : shownCols.find((c) => c.key === key)?.label ?? key);
  const drag = useColumnDrag({ keys: order.keys, names: Object.fromEntries(order.keys.map((k) => [k, headName(k)])), onMove: order.move });
  const columnOf = (key: string): ColumnName =>
    fixedKeys.includes(key) ? FIXED_COLUMNS[fixedKeys.indexOf(key)] : (shownCols.find((c) => c.key === key)?.column ?? "listRowActions");
  const columns: ColumnName[] = [...order.keys.map(columnOf), "listRowActions"];
  // Slice #39.63: the bar's fields, labelled as their columns are. Since #39.82 only the columns that filter
  // (`DOCUMENT_COLUMN_FILTERS`), each named as its column is in „Câmpuri afișate".
  const filterFields: FilterBarField[] = DOCUMENT_FILTER_FIELDS.map((f) => ({
    key: f.key,
    kind: f.kind,
    // Slice 40.20: a filter keeps the field's whole label, not the band's short one.
    label: optionalCols.find((c) => DOCUMENT_COLUMN_FILTERS[c.key] === f.key)?.full ?? f.key,
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
      address={{ kind: "document", row: address.row, tiles: address.tiles }}
    >
      {/* Toolbar — one row since Slice #39.63: the search, „Câmpuri afișate", „Expiră curând" right after it (#39.84;
          Adrian, 2026-10-18: „The Expiring Soon button will slide left close to field picker button"), then — since
          #40.01 — „Tip document:" and „Câmp specific" with its ⓘ, and at its end „Adaugă act"'s group. The filter bar
          under it is drawn only while a filter is active. */}
      {/* Slice 40.30: the toolbar one step down — „Adaugă act" md, the other controls 30 px (sm), 8-px gaps. */}
      <div className={`flex flex-col gap-2 ${LIST_TOOLBAR}`} data-toolbar="" {...edge.toolbar}>
      {/* #39.74: top-aligned, not centred — choosing a field adds its value select here, and centred, the row would
          move under the cursor (TC-DOC-08 step 7). From #39.84 to #40.01 that select was on the bar below; it is back on
          this row, which stays top-aligned, every control on it 33–37 px tall (Ask first 4) — 30–34 since 40.30. */}
      <div className="flex items-start gap-2" data-toolbar-row="first">
        {/* Slice #40.01: the controls on the left wrap among themselves, so the group at the right — „Adaugă act" —
            always ends the first line and is never pushed under them (Ask first 2). */}
        <div className="flex min-w-0 flex-1 flex-wrap items-start gap-2" data-toolbar-controls="">
          {/* Slice #37.62: the search first — its placeholder no longer begins
              with „SAU", which only made sense after the type. Since #38.18 the
              type stands in front of „Câmp specific" — since #40.01 after „Expiră curând". */}
          {/* Slice #39.85: as wide as „Adaugă …", its whole explanation on hover. */}
          <ListSearchBox value={searchInput} onChange={setSearchInput} explanation={t("searchPlaceholder")} small list="document" />

          {/* Slice #37.62: the shared chooser, as on the other three lists. Its list hung from the right while the button
              stood near the toolbar's end; since #39.85 the search box before it is as narrow as „Adaugă act", so a list
              hung from the right would reach under the sidebar — it hangs from the left, as on the other lists. */}
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

          {/* #37.42 (A014): CalendarClock, a toggle. Pressed is the strong `primary` fill and `aria-pressed`. */}
          <IconButton
            icon={CalendarClock}
            label={tFilter("expiringSoon")}
            variant={expiringSoon ? "primary" : "secondary"}
            size="sm"
            aria-pressed={expiringSoon}
            onClick={() => { setExpiringSoon((v) => !v); setCurrentPage(0); }}
          />

          {/* Slice #40.01: „Tip document:", then the sign, „Câmp specific:" with its selects and its ⓘ — on the toolbar's
              row, after „Expiră curând" (Adrian, 2026-10-20: „move the connected fields … to the right of the Expiring
              Soon button"). One item that never wraps apart: when it does not fit beside „Expiră curând" it goes whole
              onto a line of its own under the row, at its left (Ask first 2). #39.84 had it on the filter bar, #39.74
              „Câmp specific" alone on the toolbar. */}
          <div className="flex shrink-0 flex-nowrap items-center gap-2" data-filter-fixed="">
            <DocumentTypeFilterDropdown
              types={typeOptions}
              initialDocumentTypeIds={initialDocumentTypeIds}
              label={t("typeFilterLabel")}
              allTypesLabel={t("allTypes")}
              noTypesLabel={t("noTypes")}
              typesShownLabel={(count) => t("typesShown", { count })}
              searchPlaceholder={t("typeSearchPlaceholder")}
              searchEmptyLabel={t("typeSearchEmpty")}
            />
            {/* Slice #39.84 — „Câmp specific" (the sign, „Câmp specific:", its two selects and its ⓘ, one item that never
                wraps apart, #39.74's decision 5) went on the filter bar, where „+ Filtru" stood until #39.82; since #40.01 it is here, after „Tip document:" (Adrian,
                2026-10-18: „the icon with the stop sign or the check mark … to replace it followed by the type specific
                field and information button"). Same controls, same address keys (field, value). */}
            {typeOptions.length > 0 && (
            <div className="flex items-center gap-2" data-custom-field-group="">
            <CustomFieldSign
              state={fieldState}
              title={fieldState.enabled ? tFilter("customFieldSignOn") : tFilter("customFieldSignOff")}
              note={
                fieldState.enabled
                  ? tFilter("customFieldSignOffers", { type: fieldState.typeName ?? "" })
                  : fieldState.reason === "all"
                    ? tFilter("customFieldSignAll")
                    : fieldState.reason === "none"
                      ? tFilter("customFieldSignNone")
                      : fieldState.reason === "several"
                        ? tFilter("customFieldSignSeveral", { count: fieldState.count })
                        : fieldState.reason === "noForm"
                          ? tFilter("customFieldSignNoForm", { type: fieldState.typeName ?? "" })
                          : tFilter("customFieldSignNoClosedList", { type: fieldState.typeName ?? "" })
              }
            />
            {/* Slice #37.62: no „Importanță" or „Relevanță" filter. The
                Expiring-soon toggle beside it (#39.63) filters on the document's own
                date_valid_until — a business question, not a curation value — and
                stays; its threshold is in Settings → Time frames. */}
            {/* ── Custom-field filter ─────────────── (Slice #34.10) ─────────
                The half of D-01 that needs code. D-01 settled that
                CONTRACT_VANZARE gets ONE union form plus one hand-written field
                carrying the flavour — five descriptions, no subtype level — and
                until this control the answer was on paper only: nothing anywhere
                read `custom_fields` for search or for filtering, so a flavour could
                be captured and never grouped by.

                ⚠️ **ALWAYS DRAWN SINCE #38.07, DISABLED UNLESS EXACTLY ONE TYPE
                WITH A CLOSED-LIST FIELD IS TICKED.** It used to be drawn only when
                the types on screen had such a field, offering every type's at once;
                Adrian asked for one type at a time, and for the control to stay in
                sight, its ⓘ saying how to turn it on (the header's Ask first).

                ⚠️ **TWO CONTROLS, THE SECOND APPEARING ONLY AFTER THE FIRST.** A
                value alone is meaningless (which field?) and a key alone is a
                different feature ("documents that HAVE this field"), which nothing
                here offers — so the pair is the filter, and the schema, the fetch
                and `listDocument` all apply the same `&&`. Revealing the values
                only once a key is chosen is also what keeps the `GROUP BY` behind
                them from running on every visit to this page.

                ⚠️ **The value is a SELECT, not a text box, and that is the whole
                usefulness of it.** "Minimise human effort" applies to a filter too:
                a text box would be a control you can only use if you already know,
                diacritic for diacritic, which of Adrian's five descriptions was
                typed. The archive knows, so it is asked. The count beside each
                option is not decoration either — a flavour with one document behind
                it is almost always a typo, invisible in a bare list of strings. */}
            {/* Slice #37.62 — Adrian asked how „Câmp specific" is meant to be used,
                so the control says it itself: an ⓘ beside it opens the answer as a
                bubble (HintBubble, #37.50), and the key select is described by it. */}
              <HintBubble
                id="custom-field-hint"
                text={tFilter("customFieldHint")}
                note={tFilter("customFieldWhenActive")}
                triggerLabel={tFilter("customFieldHintTrigger")}
              >
              {/* #38.18: disabled, it looks it — the label greyed and in italics, as #38.04's
                  disabled boxes; the box faded, its border dashed, the cursor not-allowed. */}
              <div
                data-custom-field-box={customField.enabled ? "enabled" : "disabled"}
                className={
                  customField.enabled
                    ? "inline-flex items-center gap-1.5 rounded-md border border-wire bg-white px-2 py-1.5 text-xs shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
                    : "inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-dashed border-wire bg-cta-pale px-2 py-1.5 text-xs dark:border-zinc-600 dark:bg-zinc-800/60"
                }
              >
                <span className={customField.enabled ? "text-fade" : "italic text-fade dark:text-zinc-500"}>{tFilter("customFieldLabel")}</span>
                <select
                  value={customFieldKey}
                  aria-describedby="custom-field-hint"
                  onChange={(e) => {
                    setCustomFieldKey(e.target.value);
                    // ⚠️ The value belongs to the OLD key. Carrying it over would
                    // filter the new field for a string only the old one held, and
                    // the list would empty out with both controls looking right.
                    setCustomFieldValue("");
                    setCurrentPage(0);
                  }}
                  aria-label={tFilter("customFieldLabel")}
                  // Slice #38.07: works only for exactly one type with a closed-list field.
                  disabled={!customField.enabled}
                  data-custom-field-enabled={customField.enabled ? "true" : "false"}
                  className="bg-transparent text-xs font-medium text-ink focus:outline-none disabled:cursor-not-allowed disabled:italic disabled:text-fade dark:text-zinc-100 dark:disabled:text-zinc-500"
                >
                  <option value="">{tFilter("allCustomFields")}</option>
                  {customFieldOptions.map((o) => (
                    <option key={o.key} value={o.key}>{o.label}</option>
                  ))}
                </select>
                {customFieldKey !== "" && (
                  <select
                    value={customFieldValue}
                    onChange={(e) => { setCustomFieldValue(e.target.value); setCurrentPage(0); }}
                    aria-label={tFilter("customFieldValueLabel")}
                    // ⚠️ Disabled while the values are still being read, rather
                    // than absent: a control that appears a beat after the one
                    // beside it moves the toolbar under the cursor.
                    disabled={valuesQuery.isPending}
                    className="bg-transparent text-xs font-medium text-ink focus:outline-none disabled:text-fade dark:text-zinc-100"
                  >
                    <option value="">
                      {valuesQuery.isPending
                        ? tFilter("customFieldValuesLoading")
                        : tFilter("allCustomFieldValues")}
                    </option>
                    {valueOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {/* Slice #37.73: the option's Romanian label, not its code; the value sent is unchanged. */}
                        {tFilter("customFieldValueOption", { value: customFieldValueLabel(chosenCustomField, o.value), count: o.count })}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              </HintBubble>
            </div>
            )}
            {/* Slice 40.46: the sort button, right after „Câmp specific"'s ⓘ — and, with no types (no ⓘ drawn), right
                after „Tip document:" (Ask first 5). Inside the group, so the two never part. */}
            <ListSortButton order={listOrder} onChange={changeListOrder} />
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {/* Slice #39.85: measured, so the search box could take its width; 40.37: „+ Nou" and the list's Domeniu icon, its
              name and tooltip the whole „Adaugă …", the search box pinned at the old width (LIST_SEARCH_REM). */}
          <span className="inline-flex" {...LIST_ADD}>
            <IconButton
              href="/documents/new"
              icon={Plus}
              label={t("newCaption")}
              fullName={t("addNew")}
              trailingIcon={domainIcon("document")}
              showLabel
              variant="primary"
              size="md"
            />
          </span>
        </div>
      </div>
      </div>

      {/* Slice #39.63 — the shared filter bar, a row of its own under the toolbar (#39.61): the active filters' chips and
          „Șterge filtrele", drawn only while a filter is active — with none it takes no space (#40.01, Ask first 3).
          Until #40.01 it opened with „Tip document:" and „Câmp specific"; they are on the toolbar's row now, with the
          same controls and address keys (documentTypeIds, field, value) as ever (Ask first 5). */}
      <FilterBar
        fields={filterFields}
        state={filters}
        onChange={changeFilters}
        editing={editingFilter}
        onEditing={setEditingFilter}
        loadValues={(key) => fetchFilterValues(key, debouncedSearch, initialDocumentTypeIds, expiringSoon, customFieldKey, customFieldValue, filters)}
        valuesKey={(key) => ["documents", "filter-values", key, debouncedSearch, typeFiltersKey, expiringSoon, customFieldKey, customFieldValue, filterSig]}
        // Slice 40.31: the funnel on „Tip" opens, under itself, the checklist of „Tip document:" — the same control,
        // the same documentTypeIds in the address; no chip, the toolbar already says it (Ask first 1–3).
        own={{
          key: TYPE_FUNNEL,
          label: t("table.type"),
          content: (
            <div className="-mx-3 max-h-80 overflow-y-auto" data-type-checklist="funnel">
              <TypeChecklist
                types={typeOptions}
                initialDocumentTypeIds={initialDocumentTypeIds}
                allTypesLabel={t("allTypes")}
                searchPlaceholder={t("typeSearchPlaceholder")}
                searchEmptyLabel={t("typeSearchEmpty")}
              />
            </div>
          ),
        }}
      />


      {/* No types selected — prompt the user to pick at least one */}
      {noTypesSelected ? (
        <div className="w-fit max-w-full overflow-x-auto rounded-md border border-card-rim bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900" {...edge.frame}>
          <div className="px-4 py-8 text-center text-sm text-fade">
            {t("noTypeSelected")}
          </div>
        </div>
      ) : (
        <>
          <ListPreviewRow>
            <div className={`${LIST_FRAME} rounded-md border border-card-rim bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900`} {...edge.frame} {...fit.frame}>
              {/* Slice #40.03: red „<" / „>" at the band's visible edges while columns are hidden that way. */}
              <HiddenColumnSigns />
              {drag.layer}
              {/* Slice #38.57: the table fills its frame, which the toolbar may hold wider than the columns. */}
              <FixedTable id="documents" columns={columns} className="text-sm min-w-full">
                <thead className={LIST_HEAD}>
                  <tr>
                    {/* Slice 40.25: in the order dragged, each name cell its column's handle. */}
                    {order.keys.map((key) => {
                      // Slice 40.31: „Tip" has a funnel too — the checklist of „Tip document:", filled while not every type is ticked.
                      if (key === "type") return <ListHeadCell key={key} column="listDocumentType" name={tHead("type")} full={t("table.type")} funnel={<FilterFunnel field={TYPE_FUNNEL} label={t("table.type")} active={typesNarrowed(typeOptions, initialDocumentTypeIds)} onOpen={() => setEditingFilter(TYPE_FUNNEL)} />} drag={drag.headProps(key)} />;
                      if (key === "title") return <ListHeadCell key={key} column="listDocumentTitle" name={tHead("title")} full={t("table.title")} drag={drag.headProps(key)} />;
                      const col = shownCols.find((c) => c.key === key);
                      if (!col) return null;
                      const filterKey = DOCUMENT_COLUMN_FILTERS[col.key];
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
                        if (newTabIfAsked(e, `/documents/${item.id}`)) return;
                        router.push(`/documents/${item.id}`);
                      }}
                      onAuxClick={(e) => newTabIfAsked(e, `/documents/${item.id}`)}
                      className="align-top hover:bg-cta-pale dark:hover:bg-zinc-800/50 cursor-pointer"
                    >
                      {order.keys.map((key) =>
                        key === "type" ? (
                          // Slice #37.95: the type by its short name (CVC, PAD…, or the rule's), the full name in its tooltip.
                          <td key={key} className={`px-4 py-1 text-fade dark:text-zinc-400 ${ONE_LINE}`} title={item.documentTypeName ?? undefined}>
                            <FirstCellText badges={<RecencyBadge createdAt={item.createdAt} updatedAt={item.updatedAt} />}>
                              {item.documentTypeName
                                ? documentTypeShortName({ name: item.documentTypeName, shortName: item.documentTypeShortName })
                                : "—"}
                            </FirstCellText>
                          </td>
                        ) : key === "title" ? (
                          <td key={key} className={`px-4 py-1 font-medium ${ONE_LINE}`} title={cellTitle(item.title)}>
                            {item.title ?? (
                              <span className="text-fade italic">—</span>
                            )}
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
                          <PreviewButton target={{ kind: "document", id: item.id }} square="row" />
                          <IncursionButton target={{ kind: "document", id: item.id }} square="row" />
                          <LinksButton target={{ kind: "document", id: item.id }} square="row" />
                          <IconButton
                            href={`/documents/${item.id}`}
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
        </>
      )}

    </ListPreviews>
  );
}
