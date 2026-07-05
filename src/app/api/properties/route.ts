/**
 * /api/properties
 *
 * GET  — list with search + pagination
 * POST — create a Property (with optional address + corners)
 */

import type { NextRequest } from "next/server";
import {
  dbErrorToResponse,
  unexpectedError,
  zodErrorToResponse,
} from "@/lib/api/errors";
import { createProperty, listProperties } from "@/lib/properties/queries";
import {
  propertyCreateSchema,
  propertyListQuerySchema,
} from "@/lib/properties/validation";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  // Parse ?groupCodes=PROP-AA,PROP-AB (comma-separated).
  // Key absent → undefined (no group filter). Key present but empty → [] (no-group only).
  const gcRaw = url.searchParams.get("groupCodes");
  const groupCodes: string[] | undefined =
    gcRaw === null
      ? undefined
      : gcRaw === ""
      ? []
      : gcRaw.split(",").filter(Boolean);

  // Parse ?includeUngrouped=false (only relevant when groupCodes is non-empty).
  // Absent or "true" → true (default: include ungrouped). "false" → false.
  const iuRaw = url.searchParams.get("includeUngrouped");
  const includeUngrouped: boolean | undefined =
    iuRaw === null ? undefined : iuRaw !== "false";

  const parsed = propertyListQuerySchema.safeParse({
    q:               url.searchParams.get("q")      ?? undefined,
    limit:           url.searchParams.get("limit")  ?? undefined,
    offset:          url.searchParams.get("offset") ?? undefined,
    groupCodes,
    includeUngrouped,
  });

  if (!parsed.success) {
    return zodErrorToResponse(parsed.error);
  }

  try {
    const { items, total } = await listProperties(parsed.data);
    return Response.json({
      items,
      total,
      limit:  parsed.data.limit,
      offset: parsed.data.offset,
    });
  } catch (err) {
    return unexpectedError(err, "GET /api/properties");
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = propertyCreateSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorToResponse(parsed.error);
  }

  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    const result = await createProperty(parsed.data, user?.email ?? null);
    return Response.json(result, { status: 201 });
  } catch (err) {
    const dbResponse = dbErrorToResponse(err);
    if (dbResponse) return dbResponse;
    return unexpectedError(err, "POST /api/properties");
  }
}
