-- migration_057_soft_delete_lookups.sql
--
-- Slice #19.30 — Soft-delete for all lookup/reference tables, groups, and stamps.
--
-- Adds deleted_at TIMESTAMPTZ (nullable) to:
--   11 lookup_* tables, groups, stamps  (13 tables total)
--
-- Behaviour: API DELETE handlers now set deleted_at = NOW() instead of
-- hard-deleting the row.  All list/dropdown queries gain a WHERE deleted_at IS NULL
-- filter so retired entries are invisible to the UI.  M:M junctions keep their
-- existing ON DELETE SET NULL FKs — if a lookup row is soft-deleted those FKs
-- are never triggered, so historical associations keep their role tag.

BEGIN;

-- ── Lookup tables ─────────────────────────────────────────────────────────────

ALTER TABLE lookup_property_type
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE lookup_tarla
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE lookup_use_category
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE lookup_person_type
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE lookup_person_role
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE lookup_judicial_person_type
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE lookup_citizenship
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE lookup_document_type
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE lookup_institution
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE lookup_property_property_role
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE lookup_document_document_role
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ── Groups and Stamps ─────────────────────────────────────────────────────────

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE stamps
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ── schema_migrations record ──────────────────────────────────────────────────

INSERT INTO schema_migrations (filename) VALUES ('migration_057_soft_delete_lookups.sql')
  ON CONFLICT (filename) DO NOTHING;

COMMIT;
