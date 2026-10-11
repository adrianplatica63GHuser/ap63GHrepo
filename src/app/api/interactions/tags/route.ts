/**
 * GET /api/interactions/tags?prefix=…                              (Slice #38.86)
 *
 * The log form's tag suggestions (§4: „suggested tags come from recent use"): the tags already on interactions,
 * most recently used first, those starting with `prefix` when it is given. Only interactions' own tags — never the
 * archive's tags of Administrare › Etichete.
 */
import type { NextRequest } from "next/server";
import { z } from "zod/v4";
import { unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { interactionTagSuggestions } from "@/lib/interactions/queries";
import { TAG_MAX } from "@/lib/interactions/model";

const qs = z.object({ prefix: z.string().trim().max(TAG_MAX).optional() }).strict();

export async function GET(request: NextRequest): Promise<Response> {
  const parsed = qs.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
  if (!parsed.success) return zodErrorToResponse(parsed.error);
  try {
    return Response.json({ tags: await interactionTagSuggestions(parsed.data.prefix || undefined) });
  } catch (err) {
    return unexpectedError(err, "GET /api/interactions/tags");
  }
}
