/**
 * „Calcul drum lateral"'s searches, as a person types them                                        (2026-10-18)
 *
 * Pure (no I/O). Adrian, 2026-10-18: the owner search answered „Nimic găsit." for every person he looked for — it
 * matched the typed text, whole and as typed, against the display name alone, so a code (`PPERS67345`), a surname
 * typed first („Chiriac Gheorghe" for „Gheorghe Chiriac") or a name without its diacritics („Stefan") found nobody.
 * Here the text is cut into words, each folded the way `foldRomanian` folds (no diacritics, lower case); a hit must
 * hold every word, in any order, somewhere in its name, code or identifiers. The SQL side (`foldedSql`) folds the
 * columns the same way.
 */
import { sql, type SQL } from "drizzle-orm";

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

/** A word as a LIKE pattern that finds it anywhere: `%`, `_` and `\` typed by the person are literal. */
export function containsPattern(word: string): string {
  return `%${word.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** The column folded in SQL as `foldSearch` folds in JavaScript — NFD, combining marks stripped, lower case. */
export function foldedSql(col: SQL | unknown): SQL {
  return sql`lower(regexp_replace(normalize(coalesce(${col}::text, ''), NFD), '[' || chr(768) || '-' || chr(879) || ']', '', 'g'))`;
}

/** Every word somewhere in the haystack: the columns folded and joined. Undefined when there are no words. */
export function allWordsIn(columns: readonly unknown[], words: readonly string[]): SQL | undefined {
  if (words.length === 0) return undefined;
  const hay = sql.join(columns.map((c) => foldedSql(c)), sql` || ' ' || `);
  return sql.join(words.map((w) => sql`(${hay}) LIKE ${containsPattern(w)}`), sql` AND `);
}
