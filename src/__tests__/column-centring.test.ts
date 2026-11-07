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
import { COLUMN, columnPadRem, columnRem } from "@/lib/ui/field-widths";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const MODAL = read("src/app/admin/value-lists/_components/value-list-modal.tsx");
const REM = 16;
// #38.70: less the column's own padding — the roles' columns are `px-2` (1 rem), every other `px-4` (2).
const content = (n: keyof typeof COLUMN) => (columnRem(n) - columnPadRem(n)) * REM;

describe("the roles list's own widths (#38.60)", () => {
  // 42.02 — Adrian: „the “Name” column, which can be around 60%". It read „as wide as the longest role name (215 px)",
  // `expect(content("valueRoleName")).toBeGreaterThanOrEqual(215)`: the longest is cut now, whole in its tooltip.
  it("„Denumire” at about 60 % of #38.60's (128 px), narrower than a document type's (252)", () => {
    expect(content("valueRoleName")).toBe(128);
    expect(content("valueRoleName")).toBeLessThan(content("valueName"));
    expect(MODAL).toContain('if (listKey === "person-roles") return "valueRoleName";');
  });
  // #38.60 held „Rol invers" at its longest after #38.58, „Reprezentat / Mandant, Reprezentată / Mandantă" (309 px:
  // `>= 309`, `< 330`). #38.70 shortens that name to „Reprezentat(ă) / Mandant(ă)" (176.6 px, migration_104) and the
  // column with it.
  it("„Rol invers” is as wide as its longest value after #38.70 („Reprezentat(ă) / Mandant(ă)”, 176.6 px)", () => {
    expect(content("valueConverse")).toBeGreaterThanOrEqual(177.6);
    expect(content("valueConverse")).toBeLessThan(185);
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
  it("centre the cells of these columns; since 42.02 every header is centred across and down", () => {
    // #38.60 pinned `px-4`; #38.70 drew a compact list's cells `px-2` (`pad`): it read
    // 'className={`${pad} py-2 align-bottom${centredCell(cell) ? ` ${CENTRED}` : ""}`} …'. 42.02 — Adrian: „All the column
    // titles must be aligned to the centre and to the middle of their cell" — every header is `HEAD_CELL`.
    expect(MODAL).toContain('const HEAD_CELL = "py-2 align-middle text-center";');
    expect(MODAL).toContain("className={`${valueCellPad(cellColumn(cell, listKey))} ${HEAD_CELL}`} {...columnHead(cellColumn(cell, listKey))}");
    expect((MODAL.match(/\$\{HEAD_CELL\}/g) ?? []).length).toBe(4); // the cells' headers, the status, „Folosit de", the buttons
    expect(MODAL).not.toContain("align-bottom");
    expect(MODAL).toContain("centredCell(cell) && CENTRED,");
  });
  it("centre „Folosit de”, header and cells, on every list", () => {
    expect(MODAL).toContain('<th className={`${valueCellPad(usageColumn(listKey))} ${HEAD_CELL}`} {...columnHead(usageColumn(listKey))}>');
    expect(MODAL).toMatch(/<td className=\{`\$\{valueCellPad\(usageColumn\(listKey\)\)\} \$\{ROW_CELL\} text-xs text-fade \$\{ONE_LINE\} \$\{CENTRED\}`\} data-usage=/);
  });
});
