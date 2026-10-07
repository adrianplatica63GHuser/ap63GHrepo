/**
 * POST /api/calculation/preview   (Slice #18.10.diviz; #38.23)
 *
 * Body: { text: string; order?: number[]; road?: { corner: number; side: "next" | "previous" } }
 *   text  — the raw three-section data file („Secțiunea de Colțuri", …);
 *   order — order[k] is the file index of the owner in slice k. Left out on
 *           the first read, which gets a random order back;
 *   road  — (#38.24) the corner the road starts at, by its index in the file,
 *           and which of its two sides it runs along. Left out until the
 *           user has made both clicks.
 *
 * Answers 200 { computation } — the parcel, its numbered corners and sides,
 * the road when one was asked for, and the slices in WGS84; or
 * 400 { problems } — EVERY reason the file was rejected, as codes the screen
 * words in Romanian or English; or 400 { refusal } — why that road cannot be
 * built (#38.24), never a road drawn wrong; or 400 { error } for a body that
 * is not one (an order that does not list each owner once, a corner that is
 * not one of the four).
 * Writes nothing. The geometry is the server's: Node.js, because transdatRO
 * reads the Stereo 70 grid from disk.
 */

export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { unexpectedError } from "@/lib/api/errors";
import { computeSlicesFromFile, RoadRejected } from "@/lib/calculation/compute";
import { DivisionError } from "@/lib/calculation/geometry";
import { FileRejected } from "@/lib/calculation/parse";
import { requireFullAccess } from "@/lib/auth/current-role";

export async function POST(request: NextRequest): Promise<Response> {
  // Full access only (superuser-only until #38.21) — FU-222, Slice #37.03: its only screen is „Calcul" (/admin/calculation).
  const denied = await requireFullAccess();
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { text, order, road } = (body ?? {}) as { text?: unknown; order?: unknown; road?: unknown };
  if (typeof text !== "string" || text.trim().length === 0) {
    return Response.json({ error: "No file text provided" }, { status: 400 });
  }

  try {
    const computation = computeSlicesFromFile(text, order, Math.random, road);
    return Response.json({ computation });
  } catch (err) {
    if (err instanceof FileRejected) {
      return Response.json({ problems: err.problems }, { status: 400 });
    }
    if (err instanceof RoadRejected) {
      return Response.json({ refusal: err.refusal }, { status: 400 });
    }
    if (err instanceof DivisionError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return unexpectedError(err, "POST /api/calculation/preview");
  }
}
