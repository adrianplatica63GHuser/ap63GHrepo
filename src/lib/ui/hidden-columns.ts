/**
 * Which sides of a principal list hide columns.                                                     (Slice #40.03)
 *
 * Adrian, 2026-10-20: „the lists can keep their horizontal scroll bar But if there columns that are not shown on the
 * right side we will display 3 greater than signs in red One on top of each other At the right edge of the visible part
 * of the title bar … similarly … 3 smaller than sign in red … at the left side". His second „right side" is read as the
 * left (Ask first 1).
 *
 * From the frame's own scroll (Ask first 3): the right side hides something while `scrollLeft + clientWidth` is short of
 * `scrollWidth` by more than a pixel, the left while `scrollLeft` is more than a pixel — the 1-px tolerance because a
 * zoomed window scrolls by fractions and a list scrolled to its end can stop half a pixel short. Both in the middle of a
 * wide list; neither when every column fits.
 *
 * PURE — `hidden-columns.test.ts` covers it; `HiddenColumnSigns` reads the frame and draws.
 */

export interface FrameScroll {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
}

export interface HiddenSides {
  left: boolean;
  right: boolean;
}

/** The tolerance, in px, on both sides. */
export const HIDDEN_TOLERANCE_PX = 1;

export const NOTHING_HIDDEN: HiddenSides = { left: false, right: false };

export function hiddenSides(s: FrameScroll): HiddenSides {
  return {
    left: s.scrollLeft > HIDDEN_TOLERANCE_PX,
    right: s.scrollLeft + s.clientWidth < s.scrollWidth - HIDDEN_TOLERANCE_PX,
  };
}

export function sameSides(a: HiddenSides, b: HiddenSides): boolean {
  return a.left === b.left && a.right === b.right;
}
