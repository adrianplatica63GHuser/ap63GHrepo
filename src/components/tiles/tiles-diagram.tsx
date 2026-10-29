"use client";

/**
 * TilesDiagram — a small picture of the tiles on screen, right of the two-row tile bar.               (Slice 40.42)
 *
 * One plain rectangle per tile shown — the right-hand tiles and the open previews included, the banners and the action
 * bar not — in its tile's group colours (light and dark), stacked as the tiles stand (`tilesDiagram`,
 * src/lib/ui/tiles-diagram.ts). No caption, no tooltip, no click: `aria-hidden`, the checkboxes already say which tiles
 * are shown (40.42's Ask first 3).
 *
 * WHERE (Ask first 1): its left edge one average checkbox-label width right of the bar's longer row (and of the record's
 * name, should that reach further); its top level with the record header's top, its bottom with the bar's bottom —
 * Adrian's height: the name's row, the gap, the two rows. (Until 40.57, below.) It never covered the version controls:
 * when the room before them is short it is drawn narrower, never taller.
 *
 * WHEN (Ask first 4): it redraws from the packing hook's snapshot (`TILES_PLACED`) — after a layout, a drop, a
 * double-click, „Toate sus", a tick — and when the bar or the header changes size.
 *
 * Slice 40.53 (Adrian, 2026-10-24: „The rectangles inside this tiles map can be moved in the same way that the tiles can
 * be moved … while moving it, the rectangles that come under this moving rectangle will also be sliding down"): a
 * rectangle pressed and moved past the drag threshold drags its tile — the packing hook's own drag, told through
 * `dragFromDiagram` (Ask first 1), so the same free-space rule, make-room delay, drop and store run. The rectangle
 * follows the pointer; the others redraw from the hook's live snapshot as their tiles make room; red where the tile
 * cannot drop (Ask first 2). A click does nothing; Esc, or a release outside the diagram, puts everything back. Only
 * the rectangles take the pointer, „grab" over them; the diagram stays `aria-hidden` — no keyboard path, as the tiles
 * have none (Ask first 3). Every rectangle's tile can be dragged, previews too (Ask first 4).
 *
 * Slice 40.57 (Ask first 2): the diagram moved into the „Panouri" panel with the bar, right of the checkboxes as before,
 * at its old size — as tall as the record's name row, the 16 px under it and the bar's two rows. Its left edge as
 * before, one average checkbox-label width right of the bar's longer row; its right the panel's. The panel holds it
 * (`onHeight`). With the panel closed there is nothing to measure, and it waits (`data-room="pending"`).
 */
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { moveOnScreen, tilesDiagram, type Diagram, type DiagramRect, type DiagramTile } from "@/lib/ui/tiles-diagram";
import { groupColours } from "@/lib/ui/tile-surface";
import type { TileGroup } from "@/lib/ui/tiles";
import { TILES_PLACED, dragFromDiagram, lastPlaced, type PlacedSnapshot } from "./tiles-placed";
import { DRAG_THRESHOLD_PX } from "./use-tile-packing";

/** Slice 40.53: a rectangle being dragged — where it stood at the press, and how far the pointer has moved it. */
type Held = { id: string; rect: DiagramRect; x0: number; y0: number; dx: number; dy: number; active: boolean; toScreen: (dx: number, dy: number) => { dx: number; dy: number } };

/** The gap between the record's header and the bar that the diagram's height counts, as before 40.57 (`gap-4`). */
const HEADER_GAP_PX = 16;

/**
 * The narrowest room it is drawn in, in px. Less — a bar whose first row fills the panel — and it is not drawn at all
 * (`data-room="none"`): narrower, never taller.
 */
export const DIAGRAM_MIN_ROOM_PX = 48;

type Frame = { left: number; top: number; width: number; height: number };

/** Where the diagram may stand, relative to `wrap` (the bar's positioned box) — or `null` while there is no header. */
/** The record screen's header: the nearest `[data-record-header]` among the bar's ancestors' children. */
function headerOf(wrap: HTMLElement): HTMLElement | null {
  for (let a = wrap.parentElement; a; a = a.parentElement) {
    const h = a.querySelector<HTMLElement>(":scope > [data-record-header]");
    if (h) return h;
  }
  return null;
}

function frameOf(wrap: HTMLElement): Frame | null {
  const header = headerOf(wrap);
  const bar = wrap.querySelector<HTMLElement>("[data-tile-selector]");
  if (!header || !bar) return null;
  const R = (e: Element) => e.getBoundingClientRect();
  const w = R(wrap);
  const b = R(bar);
  // The panel closed: nothing is laid out.
  if (b.width === 0 || w.width === 0) return null;
  // The bar's longer row ends where its furthest piece (or the buttons) ends.
  const rowRight = [...bar.querySelectorAll<HTMLElement>("[data-bar-row]")].reduce((m, e) => Math.max(m, R(e).right), b.left);
  const labels = [...bar.querySelectorAll("label")].map((l) => R(l).width).filter((x) => x > 0);
  const average = labels.length ? labels.reduce((s, x) => s + x, 0) / labels.length : 80;
  const left = rowRight + average;
  return { left: left - w.left, top: 0, width: Math.max(0, w.right - left), height: R(header).height + HEADER_GAP_PX + b.height };
}

/** Two frames within a pixel of each other on every side are the same frame (40.98). */
function sameFrame(a: Frame | null, b: Frame | null): boolean {
  if (a === null || b === null) return a === b;
  return Math.abs(a.left - b.left) < 1 && Math.abs(a.top - b.top) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1;
}

export function TilesDiagram({
  entity,
  groupOf,
  onHeight,
}: {
  entity: string;
  groupOf: (id: string) => TileGroup | null;
  /** Slice 40.57: told the height it is drawn at (0 when it is not), so the panel can hold it. */
  onHeight?: (px: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [heard, setHeard] = useState<PlacedSnapshot | undefined>(undefined);
  // The last one heard for this kind of record, or — none heard yet, or the kind changed — the last one published.
  const snapshot = heard?.entity === entity ? heard : lastPlaced(entity);
  const [frame, setFrame] = useState<Frame | null>(null);

  useEffect(() => {
    const on = (e: Event) => {
      const s = (e as CustomEvent<PlacedSnapshot>).detail;
      if (s.entity === entity) setHeard(s);
    };
    window.addEventListener(TILES_PLACED, on);
    return () => window.removeEventListener(TILES_PLACED, on);
  }, [entity]);

  // 40.98: a frame that settles. TC-DOC-01 met „Maximum update depth exceeded" here — this effect runs after every
  // render, and a frame that differed by a fraction of a pixel each time (the labels' average width, as the panel's
  // rows reflowed on the narrower unit) set state on every pass. So a change under a pixel is no change, and more
  // than a few changes in a burst wait for the next resize rather than loop.
  // The frame last set, read without a render: a measure that would not change it — or one more in a burst — sets
  // nothing at all, so no render follows it.
  const burst = useRef({ at: 0, n: 0 });
  const shown = useRef<Frame | null>(null);
  useLayoutEffect(() => {
    const wrap = ref.current?.parentElement;
    if (!wrap) return;
    const measure = () => {
      const next = frameOf(wrap);
      if (sameFrame(shown.current, next)) return;
      const now = typeof performance === "undefined" ? Date.now() : performance.now();
      if (now - burst.current.at > 250) burst.current = { at: now, n: 0 };
      burst.current.n += 1;
      if (burst.current.n > 8) return;
      shown.current = next;
      setFrame(next);
    };
    measure();
    // jsdom (jest) has no layout and no ResizeObserver: the first measure stands there.
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    const header = headerOf(wrap);
    if (header) observer.observe(header);
    const bar = wrap.querySelector("[data-tile-selector]");
    if (bar) observer.observe(bar);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  });

  let diagram: Diagram = { rects: [], width: 0, height: 0, unit: 0, across: 0, scale: 0 };
  const room = !!frame && frame.width >= DIAGRAM_MIN_ROOM_PX && frame.height > 0;
  const drawnHeight = frame && room ? Math.ceil(frame.height) : 0;
  useLayoutEffect(() => {
    onHeight?.(drawnHeight);
  }, [drawnHeight, onHeight]);
  if (snapshot && frame && room) {
    const tiles: DiagramTile[] = [];
    for (const b of snapshot.boxes) {
      const group = groupOf(b.id);
      if (group) tiles.push({ id: b.id, group, col: b.col, units: b.units, top: b.top, height: b.height });
    }
    diagram = tilesDiagram(tiles, { tileGap: snapshot.gap, height: frame.height, maxWidth: frame.width, columns: snapshot.columns });
  }
  const [held, setHeld] = useState<Held | null>(null);
  const heldRef = useRef<Held | null>(null);

  // Slice 40.53: the drag — window listeners while a rectangle is held; the hook does the rest.
  useEffect(() => {
    if (!held) return;
    const update = (next: Held | null) => {
      heldRef.current = next;
      setHeld(next);
    };
    const onMove = (e: PointerEvent) => {
      const h = heldRef.current;
      if (!h) return;
      const dx = e.clientX - h.x0;
      const dy = e.clientY - h.y0;
      if (!h.active && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      e.preventDefault();
      const on = h.toScreen(dx, dy);
      dragFromDiagram({ entity, id: h.id, phase: h.active ? "move" : "start", dx: on.dx, dy: on.dy });
      update({ ...h, dx, dy, active: true });
    };
    const onUp = (e: PointerEvent) => {
      const h = heldRef.current;
      update(null);
      if (!h?.active) return;
      const box = ref.current?.getBoundingClientRect();
      const inside = !!box && e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top - 8 && e.clientY <= box.bottom + 8;
      dragFromDiagram({ entity, id: h.id, phase: inside ? "drop" : "cancel", dx: 0, dy: 0 });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const h = heldRef.current;
      update(null);
      if (!h?.active) return;
      // 40.57: this Esc is the drag's — the „Panouri" panel around the diagram stays open.
      e.stopPropagation();
      dragFromDiagram({ entity, id: h.id, phase: "cancel", dx: 0, dy: 0 });
    };
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [held !== null, entity]); // eslint-disable-line react-hooks/exhaustive-deps

  const press = (r: DiagramRect) => (e: ReactPointerEvent) => {
    if (e.button !== 0 || !e.isPrimary || !snapshot) return;
    e.preventDefault();
    // The diagram and the tiles as they stood at the press: the rectangles that slide meanwhile do not change the map.
    const shape = { rects: diagram.rects, unit: diagram.unit, across: diagram.across, scale: diagram.scale };
    const tiles = snapshot.boxes;
    const screen = { unit: snapshot.unit, gap: snapshot.gap };
    const next: Held = { id: r.id, rect: r, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, active: false, toScreen: (dx, dy) => moveOnScreen({ x: r.x + dx, y: r.y + dy }, r, shape, tiles, screen) };
    heldRef.current = next;
    setHeld(next);
  };
  const dragged = held?.active ? held : null;
  const refused = dragged && snapshot?.drag?.id === dragged.id && snapshot.drag.free === false;

  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-tiles-diagram=""
      data-room={!frame ? "pending" : room ? "yes" : "none"}
      className="pointer-events-none absolute"
      style={frame && room ? { left: frame.left, top: frame.top, width: diagram.width, height: frame.height } : { display: "none" }}
    >
      {diagram.rects.map((r) => {
        // 40.53: the rectangle dragged follows the pointer from where it stood at the press, above the rest.
        const at = dragged?.id === r.id ? { ...dragged.rect, x: dragged.rect.x + dragged.dx, y: dragged.rect.y + dragged.dy } : r;
        return (
          <div
            key={r.id}
            data-diagram-rect={r.id}
            data-group={r.group}
            data-diagram-dragged={dragged?.id === r.id ? (refused ? "refused" : "free") : undefined}
            className={`pointer-events-auto absolute rounded-[2px] border ${groupColours(r.group)} ${dragged?.id === r.id ? "z-10 cursor-grabbing shadow" : "cursor-grab"}${refused && dragged?.id === r.id ? " !border-red-600 ring-1 ring-red-600" : ""}`}
            style={{ left: at.x, top: at.y, width: at.w, height: at.h, touchAction: "none" }}
            onPointerDown={press(r)}
          />
        );
      })}
    </div>
  );
}
