/**
 * /api/admin/value-lists/[list]
 *
 * GET  — return all rows for a given lookup table, in the order `listValues`
 *         defines: `sort_order` then the list's own required field, except
 *         `person-roles` (name alone) and `document-types` (UNCLASSIFIED
 *         pinned first, then name). See `listValues`.      (Slice #34.01)
 * POST — insert a new row; validates body against the per-list Zod schema
 */

import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
import {
  dbErrorToResponse,
  pgErrorCode,
  pgErrorConstraint,
  unexpectedError,
  zodErrorToResponse,
} from "@/lib/api/errors";
import { isValidListKey } from "@/lib/admin/value-lists/config";
import {
  listValues,
  createValue,
  PREFERRED_KEY_TAKEN,
} from "@/lib/admin/value-lists/queries";
import { LIST_SCHEMAS } from "@/lib/admin/value-lists/validation";
import {
  asIdCardFormRefusal,
  idCardRefusalCode,
} from "@/lib/documents/id-card-form-guard";
import {
  asCatchAllFormRefusal,
  catchAllRefusalCode,
} from "@/lib/documents/catch-all-form-guard";
import {
  asDocumentTypeKeyRefused,
  asDocumentTypeNameTaken,
  documentTypeKeyRefusalCode,
  DOCUMENT_TYPE_KEY_TAKEN_CODE,
  DOCUMENT_TYPE_NAME_TAKEN_CODE,
  DOCUMENT_TYPE_NAME_UNIQUE_INDEX,
  MAX_DOCUMENT_TYPE_KEY_LENGTH,
} from "@/lib/documents/document-type-name-guard";

type Ctx = { params: Promise<{ list: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { list } = await ctx.params;

  if (!isValidListKey(list)) {
    return Response.json({ error: "Unknown list" }, { status: 404 });
  }

  try {
    const rows = await listValues(list);
    return Response.json({ items: rows, total: rows.length });
  } catch (err) {
    return unexpectedError(err, `GET /api/admin/value-lists/${list}`);
  }
}

export async function POST(request: NextRequest, ctx: Ctx): Promise<Response> {
  const { list } = await ctx.params;

  if (!isValidListKey(list)) {
    return Response.json({ error: "Unknown list" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = LIST_SCHEMAS[list].safeParse(body);
  if (!parsed.success) {
    return zodErrorToResponse(parsed.error);
  }

  try {
    const row = await createValue(list, parsed.data);
    return Response.json(row, { status: 201 });
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
    // ⚠️ **TWO TYPES MAY NOT SHARE ONE DISPLAY NAME.**          (Slice #34.09)
    // Same shape as the two refusals above — thrown from the query layer so a
    // direct caller of `createValue` is bound by it too, answered here as a
    // named 400 whose `code` the Reference Data screens turn into a Romanian
    // sentence. The `error` string is the English wire, never rendered; see
    // `@/lib/admin/value-lists/failures.ts`.
    const nameTaken = asDocumentTypeNameTaken(err);
    if (nameTaken !== null) {
      return Response.json(
        {
          error:
            "A document type with this display name already exists: " +
            `"${nameTaken.takenBy}". Two types the archive reads as one name is ` +
            "how a document ends up filed under the wrong one.",
          code: DOCUMENT_TYPE_NAME_TAKEN_CODE,
        },
        { status: 400 },
      );
    }
    // ⚠️ **AND THE SAME NAME, ARRIVING AS A RACE INSTEAD OF AS A STALE LIST.**
    // The check above is a read and then a write, so two administrators typing
    // one name in the same instant both pass it; migration_080's partial unique
    // index is what makes the loser fail, and it has to arrive as the SAME
    // sentence rather than as the generic one. Recognised by CONSTRAINT — the
    // index name is exported beside the code for that purpose — because
    // `dbErrorToResponse`'s 23505 body carries no `code` at all and its
    // `.includes("cnp")` / `("cui")` tests have nothing to say about this
    // table. Ahead of the generic 23505 branch below, which would otherwise
    // answer 409 and land on the generic Romanian sentence.
    if (
      pgErrorCode(err) === "23505" &&
      pgErrorConstraint(err) === DOCUMENT_TYPE_NAME_UNIQUE_INDEX
    ) {
      return Response.json(
        {
          error:
            "A document type with this display name already exists (created by " +
            "another writer while this request was in flight).",
          code: DOCUMENT_TYPE_NAME_TAKEN_CODE,
        },
        { status: 400 },
      );
    }
    // ⚠️ **AND THE KEY THE PERSON CHOSE, WHEN SOME ROW ALREADY HOLDS IT.**
    // `PREFERRED_KEY_TAKEN` is #29.07's sentinel: `createDocumentTypeRow`
    // refuses to substitute `..._2` for a key it was asked for, because a `_2`
    // row is a row every carve-out matching the literal key would miss. It was
    // written so `resolveClassifiedDocumentType` could go round and adopt;
    // since #34.09 a PERSON can reach it too, and a person needs to be TOLD
    // rather than have the request retried. Unreachable on this route unless
    // the body carried a `key`, because `createValue` passes `null` otherwise
    // and the sentinel is only thrown when a key was actually preferred.
    if (err instanceof Error && err.message === PREFERRED_KEY_TAKEN) {
      return Response.json(
        {
          error:
            "This key already belongs to another document type. A key is set " +
            "once and never changes, so it is not given a numeric suffix.",
          code: DOCUMENT_TYPE_KEY_TAKEN_CODE,
        },
        { status: 400 },
      );
    }
    // ⚠️ **AND THE KEY ITSELF, WHEN IT IS NOT ONE THE ARCHIVE CAN HAVE.**
    // (Slice #34.09.) Two arms, one refusal: a key that slugs to nothing or is
    // longer than `MAX_DOCUMENT_TYPE_KEY_LENGTH`, and a key the codebase itself
    // matches on — `NECLASIFICAT`, `UNCLASSIFIED`, `CARTE_IDENTITATE` — asked
    // for by a row whose NAME does not agree with it. It is a named 400 rather
    // than a zod failure for the reason `optionalDocumentTypeKey` now states at
    // length: a zod issue carries no `code`, and an uncoded 400 from this door
    // renders as "a required field is missing or wrong", which points an
    // administrator at the field that is correct.
    const keyRefused = asDocumentTypeKeyRefused(err);
    if (keyRefused !== null) {
      return Response.json(
        {
          error:
            keyRefused.refusal === "reserved"
              ? "This key is one the archive matches on itself (the catch-all, or an " +
                "identity card). A row may hold it only if its name says the same thing."
              : "This key cannot be used: it contains nothing that can become a key, or " +
                `it is longer than ${MAX_DOCUMENT_TYPE_KEY_LENGTH} characters once folded.`,
          code: documentTypeKeyRefusalCode(keyRefused.refusal),
        },
        { status: 400 },
      );
    }
    // Slice #29.06: through `dbErrorToResponse` before the catch-all, and this
    // route was the ONE that skipped it. Sixteen routes under documents,
    // people, properties, judicial-persons, groups, stamps and admin/import
    // already map their Postgres errors here; the value-lists POST caught with
    // `unexpectedError` alone, so a duplicate key — the exact ending of two
    // concurrent creates of one label — came back as a 500 "Internal server
    // error".
    //
    // ⚠️ **What this buys, stated exactly, because a review round caught the
    // first version of this comment overclaiming.** It makes the API honest: a
    // 409 is what a duplicate is. It does NOT change what the Reference Data
    // screen says — `failureFromResponse` in `value-list-modal.tsx` branches on
    // a `code` field, and `dbErrorToResponse`'s 23505 body carries only `error`
    // and `constraint`, so a 409 lands on the same generic Romanian sentence
    // the 500 did. Saying "two administrators created this at once" in Romanian
    // is a real improvement and is in the handover, not in this slice. And it
    // is no longer half of finding F1: since this slice the import path does
    // not come through this door at all — it goes to
    // POST /api/document-types/resolve, which wins the race rather than
    // reporting it.
    //
    // ⚠️ **23505 ONLY, and an adversarial round narrowed it from every code
    // `dbErrorToResponse` knows.** That function answers 23514 and 23503 with a
    // **400**, and `value-list-modal.tsx` reads any 400 from this door as its
    // own form's rejection — "a required field is missing or wrong" — which
    // over a database CHECK or FK violation is a sentence that sends an
    // administrator to fix a field that is perfectly correct. A 500 is vague;
    // that would be misleading, which is worse. The 409 is safe: the same
    // client maps a status it does not recognise to its generic Romanian
    // sentence. (23503 on a value-lists write is the DELETE's business and is
    // already answered there, in full, by #29.05.)
    if (pgErrorCode(err) === "23505") {
      const mapped = dbErrorToResponse(err);
      if (mapped) return mapped;
    }
    return unexpectedError(err, `POST /api/admin/value-lists/${list}`);
  }
}
