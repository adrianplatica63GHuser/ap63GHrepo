/**
 * Slice #39.77 — the Tarla Codes list as narrow as its columns, and the tarla page as tiles.
 *
 * Adrian, 2026-10-17: „the between the code column and the locality column is way too big … The list itself is way too
 * wide, it should only be as wide as to accommodate the last buttons”; „make the width of all the panels with the
 * exception of the big list of properties and the big list of documents to be a third of the width of the page of a
 * maximized browser … half … not taller than two thirds of the height of the page … with a vertical scroll bar”.
 * The browser half is TC-PROP-16 step 8 and TC-VL-05 step 9.
 */
import fs from "fs";
import path from "path";
import { COLUMN, SCALE, columnRem, unitsRem } from "@/lib/ui/field-widths";
import { TARLA_HALF_UNITS, TARLA_SCREEN, TARLA_THIRD_UNITS } from "@/lib/ui/screen-tiles";

const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const PAGE = code(read("src", "app", "tarlale", "_components", "tarla-detail.tsx"));
const MODAL = code(read("src", "app", "admin", "value-lists", "_components", "value-list-modal.tsx"));
const REM = 16;

describe("„Indicative Tarla” — a small gap after the code, the list ending at its buttons", () => {
  it("the code's column is its header's width (S, 80 px — „INDICATIV” measured 75), not valueText's 160", () => {
    expect(MODAL).toContain('tarla: { indicativ: "valueTarlaCode" },');
    expect(COLUMN.valueTarlaCode.content).toBe("S");
    expect(SCALE.S * REM).toBeGreaterThanOrEqual(75);
    expect(SCALE.S).toBeLessThan(COLUMN.valueText.content as number);
  });

  it("its buttons' column holds the four it draws (179 px measured), not the document types' 21rem", () => {
    expect((columnRem("valueActionsTarla") - 2) * REM).toBeGreaterThanOrEqual(179);
    expect(columnRem("valueActionsTarla")).toBeLessThan(columnRem("valueActionsDocTypes"));
  });
});

describe("the tarla page as tiles (Ask first 1, 2, 4)", () => {
  it("thirds of 3 units (476 px) and halves of 5 (804 px) — a maximized window's page holds ten", () => {
    expect([TARLA_THIRD_UNITS, TARLA_HALF_UNITS]).toEqual([3, 5]);
    expect(unitsRem(3) * REM).toBe(476);
    expect(unitsRem(5) * REM).toBe(804);
    expect(unitsRem(10) * REM).toBe(1624); // 1920 − the sidebar's 248 − the page's 2 × 24
    expect(TARLA_SCREEN).toEqual({
      entity: "tarla",
      tiles: ["identity", "outline", "properties", "plans", "parcels", "documents"],
      units: 5,
      flowUnits: 10,
    });
  });

  it("each panel names its tile and its width; the two big lists are halves, the map's tile a third", () => {
    for (const [tile, units] of [
      ["identity", "TARLA_THIRD_UNITS"],
      ["outline", "TARLA_THIRD_UNITS"],
      ["properties", "TARLA_HALF_UNITS"],
      ["plans", "TARLA_THIRD_UNITS"],
      ["parcels", "TARLA_THIRD_UNITS"],
      ["documents", "TARLA_HALF_UNITS"],
    ]) {
      expect(PAGE).toContain(`data-tarla-${tile}="" data-tile="${tile}" style={unitStyle(${units})}`);
    }
    expect(PAGE).toContain("<TileUnitRow screen={TARLA_SCREEN}>");
    expect(PAGE).toContain("<TilePositionsReset entity={TARLA_SCREEN.entity} />");
  });

  it("the big lists stop at two thirds of the window and scroll inside, their header on top", () => {
    expect(PAGE).toContain('const BIG_LIST_FRAME = "mt-2 max-h-[66vh] overflow-auto";');
    expect((PAGE.match(/<div className=\{BIG_LIST_FRAME\} data-tarla-big-list="">/g) ?? []).length).toBe(2);
    expect((PAGE.match(/<thead className=\{STICKY_HEAD\}>/g) ?? []).length).toBe(2);
  });

  it("the save stands above the tiles — it writes two of them", () => {
    expect(PAGE.indexOf('data-tarla-save=""')).toBeLessThan(PAGE.indexOf("<TileUnitRow screen={TARLA_SCREEN}>"));
  });
});
