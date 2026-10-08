/**
 * GET    /api/calculation/runs/[id]   (Slice #20.09)
 * DELETE /api/calculation/runs/[id]   (Slice #38.43)
 *
 * GET returns full detail for one calculation run: { run: CalcRunDetail } or 404.
 * DELETE removes the run and, by cascade, its output rows; the properties and
 * the group it created stay. 200 { code } — or 404 for an id that is no run,
 * including one that is not a UUID (refused before the query, which would
 * otherwise fail as a 500).
 */

export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { unexpectedError } from "@/lib/api/errors";
import { deleteCalculationRun, getCalculationRun } from "@/lib/calculation/runs";
import { isRunId } from "@/lib/calculation/delete-run";
import { requireFullAccess } from "@/lib/auth/current-role";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  // Full access only (superuser-only until #38.21) — FU-222, Slice #37.03: its only screen is a calculation run (/admin/calculation/history/[id]).
  const denied = await requireFullAccess();
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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  // Full access only, as the rest of /admin/* — there is no role beyond it since #38.21.
  const denied = await requireFullAccess();
  if (denied) return denied;

  const { id } = await params;
  if (!isRunId(id)) return Response.json({ error: "Not found" }, { status: 404 });
  try {
    const deleted = await deleteCalculationRun(id);
    if (!deleted) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ code: deleted.code });
  } catch (err) {
    return unexpectedError(err, `DELETE /api/calculation/runs/${id}`);
  }
}
