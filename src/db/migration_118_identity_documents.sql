-- migration_118_identity_documents.sql
-- Slice 40.82 - Identity documents: one model for four kinds.
--
-- WHY
--   Adrian, 2026-10-26: „We have to overhaul the identity card functionality! / We need to accommodate 4 different
--   types (possibly more in the future) and do it in a consistent and safe way". The design the slices build to is
--   Identity.Documents.Design.v01 (01.Slice.Inputs\Slices.40.82-40.87); this file is its sections 2.1, 2.2 and 4.
--
-- WHAT THIS DOES - it only ADDS. Nothing stored is dropped, deleted or rewritten.
--   1. lookup_document_type.identity_kind: CI_VECHE | CI_NOU | PASAPORT | PASAPORT_CRDS, NULL on every other type.
--      One type per kind (a partial unique index). The application recognises an identity document by it, never by
--      the type's name (src/lib/identity-documents/kinds.ts).
--   2. The four types. CARTE_IDENTITATE keeps its key and every document, is renamed
--      'Carte de Identitate (model nou)' and marked CI_NOU. Three rows are added: CARTE_IDENTITATE_VECHE
--      'Carte de Identitate (model vechi)', PASAPORT 'Pașaport', PASAPORT_CRDS 'Pașaport CRDS'. Each new type gets
--      the person roles the card's type has (lookup_doc_type_person_role), so a holder can be linked to a passport
--      as to a card. A row already holding one of the three keys is marked rather than duplicated.
--   3. identity_document: 1:1 with document (document_id the primary key, ON DELETE CASCADE) - what an identity
--      document printed beyond the four common columns (number, issue date, valid until, issuer), which stay the
--      document's own.
--   4. Backfill A - every CARTE_IDENTITATE document gets its identity_document row, filled from its holder (role
--      'Titular act de identitate', else the one natural person linked to it) when the holder's id_document_number
--      is the document's nr_document (letters and digits compared, case folded) or the document has none; otherwise
--      the row is created empty. All are model nou, so only model nou's fields are filled: names, CNP, sex, place of
--      birth, nationality (the holder's citizenship), the HOME address as one line, MRZ and card number. Date of
--      birth is NOT copied: model nou prints none (it is in the CNP), and a value outside a kind's fields is what the
--      application refuses. A filled row appends a document version carrying it, by 'migration_118'.
--   5. Backfill B - a natural person whose id_document_number is filled and who is linked to no identity document
--      with that number gets one: a document without pages, of CARTE_IDENTITATE for ID_CARD (or none) and PASAPORT
--      for PASSPORT, its number, issue date and validity end from id_document_number / id_valid_from /
--      id_valid_until, its issuer as read from id_issuing_authority, its identity values as in 4 (a passport's
--      domicile is the HOME address's county), linked with the holder role, version 0 written, code allocated from
--      principal_object_code_seq as every document's is. So 40.85 can replace the person's tile with nothing left
--      behind. natural_person's id_* columns are untouched and still read and written by today's screens.
--   6. A report, SELECTed, because two of the three apply paths never show a RAISE NOTICE.
--
-- Snapshot keys: see src/lib/versioning/snapshot-registry.ts (DOCUMENT_SNAPSHOT_KEYS, IDENTITY_SNAPSHOT_KEYS).
-- The version rows written here carry the document's 21 fields and `identity`, exactly as `snapshotFromFull`
-- builds them; the CNP is copied only where it is 13 digits (identity_document_cnp_digits), and the report counts
-- the ones that were not.
--
-- SAFE TO RUN TWICE. Every insert is guarded by NOT EXISTS / ON CONFLICT, so a second run adds nothing and the
-- report counts 0 for this run.
--
-- Apply locally: the runner's migrate-local (or pwsh .\scripts\Apply-Migration.ps1).
-- Apply to Supabase: npm run supabase:migrate (Adrian's).

BEGIN;

-- Bare names below mean public.*; the two CREATEs name `public.` themselves, because with pg_catalog first an
-- unqualified CREATE TABLE would target pg_catalog (measured: „permission denied to create pg_catalog.…").
SET LOCAL search_path = pg_catalog, public, pg_temp;

CREATE TEMP TABLE m118_report (step text PRIMARY KEY, n integer NOT NULL) ON COMMIT DROP;

-- ---------------------------------------------------------------------------
-- 1. The marker
-- ---------------------------------------------------------------------------

ALTER TABLE lookup_document_type ADD COLUMN IF NOT EXISTS identity_kind text;

DO $c$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lookup_document_type_identity_kind_check') THEN
    ALTER TABLE lookup_document_type ADD CONSTRAINT lookup_document_type_identity_kind_check
      CHECK (identity_kind IS NULL OR identity_kind IN ('CI_VECHE', 'CI_NOU', 'PASAPORT', 'PASAPORT_CRDS'));
  END IF;
END
$c$;

CREATE UNIQUE INDEX IF NOT EXISTS lookup_document_type_identity_kind_unique
  ON lookup_document_type (identity_kind) WHERE identity_kind IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. The four types
-- ---------------------------------------------------------------------------

DO $t$
DECLARE
  k record;
  existing record;
  clash text;
BEGIN
  FOR k IN
    SELECT * FROM (VALUES
      ('CARTE_IDENTITATE',       'Carte de Identitate (model nou)',   'CI_NOU',        'CI'),
      ('CARTE_IDENTITATE_VECHE', 'Carte de Identitate (model vechi)', 'CI_VECHE',      'CI vechi'),
      ('PASAPORT',               'Pașaport',                          'PASAPORT',      NULL),
      ('PASAPORT_CRDS',          'Pașaport CRDS',                     'PASAPORT_CRDS', NULL)
    ) AS v(key, name, kind, short_name)
  LOOP
    SELECT id, name, template_fields INTO existing FROM lookup_document_type WHERE key = k.key;
    IF FOUND THEN
      -- #32.07: an identity type never holds a form. migration_073 cleared every one it recognised; a row found
      -- here still holding one is a question for a human, not something this file decides by deleting a form.
      IF jsonb_typeof(existing.template_fields) = 'array' AND existing.template_fields <> '[]'::jsonb THEN
        RAISE EXCEPTION 'migration_118: type % (%) carries a form; an identity type may not. Clear its form under Tipuri de documente, then re-run.', k.key, existing.name;
      END IF;
      UPDATE lookup_document_type
         SET identity_kind = k.kind,
             -- Only today's card is renamed. A row that already holds one of the three new keys keeps its name.
             name = CASE WHEN k.key = 'CARTE_IDENTITATE' THEN k.name ELSE name END,
             updated_at = now()
       WHERE id = existing.id AND identity_kind IS DISTINCT FROM k.kind;
    ELSE
      -- The display name is unique once normalised (migration_080). A row of another key already holding this name
      -- would make the insert fail with a bare 23505; say what it is instead.
      SELECT t.key INTO clash FROM lookup_document_type t
       WHERE regexp_replace(btrim(regexp_replace(regexp_replace(lower(normalize(coalesce(t.name, ''), NFD)), '[' || chr(768) || '-' || chr(879) || ']', '', 'g'), '\s+', ' ', 'g')), '[^a-z0-9]', '', 'g')
           = regexp_replace(btrim(regexp_replace(regexp_replace(lower(normalize(k.name, NFD)), '[' || chr(768) || '-' || chr(879) || ']', '', 'g'), '\s+', ' ', 'g')), '[^a-z0-9]', '', 'g')
       LIMIT 1;
      IF clash IS NOT NULL THEN
        RAISE EXCEPTION 'migration_118: the name % is already held by the type keyed %; rename that type, then re-run.', k.name, clash;
      END IF;
      INSERT INTO lookup_document_type (id, key, name, short_name, sort_order, identity_kind, created_at, updated_at)
      VALUES (gen_random_uuid(), k.key, k.name, k.short_name, 6, k.kind, now(), now());
      INSERT INTO m118_report VALUES ('type added: ' || k.key, 1);
    END IF;
  END LOOP;
END
$t$;

-- The card's person roles, on each new kind's type too.
INSERT INTO lookup_doc_type_person_role (id, document_type_id, person_role_id, holds_share, created_at)
SELECT gen_random_uuid(), n.id, r.person_role_id, r.holds_share, now()
  FROM lookup_doc_type_person_role r
  JOIN lookup_document_type c ON c.id = r.document_type_id AND c.key = 'CARTE_IDENTITATE'
  JOIN lookup_document_type n ON n.identity_kind IN ('CI_VECHE', 'PASAPORT', 'PASAPORT_CRDS')
ON CONFLICT (document_type_id, person_role_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. identity_document
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.identity_document (
  document_id       uuid PRIMARY KEY REFERENCES document(id) ON DELETE CASCADE,
  last_name         text,
  first_name        text,
  cnp               text,
  sex               gender,
  date_of_birth     date,
  place_of_birth    text,
  nationality       text,
  father_first_name text,
  mother_first_name text,
  civil_status      text,
  domicile_address  text,
  domicile_county   text,
  domicile_country  text,
  issuer_officer    text,
  passport_type     text,
  country_code      text,
  mrz               text,
  card_number       text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT identity_document_cnp_digits CHECK (cnp IS NULL OR cnp ~ '^[0-9]{13}$')
);

CREATE INDEX IF NOT EXISTS identity_document_cnp_idx ON public.identity_document (cnp);

-- ---------------------------------------------------------------------------
-- Helpers, for this session only
-- ---------------------------------------------------------------------------

-- A document number as compared: letters and digits only, upper case. 'RT 123456' = 'rt123456'.
CREATE OR REPLACE FUNCTION pg_temp.m118_num(txt text) RETURNS text AS $f$
  SELECT upper(regexp_replace(coalesce($1, ''), '[^A-Za-z0-9]', '', 'g'))
$f$ LANGUAGE sql IMMUTABLE;

-- The person's HOME address as one line: street, locality, county, and the country unless it is Romania.
CREATE OR REPLACE FUNCTION pg_temp.m118_home_line(pid uuid) RETURNS text AS $f$
  SELECT nullif(concat_ws(', ',
           nullif(btrim(a.street_line), ''),
           nullif(btrim(a.locality), ''),
           nullif(btrim(a.county), ''),
           CASE WHEN lower(translate(btrim(a.country), 'âÂ', 'aA')) IN ('romania', 'românia', 'ro', 'rou') THEN NULL
                ELSE nullif(btrim(a.country), '') END), '')
    FROM address a WHERE a.person_id = $1 AND a.kind = 'HOME'
$f$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION pg_temp.m118_home_county(pid uuid) RETURNS text AS $f$
  SELECT nullif(btrim(a.county), '') FROM address a WHERE a.person_id = $1 AND a.kind = 'HOME'
$f$ LANGUAGE sql STABLE;

-- The identity values a kind takes from a person, as the snapshot's `identity` object (null where the kind has no
-- such field). The one place this file says which kind has which field - the copy of kinds.ts it needs.
CREATE OR REPLACE FUNCTION pg_temp.m118_values(pid uuid, kind text) RETURNS jsonb AS $f$
  SELECT jsonb_build_object(
    'lastName',        nullif(btrim(np.last_name), ''),
    'firstName',       nullif(btrim(np.first_name), ''),
    'cnp',             CASE WHEN kind IN ('CI_NOU', 'PASAPORT', 'PASAPORT_CRDS') AND btrim(np.cnp) ~ '^[0-9]{13}$' THEN btrim(np.cnp) END,
    'sex',             CASE WHEN kind IN ('CI_NOU', 'PASAPORT', 'PASAPORT_CRDS') THEN np.gender::text END,
    'dateOfBirth',     CASE WHEN kind IN ('CI_VECHE', 'PASAPORT', 'PASAPORT_CRDS') THEN np.date_of_birth::text END,
    'placeOfBirth',    nullif(btrim(np.place_of_birth), ''),
    'nationality',     CASE WHEN kind IN ('CI_NOU', 'PASAPORT', 'PASAPORT_CRDS') THEN (SELECT c.name FROM lookup_citizenship c WHERE c.id = np.citizenship_id) END,
    'fatherFirstName', NULL,
    'motherFirstName', NULL,
    'civilStatus',     NULL,
    'domicileAddress', CASE WHEN kind IN ('CI_VECHE', 'CI_NOU') THEN pg_temp.m118_home_line(np.person_id) END,
    'domicileCounty',  CASE WHEN kind = 'PASAPORT' THEN pg_temp.m118_home_county(np.person_id) END,
    'domicileCountry', NULL,
    'issuerOfficer',   NULL,
    'passportType',    NULL,
    'countryCode',     NULL,
    'mrz',             CASE WHEN kind IN ('CI_NOU', 'PASAPORT', 'PASAPORT_CRDS') THEN nullif(btrim(np.id_mrz_raw), '') END,
    'cardNumber',      CASE WHEN kind = 'CI_NOU' THEN nullif(btrim(np.id_card_number), '') END)
  FROM natural_person np WHERE np.person_id = pid
$f$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION pg_temp.m118_empty() RETURNS jsonb AS $f$
  SELECT jsonb_build_object('lastName', NULL, 'firstName', NULL, 'cnp', NULL, 'sex', NULL, 'dateOfBirth', NULL,
    'placeOfBirth', NULL, 'nationality', NULL, 'fatherFirstName', NULL, 'motherFirstName', NULL, 'civilStatus', NULL,
    'domicileAddress', NULL, 'domicileCounty', NULL, 'domicileCountry', NULL, 'issuerOfficer', NULL,
    'passportType', NULL, 'countryCode', NULL, 'mrz', NULL, 'cardNumber', NULL)
$f$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION pg_temp.m118_insert_identity(doc uuid, v jsonb) RETURNS void AS $f$
  INSERT INTO identity_document (document_id, last_name, first_name, cnp, sex, date_of_birth, place_of_birth,
    nationality, father_first_name, mother_first_name, civil_status, domicile_address, domicile_county,
    domicile_country, issuer_officer, passport_type, country_code, mrz, card_number)
  VALUES ($1, $2->>'lastName', $2->>'firstName', $2->>'cnp', ($2->>'sex')::gender, ($2->>'dateOfBirth')::date,
    $2->>'placeOfBirth', $2->>'nationality', $2->>'fatherFirstName', $2->>'motherFirstName', $2->>'civilStatus',
    $2->>'domicileAddress', $2->>'domicileCounty', $2->>'domicileCountry', $2->>'issuerOfficer',
    $2->>'passportType', $2->>'countryCode', $2->>'mrz', $2->>'cardNumber')
  ON CONFLICT (document_id) DO NOTHING
$f$ LANGUAGE sql;

-- A document's own 21 snapshot fields, as `snapshotFromFull` writes them.
CREATE OR REPLACE FUNCTION pg_temp.m118_doc_snapshot(doc uuid) RETURNS jsonb AS $f$
  SELECT jsonb_build_object(
    'documentTypeId', d.document_type_id::text, 'title', d.title, 'nrDocument', d.nr_document,
    'dateDocument', d.date_document::text, 'issuerPersonId', d.issuer_person_id::text, 'emitent', d.emitent,
    'bazaLegala', d.baza_legala, 'uatProprietate', d.uat_proprietate, 'uatProprietar', d.uat_proprietar,
    'suprafata', d.suprafata::text, 'nrDosarSuccesoral', d.nr_dosar_succesoral, 'dataDecesului', d.data_decesului::text,
    'ultimulDomiciliu', d.ultimul_domiciliu, 'nrCertificatDeces', d.nr_certificat_deces, 'dateStart', d.date_start::text,
    'dateEnd', d.date_end::text, 'notes', d.notes, 'subject', d.subject, 'dateValidUntil', d.date_valid_until::text,
    'surveyorId', d.surveyor_id::text, 'customFields', d.custom_fields)
  FROM document d WHERE d.id = doc
$f$ LANGUAGE sql STABLE;

-- The holder role, when the archive has one.
CREATE TEMP TABLE m118_holder_role ON COMMIT DROP AS
  SELECT id FROM lookup_person_role WHERE lower(btrim(name)) = 'titular act de identitate' ORDER BY created_at LIMIT 1;

-- ---------------------------------------------------------------------------
-- 4. Backfill A - every existing card document gets its identity row
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE m118_cards ON COMMIT DROP AS
SELECT d.id AS document_id,
       d.nr_document,
       coalesce(
         (SELECT pd.person_id FROM person_document pd
            JOIN natural_person np ON np.person_id = pd.person_id
           WHERE pd.document_id = d.id AND pd.person_role_id IN (SELECT id FROM m118_holder_role)
           ORDER BY pd.created_at DESC LIMIT 1),
         (SELECT (array_agg(DISTINCT pd.person_id))[1] FROM person_document pd
            JOIN natural_person np ON np.person_id = pd.person_id
           WHERE pd.document_id = d.id
          HAVING count(DISTINCT pd.person_id) = 1)
       ) AS holder_id
  FROM document d
  JOIN lookup_document_type t ON t.id = d.document_type_id AND t.key = 'CARTE_IDENTITATE'
 WHERE NOT EXISTS (SELECT 1 FROM identity_document i WHERE i.document_id = d.id);

ALTER TABLE m118_cards ADD COLUMN fill boolean;
UPDATE m118_cards c
   SET fill = c.holder_id IS NOT NULL AND (
         pg_temp.m118_num(c.nr_document) = ''
         OR pg_temp.m118_num(c.nr_document) = pg_temp.m118_num((SELECT np.id_document_number FROM natural_person np WHERE np.person_id = c.holder_id)));

DO $i$
BEGIN
  PERFORM pg_temp.m118_insert_identity(c.document_id,
            CASE WHEN c.fill THEN pg_temp.m118_values(c.holder_id, 'CI_NOU') ELSE pg_temp.m118_empty() END)
     FROM m118_cards c;
END
$i$;

-- A filled row is a change to the document's values: one version, carrying it, on top of the latest.
INSERT INTO document_version (id, document_id, version_number, snapshot, updated_by, created_at)
SELECT gen_random_uuid(), c.document_id,
       coalesce(v.version_number + 1, 0),
       coalesce(v.snapshot, pg_temp.m118_doc_snapshot(c.document_id)) || jsonb_build_object('identity', pg_temp.m118_values(c.holder_id, 'CI_NOU')),
       'migration_118', now()
  FROM m118_cards c
  LEFT JOIN LATERAL (SELECT dv.version_number, dv.snapshot FROM document_version dv
                      WHERE dv.document_id = c.document_id ORDER BY dv.version_number DESC LIMIT 1) v ON true
 WHERE c.fill
   AND EXISTS (SELECT 1 FROM jsonb_each(pg_temp.m118_values(c.holder_id, 'CI_NOU')) e WHERE e.value <> 'null'::jsonb);

INSERT INTO m118_report
SELECT 'card documents given identity values (from the holder)', count(*) FROM m118_cards WHERE fill
UNION ALL SELECT 'card documents given an empty identity row (no holder, or another number)', count(*) FROM m118_cards WHERE NOT fill
UNION ALL SELECT 'card documents with no MRZ (the likeliest old cards - re-file by type)', count(*)
  FROM m118_cards c JOIN identity_document i ON i.document_id = c.document_id WHERE i.mrz IS NULL
UNION ALL SELECT 'holder CNPs not copied (not 13 digits)', count(*)
  FROM m118_cards c JOIN natural_person np ON np.person_id = c.holder_id
 WHERE c.fill AND btrim(coalesce(np.cnp, '')) <> '' AND btrim(np.cnp) !~ '^[0-9]{13}$';

-- ---------------------------------------------------------------------------
-- 5. Backfill B - a person's hand-typed „Act de identitate" gets its document
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE m118_persons ON COMMIT DROP AS
SELECT np.person_id,
       CASE WHEN np.id_document_type = 'PASSPORT' THEN 'PASAPORT' ELSE 'CARTE_IDENTITATE' END AS type_key,
       CASE WHEN np.id_document_type = 'PASSPORT' THEN 'PASAPORT' ELSE 'CI_NOU' END AS kind,
       btrim(np.id_document_number) AS nr_document,
       np.id_valid_from, np.id_valid_until,
       nullif(btrim(np.id_issuing_authority), '') AS issuer_read,
       concat_ws(' ', nullif(btrim(np.last_name), ''), nullif(btrim(np.first_name), '')) AS holder_name,
       NULL::uuid AS po_id, NULL::text AS code, NULL::uuid AS document_id
  FROM natural_person np
 WHERE pg_temp.m118_num(np.id_document_number) <> ''
   AND NOT EXISTS (
     SELECT 1 FROM person_document pd
       JOIN document d ON d.id = pd.document_id
       JOIN lookup_document_type t ON t.id = d.document_type_id AND t.identity_kind IS NOT NULL
      WHERE pd.person_id = np.person_id
        AND pg_temp.m118_num(d.nr_document) = pg_temp.m118_num(np.id_document_number));

UPDATE m118_persons SET po_id = gen_random_uuid(), document_id = gen_random_uuid(),
                        code = 'DOC' || lpad(nextval('principal_object_code_seq')::text, 5, '0');

INSERT INTO principal_object (id, code, object_type, created_at)
SELECT po_id, code, 'DOCUMENT', now() FROM m118_persons;

INSERT INTO document (id, principal_object_id, code, document_type_id, title, nr_document, date_document,
                      date_valid_until, issuer_read, notes, updated_by, created_at, updated_at)
SELECT p.document_id, p.po_id, p.code, t.id,
       CASE WHEN p.kind = 'PASAPORT' THEN 'Pașaport' ELSE 'CI' END || CASE WHEN p.holder_name <> '' THEN ' ' || p.holder_name ELSE '' END,
       p.nr_document, p.id_valid_from, p.id_valid_until, p.issuer_read,
       'Creat la migrarea actelor de identitate (Slice 40.82) din „Act de identitate” al persoanei; fără pagini.',
       'migration_118', now(), now()
  FROM m118_persons p
  JOIN lookup_document_type t ON t.key = p.type_key;

DO $i$
BEGIN
  PERFORM pg_temp.m118_insert_identity(p.document_id, pg_temp.m118_values(p.person_id, p.kind)) FROM m118_persons p;
END
$i$;

INSERT INTO person_document (id, person_id, document_id, person_role_id, created_at)
SELECT gen_random_uuid(), p.person_id, p.document_id, (SELECT id FROM m118_holder_role), now() FROM m118_persons p;

INSERT INTO document_version (id, document_id, version_number, snapshot, updated_by, created_at)
SELECT gen_random_uuid(), p.document_id, 0,
       pg_temp.m118_doc_snapshot(p.document_id) || jsonb_build_object('identity', pg_temp.m118_values(p.person_id, p.kind)),
       'migration_118', now()
  FROM m118_persons p;

INSERT INTO m118_report
SELECT 'identity documents created from a person''s „Act de identitate” (cards)', count(*) FROM m118_persons WHERE kind = 'CI_NOU'
UNION ALL SELECT 'identity documents created from a person''s „Act de identitate” (passports)', count(*) FROM m118_persons WHERE kind = 'PASAPORT'
UNION ALL SELECT 'holder role found (1) or absent (0) - absent links the created documents with no role', count(*) FROM m118_holder_role;

-- Any other document already filed under an identity type (a row that held one of the three new keys before this
-- file marked it) gets its empty row too, so every identity document has one.
WITH added AS (
  INSERT INTO identity_document (document_id)
  SELECT d.id FROM document d
    JOIN lookup_document_type t ON t.id = d.document_type_id AND t.identity_kind IS NOT NULL
  ON CONFLICT (document_id) DO NOTHING
  RETURNING document_id)
INSERT INTO m118_report SELECT 'other identity documents given an empty identity row', count(*) FROM added;

-- ---------------------------------------------------------------------------
-- 6. The report, and the archive's state after it
-- ---------------------------------------------------------------------------

INSERT INTO m118_report
SELECT 'identity types (one per kind - expect 4)', count(*) FROM lookup_document_type WHERE identity_kind IS NOT NULL
UNION ALL SELECT 'identity types carrying a form (expect 0)', count(*) FROM lookup_document_type
 WHERE identity_kind IS NOT NULL AND jsonb_typeof(template_fields) = 'array' AND template_fields <> '[]'::jsonb
UNION ALL SELECT 'identity documents without an identity row (expect 0)', count(*)
  FROM document d JOIN lookup_document_type t ON t.id = d.document_type_id AND t.identity_kind IS NOT NULL
 WHERE NOT EXISTS (SELECT 1 FROM identity_document i WHERE i.document_id = d.id);

DO $a$
BEGIN
  IF (SELECT count(*) FROM lookup_document_type WHERE identity_kind IS NOT NULL) <> 4 THEN
    RAISE EXCEPTION 'migration_118: expected four identity types';
  END IF;
END
$a$;

SELECT step AS "migration_118", n FROM m118_report ORDER BY step;

COMMIT;
