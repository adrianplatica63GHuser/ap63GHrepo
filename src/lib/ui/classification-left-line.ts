/**
 * „Clasificări": where Importanță's and Relevanță's selects stand in their
 * cells, and the one left line Proveniență shares with Importanță's select.
 *                                                                (Slice #38.01)
 *
 * #37.81 centred each select in its cell, its „Marchează ca verificat" button
 * hanging to its right, so select and button together read right-heavy.
 * Adrian: „another 25% from the distance to the edge". So, per cell, with d the
 * gap #37.81 left between the select's left edge and the cell's, the select row
 * moves left by `SELECT_ROW_SHIFT` × d — the select now stands 0.75 × d from
 * the cell's left edge, its button still 4 px to its right. Both cells the same
 * way, and the same on an older version, which has no review buttons.
 *
 * The row is the cell's full width, a grid of three tracks: an empty one, the
 * select, and one holding the button. The free width (cell − select) is shared
 * between the two outer tracks in the ratio 0.75 : 1.25, so the empty one is
 * exactly 0.75 × (cell − select) / 2 = 0.75 × d. The button's track must hold
 * the button and its 4 px (38 px); measured in the browser on 2026-10-05
 * (runner 20261005T185820Z-28557), at 1366 and 1920 px alike, the cells are
 * 208.5 px and the selects 105 px (Importanță) and 132 px (Relevanță), so the
 * narrower track is 1.25 × 76.5 / 2 = 47.8 px. Re-measure if an option's
 * wording changes: a native select is as wide as its widest option.
 *
 * Proveniență, a full-width item under the pair, starts on Importanță's select's
 * left edge after the shift: its title, select and „Istoric" line. That edge
 * depends on the select's width, which only the browser knows, so it is
 * measured — `useSharedLeftLine` writes it as `--classification-left` on the
 * element holding both, and Proveniență is inset by it. Measured, it is
 * 0.75 × 51.75 = 38.8 px.
 */
import { useCallback, type CSSProperties, type RefCallback } from "react";

/** The share of d (the select's centred gap to its cell's left edge) the select row moves left by. */
export const SELECT_ROW_SHIFT = 0.25;

/** The centred cells' select row: the empty track, the select, the button's track. */
export const SHIFTED_SELECT_ROW: CSSProperties = {
  gridTemplateColumns: `${1 - SELECT_ROW_SHIFT}fr auto ${1 + SELECT_ROW_SHIFT}fr`,
  columnGap: 0,
};

/** The select's left edge in its cell after the shift: (1 − shift) × d, d = (cell − select) / 2. */
export function shiftedSelectLeft(cellWidth: number, selectWidth: number): number {
  return ((1 - SELECT_ROW_SHIFT) * (cellWidth - selectWidth)) / 2;
}

/** The custom property that carries the shared left line, in px from the pair's left edge. */
export const SHARED_LEFT_VAR = "--classification-left";

/** Proveniență's inset: the shared left line, or nothing before it is measured. */
export const SHARED_LEFT_INSET: CSSProperties = { paddingLeft: `var(${SHARED_LEFT_VAR}, 0px)` };

/** Importanță's select: the first cell's, in the pair row. */
const FIRST_SELECT = "[data-classification-pair] > section select";

/**
 * A ref for the element that holds the pair row and Proveniență. It measures
 * Importanță's select's left edge against the pair row's and writes it as
 * `--classification-left` on that element — straight onto the DOM, so a resize
 * re-measures without a render. Re-read whenever the element or the select
 * changes size (a narrower window, a version with no review buttons, a font
 * that arrives late). jsdom has no layout and no ResizeObserver: there the
 * first read stands, 0 px.
 */
export function useSharedLeftLine(): RefCallback<HTMLElement> {
  return useCallback((el: HTMLElement | null) => {
    if (!el) return;
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => read());
    let watched: Element | null = null;
    function read() {
      const select = el!.querySelector(FIRST_SELECT);
      const pair = select?.closest("[data-classification-pair]");
      if (!select || !pair) {
        el!.style.removeProperty(SHARED_LEFT_VAR);
        return;
      }
      const x = select.getBoundingClientRect().left - pair.getBoundingClientRect().left;
      el!.style.setProperty(SHARED_LEFT_VAR, `${Math.max(0, x)}px`);
      if (observer && select !== watched) {
        if (watched) observer.unobserve(watched);
        observer.observe(select);
        watched = select;
      }
    }
    read();
    observer?.observe(el);
    return () => observer?.disconnect();
  }, []);
}
