/**
 * /api/stamps
 *
 * GET  — list all stamps (most-recent first) with total member counts
 * POST — create a stamp (system-assigned STMP-AAA code, shortDescription, notes)
 */

import type { NextRequest } from "next/server";
import {
  dbErrorToResponse,
  unexpectedError,
  zodErrorToResponse,
} from "@/lib/api/errors";
import { createStamp, listStamps } from "@/lib/stamps/queries";
import { stampCreateSchema } from "@/lib/stamps/validation";

export async function GET(): Promise<Response> {
  try {
    const items = await listStamps();
    return Response.json({ items });
  } catch (err) {
    return unexpectedError(err, "GET /api/stamps");
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = stampCreateSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorToResponse(parsed.error);
  }

  try {
    const result = await createStamp(parsed.data);
    return Response.json(result, { status: 201 });
  } catch (err) {
    const dbResponse = dbErrorToResponse(err);
    if (dbResponse) return dbResponse;
    return unexpectedError(err, "POST /api/stamps");
  }
}
