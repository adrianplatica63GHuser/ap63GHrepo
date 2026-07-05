-- migration_052_drop_dead_document_columns.sql
--
-- 1. Drop free-text columns from document that are no longer used
--    (replaced by FK relationships and the linked-persons pattern).
-- 2. Drop the lookup_others table entirely — all three categories
--    (Serviciu, Interes, Stampila) are obsolete:
--      - Services and Interests: removed from UI; no replacement needed.
--      - Stamps: superseded by the dedicated stamps/stamp_member tables
--        (Slice #19.09); the old lookup_others stamp names are discarded.
--
-- Safe to run multiple times (IF EXISTS guards).

BEGIN;

ALTER TABLE document
  DROP COLUMN IF EXISTS titular_text,
  DROP COLUMN IF EXISTS defunct_text,
  DROP COLUMN IF EXISTS parties_a_text,
  DROP COLUMN IF EXISTS parties_b_text,
  DROP COLUMN IF EXISTS institution;

DROP TABLE IF EXISTS lookup_others;

COMMIT;
