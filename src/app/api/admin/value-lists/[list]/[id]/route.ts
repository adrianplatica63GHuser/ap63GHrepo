/**
 * /api/admin/value-lists/[list]/[id]
 *
 * PUT    — full-replace update of a single row
 * DELETE — hard delete (lookup rows have no soft-delete). The row goes and its
 *          key is free for immediate reuse (Slice #29.04).
 *
 *          GUARDED as of Slice #29.05, and guarded in APPLICATION code for
 *          every list rather than left to the schema: of the sixteen foreign
 *          keys that reach these tables exactly one refuses a delete
 *          (document.document_type_id), ELEVEN blank the referencing column
 *          and four cascade rows away. (Nine and fourteen until Slice #29.13
 *          brought the two relationship-role lists in; the inventory lives in
 *          src/lib/admin/value-lists/dependents.ts.) A delete that anything depends on is
 *          answered with 409 and a body naming what depends on it and how
 *          many; the client turns that into a sentence and an offer to move
 *          those objects onto another value of the same list (POST ./reassign).
 */

import type { NextRequest } from "next/server";
import {
  dbErrorToResponse,
  pgErrorCode,
  pgErrorConstraint,
  unexpectedError,
  zodErrorToResponse,
} from "@/lib/api/errors";
import { isValidListKey } from "@/lib/admin/value-lists/config";
import { isUuid } from "@/lib/admin/value-lists/responses";
import { updateValue, deleteValue } from "@/lib/admin/value-lists/queries";
import { inUseResponse } from "@/lib/admin/value-lists/responses";
import { LIST_UPDATE_SCHEMAS } from "@/lib/admin/value-lists/validation";
import {
  asIdCardFormRefusal,
  idCardRefusalCode,
} from "@/lib/documents/id-card-form-guard";
import {
  asCatchAllFormRefusal,
  catchAllRefusalCode,
} from "@/lib/documents/catch-all-form-guard";
import {
  asDocumentTypeNameTaken,
  DOCUMENT_TYPE_NAME_TAKEN_CODE,
  DOCUMENT_TYPE_NAME_UNIQUE_INDEX,
} from "@/lib/documents/document-type-name-guard";

type Ctx = { params: Promise<{ list: string; id: string }> };

export async function PUT(
  request: NextRequest,
  ctx: Ctx,
): Promise<Response> {
  const { list, id } = await ctx.params;

  if (!isValidListKey(list)) {
    return Response.json({ error: "Unknown list" }, { status: 404 });
  }
  // A path segment that is not a uuid reaches Postgres as one and comes back
  // as 22P02 — which `dbErrorToResponse` does not know, so it surfaced as a
  // 500. "No such row" is what it means.
  if (!isUuid(id)) {
    return Response.json({ error: "Not found" }, { status: 404 });
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
    // ⚠️ **The identity-card refusal, ahead of everything else in this catch.**
    // (Slice #32.07.) It is a NAMED 400 rather than a 500, and it carries a
    // `code` the Reference Data screens turn into a Romanian sentence — see
    // `@/lib/documents/id-card-form-guard`. It is thrown from the query layer
    // rather than checked here so that a direct caller of `updateValue` /
    // `createValue` is bound by it too; the route's job is only to say it.
    //
    // ⚠️ **A 400, and that is the one status this door's client reads as its
    // own form's rejection** — `throwRequestFailed(res, true)` maps every 400
    // to "a required field is missing or wrong". #32.07 makes that mapping
    // consult the body's `code` first, so this refusal reaches its own
    // sentence rather than that one. A 409 would have avoided the collision
    // and would have been wrong: nothing is racing, and nothing about
    // retrying helps.
    const idCard = asIdCardFormRefusal(err);
    if (idCard !== null) {
      return Response.json(
        {
          error:
            "A document type that is an identity card may not hold a form; its data is " +
            "captured by the import's identity-card step as Person records.",
          code: idCardRefusalCode(idCard),
        },
        { status: 400 },
      );
    }
    // ⚠️ **AND THE SAME FOR THE CATCH-ALL.**                   (Slice #32.19.)
    // Finding S-02: DocTypeEngine refused to give the unclassified catch-all a
    // form and this door did not, so the Form button on the NECLASIFICAT row
    // saved one. Same shape as the refusal above, deliberately — same query
    // layer, same named 400, same `code`-first mapping on the client — because
    // two refusals arriving as two different kinds of failure is how a screen
    // ends up handling one of them and rendering the other in English.
    const catchAll = asCatchAllFormRefusal(err);
    if (catchAll !== null) {
      return Response.json(
        {
          error:
            "The catch-all document type may not hold a form; it holds documents whose " +
            "type is wrong, not documents whose type is unfinished.",
          code: catchAllRefusalCode(catchAll),
        },
        { status: 400 },
      );
    }
    // ⚠️ **TWO TYPES MAY NOT SHARE ONE DISPLAY NAME, AND A RENAME IS THE OTHER
    // WAY TO GET THERE.**                                       (Slice #34.09)
    // The same refusal the POST answers, from the same guard in the same query
    // layer, for the reason the identity-card and catch-all pairs above both
    // grew a rename half: a guard on the create door alone is a lock on a door
    // with the window open beside it.
    const nameTaken = asDocumentTypeNameTaken(err);
    if (nameTaken !== null) {
      return Response.json(
        {
          error:
            "A document type with this display name already exists: " +
            `"${nameTaken.takenBy}".`,
          code: DOCUMENT_TYPE_NAME_TAKEN_CODE,
        },
        { status: 400 },
      );
    }
    // ── The one Postgres error this route now answers, and the paragraph it
    //    replaces was right until migration_080 existed.        (Slice #34.09)
    //
    // ⚠️ **WHAT STOOD HERE WAS A CENSUS, AND #34.09 INVALIDATED IT.** Quoted so
    // the next reader can see what changed rather than wonder: "Across all
    // eleven lists the only UNIQUE constraints are on `key`, and `origin` — the
    // one CHECK a lookup row carries — is stripped from the PUT schema. So the
    // branch would have been unreachable code justified by a sentence that is
    // not true." (Slice #29.06 added a general `dbErrorToResponse` wiring here
    // to match the POST; a second review round took it back out on that
    // count.) `lookup_document_type_name_normalised_unique` is a twelfth
    // uniqueness and the first one a PUT can violate: a rename onto a name
    // another row holds is a 23505 on this route, today.
    //
    // ⚠️ **AND THE REST OF THAT PARAGRAPH STILL STANDS, WHICH IS WHY THIS IS
    // ONE INDEX AND NOT `dbErrorToResponse`.** Wiring the general mapper in
    // would answer 23514 and 23503 with a 400, and `value-list-modal.tsx`
    // reads any 400 from this door as its own form's rejection — "a required
    // field is missing or wrong" — over a database constraint no field on the
    // form controls. This branch is exact: one SQLSTATE, one constraint name,
    // one `code` the client already knows, and everything else falls through
    // to the 500 as before.
    if (
      pgErrorCode(err) === "23505" &&
      pgErrorConstraint(err) === DOCUMENT_TYPE_NAME_UNIQUE_INDEX
    ) {
      return Response.json(
        {
          error:
            "A document type with this display name already exists (created or " +
            "renamed by another writer while this request was in flight).",
          code: DOCUMENT_TYPE_NAME_TAKEN_CODE,
        },
        { status: 400 },
      );
    }
    return unexpectedError(err, `PUT /api/admin/value-lists/${list}/${id}`);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { list, id } = await ctx.params;

  if (!isValidListKey(list)) {
    return Response.json({ error: "Unknown list" }, { status: 404 });
  }
  // A path segment that is not a uuid reaches Postgres as one and comes back
  // as 22P02 — which `dbErrorToResponse` does not know, so it surfaced as a
  // 500. "No such row" is what it means.
  if (!isUuid(id)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const outcome = await deleteValue(list, id);
    if (outcome.ok) return new Response(null, { status: 204 });
    if (outcome.reason === "not-found") {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    // 409, not 400: the request is perfectly well formed and the row is
    // perfectly deletable — just not yet. `code` is what the client branches
    // on; `dependents` is what it turns into a Romanian sentence.
    return inUseResponse(outcome.report);
  } catch (err) {
    // The race the pre-check cannot win on its own, and the only list where
    // the database itself has an opinion: a document created for this type
    // between the count and the DELETE. `deleteValue` takes a FOR UPDATE on
    // the lookup row precisely to make this unreachable — an insert that
    // references it needs a conflicting FOR KEY SHARE — so landing here means
    // the guarantee failed, and the answer must still be the refusal rather
    // than a 500 with a constraint name in it.
    if (pgErrorCode(err) === "23503") {
      // ⚠️ **Retry once rather than guess.** An earlier version recounted and
      // answered from the count, which had two wrong endings an adversarial
      // round found: a racer that had rolled back gave a 409 saying "0 objects
      // depend on this" — an error path ending in an enabled delete button —
      // and a count of zero fell through to `dbErrorToResponse`, whose 400
      // carries an English constraint name.
      //
      // Re-running the delete has no such gap: it takes the row lock again and
      // decides from what is true afterwards. Racer committed → its own count
      // sees the new row and returns the refusal. Racer rolled back → the
      // delete simply succeeds. Row gone → 404. One retry, never a loop.
      const retry = await deleteValue(list, id).catch((retryErr) => {
        // Logged rather than swallowed: without this the only trace of a
        // genuinely broken retry — a dropped connection, a lock timeout — is a
        // 400 that looks exactly like an ordinary foreign-key refusal.
        console.error(
          `[DELETE /api/admin/value-lists/${list}/${id}] retry after 23503 failed:`,
          retryErr,
        );
        return null;
      });
      if (retry?.ok) return new Response(null, { status: 204 });
      if (retry && retry.reason === "not-found") {
        return Response.json({ error: "Not found" }, { status: 404 });
      }
      if (retry) return inUseResponse(retry.report);
    }
    const mapped = dbErrorToResponse(err);
    if (mapped) return mapped;
    return unexpectedError(err, `DELETE /api/admin/value-lists/${list}/${id}`);
  }
}
