/**
 * Calendar dates as ISO strings (yyyy-mm-dd), for the big dev seed.            (Slice #39.20)
 *
 * PURE. Every date in the plan is a string so it compares with < and > and goes to the database as is;
 * the arithmetic goes through UTC so no timezone moves a day.
 */

const DAY = 86_400_000;

export const toIso = (d: Date): string => d.toISOString().slice(0, 10);
export const fromIso = (iso: string): Date => new Date(`${iso}T00:00:00Z`);

export function addDays(iso: string, days: number): string {
  return toIso(new Date(fromIso(iso).getTime() + Math.round(days) * DAY));
}

/** `years` may be fractional: whole years by the calendar, the rest as days. */
export function addYears(iso: string, years: number): string {
  const whole = Math.trunc(years);
  const d = fromIso(iso);
  const y = d.getUTCFullYear() + whole;
  const m = d.getUTCMonth();
  // 29 February in a year that has none becomes 28 February
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const moved = new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last)));
  return addDays(toIso(moved), (years - whole) * 365.25);
}

export const daysBetween = (a: string, b: string): number => Math.round((fromIso(b).getTime() - fromIso(a).getTime()) / DAY);

/** Whole years from `dob` to `at`. */
export function ageAt(dob: string, at: string): number {
  const [y1, m1, d1] = dob.split("-").map(Number);
  const [y2, m2, d2] = at.split("-").map(Number);
  let age = y2 - y1;
  if (m2 < m1 || (m2 === m1 && d2 < d1)) age--;
  return age;
}

export const yearOf = (iso: string): number => Number(iso.slice(0, 4));
export const dmy = (iso: string): string => iso.split("-").reverse().join(".");
export const minIso = (...xs: (string | null | undefined)[]): string | null =>
  xs.filter((x): x is string => !!x).sort()[0] ?? null;
export const maxIso = (...xs: (string | null | undefined)[]): string | null =>
  xs.filter((x): x is string => !!x).sort().at(-1) ?? null;
