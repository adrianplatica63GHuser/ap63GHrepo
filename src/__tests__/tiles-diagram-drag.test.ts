/**
 * Slice 40.53 — a rectangle of the tiles diagram dragged as its tile is.
 *
 * Adrian, 2026-10-24: „The rectangles inside this tiles map can be moved in the same way that the tiles can be moved".
 * The diagram turns the pointer's move from its own scale into the screen's (`moveOnScreen`, tiles-diagram.ts) and
 * hands it to the packing hook's own drag (`dragFromDiagram`, tiles-placed.ts) — so a drop in the diagram snaps to the
 * same place as the same drop on the screen. The browser half — the hold, the slide, the drop kept after a reload, Esc
 * — is TC-TILES-25.
 */
import fs from "node:fs";
import path from "node:path";

import { moveOnScreen, tilesDiagram, type DiagramTile } from "@/lib/ui/tiles-diagram";
import { snapPlace } from "@/lib/ui/tile-positions";

const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");
const SCREEN = { unit: 148, gap: 16 };
const t = (id: string, col: number, top: number, height: number, units = 3): DiagramTile => ({ id, group: "record", col, units, top, height });
const ROOM = { tileGap: SCREEN.gap, height: 130, maxWidth: 400, columns: 8 };

describe("the diagram's move, on the screen (40.53)", () => {
  // Two columns: a (300) over c (200), 20 px apart; b (500) beside them; d (120) under b, 68 px below it.
  const tiles = [t("a", 0, 0, 300), t("b", 3, 0, 500), t("c", 0, 320, 200), t("d", 3, 568, 120)];
  const d = tilesDiagram(tiles, ROOM);
  const rect = (id: string) => d.rects.find((r) => r.id === id)!;
  const tile = (id: string) => tiles.find((x) => x.id === id)!;
  const pitch = d.unit + d.across;
  /** The tile's place on the screen when its rectangle is laid at `at`, snapped as the hook's `follow` snaps it. */
  const landing = (id: string, at: { x: number; y: number }) => {
    const on = moveOnScreen(at, { id }, d, tiles, SCREEN);
    return snapPlace(tile(id).col * (SCREEN.unit + SCREEN.gap) + on.dx, tile(id).top + on.dy, SCREEN.unit, SCREEN.gap);
  };

  it("the diagram says its unit, the gap across and its scale", () => {
    expect(d.unit).toBeGreaterThan(0);
    expect(d.across).toBeGreaterThan(0);
    expect(d.scale).toBeGreaterThan(0);
    expect(rect("b").x).toBeCloseTo(3 * pitch, 5);
  });

  it("no move is no move", () => {
    for (const id of ["a", "b", "c", "d"]) {
      const on = moveOnScreen({ x: rect(id).x, y: rect(id).y }, { id }, d, tiles, SCREEN);
      expect(on.dx).toBeCloseTo(0, 5);
      expect(on.dy).toBeCloseTo(0, 5);
    }
  });

  it("across: one diagram column is one screen column", () => {
    const on = moveOnScreen({ x: rect("a").x + pitch, y: rect("a").y }, { id: "a" }, d, tiles, SCREEN);
    expect(on.dx).toBeCloseTo(SCREEN.unit + SCREEN.gap, 5);
  });

  it("laid on another rectangle's top-left, the tile lands on that tile's — whatever the gaps above it", () => {
    expect(landing("a", { x: rect("d").x, y: rect("d").y })).toEqual({ col: 3, top: 568 });
    expect(landing("d", { x: rect("c").x, y: rect("c").y })).toEqual({ col: 0, top: 320 });
    expect(landing("c", { x: rect("b").x, y: rect("b").y })).toEqual({ col: 3, top: 0 });
  });

  it("half way down a rectangle, half way down its tile", () => {
    const b = rect("b");
    const on = moveOnScreen({ x: b.x, y: b.y + b.h / 2 }, { id: "d" }, d, tiles, SCREEN);
    expect(tile("d").top + on.dy).toBeCloseTo(250, 0);
  });

  it("half way across a gap in the diagram, half way across the gap on the screen", () => {
    const b = rect("b");
    const dd = rect("d");
    const on = moveOnScreen({ x: b.x, y: (b.y + b.h + dd.y) / 2 }, { id: "a" }, d, tiles, SCREEN);
    expect(tile("a").top + on.dy).toBeCloseTo((500 + 568) / 2, 0);
  });

  it("under every rectangle, on at the diagram's scale", () => {
    const dd = rect("d");
    const on = moveOnScreen({ x: dd.x, y: dd.y + dd.h + 10 }, { id: "a" }, d, tiles, SCREEN);
    expect(tile("a").top + on.dy).toBeCloseTo(568 + 120 + 10 / d.scale, 3);
  });

  it("where the floor took over (scale 0), down past them all by the rectangle's height over its tile's", () => {
    const flat = { rects: [{ id: "a", group: "record" as const, x: 0, y: 0, w: 10, h: 3 }], unit: 10, across: 4, scale: 0 };
    const on = moveOnScreen({ x: 0, y: 6 }, { id: "a" }, flat, [t("a", 0, 0, 600)], SCREEN);
    expect(on.dy).toBeCloseTo(600 + 3 * 200, 5);
  });

  it("an empty diagram, or a tile it does not draw, moves nothing", () => {
    expect(moveOnScreen({ x: 5, y: 5 }, { id: "a" }, tilesDiagram([], ROOM), tiles, SCREEN)).toEqual({ dx: 0, dy: 0 });
    expect(moveOnScreen({ x: 5, y: 5 }, { id: "zzz" }, d, tiles, SCREEN)).toEqual({ dx: 0, dy: 0 });
  });

  it("above the row, never under zero once snapped", () => {
    expect(landing("c", { x: rect("a").x, y: -4 }).top).toBe(0);
  });
});

describe("the diagram drives the hook's drag, and no drag of its own (40.53)", () => {
  const diagram = read("src", "components", "tiles", "tiles-diagram.tsx");
  const hook = read("src", "components", "tiles", "use-tile-packing.ts");
  const placed = read("src", "components", "tiles", "tiles-placed.ts");

  it("the diagram tells the hook through dragFromDiagram, every phase", () => {
    expect(diagram).toMatch(/import \{[^}]*\bdragFromDiagram\b[^}]*\} from "\.\/tiles-placed"/);
    for (const phase of ["start", "move", "drop", "cancel"]) expect(diagram).toContain(`"${phase}"`);
  });

  it("it starts only past the hook's own threshold", () => {
    expect(diagram).toMatch(/import \{ DRAG_THRESHOLD_PX \} from "\.\/use-tile-packing"/);
    expect(diagram).toMatch(/Math\.hypot\(dx, dy\) < DRAG_THRESHOLD_PX/);
  });

  it("only the rectangles take the pointer; the diagram stays aria-hidden", () => {
    expect(diagram).toMatch(/aria-hidden="true"\s+data-tiles-diagram=""/);
    expect(diagram).toMatch(/className="pointer-events-none absolute"/);
    expect(diagram).toMatch(/`pointer-events-auto absolute rounded-\[2px\]/);
    expect(diagram).toMatch(/onPointerDown=\{press\(r\)\}/);
  });

  it("Esc and a release outside the diagram cancel", () => {
    expect(diagram).toMatch(/e\.key !== "Escape"/);
    expect(diagram).toMatch(/phase: inside \? "drop" : "cancel"/);
  });

  it("the hook listens for it, runs it as its own and lets go of the listener", () => {
    expect(hook).toMatch(/window\.addEventListener\(TILE_DIAGRAM_DRAG, onDiagram\)/);
    expect(hook).toMatch(/window\.removeEventListener\(TILE_DIAGRAM_DRAG, onDiagram\)/);
    expect(hook).toMatch(/fromDiagram: true/);
    // While it runs the hook publishes, so the diagram shows the tiles making room.
    expect(hook).toMatch(/if \(drag\.fromDiagram\) publish\(\);/);
    expect(placed).toMatch(/export const TILE_DIAGRAM_DRAG = "ga40-tile-diagram-drag"/);
  });
});
