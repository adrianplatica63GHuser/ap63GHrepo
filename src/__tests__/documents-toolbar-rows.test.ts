/**
 * Slice #37.83 — the Documents list's toolbar. Since #39.63 it is one row: the
 * search box, „Câmpuri afișate", and at its end the group with „Adaugă act".
 * „Tip document:", the green or red sign, „Câmp specific:" with its values
 * select and its ⓘ — the toolbar's second row from #38.18 to #39.63 — are the
 * shared filter bar's first, fixed chips, then „Expiră curând". Read from the
 * source, as `document-status.test.ts` reads this file; the browser half is
 * TC-DOC-08, TC-DOC-16 and TC-DOC-27.
 */
import fs from "node:fs";
import path from "node:path";

const SRC = fs.readFileSync(path.join(process.cwd(), "src", "app", "documents", "list-view.tsx"), "utf8");
const code = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\s*\}/g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/** The source between two markers. */
function between(a: string, b: string): string {
  const i = code.indexOf(a);
  const j = code.indexOf(b, i + a.length);
  if (i < 0 || j < 0) throw new Error(`no region ${a} … ${b}`);
  return code.slice(i, j);
}

describe("the Documents toolbar and the bar's fixed chips (Slices #37.83, #39.63)", () => {
  const first = between('data-toolbar-row="first"', "<FilterBar");
  // #39.63: these were `between('data-toolbar-row="second"', "<FilterBar")` — the second row — until the row moved.
  const fixed = between('data-filter-fixed=""', "icon={CalendarClock}");

  // Slice #39.63: „Expiră curând" left the first row (Ask first 2), and „Tip document" left the second for the bar.
  // It read `['type="search"', "icon={CalendarClock}", "<FieldChooser", …]` until then.
  it("the first row: search, „Câmpuri afișate”, then the group at its end — no „Tip document”, „Câmp specific” or „Expiră curând”", () => {
    const order = ['type="search"', "<FieldChooser", 'className="ml-auto flex items-center gap-2"', 'href="/documents/new"'];
    const at = order.map((m) => first.indexOf(m));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((x, y) => x - y)).toEqual(at);
    expect(first).not.toMatch(/customFieldKey|custom-field-hint|<DocumentTypeFilterDropdown|<CustomFieldSign|icon=\{CalendarClock\}/);
  });

  it("no second row any more (#39.63)", () => {
    expect(code).not.toContain('data-toolbar-row="second"');
  });

  // #39.63: the bar's `leading` slot holds the fixed chips, then „Expiră curând" — before any chip of the bar's own.
  it("the bar opens with the fixed chips, then „Expiră curând”, the toggle it was, its address key unchanged", () => {
    const bar = code.slice(code.indexOf("<FilterBar"), code.indexOf("deleteError &&"));
    expect(bar).toMatch(/leading=\{\s*<>\s*<div className="flex flex-wrap items-center gap-2" data-filter-fixed="">\s*<DocumentTypeFilterDropdown/);
    expect(bar.indexOf('data-filter-fixed=""')).toBeLessThan(bar.indexOf("icon={CalendarClock}"));
    expect(bar).toMatch(/<IconButton\s+icon=\{CalendarClock\}\s+label=\{tFilter\("expiringSoon"\)\}/);
    expect(bar).toContain("aria-pressed={expiringSoon}");
    expect(code).toContain('expiring: expiringSoon ? "1" : ""');
  });

  // #38.18: „Tip document:" → the sign → „Câmp specific:" → its values select → the ⓘ (the HintBubble's trigger, after its children).
  it("the fixed chips, left to right: „Tip document:”, the sign, „Câmp specific:”, its values select, the ⓘ", () => {
    const order = ["<DocumentTypeFilterDropdown", "<CustomFieldSign", "<HintBubble", 'aria-label={tFilter("customFieldLabel")}', 'aria-label={tFilter("customFieldValueLabel")}', "</HintBubble>"];
    const at = order.map((m) => fixed.indexOf(m));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((x, y) => x - y)).toEqual(at);
    expect(fixed).not.toMatch(/<FieldChooser|\/documents\/new/);
  });

  // #38.07/#38.18: always drawn (the type filter is there); the sign and the field once the types have loaded.
  it("the type chip is always drawn; the sign and „Câmp specific” join it once the types have loaded", () => {
    expect(code).toMatch(/\/>\s*\{typeOptions\.length > 0 && \(\s*<>\s*<CustomFieldSign/);
    expect(fixed).toContain('id="custom-field-hint"');
    expect(fixed).toContain("setCustomFieldKey(");
    expect(fixed).toContain("setCustomFieldValue(");
  });

  it("the toolbar is one column, the list's toolbar box", () => {
    // Slice #37.84: the column is also the list's toolbar box, as wide as the table or its controls.
    expect(code).toMatch(/<div className=\{`flex flex-col gap-3 \$\{LIST_TOOLBAR\}`\} data-toolbar="" \{\.\.\.edge\.toolbar\}>\s*<div className="flex flex-wrap items-center gap-3" data-toolbar-row="first">/);
  });
});
