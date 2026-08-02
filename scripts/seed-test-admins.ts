/**
 * One-time admin seed script — Slice #22.01
 *
 * Creates the two fixed test-mode administrator accounts (Adrian + Ciprian)
 * in Supabase Auth and inserts/updates the matching rows in app_users with
 * role "superuser". Safe to run multiple times (idempotent).
 *
 * Unlike scripts/seed-admin.ts — which writes the app_users row via the
 * Supabase JS client (`supabase.from("app_users").insert(...)`), which
 * always hits the CLOUD Supabase Postgres via PostgREST regardless of
 * DATABASE_URL — this script writes app_users via the app's own Drizzle
 * `db`, so the row lands in whichever database DATABASE_URL currently
 * points to. That mismatch (cloud-only app_users write vs. local-only app
 * reads in `npm run dev`) was the exact reason the Users & Access menu was
 * invisible for a locally-seeded admin.
 *
 * Usage:
 *   npm run seed:test-admins                    — seeds local Docker (DATABASE_URL as-is in .env)
 *
 * To also seed the deployed/cloud app, re-run with DATABASE_URL temporarily
 * pointed at Supabase (same pattern as scripts/supabase-sync.ts's seed
 * step) — and set NODE_ENV=production too, since src/db/index.ts only
 * enables TLS when NODE_ENV is "production", and Supabase requires TLS:
 *
 *   $env:DATABASE_URL = $env:SUPABASE_SYNC_URL   (PowerShell)
 *   $env:NODE_ENV = "production"
 *   npm run seed:test-admins
 *   Remove-Item Env:\DATABASE_URL
 *   Remove-Item Env:\NODE_ENV
 *
 * Required env vars (already in .env):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   DATABASE_URL  — determines which Postgres the app_users rows are written to
 */
import { createClient } from "@supabase/supabase-js";
import { db, pool } from "../src/db";
import { appUsers } from "../src/db/schema";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error(
    "Missing required env vars. Set NEXT_PUBLIC_SUPABASE_URL and " +
      "SUPABASE_SERVICE_ROLE_KEY in .env",
  );
  process.exit(1);
}

// Fixed test-mode password, shared by both admin accounts — per Adrian's
// request for Slice #22.01. Testing mode only; not a real production
// credential, so it's fine to keep it literal here rather than in .env.
const SHARED_TEST_PASSWORD = "Dan123te456lei789";

const ADMINS = [
  { username: "Adrian", email: "adrianplatica63@gmail.com" },
  { username: "Ciprian", email: "termoactiv@yahoo.com" },
] as const;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function ensureAuthUser(username: string, email: string): Promise<string> {
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw listError;

  const existing = listData.users.find((u) => u.email === email);

  if (existing) {
    // Force the password to the fixed shared value even if the account
    // already existed with a different one (e.g. created earlier via the
    // self-signup + approval flow, which assigns a random generated
    // password). The whole point of this script is that both admins log in
    // with the same known password, regardless of how the account got here.
    const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
      password: SHARED_TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { username, role: "superuser" },
    });
    if (updateError) throw updateError;
    console.log(
      `  Supabase Auth user for ${email} already existed — password reset to the shared test password.`,
    );
    return existing.id;
  }

  const { data: createData, error: createError } = await supabase.auth.admin.createUser({
    email,
    password: SHARED_TEST_PASSWORD,
    email_confirm: true, // skip confirmation email for the seeded admins
    user_metadata: { username, role: "superuser" },
  });
  if (createError) throw createError;

  console.log(`  Created Supabase Auth user: ${email} (uid: ${createData.user.id})`);
  return createData.user.id;
}

async function upsertAppUser(username: string, email: string, supabaseUid: string) {
  await db
    .insert(appUsers)
    .values({
      supabaseUid,
      email,
      username,
      role: "superuser",
      approvedBy: null,
    })
    .onConflictDoUpdate({
      target: appUsers.email,
      set: { supabaseUid, username, role: "superuser" },
    });
}

async function run() {
  for (const admin of ADMINS) {
    console.log(`\n=== ${admin.username} <${admin.email}> ===`);
    const supabaseUid = await ensureAuthUser(admin.username, admin.email);
    await upsertAppUser(admin.username, admin.email, supabaseUid);
    console.log("  app_users row upserted (role: superuser) in the current DATABASE_URL.");
  }
  console.log(
    "\n✅ Admin seed complete. Both accounts share the fixed test password.",
  );
}

run()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
