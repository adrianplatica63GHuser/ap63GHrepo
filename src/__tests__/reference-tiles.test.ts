/**
 * Slice #39.75 — „Tipuri de Proprietate și Folosințe” as tiles, and the piece every Reference Data page will use.
 *
 * Adrian, 2026-10-17: „turn all the three panels into tiles the way we use for principal object forms”; „property
 * types can be about 60% of what it is now Use categories can be above 35% … and uses allowed can be about 60%”; „if
 * the browser is maximized we should be able to fit the "property types" and the "use categories" on the same level”.
 * The browser half — the widths, side by side at 1920, the equal gaps — is TC-VL-11 step 9.
 */
import fs from "fs";
import path from "path";
import { PANEL_BORDER_REM, REFERENCE_GAP_REM, columnsRem, dialogUnits, referenceTableRem, referenceTileRem, unitsRem } from "@/lib/ui/field-widths";
import { referenceScreen, typeUsesUnits } from "@/lib/admin/value-lists/reference-tiles";

const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const ro = JSON.parse(read("messages", "ro-RO.json"));
const en = JSON.parse(read("messages", "en-GB.json"));
const HUB = code(read("src", "app", "admin", "value-lists", "_components", "value-list-hub.tsx"));
const MODAL = code(read("src", "app", "admin", "value-lists", "_components", "value-list-modal.tsx"));

/** The card's padding (`p-5`), as value-list-modal.tsx's CARD_PADDING_REM. */
const CARD = 1.25;
/** The eight units the one card had on every list until #39.75 — 1296 px. */
const BEFORE = 8;

describe("the menu item (Ask first 1)", () => {
  it("is title case, as its neighbours, in both languages", () => {
    expect(ro.valueList.lists.propertyTypesPage).toBe("Tipuri de Proprietate și Folosințe");
    expect(en.valueList.lists.propertyTypesPage).toBe("Property Types and Uses");
  });
});

describe("the widths — whole units, the fewest that hold each table (Ask first 2)", () => {
  it("„Categorii Folosință” at the compact padding is three units: 29.75rem, its 27rem table and the card", () => {
    expect(MODAL).toMatch(/const COMPACT_LISTS: ReadonlySet<ListKey> = new Set\(\["person-roles", "use-categories"\]\);/);
    const table = columnsRem(["valueNameShort", "valueUsageRoles", "valueActionsRoles"]);
    expect(table).toBe(27);
    expect(dialogUnits(table, CARD)).toBe(3);
    expect(unitsRem(3)).toBe(29.75);
    // Adrian's „about 35 %" of the eight units: 476 of 1296 px is 37 %.
    expect(Math.round((unitsRem(3) / unitsRem(BEFORE)) * 100)).toBe(37);
  });

  it("each list's card on a tiled page is its own (`valueListCardUnits`), filling its tile, its list centred", () => {
    expect(MODAL).toContain("return dialogUnits(columnsRem(listColumns(listKey)), CARD_PADDING_REM);");
    expect(MODAL).toContain('style={fill ? { width: "100%" } : dialogCardStyle(VALUE_LIST_CARD_UNITS)}');
    expect(MODAL).toContain('className={fill ? "mx-auto w-fit max-w-full" : "w-fit max-w-full"} data-value-list-frame="" data-tile-centred={fill ? "" : undefined}>');
  });

  it("the grid takes the units its table needs at its own width: 701 px measured is five, 62 % of eight", () => {
    expect(typeUsesUnits(701)).toBe(5);
    expect(Math.round((unitsRem(5) / unitsRem(BEFORE)) * 100)).toBe(62);
    expect(typeUsesUnits(100)).toBe(2); // never under MIN_TILE_UNITS
  });
});

describe("one piece for every Reference Data page (Ask first 3)", () => {
  it("keeps each page's places under its own key, the first two tiles across", () => {
    const s = referenceScreen("property-types", [
      { key: "property-types", units: 5 },
      { key: "use-categories", units: 3 },
      { key: "type-uses", units: 5 },
    ]);
    expect(s).toEqual({ entity: "reference-property-types", tiles: ["property-types", "use-categories", "type-uses"], units: 5, flowUnits: 8 });
    expect(referenceScreen("citizenships", [{ key: "citizenships", units: 3 }]).flowUnits).toBe(3);
  });

  it("the property types' page draws its lists and the grid through it", () => {
    expect(HUB).toContain('selected === "property-types"');
    expect(HUB).toContain("...referenceTileWidth(key), node: listCard(key, true)"); // #39.88: was `units: valueListCardUnits(key)`
    expect(HUB).toContain('{ key: "type-uses", units: usesUnits, node: <PropertyTypeUses cardUnits={VALUE_LIST_CARD_UNITS} fill onUnits={setUsesUnits} /> }');
    expect(HUB).toContain("<ReferenceTiles page={selected} tiles={tiles} />");
  });
});

describe("every page but „Indicative Tarla” as tiles (Slice #39.76)", () => {
  it("the hub tiles every page — „Indicative Tarla” too since #39.77", () => {
    expect(HUB).toMatch(/const tiles: ReferenceTile\[\] \| null =\s*selected === null\s*\? null/);
  });

  it("on „Roluri și legături” the triangle is a line of its own across the row, at #38.77's width", () => {
    expect(HUB).toMatch(/\{ key: "triangle", units: TRIANGLE_UNITS, full: true, node: <RelationshipTriangle [^>]*cardUnits=\{VALUE_LIST_CARD_UNITS\} \/> \}/);
    const s = referenceScreen("person-roles", [
      { key: "triangle", units: 8, full: true },
      { key: "role-form", units: 5 },
      { key: "person-roles", units: 6 },
    ]);
    // A full tile sets neither the row's widest (6, so 1366 px holds it) nor the flow (the two under it).
    expect(s).toEqual({ entity: "reference-person-roles", tiles: ["triangle", "role-form", "person-roles"], units: 6, flowUnits: 11 });
  });

  it("a role's form — its fields, scope and document types — is a tile of its own while it is open (Ask first 1)", () => {
    expect(HUB).toContain('const ROLE_FORM_LIST: ListKey = "person-roles";');
    expect(HUB).toContain('{ key: "role-form", units: ROLE_FORM_UNITS, hidden: !formOpen, node: <div ref={setFormSlot} data-role-form-slot="" /> }');
    expect(MODAL).toContain("{form && formSlot && createPortal(");
    expect(MODAL).toContain("{form && !formSlot && (");
  });

  it("a hidden tile takes no part in the flow", () => {
    const tiles = read("src", "app", "admin", "value-lists", "_components", "reference-tiles.tsx");
    expect(tiles).toContain("referenceScreen(page, tiles.filter((t) => !t.hidden))");
    expect(tiles).toContain("hidden={t.hidden}");
  });

  it("English says „Natural Person Types”, as the menu says „Natural Persons” (Ask first 2)", () => {
    expect(en.valueList.lists.personTypes).toBe("Natural Person Types");
  });
});

describe("one gap on every page: „Categorii Folosință”'s (Slice #39.88)", () => {
  // Adrian, 2026-10-18: „The gap between the list edge and the tile edge has a proper size … all the others must be
  // modified to have the same size as the use categories tile". The browser half is TC-VL-05 and TC-VL-11 step 9.
  it("is the card's border and its p-5 — 21 px — and „Categorii Folosință”'s list already stands at it", () => {
    expect(REFERENCE_GAP_REM * 16).toBe(21);
    expect(referenceTableRem(unitsRem(3))).toBe(columnsRem(["valueNameShort", "valueUsageRoles", "valueActionsRoles"]));
    expect(referenceTileRem(referenceTableRem(unitsRem(7)))).toBe(unitsRem(7));
    expect(PANEL_BORDER_REM).toBe(1 / 16);
  });

  it("the roles' and the links' pages are not touched (Ask first 1)", () => {
    expect(MODAL).toContain('export const REFERENCE_LISTS_UNTOUCHED: ReadonlySet<ListKey> = new Set(["person-roles", "property-property-roles", "document-document-roles"]);');
  });

  it("„Cetățenie” and „Relația cu firma” keep their list and narrow their tile, off the grid where units miss (Ask first 3)", () => {
    expect(MODAL).toContain('export const REFERENCE_TILE_FOLLOWS_LIST: ReadonlySet<ListKey> = new Set(["citizenships", "person-relationships"]);');
    // Their tables, measured at 1920 px when the slice started: 464 and 600 px.
    for (const [table, tile] of [[29, 508], [37.5, 644]] as const) {
      expect(columnsRem(table === 29 ? ["valueNameShort", "valueUsage", "valueActions"] : ["valueName", "valueUsage", "valueActions"])).toBe(table);
      expect(referenceTileRem(table) * 16).toBe(tile);
      for (let n = 1; n <= 6; n++) expect(referenceTableRem(unitsRem(n))).not.toBe(table); // no whole units land on it
    }
  });

  it("every other list grows to the gap in its tile, the width going to its description or its name (Ask first 2)", () => {
    expect(MODAL).toContain('return columns.includes("valueText") ? "valueText" : columns[0];');
    // Slice 40.12: one piece, `FixedTable`, which also keeps a width the user dragged — taken from the fill column.
    expect(MODAL).toContain('<FixedTable id={`value-list/${listKey}`} columns={columns} className="text-sm min-w-full" fill={tileFill}>');
    // „Indicative Tarla": 964 px in 1132 before, 1088 after — the 124 px to „Descriere".
    expect(referenceTableRem(unitsRem(7)) * 16).toBe(1088);
  });

  it("the allowed-uses grid too: its bottom at the gap, and what it gains to „Tip”", () => {
    const USES = code(read("src", "app", "admin", "value-lists", "_components", "property-type-uses.tsx"));
    expect(USES).toContain('fill ? "pb-5 pt-3" : "py-3"');
    expect(USES).toContain("const own = el.offsetWidth - extraRef.current;");
    expect((USES.match(/style=\{namePad\}/g) ?? []).length).toBe(2);
  });
});
