/**
 * A tile dragged to free space, and remembered: the pure half.   (Slice #37.76)
 *
 * The fixture is #37.75's Natural Person at 1920 px (10 units): the boxes'
 * units and the heights measured on its synthetic records. The browser half —
 * Playwright's mouse on the four screens — is TC-TILES-13.
 */
import fs from "node:fs";
import path from "node:path";

import { grow, packTiles, settle, type PackBox, type Placed } from "@/lib/ui/tile-packing";
import {
  FIXED_PREFIX,
  ROW_STEP,
  canDrop,
  dropAt,
  isStorable,
  parseStoredPlaces,
  placeWithStored,
  placesToStore,
  riseIntoGaps,
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
    // #38.16: a drop rises at once, as the hook does — 904 is 3 px under „Corelate"'s PANEL_GAP.
    const placed = riseIntoGaps(dropAt(rule(), "connections", { col: 6, top: 904 }, GAP), GAP);
    expect(at(placed, "connections").top).toBe(bottom(at(placed, "related")) + GAP);
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
    const stored = placesToStore(riseIntoGaps(dropAt(rule(), "connections", { col: 6, top: 904 }, GAP), GAP), {}, [], "connections");
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
    // #37.89: the persons draw their row through `TileAreas` too, for „Interacțiuni"'s column.
    for (const f of ["src/app/natural-persons/_components/person-detail-tiles.tsx", "src/app/judicial-persons/_components/person-detail-tiles.tsx"]) {
      expect(code(read(...f.split("/")))).toMatch(/<TileAreas[^>]*entity=\{[A-Z_]+_TILE_REGISTRY\.entity\}/);
    }
    expect(code(read("src", "components", "tiles", "tile-areas.tsx"))).toContain("useTilePacking(leftRef, { fitWidest: true, entity, rightRef })");
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

/**
 * Slice #37.79 — the Property at 1920 px: the row 10 units, the left area 7,
 * „Hartă" and „Puncte de contur" fixed in the 3-unit column (col 7), as
 * measured in the browser pane on a synthetic property.
 */
const PROPERTY: PackBox[] = [
  { id: `${FIXED_PREFIX}map`, units: 3, height: 378, fixed: { col: 7, top: 0 } },
  { id: `${FIXED_PREFIX}corners`, units: 3, height: 341, fixed: { col: 7, top: 394 } },
  { id: "cadastral", units: 3, height: 449 },
  { id: "address", units: 3, height: 391 },
  { id: "connections", units: 3, height: 363 },
  { id: "actions", units: 1, height: 63, rowEnd: true },
];
const placeOf = (placed: readonly Placed[], id: string) => placed.find((p) => p.id === id)!;

describe("the free space under the right column (#37.79)", () => {
  it("a screen opens as before: the flow keeps to the left area, the column's tiles where they stand", () => {
    const placed = packTiles(PROPERTY, 10, GAP, 7);
    expect(placeOf(placed, "cadastral")).toMatchObject({ col: 0, top: 0 });
    expect(placeOf(placed, "address")).toMatchObject({ col: 3, top: 0 });
    expect(placeOf(placed, "connections")).toMatchObject({ col: 0, top: 465 });
    expect(placeOf(placed, `${FIXED_PREFIX}map`)).toMatchObject({ col: 7, top: 0, fixed: true });
    expect(placeOf(placed, `${FIXED_PREFIX}corners`)).toMatchObject({ col: 7, top: 394, fixed: true });
    // The action bar under every tile that is not fixed, the left area's width.
    expect(placeOf(placed, "actions")).toMatchObject({ col: 0, units: 7, top: 465 + 363 + GAP });
    expect(placeWithStored(PROPERTY, {}, 10, GAP, 7).placed).toEqual(placed);
  });

  it("a drop under the column is accepted where free, refused onto a fixed tile or within PANEL_GAP of one", () => {
    const placed = packTiles(PROPERTY, 10, GAP, 7);
    expect(canDrop(placed, "connections", { col: 7, top: 792 }, 10, GAP)).toBe(true);
    // „Puncte de contur" ends at 394 + 341 = 735: PANEL_GAP under it is 751.
    expect(canDrop(placed, "connections", { col: 7, top: 752 }, 10, GAP)).toBe(true);
    expect(canDrop(placed, "connections", { col: 7, top: 744 }, 10, GAP)).toBe(false);
    expect(canDrop(placed, "connections", { col: 7, top: 400 }, 10, GAP)).toBe(false);
    expect(canDrop(placed, "connections", { col: 6, top: 792 }, 10, GAP)).toBe(true); // wider than the gap: reaches into the left area
    expect(canDrop(placed, "connections", { col: 8, top: 792 }, 10, GAP)).toBe(false); // past the row's edge
    // A fixed tile is never dropped anywhere.
    expect(canDrop(placed, `${FIXED_PREFIX}corners`, { col: 7, top: 900 }, 10, GAP)).toBe(false);
  });

  it("a drop moves no fixed tile, and the fixed tiles are never stored", () => {
    const placed = dropAt(packTiles(PROPERTY, 10, GAP, 7), "connections", { col: 7, top: 792 }, GAP);
    expect(placeOf(placed, `${FIXED_PREFIX}map`)).toMatchObject({ col: 7, top: 0 });
    expect(placeOf(placed, `${FIXED_PREFIX}corners`)).toMatchObject({ col: 7, top: 394 });
    const stored = placesToStore(placed, {}, [], "connections");
    expect(stored.connections).toEqual({ col: 7, top: 792 });
    expect(Object.keys(stored).some((id) => id.startsWith(FIXED_PREFIX))).toBe(false);
    expect(isStorable(`${FIXED_PREFIX}map`)).toBe(false);
  });

  it("read back beside the column, a place under it holds; with the column wrapped it falls back and is not written over", () => {
    const beside = placeWithStored(PROPERTY, { connections: { col: 7, top: 792 } }, 10, GAP, 7);
    // #38.16: under the column, and risen right under „Puncte de contur" (394 + 341 + PANEL_GAP).
    expect(placeOf(beside.placed, "connections")).toMatchObject({ col: 7, top: 394 + 341 + GAP });
    expect(beside.fallback).toEqual([]);
    // Wrapped (a narrow window): no fixed tiles, the row is the left area.
    const wrapped = placeWithStored(PROPERTY.filter((b) => !b.fixed), { connections: { col: 7, top: 792 } }, 6, GAP, 6);
    expect(placeOf(wrapped.placed, "connections").col).toBeLessThan(6);
    expect(wrapped.fallback).toEqual(["connections"]);
    expect(placesToStore(wrapped.placed, { connections: { col: 7, top: 792 } }, wrapped.fallback, "address").connections).toEqual({ col: 7, top: 792 });
  });

  it("a fixed tile that grows, or is pushed down, pushes the tiles under it down; nothing moves a fixed tile", () => {
    const placed = dropAt(packTiles(PROPERTY, 10, GAP, 7), "connections", { col: 7, top: 792 }, GAP);
    const grown = grow(placed, `${FIXED_PREFIX}corners`, 500, GAP); // a corner added
    expect(placeOf(grown, "connections").top).toBe(394 + 500 + GAP);
    const pushed = settle(placed, `${FIXED_PREFIX}corners`, 450, 341, GAP); // the map above grew
    expect(placeOf(pushed, `${FIXED_PREFIX}corners`).top).toBe(450);
    expect(placeOf(pushed, "connections").top).toBe(450 + 341 + GAP);
    // A left tile that grows never moves a fixed one.
    const tall = grow(packTiles(PROPERTY, 10, GAP, 7), "address", 2000, GAP);
    expect(placeOf(tall, `${FIXED_PREFIX}corners`)).toMatchObject({ col: 7, top: 394 });
    // „Street View" ticked: a new fixed tile where „Conexiuni" was stored pushes it under.
    const withSv = [...PROPERTY.slice(0, 2), { id: `${FIXED_PREFIX}streetView`, units: 3, height: 378, fixed: { col: 7, top: 750 } }, ...PROPERTY.slice(2)];
    const read = placeWithStored(withSv, { connections: { col: 7, top: 792 } }, 10, GAP, 7);
    expect(placeOf(read.placed, "connections")).toMatchObject({ col: 7, top: 750 + 378 + GAP });
  });

  it("the hook measures the column's tiles as fixed boxes while the column stands beside the left area", () => {
    const src = code(read("src", "components", "tiles", "use-tile-packing.ts"));
    expect(src).toMatch(/r\.left < c\.right - 0\.5\) return \[\]/);
    expect(src).toContain("placeWithStored(items, { ...stored, ...visit }, columns, gap, flowColumns)");
    expect(code(read("src", "components", "tiles", "tile-areas.tsx"))).toMatch(/ref=\{rightRef\}[\s\S]*?data-tile-area="right"/);
  });
});


/**
 * Slice #38.16 — after the stored arrangement is laid out, every tile rises
 * into the empty space above it. A 10-unit row; A over B over C in the first
 * three units, each 100 px, as stored on the record the user arranged.
 */
describe("every tile rises into the empty space above it (#38.16)", () => {
  const A: PackBox = { id: "a", units: 3, height: 100 };
  const B: PackBox = { id: "b", units: 3, height: 100 };
  const C: PackBox = { id: "c", units: 3, height: 100 };
  const BAR: PackBox = { id: "actions", units: 1, height: 63, rowEnd: true };
  const STACK = { a: { col: 0, top: 0 }, b: { col: 0, top: 116 }, c: { col: 0, top: 232 } };
  const deepFreeze = <T,>(o: T): T => {
    for (const v of Object.values(o as object)) if (v && typeof v === "object") deepFreeze(v);
    return Object.freeze(o);
  };

  it("A over B over C, B no longer shown: C rises right under A", () => {
    const { placed } = placeWithStored([A, C, BAR], STACK, 10, GAP);
    expect(at(placed, "c")).toMatchObject({ col: 0, top: 100 + GAP });
    expect(at(placed, "actions").top).toBe(100 + GAP + 100 + GAP);
  });

  it("B shorter than when the arrangement was made: C rises by the difference", () => {
    const { placed } = placeWithStored([A, { ...B, height: 60 }, C, BAR], STACK, 10, GAP);
    expect(at(placed, "b").top).toBe(116);
    expect(at(placed, "c").top).toBe(232 - 40);
  });

  it("the arrangement as made, on the record it was made on, does not move", () => {
    const { placed } = placeWithStored([A, B, C, BAR], STACK, 10, GAP);
    expect(placed.filter((p) => !p.rowEnd).map((p) => [p.id, p.col, p.top])).toEqual([["a", 0, 0], ["b", 0, 116], ["c", 0, 232]]);
  });

  it("a tile stored under two side-by-side tiles, one of them gone, rises under the one that is left", () => {
    const L: PackBox = { id: "left", units: 3, height: 100 };
    const R: PackBox = { id: "right", units: 3, height: 300 };
    const T: PackBox = { id: "under", units: 3, height: 80 };
    const stored = { left: { col: 0, top: 0 }, right: { col: 3, top: 0 }, under: { col: 1, top: 316 } };
    // Both shown: under the taller, where the user put it.
    expect(at(placeWithStored([L, R, T], stored, 10, GAP).placed, "under")).toMatchObject({ col: 1, top: 316 });
    // „right" not shown: under „left", in the same columns.
    expect(at(placeWithStored([L, T], stored, 10, GAP).placed, "under")).toMatchObject({ col: 1, top: 100 + GAP });
    // „left" not shown: still under „right", which is still there.
    expect(at(placeWithStored([R, T], stored, 10, GAP).placed, "under")).toMatchObject({ col: 1, top: 300 + GAP });
  });

  it("a tile with nothing above it rises to the top, under the banners' lead", () => {
    const banner: PackBox = { id: "box#0", units: 1, height: 40, full: true };
    // Beside the flow's six units the banner does not reach it: the lead is still its ceiling.
    const r = placeWithStored([banner, A, C], { a: { col: 0, top: 0 }, c: { col: 6, top: 400 } }, 10, GAP, 6);
    expect(r.lead).toBe(40 + GAP);
    expect(at(r.placed, "box#0")).toMatchObject({ col: 0, top: 0 });
    expect(at(r.placed, "c")).toMatchObject({ col: 6, top: r.lead });
    expect(at(r.placed, "a")).toMatchObject({ col: 0, top: r.lead });
    // No banner: the row's top.
    expect(at(placeWithStored([A, C], { a: { col: 0, top: 0 }, c: { col: 6, top: 400 } }, 10, GAP).placed, "c").top).toBe(0);
  });

  it("each column keeps its order; a tile never moves sideways or lower", () => {
    const placed = dropAt(rule(), "connections", { col: 6, top: 2000 }, GAP);
    const risen = riseIntoGaps(placed, GAP);
    for (const p of placed.filter((x) => !x.rowEnd)) {
      expect({ id: p.id, col: at(risen, p.id).col, lower: at(risen, p.id).top > p.top }).toEqual({ id: p.id, col: p.col, lower: false });
    }
    expect(at(risen, "connections").top).toBe(bottom(at(risen, "related")) + GAP);
    // Nothing overlaps or comes nearer than PANEL_GAP.
    const body = risen.filter((p) => !p.rowEnd);
    for (const [a, b] of body.flatMap((p, i) => body.slice(i + 1).map((q) => [p, q] as const))) {
      expect([a.id, b.id, a.col < b.col + b.units && b.col < a.col + a.units && a.top < b.top + b.height + GAP && b.top < a.top + a.height + GAP]).toEqual([a.id, b.id, false]);
    }
  });

  it("fixed boxes and the action bar never move by the rise; a fixed tile lower in the columns is no ceiling", () => {
    const placed = packTiles(PROPERTY, 10, GAP, 7);
    // „Conexiuni" left 300 px under „Puncte de contur": it rises; the column does not move.
    const moved = dropAt(placed, "connections", { col: 7, top: 1040 }, GAP);
    const risen = riseIntoGaps(moved, GAP);
    expect(placeOf(risen, "connections")).toMatchObject({ col: 7, top: 394 + 341 + GAP });
    expect(placeOf(risen, `${FIXED_PREFIX}map`)).toMatchObject({ col: 7, top: 0 });
    expect(placeOf(risen, `${FIXED_PREFIX}corners`)).toMatchObject({ col: 7, top: 394 });
    expect(placeOf(risen, "actions").top).toBe(Math.max(...risen.filter((p) => !p.rowEnd && !p.fixed).map((p) => p.top + p.height)) + GAP);
    // A tile above the column's lowest tile, in its columns, rises past nothing below it.
    const high: Placed[] = [
      { id: `${FIXED_PREFIX}low`, col: 7, units: 3, top: 600, height: 100, fixed: true },
      { id: "t", col: 7, units: 3, top: 200, height: 100 },
    ];
    expect(placeOf(riseIntoGaps(high, GAP), "t").top).toBe(0);
    // A row end handed in is never taken for a tile.
    expect(placeOf(riseIntoGaps([...high, { id: "bar", col: 0, units: 7, top: 5, height: 63, rowEnd: true }], GAP), "bar").top).toBe(100 + GAP);
  });

  it("the stored value is left untouched: a layout only reads it, and only a drop writes", () => {
    const stored = deepFreeze({ ...STACK, a: { ...STACK.a }, b: { ...STACK.b }, c: { ...STACK.c } });
    const before = JSON.stringify(stored);
    placeWithStored([A, C, BAR], stored, 10, GAP);
    expect(JSON.stringify(stored)).toBe(before);
    const src = code(read("src", "components", "tiles", "use-tile-packing.ts"));
    expect(src.match(/writePlaces\(key, /g)).toHaveLength(1); // in `end`, on a free drop
  });

  it("the hook rises a dropped tile at once, and lays the row out — so rises — at every fresh layout", () => {
    const src = code(read("src", "components", "tiles", "use-tile-packing.ts"));
    expect(src).toContain("riseIntoGaps(dropAt(placed, d.box.id, d.place, gap), gap, lead,");
    // A height change inside the settling window lays the row out afresh; after it, only `grow`.
    expect(src).toContain("if (!interacted && Date.now() < settleUntil) return layout();");
    expect(code(read("src", "lib", "ui", "tile-positions.ts"))).toContain("riseIntoGaps([...placed, ...flow], gap, lead,");
  });

  it("a column tile ticked exactly where a risen tile stands pushes it under itself, never out of the column (TC-TILES-15 step 4)", () => {
    // Risen right under „Puncte de contur" (751); „Street View" then opens at that same top.
    const withSv = [...PROPERTY.slice(0, 2), { id: `${FIXED_PREFIX}streetView`, units: 3, height: 378, fixed: { col: 7, top: 751 } }, ...PROPERTY.slice(2)];
    const r = placeWithStored(withSv, { connections: { col: 7, top: 751 } }, 10, GAP, 7);
    expect(r.fallback).toEqual([]);
    expect(placeOf(r.placed, "connections")).toMatchObject({ col: 7, top: 751 + 378 + GAP });
    // Unticked again, it is back right under „Puncte de contur".
    expect(placeOf(placeWithStored(PROPERTY, { connections: { col: 7, top: 751 } }, 10, GAP, 7).placed, "connections")).toMatchObject({ col: 7, top: 751 });
  });

  it("with nothing stored nothing rises: #37.75's flow, untouched", () => {
    expect(placeWithStored(PERSON, {}, 10, GAP).placed).toEqual(rule());
    expect(riseIntoGaps(rule(), GAP)).toEqual(rule());
  });
});
