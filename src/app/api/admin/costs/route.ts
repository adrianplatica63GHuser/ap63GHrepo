/**
 * /api/admin/costs                                                 (Slice #39.17)
 *
 * GET — „Setări → Costuri": every provider's month so far, today, forecast and
 * history, in CA$. Read-only; it calls no provider and sends no credential to
 * the browser (src/lib/costs/load.ts).
 */
import { requireFullAccess } from "@/lib/auth/current-role";
import { unexpectedError } from "@/lib/api/errors";
import { aiReadsByDay, testsMapsThisMonth } from "@/lib/costs/load";
import { buildCostSummary, torontoDay } from "@/lib/costs/summary";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const denied = await requireFullAccess();
  if (denied) return denied;
  try {
    const ai = await aiReadsByDay();
    return Response.json(
      buildCostSummary({
        today: torontoDay(new Date()),
        aiReads: ai.days,
        aiReadsSince: ai.since,
        testsMaps: testsMapsThisMonth(),
        entered: {},
      }),
    );
  } catch (err) {
    return unexpectedError(err, "GET /api/admin/costs");
  }
}
