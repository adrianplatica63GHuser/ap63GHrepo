/**
 * POST /api/calculation/commit   (Slice #18.10.diviz, extended #20.09; paused #38.23)
 *
 * ⚠️ **REFUSES EVERY REQUEST UNTIL #38.25, AND WRITES NOTHING.** #38.23
 * replaced the five-section data file with the three-section one and moved the
 * road to the user's two clicks (#38.24); this route read the old file and
 * computed its own road, so there is nothing left for it to create the
 * properties from. „Calcul drum lateral" offers no „Creează proprietățile"
 * between #38.23 and #38.25 (the header's Ask first 1, confirmed by Adrian on
 * 2026-10-06), so no screen calls it.
 *
 * #38.25 rebuilds it on the new pipeline: one property per owner and the road,
 * a group, a `calculation_run` with its outputs, and `setInitialProvenance`
 * with its own `.catch()` on every created property — the shape the route had
 * until #38.23, in git history at `dd972ca:src/app/api/calculation/commit/route.ts`.
 */

export const runtime = "nodejs";

import { requireFullAccess } from "@/lib/auth/current-role";

export async function POST(): Promise<Response> {
  // Full access only (superuser-only until #38.21) — FU-222, Slice #37.03: its only screen is „Calcul" (/admin/calculation).
  const denied = await requireFullAccess();
  if (denied) return denied;

  return Response.json(
    { error: "Creating the properties from a side-road calculation returns with slice #38.25." },
    { status: 409 },
  );
}
