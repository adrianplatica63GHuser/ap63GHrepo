-- Migration 0007 — auth user_requests + app_users  (Slice #7.0)
-- Apply via: npm run db:migrate  (local Docker)
-- OR paste into Supabase SQL editor for the cloud instance.

-- ── Enums ──────────────────────────────────────────────────────────────────

CREATE TYPE "user_request_status" AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE "app_user_role"       AS ENUM ('superuser', 'user');

-- ── user_requests ──────────────────────────────────────────────────────────
-- Staging table for sign-up applications.
-- Only one pending request per email is allowed at a time.

CREATE TABLE "user_requests" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email"        text NOT NULL,
  "username"     text NOT NULL,
  "status"       "user_request_status" NOT NULL DEFAULT 'pending',
  "requested_at" timestamptz NOT NULL DEFAULT now(),
  "processed_at" timestamptz,
  "processed_by" text,
  "email_sent"   boolean NOT NULL DEFAULT false
);

-- Only one pending request per email address at a time.
CREATE UNIQUE INDEX "user_requests_email_pending_unique"
  ON "user_requests" ("email")
  WHERE "status" = 'pending';

-- ── app_users ──────────────────────────────────────────────────────────────
-- Links Supabase Auth UID → app username + role.
-- The seeded superuser has approved_by = NULL.

CREATE TABLE "app_users" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "supabase_uid" text UNIQUE,
  "email"        text NOT NULL UNIQUE,
  "username"     text NOT NULL UNIQUE,
  "role"         "app_user_role" NOT NULL DEFAULT 'user',
  "approved_by"  text,
  "created_at"   timestamptz NOT NULL DEFAULT now()
);
