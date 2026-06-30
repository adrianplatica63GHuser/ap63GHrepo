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
import { groupCreateSchema, type GroupTargetType } from "@/lib/groups/validation";

const VALID_TARGET_TYPES = new Set<string>([
  "PROPERTY",
  "PHYSICAL_PERSON",
  "JUDICIAL_PERSON",
  "DOCUMENT",
]);

export async function GET(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  // Optional ?targetType=PROPERTY filter for the list-page Groups dropdowns.
  const rawType = url.searchParams.get("targetType") ?? undefined;
  const targetType: GroupTargetType | undefined =
    rawType && VALID_TARGET_TYPES.has(rawType)
      ? (rawType as GroupTargetType)
      : undefined;
  try {
    const items = await listGroups(targetType);
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
