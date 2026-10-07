/**
 * „Calcul drum lateral" — an owner's colour travels with the owner  (Slice #38.27)
 *
 * Adrian: „If the first slice is yellow and I switch that first owner with the
 * second owner … the second owner becomes the first and it's yellow. I don't
 * want that. I want the colour to go with the owner." The colour is decided by
 * the owner's line in the file, never by the slice's place.
 */

import { swapped } from "@/lib/calculation/geometry";
import { OWNER_COLORS, ROAD_COLOR, ownerColor, sliceColors } from "@/lib/calculation/owner-colors";

/** Which colour each OWNER (file index) wears, for a given slice order. */
function colourByOwner(order: readonly number[]): Map<number, string> {
  const colours = sliceColors(order);
  return new Map(order.map((owner, k) => [owner, colours[k]]));
}

describe("an owner's colour is the owner's, not the slice's", () => {
  it("the first owner in the file takes the palette's first colour, and so on", () => {
    expect(sliceColors([0, 1, 2, 3])).toEqual(OWNER_COLORS.slice(0, 4));
  });

  it("a slice wears its owner's colour, wherever the owner stands", () => {
    // Owner 2 in the first slice wears owner 2's colour, not the first slice's.
    expect(sliceColors([2, 0, 1])).toEqual([OWNER_COLORS[2], OWNER_COLORS[0], OWNER_COLORS[1]]);
  });

  it.each([
    [[0, 1, 2, 3], 0, 1],
    [[3, 1, 0, 2], 0, 3],
    [[3, 1, 0, 2], 2, 1],
  ])("a swap keeps every owner's colour (order %j, swap %i ↔ %i)", (order, a, b) => {
    const before = colourByOwner(order);
    const after = colourByOwner(swapped(order, a, b));
    expect(after).toEqual(before);
    // …while the slices' colours DID change places: the colour moved with the owner.
    expect(sliceColors(swapped(order, a, b))[a]).toBe(sliceColors(order)[b]);
    expect(sliceColors(swapped(order, a, b))[b]).toBe(sliceColors(order)[a]);
  });

  it("two swaps in a row return the original colours", () => {
    const order = [3, 1, 0, 2];
    expect(sliceColors(swapped(swapped(order, 0, 2), 0, 2))).toEqual(sliceColors(order));
    expect(sliceColors(swapped(swapped(order, 1, 3), 3, 0))).toEqual(sliceColors([1, 2, 0, 3]));
  });

  it("more than eight owners cycle through the palette", () => {
    expect(OWNER_COLORS).toHaveLength(8);
    expect(ownerColor(8)).toBe(OWNER_COLORS[0]);
    expect(ownerColor(9)).toBe(OWNER_COLORS[1]);
    expect(ownerColor(17)).toBe(OWNER_COLORS[1]);
    const ten = Array.from({ length: 10 }, (_, i) => i);
    expect(sliceColors(ten).slice(8)).toEqual(OWNER_COLORS.slice(0, 2));
  });

  it("the road is never given an owner's colour", () => {
    expect(OWNER_COLORS).not.toContain(ROAD_COLOR);
    for (let i = 0; i < 64; i++) expect(ownerColor(i)).not.toBe(ROAD_COLOR);
  });

  it("an index outside the file's range still lands on the palette, never undefined", () => {
    expect(OWNER_COLORS).toContain(ownerColor(-1));
    expect(OWNER_COLORS).toContain(ownerColor(2.7));
  });
});
