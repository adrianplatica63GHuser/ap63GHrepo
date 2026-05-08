/**
 * GET /api/auth/me
 *
 * Returns the current user's app-level profile (username + role).
 * Used by the sidebar to display the username and conditionally show
 * superuser-only items.
 *
 * 200: { username: string; role: "superuser" | "user" }
 * 401: { error: "Unauthorized" }
 */
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [row] = await db
    .select({ username: appUsers.username, role: appUsers.role })
    .from(appUsers)
    .where(eq(appUsers.supabaseUid, user.id))
    .limit(1);

  if (!row) {
    // Auth user exists but no app_users row (edge case during seed)
    return NextResponse.json({ username: user.email ?? "user", role: "user" });
  }

  return NextResponse.json({ username: row.username, role: row.role });
}
