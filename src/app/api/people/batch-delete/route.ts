/**
 * POST /api/people/batch-delete
 *
 * Soft-deletes a list of people (sets deleted_at = now()). Covers both
 * Natural and Judicial persons — both list views share the `person` table.
 * Only affects rows that are not already deleted.
 *
 * Body:   { ids: string[] }   — array of person UUIDs, 1–1 000 items
 * 200:    { deleted: number } — count of rows actually updated
 * 400:    validation error
 * 500:    unexpected server error
 */

import type { NextRequest } from "next/server";
import { z } from "zod/v4";
import { and, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { person } from "@/db/schema";
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
    const result = await db
      .update(person)
      .set({ deletedAt: new Date() })
      .where(and(inArray(person.id, ids), isNull(person.deletedAt)))
      .returning({ id: person.id });

    return Response.json({ deleted: result.length });
  } catch (err) {
    return unexpectedError(err, "POST /api/people/batch-delete");
  }
}
