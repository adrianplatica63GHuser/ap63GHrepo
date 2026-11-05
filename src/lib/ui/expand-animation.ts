/**
 * What a tile's growing into a full-screen panel shares, whatever is inside it.                       (Slice 41.87)
 *
 * „Hartă extinsă" (41.75 / 41.77) was the first: the panel grows from the tile to the expanded rectangle (inset 16 px)
 * while what it shows travels to the middle at the tile's size, then the size changes; the way back is the same in
 * reverse, after a return when the view was moved. 41.87 gives the whole inheritance tree the same opening and 41.88
 * the big page, so what all three share lives here rather than in a third copy (41.87's Ask first 5):
 *   - the rectangle between two boxes and the expanded panel's rectangle;
 *   - the easing and the backdrop, which fades with the panel;
 *   - the tolerance a return is measured against;
 *   - `playTimeline`, the clock: a frame each time the browser gives one, and a timer at each part's end + 100 ms,
 *     because the desktop app's browser pane gives none at all (58fb1aa8).
 * What moves inside the panel — a map's camera, the tree's scale and pan, the page's — is each one's own module
 * (`expand-map-animation.ts`, `expand-tree-animation.ts`, `expand-page-animation.ts`). The tree's and the page's are
 * the same kind of thing — a scale and a pan in a box (`View`) — so their return shares `returnViewAt` below.
 */
import { MIN_RISE, easeInOut as easeSearch, parabolaZoom } from "@/lib/geo/map-search";

export type Rect = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };

/** The expanded panel's margin to the window: the panel's `inset-4`. */
export const EXPAND_INSET_PX = 16;
/** How far a view may be from the opening's end, as a share of the panel's width or height, before it returns. */
export const COLLAPSE_RETURN_TOLERANCE = 0.02;
/** Each part also lands on a timer this long after its end (58fb1aa8). */
export const PHASE_TIMER_SLACK_MS = 100;

/** Ease-in-out (cubic): slow at both ends. */
export function easeInOut(s: number): number {
  const x = Math.min(1, Math.max(0, s));
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

export const lerp = (a: number, b: number, s: number): number => a + (b - a) * s;
export const lerpPoint = (a: Point, b: Point, s: number): Point => ({ x: lerp(a.x, b.x, s), y: lerp(a.y, b.y, s) });
export const lerpRect = (a: Rect, b: Rect, s: number): Rect => ({ x: lerp(a.x, b.x, s), y: lerp(a.y, b.y, s), w: lerp(a.w, b.w, s), h: lerp(a.h, b.h, s) });
export const centreOf = (r: Rect): Point => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** The expanded panel in a window `viewport`: inset 16 px on every side. */
export function expandedRect(viewport: { w: number; h: number }): Rect {
  return {
    x: EXPAND_INSET_PX,
    y: EXPAND_INSET_PX,
    w: Math.max(1, viewport.w - 2 * EXPAND_INSET_PX),
    h: Math.max(1, viewport.h - 2 * EXPAND_INSET_PX),
  };
}

/** Where the panel starts: its body exactly on the tile's, its header just above it. */
export function panelOverTile(tileBody: Rect, headerPx: number): Rect {
  return { x: tileBody.x, y: tileBody.y - headerPx, w: tileBody.w, h: tileBody.h + headerPx };
}

/** The panel's body: the panel less its header. */
export function bodyOf(panel: Rect, headerPx: number): Rect {
  return { x: panel.x, y: panel.y + headerPx, w: panel.w, h: Math.max(1, panel.h - headerPx) };
}

/** Part 1's progress at `t`, eased: 0 at the start, 1 once the panel has arrived. The backdrop's opacity is the same. */
export function growProgress(t: number, growMs: number): number {
  return growMs <= 0 || t >= growMs ? 1 : easeInOut(Math.max(0, t) / growMs);
}

/** Part 2's progress at `t` (part 1 lasting `growMs`), eased. */
export function partTwoProgress(t: number, growMs: number, zoomMs: number): number {
  return zoomMs <= 0 || t >= growMs + zoomMs ? 1 : easeInOut(Math.max(0, t - growMs) / zoomMs);
}

/**
 * The way back's clock read as the opening's, running backwards — after a return of `returnMs`, part 2 (`zoomMs`)
 * then part 1 (`growMs`). Null while the return plays.
 */
export function openingClockBack(t: number, returnMs: number, growMs: number, zoomMs: number): number | null {
  const u = t - returnMs;
  if (u < 0) return null;
  if (u < zoomMs) return growMs + zoomMs - u;
  return Math.max(0, growMs - (u - zoomMs));
}

/** Whether a rectangle measured on screen can be flown into: it has a size and part of it is in the window. */
export function onScreen(r: DOMRect | null | undefined, viewport: { w: number; h: number }): r is DOMRect {
  return !!r && r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < viewport.h && r.left < viewport.w;
}

export type Timeline = {
  /** Stops it where it is: no further frame, no `onEnd`. */
  cancel: () => void;
};

/**
 * Plays `apply(t)` from 0 to `total` ms, a frame each time the browser gives one; at each of `marks` (a part's end)
 * and at `total`, a timer lands it too, `PHASE_TIMER_SLACK_MS` late at most, for a page that gets no frames. At the
 * end `apply(total)` and then `onEnd()`, once. A `total` of 0 ends at once.
 */
export function playTimeline({ total, marks = [], apply, onEnd }: { total: number; marks?: readonly number[]; apply: (t: number) => void; onEnd: () => void }): Timeline {
  let ended = false;
  let frame = 0;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const stop = () => {
    ended = true;
    if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
    for (const id of timers) clearTimeout(id);
  };
  const finish = () => {
    if (ended) return;
    stop();
    apply(total);
    onEnd();
  };
  apply(0);
  if (total <= 0) {
    finish();
    return { cancel: stop };
  }
  const start = performance.now();
  const tick = () => {
    if (ended) return;
    const t = performance.now() - start;
    if (t >= total) return finish();
    apply(t);
    frame = requestAnimationFrame(tick);
  };
  if (typeof requestAnimationFrame === "function") frame = requestAnimationFrame(tick);
  for (const at of marks) if (at > 0 && at < total) timers.push(setTimeout(() => !ended && apply(at), at + PHASE_TIMER_SLACK_MS));
  timers.push(setTimeout(finish, total + PHASE_TIMER_SLACK_MS));
  return { cancel: stop };
}

/** Places an element on a rectangle, in px. */
export function placeRect(el: HTMLElement | null, r: Rect): void {
  if (!el) return;
  el.style.left = `${r.x}px`;
  el.style.top = `${r.y}px`;
  el.style.width = `${r.w}px`;
  el.style.height = `${r.h}px`;
}

/** Under prefers-reduced-motion every part is 0: the panel opens and closes at once. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
}

// ---------------------------------------------------------------------------
// A scale and a pan in a box — the tree's drawing (41.87), the big page (41.88)
// ---------------------------------------------------------------------------

/** A point (x, y) of the content stands at (tx + x · scale, ty + y · scale) from the box's top-left. */
export type View = { scale: number; tx: number; ty: number };

/** The view that holds `at` in the middle of `box` at `scale`. */
export function centredOn(at: Point, scale: number, box: { w: number; h: number }): View {
  return { scale, tx: box.w / 2 - at.x * scale, ty: box.h / 2 - at.y * scale };
}

/** The content point at the middle of `box` under `v`. */
export function middleOf(v: View, box: { w: number; h: number }): Point {
  return { x: (box.w / 2 - v.tx) / v.scale, y: (box.h / 2 - v.ty) / v.scale };
}

/**
 * R for a return from `from` to `to`, in levels of log2(scale) — 41.76's rule, as the map's `flightRise`: climb until
 * both middles show in 80 % of the box, at least `MIN_RISE`.
 */
export function viewFlightRise(from: View, to: View, box: { w: number; h: number }): number {
  const a = middleOf(from, box);
  const b = middleOf(to, box);
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  const seeBoth = Math.min(dx > 0 ? (0.8 * box.w) / dx : Infinity, dy > 0 ? (0.8 * box.h) / dy : Infinity);
  const low = Math.min(Math.log2(from.scale), Math.log2(to.scale));
  const peak = Number.isFinite(seeBoth) ? Math.min(low, Math.log2(seeBoth)) : low;
  return Math.max(MIN_RISE, low - peak);
}

/**
 * The return, `t` ms into `ms`: the middle glides from `from`'s to `to`'s while the scale rides 41.76's parabola
 * (`parabolaZoom`, a = `arc`), as a map's camera does between two searches.
 */
export function returnViewAt(t: number, from: View, to: View, box: { w: number; h: number }, ms: number, rise: number, arc: number): View {
  if (ms <= 0 || t >= ms) return to;
  const x = easeSearch(Math.max(0, t) / ms);
  const a = middleOf(from, box);
  const b = middleOf(to, box);
  const scale = 2 ** parabolaZoom(x, Math.log2(from.scale), Math.log2(to.scale), rise, arc);
  return centredOn(lerpPoint(a, b, x), scale, box);
}
