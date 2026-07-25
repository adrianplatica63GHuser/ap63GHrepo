-- migration_067_provenance_values.sql
-- Slice #21.07.Import - new provenance value set + automatic assignment.
--
-- Replaces the 6-value provenance list introduced in migration_047 with the
-- 7-value list Adrian specified:
--
--   MANUAL           Manual (Add new)             <- MANUAL          (unchanged)
--   IMAGE            Image (graphics)             <- IMAGE_UPLOAD    (renamed)
--   DOC_FILE         PDF/DOC/TXT                  <- TEXT_FILE       (split)
--   COORDINATE_FILE  Coordinate file (.txt)       <- TEXT_FILE       (split)
--   ALGORITHM        Calculated (algorithm)       <- ALGORITHM       (unchanged)
--   AI_INTERPRETED   AI interpretation            <- AI_INTERPRETED  (unchanged)
--   EXTERNAL_FEED    External feed                <- EXTERNAL_IMPORT (renamed)
--
-- IMAGE_UPLOAD is renamed rather than kept because its meaning narrowed: PDFs
-- used to fall under it and now belong to DOC_FILE, so the old code would lie.
--
-- The TEXT_FILE split is by principal object type, per Adrian's decision:
--   PROPERTY / DOCUMENT -> COORDINATE_FILE
--       Today the ONLY writer of TEXT_FILE is POST /api/documents/[id]/process,
--       which sets it on the cadastral .txt document it just parsed and (from
--       this slice on) on the Property built from it. Both are genuinely
--       coordinate-file provenance.
--   PERSON -> DOC_FILE
--       No code path produces this combination; the fallback exists only so
--       hand-edited or seeded rows cannot survive as an invalid value and
--       break the new CHECK constraint.
--
-- No backfill of NULL provenance (Adrian's decision) - only newly imported
-- objects get automatic provenance from here on.
--
-- The remap must touch THREE places or the app breaks:
--   1. entity_metadata.provenance          - the live value
--   2. entity_provenance_log.method        - the history rows
--   3. entity_metadata_version.snapshot    - the JSONB version snapshots
-- (3) is the easy one to miss: "Make this version current" re-saves a stored
-- snapshot, so a snapshot still holding 'TEXT_FILE' would be rejected by the
-- new CHECK constraint at restore time, long after this migration ran.
--
-- Idempotent: the CHECK is dropped before the remap and recreated after, and
-- every UPDATE matches only the old codes, which no longer exist on re-run.

-- ---------------------------------------------------------------------------
-- 1. Drop the old CHECK so the remap can run
-- ---------------------------------------------------------------------------

ALTER TABLE entity_metadata DROP CONSTRAINT IF EXISTS chk_em_provenance;

-- ---------------------------------------------------------------------------
-- 2. entity_metadata.provenance
-- ---------------------------------------------------------------------------

UPDATE entity_metadata SET provenance = 'IMAGE'
 WHERE provenance = 'IMAGE_UPLOAD';

UPDATE entity_metadata SET provenance = 'EXTERNAL_FEED'
 WHERE provenance = 'EXTERNAL_IMPORT';

UPDATE entity_metadata em SET provenance = 'COORDINATE_FILE'
  FROM principal_object po
 WHERE po.id = em.principal_object_id
   AND em.provenance = 'TEXT_FILE'
   AND po.object_type IN ('PROPERTY', 'DOCUMENT');

-- Fallback for any remaining TEXT_FILE (PERSON, or an orphaned row).
UPDATE entity_metadata SET provenance = 'DOC_FILE'
 WHERE provenance = 'TEXT_FILE';

-- ---------------------------------------------------------------------------
-- 3. entity_provenance_log.method  (historical values, same remap)
-- ---------------------------------------------------------------------------

UPDATE entity_provenance_log SET method = 'IMAGE'
 WHERE method = 'IMAGE_UPLOAD';

UPDATE entity_provenance_log SET method = 'EXTERNAL_FEED'
 WHERE method = 'EXTERNAL_IMPORT';

UPDATE entity_provenance_log epl SET method = 'COORDINATE_FILE'
  FROM entity_metadata em
  JOIN principal_object po ON po.id = em.principal_object_id
 WHERE em.id = epl.entity_metadata_id
   AND epl.method = 'TEXT_FILE'
   AND po.object_type IN ('PROPERTY', 'DOCUMENT');

UPDATE entity_provenance_log SET method = 'DOC_FILE'
 WHERE method = 'TEXT_FILE';

-- ---------------------------------------------------------------------------
-- 4. entity_metadata_version.snapshot->>'provenance'
-- ---------------------------------------------------------------------------

UPDATE entity_metadata_version
   SET snapshot = jsonb_set(snapshot, '{provenance}', '"IMAGE"'::jsonb)
 WHERE snapshot->>'provenance' = 'IMAGE_UPLOAD';

UPDATE entity_metadata_version
   SET snapshot = jsonb_set(snapshot, '{provenance}', '"EXTERNAL_FEED"'::jsonb)
 WHERE snapshot->>'provenance' = 'EXTERNAL_IMPORT';

UPDATE entity_metadata_version emv
   SET snapshot = jsonb_set(emv.snapshot, '{provenance}', '"COORDINATE_FILE"'::jsonb)
  FROM entity_metadata em
  JOIN principal_object po ON po.id = em.principal_object_id
 WHERE em.id = emv.entity_metadata_id
   AND emv.snapshot->>'provenance' = 'TEXT_FILE'
   AND po.object_type IN ('PROPERTY', 'DOCUMENT');

UPDATE entity_metadata_version
   SET snapshot = jsonb_set(snapshot, '{provenance}', '"DOC_FILE"'::jsonb)
 WHERE snapshot->>'provenance' = 'TEXT_FILE';

-- ---------------------------------------------------------------------------
-- 5. Recreate the CHECK with the new value set
-- ---------------------------------------------------------------------------

ALTER TABLE entity_metadata
  ADD CONSTRAINT chk_em_provenance
    CHECK (provenance IN (
      'MANUAL', 'IMAGE', 'DOC_FILE', 'COORDINATE_FILE',
      'ALGORITHM', 'AI_INTERPRETED', 'EXTERNAL_FEED'
    ));

-- ---------------------------------------------------------------------------
-- 6. Sanity report (visible in the psql output when applied)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  stale integer;
BEGIN
  SELECT count(*) INTO stale
    FROM entity_metadata
   WHERE provenance IN ('IMAGE_UPLOAD', 'TEXT_FILE', 'EXTERNAL_IMPORT');
  RAISE NOTICE 'migration_067: % stale provenance value(s) remaining in entity_metadata (expected 0)', stale;

  SELECT count(*) INTO stale
    FROM entity_metadata_version
   WHERE snapshot->>'provenance' IN ('IMAGE_UPLOAD', 'TEXT_FILE', 'EXTERNAL_IMPORT');
  RAISE NOTICE 'migration_067: % stale provenance value(s) remaining in version snapshots (expected 0)', stale;
END $$;
