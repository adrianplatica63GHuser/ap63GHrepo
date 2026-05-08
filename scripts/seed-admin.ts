/**
 * One-time admin seed script — Slice #7.0
 *
 * Creates the superuser account in Supabase Auth and inserts the matching
 * row in app_users. Safe to run multiple times (idempotent).
 *
 * Uses only the Supabase JS client (REST API) — no direct PostgreSQL
 * connection required. Works from any machine that can reach Supabase.
 *
 * Usage (run once after applying migration 0007):
 *   npm run seed:admin
 *
 * Required env vars (set in .env before running):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ADMIN_EMAIL      — e.g. admin@yourcompany.com
 *   ADMIN_USERNAME   — e.g. admin
 *   ADMIN_PASSWORD   — initial password (change after first login)
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl   = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey    = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail    = process.env.ADMIN_EMAIL;
const adminUsername = process.env.ADMIN_USERNAME ?? "admin";
const adminPassword = process.env.ADMIN_PASSWORD;

if (!supabaseUrl || !serviceKey || !adminEmail || !adminPassword) {
  console.error(
    "Missing required env vars. Set NEXT_PUBLIC_SUPABASE_URL, " +
    "SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL, and ADMIN_PASSWORD in .env",
  );
  process.exit(1);
}

// Service-role client — bypasses RLS, can read/write anything
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  // ── 1. Check if admin already exists in app_users (via REST) ─────────────
  const { data: existingRows, error: selectError } = await supabase
    .from("app_users")
    .select("id")
    .eq("username", adminUsername)
    .limit(1);

  if (selectError) throw selectError;

  if (existingRows && existingRows.length > 0) {
    console.log(`✓ Superuser "${adminUsername}" already exists in app_users — skipping.`);
    return;
  }

  // ── 2. Check if the email already exists in Supabase Auth ────────────────
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw listError;

  let supabaseUid: string | null = null;
  const existingAuthUser = listData.users.find((u) => u.email === adminEmail);

  if (existingAuthUser) {
    console.log(`✓ Supabase Auth user for "${adminEmail}" already exists — reusing UID.`);
    supabaseUid = existingAuthUser.id;
  } else {
    // ── 3. Create the auth user ───────────────────────────────────────────
    const { data: createData, error: createError } =
      await supabase.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true, // skip confirmation email for the admin account
        user_metadata: { username: adminUsername, role: "superuser" },
      });
    if (createError) throw createError;
    supabaseUid = createData.user.id;
    console.log(`✓ Created Supabase Auth user: ${adminEmail} (uid: ${supabaseUid})`);
  }

  // ── 4. Insert into app_users (via REST, service role bypasses RLS) ────────
  const { error: insertError } = await supabase
    .from("app_users")
    .insert({
      supabase_uid: supabaseUid,
      email: adminEmail,
      username: adminUsername,
      role: "superuser",
      approved_by: null,
    });

  if (insertError) {
    // Conflict = row already exists (race or re-run) — treat as success
    if (insertError.code === "23505") {
      console.log(`✓ app_users row for "${adminUsername}" already exists.`);
    } else {
      throw insertError;
    }
  } else {
    console.log(`✓ Inserted app_users row: username="${adminUsername}", role="superuser"`);
  }

  console.log("\n✅ Admin seed complete. Change your password after first login.");
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
