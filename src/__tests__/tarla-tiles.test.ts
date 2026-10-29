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
import { COLUMN, CORNER_COLUMNS, SCALE, columnRem, tightCornerColumn, unitsInnerRem, unitsRem } from "@/lib/ui/field-widths";
import { TARLA_HALF_UNITS, TARLA_SCREEN, TARLA_THIRD_UNITS } from "@/lib/ui/screen-tiles";

const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const PAGE = code(read("src", "app", "tarlale", "_components", "tarla-detail.tsx"));
const MODAL = code(read("src", "app", "admin", "value-lists", "_components", "value-list-modal.tsx"));
const CORNERS = code(read("src", "app", "properties", "_components", "corners-manager.tsx"));
const PROPERTY_FORM = code(read("src", "app", "properties", "_components", "property-form.tsx"));
const PAGES_PANEL = code(read("src", "app", "documents", "_components", "pages-panel.tsx"));
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
  // 40.98 (Ask first 5): on the 119-px unit a 1920-px row holds 12, so its third is 4 and its half 6. Was thirds of 3
  // units (476 px) and halves of 5 (804 px) of the ten a row held.
  it("thirds of 4 units (524 px) and halves of 6 (794 px) — a maximized window's page holds twelve", () => {
    expect([TARLA_THIRD_UNITS, TARLA_HALF_UNITS]).toEqual([4, 6]);
    expect(unitsRem(4) * REM).toBe(524);
    expect(unitsRem(6) * REM).toBe(794);
    expect(unitsRem(12) * REM).toBeLessThanOrEqual(1624); // 1920 − the sidebar's 248 − the page's 2 × 24
    expect(unitsRem(13) * REM).toBeGreaterThan(1624);
    expect(TARLA_SCREEN).toEqual({
      entity: "tarla",
      tiles: ["facts", "identity", "outline", "properties", "plans", "parcels", "documents"], // #39.87: the facts first
      units: 6,
      flowUnits: 12,
    });
  });

  it("each panel names its tile and its width; the two big lists are halves, the map's tile a third", () => {
    for (const [tile, units] of [
      ["facts", "TARLA_THIRD_UNITS"], // #39.87
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
    // #39.87: three — „Parcele" scrolls as the properties and the documents do (it was 2, the parcels sideways only).
    expect((PAGE.match(/<div className=\{BIG_LIST_FRAME\} data-tarla-big-list="">/g) ?? []).length).toBe(3);
    expect((PAGE.match(/<thead className=\{STICKY_HEAD\}>/g) ?? []).length).toBe(3);
    const parcels = PAGE.slice(PAGE.indexOf('data-tarla-parcels=""'), PAGE.indexOf('data-tarla-documents=""'));
    expect(parcels).toContain('<div className={BIG_LIST_FRAME} data-tarla-big-list="">');
  });

  // Inverted by #39.87. It read: „the save stands above the tiles — it writes two of them", and held
  // `data-tarla-save` before `<TileUnitRow`. Adrian, 2026-10-18: „the save button should go at the bottom under a divider
  // Together with the delete button and the cancel button".
  it("the save, the delete and the cancel stand under the tiles, a divider above them (#39.87)", () => {
    const footer = PAGE.slice(PAGE.indexOf('data-tarla-save=""') - 200);
    expect(PAGE.indexOf('data-tarla-save=""')).toBeGreaterThan(PAGE.indexOf("</TileUnitRow>"));
    expect(footer).toMatch(/border-t border-crease pt-6[\s\S]*data-tarla-save=""/);
    // The record forms' icons and order: Save, Trash2, X.
    expect(footer).toMatch(/icon=\{Save\}[\s\S]*icon=\{Trash2\}[\s\S]*icon=\{X\}/);
    expect(footer).toContain('label={t("delete")}');
    expect(footer).toContain('label={t("cancel")}');
  });

  it("„Șterge” is Reference Data's own delete dialog, and leads back to the tarla list (Ask first 5)", () => {
    expect(PAGE).toContain('import { DeleteDialog, fetchRows } from "@/app/admin/value-lists/_components/value-list-modal";');
    expect(PAGE).toMatch(/<DeleteDialog\s+listKey="tarla"/);
    expect(PAGE).toContain('router.push("/tarlale")');
  });

  it("„Anulează” puts back what was last saved and is idle while nothing changed (Ask first 4)", () => {
    const cancel = PAGE.slice(PAGE.indexOf('label={t("cancel")}'), PAGE.indexOf('data-tarla-cancel=""'));
    expect(cancel).toContain("setDraft(null)");
    expect(cancel).toContain("disabled={!dirty || save.isPending}");
  });

  it("the facts are a tile on the page, and stay across the page on the tarla list", () => {
    expect(PAGE).not.toMatch(/<\/header>\s*<TarlaBoundariesInfo \/>/);
    const list = code(read("src", "app", "tarlale", "_components", "tarla-list.tsx"));
    expect(list).toContain("<TarlaBoundariesInfo />");
    expect(list).not.toContain('data-tile="facts"');
  });
});

describe("„Contur”: one line per corner, by narrower gaps (#39.87, Ask first 1)", () => {
  // Adrian: „by decreasing the gap between the columns and not by widening the list or the tile".
  it("each column gives up exactly the padding it loses, so every value keeps its room", () => {
    for (const w of Object.values(CORNER_COLUMNS)) {
      expect(parseFloat(w) - parseFloat(tightCornerColumn(w))).toBe(0.75); // px-3 → px-1.5 on both sides
    }
  });

  // 40.98: a third is 4 units of 119 px, its table 480 px (432 in 3 of 148) — the four buttons fit even at the
  // ordinary gaps now (152 px); the narrower ones stay, and leave them 212. Was „104 before, 164 after".
  it("in a third the buttons' cell holds the four (116 px): 152 at the ordinary gaps, 212 at the narrower", () => {
    const table = (unitsInnerRem(TARLA_THIRD_UNITS) + 0.75 * 2 - 1.25 * 2) * REM - 2; // the card's px-5, the frame's border
    expect(table).toBe(480);
    const sum = (ws: string[]) => ws.reduce((n, w) => n + parseFloat(w) * REM, 0);
    const loose = table - sum(Object.values(CORNER_COLUMNS)) - 24;
    const tight = table - sum(Object.values(CORNER_COLUMNS).map(tightCornerColumn)) - 12;
    expect(loose).toBeGreaterThanOrEqual(116);
    expect(tight).toBeGreaterThanOrEqual(116);
    expect([loose, tight]).toEqual([152, 212]);
  });

  it("only the tarla page asks for it — the property form and a document's pages keep their table", () => {
    expect(PAGE).toMatch(/<CornersManager [^>]*\btight\b/);
    expect(PROPERTY_FORM).not.toMatch(/<CornersManager[^>]*\btight\b/);
    expect(PAGES_PANEL).not.toMatch(/<CornersManager[^>]*\btight\b/);
    expect(CORNERS).toContain('const padX      = tight ? "px-1.5" : "px-3";');
  });
});
