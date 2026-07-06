/**
 * GET /api/calculation/runs   (Slice #20.09)
 *
 * Returns all calculation runs, newest first.
 * Response: { items: CalcRunListItem[] }
 */

export const runtime = "nodejs";

import { unexpectedError } from "@/lib/api/errors";
import { listCalculationRuns } from "@/lib/calculation/runs";

export async function GET(): Promise<Response> {
  try {
    const items = await listCalculationRuns();
    return Response.json({ items });
  } catch (err) {
    return unexpectedError(err, "GET /api/calculation/runs");
  }
}
