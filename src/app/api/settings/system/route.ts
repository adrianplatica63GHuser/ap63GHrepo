/**
 * /api/settings/system
 *
 * GET — what „Setări" shows about the installation: the backups and the
 * restore drill, the AI models, and „Despre".                    (Slice #38.40)
 *
 * Read-only, and it never fails on a missing backup folder: see
 * src/lib/settings/system-status.ts. No credential leaves it — the database is
 * a host and a name.
 */

import { requireFullAccess } from "@/lib/auth/current-role";
import { unexpectedError } from "@/lib/api/errors";
import { readSystemStatus } from "@/lib/settings/system-status";
import { paidReadsThisMonth } from "@/lib/ai/paid-reads";
import pkg from "../../../../../package.json";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  // The admin screens' guard, as on /api/time-frames' writes (FU-222). Since #38.21 every
  // signed-in account has full access, so in practice everyone sees it, as the header asks.
  const denied = await requireFullAccess();
  if (denied) return denied;
  try {
    const status = readSystemStatus(pkg.version);
    return Response.json({ ...status, ai: { ...status.ai, paidReads: await paidReadsThisMonth() } });
  } catch (err) {
    return unexpectedError(err, "GET /api/settings/system");
  }
}
