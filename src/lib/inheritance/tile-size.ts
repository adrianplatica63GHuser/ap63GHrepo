/**
 * A natural person's „Arbore de moștenire" tile, as wide as its family.                              (Slice 41.71)
 *
 * Adrian, 2026-11-03: „if there are only two persons featured the tile should open with a width of two units and the
 * two persons should be shown at zoom level 2 of 3; however, if there are more than two persons featured the tile
 * should open with the width of three units and the persons should be shown at zoom level one of three".
 *
 * „Persons featured" are the persons the tile draws — `personSubtree`'s, the person included (Ask first 1). One (no tie
 * yet) and two open at 2 units, three or more at 3; while the tree is loading the tile stands at 2. This is the tile's
 * OWN width — the one Home or a double-click on its edge returns to; a width dragged by its edge (41.17) still wins.
 *
 * The opening zoom (Ask first 3) is the drawing's fit — the whole tree in the box, at most scale 1 — then held to the
 * level asked: up to level 2's floor for two persons or fewer, down to just under it for more. A tree that needs a
 * smaller scale than level 1's ceiling is drawn smaller, still level 1. The wheel and the drag work as before after it.
 */
import { LEVEL_2_AT, LEVEL_3_AT } from "./layout";

/** The tile's units: 2 for one or two persons (and while loading), 3 for more. */
export function treeTileUnits(persons: number | null): 2 | 3 {
  return persons !== null && persons > 2 ? 3 : 2;
}

/** Just under level 2: the largest scale `levelAt` still reads as level 1. */
export const LEVEL_1_CEILING = LEVEL_2_AT - 0.01;

/** The drawing's first scale, from its fit (`fit` already capped at 1) and how many persons it draws. */
export function treeTileOpeningScale(persons: number, fit: number): number {
  if (persons > 2) return Math.min(fit, LEVEL_1_CEILING);
  return Math.min(Math.max(fit, LEVEL_2_AT), LEVEL_3_AT - 0.01);
}
