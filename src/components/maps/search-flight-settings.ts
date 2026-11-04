"use client";

/**
 * „Caută pe hartă"'s flight, as „Setări" sets it: its length in ms and the parabola's coefficient a.  (Slice 41.76)
 *
 * `map_search_flight` (ms, 0–15 s) and `map_search_arc` (hundredths, 0–300) in „Praguri de timp" → „Hărți", read once
 * per page load through a module-level promise, as the make-room delay and „Hartă extinsă"'s parts are. Until the read
 * answers, and whenever it fails or holds nothing usable, the flight is 41.70's 4 s and a is 1,00. A save on „Setări"
 * calls `forgetSearchFlight()`.
 */
import { FLIGHT_ARC, FLIGHT_MS } from "@/lib/geo/map-search";
import { HUNDREDTHS_MAX, HUNDREDTHS_MIN, MAP_SEARCH_ARC_KEY, MAP_SEARCH_FLIGHT_KEY, MAP_SEARCH_FLIGHT_MAX_MS } from "@/lib/time-frames/config";

export type SearchFlight = { durationMs: number; arc: number };

const DEFAULTS: SearchFlight = { durationMs: FLIGHT_MS, arc: FLIGHT_ARC };
let pending: Promise<SearchFlight> | null = null;
let current: SearchFlight = DEFAULTS;

const whole = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** The two saved values as the flight uses them; anything unusable is its default. */
export function usableSearchFlight(flight: unknown, arcHundredths: unknown): SearchFlight {
  return {
    durationMs: whole(flight, 0, MAP_SEARCH_FLIGHT_MAX_MS) ? flight : FLIGHT_MS,
    arc: whole(arcHundredths, HUNDREDTHS_MIN, HUNDREDTHS_MAX) ? arcHundredths / 100 : FLIGHT_ARC,
  };
}

/** Reads them, once per page load (until forgotten). */
export function loadSearchFlight(): Promise<SearchFlight> {
  if (pending) return pending;
  pending =
    typeof fetch !== "function"
      ? Promise.resolve(DEFAULTS)
      : fetch("/api/time-frames")
          .then((r) => (r.ok ? (r.json() as Promise<{ items?: { key: string; value: unknown }[] }>) : { items: [] }))
          .then((j) =>
            usableSearchFlight(
              j.items?.find((i) => i.key === MAP_SEARCH_FLIGHT_KEY)?.value,
              j.items?.find((i) => i.key === MAP_SEARCH_ARC_KEY)?.value,
            ),
          )
          .catch(() => DEFAULTS);
  pending.then((f) => {
    current = f;
  });
  return pending;
}

/** After „Setări" saves the thresholds: the next screen reads them afresh. */
export function forgetSearchFlight(): void {
  pending = null;
}

/** The flight now: the saved values once read, 4 s and a = 1,00 before that. (`searchFlight` is the map's own state.) */
export function searchFlightSetting(): SearchFlight {
  return current;
}
