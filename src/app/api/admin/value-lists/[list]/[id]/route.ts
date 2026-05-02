/**
 * /api/admin/value-lists/[list]/[id]
 *
 * PUT    — full-replace update of a single row
 * DELETE — hard delete (lookup rows have no soft-delete)
 */

import type { NextRequest } from "next/server";
import {
  unexpectedError,
  zodErrorToResponse,
} from "@/lib/api/errors";
import { isValidListKey } from "@/lib/admin/value-lists/config";
import { updateValue, deleteValue } from "@/lib/admin/value-lists/queries";
import { LIST_SCHEMAS } from "@/lib/admin/value-lists/validation";

type Ctx = { params: Promise<{ list: string; id: string }> };

export async function PUT(
  request: NextRequest,
  ctx: Ctx,
): Promise<Response> {
  const { list, id } = await ctx.params;

  if (!isValidListKey(list)) {
    return Response.json({ error: "Unknown list" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = LIST_SCHEMAS[list].safeParse(body);
  if (!parsed.success) {
    return zodErrorToResponse(parsed.error);
  }

  try {
    const row = await updateValue(list, id, parsed.data);
    if (!row) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json(row);
  } catch (err) {
    return unexpectedError(err, `PUT /api/admin/value-lists/${list}/${id}`);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { list, id } = await ctx.params;

  if (!isValidListKey(list)) {
    return Response.json({ error: "Unknown list" }, { status: 404 });
  }

  try {
    const ok = await deleteValue(list, id);
    if (!ok) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return new Response(null, { status: 204 });
  } catch (err) {
    return unexpectedError(err, `DELETE /api/admin/value-lists/${list}/${id}`);
  }
}
