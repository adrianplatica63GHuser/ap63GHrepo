/**
 * GET /api/admin/user-requests
 *
 * Returns user_requests rows. Superuser-only.
 *
 * ⚠️ **The role check was MISSING until Slice #29.09a**, and the comment below
 * claimed it was there. Any signed-in account could read every applicant's
 * email and username — the middleware only requires a session, and
 * `admin/layout.tsx` is a page layout that never runs for a Route Handler. Its
 * two siblings in this folder (approve, reject) checked properly; this one, the
 * read, did not. Found by an adversarial round on the slice that centralised
 * the check, which had rewritten those two and walked past this one.
 *
 * Query params:
 *   status  — "pending" | "approved" | "rejected" (default: all)
 *
 * Response: { requests: UserRequestRow[] }
 */
import { NextResponse } from "next/server";
import { db } from "@/db";
import { userRequests } from "@/db/schema";
import { canManageAccounts, getCurrentAppUser } from "@/lib/auth/current-role";
import { desc, eq } from "drizzle-orm";

export async function GET(request: Request) {
  // Auth check — must be able to administer accounts (superuser, and not the
  // UAT box, whose /admin/users screen does not exist).
  const caller = await getCurrentAppUser();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageAccounts(caller)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status");

  const query = db.select().from(userRequests).orderBy(desc(userRequests.requestedAt));

  // Drizzle doesn't support conditional where easily in a chain, so we split:
  if (statusFilter === "pending" || statusFilter === "approved" || statusFilter === "rejected") {
    const rows = await db
      .select()
      .from(userRequests)
      .where(eq(userRequests.status, statusFilter))
      .orderBy(desc(userRequests.requestedAt));
    return NextResponse.json({ requests: rows });
  }

  const rows = await query;
  return NextResponse.json({ requests: rows });
}
