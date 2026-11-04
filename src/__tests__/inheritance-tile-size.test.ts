/**
 * Slice 41.71 — the person's „Arbore de moștenire" tile, as wide as its family (`@/lib/inheritance/tile-size`):
 * one or two persons → 2 units at level 2, three or more → 3 units at level 1; the opening scale from the drawing's fit.
 */
import { LEVEL_2_AT, LEVEL_3_AT, levelAt } from "@/lib/inheritance/layout";
import { LEVEL_1_CEILING, treeTileOpeningScale, treeTileUnits } from "@/lib/inheritance/tile-size";

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
