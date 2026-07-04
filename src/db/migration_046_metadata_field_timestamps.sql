-- ---------------------------------------------------------------------------
-- migration_046_metadata_field_timestamps.sql  (Slice #19.10.Metadata rev)
--
-- Adds three per-field updated-at timestamps to entity_metadata so the UI
-- can show "last changed N days ago" per field and flag stale values (>90 days).
--
-- Apply locally:
--   docker cp src/db/migration_046_metadata_field_timestamps.sql ga40prj-postgres:/tmp/m046.sql
--   docker exec ga40prj-postgres psql -U postgres -d ga40db -f /tmp/m046.sql
--
-- Apply on Supabase: paste this file into the SQL Editor.
-- ---------------------------------------------------------------------------

ALTER TABLE entity_metadata
  ADD COLUMN IF NOT EXISTS importance_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS relevance_updated_at  timestamptz,
  ADD COLUMN IF NOT EXISTS provenance_updated_at timestamptz;
