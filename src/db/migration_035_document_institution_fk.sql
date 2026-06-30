-- migration_035_document_institution_fk.sql
--
-- Wires the Document "Institutie inregistrare" field to the admin-managed
-- lookup_institution table (Slice #18.16.VL).
--
-- Before: document.institution  TEXT (free-form)
-- After:  document.institution_id UUID FK -> lookup_institution (nullable)
--
-- The old `institution` text column is left in place (nullable) for backward
-- compatibility; its values are not migrated (free text cannot auto-map to
-- UUIDs). New writes go to institution_id exclusively.
--
-- Existing document_version snapshots are backfilled to rename the
-- `institution` key to `institutionId: null` so that the JS snapshot shape
-- stays in lockstep with the new DocumentSnapshot type.
--
-- Apply locally:
--   docker cp src/db/migration_035_document_institution_fk.sql ga40prj-postgres:/tmp/m035.sql
--   docker exec ga40prj-postgres psql -U postgres -d ga40db -f /tmp/m035.sql
-- Apply on Supabase: paste into SQL Editor.

BEGIN;

-- 1. Add the FK column (nullable; ON DELETE SET NULL so removing an institution
--    from Reference Data just clears the tag rather than blocking the delete).
ALTER TABLE document
  ADD COLUMN IF NOT EXISTS institution_id uuid
    REFERENCES lookup_institution(id) ON DELETE SET NULL;

-- 2. Backfill existing document_version snapshots:
--    rename the snapshot key `institution` -> `institutionId` (value = null).
--    Old free-text values cannot be mapped to UUIDs so they are discarded.
--    Rows that already have `institutionId` are left untouched (idempotent).
UPDATE document_version
SET snapshot = (snapshot - 'institution') || '{"institutionId": null}'::jsonb
WHERE snapshot ? 'institution'
  AND NOT (snapshot ? 'institutionId');

COMMIT;
