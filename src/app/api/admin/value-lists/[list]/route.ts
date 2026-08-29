/**
 * /api/admin/value-lists/[list]
 *
 * GET  — return all rows for a given lookup table, ordered by sort_order
 * POST — insert a new row; validates body against the per-list Zod schema
 */

import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
import {
  dbErrorToResponse,
  pgErrorCode,
  unexpectedError,
  zodErrorToResponse,
} from "@/lib/api/errors";
import { isValidListKey } from "@/lib/admin/value-lists/config";
import { listValues, createValue } from "@/lib/admin/value-lists/queries";
import { LIST_SCHEMAS } from "@/lib/admin/value-lists/validation";
import {
  asIdCardFormRefusal,
  idCardRefusalCode,
} from "@/lib/documents/id-card-form-guard";

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
