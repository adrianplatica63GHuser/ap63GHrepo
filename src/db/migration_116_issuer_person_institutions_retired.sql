-- migration_116_issuer_person_institutions_retired.sql
-- Slice #39.72 - a document's issuer is a juridical person, picked on the form and read by the AI; the
-- „Instituții" value list and document.institution_id go.
--
-- WHY
--   Adrian, on the research doc: „Switch the document field to a person picker filtered on those types, teach the AI
--   to read the issuer, and retire the value list.  (Adrian: agree)". migration_115 (39.71) made every institution a
--   juridical person and filled document.issuer_person_id; three triggers kept the old column in step with it. From
--   this slice nothing reads or writes the old column or the list, so both go.
--
-- WHAT THIS DOES
--   1. lookup_judicial_person_type.public_body (new, boolean): the types the issuer picker offers first. True for the
--      seven public-body types migration_115 added, found by their folded names; false for every other type.
--   2. document.issuer_read (new, text): the issuer as the AI read it off the pages — a PROPOSAL (D-12). The document's
--      screen offers it until a person picks an issuer; nothing becomes the issuer without that person.
--   3. Every document version's snapshot names the issuer person instead of the institution: `institutionId` becomes
--      `issuerPersonId`, the institution's juridical person (null where there was none). So paging back through a
--      document's history keeps showing who issued it, after the list it pointed at is gone.
--   4. The three triggers and four functions migration_115 made to keep the pair in step are dropped.
--   5. document.institution_id (its FK and index with it) and lookup_institution are dropped. Each institution's
--      juridical person stays, with its code, history and documents.
--
-- RAISEs a NOTICE with the counts: public-body types, document versions rewritten, documents with an issuer.
--
-- Idempotent: every step is guarded, and a database that has already run it is left as it is.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.ga40_fold(x text) RETURNS text LANGUAGE sql IMMUTABLE AS $f$
  SELECT btrim(regexp_replace(
           regexp_replace(lower(normalize(coalesce(x, ''), NFD)), '[' || chr(768) || '-' || chr(879) || ']', '', 'g'),
           '\s+', ' ', 'g'))
$f$;

-- 1 ── the public-body flag ───────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE lookup_judicial_person_type ADD COLUMN IF NOT EXISTS public_body boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN lookup_judicial_person_type.public_body IS
  'Slice #39.72: a public-body type — the document''s issuer picker offers the juridical persons of these types first.';
UPDATE lookup_judicial_person_type
   SET public_body = true, updated_at = now()
 WHERE NOT public_body
   AND pg_temp.ga40_fold(name) IN (
     pg_temp.ga40_fold('Autoritate publică centrală'), pg_temp.ga40_fold('Instituție publică teritorială'),
     pg_temp.ga40_fold('Autoritate locală'), pg_temp.ga40_fold('Instanță'), pg_temp.ga40_fold('Birou notarial'),
     pg_temp.ga40_fold('Birou de executor judecătoresc'), pg_temp.ga40_fold('Cabinet sau societate de avocatură'));

-- 2 ── the AI's reading of the issuer ─────────────────────────────────────────────────────────────────────────────────
ALTER TABLE document ADD COLUMN IF NOT EXISTS issuer_read text;
COMMENT ON COLUMN document.issuer_read IS
  'Slice #39.72: the issuer as the AI read it — a proposal a person confirms (D-12), never the issuer itself.';

-- 3 ── the versions name the person ──────────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  n_versions int := 0;
BEGIN
  IF to_regclass('public.lookup_institution') IS NOT NULL THEN
    UPDATE document_version v
       SET snapshot = (v.snapshot - 'institutionId')
                      || jsonb_build_object('issuerPersonId',
                           (SELECT li.juridical_person_id::text FROM lookup_institution li
                             WHERE li.id::text = v.snapshot ->> 'institutionId'))
     WHERE v.snapshot ? 'institutionId';
    GET DIAGNOSTICS n_versions = ROW_COUNT;
  END IF;
  -- A version written by a database that never had the key gets the new one, null, so every snapshot has one shape.
  UPDATE document_version SET snapshot = snapshot || '{"issuerPersonId": null}'::jsonb
   WHERE NOT (snapshot ? 'issuerPersonId');
  RAISE NOTICE 'migration_116: % document version(s) now name the issuer person', n_versions;
END $$;

-- 4 ── the pair is no longer kept in step ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS document_issuer_from_institution ON document;
DO $$
BEGIN
  IF to_regclass('public.lookup_institution') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS lookup_institution_juridical_person_added ON lookup_institution;
    DROP TRIGGER IF EXISTS lookup_institution_juridical_person_renamed ON lookup_institution;
  END IF;
END $$;
DROP FUNCTION IF EXISTS ga40_document_issuer_from_institution();
DROP FUNCTION IF EXISTS ga40_institution_added();
DROP FUNCTION IF EXISTS ga40_institution_renamed();
DROP FUNCTION IF EXISTS ga40_institution_juridical_person(uuid);

-- 5 ── the old column and the list ───────────────────────────────────────────────────────────────────────────────────
ALTER TABLE document DROP COLUMN IF EXISTS institution_id;
DROP TABLE IF EXISTS lookup_institution;

DO $$
DECLARE
  n_types  int;
  n_issued int;
BEGIN
  SELECT count(*) INTO n_types FROM lookup_judicial_person_type WHERE public_body;
  SELECT count(*) INTO n_issued FROM document WHERE issuer_person_id IS NOT NULL;
  RAISE NOTICE 'migration_116: % public-body type(s); % document(s) with an issuer; lookup_institution dropped',
    n_types, n_issued;
END $$;

COMMIT;
