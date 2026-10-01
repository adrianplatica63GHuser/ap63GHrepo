/**
 * Every row that opens a record is a real link.                (Slice #37.21)
 *
 * The open button of every association tile („Vizualizare") is an `<a href>`
 * to the record read-only, and every row — tile or list — opens the same
 * address in a new tab on Ctrl/⌘+click or a middle-click, while a plain click
 * and a double-click do what they did.
 */
import fs from "fs";
import path from "path";
import { openThroughGuard, personPath } from "@/lib/ui/row-link";

const ROOT = process.cwd();
const read = (...p: string[]): string => fs.readFileSync(path.join(ROOT, ...p), "utf8");

const TILES = [
  ["properties", "_components", "person-properties-tab.tsx"],
  ["documents", "_components", "person-document-tab.tsx"],
  ["natural-persons", "_components", "person-references-tab.tsx"],
  ["documents", "_components", "document-persons-tab.tsx"],
  ["documents", "_components", "document-properties-tab.tsx"],
  ["documents", "_components", "document-references-tab.tsx"],
  ["properties", "_components", "property-persons-tab.tsx"],
  ["properties", "_components", "property-document-tab.tsx"],
  ["properties", "_components", "property-references-tab.tsx"],
];

const LISTS = [
  ["natural-persons", "list-view.tsx"],
  ["judicial-persons", "list-view.tsx"],
  ["properties", "list-view.tsx"],
  ["documents", "list-view.tsx"],
];

describe("an association row", () => {
  it.each(TILES.map((f) => [f.join("/"), f]))("%s: „Vizualizare\" is a link to the record read-only, and the row opens a new tab on request", (_n, f) => {
    const src = read("src", "app", ...(f as string[]));
    // Slice #37.42: „Vizualizare" is an ArrowRight IconButton in its link form —
    // its words the name and the tooltip. It was asserted as
    // `<Link href={`…?readonly=true`}>…{t("view")}</Link>`; the link it renders
    // is the same, so the assertion moved to the component that draws it.
    expect(src).toMatch(/<IconButton\s+href=\{`[^`]*\?readonly=true`\}[\s\S]{0,300}?icon=\{ArrowRight\}\s+label=\{t\("view"\)\}/);
    expect(src).not.toMatch(/<button[^>]*>\s*\{t\("view"\)\}/);
    expect(src).toMatch(/onClick=\{\(e\) => \{\s*if \(newTabIfAsked\(e, `[^`]*\?readonly=true`\)\) return;/);
    expect(src).toMatch(/onAuxClick=\{\(e\) => newTabIfAsked\(e, `[^`]*\?readonly=true`\)\}/);
    // A plain double-click still opens the record here.
    expect(src).toMatch(/onDoubleClick=/);
  });

  it.each(TILES.map((f) => [f.join("/"), f]))("%s: „Previzualizare\" opens the record beside this one (#37.24)", (_n, f) => {
    const src = read("src", "app", ...(f as string[]));
    expect(src).toMatch(/<PreviewButton target=\{/);
    // Slice #37.27: the header cell takes the column by name from a pair —
    // „openPreview" beside, or „openPreviewStacked" on the Natural Person's unit tile.
    expect(src).toMatch(/\bcolumnHead\("openPreview"\)|"openPreviewStacked"\] as const\)\s*: \(\[[^\]]*"openPreview"\] as const\)/);
    expect(src).toMatch(/\bcolumnHead\((?:"openPreview"|buttonsCol)\)/);
  });
});

describe("an association row leaves the screen through the unsaved-changes guard (FU-271, Slice #37.33)", () => {
  // TC-TILES-05 found it: with an unsaved edit on the screen, „Vizualizare" and
  // a row's double-click left WITHOUT the „Modificări nesalvate" question, and
  // the edit was lost. Only the sidebar, the recently-viewed panel and a
  // preview's „Deschide" went through `guardedNavigate`.
  it.each(TILES.map((f) => [f.join("/"), f]))("%s: „Vizualizare\" and the double-click ask first", (_n, f) => {
    const src = read("src", "app", ...(f as string[]));
    expect(src).toMatch(/const \{ guardedNavigate \} = useUnsavedChanges\(\);/);
    // The link: a plain click through the guard; Ctrl/⌘ and middle click left to the browser.
    // (#37.42: `<IconButton href=… onClick=…>`, which renders that same `<Link>`.)
    expect(src).toMatch(/<IconButton\s+href=\{`[^`]*\?readonly=true`\}\s+onClick=\{\(e\) => openThroughGuard\(e, `[^`]*\?readonly=true`, guardedNavigate\)\}/);
    // The double-click: through the guard, never straight to the router.
    expect(src).toMatch(/onDoubleClick=\{\(\) => guardedNavigate\(`[^`]*\?readonly=true`\)\}/);
    expect(src).not.toMatch(/router\.push\(`[^`]*\?readonly=true`\)/);
  });

  it("a plain click goes through the guard; Ctrl/⌘, Shift and the middle button are the browser's", () => {
    const click = (over: Partial<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; button: number }> = {}) => ({
      ctrlKey: false, metaKey: false, shiftKey: false, button: 0, ...over,
      preventDefault: jest.fn(), stopPropagation: jest.fn(),
    });
    const went: string[] = [];
    const plain = click();
    openThroughGuard(plain as never, "/documents/1?readonly=true", (h) => went.push(h));
    expect(went).toEqual(["/documents/1?readonly=true"]);
    expect(plain.preventDefault).toHaveBeenCalled();
    expect(plain.stopPropagation).toHaveBeenCalled(); // the row's own click (select) does not also run
    for (const over of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { button: 1 }]) {
      const e = click(over);
      openThroughGuard(e as never, "/documents/1?readonly=true", (h) => went.push(h));
      expect(e.preventDefault).not.toHaveBeenCalled();
      expect(e.stopPropagation).toHaveBeenCalled();
    }
    expect(went).toHaveLength(1);
  });
});

describe("a list row", () => {
  it.each(LISTS.map((f) => [f.join("/"), f]))("%s: opens a new tab on request, and the record here on a plain click", (_n, f) => {
    const src = read("src", "app", ...(f as string[]));
    expect(src).toMatch(/if \(newTabIfAsked\(e, `\/[a-z-]+\/\$\{item\.id\}`\)\) return;\s*router\.push\(`\/[a-z-]+\/\$\{item\.id\}`\);/);
    expect(src).toMatch(/onAuxClick=\{\(e\) => newTabIfAsked\(e, `\/[a-z-]+\/\$\{item\.id\}`\)\}/);
  });
});

describe('a list row\'s „Previzualizare" (#37.25)', () => {
  const KIND: Record<string, string> = {
    "natural-persons": "person",
    "judicial-persons": "company",
    properties: "property",
    documents: "document",
  };
  it.each(LISTS.map((f) => [f.join("/"), f]))("%s: opens the record in a tile beside the list", (_n, f) => {
    const src = read("src", "app", ...(f as string[]));
    const kind = KIND[(f as string[])[0]];
    expect(src).toMatch(new RegExp(`<PreviewButton target=\\{\\{ kind: "${kind}", id: item\\.id \\}\\} />`));
    expect(src).toMatch(/\bcolumnHead\("openPreview"\)/);
    expect(src).not.toMatch(/\bcolumnHead\("open"\)/);
    // The table and the previews share one wrapping row, inside the opener.
    expect(src).toMatch(/<ListPreviews>\s*<div className=\{`\$\{TABLE_FRAME\}/);
  });
});

describe("a person's address", () => {
  it("goes by the person's type", () => {
    expect(personPath("NATURAL", "a b")).toBe("/natural-persons/a%20b");
    expect(personPath("JUDICIAL", "x")).toBe("/judicial-persons/x");
  });
});
