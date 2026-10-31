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
  TILES_ALL_UP,
  allUp,
  evenColumns,
  tileColumns,
  MAKE_ROOM_DELAY_MS,
  MAKE_ROOM_SLIDE_MS,
  ROW_STEP,
  WRAPPED_PREFIX,
  canDrop,
  ceilingOf,
  dropAt,
  isStorable,
  makeRoom,
  parseStoredPlaces,
  placeWithStored,
  placesToStore,
  riseIntoGaps,
  riseOne,
  snapPlace,
  storedPlaceOf,
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
    // #38.16 had: „a drop rises at once, as the hook does — 904 is 3 px under „Corelate"'s PANEL_GAP", and
    // expected „Conexiuni" right under „Corelate". Inverted by #38.45: a drop no longer rises. 904 stays,
    // and the 3 px the user left over PANEL_GAP are stored with the place.
    const placed = dropAt(rule(), "connections", { col: 6, top: 904 }, GAP);
    expect(at(placed, "connections").top).toBe(904);
    expect(904 - (bottom(at(placed, "related")) + GAP)).toBe(3);
    const stored = placesToStore(placed, {}, [], "connections", 0, GAP);
    expect(stored.connections).toEqual({ col: 6, top: 904, space: 3 });
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
    // #38.45: the drop as the hook now makes it — not risen; its 3 px of space ride down with the banner too.
    const stored = placesToStore(dropAt(rule(), "connections", { col: 6, top: 904 }, GAP), {}, [], "connections", 0, GAP);
    expect(stored.connections).toEqual({ col: 6, top: 904, space: 3 });
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
    expect(code(read("src", "components", "tiles", "tile-areas.tsx"))).toContain("useTilePacking(areaRef, { fitWidest: true, entity, right })");
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
    // #37.79 had „The action bar under every tile that is not fixed, the left area's width" (units 7). Inverted by
    // #38.47: under every tile, the fixed ones too, across the whole row — here „Conexiuni" is still the lowest.
    expect(placeOf(placed, "actions")).toMatchObject({ col: 0, units: 10, top: 465 + 363 + GAP });
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
    const stored = placesToStore(placed, {}, [], "connections", 0, GAP);
    // #38.45: with the space left above it — 792 against „Puncte de contur"'s 394 + 341 + PANEL_GAP.
    expect(stored.connections).toEqual({ col: 7, top: 792, space: 792 - (394 + 341 + GAP) });
    expect(Object.keys(stored).some((id) => id.startsWith(FIXED_PREFIX))).toBe(false);
    expect(isStorable(`${FIXED_PREFIX}map`)).toBe(false);
  });

  it("read back beside the column, a place under it holds; with the column wrapped it falls back and is not written over", () => {
    const beside = placeWithStored(PROPERTY, { connections: { col: 7, top: 792 } }, 10, GAP, 7);
    // #38.16: under the column, and risen right under „Puncte de contur" (394 + 341 + PANEL_GAP) — an entry
    // with no `space`, as every one stored before #38.45 is, closes the gap above it.
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

  // Slice 40.32: the right-hand tiles are boxes like the others, starting at the right edge while nothing is stored.
  it("the hook gives the right-hand tiles a starting place at the right edge, and no fixed boxes any more", () => {
    const src = code(read("src", "components", "tiles", "use-tile-packing.ts"));
    expect(src).toContain("const starting = rightBoxes.filter((b) => !stored[b.id] && !visit[b.id]);");
    expect(src).toContain("start.set(b.id, { col: ownColumns - units, top });");
    expect(src).toContain("const beside = fitsBeside(leftUnits, starting.map(own), ownColumns);");
    expect(src).toContain("placeWithStored(items, { ...stored, ...visit }, columns, gap, flowColumns)");
    expect(src).not.toMatch(/fixedNow|rightRef|FIXED_PREFIX/);
    // The Property's map and corners are panels inside a `display: contents` tile wrapper: their boxes are „map#0".
    expect(src).toContain('const tileOf = (id: string) => id.replace(/^wrapped:/, "").replace(/#\\d+$/, "");');
    expect(src).toContain("const rightBoxes = rightNames.flatMap((n) => boxes.filter((b) => tileOf(b.id) === n));");
    // Another tile's drop stores every tile as it stands — but not a right-hand tile still at its start (TC-TILES-15
    // step 4: stored there, it no longer started, and „Street View" ticked later took its place).
    expect(src).toContain("const unmoved = startIds.filter((s) => !lasting.includes(s) && !(s in stored));");
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
    // #38.47: under every box, the fixed ones too (it read `!p.rowEnd && !p.fixed`).
    expect(placeOf(risen, "actions").top).toBe(Math.max(...risen.filter((p) => !p.rowEnd).map((p) => p.top + p.height)) + GAP);
    // A tile above the column's lowest tile, in its columns, rises past nothing below it.
    const high: Placed[] = [
      { id: `${FIXED_PREFIX}low`, col: 7, units: 3, top: 600, height: 100, fixed: true },
      { id: "t", col: 7, units: 3, top: 200, height: 100 },
    ];
    expect(placeOf(riseIntoGaps(high, GAP), "t").top).toBe(0);
    // A row end handed in is never taken for a tile. It expected `100 + GAP` — under „t" only, beside the fixed
    // tile; #38.47 puts the bar under every box, the fixed one too: 600 + 100 + GAP.
    expect(placeOf(riseIntoGaps([...high, { id: "bar", col: 0, units: 7, top: 5, height: 63, rowEnd: true }], GAP), "bar").top).toBe(600 + 100 + GAP);
  });

  it("the stored value is left untouched: a layout only reads it, and only a drop writes", () => {
    const stored = deepFreeze({ ...STACK, a: { ...STACK.a }, b: { ...STACK.b }, c: { ...STACK.c } });
    const before = JSON.stringify(stored);
    placeWithStored([A, C, BAR], stored, 10, GAP);
    expect(JSON.stringify(stored)).toBe(before);
    const src = code(read("src", "components", "tiles", "use-tile-packing.ts"));
    // In `store`, after a free drop or a double-click's rise (#38.45; #38.16's note read „in `end`, on a free drop").
    // 41.17: and a width set by a tile's edge — all through `persist`, the one write.
    expect(src.match(/writePlaces\(key, /g)).toHaveLength(1);
    expect(src).toContain("const persist = () => writePlaces(key, stored);");
    expect(src.match(/persist\(\);/g)).toHaveLength(3);
  });

  it("the hook no longer rises a dropped tile; it lays the row out — so rises — at every fresh layout", () => {
    // #38.16's title was „the hook rises a dropped tile at once", and it expected
    // `riseIntoGaps(dropAt(placed, d.box.id, d.place, gap), gap, lead,` in the hook. Inverted by #38.45:
    // a drop is `dropAt` alone, and the hook calls no `riseIntoGaps` at all.
    const src = code(read("src", "components", "tiles", "use-tile-packing.ts"));
    expect(src).toContain("placed = dropAt(placed, d.box.id, d.place, gap);");
    expect(src).not.toContain("riseIntoGaps(");
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

/**
 * Slice #38.45 — a drop leaves the space it made; a double-click rises one
 * tile; and the layout keeps the gap the user left. The same A over B over C,
 * 100 px each, in the first three units of a 10-unit row.
 */
describe("a drop leaves its space; a double-click rises one tile; a gap left on purpose is kept (#38.45)", () => {
  const A: PackBox = { id: "a", units: 3, height: 100 };
  const B: PackBox = { id: "b", units: 3, height: 100 };
  const C: PackBox = { id: "c", units: 3, height: 100 };
  const BAR: PackBox = { id: "actions", units: 1, height: 63, rowEnd: true };
  const STACK = { a: { col: 0, top: 0 }, b: { col: 0, top: 116 }, c: { col: 0, top: 232 } };
  const stack = () => placeWithStored([A, B, C, BAR], STACK, 10, GAP).placed;

  it("B dragged away: C stays where it stands, and the space B left stays empty", () => {
    const placed = dropAt(stack(), "b", { col: 6, top: 0 }, GAP);
    expect(at(placed, "c")).toMatchObject({ col: 0, top: 232 });
    expect(at(placed, "a")).toMatchObject({ col: 0, top: 0 });
    expect(at(placed, "b")).toMatchObject({ col: 6, top: 0 });
    // Stored with the space above C, so the next visit keeps the room too.
    const stored = placesToStore(placed, STACK, [], "b", 0, GAP);
    expect(stored.c).toEqual({ col: 0, top: 232, space: 232 - (100 + GAP) });
    const back = placeWithStored([A, B, C, BAR], parseStoredPlaces(JSON.stringify(stored)), 10, GAP).placed;
    expect(back.filter((p) => !p.rowEnd).map((p) => [p.id, p.col, p.top])).toEqual([["a", 0, 0], ["b", 6, 0], ["c", 0, 232]]);
  });

  it("a double-click rises that one tile right under the tile above it, in its own columns; nothing else moves", () => {
    const placed = dropAt(stack(), "b", { col: 6, top: 0 }, GAP);
    const risen = riseOne(placed, "c", GAP);
    expect(risen).not.toBeNull();
    expect(at(risen!, "c")).toMatchObject({ col: 0, top: 100 + GAP });
    for (const p of placed.filter((x) => x.id !== "c" && !x.rowEnd)) expect(at(risen!, p.id)).toEqual(p);
    // The action bar goes under everything.
    expect(at(risen!, "actions").top).toBe(Math.max(...risen!.filter((p) => !p.rowEnd).map(bottom)) + GAP);
    // Stored like a drop: right under „a", so no space.
    expect(placesToStore(risen!, STACK, [], "c", 0, GAP).c).toEqual({ col: 0, top: 116 });
  });

  it("it rises to the top of the row under the banners when nothing stands above it, and never sideways", () => {
    const placed: Placed[] = [
      { id: "box#0", col: 0, units: 10, top: 0, height: 40 },
      { id: "t", col: 4, units: 3, top: 500, height: 100 },
    ];
    expect(at(riseOne(placed, "t", GAP, 40 + GAP)!, "t")).toMatchObject({ col: 4, top: 40 + GAP });
    expect(at(riseOne(placed.slice(1), "t", GAP)!, "t")).toMatchObject({ col: 4, top: 0 });
  });

  it("under two side-by-side tiles it rises under the lower of the two", () => {
    const placed: Placed[] = [
      { id: "l", col: 0, units: 3, top: 0, height: 100 },
      { id: "r", col: 3, units: 3, top: 0, height: 300 },
      { id: "t", col: 2, units: 3, top: 700, height: 80 },
    ];
    expect(at(riseOne(placed, "t", GAP)!, "t")).toMatchObject({ col: 2, top: 300 + GAP });
  });

  it("under the right column it rises right under the lowest fixed tile; a fixed tile, the bar or a tile already there does not move", () => {
    const placed = dropAt(packTiles(PROPERTY, 10, GAP, 7), "connections", { col: 7, top: 1040 }, GAP);
    const risen = riseOne(placed, "connections", GAP)!;
    expect(placeOf(risen, "connections")).toMatchObject({ col: 7, top: 394 + 341 + GAP });
    expect(placeOf(risen, `${FIXED_PREFIX}corners`)).toMatchObject({ col: 7, top: 394 });
    expect(riseOne(risen, "connections", GAP)).toBeNull();
    expect(riseOne(placed, `${FIXED_PREFIX}corners`, GAP)).toBeNull();
    expect(riseOne(placed, "actions", GAP)).toBeNull();
    expect(riseOne(placed, "nothing", GAP)).toBeNull();
  });

  it("the layout rises a tile only by what a tile above gave up: the gap the user left keeps its size", () => {
    // C stored 60 px lower than right under B.
    const stored = { ...STACK, c: { col: 0, top: 232 + 60, space: 60 } };
    // On the record it was made on, nothing moves.
    expect(at(placeWithStored([A, B, C, BAR], stored, 10, GAP).placed, "c").top).toBe(292);
    // B 40 px shorter: C rises by those 40 px, 60 px still above it.
    const shorter = placeWithStored([A, { ...B, height: 60 }, C, BAR], stored, 10, GAP).placed;
    expect(at(shorter, "c").top).toBe(292 - 40);
    expect(at(shorter, "c").top - ceilingOf(shorter, at(shorter, "c"), GAP)).toBe(60);
    // B not shown: C rises by all B held — its height and its PANEL_GAP — and keeps its 60 px under A.
    const gone = placeWithStored([A, C, BAR], stored, 10, GAP).placed;
    expect(at(gone, "c").top).toBe(100 + GAP + 60);
    // B 80 px taller reaches into C's place: #37.75's growth rule pushes C just clear of it, and no further.
    const taller = placeWithStored([A, { ...B, height: 180 }, C, BAR], stored, 10, GAP).placed;
    expect(at(taller, "c").top).toBe(116 + 180 + GAP);
  });

  it("the space is read back checked: a corrupt one is dropped and the place still holds", () => {
    for (const space of ["-5", "0", "0.4", '"x"', "null", "1e9"]) {
      expect(parseStoredPlaces(`{"c":{"col":0,"top":292,"space":${space}}}`)).toEqual({ c: { col: 0, top: 292 } });
    }
    expect(parseStoredPlaces('{"c":{"col":0,"top":292,"space":59.6}}')).toEqual({ c: { col: 0, top: 292, space: 60 } });
  });

  it("a stored place counts its space from under the banners; none is stored for a tile right under another", () => {
    const placed: Placed[] = [
      { id: "box#0", col: 0, units: 10, top: 0, height: 40 },
      { id: "a", col: 0, units: 3, top: 56, height: 100 },
      { id: "c", col: 0, units: 3, top: 56 + 100 + GAP + 24, height: 100 },
    ];
    expect(storedPlaceOf(placed, placed[1], GAP, 56)).toEqual({ col: 0, top: 0 });
    expect(storedPlaceOf(placed, placed[2], GAP, 56)).toEqual({ col: 0, top: 140, space: 24 });
  });

  it("the hook rises on a double-click on the drag surface only, and stores the result", () => {
    const src = code(read("src", "components", "tiles", "use-tile-packing.ts"));
    expect(src).toContain('container.addEventListener("dblclick", onDouble)');
    expect(src).toMatch(/const onDouble = [\s\S]*?isDragSurface\(e\.target, e\.clientX, e\.clientY, box\.el\)[\s\S]*?riseOne\(placed, box\.id, metrics\(\)\.gap, lead\)[\s\S]*?store\(box\.id\)/);
    expect(src).toContain('container.removeEventListener("dblclick", onDouble)');
  });
});

/**
 * Slice #38.46 — a tile can be dropped under „Interacțiuni", beside the left
 * area or wrapped under it. The persons' boxes as measured by the browser on a
 * blank Natural Person and Judicial Person (units; heights in px): at 1920 px
 * the row is 10 units, the left area 6, „Interacțiuni" fixed at col 6; at
 * 1366 px the row is 6 units, and the column — 4 units beside a left area
 * whose widest tile is 4 — no longer fits, so it wraps.
 */
describe("a tile dropped under „Interacțiuni”, beside or wrapped (#38.46)", () => {
  const NP_LEFT: PackBox[] = [
    { id: "identity", units: 3, height: 370 },
    { id: "idCard", units: 3, height: 398 },
    { id: "contact", units: 2, height: 364 },
    { id: "addresses#0", units: 3, height: 342 },
    { id: "addresses#1", units: 3, height: 294 },
    { id: "related", units: 4, height: 184 },
    { id: "classification", units: 3, height: 313 },
    { id: "connections", units: 3, height: 383 },
  ];
  const JP_LEFT: PackBox[] = [
    { id: "identity", units: 3, height: 306 },
    { id: "contactPersons", units: 2, height: 360 },
    { id: "addresses#0", units: 3, height: 366 },
    { id: "addresses#1", units: 3, height: 294 },
    { id: "related", units: 4, height: 184 },
    { id: "classification", units: 3, height: 313 },
    { id: "connections", units: 3, height: 383 },
  ];
  const BAR: PackBox = { id: "actions", units: 1, height: 63, rowEnd: true };
  const INTER = 436;
  const beside = (left: PackBox[]): PackBox[] => [{ id: `${FIXED_PREFIX}interactions`, units: 4, height: INTER, fixed: { col: 6, top: 0 } }, ...left, BAR];
  const wrapped = (left: PackBox[]): PackBox[] => [...left, { id: `${WRAPPED_PREFIX}interactions`, units: 4, height: INTER, under: true }, BAR];

  it.each([
    ["Persoană fizică", NP_LEFT],
    ["Persoană juridică", JP_LEFT],
  ] as const)("%s at 1920: canDrop accepts a place under „Interacțiuni”, and the place holds after a reload", (_name, left) => {
    const placed = placeWithStored(beside([...left]), {}, 10, GAP, 6).placed;
    const tile = left[1].id;
    const place = { col: 6, top: INTER + GAP + 40 };
    expect(canDrop(placed, tile, place, 10, GAP)).toBe(true);
    const stored = placesToStore(dropAt(placed, tile, place, GAP), {}, [], tile, 0, GAP);
    const back = placeWithStored(beside([...left]), parseStoredPlaces(JSON.stringify(stored)), 10, GAP, 6);
    expect(back.fallback).toEqual([]);
    expect(at(back.placed, tile)).toMatchObject({ col: 6, top: INTER + GAP + 40 });
  });

  it.each([
    ["Persoană fizică", NP_LEFT],
    ["Persoană juridică", JP_LEFT],
  ] as const)("%s at 1366, the column wrapped: „Interacțiuni” stands under the left tiles, the bar under it, and a tile dropped under it stays there", (_name, left) => {
    const placed = placeWithStored(wrapped([...left]), {}, 6, GAP).placed;
    const inter = at(placed, `${WRAPPED_PREFIX}interactions`);
    // Its own line, from the left edge, under every left tile in its columns.
    expect(inter.col).toBe(0);
    for (const p of placed.filter((x) => !x.rowEnd && x.id !== inter.id && x.col < inter.col + inter.units)) expect(p.top + p.height + GAP).toBeLessThanOrEqual(inter.top);
    expect(at(placed, "actions").top).toBeGreaterThanOrEqual(inter.top + INTER + GAP);
    // Dropped under it, at the left edge.
    const tile = left[1].id;
    const place = { col: 0, top: inter.top + INTER + GAP + 40 };
    expect(canDrop(placed, tile, place, 6, GAP)).toBe(true);
    const dropped = dropAt(placed, tile, place, GAP);
    expect(at(dropped, "actions").top).toBe(place.top + at(dropped, tile).height + GAP);
    // The wrapped tile's place is stored with the rest, so after a reload the dropped tile is still under it.
    const stored = placesToStore(dropped, {}, [], tile, 0, GAP);
    expect(stored[`${WRAPPED_PREFIX}interactions`]).toMatchObject({ col: 0, top: inter.top });
    const back = placeWithStored(wrapped([...left]), parseStoredPlaces(JSON.stringify(stored)), 6, GAP).placed;
    expect(at(back, `${WRAPPED_PREFIX}interactions`).top).toBe(inter.top);
    expect(at(back, tile)).toMatchObject({ col: 0, top: place.top });
  });

  it("a wrapped column's tile is storable, a fixed one is not; an arrangement stored beside is not rewritten when it wraps", () => {
    expect(isStorable(`${WRAPPED_PREFIX}interactions`)).toBe(true);
    expect(isStorable(`${FIXED_PREFIX}interactions`)).toBe(false);
    const stored = placesToStore(placeWithStored(beside([...NP_LEFT]), {}, 10, GAP, 6).placed, {}, [], "identity", 0, GAP);
    const r = placeWithStored(wrapped([...NP_LEFT]), stored, 6, GAP);
    // Read only: the wrapped tile is placed by the rule, under everything in its columns.
    expect(JSON.stringify(stored)).not.toContain(WRAPPED_PREFIX);
    const inter = at(r.placed, `${WRAPPED_PREFIX}interactions`);
    for (const p of r.placed.filter((x) => !x.rowEnd && x.id !== inter.id && x.col < inter.col + inter.units)) expect(p.top + p.height + GAP).toBeLessThanOrEqual(inter.top);
  });

  it("the hook decides beside or wrapped itself, takes the wrapped column out of the flow, and watches the row's width", () => {
    const src = code(read("src", "components", "tiles", "use-tile-packing.ts"));
    // Slice 40.32: one area — the right-hand tiles that start wrapped are boxes `wrapped:<id>`, under the left ones.
    expect(src).toContain("const beside = fitsBeside(leftUnits, starting.map(own), ownColumns);");
    expect(src).toContain("const id = `${WRAPPED_PREFIX}${b.id}`;");
    expect(src).toContain("under: true");
    // Dragged like any tile since 40.32: the drag looks among every box of the area.
    expect(src).toContain("boxes.find((b) => !b.rowEnd && !b.full && b.el.contains(target))");
  });
});

/**
 * Slice 39.91 — a tile held over another makes room. A 10-unit row: A over B
 * over C in the first three units, 100 px each, PANEL_GAP apart; D beside
 * them at col 6. Adrian: „that tile should slide down until it finds an
 * available spot, large enough, to make room for me to drop off the tile I am
 * moving".
 */
describe("a tile held over another makes room: the tile under it slides down to the first free place (39.91)", () => {
  const box = (id: string, height = 100, units = 3): PackBox => ({ id, units, height });
  const BAR: PackBox = { id: "actions", units: 1, height: 63, rowEnd: true };
  const STACK = { a: { col: 0, top: 0 }, b: { col: 0, top: 116 }, c: { col: 0, top: 232 }, d: { col: 6, top: 0 } };
  const lay = (extra: PackBox[] = [], stored: Record<string, { col: number; top: number; space?: number }> = STACK) =>
    placeWithStored([box("a"), box("b"), box("c"), box("d"), ...extra, BAR], stored, 10, GAP).placed;

  it("the tile under the outline slides down in its own columns, past the tiles under it, to where it fits whole", () => {
    const placed = lay();
    expect(canDrop(placed, "d", { col: 0, top: 0 }, 10, GAP)).toBe(false);
    const r = makeRoom(placed, "d", { col: 0, top: 0 }, 10, GAP);
    expect(r?.slid).toEqual(["a"]);
    const after = r!.placed;
    // Not pushed onto B or C: it jumps past both, to under C.
    expect(at(after, "a")).toMatchObject({ col: 0, top: 348 });
    expect(at(after, "b")).toMatchObject({ col: 0, top: 116 });
    expect(at(after, "c")).toMatchObject({ col: 0, top: 232 });
    expect(at(after, "d")).toMatchObject({ col: 6, top: 0 }); // the dragged tile itself moves only on its drop
    // The outline now shows the place free, and the drop is accepted.
    expect(canDrop(after, "d", { col: 0, top: 0 }, 10, GAP)).toBe(true);
    // The action bar under everything, as after a drop.
    expect(at(after, "actions").top).toBe(348 + 100 + GAP);
  });

  it("it takes the first free place below, not the lowest: a hole large enough is used", () => {
    // C lower, leaving a 216-px hole under B (kept on purpose, #38.45's space): A slides into it, under B.
    const placed = lay([], { ...STACK, c: { col: 0, top: 448, space: 216 } });
    expect(at(placed, "c").top).toBe(448);
    const after = makeRoom(placed, "d", { col: 0, top: 0 }, 10, GAP)!.placed;
    expect(at(after, "a")).toMatchObject({ col: 0, top: 232 });
    // A hole one pixel too small is not used.
    const tight = lay([], { ...STACK, c: { col: 0, top: 347, space: 115 } });
    expect(at(makeRoom(tight, "d", { col: 0, top: 0 }, 10, GAP)!.placed, "a").top).toBe(347 + 100 + GAP);
  });

  it("every tile the outline overlaps slides, top to bottom, each keeping its column and its order", () => {
    const placed = lay([box("e", 200)], { ...STACK, e: { col: 6, top: 116 } });
    const r = makeRoom(placed, "e", { col: 0, top: 0 }, 10, GAP)!;
    expect(r.slid).toEqual(["a", "b"]);
    expect(at(r.placed, "a")).toMatchObject({ col: 0, top: 348 });
    expect(at(r.placed, "b")).toMatchObject({ col: 0, top: 464 });
    expect(at(r.placed, "c")).toMatchObject({ col: 0, top: 232 });
    expect(canDrop(r.placed, "e", { col: 0, top: 0 }, 10, GAP)).toBe(true);
  });

  it("never sideways, never up: a tile reaching only partly under the outline still slides straight down", () => {
    // A 3-unit outline at col 2 overlaps A (cols 0–2) by one unit.
    const placed = lay();
    const after = makeRoom(placed, "d", { col: 2, top: 0 }, 10, GAP)!.placed;
    expect(at(after, "a").col).toBe(0);
    expect(at(after, "a").top).toBeGreaterThan(0);
    for (const p of after) expect(p.top).toBeGreaterThanOrEqual(at(placed, p.id).top);
  });

  it("the dragged tile's own place counts as taken: nothing slides into it, so Esc still has it to go back to", () => {
    // B dragged up over A: A would fit at 116, where B stood — it jumps past that too.
    const placed = lay();
    const after = makeRoom(placed, "b", { col: 0, top: 0 }, 10, GAP)!.placed;
    expect(at(after, "a").top).toBe(348);
    expect(at(after, "b")).toMatchObject({ col: 0, top: 116 });
  });

  it("a fixed box, a banner or a wrapped column tile never slides: the outline stays red", () => {
    const fixed: PackBox = { id: `${FIXED_PREFIX}map`, units: 3, height: 300, fixed: { col: 7, top: 0 } };
    const placed = placeWithStored([box("a"), box("d"), box("f"), fixed, BAR], { a: { col: 0, top: 0 }, d: { col: 0, top: 116 }, f: { col: 4, top: 0 } }, 10, GAP).placed;
    expect(at(placed, "f")).toMatchObject({ col: 4, top: 0 });
    expect(makeRoom(placed, "d", { col: 7, top: 0 }, 10, GAP)).toBeNull();
    // Over a tile and a fixed box at once: neither slides, since the place could not be freed.
    expect(makeRoom(placed, "d", { col: 5, top: 0 }, 10, GAP)).toBeNull();
    // Over the tile alone, it does.
    expect(makeRoom(placed, "d", { col: 4, top: 0 }, 10, GAP)?.slid).toEqual(["f"]);
    expect(makeRoom(lay(), "d", { col: 0, top: 0 }, 10, GAP, new Set(["a"]))).toBeNull();
  });

  it("no room to make where the place is free, past the row's units, or for a fixed or row-end box", () => {
    const placed = lay();
    expect(makeRoom(placed, "d", { col: 6, top: 500 }, 10, GAP)).toBeNull();
    expect(makeRoom(placed, "d", { col: 8, top: 0 }, 10, GAP)).toBeNull(); // 8 + 3 > 10
    expect(makeRoom(placed, "actions", { col: 0, top: 0 }, 10, GAP)).toBeNull();
    expect(makeRoom(placed, "nobody", { col: 0, top: 0 }, 10, GAP)).toBeNull();
  });

  it("held again over the tile that slid, it slides again; nothing slides back up", () => {
    const placed = lay();
    const once = makeRoom(placed, "d", { col: 0, top: 0 }, 10, GAP)!.placed;
    const twice = makeRoom(once, "d", { col: 0, top: 348 }, 10, GAP)!.placed;
    expect(at(twice, "a").top).toBe(348 + 100 + GAP);
    expect(at(twice, "b").top).toBe(116);
  });

  it("a drop stores the dropped tile and every tile that made room, as one — a fallback among them too", () => {
    const placed = lay();
    const after = dropAt(makeRoom(placed, "d", { col: 0, top: 0 }, 10, GAP)!.placed, "d", { col: 0, top: 0 }, GAP);
    const stored = placesToStore(after, STACK, ["a"], ["d", "a"], 0, GAP);
    expect(stored.d).toEqual({ col: 0, top: 0 });
    expect(stored.a).toEqual({ col: 0, top: 348 });
    const back = placeWithStored([box("a"), box("b"), box("c"), box("d"), BAR], parseStoredPlaces(JSON.stringify(stored)), 10, GAP).placed;
    expect(back.filter((p) => !p.rowEnd).map((p) => [p.id, p.col, p.top]).sort()).toEqual(
      [["a", 0, 348], ["b", 0, 116], ["c", 0, 232], ["d", 0, 0]],
    );
    // A single id still works as before (#38.45): a fallback that was not moved is kept.
    expect(placesToStore(after, STACK, ["a"], "d", 0, GAP).a).toEqual(STACK.a);
  });

  it("the delay is one value, 1,0 s, read through one function; the slide is 200 ms", () => {
    expect(MAKE_ROOM_DELAY_MS).toBe(1000);
    expect(MAKE_ROOM_SLIDE_MS).toBe(200);
    const fn = code(read("src", "components", "tiles", "make-room-delay.ts"));
    expect(fn).toContain("export function makeRoomDelayMs(): number");
    // Nothing else reads the constant: 39.92 points the one function at „Setări".
    const hook = code(read("src", "components", "tiles", "use-tile-packing.ts"));
    expect(hook).not.toContain("MAKE_ROOM_DELAY_MS");
    expect(hook).toContain("window.setTimeout(makeRoomNow, makeRoomDelayMs())");
  });

  it("the hook counts on the snapped place, undoes on Esc or a refused release, and stores with the drop", () => {
    const src = code(read("src", "components", "tiles", "use-tile-packing.ts"));
    expect(src).toMatch(/if \(at !== drag\.held\) \{[\s\S]*?window\.clearTimeout\(hold\);[\s\S]*?if \(!drag\.free\) hold = /);
    expect(src).toContain("const r = makeRoom(placed, d.box.id, d.place, columns, metrics().gap, still);");
    expect(src).toContain("d.before ??= placed;");
    expect(src).toContain("store(d.box.id, d.slid);");
    expect(src).toMatch(/\} else if \(d\.before\) \{[\s\S]*?placed = d\.before;/);
    expect(src).toContain('"(prefers-reduced-motion: reduce)"');
    // The banners never slide; since 40.32 the right-hand tiles do, like any tile.
    expect(src).toContain("const still = new Set(boxes.filter((b) => b.full).map((b) => b.id));");
    // The rule's header says the new rule and quotes the old one.
    const pure = read("src", "lib", "ui", "tile-positions.ts");
    expect(pure).toContain("„It never pushes another — to put it where another tile");
    expect(pure).toContain("`makeRoom`, Slice 39.91");
  });
});

/**
 * Slice 40.32 — the right-hand tiles start at the right edge and move like any tile (`PackBox.start`).
 * A property at 10 units: two left tiles in the flow's 7, the map and the corners starting at column 7.
 */
describe("the right-hand tiles start at the right edge, and move (40.32)", () => {
  const GAP40 = 16;
  const BOXES: PackBox[] = [
    { id: "identity", units: 4, height: 300 },
    { id: "related", units: 3, height: 200 },
    { id: "map", units: 3, height: 378, start: { col: 7, top: 0 } },
    { id: "corners", units: 3, height: 341, start: { col: 7, top: 394 } },
  ];
  const at = (placed: readonly { id: string; col: number; top: number }[], id: string) => placed.find((p) => p.id === id)!;

  it("with nothing stored they stand at their starting places, the flow left of them — as the column stood", () => {
    const { placed } = placeWithStored(BOXES, {}, 10, GAP40, 7);
    expect(at(placed, "map")).toMatchObject({ col: 7, top: 0 });
    expect(at(placed, "corners")).toMatchObject({ col: 7, top: 394 });
    expect(at(placed, "identity")).toMatchObject({ col: 0, top: 0 });
    expect(at(placed, "related")).toMatchObject({ col: 4, top: 0 });
    expect(placed.some((p) => p.fixed)).toBe(false);
  });

  it("a stored place wins over the start: dragged left, the map stays there, and its place is stored", () => {
    const { placed } = placeWithStored(BOXES, { map: { col: 0, top: 316 } }, 10, GAP40, 7);
    expect(at(placed, "map")).toMatchObject({ col: 0, top: 316 });
    // The corners keep their column; with the map gone from above them they rise (the hook starts them at 0 then).
    expect(at(placed, "corners")).toMatchObject({ col: 7, top: 0 });
    expect(isStorable("map")).toBe(true);
    const stored = placesToStore(placed, {}, [], "map", 0, GAP40);
    expect(stored.map).toMatchObject({ col: 0, top: 316 });
  });

  it("they can be dropped and can make room, like any tile — a fixed box could do neither", () => {
    const { placed } = placeWithStored(BOXES, {}, 10, GAP40, 7);
    expect(canDrop(placed, "map", { col: 7, top: 800 }, 10, GAP40)).toBe(true);
    expect(canDrop(placed, "corners", { col: 4, top: 300 }, 10, GAP40)).toBe(true);
    expect(makeRoom(placed, "identity", { col: 6, top: 0 }, 10, GAP40)).not.toBeNull();
  });

  it("an arrangement stored before 40.32 names none of them: they open at their starts, nothing is lost", () => {
    const { placed, fallback } = placeWithStored(BOXES, { related: { col: 0, top: 316 }, [`${FIXED_PREFIX}map`]: { col: 2, top: 2 } }, 10, GAP40, 7);
    expect(at(placed, "related")).toMatchObject({ col: 0, top: 316 });
    expect(at(placed, "map")).toMatchObject({ col: 7, top: 0 });
    expect(fallback).toEqual([]);
  });

  it("packTiles places a start too, and the flow never into it", () => {
    const placed = packTiles(BOXES, 10, GAP40, 7);
    expect(at(placed, "map")).toMatchObject({ col: 7, top: 0 });
    expect(placed.filter((p) => p.col + p.units > 7).map((p) => p.id).sort()).toEqual(["corners", "map"]);
  });
});

describe("„Toate sus”: every tile up, then the columns evened (40.40)", () => {
  // Two columns of 3 units in a 6-unit row; heights in px; GAP is PANEL_GAP.
  const tile = (id: string, col: number, top: number, height: number, units = 3): Placed => ({ id, col, units, top, height });
  const bar: Placed = { id: "actions", col: 0, units: 6, top: 2000, height: 63, rowEnd: true };

  it("the rise closes the gap above every tile, top to bottom, each under the one risen before it", () => {
    // One column (a 3-unit row), so there is nothing to even.
    const placed = [tile("a", 0, 100, 200), tile("b", 0, 500, 100), tile("c", 0, 700, 150), bar];
    const r = allUp(placed, 3, GAP)!;
    expect(at(r.placed, "a").top).toBe(0);
    expect(at(r.placed, "b").top).toBe(200 + GAP);
    expect(at(r.placed, "c").top).toBe(200 + GAP + 100 + GAP);
    expect(r.moved.sort()).toEqual(["a", "b", "c"]);
    // The action bar under everything.
    expect(at(r.placed, "actions").top).toBe(200 + GAP + 100 + GAP + 150 + GAP);
  });

  it("then evens: a column left taller than another after the rise gives up its bottom tile", () => {
    const placed = [tile("a", 0, 100, 200), tile("b", 0, 500, 100), tile("c", 3, 40, 150), bar];
    const r = allUp(placed, 6, GAP)!;
    expect(at(r.placed, "a")).toMatchObject({ col: 0, top: 0 });
    expect(at(r.placed, "c")).toMatchObject({ col: 3, top: 0 });
    // After the rise „b" stood at 216 under „a" (bottom 316, against 150): under „c" its bottom is 266.
    expect(at(r.placed, "b")).toMatchObject({ col: 3, top: 150 + GAP });
  });

  it("two columns 600 / 300 px: the tall one's bottom tile goes under the short one — one move", () => {
    const placed = [tile("t1", 0, 0, 400), tile("t2", 0, 416, 184), tile("u1", 3, 0, 300), bar];
    expect(tileColumns(placed).map((c) => c.bottom)).toEqual([600, 300]);
    const even = evenColumns(placed, 6, GAP);
    expect(at(even, "t2")).toMatchObject({ col: 3, top: 300 + GAP });
    expect(at(even, "t1")).toMatchObject({ col: 0, top: 0 });
    expect(at(even, "u1")).toMatchObject({ col: 3, top: 0 });
    expect(tileColumns(even).map((c) => c.bottom)).toEqual([400, 500]);
    // Moving it back would make the lowest bottom lower again: the evening stopped after one move.
    expect(allUp(placed, 6, GAP)!.moved).toEqual(["t2"]);
  });

  it("a tile too wide for the short column is left where it is", () => {
    const placed = [tile("t1", 0, 0, 400), tile("t2", 0, 416, 184, 4), tile("u1", 4, 0, 300, 2), bar];
    const tiles = (ps: readonly Placed[]) => ps.filter((p) => !p.rowEnd).map(({ id, col, top }) => ({ id, col, top }));
    expect(tiles(evenColumns(placed, 6, GAP))).toEqual(tiles(placed));
  });

  it("no move when it would not make the lowest bottom higher; a press with nothing to move moves nothing", () => {
    const placed = [tile("t", 0, 0, 600), tile("u", 3, 0, 300), bar];
    expect(at(evenColumns(placed, 6, GAP), "t")).toMatchObject({ col: 0, top: 0 });
    expect(allUp(placed, 6, GAP)).toBeNull();
  });

  it("tries the next shortest column when the shortest has no room across", () => {
    // Three columns: the shortest (col 4, 2 units) cannot take a 3-unit tile; the next shortest (col 2) can.
    const placed = [
      tile("t1", 0, 0, 500, 2),
      tile("t2", 0, 516, 200, 3),
      tile("m", 2, 0, 250, 2),
      tile("s", 4, 0, 100, 2),
      bar,
    ];
    const even = evenColumns(placed, 6, GAP);
    expect(at(even, "t2")).toMatchObject({ col: 2, top: 250 + GAP });
  });

  it("the banners never move, and every tile rises to under them", () => {
    const placed = [{ id: "box#0", col: 0, units: 6, top: 0, height: 40 }, tile("a", 0, 300, 100), bar];
    const r = allUp(placed, 6, GAP, 40 + GAP, new Set(["box#0"]))!;
    expect(at(r.placed, "box#0").top).toBe(0);
    expect(at(r.placed, "a").top).toBe(40 + GAP);
    expect(r.moved).toEqual(["a"]);
  });

  it("is a window event like „Implicit”'s, heard by the packing hook, slid and stored like a drop", () => {
    expect(TILES_ALL_UP).toBe("ga40-tiles-all-up");
    const hook = code(read("src", "components", "tiles", "use-tile-packing.ts"));
    expect(hook).toContain("window.addEventListener(TILES_ALL_UP, onAllUp);");
    expect(hook).toContain("const r = allUp(placed, columns, metrics().gap, lead, still);");
    expect(hook).toMatch(/slide\(r\.moved\);\s*store\(r\.moved\[0\], r\.moved\.slice\(1\)\);\s*apply\(\);/);
    const choice = code(read("src", "components", "tiles", "use-tile-choice.ts"));
    expect(choice).toContain("window.dispatchEvent(new CustomEvent(TILES_ALL_UP, { detail: reg.entity }));");
  });
});
