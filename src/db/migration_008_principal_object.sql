-- ---------------------------------------------------------------------------
-- Migration 008 — principal_object base class + shared code counter
--
-- Apply to:  local Docker Postgres  →  psql / pgAdmin
--            Supabase               →  Supabase SQL editor
--
-- What this does:
--   1. Creates the `principal_object_type` enum.
--   2. Creates the `principal_object` table.
--   3. Creates the single shared sequence `principal_object_code_seq`.
--   4. Adds a nullable `principal_object_id` FK column to person, property,
--      and paperwork.
--   5. Drops the old DEFAULT expressions that referenced the per-table
--      sequences (person_code_seq, property_code_seq, paperwork_code_seq).
--   6. Backfills all three domain tables: each existing row gets a new
--      principal_object row; codes are re-assigned from 1 (shared counter,
--      ordered by created_at within each type — persons first, then
--      properties, then paperwork).
--   7. Sets principal_object_id NOT NULL + UNIQUE on all three tables.
--   8. Drops the now-obsolete per-table sequences.
-- ---------------------------------------------------------------------------

-- 1. Enum
CREATE TYPE principal_object_type AS ENUM ('PERSON', 'PROPERTY', 'PAPERWORK');

-- 2. Table
CREATE TABLE principal_object (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT        NOT NULL UNIQUE,
  object_type principal_object_type NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Shared sequence (starts at 1)
CREATE SEQUENCE principal_object_code_seq START 1;

-- 4. Add nullable FK columns
ALTER TABLE person    ADD COLUMN principal_object_id UUID REFERENCES principal_object(id);
ALTER TABLE property  ADD COLUMN principal_object_id UUID REFERENCES principal_object(id);
ALTER TABLE paperwork ADD COLUMN principal_object_id UUID REFERENCES principal_object(id);

-- 5. Drop old DEFAULT expressions (sequences still exist temporarily for step 6)
ALTER TABLE person    ALTER COLUMN code DROP DEFAULT;
ALTER TABLE property  ALTER COLUMN code DROP DEFAULT;
ALTER TABLE paperwork ALTER COLUMN code DROP DEFAULT;

-- 6a. Backfill — Persons (ordered by created_at)
DO $$
DECLARE
  r        RECORD;
  po_id    UUID;
  new_code TEXT;
BEGIN
  FOR r IN SELECT id FROM person ORDER BY created_at ASC LOOP
    new_code := 'PERS' || lpad(nextval('principal_object_code_seq')::text, 5, '0');
    INSERT INTO principal_object (code, object_type)
      VALUES (new_code, 'PERSON')
      RETURNING id INTO po_id;
    UPDATE person
      SET principal_object_id = po_id,
          code                = new_code
      WHERE id = r.id;
  END LOOP;
END;
$$;

-- 6b. Backfill — Properties (ordered by created_at)
DO $$
DECLARE
  r        RECORD;
  po_id    UUID;
  new_code TEXT;
BEGIN
  -- Blank existing codes first. Without this, new codes drawn from the shared
  -- sequence (which starts after all persons) can coincide with codes that
  -- still exist on unprocessed property rows, causing a unique-constraint
  -- violation mid-loop.
  UPDATE property SET code = 'PROP_TMP_' || id::text;

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

-- 6c. Backfill — Paperwork (ordered by created_at)
DO $$
DECLARE
  r        RECORD;
  po_id    UUID;
  new_code TEXT;
BEGIN
  -- Same reason as above — blank codes first to avoid mid-loop collisions.
  UPDATE paperwork SET code = 'PAPR_TMP_' || id::text;

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

-- 7. Enforce NOT NULL + UNIQUE on FK columns
ALTER TABLE person    ALTER COLUMN principal_object_id SET NOT NULL;
ALTER TABLE property  ALTER COLUMN principal_object_id SET NOT NULL;
ALTER TABLE paperwork ALTER COLUMN principal_object_id SET NOT NULL;

ALTER TABLE person    ADD CONSTRAINT person_principal_object_id_unique    UNIQUE (principal_object_id);
ALTER TABLE property  ADD CONSTRAINT property_principal_object_id_unique  UNIQUE (principal_object_id);
ALTER TABLE paperwork ADD CONSTRAINT paperwork_principal_object_id_unique UNIQUE (principal_object_id);

-- 8. Drop the now-obsolete per-table sequences
DROP SEQUENCE person_code_seq;
DROP SEQUENCE property_code_seq;
DROP SEQUENCE paperwork_code_seq;
