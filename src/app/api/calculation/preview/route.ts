/**
 * POST /api/calculation/preview   (Slice #18.10.diviz; #38.23; #39.79)
 *
 * Body: {
 *   propertyId: string;                                   // (#39.79) the parcel: a property in the archive
 *   owners: { personId: string; share: string }[];        // each a person in the archive, the share as typed
 *   width: string;                                        // the road's width in metres, as typed
 *   rerunOf?: string;                                     // a run id: cut the corners that run stored instead
 *   order?: number[];
 *   road?: { corner: number; side: "next" | "previous" };
 * }
 *   order — order[k] is the entry index of the owner in slice k. Left out on
 *           the first read, which gets a random order back;
 *   road  — (#38.24) the corner the road starts at, by its index among the
 *           property's four, and which of its two sides it runs along.
 *
 * Answers 200 { computation } — the parcel, its numbered corners and sides,
 * the road when one was asked for, and the slices in WGS84; or
 * 400 { problems } — EVERY reason the input was refused, as codes the screen
 * words (side-road-input.ts); or 400 { refusal } — why that road cannot be
 * built (#38.24), never a road drawn wrong; or 400 { error } for a body that
 * is not one (an unknown property or person, an order that does not list each
 * owner once, a corner that is not one of the four).
 * Writes nothing. The geometry is the server's: Node.js, because transdatRO
 * reads the Stereo 70 grid from disk.
 */

export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { unexpectedError } from "@/lib/api/errors";
import { computeSlices, RoadRejected } from "@/lib/calculation/compute";
import { DivisionError } from "@/lib/calculation/geometry";
import { InputRejected } from "@/lib/calculation/side-road-input";
import { resolveSideRoadRequest, SideRoadRequestInvalid } from "@/lib/calculation/side-road-source";
import { requireFullAccess } from "@/lib/auth/current-role";

export async function POST(request: NextRequest): Promise<Response> {
  // Full access only (superuser-only until #38.21) — FU-222, Slice #37.03: its only screen is „Calcul drum lateral" (/admin/calculation).
  const denied = await requireFullAccess();
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { order, road } = (body ?? {}) as { order?: unknown; road?: unknown };
  try {
    const { input } = await resolveSideRoadRequest(body);
    const computation = computeSlices(input, order, Math.random, road);
    return Response.json({ computation });
  } catch (err) {
    if (err instanceof InputRejected) {
      return Response.json({ problems: err.problems }, { status: 400 });
    }
    if (err instanceof RoadRejected) {
      return Response.json({ refusal: err.refusal }, { status: 400 });
    }
    if (err instanceof DivisionError || err instanceof SideRoadRequestInvalid) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return unexpectedError(err, "POST /api/calculation/preview");
  }
}
