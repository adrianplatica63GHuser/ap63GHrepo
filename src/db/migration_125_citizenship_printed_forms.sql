-- migration_125_citizenship_printed_forms.sql
-- Slice 41.52 - „Cetățenie" learns the forms a document prints: „Forme tipărite".
--
-- WHY
--   Adrian, 2026-11-02: on a „Carte de Identitate (tip nou)" „Cetățenia" is printed „Română / ROU" (the same on a
--   Pașaport and a Pașaport CRDS): „please implement the ability of the system To accept values of this kind, store
--   them, and display them as original … Feel free to add management Functions under value lists, please choose
--   something that makes sense and and is not complicated".
--
-- WHAT THIS DOES
--   lookup_citizenship.printed_forms (new, text, nullable): the forms a document may print for this citizenship,
--   comma-separated — „ROU, ROUMAINE". Edited in Reference data beside the name. The ID-card import reads it beside
--   the code's own aliases (src/lib/import/lookup-name-match.ts), which stay. Added empty.
--
-- NOT DESTRUCTIVE
--   One nullable column, no value written. The identity document's „Cetățenia" already stores the printed text as it
--   is (identity_document.nationality, migration_118); nothing about it changes.

BEGIN;

ALTER TABLE lookup_citizenship ADD COLUMN IF NOT EXISTS printed_forms text;
COMMENT ON COLUMN lookup_citizenship.printed_forms IS
  'Slice 41.52: „Forme tipărite" - what an identity document may print for this citizenship, comma-separated (ROU, ROUMAINE). The import recognises them.';

COMMIT;
