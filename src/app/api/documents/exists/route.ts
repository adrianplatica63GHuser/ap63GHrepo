/**
 * POST /api/documents/exists   (Slice #29.11)
 *
 * "Do these documents still exist?" — asked once, for a whole saved import
 * report, before the wizard offers to resume it.
 *
 * ⚠️ **WHY THIS ROUTE EXISTS AT ALL.** A finished import auto-saves its report
 * to localStorage, and the report holds a document id per row and nothing more
 * (`src/lib/import/session.ts`). Nothing checked those ids against the archive,
 * so after #29.04 gave Adrian a way to empty the database — which he now does
 * deliberately and often — the wizard went on offering "Reia ultimul import"
 * over a list of links to documents that no longer existed. The resumed view is
 * read-only by design (File System Access handles cannot be serialised), so
 * validating the ids is the only lever there is.
 *
 * ⚠️ **A POST THAT WRITES NOTHING, and it has to be a POST**, for the same
 * reason `POST /api/admin/import/preexisting` is one: the question is a list,
 * and a list is a body. Nothing here or under it opens a transaction or touches
 * a table other than by reading.
 *
 * ⚠️ **NO PARTIAL ANSWER.** Either every id was looked up or the request
 * failed. A response that silently covered a subset would let the wizard mark
 * the rows it did not ask about as present — the confident-output failure this
 * codebase records after #26.00, in a screen whose whole job is to stop
 * claiming something that is no longer true.
 *
 * Session-only, like the routes it sits beside: the answer is a subset of ids
 * the caller already holds, and it carries no title, no code and no content.
 *
 * Body:   { ids: unknown[] }       — 1–5 000 ids; anything not uuid-shaped is
 *                                   dropped rather than refused, see below
 * 200:    { existing: string[] }   — the subset that still exists
 * 400:    validation error
 * 500:    unexpected server error
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // a cached "it still exists" is the whole bug

import type { NextRequest } from "next/server";
import { z } from "zod/v4";

import { dbErrorToResponse, unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { existingDocumentIds } from "@/lib/documents/queries";

/**
 * A ceiling, not an expectation. Adrian's archive walks to roughly 760 files,
 * so a saved report cannot approach this; it is here because the body is the
 * one place a client hands the server an unbounded amount of work. Refused
 * loudly rather than truncated: a truncated lookup answers "gone" for every id
 * it dropped, and the screen behind this would then tell the user their whole
 * report is stale.
 */
const MAX_IDS = 5000;

/**
 * ⚠️ **THE IDS ARE FILTERED HERE, NOT VALIDATED, AND AN ADVERSARIAL ROUND MADE
 * THAT CHANGE.** The first version wrote `z.array(z.string().uuid())`, which
 * refuses the whole body if a SINGLE id is not uuid-shaped — and a saved report
 * is client-held localStorage that can carry anything an older build wrote. One
 * stale row would then 400 the request, and the screen behind this renders a
 * 400 as "we could not check any of this": a report with one dead link would be
 * reported as a report nobody could vouch for at all.
 *
 * It also removed a second definition of "uuid-shaped". The client used to
 * filter with its own regex before sending, and zod v4's `.uuid()` is
 * RFC-strict about the version and variant nibbles where an ordinary hex regex
 * is not — so the two disagreed about ids of exactly the shape seed and
 * fixture data uses, and the disagreement produced the 400 the client's filter
 * existed to prevent. There is now one test, on this side, and the client sends
 * what it has.
 *
 * An id that does not match is simply absent from `existing`, which the caller
 * already reads as "gone" — and a link to it is dead whatever the archive
 * holds, because `document.id` is a `uuid` column.
 *
 * Loose on purpose (any hex in the right shape) rather than RFC-strict: the
 * question is only "can this be compared against a uuid column without
 * Postgres raising `invalid input syntax`", and answering it narrowly would put
 * a real row's id on the wrong side of the line.
 */
const UUID_SHAPED = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const bodySchema = z.object({
  /**
   * ⚠️ **NOTHING ABOUT AN INDIVIDUAL ID IS VALIDATED HERE, and a second
   * adversarial round finished the job the first one started.** The round-one
   * fix dropped the `.uuid()` but kept a `.min(1).max(200)` per element — which
   * still refuses the WHOLE body over one long string in localStorage, and the
   * client renders any 400 as "we could not check any of this". The element
   * test is `UUID_SHAPED`'s alone, below, and it drops rather than refuses; a
   * uuid is 36 characters, so the shape test is its own length bound.
   *
   * `unknown` rather than `string`, because a non-string element must be
   * dropped for the same reason a mis-shaped one is.
   */
  ids: z.array(z.unknown()).min(1).max(MAX_IDS),
});

export async function POST(request: NextRequest): Promise<Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return zodErrorToResponse(parsed.error);

  const ids = parsed.data.ids.filter(
    (id): id is string => typeof id === "string" && UUID_SHAPED.test(id),
  );
  // Answered without a query rather than handing Postgres an empty `IN ()`.
  // `existing: []` is the honest answer: none of what was asked about is there.
  if (ids.length === 0) return Response.json({ existing: [] }, { status: 200 });

  try {
    const existing = await existingDocumentIds(ids);
    return Response.json({ existing }, { status: 200 });
  } catch (err) {
    const dbResponse = dbErrorToResponse(err);
    if (dbResponse) return dbResponse;
    return unexpectedError(err, "POST /api/documents/exists");
  }
}
