-- Slice #15.06 — keep alternate Romanian wordings as distinct document types
--
-- Slice #15.05 dropped the paperwork_type enum and collapsed each of its 21
-- values to a single canonical (key, name) row in lookup_document_type. Three
-- of those enum values had two different Romanian wordings in active use
-- across the codebase before the rename — one baked into the old i18n
-- labels (messages/*.json -> document.types.*, now unused dead strings),
-- a different one already corrected into the DB by earlier diacritics-fix
-- migrations. Per Adrian, these read as different enough documents to keep
-- both as separate, independently selectable types rather than picking a
-- winner:
--
--   AUTORIZATIE            -> 'Autorizare'                (already in DB)
--   AUTORIZATIE_ALT        -> 'Autorizație'                (added here)
--   CERTIFICAT_SARCINI     -> 'Certificat de Bunuri'       (already in DB)
--   CERTIFICAT_SARCINI_ALT -> 'Certificat de Sarcini'      (added here)
--   EXTRAS_CARTE_FUNCIARA     -> 'Extras din Carte Funciară' (already in DB)
--   EXTRAS_CARTE_FUNCIARA_ALT -> 'Extras de Carte Funciară'  (added here)
--
-- New rows only — nothing existing is renamed or removed, so no live
-- Document rows are affected.
--
-- Idempotent — safe to re-run.
--
-- Apply via:
--   docker cp src/db/migration_021_keep_alternate_wordings.sql ga40prj-postgres:/tmp/m021.sql
--   docker exec ga40prj-postgres psql -U postgres -d ga40db -f /tmp/m021.sql

INSERT INTO lookup_document_type (key, name, sort_order)
SELECT 'AUTORIZATIE_ALT', 'Autorizație', (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM lookup_document_type)
WHERE NOT EXISTS (SELECT 1 FROM lookup_document_type WHERE key = 'AUTORIZATIE_ALT');

INSERT INTO lookup_document_type (key, name, sort_order)
SELECT 'CERTIFICAT_SARCINI_ALT', 'Certificat de Sarcini', (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM lookup_document_type)
WHERE NOT EXISTS (SELECT 1 FROM lookup_document_type WHERE key = 'CERTIFICAT_SARCINI_ALT');

INSERT INTO lookup_document_type (key, name, sort_order)
SELECT 'EXTRAS_CARTE_FUNCIARA_ALT', 'Extras de Carte Funciară', (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM lookup_document_type)
WHERE NOT EXISTS (SELECT 1 FROM lookup_document_type WHERE key = 'EXTRAS_CARTE_FUNCIARA_ALT');
