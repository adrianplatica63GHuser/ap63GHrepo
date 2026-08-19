/**
 * /api/admin/value-lists/[list]/[id]/reassign
 *
 * POST — move everything that depends on this row onto another value of the
 *        same list, so the row can then be deleted.            (Slice #29.05)
 *
 * WHY THIS EXISTS AS ONE ENDPOINT FOR ALL NINE LISTS
 *   Nothing in the application could re-point rows in bulk before this. What
 *   existed was a bulk DELETE of documents, a per-row PATCH loop inside the
 *   import wizard, and a single-document type change on the document form —
 *   none of which takes an old lookup id and a new one. Deciding it once, here,
 *   is what keeps "refuse, name, offer" the same conversation on every list
 *   instead of nine slightly different screens.
 *
 *   The offer is deliberately NOT a filtered view of the dependent objects:
 *   for `person-roles` the dependents span six tables, three of them whitelist
 *   rows with no screen of their own, so "go and edit them yourself" would be a
 *   dead end on the very list that needs it most.
 *
 * Answers 200 with `{ moved: [{ labelKey, count }], total }`. The delete is a
 * separate call the user makes afterwards, on purpose: a move and a permanent
 * delete behind one button would be one click away from being irreversible.
 */

import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

import { z } from "zod/v4";
import {
  dbErrorToResponse,
  unexpectedError,
  zodErrorToResponse,
} from "@/lib/api/errors";
import { isValidListKey } from "@/lib/admin/value-lists/config";
import { isUuid } from "@/lib/admin/value-lists/responses";
import { reassignDependents } from "@/lib/admin/value-lists/queries";

type Ctx = { params: Promise<{ list: string; id: string }> };

const bodySchema = z.object({ targetId: z.string().uuid() });

export async function POST(request: NextRequest, ctx: Ctx): Promise<Response> {
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

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return zodErrorToResponse(parsed.error);

  try {
    const outcome = await reassignDependents(list, id, parsed.data.targetId);
    if (outcome.ok) {
      return Response.json({ moved: outcome.moved, total: outcome.total });
    }
    if (outcome.reason === "not-found") {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    // Two shapes of no, and the client says them differently in Romanian:
    // SAME_VALUE  — the target IS this value (the same row, or on `tarla` a
    //               different row carrying the same indicativ). Moving onto it
    //               would rewrite nothing and report a move.
    // AMBIGUOUS   — a twin row carries this value, so "the properties that use
    //               this one" is not a set the data can identify. Moving would
    //               take the twin's properties with it.
    const code = outcome.reason === "ambiguous-value" ? "AMBIGUOUS_VALUE" : "SAME_VALUE";
    return Response.json({ error: code, code }, { status: 409 });
  } catch (err) {
    const mapped = dbErrorToResponse(err);
    if (mapped) return mapped;
    return unexpectedError(
      err,
      `POST /api/admin/value-lists/${list}/${id}/reassign`,
    );
  }
}
