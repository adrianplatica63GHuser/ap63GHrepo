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
 * Adrian's height: the name's row, the gap, the two rows. It never covers the version controls at the header's right:
 * when the room before them is short it is drawn narrower, never taller.
 *
 * WHEN (Ask first 4): it redraws from the packing hook's snapshot (`TILES_PLACED`) — after a layout, a drop, a
 * double-click, „Toate sus", a tick — and when the bar or the header changes size.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { tilesDiagram, type Diagram, type DiagramTile } from "@/lib/ui/tiles-diagram";
import { groupColours } from "@/lib/ui/tile-surface";
import type { TileGroup } from "@/lib/ui/tiles";
import { TILES_PLACED, lastPlaced, type PlacedSnapshot } from "./tiles-placed";

/** The gap kept between the diagram and the version controls, in px. */
const CLEAR_PX = 12;

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
  const h = R(header);
  const rows = [...bar.querySelectorAll<HTMLElement>("[data-tile-bar-row]")];
  const rowRight = rows.reduce((m, r) => (r.lastElementChild ? Math.max(m, R(r.lastElementChild).right) : m), R(bar).left);
  const labels = [...bar.querySelectorAll("label")].map((l) => R(l).width).filter((x) => x > 0);
  const average = labels.length ? labels.reduce((s, x) => s + x, 0) / labels.length : 80;
  const slot = header.querySelector<HTMLElement>("[data-version-slot]");
  const named = [...header.children].filter((c) => c !== slot).reduce((m, c) => Math.max(m, R(c).right), h.left);
  const controls = slot?.firstElementChild ? R(slot.firstElementChild).left : h.right;
  const left = Math.max(rowRight, named) + average;
  const right = Math.min(w.right, controls - CLEAR_PX);
  return { left: left - w.left, top: h.top - w.top, width: Math.max(0, right - left), height: R(bar).bottom - h.top };
}

export function TilesDiagram({ entity, groupOf }: { entity: string; groupOf: (id: string) => TileGroup | null }) {
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

  useLayoutEffect(() => {
    const wrap = ref.current?.parentElement;
    if (!wrap) return;
    const measure = () => {
      const next = frameOf(wrap);
      setFrame((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    measure();
    // jsdom (jest) has no layout and no ResizeObserver: the first measure stands there.
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    const header = headerOf(wrap);
    if (header) observer.observe(header);
    for (const row of wrap.querySelectorAll("[data-tile-bar-row]")) observer.observe(row);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  });

  let diagram: Diagram = { rects: [], width: 0, height: 0 };
  if (snapshot && frame && frame.width > 0 && frame.height > 0) {
    const tiles: DiagramTile[] = [];
    for (const b of snapshot.boxes) {
      const group = groupOf(b.id);
      if (group) tiles.push({ id: b.id, group, col: b.col, units: b.units, top: b.top, height: b.height });
    }
    diagram = tilesDiagram(tiles, { tileGap: snapshot.gap, height: frame.height, maxWidth: frame.width, columns: snapshot.columns });
  }

  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-tiles-diagram=""
      className="pointer-events-none absolute"
      style={frame ? { left: frame.left, top: frame.top, width: diagram.width, height: frame.height } : { display: "none" }}
    >
      {diagram.rects.map((r) => (
        <div
          key={r.id}
          data-diagram-rect={r.id}
          data-group={r.group}
          className={`absolute rounded-[2px] border ${groupColours(r.group)}`}
          style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
        />
      ))}
    </div>
  );
}
