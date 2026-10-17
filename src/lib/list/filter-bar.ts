/**
 * A principal list's filter bar — the filters, in the list's address and in its query.            (Slice #39.61)
 *
 * Adrian, 2026-10-16, on the research doc's section 7: „One filter bar for every list. The document type filter
 * becomes its first chip; Câmp specific stays as a dependent chip.  (Adrian: agree)". Each filter is a chip above
 * the list. A field with a list of values is a checklist, OR within the field; numbers are from / to; free text is
 * „contains"; fields AND together. This module is the part that needs no React and no database: what a filter
 * holds, how it is written into the address (and sent to the list's route, in the same words), and how it is read
 * back. Shared by the lists — Proprietăți first (#39.61), the person lists (#39.62) and Acte (#39.63) after.
 *
 * THE ADDRESS (#39.61's Ask first 2): one key per field, its values comma-separated —
 *   ?propertyType=<uuid>,<uuid>&surfaceAreaMp=100..500&cadastralNumber=123
 * as `documentTypeIds` already is. A value that is itself text (a locality) has its commas and percent signs
 * escaped (`%2C`, `%25`) before joining. `_none` is „(necompletat)": the field left empty. Anything malformed reads
 * as unset — a list never refuses to open over its address.
 *
 * PURE — `filter-bar.test.ts` covers it.
 */

export type FilterKind = "values" | "range" | "text" | "dates" | "choice";

/**
 * One filterable field of a list: its key (address and route) and what kind of filter it takes. A „choice" names
 * the values it may take (#39.62: „toți / în viață / decedați" is a choice of `alive` or `deceased`, none = toți).
 */
export type FilterFieldDef = { readonly key: string; readonly kind: FilterKind; readonly options?: readonly string[] };

export type ValuesFilter = { readonly kind: "values"; readonly ids: readonly string[] };
export type RangeFilter = { readonly kind: "range"; readonly from: number | null; readonly to: number | null };
export type TextFilter = { readonly kind: "text"; readonly text: string };
/** Dates as ISO `yyyy-mm-dd`, either side open (#39.62: born, died). */
export type DatesFilter = { readonly kind: "dates"; readonly from: string | null; readonly to: string | null };
/** One of a field's `options`; no filter is „all". */
export type ChoiceFilter = { readonly kind: "choice"; readonly value: string };
export type FilterValue = ValuesFilter | RangeFilter | TextFilter | DatesFilter | ChoiceFilter;

/** The filters set, by field key. A field that is not a key here is not filtered. */
export type FilterState = Readonly<Record<string, FilterValue>>;

/** „(necompletat)" — the field left empty, offered beside the values it holds. */
export const NONE_VALUE = "_none";
/** An address is not a store. */
export const MAX_FILTER_VALUES = 50;
export const MAX_FILTER_TEXT = 100;

/** One value a checklist offers: its id, what it is called, and how many rows of the list hold it. */
export type FacetValue = { id: string; label: string | null; count: number };

function escapeItem(s: string): string {
  return s.replace(/%/g, "%25").replace(/,/g, "%2C");
}
function unescapeItem(s: string): string {
  return s.replace(/%2C/gi, ",").replace(/%25/g, "%");
}

/** The values of a checklist, as the address writes them. */
export function encodeValues(ids: readonly string[]): string {
  return ids.map(escapeItem).join(",");
}

/** The values of a checklist, read back: trimmed, de-duplicated, empty ones dropped, at most `MAX_FILTER_VALUES`. */
export function decodeValues(raw: string): string[] {
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const v = unescapeItem(part).trim();
    if (v && !out.includes(v)) out.push(v);
    if (out.length >= MAX_FILTER_VALUES) break;
  }
  return out;
}

function numberOf(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (t === "" || !/^-?\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** A from / to, as `<from>..<to>`, either side empty. */
export function encodeRange(from: number | null, to: number | null): string {
  if (from === null && to === null) return "";
  return `${from ?? ""}..${to ?? ""}`;
}

/** A from / to read back; both sides unreadable is no filter. The two swap when written the wrong way round. */
export function decodeRange(raw: string): RangeFilter | null {
  const t = raw.trim();
  const at = t.indexOf("..");
  if (at < 0) return null;
  let from = numberOf(t.slice(0, at));
  let to = numberOf(t.slice(at + 2));
  if (from === null && to === null) return null;
  if (from !== null && to !== null && from > to) [from, to] = [to, from];
  return { kind: "range", from, to };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date as `yyyy-mm-dd`, or null. */
function isoDateOf(raw: string): string | null {
  const t = raw.trim();
  if (!ISO_DATE.test(t)) return null;
  const d = new Date(`${t}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== t ? null : t;
}

/** Dates read back as `<from>..<to>`; both sides unreadable is no filter; a reversed pair swaps. */
export function decodeDates(raw: string): DatesFilter | null {
  const t = raw.trim();
  const at = t.indexOf("..");
  if (at < 0) return null;
  let from = isoDateOf(t.slice(0, at));
  let to = isoDateOf(t.slice(at + 2));
  if (from === null && to === null) return null;
  if (from !== null && to !== null && from > to) [from, to] = [to, from];
  return { kind: "dates", from, to };
}

/** One field's filter as the address writes it; "" when it filters nothing. */
export function encodeFilter(value: FilterValue | undefined): string {
  if (!value) return "";
  if (value.kind === "values") return encodeValues(value.ids);
  if (value.kind === "range") return encodeRange(value.from, value.to);
  if (value.kind === "dates") return value.from === null && value.to === null ? "" : `${value.from ?? ""}..${value.to ?? ""}`;
  if (value.kind === "choice") return value.value;
  return value.text.trim().slice(0, MAX_FILTER_TEXT);
}

/** One field's filter read from the address, or null when it is unset or unreadable. */
export function decodeFilter(field: FilterFieldDef, raw: string | null): FilterValue | null {
  if (raw === null || raw.trim() === "") return null;
  if (field.kind === "values") {
    const ids = decodeValues(raw);
    return ids.length > 0 ? { kind: "values", ids } : null;
  }
  if (field.kind === "range") return decodeRange(raw);
  if (field.kind === "dates") return decodeDates(raw);
  if (field.kind === "choice") {
    const v = raw.trim();
    return field.options?.includes(v) ? { kind: "choice", value: v } : null;
  }
  const text = raw.trim().slice(0, MAX_FILTER_TEXT);
  return text ? { kind: "text", text } : null;
}

/** The filters an address (or a route's query) holds, for these fields. */
export function readFilterState(params: { get(key: string): string | null }, fields: readonly FilterFieldDef[]): FilterState {
  const out: Record<string, FilterValue> = {};
  for (const f of fields) {
    const v = decodeFilter(f, params.get(f.key));
    if (v) out[f.key] = v;
  }
  return out;
}

/**
 * Every field's key with what the address should hold for it — "" for a field not filtered, so writing the patch
 * removes a filter that was taken off (`writeListAddress` deletes a key given "").
 */
export function filterAddressPatch(state: FilterState, fields: readonly FilterFieldDef[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) out[f.key] = encodeFilter(state[f.key]);
  return out;
}

/** A filter that filters nothing — no value ticked, no bound, no text — is no filter. */
export function isEmptyFilter(value: FilterValue): boolean {
  if (value.kind === "values") return value.ids.length === 0;
  if (value.kind === "range" || value.kind === "dates") return value.from === null && value.to === null;
  if (value.kind === "choice") return value.value === "";
  return value.text.trim() === "";
}

/** `state` with `key` set to `value`, or taken off when `value` is null or filters nothing. */
export function setFilter(state: FilterState, key: string, value: FilterValue | null): FilterState {
  const next: Record<string, FilterValue> = { ...state };
  if (value === null || isEmptyFilter(value)) delete next[key];
  else next[key] = value;
  return next;
}

/** A checklist value ticked or unticked. */
export function toggleValue(state: FilterState, key: string, id: string): FilterState {
  const cur = state[key];
  const ids = cur?.kind === "values" ? cur.ids : [];
  const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(0, MAX_FILTER_VALUES);
  return setFilter(state, key, { kind: "values", ids: next });
}

/** The fields filtered, in the bar's order. */
export function activeFilterKeys(state: FilterState, fields: readonly FilterFieldDef[]): string[] {
  return fields.filter((f) => state[f.key] !== undefined).map((f) => f.key);
}

/** A string that changes exactly when the filters do — for query keys, the page reset and the address write. */
export function filterSignature(state: FilterState, fields: readonly FilterFieldDef[]): string {
  return fields.map((f) => `${f.key}=${encodeFilter(state[f.key])}`).filter((s) => !s.endsWith("=")).join("&");
}

/** `state` without the filter on `key` — what a checklist's counts are computed over (Ask first 3). */
export function withoutFilter(state: FilterState, key: string): FilterState {
  return setFilter(state, key, null);
}

/** The filters as query parameters for the list's route — the address's words, so the route reads them the same way. */
export function appendFilterParams(params: URLSearchParams, state: FilterState, fields: readonly FilterFieldDef[]): void {
  for (const f of fields) {
    const v = encodeFilter(state[f.key]);
    if (v) params.set(f.key, v);
  }
}

/**
 * The values a checklist offers: those the list holds (count > 0), and any ticked one it no longer holds, so it can
 * still be unticked. „(necompletat)" first, then by name.
 */
export function offeredValues(facets: readonly FacetValue[], ticked: readonly string[]): FacetValue[] {
  const held = facets.filter((f) => f.count > 0 || ticked.includes(f.id));
  const missing = ticked.filter((id) => !held.some((f) => f.id === id)).map((id) => ({ id, label: null, count: 0 }));
  const all = [...held, ...missing];
  return all.sort((a, b) => {
    if (a.id === NONE_VALUE) return -1;
    if (b.id === NONE_VALUE) return 1;
    return (a.label ?? a.id).localeCompare(b.label ?? b.id, "ro");
  });
}

/** The first and last day of the current year, and the twelve months to today — the dates editor's two shortcuts. */
export function datePreset(preset: "thisYear" | "last12Months", today: Date = new Date()): { from: string; to: string } {
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (preset === "thisYear") return { from: `${today.getFullYear()}-01-01`, to: `${today.getFullYear()}-12-31` };
  const from = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate() + 1);
  return { from: iso(from), to: iso(today) };
}

/** `yyyy-mm-dd` as the archive shows a date, `dd.mm.yyyy`. */
export function dmy(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/** Folded for search: lower case, no diacritics — „Bragadiru" is found by „braga", „Ilfov" by „ILF", „Măgurele" by „magu". */
export function foldForSearch(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** The values whose name holds `query`, folded. */
export function valuesMatching(values: readonly FacetValue[], query: string, noneLabel: string): FacetValue[] {
  const q = foldForSearch(query.trim());
  if (!q) return [...values];
  return values.filter((v) => foldForSearch(v.id === NONE_VALUE ? noneLabel : (v.label ?? v.id)).includes(q));
}
