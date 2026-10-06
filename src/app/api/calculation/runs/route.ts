/**
 * GET /api/calculation/runs   (Slice #20.09)
 *
 * Returns all calculation runs, newest first.
 * Response: { items: CalcRunListItem[] }
 */

export const runtime = "nodejs";

import { unexpectedError } from "@/lib/api/errors";
import { listCalculationRuns } from "@/lib/calculation/runs";
import { requireFullAccess } from "@/lib/auth/current-role";

export async function GET(): Promise<Response> {
  // Full access only (superuser-only until #38.21) — FU-222, Slice #37.03: its only screen is the calculation history (/admin/calculation/history).
  const denied = await requireFullAccess();
  if (denied) return denied;

  try {
    const items = await listCalculationRuns();
    return Response.json({ items });
  } catch (err) {
    return unexpectedError(err, "GET /api/calculation/runs");
  }
}
