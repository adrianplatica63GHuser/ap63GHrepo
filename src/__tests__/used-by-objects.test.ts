/**
 * Slice #38.59 — „Folosit de" counts objects. The column's header is two lines, „Folosit de" over
 * „(n obiecte)" (Adrian's wording, the letter n included), and each row reads only the number and the
 * word: „1 obiect", „3 obiecte", „20 de obiecte". #38.35 read „folosit de 3 înregistrări".
 */
import fs from "node:fs";
import path from "node:path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const MODAL = read("src/app/admin/value-lists/_components/value-list-modal.tsx");
type Usage = { column: string; columnSub: string; usedBy: string; unused: string };
const MSG = {
  ro: (JSON.parse(read("messages/ro-RO.json")) as { valueList: { usage: Usage } }).valueList.usage,
  en: (JSON.parse(read("messages/en-GB.json")) as { valueList: { usage: Usage } }).valueList.usage,
};

/** The arm of a `{count, plural, …}` message that `Intl.PluralRules` picks for `n`, with „#" filled in. */
function plural(message: string, locale: string, n: number): string {
  const arms = new Map<string, string>();
  for (const m of message.matchAll(/(zero|one|two|few|many|other) \{([^{}]*)\}/g)) arms.set(m[1], m[2]);
  const arm = arms.get(new Intl.PluralRules(locale).select(n)) ?? arms.get("other");
  if (arm === undefined) throw new Error(`no arm for ${n} in ${message}`);
  return arm.replace(/#/g, String(n));
}

describe("the row's text (#38.59)", () => {
  it("reads „1 obiect”, „3 obiecte”, „20 de obiecte” in Romanian", () => {
    expect(plural(MSG.ro.usedBy, "ro", 1)).toBe("1 obiect");
    expect(plural(MSG.ro.usedBy, "ro", 3)).toBe("3 obiecte");
    expect(plural(MSG.ro.usedBy, "ro", 19)).toBe("19 obiecte");
    expect(plural(MSG.ro.usedBy, "ro", 20)).toBe("20 de obiecte");
    expect(plural(MSG.ro.usedBy, "ro", 101)).toBe("101 obiecte");
  });
  it("reads „1 object”, „3 objects” in English", () => {
    expect(plural(MSG.en.usedBy, "en", 1)).toBe("1 object");
    expect(plural(MSG.en.usedBy, "en", 3)).toBe("3 objects");
  });
  it("no longer says „înregistrare” or „folosit de” on a row", () => {
    expect(MSG.ro.usedBy).not.toMatch(/înregistr|folosit/i);
    expect(MSG.en.usedBy).not.toMatch(/record|used by/i);
  });
  it("keeps „nefolosit” for a value nothing uses (Ask first #1)", () => {
    expect(MSG.ro.unused).toBe("nefolosit");
    expect(MSG.en.unused).toBe("unused");
  });
});

describe("the header (#38.59)", () => {
  it("is „Folosit de” over „(n obiecte)”, and „Used by” over „(n objects)”", () => {
    expect([MSG.ro.column, MSG.ro.columnSub]).toEqual(["Folosit de", "(n obiecte)"]);
    expect([MSG.en.column, MSG.en.columnSub]).toEqual(["Used by", "(n objects)"]);
  });
  it("draws the two keys as two lines of the one header cell, on every list", () => {
    expect(MODAL).toMatch(
    // #38.59 pinned `columnHead("valueUsage")`; #38.70 gives the roles their own usage column (`usageColumn`).
      /columnHead\(usageColumn\(listKey\)\)\}>\s*<span className="block">\{t\("usage\.column"\)\}<\/span>\s*<span className="block">\{t\("usage\.columnSub"\)\}<\/span>/,
    );
  });
});
