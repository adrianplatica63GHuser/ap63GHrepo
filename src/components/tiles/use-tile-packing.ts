"use client";

/**
 * Draws a tile row by `packTiles`: each box right under the box above it.
 *                                                              (Slice #37.75)
 *
 * The screens keep rendering their tiles as before — the form's (inside a
 * `display: contents` form, hidden rather than unmounted when unticked), the
 * list tiles, the previews — and this hook only MEASURES them and places them:
 * the row becomes `position: relative`, as tall as its packed boxes, and each
 * box `position: absolute` at its column and its place down the screen. The
 * DOM order — the registry's, which is the reading and keyboard order — is
 * never touched, and neither is the form (one element, nothing portalled).
 *
 * WHAT A BOX IS: an element of the row that draws a box. `display: contents`
 * wrappers (the form, its fieldset, its panel row, „Adrese"'s wrapper) are
 * walked through, so „Adrese"'s two address panels are placed one by one, as
 * Adrian reads them; a hidden element is not a box. A box's id is its
 * `data-tile`, or its tile's plus its place inside it („addresses#1").
 *
 * WHEN THE ROW IS LAID OUT AFRESH: when it mounts, when a box comes or goes (a
 * tile ticked or unticked, a preview opened or closed — seen by a
 * MutationObserver, so no screen has to say so), and when the row's width in
 * units changes. Contents arrive after a screen opens (a list fills), so for
 * two seconds after a layout — until the user types, clicks or presses a key
 * in the row — a height change lays the row out afresh too: that is still
 * „when the screen opens". After that a box that grows pushes the boxes under
 * it down (`grow`) and one that shrinks leaves its place, so nothing jumps
 * while the user types.
 */
import { useLayoutEffect, type RefObject } from "react";
import { UNIT_GAP_REM, UNIT_REM } from "@/lib/ui/field-widths";
import { columnsIn, grow, packTiles, packedHeight, unitsOf, type PackBox, type Placed } from "@/lib/ui/tile-packing";

/** How long after a layout the row still settles afresh on a height change, unless the user acts first. */
export const SETTLE_MS = 2000;

interface FoundBox {
  el: HTMLElement;
  id: string;
  anchor?: string;
  /** `basis-full`: a line of its own (the form's banner and sync notice). */
  full: boolean;
  /** `order-last basis-full`: the row's last line (the form's action bar). */
  rowEnd: boolean;
}

/**
 * The row's boxes, walking through `display: contents` wrappers, in the
 * order the row draws them: CSS `order` first (the Document orders its tiles
 * by its type's tile order), the DOM's among equals.
 */
export function findBoxes(container: HTMLElement): FoundBox[] {
  const out: (FoundBox & { order: number; index: number })[] = [];
  const counts = new Map<string, number>();
  const walk = (parent: Element, tile: string | null) => {
    for (const child of Array.from(parent.children)) {
      if (!(child instanceof HTMLElement) || child.hidden) continue;
      const display = getComputedStyle(child).display;
      if (display === "none") continue;
      const own = child.dataset.tile ?? null;
      if (display === "contents") {
        walk(child, own ?? tile);
        continue;
      }
      // A wrapper around one tile (the Document's list tiles, which carry its `order`) is that tile.
      let id = own ?? (child.querySelector(":scope > [data-tile]") as HTMLElement | null)?.dataset.tile ?? null;
      if (!id) {
        const base = tile ?? "box";
        const n = counts.get(base) ?? 0;
        counts.set(base, n + 1);
        id = `${base}#${n}`;
      }
      const basisFull = child.classList.contains("basis-full");
      const rowEnd = basisFull && child.classList.contains("order-last");
      const order = Number.parseInt(getComputedStyle(child).order, 10);
      out.push({
        el: child,
        id,
        anchor: child.dataset.previewAnchor || undefined,
        full: basisFull && !rowEnd,
        rowEnd,
        order: Number.isFinite(order) ? order : 0,
        index: out.length,
      });
    }
  };
  walk(container, null);
  return out
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map(({ el, id, anchor, full, rowEnd }) => ({ el, id, anchor, full, rowEnd }));
}

/** The inline styles the hook sets on a box, cleared when the row is no longer packed. */
const BOX_STYLES = ["position", "left", "top", "margin", "width"] as const;

function remPx(): number {
  const px = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(px) && px > 0 ? px : 16;
}

/**
 * Packs the boxes of the row `ref` points at. `fitWidest`: give the row a
 * min-width of its widest box — for #37.56's left area, a flex item that
 * would otherwise shrink to nothing once its boxes are out of the flow.
 */
export function useTilePacking(ref: RefObject<HTMLElement | null>, fitWidest = false): void {
  useLayoutEffect(() => {
    const container = ref.current;
    // jsdom (jest) has no layout and no ResizeObserver: the row stays a flex-wrap there.
    if (!container || typeof ResizeObserver === "undefined") return;
    let placed: Placed[] = [];
    let boxes: FoundBox[] = [];
    let columns = 0;
    let settleUntil = 0;
    let interacted = false;
    let frame = 0;

    const metrics = () => {
      const r = remPx();
      return { unit: UNIT_REM * r, gap: UNIT_GAP_REM * r };
    };

    const apply = () => {
      const { unit, gap } = metrics();
      container.style.position = "relative";
      container.style.height = `${packedHeight(placed)}px`;
      const byId = new Map(boxes.map((b) => [b.id, b]));
      let widest = 0;
      for (const p of placed) {
        const box = byId.get(p.id);
        if (!box) continue;
        const s = box.el.style;
        s.position = "absolute";
        s.left = `${p.col * (unit + gap)}px`;
        s.top = `${p.top}px`;
        s.margin = "0";
        if (p.rowEnd || box.full) s.width = "100%";
        else widest = Math.max(widest, box.el.offsetWidth);
        box.el.dataset.packedCol = String(p.col);
      }
      if (fitWidest) container.style.minWidth = `${widest}px`;
    };

    const heights = () => new Map(boxes.map((b) => [b.id, b.el.offsetHeight]));

    const layout = () => {
      const { unit, gap } = metrics();
      boxes = findBoxes(container);
      columns = columnsIn(container.clientWidth, unit, gap);
      const h = heights();
      const items: PackBox[] = boxes.map((b) => ({
        id: b.id,
        units: b.rowEnd || b.full ? columns : unitsOf(b.el.offsetWidth, unit, gap),
        height: h.get(b.id) ?? 0,
        anchor: b.anchor,
        full: b.full,
        rowEnd: b.rowEnd,
      }));
      placed = packTiles(items, columns, gap);
      apply();
      sizes.disconnect();
      for (const b of boxes) sizes.observe(b.el);
    };

    const fresh = () => {
      settleUntil = Date.now() + SETTLE_MS;
      interacted = false;
      layout();
    };

    const onSizes = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const { unit, gap } = metrics();
        if (columnsIn(container.clientWidth, unit, gap) !== columns) return fresh();
        // A ResizeObserver also reports every box once when it starts observing it:
        // only a height that differs from the one placed is a change.
        // A box whose width in units changed (a preview past „Se încarcă…") needs a new place.
        const byId = new Map(boxes.map((b) => [b.id, b]));
        if (placed.some((p) => !p.rowEnd && byId.has(p.id) && !byId.get(p.id)!.full && Math.min(unitsOf(byId.get(p.id)!.el.offsetWidth, unit, gap), columns) !== p.units)) return layout();
        const now = heights();
        const changed = placed.some((p) => now.has(p.id) && Math.abs(now.get(p.id)! - p.height) > 0.5);
        if (!changed) return;
        if (!interacted && Date.now() < settleUntil) return layout();
        let next = placed;
        for (const [id, height] of now) {
          const p = next.find((x) => x.id === id);
          if (p && Math.abs(p.height - height) > 0.5) next = grow(next, id, height, gap);
        }
        if (next !== placed) {
          placed = next;
          apply();
        }
      });
    };

    const sizes = new ResizeObserver(onSizes);
    const width = new ResizeObserver(onSizes);
    width.observe(container);

    // A box came or went, or React replaced one: lay the row out afresh.
    const changes = new MutationObserver(() => {
      const now = findBoxes(container);
      const same = now.length === boxes.length && now.every((b, i) => b.el === boxes[i].el && b.id === boxes[i].id);
      if (!same) fresh();
    });
    changes.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "class"] });

    const acted = () => {
      interacted = true;
    };
    container.addEventListener("input", acted);
    container.addEventListener("keydown", acted);
    container.addEventListener("pointerdown", acted);
    // A page opened in a hidden tab gets no ResizeObserver callbacks and no
    // frames until it is shown, so its first layout used the heights of the
    // first render („Se încarcă…"): shown before anyone acted, it is still „the
    // screen opening", and is laid out afresh.
    const shown = () => {
      if (document.visibilityState === "visible" && !interacted) fresh();
    };
    document.addEventListener("visibilitychange", shown);

    fresh();
    return () => {
      cancelAnimationFrame(frame);
      sizes.disconnect();
      width.disconnect();
      changes.disconnect();
      for (const b of boxes) {
        for (const k of BOX_STYLES) b.el.style.removeProperty(k);
        delete b.el.dataset.packedCol;
      }
      for (const k of ["position", "height", "min-width"]) container.style.removeProperty(k);
      container.removeEventListener("input", acted);
      container.removeEventListener("keydown", acted);
      container.removeEventListener("pointerdown", acted);
      document.removeEventListener("visibilitychange", shown);
    };
  }, [ref, fitWidest]);
}
