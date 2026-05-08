/**
 * POST /api/admin/user-requests/reject
 *
 * Rejects a pending user request. Superuser-only.
 *
 * Body: { requestId: string }
 *
 * Actions:
 *  1. Load the request row.
 *  2. Mark as rejected.
 *  3. Send rejection email.
 *
 * Response: { ok: true }
 */
import { NextResponse } from "next/server";
import { db } from "@/db";
import { appUsers, userRequests } from "@/db/schema";
import { createServerClient } from "@/lib/supabase/server";
import { buildRejectionEmail, sendEmail } from "@/lib/email/send-email";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  // Auth check
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify superuser role
  const [callerRow] = await db
    .select({ role: appUsers.role, username: appUsers.username })
    .from(appUsers)
    .where(eq(appUsers.supabaseUid, user.id))
    .limit(1);
  if (!callerRow || callerRow.role !== "superuser") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { requestId } = await request.json();
  if (!requestId) {
    return NextResponse.json({ error: "requestId required" }, { status: 400 });
  }

  const [req] = await db
    .select()
    .from(userRequests)
    .where(eq(userRequests.id, requestId))
    .limit(1);

  if (!req) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (req.status !== "pending") {
    return NextResponse.json(
      { error: `Request is already ${req.status}` },
      { status: 409 },
    );
  }

  // Send rejection email
  let emailSent = false;
  try {
    const { subject, html } = buildRejectionEmail({ username: req.username });
    await sendEmail({ to: req.email, subject, html });
    emailSent = true;
  } catch (emailErr) {
    console.error("[reject] Email send failed:", emailErr);
  }

  // Mark as rejected
  await db
    .update(userRequests)
    .set({
      status: "rejected",
      processedAt: new Date(),
      processedBy: callerRow.username,
      emailSent,
    })
    .where(eq(userRequests.id, requestId));

  return NextResponse.json({ ok: true, emailSent });
}
