/**
 * GET /api/manual/search?q=<question>&lang=ro|en — where the user manual answers a question.   (Slice #39.45)
 *
 * „Întreabă”'s built-in layer: nothing leaves the server and nothing is paid. The answer is the five best sections
 * (src/lib/manual/search.ts), each with its number, title, chapter, the sentences that match — the matched words
 * marked — and its address in „Manual de utilizare”. A question nothing matches answers `{ results: [] }`.
 */
import type { NextRequest } from "next/server";
import { z } from "zod/v4";
import { getCurrentUser } from "@/lib/auth/current-user";
import { unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { QUESTION_MAX } from "@/lib/manual/ask";
import { manualHref } from "@/lib/manual/manual";
import { searchManual } from "@/lib/manual/search";
import { manualIndex } from "@/lib/manual/search-index";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().trim().min(1).max(QUESTION_MAX),
  lang: z.enum(["ro", "en"]),
});

export async function GET(request: NextRequest): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) return zodErrorToResponse(parsed.error);
    const { q, lang } = parsed.data;
    const results = searchManual(manualIndex(lang === "en" ? "en-GB" : "ro-RO"), q);
    return Response.json({ results: results.map((r) => ({ ...r, href: manualHref(r.id) })) });
  } catch (err) {
    return unexpectedError(err, "manual-search");
  }
}
