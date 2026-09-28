/**
 * Tiles — the rules, and the Natural Person's use of them.     (Slice #37.17)
 *
 * The browser half — ticking, „Toate", „Implicit", a reload that keeps the
 * choice, an error in a hidden tile — is TC-TILES-01, a case driven by hand;
 * the specs reach tiles through `e2e/helpers/tiles.ts`.
 */
import fs from "fs";
import path from "path";

import {
  firstErrorPath,
  inRegistryOrder,
  parseStoredTiles,
  shownTiles,
  tileStorageKey,
  toggleTile,
  type TileRegistry,
} from "@/lib/ui/tiles";
import {
  NP_FORM_TILES,
  NP_TILES,
  NP_TILE_OF_TAB,
  NP_TILE_REGISTRY,
  npTileOfField,
} from "@/app/natural-persons/_components/person-tiles";
import { TILE_REM, PANEL_REM, PANEL_GAP_REM } from "@/lib/ui/field-widths";

const ROOT = process.cwd();
const read = (...p: string[]): string => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const code = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const REG: TileRegistry<"a" | "b" | "c" | "d"> = { entity: "test", all: ["a", "b", "c", "d"], defaults: ["a", "b"], form: ["a", "b"] };

describe("the rules", () => {
  it("remembers per entity kind, under a key of its own", () => {
    expect(tileStorageKey("natural-person")).toBe("ga40-tiles-natural-person-v1");
    expect(tileStorageKey("judicial-person")).not.toBe(tileStorageKey("natural-person"));
  });

  it("reads a stored choice back in registry order, known tiles only", () => {
    expect(parseStoredTiles('["d","a"]', REG)).toEqual(["a", "d"]);
    expect(parseStoredTiles('["x","c","c"]', REG)).toEqual(["c"]);
  });

  it("reads nothing, garbage, an empty choice or only unknown tiles as the defaults — the screen always has a tile", () => {
    for (const raw of [null, "", "{", '"a"', "[]", '["x","y"]', "[1,2]"]) {
      expect(parseStoredTiles(raw, REG)).toEqual(["a", "b"]);
    }
  });

  it("ticks in registry order, and never unticks the last tile", () => {
    expect(toggleTile(["c"], "a", REG.all)).toEqual(["a", "c"]);
    expect(toggleTile(["a", "c"], "a", REG.all)).toEqual(["c"]);
    expect(toggleTile(["c"], "c", REG.all)).toEqual(["c"]);
  });

  it("adds a visit's tiles to the stored choice without storing them", () => {
    expect(shownTiles(["b"], ["d", "b"], REG.all)).toEqual(["b", "d"]);
    expect(inRegistryOrder(["d", "zz", "a"], REG.all)).toEqual(["a", "d"]);
  });

  it("finds the first field react-hook-form reports, nested or not, without walking into `ref`", () => {
    expect(firstErrorPath({ lastName: { type: "too_small", message: "x", ref: { name: "lastName" } } })).toBe("lastName");
    expect(firstErrorPath({ addresses: { HOME: { streetLine: { type: "max", message: "y" } } } })).toBe("addresses.HOME.streetLine");
    expect(firstErrorPath({})).toBeNull();
    expect(firstErrorPath(undefined)).toBeNull();
  });
});

describe("the Natural Person's tiles", () => {
  const FORM = code(read("src", "app", "natural-persons", "_components", "natural-person-form.tsx"));
  const PAGE = code(read("src", "app", "natural-persons", "_components", "person-detail-tiles.tsx"));

  it("are the eight the header names, and nothing stored shows exactly the old Detalii tab", () => {
    expect([...NP_TILES]).toEqual(["identity", "idCard", "contact", "addresses", "associations", "properties", "documents", "metadata"]);
    expect([...NP_TILE_REGISTRY.defaults]).toEqual(["identity", "idCard", "contact", "addresses"]);
    expect(NP_TILE_REGISTRY.form).toBe(NP_FORM_TILES);
  });

  it("keep every old `?tab=` working: each tab but Detalii names its tile", () => {
    expect(NP_TILE_OF_TAB).toEqual({ related: "associations", properties: "properties", document: "documents", metadata: "metadata" });
    expect(NP_TILE_OF_TAB.details).toBeUndefined();
  });

  it("put every field of the form on the tile its panel is", () => {
    const panel = (start: string, end: string): string[] => {
      const i = FORM.indexOf(start);
      const j = FORM.indexOf(end, i + start.length);
      expect([start, i >= 0 && j > i]).toEqual([start, true]);
      return [...FORM.slice(i, j).matchAll(/name="([a-zA-Z0-9.]+)"/g)].map((m) => m[1]);
    };
    const identity = panel('data-panel="identity"', 'data-panel="id-card"');
    const idCard = panel('data-panel="id-card"', 'data-panel="contact"');
    const contact = panel('data-panel="contact"', "<AddressBlock");
    expect(identity.length).toBeGreaterThan(5);
    expect(idCard.length).toBeGreaterThan(5);
    for (const f of identity) expect([f, npTileOfField(f)]).toEqual([f, "identity"]);
    for (const f of idCard) expect([f, npTileOfField(f)]).toEqual([f, "idCard"]);
    for (const f of contact) expect([f, npTileOfField(f)]).toEqual([f, "contact"]);
    for (const f of ["personalPhone1", "personalEmail2", "workEmail"]) expect(npTileOfField(f)).toBe("contact");
    expect(npTileOfField("addresses.HOME.streetLine")).toBe("addresses");
    expect(npTileOfField("correspondenceSameAsHome")).toBe("addresses");
  });

  it("HIDING A TILE NEVER LOSES A VALUE: every form tile is hidden, never unmounted", () => {
    for (const tile of NP_FORM_TILES) expect(FORM).toContain(`tileProps("${tile}")`);
    expect(FORM).not.toMatch(/tileShown\([^)]*\)\s*&&/);
    // An error in a hidden tile brings it back.
    expect(FORM).toMatch(/form\.handleSubmit\(onSubmit, onInvalid\)/);
    expect(FORM).toMatch(/onRevealTile\(tile\)/);
  });

  it("list tiles may unmount, and the page has no tab row", () => {
    for (const tile of ["associations", "properties", "documents", "metadata"]) {
      expect(PAGE).toMatch(new RegExp(`isShown\\("${tile}"\\) && \\(\\s*<ListTile tile="${tile}"`));
    }
    expect(PAGE).not.toMatch(/role="tab/);
    expect(code(read("src", "app", "natural-persons", "[id]", "page.tsx"))).toContain("<PersonDetailTiles");
  });

  it("are named in Romanian exactly as the specs tick them", () => {
    const ro = JSON.parse(read("messages", "ro-RO.json")) as {
      naturalPerson: { tiles: Record<string, string> };
      shared: { tiles: Record<string, string> };
    };
    expect(NP_TILES.map((k) => ro.naturalPerson.tiles[k])).toEqual([
      "Identitate", "Carte de identitate", "Contact", "Adrese", "Asocieri", "Proprietăți", "Acte", "META INFO",
    ]);
    expect(ro.shared.tiles.all).toBe("Toate");
    expect(ro.shared.tiles.defaults).toBe("Implicit");
    expect(read("e2e", "helpers", "tiles.ts")).toContain(`TILE_GROUP = "${ro.shared.tiles.groupLabel}"`);
  });

  it("sit on the small scale: a small tile is a panel, a wide one two and the gap", () => {
    expect(TILE_REM.small).toBe(PANEL_REM);
    expect(TILE_REM.wide).toBe(2 * PANEL_REM + PANEL_GAP_REM);
  });
});
