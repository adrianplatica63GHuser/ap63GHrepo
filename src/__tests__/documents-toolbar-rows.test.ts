/**
 * Slice #37.83 — the Documents list's toolbar in two rows. Since #38.18 the
 * first holds the search box, „Expiră curând", „Câmpuri afișate", and at its
 * end the group with „Adaugă act"; the second, „Tip document:", the green or
 * red sign, then „Câmp specific:" with its values select and its ⓘ. Read from
 * the source, as `document-status.test.ts` reads this file; the browser half
 * is TC-DOC-08 and TC-DOC-16.
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

describe("the Documents toolbar in two rows (Slice #37.83)", () => {
  const first = between('data-toolbar-row="first"', 'data-toolbar-row="second"');
  const second = between('data-toolbar-row="second"', "deleteError &&");

  it("the first row: search, „Expiră curând”, „Câmpuri afișate”, then the group at its end — no „Tip document” (#38.18)", () => {
    const order = ['type="search"', "icon={CalendarClock}", "<FieldChooser", 'className="ml-auto flex items-center gap-2"', 'href="/documents/new"'];
    const at = order.map((m) => first.indexOf(m));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((x, y) => x - y)).toEqual(at);
    expect(first).not.toMatch(/customFieldKey|custom-field-hint|<DocumentTypeFilterDropdown|<CustomFieldSign/);
  });

  // #38.18: „Tip document:" → the sign → „Câmp specific:" → its values select → the ⓘ (the HintBubble's trigger, after its children).
  it("the second row, left to right: „Tip document:”, the sign, „Câmp specific:”, its values select, the ⓘ", () => {
    const order = ["<DocumentTypeFilterDropdown", "<CustomFieldSign", "<HintBubble", 'aria-label={tFilter("customFieldLabel")}', 'aria-label={tFilter("customFieldValueLabel")}', "</HintBubble>"];
    const at = order.map((m) => second.indexOf(m));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((x, y) => x - y)).toEqual(at);
    expect(second).not.toMatch(/icon=\{CalendarClock\}|<FieldChooser|\/documents\/new/);
  });

  // #38.07/#38.18: the row is always drawn (the type filter is on it); the sign and the field once the types have loaded.
  it("the second row is always drawn; the sign and „Câmp specific” join it once the types have loaded", () => {
    expect(code).toMatch(/<div className="flex flex-wrap items-center gap-3" data-toolbar-row="second">\s*<DocumentTypeFilterDropdown/);
    expect(code).toMatch(/\/>\s*\{typeOptions\.length > 0 && \(\s*<>\s*<CustomFieldSign/);
    expect(second).toContain('id="custom-field-hint"');
    expect(second).toContain("setCustomFieldKey(");
    expect(second).toContain("setCustomFieldValue(");
  });

  it("the two rows are one toolbar column, the second under the first", () => {
    // Slice #37.84: the column is also the list's toolbar box, as wide as the table or its controls.
    expect(code).toMatch(/<div className=\{`flex flex-col gap-3 \$\{LIST_TOOLBAR\}`\} data-toolbar="" \{\.\.\.edge\.toolbar\}>\s*<div className="flex flex-wrap items-center gap-3" data-toolbar-row="first">/);
    expect(code.indexOf('data-toolbar-row="first"')).toBeLessThan(code.indexOf('data-toolbar-row="second"'));
  });
});
