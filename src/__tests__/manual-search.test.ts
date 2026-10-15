/**
 * „Întreabă” — the built-in search over the user manual.                                     (Slice #39.45)
 *
 * Ask first 4: Romanian with or without diacritics (the cedilla letters too), word beginnings, sections ranked,
 * the five best. Checked on the pure pieces and on the real manual in both languages.
 */
import { getManual } from "@/lib/manual/manual";
import { buildIndex, fold, highlight, queryWords, searchManual, wordMatch } from "@/lib/manual/search";

const ro = buildIndex(getManual("ro-RO"));
const en = buildIndex(getManual("en-GB"));
const ids = (index: typeof ro, q: string) => searchManual(index, q).map((r) => r.id);

describe("the pieces", () => {
  it("folds the diacritics, comma-below and cedilla alike, and keeps the length", () => {
    expect(fold("Ștergere ştergere Țară ţară Ăsta Âncă Încă")).toBe("stergere stergere tara tara asta anca inca");
    for (const s of ["adăugați", "ştampilă", "Înscrisuri „citate”"]) expect(fold(s)).toHaveLength(s.length);
  });

  it("leaves the small words out of a question", () => {
    expect(queryWords("Cum adaug o persoană în arhivă?")).toEqual(["adaug", "persoana", "arhiva"]);
    expect(queryWords("How do I add a property?")).toEqual(["add", "property"]);
    expect(queryWords("cum și unde")).toEqual([]);
  });

  it("matches word beginnings, a shared stem lightly, and a short word only a little beyond itself", () => {
    expect(wordMatch("adaug", "adaugarea")).toBe(1);
    expect(wordMatch("adaugare", "adaugati")).toBe(0.6);
    expect(wordMatch("add", "added")).toBe(1);
    expect(wordMatch("add", "address")).toBe(0);
    expect(wordMatch("parol", "parolei")).toBe(1);
    expect(wordMatch("parola", "parolei")).toBe(0.6);
    expect(wordMatch("casa", "cota")).toBe(0);
  });

  it("marks the matched words in the sentence as written", () => {
    const runs = highlight("Pe lista persoanelor fizice, apăsați „Adaugă persoană”.", ["adaug", "persoana"]);
    expect(runs.filter((r) => r.hit).map((r) => r.text)).toEqual(["persoanelor", "Adaugă", "persoană"]);
    expect(runs.map((r) => r.text).join("")).toBe("Pe lista persoanelor fizice, apăsați „Adaugă persoană”.");
  });
});

describe("the real manual", () => {
  it("indexes every chapter and section, in both languages alike", () => {
    const targets = [...getManual("ro-RO").targets.values()].filter((t) => t.kind !== "figure").map((t) => t.id).sort();
    expect(ro.entries.map((e) => e.id).sort()).toEqual(targets);
    expect(en.entries.map((e) => e.id).sort()).toEqual(targets);
  });

  it("answers the same with and without diacritics, the cedilla too", () => {
    expect(ids(ro, "cum adaug o persoana")).toEqual(ids(ro, "cum adăug o persoană"));
    expect(ids(ro, "stergere eticheta")).toEqual(ids(ro, "ștergere etichetă"));
    expect(ids(ro, "stergere eticheta")).toEqual(ids(ro, "ştergere etichetă"));
  });

  it.each([
    ["cum adaug o persoană", "persons-add", 1],
    ["schimb parola", "admin-settings-account", 5],
    ["ce este o cotă-parte", "documents-parties", 1],
    ["cum import un folder", "import-overview", 1],
    ["unde găsesc etichetele", "links-classify-tags", 5],
  ])("ro „%s” finds %s among the first %i", (q, id, within) => {
    expect(ids(ro, q).slice(0, within)).toContain(id);
  });

  it.each([
    ["how do I add a property", "properties-add", 1],
    ["how do I add a person", "persons-add", 1],
    ["change my password", "admin-settings-account", 5],
    ["what is a share", "documents-parties", 3],
  ])("en „%s” finds %s among the first %i", (q, id, within) => {
    expect(ids(en, q).slice(0, within)).toContain(id);
  });

  it("gives at most five, best first, each with a sentence and its matches marked", () => {
    const r = searchManual(ro, "cum adaug o persoană");
    expect(r.length).toBeGreaterThan(0);
    expect(r.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < r.length; i++) expect(r[i - 1].score).toBeGreaterThanOrEqual(r[i].score);
    for (const x of r) {
      expect(x.sentences.length).toBeGreaterThan(0);
      expect(x.sentences.some((s) => s.some((run) => run.hit))).toBe(true);
    }
  });

  it("finds nothing for words the manual does not use", () => {
    expect(searchManual(ro, "xqzvw plmkj")).toEqual([]);
    expect(searchManual(ro, "cum și unde")).toEqual([]);
  });
});
