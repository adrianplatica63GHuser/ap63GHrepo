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
    // #39.10: was `… ? undefined : cellText(cell, row)}` — a role's „Persoană → Persoană" says its family tie whole.
    expect(MODAL).toContain('title={nameTip && cell[0].key === "name" ? undefined : (tieIn(cell, row) ?? cellText(cell, row))}');
    expect((MODAL.match(/\bONE_LINE\b/g) ?? []).length).toBeGreaterThanOrEqual(4); // import, cells, status, usage
  });

  it("the row's buttons hold one line: never wrapping, in a column as wide as they measured (146 px; 331 px on a document type)", () => {
    // 42.02: and calm — at 35 % until the row is hovered (QUIET_ROW_BUTTONS). It read
    // '<div className="flex flex-nowrap gap-2" data-row-actions="">'.
    expect(MODAL).toContain('<div className={`flex flex-nowrap gap-2 ${QUIET_ROW_BUTTONS}`} data-row-actions="" data-row-buttons={QUIET_ROW_MARK}>');
    expect(MODAL).not.toMatch(/flex flex-wrap gap-2">\s*\{isDocumentTypes/);
    // 42.02: each column's own padding (`columnPadRem`) — half since 42.02; it read `columnRem(…) * REM - 32`.
    const inner = (n: keyof typeof COLUMN) => (columnRem(n) - columnPadRem(n)) * REM;
    expect(inner("valueActions")).toBeGreaterThanOrEqual(146);
    expect(inner("valueActionsDocTypes")).toBeGreaterThanOrEqual(331);
    // Slice #39.67: a tarla's row opens its page too, so it took the document types' column (was document types only).
    // #39.77: a column of its own, as wide as its four buttons — 179 px measured.
    expect(MODAL).toContain('return listKey === "document-types"\n    ? "valueActionsDocTypes"\n    : listKey === "tarla"\n      ? "valueActionsTarla"\n      : COMPACT_LISTS.has(listKey)\n        ? "valueActionsRoles"\n        : "valueActions";');
    expect(inner("valueActionsTarla")).toBeGreaterThanOrEqual(179);
  });

  it("each column as wide as what it holds, measured: a checkmark as its header's longest word, „folosit de N” and the status their longest", () => {
    // The content width (COLUMN.content) against the widest text measured at 1920 px.
    // 42.02: less the column's own padding — it read `(columnRem(n) - 2) * REM`.
    const content = (n: keyof typeof COLUMN) => (columnRem(n) - columnPadRem(n)) * REM;
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
    // 42.02: every header cell centred across and down (`HEAD_CELL`), each cell at its column's padding
    // (`valueCellPad`). It read "${pad} py-2 align-bottom" and 'const pad = COMPACT_LISTS.has(listKey) ? "px-2" : "px-4";'.
    expect(MODAL).toContain('const HEAD_CELL = "py-2 align-middle text-center";');
    expect(MODAL).toContain("className={`${valueCellPad(cellColumn(cell, listKey))} ${HEAD_CELL}`}");
    expect(MODAL).not.toContain("${pad}");
    // #38.50: `<div className="w-fit max-w-full" data-value-list-frame="">`; #38.78 measures it (`columnRef`).
    // #39.75: centred in a tile (`fill`).
    expect(MODAL).toContain('<div ref={columnRef} className={fill ? "mx-auto w-fit max-w-full" : "w-fit max-w-full"} data-value-list-frame="" data-tile-centred={fill ? "" : undefined}>');
    // #39.88: and, in a tile, filled to the standard gap (`tileFill`, reference-tiles.test.ts).
    expect(MODAL).toContain('<FixedTable id={`value-list/${listKey}`} columns={columns} className="text-sm min-w-full" fill={tileFill}>');
  });
});

describe("„+ Adaugă” and the count on the title's line (Slice #38.78)", () => {
  const head = MODAL.slice(MODAL.indexOf('data-value-list-head=""'), MODAL.indexOf("{/* Body */}"));
  const frame = MODAL.slice(MODAL.indexOf('data-value-list-frame=""'), MODAL.indexOf("{/* Slice #27.07: the backlog is empty."));

  it("the title's line holds the title, then the count, then „+ Adaugă” — every list in the card (Ask first #1)", () => {
    const at = (x: string) => head.indexOf(x);
    expect(at("{t(`lists.${meta.titleKey}`)}")).toBeGreaterThan(-1);
    expect(at('data-value-list-count=""')).toBeGreaterThan(at("{t(`lists.${meta.titleKey}`)}"));
    expect(at("label={`+ ${t(\"toolbar.add\")}`}")).toBeGreaterThan(at('data-value-list-count=""'));
    // The count keeps its wording rule: what is shown, and of how many when filtered (#27.07).
    expect(head).toContain('t("toolbar.countFiltered", {');
    expect(head).toContain('t("toolbar.count", { count: query.data.length })');
    // Its right edge is the table's: the line is never narrower than the frame, measured.
    expect(head).toContain("style={columnWidth === null ? undefined : { minWidth: columnWidth, width: \"fit-content\" }}");
    expect(MODAL).toContain("const columnWidth = useWidthOf(columnRef);");
  });

  it("neither is in the frame any more; the checkboxes have a line of their own, only on the lists that have them (Ask first #2)", () => {
    expect(frame).not.toContain("toolbar.add");
    expect(frame).not.toContain("toolbar.count");
    expect(frame).toContain('{(isDocumentTypes || (review && offerReview)) && (');
    expect(frame).toContain('data-value-list-filters=""');
    expect(frame).toContain('data-form-filter=""');
  });

  it("the table starts right under the divider: the body's top is 6 px, not 20", () => {
    expect(MODAL).toContain('<div className="px-5 pb-5 pt-1.5">');
    expect(MODAL).not.toContain('<div className="p-5">\n            {/* Add/Edit form');
  });
});

describe("„Tipuri de obiecte” without the wasted space (#38.66)", () => {
  // Each column: [its COLUMN name, the field it is drawn for, the widest thing it holds — its longest value or its
  // header's longest word — measured in px at 1366 on the archive (field-widths.ts says where)].
  const OWN: [string, keyof typeof COLUMN, string, number][] = [
    // 42.02: the judicial types' and the document types' names left this table — „Denumire" at about 60 % (below) cuts
    // their longest, whole in a tooltip. They read ["judicial-person-types", "valueJudicialTypeName", "name", 192.3] and
    // ["document-types", "valueDocTypeName", "name", 217.9].
    // #39.70: the header „DENUMIRE" (104 px; „Spațiu comercial" 103.4) since #39.66's types — was 148.6, „Teren pentru
    // Construcții" (#39.23).
    ["property-types", "valuePropertyTypeName", "name", 104],
    ["property-types", "valueFlagTarlaParcela", "showTarlaParcela", 59.2], // „PARCELĂ"
    ["property-types", "valueFlagAddress", "showAddress", 52.5], //         „ADRESĂ"
    ["property-types", "valueFlagStreetView", "showStreetView", 49.1], //   „STREET"
    ["document-types", "valueDocTypeShortName", "shortName", 97.3], //      „Doc. cadastrală"
  ];

  it.each(OWN)("%s: %s holds its widest (%s) with 1 to 8 px to spare", (_list, column, _field, widest) => {
    // 42.02: less its own padding (half, on most); it read `(columnRem(column) - 2) * REM`.
    const content = (columnRem(column) - columnPadRem(column)) * REM;
    expect(content - widest).toBeGreaterThanOrEqual(1);
    expect(content - widest).toBeLessThan(8);
    expect(COLUMN[column].kind).toBe("fixed");
  });

  it("each list draws its own columns, and only these lists have them", () => {
    expect(MODAL).toContain('"judicial-person-types": { name: "valueJudicialTypeName" },');
    expect(MODAL).toContain('"document-types": { name: "valueDocTypeName", shortName: "valueDocTypeShortName" },');
    for (const [, column, field] of OWN.filter(([l]) => l === "property-types")) expect(MODAL).toContain(`${field}: "${column}",`);
    expect(MODAL).toMatch(/const own = OWN_COLUMNS\[listKey\]\?\.\[f\.key\];\s*if \(own\) return own;\s*if \(f\.type === "checkbox"\) return "valueFlag";/);
    // #39.70: „person-types" left — the professions are long. Was ["use-categories", "person-types", "citizenships"].
    // 41.51: „Țara adresei" as its sister (it read new Set(["use-categories", "citizenships"])).
    expect(MODAL).toContain('const SHORT_NAME_LISTS: ReadonlySet<ListKey> = new Set(["use-categories", "citizenships", "address-countries"]);');
  });

  it("each is narrower than the shared column it replaced", () => {
    expect(columnRem("valueJudicialTypeName")).toBeLessThan(columnRem("valueName"));
    // #39.23: „Teren pentru Construcții" made the property types' name wider than the M it replaced; still under XL.
    expect(columnRem("valuePropertyTypeName")).toBeLessThan(columnRem("valueName"));
    for (const f of ["valueFlagTarlaParcela", "valueFlagAddress", "valueFlagStreetView"] as const) expect(columnRem(f)).toBeLessThan(columnRem("valueFlag"));
    expect(columnRem("valueDocTypeName")).toBeLessThan(columnRem("valueName"));
    expect(columnRem("valueDocTypeShortName")).toBeLessThan(columnRem("valueText"));
  });

  it("the status column holds the longest status any review list shows, „Adăugat manual” (102 px), and no more than 4 px over", () => {
    const content = (columnRem("valueStatus") - columnPadRem("valueStatus")) * REM; // 42.02: was `- 2`
    expect(content).toBeGreaterThanOrEqual(103);
    expect(content).toBeLessThanOrEqual(106);
  });
});

describe("42.02 — the columns of „Tipuri de obiecte” and „Roluri și legături” narrower", () => {
  // [column, its width before 42.02 (content and padding, rem), Adrian's share of it, how near].
  const NARROWER: [keyof typeof COLUMN, number, number][] = [
    // „Denumire … around 60%"
    ["valuePersonTypeName", 19, 0.6],
    ["valueLinkName", 19, 0.6],
    ["valueJudicialTypeName", 14.5, 0.6],
    ["valueDocTypeName", 16, 0.6],
    ["valueRoleName", 14.75, 0.6],
    // „Tarla/Parcelă, Adresă, Street View can 80%"
    ["valueFlagTarlaParcela", 6, 0.8],
    ["valueFlagAddress", 5.5, 0.8],
    ["valueFlagStreetView", 5.25, 0.8],
    // „“Used by (n objects)” can be 90%"
    ["valueUsage", 7.25, 0.9],
  ];

  it.each(NARROWER)("%s: %s rem → about %s of it, rounded to a quarter rem", (column, before, share) => {
    const now = columnRem(column);
    expect(Math.abs(now / before - share)).toBeLessThanOrEqual(0.04);
    expect((now * 4) % 1).toBe(0);
  });

  it("no „Denumire” is narrower than its header's longest word, „DENUMIRE” (104 px)", () => {
    for (const n of ["valuePersonTypeName", "valueLinkName", "valueJudicialTypeName", "valueDocTypeName", "valueRoleName", "valuePropertyTypeName", "valueUseCategoryName"] as const) {
      expect([n, (columnRem(n) - columnPadRem(n)) * REM >= 105]).toEqual([n, true]);
    }
  });

  it("where the header's word sets the content, the padding halves instead: the property types' name and „Categorii Folosință”'s", () => {
    expect([columnPadRem("valuePropertyTypeName"), columnPadRem("valueUseCategoryName")]).toEqual([1, 1]);
    expect(columnRem("valuePropertyTypeName")).toBeLessThan(8.75);
    expect(columnRem("valueUseCategoryName")).toBeLessThan(10.5);
  });

  it("the lists that share valueName keep it: the narrower names are columns of their own", () => {
    expect(MODAL).toContain('"person-types": { name: "valuePersonTypeName" },');
    expect(MODAL).toContain('"use-categories": { name: "valueUseCategoryName" },');
    expect(MODAL).toContain('"property-property-roles": { name: "valueLinkName" },');
    expect(MODAL).toContain('"document-document-roles": { name: "valueLinkName" },');
    expect(columnRem("valueName")).toBe(19);
  });

  it("a cut name says itself whole: the cells keep their tooltip", () => {
    expect(MODAL).toContain('title={nameTip && cell[0].key === "name" ? undefined : (tieIn(cell, row) ?? cellText(cell, row))}');
  });
});

describe("„Roluri Persoane” without a horizontal scroll bar at 1366 px (#38.70)", () => {
  // The roles' table, column by column, as value-list-modal.tsx draws it.
  const ROLES = ["valueRoleName", "valueRoleFlag", "valueRoleFlag", "valueConverse", "valueUsageRoles", "valueActionsRoles"] as const;
  /** The list's frame at 1366 px: the 968-px card less its 20-px padding and its border, measured. */
  const FRAME_1366 = 924;

  // 42.02: 808 px — the name at about 60 %, „Folosit de" and the buttons at half the padding. It read 904.
  it("fits the frame: 808 px", () => {
    const px = ROLES.reduce((sum, n) => sum + columnRem(n), 0) * REM;
    expect(px).toBe(808);
    expect(px).toBeLessThanOrEqual(FRAME_1366);
  });

  it("every one of its columns is drawn at half the padding, and holds its widest", () => {
    for (const n of ROLES) expect([n, columnPadRem(n)]).toEqual([n, 1]);
    const content = (n: keyof typeof COLUMN) => (columnRem(n) - columnPadRem(n)) * REM;
    // 42.02: „Reprezentant al instituției emitente" (214.8 px) is cut now, whole in the name's tooltip — it read
    // `expect(content("valueRoleName")).toBeGreaterThanOrEqual(214.8)`.
    expect(content("valueRoleName")).toBeGreaterThanOrEqual(105); // „DENUMIRE"
    expect(content("valueRoleFlag")).toBeGreaterThanOrEqual(86.9); // „PROPRIETATE"
    expect(content("valueConverse")).toBeGreaterThanOrEqual(176.6); // „Reprezentat(ă) / Mandant(ă)"
    expect(content("valueUsageRoles")).toBe(content("valueUsage"));
    expect(content("valueActionsRoles")).toBe(content("valueActions"));
  });

  it("reads the description in the name's tooltip, in the body's face, not in a column", () => {
    const description = LIST_META["person-roles"].fields.find((f) => f.key === "description");
    expect(description).toMatchObject({ nameTip: true, multiline: true });
    // #39.75: „Categorii Folosință" too, so its tile is three units.
    expect(MODAL).toContain('const COMPACT_LISTS: ReadonlySet<ListKey> = new Set(["person-roles", "use-categories"]);');
    expect(MODAL).toContain('"person-roles": { validForProperty: "valueRoleFlag", validForPerson: "valueRoleFlag" },');
  });
});

describe("42.03 — „Liste de valori”'s columns narrower", () => {
  const inner = (n: keyof typeof COLUMN) => (columnRem(n) - columnPadRem(n)) * REM;

  it("„Cetățenie”: „Denumire” and „Forme tipărite” in columns of their own, never wider than before", () => {
    expect(MODAL).toContain('citizenships: { name: "valueCitizenshipName", printedForms: "valuePrintedForms" },');
    expect(inner("valueCitizenshipName")).toBeGreaterThanOrEqual(76.5); // „Moldoveană", measured
    expect(columnRem("valueCitizenshipName")).toBeLessThan(columnRem("valueNameShort"));
    expect(columnRem("valuePrintedForms")).toBeLessThan(columnRem("valueText"));
  });

  it("„Relația cu firma”: „Denumire” at half of valueName's, still holding „Contact instituțional” (125.8 px)", () => {
    expect(MODAL).toContain('"person-relationships": { name: "valuePersonRelationshipName" },');
    expect(columnRem("valuePersonRelationshipName")).toBe(columnRem("valueName") / 2);
    expect(inner("valuePersonRelationshipName")).toBeGreaterThanOrEqual(125.8);
  });

  it("„Țara adresei” keeps its name column: „Statele Unite ale Americii” is the longest", () => {
    expect(MODAL).toContain('const SHORT_NAME_LISTS: ReadonlySet<ListKey> = new Set(["use-categories", "citizenships", "address-countries"]);');
  });

  it("„Forme tipărite”'s title carries a bubble that says what it is, in both languages", () => {
    expect(MODAL).toContain('f.key === "printedForms" && listKey === "citizenships" ? (');
    expect(MODAL).toContain('text={t("fields.printedFormsHint")}');
    const ro = JSON.parse(read("messages", "ro-RO.json"));
    const en = JSON.parse(read("messages", "en-GB.json"));
    expect(ro.valueList.fields.printedFormsHint).toBe(
      "Cum scrie actul de identitate această cetățenie (ex. ROU, ROUMAINE), despărțite prin virgulă — importul cărții de identitate le folosește ca să găsească cetățenia.",
    );
    expect(en.valueList.fields.printedFormsHint).toContain("ROU, ROUMAINE");
    expect(typeof ro.valueList.fields.printedFormsHintTrigger).toBe("string");
    expect(typeof en.valueList.fields.printedFormsHintTrigger).toBe("string");
  });
});
