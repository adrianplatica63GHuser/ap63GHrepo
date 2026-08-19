/**
 * /api/admin/value-lists/[list]/[id]/dependents
 *
 * GET — what depends on this reference-data row, counted live.  (Slice #29.05)
 *
 * WHY A ROUTE OF ITS OWN, RATHER THAN A COLUMN ON THE LIST
 *   Until this slice the only usage count in the application was a correlated
 *   subquery on the property-types LIST query — one class of dependent, one
 *   list of nine, and read at list-load time, so the confirmation dialog was
 *   quoting a number that could be minutes old. Counting on demand is what
 *   makes the sentence true when it is read, and it costs one small query per
 *   confirmation rather than up to six on every list open.
 *
 * The body is `{ total, dependents: [{ labelKey, count }], removedWithRow:
 * [{ labelKey, count }], notes: [key] }` — keys and numbers, no sentences. See
 * src/lib/admin/value-lists/responses.ts. `total` counts `dependents` only:
 * `removedWithRow` is the row's own configuration (whitelist ticks), which the
 * database cascades away and which never blocks a delete.
 */

import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

import { unexpectedError } from "@/lib/api/errors";
import { isValidListKey } from "@/lib/admin/value-lists/config";
import { isUuid } from "@/lib/admin/value-lists/responses";
import { countDependents } from "@/lib/admin/value-lists/queries";

type Ctx = { params: Promise<{ list: string; id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
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
    const report = await countDependents(list, id);
    if (!report) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(report);
  } catch (err) {
    return unexpectedError(
      err,
      `GET /api/admin/value-lists/${list}/${id}/dependents`,
    );
  }
}
