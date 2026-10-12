/**
 * /api/admin/costs                                                 (Slice #39.17)
 *
 * GET    — „Setări → Costuri": every provider's month so far, today, forecast
 *          and history, in CA$, with the amounts Adrian entered.
 * POST   — an amount entered from a tile (a bill's figure, a plan's price, a
 *          domain's year): `cost_record`, source 'entered' (migration_107).
 * DELETE — ?id=… removes one ENTERED amount, never a live or counted one.
 *
 * It calls no provider and sends no credential to the browser
 * (src/lib/costs/load.ts).
 */
import { z } from "zod/v4";
import { requireFullAccess } from "@/lib/auth/current-role";
import { unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { COST_PROVIDERS } from "@/lib/costs/catalogue";
import { aiReadsByDay, deleteEnteredAmount, enteredAmounts, insertEnteredAmount, testsMapsThisMonth } from "@/lib/costs/load";
import { buildCostSummary, torontoDay } from "@/lib/costs/summary";
import { ENTERED_CURRENCIES } from "@/lib/costs/compute";

export const dynamic = "force-dynamic";

const DAY = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const PostSchema = z
  .object({
    provider: z.enum(COST_PROVIDERS),
    periodStart: DAY,
    periodEnd: DAY,
    amount: z.number().min(0).max(1_000_000),
    currency: z.enum(ENTERED_CURRENCIES),
    cadRate: z.number().gt(0).max(100),
    note: z.string().trim().max(200).nullable().optional(),
  })
  .refine((v) => v.periodEnd >= v.periodStart, { message: "periodEnd before periodStart", path: ["periodEnd"] });

export async function GET(): Promise<Response> {
  const denied = await requireFullAccess();
  if (denied) return denied;
  try {
    const [ai, entered] = await Promise.all([aiReadsByDay(), enteredAmounts()]);
    return Response.json(
      buildCostSummary({
        today: torontoDay(new Date()),
        aiReads: ai.days,
        aiReadsSince: ai.since,
        testsMaps: testsMapsThisMonth(),
        entered,
      }),
    );
  } catch (err) {
    return unexpectedError(err, "GET /api/admin/costs");
  }
}

export async function POST(request: Request): Promise<Response> {
  const denied = await requireFullAccess();
  if (denied) return denied;
  try {
    const parsed = PostSchema.safeParse(await request.json());
    if (!parsed.success) return zodErrorToResponse(parsed.error);
    const v = parsed.data;
    const id = await insertEnteredAmount({ ...v, note: v.note ? v.note : null });
    return Response.json({ id }, { status: 201 });
  } catch (err) {
    return unexpectedError(err, "POST /api/admin/costs");
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const denied = await requireFullAccess();
  if (denied) return denied;
  try {
    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "id" }, { status: 400 });
    return (await deleteEnteredAmount(id)) ? new Response(null, { status: 204 }) : Response.json({ error: "not-found" }, { status: 404 });
  } catch (err) {
    return unexpectedError(err, "DELETE /api/admin/costs");
  }
}
