-- HAND-MAINTAINED, despite the line below. `npm run export:reference-data`
-- points at scripts/export-reference-data.ts, and that file is not in the
-- repository -- so the script exits 1 and this file has been edited by hand
-- for some time. Noticed while wiring scripts/verify-rebuild.ts (Slice #31.01);
-- either write the generator or drop the npm script, but do not trust the next
-- line until one of those happens.
--
-- Auto-generated from src/db/supabase_schema_full.sql (authoritative seed source)
-- Regenerate via: npm run export:reference-data
--
-- THIS FILE IS DESTRUCTIVE. It is a seed for a FRESHLY REBUILT database, not
-- a top-up for a live one. Its two TRUNCATE ... CASCADE statements below reach
-- nineteen domain tables through the lookup foreign keys -- document, person,
-- natural_person, judicial_person, property, property_corner, property_address,
-- every junction and every *_version table -- so running it against a database
-- with real records in it deletes them. Measured at Slice #31.01 by counting
-- the `truncate cascades to table` notices. Do not run it against ga40db
-- unless ga40db is disposable.
--
-- Apply to a freshly rebuilt Postgres instance to seed all reference/lookup data:
--   docker cp src/db/sync-reference-data.sql <container>:/tmp/ref.sql
--   docker exec <container> psql -U postgres -d ga40db -f /tmp/ref.sql

SET client_encoding = 'UTF8';

-- ──────────────────────────────────────────────────────────────────────────────
-- Truncate (junction tables first so FK constraints are not violated)
-- ──────────────────────────────────────────────────────────────────────────────
-- lookup_others was dropped by migration_052, so naming it here made this whole
-- file fail on its second statement against any current database. The three
-- relationship-role lookups from migration_055 were missing instead.
-- (Slice #31.01; scripts/verify-rebuild.ts now fails on both shapes.)
TRUNCATE lookup_property_person_role, lookup_person_person_role,
         lookup_doc_type_person_role CASCADE;
TRUNCATE lookup_person_role, lookup_property_type, lookup_tarla,
         lookup_use_category, lookup_person_type, lookup_citizenship,
         lookup_document_type, lookup_institution,
         lookup_judicial_person_type,
         lookup_property_property_role, lookup_document_document_role CASCADE;

-- ── lookup_property_type ──────────────────────────────────────────────────────
--
-- `key` and the three panel flags are NOT optional here. This block used to
-- insert (name, sort_order) only, and it had gone stale in two ways at once:
-- it wrote six of the fourteen types, and it left `key` NULL on all six.
-- `key` is the immutable slug src/lib/properties/type-config.ts switches on,
-- and the flags are the per-type form-panel visibility migration_041 sets --
-- DEFAULT FALSE means every panel hidden. A project seeded from the old block
-- had eight property types missing and six with no slug and every panel
-- hidden, and nothing in the repository would have said so.
-- Values are migration_039 + migration_040 (rows and slugs) and migration_041
-- (flags). scripts/verify-rebuild.ts now fails when any row here has key NULL.
-- (Slice #31.01)
INSERT INTO lookup_property_type
  (name, key, sort_order, show_tarla_parcela, show_address, show_street_view) VALUES
  -- Generic / Linear: everything visible
  ('Liniară',             'LINIARA',               3, TRUE,  TRUE,  TRUE),
  -- Urban / Built: no Tarla/Parcela, show Address + Street View
  ('Teren Construit',     'TEREN_CONSTRUIT',       2, FALSE, TRUE,  TRUE),
  ('Apartament',          'APARTAMENT',            5, FALSE, TRUE,  TRUE),
  ('Casă',                'CASA',                  6, FALSE, TRUE,  TRUE),
  ('Garaj',               'GARAJ',                 7, FALSE, TRUE,  TRUE),
  ('Spațiu Comercial',    'SPATIU_COMERCIAL',      8, FALSE, TRUE,  TRUE),
  ('Birou',               'BIROU',                 9, FALSE, TRUE,  TRUE),
  -- Agricultural / Rural: show Tarla/Parcela only
  ('Teren Arabil',        'TEREN_ARABIL',          1, TRUE,  FALSE, FALSE),
  ('Pășune',              'PASUNE',                4, TRUE,  FALSE, FALSE),
  ('Vie',                 'VIE',                  10, TRUE,  FALSE, FALSE),
  ('Livadă',              'LIVADA',               11, TRUE,  FALSE, FALSE),
  ('Fâneață',             'FANATA',               12, TRUE,  FALSE, FALSE),
  -- Forest / Vegetation: show Tarla/Parcela only
  ('Pădure',              'PADURE',               13, TRUE,  FALSE, FALSE),
  ('Vegetație Forestieră','VEGETATIE_FORESTIERA',  14, TRUE,  FALSE, FALSE);

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
-- `key` (added by migration 020, Slice #15.05) is the immutable slug app code
-- switches on — never `name` (translatable/editable).
--
-- ⚠️ **THIS BLOCK AND `KNOWN_DOCUMENT_TYPES` ARE ONE LIST WRITTEN TWICE, AND A
-- TEST HOLDS THEM TOGETHER.** src/lib/import/classify-prompts.ts whitelists the
-- classifier's `suggestedTypeKey` against that constant and
-- `resolveClassifiedDocumentType` then looks the key up in THIS catalogue; a key
-- on one side with no row on the other is finding F6 of the 29.01 report — the
-- document lands under a slug of its display label and every carve-out matching
-- the canonical key stops working. src/__tests__/
-- document-type-catalogue-single-source.test.ts parses the (key, name) pairs
-- below and asserts they are exactly the constant's, in both directions.
-- (Slice #29.07.)
--
-- ⚠️ **EDITING THIS BLOCK INVALIDATES src/db/rebuild-known-differences.txt.**
-- That file is GENERATED: it records the rows on which a migrated database and
-- a database rebuilt from these files disagree, and `scripts/verify-rebuild.ts`
-- fails when the real difference set no longer matches it — including when it
-- SHRINKS, which is what #29.07 does. Regenerate it with
-- `npm run db:verify-rebuild -- --update-baseline` (needs Docker; the run
-- itself never reports a pass, so a re-baseline is always deliberate) and
-- commit the result, or the `DB rebuild` workflow is red on the next push.
--
-- Three corrections Slice #29.07 made, each of them the file catching up with a
-- migration it had never been told about:
--   * ('AUTORIZATIE', 'Autorizare') is GONE. migration_043_doctype_cleanup.sql
--     deletes that row after reassigning its documents, version snapshots and
--     person-role pairs to AUTORIZATIE_ALT ('Autorizație'). Seeding it back gave
--     a rebuilt project a duplicate type the migrated one had removed.
--   * UNCLASSIFIED is named 'NECLASIFICAT', which is what migration_043 renames
--     it to. Until now a rebuilt project called it 'Unclassified' — an ENGLISH
--     name in the one list a Romanian user reads, and a divergence
--     `document-type-match.ts` had to carry a literal for.
--   * HOTARARE_ADMINISTRATIVA / DOCUMENTATIE_CADASTRALA / AUTORIZATIE_CONSTRUIRE
--     are added, with the names and sort_orders
--     migration_035_seed_doc_types.sql gives them. All three are in
--     `type-config.ts`, so a rebuilt project had three configured document types
--     that could not exist.
--
-- ⚠️ **`sort_order` IS NOT WHAT ORDERS THIS LIST ON SCREEN.** `listValues`
-- (src/lib/admin/value-lists/queries.ts) orders document-types by
-- `CASE WHEN key = 'UNCLASSIFIED' THEN 0 ELSE 1 END`, then by NAME — the column
-- is read for seven of the other eight lookup lists and not for this one
-- (`person-roles` orders by name too). So the numbers
-- below are a stable identity for the row and nothing more, existing values are
-- left where they are (4 is a deliberate gap where 'Autorizare' was), and
-- rebuild-known-differences.txt's claim that they make "the dropdown order
-- differently in a rebuilt project" was wrong when it was written.
INSERT INTO lookup_document_type (key, name, sort_order) VALUES
  ('ACT_ADJUDECARE',             'Act de Adjudecare',              1),
  ('ACT_CADASTRU',               'Act Cadastru',                   2),
  ('ACT_DONATIE',                'Act de Donație',                 3),
  ('AVIZ_INSTITUTIE',            'Aviz de Instituție',             5),
  ('CARTE_IDENTITATE',           'Carte de Identitate',            6),
  ('CERTIFICAT_FISCAL',          'Certificat Fiscal',              7),
  ('CERTIFICAT_MOSTENITOR',      'Certificat de Moștenitor',       8),
  -- CERTIFICAT_SARCINI carries 'Certificat de Bunuri' and the _ALT row carries
  -- 'Certificat de Sarcini'. That reads backwards and is deliberate: it is a
  -- naming decision inherited from migration_020's name-matching backfill, not
  -- a swap. The full history is in classify-prompts.ts's header. Do not "fix"
  -- it here, because `key` is immutable and app code matches on it.
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
  ('UNCLASSIFIED',               'NECLASIFICAT',                  21),
  ('AUTORIZATIE_ALT',            'Autorizație',                   22),
  ('CERTIFICAT_SARCINI_ALT',     'Certificat de Sarcini',         23),
  ('EXTRAS_CARTE_FUNCIARA_ALT',  'Extras de Carte Funciară',      24),
  -- migration_035_seed_doc_types.sql, values byte-for-byte from that file.
  ('HOTARARE_ADMINISTRATIVA',    'Hotărâre Administrativă',      110),
  ('DOCUMENTATIE_CADASTRALA',    'Documentație Cadastrală',      120),
  ('AUTORIZATIE_CONSTRUIRE',     'Autorizație De Construire',    130);

-- ── lookup_institution ────────────────────────────────────────────────────────
INSERT INTO lookup_institution (name, institution_type, sort_order) VALUES
  ('OCPI',                  'Cadastru',                1),
  ('Primăria Municipiului', 'Administrație Locală',    2),
  ('Consiliu Județean',     'Administrație Județeană', 3),
  ('ANAF',                  'Fiscal',                  4),
  ('Notariat',              'Juridic',                 5),
  ('Judecătorie',           'Juridic',                 6),
  ('Tribunal',              'Juridic',                 7);

-- lookup_others: the table was dropped by migration_052 (its three categories
-- moved to lookup_service / lookup_interest / stamps), so the INSERT that stood
-- here has been removed along with the TRUNCATE at the top. (Slice #31.01)

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
  -- 'Autorizare' until Slice #29.07: migration_043 deletes that type and moves
  -- its role pairs to 'Autorizație' (AUTORIZATIE_ALT). These rows JOIN on the
  -- document type's NAME, so under the old spelling all five silently matched
  -- nothing once the row above was removed — a JOIN that finds no row drops the
  -- pair without a word.
  ('Autorizație',                   'Beneficiar / Solicitant'),
  ('Autorizație',                   'Proprietar / Titular'),
  ('Autorizație',                   'Constructor / Antreprenor'),
  ('Autorizație',                   'Proiectant / Arhitect'),
  ('Autorizație',                   'Reprezentant legal'),
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

-- ── lookup_property_property_role (migration_055) ─────────────────────────────
-- Roles for Property ↔ Property. Values copied from migration_055, which is the
-- only place they were ever written; a Supabase project rebuilt from
-- supabase_schema_full.sql has the table and none of the rows.
INSERT INTO lookup_property_property_role (name, description, sort_order) VALUES
  ('Adiacent',        'Proprietăți cu latură comună',                     1),
  ('Inclus în',       'O proprietate este parte dintr-o alta',            2),
  ('Contiguu',        'Proprietăți vecine fără latură comună directă',    3),
  ('Subdiviziune a',  'Parcelă rezultată din dezmembrarea alteia',        4),
  ('Suprapus cu',     'Zone cu suprapunere parțială',                     5),
  ('Acces prin',      'Acces la drum sau utilități prin altă proprietate', 6),
  ('Alipit de',       'Proprietăți unite sau alipite cadastral',          7);

-- ── lookup_document_document_role (migration_055) ─────────────────────────────
-- Roles for Document ↔ Document.
INSERT INTO lookup_document_document_role (name, description, sort_order) VALUES
  ('Înlocuiește',           'Document care supersedează un altul',           1),
  ('Modifică',              'Document cu modificări parțiale față de altul', 2),
  ('Prelungește',           'Document care extinde valabilitatea altuia',    3),
  ('Anulează',              'Document care desființează un altul',           4),
  ('Consolidat cu',         'Documente corelate legal',                      5),
  ('Versiune anterioară a', 'Formă anterioară a unui document în vigoare',   6),
  ('Anexă la',              'Document atașat ca anexă unui document principal', 7),
  ('Corecție a',            'Document care rectifică erori dintr-un altul',  8);

-- ── lookup_person_person_role ─────────────────────────────────────────────────
-- Deliberately no rows. It is a whitelist over lookup_person_role that Adrian
-- fills from the Admin UI, and migration_055 seeds nothing into it either, so
-- an empty table here is the same state a migrated database is in. It is
-- truncated above so a rebuild does not inherit a previous run's whitelist.
