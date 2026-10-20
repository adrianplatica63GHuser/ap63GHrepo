/**
 * Slice #37.83 — the Documents list's toolbar. Since #39.63 it is one row. Since #40.01 that row is the search box,
 * „Câmpuri afișate", „Expiră curând", then „Tip document:" with the green or red sign, „Câmp specific:", its values
 * select and its ⓘ — one group that never wraps apart — and at its end the group with „Adaugă act" (Adrian,
 * 2026-10-20: „move the connected fields Document Type, the icon, specific fields, and the information button to the
 * right of the Expiring Soon button"). The filter bar under it holds only the chips and „Șterge filtrele", and is a
 * row only while a filter is active (`filter-bar-shown.test.ts`). From #39.84 to #40.01 „Tip document:" and „Câmp
 * specific" opened the filter bar; #39.74 had „Câmp specific" on the toolbar, between the chooser and „Expiră
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

describe("the Documents toolbar and its filter group (Slices #37.83, #39.63, #39.74, #39.84, #40.01)", () => {
  const first = between('data-toolbar-row="first"', "<FilterBar");
  const controls = between('data-toolbar-controls=""', 'className="ml-auto flex shrink-0 items-center gap-2"');
  const group = between('data-filter-fixed=""', 'className="ml-auto flex shrink-0 items-center gap-2"');
  const field = group.slice(group.indexOf("{typeOptions.length > 0 &&"));
  const bar = code.slice(code.indexOf("<FilterBar"), code.indexOf("deleteError &&"));

  // #40.01: it read `["<ListSearchBox", "<FieldChooser", "icon={CalendarClock}", 'className="ml-auto flex items-center
  // gap-2"', 'href="/documents/new"']` and no „Tip document" or „Câmp specific" on the row, from #39.84.
  it("the first row: search, „Câmpuri afișate”, „Expiră curând”, „Tip document:”, „Câmp specific”, then the group at its end", () => {
    const order = [
      "<ListSearchBox",
      "<FieldChooser",
      "icon={CalendarClock}",
      'data-filter-fixed=""',
      "<DocumentTypeFilterDropdown",
      "<CustomFieldSign",
      'aria-label={tFilter("customFieldLabel")}',
      'className="ml-auto flex shrink-0 items-center gap-2"',
      'href="/documents/new"',
    ];
    const at = order.map((m) => first.indexOf(m));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((x, y) => x - y)).toEqual(at);
    // „Expiră curând" right after „Câmpuri afișate": nothing drawn between them.
    expect(first.slice(first.indexOf("<FieldChooser"), first.indexOf("icon={CalendarClock}")).match(/<[A-Z]\w+|<(div|span|select|input)\b/g)).toEqual(["<FieldChooser", "<IconButton"]);
    // And the group right after „Expiră curând".
    expect(first.slice(first.indexOf("icon={CalendarClock}"), first.indexOf('data-filter-fixed=""')).match(/<[A-Z]\w+|<(div|span|select|input)\b/g)).toEqual(["<div"]);
  });

  // Ask first 2: the controls wrap among themselves, inside their own box; the row itself does not wrap, so „Adaugă
  // act"'s group always ends the first line; the filter group never wraps apart.
  it("the controls wrap, the row does not, and the group never wraps apart", () => {
    expect(code).toContain('<div className="flex items-start gap-3" data-toolbar-row="first">');
    expect(code).toContain('<div className="flex min-w-0 flex-1 flex-wrap items-start gap-3" data-toolbar-controls="">');
    expect(code).toContain('<div className="flex shrink-0 flex-nowrap items-center gap-2" data-filter-fixed="">');
    expect(controls).toContain("<DocumentTypeFilterDropdown");
    expect(controls).toContain("<CustomFieldSign");
  });

  it("no second row any more (#39.63)", () => {
    expect(code).not.toContain('data-toolbar-row="second"');
  });

  it("„Expiră curând” is the toggle it was, its address key unchanged", () => {
    expect(first).toMatch(/<IconButton\s+icon=\{CalendarClock\}\s+label=\{tFilter\("expiringSoon"\)\}/);
    expect(first).toContain("aria-pressed={expiringSoon}");
    expect(code).toContain('expiring: expiringSoon ? "1" : ""');
  });

  // #40.01: the bar's `leading` slot is gone — it held „Tip document:" and „Câmp specific" from #39.84.
  it("the filter bar holds no control of Acte's own — only its chips", () => {
    expect(bar).not.toContain("leading=");
    expect(bar).not.toMatch(/<DocumentTypeFilterDropdown|<CustomFieldSign|icon=\{CalendarClock\}/);
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
    expect(code).toMatch(/<div className=\{`flex flex-col gap-3 \$\{LIST_TOOLBAR\}`\} data-toolbar="" \{\.\.\.edge\.toolbar\}>\s*<div className="flex items-start gap-3" data-toolbar-row="first">/);
  });
});
