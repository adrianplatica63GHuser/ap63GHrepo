-- migration_022_judicial_person_types.sql
--
-- Slice #15.07 — Judicial Person Types: enum -> admin-managed lookup table
--
-- Replaces the fixed `judicial_type` Postgres enum (SRL/SA/SRL_D/PFA/II/IF/
-- ONG/OTHER) with a new `lookup_judicial_person_type` table, managed via
-- Administration -> Reference Data -> "Judicial Person Types". Going
-- forward, new judicial person types are added by Adrian via that UI —
-- never auto-seeded or hardcoded again (same standing rule as Document
-- Types from Slice #15.05).
--
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. New lookup table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS lookup_judicial_person_type (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  sort_order integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER touch_updated_at_lookup_judicial_person_type
  BEFORE UPDATE ON lookup_judicial_person_type
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Seed the 8 values that previously made up the judicial_type enum, in
-- their original display order.
INSERT INTO lookup_judicial_person_type (name, sort_order) VALUES
  ('SRL',    1),
  ('SA',     2),
  ('SRL-D',  3),
  ('PFA',    4),
  ('II',     5),
  ('IF',     6),
  ('ONG',    7),
  ('Altele', 8)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. New FK column on judicial_person
-- ---------------------------------------------------------------------------

ALTER TABLE judicial_person
  ADD COLUMN IF NOT EXISTS judicial_person_type_id uuid
    REFERENCES lookup_judicial_person_type(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 3. Backfill from the old enum column by name match
--    (only if judicial_type still exists — guards re-running this file
--    after a previous run already dropped it in step 4)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'judicial_person' AND column_name = 'judicial_type'
  ) THEN
    UPDATE judicial_person jp
    SET judicial_person_type_id = lt.id
    FROM lookup_judicial_person_type lt
    WHERE jp.judicial_person_type_id IS NULL
      AND jp.judicial_type IS NOT NULL
      AND lt.name = CASE jp.judicial_type::text
        WHEN 'SRL'   THEN 'SRL'
        WHEN 'SA'    THEN 'SA'
        WHEN 'SRL_D' THEN 'SRL-D'
        WHEN 'PFA'   THEN 'PFA'
        WHEN 'II'    THEN 'II'
        WHEN 'IF'    THEN 'IF'
        WHEN 'ONG'   THEN 'ONG'
        WHEN 'OTHER' THEN 'Altele'
      END;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Drop the old enum column and the enum type itself
-- ---------------------------------------------------------------------------

ALTER TABLE judicial_person DROP COLUMN IF EXISTS judicial_type;

DROP TYPE IF EXISTS judicial_type;
