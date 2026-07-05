-- migration_056_person_document_quality_check.sql
--
-- Adds a CHECK constraint to person_document.quality so the DB enforces
-- that only the two legal values ('DEFUNCT', 'MOSTENITOR') or NULL are ever
-- stored.  NULL is valid for general (non-Certificat de Mostenitor) links.
--
-- Slice #19.24

ALTER TABLE person_document
  ADD CONSTRAINT person_document_quality_check
  CHECK (quality IS NULL OR quality IN ('DEFUNCT', 'MOSTENITOR'));
