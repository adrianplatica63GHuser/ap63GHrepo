/**
 * src/lib/costs/compute.ts                                         (Slice #39.17)
 *
 * The arithmetic behind „Setări → Costuri": a provider's costs as one amount in
 * CA$ per day, then this month so far, today, the month's forecast, and the
 * months over time. Pure — dates are `YYYY-MM-DD` strings and `today` is passed
 * in — so `src/__tests__/settings-costs.test.ts` holds every rule.
 */

/** One day's cost, in CA$. */
export interface DayCost {
  day: string;
  cad: number;
}

/** An amount for a period, in its own currency, with the CA$ rate used for it. */
export interface PeriodAmount {
  periodStart: string;
  periodEnd: string;
  amount: number;
  cadRate: number;
}

/** How a provider's month is forecast. */
export type ForecastBasis =
  /** Usage that goes on as it went: this month so far, spread over the whole month. */
  | { kind: "linear" }
  /** What is known so far, plus a fixed amount for each day left. */
  | { kind: "perDay"; cadPerDay: number }
  /** Only what is entered for the month (a plan's fee, a domain's year). */
  | { kind: "entered" };

const DAY_MS = 86_400_000;

function parseDay(day: string): number {
  return Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
}

function formatDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** `YYYY-MM` of a day. */
export function monthOf(day: string): string {
  return day.slice(0, 7);
}

/** How many days `YYYY-MM` has. */
export function daysInMonth(month: string): number {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Every day from `start` to `end`, both included. */
export function daysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  for (let t = parseDay(start); t <= parseDay(end); t += DAY_MS) out.push(formatDay(t));
  return out;
}

/** Two decimals, the way money is kept. */
export function cents(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * An amount for a period, spread evenly over its days in CA$: a yearly domain
 * fee becomes a small amount every day, a month's plan its month's days, a
 * day's bill that day.
 */
export function spreadOverDays(p: PeriodAmount): DayCost[] {
  const days = daysBetween(p.periodStart, p.periodEnd);
  if (days.length === 0) return [];
  const each = (p.amount * p.cadRate) / days.length;
  return days.map((day) => ({ day, cad: each }));
}

/** Days added together, one entry per day, in day order. */
export function sumByDay(...lists: readonly (readonly DayCost[])[]): DayCost[] {
  const m = new Map<string, number>();
  for (const list of lists) for (const d of list) m.set(d.day, (m.get(d.day) ?? 0) + d.cad);
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, cad]) => ({ day, cad }));
}

/**
 * The known bill's days, with any day an entered figure covers left out — so
 * Adrian entering a day already on the known list replaces it, never doubles it.
 */
export function withoutDaysCovered(known: readonly DayCost[], entered: readonly PeriodAmount[]): DayCost[] {
  const covered = new Set(entered.flatMap((p) => daysBetween(p.periodStart, p.periodEnd)));
  return known.filter((d) => !covered.has(d.day));
}

export interface MonthFigures {
  /** This month up to and including today, CA$. */
  soFar: number;
  /** Today alone, CA$. */
  today: number;
  /** The month's expected total, CA$ — never less than what is already spent. */
  forecast: number;
}

/**
 * This month's figures from a provider's days.
 *
 * `linear`: so far ÷ days gone × days in the month. `perDay`: so far plus the
 * fixed amount for each day left — but only once the month has cost something,
 * since a month still inside a free allowance is expected to stay there.
 * `entered`: the month's whole entered amount (a plan spread over its days),
 * future days included.
 */
export function monthFigures(days: readonly DayCost[], today: string, basis: ForecastBasis): MonthFigures {
  const month = monthOf(today);
  const inMonth = days.filter((d) => monthOf(d.day) === month);
  const soFar = inMonth.filter((d) => d.day <= today).reduce((n, d) => n + d.cad, 0);
  const todayCad = inMonth.filter((d) => d.day === today).reduce((n, d) => n + d.cad, 0);
  const total = daysInMonth(month);
  const gone = Number(today.slice(8, 10));
  const left = total - gone;
  let forecast: number;
  switch (basis.kind) {
    case "linear":
      forecast = gone > 0 ? (soFar / gone) * total : soFar;
      break;
    case "perDay":
      forecast = soFar + (soFar > 0 ? left * basis.cadPerDay : 0);
      break;
    case "entered":
      forecast = inMonth.reduce((n, d) => n + d.cad, 0);
      break;
  }
  return { soFar: cents(soFar), today: cents(todayCad), forecast: cents(Math.max(forecast, soFar)) };
}

/** Each month's total, oldest first. */
export function monthlyTotals(days: readonly DayCost[]): { month: string; cad: number }[] {
  const m = new Map<string, number>();
  for (const d of days) m.set(monthOf(d.day), (m.get(monthOf(d.day)) ?? 0) + d.cad);
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, cad]) => ({ month, cad: cents(cad) }));
}

/**
 * The days the tile's graph draws: from the first day that cost something (at
 * most `maxDays` back) to today, every day present — a day without a cost is a
 * zero, not a gap, so the bars keep their dates.
 */
export function chartDays(days: readonly DayCost[], today: string, maxDays = 92): DayCost[] {
  const costly = days.filter((d) => d.cad > 0 && d.day <= today).map((d) => d.day).sort();
  const earliest = formatDay(parseDay(today) - (maxDays - 1) * DAY_MS);
  const monthStart = `${monthOf(today)}-01`;
  const start = costly.length > 0 ? (costly[0] < earliest ? earliest : costly[0] < monthStart ? costly[0] : monthStart) : monthStart;
  const by = new Map(days.map((d) => [d.day, 0]));
  for (const d of days) by.set(d.day, (by.get(d.day) ?? 0) + d.cad);
  return daysBetween(start, today).map((day) => ({ day, cad: cents(by.get(day) ?? 0) }));
}

/** CA$ the way the tiles write it: „CA$12.34". */
export function formatCad(n: number): string {
  return `CA$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
