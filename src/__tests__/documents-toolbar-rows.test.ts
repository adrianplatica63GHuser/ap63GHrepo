/**
 * Slice #37.83 — the Documents list's toolbar in two rows. The first: the
 * search box, „Tip document:", „Expiră curând", „Câmpuri afișate", and at its
 * end the group with „Adaugă act". The second: „Câmp specific:" alone — drawn
 * only when the types on screen have such a field, so an empty row never
 * pushes the list down. Read from the source, as `document-status.test.ts`
 * reads this file; the browser half is TC-DOC-08.
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

  it("the first row: search, „Tip document”, „Expiră curând”, „Câmpuri afișate”, then the group at its end", () => {
    const order = ['type="search"', "<DocumentTypeFilterDropdown", "icon={CalendarClock}", "<FieldChooser", 'className="ml-auto flex items-center gap-2"', 'href="/documents/new"'];
    const at = order.map((m) => first.indexOf(m));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((x, y) => x - y)).toEqual(at);
    expect(first).not.toMatch(/customFieldKey|custom-field-hint/);
  });

  // #38.07: drawn once the types have loaded, its control disabled unless exactly one type with a closed-list field is ticked.
  it("the second row holds „Câmp specific” alone, and is drawn once the types have loaded", () => {
    expect(code).toMatch(/\{typeOptions\.length > 0 && \(\s*<div className="flex flex-wrap items-center gap-3" data-toolbar-row="second">/);
    expect(second).toContain('id="custom-field-hint"');
    expect(second).toContain("setCustomFieldKey(");
    expect(second).toContain("setCustomFieldValue(");
    expect(second).not.toMatch(/<DocumentTypeFilterDropdown|icon=\{CalendarClock\}|<FieldChooser|\/documents\/new/);
  });

  it("the two rows are one toolbar column, the second under the first", () => {
    // Slice #37.84: the column is also the list's toolbar box, as wide as the table or its controls.
    expect(code).toMatch(/<div className=\{`flex flex-col gap-3 \$\{LIST_TOOLBAR\}`\} data-toolbar="" \{\.\.\.edge\.toolbar\}>\s*<div className="flex flex-wrap items-center gap-3" data-toolbar-row="first">/);
    expect(code.indexOf('data-toolbar-row="first"')).toBeLessThan(code.indexOf('data-toolbar-row="second"'));
  });
});
