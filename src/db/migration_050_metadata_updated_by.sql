-- migration_050_metadata_updated_by.sql
--
-- Add updated_by column to entity_metadata.
-- Stores the email/identifier of the last user to save any metadata field.
-- NULL for rows written before this migration (no backfill is needed or possible).

ALTER TABLE entity_metadata
  ADD COLUMN IF NOT EXISTS updated_by text;

-- Confirm
SELECT column_name, data_type, is_nullable
FROM   information_schema.columns
WHERE  table_name = 'entity_metadata'
  AND  column_name = 'updated_by';
