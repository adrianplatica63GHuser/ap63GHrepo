/**
 * @jest-environment node
 */

/**
 * Slice #39.17 — „Setări → Costuri": the arithmetic, the catalogue and the
 * screen's tiles. Pure parts only; TC-SET-04 drives the screen.
 */

import fs from "fs";
import path from "path";

import {
  AI_READ_UPPER,
  CAD_PER,
  COST_PROVIDERS,
  GOOGLE_MAPS_KNOWN_BILL,
  PROVIDER_FACTS,
  PROVIDER_ID,
  aiReadUsd,
} from "@/lib/costs/catalogue";
import {
  chartDays,
  daysBetween,
  daysInMonth,
  ENTERED_CURRENCIES,
  formatCad,
  parseTypedAmount,
  monthFigures,
  monthlyTotals,
  spreadOverDays,
  sumByDay,
  withoutDaysCovered,
} from "@/lib/costs/compute";
import { buildCostSummary, torontoDay, type CostInputs } from "@/lib/costs/summary";
import { SETTINGS_OWN_TILES, SETTINGS_TILES, SETTINGS_TILE_REGISTRY } from "@/app/admin/settings/_components/settings-tiles";
import { TILE_GROUPS } from "@/lib/ui/tiles";

const ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const ro = JSON.parse(read("messages/ro-RO.json")).settings.costs;
const en = JSON.parse(read("messages/en-GB.json")).settings.costs;

describe("the days of a month", () => {
  it("counts each month's days, February in a leap year included", () => {
    expect(daysInMonth("2026-10")).toBe(31);
    expect(daysInMonth("2026-11")).toBe(30);
    expect(daysInMonth("2028-02")).toBe(29);
  });
  it("lists every day of a period, both ends included, across a month's end", () => {
    expect(daysBetween("2026-10-30", "2026-11-02")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(daysBetween("2026-10-12", "2026-10-11")).toEqual([]);
  });
});

describe("an amount for a period becomes CA$ per day", () => {
  it("a day's bill is that day, at its rate", () => {
    const d = spreadOverDays({ periodStart: "2026-10-08", periodEnd: "2026-10-08", amount: 10, cadRate: 1.38 });
    expect(d.map((x) => x.day)).toEqual(["2026-10-08"]);
    expect(d[0].cad).toBeCloseTo(13.8, 10);
  });
  it("a month's plan is spread over the month's days", () => {
    const d = spreadOverDays({ periodStart: "2026-11-01", periodEnd: "2026-11-30", amount: 20, cadRate: 1.5 });
    expect(d).toHaveLength(30);
    expect(d.reduce((n, x) => n + x.cad, 0)).toBeCloseTo(30, 6);
  });
  it("days add up, in day order", () => {
    expect(sumByDay([{ day: "2026-10-02", cad: 1 }], [{ day: "2026-10-01", cad: 2 }, { day: "2026-10-02", cad: 3 }])).toEqual([
      { day: "2026-10-01", cad: 2 },
      { day: "2026-10-02", cad: 4 },
    ]);
  });
  it("a day Adrian enters replaces the same day on the known bill — never counted twice", () => {
    const entered = [{ periodStart: "2026-10-10", periodEnd: "2026-10-11", amount: 1, cadRate: 1 }];
    expect(withoutDaysCovered(GOOGLE_MAPS_KNOWN_BILL, entered).map((d) => d.day)).toEqual(["2026-10-08", "2026-10-09"]);
  });
});

describe("the month: so far, today, forecast", () => {
  const days = [
    { day: "2026-09-30", cad: 100 },
    { day: "2026-10-01", cad: 2 },
    { day: "2026-10-10", cad: 4 },
  ];
  it("linear: so far, spread over the whole month", () => {
    expect(monthFigures(days, "2026-10-10", { kind: "linear" })).toEqual({ soFar: 6, today: 4, forecast: 18.6 });
  });
  it("per day: so far plus a fixed amount for each day left — once the month has cost something", () => {
    expect(monthFigures(days, "2026-10-11", { kind: "perDay", cadPerDay: 0.5 })).toEqual({ soFar: 6, today: 0, forecast: 16 });
    expect(monthFigures([], "2026-11-03", { kind: "perDay", cadPerDay: 0.5 })).toEqual({ soFar: 0, today: 0, forecast: 0 });
  });
  it("entered: the month's whole entered amount, days still to come included", () => {
    const plan = spreadOverDays({ periodStart: "2026-11-01", periodEnd: "2026-11-30", amount: 30, cadRate: 1 });
    expect(monthFigures(plan, "2026-11-10", { kind: "entered" })).toEqual({ soFar: 10, today: 1, forecast: 30 });
  });
  it("the forecast is never below what is already spent", () => {
    expect(monthFigures([{ day: "2026-10-20", cad: 5 }], "2026-10-10", { kind: "entered" }).forecast).toBe(5);
  });
  it("months add up, oldest first", () => {
    expect(monthlyTotals(days)).toEqual([{ month: "2026-09", cad: 100 }, { month: "2026-10", cad: 6 }]);
  });
});

describe("the graph's days", () => {
  it("start at the first day that cost something this month or before, and every day is present", () => {
    const c = chartDays(GOOGLE_MAPS_KNOWN_BILL, "2026-10-12");
    expect(c[0].day).toBe("2026-10-01");
    expect(c[c.length - 1]).toEqual({ day: "2026-10-12", cad: 0 });
    expect(c).toHaveLength(12);
    expect(c.find((d) => d.day === "2026-10-10")?.cad).toBe(21.97);
  });
  it("reach back to an earlier month's first cost, but never more than 92 days", () => {
    expect(chartDays([{ day: "2026-09-20", cad: 1 }], "2026-10-12")[0].day).toBe("2026-09-20");
    expect(chartDays([{ day: "2026-01-01", cad: 1 }], "2026-10-12")).toHaveLength(92);
  });
});

describe("the catalogue", () => {
  it("names every provider the header asked for, plus the Claude plan and testing", () => {
    expect(COST_PROVIDERS).toEqual(["ai", "claudePlan", "googleMaps", "supabase", "vercel", "resend", "github", "domain", "testing"]);
  });
  it("every provider has its pricing page, the day it was checked, and a record id migration_107 accepts", () => {
    for (const k of COST_PROVIDERS) {
      expect([k, PROVIDER_FACTS[k].pricingUrl]).toEqual([k, expect.stringMatching(/^https:\/\//)]);
      expect([k, PROVIDER_FACTS[k].checked]).toEqual([k, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)]);
      expect([k, /^[a-z][a-z-]{1,39}$/.test(PROVIDER_ID[k])]).toEqual([k, true]);
    }
  });
  it("a read is priced at the upper bound: a large read at Sonnet's price — US$0.15", () => {
    expect(AI_READ_UPPER.model).toBe("claude-sonnet-4-6");
    expect(aiReadUsd()).toBeCloseTo(0.15, 10);
  });
  it("the read is priced at the model the app actually uses for extraction", () => {
    expect(read("src/lib/ai/models.ts")).toContain(`"${AI_READ_UPPER.model}"`);
  });
  it("Google's known bill is the four days of Slice #39.16 — CA$62.30 day by day; the report's own total, rounded per line, reads 62.31", () => {
    expect(GOOGLE_MAPS_KNOWN_BILL.reduce((n, d) => n + d.cad, 0)).toBeCloseTo(62.3, 6);
  });
  it("no key that would connect a provider is a NEXT_PUBLIC_ one — the server makes every provider call", () => {
    for (const k of COST_PROVIDERS) expect(PROVIDER_FACTS[k].liveKey?.name ?? "").not.toMatch(/^NEXT_PUBLIC_/);
  });
});

describe("the summary", () => {
  const input = (over: Partial<CostInputs> = {}): CostInputs => ({
    today: "2026-10-12",
    aiReads: [
      { day: "2026-10-09", reads: 4 },
      { day: "2026-10-12", reads: 2 },
    ],
    aiReadsSince: "2026-10-08T12:00:00.000Z",
    testsMaps: { month: "2026-10", maps: 14_598 },
    entered: {},
    ...over,
  });
  const perRead = 0.15 * CAD_PER.USD;

  it("prices the AI reads per day and forecasts them on their pace", () => {
    const ai = buildCostSummary(input()).providers.find((p) => p.key === "ai")!;
    expect(ai.figures.soFar).toBeCloseTo(6 * perRead, 2);
    expect(ai.figures.today).toBeCloseTo(2 * perRead, 2);
    expect(ai.figures.forecast).toBeCloseTo(((6 * perRead) / 12) * 31, 1);
    expect(ai.facts.readsThisMonth).toBe(6);
  });
  it("Google Maps: the known bill, plus CA$0.50 for each day left", () => {
    const g = buildCostSummary(input()).providers.find((p) => p.key === "googleMaps")!;
    expect(g.figures).toEqual({ soFar: 62.3, today: 0, forecast: 71.8 }); // 62.30 + 19 days × 0.50
  });
  it("the tests' maps are this month's, and unknown away from the runner's laptop", () => {
    const testing = (i: CostInputs) => buildCostSummary(i).providers.find((p) => p.key === "testing")!.facts.testsMaps;
    expect(testing(input())).toBe(14_598);
    expect(testing(input({ testsMaps: { month: "2026-09", maps: 5 } }))).toBe(0);
    expect(testing(input({ testsMaps: null }))).toBeNull();
  });
  it("adds every provider into one total", () => {
    const s = buildCostSummary(input());
    expect(s.total.soFar).toBeCloseTo(s.providers.reduce((n, p) => n + p.figures.soFar, 0), 2);
  });
  it("Toronto's day, not UTC's: 02:00 UTC on the 13th is still the 12th", () => {
    expect(torontoDay(new Date("2026-10-13T02:00:00Z"))).toBe("2026-10-12");
  });
  it("money is written CA$1,234.50", () => {
    expect(formatCad(1234.5)).toBe("CA$1,234.50");
  });
});

describe("Setări's tiles", () => {
  it("are the screen's own tiles, then every cost provider — and all show by default", () => {
    expect(SETTINGS_TILES).toEqual([...SETTINGS_OWN_TILES, ...COST_PROVIDERS]);
    expect(SETTINGS_TILE_REGISTRY.defaults).toEqual(SETTINGS_TILES);
  });
  it("„Costuri” is one group of its own, and `all` is the groups in bar order (as tiles.test holds for records)", () => {
    const g = SETTINGS_TILE_REGISTRY.groups!;
    expect(g.meta).toEqual(COST_PROVIDERS);
    expect(TILE_GROUPS.flatMap((k) => g[k])).toEqual([...SETTINGS_TILE_REGISTRY.all]);
  });
  it("the screen ticks them with the record screens' own selector, not a copy", () => {
    const view = read("src/app/admin/settings/_components/settings-view.tsx");
    expect(view).toContain('from "@/components/tiles/tile-selector"');
    expect(view).toContain("useTileChoice<SettingsTile>(SETTINGS_TILE_REGISTRY)");
  });
  it("the AI tile is a cost tile now, and still shows the reads and the models when expanded", () => {
    const view = read("src/app/admin/settings/_components/settings-view.tsx");
    expect(view).not.toContain('name="settings-ai"');
    expect(view).toMatch(/k === "ai" \? <AiReadsAndModels \/> : null/);
  });
});

describe("the sentences", () => {
  const leaves = (o: unknown, p = ""): string[] =>
    typeof o === "string" ? [p] : Object.entries(o as object).flatMap(([k, v]) => leaves(v, p ? `${p}.${k}` : k));
  it("are the same keys in both locales", () => {
    expect(leaves(en).sort()).toEqual(leaves(ro).sort());
  });
  it("every provider has a title, its conditions, its free part and its pricing", () => {
    for (const k of COST_PROVIDERS) expect(Object.keys(ro.providers[k]).sort()).toEqual(["conditions", "freeTier", "pricing", "title"]);
  });
  it("the AI tile keeps its name, which TC-SET-02 reads", () => {
    expect(ro.providers.ai.title).toBe("AI");
  });
});

// ---- the amounts Adrian enters (migration_107) ------------------------------------------


describe("an amount entered on a tile", () => {
  it("is typed with a comma or a dot, never negative", () => {
    expect(parseTypedAmount("12,50")).toBe(12.5);
    expect(parseTypedAmount(" 1 234.5 ")).toBe(1234.5);
    expect(parseTypedAmount("-3")).toBeNull();
    expect(parseTypedAmount("abc")).toBeNull();
    expect(parseTypedAmount("")).toBeNull();
  });
  it("is in one of the currencies the providers bill", () => {
    expect(ENTERED_CURRENCIES).toEqual(["CAD", "USD", "EUR"]);
    for (const k of COST_PROVIDERS) expect(ENTERED_CURRENCIES).toContain(PROVIDER_FACTS[k].currency);
  });
  it("a plan entered for the month is the month's forecast", () => {
    const s = buildCostSummary({
      today: "2026-11-10",
      aiReads: [],
      aiReadsSince: null,
      testsMaps: null,
      entered: { vercel: [{ id: "x", periodStart: "2026-11-01", periodEnd: "2026-11-30", amount: 20, currency: "USD", cadRate: 1.4, note: null, enteredAt: "2026-11-01T00:00:00Z" }] },
    });
    expect(s.providers.find((p) => p.key === "vercel")!.figures).toEqual({ soFar: 9.33, today: 0.93, forecast: 28 });
  });
  it("an Anthropic bill entered for some days replaces the reads' estimate on those days", () => {
    const s = buildCostSummary({
      today: "2026-10-12",
      aiReads: [{ day: "2026-10-09", reads: 100 }, { day: "2026-10-12", reads: 1 }],
      aiReadsSince: null,
      testsMaps: null,
      entered: { ai: [{ id: "x", periodStart: "2026-10-09", periodEnd: "2026-10-09", amount: 2, currency: "USD", cadRate: 1.5, note: null, enteredAt: "2026-10-10T00:00:00Z" }] },
    });
    expect(s.providers.find((p) => p.key === "ai")!.figures.soFar).toBeCloseTo(3 + 0.15 * 1.38, 2);
  });
  it("the route writes only 'entered' amounts, and removes only those", () => {
    const load = read("src/lib/costs/load.ts");
    expect(load).toMatch(/source: "entered",/);
    expect(load).toMatch(/\.where\(and\(eq\(costRecord\.id, id\), eq\(costRecord\.source, "entered"\)\)\)/);
    const route = read("src/app/api/admin/costs/route.ts");
    for (const verb of ["GET", "POST", "DELETE"]) {
      expect(route).toMatch(new RegExp(`export async function ${verb}\\([^)]*\\): Promise<Response> \\{\\s*const denied = await requireFullAccess\\(\\);`));
    }
  });
});
