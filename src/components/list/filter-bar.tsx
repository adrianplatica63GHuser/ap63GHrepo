"use client";

/**
 * A principal list's filter bar — the active filters' chips above the list, and „Șterge filtrele". (Slice #39.61)
 *
 * The design agreed in the research doc (section 7; Adrian: „agree"): each filter a chip. Since Slice #39.82 a filter
 * is opened from its column — the funnel in the header of a column that can be filtered (`FilterFunnel`), shown
 * when the column is chosen in „Câmpuri afișate" — or from its chip; there is no „+ Filtru" any more (Adrian,
 * 2026-10-18: „we are removing the " + Filter" dropdown; its functionality will be replaced by column filters").
 * The editor opens right under the funnel or the chip that opened it (#39.82's Ask first 5). A checklist shows how
 * many rows hold each value, counted with the list's other filters applied, and has a search box. Numbers and
 * dates are from / to; free text is „contains". OR within a field, AND across fields. A chip does not depend on its
 * column being shown, so the list never filters invisibly — hiding a column keeps its filter, and its chip still
 * says what it filters (#39.82's Ask first 1). The state, its address and its route parameters are
 * `@/lib/list/filter-bar`'s; this is the screen. Shared: Proprietăți (#39.61), then the person lists and Acte.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Funnel, FunnelX, X } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import {
  NONE_VALUE,
  activeFilterKeys,
  datePreset,
  dmy,
  offeredValues,
  setFilter,
  toggleValue,
  valuesMatching,
  withoutFilter,
  type FacetValue,
  type FilterKind,
  type FilterState,
  type FilterValue,
} from "@/lib/list/filter-bar";

export type FilterBarField = {
  key: string;
  kind: FilterKind;
  label: string;
  /** A „choice" field's values and their words, in order (#39.62: „în viață", „decedați"), and its „all". */
  choices?: readonly { value: string; label: string }[];
  allLabel?: string;
  /** A checklist whose values are codes, not names (a gender): the words for each. */
  valueLabel?: (id: string) => string;
};

type Props = {
  fields: readonly FilterBarField[];
  state: FilterState;
  onChange: (next: FilterState) => void;
  /** The field whose editor is open — a chip on the bar, or a column's funnel, sets it. */
  editing: string | null;
  onEditing: (key: string | null) => void;
  /** A checklist's values, counted over the list with every other filter applied. */
  loadValues: (key: string) => Promise<FacetValue[]>;
  /** Their query key: the list's search and its filters — the field's own too, which names its ticked values. */
  valuesKey: (key: string) => readonly unknown[];
  /** A list's own controls that stand first on the bar (#39.63: Acte's „Expiră curând" toggle). */
  leading?: ReactNode;
};

const NUMBER = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 });
/** The editor's width — `w-80` — so it can be kept inside the window when its anchor is near the right edge. */
const EDITOR_WIDTH = 320;
/** The gap between the anchor and the editor under it. */
const EDITOR_GAP = 4;

/** The funnel of the column that filters `key`, if that column is on screen. */
function funnelOf(key: string): Element | null {
  return document.querySelector(`[data-filter-funnel="${CSS.escape(key)}"]`);
}

/** The bar. */
export function FilterBar({ fields, state, onChange, editing, onEditing, loadValues, valuesKey, leading }: Props) {
  const t = useTranslations("shared.filterBar");
  const ref = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  // Slice #39.82: the chip that opened the editor, when a chip did — otherwise it opens under the column's funnel.
  const [chipAnchor, setChipAnchor] = useState<string | null>(null);
  const active = activeFilterKeys(state, fields);
  const byKey = new Map(fields.map((f) => [f.key, f]));

  // The chips of active checklists name their values, so their values are read as soon as they are on screen.
  const activeValues = active.filter((k) => byKey.get(k)?.kind === "values");
  const facets = useQueries({
    queries: activeValues.map((k) => ({ queryKey: valuesKey(k), queryFn: () => loadValues(k), staleTime: 30_000 })),
  });
  const facetsOf = new Map(activeValues.map((k, i) => [k, facets[i]?.data]));

  function close() {
    setChipAnchor(null);
    onEditing(null);
  }

  useEffect(() => {
    if (!editing) return;
    function outside(e: MouseEvent) {
      const target = e.target as Element | null;
      if (!ref.current || !target) return;
      // A funnel opens its own column's filter (the list sets `editing`), under itself rather than under a chip.
      if (target.closest?.("[data-filter-funnel]")) {
        setChipAnchor(null);
        return;
      }
      if (!ref.current.contains(target)) {
        setChipAnchor(null);
        onEditing(null);
      }
    }
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setChipAnchor(null);
        onEditing(null);
      }
    }
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [editing, onEditing]);

  // Slice #39.82 (Ask first 5): the editor opens right under the funnel or the chip that opened it — not under the
  // bar. Placed before paint, and again when the window resizes or anything scrolls (the table's frame scrolls
  // sideways, #37.16). Kept inside the window on the right. A filter opened with its column hidden and no chip yet
  // has no anchor, and opens at the bar's start.
  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editing || !editor) return;
    const key = editing;
    function place() {
      const bar = ref.current;
      if (!bar || !editor) return;
      const chip = bar.querySelector(`[data-filter-chip="${CSS.escape(key)}"]`);
      const anchor = (chipAnchor === key ? chip : null) ?? funnelOf(key) ?? chip;
      const b = bar.getBoundingClientRect();
      if (!anchor) {
        editor.style.left = "0px";
        editor.style.top = `${b.height + EDITOR_GAP}px`;
        return;
      }
      const a = anchor.getBoundingClientRect();
      const maxLeft = document.documentElement.clientWidth - EDITOR_WIDTH - 8 - b.left;
      editor.style.left = `${Math.max(0, Math.min(a.left - b.left, maxLeft))}px`;
      editor.style.top = `${a.bottom - b.top + EDITOR_GAP}px`;
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [editing, chipAnchor, state]);

  function summary(field: FilterBarField, value: FilterValue): string {
    if (value.kind === "values") {
      if (value.ids.length > 1) return t("valuesCount", { count: value.ids.length });
      const id = value.ids[0];
      if (id === NONE_VALUE) return t("none");
      if (field.valueLabel) return field.valueLabel(id);
      return facetsOf.get(field.key)?.find((f) => f.id === id)?.label ?? t("valuesCount", { count: 1 });
    }
    if (value.kind === "choice") return field.choices?.find((o) => o.value === value.value)?.label ?? value.value;
    if (value.kind === "dates") {
      if (value.from !== null && value.to !== null) return t("rangeBoth", { from: dmy(value.from), to: dmy(value.to) });
      if (value.from !== null) return t("datesFrom", { from: dmy(value.from) });
      return t("datesTo", { to: dmy(value.to ?? "") });
    }
    if (value.kind === "range") {
      if (value.from !== null && value.to !== null) return t("rangeBoth", { from: NUMBER.format(value.from), to: NUMBER.format(value.to) });
      if (value.from !== null) return t("rangeFrom", { from: NUMBER.format(value.from) });
      return t("rangeTo", { to: NUMBER.format(value.to ?? 0) });
    }
    return t("contains", { text: value.text });
  }

  const editingField = editing ? byKey.get(editing) : undefined;

  return (
    <div ref={ref} className="relative flex flex-wrap items-center gap-2" data-filter-bar="">
      {leading}
      {active.map((key) => {
        const field = byKey.get(key)!;
        const value = state[key]!;
        return (
          <span
            key={key}
            data-filter-chip={key}
            className="inline-flex items-center gap-1 rounded-full border border-cta bg-cta-pale py-0.5 pl-3 pr-1 text-sm dark:border-zinc-600 dark:bg-zinc-800"
          >
            <button
              type="button"
              onClick={() => {
                if (editing === key) {
                  close();
                } else {
                  setChipAnchor(key);
                  onEditing(key);
                }
              }}
              aria-expanded={editing === key}
              aria-haspopup="dialog"
              className="max-w-80 truncate text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-cta"
            >
              <span className="text-fade">{field.label}</span> <span className="font-medium text-ink dark:text-zinc-100">{summary(field, value)}</span>
            </button>
            <IconButton
              icon={X}
              label={t("remove", { field: field.label })}
              variant="secondary"
              size="xs"
              pill
              onClick={() => {
                onChange(withoutFilter(state, key));
                if (editing === key) close();
              }}
            />
          </span>
        );
      })}

      {/* Slice #39.82: no „+ Filtru" here any more — a filter is opened from its column's funnel, or from its chip. */}
      {active.length > 0 && (
        <IconButton
          icon={FunnelX}
          label={t("clearAll")}
          showLabel
          variant="secondary"
          size="sm"
          onClick={() => {
            onChange({});
            close();
          }}
        />
      )}

      {editingField && (
        <div
          ref={editorRef}
          role="dialog"
          aria-label={editingField.label}
          data-filter-editor={editingField.key}
          className="absolute left-0 top-full z-30 w-80 rounded-md border border-wire bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-ink dark:text-zinc-100">{editingField.label}</span>
            <IconButton icon={X} label={t("close")} variant="secondary" size="xs" onClick={close} />
          </div>
          {editingField.kind === "values" ? (
            <ValuesEditor
              field={editingField}
              state={state}
              onChange={onChange}
              queryKey={valuesKey(editingField.key)}
              load={() => loadValues(editingField.key)}
            />
          ) : editingField.kind === "range" ? (
            <RangeEditor key={editingField.key} field={editingField} state={state} onChange={onChange} />
          ) : editingField.kind === "dates" ? (
            <DatesEditor key={editingField.key} field={editingField} state={state} onChange={onChange} />
          ) : editingField.kind === "choice" ? (
            <ChoiceEditor field={editingField} state={state} onChange={onChange} />
          ) : (
            <TextEditor key={editingField.key} field={editingField} state={state} onChange={onChange} />
          )}
        </div>
      )}
    </div>
  );
}

function ValuesEditor({
  field,
  state,
  onChange,
  queryKey,
  load,
}: {
  field: FilterBarField;
  state: FilterState;
  onChange: (next: FilterState) => void;
  queryKey: readonly unknown[];
  load: () => Promise<FacetValue[]>;
}) {
  const t = useTranslations("shared.filterBar");
  const [search, setSearch] = useState("");
  const focus = useFocusOnOpen<HTMLInputElement>();
  const query = useQuery({ queryKey, queryFn: load, staleTime: 30_000 });
  const cur = state[field.key];
  const ticked = cur?.kind === "values" ? cur.ids : [];
  const offered = offeredValues(query.data ?? [], ticked).map((v) =>
    field.valueLabel && v.id !== NONE_VALUE ? { ...v, label: field.valueLabel(v.id) } : v,
  );
  const shown = valuesMatching(offered, search, t("none"));
  return (
    <div className="flex flex-col gap-2">
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        ref={focus}
        placeholder={t("search")}
        aria-label={t("search")}
        autoComplete="off"
        className="w-[18.5rem] rounded-md border border-wire bg-white px-2 py-1 text-sm text-ink placeholder:text-fade focus:outline-none focus:ring-2 focus:ring-cta dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      />
      <div className="max-h-64 overflow-y-auto" data-filter-values="">
        {query.isLoading && <p className="px-1 py-1 text-sm italic text-fade">{t("loading")}</p>}
        {query.isError && <p className="px-1 py-1 text-sm text-red-600" role="alert">{t("loadError")}</p>}
        {query.isSuccess && shown.length === 0 && <p className="px-1 py-1 text-sm italic text-fade">{t("searchEmpty")}</p>}
        {shown.map((v) => (
          <label
            key={v.id}
            data-filter-value={v.id}
            className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-cta-pale dark:hover:bg-zinc-800/50"
          >
            <input
              type="checkbox"
              checked={ticked.includes(v.id)}
              onChange={() => onChange(toggleValue(state, field.key, v.id))}
              className="h-4 w-4 shrink-0 rounded border-wire accent-cta"
            />
            <span className={`min-w-0 flex-1 truncate ${v.id === NONE_VALUE ? "italic text-fade" : "text-ink dark:text-zinc-100"}`}>
              {v.id === NONE_VALUE ? t("none") : field.valueLabel ? field.valueLabel(v.id) : (v.label ?? v.id)}
            </span>
            <span className="shrink-0 tabular-nums text-xs text-fade" data-filter-count={v.count}>
              {v.count}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

/**
 * Typed into a box, applied a moment after the typing stops — each keystroke is not a query. What is still waiting
 * when the editor closes is applied then, not lost.
 */
function usePendingApply(): (apply: () => void) => void {
  const timer = useRef<number | undefined>(undefined);
  const pending = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      pending.current?.();
    },
    [],
  );
  return (apply: () => void) => {
    window.clearTimeout(timer.current);
    pending.current = apply;
    timer.current = window.setTimeout(() => {
      pending.current = null;
      apply();
    }, 400);
  };
}

/** The box focused when its editor opens. */
function useFocusOnOpen<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return ref;
}

function numberOrNull(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** `state` and `onChange` as they are when a pending change is applied, not when it was typed. */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

function RangeEditor({ field, state, onChange }: { field: FilterBarField; state: FilterState; onChange: (next: FilterState) => void }) {
  const t = useTranslations("shared.filterBar");
  const cur = state[field.key];
  const [from, setFrom] = useState(cur?.kind === "range" && cur.from !== null ? String(cur.from) : "");
  const [to, setTo] = useState(cur?.kind === "range" && cur.to !== null ? String(cur.to) : "");
  const latest = useLatest({ state, onChange });
  const schedule = usePendingApply();
  const focus = useFocusOnOpen<HTMLInputElement>();
  const apply = (nextFrom: string, nextTo: string) =>
    schedule(() => {
      const f = numberOrNull(nextFrom);
      const tt = numberOrNull(nextTo);
      const [lo, hi] = f !== null && tt !== null && f > tt ? [tt, f] : [f, tt];
      latest.current.onChange(setFilter(latest.current.state, field.key, { kind: "range", from: lo, to: hi }));
    });
  return (
    <div className="flex items-end gap-2">
      <Box label={t("from")}>
        <input
          ref={focus}
          type="number"
          inputMode="decimal"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            apply(e.target.value, to);
          }}
          data-filter-from=""
          className={NUMBER_BOX}
        />
      </Box>
      <Box label={t("to")}>
        <input
          type="number"
          inputMode="decimal"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            apply(from, e.target.value);
          }}
          data-filter-to=""
          className={NUMBER_BOX}
        />
      </Box>
    </div>
  );
}

function TextEditor({ field, state, onChange }: { field: FilterBarField; state: FilterState; onChange: (next: FilterState) => void }) {
  const t = useTranslations("shared.filterBar");
  const cur = state[field.key];
  const [text, setText] = useState(cur?.kind === "text" ? cur.text : "");
  const latest = useLatest({ state, onChange });
  const schedule = usePendingApply();
  const focus = useFocusOnOpen<HTMLInputElement>();
  return (
    <Box label={t("containsLabel")}>
      <input
        ref={focus}
        type="search"
        value={text}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          schedule(() => latest.current.onChange(setFilter(latest.current.state, field.key, { kind: "text", text: next.trim() })));
        }}
        autoComplete="off"
        data-filter-text=""
        className="w-[18.5rem] rounded-md border border-wire bg-white px-2 py-1 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-cta dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      />
    </Box>
  );
}

function DatesEditor({ field, state, onChange }: { field: FilterBarField; state: FilterState; onChange: (next: FilterState) => void }) {
  const t = useTranslations("shared.filterBar");
  const cur = state[field.key];
  const [from, setFrom] = useState(cur?.kind === "dates" ? (cur.from ?? "") : "");
  const [to, setTo] = useState(cur?.kind === "dates" ? (cur.to ?? "") : "");
  const latest = useLatest({ state, onChange });
  const focus = useFocusOnOpen<HTMLInputElement>();
  // A date input changes once per picked date, so it applies at once — no typing to wait for.
  const apply = (f: string, tt: string) => {
    const [lo, hi] = f && tt && f > tt ? [tt, f] : [f, tt];
    latest.current.onChange(setFilter(latest.current.state, field.key, { kind: "dates", from: lo || null, to: hi || null }));
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <Box label={t("from")}>
          <input ref={focus} type="date" value={from} onChange={(e) => { setFrom(e.target.value); apply(e.target.value, to); }} data-filter-from="" className={NUMBER_BOX} />
        </Box>
        <Box label={t("to")}>
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); apply(from, e.target.value); }} data-filter-to="" className={NUMBER_BOX} />
        </Box>
      </div>
      <select
        value=""
        aria-label={t("datesPreset")}
        onChange={(e) => {
          const v = e.target.value;
          if (v !== "thisYear" && v !== "last12Months") return;
          const p = datePreset(v);
          setFrom(p.from);
          setTo(p.to);
          apply(p.from, p.to);
        }}
        className="w-[17.5rem] rounded-md border border-wire bg-white px-2 py-1 text-sm text-ink dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      >
        <option value="">{t("datesPreset")}</option>
        <option value="thisYear">{t("thisYear")}</option>
        <option value="last12Months">{t("last12Months")}</option>
      </select>
    </div>
  );
}

/** A „choice": „toți" (no filter) or one of the field's options. */
function ChoiceEditor({ field, state, onChange }: { field: FilterBarField; state: FilterState; onChange: (next: FilterState) => void }) {
  const t = useTranslations("shared.filterBar");
  const cur = state[field.key];
  const value = cur?.kind === "choice" ? cur.value : "";
  const options = [{ value: "", label: field.allLabel ?? t("all") }, ...(field.choices ?? [])];
  return (
    <div role="radiogroup" aria-label={field.label} className="flex flex-col gap-1" data-filter-choice="">
      {options.map((o) => (
        <label key={o.value || "_all"} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-cta-pale dark:hover:bg-zinc-800/50">
          <input
            type="radio"
            name={`filter-${field.key}`}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(setFilter(state, field.key, o.value ? { kind: "choice", value: o.value } : null))}
            className="h-4 w-4 accent-cta"
          />
          <span className="text-ink dark:text-zinc-100">{o.label}</span>
        </label>
      ))}
    </div>
  );
}

const NUMBER_BOX =
  "w-[8.5rem] rounded-md border border-wire bg-white px-2 py-1 text-sm text-ink tabular-nums focus:outline-none focus:ring-2 focus:ring-cta dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

function Box({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-fade">{label}</span>
      {children}
    </label>
  );
}

/**
 * The funnel in a column's header: opens that column's filter, right under itself (#39.82). Filled while the column
 * is filtered. Since #39.83 it stands alone on the band's third row (`ListHeadCell`), under the name, not after it. Drawn only on the columns that can be filtered — each list's `*_COLUMN_FILTERS` (#39.82). `field` is
 * the filter's key, which the bar finds the funnel by.
 */
export function FilterFunnel({ field, label, active, onOpen }: { field: string; label: string; active: boolean; onOpen: () => void }) {
  const t = useTranslations("shared.filterBar");
  return (
    <span data-filter-funnel={field} className="inline-flex normal-case">
      <IconButton
        icon={Funnel}
        label={t("funnel", { field: label })}
        variant={active ? "primary" : "secondary"}
        size="xs"
        aria-pressed={active}
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
      />
    </span>
  );
}
