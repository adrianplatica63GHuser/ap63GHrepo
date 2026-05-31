-- ---------------------------------------------------------------------------
-- Migration 008 — REPAIR script (local Docker only)
--
-- Run this AFTER migration_008_principal_object.sql partially failed.
-- It cleans up the incomplete property and paperwork backfill, then
-- completes it correctly by blanking existing codes first to avoid
-- unique-constraint conflicts during reassignment.
-- ---------------------------------------------------------------------------

-- 1. Delete any principal_object rows that were created for properties
--    during the failed backfill, and reset those FKs to NULL so we can
--    redo the backfill cleanly.
DELETE FROM principal_object
  WHERE object_type = 'PROPERTY'
    AND id IN (SELECT principal_object_id FROM property WHERE principal_object_id IS NOT NULL);

UPDATE property SET principal_object_id = NULL;

-- 2. Blank all property codes to temporary values so the unique constraint
--    doesn't block reassignment (new codes from the shared seq can collide
--    with existing codes on rows not yet processed).
UPDATE property SET code = 'PROP_TMP_' || id::text;

-- 3. Re-backfill properties.
DO $$
DECLARE
  r        RECORD;
  po_id    UUID;
  new_code TEXT;
BEGIN
  FOR r IN SELECT id FROM property ORDER BY created_at ASC LOOP
    new_code := 'PROP' || lpad(nextval('principal_object_code_seq')::text, 5, '0');
    INSERT INTO principal_object (code, object_type)
      VALUES (new_code, 'PROPERTY')
      RETURNING id INTO po_id;
    UPDATE property
      SET principal_object_id = po_id,
          code                = new_code
      WHERE id = r.id;
  END LOOP;
END;
$$;

-- 4. Same cleanup + redo for paperwork.
DELETE FROM principal_object
  WHERE object_type = 'PAPERWORK'
    AND id IN (SELECT principal_object_id FROM paperwork WHERE principal_object_id IS NOT NULL);

UPDATE paperwork SET principal_object_id = NULL;
UPDATE paperwork SET code = 'PAPR_TMP_' || id::text;

DO $$
DECLARE
  r        RECORD;
  po_id    UUID;
  new_code TEXT;
BEGIN
  FOR r IN SELECT id FROM paperwork ORDER BY created_at ASC LOOP
    new_code := 'PAPR' || lpad(nextval('principal_object_code_seq')::text, 5, '0');
    INSERT INTO principal_object (code, object_type)
      VALUES (new_code, 'PAPERWORK')
      RETURNING id INTO po_id;
    UPDATE paperwork
      SET principal_object_id = po_id,
          code                = new_code
      WHERE id = r.id;
  END LOOP;
END;
$$;

-- 5. Now that all rows are backfilled, enforce NOT NULL.
ALTER TABLE property  ALTER COLUMN principal_object_id SET NOT NULL;
ALTER TABLE paperwork ALTER COLUMN principal_object_id SET NOT NULL;
