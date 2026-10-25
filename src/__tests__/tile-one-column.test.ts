/**
 * Slice 40.69 — a narrow window: the tiles in one column, the heading's controls wrapping, nothing sideways.
 *
 * `oneColumn` draws an arrangement as one column — top to bottom, the left column first — and stores nothing; under
 * `ONE_COLUMN_BELOW_UNITS` (5) a row uses it; a tile wider than the row scrolls inside itself; the rows are never wider
 * than a narrow window (`--row-cap`); the four headings keep their controls in the flow.
 */
import fs from "node:fs";
import path from "node:path";
import { ONE_COLUMN_BELOW_UNITS, columnsIn, oneColumn, type Placed } from "@/lib/ui/tile-packing";
import { UNIT_GAP_REM, UNIT_REM, screenRowStyle, unitRowStyle } from "@/lib/ui/field-widths";

const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");
const box = (id: string, col: number, top: number, height: number, extra: Partial<Placed> = {}): Placed => ({ id, col, units: 3, top, height, ...extra });

describe("one column (Ask first 1, 2)", () => {
  it("a 700-px window holds fewer than 5 units, 1366 px keeps its columns", () => {
    const unit = UNIT_REM * 16;
    const gap = UNIT_GAP_REM * 16;
    expect(ONE_COLUMN_BELOW_UNITS).toBe(5);
    // 700 px less the sidebar's rail (56) and the page's padding (2 × 24): 596 px.
    expect(columnsIn(596, unit, gap)).toBeLessThan(ONE_COLUMN_BELOW_UNITS);
    // 1366 px less the sidebar (224) and the padding: 1094 px.
    expect(columnsIn(1094, unit, gap)).toBeGreaterThanOrEqual(ONE_COLUMN_BELOW_UNITS);
  });
  it("reads the arrangement top to bottom, the left column first, each tile under the one before", () => {
    const placed = [box("b", 3, 0, 100), box("a", 0, 0, 200), box("c", 0, 216, 50), box("bar", 0, 400, 40, { rowEnd: true })];
    const one = oneColumn(placed, 16);
    expect(one.map((p) => [p.id, p.col, p.top])).toEqual([
      ["a", 0, 0],
      ["c", 0, 216],
      ["b", 0, 282],
      ["bar", 0, 398],
    ]);
    // Nothing of the arrangement itself changed.
    expect(placed.map((p) => [p.id, p.col, p.top])).toEqual([["b", 3, 0], ["a", 0, 0], ["c", 0, 216], ["bar", 0, 400]]);
  });
});

describe("drawn in one column, never stored, never wider than the row (Ask first 3)", () => {
  const SRC = read("src", "components", "tiles", "use-tile-packing.ts");
  it("uses it under 5 units, and draws the arrangement it computed", () => {
    expect(SRC).toContain("single = ownColumns < ONE_COLUMN_BELOW_UNITS;");
    expect(SRC).toContain("placed = single ? oneColumn(r.placed, gap) : r.placed;");
  });
  it("stores nothing and starts no drag there", () => {
    expect(SRC).toMatch(/const store = [^\n]*\n\s+\/\/[^\n]*\n\s+if \(single\) return;/);
    expect(SRC).toContain("if (drag || single || e.button !== 0 || !e.isPrimary) return;");
  });
  it("a tile wider than the row scrolls inside itself; the row is not stretched to the widest", () => {
    expect(SRC).toContain('styles.set(box.el, "overflow-x", tooWide ? "auto" : "");');
    expect(SRC).toContain('if (fitWidest) styles.set(container, "min-width", single ? "" : `${widest}px`);');
  });
  it("the rows are never wider than a narrow window — the record screens' and the dashboard's", () => {
    expect(String(unitRowStyle("naturalPerson").width)).toMatch(/^min\(var\(--row-cap\), max\(/);
    expect(String(screenRowStyle(4).width)).toMatch(/^min\(var\(--row-cap\), max\(/);
    // The cap is the row's width below 1024 px (NARROW_WINDOW_QUERY) and none above it, where #37.35's rule stands: a row
    // keeps its widest tile and the page scrolls sideways.
    const css = read("src/app/globals.css");
    expect(css).toMatch(/--row-cap: 100000px;/);
    expect(css).toMatch(/@media \(max-width: 1023\.98px\) \{\s*:root \{ --row-cap: 100%; \}/);
  });
});

describe("the four headings wrap", () => {
  it.each([
    "src/app/natural-persons/_components/person-detail-tiles.tsx",
    "src/app/judicial-persons/_components/person-detail-tiles.tsx",
    "src/app/properties/_components/property-detail-tiles.tsx",
    "src/app/documents/_components/document-detail-tiles.tsx",
  ])("%s: the controls in the flow, under a long name rather than over it", (file) => {
    const src = read(file);
    expect(src).toContain('flex-wrap items-center gap-x-4 gap-y-2" data-record-header=""');
    expect(src).toContain('className="ml-auto flex shrink-0 items-center gap-3" data-record-controls=""');
    expect(src).not.toMatch(/absolute inset-y-0 right-0 flex items-center gap-3" data-record-controls/);
  });
});
