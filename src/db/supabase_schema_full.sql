-- ============================================================
-- ga40prj — Full Schema Script (Supabase)
--
-- Applies the complete schema from scratch after running
-- supabase_reset.sql. Combines all drizzle migrations
-- (0000–0007), src/db migrations (008–019), and migration 020
-- (Slice #15.05 — paperwork -> document rename).
--
-- Run in the Supabase SQL Editor.
-- PostGIS must already be enabled in the project
-- (CREATE EXTENSION IF NOT EXISTS postgis).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Reusable trigger: bumps updated_at on every UPDATE.
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Lock CNP once set (NULL → value allowed; value → different value blocked).
CREATE OR REPLACE FUNCTION natural_person_lock_cnp() RETURNS trigger AS $$
BEGIN
  IF OLD.cnp IS NOT NULL AND NEW.cnp IS DISTINCT FROM OLD.cnp THEN
    RAISE EXCEPTION 'CNP cannot be changed once set; delete and recreate the person instead';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Lock CUI once set (same pattern as CNP).
CREATE OR REPLACE FUNCTION judicial_person_lock_cui() RETURNS trigger AS $$
BEGIN
  IF OLD.cui_number IS NOT NULL AND NEW.cui_number IS DISTINCT FROM OLD.cui_number THEN
    RAISE EXCEPTION 'CUI cannot be changed once set; delete and recreate the judicial person instead';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE address_kind AS ENUM ('HOME', 'POSTAL', 'HEADQUARTERS', 'CORRESPONDENCE');
CREATE TYPE gender AS ENUM ('MALE', 'FEMALE');
CREATE TYPE id_document_type AS ENUM ('ID_CARD', 'PASSPORT');
CREATE TYPE person_type AS ENUM ('NATURAL', 'JUDICIAL');
CREATE TYPE judicial_type AS ENUM ('SRL', 'SA', 'SRL_D', 'PFA', 'II', 'IF', 'ONG', 'OTHER');
CREATE TYPE property_type AS ENUM ('LAND');
CREATE TYPE use_category AS ENUM ('CATEG1', 'CATEG2', 'CATEG3');
-- NOTE (Slice #15.05): the old hardcoded paperwork_type enum is gone.
-- Document "type" is now a FK to lookup_document_type (admin-managed via
-- Reference Data), keyed off an immutable `key` slug column — see below.
CREATE TYPE principal_object_type AS ENUM ('PERSON', 'PROPERTY', 'DOCUMENT');
CREATE TYPE user_request_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE app_user_role AS ENUM ('superuser', 'user');

-- ============================================================
-- principal_object  (migration 008)
-- ============================================================

CREATE TABLE principal_object (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text        NOT NULL UNIQUE,
  object_type principal_object_type NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE SEQUENCE principal_object_code_seq START 1;

-- ============================================================
-- PERSON domain  (drizzle 0000 + 0004 + migration 018)
-- ============================================================

CREATE TABLE person (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_object_id uuid        NOT NULL UNIQUE REFERENCES principal_object(id),
  code                text        NOT NULL UNIQUE,
  type                person_type NOT NULL,
  display_name        text        NOT NULL,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

CREATE TRIGGER person_touch_updated_at
  BEFORE UPDATE ON person
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- natural_person ─────────────────────────────────────────────
CREATE TABLE natural_person (
  person_id          uuid PRIMARY KEY REFERENCES person(id) ON DELETE CASCADE,
  first_name         text,
  last_name          text,
  nickname           text,
  cnp                text,
  id_document_type   id_document_type,
  id_document_number text,
  gender             gender,
  date_of_birth      date,
  personal_phone_1   text,
  personal_phone_2   text,
  work_phone         text,
  personal_email_1   text,
  personal_email_2   text,
  work_email         text,
  place_of_birth         text,
  id_issuing_authority    text,
  id_valid_from           date,
  id_valid_until          date,
  id_card_number          text,
  id_mrz_raw              text,
  citizenship_id          uuid,
  CONSTRAINT natural_person_has_name
    CHECK (first_name IS NOT NULL OR last_name IS NOT NULL),
  CONSTRAINT natural_person_id_doc_paired
    CHECK ((id_document_type IS NULL) = (id_document_number IS NULL)),
  CONSTRAINT natural_person_has_contact
    CHECK (coalesce(personal_phone_1, personal_phone_2, work_phone,
                    personal_email_1, personal_email_2, work_email) IS NOT NULL)
);

CREATE UNIQUE INDEX natural_person_cnp_unique
  ON natural_person (cnp)
  WHERE cnp IS NOT NULL;

CREATE TRIGGER natural_person_lock_cnp
  BEFORE UPDATE ON natural_person
  FOR EACH ROW EXECUTE FUNCTION natural_person_lock_cnp();

-- judicial_person ────────────────────────────────────────────
-- Final state: includes contact_person FK columns from migration 018.
CREATE TABLE judicial_person (
  person_id                 uuid PRIMARY KEY REFERENCES person(id) ON DELETE CASCADE,
  name                      text NOT NULL,
  nickname                  text,
  judicial_type             judicial_type,
  cui_number                text,
  trade_register_number     text,
  -- Contact persons: FK to natural persons. ON DELETE SET NULL.
  contact_person_1_id       uuid REFERENCES person(id) ON DELETE SET NULL,
  contact_person_2_id       uuid REFERENCES person(id) ON DELETE SET NULL,
  -- When true, correspondence address mirrors registered address.
  correspondence_same_as_hq boolean NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX judicial_person_cui_unique
  ON judicial_person (cui_number)
  WHERE cui_number IS NOT NULL;

CREATE TRIGGER judicial_person_lock_cui
  BEFORE UPDATE ON judicial_person
  FOR EACH ROW EXECUTE FUNCTION judicial_person_lock_cui();

-- address ────────────────────────────────────────────────────
CREATE TABLE address (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id   uuid         NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  kind        address_kind NOT NULL,
  street_line text,
  postal_code text,
  locality    text,
  county      text,
  country     text NOT NULL,
  notes       text,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX address_person_kind_unique ON address (person_id, kind);

CREATE TRIGGER address_touch_updated_at
  BEFORE UPDATE ON address
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ============================================================
-- PROPERTY domain  (drizzle 0001)
-- ============================================================

CREATE TABLE property (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_object_id uuid          NOT NULL UNIQUE REFERENCES principal_object(id),
  code                text          NOT NULL UNIQUE,
  type                property_type NOT NULL DEFAULT 'LAND',
  nickname            text,
  tarla_sola          text,
  parcela             text,
  cadastral_number    text,
  carte_funciara      text,
  use_category        use_category,
  surface_area_mp     numeric(12,2),
  notes               text,
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

CREATE UNIQUE INDEX property_cadastral_number_unique
  ON property (cadastral_number)
  WHERE cadastral_number IS NOT NULL;

CREATE TRIGGER property_touch_updated_at
  BEFORE UPDATE ON property
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE property_address (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid        NOT NULL REFERENCES property(id) ON DELETE CASCADE,
  street_line text,
  postal_code text,
  locality    text,
  county      text,
  country     text NOT NULL,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX property_address_property_unique ON property_address (property_id);

CREATE TRIGGER property_address_touch_updated_at
  BEFORE UPDATE ON property_address
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE property_corner (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid        NOT NULL REFERENCES property(id) ON DELETE CASCADE,
  sequence_no integer     NOT NULL,
  lat         double precision NOT NULL,
  lon         double precision NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX property_corner_property_seq_unique
  ON property_corner (property_id, sequence_no);

CREATE INDEX property_corner_geom_idx
  ON property_corner
  USING GIST (CAST(ST_SetSRID(ST_MakePoint(lon, lat), 4326) AS geography));

CREATE TRIGGER property_corner_touch_updated_at
  BEFORE UPDATE ON property_corner
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ============================================================
-- LOOKUP / REFERENCE DATA  (drizzle 0002 + migrations 009–015, 020)
-- ============================================================

-- ── lookup_property_type ─────────────────────────────────────
CREATE TABLE lookup_property_type (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  sort_order integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER lookup_property_type_touch_updated_at
  BEFORE UPDATE ON lookup_property_type
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
INSERT INTO lookup_property_type (name, sort_order) VALUES
  ('Teren Arabil',    1),
  ('Teren Construit', 2),
  ('Liniară',         3),
  ('Pășune',          4),
  ('Apartament',      5),
  ('Casă',            6);

-- ── lookup_tarla ─────────────────────────────────────────────
CREATE TABLE lookup_tarla (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  indicativ  text        NOT NULL,
  descriere  text,
  sort_order integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER lookup_tarla_touch_updated_at
  BEFORE UPDATE ON lookup_tarla
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
INSERT INTO lookup_tarla (indicativ, descriere, sort_order) VALUES
  ('T1',  'Tarla 1',  1), ('T2',  'Tarla 2',  2), ('T3',  'Tarla 3',  3),
  ('T4',  'Tarla 4',  4), ('T5',  'Tarla 5',  5), ('T6',  'Tarla 6',  6),
  ('T7',  'Tarla 7',  7), ('T8',  'Tarla 8',  8), ('T9',  'Tarla 9',  9),
  ('T10', 'Tarla 10', 10);

-- ── lookup_use_category ──────────────────────────────────────
CREATE TABLE lookup_use_category (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  sort_order integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER lookup_use_category_touch_updated_at
  BEFORE UPDATE ON lookup_use_category
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
INSERT INTO lookup_use_category (name, sort_order) VALUES
  ('Arabil', 1), ('Pășune', 2), ('Fânețe', 3), ('Vie', 4),
  ('Livadă', 5), ('Pădure', 6), ('Ape',    7), ('Neproductiv', 8);

-- ── lookup_person_type ───────────────────────────────────────
CREATE TABLE lookup_person_type (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  sort_order integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER lookup_person_type_touch_updated_at
  BEFORE UPDATE ON lookup_person_type
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
INSERT INTO lookup_person_type (name, sort_order) VALUES
  ('Persoană Fizică',   1), ('Persoană Juridică', 2), ('Expert',       3),
  ('PFA',               4), ('Instituție',         5), ('ONG',          6),
  ('Consiliu Local',    7);

-- ── lookup_citizenship ───────────────────────────────────────
CREATE TABLE lookup_citizenship (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  sort_order integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER lookup_citizenship_touch_updated_at
  BEFORE UPDATE ON lookup_citizenship
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
INSERT INTO lookup_citizenship (name, sort_order) VALUES
  ('Română', 1), ('Moldoveană', 2), ('Americană', 3), ('Germană',  4),
  ('Franceză', 5), ('Italiană', 6), ('Spaniolă',  7), ('Engleză',  8);

-- natural_person.citizenship_id FK — added here, not inline above, because
-- lookup_citizenship didn't exist yet when natural_person was created.
ALTER TABLE natural_person
  ADD CONSTRAINT natural_person_citizenship_id_fkey
  FOREIGN KEY (citizenship_id) REFERENCES lookup_citizenship(id) ON DELETE SET NULL;

-- ── lookup_document_type ─────────────────────────────────────
-- NOTE: Row 6 is 'Certificat de Moștenitor' (the correct value).
-- The original migration 0002 had a typo ('Certificat de Macanentur')
-- which was fixed manually before Slice 10.04. Correct here from the start.
--
-- `key` (added by migration 020) is the immutable slug business logic
-- switches on — never `name` (translatable/editable) and never the uuid
-- `id` (would break across environments). New type rows must only ever be
-- added by Adrian by hand via Administration -> Reference Data, or by
-- Claude when explicitly directed — never auto-seeded by app code.
CREATE TABLE lookup_document_type (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key        text        NOT NULL UNIQUE,
  name       text        NOT NULL,
  sort_order integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER lookup_document_type_touch_updated_at
  BEFORE UPDATE ON lookup_document_type
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
INSERT INTO lookup_document_type (key, name, sort_order) VALUES
  ('ACT_ADJUDECARE',             'Act de Adjudecare',              1),
  ('ACT_CADASTRU',               'Act Cadastru',                   2),
  ('ACT_DONATIE',                'Act de Donație',                 3),
  ('AUTORIZATIE',                'Autorizare',                     4),
  ('AVIZ_INSTITUTIE',            'Aviz de Instituție',             5),
  ('CARTE_IDENTITATE',           'Carte de Identitate',            6),
  ('CERTIFICAT_FISCAL',          'Certificat Fiscal',              7),
  ('CERTIFICAT_MOSTENITOR',      'Certificat de Moștenitor',       8),
  ('CERTIFICAT_SARCINI',         'Certificat de Bunuri',           9),
  ('CERTIFICAT_URBANISM',        'Certificat de Urbanism',        10),
  ('CONTRACT_ARENDA',            'Contract de Arendă',            11),
  ('CONTRACT_INCHIRIERE',        'Contract de Închiriere',        12),
  ('CONTRACT_PARTAJ',            'Contract de Partaj',            13),
  ('CONTRACT_PRESTARI_SERVICII', 'Contract de Prestări Servicii', 14),
  ('CONTRACT_VANZARE',           'Contract de Vânzare',           15),
  ('EXTRAS_CARTE_FUNCIARA',      'Extras din Carte Funciară',     16),
  ('EXTRAS_PUG',                 'Extras din PUG',                17),
  ('HOTARARE_JUDECATOREASCA',    'Hotărâre Judecătorească',       18),
  ('TESTAMENT',                  'Testament',                     19),
  ('TITLU_PROPRIETATE',          'Titlu de Proprietate',          20),
  ('UNCLASSIFIED',               'Unclassified',                  21),
  -- Alternate wordings kept as distinct types (Slice #15.06) — see
  -- migration_021_keep_alternate_wordings.sql for the rationale.
  ('AUTORIZATIE_ALT',            'Autorizație',                   22),
  ('CERTIFICAT_SARCINI_ALT',     'Certificat de Sarcini',         23),
  ('EXTRAS_CARTE_FUNCIARA_ALT',  'Extras de Carte Funciară',      24);

-- ── lookup_institution ───────────────────────────────────────
CREATE TABLE lookup_institution (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text        NOT NULL,
  institution_type text,
  sort_order       integer     NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER lookup_institution_touch_updated_at
  BEFORE UPDATE ON lookup_institution
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
INSERT INTO lookup_institution (name, institution_type, sort_order) VALUES
  ('OCPI',                  'Cadastru',                1),
  ('Primăria Municipiului', 'Administrație Locală',    2),
  ('Consiliu Județean',     'Administrație Județeană', 3),
  ('ANAF',                  'Fiscal',                  4),
  ('Notariat',              'Juridic',                 5),
  ('Judecătorie',           'Juridic',                 6),
  ('Tribunal',              'Juridic',                 7);

-- ── lookup_others  (final name; was lookup_service_interest) ─
-- Categories: Serviciu, Interes, Grup, Stampila
CREATE TABLE lookup_others (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  description text,
  category    text,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER lookup_others_touch_updated_at
  BEFORE UPDATE ON lookup_others
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
INSERT INTO lookup_others (name, category, sort_order) VALUES
  ('Consultanță Juridică', 'Serviciu', 1),
  ('Evaluare Imobiliară',  'Serviciu', 2),
  ('Mediere',              'Serviciu', 3),
  ('Topografie',           'Serviciu', 4),
  ('Cumpărare',            'Interes',  5),
  ('Vânzare',              'Interes',  6),
  ('Închiriere',           'Interes',  7),
  ('Arendare',             'Interes',  8);

-- ── lookup_person_role  (migration 013) ──────────────────────
CREATE TABLE lookup_person_role (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  description text,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER touch_updated_at_lookup_person_role
  BEFORE UPDATE ON lookup_person_role
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

INSERT INTO lookup_person_role (id, name, description, sort_order, created_at, updated_at) VALUES
  (gen_random_uuid(), 'Adjudecatar', '(principalul beneficiar care dobândește proprietatea prin licitație în executare silită)', 1, now(), now()),
  (gen_random_uuid(), 'Arendator', '(proprietarul care dă în arendă)', 2, now(), now()),
  (gen_random_uuid(), 'Arendaș', '(cel care ia în arendă și exploatează)', 3, now(), now()),
  (gen_random_uuid(), 'Autoritate locală', '(emitent)', 4, now(), now()),
  (gen_random_uuid(), 'Beneficiar / Client', NULL, 5, now(), now()),
  (gen_random_uuid(), 'Beneficiar / Solicitant', '(cel care obține autorizația, de obicei proprietarul)', 6, now(), now()),
  (gen_random_uuid(), 'Chiriaș / Locatar', '(cel care închiriază)', 7, now(), now()),
  (gen_random_uuid(), 'Constructor / Antreprenor', '(responsabil de execuție)', 8, now(), now()),
  (gen_random_uuid(), 'Coproprietar', '(în cazuri de indiviziune)', 9, now(), now()),
  (gen_random_uuid(), 'Coproprietar / Co-moștenitor', '(apare în același certificat)', 10, now(), now()),
  (gen_random_uuid(), 'Coproprietari / Coindivizari', '(părți care partajează)', 11, now(), now()),
  (gen_random_uuid(), 'Creditor', '(inițiator al executării)', 12, now(), now()),
  (gen_random_uuid(), 'Creditor / Ipotecar', '(pentru verificare sarcini)', 13, now(), now()),
  (gen_random_uuid(), 'Cumpărător', '(Dobânditor)', 14, now(), now()),
  (gen_random_uuid(), 'Debitor', '(cel al cărui bun este adjudecat)', 15, now(), now()),
  (gen_random_uuid(), 'Debitor / Plătitor de impozite', '(cel pentru care se atestă situația fiscală)', 16, now(), now()),
  (gen_random_uuid(), 'Executor judecătoresc', '(emitent)', 17, now(), now()),
  (gen_random_uuid(), 'Garant', NULL, 18, now(), now()),
  (gen_random_uuid(), 'Judecător / Instanță', '(emitent)', 19, now(), now()),
  (gen_random_uuid(), 'Locator', '(proprietarul care închiriază)', 20, now(), now()),
  (gen_random_uuid(), 'Martor / Notar', '(la autentificare, dacă e cazul)', 21, now(), now()),
  (gen_random_uuid(), 'Mediator / Judecător', '(în caz de partaj judiciar)', 22, now(), now()),
  (gen_random_uuid(), 'Moștenitor', '(principalul beneficiar)', 23, now(), now()),
  (gen_random_uuid(), 'Moștenitor / succesor', '(în cazuri de continuare a procedurii)', 24, now(), now()),
  (gen_random_uuid(), 'Moștenitor / Succesor', '(în cazuri specifice)', 25, now(), now()),
  (gen_random_uuid(), 'Moștenitori', NULL, 26, now(), now()),
  (gen_random_uuid(), 'Notar', '(autentificator)', 27, now(), now()),
  (gen_random_uuid(), 'Notar public', '(care emite certificatul)', 28, now(), now()),
  (gen_random_uuid(), 'Prestator', '(Furnizor de servicii)', 29, now(), now()),
  (gen_random_uuid(), 'Proiectant', '(în unele cazuri)', 30, now(), now()),
  (gen_random_uuid(), 'Proiectant / Arhitect', '(elaborator)', 31, now(), now()),
  (gen_random_uuid(), 'Proiectant / Consultant', NULL, 32, now(), now()),
  (gen_random_uuid(), 'Proprietar', '(Deținător de bunuri imobile/mobiliare)', 33, now(), now()),
  (gen_random_uuid(), 'Proprietar / Coproprietar', '(al imobilului)', 34, now(), now()),
  (gen_random_uuid(), 'Proprietar / Titular', '(al imobilului)', 35, now(), now()),
  (gen_random_uuid(), 'Proprietar / Titular al imobilului', NULL, 36, now(), now()),
  (gen_random_uuid(), 'Proprietar / Titular de drept real', '(principalul interesat)', 37, now(), now()),
  (gen_random_uuid(), 'Proprietar / Titular de drepturi înscrise', NULL, 38, now(), now()),
  (gen_random_uuid(), 'Pârât / Debitor', NULL, 39, now(), now()),
  (gen_random_uuid(), 'Reclamant / Petent', NULL, 40, now(), now()),
  (gen_random_uuid(), 'Reprezentant al instituției emitente', '(ex: mediu, cultură, utilități)', 41, now(), now()),
  (gen_random_uuid(), 'Reprezentant legal', '(al părților)', 42, now(), now()),
  (gen_random_uuid(), 'Reprezentant legal (al părților)', NULL, 43, now(), now()),
  (gen_random_uuid(), 'Reprezentant legal / Mandatar', '(prin procură)', 44, now(), now()),
  (gen_random_uuid(), 'Solicitant', '(cel care cere eliberarea certificatului)', 45, now(), now()),
  (gen_random_uuid(), 'Solicitant / Beneficiar', '(cel care comandă lucrarea)', 46, now(), now()),
  (gen_random_uuid(), 'Solicitant / Titular de drepturi', NULL, 47, now(), now()),
  (gen_random_uuid(), 'Solicitant / Titular de rol fiscal', NULL, 48, now(), now()),
  (gen_random_uuid(), 'Succesor universal', '(cu titlu particular)', 49, now(), now()),
  (gen_random_uuid(), 'Titular / Proprietar', '(principalul beneficiar)', 50, now(), now()),
  (gen_random_uuid(), 'Titular al imobilului', NULL, 51, now(), now()),
  (gen_random_uuid(), 'Titular al succesiunii / Defunct', '(persoana decedată)', 52, now(), now()),
  (gen_random_uuid(), 'Titular de drept', '(cel în favoarea căruia s-a pronunțat)', 53, now(), now()),
  (gen_random_uuid(), 'Topograf / Expert cadastral', '(cel care întocmește documentația)', 54, now(), now()),
  (gen_random_uuid(), 'Urbanist / Proiectant', NULL, 55, now(), now()),
  (gen_random_uuid(), 'Vânzător', '(Transmitent)', 56, now(), now())
ON CONFLICT DO NOTHING;

-- ── lookup_doc_type_person_role  (migration 014) ─────────────
CREATE TABLE lookup_doc_type_person_role (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type_id uuid        NOT NULL REFERENCES lookup_document_type(id) ON DELETE CASCADE,
  person_role_id   uuid        NOT NULL REFERENCES lookup_person_role(id)   ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_type_id, person_role_id)
);

WITH doc AS (SELECT id, name FROM lookup_document_type),
     rol AS (SELECT id, name FROM lookup_person_role)
INSERT INTO lookup_doc_type_person_role (id, document_type_id, person_role_id, created_at)
SELECT gen_random_uuid(), d.id, r.id, now()
FROM (VALUES
  ('Act de Adjudecare',             'Adjudecatar'),
  ('Act de Adjudecare',             'Debitor'),
  ('Act de Adjudecare',             'Executor judecătoresc'),
  ('Act de Adjudecare',             'Creditor'),
  ('Act de Adjudecare',             'Moștenitor / succesor'),
  ('Act Cadastru',                  'Proprietar / Titular de drept real'),
  ('Act Cadastru',                  'Solicitant / Beneficiar'),
  ('Act Cadastru',                  'Coproprietar'),
  ('Act Cadastru',                  'Reprezentant legal / Mandatar'),
  ('Act Cadastru',                  'Topograf / Expert cadastral'),
  ('Autorizare',                    'Beneficiar / Solicitant'),
  ('Autorizare',                    'Proprietar / Titular'),
  ('Autorizare',                    'Constructor / Antreprenor'),
  ('Autorizare',                    'Proiectant / Arhitect'),
  ('Autorizare',                    'Reprezentant legal'),
  ('Aviz de Instituție',            'Solicitant / Beneficiar'),
  ('Aviz de Instituție',            'Titular al imobilului'),
  ('Aviz de Instituție',            'Reprezentant al instituției emitente'),
  ('Aviz de Instituție',            'Proiectant / Consultant'),
  ('Certificat Fiscal',             'Solicitant / Titular de rol fiscal'),
  ('Certificat Fiscal',             'Proprietar / Coproprietar'),
  ('Certificat Fiscal',             'Moștenitor / Succesor'),
  ('Certificat Fiscal',             'Debitor / Plătitor de impozite'),
  ('Certificat de Moștenitor',      'Moștenitor'),
  ('Certificat de Moștenitor',      'Solicitant'),
  ('Certificat de Moștenitor',      'Titular al succesiunii / Defunct'),
  ('Certificat de Moștenitor',      'Coproprietar / Co-moștenitor'),
  ('Certificat de Moștenitor',      'Reprezentant legal / Mandatar'),
  ('Certificat de Moștenitor',      'Notar public'),
  ('Certificat de Moștenitor',      'Succesor universal'),
  ('Certificat de Bunuri',          'Solicitant / Titular de drepturi'),
  ('Certificat de Bunuri',          'Proprietar'),
  ('Certificat de Bunuri',          'Moștenitor'),
  ('Certificat de Bunuri',          'Coproprietar'),
  ('Certificat de Urbanism',        'Solicitant / Beneficiar'),
  ('Certificat de Urbanism',        'Proprietar / Titular al imobilului'),
  ('Certificat de Urbanism',        'Reprezentant legal / Mandatar'),
  ('Certificat de Urbanism',        'Proiectant'),
  ('Contract de Arendă',            'Arendator'),
  ('Contract de Arendă',            'Arendaș'),
  ('Contract de Arendă',            'Reprezentant legal'),
  ('Contract de Arendă',            'Martor / Notar'),
  ('Contract de Închiriere',        'Locator'),
  ('Contract de Închiriere',        'Chiriaș / Locatar'),
  ('Contract de Închiriere',        'Garant'),
  ('Contract de Închiriere',        'Reprezentant legal'),
  ('Contract de Partaj',            'Coproprietari / Coindivizari'),
  ('Contract de Partaj',            'Moștenitori'),
  ('Contract de Partaj',            'Notar'),
  ('Contract de Partaj',            'Mediator / Judecător'),
  ('Contract de Prestări Servicii', 'Prestator'),
  ('Contract de Prestări Servicii', 'Beneficiar / Client'),
  ('Contract de Prestări Servicii', 'Reprezentant legal (al părților)'),
  ('Contract de Vânzare',           'Vânzător'),
  ('Contract de Vânzare',           'Cumpărător'),
  ('Contract de Vânzare',           'Notar'),
  ('Contract de Vânzare',           'Reprezentant legal / Mandatar'),
  ('Contract de Vânzare',           'Moștenitor / Succesor'),
  ('Extras din Carte Funciară',     'Solicitant / Beneficiar'),
  ('Extras din Carte Funciară',     'Proprietar / Titular de drepturi înscrise'),
  ('Extras din Carte Funciară',     'Reprezentant legal'),
  ('Extras din Carte Funciară',     'Creditor / Ipotecar'),
  ('Extras din PUG',                'Solicitant / Beneficiar'),
  ('Extras din PUG',                'Autoritate locală'),
  ('Extras din PUG',                'Urbanist / Proiectant'),
  ('Hotărâre Judecătorească',       'Reclamant / Petent'),
  ('Hotărâre Judecătorească',       'Pârât / Debitor'),
  ('Hotărâre Judecătorească',       'Moștenitor / Succesor'),
  ('Hotărâre Judecătorească',       'Titular de drept'),
  ('Hotărâre Judecătorească',       'Judecător / Instanță'),
  ('Titlu de Proprietate',          'Titular / Proprietar'),
  ('Titlu de Proprietate',          'Moștenitor / Succesor'),
  ('Titlu de Proprietate',          'Coproprietar'),
  ('Titlu de Proprietate',          'Reprezentant legal')
) AS pairs(doc_name, role_name)
JOIN doc d ON d.name = pairs.doc_name
JOIN rol r ON r.name = pairs.role_name
ON CONFLICT DO NOTHING;

-- ── lookup_property_person_role  (migration 015) ─────────────
CREATE TABLE lookup_property_person_role (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  person_role_id uuid        NOT NULL UNIQUE REFERENCES lookup_person_role(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Seed: roles valid for Property ↔ Person associations (matches dev)
INSERT INTO lookup_property_person_role (id, person_role_id, created_at)
  SELECT gen_random_uuid(), id, now() FROM lookup_person_role WHERE name = 'Coproprietari / Coindivizari' ON CONFLICT (person_role_id) DO NOTHING;
INSERT INTO lookup_property_person_role (id, person_role_id, created_at)
  SELECT gen_random_uuid(), id, now() FROM lookup_person_role WHERE name = 'Cumpărător' ON CONFLICT (person_role_id) DO NOTHING;
INSERT INTO lookup_property_person_role (id, person_role_id, created_at)
  SELECT gen_random_uuid(), id, now() FROM lookup_person_role WHERE name = 'Proprietar / Titular de drept real' ON CONFLICT (person_role_id) DO NOTHING;
INSERT INTO lookup_property_person_role (id, person_role_id, created_at)
  SELECT gen_random_uuid(), id, now() FROM lookup_person_role WHERE name = 'Titular de drept' ON CONFLICT (person_role_id) DO NOTHING;

-- ============================================================
-- DOCUMENT domain  (drizzle 0003, renamed from "paperwork" in
-- migration 020 — Slice #15.05)
-- ============================================================

CREATE TABLE document (
  id                  uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_object_id uuid           NOT NULL UNIQUE REFERENCES principal_object(id),
  code                text           NOT NULL UNIQUE,
  document_type_id    uuid           NOT NULL REFERENCES lookup_document_type(id),
  title               text,
  nr_document         text,
  date_document       date,
  institution         text,
  emitent             text,
  baza_legala         text,
  uat_proprietate     text,
  uat_proprietar      text,
  suprafata           numeric(12,2),
  nr_dosar_succesoral text,
  data_decesului      date,
  ultimul_domiciliu   text,
  nr_certificat_deces text,
  date_start          date,
  date_end            date,
  titular_text        text,
  defunct_text        text,
  parties_a_text      text,
  parties_b_text      text,
  notes               text,
  created_at          timestamptz    NOT NULL DEFAULT now(),
  updated_at          timestamptz    NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

CREATE TRIGGER document_touch_updated_at
  BEFORE UPDATE ON document
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ============================================================
-- JUNCTION TABLES  (drizzle 0005–0006 + migrations 016–017, 020)
-- ============================================================

-- property_person  (final: includes person_role_id from migration 016)
CREATE TABLE property_person (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id    uuid        NOT NULL REFERENCES property(id)  ON DELETE CASCADE,
  person_id      uuid        NOT NULL REFERENCES person(id)    ON DELETE CASCADE,
  person_role_id uuid        REFERENCES lookup_person_role(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX property_person_unique ON property_person (property_id, person_id);

-- property_document  (renamed from property_paperwork)
CREATE TABLE property_document (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid        NOT NULL REFERENCES property(id) ON DELETE CASCADE,
  document_id uuid        NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX property_document_unique ON property_document (property_id, document_id);

-- property_property  (self-ref, symmetric)
CREATE TABLE property_property (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id_a   uuid        NOT NULL REFERENCES property(id) ON DELETE CASCADE,
  property_id_b   uuid        NOT NULL REFERENCES property(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT property_property_order CHECK (property_id_a < property_id_b)
);
CREATE UNIQUE INDEX property_property_unique ON property_property (property_id_a, property_id_b);

-- person_document  (final: includes quality from migration 013 + person_role_id
-- from migration 017; renamed from person_paperwork)
CREATE TABLE person_document (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id      uuid        NOT NULL REFERENCES person(id)    ON DELETE CASCADE,
  document_id    uuid        NOT NULL REFERENCES document(id)  ON DELETE CASCADE,
  quality        text,
  person_role_id uuid        REFERENCES lookup_person_role(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX person_document_unique ON person_document (person_id, document_id);

-- person_person  (self-ref, symmetric)
CREATE TABLE person_person (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id_a  uuid        NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  person_id_b  uuid        NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT person_person_order CHECK (person_id_a < person_id_b)
);
CREATE UNIQUE INDEX person_person_unique ON person_person (person_id_a, person_id_b);

-- document_document  (self-ref, symmetric; renamed from paperwork_paperwork)
CREATE TABLE document_document (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id_a   uuid        NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  document_id_b   uuid        NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_document_order CHECK (document_id_a < document_id_b)
);
CREATE UNIQUE INDEX document_document_unique ON document_document (document_id_a, document_id_b);

-- ============================================================
-- DOCUMENT_PAGE  (migration 010, renamed from paperwork_page in
-- migration 020)
-- ============================================================

CREATE TABLE document_page (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  uuid        NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  page_number  integer     NOT NULL,
  page_name    text,
  page_notes   text,
  file_name    text        NOT NULL,
  file_path    text        NOT NULL,
  file_size    integer,
  mime_type    text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_page_document_number_unique UNIQUE (document_id, page_number)
);
CREATE TRIGGER touch_updated_at_document_page
  BEFORE UPDATE ON document_page
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ============================================================
-- AUTH  (drizzle 0007)
-- ============================================================

CREATE TABLE user_requests (
  id           uuid                 PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text                 NOT NULL,
  username     text                 NOT NULL,
  status       user_request_status  NOT NULL DEFAULT 'pending',
  requested_at timestamptz          NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processed_by text,
  email_sent   boolean              NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX user_requests_email_pending_unique
  ON user_requests (email)
  WHERE status = 'pending';

CREATE TABLE app_users (
  id           uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_uid text           UNIQUE,
  email        text           NOT NULL UNIQUE,
  username     text           NOT NULL UNIQUE,
  role         app_user_role  NOT NULL DEFAULT 'user',
  approved_by  text,
  created_at   timestamptz    NOT NULL DEFAULT now()
);
