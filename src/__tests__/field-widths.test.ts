/**
 * Fixed widths — the file, the guard, and the measurement.   (Slice #37.12)
 *
 * THE WINDOW DECIDES HOW MANY PANELS FIT, NEVER HOW WIDE ANYTHING IS. Every
 * field on a converted screen takes its width from `src/lib/ui/field-widths.ts`;
 * this suite fails when a field on one of those screens takes it from
 * `flex-1`, `w-full`, a `min-w-[…]` floor or a grid column instead. Today that
 * is the Natural Person form and the shared address block; each later slice
 * adds its screen to `CONVERTED` below. The browser half — same pixel widths at
 * 1400 and 2400 px — is `e2e/helpers/field-widths.ts`.
 */
import fs from "fs";
import path from "path";

import { oneLine } from "@/components/forms/growing-text";
import {
  MAX_PAIRS,
  OVER_AT,
  buildColumnSql,
  buildObjectSql,
  buildLookupSql,
  buildTemplateSql,
  cell,
  formatReport,
  maskSql,
} from "@/lib/ui/field-measure";
import { documentTemplateFieldSchema } from "@/lib/admin/value-lists/validation";
import { FORMS_FILE_REL, parseFormsFile } from "@/lib/documents/document-type-forms-file";
import { fieldFromEditorRow, rowFromStoredField } from "@/lib/documents/template-editor-rows";
import { parseTemplateFields } from "@/lib/documents/template-fields";
import {
  ADDRESS,
  ADDRESS_ROWS,
  META_CELL_GAP_REM,
  NP_LIST_COLUMNS,
  NP_LIST_UNITS,
  NP_META_CELL_REM,
  NP_PANEL_UNITS,
  UNIT_GAP_REM,
  UNIT_REM,
  tileTableRem,
  unitsFor,
  unitsInnerRem,
  unitsRem,
  type ColumnName,
  CELL_PADDING_REM,
  COLUMN,
  DOCUMENT,
  HOLDS,
  CORNER_COLUMNS,
  JUDICIAL_PERSON,
  LABEL_GAP_REM,
  LABEL_REM,
  NATURAL_PERSON,
  NP_PANEL_INNER_REM,
  NP_ROWS,
  NP_VALIDITY_REM,
  PAGES_PANEL_REM,
  PANEL_INNER_REM,
  PANEL_REM,
  PROPERTY,
  SCALE,
  SCREEN,
  SCREEN_COLUMN,
  SELECT_CHROME_PX,
  STACK_GAP_REM,
  TEMPLATE_FIELD,
  boxRem,
  boxStyle,
  columnRem,
  columnsStyle,
  documentRowStyle,
  fieldsBesidePagesStyle,
  isStep,
  npRowStyle,
  panelRem,
  panelRowStyle,
  rowRem,
  selectStepFor,
  templateFieldWidth,
  textPx,
  type FieldWidth,
} from "@/lib/ui/field-widths";

const ROOT = process.cwd();
const read = (...p: string[]): string => fs.readFileSync(path.join(ROOT, ...p), "utf8");
/** Comments out, so a sentence that explains the old layout cannot fail the guard. */
const code = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/** What decided a width before, and must not any more. */
const STRETCH = /(?<![\w-])(flex-1|w-full|grid-cols-\d+|min-w-\[[^\]]+\])(?![\w-])/g;

/** The part of a source that lays out fields: from `start` to the first `end` after it. */
function region(src: string, start: string, end: string): string {
  const i = src.indexOf(start);
  if (i < 0) throw new Error(`no "${start}"`);
  const j = src.indexOf(end, i + start.length);
  if (j < 0) throw new Error(`no "${end}" after "${start}"`);
  return src.slice(i, j);
}

const NP_FORM = code(read("src", "app", "natural-persons", "_components", "natural-person-form.tsx"));
const ADDRESS_BLOCK = code(read("src", "components", "address", "address-block.tsx"));
const JP_FORM = code(read("src", "app", "judicial-persons", "_components", "judicial-person-form.tsx"));
const PROP_FORM = code(read("src", "app", "properties", "_components", "property-form.tsx"));
const CORNERS = code(read("src", "app", "properties", "_components", "corners-manager.tsx"));
const DOC_FORM = code(read("src", "app", "documents", "_components", "document-form.tsx"));

/** The converted screens: every region that lays out fields at fixed widths. */
const CONVERTED: [string, string][] = [
  ["the Natural Person's panels", region(NP_FORM, "<fieldset disabled", "</fieldset>")],
  ["the Natural Person's Field", region(NP_FORM, "function Field(", "\nfunction ")],
  ["the Natural Person's SelectField", region(NP_FORM, "function SelectField(", "\nfunction ")],
  ["the Natural Person's ReadOnlyField", region(NP_FORM, "function ReadOnlyField(", "\nfunction ")],
  ["the address block, fixed", region(ADDRESS_BLOCK, "if (fixedWidths) {", "\n  return (")],
  ["the address block's Field, fixed", region(ADDRESS_BLOCK, "if (width) {", "\n  return (")],
  // Slice #37.26
  ["the address block's Field, stacked", region(ADDRESS_BLOCK, "if (width && stacked) {", "\n  if (width) {")],
  // Slice #37.13
  ["the Judicial Person's panels", region(JP_FORM, "<fieldset disabled", "</fieldset>")],
  ["the Judicial Person's Field", region(JP_FORM, "function Field(", "\nfunction ")],
  ["the Judicial Person's SelectField", region(JP_FORM, "function SelectField(", "\nfunction ")],
  ["the Judicial Person's ReadOnlyField", region(JP_FORM, "function ReadOnlyField(", "\nfunction ")],
  ["the Judicial Person's contact-person row", region(JP_FORM, "function ContactPersonRow(", "\nfunction ")],
  // Slice #37.14
  ["the Property's panels", region(PROP_FORM, "data-panel-row", "{bigMap && createPortal(")],
  ["the Property's Field", region(PROP_FORM, "function Field(", "\nfunction ")],
  ["the Property's SelectField", region(PROP_FORM, "function SelectField(", "\nfunction ")],
  ["the Property's ReadOnlyField", region(PROP_FORM, "function ReadOnlyField(", "\nfunction ")],
  // Slice #37.15
  ["the Document's panels", region(DOC_FORM, "const renderCustomField = (", "const formElement = (")],
  ["the Document's form and its row", region(DOC_FORM, "const formElement = (", "{bigPage && mode !== \"create\"")],
  ["the Document's Section", region(DOC_FORM, "function Section(", "\ntype FieldProps")],
  ["the Document's Field", region(DOC_FORM, "function Field(", "\nfunction ")],
  ["the Document's SelectField", region(DOC_FORM, "function SelectField(", "\ntype TFunc")],
];

describe("THE WINDOW DECIDES HOW MANY PANELS FIT, NEVER HOW WIDE ANYTHING IS", () => {
  it.each(CONVERTED)("%s takes no width from flex-1, w-full, min-w-[…] or a grid column", (_what, src) => {
    expect(src.match(STRETCH) ?? []).toEqual([]);
  });

  it("every field on the Natural Person form names its width in the file", () => {
    const panels = region(NP_FORM, "<fieldset disabled", "</fieldset>");
    const uses = panels.match(/<(Field|SelectField|ReadOnlyField)\b/g) ?? [];
    const widths = panels.match(/width=\{NP\.[A-Za-z0-9]+\}/g) ?? [];
    expect(uses.length).toBeGreaterThan(20);
    expect(widths).toHaveLength(uses.length);
  });

  it("every field on the Judicial Person form names its width in the file, and its page has no centred cap", () => {
    const panels = region(JP_FORM, "<fieldset disabled", "</fieldset>");
    const uses = panels.match(/<(Field|SelectField|ReadOnlyField)\b/g) ?? [];
    expect(uses.length).toBe(7);
    expect(panels.match(/width=\{JP\.[A-Za-z0-9]+\}/g) ?? []).toHaveLength(uses.length);
    expect(panels.match(/<section style=\{PANEL_STYLE\}/g) ?? []).toHaveLength(2);
    expect(panels.match(/<AddressBlock<FormValues>[\s\S]*?fixedWidths/g) ?? []).toHaveLength(2);
    // Slice #37.18: as tiles, the page's tile row carries the snap and the form is `contents`.
    expect(JP_FORM).toMatch(/<form[\s\S]{0,600}?style=\{tiled \? undefined : panelRowStyle\(\)\}/);
    expect(code(read("src", "app", "judicial-persons", "_components", "person-detail-tiles.tsx"))).toMatch(/style=\{panelRowStyle\(\)\}/);
    for (const page of [["[id]", "page.tsx"], ["new", "page.tsx"]]) {
      expect(code(read("src", "app", "judicial-persons", ...page))).not.toMatch(/max-w-3xl|mx-auto/);
    }
  });

  it("every field on the Property form names its width in the file, the map has a fixed size, and no page caps it", () => {
    const panels = region(PROP_FORM, "data-panel-row", "{bigMap && createPortal(");
    const uses = panels.match(/<(Field|SelectField|ReadOnlyField)\b/g) ?? [];
    expect(uses.length).toBe(17);
    expect(panels.match(/width=\{(PROP|ADDRESS)\.[A-Za-z0-9]+\}/g) ?? []).toHaveLength(uses.length);
    expect(panels.match(/style=\{PANEL_STYLE\}/g) ?? []).toHaveLength(5);
    expect(panels.match(/style=\{MAP_BOX_STYLE\}/g) ?? []).toHaveLength(2);
    // Slice #37.19: as tiles, the page's tile row carries the snap and the form is `contents`.
    expect(PROP_FORM).toMatch(/<form[\s\S]{0,600}?style=\{tiled \? undefined : panelRowStyle\(\)\}/);
    expect(code(read("src", "app", "properties", "_components", "property-detail-tiles.tsx"))).toMatch(/style=\{panelRowStyle\(\)\}/);
    for (const f of ["property-detail-tiles.tsx", "new-property-shell.tsx"]) {
      expect(code(read("src", "app", "properties", "_components", f))).not.toMatch(/max-w-\[1040px\]|mx-auto/);
    }
    // The corners table fills its fixed panel; its COLUMNS are what the file fixes.
    expect(region(CORNERS, "<table", "</colgroup>")).toMatch(/table-fixed[\s\S]*CORNER_COLUMNS\.seq[\s\S]*CORNER_COLUMNS\.originalIndex[\s\S]*CORNER_COLUMNS\.north[\s\S]*CORNER_COLUMNS\.east/);
    expect(Object.values(CORNER_COLUMNS).every((w) => /^\d+(\.\d+)?rem$/.test(w))).toBe(true);
  });

  it("every field on the Document names its width, a type's own fields take the rule's, the page image is a fixed panel, and no page caps it", () => {
    const general = region(DOC_FORM, "const feesSection = (", "const formElement = (");
    const uses = general.match(/<(Field|SelectField)\b/g) ?? [];
    expect(uses.length).toBe(7);
    expect(general.match(/width=\{DOC\.[A-Za-z]+\}/g) ?? []).toHaveLength(uses.length);
    // Every panel is a named Section, and a Section is a fixed panel.
    const panels = region(DOC_FORM, "const renderCustomField = (", "const formElement = (");
    expect((panels.match(/<Section\b/g) ?? []).length).toBe((panels.match(/<Section\b[^>]*?\bpanel=/g) ?? []).length);
    // Slice #37.20: as tiles a panel also takes its tile's `order` — still PANEL_STYLE's width.
    expect(region(DOC_FORM, "function Section(", "\ntype FieldProps")).toMatch(/style=\{order === undefined \? PANEL_STYLE : \{ \.\.\.PANEL_STYLE, order \}\}[\s\S]*data-panel=\{panel\}/);
    // A type's own fields: the rule, never a width of their own in the form.
    const custom = region(DOC_FORM, "const renderCustomField = (", "const feesSection = (");
    expect(custom.match(/templateFieldWidth\(/g) ?? []).toHaveLength(2);
    expect(custom).not.toMatch(/width=\{(DOC|SCALE)\./);
    // The row: whole panels and the page panel, the action bar under it at that width.
    expect(DOC_FORM).toMatch(/style=\{tiled \? undefined : showPagesPanel \? documentRowStyle\(\) : panelRowStyle\(\)\}/);
    // Slice #37.20: as tiles, the page's tile row carries the snap — with the page image when it is shown.
    expect(code(read("src", "app", "documents", "_components", "document-detail-tiles.tsx"))).toMatch(/choice\.isShown\("pages"\) \? documentRowStyle\(\) : panelRowStyle\(\)/);
    expect(DOC_FORM).toMatch(/style=\{fieldsBesidePagesStyle\(\)\}/);
    expect(DOC_FORM).toMatch(/style=\{PAGES_PANEL_STYLE\} data-panel="pages"/);
    expect(DOC_FORM).not.toMatch(/lg:grid-cols-5|lg:col-span-[23]/);
    expect(code(read("src", "app", "documents", "_components", "document-detail-tiles.tsx"))).not.toMatch(/max-w-\[93rem\]|mx-auto/);
    expect(code(read("src", "app", "documents", "new", "page.tsx"))).not.toMatch(/max-w-4xl|mx-auto/);
    expect(code(read("src", "app", "documents", "_components", "succession-parties-panel.tsx"))).toMatch(/style=\{PANEL_STYLE\}/);
  });

  it("the panels, the address block and the form itself take their widths from the file", () => {
    const panels = region(NP_FORM, "<fieldset disabled", "</fieldset>");
    // Slice #37.26: each panel its own width, from its widest row.
    for (const p of ["identity", "idCard", "contact"]) expect(panels).toContain(`<section style={NP_PANEL_STYLE.${p}}`);
    expect(panels).not.toMatch(/PANEL_STYLE\}/);
    // Slice #37.27: the same-as-home checkbox is the home address panel's last line, not a panel of its own.
    expect(panels).not.toMatch(/data-panel="correspondence"/);
    expect(panels).toMatch(/prefix="addresses\.HOME"[\s\S]*?stacked\s+footer=\{\s*<Controller[\s\S]*?name="correspondenceSameAsHome"/);
    expect(region(ADDRESS_BLOCK, "if (stacked) {", "\n    return (")).toMatch(/\{footer && <div/);
    expect(panels.match(/<AddressBlock<FormValues>[\s\S]*?fixedWidths\s+stacked/g) ?? []).toHaveLength(2);
    // Slice #37.17: as tiles, the page's tile row carries the width and the form is `contents`.
    expect(NP_FORM).toMatch(/<form[\s\S]{0,600}?style=\{tiled \? undefined : npRowStyle\(\)\}/);
    expect(code(read("src", "app", "natural-persons", "_components", "person-detail-tiles.tsx"))).toMatch(/style=\{npRowStyle\(\)\}/);
    // Beside a label for the Judicial Person and the Property; stacked only when asked.
    expect(ADDRESS_BLOCK).toMatch(/<section style=\{PANEL_STYLE\}/);
    expect(ADDRESS_BLOCK).toMatch(/<section style=\{NP_PANEL_STYLE\.address\}/);
  });

  it("every box a field helper draws is marked for the e2e width check", () => {
    // The helpers, not the panels: a panel also holds checkboxes, which are not fields.
    for (const [what, src] of CONVERTED.filter(([w]) => !/panels/.test(w))) {
      if (/<input|<GrowingText|<AsyncSelect/.test(src)) expect([what, /data-width-field=|widthField=/.test(src)]).toEqual([what, true]);
    }
  });

  it("the rule is written where every later slice loads it", () => {
    const rule = read(".claude", "rules", "styling-and-buttons.md");
    expect(rule).toContain("the window decides how many panels fit, never how wide anything is");
    expect(rule).toContain("src/lib/ui/field-widths.ts");
    expect(rule).toContain("e2e/helpers/field-widths.ts");
  });
});

describe("the scale", () => {
  it("rises step by step, and a step's box holds about what the file says", () => {
    const steps = Object.keys(SCALE) as (keyof typeof SCALE)[];
    for (let i = 1; i < steps.length; i++) expect(SCALE[steps[i]]).toBeGreaterThan(SCALE[steps[i - 1]]);
    // ≈ 7 px a mixed character at 14 px Arial, plus 18 px of padding and border; 16 px a rem.
    for (const s of steps) expect(HOLDS[s] * 7 + 18).toBeLessThanOrEqual(SCALE[s] * 16 + 8);
  });

  it("Adrian's two cadastral widths are never narrowed: Nr. tarla / sola at least M, Nr. parcelă at least L", () => {
    expect(SCALE[PROPERTY.tarlaId.step]).toBeGreaterThanOrEqual(SCALE.M);
    expect(SCALE[PROPERTY.parcela.step]).toBeGreaterThanOrEqual(SCALE.L);
  });

  it("TILE is the panel's whole inner width beside the label", () => {
    // Padding AND the 1-px border: at 30.5 a TILE row overflowed its panel by 2 px (#37.14's pictures).
    expect(PANEL_INNER_REM).toBe(30.375);
    expect(SCALE.TILE).toBe(PANEL_INNER_REM - LABEL_REM - LABEL_GAP_REM);
    expect(PANEL_REM).toBe(32);
  });

  it("no field is wider than a panel's inner width beside its label", () => {
    const all: FieldWidth[] = [
      ...Object.values(NATURAL_PERSON),
      ...Object.values(ADDRESS),
      ...Object.values(JUDICIAL_PERSON),
      ...Object.values(PROPERTY),
      ...Object.values(DOCUMENT),
      ...Object.values(TEMPLATE_FIELD),
    ];
    for (const w of all) expect(LABEL_REM + LABEL_GAP_REM + SCALE[w.step]).toBeLessThanOrEqual(PANEL_INNER_REM);
  });

  it("the pairs a form puts on one row, each beside its label, fit a panel", () => {
    // The gap between the two is gap-2 (0.5rem), or gap-x-1 (0.25rem) where a pair needs it.
    // Slice #37.26: the Natural Person's rows are stacked now, and checked in their own describe below.
    const pair = (a: FieldWidth, b: FieldWidth, gap = 0.5): number => 2 * (LABEL_REM + LABEL_GAP_REM) + SCALE[a.step] + SCALE[b.step] + gap;
    for (const [a, b, gap] of [
      [ADDRESS.postalCode, ADDRESS.locality, 0.25],
      [ADDRESS.county, ADDRESS.country],
      [JUDICIAL_PERSON.cuiNumber, JUDICIAL_PERSON.tradeRegisterNumber],
      [PROPERTY.surfaceAreaMp, PROPERTY.calculatedAreaMp],
      [PROPERTY.carteFunciara, PROPERTY.cadastralNumber],
      [DOCUMENT.nrDocument, DOCUMENT.dateDocument],
      [TEMPLATE_FIELD.number, TEMPLATE_FIELD.date],
    ] as [FieldWidth, FieldWidth, number?][]) {
      expect(pair(a, b, gap)).toBeLessThanOrEqual(PANEL_INNER_REM);
    }
  });

  it("a FIXED field that names a sample holds it at about 7.8 px a digit and 9.3 px a capital", () => {
    const px = (s: string): number => [...s].reduce((n, c) => n + (/[0-9]/.test(c) ? 7.8 : /[A-ZĂÂÎȘȚH]/.test(c) ? 9.3 : /[a-zăâîșț]/.test(c) ? 6.5 : 4), 0);
    for (const w of [
      ...Object.values(NATURAL_PERSON),
      ...Object.values(ADDRESS),
      ...Object.values(JUDICIAL_PERSON),
      ...Object.values(PROPERTY),
      ...Object.values(DOCUMENT),
      ...Object.values(TEMPLATE_FIELD),
    ] as FieldWidth[]) {
      if (w.sample) expect(px(w.sample) + 18).toBeLessThanOrEqual(boxRem(w) * 16);
    }
  });

  it("a box's width is an inline style in rem, and the form snaps to whole panels", () => {
    expect(boxStyle({ step: "M", kind: "fixed" })).toEqual({ width: "8.5rem" });
    expect(String(panelRowStyle().width)).toBe("max(32rem, calc(round(down, 100% + 1rem, 33rem) - 1rem))");
  });
});

describe("the Natural Person: every label above its box, every panel as wide as its widest row (Slice #37.26)", () => {
  const NP = NATURAL_PERSON;
  const panels = region(NP_FORM, "<fieldset disabled", "</fieldset>");

  /**
   * The form's rows, read from its source: each `<div className="flex gap-2">`
   * is one row of the names in it, and a field outside one is a row alone.
   * `field="…"` is the read-only Vârstă, which has no form name.
   */
  function rowsOf(src: string): string[][] {
    const rows: string[][] = [];
    const re = /<div className="flex gap-2">([\s\S]*?)\n {10}<\/div>|(?:name|field)="([a-zA-Z0-9.]+)"/g;
    for (const m of src.matchAll(re)) {
      if (m[1] !== undefined) rows.push([...m[1].matchAll(/(?:name|field)="([a-zA-Z0-9.]+)"/g)].map((n) => n[1]));
      else rows.push([m[2]]);
    }
    return rows;
  }

  it("every field is in exactly one row", () => {
    const listed = Object.values(NP_ROWS).flat(2);
    expect([...listed].sort()).toEqual(Object.keys(NP).sort());
    expect(new Set(listed).size).toBe(listed.length);
    expect([...ADDRESS_ROWS.flat()].sort()).toEqual(Object.keys(ADDRESS).sort());
  });

  it("the form draws exactly the rows the file names, panel by panel, in order", () => {
    const identity = region(panels, 'data-panel="identity"', 'data-panel="id-card"');
    const idCard = region(panels, 'data-panel="id-card"', 'data-panel="contact"');
    const contact = region(panels, 'data-panel="contact"', "<AddressBlock");
    expect(rowsOf(identity)).toEqual(NP_ROWS.identity.map((r) => [...r]));
    expect(rowsOf(idCard)).toEqual(NP_ROWS.idCard.map((r) => [...r]));
    expect(rowsOf(contact)).toEqual(NP_ROWS.contact.map((r) => [...r]));
    // The address block draws ADDRESS_ROWS itself when stacked.
    expect(region(ADDRESS_BLOCK, "if (stacked) {", "\n    return (")).toMatch(/ADDRESS_ROWS\.map\(/);
  });

  it("Adrian's rows: Nume | Prenume, Poreclă | CNP, Data nașterii | Vârstă | Gen, Locul nașterii | Tip profesional, then Note", () => {
    expect(NP_ROWS.identity).toEqual([
      ["lastName", "firstName"],
      ["nickname", "cnp"],
      ["dateOfBirth", "age", "gender"],
      ["placeOfBirth", "physicalPersonTypeId"],
      ["notes"],
    ]);
    expect(NP_ROWS.idCard).toEqual([
      ["idDocumentType", "idDocumentNumber", "idCardNumber"],
      ["idValidFrom", "idValidUntil"],
      ["citizenshipId", "idIssuingAuthority"],
      ["idMrzRaw"],
    ]);
    // The validity status sits in the dates' row, after them.
    expect(region(panels, 'name="idValidUntil"', 'name="citizenshipId"')).toMatch(/data-validity-status/);
    expect(NP_VALIDITY_REM).toBe(10.125);
  });

  it("the ID card's first row is about 75% of what it was, and still holds its values", () => {
    expect(boxRem(NP.idDocumentNumber)).toBe(0.75 * SCALE.M);
    expect(boxRem(NP.idCardNumber)).toBe(0.75 * SCALE.M);
    // Tip document: the nearest to 75% of L that still shows „Carte de identitate" whole.
    expect(boxRem(NP.idDocumentType) / SCALE.L).toBeGreaterThanOrEqual(0.75);
    expect(boxRem(NP.idDocumentType) / SCALE.L).toBeLessThan(0.8);
    expect(textPx("Carte de identitate") + SELECT_CHROME_PX).toBeLessThanOrEqual(boxRem(NP.idDocumentType) * 16);
    expect(textPx("Carte de identitate") + SELECT_CHROME_PX).toBeGreaterThan(0.75 * SCALE.L * 16);
  });

  it("each panel is the fewest whole units that hold its widest row (#37.27), and Note and the MRZ fill it", () => {
    const widest = (rows: readonly (readonly string[])[], widths: Record<string, FieldWidth>): number =>
      Math.max(...rows.map((r) => rowRem(r.map((k) => widths[k]))));
    const rowsOf: Record<keyof typeof NP_PANEL_UNITS, number> = {
      identity: widest(NP_ROWS.identity, NP),
      idCard: widest(NP_ROWS.idCard, NP),
      contact: widest(NP_ROWS.contact, NP),
      address: widest(ADDRESS_ROWS, ADDRESS),
    };
    expect(rowsOf).toEqual({ identity: 26.5, idCard: 26, contact: 17.5, address: 24 });
    expect(NP_PANEL_UNITS).toEqual({ identity: 3, idCard: 3, contact: 2, address: 3 });
    for (const k of Object.keys(NP_PANEL_UNITS) as (keyof typeof NP_PANEL_UNITS)[]) {
      expect([k, NP_PANEL_INNER_REM[k] >= rowsOf[k]]).toEqual([k, true]);
      expect([k, unitsInnerRem(NP_PANEL_UNITS[k] - 1) < rowsOf[k]]).toEqual([k, true]); // one unit fewer would not hold it
    }
    expect(NP_PANEL_INNER_REM).toEqual({ identity: 28.125, idCard: 28.125, contact: 17.875, address: 28.125 });
    for (const inner of Object.values(NP_PANEL_INNER_REM)) expect(panelRem(inner)).toBeLessThan(PANEL_REM);
    expect(rowRem([NP.idValidFrom, NP.idValidUntil]) + STACK_GAP_REM + NP_VALIDITY_REM).toBe(NP_PANEL_INNER_REM.idCard);
    expect([NP.notes.fill, NP.idMrzRaw.fill, ADDRESS.notes.fill]).toEqual([true, true, true]);
    expect(panels).toMatch(/width=\{NP\.notes\}\s+fillRem=\{NP_PANEL_INNER_REM\.identity\}/);
    expect(panels).toMatch(/width=\{NP\.idMrzRaw\}\s+fillRem=\{NP_PANEL_INNER_REM\.idCard\}/);
  });

  it("no label beside a box is left on the form, and the row is as wide as its panels", () => {
    expect(NP_FORM).not.toMatch(/LABEL_STYLE/);
    expect(region(ADDRESS_BLOCK, "if (width && stacked) {", "\n  if (width) {")).not.toMatch(/LABEL_STYLE/);
    expect(String(npRowStyle().width)).toBe("max(50.25rem, calc(round(down, 100% + 1rem, 10.25rem) - 1rem))");
  });
});

describe("the width unit: every Natural Person tile a whole number of units (Slice #37.27)", () => {
  it("n units are n units and the gaps between them, so a 3 and a 3 line up with a 4 and a 2", () => {
    expect(UNIT_REM).toBe(9.25);
    expect(UNIT_GAP_REM).toBe(1);
    expect([1, 2, 3, 4, 5, 6].map(unitsRem)).toEqual([9.25, 19.5, 29.75, 40, 50.25, 60.5]);
    expect(unitsRem(3) + UNIT_GAP_REM + unitsRem(3)).toBe(unitsRem(6));
    expect(unitsRem(4) + UNIT_GAP_REM + unitsRem(2)).toBe(unitsRem(6));
    expect(unitsFor(unitsRem(3))).toBe(3);
    expect(unitsFor(unitsRem(3) + 0.01)).toBe(4);
  });

  it("a row holds 6 units beside the sidebar at 1366 px, 10 at 1920 and 14 at 2560", () => {
    // The sidebar is 14rem and the page's padding 1.5rem a side: what is left, in rem.
    const room = (px: number): number => px / 16 - 14 - 3;
    const fit = (px: number): number => Math.floor((room(px) + UNIT_GAP_REM) / (UNIT_REM + UNIT_GAP_REM));
    expect([1366, 1920, 2560].map(fit)).toEqual([6, 10, 14]);
  });

  it("each list tile's table fills its tile of whole units, to within half a rem", () => {
    const sum = (cols: readonly ColumnName[]): number => cols.reduce((n, c) => n + columnRem(c), 0);
    for (const k of ["associations", "properties", "documents"] as const) {
      const room = tileTableRem(NP_LIST_UNITS[k]);
      expect([k, sum(NP_LIST_COLUMNS[k]) <= room]).toEqual([k, true]);
      expect([k, room - sum(NP_LIST_COLUMNS[k]) < 0.5]).toEqual([k, true]);
    }
    // Persoane: the name, the relationship and the buttons — no „Tip".
    expect(NP_LIST_COLUMNS.associations).not.toContain("personType");
    expect(NP_LIST_UNITS).toEqual({ associations: 4, properties: 4, documents: 5, metadata: 5 });
  });

  it("the person's page gives every list tile its units and the compact tables, and META INFO its cells", () => {
    const page = code(read("src", "app", "natural-persons", "_components", "person-detail-tiles.tsx"));
    for (const k of ["associations", "properties", "documents", "metadata"]) {
      expect(page).toMatch(new RegExp(`<ListTile tile="${k}"[^>]*units=\\{NP_LIST_UNITS\\.${k}\\}`));
    }
    expect(page.match(/backBase="\/natural-persons" compact \/>/g) ?? []).toHaveLength(3);
    expect(page).toMatch(/compactCellRem=\{NP_META_CELL_REM\}/);
    // Two cells and the gap fill META INFO inside.
    expect(2 * NP_META_CELL_REM + META_CELL_GAP_REM).toBe(unitsInnerRem(NP_LIST_UNITS.metadata));
  });
});

describe("a growing field that holds one value", () => {
  it.each([
    ["Ion\nPopescu", "Ion Popescu"],
    ["Ion \r\n  Popescu", "Ion Popescu"],
    ["a\n\n\nb", "a b"],
    ["no break", "no break"],
    ["tab\tstays", "tab\tstays"],
  ])("%j becomes %j", (input, out) => {
    expect(oneLine(input)).toBe(out);
  });
});

describe("the measurement — read-only, and no real value leaves the database", () => {
  const sqls = [
    buildColumnSql([{ screen: "NP", field: "lastName", table: "natural_person", column: "last_name" }]),
    buildLookupSql([{ screen: "NP", field: "citizenshipId", table: "lookup_citizenship", column: "name" }]),
    buildTemplateSql(),
  ];

  it.each(sqls.map((s, i) => [i, s] as const))("statement %i is one SELECT and writes nothing", (_i, sql) => {
    expect(sql.trim()).toMatch(/^SELECT\b/);
    expect(sql.trim().replace(/;$/, "")).not.toContain(";");
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|CREATE|GRANT|COPY)\b/i);
  });

  it("the longest free-text value comes back masked: capitals H, small letters n, digits 0", () => {
    expect(sqls[0]).toContain(`'longestMasked', (SELECT ${maskSql("v")}`);
    expect(maskSql("v")).toBe(
      "regexp_replace(regexp_replace(regexp_replace(v, '[[:upper:]]', 'H', 'g'), '[[:lower:]]', 'n', 'g'), '[[:digit:]]', '0', 'g')",
    );
    expect(sqls[2]).toContain(maskSql("v"));
  });

  it("refuses anything but a plain identifier as a table or column", () => {
    expect(() => buildColumnSql([{ screen: "NP", field: "x", table: "person; drop table person", column: "a" }])).toThrow(/identifier/);
    expect(() => buildLookupSql([{ screen: "NP", field: "x", table: "t", column: "a b" }])).toThrow(/identifier/);
  });

  it("a masked value stays one table cell: breaks shown, pipes escaped, long ones cut with their length", () => {
    expect(cell("nnn\nHHH")).toBe("nnn ⏎ HHH");
    expect(cell("a|b")).toBe("a\\|b");
    expect(cell("n".repeat(100))).toBe(`${"n".repeat(80)}… (100)`);
    expect(cell(null)).toBe("—");
  });

  it("the table has one line per field, with every overflow count", () => {
    const lines = formatReport(
      { "NP.lastName": { n: 40, max: 21, p95: 12, over: { 4: 40, 8: 30, 17: 2, 27: 0, 37: 0, 52: 0 }, longestMasked: "HHHHH-HHHHHH" } },
      { "NP.citizenshipId": { n: 3, max: 8, longest: "Română" } },
      [],
    );
    expect(lines[0]).toBe(`| field | rows | longest | p95 | > ${OVER_AT.join(" | > ")} | longest, masked |`);
    expect(lines).toContain("| NP.lastName | 40 | 21 | 12 | 40 | 30 | 2 | 0 | 0 | 0 | HHHHH-HHHHHH |");
    expect(lines).toContain("| NP.citizenshipId | 3 | 8 | Română |");
  });
});

describe("the Document's page image and row (#37.15)", () => {
  it("the page panel is not narrower than the two-fifths it was in a 1920-pixel window", () => {
    // (1920 − 224 sidebar − 15 scrollbar − 48 padding) capped at 93rem = 1488 px,
    // less the tab frame's 36, split 3:2 with a 16 px gap: 2/5 × (1452 − 64) + 16 ≈ 571 px.
    expect(PAGES_PANEL_REM * 16).toBeGreaterThanOrEqual(576);
  });

  it("the row is whole panels and the page panel, never less than the page panel; the fields take the rest", () => {
    expect(String(documentRowStyle().width)).toBe("max(40rem, calc(round(down, 100% - 40rem, 33rem) + 40rem))");
    expect(String(fieldsBesidePagesStyle().width)).toBe("max(32rem, calc(100% - 41rem))");
    // What the snap gives, by the same arithmetic in rem.
    const row = (w: number): number => Math.max(PAGES_PANEL_REM, Math.floor((w - PAGES_PANEL_REM) / 33) * 33 + PAGES_PANEL_REM);
    const fields = (r: number): number => Math.max(PANEL_REM, r - 41);
    expect(row(99.8)).toBe(73); //   1920 px: one panel and the page image
    expect(fields(row(99.8))).toBe(32);
    expect(row(139.8)).toBe(139); // 2560 px: three panels and the page image
    expect(fields(row(139.8))).toBe(98);
    expect(row(65.2)).toBe(40); //   1366 px: the page image wraps under one panel
  });
});

describe("a document type's own fields are sized by rule (#37.15)", () => {
  it("by type: text grows at XL, a textarea at the panel's width with its breaks, a date or number is a fixed M", () => {
    expect(templateFieldWidth({ type: "text" })).toEqual({ step: "XL", kind: "grows" });
    expect(templateFieldWidth({ type: "textarea" })).toEqual({ step: "TILE", kind: "lines", rows: 1 });
    expect(templateFieldWidth({ type: "date" })).toEqual({ step: "M", kind: "fixed" });
    expect(templateFieldWidth({ type: "number" })).toMatchObject({ step: "M", kind: "fixed" });
  });

  it("under Certificate și referințe everything grows at the panel's width — except a dropdown", () => {
    for (const type of ["text", "date", "number", "textarea"] as const) {
      expect(templateFieldWidth({ type }, [], true)).toEqual({ step: "TILE", kind: "lines", rows: 1 });
    }
    expect(templateFieldWidth({ type: "select" }, ["Da", "Nu"], true).kind).toBe("select");
  });

  it("a dropdown is as wide as its longest option, from S up, and stops at XXL", () => {
    expect(templateFieldWidth({ type: "select" }, ["Da", "Nu"])).toEqual({ step: "S", kind: "select" });
    expect(selectStepFor(["— fără valoare —", "Da", "Nu"]).step).toBe("L");
    const long = "O opțiune foarte lungă, mult peste ce încape într-o casetă";
    expect(templateFieldWidth({ type: "select" }, [long])).toEqual({ step: "XXL", kind: "select", capped: true });
    // The chosen step shows every label whole, with the arrow and the padding.
    for (const labels of [["Da"], ["Neverificat"], ["Primăria Municipiului"], ["3 — Fără cadastru, completat ulterior"]]) {
      const { step, capped } = selectStepFor(labels);
      expect(capped).toBe(false);
      expect(textPx(labels[0]) + SELECT_CHROME_PX).toBeLessThanOrEqual(SCALE[step] * 16);
    }
  });

  it("a field's own `width` names the step; its kind still follows from its type", () => {
    expect(templateFieldWidth({ type: "text", width: "L" })).toEqual({ step: "L", kind: "grows" });
    expect(templateFieldWidth({ type: "select", width: "XS" }, ["Opțiune lungă"])).toEqual({ step: "XS", kind: "select" });
    expect(templateFieldWidth({ type: "date", width: "L" }).kind).toBe("fixed");
  });

  it("measures text in Arial: diacritics as their letter, an em dash wide, a capital wider than a small letter", () => {
    expect(textPx("ăîșț")).toBe(textPx("aist"));
    expect(textPx("—")).toBeGreaterThan(textPx("-") * 2);
    expect(textPx("H")).toBeGreaterThan(textPx("n"));
    expect(textPx("0000")).toBeCloseTo(4 * 7.784, 2);
  });

  it("every dropdown on every seeded form fits without the cap, its blank choice included", () => {
    const file = parseFormsFile(read(FORMS_FILE_REL));
    let selects = 0;
    for (const form of file.forms) {
      for (const f of parseTemplateFields(form.fields)) {
        if (f.type !== "select" || !f.options?.length) continue;
        selects++;
        const w = templateFieldWidth(f, ["— fără valoare —", ...f.options.map((o) => o.labelRo)]);
        expect([form.key, f.key, w.capped ?? false]).toEqual([form.key, f.key, false]);
      }
    }
    expect(selects).toBeGreaterThan(40);
  });

  it("no seeded form sets `width` — the rule sizes all of them", () => {
    const file = parseFormsFile(read(FORMS_FILE_REL));
    for (const form of file.forms) for (const f of form.fields as Record<string, unknown>[]) expect("width" in f).toBe(false);
  });
});

describe("a template field's optional `width` (#37.15)", () => {
  const stored = { key: "k", labelRo: "Etichetă", labelEn: "Label", type: "text", order: 0 };

  it("is read when it names a step, dropped when it does not, and absent when absent", () => {
    expect(parseTemplateFields([{ ...stored, width: "L" }])[0].width).toBe("L");
    expect(parseTemplateFields([{ ...stored, width: "huge" }])[0]).not.toHaveProperty("width");
    expect(parseTemplateFields([{ ...stored, width: 13 }])[0]).not.toHaveProperty("width");
    expect(parseTemplateFields([stored])[0]).not.toHaveProperty("width");
    expect(isStep("TILE")).toBe(true);
    expect(isStep("toString")).toBe(false);
  });

  it("survives both write doors, which would otherwise strip it", () => {
    expect(documentTemplateFieldSchema.parse({ ...stored, width: "XL" }).width).toBe("XL");
    expect(documentTemplateFieldSchema.safeParse({ ...stored, width: "huge" }).success).toBe(false);
    expect(documentTemplateFieldSchema.parse(stored).width).toBeUndefined();
  });

  it("is carried through a Form-editor save untouched, and not invented for a field without one", () => {
    const [withWidth, without] = parseTemplateFields([{ ...stored, width: "M" }, { ...stored, key: "j", order: 1 }]);
    expect(fieldFromEditorRow(rowFromStoredField(withWidth, 0), "k", 0).width).toBe("M");
    expect(fieldFromEditorRow(rowFromStoredField(without, 1), "j", 1)).not.toHaveProperty("width");
  });
});

describe("tables at fixed column widths (#37.16)", () => {
  const APP = (...p: string[]) => code(read("src", "app", ...p));
  const TABLES: [string, string][] = [
    ["Persoane fizice", APP("natural-persons", "list-view.tsx")],
    ["Persoane juridice", APP("judicial-persons", "list-view.tsx")],
    ["Acte", APP("documents", "list-view.tsx")],
    ["Proprietăți", APP("properties", "list-view.tsx")],
    ["Căutare globală", APP("(all-roles)", "admin", "global-search", "_components", "global-search-view.tsx")],
    ["a person's Asocieri", APP("natural-persons", "_components", "person-references-tab.tsx")],
    ["a person's Acte", APP("documents", "_components", "person-document-tab.tsx")],
    ["a person's Proprietăți", APP("properties", "_components", "person-properties-tab.tsx")],
    ["a document's Persoane", APP("documents", "_components", "document-persons-tab.tsx")],
    ["a document's Proprietăți", APP("documents", "_components", "document-properties-tab.tsx")],
    ["a document's Asocieri", APP("documents", "_components", "document-references-tab.tsx")],
    ["a property's Persoane", APP("properties", "_components", "property-persons-tab.tsx")],
    ["a property's Acte", APP("properties", "_components", "property-document-tab.tsx")],
    ["a property's Asocieri", APP("properties", "_components", "property-references-tab.tsx")],
  ];

  it.each(TABLES)("%s: a fixed table from COLUMN, as wide as its columns, every header marked", (_what, src) => {
    const table = region(src, "<table", "</table>");
    expect(table).toMatch(/^<table \{\.\.\.fixedTable\(/);
    expect(table).toContain("<FixedColumns columns={");
    expect(table).not.toMatch(STRETCH);
    expect(table).not.toMatch(/whitespace-nowrap/);
    const head = region(table, "<thead", "</thead>");
    const ths = head.match(/<th\b/g) ?? [];
    expect(ths.length).toBeGreaterThan(1);
    expect(head.match(/<th\b[^>]*\{\.\.\.columnHead\(/g) ?? []).toHaveLength(ths.length);
    // Its frame is as wide as the table, scrolling past the window.
    expect(src).toMatch(/TABLE_FRAME/);
  });

  it("no list page caps or centres the list", () => {
    for (const p of [["natural-persons"], ["judicial-persons"], ["documents"], ["properties"], ["(all-roles)", "admin", "global-search"]]) {
      expect(APP(...p, "page.tsx")).not.toMatch(/mx-auto|max-w-(5|6)xl/);
    }
  });

  it("A STORED COLUMN CHOICE SURVIVES: the „Câmpuri afișate” keys are the ones stored before this slice", () => {
    expect(APP("natural-persons", "list-view.tsx")).toContain('"ga40-col-person-v2"');
    expect(APP("properties", "list-view.tsx")).toContain('"ga40-col-property-v2"');
    expect(APP("documents", "list-view.tsx")).toContain('"ga40-col-document-v2"');
    // The property list's optional keys are still the stored ones, "nickname" and "tarlaSola" included.
    for (const key of ["nickname", "parcela", "tarlaSola", "cadastralNumber", "carteFunciara", "surfaceAreaMp", "calculatedAreaMp", "locality"]) {
      expect(APP("properties", "list-view.tsx")).toContain(`key: "${key}"`);
    }
  });

  it("a column is a step of the scale plus the cells' padding, and one name has one width", () => {
    expect(columnRem("code")).toBe(SCALE.S + CELL_PADDING_REM);
    expect(columnRem("documentTitle")).toBe(SCALE.XXL + CELL_PADDING_REM);
    expect(String(columnsStyle(["select", "code", "open"]).width)).toBe(`${columnRem("select") + columnRem("code") + columnRem("open")}rem`);
    for (const c of Object.values(COLUMN)) {
      const content = typeof c.content === "number" ? c.content : SCALE[c.content];
      expect(content).toBeLessThanOrEqual(SCALE.XXL);
    }
  });
});

describe("the measurement stays one SELECT past 50 columns (#37.16)", () => {
  it("splits more than 50 pairs across jsonb_build_object calls joined by ||", () => {
    const pairs = Array.from({ length: 120 }, (_, i) => `'k${i}', ${i}`);
    const sql = buildObjectSql(pairs);
    expect(sql.match(/jsonb_build_object\(/g) ?? []).toHaveLength(3);
    expect(sql.match(/\|\|/g) ?? []).toHaveLength(2);
    expect(buildObjectSql(pairs.slice(0, MAX_PAIRS))).toMatch(/^json_build_object\(/);
    expect(MAX_PAIRS * 2).toBeLessThanOrEqual(100);
  });
});

describe("EVERY OTHER SCREEN FOLLOWS THE SAME RULE (#37.22)", () => {
  const APP = (...p: string[]) => code(read("src", "app", ...p));
  /** The part of a source outside its dialogs: a dialog's card is fixed by design and stays. */
  const outsideDialogs = (src: string, from?: string) => (from ? src.slice(src.indexOf(from)) : src);

  const ASSOCIATE = [
    ["documents", "associate-party"], ["documents", "associate-person"], ["documents", "associate-property"], ["documents", "associate-reference"],
    ["natural-persons", "associate-document"], ["natural-persons", "associate-person"], ["natural-persons", "associate-property"],
    ["judicial-persons", "associate-document"], ["judicial-persons", "associate-person"], ["judicial-persons", "associate-property"],
    ["properties", "associate-document"], ["properties", "associate-person"], ["properties", "associate-reference"],
  ] as const;

  /** Every page of the slice: none caps or centres what it shows. */
  const PAGES: [string, string][] = [
    ["the home page", APP("page.tsx") + APP("_components", "dashboard-client.tsx")],
    ...ASSOCIATE.map(([e, r]): [string, string] => [`/${e}/[id]/${r}`, APP(e, "[id]", r, "page.tsx")]),
    ...(["settings", "value-lists", "groups", "stamps", "tags", "help-content", "calculation", "doc-type-engine"] as const).map(
      (r): [string, string] => [`/admin/${r}`, APP("admin", r, "page.tsx")],
    ),
    ["/admin/users", APP("admin", "users", "page.tsx")],
    ["/admin/groups/[id]", APP("admin", "groups", "[id]", "page.tsx")],
    ["/admin/stamps/[id]", APP("admin", "stamps", "[id]", "page.tsx")],
    ["/admin/calculation/history", APP("admin", "calculation", "history", "page.tsx")],
    ["/admin/calculation/history/[id]", APP("admin", "calculation", "history", "[id]", "page.tsx")],
    ["/account/change-password", APP("account", "change-password", "page.tsx")],
  ];

  it.each(PAGES)("%s sits left-aligned beside the sidebar: no mx-auto, no max-w cap", (_what, src) => {
    expect(src.match(/mx-auto|max-w-(xs|sm|md|lg|xl|[2-7]xl)\b/g) ?? []).toEqual([]);
  });

  /** Every view of the slice, outside its dialogs. */
  const VIEWS: [string, string][] = [
    ["the dashboard", APP("_components", "dashboard-client.tsx")],
    ...ASSOCIATE.map(([e, r]): [string, string] => [`/${e}/[id]/${r}`, APP(e, "[id]", r, `${r}-view.tsx`)]),
    ["Setări", APP("admin", "settings", "_components", "settings-view.tsx")],
    ["Liste de valori", APP("admin", "value-lists", "_components", "value-list-hub.tsx")],
    ["Utilizatori & Acces", APP("admin", "users", "users-access-client.tsx")],
    ["Grupuri", APP("admin", "groups", "_components", "groups-list-view.tsx")],
    ["a group", APP("admin", "groups", "_components", "group-editor.tsx")],
    ["Ștampile", APP("admin", "stamps", "_components", "stamps-list-view.tsx")],
    ["a stamp", APP("admin", "stamps", "_components", "stamp-applicator.tsx")],
    ["Etichete", outsideDialogs(APP("admin", "tags", "_components", "tag-manager.tsx"), "export function TagManager(")],
    ["Texte de ajutor", APP("admin", "help-content", "_components", "help-content-hub.tsx")],
    ["Calcul", APP("admin", "calculation", "_components", "calculation-view.tsx")],
    ["Calcul — the map", APP("admin", "calculation", "_components", "preview-map.tsx")],
    ["Istoricul calculelor", APP("admin", "calculation", "history", "_components", "calculation-history-list.tsx")],
    ["one calculation", APP("admin", "calculation", "history", "[id]", "_components", "calculation-run-detail.tsx")],
    ["Motorul de tipuri", APP("admin", "doc-type-engine", "_components", "doc-type-engine.tsx")],
    ["Schimbă parola", APP("account", "change-password", "change-password-form.tsx")],
  ];

  it.each(VIEWS)("%s: every box names its step in the file, and no box or card takes the window's width", (_what, src) => {
    const unsized: string[] = [];
    for (const m of src.matchAll(/<(input|select|textarea)\b/g)) {
      const rest = src.slice(m.index);
      const end = rest.search(/\/>|\n\s*>|"\s*>|\}\s*>/);
      const tag = end < 0 ? rest.slice(0, 900) : rest.slice(0, end + 2);
      if (/type="(checkbox|radio|file|hidden)"/.test(tag)) continue;
      if (!tag.includes("screenBox(")) unsized.push(tag.split("\n").slice(0, 3).join(" ").slice(0, 120));
    }
    expect(unsized).toEqual([]);
    // No Tailwind width on a box, and no cap or centring outside a dialog's card.
    const outsideCards = src.split("\n").filter((l) => !/fixed inset-/.test(l)).join("\n");
    expect(outsideCards.match(/mx-auto|max-w-(xs|sm|md|lg|xl|[2-7]xl|\[[^\]]+\])/g) ?? []).toEqual([]);
    expect(outsideCards).not.toMatch(/grid-cols-\d|md:grid-cols|lg:grid-cols/);
  });

  it.each(VIEWS.filter(([, src]) => /<table\b/.test(src)))("%s: every table is #37.16's — fixed, from COLUMN, every header marked", (_what, src) => {
    for (const m of src.matchAll(/<table\b/g)) {
      const table = region(src.slice(m.index), "<table", "</table>");
      expect(table).toMatch(/^<table \{\.\.\.fixedTable\(/);
      expect(table).toContain("<FixedColumns columns={");
      expect(table).not.toMatch(/\bw-full\b|whitespace-nowrap/);
      const head = region(table, "<thead", "</thead>");
      const ths = head.match(/<th\b/g) ?? [];
      expect(head.match(/<th\b[^>]*\{\.\.\.columnHead\(/g) ?? []).toHaveLength(ths.length);
    }
    expect(src).toMatch(/TABLE_FRAME/);
  });

  it("a view is a column as wide as its widest fixed piece, whose prose wraps inside it", () => {
    expect(SCREEN_COLUMN).toMatch(/\bw-fit\b/);
    expect(SCREEN_COLUMN).toMatch(/\bmax-w-full\b/);
    for (const child of ["p", "header", "[role=status]:not(.sr-only)", "[role=alert]:not(.sr-only)"]) {
      expect(SCREEN_COLUMN).toContain(`[&>${child}]:w-0`);
      expect(SCREEN_COLUMN).toContain(`[&>${child}]:min-w-full`);
    }
    for (const [what, src] of VIEWS.filter(([w]) => w.startsWith("/") || ["Grupuri", "a group", "Ștampile", "a stamp", "Utilizatori & Acces", "Texte de ajutor", "Calcul", "one calculation"].includes(w))) {
      expect([what, /\$\{SCREEN_COLUMN\}|\{SCREEN_COLUMN\}/.test(src)]).toEqual([what, true]);
    }
  });

  it("THE SCALE DID NOT GROW: every box on these screens takes a step that already existed", () => {
    expect(Object.keys(SCALE)).toEqual(["XS", "S", "M", "L", "XL", "XXL", "TILE"]);
    for (const w of Object.values(SCREEN)) expect(Object.keys(SCALE)).toContain(w.step);
    // Nothing wider than a panel's inside, as on the four detail screens.
    for (const w of Object.values(SCREEN)) expect(SCALE[w.step]).toBeLessThanOrEqual(PANEL_INNER_REM);
  });

  it("the import wizard is not on the list: it has its own rule file, and FU-269 says what it would need", () => {
    const register = read("docs", "claude", "FOLLOW-UP-REGISTER.md");
    expect(register).toMatch(/\| FU-269 \|[^\n]*import/i);
  });
});
