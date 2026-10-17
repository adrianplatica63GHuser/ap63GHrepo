/**
 * /api/documents
 *
 * GET  — list with search + type filter + pagination
 * POST — create a Document record
 */

import type { NextRequest } from "next/server";
import {
  dbErrorToResponse,
  unexpectedError,
  zodErrorToResponse,
} from "@/lib/api/errors";
import { createDocument, listDocument } from "@/lib/documents/queries";
import { documentCreateSchema } from "@/lib/documents/validation";
import { provenanceFromRequestBody } from "@/lib/metadata/provenance";
import { setInitialProvenance } from "@/lib/metadata/queries";
import { getCurrentUserEmail } from "@/lib/auth/current-user";
import { getTimeFrameSettings } from "@/lib/time-frames/queries";
import { parseDocumentListRequest } from "@/lib/documents/list-request";
import { getDays } from "@/lib/time-frames/config";

export async function GET(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  // Slice #39.63: read by `parseDocumentListRequest`, which the institution checklist's counts share.
  const parsed = parseDocumentListRequest(url);
  if (!parsed.ok) {
    return zodErrorToResponse(parsed.error!);
  }

  try {
    const tf = await getTimeFrameSettings();
    const expiringSoonDays = getDays(tf, "documents_expiring_soon");
    const { items, total } = await listDocument(parsed.query, expiringSoonDays);
    return Response.json({
      items,
      total,
      limit:  parsed.query.limit,
      offset: parsed.query.offset,
    });
  } catch (err) {
    return unexpectedError(err, "GET /api/documents");
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = documentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorToResponse(parsed.error);
  }

  try {
    // Resolved once and reused below — setInitialProvenance needs the same
    // identity, and getCurrentUserEmail() hits the Supabase session each call.
    const updatedBy = await getCurrentUserEmail();
    const result = await createDocument(parsed.data, updatedBy);

    // Slice #21.07.Import — record how this entity entered the system.
    // Import paths pass the value their provenance rule inferred (or the one
    // the user picked when no rule applies); the "Add new" forms pass MANUAL.
    // Absent/unknown -> no provenance recorded, as before this slice.
    // ⚠️ **`.catch()`, and it is the CALL SITE's guarantee, not the callee's**
    //                                                        (Slice #34.07)
    // The entity is committed by the time this line runs, so a rejection here
    // cannot undo it — it can only turn a create that SUCCEEDED into a 500,
    // telling the user their record was not saved when it was. Two other call
    // sites already guard it in exactly these words — `ensurePropertyForFolder`
    // in src/lib/properties/import-property.ts, and step 7.15 of
    // /api/documents/[id]/process — and these four had the comment above
    // without the guard.
    //
    // `setInitialProvenance` does currently swallow everything its own try
    // block sees, so today this catches nothing. That is the point: "best
    // effort" is a promise this route makes to its user, and it should not
    // depend on reading another module's catch block to find out whether the
    // promise holds. Narrowing that catch — to the 23514 case its comment is
    // written about, which is the obvious future edit — would otherwise put a
    // dropped connection between a committed row and a 201.
    const provenance = provenanceFromRequestBody(body);
    if (provenance) {
      await setInitialProvenance(result.principalObjectId, provenance, updatedBy)
        .catch(() => {
          // Best-effort, as documented — never at the cost of the 201.
        });
    }
    return Response.json(result, { status: 201 });
  } catch (err) {
    const dbResponse = dbErrorToResponse(err);
    if (dbResponse) return dbResponse;
    return unexpectedError(err, "POST /api/documents");
  }
}
