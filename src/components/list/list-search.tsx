"use client";

/**
 * A principal list's search box, as wide as the list's „Adaugă …" button, its whole explanation on hover.
 *                                                                                                  (Slice #39.85)
 *
 * Adrian, 2026-10-18: „The first field for searching by code title or numbers should be as wide as the Add New button
 * but - when hovering over the field it should display the entire explanation". So:
 *   - the box takes the width of its toolbar's „Adaugă …" button (the element marked `data-list-add`), measured before
 *     paint and again whenever the button's width changes — so it follows the button in either language (#39.85's Ask
 *     first 1), not a fixed rem. The button is found in the DOM, not by a ref: it comes after the box in the toolbar,
 *     and React attaches a later sibling's ref only after this box's layout effect has run;
 *   - its explanation is the placeholder, cut with „…" where the box is narrower; the hover (`title`) and the box's
 *     accessible name are the whole text (Ask first 2);
 *   - the explanation names its fields as „Câmpuri afișate", the column headers or the form spell them
 *     (`search-explanation.test.ts` holds the four to that, and to what each list's route searches).
 * Until the button is measured — the first render, on the server — the box is `w-64`, as all four were.
 */
import { useLayoutEffect, useRef } from "react";

/** Marks a list's „Adaugă …" button (the element around it) for the search box to take its width. */
export const LIST_ADD = { "data-list-add": "" } as const;

export function ListSearchBox({
  value,
  onChange,
  explanation,
}: {
  value: string;
  onChange: (next: string) => void;
  /** The list's searchPlaceholder: what the search reads, in the chooser's words. */
  explanation: string;
}) {
  const box = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    const input = box.current;
    const source = input?.closest("[data-list-toolbar]")?.querySelector<HTMLElement>("[data-list-add]");
    if (!source || !input) return;
    const fit = () => {
      const w = source.getBoundingClientRect().width;
      if (w > 0) input.style.width = `${w}px`;
    };
    fit();
    const watch = new ResizeObserver(fit);
    watch.observe(source);
    return () => watch.disconnect();
  }, []);
  return (
    <input
      ref={box}
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={explanation}
      aria-label={explanation}
      title={explanation}
      data-list-search=""
      className="w-64 shrink-0 text-ellipsis rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm placeholder:text-fade focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
    />
  );
}
