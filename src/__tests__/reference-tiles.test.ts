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
import { columnsRem, dialogUnits, unitsRem } from "@/lib/ui/field-widths";
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
    expect(HUB).toContain("units: valueListCardUnits(key), node: listCard(key, true)");
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
