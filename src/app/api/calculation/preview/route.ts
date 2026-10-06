/**
 * POST /api/calculation/preview   (Slice #18.10.diviz; #38.23)
 *
 * Body: { text: string; order?: number[] }
 *   text  — the raw three-section data file („Secțiunea de Colțuri", …);
 *   order — order[k] is the file index of the owner in slice k. Left out on
 *           the first read, which gets a random order back.
 *
 * Answers 200 { computation } — the parcel, its numbered corners and sides,
 * and the slices in WGS84; or 400 { problems } — EVERY reason the file was
 * rejected, as codes the screen words in Romanian or English; or 400 { error }
 * for a body that is not one (an order that does not list each owner once).
 * Writes nothing. The geometry is the server's: Node.js, because transdatRO
 * reads the Stereo 70 grid from disk.
 */

export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { unexpectedError } from "@/lib/api/errors";
import { computeSlicesFromFile } from "@/lib/calculation/compute";
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

  const { text, order } = (body ?? {}) as { text?: unknown; order?: unknown };
  if (typeof text !== "string" || text.trim().length === 0) {
    return Response.json({ error: "No file text provided" }, { status: 400 });
  }

  try {
    const computation = computeSlicesFromFile(text, order);
    return Response.json({ computation });
  } catch (err) {
    if (err instanceof FileRejected) {
      return Response.json({ problems: err.problems }, { status: 400 });
    }
    if (err instanceof DivisionError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return unexpectedError(err, "POST /api/calculation/preview");
  }
}
