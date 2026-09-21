/**
 * /api/documents/[id]/references
 */
import { z } from "zod/v4";
import type { NextRequest } from "next/server";
import { unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { listDocumentReferences, associateDocumentToDocument } from "@/lib/documents/queries";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  try { return Response.json({ items: await listDocumentReferences(id) }); }
  catch (err) { return unexpectedError(err, "GET /api/documents/[id]/references"); }
}

const bodySchema = z.object({
  documentIds:         z.array(z.string().uuid()).min(1),
  relationshipRoleId:  z.string().uuid().optional().nullable(),
});

export async function POST(request: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return zodErrorToResponse(parsed.error);
  try {
    const result = await associateDocumentToDocument(
      id,
      parsed.data.documentIds,
      parsed.data.relationshipRoleId ?? null,
    );
    /**
     * ⚠️ **A BODY WHERE THIS USED TO ANSWER 204, AND THE SILENCE WAS THE
     * DEFECT.**                                                (Slice #36.03)
     *
     * `associateDocumentToDocument` ends in `.onConflictDoNothing()` over a
     * unique index on the PAIR, so associating two documents that are already
     * associated did nothing — successfully — INCLUDING when the user's reason
     * for pressing the button was to change the role. A 204 said the same thing
     * whether one row was written or none, so the screen refreshed, showed the
     * old role, and the user pressed again.
     *
     * The status stays 2xx because nothing went wrong: the archive holds what
     * the user asked for, it just held it already. What changes is that the
     * caller can now tell, and `alreadyLinked` names the role each existing
     * pair carries so the sentence on screen can say „este deja asociat, ca
     * «Titlu anterior al»" instead of „nimic nu s-a schimbat".
     *
     * This is the same shape as the defect #36.02 fixed on `person_document`
     * one table over, and it is fixed the same way.
     */
    return Response.json(result, { status: 200 });
  } catch (err) { return unexpectedError(err, "POST /api/documents/[id]/references"); }
}
