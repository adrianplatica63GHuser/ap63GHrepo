/**
 * POST /api/people/batch-delete
 *
 * Deletes a list of people outright (Slice #29.04).
 * Covers both Natural and Judicial persons — both list views share the
 * `person` table.
 * Everything hanging off each row cascades — including its version history —
 * and its `principal_object` row goes with it, so the code it held is retired
 * rather than reused. Ids that match nothing are simply not counted.
 *
 * Delegates to `deletePersons` so this route and DELETE /api/people/[id]
 * are literally the same delete.
 * Two implementations of one delete is how the Property pair drifted apart
 * before this slice; there is now one.
 *
 * Body:   { ids: string[] }   — array of person UUIDs, 1–1 000 items
 * 200:    { deleted: number } — count of rows actually deleted
 * 400:    validation error
 * 500:    unexpected server error
 */

import type { NextRequest } from "next/server";
import { z } from "zod/v4";
import { deletePersons } from "@/lib/persons/queries";
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
    const deleted = await deletePersons(ids);
    return Response.json({ deleted });
  } catch (err) {
    return unexpectedError(err, "POST /api/people/batch-delete");
  }
}
