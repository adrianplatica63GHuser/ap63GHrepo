/**
 * A name as the screen shows it — never what only a screen reader hears.                   (Slice 41.20)
 *
 * Adrian, 2026-10-31: „why are you showing me the string "System ID "? I cannot see it anywhere!" The width bubble
 * named a tile by its heading's `textContent`, which glues every text node together — the record's system ID corner
 * (system-id-corner.tsx) included, whose „ID sistem" / „System ID" is `sr-only`: read aloud, never drawn. So
 * „Identitate" + „ID sistem" + „PPERS 77369" came out as „IdentitateID sistem PPERS 77369". (Since 41.22 the ID is in
 * the page bar and no tile heading holds it; the rule below stands for any part only a screen reader hears.)
 *
 * Here a name is its visible text only (Ask first 1): `sr-only`, `aria-hidden`, `hidden` and undrawn nodes left out,
 * and a heading's visible parts — its direct children — joined with „ · " (`VISIBLE_JOIN`): „Identitate · PPERS 77369".
 * The same rule for every name the width bubble shows: a tile's title, a field's label.
 *
 * DOM only, no React; `visible-text.test.ts` pins it under jsdom, and `headingParts` — which needs layout — is
 * driven by TC-TILES-26.
 */
import { VISIBLE_JOIN, type HeadingPart } from "@/lib/ui/tile-width-rules";

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

/** Not drawn, or drawn for a screen reader only: `hidden`, `aria-hidden`, `sr-only`, no display, not visible. */
export function isUnseen(el: Element): boolean {
  if ((el as HTMLElement).hidden || el.getAttribute("aria-hidden") === "true" || el.classList.contains("sr-only")) return true;
  const cs = getComputedStyle(el);
  return cs.display === "none" || cs.visibility === "hidden" || cs.visibility === "collapse";
}

/** The text of `node` a sighted user reads — its unseen descendants left out, white space collapsed. */
export function visibleText(node: Node): string {
  const walk = (n: Node): string => {
    if (n.nodeType === Node.TEXT_NODE) return n.textContent ?? "";
    if (n.nodeType !== Node.ELEMENT_NODE || isUnseen(n as Element)) return "";
    return Array.from(n.childNodes).map(walk).join("");
  };
  return collapse(walk(node));
}

/** A heading's visible parts: each direct child — a text node or an element — that shows any text, in order. */
export function visibleParts(root: Element): { node: Node; text: string }[] {
  const out: { node: Node; text: string }[] = [];
  for (const n of Array.from(root.childNodes)) {
    if (n.nodeType === Node.ELEMENT_NODE && isUnseen(n as Element)) continue;
    const text = visibleText(n);
    if (text) out.push({ node: n, text });
  }
  return out;
}

/** A tile's name as the screen shows it: its heading's visible parts joined with „ · ". */
export function visibleName(root: Element): string {
  return visibleParts(root)
    .map((p) => p.text)
    .join(VISIBLE_JOIN);
}

/** Where a part is drawn: an element's box, or a text node's run. */
function rectOf(n: Node): DOMRect {
  if (n.nodeType === Node.ELEMENT_NODE) return (n as Element).getBoundingClientRect();
  const r = document.createRange();
  r.selectNodeContents(n);
  return r.getBoundingClientRect();
}

/**
 * 41.20 (Ask first 2, 3): a heading's visible parts, each with its width as drawn on one line, and the least space its
 * layout puts between two of them — its `column-gap` in a flex or grid line, never the stretch an `ml-auto` gives on a
 * wide tile; in a line of text, what is drawn between them. `frame` is what is around the line inside the tile `box`:
 * from the box's left edge to where the heading's text starts, and from where it ends to the box's right edge — the
 * tile's padding and border, and the heading's own. Measured with the heading held on one line (nothing wraps), and
 * put back as it was.
 */
export function headingParts(h: HTMLElement, box: HTMLElement): { parts: HeadingPart[]; spaces: number[]; frame: number } {
  const ws = h.style.getPropertyValue("white-space");
  h.style.setProperty("white-space", "nowrap");
  try {
    const visible = visibleParts(h);
    const rects = visible.map((p) => rectOf(p.node));
    const parts = visible.map((p, i) => ({ text: p.text, px: rects[i].width }));
    const cs = getComputedStyle(h);
    const flex = /(flex|grid)$/.test(cs.display);
    const gap = parseFloat(cs.columnGap) || 0;
    const spaces = rects.slice(1).map((r, i) => (flex ? gap : Math.max(0, r.left - rects[i].right)));
    const b = box.getBoundingClientRect();
    const hr = h.getBoundingClientRect();
    const px = (v: string) => parseFloat(v) || 0;
    const left = hr.left + px(cs.borderLeftWidth) + px(cs.paddingLeft) - b.left;
    // 41.38: beside „Editează" (and Clasificare's „i") the heading shares its row with them; their room is not the
    // heading's frame — the title wraps before them at a narrow width rather than widening the tile — so its right is
    // measured from the row's end, as it was from the heading's own while the pen sat on the line under it.
    const line = h.closest<HTMLElement>("[data-tile-title-line]");
    const rowRight = line ? line.getBoundingClientRect().right : hr.right - px(cs.borderRightWidth) - px(cs.paddingRight);
    const right = b.right - rowRight;
    return { parts, spaces, frame: Math.max(0, left) + Math.max(0, right) };
  } finally {
    if (ws) h.style.setProperty("white-space", ws);
    else h.style.removeProperty("white-space");
  }
}
