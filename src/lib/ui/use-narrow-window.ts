"use client";

/**
 * A narrow window: under 1024 px wide (Tailwind's `lg`).                                             (Slice 40.68)
 *
 * Expanded, the sidebar is 224 px — a third of a 700-px window — and the dashboard and the record screens then scroll
 * sideways. Under `lg` the sidebar is drawn as its icon rail whatever was stored (`sidebar-collapsed`), and the stored
 * choice is left as it is: above `lg` it applies again. The rail's WIDTH is decided in CSS (`max-lg:w-14` on the
 * aside), so the first paint is already narrow; this hook is for what JavaScript must know — which way the expand
 * button opens the sidebar (an overlay here, the stored choice above `lg`).
 */
import { useSyncExternalStore } from "react";

/** The media query: narrower than Tailwind's `lg` (1024 px). */
export const NARROW_WINDOW_QUERY = "(max-width: 1023.98px)";

function matchesNow(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(NARROW_WINDOW_QUERY).matches;
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const list = window.matchMedia(NARROW_WINDOW_QUERY);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}

/**
 * True while the window is narrower than 1024 px; follows the window as it is resized.
 *
 * Slice 40.72 (fixed in passing): an external store, so the first render on the client is the server's (`false`) and
 * React takes the window's own answer right after it — reading `matchMedia` in `useState` made a narrow window's first
 * client render differ from the server's HTML, a hydration error in the sidebar's header.
 */
export function useNarrowWindow(): boolean {
  return useSyncExternalStore(subscribe, matchesNow, () => false);
}
