/**
 * POST /api/auth/signup-request
 *
 * Stores a new sign-up application in user_requests.
 * Only one pending request per email is allowed (enforced by DB unique index).
 *
 * Body:  { email: string; username: string }
 * 200:   { ok: true }
 * 400:   { error: string }
 */
import { NextResponse } from "next/server";
import { db } from "@/db";
import { appUsers, userRequests } from "@/db/schema";
import { eq, or } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const { email, username } = await request.json();

    // Basic validation
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }
    if (!username || typeof username !== "string" || username.length < 3) {
      return NextResponse.json(
        { error: "Username must be at least 3 characters" },
        { status: 400 },
      );
    }
    if (!/^[a-zA-Z0-9_\-]+$/.test(username)) {
      return NextResponse.json(
        { error: "Username may only contain letters, numbers, underscores, and hyphens" },
        { status: 400 },
      );
    }

    // Check if email or username is already registered in app_users
    const existing = await db
      .select({ id: appUsers.id })
      .from(appUsers)
      .where(or(eq(appUsers.email, email.trim()), eq(appUsers.username, username.trim())))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "This email or username is already registered" },
        { status: 400 },
      );
    }

    // Insert — DB unique index will reject duplicate pending requests for same email
    await db.insert(userRequests).values({
      email: email.trim().toLowerCase(),
      username: username.trim(),
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    // Drizzle wraps the pg error in err.cause — check there for the constraint name.
    const cause = (err as { cause?: { code?: string; constraint?: string } }).cause;
    if (
      cause?.constraint === "user_requests_email_pending_unique" ||
      cause?.code === "23505"
    ) {
      return NextResponse.json(
        { error: "A request for this email is already pending" },
        { status: 400 },
      );
    }
    console.error("[signup-request]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
