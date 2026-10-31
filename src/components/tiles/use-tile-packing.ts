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
 * screen opens", and never after (#38.16's Ask first 3). Since #38.45 it closes
 * only what a tile above gave up: the space the user left above a tile is
 * stored with its place and kept.
 *
 * A DROP NO LONGER RISES; A DOUBLE-CLICK DOES (Slice #38.45). This said „A drop
 * rises at once: the outline shows where the tile is released, it then slides
 * up from there, and what is stored is what the user then sees (#38.16's Ask
 * first 2)." Reversed at Adrian's request: a tile moved away to make room left
 * a hole that the tile under it filled at once. Now a released tile stays
 * where the outline showed it, and nothing else moves. A double-click on a
 * tile's unused space — the surface a drag starts from (`isDragSurface`), so
 * never a field, a button, a link or a list row, where a double-click already
 * means something — rises that one tile, in its own columns, to right under
 * the lowest tile above it, or to the top under the banners (`riseOne`); never
 * sideways, and nothing else moves. It is stored like a drop. No keyboard path:
 * dragging has none either (#38.45's Ask first 2).
 *
 * THE RIGHT-HAND TILES MOVE (Slice 40.32). Everything in the next paragraph
 * about a right column is history: the four record screens have one area now
 * (`TileAreas`), and the tiles their registry's `placement.right` names —
 * `right` here — are boxes of it like any other: found by `findBoxes`,
 * dragged, stored under their tile names. While nothing is stored for one it
 * stands at its starting place (`PackBox.start`): against the row's right edge,
 * one under another in `right`'s order, top-aligned with the row, and the flow
 * keeps to the units left of the widest of them — so a screen opens as it did.
 * When the widest left tile and the widest of them no longer fit side by side
 * (`fitsBeside`, #38.46) they start under the left tiles instead (`under`).
 *
 * UNDER THE RIGHT COLUMN (Slice #37.79, until 40.32). `rightRef` named the right column
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
 * A TILE HELD OVER ANOTHER MAKES ROOM (Slice 39.91). While a tile is
 * dragged, an outline whose snapped place stands still over other tiles for
 * the make-room delay (`makeRoomDelayMs()` — „Setări" since 39.92; a move that changes the snapped
 * place starts the count again) makes those tiles slide down out of its way
 * (`makeRoom`), animated over `MAKE_ROOM_SLIDE_MS` — at once under
 * prefers-reduced-motion — and the outline then shows the place free. A tile
 * that slid stays slid while the drag goes on elsewhere; nothing slides back up
 * under the pointer. A drop keeps them where they slid and stores them with the
 * dropped tile, as one arrangement; Esc, or a release where nothing can drop,
 * puts every one of them back. The banners, the right column's tiles and the
 * action bar never slide. Every screen whose tiles are dragged has this through
 * this hook alone — `tile-drag-guard.test.ts` fails a component that grows a
 * drag of its own.
 *
 * THE FLOW HELD TO `flowUnits` (Slice #38.12). An administration screen with no
 * checkbox bar (`TileUnitRow`, the group screen) opens in fixed columns — two
 * tiles across, the third under the first — however wide the window: the flow
 * keeps to at most `flowUnits` of the row's units, and the rest of the row is
 * free space a tile may be dragged to. Without it, the flow takes the row.
 */
import { useLayoutEffect, useRef, type RefObject } from "react";
import { TILE_FRAME_REM, TILE_INNER_VAR, UNIT_GAP_REM, declaredWidthPx, exactUnitsCss, rem } from "@/lib/ui/field-widths";
import { judgeWidth, laptopUnits, type WidthVerdict } from "@/lib/ui/tile-width-rules";
import { liveUnitPx } from "@/lib/ui/width-unit";
import { columnsIn, fitsBeside, grow, packedHeight, unitsOf, type PackBox, type Placed, ONE_COLUMN_BELOW_UNITS, oneColumn } from "@/lib/ui/tile-packing";
import {
  MAKE_ROOM_SLIDE_MS,
  TILE_POSITIONS_RESET,
  TILES_ALL_UP,
  allUp,
  WRAPPED_PREFIX,
  canDrop,
  dropAt,
  isStorable,
  makeRoom,
  parseStoredPlaces,
  placeWithStored,
  placesToStore,
  resizeTile,
  riseOne,
  snapPlace,
  snapUnits,
  storedPlaceOf,
  tilePositionsKey,
  MAX_UNITS,
  unitsAtLeast,
  widthLimits,
  withStoredWidth,
  type StoredPlace,
  type StoredPlaces,
} from "@/lib/ui/tile-positions";
import { loadMakeRoomDelay, makeRoomDelayMs } from "./make-room-delay";
import { isDragSurface } from "./tile-drag-surface";
import { PLAIN_TILE_WIDTH_WORDS, type TileWidthWords } from "./tile-width-words";
import { TILE_DIAGRAM_DRAG, publishPlaced, type DiagramDrag } from "./tiles-placed";

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
 * An element drawn over the screen rather than in the row — a dialog's overlay
 * (`fixed inset-0`: ConfirmDialog, „Ștergeți actul?"), a toast — is never a box.
 *                                                              (Slice #39.32)
 *
 * ⚠️ **A screen mounts its dialogs where its state lives, and that is inside the
 * row.** The Document's form renders „Ștergeți actul?" beside its tiles, in the
 * same `display: contents` wrapper. Taken for a box, the overlay was given
 * `position: absolute` and a place in a column; `inset-0` then made it as tall
 * as the row, the row grew to hold it, the overlay grew with the row — 12 million
 * pixels, measured — and its panel, centred in it, left the screen. What was left
 * was a grey rectangle under the first tile and no buttons, and the „Da" that
 * would have sent the DELETE was out of reach, so the document stayed.
 */
export function isOverlay(el: HTMLElement): boolean {
  return getComputedStyle(el).position === "fixed";
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
      if (!(child instanceof HTMLElement) || child.hidden || child.dataset.tileOutline !== undefined || child.dataset.tileHandle !== undefined || child.dataset.tileWidthNote !== undefined) continue;
      const display = getComputedStyle(child).display;
      if (display === "none" || isOverlay(child)) continue;
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
    /** 41.17: back to what it was before any `set`, the record kept — a width a drag forced, before it is measured. */
    reset(el: HTMLElement, prop: string): void {
      const was = kept.get(el)?.get(prop);
      if (was === undefined) return;
      if (was) el.style.setProperty(prop, was);
      else el.style.removeProperty(prop);
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
  // 41.16: a unit tile's width is an expression of the live unit (`atLeastUnitsCss`), worked out here on that unit.
  const r = remPx();
  const declared = declaredWidthPx(el.style.width, liveUnitPx(r), r);
  return Math.max(declared || 0, el.offsetWidth);
}

/** 41.17: the width handle — the lists' column handle (40.12) on its side. */
export const TILE_HANDLE_PX = 8;
export const TILE_HANDLE_CLASS = "group absolute z-[25] flex cursor-col-resize justify-center outline-none";
export const TILE_HANDLE_LINE_CLASS =
  "pointer-events-none h-full w-0.5 rounded-full bg-transparent transition-colors group-hover:bg-ink/40 group-focus-visible:bg-cta group-data-[resizing]:bg-cta";

/** 41.18 (Ask first 1, 2): the dragged edge red when the width is refused, amber when it is advised against. */
export const VERDICT_COLOUR: Readonly<Record<WidthVerdict["kind"], string>> = {
  ok: "var(--color-cta)",
  refused: "var(--color-danger)",
  advised: "var(--color-warning)",
};

/** 41.18: the bubble beside a dragged edge — the app's tooltip, as an icon button's (icon-button.tsx); a line a reason. */
export const TILE_WIDTH_NOTE_CLASS =
  "pointer-events-none absolute z-[70] max-w-[20rem] whitespace-pre-line rounded-md border border-card-rim bg-white px-2 py-1 text-xs leading-snug font-medium text-ink shadow-lg dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200";

/** 41.18: the narrowest a tile can be, and what sets it. */
interface Floor {
  units: number;
  /** It holds fixed boxes at all. */
  fields: boolean;
  /** The row that stops it going one unit narrower: its fields, and the px the tile needs to hold it. */
  widest?: { fields: string; px: number };
}

/** 41.17–41.18: what a tile's edge was measured to allow when it was pressed or stepped. */
interface Measured {
  min: number;
  max: number;
  content: number;
  widest?: { fields: string; px: number };
  fields: boolean;
  table?: number;
  beside: { col: number; title: string }[];
  col: number;
  laptop: number;
}

/** A fixed box's name: its field's label, else its own. */
function labelOf(d: HTMLElement): string {
  const own = d.closest<HTMLElement>("label") ?? d;
  const text = own.querySelector("span")?.textContent?.replace(/\s+/g, " ").trim();
  return text || d.getAttribute("aria-label") || d.dataset.widthField || "";
}

/**
 * Packs the boxes of the row `ref` points at, and lets the user drag them.
 * `fitWidest`: give the row a min-width of its widest box — for #37.56's left
 * area, a flex item that would otherwise shrink to nothing once its boxes are
 * out of the flow. `entity`: the tile choice's (`TileRegistry.entity`, per
 * document type), under which the arrangement is stored; none, nothing is.
 * `flowUnits`: the most units the flow takes across (#38.12); none, the row's.
 * `right`: the right-hand tiles' names, top to bottom (`placement.right`, Slice 40.32) — boxes like the others, each
 * starting against the row's right edge while nothing is stored for it.
 */
export function useTilePacking(
  ref: RefObject<HTMLElement | null>,
  {
    fitWidest = false,
    entity,
    right,
    flowUnits,
    words: wordsGiven,
  }: { fitWidest?: boolean; entity?: string; right?: readonly string[]; flowUnits?: number; words?: TileWidthWords } = {},
): void {
  // A stable dependency: the screens pass a fresh array on every render.
  const rightKey = (right ?? []).join("|");
  // 41.17: the width handle's words, in the screen's language (`useTileWidthWords`, handed over by the screen), for
  // the effect below — which outlives any one render.
  const words = useRef<TileWidthWords>(PLAIN_TILE_WIDTH_WORDS);
  useLayoutEffect(() => {
    words.current = wordsGiven ?? PLAIN_TILE_WIDTH_WORDS;
  });
  useLayoutEffect(() => {
    const container = ref.current;
    // jsdom (jest) has no layout and no ResizeObserver: the row stays a flex-wrap there.
    if (!container || typeof ResizeObserver === "undefined") return;
    // 39.92: the make-room delay saved in „Setări", read once per page load — long before anyone holds a tile.
    void loadMakeRoomDelay();
    const key = entity ? tilePositionsKey(entity) : null;
    const rightNames = rightKey ? rightKey.split("|") : [];
    // A box's tile: its id, or — a panel inside a `display: contents` tile wrapper, the Property's map and corners —
    // the tile's name before its place inside it („map#0"); a right-hand tile started under the left ones is
    // `wrapped:<id>` (below).
    const tileOf = (id: string) => id.replace(/^wrapped:/, "").replace(/#\d+$/, "");
    const isRight = (b: FoundBox) => rightNames.includes(tileOf(b.id));
    let placed: Placed[] = [];
    let boxes: FoundBox[] = [];
    // The row's units, and the flow's (40.32: left of the right-hand tiles at their starting places).
    let columns = 0;
    let flowColumns = 0;
    // The units this row's own width holds (#38.12: `flowColumns` may be fewer).
    let ownColumns = 0;
    // Slice 40.69: the row is too narrow for two columns — its tiles drawn one under another (`oneColumn`).
    let single = false;
    let settleUntil = 0;
    let interacted = false;
    let frame = 0;
    let stored: StoredPlaces = {};
    let fallback: string[] = [];
    // 40.32: the right-hand tiles standing at their starting places in the last layout — never stored by another
    // tile's drop, so they keep starting at the right edge until the user moves one of them.
    let startIds: string[] = [];
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
      /** 39.91: the snapped place the make-room count runs on (`col:top`), or none yet. */
      held: string | null;
      /** 39.91: the arrangement before the first tile made room — what Esc or a refused release puts back. */
      before: Placed[] | null;
      /** 39.91: every tile that made room during this drag. */
      slid: string[];
      /** 40.53: started from the tiles diagram — no pointer of its own on the row, no scrolling at the window's edges. */
      fromDiagram?: boolean;
    }
    let drag: Drag | null = null;

    const metrics = () => {
      const r = remPx();
      // 41.16: the unit set on „Setări" — `--unit` as the browser resolves it — not the 119-px default.
      return { unit: liveUnitPx(r), gap: UNIT_GAP_REM * r };
    };

    const styles = styleKeeper();

    // 41.17: a tile's width set by dragging its right edge, stored in units beside its place.
    /** The boxes whose width a stored one forces (this layout): `apply` sets it, `layout` takes it off to measure. */
    const forced = new Set<string>();
    /** Each box's own width in units — what its screen draws — measured in `layout` before any width is forced. */
    const ownUnits = new Map<string, number>();
    /** A box whose width can be dragged: a tile the arrangement stores — not a banner, a fixed box or a preview. */
    const canResize = (b: FoundBox) => !b.full && !b.rowEnd && isStorable(b.id);
    /** Too narrow for two columns (40.69): drawn as one, and every tile at its own width. */
    const narrow = () => ownColumns < ONE_COLUMN_BELOW_UNITS;
    /** A box's width in units: its stored one, else its own — measured afresh unless a stored width is forcing it. */
    const widthOf = (b: FoundBox, unit: number, gap: number) => {
      const own = forced.has(b.id) ? (ownUnits.get(b.id) ?? 1) : unitsOf(ownWidth(b.el), unit, gap);
      const set = canResize(b) && !narrow() ? stored[b.id]?.units : undefined;
      return set ?? own;
    };
    /** A box's width in units, as the flow takes it: a right-hand tile may reach past the flow's units (40.32). */
    const unitsFor = (b: FoundBox, unit: number, gap: number) => Math.min(widthOf(b, unit, gap), isRight(b) ? columns : flowColumns);

    const apply = () => {
      const { unit, gap } = metrics();
      styles.set(container, "position", "relative");
      styles.set(container, "height", `${packedHeight(placed)}px`);
      const byId = new Map(boxes.map((b) => [b.id, b]));
      let widest = 0;
      for (const p of placed) {
        const box = byId.get(p.id);
        if (!box) continue;
        // Slice 40.69: in one column a tile is never wider than the row — one whose content cannot shrink (a wide
        // table, a fixed-width form) scrolls inside itself, never the page (Ask first 3).
        const tooWide = single && ownWidth(box.el) > container.clientWidth + 0.5;
        styles.set(box.el, "max-width", tooWide ? "100%" : "");
        styles.set(box.el, "overflow-x", tooWide ? "auto" : "");
        styles.set(box.el, "position", "absolute");
        styles.set(box.el, "left", `${p.col * (unit + gap)}px`);
        styles.set(box.el, "top", `${p.top}px`);
        styles.set(box.el, "margin", "0");
        // #38.47: the action bar spans the row's units; a banner the row.
        if (p.rowEnd) styles.set(box.el, "width", `${p.units * (unit + gap) - gap}px`);
        else if (box.full) styles.set(box.el, "width", "100%");
        else {
          // 41.17: a stored width — at most what the row holds on this window, for this visit — is forced, with the inner
          // width a TILE box, Note and a list tile's table follow; every other tile keeps its own.
          const own = ownUnits.get(p.id);
          if (!single && canResize(box) && stored[p.id]?.units !== undefined && own !== undefined && p.units !== own) {
            const w = exactUnitsCss(p.units);
            styles.set(box.el, "width", w);
            styles.set(box.el, TILE_INNER_VAR, `calc(${w} - ${rem(TILE_FRAME_REM)})`);
            forced.add(p.id);
          }
          widest = Math.max(widest, ownWidth(box.el));
        }
        box.el.dataset.packedCol = String(p.col);
      }
      // Slice 40.69: in one column the row holds no tile wider than itself, so it is not stretched to the widest.
      if (fitWidest) styles.set(container, "min-width", single ? "" : `${widest}px`);
      syncHandles();
      publish();
    };

    // Slice 40.42: tell the tiles diagram where the tiles now stand — not while a tile is dragged (the drop does), except
    // a drag the diagram started (40.53): it redraws from this as the tiles make room, and rims the tile red where it
    // cannot drop.
    const publish = () => {
      if (!entity || (drag?.active && !drag.fromDiagram)) return;
      const { unit, gap } = metrics();
      const byId = new Map(boxes.map((b) => [b.id, b]));
      publishPlaced({
        entity,
        columns,
        gap,
        unit,
        boxes: placed
          .filter((p) => !p.rowEnd && byId.has(p.id) && !byId.get(p.id)!.full)
          .map((p) => ({ id: p.id.replace(/^wrapped:/, ""), col: p.col, units: p.units, top: p.top, height: p.height })),
        ...(drag?.active && drag.fromDiagram ? { drag: { id: drag.box.id.replace(/^wrapped:/, ""), free: drag.free } } : {}),
      });
    };

    const heights = () => new Map(boxes.map((b) => [b.id, b.el.offsetHeight]));

    const layout = () => {
      if (drag?.active || resize) return;
      const { unit, gap } = metrics();
      boxes = findBoxes(container);
      // 41.17: every width a stored one forced goes back to the screen's own before anything is measured; `apply` sets
      // it again.
      for (const b of boxes) {
        styles.reset(b.el, "width");
        styles.reset(b.el, TILE_INNER_VAR);
      }
      forced.clear();
      ownUnits.clear();
      ownColumns = columnsIn(container.clientWidth, unit, gap);
      columns = ownColumns;
      flowColumns = flowUnits ? Math.min(ownColumns, Math.max(1, flowUnits)) : ownColumns;
      stored = readPlaces(key);
      const h = heights();
      // 40.32: the right-hand tiles, in `right`'s order; those with nothing stored (this visit or before) start at the
      // row's right edge, one under another — or, when they and the widest left tile do not fit side by side
      // (#38.46), under the left tiles.
      const rightBoxes = rightNames.flatMap((n) => boxes.filter((b) => tileOf(b.id) === n));
      const own = (b: FoundBox) => widthOf(b, unit, gap);
      const leftUnits = boxes.filter((b) => !b.full && !b.rowEnd && !rightBoxes.includes(b)).map(own);
      const starting = rightBoxes.filter((b) => !stored[b.id] && !visit[b.id]);
      const beside = fitsBeside(leftUnits, starting.map(own), ownColumns);
      const start = new Map<string, { col: number; top: number }>();
      if (beside && starting.length > 0) {
        let top = 0;
        for (const b of starting) {
          const units = Math.min(own(b), ownColumns);
          start.set(b.id, { col: ownColumns - units, top });
          top += (h.get(b.id) ?? 0) + gap;
        }
        flowColumns = Math.max(1, Math.min(flowColumns, ownColumns - Math.max(...starting.map(own))));
      }
      // Beside: a tile at its start is not stored by another tile's drop (`store`), so it keeps starting there.
      // Wrapped (#38.46): it is `wrapped:<id>` — placed under the left tiles, and stored like a tile under that id,
      // so a tile dropped under it keeps its place after a reload — and never read at a width where it starts beside.
      startIds = beside ? starting.map((b) => b.id) : [];
      const under = new Set<string>();
      if (!beside) {
        boxes = boxes.map((b) => {
          if (!starting.includes(b)) return b;
          const id = `${WRAPPED_PREFIX}${b.id}`;
          h.set(id, h.get(b.id) ?? 0);
          under.add(id);
          return { ...b, id };
        });
      }
      for (const b of boxes) ownUnits.set(b.id, unitsOf(ownWidth(b.el), unit, gap));
      const items: PackBox[] = boxes.map((b) => ({
        id: b.id,
        units: b.rowEnd || b.full ? flowColumns : unitsFor(b, unit, gap),
        height: h.get(b.id) ?? 0,
        anchor: b.anchor,
        full: b.full,
        rowEnd: b.rowEnd,
        ...(start.has(b.id) ? { start: start.get(b.id) } : {}),
        ...(under.has(b.id) ? { under: true } : {}),
      }));
      const r = placeWithStored(items, { ...stored, ...visit }, columns, gap, flowColumns);
      // Slice 40.69: too narrow for two columns, the same arrangement is DRAWN as one; what is stored is untouched.
      single = ownColumns < ONE_COLUMN_BELOW_UNITS;
      placed = single ? oneColumn(r.placed, gap) : r.placed;
      fallback = r.fallback;
      lead = r.lead;
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
        if (drag?.active || resize) return;
        const { unit, gap } = metrics();
        if (columnsIn(container.clientWidth, unit, gap) !== ownColumns) return fresh();
        // A ResizeObserver also reports every box once when it starts observing it:
        // only a height that differs from the one placed is a change.
        // A box whose width in units changed (a preview past „Se încarcă…") needs a new place.
        const byId = new Map(boxes.map((b) => [b.id, b]));
        if (placed.some((p) => !p.rowEnd && byId.has(p.id) && !byId.get(p.id)!.full && unitsFor(byId.get(p.id)!, unit, gap) !== p.units)) return layout();
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
      const same = now.length === boxes.length && now.every((b, i) => b.el === boxes[i].el && b.id === boxes[i].id.replace(/^wrapped:/, ""));
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
    // 39.91: the make-room count, and the slide's end.
    let hold = 0;
    let slideEnd = 0;
    let sliding: HTMLElement[] = [];

    const boxAt = (target: EventTarget | null): FoundBox | undefined =>
      target instanceof Node ? boxes.find((b) => !b.rowEnd && !b.full && b.el.contains(target)) : undefined;

    /** The one place the arrangement is written: a drop, a double-click's rise, „Toate sus”, a width (41.17). */
    const persist = () => writePlaces(key, stored);

    // Box `id` now stands where the user put it — and `slid`, the tiles that made room for it (39.91):
    // store the arrangement, as one — a preview's place for this visit only.
    const store = (id: string, slid: readonly string[] = []) => {
      // Slice 40.69: one column is a way of drawing, never an arrangement — nothing dragged there is stored.
      if (single) return;
      const { gap } = metrics();
      const moved = [id, ...slid];
      const lasting = moved.filter(isStorable);
      if (lasting.length > 0) {
        const unmoved = startIds.filter((s) => !lasting.includes(s) && !(s in stored));
        const next = placesToStore(placed, stored, fallback, lasting, lead, gap);
        for (const s of unmoved) delete next[s];
        stored = next;
        fallback = fallback.filter((f) => !lasting.includes(f));
        persist();
      }
      for (const m of moved.filter((x) => !isStorable(x))) {
        const at = placed.find((p) => p.id === m);
        if (at) visit = { ...visit, [m]: storedPlaceOf(placed, at, gap, lead) };
      }
    };

    // 39.91: the tiles named slide to their places over MAKE_ROOM_SLIDE_MS, the action bar with them; at once under reduced motion.
    const slide = (ids: readonly string[]) => {
      const still = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (still) return;
      const byId = new Map(boxes.map((b) => [b.id, b]));
      const els = [...ids, ...placed.filter((p) => p.rowEnd).map((p) => p.id)].map((id) => byId.get(id)?.el).filter((el): el is HTMLElement => !!el);
      // 40.40: `left` too — „Toate sus" moves a tile across to the shortest column.
      for (const el of els) styles.set(el, "transition", `top ${MAKE_ROOM_SLIDE_MS}ms ease, left ${MAKE_ROOM_SLIDE_MS}ms ease`);
      sliding = [...new Set([...sliding, ...els])];
      window.clearTimeout(slideEnd);
      slideEnd = window.setTimeout(() => {
        for (const el of sliding) styles.set(el, "transition", "");
        sliding = [];
      }, MAKE_ROOM_SLIDE_MS + 50);
    };

    // 39.91: the outline has stood still over other tiles for the delay — they make room, and it shows the place free.
    const makeRoomNow = () => {
      const d = drag;
      if (!d?.active || !d.place) return;
      const still = new Set(boxes.filter((b) => b.full).map((b) => b.id));
      const r = makeRoom(placed, d.box.id, d.place, columns, metrics().gap, still);
      if (!r) return;
      d.before ??= placed;
      d.slid = [...new Set([...d.slid, ...r.slid])];
      placed = r.placed;
      slide(r.slid);
      apply();
      follow();
    };

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
      // 39.91: the count runs while the snapped place stands still over other tiles; a new place starts it again.
      const at = `${place.col}:${place.top}`;
      if (at !== drag.held) {
        drag.held = at;
        window.clearTimeout(hold);
        if (!drag.free) hold = window.setTimeout(makeRoomNow, makeRoomDelayMs());
      }
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
      // 40.53: the diagram rims its rectangle red where the tile cannot drop.
      if (drag.fromDiagram) publish();
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
      // Near the window's top or bottom the page scrolls, and the tile with it — not for a drag the diagram runs (40.53).
      edge = window.setInterval(() => {
        if (!drag?.active || drag.fromDiagram) return;
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
      window.clearTimeout(hold);
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
        // #38.45: the dropped tile stands where it was released; nothing rises — the space it left stays empty.
        // 39.91: the tiles that made room stay where they slid, and are stored with it.
        placed = dropAt(placed, d.box.id, d.place, gap);
        store(d.box.id, d.slid);
      } else if (d.before) {
        // 39.91: Esc, or a release where nothing can drop — every tile that made room goes back.
        placed = d.before;
        slide(d.slid);
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
      // Slice 40.69: in one column the tiles are not dragged (Ask first 2: the arrangement is not touched there).
      if (drag || single || e.button !== 0 || !e.isPrimary) return;
      const box = boxAt(e.target);
      const from = box && placed.find((p) => p.id === box.id);
      if (!box || !from || !isDragSurface(e.target, e.clientX, e.clientY, box.el)) return;
      const scroller = scrollerOf(container);
      drag = { box, from, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, scroller, scroll0: scroller.scrollTop, active: false, place: null, free: false, held: null, before: null, slid: [] };
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
    // #38.45: a double-click on a tile's unused space rises that one tile; nothing else moves.
    const onDouble = (e: MouseEvent) => {
      if (drag?.active || e.button !== 0) return;
      const box = boxAt(e.target);
      if (!box || !isDragSurface(e.target, e.clientX, e.clientY, box.el)) return;
      // A double-click selects the word nearest the pointer; on empty space there is nothing to select.
      window.getSelection()?.removeAllRanges();
      const next = riseOne(placed, box.id, metrics().gap, lead);
      if (!next) return;
      placed = next;
      store(box.id);
      apply();
    };
    container.addEventListener("pointerdown", onPress);
    container.addEventListener("pointermove", onHover);
    container.addEventListener("pointerleave", onLeave);
    container.addEventListener("dblclick", onDouble);

    // Slice 40.53 — a drag started from the tiles diagram, run as this hook's own: the diagram tells how far the tile has
    // moved from where it stood, in the screen's px, so `follow` places it, snaps the outline, starts the make-room count
    // and makes room exactly as for a drag on the screen; a drop stores it as any drop; Esc (onKey) or a cancel puts
    // everything back.
    const onDiagram = (e: Event) => {
      const d = (e as CustomEvent<DiagramDrag>).detail;
      if (d.entity !== entity) return;
      if (d.phase === "start") {
        if (drag) return;
        const box = boxes.find((b) => b.id.replace(/^wrapped:/, "") === d.id && !b.rowEnd && !b.full);
        const from = box && placed.find((p) => p.id === box.id);
        if (!box || !from) return;
        const scroller = scrollerOf(container);
        drag = { box, from, x0: 0, y0: 0, x: d.dx, y: d.dy, scroller, scroll0: scroller.scrollTop, active: false, place: null, free: false, held: null, before: null, slid: [], fromDiagram: true };
        window.addEventListener("keydown", onKey, true);
        start();
        follow();
        return;
      }
      if (!drag?.fromDiagram) return;
      if (d.phase === "move") {
        drag.x = d.dx;
        drag.y = d.dy;
        follow();
      } else end(d.phase === "drop");
    };
    window.addEventListener(TILE_DIAGRAM_DRAG, onDiagram);

    // „Implicit" forgot the arrangement: lay the row out afresh even if no tile came or went.
    const onReset = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== entity) return;
      visit = {};
      fresh();
    };
    window.addEventListener(TILE_POSITIONS_RESET, onReset);

    // 40.40 „Toate sus": every tile up, then the columns evened (`allUp`); the tiles slide there, and the arrangement is
    // stored as one, as a drop is. The banners never move; a press with nothing to move moves nothing.
    const onAllUp = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== entity || drag?.active) return;
      const still = new Set(boxes.filter((b) => b.full).map((b) => b.id));
      const r = allUp(placed, columns, metrics().gap, lead, still);
      if (!r) return;
      placed = r.placed;
      slide(r.moved);
      store(r.moved[0], r.moved.slice(1));
      apply();
    };
    window.addEventListener(TILES_ALL_UP, onAllUp);

    // ---- 41.17: a tile's width, dragged by its right edge ------------------------------------------------------------
    // Ask first 1: the lists' column handle (40.12) on its side — an 8-px strip on the tile's right edge, its whole height,
    // the col-resize cursor, a line darker while hovered or dragged; a focusable separator named „Lățimea panoului
    // {title}”: Left and Right step one unit, Home or a double-click gives the tile its own width back. It holds the
    // pointer while dragged, so a drag that ends over a button presses nothing. One per tile, in the row itself
    // (`data-tile-handle`, which `findBoxes` skips), so nothing is added inside a tile React draws.
    const handles = new Map<string, HTMLDivElement>();
    interface Resize {
      box: FoundBox;
      handle: HTMLDivElement;
      /** Its width in units when pressed. */
      from: number;
      min: number;
      max: number;
      /** 41.18: what was measured when it was pressed — the verdict's case, less the width asked. */
      measured: Measured;
      x0: number;
      /** Its width in px when pressed, and as drawn now. */
      px0: number;
      px: number;
      pointer: number;
    }
    let resize: Resize | null = null;

    const boxOf = (id: string) => boxes.find((b) => b.id === id);
    const titleOf = (b: FoundBox) =>
      b.el.querySelector("h2, h3")?.textContent?.replace(/\s+/g, " ").trim() || b.el.getAttribute("aria-label") || tileOf(b.id);
    const drawWidth = (el: HTMLElement, w: string) => {
      styles.set(el, "width", w);
      styles.set(el, TILE_INNER_VAR, `calc(${w} - ${rem(TILE_FRAME_REM)})`);
    };

    /**
     * Ask first 3 and 4: the narrowest the tile can be with every fixed box in it — a box with a width of its own, not
     * one in a table and not one that fills the tile — keeping its size, inside the tile, and on the row it shares with
     * its neighbours. Tried a unit at a time from `from` down; the tile is put back as it was before anything paints.
     */
    const narrowest = (b: FoundBox, from: number, unit: number, gap: number): Floor => {
      const el = b.el;
      const fixed = Array.from(el.querySelectorAll<HTMLElement>("*")).filter(
        (d) =>
          /^[0-9.]+(rem|px)$/.test(d.style.width) &&
          !d.closest("table") &&
          d.getClientRects().length > 0 &&
          !/^(absolute|fixed)$/.test(getComputedStyle(d).position),
      );
      const shape = () => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const inner = r.right - parseFloat(cs.paddingRight || "0") - parseFloat(cs.borderRightWidth || "0");
        return fixed.map((d) => {
          const x = d.getBoundingClientRect();
          return { w: x.width, top: x.top, right: x.right, inner };
        });
      };
      const base = shape();
      const rows: [number, number][] = [];
      for (let i = 0; i < fixed.length; i++)
        for (let j = i + 1; j < fixed.length; j++)
          if (fixed[i].parentElement === fixed[j].parentElement && Math.abs(base[i].top - base[j].top) < 0.5) rows.push([i, j]);
      // 41.18: which boxes a width breaks — they name the row that sets the floor.
      const broken = (s: ReturnType<typeof shape>): number[] => {
        const bad = new Set<number>();
        s.forEach((x, i) => {
          if (Math.abs(x.w - base[i].w) >= 0.5 || x.right > x.inner + 0.5) bad.add(i);
        });
        for (const [i, j] of rows) if (Math.abs(s[i].top - s[j].top) >= 0.5) bad.add(i).add(j);
        return [...bad];
      };
      let widest: Floor["widest"];
      const box0 = el.getBoundingClientRect();
      const width0 = el.style.getPropertyValue("width");
      const inner0 = el.style.getPropertyValue(TILE_INNER_VAR);
      let n = from;
      try {
        for (let k = from - 1; k >= 1; k--) {
          const px = k * (unit + gap) - gap;
          el.style.setProperty("width", `${px}px`);
          el.style.setProperty(TILE_INNER_VAR, `calc(${px}px - ${rem(TILE_FRAME_REM)})`);
          // The tile itself holds too: drawn at the width it is given (no min-width keeps it wider) and nothing in it
          // spilling past its edge — a heading that does not wrap, a button row.
          const drawn = el.getBoundingClientRect().width;
          if (Math.abs(drawn - px) >= 0.5 || el.scrollWidth > el.clientWidth + 1) {
            widest = { fields: titleOf(b), px: Math.max(drawn, el.scrollWidth + (el.offsetWidth - el.clientWidth)) };
            break;
          }
          const bad = broken(shape());
          if (bad.length > 0) {
            // The row of the first box that broke: it and every box beside it, as they stood at `from`.
            const row = new Set([bad[0]]);
            for (const [i, j] of rows) if (row.has(i) || row.has(j)) row.add(i).add(j);
            const right = Math.max(...[...row].map((i) => base[i].right));
            const fields = [...new Set([...row].map((i) => labelOf(fixed[i])).filter(Boolean))];
            widest = { fields: fields.join(" | "), px: right - box0.left + (box0.right - base[0].inner) };
            break;
          }
          n = k;
        }
      } finally {
        if (width0) el.style.setProperty("width", width0);
        else el.style.removeProperty("width");
        if (inner0) el.style.setProperty(TILE_INNER_VAR, inner0);
        else el.style.removeProperty(TILE_INNER_VAR);
      }
      return { units: n, fields: fixed.length > 0, widest };
    };

    /** 41.18: a list tile's table — the units its columns need at their own widths, its frame and the tile's. */
    const tableUnitsOf = (b: FoundBox, unit: number, gap: number): number | undefined => {
      const table = b.el.querySelector<HTMLTableElement>("table[data-width-table]");
      if (!table) return undefined;
      let rems = 0;
      for (const c of Array.from(table.querySelectorAll<HTMLElement>("col"))) {
        rems += /^[0-9.]+rem$/.test(c.style.width) ? parseFloat(c.style.width) : Number(c.dataset.fillBase ?? 0);
      }
      return unitsAtLeast((rems + TILE_FRAME_REM) * remPx() + 2, unit, gap);
    };

    const limitsOf = (b: FoundBox, p: Placed): Measured => {
      const { unit, gap } = metrics();
      const still = new Set(boxes.filter((x) => x.full).map((x) => x.id));
      const floor = narrowest(b, p.units, unit, gap);
      const limits = widthLimits(placed, b.id, floor.units, columns, gap, still);
      const beside = placed
        .filter((q) => q.id !== p.id && !q.rowEnd && q.col >= p.col + p.units && q.top < p.top + p.height && p.top < q.top + q.height)
        .map((q) => {
          const qb = boxOf(q.id);
          return { col: q.col, title: qb ? titleOf(qb) : tileOf(q.id) };
        });
      return { ...limits, content: floor.units, widest: floor.widest, fields: floor.fields, table: tableUnitsOf(b, unit, gap), beside, col: p.col, laptop: laptopUnits(unit, gap) };
    };

    /** 41.18: the verdict on `asked` units for what was measured. */
    const verdictOf = (m: Measured, asked: number): WidthVerdict =>
      judgeWidth({
        asked,
        min: m.min,
        max: m.max,
        widest: m.widest,
        contentUnits: m.content,
        hasFields: m.fields,
        tableUnits: m.table,
        beside: m.beside,
        col: m.col,
        laptopUnits: m.laptop,
      });

    // 41.18 (Ask first 3): a small bubble beside the edge, near the pointer, in the app's tooltip style, gone when the
    // drag ends; the same words in a polite live region, which the keyboard's steps fill too. Not a toast, not a dialog.
    let note: HTMLDivElement | null = null;
    let live: HTMLDivElement | null = null;
    let spoken = "";
    let noteTimer = 0;
    const say = (lines: readonly string[]) => {
      const text = lines.join(" ");
      if (!live) {
        live = document.createElement("div");
        live.dataset.tileWidthNote = "live";
        live.className = "sr-only";
        live.setAttribute("role", "status");
        live.setAttribute("aria-live", "polite");
        container.appendChild(live);
      }
      if (text !== spoken) live.textContent = spoken = text;
    };
    const showNote = (lines: readonly string[], verdict: WidthVerdict["kind"], x: number, y: number) => {
      window.clearTimeout(noteTimer);
      say(lines);
      if (lines.length === 0) return hideNote(false);
      if (!note) {
        note = document.createElement("div");
        note.dataset.tileWidthNote = "bubble";
        note.className = TILE_WIDTH_NOTE_CLASS;
        note.setAttribute("aria-hidden", "true");
      }
      if (note.parentElement !== container) container.appendChild(note);
      note.dataset.verdict = verdict;
      note.textContent = lines.join("\n");
      note.style.setProperty("left", `${Math.max(0, x)}px`);
      note.style.setProperty("top", `${Math.max(0, y)}px`);
    };
    const hideNote = (quiet = true) => {
      window.clearTimeout(noteTimer);
      note?.remove();
      if (quiet) spoken = "";
    };
    /** The edge's line while it is dragged: the action colour, red when refused, amber when advised; none after. */
    const paint = (h: HTMLElement, verdict: WidthVerdict["kind"] | null) => {
      const line = h.firstElementChild as HTMLElement | null;
      if (!line) return;
      if (verdict === null) line.style.removeProperty("background-color");
      else line.style.backgroundColor = VERDICT_COLOUR[verdict];
    };
    /** Where the bubble goes beside tile `p`'s edge: just right of it, at `y` (container px). */
    const besideEdge = (p: Placed, widthPx: number, y: number): [number, number] => {
      const { unit, gap } = metrics();
      return [p.col * (unit + gap) + widthPx + 12, y];
    };

    const describe = (h: HTMLElement, units: number, limits?: { min: number; max: number }) => {
      h.setAttribute("aria-valuenow", String(units));
      h.setAttribute("aria-valuetext", words.current.units(units));
      if (limits) {
        h.setAttribute("aria-valuemin", String(limits.min));
        h.setAttribute("aria-valuemax", String(limits.max));
      }
    };

    /** Every tile's handle where its right edge is drawn; none on a one-column screen, nor while a tile is carried. */
    const syncHandles = () => {
      if (drag?.active) return;
      if (!key || single) {
        for (const h of handles.values()) h.remove();
        handles.clear();
        return;
      }
      const { unit, gap } = metrics();
      const byId = new Map(boxes.map((b) => [b.id, b]));
      const live = new Set<string>();
      for (const p of placed) {
        const b = byId.get(p.id);
        if (!b || p.rowEnd || p.fixed || !canResize(b)) continue;
        live.add(p.id);
        let h = handles.get(p.id);
        if (!h) {
          h = makeHandle(p.id);
          handles.set(p.id, h);
        }
        if (h.parentElement !== container) container.appendChild(h);
        const w = resize?.box.id === p.id ? resize.px : b.el.offsetWidth;
        h.style.setProperty("left", `${p.col * (unit + gap) + w - TILE_HANDLE_PX / 2}px`);
        h.style.setProperty("top", `${p.top}px`);
        h.style.setProperty("height", `${Math.max(p.height, b.el.offsetHeight)}px`);
        h.setAttribute("aria-label", words.current.handle(titleOf(b)));
        if (resize?.box.id !== p.id) describe(h, p.units);
      }
      for (const [id, h] of handles) {
        if (live.has(id)) continue;
        h.remove();
        handles.delete(id);
      }
    };

    /** Tile `id` at `units` wide: the tiles it now overlaps slide down, and its width and their places are stored. */
    const commit = (id: string, units: number) => {
      const b = boxOf(id);
      const p = placed.find((x) => x.id === id);
      if (!b || !p || single) return;
      if (units === p.units) {
        apply();
        return;
      }
      const own = ownUnits.get(id);
      const still = new Set(boxes.filter((x) => x.full).map((x) => x.id));
      const r = resizeTile(placed, id, units, columns, metrics().gap, still);
      placed = r.placed;
      slide(r.slid);
      store(id, r.slid);
      stored = withStoredWidth(stored, id, units === own ? undefined : units);
      persist();
      layout();
    };

    /** Home, or a double-click: the tile's own width again — its stored width forgotten. */
    const toOwn = (id: string) => {
      if (stored[id]?.units === undefined) return;
      stored = withStoredWidth(stored, id, undefined);
      persist();
      layout();
    };

    const endResize = (): Resize | null => {
      const r = resize;
      if (!r) return null;
      resize = null;
      window.removeEventListener("pointermove", onEdgeMove, true);
      window.removeEventListener("pointerup", onEdgeUp, true);
      window.removeEventListener("pointercancel", onEdgeCancel, true);
      window.removeEventListener("keydown", onEdgeEscape, true);
      r.handle.removeEventListener("lostpointercapture", onEdgeCancel);
      delete r.handle.dataset.resizing;
      delete r.handle.dataset.verdict;
      paint(r.handle, null);
      hideNote();
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
      if (r.handle.hasPointerCapture?.(r.pointer)) r.handle.releasePointerCapture(r.pointer);
      styles.reset(r.box.el, "width");
      styles.reset(r.box.el, TILE_INNER_VAR);
      forced.delete(r.box.id);
      return r;
    };

    const onEdgeMove = (e: PointerEvent) => {
      const r = resize;
      if (!r) return;
      e.preventDefault();
      const { unit, gap } = metrics();
      // The edge follows the pointer, and stops where the tile can go no further (41.18 says why).
      const lo = r.min * (unit + gap) - gap;
      const hi = r.max * (unit + gap) - gap;
      r.px = Math.min(hi, Math.max(lo, r.px0 + (e.clientX - r.x0)));
      drawWidth(r.box.el, `${r.px}px`);
      syncHandles();
      describe(r.handle, snapUnits(r.from, e.clientX - r.x0, unit, gap, r.min, r.max));
      // 41.18: what the width the pointer asks for — unclamped — would be: refused (red), advised (amber), or fine.
      const asked = snapUnits(r.from, e.clientX - r.x0, unit, gap, -MAX_UNITS, MAX_UNITS);
      const verdict = verdictOf(r.measured, asked);
      r.handle.dataset.verdict = verdict.kind;
      paint(r.handle, verdict.kind);
      const p = placed.find((x) => x.id === r.box.id);
      if (p) showNote(words.current.verdict(verdict), verdict.kind, ...besideEdge(p, r.px, e.clientY - container.getBoundingClientRect().top - 12));
    };
    const onEdgeUp = (e: PointerEvent) => {
      const r = endResize();
      if (!r) return;
      const { unit, gap } = metrics();
      commit(r.box.id, snapUnits(r.from, e.clientX - r.x0, unit, gap, r.min, r.max));
    };
    const onEdgeCancel = () => {
      if (!endResize()) return;
      apply();
    };
    const onEdgeEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !resize) return;
      e.preventDefault();
      e.stopPropagation();
      onEdgeCancel();
    };

    const onEdgePress = (e: PointerEvent, id: string) => {
      if (e.button !== 0 || !e.isPrimary || drag || resize || single) return;
      const b = boxOf(id);
      const p = placed.find((x) => x.id === id);
      const h = handles.get(id);
      if (!b || !p || !h) return;
      e.preventDefault();
      e.stopPropagation();
      interacted = true;
      const limits = limitsOf(b, p);
      const px = b.el.offsetWidth;
      resize = { box: b, handle: h, from: p.units, min: limits.min, max: limits.max, measured: limits, x0: e.clientX, px0: px, px, pointer: e.pointerId };
      describe(h, p.units, limits);
      paint(h, "ok");
      h.setPointerCapture?.(e.pointerId);
      h.dataset.resizing = "";
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("pointermove", onEdgeMove, true);
      window.addEventListener("pointerup", onEdgeUp, true);
      window.addEventListener("pointercancel", onEdgeCancel, true);
      window.addEventListener("keydown", onEdgeEscape, true);
      h.addEventListener("lostpointercapture", onEdgeCancel);
    };

    const onEdgeKey = (e: KeyboardEvent, id: string) => {
      if (resize || drag?.active || single) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home") return;
      const b = boxOf(id);
      const p = placed.find((x) => x.id === id);
      if (!b || !p) return;
      e.preventDefault();
      e.stopPropagation();
      interacted = true;
      if (e.key === "Home") return toOwn(id);
      const limits = limitsOf(b, p);
      // 41.18: a step the tile cannot take is refused, and said; one it can is taken, and its cost said.
      const asked = p.units + (e.key === "ArrowRight" ? 1 : -1);
      const verdict = verdictOf(limits, asked);
      if (verdict.kind !== "refused") commit(id, asked);
      const at = placed.find((x) => x.id === id) ?? p;
      showNote(words.current.verdict(verdict), verdict.kind, ...besideEdge(at, b.el.offsetWidth, at.top + 8));
      noteTimer = window.setTimeout(() => hideNote(false), 4000);
    };

    const makeHandle = (id: string): HTMLDivElement => {
      const h = document.createElement("div");
      h.dataset.tileHandle = id.replace(/^wrapped:/, "");
      h.setAttribute("role", "separator");
      h.setAttribute("aria-orientation", "vertical");
      h.tabIndex = 0;
      h.className = TILE_HANDLE_CLASS;
      h.style.setProperty("width", `${TILE_HANDLE_PX}px`);
      const line = document.createElement("div");
      line.className = TILE_HANDLE_LINE_CLASS;
      line.setAttribute("aria-hidden", "true");
      h.appendChild(line);
      h.addEventListener("pointerdown", (e) => onEdgePress(e, id));
      h.addEventListener("keydown", (e) => onEdgeKey(e, id));
      h.addEventListener("dblclick", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toOwn(id);
      });
      h.addEventListener("focus", () => {
        const b = boxOf(id);
        const p = placed.find((x) => x.id === id);
        if (b && p && !resize) describe(h, p.units, limitsOf(b, p));
      });
      return h;
    };

    fresh();
    return () => {
      end(false);
      endResize();
      hideNote();
      live?.remove();
      for (const h of handles.values()) h.remove();
      handles.clear();
      window.clearTimeout(slideEnd);
      cancelAnimationFrame(frame);
      sizes.disconnect();
      width.disconnect();
      changes.disconnect();
      styles.restore();
      for (const b of boxes) delete b.el.dataset.packedCol;
      container.removeEventListener("input", acted);
      container.removeEventListener("keydown", acted);
      container.removeEventListener("pointerdown", onPress);
      container.removeEventListener("pointermove", onHover);
      container.removeEventListener("pointerleave", onLeave);
      container.removeEventListener("dblclick", onDouble);
      window.removeEventListener(TILE_POSITIONS_RESET, onReset);
      window.removeEventListener(TILES_ALL_UP, onAllUp);
      window.removeEventListener(TILE_DIAGRAM_DRAG, onDiagram);
      document.removeEventListener("visibilitychange", shown);
    };
  }, [ref, fitWidest, entity, rightKey, flowUnits]);
}
