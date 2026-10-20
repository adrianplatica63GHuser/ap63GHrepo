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
 *   - a sign that explains itself (Slice 40.11, Adrian: „the three red greater than or smaller than signs … should on
 *     Information when the mouse hover on top of them that will invite a user to scroll left or scroll right"): each
 *     sign is a button — the strip between them still takes no pointer — named by its sentence, „Mai sunt coloane la
 *     dreapta. Derulați spre dreapta ca să le vedeți.", which `IconTooltip` (useTooltip's delay, a keyboard focus,
 *     nothing on a tap) shows in a bubble under the band, never over the column names. A press, Enter or Space scrolls
 *     the frame that way (`signScrollTarget`), smoothly. #40.03 had them as signs a funnel under them was pressed
 *     through; a sign that catches the mouse covers its 20 px instead, and its press is what brings that column out;
 *   - which sides show is `hiddenSides` (Ask first 3), read again on the frame's scroll, on resize, and whenever the
 *     frame or its table changes size — the chosen columns, the row tiles opening or closing beside the list (Ask
 *     first 5).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { HEAD_BAND_PX } from "@/components/table/list-head";
import { IconTooltip } from "@/lib/ui/icon-button";
import { NOTHING_HIDDEN, hiddenSides, sameSides, signScrollTarget, type HiddenSides } from "@/lib/ui/hidden-columns";

/** The band of names' row: the band and its cell's `py-2`. */
export const LIST_HEAD_PX = HEAD_BAND_PX + 16;

const SIGN =
  "flex w-5 cursor-pointer flex-col items-center justify-center bg-cap text-base font-bold leading-4 text-red-600 " +
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus dark:bg-zinc-800 dark:text-red-400";

/** One side's sign: three glyphs, a button named by its sentence, the sentence in a bubble on hover or keyboard focus. */
function Sign({ side, label, onPress }: { side: "left" | "right"; label: string; onPress: () => void }) {
  const glyph = side === "left" ? "<" : ">";
  return (
    <IconTooltip label={label} className={`pointer-events-auto absolute top-0 ${side === "left" ? "left-0" : "right-0"}`}>
      <button
        type="button"
        aria-label={label}
        onClick={onPress}
        className={SIGN}
        style={{ height: LIST_HEAD_PX }}
        {...(side === "left" ? { "data-hidden-left": "" } : { "data-hidden-right": "" })}
      >
        <span aria-hidden="true">{glyph}</span>
        <span aria-hidden="true">{glyph}</span>
        <span aria-hidden="true">{glyph}</span>
      </button>
    </IconTooltip>
  );
}

export function HiddenColumnSigns() {
  const t = useTranslations("shared.hiddenColumns");
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
    // Slice 40.11, fixed in passing: the <table> a list draws first is replaced when its rows arrive, and the observer
    // went on watching the old one — so on a fresh load the signs stayed off until the first scroll or resize, however
    // many columns were hidden. A change of the frame's contents re-reads, and watches whichever table is there now.
    let table: Element | null = null;
    const watchTable = () => {
      const next = frame.querySelector("table");
      if (next === table) return;
      if (table) observer?.unobserve(table);
      table = next;
      if (table) observer?.observe(table);
    };
    watchTable();
    const mutations = typeof MutationObserver === "undefined" ? null : new MutationObserver(() => { watchTable(); read(); });
    mutations?.observe(frame, { childList: true, subtree: true });
    return () => {
      frame.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
      observer?.disconnect();
      mutations?.disconnect();
    };
  }, []);
  // Slice 40.11: a press scrolls the frame that way, smoothly — the visible width less 4 rem, never past an end.
  const press = useCallback((side: "left" | "right") => {
    const frame = ref.current?.parentElement;
    if (!frame) return;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const left = signScrollTarget({ scrollLeft: frame.scrollLeft, clientWidth: frame.clientWidth, scrollWidth: frame.scrollWidth }, side, rem);
    frame.scrollTo({ left, behavior: "smooth" });
  }, []);
  return (
    <div ref={ref} className="pointer-events-none sticky left-0 top-0 z-20 h-0 w-full" data-hidden-columns="">
      {sides.left && <Sign side="left" label={t("left")} onPress={() => press("left")} />}
      {sides.right && <Sign side="right" label={t("right")} onPress={() => press("right")} />}
    </div>
  );
}
