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
import { provenanceFromRequestBody } from "@/lib/metadata/provenance";
import { setInitialProvenance } from "@/lib/metadata/queries";
import { getCurrentUserEmail } from "@/lib/auth/current-user";

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
    q:               url.searchParams.get("q")           ?? undefined,
    limit:           url.searchParams.get("limit")        ?? undefined,
    offset:          url.searchParams.get("offset")       ?? undefined,
    groupCodes,
    includeUngrouped,
    // Slice #20.06: metadata filters.
    importance:      url.searchParams.get("importance")   ?? undefined,
    relevance:       url.searchParams.get("relevance")    ?? undefined,
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
    // Resolved once and reused below — setInitialProvenance needs the same
    // identity, and getCurrentUserEmail() hits the Supabase session each call.
    const updatedBy = await getCurrentUserEmail();
    const result = await createProperty(parsed.data, updatedBy);

    // Slice #21.07.Import — record how this entity entered the system.
    // Import paths pass the value their provenance rule inferred (or the one
    // the user picked when no rule applies); the "Add new" forms pass MANUAL.
    // Absent/unknown -> no provenance recorded, as before this slice.
    const provenance = provenanceFromRequestBody(body);
    if (provenance) {
      await setInitialProvenance(result.property.principalObjectId, provenance, updatedBy);
    }
    return Response.json(result, { status: 201 });
  } catch (err) {
    const dbResponse = dbErrorToResponse(err);
    if (dbResponse) return dbResponse;
    return unexpectedError(err, "POST /api/properties");
  }
}
