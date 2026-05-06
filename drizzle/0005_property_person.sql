-- Migration 0005 — Property <-> Person M:M junction table (Slice #5.1)
--
-- Creates the `property_person` join table that links properties to persons.
-- No deleted_at — associations are hard-deleted.
-- ON DELETE CASCADE on both sides keeps the table clean automatically.
-- Duplicate associations are blocked by the unique index on (property_id, person_id).
--
-- Drizzle-kit marker -> run with: npm run db:migrate
-- Fallback            -> paste directly into the Supabase SQL editor.

CREATE TABLE "property_person" (
  "id"          uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "property_id" uuid NOT NULL,
  "person_id"   uuid NOT NULL,
  "created_at"  timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

ALTER TABLE "property_person"
  ADD CONSTRAINT "property_person_property_id_property_id_fk"
  FOREIGN KEY ("property_id") REFERENCES "public"."property"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "property_person"
  ADD CONSTRAINT "property_person_person_id_person_id_fk"
  FOREIGN KEY ("person_id") REFERENCES "public"."person"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE UNIQUE INDEX "property_person_unique"
  ON "property_person" USING btree ("property_id", "person_id");
