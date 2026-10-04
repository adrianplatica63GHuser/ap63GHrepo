/**
 * Where a tile can be grabbed: its unused space.                 (Slice #37.76)
 *
 * Adrian: „Dragging should be possible after I click on any area of the tile
 * that is not a label, a field, a text area - any area that is just unused
 * space." So a press starts a drag only on the tile's own surface — its
 * padding, the free part of its title row, the gaps between fields and rows —
 * never on text, a label, an input, a select, a textarea, a button, a link,
 * an image, a map or the page viewer. Anything that draws its own cursor (a
 * resize handle, a map's „grab") is not unused space either.
 *
 * A DOM helper for `use-tile-packing.ts`; `tile-drag-surface.test.ts` covers
 * it in jsdom (which has no layout, so text under the pointer is checked
 * against the rectangles a test gives).
 */

/** What is never unused space, wherever it is pressed. */
export const NOT_A_SURFACE = [
  "input",
  "select",
  "textarea",
  "button",
  "a",
  "label",
  "img",
  "video",
  "canvas",
  "iframe",
  "svg",
  "[contenteditable]",
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="slider"]',
  '[role="textbox"]',
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="option"]',
  '[role="tab"]',
  ".gm-style",
  "[data-map-ui]",
  "[data-no-tile-drag]",
].join(",");

/** The cursors a tile's own surface may show: the browser's own, and the „grab" this slice sets. */
const PLAIN_CURSORS = new Set(["auto", "default", "grab", "grabbing", ""]);

/** Is the point over a run of text that is a direct child of `el`? */
export function textUnder(el: Element, x: number, y: number): boolean {
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const r of Array.from(range.getClientRects?.() ?? [])) {
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true;
    }
  }
  return false;
}

/** May a press at `x`, `y` on `target` start dragging the tile `box`? */
export function isDragSurface(target: EventTarget | null, x: number, y: number, box: HTMLElement): boolean {
  if (!(target instanceof Element) || !box.contains(target)) return false;
  if (target.closest(NOT_A_SURFACE)) return false;
  for (let el: Element | null = target; el && el !== box.parentElement; el = el.parentElement) {
    if (!PLAIN_CURSORS.has(getComputedStyle(el).cursor)) return false;
  }
  return !textUnder(target, x, y);
}
