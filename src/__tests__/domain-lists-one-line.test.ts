/**
 * #38.57 — the four main lists on #38.50's rule: narrow, one line per row, the row's buttons side by side.
 *
 * Adrian: „the lists are much wider than they should and buttons on the right side should never be stacked — should
 * stick to one row per item". Proprietăți, Persoane fizice, Persoane juridice and Acte draw their columns from
 * `COLUMN`'s `list*` entries, measured at 1920 px on the archive (field-widths.ts), every cell `ONE_LINE` with its whole
 * text as a tooltip.
 */
import fs from "node:fs";
import path from "node:path";

import { COLUMN, SCALE, type ColumnName } from "@/lib/ui/field-widths";
import { cellTitle } from "@/components/table/fixed-columns";

const LISTS = ["properties", "natural-persons", "judicial-persons", "documents"] as const;
const VIEW = Object.fromEntries(
  LISTS.map((l) => [l, fs.readFileSync(path.join(process.cwd(), "src", "app", l, "list-view.tsx"), "utf8")]),
) as Record<(typeof LISTS)[number], string>;
const REM = 16;
const content = (n: ColumnName) => {
  const c = COLUMN[n].content;
  return (typeof c === "number" ? c : SCALE[c as keyof typeof SCALE]) * REM;
};

/** Every COLUMN name a list's view draws: its columns array, an optional field's `column:`, a header's `columnHead(…)`. */
function columnsOf(src: string): ColumnName[] {
  const arrays = [...src.matchAll(/ColumnName\[\] = \[([^\]]*)\]/g)].flatMap((m) => [...m[1].matchAll(/"(\w+)"/g)].map((x) => x[1]));
  const fields = [...src.matchAll(/column: "(\w+)"/g)].map((m) => m[1]);
  const heads = [...src.matchAll(/columnHead\("(\w+)"\)/g)].map((m) => m[1]);
  return [...new Set([...arrays, ...fields, ...heads])].filter((n) => n in COLUMN) as ColumnName[];
}

describe("the four lists, one line per row (#38.57)", () => {
  it.each(LISTS)("%s: no row cell uses a `wraps` column", (l) => {
    expect(columnsOf(VIEW[l]).filter((n) => COLUMN[n].kind === "wraps")).toEqual([]);
    expect(VIEW[l]).not.toMatch(/\bWRAPS\b|wrapsIf\(/);
  });

  it.each(LISTS)("%s: its own columns, the shared ones left to the screens that share them", (l) => {
    const cols = columnsOf(VIEW[l]);
    expect(cols).toContain("listRowActions");
    expect(cols.filter((n) => ["openPreview", "personName", "documentTitle", "documentType", "propertyNickname", "count", "date"].includes(n))).toEqual([]);
  });

  it.each(LISTS)("%s: every text cell is ONE_LINE with its whole text as a tooltip", (l) => {
    expect(VIEW[l]).toMatch(/\$\{ONE_LINE\}`\} title=\{cellTitle\(cellValue\(item, col\.key\)\)\}|\$\{ONE_LINE\}`\}\s+title=\{cellTitle\(cellValue\(item, col\.key\)\)\}/);
    expect((VIEW[l].match(/\bONE_LINE\b/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it.each(LISTS)("%s: the row's buttons on one line, in a column as wide as they measured (60 px)", (l) => {
    expect(VIEW[l]).toContain('<span className="flex flex-nowrap gap-2" data-row-actions="">');
    expect(content("listRowActions")).toBeGreaterThanOrEqual(60);
  });

  it("the property list's badges side by side — „Încrucișat” no longer on a line of its own", () => {
    expect(VIEW.properties).toContain('<span className="inline-flex flex-nowrap items-center">');
    expect(VIEW.properties).not.toContain('<span className="inline-flex flex-wrap items-center">');
    expect(content("listBadges")).toBeGreaterThanOrEqual(127);
  });

  it("each column at least as wide as its header's longest word, measured", () => {
    const word: Partial<Record<ColumnName, number>> = {
      listTarla: 80, listParcela: 60, listArea: 76, listUseCategory: 74, listPropertyType: 87, listLocality: 78,
      listPersonNickname: 61, listAge: 52, listProfessionalType: 90, listCui: 95, listTradeRegister: 83,
      listContactPerson: 71, listNrDocument: 72, listCount: 84, listDate: 62,
    };
    for (const [n, px] of Object.entries(word)) expect([n, content(n as ColumnName) >= (px as number)]).toEqual([n, true]);
  });
});

describe("cellTitle (#38.57)", () => {
  it("is a cell's whole text: a string trimmed, a number, nothing for blank or anything else", () => {
    expect(cellTitle("  Clinceni, Ilfov ")).toBe("Clinceni, Ilfov");
    expect(cellTitle(12)).toBe("12");
    expect(cellTitle("")).toBeUndefined();
    expect(cellTitle(null)).toBeUndefined();
    expect(cellTitle({})).toBeUndefined();
  });
});
