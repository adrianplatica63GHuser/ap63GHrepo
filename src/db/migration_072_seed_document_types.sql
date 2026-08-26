-- migration_072_seed_document_types.sql
-- Fill Administration -> Reference Data -> Document Types with the whole
-- catalogue, additively.
--
-- WHY THIS EXISTS RATHER THAN `sync-reference-data.sql`
--   That file is the REBUILD path and it opens with
--   `TRUNCATE ... lookup_document_type, lookup_institution, ... CASCADE`, which
--   would take every other reference list with it -- person roles, institutions,
--   citizenships, the three relationship-role lists -- and CASCADE would take
--   the doc-type/person-role whitelist too. Running it to get document types is
--   a wrecking ball for a nail. This inserts and touches nothing else.
--
-- ⚠️ **ADDITIVE AND IDEMPOTENT: `ON CONFLICT (key) DO NOTHING`.** A row that is
-- already there keeps its id, its name, its sort_order and its template_fields.
-- That matters more than it sounds: `template_fields` is the FORM DocTypeEngine
-- writes, and an upsert here would erase the work of every distillation run.
-- Re-running this after building forms is safe by construction, not by care.
--
-- ⚠️ **IT DOES NOT RENAME.** If a row exists under a key with a different name
-- -- because it was hand-created, or auto-created by an import from a model's
-- label -- this leaves that name alone rather than overwriting what a person
-- chose. Rename from Reference Data, where a rename cannot touch the key.
--
-- ⚠️ **`origin` IS LEFT AT ITS DEFAULT, WHICH IS 'MANUAL', AND THAT IS
-- CORRECT.** Slice #26.12 settled what the column means: origin says WHO CHOSE
-- THE NAME. Every name below was chosen by a person, so these rows display as
-- "Adaugat manual" rather than as something the machine invented. Only
-- `resolveClassifiedDocumentType` writes 'IMPORT'.
--
-- WHAT IT DOES NOT GIVE YOU
--   A form. Every row lands with `template_fields` NULL, so the first import
--   over a folder still stops at the Slice #29.08 gate -- but it stops saying
--   "these types need a form", which DocTypeEngine answers, instead of "this
--   type does not exist", which it cannot. That is the whole point of seeding
--   the catalogue wide.
--
-- ⚠️ **NAMING IT `migration_*.sql` PUTS IT IN THE REBUILD CHAIN, AND THAT IS
-- WANTED RATHER THAN INCIDENTAL.** `migrationChain()` in
-- scripts/verify-rebuild.ts globs `src/db/migration_*.sql` and applies every
-- match in name order, so this file runs against the migration-chain database
-- too -- not only by hand against a live one. The effect is that the two
-- rebuild paths now AGREE about all forty types instead of disagreeing about
-- the fifteen only the sync file knew, which is why adding them produced no new
-- REFDATA lines in src/db/rebuild-known-differences.txt. A first reading of that
-- run expected fifteen; the cancellation is the better outcome and the reason
-- to leave the name alone.
--
-- It is safe in that position because it is additive and ordered: it runs after
-- migration_071_doctype_rekey.sql (072 > 071 by name), so the chain has already
-- retired the `_ALT` keys before this inserts anything, and ON CONFLICT means
-- the rows earlier migrations already seeded are left exactly as they were.
--
-- GENERATED FROM src/db/sync-reference-data.sql, whose block is bound to
-- KNOWN_DOCUMENT_TYPES in both directions by
-- src/__tests__/document-type-catalogue-single-source.test.ts. Regenerate
-- rather than hand-edit if the catalogue grows again.
--
-- Apply locally:
--   docker cp src/db/migration_072_seed_document_types.sql ga40prj-postgres:/tmp/m072.sql
--   docker exec ga40prj-postgres psql -U postgres -d ga40db -f /tmp/m072.sql
-- Apply to Supabase: paste into SQL Editor.
--
-- ⚠️ Run migration_071_doctype_rekey.sql FIRST on any database that still holds
-- the old `_ALT` keys. Out of order, this file inserts CERTIFICAT_SARCINI as
-- 'Certificat de Sarcini' while the old row of that key still means 'Certificat
-- de Bunuri' -- the conflict is skipped, and you are left with one row carrying
-- the new key and the old meaning.

BEGIN;

INSERT INTO lookup_document_type (key, name, sort_order) VALUES
  ('ACT_ADJUDECARE',              'Act de Adjudecare',                   1),
  ('ACT_CADASTRU',                'Act Cadastru',                        2),
  ('ACT_DONATIE',                 'Act de Donație',                      3),
  ('AVIZ_INSTITUTIE',             'Aviz de Instituție',                  5),
  ('CARTE_IDENTITATE',            'Carte de Identitate',                 6),
  ('CERTIFICAT_FISCAL',           'Certificat Fiscal',                   7),
  ('CERTIFICAT_MOSTENITOR',       'Certificat de Moștenitor',            8),
  ('CERTIFICAT_BUNURI',           'Certificat de Bunuri',                9),
  ('CERTIFICAT_URBANISM',         'Certificat de Urbanism',             10),
  ('CONTRACT_ARENDA',             'Contract de Arendă',                 11),
  ('CONTRACT_INCHIRIERE',         'Contract de Închiriere',             12),
  ('CONTRACT_PARTAJ',             'Contract de Partaj',                 13),
  ('CONTRACT_PRESTARI_SERVICII',  'Contract de Prestări Servicii',      14),
  ('CONTRACT_VANZARE',            'Contract de Vânzare',                15),
  ('EXTRAS_CARTE_FUNCIARA',       'Extras din Carte Funciară',          16),
  ('EXTRAS_PUG',                  'Extras din PUG',                     17),
  ('HOTARARE_JUDECATOREASCA',     'Hotărâre Judecătorească',            18),
  ('TESTAMENT',                   'Testament',                          19),
  ('TITLU_PROPRIETATE',           'Titlu de Proprietate',               20),
  ('UNCLASSIFIED',                'NECLASIFICAT',                       21),
  ('AUTORIZATIE',                 'Autorizație',                        22),
  ('CERTIFICAT_SARCINI',          'Certificat de Sarcini',              23),
  ('HOTARARE_ADMINISTRATIVA',     'Hotărâre Administrativă',           110),
  ('DOCUMENTATIE_CADASTRALA',     'Documentație Cadastrală',           120),
  ('AUTORIZATIE_CONSTRUIRE',      'Autorizație De Construire',         130),
  ('ACT_LOTIZARE',                'Act de Lotizare',                    25),
  ('ACT_PARTAJ',                  'Act de Partaj',                      26),
  ('ADEVERINTA',                  'Adeverință',                         27),
  ('ADRESA_OFICIALA',             'Adresă Oficială',                    28),
  ('ANTECONTRACT',                'Antecontract',                       29),
  ('CERERE_DESPAGUBIRE',          'Cerere de Despăgubire',              30),
  ('CHITANTA',                    'Chitanță',                           31),
  ('COMUNICARE_OFICIALA',         'Comunicare Oficială',                32),
  ('DOVADA_EXPROPRIERE',          'Dovadă de Expropriere',              33),
  ('EXTRAS_CONT',                 'Extras de Cont',                     34),
  ('FISA_CORPULUI_PROPRIETATE',   'Fișa Corpului de Proprietate',       35),
  ('INCHEIERE_INTABULARE',        'Încheiere de Intabulare',            36),
  ('PLAN_AMPLASAMENT_DELIMITARE', 'Plan de Amplasament și Delimitare',  37),
  ('PLAN_PARCELAR',               'Plan Parcelar',                      38),
  ('PROCURA',                     'Procură',                            39)
ON CONFLICT (key) DO NOTHING;

COMMIT;

-- Verify ------------------------------------------------------------------
-- Expect 40 rows, NECLASIFICAT pinned first (that is how `listValues` and the
-- admin screen order them), and every name beside the key it belongs to.
--
--   SELECT key, name, sort_order,
--          (template_fields IS NOT NULL) AS has_form
--   FROM   lookup_document_type
--   ORDER  BY CASE WHEN key = 'UNCLASSIFIED' THEN 0 ELSE 1 END, name;
--
--   SELECT count(*) FROM lookup_document_type;   -- 40
