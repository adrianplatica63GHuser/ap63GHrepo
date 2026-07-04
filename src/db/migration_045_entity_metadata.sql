-- ---------------------------------------------------------------------------
-- migration_045_entity_metadata.sql  (Slice #19.10.Metadata)
--
-- Creates the `entity_metadata` table: one optional row per principal_object.
-- Stores three subjective metadata fields per entity:
--   importance       — LOW | MEDIUM | HIGH
--   relevance        — OBSOLETE | HISTORICAL | CURRENT | FUTURE
--   provenance       — how the item entered the system (current value)
--   provenance_history — [{method, date}] array, oldest first; appended
--                        automatically when provenance changes
--
-- Apply locally:
--   docker cp src/db/migration_045_entity_metadata.sql ga40prj-postgres:/tmp/m045.sql
--   docker exec ga40prj-postgres psql -U postgres -d ga40db -f /tmp/m045.sql
--
-- Apply on Supabase: paste this file into the SQL Editor.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS entity_metadata (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_object_id uuid        NOT NULL UNIQUE
                                    REFERENCES principal_object(id) ON DELETE CASCADE,
  importance          text,
  relevance           text,
  provenance          text,
  provenance_history  jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Reuse the existing touch_updated_at trigger function (created in an earlier
-- migration) so updated_at stays current on every UPDATE.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'touch_updated_at_entity_metadata'
      AND tgrelid = 'entity_metadata'::regclass
  ) THEN
    CREATE TRIGGER touch_updated_at_entity_metadata
      BEFORE UPDATE ON entity_metadata
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
END $$;
