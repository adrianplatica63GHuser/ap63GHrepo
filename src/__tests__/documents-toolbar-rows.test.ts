/**
 * Slice #37.83 — the Documents list's toolbar. Since #39.63 it is one row; since #39.74 that row is the search box,
 * „Câmpuri afișate", the green or red sign with „Câmp specific:", its values select and its ⓘ, „Expiră curând", and at
 * its end the group with „Adaugă act" (Adrian, 2026-10-17: „Move the Expiring Soon button and the filter control one
 * row up after the field chooser"). „Tip document:" alone is the shared filter bar's fixed chip, under it. Read from
 * the source, as `document-status.test.ts` reads this file; the browser half is TC-DOC-08, TC-DOC-16 and TC-DOC-27.
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

describe("the Documents toolbar and the bar's fixed chip (Slices #37.83, #39.63, #39.74)", () => {
  const first = between('data-toolbar-row="first"', "<FilterBar");
  // #39.74: „Câmp specific" — between „Câmpuri afișate" and „Expiră curând". It was the bar's `data-filter-fixed`
  // region, after „Tip document:", from #39.63 to #39.74.
  const field = between("<FieldChooser", "icon={CalendarClock}");

  // #39.74: it read `['type="search"', "<FieldChooser", 'className="ml-auto …"', …]` and no „Câmp specific" or
  // „Expiră curând" until then.
  it("the first row: search, „Câmpuri afișate”, „Câmp specific”, „Expiră curând”, then the group at its end — no „Tip document”", () => {
    const order = ['type="search"', "<FieldChooser", "<CustomFieldSign", 'aria-label={tFilter("customFieldLabel")}', "icon={CalendarClock}", 'className="ml-auto flex items-center gap-2"', 'href="/documents/new"'];
    const at = order.map((m) => first.indexOf(m));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((x, y) => x - y)).toEqual(at);
    expect(first).not.toContain("<DocumentTypeFilterDropdown");
  });

  it("no second row any more (#39.63)", () => {
    expect(code).not.toContain('data-toolbar-row="second"');
  });

  it("„Expiră curând” is the toggle it was, its address key unchanged", () => {
    expect(first).toMatch(/<IconButton\s+icon=\{CalendarClock\}\s+label=\{tFilter\("expiringSoon"\)\}/);
    expect(first).toContain("aria-pressed={expiringSoon}");
    expect(code).toContain('expiring: expiringSoon ? "1" : ""');
  });

  // #39.74: the bar's `leading` slot holds „Tip document:" alone.
  it("the bar opens with „Tip document:” alone", () => {
    const bar = code.slice(code.indexOf("leading={", code.indexOf("<FilterBar")), code.indexOf("deleteError &&"));
    expect(bar).toMatch(/leading=\{\s*<>\s*<div className="flex flex-wrap items-center gap-2" data-filter-fixed="">\s*<DocumentTypeFilterDropdown[\s\S]*?\/>\s*<\/div>\s*<\/>\s*\}/);
    expect(bar).not.toMatch(/<CustomFieldSign|icon=\{CalendarClock\}|customFieldKey/);
  });

  // #38.18: the sign → „Câmp specific:" → its values select → the ⓘ (the HintBubble's trigger, after its children).
  it("„Câmp specific”, left to right: the sign, „Câmp specific:”, its values select, the ⓘ — one item, so the row never parts them", () => {
    const order = ['data-custom-field-group=""', "<CustomFieldSign", "<HintBubble", 'aria-label={tFilter("customFieldLabel")}', 'aria-label={tFilter("customFieldValueLabel")}', "</HintBubble>"];
    const at = order.map((m) => field.indexOf(m));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((x, y) => x - y)).toEqual(at);
  });

  // #38.07/#38.18: the sign and the field once the types have loaded.
  it("the sign and „Câmp specific” are drawn once the types have loaded", () => {
    expect(field).toMatch(/\{typeOptions\.length > 0 && \(\s*<div className="flex items-center gap-2" data-custom-field-group="">\s*<CustomFieldSign/);
    expect(field).toContain('id="custom-field-hint"');
    expect(field).toContain("setCustomFieldKey(");
    expect(field).toContain("setCustomFieldValue(");
  });

  it("the toolbar is one column, the list's toolbar box", () => {
    // Slice #37.84: the column is also the list's toolbar box, as wide as the table or its controls.
    expect(code).toMatch(/<div className=\{`flex flex-col gap-3 \$\{LIST_TOOLBAR\}`\} data-toolbar="" \{\.\.\.edge\.toolbar\}>\s*<div className="flex flex-wrap items-start gap-3" data-toolbar-row="first">/);
  });
});
