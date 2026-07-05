-- migration_055_relationship_roles.sql
--
-- Adds typed relationship roles to the three bare self-reference junction
-- tables (property_property, document_document, person_person).
--
-- Three new lookup tables:
--   lookup_property_property_role  — roles for Property <-> Property
--   lookup_document_document_role  — roles for Document <-> Document
--   lookup_person_person_role      — whitelist of lookup_person_role rows
--                                    usable for Person <-> Person
--
-- A nullable FK column is added to each junction table so existing bare
-- associations are never broken (they just have no role).
--
-- Idempotent: all CREATE TABLE / ALTER TABLE statements use IF NOT EXISTS /
-- ADD COLUMN IF NOT EXISTS, so re-running is safe.

-- ── 1. lookup_property_property_role ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lookup_property_property_role (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  description text,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Seed roles (skipped if table already has rows)
INSERT INTO lookup_property_property_role (name, description, sort_order)
SELECT v.name, v.description, v.sort_order
FROM (VALUES
  ('Adiacent',         'Proprietăți cu latură comună',                         1),
  ('Inclus în',        'O proprietate este parte dintr-o alta',                 2),
  ('Contiguu',         'Proprietăți vecine fără latură comună directă',         3),
  ('Subdiviziune a',   'Parcelă rezultată din dezmembrarea alteia',             4),
  ('Suprapus cu',      'Zone cu suprapunere parțială',                          5),
  ('Acces prin',       'Acces la drum sau utilități prin altă proprietate',     6),
  ('Alipit de',        'Proprietăți unite sau alipite cadastral',               7)
) AS v(name, description, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM lookup_property_property_role LIMIT 1);

-- ── 2. lookup_document_document_role ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lookup_document_document_role (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  description text,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Seed roles (skipped if table already has rows)
INSERT INTO lookup_document_document_role (name, description, sort_order)
SELECT v.name, v.description, v.sort_order
FROM (VALUES
  ('Înlocuiește',         'Document care supersedează un altul',                         1),
  ('Modifică',            'Document cu modificări parțiale față de altul',               2),
  ('Prelungește',         'Document care extinde valabilitatea altuia',                  3),
  ('Anulează',            'Document care desființează un altul',                         4),
  ('Consolidat cu',       'Documente corelate legal',                                    5),
  ('Versiune anterioară a','Formă anterioară a unui document în vigoare',                6),
  ('Anexă la',            'Document atașat ca anexă unui document principal',            7),
  ('Corecție a',          'Document care rectifică erori dintr-un altul',                8)
) AS v(name, description, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM lookup_document_document_role LIMIT 1);

-- ── 3. lookup_person_person_role ──────────────────────────────────────────────
--
-- Whitelist: each row marks a lookup_person_role entry as valid for
-- Person <-> Person associations (same pattern as lookup_property_person_role).

CREATE TABLE IF NOT EXISTS lookup_person_person_role (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  person_role_id uuid        NOT NULL UNIQUE
                             REFERENCES lookup_person_role(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ── 4. FK columns on junction tables ─────────────────────────────────────────

ALTER TABLE property_property
  ADD COLUMN IF NOT EXISTS relationship_role_id uuid
    REFERENCES lookup_property_property_role(id) ON DELETE SET NULL;

ALTER TABLE document_document
  ADD COLUMN IF NOT EXISTS relationship_role_id uuid
    REFERENCES lookup_document_document_role(id) ON DELETE SET NULL;

-- person_person uses the master lookup_person_role directly (filtered in the
-- UI to entries whitelisted in lookup_person_person_role).
ALTER TABLE person_person
  ADD COLUMN IF NOT EXISTS relationship_role_id uuid
    REFERENCES lookup_person_role(id) ON DELETE SET NULL;

-- ── 5. updated_at triggers (same pattern as all other lookup tables) ──────────

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'touch_lookup_property_property_role_updated_at'
  ) THEN
    CREATE TRIGGER touch_lookup_property_property_role_updated_at
      BEFORE UPDATE ON lookup_property_property_role
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'touch_lookup_document_document_role_updated_at'
  ) THEN
    CREATE TRIGGER touch_lookup_document_document_role_updated_at
      BEFORE UPDATE ON lookup_document_document_role
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
END $$;
