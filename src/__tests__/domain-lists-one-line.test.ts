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

  it.each(LISTS)("%s: the row's buttons on one line, in a column as wide as they make (128 px, four since #38.76)", (l) => {
    expect(VIEW[l]).toContain('<span className="flex flex-nowrap gap-2" data-row-actions="">');
    // #38.57 held two xs buttons (60 px); #38.72 adds the eye between them — three side by side, 94 px
    // („(94 px, three since #38.72)", `toBeGreaterThanOrEqual(94)`). #38.76 adds the chain link after the eye:
    // four, 4 × 26 + 3 × 8 = 128 px.
    expect(content("listRowActions")).toBeGreaterThanOrEqual(128);
  });

  // #38.57 had „the property list's badges side by side — „Încrucișat” no longer on a line of its own”, with the outer
  // span `inline-flex flex-nowrap`, no `flex-wrap`, and `content("listBadges")` at least 127 px. #39.24 narrowed the
  // column to the box and 11 px (Adrian: the gap at 30 %), so „Nou!” stays beside the box in a nowrap span of its own
  // and „Încrucișat” wraps under them, on the rare row that has it.
  // #39.73: the box is gone (the list's delete went, and its ticks with it); „Nou!” keeps its nowrap span, first.
  it("the property list's badges: „Nou!” first, „Încrucișat” on a line of its own (#39.24, #39.73)", () => {
    expect(VIEW.properties).toContain('<span className="inline-flex flex-wrap items-center" data-select-badges="">');
    expect(VIEW.properties).toMatch(
      /<span className="inline-flex flex-nowrap items-center">[\s\S]*?<RecencyBadge [^>]*\/>\s*<\/span>\s*<BowTieBadge /,
    );
    expect(VIEW.properties).not.toContain('type="checkbox"');
    expect(content("listBadges")).toBe(27);
  });

  it("each column at least as wide as its header's longest word, measured", () => {
    const word: Partial<Record<ColumnName, number>> = {
      listTarla: 80, listParcela: 60, listArea: 76, listUseCategory: 74, listPropertyType: 87, listLocality: 78,
      listPersonNickname: 61, listAge: 52, listProfessionalType: 90, listCui: 95, listTradeRegister: 83,
      listContactPerson: 71, listNrDocument: 72, listDate: 62,
      // #39.24: listCount (84, „PROPRIETĂȚI”) became one column per count, each its own header's longest word.
      listPageCount: 43, listPersonCount: 70, listPropertyCount: 84,
    };
    for (const [n, px] of Object.entries(word)) expect([n, content(n as ColumnName) >= (px as number)]).toEqual([n, true]);
  });
});

/**
 * #39.24 — Adrian, 2026-10-13: „decrease the space between checkbox and name to 50% of Current” on the two persons'
 * lists, „to 30% of Current” on Proprietăți, „add 50% to the width” of Tip proprietate and Categorie de folosință, and
 * Pages, Persons, Properties „more narrow”. The gap is measured on screen from the box's right edge to the name's first
 * letter: the select column's spare width (its content less the 16-px box) plus both cells' 16-px padding. Measured in
 * the browser pane before: 72 px on both persons' lists, 144 px on Proprietăți; after: 36 and 43.
 */
describe("the lists' columns (#39.24)", () => {
  const BOX = 16;
  const gap = (n: ColumnName) => content(n) - BOX + 2 * 16;
  const width = (n: ColumnName) => content(n) + 2 * REM;

  it("the persons' lists: their own select column, the gap at 50 % of 72 px; Acte keeps selectNew", () => {
    for (const l of ["natural-persons", "judicial-persons"] as const) {
      expect(columnsOf(VIEW[l])).toContain("listSelectPerson");
      expect(columnsOf(VIEW[l])).not.toContain("selectNew");
    }
    expect(columnsOf(VIEW.documents)).toContain("selectNew");
    expect(gap("selectNew")).toBe(72);
    expect(gap("listSelectPerson")).toBe(36);
  });

  it("Proprietăți: the gap at 30 % of 144 px, rounded to a whole pixel", () => {
    expect(gap("listBadges")).toBe(Math.round(0.3 * 144));
  });

  it("Tip proprietate and Categorie de folosință at 150 % of their width, padding included", () => {
    expect(width("listPropertyType")).toBe(1.5 * (6.75 + 2) * REM);
    expect(width("listUseCategory")).toBe(1.5 * (5 + 2) * REM);
  });

  it("Acte: each count its own column, three digits (23.4 px) or its header's longest word, whichever is wider", () => {
    const DIGITS = 23.4;
    const word = { listPageCount: 42.6, listPersonCount: 69.8, listPropertyCount: 84 } as const;
    for (const [n, px] of Object.entries(word)) expect(content(n as ColumnName)).toBeGreaterThanOrEqual(Math.max(DIGITS, px));
    expect(content("listPageCount")).toBeLessThan(content("listPersonCount"));
    expect(content("listPersonCount")).toBeLessThan(content("listPropertyCount"));
    expect(VIEW.documents).not.toMatch(/"listCount"/);
    expect("listCount" in COLUMN).toBe(false);
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
