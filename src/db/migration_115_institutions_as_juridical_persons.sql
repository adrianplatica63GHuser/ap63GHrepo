-- migration_115_institutions_as_juridical_persons.sql
-- Slice #39.71 - every institution becomes a juridical person of a public-body type; every document's issuer points
-- to that person.
--
-- WHY
--   Adrian, on the research doc: „They are juridical persons. Move them into Persoane juridice under new public-body
--   types, then retire the value list.  (Adrian: agree, but please elaborate on public-body types)", and „agree" on
--   every step. This slice moves them and links the documents; 39.72 gives the document its issuer picker and drops
--   the value list. Until then the list and document.institution_id stay, and the triggers below keep the two in step.
--
-- WHAT THIS DOES
--   1. Seven public-body types join „Tipuri de Persoană Juridică" (each a legal entity with a CIF in ANAF): Autoritate
--      publică centrală, Instituție publică teritorială, Autoritate locală, Instanță, Birou notarial, Birou de executor
--      judecătoresc, Cabinet sau societate de avocatură. „Altele" moves to the end.
--   2. lookup_institution.juridical_person_id (new): the juridical person an institution became.
--      document.issuer_person_id (new): the document's issuer, a person.
--   3. ga40_institution_juridical_person(id) (new, kept): makes an institution's juridical person when it has none, the
--      way the „Persoană juridică nouă" form does — a JPERS code from the shared sequence, the person, its
--      judicial_person row, version 0 of its history, its provenance (MANUAL for an institution added by a person,
--      AI_INTERPRETED for one the import added) — and links it. Its type comes from the name (Judecătoria … →
--      Instanță, Primăria … → Autoritate locală, OCPI … → Instituție publică teritorială, ANAF → Autoritate publică
--      centrală, Notar… → Birou notarial, …), else from the institution's own type. A row that names no particular
--      body (Notariat, Judecătorie, Tribunal, OCPI, Primăria Municipiului, Consiliu Județean) is still made, under its
--      name, with the note „generic — de înlocuit cu instituția exactă".
--   4. Every institution gets its person, each RAISEd as a NOTICE (name → code, type, generic or not, documents);
--      every document's issuer_person_id is filled from its institution_id, without moving its updated_at.
--   5. Three triggers keep the old and the new in step until 39.72: an institution added later gets its person; an
--      institution renamed renames its person (with a version); a document's institution_id written by anything
--      writes its issuer_person_id (a deleted institution's SET NULL clears both).
--
-- src/db/sync-reference-data.sql seeds the seven types for a rebuilt database; the repair file adds the two columns
-- and their indexes only (a second copy of the function would be a second create path for juridical persons).

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.ga40_fold(x text) RETURNS text LANGUAGE sql IMMUTABLE AS $f$
  SELECT btrim(regexp_replace(
           regexp_replace(lower(normalize(coalesce(x, ''), NFD)), '[' || chr(768) || '-' || chr(879) || ']', '', 'g'),
           '\s+', ' ', 'g'))
$f$;

-- 1 ── the public-body types ─────────────────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  names text[] := ARRAY['Autoritate publică centrală', 'Instituție publică teritorială', 'Autoritate locală', 'Instanță',
                        'Birou notarial', 'Birou de executor judecătoresc', 'Cabinet sau societate de avocatură'];
  i int;
BEGIN
  FOR i IN 1 .. array_length(names, 1) LOOP
    IF NOT EXISTS (SELECT 1 FROM lookup_judicial_person_type WHERE pg_temp.ga40_fold(name) = pg_temp.ga40_fold(names[i])) THEN
      INSERT INTO lookup_judicial_person_type (name, sort_order) VALUES (names[i], 20 + i);
    END IF;
  END LOOP;
  UPDATE lookup_judicial_person_type SET sort_order = 100, updated_at = now() WHERE pg_temp.ga40_fold(name) = 'altele';
END $$;

-- 2 ── the two links ─────────────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE lookup_institution ADD COLUMN IF NOT EXISTS juridical_person_id uuid REFERENCES person(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS lookup_institution_juridical_person_unique ON lookup_institution (juridical_person_id);
COMMENT ON COLUMN lookup_institution.juridical_person_id IS
  'Slice #39.71: the juridical person this institution became. 39.72 drops the list.';

ALTER TABLE document ADD COLUMN IF NOT EXISTS issuer_person_id uuid REFERENCES person(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS document_issuer_person_idx ON document (issuer_person_id);
COMMENT ON COLUMN document.issuer_person_id IS
  'Slice #39.71: the document''s issuer, a juridical person. Kept in step with institution_id by a trigger until 39.72.';

-- 3 ── an institution's juridical person ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION ga40_institution_juridical_person(inst_id uuid) RETURNS uuid LANGUAGE plpgsql AS $fn$
DECLARE
  inst      record;
  folded    text;
  kind      text;
  type_name text;
  type_id   uuid;
  generic   boolean;
  note      text;
  po_id     uuid;
  po_code   text;
  p_id      uuid;
  meta_id   uuid;
  prov      text;
BEGIN
  SELECT * INTO inst FROM lookup_institution WHERE id = inst_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF inst.juridical_person_id IS NOT NULL THEN RETURN inst.juridical_person_id; END IF;

  folded := btrim(regexp_replace(regexp_replace(lower(normalize(coalesce(inst.name, ''), NFD)),
              '[' || chr(768) || '-' || chr(879) || ']', '', 'g'), '\s+', ' ', 'g'));
  kind := btrim(regexp_replace(regexp_replace(lower(normalize(coalesce(inst.institution_type, ''), NFD)),
              '[' || chr(768) || '-' || chr(879) || ']', '', 'g'), '\s+', ' ', 'g'));

  type_name := CASE
    WHEN folded ~ '^(judecatori|tribunal|curtea )'                         THEN 'Instanță'
    WHEN folded ~ '(notar)'                                                THEN 'Birou notarial'
    WHEN folded ~ '(executor)'                                             THEN 'Birou de executor judecătoresc'
    WHEN folded ~ '(avocat)'                                               THEN 'Cabinet sau societate de avocatură'
    WHEN folded ~ '^(ocpi|ajfp|dgrfp|institutia prefectului|prefectura)'   THEN 'Instituție publică teritorială'
    WHEN folded ~ '^(anaf|ancpi|ministerul|guvernul)'                      THEN 'Autoritate publică centrală'
    WHEN folded ~ '^(primaria|consiliu|consiliul)'                         THEN 'Autoritate locală'
    WHEN kind ~ '(juridic)'                                                THEN 'Instanță'
    WHEN kind ~ '(cadastru)'                                               THEN 'Instituție publică teritorială'
    WHEN kind ~ '(administratie)'                                          THEN 'Autoritate locală'
    WHEN kind ~ '(fiscal)'                                                 THEN 'Autoritate publică centrală'
    ELSE NULL
  END;
  SELECT id INTO type_id FROM lookup_judicial_person_type
   WHERE btrim(regexp_replace(regexp_replace(lower(normalize(name, NFD)), '[' || chr(768) || '-' || chr(879) || ']', '', 'g'), '\s+', ' ', 'g'))
       = btrim(regexp_replace(regexp_replace(lower(normalize(coalesce(type_name, ''), NFD)), '[' || chr(768) || '-' || chr(879) || ']', '', 'g'), '\s+', ' ', 'g'))
   LIMIT 1;

  generic := folded IN ('notariat', 'judecatorie', 'tribunal', 'ocpi', 'primaria municipiului', 'consiliu judetean');
  note := CASE WHEN generic THEN 'generic — de înlocuit cu instituția exactă' ELSE NULL END;
  prov := CASE WHEN inst.origin = 'IMPORT' THEN 'AI_INTERPRETED' ELSE 'MANUAL' END;

  INSERT INTO principal_object (object_type, code)
  VALUES ('PERSON', 'JPERS' || lpad(nextval('principal_object_code_seq')::text, 5, '0'))
  RETURNING id, code INTO po_id, po_code;

  INSERT INTO person (principal_object_id, code, type, display_name, notes)
  VALUES (po_id, po_code, 'JUDICIAL', btrim(inst.name), note)
  RETURNING id INTO p_id;

  INSERT INTO judicial_person (person_id, name, judicial_person_type_id, correspondence_same_as_hq)
  VALUES (p_id, btrim(inst.name), type_id, false);

  -- Version 0, the shape judicialSnapshotFromFull writes (src/lib/judicial-persons/queries.ts).
  INSERT INTO person_version (person_id, version_number, snapshot)
  VALUES (p_id, 0, jsonb_build_object(
    'notes', note,
    'judicial', jsonb_build_object(
      'name', btrim(inst.name), 'nickname', NULL, 'judicialPersonTypeId', type_id, 'cuiNumber', NULL,
      'tradeRegisterNumber', NULL, 'phone', NULL, 'email', NULL, 'contactPerson1Id', NULL, 'contactPerson2Id', NULL,
      'correspondenceSameAsHq', false),
    'addresses', jsonb_build_object('HEADQUARTERS', NULL, 'CORRESPONDENCE', NULL)));

  -- Its provenance, the way setInitialProvenance records it (src/lib/metadata/queries.ts).
  INSERT INTO entity_metadata (principal_object_id, provenance, provenance_updated_at)
  VALUES (po_id, prov, now())
  RETURNING id INTO meta_id;
  INSERT INTO entity_metadata_version (entity_metadata_id, version_number, snapshot)
  VALUES (meta_id, 0, jsonb_build_object('importance', NULL, 'relevance', NULL, 'provenance', prov));

  UPDATE lookup_institution SET juridical_person_id = p_id WHERE id = inst_id;
  RETURN p_id;
END $fn$;
COMMENT ON FUNCTION ga40_institution_juridical_person(uuid) IS
  'Slice #39.71: an institution''s juridical person, made once - code, person, version 0, provenance - and linked.';

-- 4 ── every institution, every document ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  r     record;
  p_id  uuid;
  info  record;
BEGIN
  FOR r IN SELECT id, name FROM lookup_institution ORDER BY sort_order, name, id LOOP
    p_id := ga40_institution_juridical_person(r.id);
    SELECT p.code, t.name AS type_name, p.notes IS NOT NULL AS generic,
           (SELECT count(*) FROM document d WHERE d.institution_id = r.id) AS docs
      INTO info
      FROM person p JOIN judicial_person j ON j.person_id = p.id
      LEFT JOIN lookup_judicial_person_type t ON t.id = j.judicial_person_type_id
     WHERE p.id = p_id;
    RAISE NOTICE 'migration_115: „%" -> % (%), %, % document(s)', r.name, info.code, coalesce(info.type_name, 'no type'),
      CASE WHEN info.generic THEN 'generic' ELSE 'specific' END, info.docs;
  END LOOP;
  -- The issuer is written without touching a document's updated_at: its „Nou!" and its place in the list stay. The
  -- touch trigger is found by its function, whatever it is called on this database, and switched off for this one
  -- UPDATE only.
  FOR r IN SELECT tgname FROM pg_trigger
            WHERE tgrelid = 'document'::regclass AND NOT tgisinternal AND tgfoid = 'touch_updated_at'::regproc LOOP
    EXECUTE format('ALTER TABLE document DISABLE TRIGGER %I', r.tgname);
  END LOOP;
  UPDATE document d SET issuer_person_id = li.juridical_person_id
    FROM lookup_institution li
   WHERE d.institution_id = li.id AND d.issuer_person_id IS DISTINCT FROM li.juridical_person_id;
  FOR r IN SELECT tgname FROM pg_trigger
            WHERE tgrelid = 'document'::regclass AND NOT tgisinternal AND tgfoid = 'touch_updated_at'::regproc LOOP
    EXECUTE format('ALTER TABLE document ENABLE TRIGGER %I', r.tgname);
  END LOOP;
END $$;

-- 5 ── kept in step until 39.72 ──────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION ga40_institution_added() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM ga40_institution_juridical_person(NEW.id);
  RETURN NULL;
END $fn$;
DROP TRIGGER IF EXISTS lookup_institution_juridical_person_added ON lookup_institution;
CREATE TRIGGER lookup_institution_juridical_person_added AFTER INSERT ON lookup_institution
  FOR EACH ROW EXECUTE FUNCTION ga40_institution_added();

CREATE OR REPLACE FUNCTION ga40_institution_renamed() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
  latest record;
BEGIN
  IF NEW.juridical_person_id IS NULL OR btrim(NEW.name) = btrim(OLD.name) THEN RETURN NULL; END IF;
  UPDATE judicial_person SET name = btrim(NEW.name) WHERE person_id = NEW.juridical_person_id;
  UPDATE person SET display_name = btrim(NEW.name), updated_at = now() WHERE id = NEW.juridical_person_id;
  SELECT version_number, snapshot INTO latest FROM person_version
   WHERE person_id = NEW.juridical_person_id ORDER BY version_number DESC LIMIT 1;
  IF FOUND THEN
    INSERT INTO person_version (person_id, version_number, snapshot)
    VALUES (NEW.juridical_person_id, latest.version_number + 1,
            jsonb_set(latest.snapshot, '{judicial,name}', to_jsonb(btrim(NEW.name))));
  END IF;
  RETURN NULL;
END $fn$;
DROP TRIGGER IF EXISTS lookup_institution_juridical_person_renamed ON lookup_institution;
CREATE TRIGGER lookup_institution_juridical_person_renamed AFTER UPDATE OF name ON lookup_institution
  FOR EACH ROW EXECUTE FUNCTION ga40_institution_renamed();

CREATE OR REPLACE FUNCTION ga40_document_issuer_from_institution() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW.institution_id IS NULL THEN
    NEW.issuer_person_id := NULL;
  ELSE
    NEW.issuer_person_id := (SELECT juridical_person_id FROM lookup_institution WHERE id = NEW.institution_id);
  END IF;
  RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS document_issuer_from_institution ON document;
CREATE TRIGGER document_issuer_from_institution BEFORE INSERT OR UPDATE OF institution_id ON document
  FOR EACH ROW EXECUTE FUNCTION ga40_document_issuer_from_institution();

COMMIT;
