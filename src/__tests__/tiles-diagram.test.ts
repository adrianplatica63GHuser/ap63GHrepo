/**
 * Slice 40.42 — the small diagram of the tiles beside the bar: the geometry (`tilesDiagram`, tiles-diagram.ts).
 *
 * Tight tiles give 8-px gaps (half the 16-px minimum); a 64-px gap gives 32; a 200-px gap is capped at 32; widths in
 * proportion to the tiles' units; every rectangle the same height; the whole inside the height given; across, the
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

  it("tight tiles → 8-px gaps down; every rectangle the same height; the whole inside the height", () => {
    const d = tilesDiagram([t("a", 0, 0, 300), t("b", 0, 316, 500), t("c", 0, 832, 100)], ROOM);
    const [a, b, c] = ["a", "b", "c"].map((id) => at(d, id));
    expect(new Set(d.rects.map((r) => r.h)).size).toBe(1);
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
    // The packing hook publishes after a layout, not while a tile is dragged.
    expect(read("src", "components", "tiles", "use-tile-packing.ts")).toContain("if (entity && !drag?.active) {");
  });
});
