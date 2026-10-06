/**
 * POST /api/calculation/preview   (Slice #18.10.diviz)
 *
 * Body: { text: string }  — the raw contents of a 4-section division data file.
 *
 * Parses + computes the owner subdivision and road on the server (the geometry
 * is always authoritative server-side) and returns the full computation for the
 * preview screen. Writes nothing.
 *
 * Runtime: Node.js — computeDivisionFromFile reads the Stereo 70 grid from disk.
 */

export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { unexpectedError } from "@/lib/api/errors";
import { computeDivisionFromFile } from "@/lib/calculation/compute";
import { DivisionError } from "@/lib/calculation/geometry";
import { ParseError } from "@/lib/calculation/parse";
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

  const text = (body as { text?: unknown }).text;
  if (typeof text !== "string" || text.trim().length === 0) {
    return Response.json({ error: "No file text provided" }, { status: 400 });
  }

  try {
    const computation = computeDivisionFromFile(text);
    return Response.json({ computation });
  } catch (err) {
    if (err instanceof ParseError || err instanceof DivisionError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return unexpectedError(err, "POST /api/calculation/preview");
  }
}
