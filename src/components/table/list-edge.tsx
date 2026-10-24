"use client";

/**
 * A list's right edge.                                        (Slice #37.84)
 *
 * On the four lists — Persoane fizice, Persoane juridice, Proprietăți and Acte —
 * the toolbar's group at the right („Șterge selectate", its ⓘ, „Adaugă …") ends
 * where the LIST ends, the table frame's right edge, not the window's.
 *
 * The rule, in two halves, so nothing measures itself:
 *
 *   1. The toolbar is `w-fit`, never narrower than the table its columns make
 *      (`columnsRem` plus the frame's two 1 px borders). Its controls may make it
 *      wider; the group, `ml-auto`, ends at whichever is wider. The columns are
 *      known before a row arrives, so the group already stands where the columns
 *      would end while the list loads, is empty, or (on Acte) asks for a type.
 *   2. The table frame and the pagination row are never narrower than the
 *      toolbar, as the toolbar is drawn — so when the controls are wider than
 *      the table, the table's frame and the row under it widen to them, and the
 *      list's top and bottom end together.
 *
 * Every width is capped at the space there is (`min(…, 100%)`): a table wider
 * than the window still scrolls inside its frame, and the toolbar wraps.
 *
 * The open previews do not count: they stand beside the frame in `ListPreviews`
 * and nothing here reads them, so opening one never moves the group.
 *
 * Slice #40.02: the frame scrolls down too (`useListFit`), and while it does its
 * vertical scroll bar stands beside the table, inside the frame — `gutterPx`,
 * measured there. It counts as part of the columns' width, so the group and the
 * pagination row still end at the frame's right edge. Slice 40.14: the frame
 * keeps that room whether its rows overflow or not (`LIST_FRAME`), so `gutterPx`
 * no longer changes when the bar comes or goes — it did, and the frame's width
 * with it, which is what made the bars flicker on a maximise.
 */
import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { columnsRem, type ColumnName } from "@/lib/ui/field-widths";

/** The table frame's border, both sides, in px (`border` on the frame). */
export const FRAME_BORDERS_PX = 2;

/** The toolbar's own class: as wide as its controls, not the page. */
export const LIST_TOOLBAR = "w-fit max-w-full";

/** The width the table's columns make, frame included — and its vertical scroll bar, when it has one — as a CSS length. */
export function columnsEdge(columns: readonly ColumnName[], gutterPx = 0): string {
  return `calc(${columnsRem(columns)}rem + ${FRAME_BORDERS_PX + Math.max(0, gutterPx)}px)`;
}

/** The toolbar: never narrower than the columns, never wider than the page. */
export function toolbarEdgeStyle(columns: readonly ColumnName[], gutterPx = 0): CSSProperties {
  return { minWidth: `min(${columnsEdge(columns, gutterPx)}, 100%)` };
}

/**
 * The frame and the pagination row: never narrower than the toolbar as drawn
 * (`toolbarPx`), or — before it is measured — than the columns.
 */
export function frameEdgeStyle(columns: readonly ColumnName[], toolbarPx: number | null, gutterPx = 0): CSSProperties {
  const edge = toolbarPx && toolbarPx > 0 ? `max(${toolbarPx}px, ${columnsEdge(columns, gutterPx)})` : columnsEdge(columns, gutterPx);
  return { minWidth: `min(${edge}, 100%)` };
}

export type ListEdge = {
  /** Spread on the toolbar's outer box (with `LIST_TOOLBAR` in its class). */
  toolbar: { ref: RefObject<HTMLDivElement | null>; style: CSSProperties; "data-list-toolbar": "" };
  /** Spread on the table frame, the Acte prompt box and the pagination row. */
  frame: { style: CSSProperties; "data-list-edge": "" };
};

/**
 * One list's edge: the toolbar's ref and the styles above, kept up to date. `gutterPx` is the frame's vertical scroll
 * bar (`useListFit`'s `gutter`, #40.02), 0 while it has none.
 */
export function useListEdge(columns: readonly ColumnName[], gutterPx = 0): ListEdge {
  const ref = useRef<HTMLDivElement | null>(null);
  const [toolbarPx, setToolbarPx] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setToolbarPx(el.offsetWidth);
    read();
    // jsdom (jest) has no layout and no ResizeObserver: the first read stands there.
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return {
    toolbar: { ref, style: toolbarEdgeStyle(columns, gutterPx), "data-list-toolbar": "" },
    frame: { style: frameEdgeStyle(columns, toolbarPx, gutterPx), "data-list-edge": "" },
  };
}
