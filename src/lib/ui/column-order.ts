/**
 * The order of a principal list's columns, as the user drags it.                                    (Slice 40.25)
 *
 * Adrian, 2026-10-21: „on each of the lists for the four principal objects we should be able to grab a column by its
 * title area (the Gray area) and move it left or right to reposition it - when we drop it".
 *
 * A list shows its named columns — the fixed ones (a name, a nickname, a type, a title), then the ones ticked in
 * „Câmpuri afișate", in the order they were ticked — and the row buttons' column last, which never moves (Ask first
 * 1). Dragging stores the whole order of the named columns per list, in this browser (Ask first 3). From there:
 *   - a column ticked later, not in the stored order, goes to the end (`applyOrder`);
 *   - an unticked one leaves the stored order (`forgetColumn`), so it comes back at the end when ticked again;
 *   - „Ordinea implicită" forgets the stored order, and today's rule lays the columns out again (Ask first 4).
 *
 * PURE — `column-order.test.ts` covers it. The drag and the store are `src/components/list/column-order.tsx`.
 */

/** The columns shown, in the stored order where there is one: stored keys still shown, then the rest as given. */
export function applyOrder(present: readonly string[], stored: readonly string[] | null): string[] {
  if (!stored) return [...present];
  const kept = stored.filter((k, i) => present.includes(k) && stored.indexOf(k) === i);
  return [...kept, ...present.filter((k) => !kept.includes(k))];
}

/** `order` with `key` moved to `to` (clamped to the ends); the same order when `key` is not in it. */
export function moveTo(order: readonly string[], key: string, to: number): string[] {
  const from = order.indexOf(key);
  if (from < 0) return [...order];
  const rest = order.filter((k) => k !== key);
  const at = Math.max(0, Math.min(rest.length, Math.round(to)));
  return [...rest.slice(0, at), key, ...rest.slice(at)];
}

/** One place left (−1) or right (+1) — Alt+← / Alt+→ on a name cell (Ask first 5). */
export function moveBy(order: readonly string[], key: string, delta: number): string[] {
  const from = order.indexOf(key);
  return from < 0 ? [...order] : moveTo(order, key, from + delta);
}

/**
 * Where a drop lands: `gap` is the boundary the pointer is nearest, 0 before the first column … n after the last,
 * counted in the order as it stands; the result is the moved column's index once it is taken out of its place.
 */
export function dropIndex(gap: number, from: number): number {
  return gap > from ? gap - 1 : gap;
}

/** The boundary nearest `x`: how many columns have their middle left of it. `mids` in the order drawn. */
export function gapAt(mids: readonly number[], x: number): number {
  return mids.filter((m) => m < x).length;
}

/** The stored order without `key` — a column unticked in „Câmpuri afișate". `null` stays `null`. */
export function forgetColumn(stored: readonly string[] | null, key: string): string[] | null {
  return stored ? stored.filter((k) => k !== key) : null;
}

/** A stored value read back: an array of strings, or `null` for nothing stored or anything unreadable. */
export function readOrder(raw: string | null): string[] | null {
  if (raw === null) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) && v.every((k) => typeof k === "string") ? (v as string[]) : null;
  } catch {
    return null;
  }
}
