/**
 * GET /api/documents/[id]/corner-source        (Slice #23.06.Import)
 *
 * "Did this document's coordinate file already produce a Property, and if so
 * which one?"
 *
 * Read-only. Writes nothing, creates nothing, and is safe to call on every
 * render of a document detail page.
 *
 * WHY IT EXISTS
 *
 * process-panel.tsx used to answer that question by fetching
 * /api/metadata/{principalObjectId} and testing
 * `provenance === "COORDINATE_FILE"`. Two things were wrong with that:
 *
 *   1. It was WRONG for the import wizard's documents. classifyFileSource maps
 *      a file by extension alone and "txt" lives in DOCUMENT_EXTENSIONS, so a
 *      wizard-imported coordinate .txt is stamped DOC_FILE. The panel read
 *      that as "not processed", offered the button, and produced a second
 *      Property with identical coordinates.
 *   2. Even when it was right, it could only say THAT the document had been
 *      processed, never WHICH Property came out — so the done state was a grey
 *      disabled button and a sentence telling the user to go and look.
 *
 * The panel now asks this route instead. A non-null answer means processed,
 * and it carries the Property to link to.
 *
 * Response:
 *   200 { link: { propertyId, propertyCode, propertyNickname, createdAt,
 *                 createdBy } }   — this document is already a corner source
 *   200 { link: null }            — not yet; the panel may offer to process
 *   401 unauthenticated
 *   404 document not found (or soft-deleted)
 *   500 unexpected
 *
 *
 * POST /api/documents/[id]/corner-source        (Slice #23.06.Import)
 *
 * Claim this document as the corner source of `{ propertyId }`.
 *
 * This is the endpoint the IMPORT WIZARD writes through — both the bulk import
 * loop (the coordinate file that supplied the run's Property at the property
 * step). It also served CoordinatePropertyDialog, the "Aplică pe proprietate"
 * row action, until #26.10 deleted that dialog — the result screen describes
 * what the property step did instead of offering to redo it.
 * The Process route does not use it; it calls claimCornerSource directly,
 * because it needs the claim inside its own compensating-action sequence.
 *
 * The insert is ON CONFLICT DO NOTHING against UNIQUE(document_id), so this is
 * the same lock the Process route takes — there is exactly one, and whichever
 * path arrives second loses. That is the whole point of the slice: the wizard
 * and Process can no longer both produce a Property from one file.
 *
 * Request:  { propertyId: string }
 * Response:
 *   201 { link: { propertyId, propertyCode, … } }  — claimed by this call
 *   409 { error, link }                            — already claimed; `link`
 *                                                    names the winner
 *   400 malformed body / not a uuid
 *   401 unauthenticated
 *   404 document or property not found (or soft-deleted)
 *   500 unexpected
 */

export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { NextResponse }     from "next/server";
import { and, eq, isNull }  from "drizzle-orm";
import { db }               from "@/db";
import { document, property } from "@/db/schema";
import { z }               from "zod/v4";
import {
  claimCornerSource,
  getCornerSourceForDocument,
} from "@/lib/properties/corner-source";
import { getCurrentUser }   from "@/lib/auth/current-user";
import { unexpectedError }  from "@/lib/api/errors";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Zod v4 — note `z.string().uuid()` is STRICT here (it validates the version
 * and variant nibbles), which is fine: every id in this app is
 * gen_random_uuid (v4). Test fixtures need real-shaped v4 uuids.
 */
const ClaimBody = z.object({
  propertyId: z.string().uuid(),
});

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id: documentId } = await ctx.params;

  // getCurrentUser() honours UAT_NO_AUTH — never call supabase.auth.getUser()
  // directly here (CLAUDE.md / Slice #21.11.uat.auth).
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await db
      .select({ id: document.id })
      .from(document)
      .where(and(eq(document.id, documentId), isNull(document.deletedAt)))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const link = await getCornerSourceForDocument(documentId);
    return NextResponse.json({ link });

  } catch (err) {
    return unexpectedError(err, "GET /api/documents/[id]/corner-source");
  }
}


export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id: documentId } = await ctx.params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Same convention as every other mutating route since #21.02: the email, or
  // null. Never the opaque uuid — an id in an audit column was never useful,
  // and under UAT_NO_AUTH the synthetic identity has no email on purpose.
  const createdBy = user.email ?? null;

  try {
    const body = (await req.json().catch(() => null)) as
      | { propertyId?: unknown }
      | null;

    const parsed = ClaimBody.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body: propertyId (uuid) is required" },
        { status: 400 },
      );
    }
    const { propertyId } = parsed.data;

    // Both ends must exist and be live. Without this a typo'd propertyId would
    // surface as a raw FK violation 500 instead of a 404, and — worse — a
    // soft-deleted Property would be claimable, immediately locking the
    // document to something the user can never open.
    const [docRows, propRows] = await Promise.all([
      db
        .select({ id: document.id })
        .from(document)
        .where(and(eq(document.id, documentId), isNull(document.deletedAt)))
        .limit(1),
      db
        .select({ id: property.id })
        .from(property)
        .where(and(eq(property.id, propertyId), isNull(property.deletedAt)))
        .limit(1),
    ]);

    if (docRows.length === 0) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    if (propRows.length === 0) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    const claimed = await claimCornerSource(documentId, propertyId, createdBy);
    const link    = await getCornerSourceForDocument(documentId);

    if (!claimed) {
      // Lost the race, or this document was already spent. Return the winner
      // so the caller can say WHICH Property owns this file rather than just
      // "already used".
      //
      // Note the benign case: the winner may BE this propertyId, if the same
      // path ran twice (a double-click, a retried request). The caller decides
      // whether that is an error or a no-op; the server does not guess.
      return NextResponse.json(
        { error: "Document is already a corner source", link },
        { status: 409 },
      );
    }

    return NextResponse.json({ link }, { status: 201 });

  } catch (err) {
    return unexpectedError(err, "POST /api/documents/[id]/corner-source");
  }
}
