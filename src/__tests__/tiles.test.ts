/**
 * Tiles — the rules, and the Natural Person's use of them.     (Slice #37.17)
 * The Judicial Person's, declared on the same pieces.          (Slice #37.18)
 * The Property's, with the map and Street View as tiles.       (Slice #37.19)
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
import {
  JP_FORM_TILES,
  JP_TILES,
  JP_TILE_OF_TAB,
  JP_TILE_REGISTRY,
  jpTileOfField,
} from "@/app/judicial-persons/_components/person-tiles";
import {
  PROP_FORM_TILES,
  PROP_TILES,
  PROP_TILE_OF_TAB,
  PROP_TILE_REGISTRY,
  propTileOfField,
} from "@/app/properties/_components/property-tiles";
import { NP_PANEL_INNER_REM, TILE_REM, PANEL_REM, PANEL_GAP_REM, panelRem } from "@/lib/ui/field-widths";

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
    expect([...NP_TILES]).toEqual(["identity", "idCard", "contact", "addresses", "related", "classification", "connections"]); // #37.67: „Corelate"
    expect([...NP_TILE_REGISTRY.defaults]).toEqual(["identity", "idCard", "contact", "addresses"]);
    expect(NP_TILE_REGISTRY.form).toBe(NP_FORM_TILES);
  });

  it("keep every old `?tab=` working: each tab but Detalii names its tile", () => {
    expect(NP_TILE_OF_TAB).toEqual({ related: "related", properties: "related", document: "related", metadata: ["classification", "connections"] }); // #37.67
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
    // …which a disabled „Salvează" would make unreachable: as tiles, an invalid form leaves it enabled.
    expect(FORM).toMatch(/\(!tiled && !form\.formState\.isValid\)/);
  });

  it("list tiles may unmount, and the page has no tab row", () => {
    for (const tile of ["related", "classification", "connections"]) {
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
      // Slice #37.27: „Asocieri" is „Persoane" on the Natural Person — its people, by name and relationship.
      // Slice #37.67: Persoane, Proprietăți and Acte are one tile, „Corelate".
      "Identitate", "Carte de identitate", "Contact", "Adrese", "Corelate", "Clasificări", "Conexiuni",
    ]);
    expect(ro.shared.tiles.all).toBe("Toate");
    expect(ro.shared.tiles.defaults).toBe("Implicit");
    expect(read("e2e", "helpers", "tiles.ts")).toContain(`TILE_GROUP = "${ro.shared.tiles.groupLabel}"`);
  });

  it("sit on the small scale: a small tile is a panel, a wide one two and the gap", () => {
    expect(TILE_REM.small).toBe(PANEL_REM);
    expect(TILE_REM.wide).toBe(2 * PANEL_REM + PANEL_GAP_REM);
  });

  it("form tiles are each as wide as their widest row since #37.26 — never wider than a small tile", () => {
    for (const inner of Object.values(NP_PANEL_INNER_REM)) expect(panelRem(inner)).toBeLessThan(TILE_REM.small);
    expect(FORM).toMatch(/NP_PANEL_STYLE\.identity[\s\S]*NP_PANEL_STYLE\.idCard[\s\S]*NP_PANEL_STYLE\.contact/);
  });
});

describe("the Judicial Person's tiles (Slice #37.18)", () => {
  const FORM = code(read("src", "app", "judicial-persons", "_components", "judicial-person-form.tsx"));
  const PAGE = code(read("src", "app", "judicial-persons", "_components", "person-detail-tiles.tsx"));

  it("are the seven the header names, and nothing stored shows exactly the old Detalii tab", () => {
    expect([...JP_TILES]).toEqual(["identity", "contactPersons", "addresses", "related", "classification", "connections"]); // #37.67: „Corelate"
    expect([...JP_TILE_REGISTRY.defaults]).toEqual(["identity", "contactPersons", "addresses"]);
    expect(JP_TILE_REGISTRY.form).toBe(JP_FORM_TILES);
  });

  it("are remembered apart from the Natural Person's: ticking „Acte” on a company changes nothing on a person", () => {
    expect(tileStorageKey(JP_TILE_REGISTRY.entity)).toBe("ga40-tiles-judicial-person-v1");
    expect(tileStorageKey(JP_TILE_REGISTRY.entity)).not.toBe(tileStorageKey(NP_TILE_REGISTRY.entity));
  });

  it("keep every old `?tab=` working: each tab but Detalii names its tile", () => {
    expect(JP_TILE_OF_TAB).toEqual({ related: "related", properties: "related", document: "related", metadata: ["classification", "connections"] }); // #37.67
    expect(JP_TILE_OF_TAB.details).toBeUndefined();
  });

  it("put every field of the form on the tile its panel is", () => {
    const i = FORM.indexOf('data-panel="identity"');
    const j = FORM.indexOf('data-panel="contact-persons"', i);
    expect(i >= 0 && j > i).toBe(true);
    const identity = [...FORM.slice(i, j).matchAll(/name="([a-zA-Z0-9.]+)"/g)].map((m) => m[1]);
    expect(identity.length).toBeGreaterThan(4);
    for (const f of identity) expect([f, jpTileOfField(f)]).toEqual([f, "identity"]);
    for (const f of ["contactPerson1Id", "contactPerson2Name"]) expect(jpTileOfField(f)).toBe("contactPersons");
    expect(jpTileOfField("addresses.HEADQUARTERS.country")).toBe("addresses");
    expect(jpTileOfField("addresses.CORRESPONDENCE.streetLine")).toBe("addresses");
    expect(jpTileOfField("correspondenceSameAsHq")).toBe("addresses");
  });

  it("HIDING A TILE NEVER LOSES A VALUE: every form tile is hidden, never unmounted", () => {
    for (const tile of JP_FORM_TILES) expect(FORM).toContain(`tileProps("${tile}")`);
    expect(FORM).not.toMatch(/tileShown\([^)]*\)\s*&&/);
    expect(FORM).toMatch(/form\.handleSubmit\(onSubmit, onInvalid\)/);
    expect(FORM).toMatch(/onRevealTile\(tile\)/);
    expect(FORM).toMatch(/\(!tiled && !form\.formState\.isValid\)/);
  });

  it("list tiles may unmount, and the page has no tab row", () => {
    for (const tile of ["related", "classification", "connections"]) {
      expect(PAGE).toMatch(new RegExp(`isShown\\("${tile}"\\) && \\(\\s*<ListTile tile="${tile}"`));
    }
    expect(PAGE).not.toMatch(/role="tab/);
    expect(PAGE).toMatch(/useTileChoice<JpTile>\(JP_TILE_REGISTRY/);
    expect(code(read("src", "app", "judicial-persons", "[id]", "page.tsx"))).toContain("<JudicialPersonDetailTiles");
    expect(fs.existsSync(path.join(ROOT, "src", "app", "judicial-persons", "_components", "person-detail-tabs.tsx"))).toBe(false);
  });

  it("are named in Romanian exactly as the specs tick them", () => {
    const ro = JSON.parse(read("messages", "ro-RO.json")) as { judicialPerson: { tiles: Record<string, string> } };
    expect(JP_TILES.map((k) => ro.judicialPerson.tiles[k])).toEqual([
      "Persoană juridică", "Persoane de contact", "Adrese", "Corelate", "Clasificări", "Conexiuni", // #37.67
    ]);
  });
});

describe("the Property's tiles (Slice #37.19)", () => {
  const FORM = code(read("src", "app", "properties", "_components", "property-form.tsx"));
  const PAGE = code(read("src", "app", "properties", "_components", "property-detail-tiles.tsx"));

  it("are the nine the header names, and nothing stored shows exactly the old Detalii tab", () => {
    expect([...PROP_TILES]).toEqual([
      // #37.66: „Corelate"; #37.88: in the groups' order — the record, „Corelate", the two yellow, the fixed column.
      "cadastral", "address", "related", "classification", "connections", "map", "corners", "streetView",
    ]);
    // Detalii showed the four panels; Street View was a button, off on open.
    expect([...PROP_TILE_REGISTRY.defaults]).toEqual(["cadastral", "corners", "address", "map"]);
    expect([...PROP_TILE_REGISTRY.form]).toEqual(["cadastral", "corners", "address"]);
    expect(PROP_TILE_REGISTRY.form).toBe(PROP_FORM_TILES);
  });

  it("are remembered apart from the other screens", () => {
    expect(tileStorageKey(PROP_TILE_REGISTRY.entity)).toBe("ga40-tiles-property-v1");
    expect(new Set([PROP_TILE_REGISTRY, NP_TILE_REGISTRY, JP_TILE_REGISTRY].map((r) => tileStorageKey(r.entity))).size).toBe(3);
  });

  it("keep every old `?tab=` working: each tab but Detalii names its tile", () => {
    // #37.66: the association screens' way back — ?tab=related, persons or document — lands on „Corelate".
    expect(PROP_TILE_OF_TAB).toEqual({ related: "related", persons: "related", document: "related", metadata: ["classification", "connections"] });
    expect(PROP_TILE_OF_TAB.details).toBeUndefined();
  });

  it("put every field of the form on the tile its panel is", () => {
    const panel = (start: string, end: string): string[] => {
      const i = FORM.indexOf(start);
      const j = FORM.indexOf(end, i + start.length);
      expect([start, i >= 0 && j > i]).toEqual([start, true]);
      return [...FORM.slice(i, j).matchAll(/name="([a-zA-Z0-9.]+)"/g)].map((m) => m[1]);
    };
    const cadastral = panel('data-panel="cadastral"', 'data-panel="corners"');
    const address = panel('data-panel="address"', 'data-panel="map"');
    expect(cadastral.length).toBeGreaterThan(6);
    expect(address.length).toBeGreaterThan(4);
    for (const f of cadastral) expect([f, propTileOfField(f)]).toEqual([f, "cadastral"]);
    for (const f of address) expect([f, propTileOfField(f)]).toEqual([f, "address"]);
  });

  it("HIDING A FORM TILE NEVER LOSES A VALUE: the cadastral data, the corners and the address are hidden, never unmounted", () => {
    for (const tile of PROP_FORM_TILES) expect(FORM).toContain(`tileProps("${tile}")`);
    for (const tile of PROP_FORM_TILES) expect(FORM).not.toContain(`tileShown("${tile}") &&`);
    expect(FORM).toMatch(/form\.handleSubmit\(onSubmit, onInvalid\)/);
    expect(FORM).toMatch(/onRevealTile\(tile\)/);
    expect(FORM).toMatch(/\(!tiled && !form\.formState\.isValid\)/);
  });

  it("AN UNTICKED MAP COSTS NOTHING: Hartă and Street View are mounted only while shown", () => {
    // #37.56: each is placed in the right-hand column (`placeTile`) — still mounted only while shown.
    expect(FORM).toMatch(/\{tileShown\("map"\) && placeTile\("map",\s*<section[^>]*data-panel="map"/);
    expect(FORM).toMatch(/\{streetViewOpen && !typeConfig\.hideStreetView && placeTile\("streetView",\s*<section[^>]*data-panel="street-view"/);
    // As tiles, the Street View button ticks the tile; the create form keeps its own state.
    expect(FORM).toMatch(/tiles \? tiles\.onToggleTile\("streetView"\) : setShowStreetView/);
    expect(FORM).toMatch(/streetViewOpen = tiles \? tiles\.shown\.includes\("streetView"\) : showStreetView/);
    // The map draws the form's own corners, so a remount shows the edited polygon.
    expect(FORM).toMatch(/<PropertyMiniMap\s+corners=\{corners\}/);
  });

  it("list tiles may unmount, and the page has no tab row", () => {
    for (const tile of ["related", "classification", "connections"]) {
      expect(PAGE).toMatch(new RegExp(`isShown\\("${tile}"\\) && \\(\\s*<ListTile tile="${tile}"`));
    }
    expect(PAGE).not.toMatch(/role="tab/);
    expect(code(read("src", "app", "properties", "[id]", "page.tsx"))).toContain("<PropertyDetailTiles");
    expect(fs.existsSync(path.join(ROOT, "src", "app", "properties", "_components", "property-detail-tabs.tsx"))).toBe(false);
  });

  it("are named in Romanian exactly as the specs tick them", () => {
    const ro = JSON.parse(read("messages", "ro-RO.json")) as { property: { tiles: Record<string, string> } };
    expect(PROP_TILES.map((k) => ro.property.tiles[k])).toEqual([
      // #37.66: three tiles became „Corelate"; #37.88: the groups' order.
      "Date cadastrale", "Adresă", "Corelate", "Clasificări", "Conexiuni", "Hartă", "Puncte de contur", "Street View",
    ]);
  });
});
