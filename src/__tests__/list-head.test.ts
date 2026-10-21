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

import { HEAD_BAND_PX } from "@/components/table/list-head";

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
  ],
  judicialPerson: [
    ["name", "Name", "Denumire"], ["nickname", "Nickname", "Poreclă"], ["judicialPersonType", "Type", "Tip"], ["cuiNumber", "CUI", "CUI"],
    ["tradeRegisterNumber", "Trade Reg#", "#Reg. Com."], ["contactPerson", "Contact", "Contact"], ["locality", "Locality", "Localitate"],
  ],
  property: [
    ["nickname", "Nickname", "Poreclă"], ["tarlaSola", "Tarla", "Tarla"], ["parcela", "Parcelă", "Parcelă"],
    ["surfaceAreaMp", "Supr.Ofic.", "Supr. Ofic."], ["calculatedAreaMp", "Supr.Calc.", "Supr. Calc."], ["carteFunciara", "C.F.#", "# CF"],
    ["cadastralNumber", "Cadastru #", "# Cadastru"], ["useCategory", "Use Categ.", "Categ.Folos."], ["propertyType", "Prop. Type", "Tip Prop."],
    ["locality", "Locality", "Localitate"],
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
    const chooser = [...src.matchAll(/\{ key: "(\w+)",\s+label: tHead\("(\w+)"\), full: t\("[\w.]+"\),\s+column:/g)];
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

  // Slice 40.21: two rows of the names' 18-px line (40.18's band was 62 with the funnel's own row); the name and the
  // funnel one group, centred both ways; the funnel on the name's line, its 26-px button taking only that line.
  it("the band is two 18-px rows, the name and its funnel one centred group, on every cell", () => {
    expect(HEAD_BAND_PX).toBe(36);
    const cell = read("src", "components", "table", "list-head.tsx");
    expect(cell).toContain('<th className="px-4 py-2 align-middle" {...columnHead(column)}>');
    expect(cell).toContain('className="flex items-center justify-center" style={{ height: HEAD_BAND_PX }}');
    expect(cell).toContain('className="flex min-w-0 items-end justify-center gap-1" data-head-name=""');
    expect(cell).toContain('className="line-clamp-2 min-w-0 text-balance break-words text-center" data-head-text=""');
    expect(cell).toContain('className="-my-1 inline-flex shrink-0" data-head-funnel=""');
    expect(cell).not.toMatch(/grid-rows|row-span|row-start/);
  });
});

describe("Acte's three counts, renamed (#39.83)", () => {
  it("„No. of Pages”, „No. of Persons”, „No. of Properties”; „Nr. pagini”, „Nr. persoane”, „Nr. proprietăți”", () => {
    expect([en.document.table.pageCount, en.document.table.personCount, en.document.table.propertyCount]).toEqual(["No. of Pages", "No. of Persons", "No. of Properties"]);
    expect([ro.document.table.pageCount, ro.document.table.personCount, ro.document.table.propertyCount]).toEqual(["Nr. pagini", "Nr. persoane", "Nr. proprietăți"]);
  });
});
