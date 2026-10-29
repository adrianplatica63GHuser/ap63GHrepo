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

// Slice #37.40: the pure module — GrowingText itself now loads next-intl.
import { oneLine } from "@/components/forms/growing-text-rules";
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
  LIST_UNITS,
  PANEL_UNITS,
  PANEL_UNIT_INNER_REM,
  SCREEN_ROWS,
  MAP_BOX_STYLE,
  unitRowStyle,
  NP_LIST_UNITS,
  NP_PANEL_UNITS,
  UNIT_GAP_REM,
  UNIT_REM,
  GRAY_PANEL_MIN_UNITS,
  tileTableRem,
  unitsFor,
  unitsInnerRem,
  unitsRem,
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
  isStep,
  npRowStyle,
  panelRem,
  panelRowStyle,
  rowRem,
  selectNeedPx,
  selectStepFor,
  stackedBoxStyle,
  templateFieldTakesRow,
  templateFieldWidth,
  textPx,
  type FieldWidth,
  ID_CARD_DIALOG_CARD_STYLE,
  ID_CARD_DIALOG_FIELDS,
  ID_CARD_DIALOG_ROWS,
  ID_CARD_INSTITUTION,
  keepFields,
  PREVIEW_FIELDS,
  PREVIEW_INNER_REM,
  PREVIEW_LINES,
  PREVIEW_ROWS,
  PREVIEW_STYLE,
  PREVIEW_UNITS,
  PREVIEW_WIDTHS,
  boxesUnits,
  CALC_MAP_STYLE,
  columnsRem,
  fillColumnRem,
  screenPanel,
  screenRowStyle,
  tableUnits,
  PANEL_STYLE,
  oneLineRowUnits,
  ROW_CONTENT_REM,
  RELATED_SLOTS,
  RELATED_UNITS,
} from "@/lib/ui/field-widths";
import { LAYOUT_EXCEPTIONS } from "@/lib/ui/layout-exceptions";

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
const ID_CARD_DIALOG = code(read("src", "app", "admin", "import", "_components", "id-card-person-dialog.tsx"));

/** From `start` to the end of the source: a helper that is the file's last. */
function tail(src: string, start: string): string {
  const i = src.indexOf(start);
  if (i < 0) throw new Error(`no "${start}"`);
  return src.slice(i);
}

/** The converted screens: every region that lays out fields at fixed widths. */
const CONVERTED: [string, string][] = [
  ["the Natural Person's panels", region(NP_FORM, "<fieldset disabled", "</fieldset>")],
  ["the Natural Person's Field", region(NP_FORM, "function Field(", "\nfunction ")],
  ["the Natural Person's SelectField", region(NP_FORM, "function SelectField(", "\nfunction ")],
  ["the Natural Person's ReadOnlyField", region(NP_FORM, "function ReadOnlyField(", "\nfunction ")],
  // Slice #37.32: one shape, stacked, for every caller.
  ["the address block", region(ADDRESS_BLOCK, "export function AddressBlock", "\nfunction Field<")],
  ["the address block's Field", tail(ADDRESS_BLOCK, "function Field<")],
  // Slice #37.13
  ["the Judicial Person's panels", region(JP_FORM, "<fieldset disabled", "</fieldset>")],
  ["the Judicial Person's Field", region(JP_FORM, "function Field(", "\nfunction ")],
  ["the Judicial Person's SelectField", region(JP_FORM, "function SelectField(", "\nfunction ")],
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
  // Slice #37.32
  ["the ID-card dialog's panels", region(ID_CARD_DIALOG, "data-panel-row", "{unmappedEntries")],
  ["the ID-card dialog's Field", region(ID_CARD_DIALOG, "function Field(", "\nfunction ")],
  ["the ID-card dialog's SelectField", tail(ID_CARD_DIALOG, "function SelectField(")],
];

describe("THE WINDOW DECIDES HOW MANY PANELS FIT, NEVER HOW WIDE ANYTHING IS", () => {
  it.each(CONVERTED)("%s takes no width from flex-1, w-full, min-w-[…] or a grid column", (_what, src) => {
    expect(src.match(STRETCH) ?? []).toEqual([]);
  });

  it("every field on the Natural Person form names its width in the file", () => {
    const panels = region(NP_FORM, "<fieldset disabled", "</fieldset>");
    // #39.30: + „Decedat", a tick (`CheckField`), which names its width too.
    const uses = panels.match(/<(Field|SelectField|ReadOnlyField|CheckField)\b/g) ?? [];
    const widths = panels.match(/width=\{NP\.[A-Za-z0-9]+\}/g) ?? [];
    // Slice 40.85: the card's eight fields left the person (19 now; „Cetățenie" moved to „Identitate").
    expect(uses.length).toBeGreaterThan(15);
    expect(widths).toHaveLength(uses.length);
  });

  it("every field on the Judicial Person form names its width in the file, and its page has no centred cap", () => {
    const panels = region(JP_FORM, "<fieldset disabled", "</fieldset>");
    const uses = panels.match(/<(Field|SelectField|ReadOnlyField)\b/g) ?? [];
    expect(uses.length).toBe(8); // #37.57: the „ID" field left for the heading's corner; #38.31: + Telefon firmă, E-mail firmă
    expect(panels.match(/width=\{JP\.[A-Za-z0-9]+\}/g) ?? []).toHaveLength(uses.length);
    // Slice #37.29: each panel whole width units, from its widest row, and the addresses stacked.
    expect(panels.match(/<section style=\{PANEL_UNIT_STYLE\.judicialPerson\.(identity|contactPersons)\}/g) ?? []).toHaveLength(2);
    expect(panels).not.toMatch(/PANEL_STYLE\}/);
    expect(panels.match(/<AddressBlock<FormValues>/g) ?? []).toHaveLength(2);
    // Slice #37.18: as tiles, the page's tile row carries the snap and the form is `contents`.
    expect(JP_FORM).toMatch(/<form[\s\S]{0,600}?style=\{tiled \? undefined : unitRowStyle\("judicialPerson"\)\}/);
    expect(code(read("src", "app", "judicial-persons", "_components", "person-detail-tiles.tsx"))).toMatch(/style=\{unitRowStyle\("judicialPerson"\)\}/);
    for (const page of [["[id]", "page.tsx"], ["new", "page.tsx"]]) {
      expect(code(read("src", "app", "judicial-persons", ...page))).not.toMatch(/max-w-3xl|mx-auto/);
    }
  });

  it("every field on the Property form names its width in the file, the map has a fixed size, and no page caps it", () => {
    const panels = region(PROP_FORM, "data-panel-row", "{bigMap && createPortal(");
    const uses = panels.match(/<(Field|SelectField|ReadOnlyField)\b/g) ?? [];
    expect(uses.length).toBe(16); // #37.57: „Cod" left for the heading's corner
    expect(panels.match(/width=\{(PROP|ADDRESS)\.[A-Za-z0-9]+\}/g) ?? []).toHaveLength(uses.length);
    // Slice #37.30: each tile whole width units — the five panels from PANEL_UNITS.property.
    expect(panels.match(/style=\{PANEL_UNIT_STYLE\.property\.(cadastral|corners|address|map|streetView)\}/g) ?? []).toHaveLength(5);
    expect(panels).not.toMatch(/PANEL_STYLE\}/);
    expect(panels.match(/style=\{MAP_BOX_STYLE\}/g) ?? []).toHaveLength(2);
    // Slice #37.19: as tiles, the page's tile row carries the snap and the form is `contents`.
    expect(PROP_FORM).toMatch(/<form[\s\S]{0,600}?style=\{tiled \? undefined : unitRowStyle\("property"\)\}/);
    expect(code(read("src", "app", "properties", "_components", "property-detail-tiles.tsx"))).toMatch(/style=\{unitRowStyle\("property"\)\}/);
    for (const f of ["property-detail-tiles.tsx", "new-property-shell.tsx"]) {
      expect(code(read("src", "app", "properties", "_components", f))).not.toMatch(/max-w-\[1040px\]|mx-auto/);
    }
    // The corners table fills its fixed panel; its COLUMNS are what the file fixes.
    expect(region(CORNERS, "<table", "</colgroup>")).toMatch(/table-fixed[\s\S]*CORNER_COLUMNS\.seq[\s\S]*CORNER_COLUMNS\.originalIndex[\s\S]*CORNER_COLUMNS\.north[\s\S]*CORNER_COLUMNS\.east/);
    expect(Object.values(CORNER_COLUMNS).every((w) => /^\d+(\.\d+)?rem$/.test(w))).toBe(true);
  });

  it("every field on the Document names its width, a type's own fields take the rule's, the page image is a fixed panel, and no page caps it", () => {
    // #38.32: `const feesSection = ` no longer opens with a parenthesis — it is null without a fees group.
    const general = region(DOC_FORM, "const feesSection = ", "const formElement = (");
    const uses = general.match(/<(Field|SelectField)\b/g) ?? [];
    expect(uses.length).toBe(7);
    expect(general.match(/width=\{DOC\.[A-Za-z]+\}/g) ?? []).toHaveLength(uses.length);
    // Every panel is a named Section, and a Section is a fixed panel.
    const panels = region(DOC_FORM, "const renderCustomField = (", "const formElement = (");
    expect((panels.match(/<Section\b/g) ?? []).length).toBe((panels.match(/<Section\b[^>]*?\bpanel=/g) ?? []).length);
    // Slice #37.31: a panel is whole units (as tiles it also takes its tile's `order`).
    expect(region(DOC_FORM, "function Section(", "\ntype FieldProps")).toMatch(/style=\{order === undefined \? unitStyle\(units\) : \{ \.\.\.unitStyle\(units\), order \}\}[\s\S]*data-panel=\{panel\}/);
    // A type's own fields: the rule, never a width of their own in the form.
    const custom = region(DOC_FORM, "const customFieldWidth = (", "const feesSection = ");
    expect(custom.match(/templateFieldWidth\(/g) ?? []).toHaveLength(2);
    expect(custom).not.toMatch(/width=\{(DOC|SCALE)\./);
    // Slice #37.31: the unit row, with or without the page image.
    expect(DOC_FORM).toMatch(/style=\{tiled \? undefined : unitRowStyle\("document"\)\}/);
    expect(code(read("src", "app", "documents", "_components", "document-detail-tiles.tsx"))).toMatch(/style=\{unitRowStyle\("document"\)\}/);
    expect(DOC_FORM).toMatch(/style=\{PAGES_PANEL_STYLE\} data-panel="pages"/);
    expect(DOC_FORM).not.toMatch(/lg:grid-cols-5|lg:col-span-[23]/);
    expect(code(read("src", "app", "documents", "_components", "document-detail-tiles.tsx"))).not.toMatch(/max-w-\[93rem\]|mx-auto/);
    expect(code(read("src", "app", "documents", "new", "page.tsx"))).not.toMatch(/max-w-4xl|mx-auto/);
  });

  it("the panels, the address block and the form itself take their widths from the file", () => {
    const panels = region(NP_FORM, "<fieldset disabled", "</fieldset>");
    // Slice #37.26: each panel its own width, from its widest row.
    for (const p of ["identity", "idCard", "contact"]) expect(panels).toContain(`<section style={NP_PANEL_STYLE.${p}}`);
    expect(panels).not.toMatch(/PANEL_STYLE\}/);
    // Slice #37.27: the same-as-home checkbox is the home address panel's last line, not a panel of its own.
    expect(panels).not.toMatch(/data-panel="correspondence"/);
    // Slice 40.72: the footer is drawn while the tile is open (in the read view the address reads as text).
    expect(panels).toMatch(/prefix="addresses\.HOME"[\s\S]*?footer=\{reading\("addresses"\) \? undefined : \(\s*<Controller[\s\S]*?name="correspondenceSameAsHome"/);
    expect(ADDRESS_BLOCK).toMatch(/\{footer && <div/);
    expect(panels.match(/<AddressBlock<FormValues>/g) ?? []).toHaveLength(2);
    // Slice #37.17: as tiles, the page's tile row carries the width and the form is `contents`.
    expect(NP_FORM).toMatch(/<form[\s\S]{0,600}?style=\{tiled \? undefined : npRowStyle\(\)\}/);
    expect(code(read("src", "app", "natural-persons", "_components", "person-detail-tiles.tsx"))).toMatch(/style=\{npRowStyle\(\)\}/);
    // One shape since #37.32 (the persons and the ID-card dialog); the Property draws its own address rows.
    expect(ADDRESS_BLOCK).not.toMatch(/<section style=\{PANEL_STYLE\}/);
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

  it("Adrian's cadastral widths: Nr. parcelă M (his later note, #37.30); Nr. tarla / sola stays M (40.78 changed no size)", () => {
    // 01.Slice.Inputs\Slices.01--39\Slices.37.nn\Stacked.txt, 2026-09-29: „Nr. tarla / sola back to S, Nr. parcelă back to M".
    expect(PROPERTY.parcela.step).toBe("M");
    // „47/2" would fit S; „niciunul", the dropdown's own empty option, does not — which is why it was made M (rule 10,
    // retired by 40.78: a longer value wraps now). The width stays as it was.
    // (#37.55 took its dashes off: about 90 px where it was 107 — still past S's 80.)
    expect(textPx("47/2") + SELECT_CHROME_PX).toBeLessThanOrEqual(SCALE.S * 16);
    expect(textPx("niciunul") + SELECT_CHROME_PX).toBeGreaterThan(SCALE.S * 16);
    expect(PROPERTY.tarlaId.step).toBe("M");
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
      [DOCUMENT.nrDocument, DOCUMENT.dateDocument],
      [TEMPLATE_FIELD.number, TEMPLATE_FIELD.date],
    ] as [FieldWidth, FieldWidth, number?][]) {
      expect(pair(a, b, gap)).toBeLessThanOrEqual(PANEL_INNER_REM);
    }
  });

  // Slice 40.78 — Adrian, 2026-10-26: „please get rid of the notion of fixed field". One rule: a box is its step (or
  // its `rem`), and a value longer than it wraps downward.
  it("no field is FIXED any more: no `sample`, no `capped`, and the text that was fixed grows like a name", () => {
    const records = { NATURAL_PERSON, ADDRESS, JUDICIAL_PERSON, PROPERTY, DOCUMENT, TEMPLATE_FIELD, SCREEN } as Record<string, Record<string, FieldWidth>>;
    for (const [record, fields] of Object.entries(records)) {
      for (const [name, w] of Object.entries(fields)) {
        expect([record, name, w.kind]).not.toEqual([record, name, "fixed"]);
        expect([record, name, Object.keys(w).filter((k) => k === "sample" || k === "capped")]).toEqual([record, name, []]);
        expect(["input", "select", "grows", "lines"]).toContain(w.kind);
      }
    }
    // CNP, phones, document and card numbers, CUI, Nr. registru comerțului, Nr. CF, Nr. cadastru, Nr. parcelă,
    // Nr. document, and the address's postal code, county and country: the box a name is.
    for (const w of [
      NATURAL_PERSON.cnp, NATURAL_PERSON.idDocumentNumber, NATURAL_PERSON.idCardNumber,
      NATURAL_PERSON.personalPhone1, NATURAL_PERSON.personalPhone2, NATURAL_PERSON.workPhone,
      JUDICIAL_PERSON.cuiNumber, JUDICIAL_PERSON.tradeRegisterNumber, JUDICIAL_PERSON.phone,
      PROPERTY.parcela, PROPERTY.carteFunciara, PROPERTY.cadastralNumber, DOCUMENT.nrDocument,
      ADDRESS.postalCode, ADDRESS.county, ADDRESS.country,
    ] as FieldWidth[]) expect(w.kind).toBe("grows");
    // A date, a number and a tick stay the browser's own box, which cannot wrap.
    for (const w of [
      NATURAL_PERSON.dateOfBirth, NATURAL_PERSON.dateOfDeath, NATURAL_PERSON.idValidFrom, NATURAL_PERSON.idValidUntil,
      NATURAL_PERSON.isDeceased, PROPERTY.surfaceAreaMp, DOCUMENT.dateDocument, TEMPLATE_FIELD.date, TEMPLATE_FIELD.number,
    ] as FieldWidth[]) expect(w.kind).toBe("input");
    // No size changed with the rule (40.79 and 40.80 are the first new sizes).
    expect(boxRem(NATURAL_PERSON.cnp)).toBe(SCALE.M);
    expect(boxRem(NATURAL_PERSON.physicalPersonTypeId)).toBe(13.5);
    expect(PROPERTY.useCategoryId.step).toBe("M"); // 40.90: Adrian's mark, L → M
    expect(PROPERTY.propertyTypeId.step).toBe("M"); // 40.90
    expect(JUDICIAL_PERSON.judicialPersonTypeId.step).toBe("L"); // 40.90: Adrian's mark, XL → L
    expect(PROPERTY.tarlaId.step).toBe("M");
    // 40.88: Adrian's marks — Tip document and the issuer XXL → XL, on every type.
    expect(DOCUMENT.issuerPersonId.step).toBe("XL");
    expect(DOCUMENT.documentTypeId.step).toBe("XL");
  });

  it("every record screen's dropdown goes through the wrapping one, and none shows its value on hover instead", () => {
    const forms = [
      "src/app/natural-persons/_components/natural-person-form.tsx",
      "src/app/judicial-persons/_components/judicial-person-form.tsx",
      "src/app/properties/_components/property-form.tsx",
      "src/app/documents/_components/document-form.tsx",
      "src/app/admin/import/_components/id-card-person-dialog.tsx",
    ];
    for (const f of forms) {
      const src = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
      // A bare <select> on a record screen would be a box that cuts its value again.
      expect([f, /<select\b/.test(src)]).toEqual([f, false]);
      expect([f, /title=\{chosenLabel\}|capped/.test(src)]).toEqual([f, false]);
      expect([f, /<(AsyncSelect|WrappingSelect)\b/.test(src)]).toEqual([f, true]);
    }
    const async = read("src/components/forms/async-select.tsx");
    expect(async).toMatch(/<WrappingSelect\b/);
    // Only a short label's whole word („Masculin" behind „M", 40.79) — never the chosen label to read a cut value.
    expect(async).toMatch(/title=\{chosen\?\.title\}/);
  });

  it("a box's width is an inline style in rem, and the form snaps to whole panels", () => {
    expect(boxStyle({ step: "M", kind: "input" })).toEqual({ width: "8.5rem" });
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
    const re = /<div className=\{STACKED_ROW_CLASS\}>([\s\S]*?)\n {10}<\/div>|(?:name|field)="([a-zA-Z0-9.]+)"/g;
    for (const m of src.matchAll(re)) {
      if (m[1] !== undefined) rows.push([...m[1].matchAll(/(?:name|field)="([a-zA-Z0-9.]+)"/g)].map((n) => n[1]));
      else rows.push([m[2]]);
    }
    return rows;
  }

  it("every field is in exactly one row", () => {
    const listed = Object.values(NP_ROWS).flat(2);
    // Slice 40.79: „Relația cu firma" has a width (TILE) but no row — a group of ticks the form draws between the last
    // row and Note, at the panel's inner width.
    expect([...listed].sort()).toEqual(Object.keys(NP).filter((k) => k !== "relationships").sort());
    expect(new Set(listed).size).toBe(listed.length);
    expect([...ADDRESS_ROWS.flat()].sort()).toEqual(Object.keys(ADDRESS).sort());
  });

  it("the form draws exactly the rows the file names, panel by panel, in order", () => {
    const identity = region(panels, 'data-panel="identity"', 'data-panel="id-card"');
    const idCard = region(panels, 'data-panel="id-card"', 'data-panel="contact"');
    const contact = region(panels, 'data-panel="contact"', "<AddressBlock");
    expect(rowsOf(identity)).toEqual(NP_ROWS.identity.map((r) => [...r]));
    // Slice 40.85: „Acte de identitate" lists identity documents and draws none of NP_ROWS.idCard — the import's
    // card dialog still does (ID_CARD_DIALOG_ROWS, below), until 40.86.
    expect(rowsOf(idCard)).toEqual([]);
    expect(rowsOf(contact)).toEqual(NP_ROWS.contact.map((r) => [...r]));
    // The address block draws ADDRESS_ROWS itself when stacked.
    expect(ADDRESS_BLOCK).toMatch(/ADDRESS_ROWS\.map\(/);
  });

  it("Adrian's rows: Nume | Prenume, Poreclă | CNP, Data nașterii | Vârstă | Gen, Decedat | Data decesului (#39.30), Locul nașterii | Tip profesional, then Note", () => {
    expect(NP_ROWS.identity).toEqual([
      ["lastName", "firstName"],
      ["nickname", "cnp"],
      ["dateOfBirth", "age", "gender"],
      ["isDeceased", "dateOfDeath"],
      // Slice 40.85 (Ask first 1): Cetățenie after Locul nașterii, at its size; Tip profesional on its own row.
      ["placeOfBirth", "citizenshipId"],
      ["physicalPersonTypeId"],
      ["notes"],
    ]);
    expect(NP_ROWS.idCard).toEqual([
      ["idDocumentType", "idDocumentNumber", "idCardNumber"],
      ["idValidFrom", "idValidUntil"],
      ["idIssuingAuthority"],
      ["idMrzRaw"],
    ]);
    expect(NP_VALIDITY_REM).toBe(13.125); // 40.98: Carte de identitate is 4 units of 119 px (10.125 in 3 of 148)
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
    // identity 22 since 40.85: „Locul nașterii" | „Cetățenie" (13 + 0.5 + 8.5) — still three units (Nume | Prenume,
    // Data nașterii | Vârstă | Gen, … hold it there; FU-363 asks whether it should be two).
    // idCard 23.75 since 40.79 (Emisă de L, the MRZ L and not filling): the first row, Tip document | Nr. | Nr. card.
    // address 18.5 since 40.80 (Stradă XL): Cod poștal | Localitate — still three units.
    expect(rowsOf).toEqual({ identity: 22, idCard: 23.75, contact: 17.5, address: 18.5 });
    // 40.98 (the 119-px unit): Carte de identitate 4 — its first row, 23.75rem, is Adrian's and past the 363 px inside
    // 3; Contact 3, the gray panels' floor (was 2 of 148 px). Was { identity: 3, idCard: 3, contact: 2, address: 3 }.
    expect(NP_PANEL_UNITS).toEqual({ identity: 3, idCard: 4, contact: 3, address: 3 });
    for (const k of Object.keys(NP_PANEL_UNITS) as (keyof typeof NP_PANEL_UNITS)[]) {
      expect([k, NP_PANEL_INNER_REM[k] >= rowsOf[k]]).toEqual([k, true]);
      // one unit fewer would not hold it — or would be under the floor of 3
      expect([k, NP_PANEL_UNITS[k] === GRAY_PANEL_MIN_UNITS || unitsInnerRem(NP_PANEL_UNITS[k] - 1) < rowsOf[k]]).toEqual([k, true]);
    }
    expect(NP_PANEL_INNER_REM).toEqual({ identity: 22.6875, idCard: 31.125, contact: 22.6875, address: 22.6875 });
    for (const inner of Object.values(NP_PANEL_INNER_REM)) expect(panelRem(inner)).toBeLessThanOrEqual(unitsRem(4));
    expect(rowRem([NP.idValidFrom, NP.idValidUntil]) + STACK_GAP_REM + NP_VALIDITY_REM).toBe(NP_PANEL_INNER_REM.idCard);
    expect([NP.notes.fill, ADDRESS.notes.fill]).toEqual([true, true]);
    expect(panels).toMatch(/width=\{NP\.notes\}\s+fillRem=\{NP_PANEL_INNER_REM\.identity\}/);
    // Slice 40.79: the MRZ is L, no longer the panel's whole width.
    expect("fill" in NP.idMrzRaw).toBe(false);
    // Slice 40.85: not on the person's form at all — an identity document's (IDENTITY_DOCUMENT.mrz).
    expect(panels).not.toMatch(/NP\.idMrzRaw/);
  });

  // Slice 40.79 — Adrian, 2026-10-26, judged in Romanian: „Nume - M / Prenume - M / Poreclă - M / … / Gen (please use
  // "F" for Feminin, "M" for Masculin) - XS / … / Relația cu firma - TILE / Note - TILE" and „Emisă de - L / MRZ (text
  // brut) - L, 2 rows"; every other field on the two panels unchanged.
  it("Identitate and Act de identitate at Adrian's sizes (40.79)", () => {
    expect([NP.lastName.step, NP.firstName.step, NP.nickname.step]).toEqual(["M", "M", "M"]);
    expect(NP.gender).toEqual({ step: "XS", kind: "select" });
    expect(NP.relationships).toEqual({ step: "TILE", kind: "input", fill: true });
    expect(NP.notes.step).toBe("TILE");
    expect(NP.idIssuingAuthority).toEqual({ step: "L", kind: "grows" });
    expect(NP.idMrzRaw).toMatchObject({ step: "L", kind: "lines", rows: 2 });
    // Unchanged.
    expect([NP.cnp.step, NP.dateOfBirth.step, NP.age.step, NP.dateOfDeath.step, NP.placeOfBirth.step]).toEqual(["M", "M", "XS", "M", "L"]);
    expect([boxRem(NP.physicalPersonTypeId), boxRem(NP.idDocumentType), boxRem(NP.idDocumentNumber), boxRem(NP.idCardNumber)]).toEqual([13.5, 10, 6.375, 6.375]);
    expect([NP.idValidFrom.step, NP.idValidUntil.step, NP.citizenshipId.step]).toEqual(["M", "M", "M"]);
    // „M" — the wider letter — beside the arrow fits XS: the face's text room is the box less its padding, border, gap and arrow.
    expect(textPx("M") + 9 + 5 + 4 + 16).toBeLessThanOrEqual(SCALE.XS * 16);
    // The relationships' ticks span the panel's inner width on the form.
    expect(panels).toMatch(/style=\{stackedBoxStyle\(NP\.relationships, NP_PANEL_INNER_REM\.identity\)\}/);
    // Gen reads „M" / „F", the whole word its title, on the form, the ID-card dialog and the list.
    const form = code(read("src", "app", "natural-persons", "_components", "natural-person-form.tsx"));
    expect(form).toMatch(/label: t\("options\.genderShort\.MALE"\), title: t\("options\.gender\.MALE"\)/);
    expect(form).toMatch(/label: t\("options\.genderShort\.FEMALE"\), title: t\("options\.gender\.FEMALE"\)/);
    const dialog = code(read("src", "app", "admin", "import", "_components", "id-card-person-dialog.tsx"));
    expect(dialog).toMatch(/label: tNp\("options\.genderShort\.MALE"\), title: t\("genderMale"\)/);
    const list = code(read("src", "app", "natural-persons", "list-view.tsx"));
    expect(list).toMatch(/<GenderShort gender=\{item\.gender\} \/>/);
    for (const locale of ["ro-RO", "en-GB"]) {
      const messages = JSON.parse(read("messages", `${locale}.json`)) as { naturalPerson: { options: { genderShort: Record<string, string> } } };
      expect(messages.naturalPerson.options.genderShort).toEqual({ MALE: "M", FEMALE: "F" });
    }
  });

  // Slice 40.80 — Adrian, 2026-10-26: „Stradă, Nr., etaj, ap -XL / Cod poștal - S / Localitate - L / Județ / Sector - no
  // change / Țară - no change / Note - TILE".
  it("the address block at Adrian's sizes, one width on every screen (40.80)", () => {
    expect(ADDRESS.streetLine).toEqual({ step: "XL", kind: "grows" });
    expect([ADDRESS.postalCode.step, ADDRESS.locality.step, ADDRESS.county.step, ADDRESS.country.step, ADDRESS.notes.step]).toEqual(["S", "L", "M", "M", "TILE"]);
    expect(ADDRESS.notes.fill).toBe(true);
    // Every caller draws the shared widths: the block itself, and the Property's own address rows.
    expect(ADDRESS_BLOCK).toMatch(/ADDRESS_ROWS\.map\(/);
    expect(code(read("src", "app", "properties", "_components", "property-form.tsx"))).toMatch(/width=\{ADDRESS\.streetLine\}/);
    // No panel moved: each address panel is still the fewest units its widest row needs.
    expect(PANEL_UNITS.naturalPerson.address).toBe(3);
    expect(PANEL_UNITS.judicialPerson.address).toBe(3);
    expect(PANEL_UNITS.property.address).toBe(3);
  });

  it("no label beside a box is left on the form, and the row is as wide as its panels", () => {
    expect(NP_FORM).not.toMatch(/LABEL_STYLE/);
    expect(ADDRESS_BLOCK).not.toMatch(/LABEL_STYLE/);
    // #37.67: the widest tile is 4 units („Corelate"), where Proprietăți made it 5. 40.98: 4 units of 119 px.
    expect(String(npRowStyle().width)).toBe("min(var(--row-cap), max(32.75rem, calc(round(down, 100% + 1rem, 8.4375rem) - 1rem)))");
  });
});

describe("the width unit: every Natural Person tile a whole number of units (Slice #37.27)", () => {
  it("n units are n units and the gaps between them, so a 3 and a 3 line up with a 4 and a 2", () => {
    // 40.98 (Adrian: „from 148 to 119"): 7.4375rem; it was 9.25 (#37.27).
    expect(UNIT_REM).toBe(7.4375);
    expect(UNIT_GAP_REM).toBe(1);
    expect([1, 2, 3, 4, 5, 6].map(unitsRem)).toEqual([7.4375, 15.875, 24.3125, 32.75, 41.1875, 49.625]);
    expect([3, 4, 5].map((n) => unitsRem(n) * 16)).toEqual([389, 524, 659]);
    expect(unitsInnerRem(3) * 16).toBe(363); // „Each panel needs to fit 363 px inside"
    expect(unitsRem(3) + UNIT_GAP_REM + unitsRem(3)).toBe(unitsRem(6));
    expect(unitsRem(4) + UNIT_GAP_REM + unitsRem(2)).toBe(unitsRem(6));
    expect(unitsFor(unitsRem(3))).toBe(3);
    expect(unitsFor(unitsRem(3) + 0.01)).toBe(4);
  });

  it("a row holds 8 units beside the sidebar at 1366 px, 12 at 1920 and 17 at 2560 (40.98; 6, 10 and 14 of 148 px)", () => {
    // The sidebar is 14rem and the page's padding 1.5rem a side: what is left, in rem.
    const room = (px: number): number => px / 16 - 14 - 3;
    const fit = (px: number): number => Math.floor((room(px) + UNIT_GAP_REM) / (UNIT_REM + UNIT_GAP_REM));
    expect([1366, 1920, 2560].map(fit)).toEqual([8, 12, 17]);
  });

  it("a person's list tiles: „Corelate” at the Document's units, META INFO's two halves at theirs (#37.67)", () => {
    // #37.67: Persoane (4), Proprietăți (5) and Acte (5) are one tile, „Corelate" — no tables, so no column sets.
    expect(NP_LIST_UNITS).toEqual({ related: RELATED_UNITS, classification: 4, connections: 3 }); // #37.68: Importanță and Relevanță on one row; 40.98: 4 of 119 px
    expect(RELATED_UNITS).toBe(4);
  });

  it("the person's page gives every list tile its units and the compact tables, and META INFO's two halves theirs", () => {
    const page = code(read("src", "app", "natural-persons", "_components", "person-detail-tiles.tsx"));
    for (const k of ["related", "classification", "connections"]) {
      expect(page).toMatch(new RegExp(`<ListTile tile="${k}"[^>]*units=\\{NP_LIST_UNITS\\.${k}\\}`));
    }
    expect(page).toMatch(/<PersonRelatedTile personId=\{personId\} backBase="\/natural-persons"/);
    // Slice #37.63: no cells any more — each half is one column of items.
    expect(page).toMatch(/part="classification"/);
    expect(page).toMatch(/part="connections"/);
    expect(page).not.toMatch(/compactCellRem/);
  });
});

describe("the Judicial Person: labels above, rows by meaning, every tile on the unit (Slice #37.29)", () => {
  const JP = JUDICIAL_PERSON;
  const panels = region(JP_FORM, "<fieldset disabled", "</fieldset>");
  const identity = region(panels, 'data-panel="identity"', 'data-panel="contact-persons"');

  /** The same reading as the Natural Person's: a STACKED_ROW_CLASS div is a row, a field outside one a row alone. */
  function rowsOf(src: string): string[][] {
    const rows: string[][] = [];
    const re = /<div className=\{STACKED_ROW_CLASS\}>([\s\S]*?)\n {10}<\/div>|(?:name|field)="([a-zA-Z0-9.]+)"/g;
    for (const m of src.matchAll(re)) {
      if (m[1] !== undefined) rows.push([...m[1].matchAll(/(?:name|field)="([a-zA-Z0-9.]+)"/g)].map((n) => n[1]));
      else rows.push([m[2]]);
    }
    return rows;
  }

  it("draws exactly the rows the file names: Denumire — Poreclă | Tip — CUI | Nr. Reg. Com. — Note (#37.57: no ID)", () => {
    expect(SCREEN_ROWS.judicialPerson.identity).toEqual([
      ["name"],
      ["nickname", "judicialPersonTypeId"],
      ["cuiNumber", "tradeRegisterNumber"],
      ["notes"],
    ]);
    expect(rowsOf(identity)).toEqual(SCREEN_ROWS.judicialPerson.identity.map((r) => [...r]));
    // Denumire and Note fill the panel; the CUI hint stays with CUI (rule 15) — a bubble since #37.50.
    expect(identity).toMatch(/width=\{JP\.name\}\s+fillRem=\{PANEL_UNIT_INNER_REM\.judicialPerson\.identity\}/);
    expect(identity).toMatch(/width=\{JP\.notes\}\s+fillRem=\{PANEL_UNIT_INNER_REM\.judicialPerson\.identity\}/);
    expect(identity).toMatch(/name="cuiNumber"[\s\S]{0,200}bubble=\{cuiIsLocked/);
    expect(JP.name.fill && JP.notes.fill).toBe(true);
  });

  it("each panel is the fewest whole units that hold its widest row: Persoană juridică 3, Persoane de contact 3 (40.98: the floor), Adresă 3", () => {
    // #39.71: Poreclă M | Tip XL (the public-body types are long) — 26 rem; 40.90: Tip L, 22 rem — still three units.
    expect(rowRem([JP.nickname, JP.judicialPersonTypeId])).toBe(22);
    // #37.57: the system ID left this row for the heading's corner; Poreclă | Tip still makes it 3.
    expect(rowRem([JP.cuiNumber, JP.tradeRegisterNumber])).toBe(17.5);
    expect("code" in JP).toBe(false);
    expect(PANEL_UNITS.judicialPerson).toEqual({ identity: 3, contactPersons: 3, address: 3 });
    expect(PANEL_UNIT_INNER_REM.judicialPerson.identity).toBeGreaterThanOrEqual(22);
    expect(unitsInnerRem(2)).toBeLessThan(22);
    expect(unitsInnerRem(3)).toBeGreaterThanOrEqual(22); // 40.98: 22.6875rem inside 3 units of 119 px
    expect(PANEL_UNIT_INNER_REM.judicialPerson.contactPersons).toBeGreaterThanOrEqual(boxRem(JP.contactPerson));
    // The contact rows are the XL box under its label; the hint wraps inside the panel.
    expect(region(JP_FORM, "function ContactPersonRow(", "\nfunction ")).toMatch(/STACKED_FIELD_CLASS/);
  });

  it("no label is left beside a box, the checkbox is the registered address's last line, and the loose panel is gone", () => {
    expect(JP_FORM).not.toMatch(/LABEL_STYLE/);
    expect(panels).not.toMatch(/data-panel="correspondence"/);
    expect(panels).toMatch(/prefix="addresses\.HEADQUARTERS"[\s\S]*?footer=\{reading\("addresses"\) \? undefined : \(\s*<Controller[\s\S]*?name="correspondenceSameAsHq"/ /* 40.73: drawn while the tile is open */);
  });

  it("the company's list tiles are the Natural Person's, at the same units (rule 17), META INFO's two halves among them", () => {
    const page = code(read("src", "app", "judicial-persons", "_components", "person-detail-tiles.tsx"));
    for (const k of ["related", "classification", "connections"]) {
      expect(page).toMatch(new RegExp(`<ListTile tile="${k}"[^>]*units=\\{LIST_UNITS\\.judicialPerson\\.${k}\\}`));
    }
    expect(page).toMatch(/<PersonRelatedTile personId=\{personId\} backBase="\/judicial-persons"/);
    expect(page).not.toMatch(/compactCellRem/);
    expect(LIST_UNITS.judicialPerson).toEqual(LIST_UNITS.naturalPerson);
  });

  it("rule 19: one shape keyed by screen — the Natural Person's numbers did not move", () => {
    expect(NP_ROWS).toBe(SCREEN_ROWS.naturalPerson);
    expect(NP_PANEL_UNITS).toEqual({ identity: 3, idCard: 4, contact: 3, address: 3 }); // 40.98
    expect(PANEL_UNITS.naturalPerson).toBe(NP_PANEL_UNITS);
    expect(String(unitRowStyle("naturalPerson").width)).toBe(String(npRowStyle().width));
    expect(String(unitRowStyle("judicialPerson").width)).toBe("min(var(--row-cap), max(32.75rem, calc(round(down, 100% + 1rem, 8.4375rem) - 1rem)))"); // #37.67: 4 units; #40.69: never wider than a narrow window; 40.98: of 119 px
    // No JP_ twins of the unit shape.
    expect(code(read("src", "lib", "ui", "field-widths.ts"))).not.toMatch(/export const JP_(ROWS|PANEL|LIST|META)/);
  });

  it("rule 16: a row's boxes start on one line — each field a subgrid of the row's three tracks", () => {
    const stacked = code(read("src", "lib", "ui", "stacked.ts"));
    // #37.52 (rule 19): `auto` columns from the start, so the last field can take the room to its right.
    expect(stacked).toMatch(/STACKED_ROW_CLASS =\s*"grid grid-flow-col auto-cols-auto justify-start grid-rows-\[auto_auto_auto\]/);
    expect(stacked).toMatch(/STACKED_FIELD_CLASS = "row-span-3 grid grid-rows-subgrid/);
    expect(stacked).toMatch(/STACKED_LABEL_CLASS = "self-end/);
    for (const src of [NP_FORM, JP_FORM, ADDRESS_BLOCK]) expect(src).toMatch(/STACKED_ROW_CLASS/);
  });
});

describe("the Property: labels above, rows by meaning, every tile on the unit (Slice #37.30)", () => {
  const panels = region(PROP_FORM, "data-panel-row", "{bigMap && createPortal(");
  const cadastral = region(panels, 'data-panel="cadastral"', 'data-panel="corners"');
  const address = region(panels, 'data-panel="address"', 'data-panel="map"');

  /** A STACKED_ROW_CLASS div is a row (it holds no other div); a field outside one is a row alone. */
  function rowsOf(src: string): string[][] {
    const rows: string[][] = [];
    const re = /<div className=\{STACKED_ROW_CLASS\}>([\s\S]*?)<\/div>|(?:name|field)="([a-zA-Z0-9.]+)"/g;
    for (const m of src.matchAll(re)) {
      if (m[1] !== undefined) rows.push([...m[1].matchAll(/(?:name|field)="([a-zA-Z0-9.]+)"/g)].map((n) => n[1]));
      else rows.push([m[2]]);
    }
    return rows;
  }

  it("draws exactly the rows the file names, in both panels", () => {
    expect(rowsOf(cadastral)).toEqual(SCREEN_ROWS.property.cadastral.map((r) => [...r]));
    expect(rowsOf(address)).toEqual(SCREEN_ROWS.property.address.map((r) => [...r]));
    expect(cadastral).toMatch(/width=\{PROP\.notes\}\s+fillRem=\{PANEL_UNIT_INNER_REM\.property\.cadastral\}/);
    expect(address).toMatch(/width=\{ADDRESS\.notes\}\s+fillRem=\{PANEL_UNIT_INNER_REM\.property\.address\}/);
    // Rule 15: the bow-tie marker, the Street View button and the „Țară" default sit inside the panel, with no label indent.
    expect(PROP_FORM).not.toMatch(/LABEL_INDENT|LABEL_STYLE/);
  });

  // 40.98 (Adrian's red notes): Colțuri „needs 4", Hartă and Street View „should go to 4 to stay beside the 4-unit
  // cadastral panel". Was: Date cadastrale 3, Adresă 3, the three 3 (#37.77).
  it("each tile is whole units: Date cadastrale 4, Adresă 3, Puncte de contur, Hartă and Street View 4 (40.98)", () => {
    // #37.57: the system ID left the first row for the heading's corner; the panel stays 3.
    expect(rowRem([PROPERTY.tarlaId, PROPERTY.parcela])).toBe(17.5);
    expect("code" in PROPERTY).toBe(false);
    expect(SCREEN_ROWS.property.cadastral[0]).toEqual(["tarlaId", "parcela"]);
    expect(PANEL_UNITS.property).toEqual({ cadastral: 4, address: 3, corners: 4, map: 4, streetView: 4 });
    expect(unitsRem(PANEL_UNITS.property.cadastral) * 16).toBe(524);
    expect(parseFloat(String(MAP_BOX_STYLE.width))).toBe(unitsInnerRem(4));
    expect(MAP_BOX_STYLE.height).toBe("22rem");
  });

  it("the list tiles: „Corelate” the Document's 4 units (#37.66, rule 17), Clasificări 3 (#37.68) and Conexiuni 3 (#37.63)", () => {
    expect(LIST_UNITS.property).toEqual({ related: RELATED_UNITS, classification: 4, connections: 3 }); // #37.68; 40.98: Clasificări 4 of 119 px
    expect(LIST_UNITS.property.related).toBe(LIST_UNITS.document.related);
    const page = code(read("src", "app", "properties", "_components", "property-detail-tiles.tsx"));
    for (const k of ["related", "classification", "connections"]) {
      expect(page).toMatch(new RegExp(`<ListTile tile="${k}"[^>]*units=\\{LIST_UNITS\\.property\\.${k}\\}`));
    }
    expect(page).toContain("<PropertyRelatedTile propertyId={propertyId} label={labels.related} />");
    expect(page).not.toMatch(/compactCellRem/);
  });
});

describe("the Document: labels above, every tile on the unit, notebook tiles as one frame (Slice #37.31)", () => {
  // #38.32: „Date generale" is „Identificarea actului" and holds the issuer, number and date
  // (and the type's identification fields) under Tip document; they were the fees panel's.
  it("Identificarea actului is Tip document, Emitent, Nr. | Data, the type's identification fields, then Etichetă scurtă, Subiect, Note extinse — 3 units at least", () => {
    expect(SCREEN_ROWS.document.general).toEqual([["documentTypeId"], ["issuerPersonId"], ["nrDocument", "dateDocument"], ["title"], ["subject"], ["notes"]]);
    const general = region(DOC_FORM, "const generalSection = (", "const panelsOf = (");
    const order = [...general.matchAll(/name="([a-zA-Z]+)"|\{(issueFields)\}/g)].map((m) => m[1] ?? m[2]);
    expect(order).toEqual(["documentTypeId", "issueFields", "title", "subject", "notes"]);
    for (const f of ["title", "subject", "notes"]) {
      expect(general).toMatch(new RegExp(`width=\\{DOC\\.${f}\\}\\s+fillRem=\\{unitsInnerRem\\(generalUnits\\)\\}`));
    }
    const issue = region(DOC_FORM, "const issueFields = (", "const financialPacked");
    expect(issue).toMatch(/name="issuerPersonId"[\s\S]*<div className=\{STACKED_ROW_CLASS\}>[\s\S]*name="nrDocument"[\s\S]*name="dateDocument"[\s\S]*\{identificationPacked\.nodes\}/);
    expect(PANEL_UNITS.document.general).toBe(3);
  });

  it("Taxe și onorarii: only the fees group, packed, 3 units at least — and no panel without one (#38.32)", () => {
    const fees = region(DOC_FORM, "const feesSection = ", "const issueFields");
    expect(fees).not.toMatch(/name="(issuerPersonId|nrDocument|dateDocument)"/);
    expect(fees).toContain("{feesPacked.nodes}");
    expect(PANEL_UNITS.document.fees).toBe(3);
  });

  it("a type's own panels are packed (rule 18), and a notebook tile is one frame of them", () => {
    const panels = region(DOC_FORM, "const panelsOf = (", "const formElement = (");
    expect(panels).not.toMatch(/\.map\(\(f\) => renderCustomField\(/);
    expect(panels.match(/packCustomFields\(|financialPacked/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(DOC_FORM).toMatch(/frameBlock\(tileOfTabIndex\(tabs, i\), label, panelsOf\(i\)\)/);
    // Inside a frame a panel is a section of it: no border, `data-section`, its units' inner width.
    expect(region(DOC_FORM, "function Section(", "\ntype FieldProps")).toMatch(/if \(framed\)[\s\S]*data-section=\{panel\}[\s\S]*unitsInnerRem\(units\)/);
  });

  it("the list tiles: „Corelate” 4 units (#37.65), Clasificări 3 (#37.68) and Conexiuni 3 (#37.63)", () => {
    // #37.65: the fewest units that hold its widest row — the icon, the longest property name, all four slots (rule 17).
    expect(LIST_UNITS.document.related).toBe(oneLineRowUnits(RELATED_SLOTS, ROW_CONTENT_REM.property, true));
    expect(LIST_UNITS.document).toEqual({ related: 4, classification: 4, connections: 3 }); // #37.68; 40.98: Clasificări 4 of 119 px
    const page = code(read("src", "app", "documents", "_components", "document-detail-tiles.tsx"));
    for (const k of ["related", "classification", "connections"]) {
      expect(page).toMatch(new RegExp(`<ListTile tile="${k}"[^>]*units=\\{LIST_UNITS\\.document\\.${k}\\}`));
    }
    // #37.65: one tile for the three lists, named by its tile.
    expect(page).toContain("<DocumentRelatedTile documentId={documentId} label={labels.related}");
    // #38.33: a CVC's „Părți" is a list tile the size of „Legături".
    expect(page).toMatch(/<ListTile tile="parties"[^>]*units=\{LIST_UNITS\.document\.related\}/);
    expect(page).not.toMatch(/compactCellRem/);
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

  // 40.98 (Adrian: „5 units is the closest match"): 659 px; it was four units of 148 px, 640 (#37.31, rule 20).
  it("is exactly five width units, so it joins the unit row unchanged (40.98)", () => {
    expect(PAGES_PANEL_REM).toBe(unitsRem(5));
    expect(PAGES_PANEL_REM * 16).toBe(659);
    expect(PANEL_UNITS.document.pages).toBe(5);
    // At 1920 px (12 units) the default CVC's Identificarea actului 3, Pagini 5 and a 3-unit tile fit one row.
    expect(PANEL_UNITS.document.general + PANEL_UNITS.document.pages + 3).toBeLessThanOrEqual(12);
  });
});

describe("a document type's own fields are sized by rule (#37.15)", () => {
  it("by type: text grows at XL, a textarea at the panel's width with its breaks, a date or number is the browser's own M box", () => {
    expect(templateFieldWidth({ type: "text" })).toEqual({ step: "XL", kind: "grows" });
    expect(templateFieldWidth({ type: "textarea" })).toEqual({ step: "TILE", kind: "lines", rows: 1 });
    expect(templateFieldWidth({ type: "date" })).toEqual({ step: "M", kind: "input" });
    expect(templateFieldWidth({ type: "number" })).toMatchObject({ step: "M", kind: "input" });
  });

  it("under Certificate și referințe everything grows at the panel's width — except a dropdown", () => {
    for (const type of ["text", "date", "number", "textarea"] as const) {
      expect(templateFieldWidth({ type }, [], true)).toEqual({ step: "TILE", kind: "lines", rows: 1 });
    }
    expect(templateFieldWidth({ type: "select" }, ["Da", "Nu"], true).kind).toBe("select");
  });

  it("a dropdown starts as wide as its widest choice needs, in half rems, from S up, and stops at XXL, past which it wraps (#37.53, 40.78)", () => {
    // Never narrower than S.
    expect(templateFieldWidth({ type: "select" }, ["Da", "Nu"])).toEqual({ step: "S", kind: "select", rem: 5 });
    // „Nu e menționat" needs 142 px: 9rem, where the step rule drew L (13rem).
    expect(selectNeedPx(["Nu e menționat"])).toBeCloseTo(141.7, 0);
    expect(boxRem(templateFieldWidth({ type: "select" }, ["Nu e menționat"]))).toBe(9);
    // The blank „fără valoare" (#37.55: italic, no dashes — it was „— fără valoare —", 157 px in Arial, 150 in
    // Roboto since 40.70) needs 120 px, so beside „Nu e menționat" the dropdown is 9rem, where it was 10.
    expect(selectNeedPx(["— fără valoare —"])).toBeCloseTo(149.8, 0);
    expect(selectNeedPx(["fără valoare"])).toBeCloseTo(119.6, 0);
    expect(boxRem(templateFieldWidth({ type: "select" }, ["fără valoare", "Da", "Nu", "Nu e menționat"]))).toBe(9);
    expect(selectStepFor(["fără valoare", "Da", "Nu"]).step).toBe("M");
    const long = "O opțiune foarte lungă, mult peste ce încape într-o casetă";
    expect(templateFieldWidth({ type: "select" }, [long])).toEqual({ step: "XXL", kind: "select" });
    expect(selectStepFor([long]).wraps).toBe(true);
    expect(boxRem(templateFieldWidth({ type: "select" }, [long]))).toBe(SCALE.XXL);
    // The width shows every label whole, and is never more than half a rem past what it needs.
    for (const labels of [["Da"], ["Neverificat"], ["Primăria Municipiului"], ["3 — Fără cadastru, completat ulterior"], ["fără valoare"]]) {
      const w = boxRem(templateFieldWidth({ type: "select" }, labels)) * 16;
      expect(w).toBeGreaterThanOrEqual(selectNeedPx(labels));
      expect(w).toBeLessThanOrEqual(Math.max(SCALE.S * 16, selectNeedPx(labels) + 8));
    }
    // The chosen step shows every label whole, with the arrow and the padding.
    for (const labels of [["Da"], ["Neverificat"], ["Primăria Municipiului"], ["3 — Fără cadastru, completat ulterior"]]) {
      const { step, wraps } = selectStepFor(labels);
      expect(wraps).toBe(false);
      expect(textPx(labels[0]) + SELECT_CHROME_PX).toBeLessThanOrEqual(SCALE[step] * 16);
    }
  });

  it("a field's own `width` names the step; its kind still follows from its type", () => {
    expect(templateFieldWidth({ type: "text", width: "L" })).toEqual({ step: "L", kind: "grows" });
    expect(templateFieldWidth({ type: "select", width: "XS" }, ["Opțiune lungă"])).toEqual({ step: "XS", kind: "select" });
    expect(templateFieldWidth({ type: "date", width: "L" }).kind).toBe("input");
  });

  it("TILE fills the panel on a row of its own, whatever the field's type (40.88)", () => {
    expect(templateFieldWidth({ type: "text", width: "TILE" })).toEqual({ step: "TILE", kind: "grows", fill: true });
    expect(templateFieldWidth({ type: "number", width: "TILE" })).toEqual({ step: "TILE", kind: "input", fill: true });
    expect(templateFieldWidth({ type: "select", width: "TILE" }, ["Da"])).toEqual({ step: "TILE", kind: "select", fill: true });
    // A row of its own: TILE, a textarea, anything under Certificate și referințe — never another dropdown.
    expect(templateFieldTakesRow(templateFieldWidth({ type: "text", width: "TILE" }), { isSelect: false })).toBe(true);
    expect(templateFieldTakesRow(templateFieldWidth({ type: "select", width: "TILE" }, ["Da"]), { isSelect: true })).toBe(true);
    expect(templateFieldTakesRow(templateFieldWidth({ type: "textarea" }), { isSelect: false })).toBe(true);
    expect(templateFieldTakesRow(templateFieldWidth({ type: "text" }, [], true), { isSelect: false, forceLines: true })).toBe(true);
    expect(templateFieldTakesRow(templateFieldWidth({ type: "text" }), { isSelect: false })).toBe(false);
    expect(templateFieldTakesRow(templateFieldWidth({ type: "select", width: "M" }, ["Da"]), { isSelect: true })).toBe(false);
    expect(templateFieldTakesRow(templateFieldWidth({ type: "select" }, ["Da"], true), { isSelect: true, forceLines: true })).toBe(false);
    // A TILE box beside its label is the step; on a stacked panel it is the panel's inner width (`fill`).
    expect(stackedBoxStyle(templateFieldWidth({ type: "text", width: "TILE" }), unitsInnerRem(3))).toEqual({ width: `${unitsInnerRem(3)}rem` });
  });

  it("measures text in Roboto (40.70): diacritics as their letter, an em dash wide, a capital wider than a small letter", () => {
    expect(textPx("ăîșț")).toBe(textPx("aist"));
    expect(textPx("—")).toBeGreaterThan(textPx("-") * 2);
    expect(textPx("H")).toBeGreaterThan(textPx("n"));
    expect(textPx("0000")).toBeCloseTo(4 * 7.868, 2); // Roboto's digit, 562 thousandths of 14 px (Arial's was 556)
  });

  it("every dropdown on every seeded form fits on one line below XXL, its blank choice included", () => {
    const file = parseFormsFile(read(FORMS_FILE_REL));
    let selects = 0;
    for (const form of file.forms) {
      for (const f of parseTemplateFields(form.fields)) {
        if (f.type !== "select" || !f.options?.length) continue;
        selects++;
        const { wraps } = selectStepFor(["fără valoare", ...f.options.map((o) => o.labelRo)]);
        expect([form.key, f.key, wraps]).toEqual([form.key, f.key, false]);
      }
    }
    expect(selects).toBeGreaterThan(40);
  });

  // Was „no seeded form sets `width` — the rule sizes all of them" (#37.15). Since 40.88 Adrian sets sizes field by
  // field (migration_120), so the file carries `width` exactly where a migration put it, and nowhere else.
  it("a seeded form sets `width` only on the fields Adrian sized, each a step of the scale (40.88)", () => {
    const file = parseFormsFile(read(FORMS_FILE_REL));
    const sized: string[] = [];
    for (const form of file.forms) {
      for (const f of form.fields as Record<string, unknown>[]) {
        if (!("width" in f)) continue;
        expect([form.key, f.key, isStep(f.width)]).toEqual([form.key, f.key, true]);
        sized.push(`${form.key}.${String(f.key)}=${String(f.width)}`);
      }
    }
    expect(sized.sort()).toEqual(SIZED_FIELDS.slice().sort());
  });
});

/** Every `width` the forms file carries: migration_120 (40.88), migration_121 (40.89) and migration_122 (40.93). */
const SIZED_FIELDS = [
  ...["calitateExemplar=M", "exemplareEmise=TILE", "temeiLegalCompletare=TILE", "efectUrmarit=M", "pretNeschimbat=M",
    "liberDeSarcini=M", "faraServituti=M", "nearendat=M", "notificareAml=M", "consimtamantRadiere=M", "taxeLocaleLaZi=M",
    "nedezmembratContrar=M", "consimtamantDatePersonale=M", "celelalteClauzeNemodificate=M"].map((s) => `ACT_ADITIONAL.${s}`),
  ...["calitateExemplar=M", "exemplareEmise=TILE",
    // 40.93 — Temei autentificare TILE
    "temeiAutentificare=TILE",
    // 40.89 — Preț și plată; 40.93: Stare plată and Modalitate plată L
    "pretTotal=S", "monedaPret=S", "pretRealDeclarat=M", "starePlata=L", "modalitatePlata=L",
    // Carte funciară; 40.93: Documentație finalizată has no width again (its widest choice, 184 px)
    "categorieInterna=XL", "marcajCarteFunciara=L", "poateFiIntabulat=M", "consimtamantRadiere=M",
    "temeiExceptieCadastru=TILE", "renuntareCercetareOcpi=M", "obligatieNrCadastral=M", "termenFormalitati=TILE", "completareUlterioara=TILE",
    // Declarații și garanții
    "inCircuitCivil=M", "liberDeSarcini=M", "faraServituti=M", "neipotecat=M", "nepromisAltcuiva=M", "nearendat=M",
    "neaportatSocietate=M", "faraLitigii=M", "faraExpropriere=M", "faraMonumentIstoric=M", "nedezmembratContrar=M",
    "cumparatorCunoasteSituatia=M", "garantieEvictiune=M", "temeiLegalEvictiune=TILE", "garantieVicii=M", "declaratieArt292=M",
    "notificareAml=M", "consimtamantDatePersonale=M", "preemptiuneTerenAgricol=M", "preemptiunePadure=M",
    // Taxe și cheltuieli; 40.93: the four sums M
    "timbruJudiciar=M", "onorariuNotarial=M", "impozitTransfer=M", "taxaTimbruPublicitate=M",
    "cheltuieliPerfectare=M", "taxeLocalePlatiteDe=M", "taxeLocaleLaZi=M"].map((s) => `CONTRACT_VANZARE.${s}`),
];

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

describe("a template field's optional `newRow` (40.89)", () => {
  const stored = { key: "k", labelRo: "Etichetă", labelEn: "Label", type: "text", order: 0 };

  it("is read when true, dropped otherwise, and absent when absent", () => {
    expect(parseTemplateFields([{ ...stored, newRow: true }])[0].newRow).toBe(true);
    expect(parseTemplateFields([{ ...stored, newRow: "true" }])[0]).not.toHaveProperty("newRow");
    expect(parseTemplateFields([{ ...stored, newRow: false }])[0]).not.toHaveProperty("newRow");
    expect(parseTemplateFields([stored])[0]).not.toHaveProperty("newRow");
  });

  it("survives the write door, and a Form-editor save, untouched", () => {
    expect(documentTemplateFieldSchema.parse({ ...stored, newRow: true }).newRow).toBe(true);
    const [starts, plain] = parseTemplateFields([{ ...stored, newRow: true }, { ...stored, key: "j", order: 1 }]);
    expect(fieldFromEditorRow(rowFromStoredField(starts, 0), "k", 0).newRow).toBe(true);
    expect(fieldFromEditorRow(rowFromStoredField(plain, 1), "j", 1)).not.toHaveProperty("newRow");
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
    // #37.64–#37.67: a document's, a property's and a person's lists are „Corelate"'s one-line rows,
    // not tables (one-line-rows, related-tile, property-related-tile and person-related-tile tests).
  ];

  it.each(TABLES)("%s: a fixed table from COLUMN, as wide as its columns, every header marked", (_what, src) => {
    // Slice 40.12: #37.16's `fixedTable` and `FixedColumns` are one piece, `FixedTable`, which also keeps the widths the
    // user dragged (column-resize.tsx) — named per table in the browser's store.
    const table = region(src, "<FixedTable", "</FixedTable>");
    expect(table).toMatch(/^<FixedTable id="[a-z-/]+" columns=\{/);
    expect(table).not.toMatch(STRETCH);
    expect(table).not.toMatch(/whitespace-nowrap/);
    const head = region(table, "<thead", "</thead>");
    const ths = head.match(/<th\b/g) ?? [];
    // Slice 40.24: the four lists' only literal <th> is the row buttons' — every name is the band's shared cell, which
    // marks its own <th> with `columnHead` (list-head.tsx); so a header is a <th> or a ListHeadCell.
    const cells = head.match(/<ListHeadCell\b/g) ?? [];
    expect(ths.length + cells.length).toBeGreaterThan(1);
    expect(head.match(/<th\b[^>]*\{\.\.\.columnHead\(/g) ?? []).toHaveLength(ths.length);
    // Its frame is as wide as the table, scrolling past the window — on the four lists since #40.02 `LIST_FRAME`, which
    // scrolls down too.
    expect(src).toMatch(/TABLE_FRAME|LIST_FRAME/);
  });

  it("no list page caps or centres the list", () => {
    for (const p of [["natural-persons"], ["judicial-persons"], ["documents"], ["properties"], ["(all-roles)", "admin", "global-search"]]) {
      expect(APP(...p, "page.tsx")).not.toMatch(/mx-auto|max-w-(5|6)xl/);
    }
  });

  it("A STORED COLUMN CHOICE SURVIVES: the „Câmpuri afișate” keys are the ones stored before this slice", () => {
    // Slice #37.94 moved each key once, on purpose (list-columns.ts); the lists read them from there.
    expect(APP("natural-persons", "list-view.tsx")).toContain("LIST_COLUMN_CHOICE.person.storageKey");
    expect(APP("properties", "list-view.tsx")).toContain("LIST_COLUMN_CHOICE.property.storageKey");
    expect(APP("documents", "list-view.tsx")).toContain("LIST_COLUMN_CHOICE.document.storageKey");
    // The property list's optional keys are still the stored ones, "tarlaSola" included. Slice #37.72:
    // "nickname" is no longer offered — Poreclă is a fixed column — so a stored "nickname" is dropped
    // from the choice (property-list.test.tsx) while the column shows anyway.
    for (const key of ["parcela", "tarlaSola", "cadastralNumber", "carteFunciara", "surfaceAreaMp", "calculatedAreaMp", "locality"]) {
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

  it.each(VIEWS.filter(([, src]) => /<(table|FixedTable|AdminListTable)\b/.test(src)))("%s: every table is #37.16's — fixed, from COLUMN, every header marked", (_what, src) => {
    let fixed = 0;
    for (const m of src.matchAll(/<(table|FixedTable|AdminListTable)\b/g)) {
      const table = region(src.slice(m.index), `<${m[1]}`, `</${m[1]}>`);
      // Slice 40.62: the one exception — the dashboard's „Acte cu valabilitate limitată" is two columns, a fixed status
      // and the title, as wide as its tile and never wider (Adrian, chapter 10: „nothing off-screen"). A FixedTable is
      // as wide as its columns' rems, which is what pushed „Stare" off the tile; expiring-documents.test.tsx pins it.
      if (table.includes('data-expiring-table=""')) continue;
      fixed += 1;
      // Slice #39.89: „Grupuri" and „Ștampile" draw theirs through `AdminListTable` (src/components/list/admin-list.tsx)
      // — every column from COLUMN but the description, which takes what the frame leaves, so a scroll bar comes out of
      // it rather than pushing the buttons out sideways. Slice 40.12: a bare `<table>` is none of these — both pieces
      // draw the line between the columns and keep the widths the user dragged.
      expect(table).toMatch(/^<(FixedTable|AdminListTable) id=(\{`[a-z-/${}A-Za-z]+`\}|"[a-z-/]+") columns=\{/);
      expect(table).not.toMatch(/\bw-full\b|whitespace-nowrap/);
      const head = region(table, "<thead", "</thead>");
      const ths = head.match(/<th\b/g) ?? [];
      expect(head.match(/<th\b[^>]*\{\.\.\.columnHead\(/g) ?? []).toHaveLength(ths.length);
    }
    // 40.62: a view whose only table is the exception (the dashboard) has no frame to scroll in.
    if (fixed > 0) expect(src).toMatch(/TABLE_FRAME|ADMIN_LIST_FRAME|LIST_FRAME/); // #40.02: the four lists' `LIST_FRAME`
  });

  it("a view is a column as wide as its widest fixed piece, whose prose wraps inside it", () => {
    expect(SCREEN_COLUMN).toMatch(/\bw-fit\b/);
    expect(SCREEN_COLUMN).toMatch(/\bmax-w-full\b/);
    for (const child of ["p", "header", "[role=status]:not(.sr-only)", "[role=alert]:not(.sr-only)"]) {
      expect(SCREEN_COLUMN).toContain(`[&>${child}]:w-0`);
      expect(SCREEN_COLUMN).toContain(`[&>${child}]:min-w-full`);
    }
    for (const [what, src] of VIEWS.filter(([w]) => w.startsWith("/") || ["Grupuri", "a group", "Ștampile", "a stamp", "Utilizatori & Acces", "Texte de ajutor", "Calcul", "one calculation"].includes(w))) {
      // Slices #37.34 and #37.35: an „Asociază …" screen and every administration screen
      // is a row of unit tiles instead (`AssociateRow`, `UnitRow`).
      // #38.12: the group screen's row is `TileUnitRow` — `UnitRow`'s, packed and dragged.
      const column = /associate-/.test(what) ? /<AssociateRow units=/.test(src) : /<(UnitRow units|TileUnitRow screen)=/.test(src);
      expect([what, column]).toEqual([what, true]);
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

describe("the ID-card dialog: the Natural Person's rows, widths and panels (Slice #37.32)", () => {
  const panels = region(ID_CARD_DIALOG, "data-panel-row", "{unmappedEntries");

  it("keeps the Natural Person's rows, less what a card does not carry — derived, never a copy", () => {
    // Slice 40.85: Cetățenie moved to „Identitate" on the person, so here too.
    expect(ID_CARD_DIALOG_ROWS.identity).toEqual([["lastName", "firstName"], ["cnp"], ["dateOfBirth", "gender"], ["placeOfBirth", "citizenshipId"]]);
    expect(ID_CARD_DIALOG_ROWS.idCard).toEqual([
      ["idDocumentNumber", "idCardNumber"],
      ["idValidFrom", "idValidUntil"],
      ["idIssuingAuthority"],
    ]);
    expect(ID_CARD_DIALOG_ROWS.identity).toEqual(keepFields(NP_ROWS.identity, ID_CARD_DIALOG_FIELDS));
    expect(ID_CARD_DIALOG_ROWS.idCard).toEqual(keepFields(NP_ROWS.idCard, ID_CARD_DIALOG_FIELDS));
    expect(keepFields([["a", "b"], ["c"]], ["b"])).toEqual([["b"]]);
    const file = code(read("src", "lib", "ui", "field-widths.ts"));
    expect(file).toMatch(/identity: keepFields\(NP_ROWS\.identity, ID_CARD_DIALOG_FIELDS\)/);
    expect(file).toMatch(/idCard: keepFields\(NP_ROWS\.idCard, ID_CARD_DIALOG_FIELDS\)/);
    // Every field the dialog keeps is a row's; none of them is dropped on the way.
    expect([...Object.values(ID_CARD_DIALOG_ROWS).flat(2)].sort()).toEqual([...ID_CARD_DIALOG_FIELDS].sort());
  });

  it("draws them, each field at its Natural Person width and label, in the Natural Person's 3-unit panels", () => {
    for (const p of ["identity", "idCard"]) {
      expect(panels).toMatch(new RegExp(`<section style=\\{NP_PANEL_STYLE\\.${p}\\}`));
      expect(panels).toMatch(new RegExp(`ID_CARD_DIALOG_ROWS\\.${p}\\.map\\(`));
    }
    expect([NP_PANEL_UNITS.identity, NP_PANEL_UNITS.idCard, NP_PANEL_UNITS.address]).toEqual([3, 4, 3]); // 40.98: idCard 4
    const field = region(ID_CARD_DIALOG, "const reviewField = (", "if (fatalError) {");
    expect(field).toMatch(/const width = NATURAL_PERSON\[name\];/);
    expect(field).toMatch(/const label = tNp\(`fields\./);
    expect(field.match(/width=\{width\}/g) ?? []).toHaveLength(3);
    expect(panels).not.toMatch(/grid-cols-2/);
    // Instituție: its own row under Emisă de, the panel's whole width, its offer and its retry under it.
    expect(ID_CARD_INSTITUTION.fill).toBe(true);
    expect(panels).toMatch(/ID_CARD_DIALOG_ROWS\.idCard\.map[\s\S]*data-institution-row[\s\S]*style=\{INSTITUTION_BOX\}[\s\S]*offerInstitutionAdd &&[\s\S]*reloadInstitutions/);
    // The address block's one shape, the reading's ⚠ marks carried through.
    expect(panels).toMatch(/<AddressBlock<FormValues>[\s\S]*?warnFields=\{addressWarnFields\}/);
  });

  // 40.98: Identitate 3 and Carte de identitate 4 of 119 px, side by side (was two 3-unit panels of 148, 65rem).
  it("the card is wide only when the review shows, and holds its two panels side by side", () => {
    expect(unitsRem(NP_PANEL_UNITS.identity) + UNIT_GAP_REM + unitsRem(NP_PANEL_UNITS.idCard)).toBe(unitsRem(7));
    expect(ID_CARD_DIALOG_CARD_STYLE.maxWidth).toBe("62.5625rem");
    expect(ID_CARD_DIALOG).toMatch(/wide=\{showForm\}/);
    const card = code(read("src", "components", "persons", "person-resolution-dialog.tsx"));
    expect(card).toMatch(/wide = false/);
    expect(card).toMatch(/style=\{wide \? ID_CARD_DIALOG_CARD_STYLE : undefined\}/);
  });

  it("the address block's free-width branch is gone, and its layout exception with it", () => {
    expect(ADDRESS_BLOCK).not.toMatch(/w-\[5\.5rem\]|fixedWidths|grid-cols-2/);
    expect(LAYOUT_EXCEPTIONS.some((e) => e.file === "src/components/address/address-block.tsx")).toBe(false);
  });
});

describe("a Previzualizare tile: whole units, its screen's rows (Slice #37.33)", () => {
  // 40.98: re-pinned to the width they had on the 148-px unit — 3 → 4 (524 px), 4 → 5 (659, the page image's).
  it("is 4 units for a person, a company or a property and 5 — the page image's width — for a document", () => {
    expect(PREVIEW_UNITS).toEqual({ panel: 4, pages: 5 });
    expect(PREVIEW_STYLE.panel.width).toBe("32.75rem");
    expect(PREVIEW_STYLE.pages.width).toBe(`${PAGES_PANEL_REM}rem`);
  });

  it("lays #37.24's short set in its screen's rows (a person, a company) or Adrian's (a property, a document — #37.70)", () => {
    expect(PREVIEW_ROWS).toEqual({
      // Slice #37.60: the name is the heading; the person and the company draw PREVIEW_LINES.
      // #39.28: and their notes; the company loses „Tip" and „Nr. Reg. Com." — it read
      // person [["nickname", "cnp"], ["dateOfBirth"], ["placeOfBirth"]], company [["nickname", "judicialPersonTypeId"], ["cuiNumber", "tradeRegisterNumber"]].
      // #39.30: + „Data decesului" — it read person [["nickname", "cnp"], ["dateOfBirth"], ["placeOfBirth"], ["notes"]].
      person: [["nickname", "cnp"], ["dateOfBirth"], ["dateOfDeath"], ["placeOfBirth"], ["notes"]],
      company: [["nickname"], ["cuiNumber"], ["notes"]],
      // Slice #37.70: Adrian's rows for these two (preview-four-kinds.test.tsx).
      property: [["parcela", "tarlaId", "surfaceAreaMp"], ["nickname"], ["carteFunciara", "cadastralNumber"]],
      document: [["subject", "nrDocument", "dateDocument"]],
    });
    const file = code(read("src", "lib", "ui", "field-widths.ts"));
    expect(file).toMatch(/person: keepFields\(SCREEN_ROWS\.naturalPerson\.identity, PREVIEW_FIELDS\.person\)/);
    expect(file).toMatch(/company: keepFields\(SCREEN_ROWS\.judicialPerson\.identity, PREVIEW_FIELDS\.company\)/);
    // Slice #37.70: the property's and the document's rows are Adrian's, no longer their screen's.
    expect(file).not.toMatch(/property: keepFields\(/);
    expect(file).not.toMatch(/document: keepFields\(/);
    // Every field of the short set is on a row, and has its screen's width — a property's and a document's, whose
    // previews draw rows. #39.28: a person's and a company's draw PREVIEW_LINES only (#37.60), and their phone and
    // e-mail are on no screen row under one name (personal 1, 2 or work), so for them every field is on a LINE.
    // It read the rows and widths check for all four kinds.
    for (const kind of ["property", "document"] as const) {
      expect([kind, [...PREVIEW_ROWS[kind].flat()].sort()]).toEqual([kind, [...PREVIEW_FIELDS[kind]].sort()]);
      for (const f of PREVIEW_FIELDS[kind]) expect([kind, f, Boolean(PREVIEW_WIDTHS[kind][f])]).toEqual([kind, f, true]);
    }
    for (const kind of ["person", "company"] as const) {
      expect([kind, [...PREVIEW_LINES[kind].flat()].sort()]).toEqual([kind, [...PREVIEW_FIELDS[kind]].sort()]);
    }
  });

  it("every row fits inside its tile", () => {
    for (const kind of Object.keys(PREVIEW_ROWS) as (keyof typeof PREVIEW_ROWS)[]) {
      const inner = PREVIEW_INNER_REM[kind === "document" ? "pages" : "panel"];
      for (const row of PREVIEW_ROWS[kind]) {
        expect([kind, row.join("|"), rowRem(row.map((f) => PREVIEW_WIDTHS[kind][f])) <= inner]).toEqual([kind, row.join("|"), true]);
      }
    }
  });

  it("the body takes its width from the unit and its rows from the screen; the 5.5rem label column is gone", () => {
    const body = code(read("src", "components", "tiles", "preview-tile-body.tsx"));
    expect(body).toMatch(/style=\{lines \? style : \{ \.\.\.PREVIEW_STYLE\[width\], \.\.\.style \}\}/);
    expect(body).not.toMatch(/PANEL_STYLE\b|PAGES_PANEL_STYLE|5\.5rem|<dl/);
    expect(body).toMatch(/className=\{STACKED_ROW_CLASS\}/);
    const tiles = code(read("src", "components", "tiles", "preview-tiles.tsx"));
    expect(tiles).toMatch(/PREVIEW_ROWS\[kind\]\.flatMap\(/);
    expect(tiles).toMatch(/width: PREVIEW_WIDTHS\[kind\]\[name\]/);
  });
});

describe("the thirteen „Asociază …” screens: Căutare, Rezultate and Asociere on the unit (Slice #37.34)", () => {
  const VIEWS = [
    ["natural-persons", "associate-person"], ["natural-persons", "associate-property"], ["natural-persons", "associate-document"],
    ["judicial-persons", "associate-person"], ["judicial-persons", "associate-property"], ["judicial-persons", "associate-document"],
    ["documents", "associate-person"], ["documents", "associate-property"], ["documents", "associate-reference"], ["documents", "associate-party"],
    ["properties", "associate-person"], ["properties", "associate-document"], ["properties", "associate-reference"],
  ] as const;

  it.each(VIEWS.map(([e, s]) => [`${e}/${s}`, e, s]))("%s: the three tiles in reading order, each whole units, the table filling its tile", (_n, e, s) => {
    const src = code(read("src", "app", e as string, "[id]", s as string, `${s}-view.tsx`));
    expect(src).toMatch(/<AssociateRow units=\{\[SEARCH_UNITS, RESULTS_UNITS, ASSOCIATION_UNITS\]\}>/);
    const at = (tile: string, units: string) => {
      const m = src.match(new RegExp(`<AssociateTile tile="${tile}" units=\\{${units}\\}>`));
      expect([tile, Boolean(m)]).toEqual([tile, true]);
      return m!.index!;
    };
    const search = at("search", "SEARCH_UNITS");
    const results = at("results", "RESULTS_UNITS");
    const association = at("association", "ASSOCIATION_UNITS");
    expect(search < results && results < association).toBe(true);
    expect(src).toMatch(/const SEARCH_UNITS = boxesUnits\(\["search(Name", "searchCode|Text)"\]\);/);
    expect(src).toMatch(/const RESULTS_UNITS = tableUnits\(COLUMNS\);/);
    expect(src).toMatch(/const ASSOCIATION_UNITS = boxesUnits\(\[("role")?\]\);/);
    expect(src).toMatch(/<FixedTable id="[a-z-]+\/associate-[a-z]+" columns=\{COLUMNS\} fill=\{RESULTS_FILL\}>/);
    // Labels above: no 5.5rem label beside a box, no #37.22 column.
    expect(src).not.toMatch(/LABEL_STYLE|SCREEN_COLUMN/);
    expect(src).toMatch(/className=\{STACKED_FIELD_CLASS\} style=\{screenFieldStyle\("search(Name|Text)"\)\}/);
    if (/screenBox\("role"\)/.test(src)) expect(src).toMatch(/className=\{STACKED_FIELD_CLASS\} style=\{screenFieldStyle\("role"\)\}/);
    expect(src).toMatch(/useRecordCrumb\(/);
  });

  // 40.98: on the 119-px unit — Căutare 3, Rezultate 4/7/3, Asociere 3; at 1920 px a row holds 12.
  it("the tiles are the fewest units that hold them, and the three sit side by side at 1920 px (12 units)", () => {
    expect(boxesUnits(["searchName", "searchCode"])).toBe(3);
    expect(boxesUnits(["searchText"])).toBe(3);
    expect(boxesUnits(["role"])).toBe(3);
    expect(boxesUnits([])).toBe(2);
    // #37.57: no „Cod" column — a record's system ID is on its own screen only.
    const person = ["select", "personName", "personType"] as const;
    const doc = ["select", "documentType", "documentTitle"] as const;
    const prop = ["select", "propertyLabel"] as const;
    expect([tableUnits(person), tableUnits(doc), tableUnits(prop)]).toEqual([4, 7, 3]);
    expect(3 + tableUnits(person) + 3).toBeLessThanOrEqual(12);
    expect(3 + tableUnits(doc) + 3).toBeLessThanOrEqual(13); // the documents' search: one row at 2560 px, two at 1920
    // One unit fewer would not hold the table, and the fill column keeps at least its own width.
    for (const [cols, fill] of [[person, "personName"], [doc, "documentTitle"], [prop, "propertyLabel"]] as const) {
      const sum = cols.reduce((n, c) => n + columnRem(c), 0);
      expect(tileTableRem(tableUnits(cols) - 1)).toBeLessThan(sum);
      expect(fillColumnRem(cols, tableUnits(cols), fill)).toBeGreaterThanOrEqual(columnRem(fill));
      expect(fillColumnRem(cols, tableUnits(cols), fill) + sum - columnRem(fill)).toBeCloseTo(tileTableRem(tableUnits(cols)));
    }
  });

  it("screenPanel and the screen row learn the unit, by opt-in", () => {
    expect(screenPanel("x", 3).style).toEqual({ width: "24.3125rem" }); // 40.98: 3 units of 119 px
    expect(screenPanel("x").style).toEqual(PANEL_STYLE);
    expect(String(screenRowStyle(6).width)).toBe("min(var(--row-cap), max(49.625rem, calc(round(down, 100% + 1rem, 8.4375rem) - 1rem)))");
  });
});

describe("the administration screens on the unit (Slice #37.35)", () => {
  const APP = (...p: string[]) => code(read("src", "app", ...p));
  const ADMIN: [string, string][] = [
    ["Setări", APP("admin", "settings", "_components", "settings-view.tsx")],
    ["Liste de valori", APP("admin", "value-lists", "_components", "value-list-hub.tsx")],
    ["Utilizatori & Acces", APP("admin", "users", "users-access-client.tsx")],
    ["Grupuri", APP("admin", "groups", "_components", "groups-list-view.tsx")],
    ["a group", APP("admin", "groups", "_components", "group-editor.tsx")],
    ["Ștampile", APP("admin", "stamps", "_components", "stamps-list-view.tsx")],
    ["a stamp", APP("admin", "stamps", "_components", "stamp-applicator.tsx")],
    ["Etichete", APP("admin", "tags", "_components", "tag-manager.tsx")],
    ["Texte de ajutor", APP("admin", "help-content", "_components", "help-content-hub.tsx")],
    ["Calcul", APP("admin", "calculation", "_components", "calculation-view.tsx")],
    ["Istoricul calculelor", APP("admin", "calculation", "history", "_components", "calculation-history-list.tsx")],
    ["one calculation", APP("admin", "calculation", "history", "[id]", "_components", "calculation-run-detail.tsx")],
    ["Distilare Tipizate", APP("admin", "doc-type-engine", "_components", "doc-type-engine.tsx")],
    ["Schimbă parola", APP("account", "change-password", "page.tsx")],
    ["Grupuri — the page", APP("admin", "groups", "page.tsx")],
    ["Ștampile — the page", APP("admin", "stamps", "page.tsx")],
  ];

  it.each(ADMIN)("%s: every section a tile of whole units, no #37.22 width left", (what, src) => {
    for (const m of src.matchAll(/screenPanel\(([^()]*(?:\([^()]*\))?[^()]*)\)/g)) {
      // Two arguments, the second a number of units — never a lone name (32rem) or `true` (65rem).
      expect([what, m[1], /,\s*(?!true\b)[A-Za-z0-9_]+(\[[a-z]+\])?\s*$/.test(m[1])]).toEqual([what, m[1], true]);
    }
    expect(src).not.toMatch(/SCREEN_COLUMN|WIDE_COLUMN_STYLE|HELP_NAV_STYLE|CAPTION_STYLE|data-panel-row/);
    if (!/— the page$/.test(what)) expect([what, /<(UnitRow units|TileUnitRow screen)=/.test(src)]).toEqual([what, true]); // #38.12: TileUnitRow
  });

  // The lists whose table IS the tile; Calcul's owners and parcels sit in a 7-unit tile beside its map and figures.
  // #38.14: „Etichete" is the cloud alone — no table.
  const LISTS = ["Utilizatori & Acces", "Grupuri", "Ștampile", "Istoricul calculelor"];
  it.each(ADMIN.filter(([w]) => LISTS.includes(w)))("%s: its table fills its tile", (what, src) => {
    // Slice #39.89: „Grupuri" and „Ștampile" fill theirs as the frame's whole width (`AdminListTable`, admin-list.tsx).
    if (/<AdminListTable /.test(src)) {
      expect(src).toMatch(/<AdminListTable id="(groups|stamps)" columns=\{COLUMNS\} fill=\{LIST_FILL\}>/);
      return;
    }
    expect(src).toMatch(/<FixedTable /);
    for (const m of src.matchAll(/<FixedTable ([^>]*)>/g)) {
      expect([what, / fill=\{[A-Za-z_]+\}$/.test(m[1])]).toEqual([what, true]);
    }
  });

  it("Calcul's map is whole units, at its height (rule 20)", () => {
    expect(CALC_MAP_STYLE).toEqual({ width: `${unitsRem(7)}rem`, height: "26.25rem" }); // 40.98: 7 of 119 px, 929 (6 of 148, 968)
  });
});

describe("the home page as unit tiles, in the detail screens' frame (Slice #37.36)", () => {
  const src = code(read("src", "app", "_components", "dashboard-client.tsx"));

  it("each section is a ListTile of whole units, on the unit row, ticked with the detail screens' selector", () => {
    expect(src).toMatch(/<ListTile tile=\{tile\} panel=\{PANEL_NAME\[tile\]\} title=\{title\} units=\{HOME_UNITS\[tile\]\}>/);
    expect(src).toMatch(/recentCounts: 4,\s*staleMetadata: 4,\s*expiringDocuments: tableUnits\(EXPIRING_COLUMNS\),\s*recentActivity: 5,/); // 40.98: re-pinned
    expect(src).toMatch(/<UnitRow units=\{choice\.shown\.map\(\(k\) => HOME_UNITS\[k\]\)\}>/);
    expect(src).toMatch(/useTileChoice<HomeTile>\(HOME_TILE_REGISTRY\)/);
    expect(src).toMatch(/<TileSelector all=\{HOME_TILES\}/);
    // 40.62: a plain table as wide as its tile (it was `<FixedTable id="dashboard/expiring" … fill={EXPIRING_FILL}>`).
    expect(src).toMatch(/<table className="w-full table-fixed text-sm" data-expiring-table="">/);
    // The old card (rounded-xl, a grey header band) and #37.22's widths are gone.
    expect(src).not.toMatch(/rounded-xl|PANEL_REM|screenPanel\(|data-panel-row/);
    expect(3 * SCALE.M + 2).toBeLessThanOrEqual(unitsInnerRem(4)); // 40.98: the counts' tile is 4 units of 119 px
    // #37.57: no „Cod" — the title is the link; the tile was 8 units, the title filling it. 40.62: two columns, the
    // status and the title, so fewer units (`tableUnits(["documentType", "documentTitle", "date", "expiryStatus"])` was 8).
    expect(src).toContain('const EXPIRING_COLUMNS: readonly ColumnName[] = ["expiryStatus", "documentTitle"];');
    expect(tableUnits(["expiryStatus", "documentTitle"])).toBeLessThan(8);
  });

  it("with nothing stored all four show — the page as it was", () => {
    const tiles = code(read("src", "app", "_components", "home-tiles.ts"));
    expect(tiles).toMatch(/entity: "home"/);
    expect(tiles).toMatch(/defaults: HOME_TILES/);
  });
});

describe("the value-list editors and the Form editor on the unit (Slice #37.37)", () => {
  const DIR = ["src", "app", "admin", "value-lists", "_components"];
  const FILES: [string, string][] = [
    ["the value-list editor", code(read(...DIR, "value-list-modal.tsx"))],
    // Slice #38.36: „Roluri pe Document" is gone; a role's document types are a list inside the role's form.
    ["the Form editor", code(read(...DIR, "document-type-form-editor.tsx"))],
  ];

  it.each(FILES)("%s: no width from the window inside the card, and its card is whole units", (what, src) => {
    // The confirmations keep their max-w-sm / max-w-md cards; the editors' own cards do not cap.
    expect([what, src.match(/\bmin-w-48\b|(?<![\w-])w-full\b|(?<![\w-])w-(20|24|28|32|40|56)\b|max-w-\[240px\]|\btruncate\b|max-w-(2xl|3xl|5xl)/g) ?? []]).toEqual([what, []]);
    // #39.75: a tile's card fills its tile (`fill`), every other card is whole units.
    expect(src).toMatch(/style=\{(\{ \.\.\.)?(fill \? \{ width: "100%" \} : )?dialogCardStyle\(/);
    expect([what, /<table\b/.test(src)]).toEqual([what, false]); // Slice 40.12: every table is `FixedTable`
    for (const m of src.matchAll(/<FixedTable\b/g)) {
      const table = region(src.slice(m.index), "<FixedTable", "</thead>");
      const ths = table.match(/<th\b/g) ?? [];
      expect([what, (table.match(/columnHead\(/g) ?? []).length >= ths.length]).toEqual([what, true]);
    }
  });

  it("every value list shares one card width — the widest list's table, „Roluri Persoană”", () => {
    const src = code(read(...DIR, "value-list-modal.tsx"));
    // #39.75: through `valueListCardUnits`, one list's own card — what a tiled page gives each list.
    expect(src).toMatch(/export const VALUE_LIST_CARD_UNITS = Math\.max\(\s*\.\.\.VALID_LIST_KEYS\.map\(\(k\) => valueListCardUnits\(k\)\),\s*\);/);
    expect(src).toContain("return dialogUnits(columnsRem(listColumns(listKey)), CARD_PADDING_REM);");
    expect(src).toMatch(/style=\{fill \? \{ width: "100%" \} : dialogCardStyle\(VALUE_LIST_CARD_UNITS\)\}/);
    // The boxes of its form at their steps, labels above.
    expect(src).toMatch(/\{\.\.\.screenBox\(formBox\(f\)\)\}/);
    expect(src).toMatch(/\{\.\.\.screenBox\("valueDescription"\)\}/);
  });

  it("the Form editor's columns are COLUMN's, its labels and hint grow downward, the rows module untouched", () => {
    const src = code(read(...DIR, "document-type-form-editor.tsx"));
    expect(src).toMatch(/const FE_COLUMNS: readonly ColumnName\[\] = \["feOrder", "feLabel", "feLabel", "feType", "feGroup", "feTab", "feHint", "feActions"\];/);
    expect((src.match(/<GrowField\b/g) ?? []).length).toBe(3);
    expect((src.match(/style=\{columnBoxStyle\("fe[A-Z][a-z]+"\)\}/g) ?? []).length).toBe(8);
    expect(columnsRem(["feOrder", "feLabel", "feLabel", "feType", "feGroup", "feTab", "feHint", "feActions"])).toBe(98);
  });
});
