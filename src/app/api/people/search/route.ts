/**
 * GET /api/people/search
 *
 * Search persons for the associate-person and contact-person-picker flows.
 * Returns both person types by default; pass ?type=NATURAL or ?type=JUDICIAL
 * to restrict results to a single type.
 *
 * Query params:
 *   name?   — ilike filter on display_name
 *   code?   — ilike filter on code
 *   type?   — "NATURAL" | "JUDICIAL"  (omit = both)
 *   limit?  — default 50
 *   offset? — default 0
 */

import { z } from "zod/v4";
import type { NextRequest } from "next/server";
import { unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { searchPersonsAll } from "@/lib/persons/queries";

const searchQuerySchema = z.object({
  name:   z.string().optional(),
  code:   z.string().optional(),
  type:   z.enum(["NATURAL", "JUDICIAL"]).optional(),
  limit:  z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  const parsed = searchQuerySchema.safeParse({
    name:   url.searchParams.get("name")   ?? undefined,
    code:   url.searchParams.get("code")   ?? undefined,
    type:   url.searchParams.get("type")   ?? undefined,
    limit:  url.searchParams.get("limit")  ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });

  if (!parsed.success) {
    return zodErrorToResponse(parsed.error);
  }

  try {
    const { items, total } = await searchPersonsAll(parsed.data);
    return Response.json({
      items,
      total,
      limit:  parsed.data.limit,
      offset: parsed.data.offset,
    });
  } catch (err) {
    return unexpectedError(err, "GET /api/people/search");
  }
}
