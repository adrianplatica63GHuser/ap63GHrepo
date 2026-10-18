/**
 * GET /api/calculation/persons?q=…   (2026-10-18)
 *
 * „Calcul drum lateral"'s owner search: natural and juridical persons by name, code, CNP, CUI or nickname — every
 * word typed, in any order, with or without diacritics (search-words.ts). Until 2026-10-18 the screen used
 * /api/people/search, which matched the text whole against the display name only, so a code or a surname typed first
 * found nobody.
 *
 * Answers 200 { items: { id, code, type, displayName, isDeceased }[] } — at most `limit` (default 10): an exact code
 * first, then by name.
 */

import { z } from "zod/v4";
import type { NextRequest } from "next/server";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { judicialPerson, naturalPerson, person } from "@/db/schema";
import { unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { requireFullAccess } from "@/lib/auth/current-role";
import { allWordsIn, foldSearch, searchWords } from "@/lib/calculation/search-words";

const qs = z.object({
  q:     z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export async function GET(request: NextRequest): Promise<Response> {
  const denied = await requireFullAccess();
  if (denied) return denied;

  const url = new URL(request.url);
  const parsed = qs.safeParse({ q: url.searchParams.get("q") ?? undefined, limit: url.searchParams.get("limit") ?? undefined });
  if (!parsed.success) return zodErrorToResponse(parsed.error);
  const words = searchWords(parsed.data.q);
  if (words.length === 0) return Response.json({ items: [] });

  try {
    const items = await db
      .select({
        id:          person.id,
        code:        person.code,
        type:        person.type,
        displayName: person.displayName,
        isDeceased:  sql<boolean>`coalesce(${naturalPerson.isDeceased}, false)`,
      })
      .from(person)
      .leftJoin(naturalPerson, eq(naturalPerson.personId, person.id))
      .leftJoin(judicialPerson, eq(judicialPerson.personId, person.id))
      .where(allWordsIn([person.displayName, person.code, naturalPerson.cnp, naturalPerson.nickname, judicialPerson.cuiNumber, judicialPerson.nickname], words))
      .orderBy(sql`(lower(${person.code}) = ${foldSearch(parsed.data.q)}) DESC`, asc(person.displayName), asc(person.code))
      .limit(parsed.data.limit);
    return Response.json({ items });
  } catch (err) {
    return unexpectedError(err, "GET /api/calculation/persons");
  }
}
