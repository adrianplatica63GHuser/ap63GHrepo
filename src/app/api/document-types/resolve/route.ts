/**
 * POST /api/document-types/resolve                             (Slice #29.06)
 *
 * The import wizard's door to the ONE writer that turns a classifier's answer
 * into a `lookup_document_type` row — `resolveClassifiedDocumentType`, which
 * `ai-interpret` calls in-process. Two callers, one function, one rule about
 * when two names are the same name.
 *
 * WHY THE WIZARD DOES NOT JUST KEEP POSTING TO THE VALUE-LISTS ROUTE
 * ------------------------------------------------------------------
 * Because the fix for the race lives in a retry across a read and a write, and
 * a browser tab is the wrong place to hold one: the user may close the dialog,
 * the laptop may sleep, and the wizard would have to re-implement the adopt
 * rule that the server already has to have. The value-lists POST stays exactly
 * where it is for the two callers that are a PERSON adding a type by hand —
 * the Reference Data form and the discovery review dialog — and this door is
 * for the machine.
 *
 * WHY IT IS NOT UNDER /api/admin
 * ------------------------------
 * Same argument the sibling `document-types/[id]/template-fields` route makes
 * about itself: this action belongs to a business user standing in the import
 * wizard, not to the Reference Data screen. It writes a lookup row all the
 * same, which is why `origin` is decided by the resolver and cannot be sent.
 *
 * ⚠️ **A resolution of `unclassified` is a 200, not a 404.** "The model had no
 * idea" is an answer, and the caller has a fallback rule of its own; an error
 * status here would put it back into the same catch that finding F1 is about.
 *
 * Auth: the middleware requires a session for everything outside /api/auth, so
 * an unauthenticated POST never reaches this handler.
 */

import type { NextRequest } from "next/server";
import { z } from "zod/v4";
import { dbErrorToResponse, unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { resolveClassifiedDocumentType } from "@/lib/documents/resolve-document-type";
import { PREFERRED_KEY_TAKEN } from "@/lib/admin/value-lists/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ⚠️ **Both fields are `nullish`, and neither is required.** The scan's own
 * result carries `typeKey` and `description` as optional values, and an answer
 * with neither is a legitimate question — it is exactly the one whose answer is
 * `unclassified`. Requiring either would turn "the model said nothing" into a
 * 400 the wizard would have to special-case back into the same answer.
 */
const bodySchema = z.object({
  typeKey: z.string().nullish(),
  label:   z.string().nullish(),
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
    const resolution = await resolveClassifiedDocumentType(parsed.data);
    return Response.json(resolution);
  } catch (err) {
    // ⚠️ **`dbErrorToResponse` first, and a 23505 reaching here means the
    // retry budget ran out** — `MAX_ATTEMPTS` rounds, each of which either
    // returned or provably removed one key collision. A 409 says that
    // truthfully; the 500 it used to be said only that something went wrong
    // inside, which is what left the wizard unable to tell a lost race from an
    // unclassifiable document. Either way `ensureDocType` reads it as `failed`
    // and the row says so, which is the point.
    const mapped = dbErrorToResponse(err);
    if (mapped) return mapped;
    // ⚠️ **The second way to exhaust the budget, and it has no Postgres code.**
    // (Slice #29.07.) `PREFERRED_KEY_TAKEN` is `createDocumentTypeRow` refusing
    // to substitute a suffixed key for a canonical one — a lost race that
    // raises no 23505, so `dbErrorToResponse` has nothing to map. Reaching here
    // means `MAX_ATTEMPTS` rounds of it, which is the same statement a 23505
    // exhaustion makes and deserves the same 409; the 500 it would otherwise be
    // says only that something went wrong inside, which is the shape finding F1
    // is about. Unreachable as far as anyone can show — each occurrence proves
    // the key is now held, so the next round key-matches — and answered anyway,
    // because "unreachable" is what the retry budget above was also called.
    if (err instanceof Error && err.message === PREFERRED_KEY_TAKEN) {
      // `{ error }` and nothing else — the shape `dbErrorToResponse`'s own
      // 409s use. A bespoke `code` here would be a field no caller reads
      // (`ensureDocType` returns `failed` on any `!res.ok` without touching the
      // body) pretending to be part of a protocol.
      return Response.json(
        { error: "Document type key was taken by a concurrent writer" },
        { status: 409 },
      );
    }
    return unexpectedError(err, "POST /api/document-types/resolve");
  }
}
