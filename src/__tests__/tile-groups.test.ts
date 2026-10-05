/**
 * Slice #37.88 — every tile of every registry is in exactly one coloured group,
 * the checkboxes and the tiles run in the groups' order, and the purple group
 * is the right-hand column.
 */
import { TILE_GROUPS, groupedTiles, tileGroupOf, type TileRegistry } from "@/lib/ui/tiles";
import { PROP_TILE_REGISTRY } from "@/app/properties/_components/property-tiles";
import { NP_TILE_REGISTRY } from "@/app/natural-persons/_components/person-tiles";
import { JP_TILE_REGISTRY } from "@/app/judicial-persons/_components/person-tiles";
import { documentTileRegistry, type DocumentLayout } from "@/app/documents/_components/document-tiles";

const CVC: DocumentLayout = { typeKey: "CONTRACT_VANZARE", tabs: ["Preț și taxe", "Cadastru și CF"], succession: false, pages: true };
const MOSTENITOR: DocumentLayout = { typeKey: "CERTIFICAT_MOSTENITOR", tabs: [], succession: true, pages: true };
const UNSAVED: DocumentLayout = { typeKey: null, tabs: [], succession: false, pages: false };

const REGISTRIES: [string, TileRegistry<string>][] = [
  ["property", PROP_TILE_REGISTRY as TileRegistry<string>],
  ["natural person", NP_TILE_REGISTRY as TileRegistry<string>],
  ["judicial person", JP_TILE_REGISTRY as TileRegistry<string>],
  ["document (CVC)", documentTileRegistry(CVC)],
  ["document (Certificat de Moștenitor)", documentTileRegistry(MOSTENITOR)],
  ["document (unsaved)", documentTileRegistry(UNSAVED)],
];

describe.each(REGISTRIES)("%s", (_name, reg) => {
  it("has a group for every tile, and each tile in exactly one", () => {
    expect(reg.groups).toBeDefined();
    const seen = TILE_GROUPS.flatMap((g) => reg.groups![g]);
    expect([...seen].sort()).toEqual([...reg.all].sort());
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("draws the tiles in the groups' order", () => {
    expect(groupedTiles(reg).flatMap((g) => g.tiles)).toEqual(reg.all);
  });

  it("has the right-hand column as its purple group", () => {
    expect(reg.groups!.fixed).toEqual(reg.placement?.right ?? []);
  });

  it("puts „Corelate” in green and „Clasificări”, „Conexiuni” in yellow", () => {
    expect(tileGroupOf(reg, "related")).toBe("related");
    expect(tileGroupOf(reg, "classification")).toBe("meta");
    expect(tileGroupOf(reg, "connections")).toBe("meta");
  });
});

describe("the groups as the header lists them", () => {
  it("Property", () => {
    expect(PROP_TILE_REGISTRY.groups).toEqual({
      record: ["cadastral", "address"],
      related: ["related"],
      meta: ["classification", "connections"],
      fixed: ["map", "corners", "streetView"],
    });
  });
  it("Document: Date generale, the type's own tiles, Părți; then the lists; Pagini at the right", () => {
    expect(documentTileRegistry(MOSTENITOR).groups).toEqual({
      record: ["general", "fields", "succession"],
      related: ["related"],
      meta: ["classification", "connections"],
      fixed: ["pages"],
    });
  });
});
