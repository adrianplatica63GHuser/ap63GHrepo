/**
 * Slice #37.83 — the Documents list's toolbar. Since #39.63 it is one row. Since #39.84 that row is the search box,
 * „Câmpuri afișate", „Expiră curând" right after it, and at its end the group with „Adaugă act"; the filter bar under
 * it opens with „Tip document:", then the green or red sign with „Câmp specific:", its values select and its ⓘ — where
 * „+ Filtru" stood until #39.82 — then the chips (Adrian, 2026-10-18: „the icon with the stop sign or the check mark
 * … to replace it followed by the type specific field and information button; The Expiring Soon button will slide
 * left close to field picker button"). #39.74 had „Câmp specific" on the toolbar, between the chooser and „Expiră
 * curând". Read from the source, as `document-status.test.ts` reads this file; the browser half is TC-DOC-08,
 * TC-DOC-16 and TC-DOC-27.
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

describe("the Documents toolbar and the bar's fixed controls (Slices #37.83, #39.63, #39.74, #39.84)", () => {
  const first = between('data-toolbar-row="first"', "<FilterBar");
  const bar = code.slice(code.indexOf("leading={", code.indexOf("<FilterBar")), code.indexOf("deleteError &&"));
  // #39.84: „Câmp specific" on the bar, after „Tip document:". From #39.74 it was on the toolbar, between „Câmpuri
  // afișate" and „Expiră curând"; from #39.63 to #39.74 on the bar, as now.
  const field = bar.slice(bar.indexOf("{typeOptions.length > 0 &&"));

  // #39.84: it read `[… "<FieldChooser", "<CustomFieldSign", 'aria-label={tFilter("customFieldLabel")}',
  // "icon={CalendarClock}", …]` from #39.74; before that no „Câmp specific" or „Expiră curând" here.
  it("the first row: search, „Câmpuri afișate”, „Expiră curând”, then the group at its end — no „Tip document”, no „Câmp specific”", () => {
    // #39.85: the search is the shared box, as wide as „Adaugă act" — was `'type="search"'`.
    const order = ["<ListSearchBox", "<FieldChooser", "icon={CalendarClock}", 'className="ml-auto flex items-center gap-2"', 'href="/documents/new"'];
    const at = order.map((m) => first.indexOf(m));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((x, y) => x - y)).toEqual(at);
    expect(first).not.toContain("<DocumentTypeFilterDropdown");
    expect(first).not.toMatch(/<CustomFieldSign|customFieldLabel|data-custom-field-group/);
    // „Expiră curând" right after „Câmpuri afișate": nothing drawn between them.
    expect(first.slice(first.indexOf("<FieldChooser"), first.indexOf("icon={CalendarClock}")).match(/<[A-Z]\w+|<(div|span|select|input)\b/g)).toEqual(["<FieldChooser", "<IconButton"]);
  });

  it("no second row any more (#39.63)", () => {
    expect(code).not.toContain('data-toolbar-row="second"');
  });

  it("„Expiră curând” is the toggle it was, its address key unchanged", () => {
    expect(first).toMatch(/<IconButton\s+icon=\{CalendarClock\}\s+label=\{tFilter\("expiringSoon"\)\}/);
    expect(first).toContain("aria-pressed={expiringSoon}");
    expect(code).toContain('expiring: expiringSoon ? "1" : ""');
  });

  // #39.84: the bar's `leading` slot holds „Tip document:", then „Câmp specific" — where „+ Filtru" stood. #39.74 had
  // „Tip document:" alone there.
  it("the bar opens with „Tip document:”, then „Câmp specific” — no „Expiră curând”", () => {
    expect(bar).toMatch(/leading=\{\s*<>\s*<div className="flex flex-wrap items-center gap-2" data-filter-fixed="">\s*<DocumentTypeFilterDropdown[\s\S]*?\/>\s*\{typeOptions\.length > 0 && \(\s*<div className="flex items-center gap-2" data-custom-field-group="">\s*<CustomFieldSign/);
    expect(bar.indexOf("<DocumentTypeFilterDropdown")).toBeLessThan(bar.indexOf("<CustomFieldSign"));
    expect(bar).not.toMatch(/icon=\{CalendarClock\}/);
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
