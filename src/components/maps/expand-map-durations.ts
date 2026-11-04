"use client";

/**
 * How long each part of „Hartă extinsă"'s opening lasts, in ms.                                       (Slice 41.75)
 *
 * The values saved in „Setări" („Praguri de timp" → „Hărți": `map_expand_grow`, `map_expand_zoom_out`), read once per
 * page load through a module-level promise, as the make-room delay is (make-room-delay.ts) and for the same reason:
 * the property form is rendered in jest with no QueryClientProvider. Until the read answers, and whenever it fails or
 * holds nothing usable, each part is the built-in 3,0 s. A save on „Setări" calls `forgetExpandDurations()`.
 */
import { EXPAND_DEFAULT_MS, EXPAND_GROW_KEY, EXPAND_ZOOM_OUT_KEY, usableExpandMs } from "@/lib/geo/expand-map-animation";

export type ExpandDurations = { growMs: number; zoomMs: number };

const DEFAULTS: ExpandDurations = { growMs: EXPAND_DEFAULT_MS, zoomMs: EXPAND_DEFAULT_MS };
let pending: Promise<ExpandDurations> | null = null;
let current: ExpandDurations = DEFAULTS;

/** Reads the two saved lengths, once per page load (until forgotten). */
export function loadExpandDurations(): Promise<ExpandDurations> {
  if (pending) return pending;
  pending =
    typeof fetch !== "function"
      ? Promise.resolve(DEFAULTS)
      : fetch("/api/time-frames")
          .then((r) => (r.ok ? (r.json() as Promise<{ items?: { key: string; value: unknown }[] }>) : { items: [] }))
          .then((j) => ({
            growMs: usableExpandMs(j.items?.find((i) => i.key === EXPAND_GROW_KEY)?.value),
            zoomMs: usableExpandMs(j.items?.find((i) => i.key === EXPAND_ZOOM_OUT_KEY)?.value),
          }))
          .catch(() => DEFAULTS);
  pending.then((d) => {
    current = d;
  });
  return pending;
}

/** After „Setări" saves the thresholds: the next screen reads the lengths afresh. */
export function forgetExpandDurations(): void {
  pending = null;
}

/** The two lengths now: the saved values once read, the built-in 3,0 s each before that. */
export function expandDurations(): ExpandDurations {
  return current;
}
