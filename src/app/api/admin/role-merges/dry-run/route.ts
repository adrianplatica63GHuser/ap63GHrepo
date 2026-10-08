/**
 * /api/admin/role-merges/dry-run
 *
 * POST — the role clean-up's dry run against this server's database.
 *                                                               (Slice #38.37)
 *
 * Runs every merge in src/db/role-merges.json, each in its own transaction,
 * and rolls every one back: `{ approved, outcomes: MergeOutcome[], lines,
 * linksMoved }`. POST, not GET, because it does write — inside transactions
 * that never commit — and a GET a browser may prefetch should not.
 *
 * It exists so the dry run can be read where the real data is, before anyone
 * applies: the session that converts Adrian's and Ciprian's marked list quotes
 * it in the handover above the apply line, and `npm run roles:merge` prints the
 * same lines from the same function. There is no apply here, on purpose: the
 * apply is a destructive database operation, and it stays a script Adrian runs.
 */

import { requireFullAccess } from "@/lib/auth/current-role";

export const dynamic = "force-dynamic";

import { db } from "@/db";
import { unexpectedError } from "@/lib/api/errors";
import rawList from "@/db/role-merges.json";
import {
  describeOutcome,
  linksMoved,
  roleMergeListProblems,
  parseRoleMergeList,
} from "@/lib/admin/person-roles/role-merge-list";
import { runRoleMerges } from "@/lib/admin/person-roles/role-merge";

export async function POST(): Promise<Response> {
  // Full access only (superuser-only until #38.21) — FU-002, Slice #36.20 (src/lib/auth/current-role.ts).
  const denied = await requireFullAccess();
  if (denied) return denied;

  const problems = roleMergeListProblems(rawList);
  if (problems.length > 0) {
    return Response.json({ error: "ROLE_MERGE_LIST_INVALID", problems }, { status: 422 });
  }
  try {
    const list = parseRoleMergeList(rawList);
    const outcomes = await runRoleMerges(db, list, { apply: false, actor: null });
    return Response.json({
      approved: list.approved,
      outcomes,
      lines: outcomes.map(describeOutcome),
      linksMoved: outcomes.reduce((sum, o) => sum + linksMoved(o), 0),
    });
  } catch (err) {
    return unexpectedError(err, "POST /api/admin/role-merges/dry-run");
  }
}
