/**
 * src/lib/costs/summary.ts                                         (Slice #39.17)
 *
 * What „Setări → Costuri" shows, built from what the server read: the paid AI
 * reads per day, the tests' Google maps this month, and the amounts Adrian
 * entered. Pure — `src/lib/costs/load.ts` does the reading.
 */
import {
  AI_READ_UPPER,
  CAD_PER,
  COST_PROVIDERS,
  GOOGLE_MAPS_KNOWN_BILL,
  GOOGLE_MAPS_PEOPLE_DAILY_CAD,
  aiReadUsd,
  type CostProvider,
} from "./catalogue";
import {
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
  /** The tests' real Google maps this month (the runner's ledger), or null where it cannot be read. */
  testsMaps: { month: string; maps: number } | null;
  entered: Readonly<Partial<Record<CostProvider, readonly EnteredAmount[]>>>;
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
  const providers = COST_PROVIDERS.map((key): ProviderSummary => {
    const entered = [...(i.entered[key] ?? [])];
    const enteredDays = entered.flatMap(spreadOverDays);
    let days: DayCost[];
    const facts: Record<string, number | string | null> = {};
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
      case "testing":
        days = enteredDays;
        facts.testsMaps = i.testsMaps && i.testsMaps.month === i.today.slice(0, 7) ? i.testsMaps.maps : i.testsMaps ? 0 : null;
        break;
      default:
        days = enteredDays;
    }
    return {
      key,
      figures: monthFigures(days, i.today, BASIS[key]),
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
