/**
 * GET /api/calculation/properties?q=…   (Slice #39.79)
 *
 * „Calcul drum lateral"'s property search: by code, nickname, cadastral number or CF (Ask first 9). Each hit says how
 * many corners the property has, so the screen can list one without four greyed out with its reason.
 *
 * Answers 200 { items: { id, code, nickname, cadastralNumber, carteFunciara, cornerCount }[] } — at most `limit`
 * (default 8), by code.
 */

import { z } from "zod/v4";
import type { NextRequest } from "next/server";
import { count, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { property, propertyCorner } from "@/db/schema";
import { unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { requireFullAccess } from "@/lib/auth/current-role";

const qs = z.object({
  q:     z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(50).default(8),
});

export async function GET(request: NextRequest): Promise<Response> {
  const denied = await requireFullAccess();
  if (denied) return denied;

  const url = new URL(request.url);
  const parsed = qs.safeParse({ q: url.searchParams.get("q") ?? undefined, limit: url.searchParams.get("limit") ?? undefined });
  if (!parsed.success) return zodErrorToResponse(parsed.error);
  const pat = `%${parsed.data.q}%`;

  try {
    const items = await db
      .select({
        id:              property.id,
        code:            property.code,
        nickname:        property.nickname,
        cadastralNumber: property.cadastralNumber,
        carteFunciara:   property.carteFunciara,
        cornerCount:     count(propertyCorner.id),
      })
      .from(property)
      .leftJoin(propertyCorner, eq(propertyCorner.propertyId, property.id))
      .where(or(ilike(property.code, pat), ilike(property.nickname, pat), ilike(property.cadastralNumber, pat), ilike(property.carteFunciara, pat)))
      .groupBy(property.id)
      .orderBy(property.code)
      .limit(parsed.data.limit);
    return Response.json({ items: items.map((i) => ({ ...i, cornerCount: Number(i.cornerCount) })) });
  } catch (err) {
    return unexpectedError(err, "GET /api/calculation/properties");
  }
}
