/**
 * „Interacțiuni" — the history's ONE filter state.   (Slice #38.84)
 *
 * The spec (§3): the toolbar is the fast path, the column headers are there for people who think in columns, and
 * „both write to the same filter state, so they cannot disagree". This is that state, and the only place it is turned
 * into the list route's query (`listQuery`). The toolbar and every column filter take an `InteractionFilters` and
 * hand back a new one; neither keeps a copy of its own.
 *
 * ⚠️ **DESCRIPTION AND INTERNAL NOTE ARE NOT HERE, AND MUST NOT BE** (§3, §8.2). They are free text; a long note must
 * not become a filter by accident. `interactions-filters.test.ts` holds that no field of this state, and no key
 * `listQuery` writes, names either — and the route's own query is strict, so a key it does not know is refused.
 *
 * What is not a filter: the order (`InteractionOrder`, kept for the browser session, §8.3) and the scope — the person
 * whose history is shown, which lives in the address (`?person=<id>`, so the person's tile can open the screen
 * scoped, 38.89). „Șterge filtrele" restores the filters and the order and leaves the scope as it is.
 */
import {
  DEFAULT_ORDER,
  DEFAULT_RANGE_DAYS,
  DEFAULT_SORT,
  INTERACTION_CHANNELS,
  INTERACTION_STATUSES,
  SORT_FIELDS,
  SUBJECT_MAX,
  type InteractionChannel,
  type InteractionDirection,
  type InteractionSort,
  type InteractionStatus,
} from "./model";

/** The date range's presets (§3), in the order the picker lists them. */
export const RANGE_PRESETS = ["today", "last7", "last30", "last90", "thisYear", "custom"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

/** The „last N days" presets, by their N. */
const LAST_DAYS: Partial<Record<RangePreset, number>> = { last7: 7, last30: 30, last90: DEFAULT_RANGE_DAYS };

export type DirectionChoice = "ALL" | InteractionDirection;
export const DIRECTION_CHOICES: readonly DirectionChoice[] = ["ALL", "INBOUND", "OUTBOUND"];

export type DocumentsChoice = "ALL" | "WITH" | "WITHOUT";
export const DOCUMENTS_CHOICES: readonly DocumentsChoice[] = ["ALL", "WITH", "WITHOUT"];

export interface InteractionFilters {
  preset: RangePreset;
  /** „Personalizat" only: `yyyy-MM-dd`, both ends included, in the browser's own days. Empty = open. */
  customFrom: string;
  customTo: string;
  /** None ticked = every channel. */
  channels: InteractionChannel[];
  direction: DirectionChoice;
  /** „Subiectul conține" — the one short text field that is a filter (§3). */
  subject: string;
  documents: DocumentsChoice;
  /** None ticked = every status. */
  statuses: InteractionStatus[];
  /** The module bar's search: a person's name and the subject, never the description (§2). */
  q: string;
}

/** Every field of the filter state, by name — what the test reads. */
export const FILTER_STATE_FIELDS = [
  "preset",
  "customFrom",
  "customTo",
  "channels",
  "direction",
  "subject",
  "documents",
  "statuses",
  "q",
] as const satisfies readonly (keyof InteractionFilters)[];

/** The defaults (§3): the last 90 days, every channel, every direction, every status. */
export const DEFAULT_FILTERS: InteractionFilters = {
  preset: "last90",
  customFrom: "",
  customTo: "",
  channels: [],
  direction: "ALL",
  subject: "",
  documents: "ALL",
  statuses: [],
  q: "",
};

export interface InteractionOrder {
  sort: InteractionSort;
  order: "asc" | "desc";
}

/** Newest first (§3, §8.3). */
export const DEFAULT_ORDER_STATE: InteractionOrder = { sort: DEFAULT_SORT, order: DEFAULT_ORDER };

/** Ticked none, or ticked all: either way, no narrowing. */
function narrows(ticked: readonly string[], all: readonly string[]): boolean {
  return ticked.length > 0 && ticked.length < all.length;
}

/** True while any filter differs from its default — what shows „Șterge filtrele" (§3). The order is not a filter. */
export function isFiltered(f: InteractionFilters): boolean {
  return (
    f.preset !== DEFAULT_FILTERS.preset ||
    narrows(f.channels, INTERACTION_CHANNELS) ||
    f.direction !== "ALL" ||
    f.subject.trim() !== "" ||
    f.documents !== "ALL" ||
    narrows(f.statuses, INTERACTION_STATUSES) ||
    f.q.trim() !== ""
  );
}

/** The grid's columns, left to right (§3) — each one a sort, and each one a filter. */
export const HISTORY_COLUMNS = SORT_FIELDS;
export type HistoryColumn = InteractionSort;

/** Whether a column's own filter narrows the history — what marks its header's funnel. The person is the scope. */
export function columnFiltered(f: InteractionFilters, column: HistoryColumn, scope: string | null): boolean {
  switch (column) {
    case "occurredAt":
      return f.preset !== DEFAULT_FILTERS.preset;
    case "channel":
      return narrows(f.channels, INTERACTION_CHANNELS);
    case "direction":
      return f.direction !== "ALL";
    case "person":
      return scope !== null;
    case "subject":
      return f.subject.trim() !== "";
    case "documents":
      return f.documents !== "ALL";
    case "status":
      return narrows(f.statuses, INTERACTION_STATUSES);
  }
}

/** A value added to the list, or taken out of it if it was there — a chip pressed again clears it (§3). */
export function toggled<T>(xs: readonly T[], x: T): T[] {
  return xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x];
}

/** The „Așteaptă răspuns" counter's jump (§2): inbound rows still awaiting a reply, everything else as it was. */
export function needsReplyFilters(f: InteractionFilters): InteractionFilters {
  return { ...f, direction: "INBOUND", statuses: ["NEEDS_REPLY"] };
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** `yyyy-MM-dd` as the browser's own day, or null. */
export function parseDay(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 ? d : null;
}

/** A day as `yyyy-MM-dd`, the browser's own. */
export function dayString(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * The instants a range covers. `from` is the first moment of its first day; `to` the last moment of its last day —
 * or none: „Ultimele N zile" and „Anul acesta" end nowhere, so a meeting scheduled for next week is still in view
 * (the spec allows a future date for „Programată" only, §4, and hiding exactly those would hide the plan).
 */
export function rangeOf(f: Pick<InteractionFilters, "preset" | "customFrom" | "customTo">, now: Date): { from?: Date; to?: Date } {
  const today = startOfDay(now);
  const endOf = (d: Date) => new Date(addDays(d, 1).getTime() - 1);
  if (f.preset === "today") return { from: today, to: endOf(today) };
  if (f.preset === "thisYear") return { from: new Date(today.getFullYear(), 0, 1) };
  if (f.preset === "custom") {
    const from = parseDay(f.customFrom);
    const to = parseDay(f.customTo);
    return { ...(from ? { from } : {}), ...(to ? { to: endOf(to) } : {}) };
  }
  const n = LAST_DAYS[f.preset] ?? DEFAULT_RANGE_DAYS;
  return { from: addDays(today, -(n - 1)) };
}

/**
 * The list route's query for this state — the only place it is built. `scope` is the person in the address;
 * `page` is 0-based.
 */
export function listQuery(
  f: InteractionFilters,
  o: InteractionOrder,
  scope: string | null,
  page: number,
  pageSize: number,
  now: Date,
): URLSearchParams {
  const p = new URLSearchParams();
  const { from, to } = rangeOf(f, now);
  if (from) p.set("from", from.toISOString());
  if (to) p.set("to", to.toISOString());
  if (narrows(f.channels, INTERACTION_CHANNELS)) p.set("channels", [...f.channels].sort().join(","));
  if (f.direction !== "ALL") p.set("direction", f.direction);
  if (scope) p.set("personId", scope);
  const subject = f.subject.trim().slice(0, SUBJECT_MAX);
  if (subject) p.set("subject", subject);
  if (f.documents !== "ALL") p.set("hasDocuments", f.documents === "WITH" ? "true" : "false");
  if (narrows(f.statuses, INTERACTION_STATUSES)) p.set("statuses", [...f.statuses].sort().join(","));
  const q = f.q.trim().slice(0, 200);
  if (q) p.set("q", q);
  p.set("sort", o.sort);
  p.set("order", o.order);
  p.set("limit", String(pageSize));
  p.set("offset", String(page * pageSize));
  return p;
}

/** The order kept for the session (§8.3), read back; anything unreadable is newest first. */
export function readOrder(raw: string | null): InteractionOrder {
  if (!raw) return DEFAULT_ORDER_STATE;
  try {
    const v = JSON.parse(raw) as Partial<InteractionOrder>;
    if ((SORT_FIELDS as readonly string[]).includes(v.sort as string) && (v.order === "asc" || v.order === "desc")) {
      return { sort: v.sort as InteractionSort, order: v.order };
    }
  } catch {
    // fall through
  }
  return DEFAULT_ORDER_STATE;
}

/** A column header pressed: that column, ascending — or, if it is already the column, the other way. Dates start newest. */
export function orderBy(current: InteractionOrder, sort: InteractionSort): InteractionOrder {
  if (current.sort === sort) return { sort, order: current.order === "asc" ? "desc" : "asc" };
  return { sort, order: sort === "occurredAt" ? "desc" : "asc" };
}

/** The toolbar's sort control (§3): newest ⇄ oldest; from another column's order it goes back to newest first. */
export function flipDateOrder(current: InteractionOrder): InteractionOrder {
  if (current.sort !== "occurredAt") return DEFAULT_ORDER_STATE;
  return { sort: "occurredAt", order: current.order === "desc" ? "asc" : "desc" };
}

/** Column widths kept for the session (§3: the user can resize them), read back over the defaults, never under `min`. */
export function readWidths<K extends string>(raw: string | null, defaults: Readonly<Record<K, number>>, min: number): Record<K, number> {
  const out = { ...defaults } as Record<K, number>;
  if (!raw) return out;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    for (const k of Object.keys(defaults) as K[]) {
      const n = v[k];
      if (typeof n === "number" && Number.isFinite(n)) out[k] = Math.max(min, Math.min(n, 60));
    }
  } catch {
    // the defaults
  }
  return out;
}
