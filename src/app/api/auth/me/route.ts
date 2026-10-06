/**
 * GET /api/auth/me
 *
 * Returns the current user's app-level profile: the username, and whether the
 * account has the whole application (`hasFullAccess`, Slice #38.21 — the role is
 * no longer read or sent). Used by the sidebar to display the username and to
 * show an account without an app_users row only the four lists.
 *
 * 200: { username: string; fullAccess: boolean; uatMode?: true }
 * 401: { error: "Unauthorized" }
 *
 * Slice #29.09a: the role lookup this route used to run itself now lives in
 * `@/lib/auth/current-role`, because the OCR rate limiter needs the same answer
 * and that would have been the SEVENTH copy of the same four lines of drizzle —
 * six modules ran it, of which this was one.
 */
import { NextResponse } from "next/server";
import { getCurrentAppUser, hasFullAccess } from "@/lib/auth/current-role";

export async function GET() {
  const appUser = await getCurrentAppUser();

  if (!appUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // UAT mode (Ciprian's local box, Slice #9.0) — no real Supabase project.
  // `hasFullAccess()` lets that identity in, so nothing in
  // the sidebar looks hidden (which would be inconsistent with middleware
  // already letting every route through unauthenticated). `uatMode` is what
  // tells the client to hide Sign Out / Change Password — both assume a real
  // Supabase session that doesn't exist on this box.
  if (appUser.isUat) {
    return NextResponse.json({
      username: appUser.username ?? "UAT",
      fullAccess: hasFullAccess(appUser),
      uatMode: true,
    });
  }

  // An auth user with no app_users row (edge case during seed) has a null
  // username and no full access — refused as before #38.21.
  return NextResponse.json({
    username: appUser.username ?? appUser.email ?? "user",
    fullAccess: hasFullAccess(appUser),
  });
}
