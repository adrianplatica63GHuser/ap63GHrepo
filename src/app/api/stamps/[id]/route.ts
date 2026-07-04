/**
 * /api/stamps/[id]
 *
 * GET    — stamp detail + members + candidates for a given ?targetType=
 *          (defaults to PHYSICAL_PERSON if omitted or invalid)
 * PATCH  — update shortDescription / notes and/or apply member changes
 * DELETE — hard delete (cascades to stamp_member)
 */

import type { NextRequest } from "next/server";
import {
  dbErrorToResponse,
  unexpectedError,
  zodErrorToResponse,
} from "@/lib/api/errors";
import {
  StampError,
  deleteStamp,
  getStampDetail,
  updateStamp,
} from "@/lib/stamps/queries";
import { stampUpdateSchema, type StampTargetType } from "@/lib/stamps/validation";

type Ctx = { params: Promise<{ id: string }> };

const VALID_TARGET_TYPES = new Set<string>([
  "PHYSICAL_PERSON",
  "JUDICIAL_PERSON",
  "PROPERTY",
  "DOCUMENT",
]);

function resolveTargetType(raw: string | null): StampTargetType {
  if (raw && VALID_TARGET_TYPES.has(raw)) return raw as StampTargetType;
  return "PHYSICAL_PERSON";
}

export async function GET(request: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const url = new URL(request.url);
  const targetType = resolveTargetType(url.searchParams.get("targetType"));

  try {
    const result = await getStampDetail(id, targetType);
    if (!result) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json(result);
  } catch (err) {
    return unexpectedError(err, "GET /api/stamps/[id]");
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

  const parsed = stampUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorToResponse(parsed.error);
  }

  try {
    const found = await updateStamp(id, parsed.data);
    if (!found) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return new Response(null, { status: 204 });
  } catch (err) {
    if (err instanceof StampError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    const dbResponse = dbErrorToResponse(err);
    if (dbResponse) return dbResponse;
    return unexpectedError(err, "PATCH /api/stamps/[id]");
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  try {
    const ok = await deleteStamp(id);
    if (!ok) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return new Response(null, { status: 204 });
  } catch (err) {
    return unexpectedError(err, "DELETE /api/stamps/[id]");
  }
}
