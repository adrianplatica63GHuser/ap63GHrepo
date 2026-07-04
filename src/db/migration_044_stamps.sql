-- migration_044_stamps.sql  (Slice #19.09.Stamps)
--
-- Creates the stamps + stamp_member tables and a sequence for code allocation.
-- Stamps can be applied to items of any target type (PHYSICAL_PERSON,
-- JUDICIAL_PERSON, PROPERTY, DOCUMENT) — unlike groups which are single-type.
--
-- Apply locally:
--   docker cp src/db/migration_044_stamps.sql ga40prj-postgres:/tmp/m044.sql
--   docker exec ga40prj-postgres psql -U postgres -d ga40db -f /tmp/m044.sql
-- Apply to Supabase: paste into the SQL Editor.

-- ---------------------------------------------------------------------------
-- Sequence for stamp codes (STMP-AAA … STMP-ZZZ)
-- 3-letter codes from the 24-letter group alphabet (I and O excluded).
-- Codes are NEVER reused — the sequence only moves forward.
-- ---------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS stamp_code_seq START 1;

-- ---------------------------------------------------------------------------
-- stamps — one row per stamp
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS stamps (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code             TEXT        NOT NULL UNIQUE,
  short_description TEXT       NOT NULL,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reuse the existing touch_updated_at trigger function (created in earlier
-- migrations) so updated_at stays current on every UPDATE.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'touch_updated_at_stamps'
      AND tgrelid = 'stamps'::regclass
  ) THEN
    CREATE TRIGGER touch_updated_at_stamps
      BEFORE UPDATE ON stamps
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- stamp_member — one row per stamped item
-- ---------------------------------------------------------------------------
-- Exactly one of person_id / property_id / document_id is non-NULL per row,
-- matching target_type. The partial unique indexes below enforce the
-- "a stamp can be applied only once per item" constraint.
-- target_type reuses the existing group_target_type enum.

CREATE TABLE IF NOT EXISTS stamp_member (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  stamp_id    UUID        NOT NULL REFERENCES stamps(id) ON DELETE CASCADE,
  target_type group_target_type NOT NULL,
  person_id   UUID        REFERENCES person(id)   ON DELETE CASCADE,
  property_id UUID        REFERENCES property(id) ON DELETE CASCADE,
  document_id UUID        REFERENCES document(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A stamp can only be applied once per person / property / document.
CREATE UNIQUE INDEX IF NOT EXISTS stamp_member_stamp_person_unique
  ON stamp_member (stamp_id, person_id)
  WHERE person_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS stamp_member_stamp_property_unique
  ON stamp_member (stamp_id, property_id)
  WHERE property_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS stamp_member_stamp_document_unique
  ON stamp_member (stamp_id, document_id)
  WHERE document_id IS NOT NULL;

-- Index for fast lookup "all stamps on a given property/person/document"
CREATE INDEX IF NOT EXISTS stamp_member_person_idx   ON stamp_member (person_id)   WHERE person_id   IS NOT NULL;
CREATE INDEX IF NOT EXISTS stamp_member_property_idx ON stamp_member (property_id) WHERE property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS stamp_member_document_idx ON stamp_member (document_id) WHERE document_id IS NOT NULL;
