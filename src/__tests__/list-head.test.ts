/**
 * #39.83 — the band of column names on the four principal lists: three rows, a long name on two, the funnel on the
 * third, a name without a filter centred. Which names always take two rows, where they break, and that every list
 * draws its names through the one shared cell.
 */
import fs from "node:fs";
import path from "node:path";

import { TWO_ROW_NAMES, splitName, twoRowName } from "@/lib/ui/list-head";
import { HEAD_BAND_PX } from "@/components/table/list-head";

const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");
const ro = JSON.parse(read("messages", "ro-RO.json"));
const en = JSON.parse(read("messages", "en-GB.json"));

describe("which names always take two rows (Adrian's list, 2026-10-18)", () => {
  it("is his thirteen, by their columns' chooser keys", () => {
    expect(TWO_ROW_NAMES).toEqual({
      property: ["surfaceAreaMp", "calculatedAreaMp", "useCategory", "propertyType"],
      person: ["dateOfBirth", "dateOfDeath", "placeOfBirth", "professionalType", "relationships"],
      company: [],
      document: ["institution", "pageCount", "personCount", "propertyCount"],
    });
    expect(Object.values(TWO_ROW_NAMES).flat()).toHaveLength(13);
    expect(twoRowName("person", "relationships")).toBe(true);
    expect(twoRowName("person", "cnp")).toBe(false);
  });

  it("each is a name of more than one word in both languages, so it can break", () => {
    const names: Record<string, (m: typeof ro) => string> = {
      surfaceAreaMp: (m) => m.property.table.surfaceAreaMp,
      calculatedAreaMp: (m) => m.property.table.calculatedAreaMp,
      useCategory: (m) => m.property.fields.useCategory,
      propertyType: (m) => m.property.fields.propertyType,
      dateOfBirth: (m) => m.naturalPerson.fields.dateOfBirth,
      dateOfDeath: (m) => m.naturalPerson.fields.dateOfDeath,
      placeOfBirth: (m) => m.naturalPerson.fields.placeOfBirth,
      professionalType: (m) => m.naturalPerson.fields.physicalPersonTypeId,
      relationships: (m) => m.naturalPerson.fields.relationships,
      institution: (m) => m.document.table.institution,
      pageCount: (m) => m.document.table.pageCount,
      personCount: (m) => m.document.table.personCount,
      propertyCount: (m) => m.document.table.propertyCount,
    };
    for (const [key, of] of Object.entries(names)) {
      for (const m of [ro, en]) expect([key, splitName(of(m)) !== null]).toEqual([key, true]);
    }
  });
});

describe("splitName — where the two rows come out most even", () => {
  it.each([
    ["Date of Birth", ["Date of", "Birth"]],
    ["Data nașterii", ["Data", "nașterii"]],
    // A tie (12 characters either way) keeps the longer row first.
    ["Categorie de folosință", ["Categorie de", "folosință"]],
    ["Relationship to the business", ["Relationship to", "the business"]],
    ["Instituție / Notariat", ["Instituție /", "Notariat"]],
    ["Institution / Notariat", ["Institution /", "Notariat"]],
    ["No. of Properties", ["No. of", "Properties"]],
    ["Nr. proprietăți", ["Nr.", "proprietăți"]],
    ["Oficială (m²)", ["Oficială", "(m²)"]],
  ] as const)("%s", (name, rows) => {
    expect(splitName(name)).toEqual(rows);
  });
  it("a one-word name does not break", () => {
    expect(splitName("Vârstă")).toBeNull();
    expect(splitName("  Tarla/Solă ")).toBeNull();
  });
});

describe("the four lists draw their names through the one cell", () => {
  const LISTS = { properties: "property", "natural-persons": "person", "judicial-persons": "company", documents: "document" } as const;
  it.each(Object.entries(LISTS))("%s", (dir, kind) => {
    const src = read("src", "app", dir, "list-view.tsx");
    expect(src).toContain('import { ListHeadCell } from "@/components/table/list-head";');
    expect(src).toContain(`twoRows={twoRowName("${kind}", col.key)}`);
    // A header cell that draws a name is the shared cell; only the tick box's and the row buttons' <th> are left.
    const rawHeads = [...src.matchAll(/<th\b[^>]*\{\.\.\.columnHead\("(\w+)"\)\}/g)].map((m) => m[1]);
    expect(rawHeads.filter((n) => !["listBadges", "listSelectPerson", "selectNew", "listRowActions"].includes(n))).toEqual([]);
    expect(src).not.toMatch(/<th key=\{col\.key\}/);
  });

  // Slice 40.18: the names are Roboto Condensed 13.5 px on an 18-px line (alternative 13), so the band went 58 → 62.
  it("the band is two 18-px text rows and the funnel's 26-px row, on every cell", () => {
    expect(HEAD_BAND_PX).toBe(62);
    const cell = read("src", "components", "table", "list-head.tsx");
    expect(cell).toContain('className="grid grid-rows-[1.125rem_1.125rem_1.625rem]" style={{ height: HEAD_BAND_PX }}');
    expect(cell).toContain('className="row-span-2 flex min-w-0 items-end" data-head-name=""');
    expect(cell).toContain('className="row-start-3 flex items-end" data-head-funnel=""');
    expect(cell).toContain('className="row-span-3 flex min-w-0 items-center" data-head-name=""');
    expect(cell).toContain("line-clamp-2 text-balance");
  });
});

describe("Acte's three counts, renamed (#39.83)", () => {
  it("„No. of Pages”, „No. of Persons”, „No. of Properties”; „Nr. pagini”, „Nr. persoane”, „Nr. proprietăți”", () => {
    expect([en.document.table.pageCount, en.document.table.personCount, en.document.table.propertyCount]).toEqual(["No. of Pages", "No. of Persons", "No. of Properties"]);
    expect([ro.document.table.pageCount, ro.document.table.personCount, ro.document.table.propertyCount]).toEqual(["Nr. pagini", "Nr. persoane", "Nr. proprietăți"]);
  });
});
