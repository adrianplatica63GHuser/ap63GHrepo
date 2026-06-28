/**
 * /api/groups
 *
 * GET  — list all groups (most-recent first) with live member counts
 * POST — create a group (system-assigned code + target type + description)
 */

import type { NextRequest } from "next/server";
import {
  dbErrorToResponse,
  unexpectedError,
  zodErrorToResponse,
} from "@/lib/api/errors";
import { createGroup, listGroups } from "@/lib/groups/queries";
import { groupCreateSchema } from "@/lib/groups/validation";

export async function GET(): Promise<Response> {
  try {
    const items = await listGroups();
    return Response.json({ items });
  } catch (err) {
    return unexpectedError(err, "GET /api/groups");
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = groupCreateSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorToResponse(parsed.error);
  }

  try {
    const result = await createGroup(parsed.data);
    return Response.json(result, { status: 201 });
  } catch (err) {
    const dbResponse = dbErrorToResponse(err);
    if (dbResponse) return dbResponse;
    return unexpectedError(err, "POST /api/groups");
  }
}
