/**
 * „Căutare globală": the filters a third of their old width, and the explanation's example of AND.   (Slice 40.09)
 *
 * Adrian, 2026-10-20: „for global search under please make every filter box about 33% of the current size; In the
 * explanation please give an example of how and works".
 *
 * The example names the filters by the labels the screen shows — read here from the messages — so renaming a label
 * without the example fails this suite rather than leaving the explanation naming a filter that is not there.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (...p: string[]) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
type GS = { pageSubtitle: string; filters: Record<string, string>; entityTypes: Record<string, string> };
const gs = (f: string) => (JSON.parse(read("messages", f)) as { globalSearch: GS }).globalSearch;
const RO = gs("ro-RO.json");
const EN = gs("en-GB.json");
const VIEW = code(read("src", "app", "(all-roles)", "admin", "global-search", "_components", "global-search-view.tsx"));
const FORM = VIEW.slice(VIEW.indexOf("function FilterForm("), VIEW.indexOf("Truncation notice"));

describe("the explanation says what AND does, with an example", () => {
  it("Romanian: no English „AND”, „ȘI” explained, the example in the screen's own labels", () => {
    const s = RO.pageSubtitle;
    expect(s).not.toMatch(/\bAND\b/);
    expect(s).toContain("Filtrele puse lucrează împreună (ȘI): un rezultat apare numai dacă le îndeplinește pe toate.");
    expect(s).toContain(`„${RO.filters.entityType}: ${RO.entityTypes.PROPERTY}”`);
    expect(s).toContain(`„${RO.filters.tag}: ${RO.filters.tagPlaceholder}”`);
    expect(s).toContain("— nu și persoanele cu această etichetă, nici proprietățile fără ea.");
    // The sentences around it are kept.
    expect(s.startsWith("Căutați printre toate entitățile după nume, cod, adresă sau combinând filtre")).toBe(true);
    expect(s.endsWith("Se afișează cel mult 50 de rezultate pentru fiecare tip de entitate, câte 15 pe pagină.")).toBe(true);
  });

  it("English says the same with AND and the same example", () => {
    const s = EN.pageSubtitle;
    expect(s).toContain("(AND): a result appears only if it meets all of them.");
    expect(s).toContain(`“${EN.filters.entityType}: ${EN.entityTypes.PROPERTY}”`);
    expect(s).toContain(`“${EN.filters.tag}: ${EN.filters.tagPlaceholder}”`);
    expect(s.endsWith("Up to 50 results per entity type, 15 per page.")).toBe(true);
  });
});

describe("every filter one width, a third of its old one", () => {
  it("one class for every filter: 11 rem wide (525 px at 1920 → 176), never shrunk, its box at the row's bottom", () => {
    // Read from the source: the view is a client component over next-intl, which is ESM-only and does not load here.
    expect(VIEW).toContain('export const FILTER_CLASS = "flex w-44 shrink-0 flex-col justify-end gap-1";');
    expect(FORM.match(/<div className=\{FILTER_CLASS\} data-search-filter="">/g) ?? []).toHaveLength(12);
    expect(FORM).not.toMatch(/grid-cols/);
    expect(FORM).toContain('<div className="flex flex-wrap items-end gap-x-4 gap-y-3" data-search-filters="">');
  });

  it("„Caută” and „Resetează” follow the last filter, inside the same row", () => {
    const row = FORM.slice(FORM.indexOf("data-search-filters"));
    expect(row.indexOf('data-search-actions=""')).toBeGreaterThan(row.lastIndexOf('data-search-filter=""'));
    expect(FORM).not.toContain("mt-5 flex items-center gap-3");
  });

  it("each box fills its filter and cuts a long value with an ellipsis", () => {
    expect(FORM.match(/"w-full min-w-0 truncate rounded border/g) ?? []).toHaveLength(12);
  });

  it.each([
    ["search", "Popescu", "ex. Popescu sau PPERS00012"],
    ["groupCode", "GRP-001", "ex. GRP-001"],
    ["stampCode", "STMP-AAA", "ex. STMP-AAA"],
    ["tag", "prioritar", "ex. prioritar"],
  ] as const)("%s: the placeholder is its example, the whole hint in the tooltip", (key, placeholder, hint) => {
    expect(RO.filters[`${key}Placeholder`]).toBe(placeholder);
    expect(RO.filters[`${key}Hint`]).toBe(hint);
    expect(EN.filters[`${key}Hint`]).toMatch(/^e\.g\. /);
    expect(FORM).toContain(`placeholder={t("filters.${key}Placeholder")}\n            title={t("filters.${key}Hint")}`);
  });
});
