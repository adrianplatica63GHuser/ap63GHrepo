/**
 * POST /api/auth/lookup-email
 *
 * Given a username, returns the associated email from app_users.
 * Used by the login form to translate "username + password" into
 * "email + password" for Supabase Auth.
 *
 * Body:  { username: string }
 * 200:   { email: string }
 * 404:   { error: "Invalid username or password" }
 */
import { NextResponse } from "next/server";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const { username } = await request.json();
    if (!username || typeof username !== "string") {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 404 },
      );
    }

    const [row] = await db
      .select({ email: appUsers.email })
      .from(appUsers)
      .where(eq(appUsers.username, username.trim()))
      .limit(1);

    if (!row) {
      // Return the same message as a wrong password to avoid username enumeration
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 404 },
      );
    }

    return NextResponse.json({ email: row.email });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
