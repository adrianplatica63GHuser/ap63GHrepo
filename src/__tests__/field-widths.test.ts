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
  OVER_AT,
  buildColumnSql,
  buildLookupSql,
  buildTemplateSql,
  cell,
  formatReport,
  maskSql,
} from "@/lib/ui/field-measure";
import {
  ADDRESS,
  HOLDS,
  JUDICIAL_PERSON,
  LABEL_GAP_REM,
  LABEL_REM,
  NATURAL_PERSON,
  PANEL_INNER_REM,
  PANEL_REM,
  SCALE,
  boxStyle,
  panelRowStyle,
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

/** The converted screens: every region that lays out fields at fixed widths. */
const CONVERTED: [string, string][] = [
  ["the Natural Person's panels", region(NP_FORM, "<fieldset disabled", "</fieldset>")],
  ["the Natural Person's Field", region(NP_FORM, "function Field(", "\nfunction ")],
  ["the Natural Person's SelectField", region(NP_FORM, "function SelectField(", "\nfunction ")],
  ["the Natural Person's ReadOnlyField", region(NP_FORM, "function ReadOnlyField(", "\nfunction ")],
  ["the address block, fixed", region(ADDRESS_BLOCK, "if (fixedWidths) {", "\n  return (")],
  ["the address block's Field, fixed", region(ADDRESS_BLOCK, "if (width) {", "\n  return (")],
  // Slice #37.13
  ["the Judicial Person's panels", region(JP_FORM, "<fieldset disabled", "</fieldset>")],
  ["the Judicial Person's Field", region(JP_FORM, "function Field(", "\nfunction ")],
  ["the Judicial Person's SelectField", region(JP_FORM, "function SelectField(", "\nfunction ")],
  ["the Judicial Person's ReadOnlyField", region(JP_FORM, "function ReadOnlyField(", "\nfunction ")],
  ["the Judicial Person's contact-person row", region(JP_FORM, "function ContactPersonRow(", "\nfunction ")],
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
    expect(JP_FORM).toMatch(/<form[\s\S]{0,300}?style=\{panelRowStyle\(\)\}/);
    for (const page of [["[id]", "page.tsx"], ["new", "page.tsx"]]) {
      expect(code(read("src", "app", "judicial-persons", ...page))).not.toMatch(/max-w-3xl|mx-auto/);
    }
  });

  it("the panels, the address block and the form itself take their widths from the file", () => {
    const panels = region(NP_FORM, "<fieldset disabled", "</fieldset>");
    expect(panels.match(/<section style=\{PANEL_STYLE\}/g) ?? []).toHaveLength(3);
    expect(panels.match(/<AddressBlock<FormValues>[\s\S]*?fixedWidths/g) ?? []).toHaveLength(2);
    expect(NP_FORM).toMatch(/<form[\s\S]{0,300}?style=\{panelRowStyle\(\)\}/);
    expect(ADDRESS_BLOCK).toMatch(/<section style=\{PANEL_STYLE\}/);
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

  it("TILE is the panel's whole inner width beside the label", () => {
    expect(PANEL_INNER_REM).toBe(30.5);
    expect(SCALE.TILE).toBe(PANEL_INNER_REM - LABEL_REM - LABEL_GAP_REM);
    expect(PANEL_REM).toBe(32);
  });

  it("no field is wider than a panel's inner width beside its label", () => {
    const all: FieldWidth[] = [...Object.values(NATURAL_PERSON), ...Object.values(ADDRESS), ...Object.values(JUDICIAL_PERSON)];
    for (const w of all) expect(LABEL_REM + LABEL_GAP_REM + SCALE[w.step]).toBeLessThanOrEqual(PANEL_INNER_REM);
  });

  it("the pairs the Natural Person form puts on one row fit a panel", () => {
    const pair = (a: FieldWidth, b: FieldWidth): number => 2 * (LABEL_REM + LABEL_GAP_REM) + SCALE[a.step] + SCALE[b.step] + 0.5;
    const NP = NATURAL_PERSON;
    for (const [a, b] of [
      [NP.cnp, NP.gender],
      [NP.dateOfBirth, NP.age],
      [NP.idDocumentNumber, NP.idCardNumber],
      [NP.idValidFrom, NP.idValidUntil],
      [NP.personalPhone1, NP.personalPhone2],
      [ADDRESS.postalCode, ADDRESS.locality],
      [ADDRESS.county, ADDRESS.country],
      [JUDICIAL_PERSON.cuiNumber, JUDICIAL_PERSON.tradeRegisterNumber],
    ] as const) {
      expect(pair(a, b)).toBeLessThanOrEqual(PANEL_INNER_REM);
    }
  });

  it("a FIXED field that names a sample holds it at about 7.8 px a digit and 9.3 px a capital", () => {
    const px = (s: string): number => [...s].reduce((n, c) => n + (/[0-9]/.test(c) ? 7.8 : /[A-ZĂÂÎȘȚH]/.test(c) ? 9.3 : /[a-zăâîșț]/.test(c) ? 6.5 : 4), 0);
    for (const w of [...Object.values(NATURAL_PERSON), ...Object.values(ADDRESS), ...Object.values(JUDICIAL_PERSON)] as FieldWidth[]) {
      if (w.sample) expect(px(w.sample) + 18).toBeLessThanOrEqual(SCALE[w.step] * 16);
    }
  });

  it("a box's width is an inline style in rem, and the form snaps to whole panels", () => {
    expect(boxStyle({ step: "M", kind: "fixed" })).toEqual({ width: "8.5rem" });
    expect(String(panelRowStyle().width)).toBe("max(32rem, calc(round(down, 100% + 1rem, 33rem) - 1rem))");
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
