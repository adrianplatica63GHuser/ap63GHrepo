/**
 * Slice 41.17 — a tile's width dragged by its right edge, snapping to whole units, and remembered.
 *
 * The pure half: the snap, the limits, the tiles a wider tile pushes down, and the width stored beside the place.
 * The handle itself (use-tile-packing.ts) is driven by e2e/tiles/tile-width-drag.spec.ts.
 */
import { readFileSync } from "fs";
import { join } from "path";
import type { Placed } from "@/lib/ui/tile-packing";
import {
  MAX_UNITS,
  WIDTH_SNAP_AT,
  parseStoredPlaces,
  placesToStore,
  resizeTile,
  snapUnits,
  unitsAtLeast,
  widthLimits,
  withStoredWidth,
} from "@/lib/ui/tile-positions";
import { declaredWidthPx, exactUnitsCss } from "@/lib/ui/field-widths";

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const U = 119;
const G = 16;
const STEP = U + G;

describe("the snap (Ask first 2)", () => {
  it("a quarter of a unit either way moves a 3-unit tile one unit — Adrian's 3 → 2 and 3 → 4", () => {
    expect(WIDTH_SNAP_AT).toBe(0.25);
    expect(snapUnits(3, -0.25 * STEP, U, G, 1, 8)).toBe(2);
    expect(snapUnits(3, 0.25 * STEP, U, G, 1, 8)).toBe(4);
    expect(snapUnits(3, -STEP / 3, U, G, 1, 8)).toBe(2);
    expect(snapUnits(3, STEP / 3, U, G, 1, 8)).toBe(4);
  });

  it("under a quarter it stays; past that it is the nearest whole unit", () => {
    expect(snapUnits(3, 0.24 * STEP, U, G, 1, 8)).toBe(3);
    expect(snapUnits(3, -0.24 * STEP, U, G, 1, 8)).toBe(3);
    expect(snapUnits(3, 1.4 * STEP, U, G, 1, 8)).toBe(4);
    expect(snapUnits(3, 1.6 * STEP, U, G, 1, 8)).toBe(5);
    expect(snapUnits(3, -1.6 * STEP, U, G, 1, 8)).toBe(1);
  });

  it("never past the limits", () => {
    expect(snapUnits(3, -5 * STEP, U, G, 2, 8)).toBe(2);
    expect(snapUnits(3, 9 * STEP, U, G, 1, 6)).toBe(6);
    expect(snapUnits(3, -0.3 * STEP, U, G, 3, 8)).toBe(3);
  });

  it("works on any unit (41.16)", () => {
    expect(snapUnits(3, 0.3 * (100 + G), 100, G, 1, 8)).toBe(4);
    expect(unitsAtLeast(389, U, G)).toBe(3);
    expect(unitsAtLeast(390, U, G)).toBe(4);
    expect(unitsAtLeast(0, U, G)).toBe(1);
  });
});

const tile = (id: string, col: number, units: number, top: number, height: number, extra: Partial<Placed> = {}): Placed => ({ id, col, units, top, height, ...extra });

describe("the limits (Ask first 4)", () => {
  const row = [tile("a", 0, 3, 0, 200), tile("b", 3, 3, 0, 100)];

  it("never under its content's units nor one unit; never past the row's end on this window", () => {
    expect(widthLimits(row, "a", 2, 8, G)).toEqual({ min: 2, max: 8 });
    expect(widthLimits(row, "b", 1, 8, G)).toEqual({ min: 1, max: 5 });
    expect(widthLimits(row, "a", 0, 8, G).min).toBe(1);
  });

  it("its own width is always inside them", () => {
    expect(widthLimits(row, "a", 5, 8, G).min).toBe(3);
    expect(widthLimits([tile("a", 4, 6, 0, 100)], "a", 1, 8, G).max).toBe(6);
  });

  it("never across a fixed box or one that holds still", () => {
    const withFixed = [tile("a", 0, 3, 0, 200), tile("fixed:x", 5, 3, 0, 100, { fixed: true })];
    expect(widthLimits(withFixed, "a", 1, 8, G).max).toBe(5);
    const withStill = [tile("a", 0, 3, 0, 200), tile("s", 6, 2, 50, 100)];
    expect(widthLimits(withStill, "a", 1, 8, G, new Set(["s"])).max).toBe(6);
  });
});

describe("a wider tile makes room, a narrower one leaves it (Ask first 5)", () => {
  it("the tile it now overlaps slides down out of its way, never sideways", () => {
    const placed = [tile("a", 0, 3, 0, 200), tile("b", 3, 3, 0, 100)];
    const r = resizeTile(placed, "a", 4, 8, G);
    expect(r.slid).toEqual(["b"]);
    const b = r.placed.find((p) => p.id === "b")!;
    expect([b.col, b.top]).toEqual([3, 200 + G]);
    expect(r.placed.find((p) => p.id === "a")!.units).toBe(4);
  });

  it("a narrower tile moves nothing", () => {
    const placed = [tile("a", 0, 3, 0, 200), tile("b", 3, 3, 0, 100)];
    const r = resizeTile(placed, "a", 2, 8, G);
    expect(r.slid).toEqual([]);
    expect(r.placed.map((p) => [p.id, p.col, p.units, p.top])).toEqual([["a", 0, 2, 0], ["b", 3, 3, 0]]);
  });
});

describe("remembered with the place (Ask first 6)", () => {
  it("an entry carries its width in units; one without is the screen's own — every arrangement stored before 41.17", () => {
    const raw = JSON.stringify({ a: { col: 0, top: 0 }, b: { col: 3, top: 40, units: 4 }, c: { col: 1, top: 0, units: 0 }, d: { col: 1, top: 0, units: 2.5 } });
    expect(parseStoredPlaces(raw)).toEqual({ a: { col: 0, top: 0 }, b: { col: 3, top: 40, units: 4 }, c: { col: 1, top: 0 }, d: { col: 1, top: 0 } });
    expect(parseStoredPlaces(JSON.stringify({ a: { col: 0, top: 0, units: MAX_UNITS + 1 } }))).toEqual({ a: { col: 0, top: 0 } });
  });

  it("a place written anew keeps its stored width; a width is set or forgotten only by its own edge", () => {
    const placed = [tile("a", 0, 4, 0, 200), tile("b", 4, 3, 0, 100)];
    const out = placesToStore(placed, { a: { col: 0, top: 0, units: 4 } }, [], "b");
    expect(out.a).toEqual({ col: 0, top: 0, units: 4 });
    expect(out.b).toEqual({ col: 4, top: 0 });
    expect(withStoredWidth(out, "b", 2).b).toEqual({ col: 4, top: 0, units: 2 });
    expect(withStoredWidth(out, "a", undefined).a).toEqual({ col: 0, top: 0 });
    expect(withStoredWidth(out, "zz", 2)).toEqual(out);
  });

  it("drawn in live units, so a unit changed on „Setări” keeps the count (41.16)", () => {
    expect(exactUnitsCss(4)).toBe("calc(4 * var(--unit, 7.4375rem) + 3rem)");
    expect(declaredWidthPx(exactUnitsCss(4), 119)).toBe(524);
    expect(declaredWidthPx(exactUnitsCss(4), 100)).toBe(448);
  });
});

describe("the handle (Ask first 1, 7)", () => {
  const src = read("src", "components", "tiles", "use-tile-packing.ts");

  it("is a focusable separator on the tile's right edge, in the row, not inside the tile", () => {
    expect(src).toContain('h.setAttribute("role", "separator");');
    expect(src).toContain('h.setAttribute("aria-orientation", "vertical");');
    expect(src).toContain("h.tabIndex = 0;");
    expect(src).toContain("export const TILE_HANDLE_PX = 8;");
    expect(src).toMatch(/TILE_HANDLE_CLASS = "[^"]*cursor-col-resize/);
    expect(src).toContain("child.dataset.tileHandle !== undefined");
    expect(src).toContain("h.setPointerCapture?.(e.pointerId);");
  });

  it("Left and Right step one unit, Home or a double-click gives its own width back", () => {
    expect(src).toMatch(/e\.key !== "ArrowLeft" && e\.key !== "ArrowRight" && e\.key !== "Home"/);
    expect(src).toContain('if (e.key === "Home") return toOwn(id);');
    expect(src).toMatch(/addEventListener\("dblclick", \(e\) => \{[\s\S]{0,80}toOwn\(id\);/);
  });

  it("only on a tile the arrangement stores — not a banner, a fixed box, a preview", () => {
    expect(src).toContain("const canResize = (b: FoundBox) => !b.full && !b.rowEnd && isStorable(b.id);");
  });

  it("is named in both languages", () => {
    const ro = JSON.parse(read("messages", "ro-RO.json")).shared.tileWidth;
    const en = JSON.parse(read("messages", "en-GB.json")).shared.tileWidth;
    expect(ro.handle).toBe("Lățimea panoului {title}");
    expect(ro.units).toBe("{count, plural, one {# unitate} few {# unități} other {# de unități}}");
    // 41.18 added what the drag says: `refused` and `advised`.
    // 41.19: and the shared tiles' line and the forms' names.
    expect(Object.keys(en).sort()).toEqual(["advised", "forms", "handle", "refused", "shared", "units"]);
  });
});
