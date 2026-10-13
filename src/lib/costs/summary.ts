/**
 * src/lib/costs/summary.ts                                         (Slice #39.17)
 *
 * What „Setări → Costuri" shows, built from what the server read: the paid AI
 * reads per day, the tests' Google maps — and, since #39.19, Street View
 * panoramas and address look-ups — this month, and the amounts Adrian
 * entered. Pure — `src/lib/costs/load.ts` does the reading.
 */
import {
  AI_READ_UPPER,
  CAD_PER,
  COST_PROVIDERS,
  GOOGLE_EXTRAS,
  GOOGLE_MAPS_KNOWN_BILL,
  GOOGLE_MAPS_PEOPLE_DAILY_CAD,
  TESTS_MAPS_CEILING,
  aiReadUsd,
  type CostProvider,
} from "./catalogue";
import {
  allowanceEstimate,
  cents,
  chartDays,
  monthFigures,
  monthlyTotals,
  spreadOverDays,
  sumByDay,
  withoutDaysCovered,
  type DayCost,
  type ForecastBasis,
  type MonthFigures,
  type PeriodAmount,
} from "./compute";

/** An amount Adrian entered (`cost_record`, source 'entered'). */
export interface EnteredAmount extends PeriodAmount {
  id: string;
  currency: string;
  note: string | null;
  enteredAt: string;
}

export interface CostInputs {
  /** `YYYY-MM-DD`, Toronto. */
  today: string;
  /** Successful paid AI reads per Toronto day. */
  aiReads: readonly { day: string; reads: number }[];
  /** When the application began counting them, or null. */
  aiReadsSince: string | null;
  /**
   * The tests' Google use this month — the runner's ledger — or null where it cannot be read. `streetView` and
   * `addressLookups` are null in a ledger written before Slice #39.18 counted them: „not counted", never zero.
   */
  testsGoogle: TestsGoogle | null;
  entered: Readonly<Partial<Record<CostProvider, readonly EnteredAmount[]>>>;
}

export interface TestsGoogle {
  month: string;
  maps: number;
  streetView: number | null;
  addressLookups: number | null;
}

export interface ProviderSummary {
  key: CostProvider;
  figures: MonthFigures;
  monthly: { month: string; cad: number }[];
  chart: DayCost[];
  entered: EnteredAmount[];
  /** Figures that are not money: reads, maps, the price of one read. */
  facts: Record<string, number | string | null>;
}

export interface CostSummary {
  today: string;
  /** Every provider together, CA$. */
  total: MonthFigures;
  providers: ProviderSummary[];
}

const BASIS: Readonly<Record<CostProvider, ForecastBasis>> = {
  ai: { kind: "linear" },
  claudePlan: { kind: "entered" },
  googleMaps: { kind: "perDay", cadPerDay: GOOGLE_MAPS_PEOPLE_DAILY_CAD },
  // #39.19: what is entered from a bill, or — when more — the cost the month's estimated use comes to (below).
  streetView: { kind: "entered" },
  addressLookups: { kind: "entered" },
  supabase: { kind: "entered" },
  vercel: { kind: "entered" },
  resend: { kind: "entered" },
  github: { kind: "entered" },
  domain: { kind: "entered" },
  // The tests' maps are inside Google's bill and their reads inside the AI tile's: no money of their own.
  testing: { kind: "entered" },
};

export function buildCostSummary(i: CostInputs): CostSummary {
  const perReadCad = aiReadUsd() * CAD_PER.USD;
  // The tests' counts as they stand this month: null where not counted, 0 when the ledger is last month's.
  const thisMonth = i.today.slice(0, 7);
  const ledger = i.testsGoogle;
  const tests = (k: "maps" | "streetView" | "addressLookups"): number | null =>
    ledger === null ? null : ledger[k] === null ? null : ledger.month === thisMonth ? ledger[k] : 0;
  const providers = COST_PROVIDERS.map((key): ProviderSummary => {
    const entered = [...(i.entered[key] ?? [])];
    const enteredDays = entered.flatMap(spreadOverDays);
    let days: DayCost[];
    const facts: Record<string, number | string | null> = {};
    let floor = 0;
    switch (key) {
      case "ai": {
        // An entered Anthropic bill replaces the estimate for the days it covers, as Google's known days are replaced.
        days = sumByDay(withoutDaysCovered(i.aiReads.map((r) => ({ day: r.day, cad: r.reads * perReadCad })), entered), enteredDays);
        facts.readsThisMonth = i.aiReads.filter((r) => r.day.slice(0, 7) === i.today.slice(0, 7)).reduce((n, r) => n + r.reads, 0);
        facts.readsSince = i.aiReadsSince;
        facts.perReadUsd = aiReadUsd();
        facts.model = AI_READ_UPPER.model;
        break;
      }
      case "googleMaps":
        days = sumByDay(withoutDaysCovered(GOOGLE_MAPS_KNOWN_BILL, entered), enteredDays);
        break;
      case "streetView":
      case "addressLookups": {
        // Nothing billed yet (#39.19): the month's use — the tests' count and people's estimate — against the free part.
        days = enteredDays;
        const g = GOOGLE_EXTRAS[key];
        const e = allowanceEstimate({
          today: i.today,
          testsSoFar: tests(key),
          testsCeiling: g.testsCeiling,
          peoplePerDay: g.peoplePerDay,
          freePerMonth: g.freePerMonth,
          usdPer1000: g.usdPer1000,
          cadPerUsd: CAD_PER.USD,
        });
        floor = e.cad;
        Object.assign(facts, {
          testsSoFar: e.testsSoFar,
          testsMonth: e.tests,
          testsCeiling: g.testsCeiling,
          peoplePerDay: g.peoplePerDay,
          peopleMonth: e.people,
          monthUse: e.total,
          free: e.free,
          paid: e.paid,
          estimateCad: e.cad,
          usdPer1000: g.usdPer1000,
        });
        break;
      }
      case "testing":
        days = enteredDays;
        facts.testsMaps = tests("maps");
        facts.testsStreetView = tests("streetView");
        facts.testsAddressLookups = tests("addressLookups");
        facts.mapsCeiling = TESTS_MAPS_CEILING;
        facts.streetViewCeiling = GOOGLE_EXTRAS.streetView.testsCeiling;
        facts.addressLookupsCeiling = GOOGLE_EXTRAS.addressLookups.testsCeiling;
        break;
      default:
        days = enteredDays;
    }
    const figures = monthFigures(days, i.today, BASIS[key]);
    return {
      key,
      figures: floor > figures.forecast ? { ...figures, forecast: cents(floor) } : figures,
      monthly: monthlyTotals(days),
      chart: chartDays(days, i.today),
      entered,
      facts,
    };
  });
  const total = providers.reduce(
    (t, p) => ({ soFar: t.soFar + p.figures.soFar, today: t.today + p.figures.today, forecast: t.forecast + p.figures.forecast }),
    { soFar: 0, today: 0, forecast: 0 },
  );
  return { today: i.today, total: { soFar: cents(total.soFar), today: cents(total.today), forecast: cents(total.forecast) }, providers };
}

/** `YYYY-MM-DD` in Toronto — the business's day. */
export function torontoDay(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}
