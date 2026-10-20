"use client";

/**
 * Three red „>" at the band of names' right edge while columns are hidden to the right, three red „<" at its left
 * edge while columns are hidden to the left.                                                       (Slice #40.03)
 *
 * Adrian, 2026-10-20: „This will show the user that it would be a good idea to scroll towards the right". The four
 * principal lists' frames (`LIST_FRAME`, #40.02) draw this as their FIRST child, before the table (Ask first 6):
 *   - a strip with no height, as wide as the frame's visible part, sticking to its top-left corner — so it stays at the
 *     band's height as the rows scroll down and at the visible part's edges as the list scrolls sideways — and at its
 *     two ends the signs, each the band's height (`LIST_HEAD_PX`), three glyphs centred in it, on a narrow strip of the
 *     band's own background so they read over a column's name (Ask first 2);
 *   - in the danger red, `text-red-600`, `dark:text-red-400`, bold, at the band's 16-px line;
 *   - a sign, not a button (Ask first 4): `pointer-events-none` and `aria-hidden`, so a funnel or the select-all box
 *     under it is pressed as if it were not there; the scroll bar, the trackpad and Shift+wheel scroll the list;
 *   - which sides show is `hiddenSides` (Ask first 3), read again on the frame's scroll, on resize, and whenever the
 *     frame or its table changes size — the chosen columns, the row tiles opening or closing beside the list (Ask
 *     first 5).
 */
import { useEffect, useRef, useState } from "react";
import { HEAD_BAND_PX } from "@/components/table/list-head";
import { NOTHING_HIDDEN, hiddenSides, sameSides, type HiddenSides } from "@/lib/ui/hidden-columns";

/** The band of names' row: the band and its cell's `py-2`. */
export const LIST_HEAD_PX = HEAD_BAND_PX + 16;

const SIGN = "absolute top-0 flex w-5 flex-col items-center justify-center bg-cap text-base font-bold leading-4 text-red-600 dark:bg-zinc-800 dark:text-red-400";

export function HiddenColumnSigns() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [sides, setSides] = useState<HiddenSides>(NOTHING_HIDDEN);
  useEffect(() => {
    const frame = ref.current?.parentElement;
    if (!frame) return;
    const read = () => {
      const next = hiddenSides({ scrollLeft: frame.scrollLeft, clientWidth: frame.clientWidth, scrollWidth: frame.scrollWidth });
      setSides((prev) => (sameSides(prev, next) ? prev : next));
    };
    read();
    frame.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", read);
    // jsdom (jest) has no layout and no ResizeObserver: the first read stands there.
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(read);
    observer?.observe(frame);
    const table = frame.querySelector("table");
    if (table) observer?.observe(table);
    return () => {
      frame.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
      observer?.disconnect();
    };
  }, []);
  return (
    <div ref={ref} aria-hidden="true" className="pointer-events-none sticky left-0 top-0 z-20 h-0 w-full" data-hidden-columns="">
      {sides.left && (
        <span className={`${SIGN} left-0`} style={{ height: LIST_HEAD_PX }} data-hidden-left="">
          <span>&lt;</span>
          <span>&lt;</span>
          <span>&lt;</span>
        </span>
      )}
      {sides.right && (
        <span className={`${SIGN} right-0`} style={{ height: LIST_HEAD_PX }} data-hidden-right="">
          <span>&gt;</span>
          <span>&gt;</span>
          <span>&gt;</span>
        </span>
      )}
    </div>
  );
}
