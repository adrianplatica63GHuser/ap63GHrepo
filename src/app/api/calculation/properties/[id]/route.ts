/**
 * GET /api/calculation/properties/[id]   (Slice #39.79)
 *
 * The property „Calcul drum lateral" will divide, as the calculation reads it: its corners in their stored order, in
 * Stereo 70, with the labels they will carry (side-road-source.ts). The screen checks them at once — four, and not
 * crossing — with the same `checkSideRoadInput` the server applies when it computes.
 *
 * Answers 200 { property: { id, code, nickname, corners: { number, north, east }[] } }, or 404.
 */

export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { unexpectedError } from "@/lib/api/errors";
import { requireFullAccess } from "@/lib/auth/current-role";
import { loadPropertyForCalculation } from "@/lib/calculation/side-road-source";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireFullAccess();
  if (denied) return denied;
  const { id } = await params;
  try {
    const found = await loadPropertyForCalculation(id);
    if (!found) return Response.json({ error: "Property not found" }, { status: 404 });
    return Response.json({ property: found });
  } catch (err) {
    return unexpectedError(err, `GET /api/calculation/properties/${id}`);
  }
}
