-- migration_119_drop_person_id_card_columns.sql
-- FU-366 - natural_person's seven identity-card columns are dropped.
--
-- WHY
--   Since Slice 40.82 a person's identity card or passport is a document of its own (identity_document, migration_118),
--   and since Slice 40.85 no screen, API, matching rule or deed reader reads or writes natural_person's id_* columns.
--   FU-366 asked whether they could be dropped; Adrian, 2026-10-27: „yes, natural_person's seven old ID-card columns
--   can be dropped".
--
-- WHAT THIS DOES
--   1. Refuses, and changes nothing, unless migration_118's backfills hold: every person whose id_document_number is
--      filled is linked to an identity document with that number (letters and digits compared, case folded), and no
--      person holds an id_* value without a number. On a refusal the RAISE names how many persons fail.
--   2. Drops natural_person_id_doc_paired, the seven columns and the id_document_type enum, which nothing else uses.
--
-- WHAT IS KEPT
--   The values live on in the identity documents migration_118 made, and in the person versions written before
--   Slice 40.85, whose snapshots still carry them (shown read-only under „Acte de identitate"; LegacyPersonIdCardSnapshot).
--
-- SAFE TO RUN TWICE: every DROP is IF EXISTS, and the check runs only while the columns are still there.
--
-- Apply locally: the runner's migrate-local (or pwsh .\scripts\Apply-Migration.ps1).
-- Apply to Supabase: npm run supabase:migrate (Adrian's) - after migration_118, which it depends on.

BEGIN;

SET LOCAL search_path = pg_catalog, public, pg_temp;

DO $c$
DECLARE
  unfiled integer;
  orphaned integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'natural_person' AND column_name = 'id_document_number') THEN
    RAISE NOTICE 'migration_119: the id_* columns are already gone';
    RETURN;
  END IF;

  EXECUTE $q$
    SELECT count(*) FROM natural_person np
     WHERE upper(regexp_replace(coalesce(np.id_document_number, ''), '[^A-Za-z0-9]', '', 'g')) <> ''
       AND NOT EXISTS (
         SELECT 1 FROM person_document pd
           JOIN document d ON d.id = pd.document_id
           JOIN lookup_document_type t ON t.id = d.document_type_id AND t.identity_kind IS NOT NULL
          WHERE pd.person_id = np.person_id
            AND upper(regexp_replace(coalesce(d.nr_document, ''), '[^A-Za-z0-9]', '', 'g'))
              = upper(regexp_replace(np.id_document_number, '[^A-Za-z0-9]', '', 'g')))
  $q$ INTO unfiled;

  EXECUTE $q$
    SELECT count(*) FROM natural_person np
     WHERE upper(regexp_replace(coalesce(np.id_document_number, ''), '[^A-Za-z0-9]', '', 'g')) = ''
       AND (nullif(btrim(coalesce(np.id_card_number, '')), '') IS NOT NULL
            OR nullif(btrim(coalesce(np.id_issuing_authority, '')), '') IS NOT NULL
            OR nullif(btrim(coalesce(np.id_mrz_raw, '')), '') IS NOT NULL
            OR np.id_valid_from IS NOT NULL
            OR np.id_valid_until IS NOT NULL)
  $q$ INTO orphaned;

  IF unfiled > 0 OR orphaned > 0 THEN
    RAISE EXCEPTION 'migration_119: not dropping natural_person''s id_* columns - % person(s) have a number no linked identity document carries, % hold card values without a number. Nothing was changed.', unfiled, orphaned;
  END IF;
END
$c$;

ALTER TABLE natural_person DROP CONSTRAINT IF EXISTS natural_person_id_doc_paired;

ALTER TABLE natural_person
  DROP COLUMN IF EXISTS id_document_type,
  DROP COLUMN IF EXISTS id_document_number,
  DROP COLUMN IF EXISTS id_card_number,
  DROP COLUMN IF EXISTS id_valid_from,
  DROP COLUMN IF EXISTS id_valid_until,
  DROP COLUMN IF EXISTS id_issuing_authority,
  DROP COLUMN IF EXISTS id_mrz_raw;

DROP TYPE IF EXISTS id_document_type;

COMMIT;
