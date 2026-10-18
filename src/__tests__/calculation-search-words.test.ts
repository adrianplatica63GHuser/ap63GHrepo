/**
 * „Calcul drum lateral"'s searches as a person types them (src/lib/calculation/search-words.ts, 2026-10-18): every
 * word, in any order, with or without diacritics — the owner search answered „Nimic găsit." to a code, to a surname
 * typed first and to a name without its diacritics.
 */
import { PgDialect } from "drizzle-orm/pg-core";
import { person } from "@/db/schema";
import { allWordsIn, containsPattern, foldSearch, MAX_SEARCH_WORDS, searchWords } from "@/lib/calculation/search-words";

describe("the calculation's search words", () => {
  it("folds as foldRomanian: no diacritics, lower case, one space", () => {
    expect(foldSearch("  Ștefan   ȚĂRANU ")).toBe("stefan taranu");
    expect(foldSearch("Mărioara Ionescu-Pîrvu")).toBe("marioara ionescu-pirvu");
    expect(foldSearch("PPERS67345")).toBe("ppers67345");
  });

  it("cuts the text into words, in the order typed, at most six", () => {
    expect(searchWords("Chiriac Gheorghe")).toEqual(["chiriac", "gheorghe"]);
    expect(searchWords("   ")).toEqual([]);
    expect(searchWords("a b c d e f g h")).toHaveLength(MAX_SEARCH_WORDS);
  });

  it("a word is looked for anywhere, and the LIKE wildcards a person types are literal", () => {
    expect(containsPattern("ana")).toBe("%ana%");
    expect(containsPattern("50%_x\\")).toBe("%50\\%\\_x\\\\%");
  });

  it("every word must be in the folded columns, joined — none at all is no condition", () => {
    expect(allWordsIn([person.displayName], [])).toBeUndefined();
    const q = new PgDialect().sqlToQuery(allWordsIn([person.displayName, person.code], ["chiriac", "gheorghe"])!);
    expect(q.sql.match(/ LIKE /g)).toHaveLength(2);
    expect(q.sql).toContain("normalize(coalesce(");
    expect(q.sql).toContain(" AND ");
    expect(q.params).toEqual(expect.arrayContaining(["%chiriac%", "%gheorghe%"]));
  });
});
