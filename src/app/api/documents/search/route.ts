/**
 * GET /api/documents/search
 * Query params: q (code/title), limit, offset
 */
import { z } from "zod/v4";
import type { NextRequest } from "next/server";
import { unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { searchDocumentAll } from "@/lib/documents/queries";

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
  try {
    const { items, total } = await searchDocumentAll(parsed.data);
    return Response.json({ items, total, limit: parsed.data.limit, offset: parsed.data.offset });
  } catch (err) {
    return unexpectedError(err, "GET /api/documents/search");
  }
}
