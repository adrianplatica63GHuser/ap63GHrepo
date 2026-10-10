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
import { COLUMN, columnPadRem, columnRem } from "@/lib/ui/field-widths";
import { LIST_META } from "@/lib/admin/value-lists/config";

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
    expect(MODAL).toContain('listKey === "document-types" ? "valueActionsDocTypes" : COMPACT_LISTS.has(listKey) ? "valueActionsRoles" : "valueActions"');
  });

  it("each column as wide as what it holds, measured: a checkmark as its header's longest word, „folosit de N” and the status their longest", () => {
    // The content width (COLUMN.content) against the widest text measured at 1920 px.
    const content = (n: keyof typeof COLUMN) => (columnRem(n) - 2) * REM;
    expect(content("valueFlag")).toBeGreaterThanOrEqual(86); // „PROPRIETATE"
    expect(content("valueFlag")).toBeLessThan(112); // narrower than S's old 7 rem column
    // #38.50 measured „folosit de 12 înregistrări" at 141 px. #38.59: the row reads „N obiecte", measured on every list at
    // 1920 px — „999 de obiecte" 79 px, the header's „(N OBIECTE)" 77 — so the column is narrower than it was.
    expect(content("valueUsage")).toBeGreaterThanOrEqual(79);
    expect(content("valueUsage")).toBeLessThan(141);
    expect(content("valueStatus")).toBeGreaterThanOrEqual(102);
    // #38.50 sized it for the longest property type (125 px); #38.66 gave the property types a column of their own.
    expect(content("valueNameShort")).toBeGreaterThanOrEqual(125);
    expect(columnRem("valueUsage")).toBeLessThan(15); // L's old width
  });

  it("a header may take two lines; the table is never narrower than its toolbar", () => {
    // #38.50 pinned the literal `className="px-4 py-2 align-bottom"`; #38.60 centres some headers, so the class is
    // built — still `px-4 py-2 align-bottom`, plus `text-center` where the column is centred (column-centring.test.ts).
    // #38.70: built from `pad` — `px-4`, or `px-2` on a compact list (the roles).
    expect(MODAL).toContain("${pad} py-2 align-bottom");
    expect(MODAL).toContain('const pad = COMPACT_LISTS.has(listKey) ? "px-2" : "px-4";');
    expect(MODAL).toContain('<div className="w-fit max-w-full" data-value-list-frame="">');
    expect(MODAL).toContain('fixedTable(columns, "text-sm min-w-full")');
  });
});

describe("„Tipuri de obiecte” without the wasted space (#38.66)", () => {
  // Each column: [its COLUMN name, the field it is drawn for, the widest thing it holds — its longest value or its
  // header's longest word — measured in px at 1366 on the archive (field-widths.ts says where)].
  const OWN: [string, keyof typeof COLUMN, string, number][] = [
    ["judicial-person-types", "valueJudicialTypeName", "name", 87.2], //   „Consiliu Local"
    ["property-types", "valuePropertyTypeName", "name", 125.3], //          „Vegetație Forestieră"
    ["property-types", "valueFlagTarlaParcela", "showTarlaParcela", 59.2], // „PARCELĂ"
    ["property-types", "valueFlagAddress", "showAddress", 52.5], //         „ADRESĂ"
    ["property-types", "valueFlagStreetView", "showStreetView", 49.1], //   „STREET"
    ["document-types", "valueDocTypeName", "name", 232.6], //               „Plan de Amplasament și Delimitare", bold
    ["document-types", "valueDocTypeShortName", "shortName", 97.3], //      „Doc. cadastrală"
  ];

  it.each(OWN)("%s: %s holds its widest (%s) with 1 to 8 px to spare", (_list, column, _field, widest) => {
    const content = (columnRem(column) - 2) * REM;
    expect(content - widest).toBeGreaterThanOrEqual(1);
    expect(content - widest).toBeLessThan(8);
    expect(COLUMN[column].kind).toBe("fixed");
  });

  it("each list draws its own columns, and only these lists have them", () => {
    expect(MODAL).toContain('"judicial-person-types": { name: "valueJudicialTypeName" },');
    expect(MODAL).toContain('"document-types": { name: "valueDocTypeName", shortName: "valueDocTypeShortName" },');
    for (const [, column, field] of OWN.filter(([l]) => l === "property-types")) expect(MODAL).toContain(`${field}: "${column}",`);
    expect(MODAL).toMatch(/const own = OWN_COLUMNS\[listKey\]\?\.\[f\.key\];\s*if \(own\) return own;\s*if \(f\.type === "checkbox"\) return "valueFlag";/);
    expect(MODAL).toContain('const SHORT_NAME_LISTS: ReadonlySet<ListKey> = new Set(["use-categories", "person-types", "citizenships"]);');
  });

  it("each is narrower than the shared column it replaced", () => {
    expect(columnRem("valueJudicialTypeName")).toBeLessThan(columnRem("valueName"));
    expect(columnRem("valuePropertyTypeName")).toBeLessThan(columnRem("valueNameShort"));
    for (const f of ["valueFlagTarlaParcela", "valueFlagAddress", "valueFlagStreetView"] as const) expect(columnRem(f)).toBeLessThan(columnRem("valueFlag"));
    expect(columnRem("valueDocTypeName")).toBeLessThan(columnRem("valueName"));
    expect(columnRem("valueDocTypeShortName")).toBeLessThan(columnRem("valueText"));
  });

  it("the status column holds the longest status any review list shows, „Adăugat manual” (102 px), and no more than 4 px over", () => {
    const content = (columnRem("valueStatus") - 2) * REM;
    expect(content).toBeGreaterThanOrEqual(103);
    expect(content).toBeLessThanOrEqual(106);
  });
});

describe("„Roluri Persoane” without a horizontal scroll bar at 1366 px (#38.70)", () => {
  // The roles' table, column by column, as value-list-modal.tsx draws it.
  const ROLES = ["valueRoleName", "valueRoleFlag", "valueRoleFlag", "valueConverse", "valueUsageRoles", "valueActionsRoles"] as const;
  /** The list's frame at 1366 px: the 968-px card less its 20-px padding and its border, measured. */
  const FRAME_1366 = 924;

  it("fits the frame: 904 px", () => {
    const px = ROLES.reduce((sum, n) => sum + columnRem(n), 0) * REM;
    expect(px).toBe(904);
    expect(px).toBeLessThanOrEqual(FRAME_1366);
  });

  it("every one of its columns is drawn at half the padding, and holds its widest", () => {
    for (const n of ROLES) expect([n, columnPadRem(n)]).toEqual([n, 1]);
    const content = (n: keyof typeof COLUMN) => (columnRem(n) - columnPadRem(n)) * REM;
    expect(content("valueRoleName")).toBeGreaterThanOrEqual(214.8); // „Reprezentant al instituției emitente"
    expect(content("valueRoleFlag")).toBeGreaterThanOrEqual(86.9); // „PROPRIETATE"
    expect(content("valueConverse")).toBeGreaterThanOrEqual(176.6); // „Reprezentat(ă) / Mandant(ă)"
    expect(content("valueUsageRoles")).toBe(content("valueUsage"));
    expect(content("valueActionsRoles")).toBe(content("valueActions"));
  });

  it("reads the description in the name's tooltip, in the body's face, not in a column", () => {
    const description = LIST_META["person-roles"].fields.find((f) => f.key === "description");
    expect(description).toMatchObject({ nameTip: true, multiline: true });
    expect(MODAL).toContain('const COMPACT_LISTS: ReadonlySet<ListKey> = new Set(["person-roles"]);');
    expect(MODAL).toContain('"person-roles": { validForProperty: "valueRoleFlag", validForPerson: "valueRoleFlag" },');
  });
});
