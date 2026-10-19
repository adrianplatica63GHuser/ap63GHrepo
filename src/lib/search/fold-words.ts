/**
 * A search as a person types it: folded words, every one somewhere, in any order.        (2026-10-18, #39.89)
 *
 * Pure, and free of the database, so a client list can use it: „Calcul drum lateral"'s searches
 * (`src/lib/calculation/search-words.ts`) fold the same way on the server, and since Slice #39.89 the groups' and the
 * stamps' lists filter what they have loaded with `filterByWords`. A word is folded as `foldRomanian` folds — no
 * diacritics, lower case — so „Stefan" finds „Ștefan" and „grp-001" finds „GRP-001".
 */

/** The most words a search keeps; the rest are dropped. */
export const MAX_SEARCH_WORDS = 6;

/** „Ștefan  POPESCU" → „stefan popescu": no diacritics, lower case, one space. */
export function foldSearch(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** The typed text as folded words, at most MAX_SEARCH_WORDS; none for blank text. */
export function searchWords(q: string): string[] {
  const f = foldSearch(q);
  return f ? f.split(" ").slice(0, MAX_SEARCH_WORDS) : [];
}

/**
 * Slice #39.89 — the items whose code and text, folded and joined, hold every word typed, in any order; an item whose
 * code IS the typed text comes first, as the calculation's routes put an exact code first. Blank text keeps them all,
 * in their order.
 */
export function filterByWords<T>(items: readonly T[], q: string, code: (item: T) => string, text: (item: T) => string): T[] {
  const words = searchWords(q);
  if (words.length === 0) return [...items];
  const whole = foldSearch(q);
  const hits = items.filter((item) => {
    const hay = foldSearch(`${code(item)} ${text(item)}`);
    return words.every((w) => hay.includes(w));
  });
  const exact = hits.filter((item) => foldSearch(code(item)) === whole);
  return [...exact, ...hits.filter((item) => foldSearch(code(item)) !== whole)];
}
