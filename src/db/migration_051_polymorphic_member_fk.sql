-- migration_051_polymorphic_member_fk.sql
--
-- Replaces the 3 nullable typed FK columns (property_id, person_id, document_id)
-- on group_member and stamp_member with a single principal_object_id FK that
-- points directly to the principal_object table.  This is the correct pattern
-- already used by entity_cross_reference, entity_tag, and entity_metadata.
--
-- Apply locally:
--   docker cp src/db/migration_051_polymorphic_member_fk.sql ga40prj-postgres:/tmp/m051.sql
--   docker exec ga40prj-postgres psql -U postgres -d ga40db -f /tmp/m051.sql
--
-- Apply on Supabase: paste directly into the SQL Editor.
--
-- Safety: the whole migration runs in a single transaction. If the pre-flight
-- orphan check finds rows whose entity no longer exists, or if the backfill
-- leaves any NULL principal_object_id, the transaction is rolled back with a
-- clear RAISE EXCEPTION message and no permanent changes are made.

BEGIN;

-- ===========================================================================
-- Pre-flight orphan check
-- ===========================================================================
-- Abort if any group_member or stamp_member row references an entity row that
-- no longer exists (which would prevent the NOT NULL backfill from succeeding).

DO $$
DECLARE
  orphan_count integer;
BEGIN
  -- group_member orphans
  SELECT count(*) INTO orphan_count
  FROM group_member gm
  WHERE
    (gm.property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM property p WHERE p.id = gm.property_id))
    OR (gm.person_id   IS NOT NULL AND NOT EXISTS (SELECT 1 FROM person   p WHERE p.id = gm.person_id))
    OR (gm.document_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM document d WHERE d.id = gm.document_id));

  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      'migration_051 aborted: % orphaned group_member row(s) found. '
      'Resolve the orphans before re-running this migration.',
      orphan_count;
  END IF;

  -- stamp_member orphans
  SELECT count(*) INTO orphan_count
  FROM stamp_member sm
  WHERE
    (sm.property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM property p WHERE p.id = sm.property_id))
    OR (sm.person_id   IS NOT NULL AND NOT EXISTS (SELECT 1 FROM person   p WHERE p.id = sm.person_id))
    OR (sm.document_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM document d WHERE d.id = sm.document_id));

  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      'migration_051 aborted: % orphaned stamp_member row(s) found. '
      'Resolve the orphans before re-running this migration.',
      orphan_count;
  END IF;
END $$;

-- ===========================================================================
-- group_member
-- ===========================================================================

-- 1. Add the new column (nullable during backfill).
ALTER TABLE group_member
  ADD COLUMN IF NOT EXISTS principal_object_id UUID
    REFERENCES principal_object(id) ON DELETE CASCADE;

-- 2. Backfill: resolve principal_object_id from the appropriate entity table.
UPDATE group_member gm
SET principal_object_id = p.principal_object_id
FROM property p
WHERE gm.property_id = p.id
  AND gm.principal_object_id IS NULL;

UPDATE group_member gm
SET principal_object_id = pe.principal_object_id
FROM person pe
WHERE gm.person_id = pe.id
  AND gm.principal_object_id IS NULL;

UPDATE group_member gm
SET principal_object_id = d.principal_object_id
FROM document d
WHERE gm.document_id = d.id
  AND gm.principal_object_id IS NULL;

-- 3. Verify no NULLs remain before locking in NOT NULL.
DO $$
DECLARE null_count integer;
BEGIN
  SELECT count(*) INTO null_count FROM group_member WHERE principal_object_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION
      'migration_051 aborted: % group_member row(s) still have NULL principal_object_id '
      'after backfill. All rows must have exactly one of property_id / person_id / document_id set.',
      null_count;
  END IF;
END $$;

-- 4. Enforce NOT NULL.
ALTER TABLE group_member
  ALTER COLUMN principal_object_id SET NOT NULL;

-- 5. Drop the old per-type unique indexes.
DROP INDEX IF EXISTS group_member_group_property_unique;
DROP INDEX IF EXISTS group_member_group_person_unique;
DROP INDEX IF EXISTS group_member_group_document_unique;

-- 6. Add the new unified unique index: one principal object per group.
CREATE UNIQUE INDEX IF NOT EXISTS group_member_group_principal_object_unique
  ON group_member (group_id, principal_object_id);

-- 7. Drop the old typed FK columns.
ALTER TABLE group_member
  DROP COLUMN IF EXISTS property_id,
  DROP COLUMN IF EXISTS person_id,
  DROP COLUMN IF EXISTS document_id;

-- ===========================================================================
-- stamp_member
-- ===========================================================================

-- 1. Add the new column (nullable during backfill).
ALTER TABLE stamp_member
  ADD COLUMN IF NOT EXISTS principal_object_id UUID
    REFERENCES principal_object(id) ON DELETE CASCADE;

-- 2. Backfill.
UPDATE stamp_member sm
SET principal_object_id = p.principal_object_id
FROM property p
WHERE sm.property_id = p.id
  AND sm.principal_object_id IS NULL;

UPDATE stamp_member sm
SET principal_object_id = pe.principal_object_id
FROM person pe
WHERE sm.person_id = pe.id
  AND sm.principal_object_id IS NULL;

UPDATE stamp_member sm
SET principal_object_id = d.principal_object_id
FROM document d
WHERE sm.document_id = d.id
  AND sm.principal_object_id IS NULL;

-- 3. Verify.
DO $$
DECLARE null_count integer;
BEGIN
  SELECT count(*) INTO null_count FROM stamp_member WHERE principal_object_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION
      'migration_051 aborted: % stamp_member row(s) still have NULL principal_object_id '
      'after backfill.',
      null_count;
  END IF;
END $$;

-- 4. NOT NULL.
ALTER TABLE stamp_member
  ALTER COLUMN principal_object_id SET NOT NULL;

-- 5. Drop old per-type unique and lookup indexes.
DROP INDEX IF EXISTS stamp_member_stamp_person_unique;
DROP INDEX IF EXISTS stamp_member_stamp_property_unique;
DROP INDEX IF EXISTS stamp_member_stamp_document_unique;
DROP INDEX IF EXISTS stamp_member_person_idx;
DROP INDEX IF EXISTS stamp_member_property_idx;
DROP INDEX IF EXISTS stamp_member_document_idx;

-- 6. New unified unique index: a stamp can be applied only once per entity.
CREATE UNIQUE INDEX IF NOT EXISTS stamp_member_stamp_principal_object_unique
  ON stamp_member (stamp_id, principal_object_id);

-- Lookup index: fast "all stamps on a given principal object".
CREATE INDEX IF NOT EXISTS stamp_member_principal_object_idx
  ON stamp_member (principal_object_id);

-- 7. Drop old typed FK columns.
ALTER TABLE stamp_member
  DROP COLUMN IF EXISTS property_id,
  DROP COLUMN IF EXISTS person_id,
  DROP COLUMN IF EXISTS document_id;

COMMIT;
