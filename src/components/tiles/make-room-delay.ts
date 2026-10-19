"use client";

/**
 * How long a dragged tile is held over another before that one makes room.
 *                                                    (Slice 39.91; 39.92)
 *
 * The one place the tile hook reads the make-room delay from, in ms. Since
 * 39.92 it is the value saved in „Setări" („Praguri de timp" → „Fișe",
 * `tile_make_room_delay`), read once per page load through a module-level
 * promise — not React Query, because the tile screens are rendered in jest
 * with no QueryClientProvider (as `saved-tile-defaults.ts` is, for the same
 * reason). Until the read answers, and whenever it fails or holds nothing
 * usable, the delay is the built-in `MAKE_ROOM_DELAY_MS`, 1,0 s. A save on
 * „Setări" calls `forgetMakeRoomDelay()`, so the next screen reads afresh.
 * One value for the whole archive, like every other threshold.
 */
import { MAKE_ROOM_DELAY_KEY, SECONDS_MAX_MS, SECONDS_MIN_MS } from "@/lib/time-frames/config";
import { MAKE_ROOM_DELAY_MS } from "@/lib/ui/tile-positions";

let pending: Promise<number> | null = null;
let current = MAKE_ROOM_DELAY_MS;

/** A saved value, if it is one the editor could have saved; anything else is the built-in delay. */
export function usableDelay(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= SECONDS_MIN_MS && value <= SECONDS_MAX_MS ? value : MAKE_ROOM_DELAY_MS;
}

/** Reads the saved delay, once per page load (until forgotten). */
export function loadMakeRoomDelay(): Promise<number> {
  if (pending) return pending;
  pending =
    typeof fetch !== "function"
      ? Promise.resolve(MAKE_ROOM_DELAY_MS)
      : fetch("/api/time-frames")
          .then((r) => (r.ok ? (r.json() as Promise<{ items?: { key: string; value: unknown }[] }>) : { items: [] }))
          .then((j) => usableDelay(j.items?.find((i) => i.key === MAKE_ROOM_DELAY_KEY)?.value))
          .catch(() => MAKE_ROOM_DELAY_MS);
  pending.then((ms) => {
    current = ms;
  });
  return pending;
}

/** After „Setări" saves the thresholds: the next screen reads the delay afresh. */
export function forgetMakeRoomDelay(): void {
  pending = null;
}

/** The make-room delay now, in ms: the saved value once read, the built-in 1,0 s before that. */
export function makeRoomDelayMs(): number {
  return current;
}
