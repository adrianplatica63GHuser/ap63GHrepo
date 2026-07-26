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
import { getCurrentUser, isUatNoAuth } from "@/lib/auth/current-user";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  // UAT mode (Ciprian's local box, Slice #9.0) — no real Supabase project.
  // Mirror the same bypass as middleware.ts and admin/layout.tsx: report
  // everyone as a superuser (so nothing in the sidebar looks hidden, which
  // would be inconsistent with middleware already letting every route
  // through unauthenticated) and flag uatMode so the client can hide the
  // Sign Out / Change Password controls — both assume a real Supabase
  // session that doesn't exist on this box.
  if (isUatNoAuth()) {
    return NextResponse.json({ username: "UAT", role: "superuser", uatMode: true });
  }

  const user = await getCurrentUser();

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
