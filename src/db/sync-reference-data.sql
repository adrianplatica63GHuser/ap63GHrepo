-- Auto-generated from src/db/supabase_schema_full.sql (authoritative seed source)
-- Regenerate via: npm run export:reference-data
--
-- Apply to any Postgres instance to seed all reference/lookup data:
--   docker cp src/db/sync-reference-data.sql <container>:/tmp/ref.sql
--   docker exec <container> psql -U postgres -d ga40db -f /tmp/ref.sql

SET client_encoding = 'UTF8';

-- ──────────────────────────────────────────────────────────────────────────────
-- Truncate (junction tables first so FK constraints are not violated)
-- ──────────────────────────────────────────────────────────────────────────────
TRUNCATE lookup_property_person_role, lookup_doc_type_person_role CASCADE;
TRUNCATE lookup_person_role, lookup_property_type, lookup_tarla,
         lookup_use_category, lookup_person_type, lookup_citizenship,
         lookup_document_type, lookup_institution, lookup_others,
         lookup_judicial_person_type CASCADE;

-- ── lookup_property_type ──────────────────────────────────────────────────────
INSERT INTO lookup_property_type (name, sort_order) VALUES
  ('Teren Arabil',    1),
  ('Teren Construit', 2),
  ('Liniară',         3),
  ('Pășune',          4),
  ('Apartament',      5),
  ('Casă',            6);

-- ── lookup_tarla ──────────────────────────────────────────────────────────────
INSERT INTO lookup_tarla (indicativ, descriere, sort_order) VALUES
  ('T1',  'Tarla 1',  1), ('T2',  'Tarla 2',  2), ('T3',  'Tarla 3',  3),
  ('T4',  'Tarla 4',  4), ('T5',  'Tarla 5',  5), ('T6',  'Tarla 6',  6),
  ('T7',  'Tarla 7',  7), ('T8',  'Tarla 8',  8), ('T9',  'Tarla 9',  9),
  ('T10', 'Tarla 10', 10);

-- ── lookup_use_category ───────────────────────────────────────────────────────
INSERT INTO lookup_use_category (name, sort_order) VALUES
  ('Arabil', 1), ('Pășune', 2), ('Fânețe', 3), ('Vie', 4),
  ('Livadă', 5), ('Pădure', 6), ('Ape',    7), ('Neproductiv', 8);

-- ── lookup_person_type ────────────────────────────────────────────────────────
INSERT INTO lookup_person_type (name, sort_order) VALUES
  ('Persoană Fizică',   1), ('Persoană Juridică', 2), ('Expert',       3),
  ('PFA',               4), ('Instituție',         5), ('ONG',          6),
  ('Consiliu Local',    7);

-- ── lookup_citizenship ────────────────────────────────────────────────────────
INSERT INTO lookup_citizenship (name, sort_order) VALUES
  ('Română', 1), ('Moldoveană', 2), ('Americană', 3), ('Germană',  4),
  ('Franceză', 5), ('Italiană', 6), ('Spaniolă',  7), ('Engleză',  8);

-- ── lookup_judicial_person_type (Slice #15.07) ───────────────────────────────
INSERT INTO lookup_judicial_person_type (name, sort_order) VALUES
  ('SRL', 1), ('SA', 2), ('SRL-D', 3), ('PFA', 4),
  ('II',  5), ('IF', 6), ('ONG',   7), ('Altele', 8);

-- ── lookup_document_type ──────────────────────────────────────────────────────
-- NOTE: Row 8 is 'Certificat de Moștenitor' (the correct value).
-- The original migration 0002 had a typo ('Certificat de Macanentur') fixed here.
-- `key` (added by migration 020, Slice #15.05) is the immutable slug app code
-- switches on — never `name` (translatable/editable). This list was out of
-- sync with the live schema until Slice #15.06 (missing the key column and
-- 4 rows added by migrations 019/020); now matches supabase_schema_full.sql
-- exactly, including the 3 alternate-wording rows from migration 021.
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
  ('AUTORIZATIE_ALT',            'Autorizație',                   22),
  ('CERTIFICAT_SARCINI_ALT',     'Certificat de Sarcini',         23),
  ('EXTRAS_CARTE_FUNCIARA_ALT',  'Extras de Carte Funciară',      24);

-- ── lookup_institution ────────────────────────────────────────────────────────
INSERT INTO lookup_institution (name, institution_type, sort_order) VALUES
  ('OCPI',                  'Cadastru',                1),
  ('Primăria Municipiului', 'Administrație Locală',    2),
  ('Consiliu Județean',     'Administrație Județeană', 3),
  ('ANAF',                  'Fiscal',                  4),
  ('Notariat',              'Juridic',                 5),
  ('Judecătorie',           'Juridic',                 6),
  ('Tribunal',              'Juridic',                 7);

-- ── lookup_others (categories: Serviciu, Interes, Grup, Stampila) ────────────
INSERT INTO lookup_others (name, category, sort_order) VALUES
  ('Consultanță Juridică', 'Serviciu', 1),
  ('Evaluare Imobiliară',  'Serviciu', 2),
  ('Mediere',              'Serviciu', 3),
  ('Topografie',           'Serviciu', 4),
  ('Cumpărare',            'Interes',  5),
  ('Vânzare',              'Interes',  6),
  ('Închiriere',           'Interes',  7),
  ('Arendare',             'Interes',  8);

-- ── lookup_person_role ────────────────────────────────────────────────────────
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

-- ── lookup_doc_type_person_role ───────────────────────────────────────────────
-- Name-resolved so UUIDs don't need to match between environments.
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

-- ── lookup_property_person_role ───────────────────────────────────────────────
-- Name-resolved. Roles valid for the Property ↔ Person association.
INSERT INTO lookup_property_person_role (id, person_role_id, created_at)
  SELECT gen_random_uuid(), id, now() FROM lookup_person_role WHERE name = 'Coproprietari / Coindivizari' ON CONFLICT (person_role_id) DO NOTHING;
INSERT INTO lookup_property_person_role (id, person_role_id, created_at)
  SELECT gen_random_uuid(), id, now() FROM lookup_person_role WHERE name = 'Cumpărător' ON CONFLICT (person_role_id) DO NOTHING;
INSERT INTO lookup_property_person_role (id, person_role_id, created_at)
  SELECT gen_random_uuid(), id, now() FROM lookup_person_role WHERE name = 'Proprietar / Titular de drept real' ON CONFLICT (person_role_id) DO NOTHING;
INSERT INTO lookup_property_person_role (id, person_role_id, created_at)
  SELECT gen_random_uuid(), id, now() FROM lookup_person_role WHERE name = 'Titular de drept' ON CONFLICT (person_role_id) DO NOTHING;
