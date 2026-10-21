"use client";

/**
 * A principal list's columns, moved by their name in the band — the store and the drag.            (Slice 40.25)
 *
 * Adrian, 2026-10-21: „we should be able to grab a column by its title area (the Gray area) and move it left or right
 * to reposition it - when we drop it". The order itself is `src/lib/ui/column-order.ts`; this is the browser half:
 *
 * - `useColumnOrder` keeps the order per list in this browser (`LIST_COLUMN_ORDER`), read after mount as the chooser's
 *   ticks are, and gives the four lists `keys` — their named columns in order — and `move`, `forget`, `reset`.
 * - `useColumnDrag` makes each name cell a handle (Ask first 2): a press that moves about 5 px starts a drag; the cell
 *   follows the pointer, half-transparent; a 2-px navy line shows where it will land; near the frame's edge the list
 *   scrolls sideways; Escape cancels; a drop away from the band changes nothing. A press on the funnel (a button) or on
 *   40.12's width handle (in the caption, not the cell) never starts one. From the keyboard a name cell is focusable,
 *   and Alt+← / Alt+→ move its column one place, the new place said aloud (Ask first 5).
 */
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { applyOrder, dropIndex, forgetColumn, gapAt, moveBy, moveTo, readOrder } from "@/lib/ui/column-order";
import { COLUMN_NAMES_BAND } from "@/lib/ui/title-type";

/** The named columns in their order, and what changes it. */
export function useColumnOrder(storageKey: string, present: readonly string[]) {
  const [stored, setStored] = useState<string[] | null>(null);
  useEffect(() => {
    const id = setTimeout(() => {
      let raw: string | null = null;
      try { raw = localStorage.getItem(storageKey); } catch { /* private window: the default order */ }
      setStored(readOrder(raw));
    }, 0);
    return () => clearTimeout(id);
  }, [storageKey]);
  const save = useCallback(
    (next: string[] | null) => {
      setStored(next);
      try {
        if (next) localStorage.setItem(storageKey, JSON.stringify(next));
        else localStorage.removeItem(storageKey);
      } catch { /* private window: the order lasts the visit */ }
    },
    [storageKey],
  );
  const keys = applyOrder(present, stored);
  return {
    keys,
    /** Whether an order is stored — „Ordinea implicită" has something to undo. */
    custom: stored !== null,
    move: (key: string, to: number) => save(moveTo(keys, key, to)),
    /** A column unticked in „Câmpuri afișate" leaves the stored order, so it comes back at the end. */
    forget: (key: string) => { if (stored) save(forgetColumn(stored, key)); },
    reset: () => save(null),
  };
}

/** What a name cell takes to be a handle (spread on its `<th>` by `ListHeadCell`). */
export type HeadDragProps = {
  tabIndex: number;
  "data-col-drag": string;
  "aria-describedby": string;
  onPointerDown: (e: PointerEvent<HTMLTableCellElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTableCellElement>) => void;
};

type Ghost = { label: string; x: number; y: number; w: number; h: number; line: { x: number; top: number; height: number } | null };

/** Within this many px above or below the band a drop still counts; further, it changes nothing. */
const DROP_SLACK_PX = 24;
/** A press becomes a drag past this many px. */
const START_PX = 5;
/** Near the frame's edge, by this much, the list scrolls sideways — this many px a frame. */
const EDGE_PX = 40;
const SCROLL_STEP_PX = 12;

export function useColumnDrag({
  keys,
  names,
  onMove,
}: {
  keys: readonly string[];
  /** Each column's short name, for the ghost and for what is said aloud. */
  names: Readonly<Record<string, string>>;
  onMove: (key: string, to: number) => void;
}): { headProps: (key: string) => HeadDragProps; layer: ReactNode } {
  const t = useTranslations("shared.columnOrder");
  const hintId = useId();
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [said, setSaid] = useState("");
  const focusAfter = useRef<string | null>(null);

  // After a keyboard move the cell's node has moved; give it its focus back.
  useEffect(() => {
    const k = focusAfter.current;
    if (!k) return;
    focusAfter.current = null;
    document.querySelector<HTMLElement>(`th[data-col-drag="${CSS.escape(k)}"]`)?.focus();
  });

  const announce = (key: string, order: readonly string[]) => {
    const n = order.indexOf(key) + 1;
    const name = names[key] ?? key;
    setSaid(n === 1 ? t("announceFirst", { name, total: order.length }) : t("announce", { name, n, total: order.length }));
  };

  function begin(e: PointerEvent<HTMLTableCellElement>, key: string) {
    if (e.button !== 0) return;
    // The funnel opens its filter, a link opens its record: neither is a handle.
    if ((e.target as Element).closest("button, a, input, select, textarea")) return;
    const th = e.currentTarget;
    const band = th.closest("thead");
    const frame = th.closest("table")?.parentElement;
    if (!band || !frame) return;
    const from = keys.indexOf(key);
    const sx = e.clientX;
    const sy = e.clientY;
    let dragging = false;
    let gap = from;
    let lastX = sx;
    let raf = 0;

    const inBand = (y: number) => {
      const b = band.getBoundingClientRect();
      return y >= b.top - DROP_SLACK_PX && y <= b.bottom + DROP_SLACK_PX;
    };
    const place = (x: number, y: number) => {
      const rects = [...band.querySelectorAll<HTMLElement>("th[data-col-drag]")].map((c) => c.getBoundingClientRect());
      if (rects.length === 0) return;
      gap = gapAt(rects.map((r) => (r.left + r.right) / 2), x);
      const b = band.getBoundingClientRect();
      const f = frame.getBoundingClientRect();
      const at = gap === 0 ? rects[0].left : rects[gap - 1].right;
      setGhost({
        label: names[key] ?? key,
        x,
        y,
        w: th.offsetWidth,
        h: b.height,
        line: inBand(y) ? { x: Math.max(f.left, Math.min(f.right, at)) - 1, top: b.top, height: b.height } : null,
      });
    };
    const tick = () => {
      if (!dragging) return;
      const f = frame.getBoundingClientRect();
      if (lastX < f.left + EDGE_PX) frame.scrollLeft -= SCROLL_STEP_PX;
      else if (lastX > f.right - EDGE_PX) frame.scrollLeft += SCROLL_STEP_PX;
      raf = requestAnimationFrame(tick);
    };
    const move = (ev: globalThis.PointerEvent) => {
      lastX = ev.clientX;
      if (!dragging) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < START_PX) return;
        dragging = true;
        document.body.style.userSelect = "none";
        raf = requestAnimationFrame(tick);
      }
      place(ev.clientX, ev.clientY);
    };
    const end = (drop: globalThis.PointerEvent | null) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("keydown", esc, true);
      cancelAnimationFrame(raf);
      document.body.style.userSelect = "";
      if (dragging && drop && inBand(drop.clientY)) {
        place(drop.clientX, drop.clientY);
        const to = dropIndex(gap, from);
        if (to !== from) {
          onMove(key, to);
          announce(key, moveTo(keys, key, to));
        }
      }
      setGhost(null);
    };
    const up = (ev: globalThis.PointerEvent) => end(ev);
    const esc = (ev: globalThis.KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      ev.preventDefault();
      ev.stopPropagation();
      end(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("keydown", esc, true);
  }

  function key(e: KeyboardEvent<HTMLTableCellElement>, k: string) {
    if (!e.altKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    e.preventDefault();
    const next = moveBy(keys, k, e.key === "ArrowLeft" ? -1 : 1);
    if (next.indexOf(k) === keys.indexOf(k)) return;
    focusAfter.current = k;
    onMove(k, next.indexOf(k));
    announce(k, next);
  }

  const layer = (
    <>
      <span id={hintId} className="sr-only">{t("hint")}</span>
      <span className="sr-only" aria-live="polite" data-column-order-said="">{said}</span>
      {ghost &&
        createPortal(
          <>
            <div
              className={`${COLUMN_NAMES_BAND} pointer-events-none fixed z-50 flex items-center justify-center rounded-sm px-4 opacity-50 shadow-md`}
              style={{ left: ghost.x - ghost.w / 2, top: ghost.y - ghost.h / 2, width: ghost.w, height: ghost.h }}
              data-column-ghost=""
            >
              {ghost.label}
            </div>
            {ghost.line && (
              <div
                className="pointer-events-none fixed z-50 w-0.5 bg-navy dark:bg-[#BFDBFE]"
                style={{ left: ghost.line.x, top: ghost.line.top, height: ghost.line.height }}
                data-column-drop-line=""
              />
            )}
          </>,
          document.body,
        )}
    </>
  );

  return {
    headProps: (k: string) => ({
      tabIndex: 0,
      "data-col-drag": k,
      "aria-describedby": hintId,
      onPointerDown: (e) => begin(e, k),
      onKeyDown: (e) => key(e, k),
    }),
    layer,
  };
}
