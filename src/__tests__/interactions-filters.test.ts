/**
 * „Interacțiuni” — the history's one filter state.                       (Slice #38.84)
 *
 * The spec (§3): the toolbar and the column headers „both write to the same filter state, so they cannot disagree”;
 * the defaults are the last 90 days, every channel, every direction, newest first; „Clear filters” shows only while a
 * filter is on and restores them; the sort is kept for the session (§8.3). And (§8.2) the description, the internal
 * note and an imported body are never a filter. These are the pure halves — `src/lib/interactions/filters.ts` — and
 * a reading of the screen's source for the one-state rule.
 */
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_FILTERS,
  DEFAULT_ORDER_STATE,
  FILTER_STATE_FIELDS,
  HISTORY_COLUMNS,
  columnFiltered,
  flipDateOrder,
  isFiltered,
  listQuery,
  needsReplyFilters,
  orderBy,
  rangeOf,
  readOrder,
  readWidths,
  toggled,
  type InteractionFilters,
} from "@/lib/interactions/filters";
import { interactionListQuerySchema } from "@/lib/interactions/validation";
import { INTERACTION_CHANNELS, INTERACTION_STATUSES, SORT_FIELDS } from "@/lib/interactions/model";

const NOW = new Date(2026, 9, 10, 15, 30); // 10 Oct 2026, 15:30, the browser's own clock
const query = (f: Partial<InteractionFilters> = {}, scope: string | null = null) =>
  Object.fromEntries(listQuery({ ...DEFAULT_FILTERS, ...f }, DEFAULT_ORDER_STATE, scope, 0, 25, NOW).entries());

describe("the defaults (§3)", () => {
  it("are the last 90 days, every channel, every direction, every status — and newest first", () => {
    expect(DEFAULT_FILTERS.preset).toBe("last90");
    expect(DEFAULT_FILTERS.channels).toEqual([]);
    expect(DEFAULT_FILTERS.direction).toBe("ALL");
    expect(DEFAULT_FILTERS.statuses).toEqual([]);
    expect(DEFAULT_ORDER_STATE).toEqual({ sort: "occurredAt", order: "desc" });
    expect(isFiltered(DEFAULT_FILTERS)).toBe(false);
  });

  it("the last 90 days start at midnight 89 days ago, and end nowhere — a scheduled meeting next week stays in view", () => {
    const { from, to } = rangeOf(DEFAULT_FILTERS, NOW);
    expect(from).toEqual(new Date(2026, 6, 13));
    expect(to).toBeUndefined();
  });

  it("ask the route for exactly the range, the order and the first page — nothing else", () => {
    expect(query()).toEqual({
      from: new Date(2026, 6, 13).toISOString(),
      sort: "occurredAt",
      order: "desc",
      limit: "25",
      offset: "0",
    });
  });

  it("the query is stable within a day: the same state asks the same thing a second later", () => {
    const later = new Date(NOW.getTime() + 1000);
    expect(listQuery(DEFAULT_FILTERS, DEFAULT_ORDER_STATE, null, 0, 25, later).toString()).toBe(
      listQuery(DEFAULT_FILTERS, DEFAULT_ORDER_STATE, null, 0, 25, NOW).toString(),
    );
  });
});

describe("the presets", () => {
  it("„Azi” is today, from its first moment to its last", () => {
    const { from, to } = rangeOf({ ...DEFAULT_FILTERS, preset: "today" }, NOW);
    expect(from).toEqual(new Date(2026, 9, 10));
    expect(to).toEqual(new Date(new Date(2026, 9, 11).getTime() - 1));
  });

  it("„Ultimele 7 zile” counts today as one of the seven; „Anul acesta” starts on 1 January", () => {
    expect(rangeOf({ ...DEFAULT_FILTERS, preset: "last7" }, NOW).from).toEqual(new Date(2026, 9, 4));
    expect(rangeOf({ ...DEFAULT_FILTERS, preset: "thisYear" }, NOW).from).toEqual(new Date(2026, 0, 1));
  });

  it("„Personalizat” takes both its days whole; an end left empty is open", () => {
    const both = rangeOf({ ...DEFAULT_FILTERS, preset: "custom", customFrom: "2026-09-01", customTo: "2026-09-30" }, NOW);
    expect(both.from).toEqual(new Date(2026, 8, 1));
    expect(both.to).toEqual(new Date(new Date(2026, 9, 1).getTime() - 1));
    expect(rangeOf({ ...DEFAULT_FILTERS, preset: "custom", customFrom: "2026-09-01", customTo: "" }, NOW).to).toBeUndefined();
    expect(rangeOf({ ...DEFAULT_FILTERS, preset: "custom", customFrom: "", customTo: "" }, NOW)).toEqual({});
  });
});

describe("one filter state for the toolbar and the column filters (§3)", () => {
  it("each structured field narrows the query, and a narrowed state shows „Șterge filtrele”", () => {
    const narrowed: Partial<InteractionFilters>[] = [
      { preset: "last7" },
      { channels: ["PHONE"] },
      { direction: "INBOUND" },
      { subject: "contract" },
      { documents: "WITH" },
      { statuses: ["NEEDS_REPLY"] },
      { q: "Popescu" },
    ];
    for (const f of narrowed) {
      expect([f, isFiltered({ ...DEFAULT_FILTERS, ...f })]).toEqual([f, true]);
    }
    expect(query({ channels: ["PHONE", "EMAIL"] }).channels).toBe("EMAIL,PHONE");
    expect(query({ direction: "INBOUND" }).direction).toBe("INBOUND");
    expect(query({ subject: "  contract " }).subject).toBe("contract");
    expect(query({ documents: "WITHOUT" }).hasDocuments).toBe("false");
    expect(query({ statuses: ["SENT"] }).statuses).toBe("SENT");
    expect(query({ q: "Popescu" }).q).toBe("Popescu");
  });

  it("every channel ticked is the same as none ticked: no narrowing, no „Șterge filtrele”", () => {
    const all = { ...DEFAULT_FILTERS, channels: [...INTERACTION_CHANNELS], statuses: [...INTERACTION_STATUSES] };
    expect(isFiltered(all)).toBe(false);
    expect(query(all).channels).toBeUndefined();
    expect(query(all).statuses).toBeUndefined();
  });

  it("a chip pressed again clears it", () => {
    expect(toggled(["EMAIL"], "PHONE")).toEqual(["EMAIL", "PHONE"]);
    expect(toggled(["EMAIL", "PHONE"], "EMAIL")).toEqual(["PHONE"]);
  });

  it("the scope is the person, in the address — it narrows the query but is not a filter „Șterge filtrele” clears", () => {
    expect(query({}, "0b5c6e0e-1111-4c4c-8888-000000000001").personId).toBe("0b5c6e0e-1111-4c4c-8888-000000000001");
    expect(columnFiltered(DEFAULT_FILTERS, "person", "x")).toBe(true);
    expect(isFiltered(DEFAULT_FILTERS)).toBe(false);
  });

  it("each column's funnel is lit by its own field and only by it", () => {
    for (const c of HISTORY_COLUMNS) expect([c, columnFiltered(DEFAULT_FILTERS, c, null)]).toEqual([c, false]);
    expect(columnFiltered({ ...DEFAULT_FILTERS, channels: ["SMS"] }, "channel", null)).toBe(true);
    expect(columnFiltered({ ...DEFAULT_FILTERS, channels: ["SMS"] }, "status", null)).toBe(false);
  });

  it("„Așteaptă răspuns” jumps to inbound rows awaiting a reply, keeping the rest of the view", () => {
    const f = needsReplyFilters({ ...DEFAULT_FILTERS, channels: ["EMAIL"] });
    expect(f).toEqual({ ...DEFAULT_FILTERS, channels: ["EMAIL"], direction: "INBOUND", statuses: ["NEEDS_REPLY"] });
  });

  it("whatever the state, the route accepts the query it makes", () => {
    const busy: InteractionFilters = {
      preset: "custom",
      customFrom: "2026-01-01",
      customTo: "2026-12-31",
      channels: ["EMAIL", "MEETING"],
      direction: "OUTBOUND",
      subject: "act",
      documents: "WITH",
      statuses: ["LOGGED", "SCHEDULED"],
      q: "Ion",
    };
    const p = listQuery(busy, { sort: "person", order: "asc" }, "0b5c6e0e-1111-4c4c-8888-000000000001", 2, 25, NOW);
    expect(interactionListQuerySchema.safeParse(Object.fromEntries(p.entries())).success).toBe(true);
    expect(p.get("offset")).toBe("50");
  });

  it("the toolbar and the column headers draw their controls over this one state — neither keeps its own", () => {
    const tile = fs.readFileSync(path.join(process.cwd(), "src/app/interactions/_components/history-tile.tsx"), "utf8");
    const controls = fs.readFileSync(path.join(process.cwd(), "src/app/interactions/_components/filter-controls.tsx"), "utf8");
    // The filter controls hold no filter of their own: their only state is the person box's typing and its list.
    expect(controls.match(/useState</g)?.length ?? 0).toBe(0);
    expect(controls.match(/useState\(/g)?.length).toBe(3); // Pop's open, PersonPicker's text and editing
    // Each column filter and each toolbar control is given `filters` and `onFilters`, from the screen.
    for (const c of ["RangeChoices", "ChannelChoices", "DirectionChoices", "SubjectContains", "DocumentsChoices", "StatusChoices", "ChannelChips", "DirectionSegments"]) {
      expect([c, new RegExp(`<${c} filters={filters} onChange={onFilters} />`).test(tile)]).toEqual([c, true]);
    }
  });
});

describe("the description is offered nowhere as a filter (§3, §8.2)", () => {
  const forbidden = /description|internal|note|body/i;

  it("no field of the state names it", () => {
    for (const k of FILTER_STATE_FIELDS) expect([k, forbidden.test(k)]).toEqual([k, false]);
    expect(Object.keys(DEFAULT_FILTERS).sort()).toEqual([...FILTER_STATE_FIELDS].sort());
  });

  it("no key the state writes into the query names it, and no column sorts by it", () => {
    const all = query({ preset: "custom", customFrom: "2026-01-01", customTo: "2026-02-01", channels: ["SMS"], direction: "INBOUND", subject: "x", documents: "WITH", statuses: ["SENT"], q: "y" }, "0b5c6e0e-1111-4c4c-8888-000000000001");
    for (const k of Object.keys(all)) expect([k, forbidden.test(k)]).toEqual([k, false]);
    for (const c of HISTORY_COLUMNS) expect([c, forbidden.test(c)]).toEqual([c, false]);
    expect([...HISTORY_COLUMNS]).toEqual([...SORT_FIELDS]);
  });
});

describe("the order and the widths, kept for the session (§3, §8.3)", () => {
  it("one control flips newest ⇄ oldest; from another column's order it goes back to newest first", () => {
    expect(flipDateOrder(DEFAULT_ORDER_STATE)).toEqual({ sort: "occurredAt", order: "asc" });
    expect(flipDateOrder({ sort: "occurredAt", order: "asc" })).toEqual(DEFAULT_ORDER_STATE);
    expect(flipDateOrder({ sort: "person", order: "asc" })).toEqual(DEFAULT_ORDER_STATE);
  });

  it("a header pressed sorts by its column, ascending; pressed again, the other way; the date starts newest", () => {
    expect(orderBy(DEFAULT_ORDER_STATE, "person")).toEqual({ sort: "person", order: "asc" });
    expect(orderBy({ sort: "person", order: "asc" }, "person")).toEqual({ sort: "person", order: "desc" });
    expect(orderBy({ sort: "person", order: "asc" }, "occurredAt")).toEqual(DEFAULT_ORDER_STATE);
  });

  it("what the session holds is read back; anything unreadable is newest first", () => {
    expect(readOrder(JSON.stringify({ sort: "status", order: "asc" }))).toEqual({ sort: "status", order: "asc" });
    for (const raw of [null, "", "{", JSON.stringify({ sort: "description", order: "asc" }), JSON.stringify({ sort: "status", order: "up" })]) {
      expect(readOrder(raw)).toEqual(DEFAULT_ORDER_STATE);
    }
  });

  it("widths read back over the defaults, never under the least", () => {
    const d = { a: 7, b: 9 };
    expect(readWidths(JSON.stringify({ a: 12, b: 1, c: 5 }), d, 4)).toEqual({ a: 12, b: 4 });
    expect(readWidths("nonsense", d, 4)).toEqual(d);
    expect(readWidths(null, d, 4)).toEqual(d);
  });
});
