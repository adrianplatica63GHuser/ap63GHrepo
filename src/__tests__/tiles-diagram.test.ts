/**
 * Slice 40.42 — the small diagram of the tiles beside the bar: the geometry (`tilesDiagram`, tiles-diagram.ts).
 *
 * Tight tiles give 8-px gaps (half the 16-px minimum); a 64-px gap gives 32; a 200-px gap is capped at 32; widths in
 * proportion to the tiles' units; heights in proportion to the tiles' (40.52 — it read „every rectangle the same
 * height"), never under 3 px; the whole inside the height given; across, the
 * tiles' own columns. The browser half — one rectangle per tile, its colour, after a tick and „Toate sus" — is
 * TC-TILES-18 and TC-TILES-21.
 */
import fs from "node:fs";
import path from "node:path";

import { DIAGRAM, diagramGap, tilesDiagram, type DiagramTile } from "@/lib/ui/tiles-diagram";
import { groupColours, groupStrip } from "@/lib/ui/tile-surface";

const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");
const GAP = 16;
const t = (id: string, col: number, top: number, height: number, units = 3): DiagramTile => ({ id, group: "record", col, units, top, height });
const ROOM = { tileGap: GAP, height: 130, maxWidth: 400, columns: 10 };
const at = (d: ReturnType<typeof tilesDiagram>, id: string) => d.rects.find((r) => r.id === id)!;

describe("the tiles diagram's geometry (40.42)", () => {
  it("the gap rule: half the tile gap, between 8 and 32 px; the top's from nothing to 32", () => {
    expect(diagramGap(16, GAP, false)).toBe(8);
    expect(diagramGap(64, GAP, false)).toBe(32);
    expect(diagramGap(200, GAP, false)).toBe(32);
    expect(diagramGap(24, GAP, false)).toBe(12);
    expect(diagramGap(0, GAP, true)).toBe(0);
    expect(diagramGap(200, GAP, true)).toBe(32);
  });

  // 40.52 (Adrian, 2026-10-24: „The height of the small rectangles will be proportional to the actual height of the
  // tile"): inverted in place — it read „every rectangle the same height", `new Set(d.rects.map((r) => r.h)).size` 1.
  it("tight tiles → 8-px gaps down; heights in proportion to the tiles'; the whole inside the height", () => {
    const d = tilesDiagram([t("a", 0, 0, 300), t("b", 0, 316, 500), t("c", 0, 832, 100)], ROOM);
    const [a, b, c] = ["a", "b", "c"].map((id) => at(d, id));
    expect(new Set(d.rects.map((r) => r.h)).size).toBe(3);
    expect(b.h / a.h).toBeCloseTo(500 / 300, 1);
    expect(c.h / a.h).toBeCloseTo(100 / 300, 1);
    expect(a.y).toBe(0);
    expect(b.y - (a.y + a.h)).toBeCloseTo(8, 5);
    expect(c.y - (b.y + b.h)).toBeCloseTo(8, 5);
    expect(d.height).toBeLessThanOrEqual(130);
    expect(d.height).toBeGreaterThan(129);
  });

  it("a 64-px gap → 32; a 200-px gap is capped at 32", () => {
    const d = tilesDiagram([t("a", 0, 0, 300), t("b", 0, 364, 100), t("c", 0, 664, 100)], ROOM);
    expect(at(d, "b").y - (at(d, "a").y + at(d, "a").h)).toBeCloseTo(32, 5);
    expect(at(d, "c").y - (at(d, "b").y + at(d, "b").h)).toBeCloseTo(32, 5);
  });

  it("widths in proportion to the tiles' units, across on the tiles' own columns", () => {
    const d = tilesDiagram([t("a", 0, 0, 300, 3), t("b", 3, 0, 300, 4), t("c", 7, 0, 300, 2)], ROOM);
    const u = DIAGRAM.unit;
    const g = GAP / 2;
    expect(at(d, "a")).toMatchObject({ x: 0, w: 3 * u + 2 * g });
    expect(at(d, "b")).toMatchObject({ x: 3 * (u + g), w: 4 * u + 3 * g });
    expect(at(d, "c")).toMatchObject({ x: 7 * (u + g), w: 2 * u + g });
    // Tiles side by side, 16 px apart, are drawn 8 px apart.
    expect(at(d, "b").x - (at(d, "a").x + at(d, "a").w)).toBe(8);
    expect(d.width).toBe(10 * u + 9 * g);
  });

  it("short of room across, drawn narrower, never taller", () => {
    const d = tilesDiagram([t("a", 0, 0, 300, 5), t("b", 5, 0, 300, 5)], { ...ROOM, maxWidth: 100 });
    expect(d.width).toBeLessThanOrEqual(100);
    expect(d.height).toBeLessThanOrEqual(130);
  });

  it("when even the smallest rectangles and the gaps do not fit, the gaps shrink with them", () => {
    const tiles = Array.from({ length: 30 }, (_, i) => t(`t${i}`, 0, i * 116, 100));
    const d = tilesDiagram(tiles, ROOM);
    expect(d.height).toBeLessThanOrEqual(130 + 0.01);
    expect(d.rects).toHaveLength(30);
  });

  it("a tile twice as tall gives a rectangle twice as tall; side-by-side stacks share one scale (40.52)", () => {
    const d = tilesDiagram([t("a", 0, 0, 200), t("b", 3, 0, 400), t("c", 0, 216, 100)], ROOM);
    expect(at(d, "b").h / at(d, "a").h).toBeCloseTo(2, 2);
    // The deepest stack is b's 400 px (a and c are 300 and a gap): it fills the room, and a and c take its scale.
    expect(at(d, "b").y + at(d, "b").h).toBeCloseTo(130, 0);
    expect(d.height).toBeLessThanOrEqual(130);
    expect(at(d, "c").h / at(d, "a").h).toBeCloseTo(0.5, 2);
    expect(at(d, "c").y + at(d, "c").h).toBeLessThan(130);
  });

  it("the gaps keep 40.42's rule in px, whatever the tiles' heights (40.52, Ask first 1)", () => {
    const small = tilesDiagram([t("a", 0, 0, 100), t("b", 0, 116, 100)], ROOM);
    const big = tilesDiagram([t("a", 0, 0, 1000), t("b", 0, 1016, 1000)], ROOM);
    for (const d of [small, big]) expect(at(d, "b").y - (at(d, "a").y + at(d, "a").h)).toBeCloseTo(8, 1);
  });

  it("no rectangle under 3 px: a one-line tile beside a tall one stays visible (40.52, Ask first 2)", () => {
    expect(DIAGRAM.minHeight).toBe(3);
    const d = tilesDiagram([t("tall", 0, 0, 5000), t("line", 3, 0, 20)], ROOM);
    expect(at(d, "line").h).toBeGreaterThanOrEqual(3);
    expect(at(d, "tall").h).toBeLessThanOrEqual(130);
    expect(d.height).toBeLessThanOrEqual(130);
  });

  it("any stacking still fits the room", () => {
    const shapes = [
      [t("a", 0, 0, 900), t("b", 0, 916, 50), t("c", 3, 0, 60), t("d", 3, 76, 2000)],
      Array.from({ length: 8 }, (_, i) => t(`s${i}`, (i % 2) * 3, Math.floor(i / 2) * 400, 380)),
      [t("one", 0, 0, 10)],
    ];
    for (const tiles of shapes) {
      const d = tilesDiagram(tiles, ROOM);
      expect(d.height).toBeLessThanOrEqual(130 + 0.01);
      for (const r of d.rects) expect(r.h).toBeGreaterThan(0);
    }
  });

  it("each rectangle in its tile's group colours — the bar strips' own", () => {
    for (const g of ["record", "related", "meta", "family", "fixed"] as const) expect(groupStrip(g)).toContain(groupColours(g));
  });

  it("the four record screens draw it from their entity; it is a picture, aria-hidden", () => {
    for (const [f, entity] of [
      [["src", "app", "natural-persons", "_components", "person-detail-tiles.tsx"], "NP_TILE_REGISTRY.entity"],
      [["src", "app", "judicial-persons", "_components", "person-detail-tiles.tsx"], "JP_TILE_REGISTRY.entity"],
      [["src", "app", "properties", "_components", "property-detail-tiles.tsx"], "PROP_TILE_REGISTRY.entity"],
      [["src", "app", "documents", "_components", "document-detail-tiles.tsx"], "reg.entity"],
    ] as const) {
      const src = read(...f);
      expect([f.join("/"), src.includes(`twoRows diagram={${entity}} />`), src.includes('data-record-header=""'), src.includes('data-version-slot=""')]).toEqual([f.join("/"), true, true, true]);
    }
    const c = read("src", "components", "tiles", "tiles-diagram.tsx");
    expect(c).toContain('aria-hidden="true"');
    expect(c).toContain("pointer-events-none");
    // The packing hook publishes after a layout, not while a tile is dragged — except a drag the diagram started (40.53:
    // it read `toContain("if (entity && !drag?.active) {")`; tiles-diagram-drag.test.ts pins the diagram's drag).
    expect(read("src", "components", "tiles", "use-tile-packing.ts")).toContain("if (!entity || (drag?.active && !drag.fromDiagram)) return;");
  });
});
