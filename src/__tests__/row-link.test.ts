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
import { personPath } from "@/lib/ui/row-link";

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
    // 300, not 200: since #37.24 the link sits one level deeper, beside „Previzualizare".
    expect(src).toMatch(/<Link\s+href=\{`[^`]*\?readonly=true`\}[\s\S]{0,300}?\{t\("view"\)\}\s*<\/Link>/);
    expect(src).not.toMatch(/<button[^>]*>\s*\{t\("view"\)\}/);
    expect(src).toMatch(/onClick=\{\(e\) => \{\s*if \(newTabIfAsked\(e, `[^`]*\?readonly=true`\)\) return;/);
    expect(src).toMatch(/onAuxClick=\{\(e\) => newTabIfAsked\(e, `[^`]*\?readonly=true`\)\}/);
    // A plain double-click still opens the record here.
    expect(src).toMatch(/onDoubleClick=/);
  });

  it.each(TILES.map((f) => [f.join("/"), f]))("%s: „Previzualizare\" opens the record beside this one (#37.24)", (_n, f) => {
    const src = read("src", "app", ...(f as string[]));
    expect(src).toMatch(/<PreviewButton target=\{/);
    expect(src).toMatch(/\bcolumnHead\("openPreview"\)/);
  });
});

describe("a list row", () => {
  it.each(LISTS.map((f) => [f.join("/"), f]))("%s: opens a new tab on request, and the record here on a plain click", (_n, f) => {
    const src = read("src", "app", ...(f as string[]));
    expect(src).toMatch(/if \(newTabIfAsked\(e, `\/[a-z-]+\/\$\{item\.id\}`\)\) return;\s*router\.push\(`\/[a-z-]+\/\$\{item\.id\}`\);/);
    expect(src).toMatch(/onAuxClick=\{\(e\) => newTabIfAsked\(e, `\/[a-z-]+\/\$\{item\.id\}`\)\}/);
  });
});

describe("a person's address", () => {
  it("goes by the person's type", () => {
    expect(personPath("NATURAL", "a b")).toBe("/natural-persons/a%20b");
    expect(personPath("JUDICIAL", "x")).toBe("/judicial-persons/x");
  });
});
