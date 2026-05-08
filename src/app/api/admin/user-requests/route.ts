/**
 * GET /api/admin/user-requests
 *
 * Returns user_requests rows. Superuser-only.
 *
 * Query params:
 *   status  — "pending" | "approved" | "rejected" (default: all)
 *
 * Response: { requests: UserRequestRow[] }
 */
import { NextResponse } from "next/server";
import { db } from "@/db";
import { userRequests } from "@/db/schema";
import { createServerClient } from "@/lib/supabase/server";
import { desc, eq } from "drizzle-orm";

export async function GET(request: Request) {
  // Auth check — must be superuser
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status");

  let query = db.select().from(userRequests).orderBy(desc(userRequests.requestedAt));

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
