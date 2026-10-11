/**
 * Slice #39.04 — a list row's three toggles: which row, and which of its tiles (`@/lib/ui/row-tiles`).
 * The rendering half is list-preview-column.test.tsx and incursion-tile.test.tsx; the browser half TC-TILES-11.
 */
import {
  NO_ROW_TILES,
  ROW_TILE_ORDER,
  closeRowTile,
  isLocked,
  isRowTileOpen,
  toggleRowTile,
  type RowTile,
  type RowTiles,
} from "@/lib/ui/row-tiles";
import type { PreviewTarget } from "@/lib/ui/previews";

const A: PreviewTarget = { kind: "property", id: "A" };
const B: PreviewTarget = { kind: "property", id: "B" };
const press = (s: RowTiles, t: PreviewTarget, ...tiles: RowTile[]) => tiles.reduce((acc, tile) => toggleRowTile(acc, t, tile), s);

/** Every subset of the three, in every order it can be pressed in. */
function permutations<T>(xs: readonly T[]): T[][] {
  if (xs.length <= 1) return [xs.slice()];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
}
const SUBSETS: RowTile[][] = [[], ["preview"], ["links"], ["peek"], ["preview", "links"], ["preview", "peek"], ["links", "peek"], ["preview", "links", "peek"]];

describe("one row, any subset of its three", () => {
  it("the column's order is fixed: Previzualizare, Legături, Incursiune", () => {
    expect(ROW_TILE_ORDER).toEqual(["preview", "links", "peek"]);
  });

  it.each(SUBSETS.map((s) => [s.join("+") || "none", s] as const))("%s — whatever the order pressed, open in the fixed order", (_name, subset) => {
    for (const order of permutations(subset)) {
      const s = press(NO_ROW_TILES, A, ...order);
      expect([order, s.open]).toEqual([order, ROW_TILE_ORDER.filter((t) => subset.includes(t))]);
      expect([order, s.row?.id ?? null]).toEqual([order, subset.length ? "A" : null]);
      for (const t of ROW_TILE_ORDER) expect([order, t, isRowTileOpen(s, A, t)]).toEqual([order, t, subset.includes(t)]);
    }
  });

  it("pressed again, a tile closes; the last one closed frees the list", () => {
    let s = press(NO_ROW_TILES, A, "peek", "preview");
    s = toggleRowTile(s, A, "peek");
    expect(s.open).toEqual(["preview"]);
    s = toggleRowTile(s, A, "preview");
    expect(s).toEqual(NO_ROW_TILES);
  });

  it("the row is kept by kind and id only — an anchor means nothing on a list", () => {
    const s = toggleRowTile(NO_ROW_TILES, { ...A, anchor: "related" }, "preview");
    expect(s.row).toEqual({ kind: "property", id: "A" });
  });
});

describe("the other rows are locked while any tile is open", () => {
  it("another row's three are disabled; its buttons change nothing even if a click slips through", () => {
    const s = press(NO_ROW_TILES, A, "links");
    expect(isLocked(s, A)).toBe(false);
    expect(isLocked(s, B)).toBe(true);
    for (const t of ROW_TILE_ORDER) {
      expect(toggleRowTile(s, B, t)).toBe(s);
      expect(isRowTileOpen(s, B, t)).toBe(false);
    }
  });

  it("nothing open: no row is locked", () => {
    expect(isLocked(NO_ROW_TILES, A)).toBe(false);
    expect(isLocked(NO_ROW_TILES, B)).toBe(false);
  });

  it("released all three: every row is enabled again", () => {
    let s = press(NO_ROW_TILES, A, "peek", "preview", "links");
    s = press(s, A, "links", "peek", "preview");
    expect(isLocked(s, B)).toBe(false);
    expect(s).toEqual(NO_ROW_TILES);
  });
});

describe("„Închide” on a tile releases its button", () => {
  it("closes that tile alone; the last one frees the list; a tile not open changes nothing", () => {
    let s = press(NO_ROW_TILES, A, "preview", "links", "peek");
    s = closeRowTile(s, "links");
    expect(s.open).toEqual(["preview", "peek"]);
    expect(isRowTileOpen(s, A, "links")).toBe(false);
    expect(closeRowTile(s, "links")).toBe(s);
    s = closeRowTile(closeRowTile(s, "preview"), "peek");
    expect(s).toEqual(NO_ROW_TILES);
    expect(isLocked(s, B)).toBe(false);
  });
});
