/**
 * /api/admin/value-lists/[list]
 *
 * GET  — return all rows for a given lookup table, ordered by sort_order
 * POST — insert a new row; validates body against the per-list Zod schema
 */

import type { NextRequest } from "next/server";
import {
  unexpectedError,
  zodErrorToResponse,
} from "@/lib/api/errors";
import { isValidListKey } from "@/lib/admin/value-lists/config";
import { listValues, createValue } from "@/lib/admin/value-lists/queries";
import { LIST_SCHEMAS } from "@/lib/admin/value-lists/validation";

type Ctx = { params: Promise<{ list: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { list } = await ctx.params;

  if (!isValidListKey(list)) {
    return Response.json({ error: "Unknown list" }, { status: 404 });
  }

  try {
    const rows = await listValues(list);
    return Response.json({ items: rows, total: rows.length });
  } catch (err) {
    return unexpectedError(err, `GET /api/admin/value-lists/${list}`);
  }
}

export async function POST(request: NextRequest, ctx: Ctx): Promise<Response> {
  const { list } = await ctx.params;

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
    const row = await createValue(list, parsed.data);
    return Response.json(row, { status: 201 });
  } catch (err) {
    return unexpectedError(err, `POST /api/admin/value-lists/${list}`);
  }
}
