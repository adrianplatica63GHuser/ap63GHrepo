/**
 * POST /api/admin/import/preexisting   (Slice #26.08)
 *
 * "Which of these does the archive already hold?" — asked once, for the whole
 * chosen folder, between the Duplication stage and Evaluation.
 *
 * The boundary and nothing else: parse, call
 * `src/lib/documents/preexisting-lookup.ts`, hand back what it found. Every
 * rule about what counts as the same document lives in
 * `src/lib/import/preexisting-check.ts`, which both sides of the comparison
 * import.
 *
 * ⚠️ **A POST THAT WRITES NOTHING, and it has to be a POST.** The question is
 * "do you have any of THESE ~760 documents", so the request body is the
 * question; a GET cannot carry it. Nothing in this route or anything under it
 * takes a transaction, opens one, or touches a table other than by reading.
 *
 * ⚠️ **NO PARTIAL ANSWER.** Either the whole folder was compared or the request
 * failed — there is deliberately no "we checked 600 of your 760 files" shape in
 * the response. The screen behind it makes a promise about what the import will
 * do with each file, and a promise over an unknown subset is the confident-
 * output failure this codebase records after #26.00. A failure surfaces as a
 * failure, the stage says so, and the user retries or continues knowing that
 * everything will be imported.
 *
 * Session-only, like `POST /api/admin/import/property` and unlike
 * `GET /api/admin/import/preflight`, which checks superuser explicitly. The
 * difference is what leaks: preflight reports infrastructure state, and this
 * returns document codes and titles that any signed-in user can already list at
 * /documents. Recorded rather than assumed, so a future reader does not read
 * the absence as an oversight.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // a cached "already in the archive" is a lie

import type { NextRequest } from "next/server";
import { z } from "zod/v4";

import { dbErrorToResponse, unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { findExistingDocuments } from "@/lib/documents/preexisting-lookup";

/**
 * Ceilings, not expectations.
 *
 * Adrian's archive walks to roughly 760 files, so 5000 entries and 2000 pages
 * leave a wide margin — and they exist because this body is the one place a
 * client can hand the server an unbounded amount of work. A folder that
 * genuinely exceeds them is refused loudly by Zod rather than being silently
 * truncated to whatever fitted: a truncated comparison answers "not in the
 * archive" for every file it dropped, which is exactly the confident-but-wrong
 * output the stage exists to avoid.
 */
const MAX_ENTRIES = 5000;
const MAX_PAGES_PER_ENTRY = 2000;

const bodySchema = z.object({
  candidates: z
    .array(
      z.object({
        path: z.string().min(1).max(4096),
        title: z.string().min(1).max(1024),
        files: z
          .array(
            z.object({
              name: z.string().min(1).max(1024),
              // A real byte count. `int()` and `nonnegative()` because the key
              // is compared against `document_page.file_size`, an integer
              // column: a float would never match anything and would do so in
              // silence.
              size: z.number().int().nonnegative(),
            }),
          )
          .min(1)
          .max(MAX_PAGES_PER_ENTRY),
      }),
    )
    .max(MAX_ENTRIES),
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

  try {
    const matches = await findExistingDocuments(parsed.data.candidates);
    return Response.json({ matches }, { status: 200 });
  } catch (err) {
    const dbResponse = dbErrorToResponse(err);
    if (dbResponse) return dbResponse;
    return unexpectedError(err, "POST /api/admin/import/preexisting");
  }
}
