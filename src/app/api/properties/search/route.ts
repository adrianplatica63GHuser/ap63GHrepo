/**
 * GET /api/properties/search
 * Query params: q (code/nickname), limit, offset
 */
import { z } from "zod/v4";
import type { NextRequest } from "next/server";
import { unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { and, count, ilike, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { property } from "@/db/schema";

const qs = z.object({
  q:      z.string().optional(),
  limit:  z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  const parsed = qs.safeParse({
    q:      url.searchParams.get("q")      ?? undefined,
    limit:  url.searchParams.get("limit")  ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });
  if (!parsed.success) return zodErrorToResponse(parsed.error);

  const { q, limit, offset } = parsed.data;
  const pat = q?.trim() ? `%${q.trim()}%` : null;

  const where = and(
    isNull(property.deletedAt),
    pat ? or(ilike(property.code, pat), ilike(property.nickname, pat)) : undefined,
  );

  try {
    const [{ value: total }] = await db.select({ value: count() }).from(property).where(where);
    const items = await db
      .select({ id: property.id, code: property.code, nickname: property.nickname })
      .from(property)
      .where(where)
      .orderBy(property.code)
      .limit(limit)
      .offset(offset);

    return Response.json({ items: items.map((r) => ({ ...r, label: r.nickname ?? r.code })), total, limit, offset });
  } catch (err) {
    return unexpectedError(err, "GET /api/properties/search");
  }
}
