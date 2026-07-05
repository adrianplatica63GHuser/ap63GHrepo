-- migration_052_drop_dead_document_columns.sql
--
-- 1. Drop free-text columns from document that are no longer used
--    (replaced by FK relationships and the linked-persons pattern).
-- 2. Drop lookup_others rows for Services (Serviciu) and Interests (Interes)
--    categories, which are no longer exposed in the UI.
--
-- Safe to run multiple times (IF EXISTS / no rows left to delete).

BEGIN;

ALTER TABLE document
  DROP COLUMN IF EXISTS titular_text,
  DROP COLUMN IF EXISTS defunct_text,
  DROP COLUMN IF EXISTS parties_a_text,
  DROP COLUMN IF EXISTS parties_b_text,
  DROP COLUMN IF EXISTS institution;

DELETE FROM lookup_others WHERE category IN ('Serviciu', 'Interes');

COMMIT;
