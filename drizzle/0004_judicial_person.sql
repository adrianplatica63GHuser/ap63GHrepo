-- Migration 0004 — Judicial Person (Slice #4.6)
--
-- Creates the `judicial_type` enum and the `judicial_person` satellite
-- table. 1:1 with `person`, keyed by person_id, ON DELETE CASCADE.
--
-- CUI (Cod Unic de Inregistrare): unique-when-present + immutable once
-- set, mirroring the CNP rules on natural_person.
--
-- Address rows are stored in the existing `address` table with kind =
-- HEADQUARTERS or CORRESPONDENCE — both already in the address_kind
-- enum from migration 0000. No new address columns needed.
--
-- judicial_person has no updated_at — its row is part of the person
-- aggregate (same pattern as natural_person).
--
-- Drizzle-kit marker → run with: npm run db:migrate
-- Fallback           → paste directly into the Supabase SQL editor.

-- ── Enum ──────────────────────────────────────────────────────────────────────

CREATE TYPE "public"."judicial_type" AS ENUM(
  'SRL',
  'SA',
  'SRL_D',
  'PFA',
  'II',
  'IF',
  'ONG',
  'OTHER'
);--> statement-breakpoint

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE "judicial_person" (
  "person_id"              uuid PRIMARY KEY NOT NULL,
  "name"                   text NOT NULL,
  "nickname"               text,
  "judicial_type"          "judicial_type",
  "cui_number"             text,
  "trade_register_number"  text,
  "contact_person_1"       text,
  "contact_person_2"       text
);--> statement-breakpoint

ALTER TABLE "judicial_person"
  ADD CONSTRAINT "judicial_person_person_id_person_id_fk"
  FOREIGN KEY ("person_id") REFERENCES "public"."person"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- CUI is unique when present (partial unique index — mirrors CNP pattern).
CREATE UNIQUE INDEX "judicial_person_cui_unique"
  ON "judicial_person" USING btree ("cui_number")
  WHERE "judicial_person"."cui_number" IS NOT NULL;--> statement-breakpoint

-- ── Triggers ──────────────────────────────────────────────────────────────────

-- Trigger: lock CUI once set. Allows NULL -> value (initial set later),
-- blocks value -> anything-different (rename or clear). Enforced at the DB
-- so the rule survives bypass attempts via the API.
CREATE OR REPLACE FUNCTION "judicial_person_lock_cui"() RETURNS trigger AS $$
BEGIN
  IF OLD.cui_number IS NOT NULL AND NEW.cui_number IS DISTINCT FROM OLD.cui_number THEN
    RAISE EXCEPTION 'CUI cannot be changed once set; delete and recreate the judicial person instead';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER "judicial_person_lock_cui"
  BEFORE UPDATE ON "judicial_person"
  FOR EACH ROW EXECUTE FUNCTION "judicial_person_lock_cui"();
