-- Slice #19.03 — add subject, date_valid_until, surveyor_id to document
--
-- subject          TEXT    — brief subject/dispozitie, shown on ALL document types.
-- date_valid_until DATE    — validity/expiry date (decisions, permits, etc.).
-- surveyor_id      UUID FK — person (natural or judicial) who performed the
--                            cadastral work. ON DELETE SET NULL: removing the
--                            person from the system clears the tag, not blocks it.
--
-- Also backfills existing document_version JSONB snapshots so old snapshots
-- remain structurally consistent with new ones (adds the three new keys as null).
--
-- Apply locally:
--   docker cp src\db\migration_042_document_new_fields.sql ga40prj-postgres:/tmp/m042.sql
--   docker exec ga40prj-postgres psql -U postgres -d ga40db -f /tmp/m042.sql
--
-- Apply to Supabase: paste this file's contents into the Supabase SQL Editor.

ALTER TABLE document
  ADD COLUMN IF NOT EXISTS subject          TEXT,
  ADD COLUMN IF NOT EXISTS date_valid_until DATE,
  ADD COLUMN IF NOT EXISTS surveyor_id      UUID REFERENCES person(id) ON DELETE SET NULL;

-- Backfill existing version snapshots: merge the three new keys as JSON null
-- so old snapshots stay structurally consistent with new ones.
-- Only updates rows that don't already have the 'subject' key (idempotent).
UPDATE document_version
SET snapshot = snapshot || '{"subject":null,"dateValidUntil":null,"surveyorId":null}'::jsonb
WHERE NOT (snapshot ? 'subject');
