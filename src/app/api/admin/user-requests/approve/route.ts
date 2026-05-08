/**
 * POST /api/admin/user-requests/approve
 *
 * Approves a pending user request. Superuser-only.
 *
 * Body: { requestId: string }
 *
 * Actions:
 *  1. Load the request row.
 *  2. Generate a random 12-char password.
 *  3. Create the user in Supabase Auth (admin API).
 *  4. Insert into app_users.
 *  5. Mark the request as approved.
 *  6. Send approval email with the generated password.
 *
 * Response: { ok: true }
 */
import { NextResponse } from "next/server";
import { db } from "@/db";
import { appUsers, userRequests } from "@/db/schema";
import { createAdminClient, createServerClient } from "@/lib/supabase/server";
import { buildApprovalEmail, sendEmail } from "@/lib/email/send-email";
import { eq } from "drizzle-orm";

function generatePassword(length = 12): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  let pwd = "";
  // Use Math.random for simplicity (crypto not needed for a temp password
  // that is immediately changed on first login).
  for (let i = 0; i < length; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
}

export async function POST(request: Request) {
  // Auth check — must be logged in (superuser check relies on app_users role)
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify the caller is a superuser
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

  // Load the request
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

  // Generate password
  const tempPassword = generatePassword();

  // Create user in Supabase Auth
  const admin = createAdminClient();
  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email: req.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { username: req.username, role: "user" },
  });
  if (createError) {
    console.error("[approve] Supabase createUser failed:", createError);
    return NextResponse.json(
      { error: "Failed to create auth user: " + createError.message },
      { status: 500 },
    );
  }

  const supabaseUid = newUser.user.id;

  // Insert into app_users
  await db.insert(appUsers).values({
    supabaseUid,
    email: req.email,
    username: req.username,
    role: "user",
    approvedBy: callerRow.username,
  });

  // In development, always log the temp password so it's visible in the
  // terminal even if email delivery fails (e.g. Resend test-mode restrictions).
  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[approve] DEV — credentials for ${req.username} <${req.email}>:`,
      `password=${tempPassword}`,
    );
  }

  // Mark request as approved
  let emailSent = false;
  try {
    const { subject, html } = buildApprovalEmail({
      username: req.username,
      password: tempPassword,
    });
    await sendEmail({ to: req.email, subject, html });
    emailSent = true;
  } catch (emailErr) {
    console.error("[approve] Email send failed:", emailErr);
    // Don't fail the whole request if email fails — the account is created.
  }

  await db
    .update(userRequests)
    .set({
      status: "approved",
      processedAt: new Date(),
      processedBy: callerRow.username,
      emailSent,
    })
    .where(eq(userRequests.id, requestId));

  return NextResponse.json({ ok: true, emailSent });
}
