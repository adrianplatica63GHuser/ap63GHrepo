-- Migration 0006 — Full M:M relationship tables (Slice #5.2)
--
-- Five new junction tables:
--   property_paperwork  — Property <-> Document
--   property_property   — Property <-> Property  (self-ref, symmetric; id_a < id_b)
--   person_paperwork    — Person   <-> Document
--   person_person       — Person   <-> Person    (self-ref, symmetric; id_a < id_b)
--   paperwork_paperwork — Document <-> Document  (self-ref, symmetric; id_a < id_b)
--
-- All regular tables follow the same pattern as property_person (0005):
--   PK uuid, two FK uuid columns with ON DELETE CASCADE, unique index on the pair.
--
-- Self-referential tables add a CHECK constraint to enforce canonical order
--   (smaller UUID always in the _a column) so each undirected edge is stored once.
--
-- Run: paste into pgAdmin Query Tool with ga40db selected, then Execute.

-- ── property_paperwork ──────────────────────────────────────────────────────
CREATE TABLE "property_paperwork" (
  "id"           uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "property_id"  uuid NOT NULL,
  "paperwork_id" uuid NOT NULL,
  "created_at"   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "property_paperwork"
  ADD CONSTRAINT "property_paperwork_property_id_fk"
  FOREIGN KEY ("property_id") REFERENCES "public"."property"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "property_paperwork"
  ADD CONSTRAINT "property_paperwork_paperwork_id_fk"
  FOREIGN KEY ("paperwork_id") REFERENCES "public"."paperwork"("id")
  ON DELETE cascade ON UPDATE no action;

CREATE UNIQUE INDEX "property_paperwork_unique"
  ON "property_paperwork" USING btree ("property_id", "paperwork_id");

-- ── property_property ───────────────────────────────────────────────────────
CREATE TABLE "property_property" (
  "id"              uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "property_id_a"   uuid NOT NULL,
  "property_id_b"   uuid NOT NULL,
  "created_at"      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "property_property_order" CHECK ("property_id_a" < "property_id_b")
);

ALTER TABLE "property_property"
  ADD CONSTRAINT "property_property_a_fk"
  FOREIGN KEY ("property_id_a") REFERENCES "public"."property"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "property_property"
  ADD CONSTRAINT "property_property_b_fk"
  FOREIGN KEY ("property_id_b") REFERENCES "public"."property"("id")
  ON DELETE cascade ON UPDATE no action;

CREATE UNIQUE INDEX "property_property_unique"
  ON "property_property" USING btree ("property_id_a", "property_id_b");

-- ── person_paperwork ────────────────────────────────────────────────────────
CREATE TABLE "person_paperwork" (
  "id"           uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "person_id"    uuid NOT NULL,
  "paperwork_id" uuid NOT NULL,
  "created_at"   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "person_paperwork"
  ADD CONSTRAINT "person_paperwork_person_id_fk"
  FOREIGN KEY ("person_id") REFERENCES "public"."person"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "person_paperwork"
  ADD CONSTRAINT "person_paperwork_paperwork_id_fk"
  FOREIGN KEY ("paperwork_id") REFERENCES "public"."paperwork"("id")
  ON DELETE cascade ON UPDATE no action;

CREATE UNIQUE INDEX "person_paperwork_unique"
  ON "person_paperwork" USING btree ("person_id", "paperwork_id");

-- ── person_person ───────────────────────────────────────────────────────────
CREATE TABLE "person_person" (
  "id"           uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "person_id_a"  uuid NOT NULL,
  "person_id_b"  uuid NOT NULL,
  "created_at"   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "person_person_order" CHECK ("person_id_a" < "person_id_b")
);

ALTER TABLE "person_person"
  ADD CONSTRAINT "person_person_a_fk"
  FOREIGN KEY ("person_id_a") REFERENCES "public"."person"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "person_person"
  ADD CONSTRAINT "person_person_b_fk"
  FOREIGN KEY ("person_id_b") REFERENCES "public"."person"("id")
  ON DELETE cascade ON UPDATE no action;

CREATE UNIQUE INDEX "person_person_unique"
  ON "person_person" USING btree ("person_id_a", "person_id_b");

-- ── paperwork_paperwork ─────────────────────────────────────────────────────
CREATE TABLE "paperwork_paperwork" (
  "id"              uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "paperwork_id_a"  uuid NOT NULL,
  "paperwork_id_b"  uuid NOT NULL,
  "created_at"      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "paperwork_paperwork_order" CHECK ("paperwork_id_a" < "paperwork_id_b")
);

ALTER TABLE "paperwork_paperwork"
  ADD CONSTRAINT "paperwork_paperwork_a_fk"
  FOREIGN KEY ("paperwork_id_a") REFERENCES "public"."paperwork"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "paperwork_paperwork"
  ADD CONSTRAINT "paperwork_paperwork_b_fk"
  FOREIGN KEY ("paperwork_id_b") REFERENCES "public"."paperwork"("id")
  ON DELETE cascade ON UPDATE no action;

CREATE UNIQUE INDEX "paperwork_paperwork_unique"
  ON "paperwork_paperwork" USING btree ("paperwork_id_a", "paperwork_id_b");
