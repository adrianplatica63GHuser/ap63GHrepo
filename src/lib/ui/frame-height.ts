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
 * ⚠️ **"FITS" MEANS A FAIR SHARE, NOT THE MINIMUM** (Slice #38.78). The rule
 * took the remaining height whenever it was at least `min`, so a frame that
 * started just high enough fitted in a six-row strip rather than a screen of its
 * own — a cliff at 280 px. #38.77 shortened the triangle above „Roluri
 * Persoane" and #38.78 the card's head, which moved the frame up at 1920 px to
 * exactly that edge (measured: top 663, 283 px left of a 1000 px window, where
 * its own screen gives 885), and TC-VL-10's frame of "most of a screen" became
 * 283 px. The remaining height is taken only while it is at least half of what
 * the frame's own screen would give it.
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
  const ownScreen = s.viewport - (s.frameTop - s.columnTop) - s.below;
  if (fits >= min && fits >= ownScreen / 2) return Math.floor(fits);
  return Math.floor(Math.max(ownScreen, min));
}

// ── Slice #40.02: the four principal lists fit the window ─────────────────────

/**
 * How tall a principal list's frame may be — Persoane fizice, Persoane juridice, Proprietăți, Acte.  (Slice #40.02)
 *
 * Adrian, 2026-10-20: „if the browser is not tall enough to accommodate the entire list I want the list itself to have
 * a vertical scroll bar … the titles row of the list to always be visible … we don't want the browser page to have a
 * vertical scroll bar". So the frame takes the height from its top to the window's bottom, less what stands under it
 * (`below`: the gap, the „Se afișează … / Pagina x din y" row and the page's bottom padding), and only its rows scroll;
 * a page whose rows fit is shorter than that and draws no scroll bar (`max-height`, not `height`).
 *
 * One floor (Ask first 3): never shorter than the band of column names and three rows (`listFrameFloor`). A window
 * shorter than that — or a filters row wrapped over several lines — brings the page's own scroll back, rather than a
 * list with no rows in sight. Unlike `frameMaxHeight` above, there is no „screen of its own": the four lists stand at
 * the page's top, so what is left of the window is always the frame's.
 *
 * The same space as `FrameSpace`, in the page's scroll container's coordinates; PURE — `list-frame-height.test.ts`.
 */
export interface ListFrameSpace {
  viewport: number;
  frameTop: number;
  below: number;
  /** `listFrameFloor`'s answer. */
  floor: number;
}

/** The rows the frame always shows, whatever the window (Ask first 3). */
export const LIST_FRAME_FLOOR_ROWS = 3;

/** A list row's height before one is drawn: a one-line row, `py-2` around a 20-px line and its 1-px rule (measured 37). */
export const LIST_ROW_PX = 37;

/** The floor: the band of names, three rows and the frame's two 1-px borders. */
export function listFrameFloor(bandPx: number, rowPx: number = LIST_ROW_PX): number {
  const row = rowPx > 0 ? rowPx : LIST_ROW_PX;
  return Math.ceil(Math.max(0, bandPx) + LIST_FRAME_FLOOR_ROWS * row + 2);
}

/** The frame's `max-height`, in whole px — rounded down, so the page never overflows by a fraction. */
export function listFrameMaxHeight(s: ListFrameSpace): number {
  return Math.max(Math.ceil(s.floor), Math.floor(s.viewport - s.frameTop - s.below));
}

/**
 * The row tiles' column beside a list (`ListPreviews`, #39.04): at most down to the window's bottom, less the page's
 * bottom padding, so its tiles — not the page — scroll (Ask first 6). Never under `min`. Wrapped under the list (a
 * narrow window) it is not capped at all and the page scrolls to reach it, as before — the caller says which.
 */
export function rowTilesMaxHeight(s: { viewport: number; columnTop: number; below: number }, min = FRAME_MIN_PX): number {
  return Math.max(min, Math.floor(s.viewport - s.columnTop - s.below));
}
