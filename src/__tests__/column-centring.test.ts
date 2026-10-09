/**
 * Slice #38.60 — roles: narrower columns, centred values.
 *
 * Adrian: „too much space between Name and Description, and between Converse role and Used by"; the checkmark
 * columns, „Rol invers" and „Folosit de" „must be centered". The roles' name and converse columns are as wide as
 * their own longest value (measured at 1920 px on the archive), and the centred columns centre header and cells
 * together. TC-VL-05 step 3 measures it in the browser.
 */
import fs from "node:fs";
import path from "node:path";
import { COLUMN, columnRem } from "@/lib/ui/field-widths";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const MODAL = read("src/app/admin/value-lists/_components/value-list-modal.tsx");
const REM = 16;
const content = (n: keyof typeof COLUMN) => (columnRem(n) - 2) * REM;

describe("the roles list's own widths (#38.60)", () => {
  it("„Denumire” is as wide as the longest role name (215 px), narrower than a document type's (252)", () => {
    expect(content("valueRoleName")).toBeGreaterThanOrEqual(215);
    expect(content("valueRoleName")).toBeLessThan(content("valueName"));
    expect(MODAL).toContain('if (listKey === "person-roles") return "valueRoleName";');
  });
  it("„Rol invers” is as wide as its longest value after #38.58 (309 px)", () => {
    expect(content("valueConverse")).toBeGreaterThanOrEqual(309);
    expect(content("valueConverse")).toBeLessThan(330);
  });
  it("the other lists keep #38.50's name columns", () => {
    expect(MODAL).toContain('return SHORT_NAME_LISTS.has(listKey) ? "valueNameShort" : "valueName";');
  });
});

describe("the centred columns (#38.60)", () => {
  it("are the checkmarks (every list, Ask first #1) and the joined converse cell", () => {
    expect(MODAL).toMatch(/function centredCell\(cell: FieldMeta\[\]\): boolean \{\s*return cell\.length > 1 \|\| cell\[0\]\.type === "checkbox";\s*\}/);
    expect(MODAL).toContain('const CENTRED = "text-center";');
  });
  it("centre the header and the cells together", () => {
    expect(MODAL).toContain('className={`px-4 py-2 align-bottom${centredCell(cell) ? ` ${CENTRED}` : ""}`} {...columnHead(cellColumn(cell, listKey))}');
    expect(MODAL).toContain("centredCell(cell) && CENTRED,");
  });
  it("centre „Folosit de”, header and cells, on every list", () => {
    expect(MODAL).toContain('<th className={`px-4 py-2 align-bottom ${CENTRED}`} {...columnHead("valueUsage")}>');
    expect(MODAL).toMatch(/<td className=\{`px-4 py-2 text-xs text-fade dark:text-zinc-400 \$\{ONE_LINE\} \$\{CENTRED\}`\} data-usage=/);
  });
});
