/**
 * #39.83 — the band of column names on the four principal lists: three rows, the funnel on the third, a name without
 * a filter centred; every list draws its names through the one shared cell.
 *
 * Slice 40.20 — Adrian's short names (2026-10-21), the band's and „Câmpuri afișate"'s, in both languages, with the
 * field's whole label on hover; #39.83's forced two-row breaks (`TWO_ROW_NAMES`, `splitName`) are gone, no short
 * name needing one.
 */
import fs from "node:fs";
import path from "node:path";

import { HEAD_BAND_PX, HEAD_PAD_PX } from "@/components/table/list-head";

const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");
const exists = (...p: string[]) => fs.existsSync(path.join(process.cwd(), ...p));
const ro = JSON.parse(read("messages", "ro-RO.json"));
const en = JSON.parse(read("messages", "en-GB.json"));

/** Adrian's list, in the order of the list and the chooser: [key, English, Romanian]. „Nascut" takes its ă. */
const SHORT: Record<string, readonly (readonly [string, string, string])[]> = {
  naturalPerson: [
    ["name", "Name", "Nume"], ["nickname", "Nickname", "Poreclă"], ["cnp", "CNP", "CNP"], ["dateOfBirth", "DoB", "Născut pe"],
    ["age", "Age", "Vârstă"], ["gender", "Gender", "Gen"], ["dateOfDeath", "DoD", "Decedat pe"], ["placeOfBirth", "Born in", "Născut la"],
    ["professionalType", "Prof.type", "Tip prof."], ["relationships", "Rel.to VM", "Rel.cu VM"],
    ["createdAt", "Added on", "Adăugat la"], // 40.45
  ],
  judicialPerson: [
    ["name", "Name", "Denumire"], ["nickname", "Nickname", "Poreclă"], ["judicialPersonType", "Type", "Tip"], ["cuiNumber", "CUI", "CUI"],
    ["tradeRegisterNumber", "Trade Reg#", "#Reg. Com."], ["contactPerson", "Contact", "Contact"], ["locality", "Locality", "Localitate"],
    ["createdAt", "Added on", "Adăugat la"], // 40.45
  ],
  property: [
    ["nickname", "Nickname", "Poreclă"], ["tarlaSola", "Tarla", "Tarla"], ["parcela", "Parcelă", "Parcelă"],
    ["surfaceAreaMp", "Supr.Ofic.", "Supr. Ofic."], ["calculatedAreaMp", "Supr.Calc.", "Supr. Calc."], ["carteFunciara", "C.F.#", "# CF"],
    ["cadastralNumber", "Cadastru #", "# Cadastru"], ["useCategory", "Use Categ.", "Categ.Folos."], ["propertyType", "Prop. Type", "Tip Prop."],
    ["locality", "Locality", "Localitate"], ["createdAt", "Added on", "Adăugat la"], // 40.45
  ],
  document: [
    ["type", "Type", "Tip"], ["title", "Title", "Titlu"], ["nrDocument", "Doc.#", "#Document"], ["dateDocument", "Date", "Data"],
    ["institution", "Inst./Notar", "Inst./Notar"], ["subject", "Subject", "Subiect"], ["pageCount", "Pages", "Pagini"],
    ["personCount", "Persons", "Persoane"], ["propertyCount", "Properties", "Proprietăți"], ["createdAt", "Added on", "Adăugat la"],
  ],
};

describe("Adrian's short names (Slice 40.20)", () => {
  it.each(Object.entries(SHORT))("%s: listHeads in both languages, in his order", (ns, rows) => {
    expect(Object.entries(en[ns].listHeads)).toEqual(rows.map(([k, e]) => [k, e]));
    expect(Object.entries(ro[ns].listHeads)).toEqual(rows.map(([k, , r]) => [k, r]));
  });

  it("the forms keep today's whole labels", () => {
    expect(ro.naturalPerson.fields.dateOfBirth).toBe("Data nașterii");
    expect(ro.property.fields.useCategory).toBe("Categorie de folosință");
    expect(ro.document.table.institution).toBe("Instituție / Notariat");
    expect(en.judicialPerson.fields.tradeRegisterNumber).not.toBe(en.judicialPerson.listHeads.tradeRegisterNumber);
  });

  const LISTS = { "natural-persons": "naturalPerson", "judicial-persons": "judicialPerson", properties: "property", documents: "document" } as const;
  it.each(Object.entries(LISTS))("%s: every chooser column and every fixed name is a short name, with its whole label beside it", (dir, ns) => {
    const src = read("src", "app", dir, "list-view.tsx");
    expect(src).toContain(`const tHead   = useTranslations("${ns}.listHeads");`);
    // 40.45: „Adăugat la"'s whole name is its short one on the three lists that gained it, `full: tHead("createdAt")`.
    const chooser = [...src.matchAll(/\{ key: "(\w+)",\s+label: tHead\("(\w+)"\), full: t(?:Head)?\("[\w.]+"\),\s+column:/g)];
    expect(chooser.length).toBe([...src.matchAll(/\{ key: "\w+",\s+label:/g)].length);
    for (const [, key, head] of chooser) expect(head).toBe(key);
    const keys = new Set(SHORT[ns].map(([k]) => k));
    for (const [, key] of chooser) expect([key, keys.has(key)]).toEqual([key, true]);
    expect(src).not.toMatch(/label: t\("(fields|table)\.\w+"\),\s+column:/);
    for (const m of src.matchAll(/<ListHeadCell column="\w+" name=\{(\w+)\("(\w+)"\)\} full=\{t\("table\.\w+"\)\} \/>/g)) {
      expect([m[1], keys.has(m[2])]).toEqual(["tHead", true]);
    }
    // A filter keeps the whole label; the band and the chooser show the short one.
    expect(src).toMatch(/\?\.full \?\? f\.key,/);
  });

  it("the forced two-row breaks are gone", () => {
    expect(exists("src", "lib", "ui", "list-head.ts")).toBe(false);
    const cell = read("src", "components", "table", "list-head.tsx").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(cell).not.toMatch(/twoRows|splitName/);
    expect(cell).toContain('data-head-text="" title={full}');
    expect(read("src", "components", "list", "field-chooser.tsx")).toContain('title={f.full}');
  });
});

describe("the four lists draw their names through the one cell", () => {
  const LISTS = { properties: "property", "natural-persons": "person", "judicial-persons": "company", documents: "document" } as const;
  it.each(Object.entries(LISTS))("%s", (dir, kind) => {
    const src = read("src", "app", dir, "list-view.tsx");
    expect(src).toContain('import { ListHeadCell } from "@/components/table/list-head";');
    expect([kind, src]).toEqual([kind, expect.stringContaining("full={col.full}")]);
    // A header cell that draws a name is the shared cell; only the tick box's and the row buttons' <th> are left.
    const rawHeads = [...src.matchAll(/<th\b[^>]*\{\.\.\.columnHead\("(\w+)"\)\}/g)].map((m) => m[1]);
    expect(rawHeads.filter((n) => !["listBadges", "listSelectPerson", "selectNew", "listRowActions"].includes(n))).toEqual([]);
    expect(src).not.toMatch(/<th key=\{col\.key\}/);
  });

  // Slice 40.21: two rows of the names' 18-px line (40.18's band was 62 with the funnel's own row). Slice 40.29: the name
  // alone centred both ways; the funnel out of the flow, in the <th>'s bottom-right corner, 2 px in.
  it("the band is two 18-px rows, the name alone centred, the funnel in the cell's corner, on every cell", () => {
    // Slice 40.30: two 17-px lines in 2.5 px of padding each way — 39 px, ¾ of 52.
    expect(HEAD_BAND_PX).toBe(34);
    expect(HEAD_BAND_PX + 2 * HEAD_PAD_PX).toBe(39);
    // The red signs are the band's height with it (`LIST_HEAD_PX`), their glyphs on a 12-px line so three fit.
    const signs = read("src", "components", "list", "hidden-column-signs.tsx");
    expect(signs).toContain("export const LIST_HEAD_PX = HEAD_BAND_PX + 2 * HEAD_PAD_PX;");
    expect(signs).toContain("text-base font-bold leading-3 text-red-600");
    const cell = read("src", "components", "table", "list-head.tsx");
    // Slice 40.25: the <th> is also the handle its column is dragged by (`drag`); 40.29: the funnel's positioning box.
    // 40.47: and the sort's aria-sort after the drag's props (it ended `{...drag}\s+>`).
    expect(cell).toMatch(/<th\s+className=\{`relative px-4 py-\[2\.5px\] align-middle\$\{drag \? [^}]*\}`\}\s+\{\.\.\.columnHead\(column\)\}\s+\{\.\.\.drag\}\s+aria-sort=\{sort \? ariaSort : undefined\}\s+>/);
    expect(cell).toContain('className="flex items-center justify-center" style={{ height: HEAD_BAND_PX }}');
    expect(cell).toContain('className="flex min-w-0 items-center justify-center" data-head-name=""');
    expect(cell).toContain('className="line-clamp-2 min-w-0 text-balance break-words text-center leading-[17px]" data-head-text=""');
    expect(cell).toContain('className="absolute bottom-0.5 right-0.5 inline-flex" data-head-funnel=""');
    // The funnel is the <th>'s child, not the name's: it cannot push the name off the middle.
    const code = cell.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(code.indexOf("data-head-funnel")).toBeGreaterThan(code.lastIndexOf("</div>"));
    expect(code).not.toContain("-my-1");
    expect(cell).not.toMatch(/grid-rows|row-span|row-start/);
  });

  it("the funnel is the 13-px corner square, its variants and name unchanged (40.29 Ask first 1)", () => {
    const bar = read("src", "components", "list", "filter-bar.tsx");
    const funnel = bar.slice(bar.indexOf("export function FilterFunnel"));
    expect(funnel).toContain('size="xs"\n        square="corner"');
    expect(funnel).toContain('variant={active ? "primary" : "secondary"}');
    expect(funnel).toContain("aria-pressed={active}");
    expect(funnel).toContain('label={t("funnel", { field: label })}');
  });
});

describe("Acte's three counts, renamed (#39.83)", () => {
  it("„No. of Pages”, „No. of Persons”, „No. of Properties”; „Nr. pagini”, „Nr. persoane”, „Nr. proprietăți”", () => {
    expect([en.document.table.pageCount, en.document.table.personCount, en.document.table.propertyCount]).toEqual(["No. of Pages", "No. of Persons", "No. of Properties"]);
    expect([ro.document.table.pageCount, ro.document.table.personCount, ro.document.table.propertyCount]).toEqual(["Nr. pagini", "Nr. persoane", "Nr. proprietăți"]);
  });
});
