/**
 * Where the tiles stand when a screen opens.                   (Slice #37.56)
 *
 * A Document's page image stands in a column at the right; a Property's map,
 * its corners and — ticked — Street View stand one under another there; every
 * other tile flows in the left area. The arrangement is data on the registry
 * (`placement`), split by `splitTiles`; the screens draw it with `<TileAreas>`
 * and the forms place their right-hand tiles into its slots. The browser half
 * — the image's top level with the row's, the column's order on screen — is
 * TC-TILES-07.
 */
import fs from "node:fs";
import path from "node:path";

import { rightColumnIndex, splitTiles, type TileRegistry } from "@/lib/ui/tiles";
import { PROP_TILE_REGISTRY, type PropTile } from "@/app/properties/_components/property-tiles";
import { documentTileRegistry } from "@/app/documents/_components/document-tiles";

const ROOT = process.cwd();
const read = (...p: string[]): string => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const code = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("the split", () => {
  const P = PROP_TILE_REGISTRY;

  it("declares the Property's column: Hartă, then Puncte de contur, then Street View", () => {
    expect(P.placement?.right).toEqual(["map", "corners", "streetView"]);
    expect(rightColumnIndex<PropTile>("map", P)).toBe(0);
    expect(rightColumnIndex<PropTile>("streetView", P)).toBe(2);
    expect(rightColumnIndex<PropTile>("cadastral", P)).toBeUndefined();
  });

  it("opens a Property with the map and the corners at the right, the cadastral data and the address to their left", () => {
    expect(splitTiles(P.defaults, P)).toEqual({ left: ["cadastral", "address"], right: ["map", "corners"] });
  });

  it("puts Street View under the corners when it is ticked", () => {
    expect(splitTiles([...P.defaults, "streetView"], P).right).toEqual(["map", "corners", "streetView"]);
  });

  it("closes up when the map is unticked", () => {
    expect(splitTiles(["cadastral", "corners", "address", "streetView"], P).right).toEqual(["corners", "streetView"]);
  });

  it("draws no column when nothing in it is ticked, and the left area takes every tile, in registry order", () => {
    expect(splitTiles(["related", "address", "cadastral"], P)).toEqual({ left: ["cadastral", "address", "related"], right: [] }); // #37.66: „Persoane" is „Corelate"
  });

  it("keeps the left area in the registry's order whatever order the choice was stored in", () => {
    expect(splitTiles(["connections", "map", "cadastral", "related"], P)).toEqual({ left: ["cadastral", "related", "connections"], right: ["map"] }); // #37.63: META INFO's half
  });

  it("puts a Document's page image at the right, and only when the document has pages", () => {
    const withPages = documentTileRegistry({ typeKey: "CONTRACT_VANZARE", tabs: ["Preț și taxe"], succession: false, pages: true });
    expect(withPages.placement?.right).toEqual(["pages"]);
    expect(splitTiles(withPages.defaults, withPages)).toEqual({ left: ["general", "tab:Preț și taxe"], right: ["pages"] });
    expect(splitTiles(["general"], withPages).right).toEqual([]);
    const noPages = documentTileRegistry({ typeKey: null, tabs: [], succession: false, pages: false });
    expect(noPages.placement?.right).toEqual([]);
    expect(splitTiles(noPages.defaults, noPages).right).toEqual([]);
  });

  it("leaves a registry without a placement as one area", () => {
    const reg: TileRegistry<"a" | "b"> = { entity: "x", all: ["a", "b"], defaults: ["a"], form: [] };
    expect(splitTiles(["b", "a"], reg)).toEqual({ left: ["a", "b"], right: [] });
  });

  it("ignores a placed tile the registry does not have", () => {
    const reg: TileRegistry<string> = { entity: "x", all: ["a"], defaults: ["a"], form: [], placement: { right: ["gone"] } };
    expect(splitTiles(["a", "gone"], reg)).toEqual({ left: ["a"], right: [] });
  });
});

describe("the screens draw it", () => {
  it("both detail screens draw their row as two areas, the column from the registry's placement", () => {
    for (const [dir, file] of [["properties", "property-detail-tiles.tsx"], ["documents", "document-detail-tiles.tsx"]]) {
      const page = code(read("src", "app", dir, "_components", file));
      expect([file, /<TileAreas right=\{rightAll\} shownRight=\{shownRight\} slotRefs=\{slotRefs\}( entity=\{[\w.]+\})?>/.test(page)]).toEqual([file, true]);
      expect([file, /placement\?\.right/.test(page), /splitTiles\(choice\.shown,/.test(page), /right: column,/.test(page)]).toEqual([file, true, true, true]);
    }
  });

  it("the forms place exactly their right-hand tiles in the column", () => {
    const prop = code(read("src", "app", "properties", "_components", "property-form.tsx"));
    expect([...prop.matchAll(/placeTile\("(\w+)",/g)].map((m) => m[1])).toEqual(["corners", "map", "streetView"]);
    const doc = code(read("src", "app", "documents", "_components", "document-form.tsx"));
    expect([...doc.matchAll(/placeTile\("(\w+)",/g)].map((m) => m[1])).toEqual(["pages"]);
    // Nothing until the slot exists, so the map is never mounted twice.
    for (const f of [prop, doc]) expect(f).toMatch(/return slot \? createPortal\(node, slot\) : null;/);
  });

  it("the column's slots are in placement order and take no room of their own; the left area never narrower than its widest tile", () => {
    const areas = code(read("src", "components", "tiles", "tile-areas.tsx"));
    expect(areas).toMatch(/right\.map\(\(tile\) => \(\s*<div key=\{tile\} className="contents" data-tile-slot=\{tile\}/);
    expect(areas).toMatch(/minWidth: "min-content"/);
    expect(areas).toMatch(/hidden=\{shownRight === 0\}/);
    expect(areas).toMatch(/data-tile-row/);
  });
});
