-- migration_038_natural_person_correspondence_same_as_home.sql
--
-- Adds correspondence_same_as_home boolean to natural_person.
-- When true the UI hides the CORRESPONDENCE address block and no
-- CORRESPONDENCE address row is stored — mirrors correspondenceSameAsHq
-- on judicial_person (Slice #12.01).
--
-- Apply locally:
--   docker cp src/db/migration_038_natural_person_correspondence_same_as_home.sql ga40prj-postgres:/tmp/m038.sql
--   docker exec ga40prj-postgres psql -U postgres -d ga40db -f /tmp/m038.sql
--
-- Apply to Supabase: paste into the SQL Editor.

ALTER TABLE natural_person
  ADD COLUMN IF NOT EXISTS correspondence_same_as_home boolean NOT NULL DEFAULT false;

-- Backfill existing person_version snapshots: insert the new field (as JSON
-- false) into any natural-person snapshot that is missing it. This keeps
-- naturalSnapshotsEqual from seeing a phantom "change" on the first save
-- after the migration.
UPDATE person_version
SET snapshot = jsonb_set(
    snapshot,
    '{natural,correspondenceSameAsHome}',
    'false'::jsonb
  )
WHERE snapshot -> 'natural' IS NOT NULL
  AND (snapshot -> 'natural' -> 'correspondenceSameAsHome') IS NULL;
