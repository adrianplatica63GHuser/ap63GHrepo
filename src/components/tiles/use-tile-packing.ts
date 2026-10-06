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
 *
 * DRAGGED BY ITS EMPTY SPACE (Slice #37.76). A left-button press on a tile's
 * unused space (`isDragSurface` — never text, a label, a field, a button, a
 * link, an image, a map or the page viewer) that moves more than
 * `DRAG_THRESHOLD_PX` drags the tile; less is a click, so nothing that worked
 * before changes. Over that space the pointer shows „grab". While it moves
 * every other tile stays where it is; an outline shows where it would land —
 * snapped to whole units across and `ROW_STEP` down — dashed in the accent
 * colour where that place is free, in red where it is not (`canDrop`).
 * Released on a free place it stays there (`dropAt`) and the arrangement is
 * stored per browser under `tilePositionsKey(entity)`; released anywhere
 * else, or on Esc, it goes back. Near the window's top or bottom the page
 * scrolls. A form tile stays in the form: only where it is drawn changes. A
 * preview can be dragged too, its place kept for the visit only. The stored
 * arrangement is read back at every fresh layout (`placeWithStored`), and
 * „Implicit" forgets it (`TILE_POSITIONS_RESET`).
 *
 * RISEN INTO THE GAPS (Slice #38.16). A stored arrangement read back on
 * another record leaves holes where a tile above is unticked, shorter or
 * empty; `placeWithStored` closes them (`riseIntoGaps`), at every fresh layout
 * — so also on a height change in the two seconds after one, still „when the
 * screen opens", and never after (#38.16's Ask first 3). A drop rises at once:
 * the outline shows where the tile is released, it then slides up from there,
 * and what is stored is what the user then sees (#38.16's Ask first 2).
 *
 * UNDER THE RIGHT COLUMN (Slice #37.79). `rightRef` names the right column
 * (#37.56's `TileAreas`). While it stands beside the left area its tiles are
 * measured as FIXED boxes, in this row's coordinates — against the row's right
 * edge, one under another — and the row is the whole width: the flow still
 * keeps to the left area (`flowColumns`), so a screen opens as before, but a
 * tile dropped in the free space under the column stays there, drawn past the
 * left area's right edge (the boxes are absolute, nothing clips them). A
 * column tile that grows, or that a tile above it pushes down, pushes the
 * tiles under it down (`settle`); one ticked or unticked lays the row out
 * afresh. While the column is wrapped under the left area there are no fixed
 * boxes and the row is the left area, so a place under the column falls back.
 *
 * THE FLOW HELD TO `flowUnits` (Slice #38.12). An administration screen with no
 * checkbox bar (`TileUnitRow`, the group screen) opens in fixed columns — two
 * tiles across, the third under the first — however wide the window: the flow
 * keeps to at most `flowUnits` of the row's units, and the rest of the row is
 * free space a tile may be dragged to. Without it, the flow takes the row.
 */
import { useLayoutEffect, type RefObject } from "react";
import { UNIT_GAP_REM, UNIT_REM } from "@/lib/ui/field-widths";
import { columnsIn, grow, packedHeight, settle, unitsOf, type PackBox, type Placed } from "@/lib/ui/tile-packing";
import {
  FIXED_PREFIX,
  TILE_POSITIONS_RESET,
  canDrop,
  dropAt,
  isStorable,
  parseStoredPlaces,
  placeWithStored,
  placesToStore,
  riseIntoGaps,
  snapPlace,
  tilePositionsKey,
  type StoredPlace,
  type StoredPlaces,
} from "@/lib/ui/tile-positions";
import { isDragSurface } from "./tile-drag-surface";

/** How long after a layout the row still settles afresh on a height change, unless the user acts first. */
export const SETTLE_MS = 2000;

/** A press that moves less than this is a click, not a drag (px). */
export const DRAG_THRESHOLD_PX = 5;

/** How near the window's top or bottom edge the page scrolls while a tile is dragged (px). */
const EDGE_PX = 48;

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
      if (!(child instanceof HTMLElement) || child.hidden || child.dataset.tileOutline !== undefined) continue;
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

/**
 * Sets inline styles on elements React also styles, and puts back exactly
 * what was there when the row is no longer packed.
 *
 * ⚠️ **NEVER REMOVE WHAT REACT SET.** A panel's width is React's inline
 * `width` (`unitStyle`). #37.75's first cleanup removed `width` from every
 * box; React's development run mounts, cleans up and mounts every effect
 * once, so the panels lost their widths and shrank to their content —
 * „Contact" 306 px, „Persoane de contact" 546 px (full 20261004T064902Z-20097,
 * TC-PERS-01 and TC-PERS-02). So the first value of each property is kept and
 * restored, whatever it was.
 */
function styleKeeper() {
  const kept = new Map<HTMLElement, Map<string, string>>();
  return {
    set(el: HTMLElement, prop: string, value: string): void {
      let props = kept.get(el);
      if (!props) kept.set(el, (props = new Map()));
      if (!props.has(prop)) props.set(prop, el.style.getPropertyValue(prop));
      el.style.setProperty(prop, value);
    },
    restore(): void {
      for (const [el, props] of kept) {
        for (const [prop, value] of props) {
          if (value) el.style.setProperty(prop, value);
          else el.style.removeProperty(prop);
        }
      }
      kept.clear();
    },
  };
}

function readPlaces(key: string | null): StoredPlaces {
  if (!key) return {};
  try {
    return parseStoredPlaces(localStorage.getItem(key));
  } catch {
    return {};
  }
}

function writePlaces(key: string | null, places: StoredPlaces): void {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(places));
  } catch {
    // Private windows and full storage: the arrangement holds for this visit.
  }
}

/** What scrolls the page the row is on: its nearest scrolling ancestor, or the document. */
function scrollerOf(el: HTMLElement): HTMLElement {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === "auto" || o === "scroll") && p.scrollHeight > p.clientHeight) return p;
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

function remPx(): number {
  const px = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(px) && px > 0 ? px : 16;
}

/**
 * A box's own width, in px (Slice #37.77): its inline `width` when it declares
 * one — a fixed panel or a list tile of whole units — or what it renders at,
 * whichever is wider. `max-w-full` lets a 4-unit tile render at 3 units in a
 * 3-unit area, and measured as rendered it then held the area at 3 units: on
 * the Property at 1366 px „Corelate" was squeezed beside the 3-unit right
 * column, its buttons on two lines (TC-PROP-07), and the screen came out
 * differently after a load than after narrowing the window.
 */
function ownWidth(el: HTMLElement): number {
  const w = el.style.width;
  const declared = w.endsWith("rem") ? parseFloat(w) * remPx() : w.endsWith("px") ? parseFloat(w) : 0;
  return Math.max(declared || 0, el.offsetWidth);
}

/**
 * Packs the boxes of the row `ref` points at, and lets the user drag them.
 * `fitWidest`: give the row a min-width of its widest box — for #37.56's left
 * area, a flex item that would otherwise shrink to nothing once its boxes are
 * out of the flow. `entity`: the tile choice's (`TileRegistry.entity`, per
 * document type), under which the arrangement is stored; none, nothing is.
 * `flowUnits`: the most units the flow takes across (#38.12); none, the row's.
 */
export function useTilePacking(
  ref: RefObject<HTMLElement | null>,
  {
    fitWidest = false,
    entity,
    rightRef,
    flowUnits,
  }: { fitWidest?: boolean; entity?: string; rightRef?: RefObject<HTMLElement | null>; flowUnits?: number } = {},
): void {
  useLayoutEffect(() => {
    const container = ref.current;
    // jsdom (jest) has no layout and no ResizeObserver: the row stays a flex-wrap there.
    if (!container || typeof ResizeObserver === "undefined") return;
    const key = entity ? tilePositionsKey(entity) : null;
    let placed: Placed[] = [];
    let boxes: FoundBox[] = [];
    // The row's units (#37.79: the whole row while the right column stands beside the left area), and the left area's.
    let columns = 0;
    let flowColumns = 0;
    // The units this row's own width holds (#38.12: `flowColumns` may be fewer).
    let ownColumns = 0;
    let settleUntil = 0;
    let interacted = false;
    let frame = 0;
    let stored: StoredPlaces = {};
    let fallback: string[] = [];
    let lead = 0;
    // Previews dragged this visit: their places are never stored.
    let visit: Record<string, StoredPlace> = {};
    // The tile being dragged (#37.76): nothing lays the row out under it.
    interface Drag {
      box: FoundBox;
      from: Placed;
      x0: number;
      y0: number;
      x: number;
      y: number;
      scroller: HTMLElement;
      scroll0: number;
      active: boolean;
      place: StoredPlace | null;
      free: boolean;
    }
    let drag: Drag | null = null;

    const metrics = () => {
      const r = remPx();
      return { unit: UNIT_REM * r, gap: UNIT_GAP_REM * r };
    };

    const styles = styleKeeper();

    /**
     * The right column's tiles, as fixed boxes in this row's coordinates — or
     * none while the column is hidden, empty or wrapped under the left area.
     */
    const fixedNow = (): (PackBox & { el: HTMLElement; fixed: { col: number; top: number } })[] => {
      const right = rightRef?.current;
      if (!right || right.hidden) return [];
      const c = container.getBoundingClientRect();
      const r = right.getBoundingClientRect();
      if (r.width === 0 || r.left < c.right - 0.5) return [];
      const { unit, gap } = metrics();
      const out: (PackBox & { el: HTMLElement; fixed: { col: number; top: number } })[] = [];
      const walk = (parent: Element) => {
        for (const child of Array.from(parent.children)) {
          if (!(child instanceof HTMLElement) || child.hidden) continue;
          const display = getComputedStyle(child).display;
          if (display === "none") continue;
          if (display === "contents") {
            walk(child);
            continue;
          }
          const b = child.getBoundingClientRect();
          if (b.width === 0) continue;
          out.push({
            id: `${FIXED_PREFIX}${child.dataset.tile ?? child.dataset.panel ?? out.length}`,
            el: child,
            units: unitsOf(b.width, unit, gap),
            height: b.height,
            fixed: { col: Math.max(0, Math.round((b.left - c.left) / (unit + gap))), top: Math.round(b.top - c.top) },
          });
        }
      };
      walk(right);
      return out;
    };
    const fixedIds = (list: readonly { id: string }[]) => list.map((f) => f.id).join("|");

    const apply = () => {
      const { unit, gap } = metrics();
      styles.set(container, "position", "relative");
      styles.set(container, "height", `${packedHeight(placed)}px`);
      const byId = new Map(boxes.map((b) => [b.id, b]));
      let widest = 0;
      for (const p of placed) {
        const box = byId.get(p.id);
        if (!box) continue;
        styles.set(box.el, "position", "absolute");
        styles.set(box.el, "left", `${p.col * (unit + gap)}px`);
        styles.set(box.el, "top", `${p.top}px`);
        styles.set(box.el, "margin", "0");
        if (p.rowEnd || box.full) styles.set(box.el, "width", "100%");
        else widest = Math.max(widest, ownWidth(box.el));
        box.el.dataset.packedCol = String(p.col);
      }
      if (fitWidest) styles.set(container, "min-width", `${widest}px`);
    };

    const heights = () => new Map(boxes.map((b) => [b.id, b.el.offsetHeight]));

    const layout = () => {
      if (drag?.active) return;
      const { unit, gap } = metrics();
      boxes = findBoxes(container);
      const fixed = fixedNow();
      ownColumns = columnsIn(container.clientWidth, unit, gap);
      flowColumns = flowUnits ? Math.min(ownColumns, Math.max(1, flowUnits)) : ownColumns;
      const rowWidth = container.parentElement?.clientWidth ?? container.clientWidth;
      columns = fixed.length ? Math.max(ownColumns, columnsIn(rowWidth, unit, gap)) : ownColumns;
      const h = heights();
      const items: PackBox[] = [
        ...fixed.map(({ id, units, height, fixed: at }) => ({ id, units, height, fixed: at })),
        ...boxes.map((b) => ({
          id: b.id,
          units: b.rowEnd || b.full ? flowColumns : Math.min(unitsOf(ownWidth(b.el), unit, gap), flowColumns),
          height: h.get(b.id) ?? 0,
          anchor: b.anchor,
          full: b.full,
          rowEnd: b.rowEnd,
        })),
      ];
      stored = readPlaces(key);
      const r = placeWithStored(items, { ...stored, ...visit }, columns, gap, flowColumns);
      placed = r.placed;
      fallback = r.fallback;
      lead = r.lead;
      apply();
      sizes.disconnect();
      for (const b of boxes) sizes.observe(b.el);
      for (const f of fixed) sizes.observe(f.el);
    };

    const fresh = () => {
      settleUntil = Date.now() + SETTLE_MS;
      interacted = false;
      layout();
    };

    const onSizes = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (drag?.active) return;
        const { unit, gap } = metrics();
        if (columnsIn(container.clientWidth, unit, gap) !== ownColumns) return fresh();
        // The right column came beside the left area or went under it, or a tile of it came or went (#37.79).
        const fixed = fixedNow();
        if (fixedIds(fixed) !== fixedIds(placed.filter((p) => p.fixed))) return fresh();
        // A ResizeObserver also reports every box once when it starts observing it:
        // only a height that differs from the one placed is a change.
        // A box whose width in units changed (a preview past „Se încarcă…") needs a new place.
        const byId = new Map(boxes.map((b) => [b.id, b]));
        if (placed.some((p) => !p.rowEnd && byId.has(p.id) && !byId.get(p.id)!.full && Math.min(unitsOf(ownWidth(byId.get(p.id)!.el), unit, gap), flowColumns) !== p.units)) return layout();
        const now = heights();
        const changed = placed.some((p) => now.has(p.id) && Math.abs(now.get(p.id)! - p.height) > 0.5);
        // A column tile that grew, or that the one above it pushed down (#37.79).
        const moved = fixed.filter((f) => {
          const p = placed.find((x) => x.id === f.id);
          return p && (p.top !== f.fixed.top || Math.abs(p.height - f.height) > 0.5);
        });
        if (!changed && moved.length === 0) return;
        if (!interacted && Date.now() < settleUntil) return layout();
        let next = placed;
        for (const f of moved) next = settle(next, f.id, f.fixed.top, f.height, gap);
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
    // #37.79: the right column — its width tells beside from wrapped; its tiles come and go.
    const right = rightRef?.current ?? null;
    if (right) width.observe(right);
    const rightChanges = new MutationObserver(() => {
      if (fixedIds(fixedNow()) !== fixedIds(placed.filter((p) => p.fixed))) fresh();
    });
    if (right) rightChanges.observe(right, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "class"] });

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
    // A page opened in a hidden tab gets no ResizeObserver callbacks and no
    // frames until it is shown, so its first layout used the heights of the
    // first render („Se încarcă…"): shown before anyone acted, it is still „the
    // screen opening", and is laid out afresh.
    const shown = () => {
      if (document.visibilityState === "visible" && !interacted) fresh();
    };
    document.addEventListener("visibilitychange", shown);

    // ── Dragging (Slice #37.76) ───────────────────────────────────────────
    let outline: HTMLDivElement | null = null;
    let edge = 0;
    let hovered: HTMLElement | null = null;

    const boxAt = (target: EventTarget | null): FoundBox | undefined =>
      target instanceof Node ? boxes.find((b) => !b.rowEnd && !b.full && b.el.contains(target)) : undefined;

    const follow = () => {
      if (!drag?.active) return;
      const { unit, gap } = metrics();
      const dy = drag.y - drag.y0 + (drag.scroller.scrollTop - drag.scroll0);
      const left = drag.from.col * (unit + gap) + (drag.x - drag.x0);
      const top = drag.from.top + dy;
      styles.set(drag.box.el, "left", `${left}px`);
      styles.set(drag.box.el, "top", `${top}px`);
      const place = snapPlace(left, top, unit, gap);
      drag.place = place;
      drag.free = canDrop(placed, drag.box.id, place, columns, gap);
      if (outline) {
        Object.assign(outline.style, {
          left: `${place.col * (unit + gap)}px`,
          top: `${place.top}px`,
          width: `${drag.box.el.offsetWidth}px`,
          height: `${drag.from.height}px`,
          borderColor: drag.free ? "var(--color-accent, #2563eb)" : "#dc2626",
          background: drag.free ? "rgba(37, 99, 235, 0.08)" : "rgba(220, 38, 38, 0.10)",
        });
        outline.dataset.free = drag.free ? "true" : "false";
      }
      // The space under the lowest tile is always free: the row grows to hold the outline.
      styles.set(container, "height", `${Math.max(packedHeight(placed), place.top + drag.from.height)}px`);
    };

    const start = () => {
      if (!drag) return;
      drag.active = true;
      styles.set(drag.box.el, "z-index", "30");
      styles.set(drag.box.el, "opacity", "0.92");
      styles.set(drag.box.el, "box-shadow", "0 8px 24px rgba(0, 0, 0, 0.18)");
      styles.set(drag.box.el, "cursor", "grabbing");
      document.body.style.userSelect = "none";
      document.body.style.cursor = "grabbing";
      window.getSelection()?.removeAllRanges();
      outline = document.createElement("div");
      outline.dataset.tileOutline = "";
      outline.setAttribute("aria-hidden", "true");
      Object.assign(outline.style, { position: "absolute", border: "2px dashed", borderRadius: "0.375rem", pointerEvents: "none", zIndex: "20" });
      container.appendChild(outline);
      // Near the window's top or bottom the page scrolls, and the tile with it.
      edge = window.setInterval(() => {
        if (!drag?.active) return;
        const by = drag.y < EDGE_PX ? -16 : drag.y > window.innerHeight - EDGE_PX ? 16 : 0;
        if (by === 0) return;
        drag.scroller.scrollTop += by;
        follow();
      }, 16);
    };

    const end = (keep: boolean) => {
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onCancel, true);
      window.removeEventListener("keydown", onKey, true);
      const d = drag;
      drag = null;
      if (!d?.active) return;
      window.clearInterval(edge);
      outline?.remove();
      outline = null;
      document.body.style.removeProperty("user-select");
      document.body.style.removeProperty("cursor");
      styles.set(d.box.el, "z-index", "");
      styles.set(d.box.el, "opacity", "");
      styles.set(d.box.el, "box-shadow", "");
      styles.set(d.box.el, "cursor", "");
      if (keep && d.place && d.free) {
        const { gap } = metrics();
        // #38.16: the dropped tile, and the tiles under where it was, rise at once.
        placed = riseIntoGaps(dropAt(placed, d.box.id, d.place, gap), gap, lead, new Set(boxes.filter((b) => b.full).map((b) => b.id)));
        const at = placed.find((p) => p.id === d.box.id);
        if (isStorable(d.box.id)) {
          stored = placesToStore(placed, stored, fallback, d.box.id, lead);
          fallback = fallback.filter((id) => id !== d.box.id);
          writePlaces(key, stored);
        } else {
          visit = { ...visit, [d.box.id]: at ? { col: at.col, top: at.top } : d.place };
        }
      }
      // Dropped: where it now stands. Refused or Esc: back where it was.
      apply();
      // The click that ends a drag is not a click on what lies under the pointer.
      const swallow = (e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
      };
      window.addEventListener("click", swallow, { capture: true, once: true });
      window.setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
    };

    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      drag.x = e.clientX;
      drag.y = e.clientY;
      if (!drag.active) {
        if (Math.hypot(drag.x - drag.x0, drag.y - drag.y0) < DRAG_THRESHOLD_PX) return;
        start();
      }
      e.preventDefault();
      follow();
    };
    const onUp = () => end(true);
    const onCancel = () => end(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !drag?.active) return;
      e.preventDefault();
      e.stopPropagation();
      end(false);
    };

    const onPress = (e: PointerEvent) => {
      interacted = true;
      if (drag || e.button !== 0 || !e.isPrimary) return;
      const box = boxAt(e.target);
      const from = box && placed.find((p) => p.id === box.id);
      if (!box || !from || !isDragSurface(e.target, e.clientX, e.clientY, box.el)) return;
      const scroller = scrollerOf(container);
      drag = { box, from, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, scroller, scroll0: scroller.scrollTop, active: false, place: null, free: false };
      window.addEventListener("pointermove", onMove, true);
      window.addEventListener("pointerup", onUp, true);
      window.addEventListener("pointercancel", onCancel, true);
      window.addEventListener("keydown", onKey, true);
    };

    // „grab" over a tile's unused space, and only there.
    const onHover = (e: PointerEvent) => {
      if (drag) return;
      const box = boxAt(e.target);
      const el = box && isDragSurface(e.target, e.clientX, e.clientY, box.el) ? box.el : null;
      if (hovered && hovered !== el) styles.set(hovered, "cursor", "");
      if (el) styles.set(el, "cursor", "grab");
      hovered = el;
    };
    const onLeave = () => {
      if (!drag && hovered) styles.set(hovered, "cursor", "");
      hovered = null;
    };
    container.addEventListener("pointerdown", onPress);
    container.addEventListener("pointermove", onHover);
    container.addEventListener("pointerleave", onLeave);

    // „Implicit" forgot the arrangement: lay the row out afresh even if no tile came or went.
    const onReset = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== entity) return;
      visit = {};
      fresh();
    };
    window.addEventListener(TILE_POSITIONS_RESET, onReset);

    fresh();
    return () => {
      end(false);
      cancelAnimationFrame(frame);
      sizes.disconnect();
      width.disconnect();
      changes.disconnect();
      rightChanges.disconnect();
      styles.restore();
      for (const b of boxes) delete b.el.dataset.packedCol;
      container.removeEventListener("input", acted);
      container.removeEventListener("keydown", acted);
      container.removeEventListener("pointerdown", onPress);
      container.removeEventListener("pointermove", onHover);
      container.removeEventListener("pointerleave", onLeave);
      window.removeEventListener(TILE_POSITIONS_RESET, onReset);
      document.removeEventListener("visibilitychange", shown);
    };
  }, [ref, fitWidest, entity, rightRef, flowUnits]);
}
