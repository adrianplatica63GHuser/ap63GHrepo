/**
 * When a classification value last changed, in whole days — and whether that was today.        (Slice 41.28)
 *
 * Adrian, 2026-10-31: „on the Classification tile if one item was updated today it should automatically be marked as
 * reviewed; The Mark as reviewed button should be used if yesterday classification was still true for today". Its
 * `<item>UpdatedAt` is stamped by a change and by „Marchează ca verificat" alike, so „updated today" is read from what
 * is stored — a display rule, no new write (Ask first 1).
 *
 * „Today" is the same reckoning the line's „(actualizat azi)" uses: under one whole day since the stamp
 * (`daysSince` = 0). Pure; `classification-updated-today.test.ts` pins it.
 */

const DAY_MS = 1000 * 60 * 60 * 24;

/** Whole days since an ISO timestamp, or null when there is none. Was entity-metadata-tab.tsx's own (#37.63). */
export function daysSince(isoDate: string | null, now: number = Date.now()): number | null {
  if (!isoDate) return null;
  const t = new Date(isoDate).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((now - t) / DAY_MS);
}

/** The value was set or marked reviewed today — its „Marchează ca verificat" is drawn as already reviewed. */
export function updatedToday(isoDate: string | null, now: number = Date.now()): boolean {
  return daysSince(isoDate, now) === 0;
}
