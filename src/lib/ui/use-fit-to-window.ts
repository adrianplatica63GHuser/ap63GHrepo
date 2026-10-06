"use client";

/**
 * A box that takes the height left in the window, and scrolls inside it.
 *                                                              (Slice #38.19)
 *
 * Administrare → Etichete: with many tags the cloud grew past the window, the
 * page scrolled, and „Redenumește etichetă" and „Fuzionează etichete" — at the
 * cloud's top — left the screen. Now the chips sit in a box of their own whose
 * height is what the window has left under everything above it and over
 * everything below it, so the page itself never scrolls and only the chips do.
 *
 * SIZED TO THE WINDOW, NOT A NUMBER OF PX: measured against the page's own
 * scroller (the nearest ancestor that scrolls — the app's content column — or
 * the document), again whenever the scroller or the box changes size, and
 * whenever the caller says what is under the box changed (`deps`, the refusal
 * line). `fittedHeight` is the arithmetic, pure.
 */
import { useLayoutEffect, useState, type DependencyList, type RefObject } from "react";

/** The smallest the box is made, in px: a window too short to hold it scrolls the page instead. */
export const MIN_FIT_PX = 160;

/**
 * The box's height: the scroller's visible height, less what stands above the
 * box and what stands below it in the scroller's content.
 */
export function fittedHeight({ visible, above, below }: { visible: number; above: number; below: number }, min = MIN_FIT_PX): number {
  return Math.max(min, Math.floor(visible - above - below));
}

/** The element whose scrolling moves `el`: the nearest ancestor that may scroll vertically, or the document. */
function scrollerOf(el: HTMLElement): HTMLElement {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if (o === "auto" || o === "scroll") return p;
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

/**
 * What stands below `el` in `scroller`'s content, in px: in each ancestor up
 * to the scroller, the siblings in flow after it and the ancestor's own bottom
 * padding and border — read from the siblings themselves, never from an
 * ancestor's bottom edge, so an ancestor stretched to the window's height does
 * not count its empty space (which would shrink the box to whatever height it
 * had, and keep it there as the tags grow).
 */
function belowOf(el: HTMLElement, scroller: HTMLElement): number {
  const px = (v: string): number => Number.parseFloat(v) || 0;
  let below = 0;
  let child: HTMLElement = el;
  for (let p = el.parentElement; p && p !== scroller; child = p, p = p.parentElement) {
    const start = child.getBoundingClientRect().bottom;
    let last = start + px(getComputedStyle(child).marginBottom);
    for (let s = child.nextElementSibling; s; s = s.nextElementSibling) {
      const cs = getComputedStyle(s);
      if (cs.position === "fixed" || cs.position === "absolute" || cs.display === "none") continue;
      const r = s.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      last = Math.max(last, r.bottom + px(cs.marginBottom));
    }
    const pcs = getComputedStyle(p);
    below += last - start + px(pcs.paddingBottom) + px(pcs.borderBottomWidth);
  }
  return below + px(getComputedStyle(scroller).paddingBottom);
}

/** The px height `ref`'s box should have to fill what the window leaves it; null until measured. */
export function useFitToWindow(ref: RefObject<HTMLElement | null>, deps: DependencyList = []): number | null {
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const scroller = scrollerOf(el);
    const isDocument = scroller === document.scrollingElement || scroller === document.documentElement;
    const measure = () => {
      const top = isDocument ? 0 : scroller.getBoundingClientRect().top;
      const above = el.getBoundingClientRect().top - top + scroller.scrollTop;
      setHeight(fittedHeight({ visible: isDocument ? window.innerHeight : scroller.clientHeight, above, below: belowOf(el, scroller) }));
    };
    // A ResizeObserver reports once when it starts observing, then on every change.
    const sizes = new ResizeObserver(measure);
    sizes.observe(scroller);
    if (el.parentElement) sizes.observe(el.parentElement); // the header above may wrap
    window.addEventListener("resize", measure);
    return () => {
      sizes.disconnect();
      window.removeEventListener("resize", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` is the caller's list of what changes the content around the box
  }, [ref, ...deps]);

  return height;
}
