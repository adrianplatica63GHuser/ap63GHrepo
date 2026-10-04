/**
 * A tile dragged to free space, and remembered: the pure half.   (Slice #37.76)
 *
 * The fixture is #37.75's Natural Person at 1920 px (10 units): the boxes'
 * units and the heights measured on its synthetic records. The browser half —
 * Playwright's mouse on the four screens — is TC-TILES-13.
 */
import fs from "node:fs";
import path from "node:path";

import { packTiles, type PackBox, type Placed } from "@/lib/ui/tile-packing";
import {
  ROW_STEP,
  canDrop,
  dropAt,
  isStorable,
  parseStoredPlaces,
  placeWithStored,
  placesToStore,
  snapPlace,
  tilePositionsKey,
} from "@/lib/ui/tile-positions";

const GAP = 16;
const UNIT = 148;
const ROOT = process.cwd();
const read = (...p: string[]): string => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const code = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const PERSON: PackBox[] = [
  { id: "identity", units: 3, height: 354 },
  { id: "idCard", units: 3, height: 382 },
  { id: "contact", units: 2, height: 348 },
  { id: "addresses#0", units: 3, height: 326 },
  { id: "addresses#1", units: 3, height: 294 },
  { id: "related", units: 4, height: 521 },
  { id: "classification", units: 3, height: 280 },
  { id: "connections", units: 3, height: 364 },
  { id: "actions", units: 1, height: 63, rowEnd: true },
];

const at = (placed: readonly Placed[], id: string): Placed => {
  const p = placed.find((x) => x.id === id);
  if (!p) throw new Error(`${id} not placed`);
  return p;
};
const bottom = (p: Placed): number => p.top + p.height;
const rule = () => packTiles(PERSON, 10, GAP);

describe("the free-space rule", () => {
  it("a drop on a free place is accepted: under the lowest tile, beside „Corelate”", () => {
    const placed = rule();
    // Under „Corelate" (cols 6–9), where nothing stands.
    expect(canDrop(placed, "connections", { col: 6, top: bottom(at(placed, "related")) + GAP }, 10, GAP)).toBe(true);
    // Far below everything: the space under the lowest tile is always free.
    expect(canDrop(placed, "connections", { col: 0, top: 5000 }, 10, GAP)).toBe(true);
    // Its own place, or a little lower in its own column (it does not block itself).
    expect(canDrop(placed, "connections", { col: 3, top: at(placed, "connections").top + ROW_STEP }, 10, GAP)).toBe(true);
  });

  it("a drop overlapping a tile, or nearer than PANEL_GAP to one, is refused", () => {
    const placed = rule();
    const related = at(placed, "related");
    expect(canDrop(placed, "connections", { col: related.col, top: related.top }, 10, GAP)).toBe(false);
    expect(canDrop(placed, "connections", { col: 6, top: bottom(related) + GAP - ROW_STEP }, 10, GAP)).toBe(false);
  });

  it("a drop past the row's right edge, or above its top, is refused", () => {
    const placed = rule();
    expect(canDrop(placed, "connections", { col: 8, top: 5000 }, 10, GAP)).toBe(false); // 8 + 3 > 10
    expect(canDrop(placed, "connections", { col: 0, top: -8 }, 10, GAP)).toBe(false);
  });

  it("the action bar is not a tile: a drop may be where it stood, and it goes under everything", () => {
    const placed = rule();
    const bar = at(placed, "actions");
    expect(canDrop(placed, "connections", { col: 0, top: bar.top }, 10, GAP)).toBe(true);
    const after = dropAt(placed, "connections", { col: 0, top: bar.top }, GAP);
    expect(at(after, "actions").top).toBe(bottom(at(after, "connections")) + GAP);
  });

  it("a drop moves nothing else", () => {
    const placed = rule();
    const after = dropAt(placed, "connections", { col: 6, top: 904 }, GAP);
    for (const p of placed.filter((x) => x.id !== "connections" && !x.rowEnd)) expect(at(after, p.id)).toEqual(p);
    expect(at(after, "connections")).toMatchObject({ col: 6, top: 904 });
  });

  it("snaps to whole units across and ROW_STEP down", () => {
    expect(snapPlace(990, 903, UNIT, GAP)).toEqual({ col: 6, top: 904 });
    expect(snapPlace(-40, -3, UNIT, GAP)).toEqual({ col: 0, top: 0 });
    expect(snapPlace(1060, 0, UNIT, GAP).col).toBe(6); // 1060 / 164 = 6.46
  });
});

describe("remembered", () => {
  it("under a key beside the tile choice's, per entity — so per document type", () => {
    expect(tilePositionsKey("natural-person")).toBe("ga40-tile-positions-natural-person-v1");
    expect(tilePositionsKey("document-CONTRACT_VANZARE")).toBe("ga40-tile-positions-document-CONTRACT_VANZARE-v1");
  });

  it("an arrangement reads back as it was stored", () => {
    const placed = dropAt(rule(), "connections", { col: 6, top: 904 }, GAP);
    const stored = placesToStore(placed, {}, [], "connections");
    const back = placeWithStored(PERSON, parseStoredPlaces(JSON.stringify(stored)), 10, GAP);
    expect(back.fallback).toEqual([]);
    for (const p of placed) expect(at(back.placed, p.id)).toMatchObject({ col: p.col, top: p.top });
  });

  it("a corrupt arrangement falls back to #37.75's places", () => {
    for (const raw of ["{", "[]", "null", "42", '"x"', '{"connections":"6,904"}', '{"connections":{"col":-1,"top":0}}', '{"connections":{"col":1.5,"top":0}}', '{"connections":{"col":2,"top":-5}}', '{"connections":{"col":2,"top":1e9}}']) {
      expect({ raw, places: parseStoredPlaces(raw) }).toEqual({ raw, places: {} });
      expect(placeWithStored(PERSON, parseStoredPlaces(raw), 10, GAP).placed).toEqual(rule());
    }
    expect(parseStoredPlaces(null)).toEqual({});
  });

  it("with nothing stored it is exactly #37.75's rule", () => {
    expect(placeWithStored(PERSON, {}, 10, GAP).placed).toEqual(rule());
    expect(placeWithStored(PERSON, {}, 6, GAP).placed).toEqual(packTiles(PERSON, 6, GAP));
  });

  it("a stored place the window cannot hold is placed by #37.75's rule for that visit, and not written over", () => {
    const wide = placesToStore(dropAt(rule(), "connections", { col: 6, top: 904 }, GAP), {}, [], "connections");
    const narrow = placeWithStored(PERSON, wide, 6, GAP);
    expect(narrow.fallback).toContain("related"); // col 6 + 4 units > 6
    expect(narrow.fallback).toContain("connections");
    for (const [a, b] of narrow.placed.flatMap((p, i) => narrow.placed.slice(i + 1).map((q) => [p, q] as const))) {
      expect([a.id, b.id, a.col < b.col + b.units && b.col < a.col + a.units && a.top < b.top + b.height + GAP && b.top < a.top + a.height + GAP]).toEqual([a.id, b.id, false]);
    }
    // A drop in the narrow window keeps the wide places it could not use.
    const kept = placesToStore(narrow.placed, wide, narrow.fallback, "identity");
    expect(kept.related).toEqual(wide.related);
    expect(kept.connections).toEqual(wide.connections);
  });

  it("a tile taller than the one the arrangement was made on pushes the tiles under it down", () => {
    const stored = placesToStore(rule(), {}, [], "identity");
    const taller = PERSON.map((b) => (b.id === "addresses#0" ? { ...b, height: 326 + 100 } : b));
    const { placed, fallback } = placeWithStored(taller, stored, 10, GAP);
    expect(fallback).toEqual([]);
    expect(at(placed, "classification").top).toBe(bottom(at(placed, "addresses#0")) + GAP);
    expect(at(placed, "connections").top).toBe(stored.connections.top);
  });

  it("a tile ticked again goes back to its stored place if free, otherwise by #37.75's rule", () => {
    const stored = placesToStore(rule(), {}, [], "identity");
    // Free: „Conexiuni" back where it was.
    expect(at(placeWithStored(PERSON, stored, 10, GAP).placed, "connections")).toMatchObject(stored.connections);
    // Taken: „Clasificare" was dropped there while „Conexiuni" was unticked.
    const taken = { ...stored, classification: { ...stored.connections } };
    const { placed, fallback } = placeWithStored(PERSON, taken, 10, GAP);
    expect(fallback).toEqual(["connections"]);
    expect(at(placed, "classification")).toMatchObject(stored.connections);
    expect(at(placed, "connections")).not.toMatchObject(stored.connections);
  });

  it("a banner over a stored arrangement stands at the top and moves every tile down by its height, and back", () => {
    const stored = placesToStore(dropAt(rule(), "connections", { col: 6, top: 904 }, GAP), {}, [], "connections");
    const withBanner = placeWithStored([{ id: "box#0", units: 1, height: 40, full: true }, ...PERSON], stored, 10, GAP);
    expect(withBanner.lead).toBe(40 + GAP);
    expect(at(withBanner.placed, "box#0")).toMatchObject({ col: 0, units: 10, top: 0 });
    for (const [id, place] of Object.entries(stored)) expect(at(withBanner.placed, id)).toMatchObject({ col: place.col, top: place.top + 40 + GAP });
    // A drop made under the banner stores the place counted from under it.
    const again = placesToStore(withBanner.placed, stored, withBanner.fallback, "identity", withBanner.lead);
    expect(again).toEqual(stored);
    // Gone, every tile back up.
    expect(placeWithStored(PERSON, stored, 10, GAP).placed.filter((p) => !p.rowEnd).map((p) => [p.id, p.top])).toEqual(
      PERSON.filter((b) => !b.rowEnd).map((b) => [b.id, stored[b.id].top]),
    );
  });

  it("previews and the banners are never stored; an unticked tile's entry is kept", () => {
    expect(isStorable("preview:document:1")).toBe(false);
    expect(isStorable("box#0")).toBe(false);
    expect(isStorable("addresses#1")).toBe(true);
    const placed = [...rule(), { id: "preview:document:1", col: 0, units: 4, top: 3000, height: 152 }];
    const out = placesToStore(placed, { idCard: { col: 3, top: 0 }, gone: { col: 1, top: 2 } }, [], "preview:document:1");
    expect(out["preview:document:1"]).toBeUndefined();
    expect(out.gone).toEqual({ col: 1, top: 2 });
  });
});

describe("the screens", () => {
  it("„Implicit” forgets the arrangement with the tile choice, and says so to the row", () => {
    const src = code(read("src", "components", "tiles", "use-tile-choice.ts"));
    expect(src).toContain("tilePositionsKey(reg.entity)");
    expect(src).toContain("TILE_POSITIONS_RESET");
  });

  it("each screen packs its row under its tile choice's entity", () => {
    for (const f of ["src/app/natural-persons/_components/person-detail-tiles.tsx", "src/app/judicial-persons/_components/person-detail-tiles.tsx"]) {
      expect(code(read(...f.split("/")))).toMatch(/useTilePacking\(rowRef, \{ entity: [A-Z_]+_TILE_REGISTRY\.entity \}\)/);
    }
    expect(code(read("src", "components", "tiles", "tile-areas.tsx"))).toContain("useTilePacking(leftRef, { fitWidest: true, entity })");
    expect(code(read("src", "app", "properties", "_components", "property-detail-tiles.tsx"))).toMatch(/<TileAreas[^>]*entity=\{/);
    expect(code(read("src", "app", "documents", "_components", "document-detail-tiles.tsx"))).toMatch(/<TileAreas[^>]*entity=\{reg\.entity\}/);
  });

  it("the hook drags only from unused space and stores only on a free drop", () => {
    const src = code(read("src", "components", "tiles", "use-tile-packing.ts"));
    expect(src).toContain("isDragSurface(");
    expect(src).toContain("canDrop(");
    expect(src).toContain("placesToStore(");
    expect(src).toContain('"Escape"');
  });
});
