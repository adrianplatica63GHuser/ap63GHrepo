/**
 * GET /api/documents/[id]/valid-person-roles
 *
 * Returns the person roles that are valid for this document's type,
 * drawn from the Document Persons whitelist (lookup_doc_type_person_role).
 * Returns an empty array when the document type has no associations defined.
 *
 * ⚠️ **THAT LAST SENTENCE ONLY BECAME TRUE IN SLICE #34.16, AND IT IS LEFT
 * WORD FOR WORD BECAUSE IT WAS ALWAYS THE INTENT.** Until decision D-16(b),
 * `listPersonRolesForDocument` fell back to „every role ticked for SOME
 * document type" on a type with no rows of its own, so this route answered a
 * wide list precisely where this header promised an empty one. The code moved
 * to meet the comment rather than the other way round.
 *
 * The empty answer is not silent on screen: all three callers render
 * `NoRolesForTypeNote` beside the picker. „Beside", not „instead of" — on a
 * type that has no ticks but whose rows carry a withdrawn role, the document
 * screen still shows a select holding that role, `disabled` (#34.05), and the
 * note underneath is what explains why nothing in it can be chosen.
 */
import type { NextRequest } from "next/server";
import { unexpectedError } from "@/lib/api/errors";
import { listPersonRolesForDocument } from "@/lib/documents/queries";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  try {
    return Response.json({ items: await listPersonRolesForDocument(id) });
  } catch (err) {
    return unexpectedError(err, "GET /api/documents/[id]/valid-person-roles");
  }
}
