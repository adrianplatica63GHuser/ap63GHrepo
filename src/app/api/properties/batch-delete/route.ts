/**
 * POST /api/properties/batch-delete
 *
 * Deletes a list of properties outright (Slice #29.04).
 * Each property's corner-source claim is released by the cascade, which
 * frees its source document for a correct re-run.
 * Everything hanging off each row cascades — including its version history —
 * and its `principal_object` row goes with it, so the code it held is retired
 * rather than reused. Ids that match nothing are simply not counted.
 *
 * Delegates to `deleteProperties` so this route and DELETE /api/properties/[id]
 * are literally the same delete.
 * They used to be two implementations and had already drifted: this route
 * wrote `deleted_at` inline, so a batch delete never released the
 * corner-source claim that the single delete released explicitly, and the
 * source document stayed locked forever.
 *
 * Body:   { ids: string[] }   — array of property UUIDs, 1–1 000 items
 * 200:    { deleted: number } — count of rows actually deleted
 * 400:    validation error
 * 500:    unexpected server error
 */

import type { NextRequest } from "next/server";
import { z } from "zod/v4";
import { deleteProperties } from "@/lib/properties/queries";
import { unexpectedError, zodErrorToResponse } from "@/lib/api/errors";

const batchDeleteSchema = z.object({
  ids: z
    .array(z.string().uuid())
    .min(1, "At least one id is required")
    .max(1000, "Maximum 1 000 ids per request"),
});

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = batchDeleteSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorToResponse(parsed.error);
  }

  const { ids } = parsed.data;

  try {
    const deleted = await deleteProperties(ids);
    return Response.json({ deleted });
  } catch (err) {
    return unexpectedError(err, "POST /api/properties/batch-delete");
  }
}
