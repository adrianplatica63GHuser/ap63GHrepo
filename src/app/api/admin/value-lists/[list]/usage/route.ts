/**
 * /api/admin/value-lists/[list]/usage
 *
 * GET — „folosit de N" for every row of a list.                 (Slice #38.35)
 *
 * `{ usage: { <id>: n } }`, every row of the list present, 0 for a value
 * nothing uses. Counted by `countUsage` with one grouped query per dependent
 * ref, not one per row; the confirmation dialogs keep counting one row live
 * through `[id]/dependents`, because a number quoted before a delete must be
 * true when it is read.
 */

import { requireFullAccess } from "@/lib/auth/current-role";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

import { unexpectedError } from "@/lib/api/errors";
import { isValidListKey } from "@/lib/admin/value-lists/config";
import { countUsage } from "@/lib/admin/value-lists/queries";

type Ctx = { params: Promise<{ list: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  // Full access only (superuser-only until #38.21) — FU-002, Slice #36.20 (src/lib/auth/current-role.ts).
  const denied = await requireFullAccess();
  if (denied) return denied;

  const { list } = await ctx.params;
  if (!isValidListKey(list)) {
    return Response.json({ error: "Unknown list" }, { status: 404 });
  }
  try {
    return Response.json({ usage: await countUsage(list) });
  } catch (err) {
    return unexpectedError(err, "GET /api/admin/value-lists/[list]/usage");
  }
}
