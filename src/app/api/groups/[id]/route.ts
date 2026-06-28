/**
 * /api/groups/[id]
 *
 * GET    — group detail: fields + ordered members + (PROPERTY) candidate items
 * PATCH  — update description and/or the complete member set
 * DELETE — hard delete (cascades to members)
 */

import type { NextRequest } from "next/server";
import {
  dbErrorToResponse,
  unexpectedError,
  zodErrorToResponse,
} from "@/lib/api/errors";
import {
  GroupError,
  deleteGroup,
  getGroupDetail,
  updateGroup,
} from "@/lib/groups/queries";
import { groupUpdateSchema } from "@/lib/groups/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  try {
    const result = await getGroupDetail(id);
    if (!result) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json(result);
  } catch (err) {
    return unexpectedError(err, "GET /api/groups/[id]");
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = groupUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorToResponse(parsed.error);
  }

  try {
    const result = await updateGroup(id, parsed.data);
    if (!result) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json(result);
  } catch (err) {
    if (err instanceof GroupError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    const dbResponse = dbErrorToResponse(err);
    if (dbResponse) return dbResponse;
    return unexpectedError(err, "PATCH /api/groups/[id]");
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  try {
    const ok = await deleteGroup(id);
    if (!ok) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return new Response(null, { status: 204 });
  } catch (err) {
    return unexpectedError(err, "DELETE /api/groups/[id]");
  }
}
