/**
 * How tall a reference list's frame may be, so that it — not the page —
 * scrolls, and its header row stays in view.                     (Slice #38.56)
 *
 * Adrian: the column titles stay in view while a long list scrolls; only the
 * rows move. A sticky `<thead>` sticks to its nearest scroll container, and
 * the table's frame (`overflow-x-auto`) is one that does not scroll
 * vertically, so the page's scroll left the header behind. #38.56's Ask
 * first 1: the frame scrolls, in both directions, and takes the window's
 * remaining height — so on a wide screen the page itself no longer scrolls,
 * and the toolbar and the categories stay put.
 *
 * Every length is in px, measured in the PAGE's scroll container's own
 * coordinates (`top` as if it were scrolled to the top):
 *   - `viewport`  — the scroll container's visible height;
 *   - `frameTop`  — where the frame starts;
 *   - `columnTop` — where the list's column starts (its card's top);
 *   - `below`     — what the page holds under the frame (the card's and the
 *                   page's bottom padding), which must stay on screen too.
 *
 * ⚠️ **WHERE THE FRAME CANNOT FIT, IT TAKES A SCREEN OF ITS OWN.** Under
 * about 1600 px the list stands under the categories (#38.35), so what is left
 * of the window under them is a strip a few rows tall. There the frame is as
 * tall as the window allows once the page is scrolled to the list's column —
 * the page scrolls that far and no further, and from there only the rows move.
 * Never under `min`, so a short window still shows a handful of rows.
 *
 * PURE — `frame-height.test.ts` covers it; value-list-modal.tsx measures.
 */

export interface FrameSpace {
  viewport: number;
  frameTop: number;
  columnTop: number;
  below: number;
}

/** The fewest px a frame is given, whatever the window (about six rows). */
export const FRAME_MIN_PX = 280;

export function frameMaxHeight(s: FrameSpace, min = FRAME_MIN_PX): number {
  const fits = s.viewport - s.frameTop - s.below;
  if (fits >= min) return Math.floor(fits);
  const ownScreen = s.viewport - (s.frameTop - s.columnTop) - s.below;
  return Math.floor(Math.max(ownScreen, min));
}
