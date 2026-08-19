/**
 * /api/people/[id]
 *
 * GET    — fetch person + subtype + addresses
 * PATCH  — partial update; addresses use merge-by-kind semantics
 * DELETE — deletes the row (Slice #29.04). The subtype row, addresses,
 *          versions, junctions and the person's principal_object row all go
 *          with it; the code it held is retired, never reused. Unguarded
 *          until Slice #29.05.
 */

import type { NextRequest } from "next/server";
import {
  dbErrorToResponse,
  unexpectedError,
  zodErrorToResponse,
} from "@/lib/api/errors";
import {
  getPersonById,
  deletePerson,
  updateNaturalPerson,
} from "@/lib/persons/queries";
import { naturalPersonUpdateSchema } from "@/lib/persons/validation";
import { getCurrentUserEmail } from "@/lib/auth/current-user";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  try {
    const result = await getPersonById(id);
    if (!result) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json(result);
  } catch (err) {
    return unexpectedError(err, "GET /api/people/[id]");
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

  const parsed = naturalPersonUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorToResponse(parsed.error);
  }

  try {
    const result = await updateNaturalPerson(id, parsed.data, await getCurrentUserEmail());
    if (!result) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json(result);
  } catch (err) {
    const dbResponse = dbErrorToResponse(err);
    if (dbResponse) return dbResponse;
    return unexpectedError(err, "PATCH /api/people/[id]");
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  try {
    const ok = await deletePerson(id);
    if (!ok) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return new Response(null, { status: 204 });
  } catch (err) {
    return unexpectedError(err, "DELETE /api/people/[id]");
  }
}
