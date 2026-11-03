"use client";

/**
 * The tooltip bubble — ONE look and ONE placement for every hover text in the app.          (Slice 41.46)
 *
 * #37.42 drew it for IconButton's label: a bubble portalled to `<body>`, `fixed`, 12 px medium ink, wrapping at
 * 320 px. Adrian, 2026-11-02: „I like the size of the fonts from the hints when I hover over the action buttons, it's a
 * good size; Let's use the same size for when I hover over other areas … even if we need to wrap the text on multiple
 * lines". So 41.46 moved the bubble here, and both IconTooltip (icon-button.tsx) and TextTooltip (text-tooltip.tsx)
 * draw it — the class is ONE constant, so the two can never drift apart.
 *
 * ⚠️ **PORTALLED, `fixed`.** Half the anchors sit inside a table frame that scrolls sideways or in the sidebar, which
 * is `overflow-hidden`; an `absolute` bubble would be clipped in both. It is placed under the anchor, centred, kept
 * inside the window, and flipped above it when there is no room below — measured in a layout effect, before paint.
 *
 * Like everything under `src/lib/ui/`, it takes its strings as props and never calls next-intl.
 */

import { useLayoutEffect, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

/** The bubble's classes: 12 px, medium, ink, wrapping at 20 rem — the size Adrian chose (41.46). */
export const TOOLTIP_BUBBLE_CLASS =
  "pointer-events-none fixed z-[70] max-w-[20rem] rounded-md border border-card-rim bg-white px-2 py-1 text-xs leading-snug font-medium text-ink shadow-lg dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200";

/** Space kept between the bubble and the anchor, and the window's edge. */
const GAP_PX = 6;
const EDGE_PX = 4;

/**
 * Put the bubble under the anchor, centred, inside the window; above it when the window has no room below. Writes the
 * position straight onto the node.
 */
export function placeTooltip(anchor: HTMLElement, tip: HTMLElement): void {
  const a = anchor.getBoundingClientRect();
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  const maxLeft = Math.max(EDGE_PX, window.innerWidth - w - EDGE_PX);
  const left = Math.min(Math.max(EDGE_PX, a.left + a.width / 2 - w / 2), maxLeft);
  const below = a.bottom + GAP_PX;
  const top = below + h > window.innerHeight - EDGE_PX ? Math.max(EDGE_PX, a.top - GAP_PX - h) : below;
  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
}

/** Keeps an open bubble placed against its anchor, through any scroll (captured) and a resize. */
export function useTooltipPlacement(
  isOpen: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  tipRef: RefObject<HTMLElement | null>,
  text: unknown,
): void {
  useLayoutEffect(() => {
    if (!isOpen) return;
    const anchor = anchorRef.current;
    const tip = tipRef.current;
    if (!anchor || !tip) return;
    const update = () => placeTooltip(anchor, tip);
    update();
    // Capture: a scroll inside any container (a table frame, the page's own column) moves the anchor too.
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [isOpen, anchorRef, tipRef, text]);
}

/** The bubble itself, portalled to `<body>`. `mark` is its `data-*` name, for the specs. */
export function TooltipBubble({
  tipRef,
  mark,
  id,
  children,
}: {
  tipRef: RefObject<HTMLSpanElement | null>;
  mark: "data-icon-tooltip" | "data-text-tooltip";
  id?: string;
  children: ReactNode;
}) {
  return createPortal(
    <span ref={tipRef} id={id} role="tooltip" {...{ [mark]: "" }} style={{ left: 0, top: 0 }} className={TOOLTIP_BUBBLE_CLASS}>
      {children}
    </span>,
    document.body,
  );
}
