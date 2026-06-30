-- migration_036_natural_person_physical_type.sql
--
-- Adds a "Professional Type" (Tip Profesional) field to the natural person
-- form, backed by the admin-managed lookup_person_type table (Slice #18.16.VL).
--
-- Apply locally:
--   docker cp src/db/migration_036_natural_person_physical_type.sql ga40prj-postgres:/tmp/m036.sql
--   docker exec ga40prj-postgres psql -U postgres -d ga40db -f /tmp/m036.sql
-- Apply on Supabase: paste into SQL Editor.

BEGIN;

-- 1. Add the FK column to natural_person (nullable; ON DELETE SET NULL).
ALTER TABLE natural_person
  ADD COLUMN IF NOT EXISTS physical_person_type_id uuid
    REFERENCES lookup_person_type(id) ON DELETE SET NULL;

-- 2. Backfill existing person_version snapshots for NATURAL persons:
--    add `physicalPersonTypeId: null` inside the `natural` sub-object.
--    Only touches NATURAL snapshots that do not already have the key
--    (idempotent re-run).
UPDATE person_version pv
SET snapshot = jsonb_set(
  pv.snapshot,
  '{natural,physicalPersonTypeId}',
  'null'::jsonb,
  true   -- create_missing = true
)
FROM person p
WHERE p.id = pv.person_id
  AND p.type = 'NATURAL'
  AND NOT (pv.snapshot->'natural' ? 'physicalPersonTypeId');

COMMIT;
