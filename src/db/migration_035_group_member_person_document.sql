-- migration_035_group_member_person_document.sql
--
-- Extends group_member to support PHYSICAL_PERSON, JUDICIAL_PERSON, and
-- DOCUMENT target types (Slice #18.17).
--
-- Previously, only PROPERTY membership was wired (property_id column). This
-- migration adds:
--   - person_id   FK → person(id) ON DELETE CASCADE  (PHYSICAL + JUDICIAL groups)
--   - document_id FK → document(id) ON DELETE CASCADE (DOCUMENT groups)
--   - unique constraints per group for each new FK (same as property_id already has)
--
-- Apply locally:
--   docker cp src/db/migration_035_group_member_person_document.sql ga40prj-postgres:/tmp/m035.sql
--   docker exec ga40prj-postgres psql -U postgres -d ga40db -f /tmp/m035.sql
--
-- Apply on Supabase: paste directly into the SQL Editor.

BEGIN;

ALTER TABLE group_member
  ADD COLUMN IF NOT EXISTS person_id   UUID REFERENCES person(id)   ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES document(id) ON DELETE CASCADE;

-- Unique: a person can appear in any given group at most once.
CREATE UNIQUE INDEX IF NOT EXISTS group_member_group_person_unique
  ON group_member (group_id, person_id)
  WHERE person_id IS NOT NULL;

-- Unique: a document can appear in any given group at most once.
CREATE UNIQUE INDEX IF NOT EXISTS group_member_group_document_unique
  ON group_member (group_id, document_id)
  WHERE document_id IS NOT NULL;

COMMIT;
