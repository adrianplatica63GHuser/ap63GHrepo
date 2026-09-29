/**
 * /api/properties/[id]
 *
 * GET    — fetch property + address + corners
 * PATCH  — partial update; corners and address use replace-all semantics
 * DELETE — deletes the row (Slice #29.04). Address, corners, versions,
 *          junctions and the property's principal_object row all go with it,
 *          and the corner-source claim is released by the cascade so the
 *          source document can be re-run. Unguarded until Slice #29.05.
 */

import type { NextRequest } from "next/server";
import {
  dbErrorToResponse,
  unexpectedError,
  zodErrorToResponse,
} from "@/lib/api/errors";
import {
  getPropertyById,
  deleteProperty,
  updateProperty,
} from "@/lib/properties/queries";
import { propertyUpdateSchema } from "@/lib/properties/validation";
import { getCurrentUserEmail } from "@/lib/auth/current-user";
import { StaleVersionError, splitBaseVersion, staleVersionResponse } from "@/lib/versioning/base-version";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  try {
    const result = await getPropertyById(id);
    if (!result) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json(result);
  } catch (err) {
    return unexpectedError(err, "GET /api/properties/[id]");
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

  // Slice #37.21: the version the form was loaded at travels beside the fields
  // and is checked inside the save's transaction; the entity's schema never sees it.
  const split = splitBaseVersion(body);
  if (!split.ok) {
    return Response.json({ error: "baseVersion must be a version number" }, { status: 400 });
  }
  const parsed = propertyUpdateSchema.safeParse(split.rest);
  if (!parsed.success) {
    return zodErrorToResponse(parsed.error);
  }

  try {
    const result = await updateProperty(id, parsed.data, await getCurrentUserEmail(), split.baseVersion);
    if (!result) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json(result);
  } catch (err) {
    if (err instanceof StaleVersionError) return staleVersionResponse(err);
    const dbResponse = dbErrorToResponse(err);
    if (dbResponse) return dbResponse;
    return unexpectedError(err, "PATCH /api/properties/[id]");
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  try {
    const ok = await deleteProperty(id);
    if (!ok) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return new Response(null, { status: 204 });
  } catch (err) {
    return unexpectedError(err, "DELETE /api/properties/[id]");
  }
}
