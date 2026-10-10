/**
 * /api/interactions                                              (Slice #38.83)
 *
 * GET  — the log of interactions: filtered by every structured field, sorted by any grid column (newest first by
 *        default), paged; `q` searches a person's name and the subject only. A parameter the query does not name —
 *        `description`, `internalNote` among them — is refused (§8.2).
 * POST — log one, by hand. A date in the future only for a SCHEDULED one (§7).
 */
import type { NextRequest } from "next/server";
import { dbErrorToResponse, unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { getCurrentUserEmail } from "@/lib/auth/current-user";
import { createInteraction, getInteraction, listInteractions } from "@/lib/interactions/queries";
import { checkWhen, interactionInputSchema, interactionListQuerySchema } from "@/lib/interactions/validation";

export async function GET(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  const parsed = interactionListQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) return zodErrorToResponse(parsed.error);
  try {
    const { items, total, needsReply, anyLogged } = await listInteractions(parsed.data);
    return Response.json({ items, total, needsReply, anyLogged, limit: parsed.data.limit, offset: parsed.data.offset });
  } catch (err) {
    return unexpectedError(err, "GET /api/interactions");
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = interactionInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorToResponse(parsed.error);
  if (checkWhen(parsed.data, new Date())) {
    return Response.json(
      { error: "A date in the future is only for a scheduled interaction", code: "future_not_scheduled" },
      { status: 400 },
    );
  }
  try {
    const id = await createInteraction(parsed.data, await getCurrentUserEmail());
    return Response.json(await getInteraction(id), { status: 201 });
  } catch (err) {
    return dbErrorToResponse(err) ?? unexpectedError(err, "POST /api/interactions");
  }
}
