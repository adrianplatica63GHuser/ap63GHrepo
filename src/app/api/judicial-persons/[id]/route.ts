/**
 * /api/judicial-persons/[id]
 *
 * GET    — fetch person + judicial subtype + addresses
 * PATCH  — partial update; addresses use merge-by-kind semantics
 * DELETE — soft delete (sets deleted_at on the parent person row)
 */

import type { NextRequest } from "next/server";
import {
  dbErrorToResponse,
  unexpectedError,
  zodErrorToResponse,
} from "@/lib/api/errors";
import {
  getJudicialPersonById,
  updateJudicialPerson,
} from "@/lib/judicial-persons/queries";
import { judicialPersonUpdateSchema } from "@/lib/judicial-persons/validation";
// softDeletePerson is type-agnostic — it lives in the natural-person module
// only because that was the first subtype shipped.
import { softDeletePerson } from "@/lib/persons/queries";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  try {
    const result = await getJudicialPersonById(id);
    if (!result) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json(result);
  } catch (err) {
    return unexpectedError(err, "GET /api/judicial-persons/[id]");
  }
}

export async function PATCH(
  request: NextRequest,
  ctx: Ctx,
): Promise<Response> {
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = judicialPersonUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorToResponse(parsed.error);
  }

  try {
    const result = await updateJudicialPerson(id, parsed.data);
    if (!result) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json(result);
  } catch (err) {
    const dbResponse = dbErrorToResponse(err);
    if (dbResponse) return dbResponse;
    return unexpectedError(err, "PATCH /api/judicial-persons/[id]");
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  try {
    const ok = await softDeletePerson(id);
    if (!ok) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return new Response(null, { status: 204 });
  } catch (err) {
    return unexpectedError(err, "DELETE /api/judicial-persons/[id]");
  }
}
