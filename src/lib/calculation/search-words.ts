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

// Slice #39.89: the folding moved to a module with no database in it, so a client list can use it too.
export { MAX_SEARCH_WORDS, foldSearch, searchWords } from "@/lib/search/fold-words";

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
