"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { metadataValueLabel } from "@/lib/metadata/value-labels";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { RecencyBadge } from "@/components/recency-badge";
import { HelpHint } from "@/components/help/help-hint";
import { buttonClass } from "@/lib/ui/button-styles";
import { parseTemplateFields } from "@/lib/documents/template-fields";

const PAGE_SIZE   = 15;
const LS_KEY      = "ga40-col-document-v2";
const MAX_OPT     = 4;
const DEFAULT_COLS = ["nrDocument", "dateDocument"];

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
}: {
  types: DocumentTypeOption[];
  initialDocumentTypeIds?: string[];
  label: string;
  allTypesLabel: string;
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

  const triggerText = allChecked ? allTypesLabel : `${checkedIds.size}/${allTypeIds.length}`;

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
        <span className="font-medium text-ink dark:text-zinc-100">{triggerText}</span>
        <span aria-hidden="true" className="text-fade text-xs">▾</span>
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
  title:            string | null;
  nrDocument:       string | null;
  dateDocument:     string | null;
  importance:       string | null;
  relevance:        string | null;
  provenance:       string | null;
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
  importance: string,
  relevance: string,
  expiringSoon: boolean,
  customFieldKey: string,
  customFieldValue: string,
): Promise<ListResponse> {
  const url = new URL("/api/documents", window.location.origin);
  if (q)                      url.searchParams.set("q",               q);
  if (documentTypeIds.length) url.searchParams.set("documentTypeIds", documentTypeIds.join(","));
  if (importance)             url.searchParams.set("importance",      importance);
  if (relevance)              url.searchParams.set("relevance",       relevance);
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
 * ⚠️ **Slice #32.19 deleted `DEV_ONLY_COLS` — all three copies of it — rather
 * than centralising it.**
 *
 * It was the same `["importance", "relevance", "provenance"]` array in each of
 * documents/list-view.tsx, natural-persons/list-view.tsx and
 * properties/list-view.tsx — this file being one of the three — and
 * the codebase's own habit ("centralise a bypass rule at the third copy site,
 * not the fourth") pointed at one shared module. That habit is about a rule
 * that SURVIVES. This one does not: Adrian asked for the developer-only screen
 * items to be revealed, the three curation columns are the clearest case of
 * what he meant, and a constant listing the columns that are hidden has nothing
 * left to say once none of them is. A shared module holding an array nobody
 * filters by would be the third copy with a nicer address.
 *
 * What the deleted comment argued for — pruning a stored choice on restore,
 * because localStorage does not know the build changed underneath it — went
 * with it. There is no build in which these columns are absent any more, so
 * there is nothing for a stored value to disagree with.
 */
function readStoredCols(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_COLS;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]) : DEFAULT_COLS;
  } catch {
    return DEFAULT_COLS;
  }
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
  const tPag    = useTranslations("shared.pagination");
  const tBulk   = useTranslations("shared.bulkDelete");
  const tFilter = useTranslations("shared.listFilters");
  const tMeta   = useTranslations("shared");
  // Slice #32.19 — next-intl types `t`'s key as a literal union per namespace,
  // so a key built from a stored value needs one cast. It is made HERE, once,
  // rather than in each case of `cellValue` below.
  const tMetaKey = (key: string) => tMeta(key as Parameters<typeof tMeta>[0]);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [searchInput,     setSearchInput]     = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage,     setCurrentPage]     = useState(0);
  const [importance,      setImportance]      = useState("");
  const [relevance,       setRelevance]       = useState("");
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

  // Column picker — always start with DEFAULT_COLS to match SSR; hydrate from
  // localStorage after mount via setTimeout so setState is in a callback and
  // does not trigger the react-hooks/set-state-in-effect lint rule.
  const [visibleCols, setVisibleCols] = useState<string[]>(DEFAULT_COLS);
  useEffect(() => {
    const id = setTimeout(() => setVisibleCols(readStoredCols()), 0);
    return () => clearTimeout(id);
  }, []);
  const [showColPicker, setShowColPicker] = useState(false);
  const colPickerRef = useRef<HTMLDivElement>(null);

  // Close col picker on outside click
  useEffect(() => {
    if (!showColPicker) return;
    function handler(e: MouseEvent) {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) {
        setShowColPicker(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showColPicker]);

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
  const customFieldOptions = useMemo(() => {
    const wanted = initialDocumentTypeIds;
    const seen = new Map<string, string>();
    for (const type of typeOptions) {
      if (wanted !== undefined && !wanted.includes(type.id)) continue;
      for (const field of parseTemplateFields(type.templateFields)) {
        if (!seen.has(field.key)) seen.set(field.key, field.labelRo || field.labelEn || field.key);
      }
    }
    return [...seen].map(([key, label]) => ({ key, label }));
  }, [typeOptions, initialDocumentTypeIds]);

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
    queryKey: ["documents", "list", debouncedSearch, typeFiltersKey, importance, relevance, expiringSoon, customFieldKey, customFieldValue, currentPage],
    queryFn:  () => fetchDocuments(debouncedSearch, initialDocumentTypeIds ?? [], currentPage, importance, relevance, expiringSoon, customFieldKey, customFieldValue),
    enabled:  !noTypesSelected,
  });

  const total      = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const paginate   = total > PAGE_SIZE;
  const items      = query.data?.items ?? [];

  // Slice #32.15: this key must carry every value the query key above carries.
  // A filter that is missing here leaves ticks set on rows the filter has just
  // taken off the screen, and the bulk delete then acts on records nobody can see.
  const pageKey = `${debouncedSearch}|${typeFiltersKey}|${importance}|${relevance}|${expiringSoon}|${customFieldKey}|${customFieldValue}|${currentPage}`;
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

  function toggleCol(key: string) {
    setVisibleCols((prev) => {
      let next: string[];
      if (prev.includes(key)) {
        next = prev.filter((k) => k !== key);
      } else if (prev.length < MAX_OPT) {
        next = [...prev, key];
      } else {
        return prev;
      }
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      return next;
    });
  }

  // Optional column definitions (ordered)
  const optionalCols = [
    { key: "nrDocument",   label: t("table.nrDocument") },
    { key: "dateDocument", label: t("table.dateDocument") },
    // Slice #23.10.dev hid these three behind the developer-tools flag because
    // the Metadata tab that feeds them was a developer surface. Slice #32.19
    // revealed both: the tab and the columns move together, so a value a user
    // can now set is a value they can now see in the list beside the filter
    // that selects on it. (See, not sort — none of these lists sorts by a
    // column, and saying so here would be a claim the next reader believes.)
    { key: "importance",   label: t("table.importance") },
    { key: "relevance",    label: t("table.relevance") },
    { key: "provenance",   label: t("table.provenance") },
  ];

  function cellValue(item: DocumentListItem, key: string): React.ReactNode {
    switch (key) {
      case "nrDocument":   return item.nrDocument   ?? "";
      case "dateDocument": return item.dateDocument ?? "";
      // Slice #32.19 — the label the user sees, not the database code. The
      // filter beside this column already renders „Ridicată"; before this the
      // cell under it rendered `HIGH`. `tMeta` is the same `shared` namespace
      // both read from.
      case "importance":   return metadataValueLabel(tMetaKey, "importance", item.importance);
      case "relevance":    return metadataValueLabel(tMetaKey, "relevance",  item.relevance);
      case "provenance":   return metadataValueLabel(tMetaKey, "provenance", item.provenance);
      default:             return null;
    }
  }

  // Total columns = checkbox + code + type + title + visible optionals + open
  const colCount = 5 + visibleCols.length;

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <DocumentTypeFilterDropdown
          types={typeOptions}
          initialDocumentTypeIds={initialDocumentTypeIds}
          label={t("typeFilterLabel")}
          allTypesLabel={t("allTypes")}
        />
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="w-64 rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm placeholder:text-fade focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
        />

        {/* Importance and Relevance are curation values set on the Metadata
            tab. Slice #23.10.dev wrapped both filters in <DevOnly> because
            that tab was developer-only; Slice #32.19 removed the wrapper along
            with the gate on the tab itself, so the two agree again.

            The Expiring-soon toggle below was never in that wrapper. It filters
            on the document's own date_valid_until, entered on the Details tab —
            a business question ("what expires soon?"), not a curation value.
            Slice #20.06 shipped the three together, which is the only reason
            they look like one group. Its threshold is configured in Settings →
            Time frames, which is an ordinary Admin-Setup screen again. */}
        {/* Importance filter */}
        <div className="inline-flex items-center gap-1.5 rounded-md border border-wire bg-white px-2 py-1.5 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <span className="text-fade">{tFilter("importanceLabel")}</span>
          <select
            value={importance}
            onChange={(e) => { setImportance(e.target.value); setCurrentPage(0); }}
            aria-label={tFilter("importanceLabel")}
            className="bg-transparent text-sm font-medium text-ink focus:outline-none dark:text-zinc-100"
          >
            <option value="">{tFilter("allImportances")}</option>
            <option value="LOW">{tMeta("importanceValues.LOW")}</option>
            <option value="MEDIUM">{tMeta("importanceValues.MEDIUM")}</option>
            <option value="HIGH">{tMeta("importanceValues.HIGH")}</option>
          </select>
        </div>

        {/* Relevance filter */}
        <div className="inline-flex items-center gap-1.5 rounded-md border border-wire bg-white px-2 py-1.5 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <span className="text-fade">{tFilter("relevanceLabel")}</span>
          <select
            value={relevance}
            onChange={(e) => { setRelevance(e.target.value); setCurrentPage(0); }}
            aria-label={tFilter("relevanceLabel")}
            className="bg-transparent text-sm font-medium text-ink focus:outline-none dark:text-zinc-100"
          >
            <option value="">{tFilter("allRelevances")}</option>
            <option value="INACTIVE">{tMeta("relevanceValues.INACTIVE")}</option>
            <option value="HISTORICAL">{tMeta("relevanceValues.HISTORICAL")}</option>
            <option value="CURRENT">{tMeta("relevanceValues.CURRENT")}</option>
            <option value="FUTURE">{tMeta("relevanceValues.FUTURE")}</option>
          </select>
        </div>

        {/* ── Custom-field filter ─────────────── (Slice #34.10) ─────────
            The half of D-01 that needs code. D-01 settled that
            CONTRACT_VANZARE gets ONE union form plus one hand-written field
            carrying the flavour — five descriptions, no subtype level — and
            until this control the answer was on paper only: nothing anywhere
            read `custom_fields` for search or for filtering, so a flavour could
            be captured and never grouped by.

            ⚠️ **DRAWN ONLY WHEN THE TYPES ON SCREEN HAVE A CUSTOM FIELD AT
            ALL.** Most of this archive's types have no template, and a pair of
            permanently empty dropdowns on the one list every user opens daily
            would be two controls that never do anything — the shape #34.02
            argued against for the review checkbox on lists that can never fill
            it.

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
        {customFieldOptions.length > 0 && (
          <div className="inline-flex items-center gap-1.5 rounded-md border border-wire bg-white px-2 py-1.5 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <span className="text-fade">{tFilter("customFieldLabel")}</span>
            <select
              value={customFieldKey}
              onChange={(e) => {
                setCustomFieldKey(e.target.value);
                // ⚠️ The value belongs to the OLD key. Carrying it over would
                // filter the new field for a string only the old one held, and
                // the list would empty out with both controls looking right.
                setCustomFieldValue("");
                setCurrentPage(0);
              }}
              aria-label={tFilter("customFieldLabel")}
              className="bg-transparent text-sm font-medium text-ink focus:outline-none dark:text-zinc-100"
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
                    {tFilter("customFieldValueOption", { value: o.value, count: o.count })}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Expiring-soon toggle */}
        <button
          type="button"
          onClick={() => { setExpiringSoon((v) => !v); setCurrentPage(0); }}
          aria-pressed={expiringSoon}
          className={`inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium shadow-sm transition-colors ${
            expiringSoon
              ? "border-amber-500 bg-amber-50 text-amber-700 dark:border-amber-400 dark:bg-amber-900/30 dark:text-amber-300"
              : "border-wire bg-white text-ink hover:bg-canvas dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          }`}
        >
          {tFilter("expiringSoon")}
        </button>

        {/* Choose fields */}
        <div ref={colPickerRef} className="relative">
          <button
            type="button"
            onClick={() => setShowColPicker((v) => !v)}
            aria-haspopup="true"
            aria-expanded={showColPicker}
            className={buttonClass({ variant: "secondary", size: "md", className: "gap-1.5" })}
          >
            <span className="text-fade">{t("chooseFields")}</span>
            <span className="font-mono text-xs text-fade">{visibleCols.length}/{MAX_OPT}</span>
          </button>
          {showColPicker && (
            <div className="absolute z-20 mt-1 left-0 w-52 rounded-md border border-wire bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900 p-3">
              <p className="mb-2 text-xs text-fade dark:text-zinc-500">
                {t("chooseFieldsHint", { max: MAX_OPT })}
              </p>
              {optionalCols.map((col) => {
                const checked  = visibleCols.includes(col.key);
                const disabled = !checked && visibleCols.length >= MAX_OPT;
                return (
                  <label key={col.key} className="flex items-center gap-2 py-0.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleCol(col.key)}
                      className="h-4 w-4 rounded border-wire accent-cta disabled:opacity-40"
                    />
                    <span className="text-sm text-ink dark:text-zinc-100">{col.label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className={buttonClass({ variant: "danger", size: "lg" })}
            >
              {tBulk("deleteSelected", { count: selectedIds.size })}
            </button>
          )}
          <HelpHint hintKey="select-all-page-only" />
          <Link
            href="/documents/new"
            className="inline-flex items-center rounded-md bg-cta px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-cta-d"
          >
            {t("addNew")}
          </Link>
        </div>
      </div>

      {deleteError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {deleteError}
        </p>
      )}

      {/* No types selected — prompt the user to pick at least one */}
      {noTypesSelected ? (
        <div className="overflow-x-auto rounded-md border border-card-rim bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="px-4 py-8 text-center text-sm text-fade">
            {t("noTypeSelected")}
          </div>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border border-card-rim bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full text-sm">
              <thead className="bg-cap text-left text-xs font-medium uppercase tracking-wide text-ink dark:bg-zinc-800 dark:text-zinc-300">
                <tr>
                  <th className="w-10 px-4 py-2">
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
                  <th className="px-4 py-2">{t("table.code")}</th>
                  <th className="px-4 py-2">{t("table.type")}</th>
                  <th className="px-4 py-2">{t("table.title")}</th>
                  {visibleCols.map((key) => (
                    <th key={key} className="px-4 py-2">
                      {optionalCols.find((c) => c.key === key)?.label ?? key}
                    </th>
                  ))}
                  <th className="px-4 py-2 w-24" />
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
                    onClick={() => router.push(`/documents/${item.id}`)}
                    className="whitespace-nowrap hover:bg-cta-pale dark:hover:bg-zinc-800/50 cursor-pointer"
                  >
                    <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                      <span className="inline-flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleOne(item.id)}
                          aria-label={item.title ?? item.code}
                          className="h-4 w-4 rounded border-wire accent-cta"
                        />
                        <RecencyBadge createdAt={item.createdAt} updatedAt={item.updatedAt} />
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-fade">
                      {item.code}
                    </td>
                    <td className="px-4 py-2 text-fade dark:text-zinc-400">
                      {item.documentTypeName ?? "—"}
                    </td>
                    <td className="px-4 py-2 font-medium">
                      {item.title ?? (
                        <span className="text-fade italic">—</span>
                      )}
                    </td>
                    {visibleCols.map((key) => (
                      <td key={key} className="px-4 py-2 text-fade dark:text-zinc-400">
                        {cellValue(item, key)}
                      </td>
                    ))}
                    <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/documents/${item.id}`}
                        className="inline-flex items-center rounded-md border border-wire bg-white px-3 py-1 text-xs font-medium text-ink shadow-sm hover:bg-canvas dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                      >
                        {t("open")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between gap-4">
            <div className="text-xs text-fade dark:text-zinc-400">
              {query.data
                ? t("counts", { shown: query.data.items.length, total })
                : null}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => p - 1)}
                disabled={!paginate || currentPage === 0}
                className={buttonClass({ variant: "secondary", size: "sm" })}
              >
                {tPag("previous")}
              </button>
              <span className="text-xs text-fade dark:text-zinc-400">
                {tPag("pageOf", { page: currentPage + 1, total: totalPages })}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={!paginate || currentPage >= totalPages - 1}
                className={buttonClass({ variant: "secondary", size: "sm" })}
              >
                {tPag("next")}
              </button>
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
