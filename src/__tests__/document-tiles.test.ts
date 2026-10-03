/**
 * The Document's tiles.                                        (Slice #37.20)
 *
 * The pure half: the registry built from the type on screen, the per-type
 * storage key, and — written red first — the marker that keeps a highlight in
 * a hidden tile from being lost. The browser half is TC-TILES-04.
 */
import fs from "fs";
import path from "path";

import {
  DOC_TILE_OF_TAB,
  FIELDS_TILE,
  documentTileRegistry,
  markedTiles,
  tabTileKey,
  tileOfTabIndex,
} from "@/app/documents/_components/document-tiles";
import { tileStorageKey } from "@/lib/ui/tiles";

const ROOT = process.cwd();
const read = (...p: string[]): string => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const code = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const CVC_TABS = ["Instrument", "Cadastru", "Stare juridică", "Conformitate"];
const CVC = { typeKey: "CONTRACT_VANZARE", tabs: CVC_TABS, succession: false, pages: true };
const PLAN = { typeKey: "PLAN_PARCELAR", tabs: [] as string[], succession: false, pages: true };
const MOSTENITOR = { typeKey: "CERTIFICAT_MOSTENITOR", tabs: [] as string[], succession: true, pages: true };

describe("HIGHLIGHTS ARE NOT LOST IN A HIDDEN TILE — the marker", () => {
  const all = documentTileRegistry(CVC).all;

  it("marks a hidden tile that holds a highlighted field", () => {
    expect(markedTiles([tabTileKey("Instrument")], ["general", "pages"], all)).toEqual([tabTileKey("Instrument")]);
  });

  it("does not mark a tile that is on screen — the highlight is there to be seen", () => {
    expect(markedTiles(["general", tabTileKey("Instrument")], ["general", tabTileKey("Instrument")], all)).toEqual([]);
  });

  it("marks each tile once, in registry order, and never a tile the type does not have", () => {
    expect(
      markedTiles([tabTileKey("Conformitate"), "general", tabTileKey("Conformitate"), "tab:Nu există"], ["pages"], all),
    ).toEqual(["general", tabTileKey("Conformitate")]);
  });

  it("marks nothing when nothing is highlighted", () => {
    expect(markedTiles([], ["general"], all)).toEqual([]);
  });
});

describe("the registry is built from the type on screen", () => {
  it("a CVC: one tile per notebook tab, in the notebook's order, between the page image and the lists", () => {
    const reg = documentTileRegistry(CVC);
    expect(reg.all).toEqual([
      "general", "pages",
      "tab:Instrument", "tab:Cadastru", "tab:Stare juridică", "tab:Conformitate",
      "persons", "properties", "associations", "classification", "connections",
    ]);
    // Nothing stored shows what Detalii showed: the general data, the first notebook page, the page image.
    expect(reg.defaults).toEqual(["general", "pages", "tab:Instrument"]);
  });

  it("a type with no notebook: one tile for its own fields", () => {
    const reg = documentTileRegistry(PLAN);
    expect(reg.all).toEqual(["general", "pages", FIELDS_TILE, "persons", "properties", "associations", "classification", "connections"]);
    expect(reg.defaults).toEqual(["general", "pages", FIELDS_TILE]);
    expect(tileOfTabIndex([], 0)).toBe(FIELDS_TILE);
  });

  it("the parties are a tile on a Certificat de Moștenitor only, shown by default as the panel was", () => {
    expect(documentTileRegistry(MOSTENITOR).all).toContain("succession");
    expect(documentTileRegistry(MOSTENITOR).defaults).toContain("succession");
    expect(documentTileRegistry(CVC).all).not.toContain("succession");
  });

  it("no page image before the document is saved", () => {
    expect(documentTileRegistry({ ...CVC, pages: false }).all).not.toContain("pages");
  });

  it("THE REMEMBERED CHOICE IS PER TYPE: the key carries the type's key", () => {
    expect(tileStorageKey(documentTileRegistry(CVC).entity)).toBe("ga40-tiles-document-CONTRACT_VANZARE-v1");
    expect(tileStorageKey(documentTileRegistry(PLAN).entity)).not.toBe(tileStorageKey(documentTileRegistry(CVC).entity));
  });

  it("the form's tiles are hidden, never unmounted; the lists may unmount", () => {
    const reg = documentTileRegistry(MOSTENITOR);
    expect(reg.form).toEqual(["general", "pages", FIELDS_TILE, "succession"]);
    for (const list of ["persons", "properties", "associations", "classification", "connections"]) expect(reg.form).not.toContain(list);
  });

  it("keeps every old `?tab=` working: each tab but Detalii names its tile", () => {
    expect(DOC_TILE_OF_TAB).toEqual({ related: "associations", persons: "persons", properties: "properties", metadata: ["classification", "connections"] });
  });

  it("a notebook page's tile, clamped the way the notebook clamps its active page", () => {
    expect(tileOfTabIndex(CVC_TABS, 1)).toBe("tab:Cadastru");
    expect(tileOfTabIndex(CVC_TABS, 9)).toBe("tab:Conformitate");
  });
});

describe("the page and the form use the declaration", () => {
  // Read inside each test, not here: a file that does not exist yet fails its
  // own tests, not the whole suite (the marker above was run red on its own).
  const form = (): string => code(read("src", "app", "documents", "_components", "document-form.tsx"));
  const page = (): string => code(read("src", "app", "documents", "_components", "document-detail-tiles.tsx"));

  it("the notebook's own rules still decide where a panel goes", () => {
    expect(form()).toMatch(/templateTabsOf\(templateFields\)/);
    expect(form()).toMatch(/tabIndexOfFeesPair\(/);
    expect(form()).toMatch(/feesPairStaysTogether\(/);
  });

  it("every form tile is hidden, never unmounted, and an error in one brings it back", () => {
    expect(form()).toMatch(/form\.handleSubmit\(onSubmit, onInvalid\)/);
    expect(form()).toMatch(/onRevealTile\(/);
    expect(form()).not.toMatch(/tileShown\([^)]*\)\s*&&/);
  });

  it("the page marks hidden tiles and switches the choice with the type", () => {
    expect(page()).toMatch(/markedTiles\(/);
    expect(page()).toMatch(/documentTileRegistry\(/);
    expect(page()).toMatch(/<TileSelector[\s\S]*?marked=/);
    // No tick before the types have loaded: it would be stored under a key the type then replaces.
    expect(page()).toMatch(/layout\.ready !== false && \(\s*<TileSelector/);
    expect(form()).toMatch(/ready: documentTypesFetched/);
    expect(page()).not.toMatch(/role="tab/);
    expect(code(read("src", "app", "documents", "[id]", "page.tsx"))).toContain("<DocumentDetailTiles");
    expect(fs.existsSync(path.join(ROOT, "src", "app", "documents", "_components", "document-detail-tabs.tsx"))).toBe(false);
  });

  it("a marked checkbox keeps its name: the marker sits outside the label", () => {
    const SELECTOR = code(read("src", "components", "tiles", "tile-selector.tsx"));
    expect(SELECTOR).toMatch(/<\/label>\s*\{isMarked && \(/);
    expect(SELECTOR).toMatch(/data-tile-marked/);
  });
});
