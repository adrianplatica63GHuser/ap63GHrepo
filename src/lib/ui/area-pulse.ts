/**
 * The big map's buttons, pointed out: a set of them pulses for three seconds.        (Slice #39.09; #39.78)
 *
 * „Instrumente → Măsurători pe hartă" and „→ Grupări de proprietăți" (#39.78) each open a box about some of the
 * map's buttons; its OK opens `/properties/map?pulse=measure` or `?pulse=groups`. On that address the buttons of the
 * set carry `ga-area-pulse` for three seconds — #38.79's ga-note-pulse timing, 1 s × 3, in the area tools' violet,
 * the background and a ring only, nothing reflowing — then settle. Reduced motion holds the highlight for the same
 * three seconds instead (globals.css). Nothing is pressed for the user. The parameter stays in the address, so a
 * reload points the buttons out again; leaving it and coming back does too.
 *
 * `?area=1` was „Calcul suprafață"'s address (#39.09), the item #39.78 took out: an old link still points out the
 * two area buttons, as it did.
 */
import { useEffect, useState } from "react";

export const PULSE_PARAM = "pulse";
/** #39.09's parameter, kept for old links: `?area=1` points out the two area buttons. */
export const AREA_PULSE_PARAM = "area";
/** „Calcul suprafață"'s address until #39.78 — an old link, still honoured. */
export const AREA_CALCULATION_HREF = `/properties/map?${AREA_PULSE_PARAM}=1`;
/** #38.79's NOTE_PULSE_MS: the same three seconds. */
export const AREA_PULSE_MS = 3000;
export const AREA_PULSE_CLASS = "ga-area-pulse";

/** The map's toolbar buttons a set can name, left to right. */
export const MAP_TOOLS = ["angles", "ruler", "areaDelimited", "areaFree", "tarlale", "groups", "select"] as const;
export type MapTool = (typeof MAP_TOOLS)[number];

/** What the address can ask to be pointed out: the two guides' sets, and the old link's. */
export type PulseSet = "measure" | "groups" | "area";
export const PULSE_SETS: Record<PulseSet, readonly MapTool[]> = {
  measure: ["angles", "ruler", "areaDelimited", "areaFree"],
  groups: ["tarlale", "groups", "select"],
  area: ["areaDelimited", "areaFree"],
};

/** Where each guide's OK goes. */
export function mapPulseHref(set: "measure" | "groups"): string {
  return `/properties/map?${PULSE_PARAM}=${set}`;
}

/**
 * Which set this query string (`window.location.search` or `URLSearchParams#toString()`) asks for, or null.
 * `?pulse=` names a set; an unknown name asks for nothing. `?area` (any value) is the old link's set.
 */
export function readMapPulse(search: string): PulseSet | null {
  const params = new URLSearchParams(search);
  const named = params.get(PULSE_PARAM);
  if (named === "measure" || named === "groups") return named;
  return params.has(AREA_PULSE_PARAM) ? "area" : null;
}

/** Does this query string ask for any pulse? (#39.09's question, kept for the old link's callers.) */
export function readAreaPulse(search: string): boolean {
  return readMapPulse(search) !== null;
}

/**
 * The window event a guide sends when its OK lands on the address the map already shows: nothing in the address
 * changes, so the map would not otherwise know to point its buttons out again.
 */
export const MAP_PULSE_EVENT = "ga-map-pulse";

/** Send it — from a guide's OK, when the map is already on that address. */
export function askMapPulseAgain(): void {
  window.dispatchEvent(new Event(MAP_PULSE_EVENT));
}

/**
 * True for AREA_PULSE_MS from the moment `asked` turns to a set — on arrival, on a reload, on coming back to the
 * address, on another set being asked, and on MAP_PULSE_EVENT while one is asked — then false until it is asked
 * again. Kept as state adjusted during render (React's „storing information from previous renders"), so an arrival
 * starts the pulse in the same render that draws the buttons. A boolean is the old form: `true` is one set.
 */
export function useAreaPulse(asked: PulseSet | boolean | null): boolean {
  const key = asked === true ? "area" : asked === false ? null : asked;
  const [pulse, setPulse] = useState(false);
  const [seen, setSeen] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  if (key !== seen) {
    setSeen(key);
    if (key) setPulse(true);
  }
  useEffect(() => {
    if (!key) return;
    const again = () => {
      setPulse(true);
      setRound((r) => r + 1);
    };
    window.addEventListener(MAP_PULSE_EVENT, again);
    return () => window.removeEventListener(MAP_PULSE_EVENT, again);
  }, [key]);
  useEffect(() => {
    if (!pulse) return;
    const timer = setTimeout(() => setPulse(false), AREA_PULSE_MS);
    return () => clearTimeout(timer);
  }, [pulse, round]);
  return pulse;
}
