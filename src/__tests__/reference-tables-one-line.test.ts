/**
 * Slice #38.50 — „Date de referință": narrow tables, one line per row.
 *
 * Adrian: „we should never make a row taller because we stack buttons — the
 * buttons should always be on the same line … We should have one line of
 * content for each item; if one column has too much content it should be
 * truncated and the entire content … shown on hover". TC-VL-05 drives it.
 */
import fs from "node:fs";
import path from "node:path";
import { COLUMN, columnRem } from "@/lib/ui/field-widths";

const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");
const code = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const MODAL = code(read("src", "app", "admin", "value-lists", "_components", "value-list-modal.tsx"));
const REM = 16;

/** Every COLUMN name the reference lists' table uses. */
const VALUE_COLUMNS = [...new Set(MODAL.match(/"value[A-Z]\w*"/g)!.map((m) => m.slice(1, -1)))].filter((n) => n in COLUMN) as (keyof typeof COLUMN)[];

describe("one line per row (#38.50)", () => {
  it("finds the columns the reference lists use", () => {
    expect(VALUE_COLUMNS).toEqual(expect.arrayContaining(["valueName", "valueNameShort", "valueText", "valueFlag", "valueStatus", "valueUsage", "valueActions", "valueActionsDocTypes"]));
  });

  it("no reference list uses a `wraps` column for a row cell", () => {
    expect(VALUE_COLUMNS.filter((n) => COLUMN[n].kind === "wraps")).toEqual([]);
  });

  it("every row cell is one line, cut with „…”, its whole text in a tooltip; the old wrapping is gone", () => {
    expect(MODAL).not.toContain("wrapsIf(");
    // Slice #38.50 had `title={cellText(cell, row)}` on every cell. Slice #38.53: a document type's name says
    // itself in its own tooltip, the key under it (document-type-key-tip.test.tsx) — every other cell as before.
    expect(MODAL).toContain('title={nameTip && cell[0].key === "name" ? undefined : cellText(cell, row)}');
    expect((MODAL.match(/\bONE_LINE\b/g) ?? []).length).toBeGreaterThanOrEqual(4); // import, cells, status, usage
  });

  it("the row's buttons hold one line: never wrapping, in a column as wide as they measured (146 px; 331 px on a document type)", () => {
    expect(MODAL).toContain('<div className="flex flex-nowrap gap-2" data-row-actions="">');
    expect(MODAL).not.toMatch(/flex flex-wrap gap-2">\s*\{isDocumentTypes/);
    expect(columnRem("valueActions") * REM - 32).toBeGreaterThanOrEqual(146);
    expect(columnRem("valueActionsDocTypes") * REM - 32).toBeGreaterThanOrEqual(331);
    expect(MODAL).toContain('listKey === "document-types" ? "valueActionsDocTypes" : "valueActions"');
  });

  it("each column as wide as what it holds, measured: a checkmark as its header's longest word, „folosit de N” and the status their longest", () => {
    // The content width (COLUMN.content) against the widest text measured at 1920 px.
    const content = (n: keyof typeof COLUMN) => (columnRem(n) - 2) * REM;
    expect(content("valueFlag")).toBeGreaterThanOrEqual(86); // „PROPRIETATE"
    expect(content("valueFlag")).toBeLessThan(112); // narrower than S's old 7 rem column
    expect(content("valueUsage")).toBeGreaterThanOrEqual(141);
    expect(content("valueStatus")).toBeGreaterThanOrEqual(102);
    expect(content("valueNameShort")).toBeGreaterThanOrEqual(125); // the longest property type
    expect(columnRem("valueUsage")).toBeLessThan(15); // L's old width
  });

  it("a header may take two lines; the table is never narrower than its toolbar", () => {
    expect(MODAL).toContain('className="px-4 py-2 align-bottom"');
    expect(MODAL).toContain('<div className="w-fit max-w-full" data-value-list-frame="">');
    expect(MODAL).toContain('fixedTable(columns, "text-sm min-w-full")');
  });
});
