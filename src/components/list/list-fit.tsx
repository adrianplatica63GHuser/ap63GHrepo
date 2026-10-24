"use client";

/**
 * The four principal lists fit the window.                                                          (Slice #40.02)
 *
 * Adrian, 2026-10-20: „this applies to all the principal objects lists / if the browser is not tall enough to
 * accommodate the entire list I want the list itself to have a vertical scroll bar … the visible part of the list To
 * still make room for the last line under the list: "showing n.. and page x of y" / I also want the titles row of the
 * list to always be visible … that means we don't want the browser page to have a vertical scroll bar".
 *
 * One piece for Persoane fizice, Persoane juridice, Proprietăți and Acte (Ask first 1, 9) — the lists `list-edge.tsx`
 * names; every other screen keeps the page's scroll:
 *   - `LIST_FRAME`: the table's frame scrolls both ways (#37.16's was sideways only), so its horizontal scroll bar is at
 *     its bottom, just above the pagination row, and in sight (Ask first 4);
 *   - `LIST_HEAD`: the band of column names (#39.83) sticks to the frame's top — the select-all box and the funnels
 *     with it (Ask first 2);
 *   - `useListFit`: the frame's `max-height`, from its top to the window's bottom less what stands under it — the gap,
 *     the „Se afișează … / Pagina x din y" row, which therefore stays right under the frame, and `main`'s bottom padding
 *     — never under the band and three rows (`listFrameMaxHeight`, Ask first 3). Measured again whenever the window, the
 *     list's column, the table or the page's scroll area changes size (Ask first 8): the chosen columns, the filters
 *     row coming and going (#40.01), the row tiles opening beside the list;
 *   - `useRowTilesFit`: the row tiles' column beside the list (#39.04) down to the window's bottom at most, its tiles
 *     scrolling inside it (Ask first 6).
 *
 * `useFrameHeight` in `value-list-modal.tsx` (#38.56) reads the same three lengths but decides differently — a frame
 * that can take „a screen of its own" below the categories — so it keeps its own rule (`frameMaxHeight`); the
 * measuring stays beside it rather than shared, the two pages being laid out differently above the frame.
 */
import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { listFrameFloor, listFrameMaxHeight, rowTilesMaxHeight } from "@/lib/ui/frame-height";
import { COLUMN_NAMES_BAND } from "@/lib/ui/title-type";
import { LIST_GUTTER_VAR } from "@/components/table/list-edge";

/**
 * The frame around a principal list's table: as wide as the table, scrolling both ways inside the window.
 *
 * Slice 40.14: the vertical scroll bar's room is always kept (`scrollbar-gutter: stable`), whether the rows overflow or
 * not. Adrian, 2026-10-21: „flickering of scroll bars … happens when I maximize the browser". Measured (TC-LAYOUT-07,
 * Windows' classic 15-px bars): from 1280 × 600 to 1920 × 1080 the rows stop overflowing, the bar goes, and the frame
 * was then 15 px wider than its table for a paint — `gutter` (below) still held the bar, and the toolbar's and the
 * frame's min-width (`useListEdge`) with it — then 15 px narrower, while the table had not yet caught up, so a
 * horizontal bar blinked in and out under the rows before the width settled two or three paints later. On Persoane
 * fizice, Persoane juridice and Proprietăți, at every height either side of where the rows just fit; not on Acte, whose
 * toolbar is wider than its columns and so sets the frame's width alone. The loop was the frame's own vertical bar
 * changing the width that is measured to place it. With the room kept, the bar coming or going changes no width at
 * all, `gutter` is the same number from the first measure on, and nothing downstream moves. The price: while the rows
 * fit, the frame keeps an empty strip the bar's width at its right.
 *
 * Slice 40.39 takes that price back. Adrian, 2026-10-23: „The right edge of the list is even longer than that grey
 * band … This right edge of the list should match the end of the grey band". So the frame has a vertical bar only while
 * its rows overflow it — `data-list-bar="on"`, its room kept as 40.14 kept it — and none at all while they fit
 * (`"off"`: no strip). Which of the two holds is decided in `useListFit`'s measure from the rows' height against the
 * frame's height, never from a width, and in that same measure, before the paint, the bar's width goes to every width
 * that depends on it (`LIST_GUTTER_VAR`, list-edge.tsx). The bar's coming changes no row's height — the frame grows by
 * the bar instead of squeezing the table — so it cannot change its own decision: the loop 40.14 removed has nothing to
 * feed on.
 */
export const LIST_FRAME =
  "w-fit max-w-full overflow-x-auto overflow-y-hidden data-[list-bar=on]:overflow-y-auto data-[list-bar=on]:[scrollbar-gutter:stable]";

/**
 * The band of column names, kept at the frame's top as the rows scroll. Slice 40.18: the names in Roboto Condensed
 * 13.5 px, 600, ink — alternative 13's kind 3 (`COLUMN_NAMES_BAND`, src/lib/ui/title-type.ts); they were `text-xs
 * font-medium uppercase tracking-wide`. „Grupuri"'s and „Ștampile"'s lists (`ADMIN_LIST_HEAD`) and a reference list's
 * band (value-list-modal.tsx) read this one.
 */
export const LIST_HEAD = `sticky top-0 z-10 ${COLUMN_NAMES_BAND}`;

/** The page's scroll area (`app-shell.tsx`, by name — #38.56 says why not the nearest scrolling ancestor). */
function pageScrollOf(el: HTMLElement): HTMLElement | null {
  return el.closest<HTMLElement>("[data-page-scroll]");
}

/** The viewport's height, and the scroll area's top in its own content's coordinates. */
function scrollSpace(el: HTMLElement): { viewport: number; base: number } {
  const scroller = pageScrollOf(el);
  return scroller
    ? { viewport: scroller.clientHeight, base: scroller.getBoundingClientRect().top - scroller.scrollTop }
    : { viewport: window.innerHeight, base: -window.scrollY };
}

/** `main`'s bottom padding: what the page holds under the list. */
function pageBottomPad(el: HTMLElement): number {
  const main = el.closest<HTMLElement>("main");
  return main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0;
}

/** Calls `measure` now and whenever one of `targets`, the page's scroll area or the window changes size. */
function useMeasured(measure: () => void, targets: () => (Element | null | undefined)[], deps: readonly unknown[]): void {
  useLayoutEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    // jsdom (jest) has no layout and no ResizeObserver: the first measure stands there.
    if (typeof ResizeObserver === "undefined") return () => window.removeEventListener("resize", measure);
    const observer = new ResizeObserver(measure);
    for (const t of targets()) if (t) observer.observe(t);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export type ListFit = {
  /** Spread on the table's frame, after `edge.frame`. Its `max-height` is set on the element itself, so the edge's
   *  style (its min-width, #37.84) is left as React draws it. */
  frame: { ref: (el: HTMLDivElement | null) => void; "data-list-frame": "" };
  // Slice 40.39: `gutter` (the bar's room, React state, for `useListEdge(columns, fit.gutter)`) is gone — the bar's width
  // is `LIST_GUTTER_VAR`, written on `main` in the measure below, so it lands before the same paint as the bar.
};

/**
 * One list's frame height. Before the first measure (and in jsdom) the frame is as tall as its rows, as before. The
 * frame is held as state, not a ref object, so a frame drawn later — Acte's, once a type is ticked after „Niciun tip" —
 * is measured from the moment it is there.
 */
export function useListFit(): ListFit {
  const ref = useRef<HTMLDivElement | null>(null);
  // Which frame is drawn: a new one runs the measuring again. The element itself is written through `ref`.
  const [drawn, setDrawn] = useState<HTMLDivElement | null>(null);
  const attach = useCallback((el: HTMLDivElement | null) => {
    ref.current = el;
    setDrawn(el);
  }, []);
  const measure = () => {
    const frame = ref.current;
    if (!frame) return;
    const { viewport, base } = scrollSpace(frame);
    const f = frame.getBoundingClientRect();
    const body = frame.closest<HTMLElement>("[data-list-body]");
    // What stands under the frame inside the list's column — the gap and the pagination row — then the page's padding.
    const below = Math.max(0, (body ? body.getBoundingClientRect().bottom : f.bottom) - f.bottom) + pageBottomPad(frame);
    const band = frame.querySelector("thead")?.getBoundingClientRect().height ?? 0;
    const row = frame.querySelector("tbody tr")?.getBoundingClientRect().height ?? 0;
    const max = `${listFrameMaxHeight({ viewport, frameTop: f.top - base, below, floor: listFrameFloor(band, row) })}px`;
    if (frame.style.maxHeight !== max) frame.style.maxHeight = max;
    // Slice 40.39: a vertical bar only while the rows overflow the height just set — read from heights, which the bar
    // does not change (the frame widens by it; the table keeps its width and its rows their height).
    const bar = frame.scrollHeight > frame.clientHeight + 0.5 ? "on" : "off";
    if (frame.dataset.listBar !== bar) frame.dataset.listBar = bar;
    const cs = getComputedStyle(frame);
    const gutter = bar === "on" ? Math.max(0, frame.offsetWidth - frame.clientWidth - (parseFloat(cs.borderLeftWidth) || 0) - (parseFloat(cs.borderRightWidth) || 0)) : 0;
    const host = frame.closest<HTMLElement>("main") ?? frame.parentElement;
    if (host && host.style.getPropertyValue(LIST_GUTTER_VAR) !== `${gutter}px`) host.style.setProperty(LIST_GUTTER_VAR, `${gutter}px`);
  };
  useMeasured(
    measure,
    () => {
      const frame = ref.current;
      if (!frame) return [];
      const scroller = pageScrollOf(frame);
      // The scroll area's own children too: the breadcrumb bar settles after the first measure (#38.56: 9 px).
      return [frame, frame.closest("[data-list-body]"), frame.querySelector("table"), frame.closest("main"), scroller, ...Array.from(scroller?.children ?? [])];
    },
    [drawn],
  );
  return { frame: { ref: attach, "data-list-frame": "" } };
}

/**
 * The row tiles' column beside the list: capped at the window's bottom while it stands beside the list's column
 * (`body`), so the page does not scroll for it; wrapped under the list, not capped — the page scrolls to reach it, as
 * before (Ask first 6).
 */
export function useRowTilesFit(column: RefObject<HTMLElement | null>, body: RefObject<HTMLElement | null>, open: boolean): CSSProperties | undefined {
  const [max, setMax] = useState<number | null>(null);
  const measure = () => {
    const col = column.current;
    const list = body.current;
    if (!col || !list) {
      setMax(null);
      return;
    }
    const c = col.getBoundingClientRect();
    const beside = Math.abs(c.top - list.getBoundingClientRect().top) < 2;
    if (!beside) {
      setMax(null);
      return;
    }
    const { viewport, base } = scrollSpace(col);
    const next = rowTilesMaxHeight({ viewport, columnTop: c.top - base, below: pageBottomPad(col) });
    setMax((prev) => (prev === next ? prev : next));
  };
  useMeasured(
    measure,
    () => {
      const scroller = column.current ? pageScrollOf(column.current) : null;
      return [column.current, body.current, column.current?.parentElement, scroller];
    },
    [open],
  );
  return max === null ? undefined : { maxHeight: max, overflowY: "auto" };
}
