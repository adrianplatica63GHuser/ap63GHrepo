-- Slice 14.15.01 — Import / Classify foundation
--
-- 1. New paperwork_type values:
--      CARTE_IDENTITATE — a scanned ID card, stored as a Document (reuses
--                         paperwork + paperwork_page + person_paperwork; no
--                         new table). Inserted after AVIZ_INSTITUTIE to keep
--                         the existing alphabetical-ish ordering.
--      UNCLASSIFIED     — fallback type for a Document of unknown kind.
-- 2. "Unclassified" row added to lookup_document_type (the decoupled
--    reference list used only for Document Persons admin associations).
-- 3. New natural_person columns for fields read off a Romanian ID card that
--    have no existing home, plus a citizenship FK.
--
-- Idempotent — safe to re-run.
--
-- IMPORTANT: each ALTER TYPE ... ADD VALUE must run as its own statement
-- outside an explicit transaction block (PostgreSQL restriction on enum
-- alteration). Apply this file with `psql -f` (not wrapped in BEGIN/COMMIT).

ALTER TYPE paperwork_type ADD VALUE IF NOT EXISTS 'CARTE_IDENTITATE' AFTER 'AVIZ_INSTITUTIE';
ALTER TYPE paperwork_type ADD VALUE IF NOT EXISTS 'UNCLASSIFIED';

-- lookup_document_type has no unique constraint on name, so guard manually.
INSERT INTO lookup_document_type (name, sort_order)
SELECT 'Unclassified', (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM lookup_document_type)
WHERE NOT EXISTS (SELECT 1 FROM lookup_document_type WHERE name = 'Unclassified');

ALTER TABLE natural_person ADD COLUMN IF NOT EXISTS place_of_birth text;
ALTER TABLE natural_person ADD COLUMN IF NOT EXISTS id_issuing_authority text;
ALTER TABLE natural_person ADD COLUMN IF NOT EXISTS id_valid_from date;
ALTER TABLE natural_person ADD COLUMN IF NOT EXISTS id_valid_until date;
ALTER TABLE natural_person ADD COLUMN IF NOT EXISTS id_card_number text;
ALTER TABLE natural_person ADD COLUMN IF NOT EXISTS id_mrz_raw text;
ALTER TABLE natural_person ADD COLUMN IF NOT EXISTS citizenship_id uuid REFERENCES lookup_citizenship(id) ON DELETE SET NULL;
