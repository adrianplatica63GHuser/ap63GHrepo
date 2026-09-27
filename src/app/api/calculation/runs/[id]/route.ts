/**
 * GET /api/calculation/runs/[id]   (Slice #20.09)
 *
 * Returns full detail for one calculation run.
 * Response: { run: CalcRunDetail } or 404.
 */

export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { unexpectedError } from "@/lib/api/errors";
import { getCalculationRun } from "@/lib/calculation/runs";
import { requireSuperuser } from "@/lib/auth/current-role";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  // Superuser only — FU-222, Slice #37.03: its only screen is a calculation run (/admin/calculation/history/[id]).
  const denied = await requireSuperuser();
  if (denied) return denied;

  const { id } = await params;
  try {
    const run = await getCalculationRun(id);
    if (!run) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json({ run });
  } catch (err) {
    return unexpectedError(err, `GET /api/calculation/runs/${id}`);
  }
}
