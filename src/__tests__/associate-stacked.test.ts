/**
 * Slice #37.58 — the association screens stack their tiles at the left; a
 * property's name stays on one line wherever properties are listed.
 *
 * Read from the source, as field-widths.test.ts reads the forms: the layout is
 * a matter of classes and column widths, and e2e/association/associate-stacked.spec.ts
 * (TC-ASSOC-13) measures it in a browser.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  COLUMN,
  LIST_UNITS,
  NP_LIST_COLUMNS,
  PROPERTY_NAME_PX,
  columnRem,
  fillColumnRem,
  tableUnits,
  tileTableRem,
  unitsInnerRem,
  oneLineRowRem,
  RELATED_SLOTS,
  CELL_PADDING_REM,
  type ColumnName,
} from "@/lib/ui/field-widths";

const ROOT = join(__dirname, "..", "..");
const read = (...p: string[]): string => readFileSync(join(ROOT, ...p), "utf8");
const sum = (cols: readonly ColumnName[]): number => cols.reduce((n, c) => n + columnRem(c), 0);
const NAME_REM = PROPERTY_NAME_PX / 16;

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(f)) out.push(p);
  }
  return out;
}

describe("the association screens: Căutare, Rezultate and Asociere one under another, at the left (Slice #37.58)", () => {
  const tiles = read("src", "components", "associate", "associate-tiles.tsx");

  it("AssociateRow is a left-aligned column, not a wrapping row", () => {
    const row = tiles.slice(tiles.indexOf("export function AssociateRow"), tiles.indexOf("export function AssociateTile"));
    expect(row).toMatch(/className="flex flex-col items-start"/);
    expect(row).not.toMatch(/flex-wrap/);
    expect(row).toMatch(/data-tile-row/);
    expect(row).toMatch(/screenRowStyle\(Math\.max\(\.\.\.units\)\)/);
  });

  it("Asociere keeps to the window's bottom edge, the other two do not", () => {
    expect(tiles).toMatch(/const STICKY = " sticky bottom-0 z-10/);
    expect(tiles).toMatch(/tile === "association" \? STICKY : ""/);
  });

  it("every association screen draws its three tiles through AssociateRow, in the order search, results, association", () => {
    const views = walk(join(ROOT, "src", "app")).filter((f) => /associate-[a-z-]+-view\.tsx$/.test(f));
    expect(views.length).toBe(13);
    for (const f of views) {
      const src = readFileSync(f, "utf8");
      const order = [...src.matchAll(/<AssociateTile tile="([a-z]+)"/g)].map((m) => m[1]);
      expect([f, src.includes("<AssociateRow units=")]).toEqual([f, true]);
      expect([f, order]).toEqual([f, ["search", "results", "association"]]);
    }
  });
});

describe("a property's name on one line (Slice #37.58)", () => {
  it("the tiles' name column holds the longest name, 273 px, inside its padding", () => {
    expect(COLUMN.tilePropertyName.kind).toBe("fixed");
    expect(columnRem("tilePropertyName") - CELL_PADDING_REM).toBeGreaterThanOrEqual(NAME_REM);
  });

  it("the Document's „Corelate” holds the longest property name on one line (4 units, #37.65; Proprietăți was 3 in #37.64, 4 as a table)", () => {
    expect(LIST_UNITS.document.related).toBe(4);
    // The row's content takes what the radio, the icon and the four button slots leave: past 273 px.
    expect(unitsInnerRem(4) - 2 / 16 - oneLineRowRem(RELATED_SLOTS, 0, true)).toBeGreaterThanOrEqual(NAME_REM);
  });

  it("rule 17: a person's Proprietăți is 5 units, the same name column; a property's related properties are „Corelate”'s rows (#37.66)", () => {
    expect(LIST_UNITS.naturalPerson.properties).toBe(5);
    expect(LIST_UNITS.judicialPerson.properties).toBe(5);
    expect(LIST_UNITS.property.related).toBe(LIST_UNITS.document.related);
    for (const k of ["properties"] as const) {
      expect(NP_LIST_COLUMNS[k]).toContain("tilePropertyName");
      const room = tileTableRem(5);
      expect([k, sum(NP_LIST_COLUMNS[k]) <= room && room - sum(NP_LIST_COLUMNS[k]) <= 0.5]).toEqual([k, true]);
    }
  });

  it("the association screens' results hold it too: the label column takes what the box leaves, past 273 px", () => {
    const cols: ColumnName[] = ["select", "propertyLabel"];
    const units = tableUnits(cols);
    expect(fillColumnRem(cols, units, "propertyLabel") - CELL_PADDING_REM).toBeGreaterThanOrEqual(NAME_REM);
  });

  it("every cell that shows a property's name is one line, cut with „…”, whole in its title", () => {
    const files = [
      ["src", "app", "properties", "_components", "person-properties-tab.tsx"],
      ["src", "app", "documents", "[id]", "associate-property", "associate-property-view.tsx"],
      ["src", "app", "judicial-persons", "[id]", "associate-property", "associate-property-view.tsx"],
      ["src", "app", "natural-persons", "[id]", "associate-property", "associate-property-view.tsx"],
      ["src", "app", "properties", "[id]", "associate-reference", "associate-reference-view.tsx"],
    ];
    for (const f of files) {
      const src = read(...f);
      const cells = src.match(/<td[^>]*>\{nameOr\(item\.label, "property"\)\}<\/td>/g) ?? [];
      expect([f.join("/"), cells.length]).toEqual([f.join("/"), 1]);
      expect([f.join("/"), cells[0]]).toEqual([f.join("/"), expect.stringMatching(/(ONE_LINE|truncate)[\s\S]*title=\{nameOr\(item\.label, "property"\)\}/)]);
      expect(cells[0]).not.toMatch(/WRAPS|break-words/);
    }
    // #37.64/#37.66: the Document's and the Property's related properties are one-line rows —
    // the name their content, whole in its title.
    for (const f of [["documents", "document-properties-tab.tsx"], ["properties", "property-references-tab.tsx"]]) {
      const src = read("src", "app", f[0], "_components", f[1]);
      expect([f[1], /title: nameOr\(item\.label, "property"\),\s+content: <span[^>]*>\{nameOr\(item\.label, "property"\)\}<\/span>,/.test(src)]).toEqual([f[1], true]);
    }
    expect(read("src", "components", "tiles", "one-line-rows.tsx")).toMatch(/className="min-w-0 flex-1 truncate" title=\{title\}/);
  });
});
