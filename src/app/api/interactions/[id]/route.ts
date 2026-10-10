/**
 * /api/interactions/[id]                                         (Slice #38.83)
 *
 * GET    — one interaction, whole: its documents (links), its tags, its audit line.
 * PUT    — change it. The body carries the `expectedUpdatedAt` it read: a row changed since answers 409 and is not
 *          overwritten (§7) — „This record was updated by someone else".
 * DELETE — remove it, its links and its tags; the documents themselves stay (they were only linked).
 */
import type { NextRequest } from "next/server";
import { dbErrorToResponse, unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { getCurrentUserEmail } from "@/lib/auth/current-user";
import { deleteInteraction, getInteraction, updateInteraction } from "@/lib/interactions/queries";
import { checkWhen, interactionUpdateSchema } from "@/lib/interactions/validation";

type Ctx = { params: Promise<{ id: string }> };

const NOT_FOUND = () => Response.json({ error: "Interaction not found" }, { status: 404 });
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  if (!isUuid(id)) return NOT_FOUND();
  try {
    const row = await getInteraction(id);
    return row ? Response.json(row) : NOT_FOUND();
  } catch (err) {
    return unexpectedError(err, "GET /api/interactions/[id]");
  }
}

export async function PUT(request: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  if (!isUuid(id)) return NOT_FOUND();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = interactionUpdateSchema.safeParse(body);
  if (!parsed.success) return zodErrorToResponse(parsed.error);
  if (checkWhen(parsed.data, new Date())) {
    return Response.json(
      { error: "A date in the future is only for a scheduled interaction", code: "future_not_scheduled" },
      { status: 400 },
    );
  }
  try {
    const outcome = await updateInteraction(id, parsed.data, await getCurrentUserEmail());
    if (outcome === "not_found") return NOT_FOUND();
    if (outcome === "conflict") {
      return Response.json(
        { error: "This record was updated by someone else", code: "stale_interaction", current: await getInteraction(id) },
        { status: 409 },
      );
    }
    return Response.json(await getInteraction(id));
  } catch (err) {
    return dbErrorToResponse(err) ?? unexpectedError(err, "PUT /api/interactions/[id]");
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  if (!isUuid(id)) return NOT_FOUND();
  try {
    return (await deleteInteraction(id)) ? new Response(null, { status: 204 }) : NOT_FOUND();
  } catch (err) {
    return unexpectedError(err, "DELETE /api/interactions/[id]");
  }
}
