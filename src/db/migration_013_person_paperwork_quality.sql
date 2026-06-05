-- migration_013_person_paperwork_quality.sql
--
-- Adds an optional `quality` column to the person_paperwork junction table.
-- Used by Certificat de Moștenitor to tag each linked person as
-- 'DEFUNCT' (the deceased) or 'MOSTENITOR' (an inheritor).
-- NULL is valid for persons linked via the general Persons tab on any
-- document type.
--
-- Idempotent: safe to re-run.

ALTER TABLE person_paperwork ADD COLUMN IF NOT EXISTS quality TEXT;
