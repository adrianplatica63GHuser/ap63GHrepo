/**
 * Slice 41.71 — the person's „Arbore de moștenire" tile, as wide as its family (`@/lib/inheritance/tile-size`):
 * one or two persons → 2 units at level 2, three or more → 3 units at level 1; the opening scale from the drawing's fit.
 */
import { LEVEL_2_AT, LEVEL_3_AT, levelAt } from "@/lib/inheritance/layout";
import { LEVEL_1_CEILING, treeOpeningView, treeTileOpeningScale, treeTileUnits } from "@/lib/inheritance/tile-size";
import type { TreeLayout } from "@/lib/inheritance/layout";
import { WIDTH_EPOCHS, parseStoredPlaces, placesToStore, withStoredWidth } from "@/lib/ui/tile-positions";

describe("the tile's units", () => {
  it.each([
    [null, 2],
    [1, 2],
    [2, 2],
    [3, 3],
    [12, 3],
  ])("%p persons → %p units", (persons, units) => {
    expect(treeTileUnits(persons)).toBe(units);
  });
});

describe("the opening scale", () => {
  it.each([
    [1, 0.3, 2],
    [2, 0.47, 2],
    [2, 1, 2],
    [3, 0.8, 1],
    [12, 1, 1],
  ])("%p persons, a fit of %p → level %p", (persons, fit, level) => {
    expect(levelAt(treeTileOpeningScale(persons, fit))).toBe(level);
  });

  it("two persons: a fit inside level 2 is left alone, a smaller one raised to its floor", () => {
    expect(treeTileOpeningScale(2, 0.8)).toBe(0.8);
    expect(treeTileOpeningScale(2, 0.47)).toBe(LEVEL_2_AT);
    expect(treeTileOpeningScale(2, 2)).toBeLessThan(LEVEL_3_AT);
  });

  it("more than two: a fit already under level 2 is left alone, a larger one capped just under it", () => {
    expect(treeTileOpeningScale(5, 0.3)).toBe(0.3);
    expect(treeTileOpeningScale(5, 0.9)).toBe(LEVEL_1_CEILING);
    expect(levelAt(LEVEL_1_CEILING)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Slice 41.79
// ---------------------------------------------------------------------------

/** A drawing 900 × 400 with three persons: one at its left edge, one in its middle, one at its right. */
const LAYOUT = {
  nodes: [
    { id: "edge", x: 60, y: 50, generation: 0, cluster: 0 },
    { id: "middle", x: 450, y: 200, generation: 1, cluster: 0 },
    { id: "right", x: 840, y: 350, generation: 2, cluster: 0 },
  ],
  edges: [],
  clusters: [],
  runs: [],
  width: 900,
  height: 400,
} as unknown as TreeLayout;

describe("41.79 — the opening view is centred on the screen's own person (Ask first 3)", () => {
  const W = 363;
  const H = 363;
  const onScreen = (id: string, v: { scale: number; tx: number; ty: number }) => {
    const n = LAYOUT.nodes.find((x) => x.id === id)!;
    return { x: n.x * v.scale + v.tx, y: n.y * v.scale + v.ty };
  };

  it.each(["edge", "middle", "right"])("%s's box is in the square's middle, at the opening scale", (id) => {
    for (const scale of [0.4, 0.8]) {
      const v = treeOpeningView(W, H, LAYOUT, scale, id);
      expect(v.scale).toBe(scale);
      const p = onScreen(id, v);
      expect(p.x).toBeCloseTo(W / 2, 9);
      expect(p.y).toBeCloseTo(H / 2, 9);
    }
  });

  it("the whole tree's screen passes no centre: the drawing centred as before; an unknown id the same", () => {
    const whole = { scale: 0.4, tx: (W - 900 * 0.4) / 2, ty: Math.max(12, (H - 400 * 0.4) / 2) };
    expect(treeOpeningView(W, H, LAYOUT, 0.4)).toEqual(whole);
    expect(treeOpeningView(W, H, LAYOUT, 0.4, "nobody")).toEqual(whole);
  });
});

describe("41.79 — a tree tile width dragged before 41.71 is forgotten once (Ask first 1)", () => {
  // What Adrian's Chrome held on 2026-11-04 under ga40-tile-positions-natural-person-v1.
  const OLD = JSON.stringify({ inheritanceTree: { col: 2, top: 0, units: 2 }, identity: { col: 0, top: 0, units: 3 } });

  it("its place is kept and its width dropped; every other tile's width kept", () => {
    expect(parseStoredPlaces(OLD)).toEqual({ inheritanceTree: { col: 2, top: 0 }, identity: { col: 0, top: 0, units: 3 } });
  });

  it("a width dragged from now on carries the epoch and wins again, through a reload and a later move", () => {
    const now = withStoredWidth(parseStoredPlaces(OLD), "inheritanceTree", 4);
    expect(now.inheritanceTree).toEqual({ col: 2, top: 0, units: 4, widthEpoch: WIDTH_EPOCHS.inheritanceTree });
    expect(parseStoredPlaces(JSON.stringify(now)).inheritanceTree.units).toBe(4);
    const moved = placesToStore([{ id: "inheritanceTree", col: 5, units: 4, top: 0, height: 300 }], now, [], "inheritanceTree");
    expect(parseStoredPlaces(JSON.stringify(moved)).inheritanceTree).toMatchObject({ col: 5, units: 4 });
    expect(withStoredWidth(now, "inheritanceTree", undefined).inheritanceTree).toEqual({ col: 2, top: 0 });
  });

  it("a width with an older epoch is forgotten too", () => {
    expect(parseStoredPlaces(JSON.stringify({ inheritanceTree: { col: 1, top: 8, units: 2, widthEpoch: 1 } }))).toEqual({ inheritanceTree: { col: 1, top: 8 } });
  });
});

describe("41.79 — the count is what the drawing places (Ask first 2)", () => {
  it("the tile counts its layout's nodes, centres on its own person, and keys its drawing on the units", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    const tile = fs.readFileSync(`${process.cwd()}/src/app/_components/person-tree-tile.tsx`, "utf8");
    expect(tile).toContain("const count = layout ? layout.nodes.length : null;");
    expect(tile).toContain("openingCentre={personId}");
    expect(tile).toContain("<TreeCanvas key={units}");
  });
});
