/**
 * Slice 41.87 — „Deschide arborele întreg" grows the tile into the whole tree as „Hartă extinsă" grows out of the map
 * tile, and „Restrânge" takes it back (`@/lib/inheritance/expand-tree-animation`, on `@/lib/ui/expand-animation`).
 */
import {
  FOCUS_SCALE,
  atTreeOpeningEnd,
  centredOn,
  planTreeCollapse,
  planTreeExpand,
  treeBackdropAt,
  treeBoxAt,
  treeCollapseBackdropAt,
  treeCollapsePanelAt,
  treeCollapseTotalMs,
  treeCollapseViewAt,
  treeExpandTotalMs,
  treePanelAt,
  treeScaleAt,
  treeViewAt,
  type TreeCollapseInput,
  type TreeExpandInput,
} from "@/lib/inheritance/expand-tree-animation";
import { EXPAND_INSET_PX, openingClockBack, playTimeline } from "@/lib/ui/expand-animation";
import { readWholeTree, TREE_WHOLE } from "@/lib/inheritance/links";
import { parabolaZoom, cameraAt, flightPeak } from "@/lib/geo/map-search";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const TILE = { x: 900, y: 300, w: 389, h: 389 };
const input = (over: Partial<TreeExpandInput> = {}): TreeExpandInput => ({
  tileBox: TILE,
  viewport: { w: 1366, h: 768 },
  headerPx: 49,
  tileScale: 0.5,
  // The person a little left of the tile's middle.
  personOnScreen: { x: 1060, y: 494 },
  person: { x: 800, y: 300 },
  growMs: 3000,
  zoomMs: 3000,
  reducedMotion: false,
  ...over,
});

/** Where the person stands on screen at `t`. */
const personAt = (t: number, i = input()) => {
  const p = planTreeExpand(i);
  const v = treeViewAt(t, p);
  const box = treeBoxAt(t, p);
  return { x: box.x + v.tx + p.person.x * v.scale, y: box.y + v.ty + p.person.y * v.scale, scale: v.scale };
};

describe("41.87 — the opening, part 1: the panel from the tile, the person to the middle at the tile's scale", () => {
  it("starts on the tile — its drawing on the tile's, its header just above — and ends at inset-4", () => {
    const p = planTreeExpand(input());
    expect(treeBoxAt(0, p)).toEqual(TILE);
    expect(treePanelAt(0, p)).toEqual({ x: 900, y: 251, w: 389, h: 438 });
    expect(treePanelAt(3000, p)).toEqual({ x: EXPAND_INSET_PX, y: EXPAND_INSET_PX, w: 1334, h: 736 });
    expect(treeBackdropAt(0, p)).toBe(0);
    expect(treeBackdropAt(3000, p)).toBe(1);
  });
  it("the person where they stood on the tile at 0, half way along the line at half time, in the middle at the end", () => {
    const at0 = personAt(0);
    expect(at0.x).toBeCloseTo(1060, 6);
    expect(at0.y).toBeCloseTo(494, 6);
    const end = personAt(3000);
    const box = treeBoxAt(3000, planTreeExpand(input()));
    expect(end.x).toBeCloseTo(box.x + box.w / 2, 6);
    expect(end.y).toBeCloseTo(box.y + box.h / 2, 6);
    const mid = personAt(1500);
    expect(mid.x).toBeCloseTo((1060 + end.x) / 2, 6);
    expect(mid.y).toBeCloseTo((494 + end.y) / 2, 6);
  });
  it("holds the tile's scale through part 1", () => {
    for (const t of [0, 750, 1500, 2999]) expect(personAt(t).scale).toBe(0.5);
  });
});

describe("41.87 — the opening, part 2: the scale from the tile's to the whole tree's view of the person", () => {
  it("ends at the near level's scale, the person in the middle", () => {
    const p = planTreeExpand(input());
    expect(treeScaleAt(6000, p)).toBeCloseTo(FOCUS_SCALE, 9);
    expect(treeViewAt(6000, p)).toEqual(centredOn(p.person, FOCUS_SCALE, treeBoxAt(6000, p)));
    expect(treeExpandTotalMs(p)).toBe(6000);
  });
  it("on a log scale: half way, the geometric middle", () => {
    const p = planTreeExpand(input());
    expect(treeScaleAt(4500, p)).toBeCloseTo(Math.sqrt(0.5 * FOCUS_SCALE), 6);
  });
  it("a tile already at the near level's scale has no part 2", () => {
    expect(planTreeExpand(input({ tileScale: FOCUS_SCALE })).zoomMs).toBe(0);
  });
  it("a setting of 0 skips its part; reduced motion opens at the end at once", () => {
    expect(treeExpandTotalMs(planTreeExpand(input({ growMs: 0 })))).toBe(3000);
    const off = planTreeExpand(input({ reducedMotion: true }));
    expect(treeExpandTotalMs(off)).toBe(0);
    expect(treePanelAt(0, off)).toEqual(off.to);
    expect(treeViewAt(0, off).scale).toBeCloseTo(FOCUS_SCALE, 9);
  });
});

const collapse = (over: Partial<TreeCollapseInput> = {}): TreeCollapseInput => {
  const i = input();
  const p = planTreeExpand(i);
  return {
    ...i,
    current: treeViewAt(6000, p),
    flightMs: 4000,
    arc: 1,
    openingCut: false,
    searched: false,
    ...over,
  };
};

describe("41.87 — the way back", () => {
  it("at the opening's end: no return — part 2 backwards, then part 1 backwards into the tile", () => {
    const c = planTreeCollapse(collapse());
    expect(c.returnMs).toBe(0);
    expect(treeCollapseTotalMs(c)).toBe(6000);
    expect(treeCollapseViewAt(3000, c).scale).toBeCloseTo(0.5, 9);
    expect(treeCollapsePanelAt(6000, c)).toEqual(treePanelAt(0, c.expand));
    expect(treeCollapseBackdropAt(6000, c)).toBe(0);
    expect(treeCollapseBackdropAt(0, c)).toBe(1);
  });
  it("inside the tolerance (1 % off the middle) there is still no return", () => {
    const end = collapse().current;
    expect(planTreeCollapse(collapse({ current: { ...end, tx: end.tx + 10 } })).returnMs).toBe(0);
  });
  it("beyond it — moved, another level, another person searched, the opening stopped — the return comes first", () => {
    const end = collapse().current;
    expect(planTreeCollapse(collapse({ current: { ...end, tx: end.tx + 200 } })).returnMs).toBe(4000);
    expect(planTreeCollapse(collapse({ current: { ...end, scale: 0.4 } })).returnMs).toBe(4000);
    expect(planTreeCollapse(collapse({ searched: true })).returnMs).toBe(4000);
    expect(planTreeCollapse(collapse({ openingCut: true })).returnMs).toBe(4000);
  });
  it("the return lands on the opening's end, from the view it started at, rising on 41.76's parabola", () => {
    const end = collapse().current;
    const from = { scale: 1.3, tx: end.tx + 400, ty: end.ty - 100 };
    const c = planTreeCollapse(collapse({ current: from }));
    expect(treeCollapseViewAt(0, c)).toEqual(expect.objectContaining({ scale: expect.any(Number) }));
    expect(treeCollapseViewAt(0, c).scale).toBeCloseTo(1.3, 9);
    expect(treeCollapseViewAt(0, c).tx).toBeCloseTo(from.tx, 6);
    const last = treeCollapseViewAt(4000, c);
    expect(last.scale).toBeCloseTo(c.end.scale, 9);
    expect(last.tx).toBeCloseTo(c.end.tx, 6);
    // Half way it is lower than both ends: a · R below the line.
    expect(treeCollapseViewAt(2000, c).scale).toBeLessThan(1.3 / 2 ** (c.rise * 0.99));
  });
  it("a tile that cannot be measured gets the return alone", () => {
    const c = planTreeCollapse(collapse({ tileBox: null, personOnScreen: null, searched: true }));
    expect([c.returnMs, c.zoomMs, c.growMs]).toEqual([4000, 0, 0]);
    expect(treeCollapsePanelAt(4000, c)).toEqual(c.expand.to);
  });
  it("reduced motion: nothing plays", () => {
    expect(treeCollapseTotalMs(planTreeCollapse(collapse({ reducedMotion: true, searched: true })))).toBe(0);
  });
  it("atTreeOpeningEnd reads the level and the middle", () => {
    const box = { w: 1000, h: 500 };
    const end = centredOn({ x: 10, y: 10 }, FOCUS_SCALE, box);
    expect(atTreeOpeningEnd(end, end, { x: 10, y: 10 }, box)).toBe(true);
    expect(atTreeOpeningEnd({ ...end, scale: 0.5 }, end, { x: 10, y: 10 }, box)).toBe(false);
    expect(atTreeOpeningEnd({ ...end, ty: end.ty + 11 }, end, { x: 10, y: 10 }, box)).toBe(false);
  });
});

describe("41.87 — what the openings share", () => {
  it("the map's flight reads the same parabola", () => {
    const from = { center: { lat: 45, lng: 24 }, zoom: 15 };
    const to = { center: { lat: 45.01, lng: 24.01 }, zoom: 17 };
    const peak = flightPeak(from, to, 1000, 700);
    const x = 0.5;
    const z = cameraAt(2000, from, to, peak, 4000, 1).zoom;
    expect(z).toBeCloseTo(Math.max(0, parabolaZoom(x, 15, 17, Math.max(1, 15 - peak), 1)), 9);
  });
  it("the way back's clock is the opening's, backwards", () => {
    expect(openingClockBack(0, 1000, 3000, 3000)).toBeNull();
    expect(openingClockBack(1000, 1000, 3000, 3000)).toBe(6000);
    expect(openingClockBack(4000, 1000, 3000, 3000)).toBe(3000);
    expect(openingClockBack(7000, 1000, 3000, 3000)).toBe(0);
  });
  it("playTimeline: 0 ms ends at once, applying the end", () => {
    const seen: number[] = [];
    let ended = 0;
    playTimeline({ total: 0, apply: (t) => seen.push(t), onEnd: () => (ended += 1) });
    expect(seen).toEqual([0, 0]);
    expect(ended).toBe(1);
  });
  it("playTimeline: lands on its timers when no frame comes, once", () => {
    jest.useFakeTimers();
    const raf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = (() => 0) as typeof requestAnimationFrame;
    try {
      const seen: number[] = [];
      let ended = 0;
      playTimeline({ total: 500, marks: [200], apply: (t) => seen.push(t), onEnd: () => (ended += 1) });
      jest.advanceTimersByTime(1000);
      expect(seen).toEqual([0, 200, 500]);
      expect(ended).toBe(1);
    } finally {
      globalThis.requestAnimationFrame = raf;
      jest.useRealTimers();
    }
  });
});

describe("41.87 — the tile's button opens the whole tree over the screen", () => {
  const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
  it("`?tree=whole` is the mark", () => {
    expect(TREE_WHOLE).toBe("whole");
    expect(readWholeTree("whole")).toBe(true);
    expect(readWholeTree("open")).toBe(false);
    expect(readWholeTree(null)).toBe(false);
  });
  it("the tile draws a button, not a link, and the panel is the route's own (shared, not copied)", () => {
    const tile = read("src", "app", "_components", "person-tree-tile.tsx");
    expect(tile).not.toMatch(/wholeTreeHref\(/);
    expect(tile).toMatch(/data-tree-whole="" onClick=\{whole\.open\}/);
    const overlay = read("src", "app", "_components", "whole-tree-overlay.tsx");
    expect(overlay).toMatch(/<InheritanceTreePanel/);
    expect(read("src", "app", "inheritance-tree", "_components", "inheritance-tree-screen.tsx")).toMatch(/return <InheritanceTreePanel /);
  });
  it("the map's module reads the shared one, not a copy", () => {
    const map = read("src", "lib", "geo", "expand-map-animation.ts");
    expect(map).toMatch(/from "@\/lib\/ui\/expand-animation"/);
    expect(map).not.toMatch(/function easeInOut/);
  });
});
