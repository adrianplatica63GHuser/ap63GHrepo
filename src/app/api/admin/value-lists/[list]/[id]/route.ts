/**
 * /api/admin/value-lists/[list]/[id]
 *
 * PUT    — full-replace update of a single row
 * DELETE — hard delete (lookup rows have no soft-delete). True again as of
 *          Slice #29.04: #19.30 had made deleteValue set deleted_at while
 *          this line went on claiming otherwise. The row goes and its key is
 *          free for immediate reuse.
 *
 *          UNGUARDED until Slice #29.05, and the failure modes differ by
 *          list. document-types is refused by Postgres (document.
 *          document_type_id is NOT NULL with no onDelete); every other list
 *          either blanks the referencing column or cascades rows away.
 */

import type { NextRequest } from "next/server";
import {
  dbErrorToResponse,
  unexpectedError,
  zodErrorToResponse,
} from "@/lib/api/errors";
import { isValidListKey } from "@/lib/admin/value-lists/config";
import { updateValue, deleteValue } from "@/lib/admin/value-lists/queries";
import { LIST_UPDATE_SCHEMAS } from "@/lib/admin/value-lists/validation";

type Ctx = { params: Promise<{ list: string; id: string }> };

export async function PUT(
  request: NextRequest,
  ctx: Ctx,
): Promise<Response> {
  const { list, id } = await ctx.params;

  if (!isValidListKey(list)) {
    return Response.json({ error: "Unknown list" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Slice #26.12: the UPDATE schemas, not the create ones. They differ for
  // document-types alone, where `origin` is write-once — see
  // documentTypeUpdateSchema for what a shared schema would have done to a
  // rename.
  const parsed = LIST_UPDATE_SCHEMAS[list].safeParse(body);
  if (!parsed.success) {
    return zodErrorToResponse(parsed.error);
  }

  try {
    const row = await updateValue(list, id, parsed.data);
    if (!row) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json(row);
  } catch (err) {
    return unexpectedError(err, `PUT /api/admin/value-lists/${list}/${id}`);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { list, id } = await ctx.params;

  if (!isValidListKey(list)) {
    return Response.json({ error: "Unknown list" }, { status: 404 });
  }

  try {
    const ok = await deleteValue(list, id);
    if (!ok) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return new Response(null, { status: 204 });
  } catch (err) {
    // Fixed in passing (Slice #29.04): this route never called
    // dbErrorToResponse, so a genuine foreign-key refusal — which only
    // becomes possible now that the delete is real — surfaced as a bare 500.
    // It is now a 400 carrying the constraint name.
    //
    // BE CLEAR ABOUT WHAT THAT IS AND IS NOT. It is a correct status code and
    // a machine-readable body. It is NOT a message for a human, and the
    // dialog does not show it: value-list-modal.tsx throws on any non-204,
    // discards the body, and its delete mutation has no onError — so from the
    // user's side the confirm dialog still just sits there. This line moves
    // the failure from "500 with nothing in it" to "400 with something in
    // it", and nothing more.
    //
    // Telling the user WHICH documents hold the type, in Romanian, and giving
    // them something to do about it, is Slice #29.05 by name — including the
    // client-side half. Do not read this line as that conversation having
    // happened.
    const mapped = dbErrorToResponse(err);
    if (mapped) return mapped;
    return unexpectedError(err, `DELETE /api/admin/value-lists/${list}/${id}`);
  }
}
