/**
 * „Instrumente → Calcul suprafață": the map of all properties, with its two area buttons pointed out.  (Slice #39.09)
 *
 * The sidebar item opens `/properties/map?area=1`. On that address the map's two area tools (#39.07, #39.08) carry
 * `ga-area-pulse` for three seconds — #38.79's ga-note-pulse timing, 1 s × 3, in the area tools' violet, the
 * background and a ring only, nothing reflowing — then settle. Reduced motion holds the highlight for the same three
 * seconds instead (globals.css). Nothing is pressed for the user. The parameter stays in the address, so a reload
 * points the buttons out again; leaving it and coming back does too.
 */
import { useEffect, useState } from "react";

export const AREA_PULSE_PARAM = "area";
/** The sidebar item's address (nav-config.ts → „Calcul suprafață"). */
export const AREA_CALCULATION_HREF = `/properties/map?${AREA_PULSE_PARAM}=1`;
/** #38.79's NOTE_PULSE_MS: the same three seconds. */
export const AREA_PULSE_MS = 3000;
export const AREA_PULSE_CLASS = "ga-area-pulse";

/** Does this query string (`window.location.search` or `URLSearchParams#toString()`) ask for the pulse? */
export function readAreaPulse(search: string): boolean {
  return new URLSearchParams(search).has(AREA_PULSE_PARAM);
}

/**
 * True for AREA_PULSE_MS from the moment `asked` turns true — on arrival, on a reload, on coming back to the address —
 * then false until it is asked again. Kept as state adjusted during render (React's „storing information from
 * previous renders"), so an arrival starts the pulse in the same render that draws the buttons.
 */
export function useAreaPulse(asked: boolean): boolean {
  const [pulse, setPulse] = useState(false);
  const [seen, setSeen] = useState(false);
  if (asked !== seen) {
    setSeen(asked);
    if (asked) setPulse(true);
  }
  useEffect(() => {
    if (!pulse) return;
    const timer = setTimeout(() => setPulse(false), AREA_PULSE_MS);
    return () => clearTimeout(timer);
  }, [pulse]);
  return pulse;
}
