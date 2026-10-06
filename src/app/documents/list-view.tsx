"use client";

import { documentTypeShortName } from "@/lib/documents/type-short-name";
import { useNameOr } from "@/components/record/use-name-or";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { RecencyBadge } from "@/components/recency-badge";
import { HelpHint } from "@/components/help/help-hint";
import { buttonClass } from "@/lib/ui/button-styles";
import { ArrowRight, CalendarClock, ChevronDown, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { FixedColumns, TABLE_FRAME, WRAPS, columnHead, fixedTable } from "@/components/table/fixed-columns";
import { LIST_TOOLBAR, useListEdge } from "@/components/table/list-edge";
import type { ColumnName } from "@/lib/ui/field-widths";
import { customFieldValueLabel } from "@/lib/documents/custom-field-options";
import { customFieldFilter, customFieldState, typeFilterTrigger } from "@/lib/documents/type-filter";
import { CustomFieldSign } from "@/components/documents/custom-field-sign";
import { newTabIfAsked } from "@/lib/ui/row-link";
import { ListPreviews, PreviewButton } from "@/components/tiles/preview-tiles";
import { FieldChooser, useFieldChooser, type ChooserField } from "@/components/list/field-chooser";
import { LIST_COLUMN_CHOICE } from "@/lib/ui/list-columns";
import { HintBubble } from "@/lib/ui/hint-bubble";
import { dmyFromIso } from "@/lib/persons/person-age";

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

function buildDocumentsUrl(checkedIds: Set<string>, allTypeIds: string[]): string {
  if (checkedIds.size === allTypeIds.length) return "/documents";
  return `/documents?documentTypeIds=${Array.from(checkedIds).join(",")}`;
}

function DocumentTypeFilterDropdown({
  types,
  initialDocumentTypeIds,
  label,
  allTypesLabel,
  noTypesLabel,
  typesShownLabel,
}: {
  types: DocumentTypeOption[];
  initialDocumentTypeIds?: string[];
  label: string;
  allTypesLabel: string;
  /** Slice #38.07: „Niciun tip". */
  noTypesLabel: string;
  /** Slice #38.07: „{count} tipuri afișate". */
  typesShownLabel: (count: number) => string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
    const next = allChecked ? new Set<string>() : new Set(allTypeIds);
    router.push(buildDocumentsUrl(next, allTypeIds));
  }

  function handleToggleType(id: string) {
    const next = new Set(checkedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    router.push(buildDocumentsUrl(next, allTypeIds));
  }

  // Slice #38.07: all — „Toate tipurile"; one — its name; several — „{n} tipuri afișate"; none — „Niciun tip".
  const trigger = typeFilterTrigger(types, initialDocumentTypeIds);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={buttonClass({ variant: "secondary", size: "md", className: "gap-1.5" })}
      >
        <span className="text-fade">{label}</span>
        {trigger.kind === "one" ? (
          <span className="max-w-56 truncate font-medium text-ink dark:text-zinc-100" title={trigger.name} data-type-trigger="one">
            {trigger.name}
          </span>
        ) : trigger.kind === "all" ? (
          <span className="font-medium text-ink dark:text-zinc-100" data-type-trigger="all">{allTypesLabel}</span>
        ) : (
          <span className="font-medium italic text-ink dark:text-zinc-100" data-type-trigger={trigger.kind}>
            {trigger.kind === "none" ? noTypesLabel : typesShownLabel(trigger.count)}
          </span>
        )}
        {/* #37.42 (A015): Lucide's ChevronDown in place of the „▾" glyph —
            decoration inside a button that has its words, so no name of its own. */}
        <ChevronDown size={16} aria-hidden="true" className="shrink-0 text-fade" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-64 max-h-80 overflow-y-auto rounded-md border border-wire bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
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
          {types.map((ty) => (
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
): Promise<ListResponse> {
  const url = new URL("/api/documents", window.location.origin);
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

async function callBatchDelete(ids: string[]): Promise<void> {
  const res = await fetch("/api/documents/batch-delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
}

// ---------------------------------------------------------------------------
// Confirm dialog
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * „Adăugat la": the day a document was created, dd.mm.yyyy in the reader's own
 * time zone — `createdAt` is a timestamp, not a date, so the ISO digits would
 * be the UTC day.                                             (Slice #37.62)
 */
function addedOn(createdAt: string): string {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

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
  const nameOr      = useNameOr(); // #37.57: a name, or words — never the system ID
  const tPag    = useTranslations("shared.pagination");
  const tBulk   = useTranslations("shared.bulkDelete");
  const tFilter = useTranslations("shared.listFilters");
  const router = useRouter();
  const queryClient = useQueryClient();

  const [searchInput,     setSearchInput]     = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage,     setCurrentPage]     = useState(0);
  const [expiringSoon,    setExpiringSoon]    = useState(false);
  // ── Slice #34.10: the custom-field filter, the half of D-01 that needs code.
  //
  // ⚠️ **TWO pieces of state and not one `{key, value}` object**, because
  // `record-list-agreement.test.ts` requires every entry in this list's
  // `queryKey` to be a bare identifier, and requires each of them to appear in
  // `pageKey` below. That rule is not bureaucracy: `pageKey` is what clears the
  // tick boxes when a filter changes, and a filter missing from it leaves rows
  // selected that the filter has just taken off the screen — with the bulk
  // delete then acting on records nobody can see.
  const [customFieldKey,   setCustomFieldKey]   = useState("");
  const [customFieldValue, setCustomFieldValue] = useState("");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [confirmOpen,  setConfirmOpen]  = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [deleteError,  setDeleteError]  = useState<string | null>(null);

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
  const customFieldKeysSignature = customFieldOptions.map((o) => o.key).join("\u0000");
  const [prevKeysSignature, setPrevKeysSignature] = useState(customFieldKeysSignature);
  if (prevKeysSignature !== customFieldKeysSignature) {
    setPrevKeysSignature(customFieldKeysSignature);
    if (customFieldKey && !customFieldOptions.some((o) => o.key === customFieldKey)) {
      setCustomFieldKey("");
      setCustomFieldValue("");
      setCurrentPage(0);
    }
  }


  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setCurrentPage(0);
    }, 250);
    return () => clearTimeout(handle);
  }, [searchInput]);

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
    queryKey: ["documents", "list", debouncedSearch, typeFiltersKey, expiringSoon, customFieldKey, customFieldValue, currentPage],
    queryFn:  () => fetchDocuments(debouncedSearch, initialDocumentTypeIds ?? [], currentPage, expiringSoon, customFieldKey, customFieldValue),
    enabled:  !noTypesSelected,
  });

  const total      = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const paginate   = total > PAGE_SIZE;
  const items      = query.data?.items ?? [];

  // Slice #32.15: this key must carry every value the query key above carries.
  // A filter that is missing here leaves ticks set on rows the filter has just
  // taken off the screen, and the bulk delete then acts on records nobody can see.
  const pageKey = `${debouncedSearch}|${typeFiltersKey}|${expiringSoon}|${customFieldKey}|${customFieldValue}|${currentPage}`;
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
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      setSelectedIds(new Set());
      setConfirmOpen(false);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : tBulk("error"));
    } finally {
      setDeleting(false);
    }
  }

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
    { key: "nrDocument",    label: t("table.nrDocument"),    column: "nrDocument" },
    { key: "dateDocument",  label: t("table.dateDocument"),  column: "dateDocument" },
    { key: "institution",   label: t("table.institution"),   column: "institution" },
    { key: "subject",       label: t("table.subject"),       column: "documentSubject" },
    { key: "pageCount",     label: t("table.pageCount"),     column: "count" },
    { key: "personCount",   label: t("table.personCount"),   column: "count" },
    { key: "propertyCount", label: t("table.propertyCount"), column: "count" },
    { key: "createdAt",     label: t("table.createdAt"),     column: "date" },
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
  const columns: ColumnName[] = ["selectNew", "documentType", "documentTitle", ...shownCols.map((c) => c.column), "openPreview"];
  // Slice #37.84: the toolbar's group ends at the table frame's right edge, not the window's.
  const edge = useListEdge(columns);
  const colCount = columns.length;

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar — Slice #37.83: two rows. The first: the search, „Tip document",
          „Expiră curând", „Câmpuri afișate" and, at its end, „Adaugă act"'s group;
          choosing a field in „Câmp specific" no longer moves any of them. The
          second, under the search box, holds „Câmp specific" alone. Since #38.07
          it is always drawn once the types have loaded, its control disabled
          unless exactly one type with a closed-list field is ticked. */}
      <div className={`flex flex-col gap-3 ${LIST_TOOLBAR}`} data-toolbar="" {...edge.toolbar}>
      <div className="flex flex-wrap items-center gap-3" data-toolbar-row="first">
        {/* Slice #37.62: the search first — its placeholder no longer begins
            with „SAU", which only made sense after the type. Since #38.18 the
            type stands on the second row, in front of „Câmp specific". */}
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="w-64 rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm placeholder:text-fade focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
        />

        {/* Expiring-soon toggle */}
        {/* #37.42 (A014): CalendarClock, a toggle. Pressed is the strong
            `primary` fill and `aria-pressed`, so the state is a colour and a
            name, not the amber tint the hand-written class used to carry. */}
        <IconButton
          icon={CalendarClock}
          label={tFilter("expiringSoon")}
          variant={expiringSoon ? "primary" : "secondary"}
          size="md"
          aria-pressed={expiringSoon}
          onClick={() => { setExpiringSoon((v) => !v); setCurrentPage(0); }}
        />

        {/* Slice #37.62: the shared chooser, as on the other three lists — its list
            hanging from the right, the button being near the toolbar's end. */}
        <FieldChooser
          label={t("chooseFields")}
          hint={t("chooseFieldsHint", { max: MAX_OPT })}
          fields={optionalCols}
          visible={chooser.visible}
          max={MAX_OPT}
          onToggle={chooser.toggle}
          align="right"
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
            href="/documents/new"
            icon={Plus}
            label={t("addNew")}
            showLabel
            variant="primary"
            size="lg"
          />
        </div>
      </div>
      {/* ── The second row: „Tip document:", the sign, „Câmp specific:" ── (Slices #37.83, #38.18) ──
          #38.18: the type moved here, in front of the field it decides; between
          them a green or red sign says whether „Câmp specific" can be used, and
          its tooltip why. The row is always drawn — the type filter is on it —
          and the sign and the field join it once the types have loaded. */}
      <div className="flex flex-wrap items-center gap-3" data-toolbar-row="second">
        <DocumentTypeFilterDropdown
          types={typeOptions}
          initialDocumentTypeIds={initialDocumentTypeIds}
          label={t("typeFilterLabel")}
          allTypesLabel={t("allTypes")}
          noTypesLabel={t("noTypes")}
          typesShownLabel={(count) => t("typesShown", { count })}
        />
        {typeOptions.length > 0 && (
        <>
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
            Expiring-soon toggle on the first row filters on the document's own
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
                ? "inline-flex items-center gap-1.5 rounded-md border border-wire bg-white px-2 py-1.5 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
                : "inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-dashed border-wire bg-cta-pale px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800/60"
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
              className="bg-transparent text-sm font-medium text-ink focus:outline-none disabled:cursor-not-allowed disabled:italic disabled:text-fade dark:text-zinc-100 dark:disabled:text-zinc-500"
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
                className="bg-transparent text-sm font-medium text-ink focus:outline-none disabled:text-fade dark:text-zinc-100"
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
        </>
        )}
      </div>
      </div>

      {deleteError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {deleteError}
        </p>
      )}

      {/* No types selected — prompt the user to pick at least one */}
      {noTypesSelected ? (
        <div className="w-fit max-w-full overflow-x-auto rounded-md border border-card-rim bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900" {...edge.frame}>
          <div className="px-4 py-8 text-center text-sm text-fade">
            {t("noTypeSelected")}
          </div>
        </div>
      ) : (
        <>
          <ListPreviews>
            <div className={`${TABLE_FRAME} rounded-md border border-card-rim bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900`} {...edge.frame}>
              <table {...fixedTable(columns)}>
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
                    <th className="px-4 py-2" {...columnHead("documentType")}>{t("table.type")}</th>
                    <th className="px-4 py-2" {...columnHead("documentTitle")}>{t("table.title")}</th>
                    {shownCols.map((col) => (
                      <th key={col.key} className="px-4 py-2" {...columnHead(col.column)}>
                        {col.label}
                      </th>
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
                        if (newTabIfAsked(e, `/documents/${item.id}`)) return;
                        router.push(`/documents/${item.id}`);
                      }}
                      onAuxClick={(e) => newTabIfAsked(e, `/documents/${item.id}`)}
                      className="align-top hover:bg-cta-pale dark:hover:bg-zinc-800/50 cursor-pointer"
                    >
                      <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                        <span className="inline-flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item.id)}
                            onChange={() => toggleOne(item.id)}
                            aria-label={nameOr(item.title, "document")}
                            className="h-4 w-4 rounded border-wire accent-cta"
                          />
                          <RecencyBadge createdAt={item.createdAt} updatedAt={item.updatedAt} />
                        </span>
                      </td>
                      {/* Slice #37.95: the type by its short name (CVC, PAD…, or the rule's),
                          the full name in its tooltip. */}
                      <td
                        className={`px-4 py-2 text-fade dark:text-zinc-400 ${WRAPS}`}
                        title={item.documentTypeName ?? undefined}
                      >
                        {item.documentTypeName
                          ? documentTypeShortName({ name: item.documentTypeName, shortName: item.documentTypeShortName })
                          : "—"}
                      </td>
                      <td className={`px-4 py-2 font-medium ${WRAPS}`}>
                        {item.title ?? (
                          <span className="text-fade italic">—</span>
                        )}
                      </td>
                      {shownCols.map((col) => (
                        <td key={col.key} className="px-4 py-2 text-fade dark:text-zinc-400">
                          {cellValue(item, col.key)}
                        </td>
                      ))}
                      <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                        <span className="flex gap-2">
                          <IconButton
                            href={`/documents/${item.id}`}
                            icon={ArrowRight}
                            label={t("open")}
                            variant="secondary"
                            size="xs"
                          />
                          <PreviewButton target={{ kind: "document", id: item.id }} />
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
