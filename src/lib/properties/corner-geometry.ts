/**
 * Project a property's corners and measure them (Slice #18.09; extended by
 * Slice #32.14).
 *
 * This is the one place that turns stored WGS84 corners into the two numbers
 * the `property` row carries about its own geometry: `calculated_area_mp` and
 * `corner_order_self_intersects`. It lives here rather than in `./area.ts`
 * because it reads the national grid file through `wgs84ToStereo70`, and
 * `area.ts` is imported by the BROWSER — the property form recomputes the same
 * two things live from the corners on screen, using the /api/geo/convert batch
 * endpoint for the projection. `area.ts` stays pure and dependency-free so both
 * sides can share the arithmetic; only the projection differs.
 *
 * ⚠️ ONE PROJECTION, TWO ANSWERS, AND THAT IS THE POINT OF THE FUNCTION. Before
 * #32.14 this was `computeCalculatedAreaMp`, which projected the corners,
 * computed the area and threw the projected array away. The obvious way to add
 * the bow-tie flag was a second function projecting a second time — and
 * `wgs84ToStereo70` THROWS at the edge of the grid's coverage, so a second
 * projection outside this try/catch would put a throw back on the save path
 * that the catch below exists to keep off it. Returning both from one call
 * makes that mistake unavailable rather than merely discouraged.
 */

import { wgs84ToStereo70 } from "@/lib/geo/transdatRO";
import { polygonSelfIntersects, shoelaceAreaM2 } from "./area";

export type CornerGeometry = {
  /**
   * Interior area in m² as a drizzle-numeric string (2 dp), or null when there
   * are fewer than 3 corners or the projection failed.
   */
  calculatedAreaMp: string | null;
  /**
   * True when the corners IN THE ORDER GIVEN trace a ring that is not a simple
   * polygon — which is exactly the condition that makes `calculatedAreaMp`
   * above a meaningless number rather than a wrong one.
   */
  selfIntersects: boolean;
};

/**
 * ⚠️ NEVER THROWS, AND NEVER REPORTS A BOW-TIE IT IS NOT SURE OF. Both callers
 * are inside a save. A corner outside the Stereo 70 grid's coverage makes
 * `wgs84ToStereo70` throw; the catch turns that into "no area, no marker",
 * because a save must not be refused by a measurement, and coordinates that
 * cannot be projected cannot support the claim that their ORDER is wrong.
 */
export function computeCornerGeometry(
  corners: { lat: number; lon: number }[],
): CornerGeometry {
  if (corners.length < 3) return { calculatedAreaMp: null, selfIntersects: false };

  try {
    const planar = corners.map((c) => wgs84ToStereo70(c.lat, c.lon));
    const area = shoelaceAreaM2(planar);
    return {
      calculatedAreaMp: area == null ? null : area.toFixed(2),
      selfIntersects: polygonSelfIntersects(planar),
    };
  } catch {
    return { calculatedAreaMp: null, selfIntersects: false };
  }
}
