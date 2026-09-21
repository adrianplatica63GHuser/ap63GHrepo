-- HAND-MAINTAINED. There is no generator: `npm run export:reference-data`
-- pointed at scripts/export-reference-data.ts, which has never been in the
-- repository, so the script exited 1 and this file has been edited by hand for
-- some time. Slice #31.01 noticed it and left the choice open -- write the
-- generator or drop the script. Slice #33.05 dropped the script.
--
-- Edit this file by hand, and keep it in step with
-- src/db/supabase_schema_full.sql yourself.
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
-- Slice #34.04 dropped lookup_property_person_role and lookup_person_person_role
-- (migration_079); both are now boolean columns on lookup_person_role, so they
-- are cleared by the TRUNCATE of that table below rather than by name here.
-- lookup_doc_type_person_role does NOT collapse -- it is unique over the PAIR
-- (document_type_id, person_role_id) -- and stays.
TRUNCATE lookup_doc_type_person_role CASCADE;
TRUNCATE lookup_person_role, lookup_property_type, lookup_tarla,
         lookup_use_category, lookup_person_type, lookup_citizenship,
         lookup_document_type, lookup_institution,
         lookup_judicial_person_type,
         lookup_property_property_role, lookup_document_document_role CASCADE;

-- ── lookup_property_type ──────────────────────────────────────────────────────
--
-- The three panel flags are NOT optional here. This block used to insert
-- (name, sort_order) only, and it had gone stale in two ways at once: it wrote
-- six of the fourteen types, and it left `key` NULL on all six. The flags are
-- the per-type form-panel visibility migration_041 sets -- DEFAULT FALSE means
-- every panel hidden. A project seeded from the old block had eight property
-- types missing and six with every panel hidden, and nothing in the repository
-- would have said so. Values are migration_039 + migration_040 (rows and
-- slugs) and migration_041 (flags). (Slice #31.01)
--
-- ⚠️ **`key` IS NOW OPTIONAL, and this block keeps writing it only so that a
-- freshly-loaded project matches a migrated one column for column.** The
-- sentence here used to say `key` was "the immutable slug
-- src/lib/properties/type-config.ts switches on"; that module was replaced by
-- the three flags below in migration_041, and Slice #34.03 (D-23) deleted the
-- generator that was still filling the column in on every insert. Nothing
-- reads it, `scripts/verify-rebuild.ts` no longer requires it on this table,
-- and rows created through Reference Data from #34.03 on hold NULL.
-- `lookup_document_type.key` further down is a different column with the same
-- name and is genuinely load-bearing. (Slice #34.03)
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
--     person-role pairs to the 'Autorizație' row. Seeding it back gave a
--     rebuilt project a duplicate type the migrated one had removed. The KEY is
--     seeded again below, but for the surviving 'Autorizație' row rather than
--     for 'Autorizare' — see the re-key note under the sort_order paragraph.
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
-- `CASE WHEN key = 'UNCLASSIFIED' THEN 0 ELSE 1 END`, then by NAME, then by `id`
-- (Slice #34.32 appended the third term — see that branch for why the second is
-- not total) — the column
-- is read for seven of the other eight lookup lists and not for this one
-- (`person-roles` orders by name too). So the numbers
-- below are a stable identity for the row and nothing more, existing values are
-- left where they are (4 is a deliberate gap where 'Autorizare' was, and 24
-- another where 'Extras de Carte Funciară' was), and
-- rebuild-known-differences.txt's claim that they make "the dropdown order
-- differently in a rebuilt project" was wrong when it was written.
--
-- ⚠️ **THE RE-KEY, AND WHY THREE ROWS BELOW CARRY KEYS THEY DID NOT HAVE.**
-- migration_021_keep_alternate_wordings.sql added three second Romanian
-- wordings under `_ALT` keys, each suffixed only because the bare key was
-- already occupied. Two of those occupants are gone — 'Autorizare' by
-- migration_043, and 'Certificat de Bunuri' by moving to its own
-- CERTIFICAT_BUNURI — so the surviving rows take the bare keys:
--   ('AUTORIZATIE',        'Autorizație')          was AUTORIZATIE_ALT
--   ('CERTIFICAT_BUNURI',  'Certificat de Bunuri') was CERTIFICAT_SARCINI
--   ('CERTIFICAT_SARCINI', 'Certificat de Sarcini') was CERTIFICAT_SARCINI_ALT
-- and ('EXTRAS_CARTE_FUNCIARA_ALT', 'Extras de Carte Funciară') is dropped
-- altogether, folded into EXTRAS_CARTE_FUNCIARA.
--
-- ⚠️ **CERTIFICAT_SARCINI MEANS SOMETHING DIFFERENT FROM WHAT IT MEANT, WHICH
-- IS THE ONE THING AN IMMUTABLE KEY IS NOT SUPPOSED TO DO.** This file
-- TRUNCATEs before it inserts, so on the rebuild path there is no old row to
-- change meaning underneath. On a database that already holds the old rows,
-- running this seed is NOT how the change lands — migration_071_doctype_rekey.sql
-- is, and it renames CERTIFICAT_SARCINI to CERTIFICAT_BUNURI before freeing the
-- name. Re-seeding over live rows instead would turn every 'Certificat de
-- Bunuri' document into a 'Certificat de Sarcini' one without a word.
INSERT INTO lookup_document_type (key, name, sort_order) VALUES
  ('ACT_ADJUDECARE',             'Act de Adjudecare',              1),
  ('ACT_CADASTRU',               'Act Cadastru',                   2),
  ('ACT_DONATIE',                'Act de Donație',                 3),
  ('AVIZ_INSTITUTIE',            'Aviz de Instituție',             5),
  ('CARTE_IDENTITATE',           'Carte de Identitate',            6),
  ('CERTIFICAT_FISCAL',          'Certificat Fiscal',              7),
  ('CERTIFICAT_MOSTENITOR',      'Certificat de Moștenitor',       8),
  -- Was CERTIFICAT_SARCINI, which carried 'Certificat de Bunuri' while the
  -- _ALT row carried 'Certificat de Sarcini' — a naming decision inherited from
  -- migration_020's name-matching backfill that read backwards to anyone
  -- reading the Romanian. The history is in classify-prompts.ts's header; the
  -- untangling is migration_071's.
  ('CERTIFICAT_BUNURI',          'Certificat de Bunuri',           9),
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
  ('AUTORIZATIE',                'Autorizație',                   22),
  ('CERTIFICAT_SARCINI',         'Certificat de Sarcini',         23),
  -- migration_035_seed_doc_types.sql, values byte-for-byte from that file.
  ('HOTARARE_ADMINISTRATIVA',    'Hotărâre Administrativă',      110),
  ('DOCUMENTATIE_CADASTRALA',    'Documentație Cadastrală',      120),
  ('AUTORIZATIE_CONSTRUIRE',     'Autorizație De Construire',    130),
  -- Slice #29.15: fifteen types added so an import stops at the #29.08 gate
  -- for a MISSING FORM rather than for a type the archive has never heard of.
  -- Names carry Romanian diacritics like every row above them; `slugifyLookupKey`
  -- folds them, so the keys are unaffected either way and are written here in
  -- the catalogue's own style: connector words dropped (EXTRAS_CONT, not
  -- EXTRAS_DE_CONT), matching EXTRAS_CARTE_FUNCIARA and ACT_ADJUDECARE.
  --
  -- ⚠️ ACT_PARTAJ sits beside the older CONTRACT_PARTAJ and they are NOT the
  -- same instrument. Two visibly similar Romanian names is the shape that
  -- produced the CERTIFICAT_BUNURI / CERTIFICAT_SARCINI tangle, so the classify
  -- prompt carries a rule telling the model how to choose. Renaming either row
  -- without updating that rule puts the pair back where it started.
  ('ACT_LOTIZARE',                  'Act de Lotizare',                   25),
  ('ACT_PARTAJ',                    'Act de Partaj',                     26),
  ('ADEVERINTA',                    'Adeverință',                        27),
  ('ADRESA_OFICIALA',               'Adresă Oficială',                   28),
  ('ANTECONTRACT',                  'Antecontract',                      29),
  ('CERERE_DESPAGUBIRE',            'Cerere de Despăgubire',             30),
  ('CHITANTA',                      'Chitanță',                          31),
  ('COMUNICARE_OFICIALA',           'Comunicare Oficială',               32),
  ('DOVADA_EXPROPRIERE',            'Dovadă de Expropriere',             33),
  ('EXTRAS_CONT',                   'Extras de Cont',                    34),
  ('FISA_CORPULUI_PROPRIETATE',     'Fișa Corpului de Proprietate',      35),
  ('INCHEIERE_INTABULARE',          'Încheiere de Intabulare',           36),
  ('PLAN_AMPLASAMENT_DELIMITARE',   'Plan de Amplasament și Delimitare',  37),
  ('PLAN_PARCELAR',                 'Plan Parcelar',                     38),
  ('PROCURA',                       'Procură',                           39),
  -- Slice #34.19: the four act types the archive holds and this file did not.
  -- `scripts/add-document-types.sql` (Slice #34.09, part 4) created them by
  -- hand against the live database and said in as many words that it was NOT
  -- adding them here, because doing so also adds them to KNOWN_DOCUMENT_TYPES
  -- and that is a decision about what a MODEL may answer. Adrian answered it:
  -- all four, both lists. The evidence for each row is in that script's header
  -- (Catalogue 33.04, items 74, 77 and 78) and is not repeated here.
  --
  -- ⚠️ **THE `sort_order`s ARE NEW NUMBERS AND THE LIVE ROWS CARRY 0.**
  -- `add-document-types.sql` deliberately writes no `sort_order`, so the rows
  -- it created took the column's DEFAULT 0, and a database seeded from this
  -- file gets 40-43 instead. Nothing reads the difference: `listValues`
  -- (src/lib/admin/value-lists/queries.ts) orders document-types by
  -- `CASE WHEN key = 'UNCLASSIFIED' THEN 0 ELSE 1 END`, then by NAME, then by
  -- `id` (Slice #34.32), which is why the paragraph above calls these numbers a
  -- stable identity for the row and nothing more.
  --
  -- ⚠️ **THE MIGRATION CHAIN SEEDS THEM TOO, SINCE #34.30, AND A FIFTH ROW
  -- ADDED HERE WOULD NOT BE.** `migration_072_seed_document_types.sql` is
  -- generated from this block and runs in the rebuild chain, which is why the
  -- fifteen rows above produced no new REFDATA lines. It is an APPLIED
  -- migration whose MD5 is recorded in `schema_migrations`
  -- (Apply-Migration.ps1 compares it), so it is NOT regenerated in place —
  -- which left these four seed-only for one slice, as four `+` lines in
  -- src/db/rebuild-known-differences.txt. Slice #34.30 closed that the only
  -- way that leaves 072 untouched: a new additive migration,
  -- `migration_081_seed_act_document_types.sql`. Anything added to this block
  -- from now on needs one of its own, for the same reason.
  --
  -- ⚠️ **AND THE `sort_order`s BELOW ARE NO LONGER FREE.** migration_081
  -- carries 40-43 because `scripts/verify-rebuild.ts` compares reference rows
  -- as whole tuples: a row seeded on both paths with a DIFFERENT sort_order is
  -- not an agreement but a `+` line AND a `-` line. Changing one of these four
  -- numbers here without changing it there costs two baselined differences per
  -- row — which is the one way the „stable identity for the row and nothing
  -- more" paragraph above is now too relaxed about this column.
  ('ACT_ADITIONAL',                 'Act Adițional',                     40),
  ('ACT_ALIPIRE',                   'Act de Alipire',                    41),
  ('ACT_DEZLIPIRE',                 'Act de Dezlipire',                  42),
  ('ACT_DEZMEMBRARE',               'Act de Dezmembrare',                43);

-- ── lookup_document_type.template_fields ──────────────────────────────────────
--
-- The two forms Slice #36.01 authored, for the six flavours of sales contract
-- in the archive: „Contract de Vânzare" covers groups 1 to 5 (the flavour is a
-- field on the form, „Categorie internă", not five types), and „Act Adițional"
-- covers group 6, which is not a sale.
--
-- An UPDATE rather than two more columns on the INSERT above, deliberately:
-- that block is parsed as (key, name, sort_order) triples by
-- `src/__tests__/document-type-catalogue-single-source.test.ts`, which holds it
-- against `KNOWN_DOCUMENT_TYPES`. A fourth column there would break that parser
-- for a reason that has nothing to do with the catalogue.
--
-- ⚠️ **EDITING THIS BLOCK INVALIDATES `src/db/rebuild-known-differences.txt`**,
-- like every other edit to this file — `template_fields` is one of the columns
-- `scripts/verify-rebuild.ts` compares. It is seeded on BOTH paths, by
-- migration_085 and by this block, with the same bytes, so it should produce no
-- new difference at all; run `npm run db:verify-rebuild` (needs Docker) to see
-- that it does not.
--
-- ⚠️ **THIS BLOCK AND `migration_085_seed_cvc_templates.sql` HOLD THE SAME
-- TWO JSON ARRAYS, AND A TEST HOLDS THEM TOGETHER.** A template written
-- through the Reference Data form editor lives only in Adrian's database;
-- `Verify-Rebuild.ps1` compares a replayed migration chain against
-- `supabase_schema_full.sql`, and this file is the rebuild path for reference
-- data — so a template that exists on one path and not the other is a project
-- rebuilt without its two biggest forms. `src/__tests__/cvc-template.test.ts`
-- parses the arrays out of BOTH files and asserts they are deeply equal, so
-- editing one and not the other is red rather than invisible.
--                                                            (Slice #36.01)
UPDATE lookup_document_type
   SET template_fields = $cvc$
[
  {"key": "pretTotal", "labelRo": "Preț total", "labelEn": "Total price", "type": "number", "order": 0, "aiHint": "suma, doar cifre și separator zecimal, fără moneda și fără punct de mie", "groupRo": "Financiar", "groupEn": "Financial", "tabRo": "Instrument", "tabEn": "Instrument", "options": null},
  {"key": "monedaPret", "labelRo": "Monedă", "labelEn": "Currency", "type": "select", "order": 1, "aiHint": null, "groupRo": "Financiar", "groupEn": "Financial", "tabRo": "Instrument", "tabEn": "Instrument", "options": [{"value": "RON", "labelRo": "Lei (RON)", "labelEn": "Lei (RON)"}, {"value": "EUR", "labelRo": "Euro (EUR)", "labelEn": "Euro (EUR)"}, {"value": "USD", "labelRo": "Dolari (USD)", "labelEn": "Dollars (USD)"}]},
  {"key": "starePlata", "labelRo": "Stare plată", "labelEn": "Payment status", "type": "select", "order": 2, "aiHint": null, "groupRo": "Financiar", "groupEn": "Financial", "tabRo": "Instrument", "tabEn": "Instrument", "options": [{"value": "ACHITAT_INTEGRAL", "labelRo": "Achitat integral", "labelEn": "Paid in full"}, {"value": "ACHITAT_ANTECONTRACT", "labelRo": "Achitat la antecontract", "labelEn": "Paid under the promise"}, {"value": "ACHITAT_PARTIAL", "labelRo": "Achitat parțial", "labelEn": "Partly paid"}, {"value": "DE_ACHITAT", "labelRo": "De achitat", "labelEn": "To be paid"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}]},
  {"key": "modalitatePlata", "labelRo": "Modalitate plată", "labelEn": "Payment method", "type": "select", "order": 3, "aiHint": null, "groupRo": "Financiar", "groupEn": "Financial", "tabRo": "Instrument", "tabEn": "Instrument", "options": [{"value": "NUMERAR", "labelRo": "Numerar", "labelEn": "Cash"}, {"value": "VIRAMENT", "labelRo": "Virament bancar", "labelEn": "Bank transfer"}, {"value": "MIXT", "labelRo": "Mixt", "labelEn": "Mixed"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}]},
  {"key": "dataPlatii", "labelRo": "Data plății", "labelEn": "Payment date", "type": "date", "order": 4, "aiHint": "data la care prețul a fost încasat, când actul o dă separat de autentificare", "groupRo": "Financiar", "groupEn": "Financial", "tabRo": "Instrument", "tabEn": "Instrument", "options": null},
  {"key": "temeiPret", "labelRo": "Temei preț", "labelEn": "Price basis", "type": "text", "order": 5, "aiHint": "actul pe care se sprijină prețul, ca tip, număr și dată — «antecontract nr. N/zz.ll.aaaa», «promisiune bilaterală nr. N/zz.ll.aaaa»", "groupRo": "Financiar", "groupEn": "Financial", "tabRo": "Instrument", "tabEn": "Instrument", "options": null},
  {"key": "alocarePret", "labelRo": "Alocare preț", "labelEn": "Price allocation", "type": "text", "order": 6, "aiHint": "cum se împarte prețul, pe unități sau pe vânzători — «X lei lotul, Y lei cota de drum», «60% / 40%»", "groupRo": "Financiar", "groupEn": "Financial", "tabRo": "Instrument", "tabEn": "Instrument", "options": null},
  {"key": "scopVanzare", "labelRo": "Scop vânzare", "labelEn": "Purpose of sale", "type": "select", "order": 7, "aiHint": null, "groupRo": "Financiar", "groupEn": "Financial", "tabRo": "Instrument", "tabEn": "Instrument", "options": [{"value": "OBISNUITA", "labelRo": "Vânzare obișnuită", "labelEn": "Ordinary sale"}, {"value": "COMASARE", "labelRo": "Comasare", "labelEn": "Merger with other plots"}, {"value": "ALTUL", "labelRo": "Alt scop", "labelEn": "Other purpose"}]},
  {"key": "predareStapanire", "labelRo": "Predare stăpânire", "labelEn": "Transfer of possession", "type": "select", "order": 8, "aiHint": null, "groupRo": "Financiar", "groupEn": "Financial", "tabRo": "Instrument", "tabEn": "Instrument", "options": [{"value": "LA_AUTENTIFICARE", "labelRo": "La autentificare", "labelEn": "On authentication"}, {"value": "ULTERIOR", "labelRo": "Ulterior", "labelEn": "Later"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}]},
  {"key": "taxaTimbruPublicitate", "labelRo": "Taxă timbru și publicitate", "labelEn": "Stamp and land-publicity fee", "type": "number", "order": 9, "aiHint": "suma totală, doar cifre; când actul le dă separat, aici merge suma lor", "groupRo": "Taxe și onorarii", "groupEn": "Fees", "tabRo": "Instrument", "tabEn": "Instrument", "options": null},
  {"key": "timbruJudiciar", "labelRo": "Timbru judiciar", "labelEn": "Court stamp", "type": "number", "order": 10, "aiHint": "suma, doar cifre", "groupRo": "Taxe și onorarii", "groupEn": "Fees", "tabRo": "Instrument", "tabEn": "Instrument", "options": null},
  {"key": "onorariuNotarial", "labelRo": "Onorariu notarial", "labelEn": "Notary fee", "type": "number", "order": 11, "aiHint": "onorariul cu TVA inclus, doar cifre", "groupRo": "Taxe și onorarii", "groupEn": "Fees", "tabRo": "Instrument", "tabEn": "Instrument", "options": null},
  {"key": "impozitTransfer", "labelRo": "Impozit transfer", "labelEn": "Transfer tax", "type": "number", "order": 12, "aiHint": "impozitul pe transferul proprietății, doar cifre", "groupRo": "Taxe și onorarii", "groupEn": "Fees", "tabRo": "Instrument", "tabEn": "Instrument", "options": null},
  {"key": "categorieInterna", "labelRo": "Categorie internă", "labelEn": "Internal category", "type": "select", "order": 13, "aiHint": "starea dosarului, nu un alt tip de act", "groupRo": "Antet instrument", "groupEn": "Instrument header", "tabRo": "Cadastru", "tabEn": "Cadastre", "options": [{"value": "1", "labelRo": "1 — Cadastru vechi, CF nedefinitivă", "labelEn": "1 — Old cadastre, temporary land book"}, {"value": "2", "labelRo": "2 — Fără cadastru, pentru comasare", "labelEn": "2 — No cadastre, for merger"}, {"value": "3", "labelRo": "3 — Fără cadastru, completat ulterior", "labelEn": "3 — No cadastre, later completed"}, {"value": "4", "labelRo": "4 — Lot plus cotă de drum", "labelEn": "4 — Lot plus road share"}, {"value": "5", "labelRo": "5 — Documentație completă", "labelEn": "5 — Complete documentation"}]},
  {"key": "documentatieFinalizata", "labelRo": "Documentație finalizată", "labelEn": "File complete", "type": "select", "order": 14, "aiHint": null, "groupRo": "Antet instrument", "groupEn": "Instrument header", "tabRo": "Cadastru", "tabEn": "Cadastre", "options": [{"value": "DA", "labelRo": "Da", "labelEn": "Yes"}, {"value": "NU", "labelRo": "Nu", "labelEn": "No"}, {"value": "DA_DUPA_COMPLETARE", "labelRo": "Da, după completare", "labelEn": "Yes, after the supplement"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}]},
  {"key": "calitateExemplar", "labelRo": "Calitate exemplar", "labelEn": "Copy status", "type": "select", "order": 15, "aiHint": null, "groupRo": "Antet instrument", "groupEn": "Instrument header", "tabRo": "Cadastru", "tabEn": "Cadastre", "options": [{"value": "ORIGINAL", "labelRo": "Original", "labelEn": "Original"}, {"value": "DUPLICAT", "labelRo": "Duplicat", "labelEn": "Duplicate"}, {"value": "COPIE_LEGALIZATA", "labelRo": "Copie legalizată", "labelEn": "Certified copy"}]},
  {"key": "exemplareEmise", "labelRo": "Exemplare emise", "labelEn": "Originals issued", "type": "text", "order": 16, "aiHint": "numărul de exemplare și câte au rămas părților — «7, din care 5 părților»", "groupRo": "Antet instrument", "groupEn": "Instrument header", "tabRo": "Cadastru", "tabEn": "Cadastre", "options": null},
  {"key": "temeiAutentificare", "labelRo": "Temei autentificare", "labelEn": "Legal basis of authenticity", "type": "text", "order": 17, "aiHint": "articolul și legea invocate în încheierea de autentificare — «art. N lit. x Legea N/aaaa»", "groupRo": "Antet instrument", "groupEn": "Instrument header", "tabRo": "Cadastru", "tabEn": "Cadastre", "options": null},
  {"key": "dataContinut", "labelRo": "Data conținutului", "labelEn": "Content date", "type": "text", "order": 18, "aiHint": "anul sau data care se citește din corpul actului, când încheierea de autentificare lipsește de pe scan", "groupRo": "Antet instrument", "groupEn": "Instrument header", "tabRo": "Cadastru", "tabEn": "Cadastre", "options": null},
  {"key": "temeiExceptieCadastru", "labelRo": "Temei excepție cadastru", "labelEn": "Cadastre exemption basis", "type": "text", "order": 19, "aiHint": "temeiul pe care actul se încheie fără număr cadastral — «Titlul X art. N Legea N/aaaa»; gol când actul are cadastru", "groupRo": "Excepție cadastru", "groupEn": "Cadastre exception", "tabRo": "Cadastru", "tabEn": "Cadastre", "options": null},
  {"key": "marcajCarteFunciara", "labelRo": "Marcaj carte funciară", "labelEn": "Land-book marker", "type": "select", "order": 20, "aiHint": null, "groupRo": "Excepție cadastru", "groupEn": "Cadastre exception", "tabRo": "Cadastru", "tabEn": "Cadastre", "options": [{"value": "DEFINITIVA", "labelRo": "Carte funciară definitivă", "labelEn": "Final land book"}, {"value": "NEDEFINITIVA", "labelRo": "Carte funciară nedefinitivă (/N)", "labelEn": "Temporary land book (/N)"}, {"value": "FARA_CF", "labelRo": "Fără carte funciară", "labelEn": "No land book"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}]},
  {"key": "poateFiIntabulat", "labelRo": "Intabulare posibilă", "labelEn": "Can be tabulated now", "type": "select", "order": 21, "aiHint": null, "groupRo": "Excepție cadastru", "groupEn": "Cadastre exception", "tabRo": "Cadastru", "tabEn": "Cadastre", "options": [{"value": "DA", "labelRo": "Da", "labelEn": "Yes"}, {"value": "NU", "labelRo": "Nu", "labelEn": "No"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}]},
  {"key": "renuntareCercetareOcpi", "labelRo": "Renunțare cercetare OCPI", "labelEn": "Waiver of OCPI search", "type": "select", "order": 22, "aiHint": null, "groupRo": "Excepție cadastru", "groupEn": "Cadastre exception", "tabRo": "Cadastru", "tabEn": "Cadastre", "options": [{"value": "AFIRMAT", "labelRo": "Afirmat", "labelEn": "Asserted"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}, {"value": "EXCEPTIE", "labelRo": "Excepție", "labelEn": "Exception"}]},
  {"key": "obligatieNrCadastral", "labelRo": "Obligație număr cadastral", "labelEn": "Duty to obtain cadastral number", "type": "select", "order": 23, "aiHint": null, "groupRo": "Excepție cadastru", "groupEn": "Cadastre exception", "tabRo": "Cadastru", "tabEn": "Cadastre", "options": [{"value": "VANZATOR", "labelRo": "Vânzător", "labelEn": "Seller"}, {"value": "CUMPARATOR", "labelRo": "Cumpărător", "labelEn": "Buyer"}, {"value": "AMBELE", "labelRo": "Ambele părți", "labelEn": "Both parties"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}]},
  {"key": "termenFormalitati", "labelRo": "Termen formalități", "labelEn": "Deadline for formalities", "type": "text", "order": 24, "aiHint": "termenul dat pentru cadastru, intabulare sau rol fiscal — «N zile de la autentificare»", "groupRo": "Excepție cadastru", "groupEn": "Cadastre exception", "tabRo": "Cadastru", "tabEn": "Cadastre", "options": null},
  {"key": "completareUlterioara", "labelRo": "Completare ulterioară", "labelEn": "Later completion", "type": "text", "order": 25, "aiHint": "actul care completează acest contract, ca tip, număr și dată — «încheiere nr. N/zz.ll.aaaa»; gol când nu există", "groupRo": "Excepție cadastru", "groupEn": "Cadastre exception", "tabRo": "Cadastru", "tabEn": "Cadastre", "options": null},
  {"key": "consimtamantRadiere", "labelRo": "Consimțământ radiere", "labelEn": "Consent to radiation", "type": "select", "order": 26, "aiHint": null, "groupRo": "Excepție cadastru", "groupEn": "Cadastre exception", "tabRo": "Cadastru", "tabEn": "Cadastre", "options": [{"value": "AFIRMAT", "labelRo": "Afirmat", "labelEn": "Asserted"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}, {"value": "EXCEPTIE", "labelRo": "Excepție", "labelEn": "Exception"}]},
  {"key": "vecinatati", "labelRo": "Vecinătăți", "labelEn": "Neighbours", "type": "textarea", "order": 27, "aiHint": "vecinii pe laturi, cu lungimile când actul le dă, ca text — «N — ...; E — ...; S — ...; V — ...»", "groupRo": "Obiect declarat", "groupEn": "Declared object", "tabRo": "Cadastru", "tabEn": "Cadastre", "options": null},
  {"key": "origineLot", "labelRo": "Origine lot", "labelEn": "Origin of the lot", "type": "textarea", "order": 28, "aiHint": "actul din care a rezultat lotul — «lot rezultat din dezmembrarea actului nr. N/zz.ll.aaaa»", "groupRo": "Obiect declarat", "groupEn": "Declared object", "tabRo": "Cadastru", "tabEn": "Cadastre", "options": null},
  {"key": "inCircuitCivil", "labelRo": "Circuit civil", "labelEn": "In the civil circuit", "type": "select", "order": 29, "aiHint": null, "groupRo": "Stare juridică afirmată", "groupEn": "Asserted legal situation", "tabRo": "Stare juridică", "tabEn": "Legal status", "options": [{"value": "AFIRMAT", "labelRo": "Afirmat", "labelEn": "Asserted"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}, {"value": "EXCEPTIE", "labelRo": "Excepție", "labelEn": "Exception"}]},
  {"key": "liberDeSarcini", "labelRo": "Liber de sarcini", "labelEn": "Free of encumbrances", "type": "select", "order": 30, "aiHint": null, "groupRo": "Stare juridică afirmată", "groupEn": "Asserted legal situation", "tabRo": "Stare juridică", "tabEn": "Legal status", "options": [{"value": "AFIRMAT", "labelRo": "Afirmat", "labelEn": "Asserted"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}, {"value": "EXCEPTIE", "labelRo": "Excepție", "labelEn": "Exception"}]},
  {"key": "faraServituti", "labelRo": "Lipsă servituți", "labelEn": "Free of easements", "type": "select", "order": 31, "aiHint": null, "groupRo": "Stare juridică afirmată", "groupEn": "Asserted legal situation", "tabRo": "Stare juridică", "tabEn": "Legal status", "options": [{"value": "AFIRMAT", "labelRo": "Afirmat", "labelEn": "Asserted"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}, {"value": "EXCEPTIE", "labelRo": "Excepție", "labelEn": "Exception"}]},
  {"key": "neipotecat", "labelRo": "Neipotecat", "labelEn": "Not mortgaged", "type": "select", "order": 32, "aiHint": null, "groupRo": "Stare juridică afirmată", "groupEn": "Asserted legal situation", "tabRo": "Stare juridică", "tabEn": "Legal status", "options": [{"value": "AFIRMAT", "labelRo": "Afirmat", "labelEn": "Asserted"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}, {"value": "EXCEPTIE", "labelRo": "Excepție", "labelEn": "Exception"}]},
  {"key": "nepromisAltcuiva", "labelRo": "Nepromis altcuiva", "labelEn": "Not promised to another", "type": "select", "order": 33, "aiHint": null, "groupRo": "Stare juridică afirmată", "groupEn": "Asserted legal situation", "tabRo": "Stare juridică", "tabEn": "Legal status", "options": [{"value": "AFIRMAT", "labelRo": "Afirmat", "labelEn": "Asserted"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}, {"value": "EXCEPTIE", "labelRo": "Excepție", "labelEn": "Exception"}]},
  {"key": "nearendat", "labelRo": "Nearendat", "labelEn": "Not leased", "type": "select", "order": 34, "aiHint": null, "groupRo": "Stare juridică afirmată", "groupEn": "Asserted legal situation", "tabRo": "Stare juridică", "tabEn": "Legal status", "options": [{"value": "AFIRMAT", "labelRo": "Afirmat", "labelEn": "Asserted"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}, {"value": "EXCEPTIE", "labelRo": "Excepție", "labelEn": "Exception"}]},
  {"key": "neaportatSocietate", "labelRo": "Neaportat la capital", "labelEn": "Not contributed to share capital", "type": "select", "order": 35, "aiHint": null, "groupRo": "Stare juridică afirmată", "groupEn": "Asserted legal situation", "tabRo": "Stare juridică", "tabEn": "Legal status", "options": [{"value": "AFIRMAT", "labelRo": "Afirmat", "labelEn": "Asserted"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}, {"value": "EXCEPTIE", "labelRo": "Excepție", "labelEn": "Exception"}]},
  {"key": "faraLitigii", "labelRo": "Lipsă litigii", "labelEn": "No claims or restitution proceedings", "type": "select", "order": 36, "aiHint": null, "groupRo": "Stare juridică afirmată", "groupEn": "Asserted legal situation", "tabRo": "Stare juridică", "tabEn": "Legal status", "options": [{"value": "AFIRMAT", "labelRo": "Afirmat", "labelEn": "Asserted"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}, {"value": "EXCEPTIE", "labelRo": "Excepție", "labelEn": "Exception"}]},
  {"key": "faraExpropriere", "labelRo": "Lipsă expropriere", "labelEn": "Not under expropriation", "type": "select", "order": 37, "aiHint": null, "groupRo": "Stare juridică afirmată", "groupEn": "Asserted legal situation", "tabRo": "Stare juridică", "tabEn": "Legal status", "options": [{"value": "AFIRMAT", "labelRo": "Afirmat", "labelEn": "Asserted"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}, {"value": "EXCEPTIE", "labelRo": "Excepție", "labelEn": "Exception"}]},
  {"key": "faraMonumentIstoric", "labelRo": "Lipsă monument istoric", "labelEn": "Not a listed monument", "type": "select", "order": 38, "aiHint": null, "groupRo": "Stare juridică afirmată", "groupEn": "Asserted legal situation", "tabRo": "Stare juridică", "tabEn": "Legal status", "options": [{"value": "AFIRMAT", "labelRo": "Afirmat", "labelEn": "Asserted"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}, {"value": "EXCEPTIE", "labelRo": "Excepție", "labelEn": "Exception"}]},
  {"key": "nedezmembratContrar", "labelRo": "Nedezmembrat contrar extrasului", "labelEn": "Not subdivided contrary to the extract", "type": "select", "order": 39, "aiHint": null, "groupRo": "Stare juridică afirmată", "groupEn": "Asserted legal situation", "tabRo": "Stare juridică", "tabEn": "Legal status", "options": [{"value": "AFIRMAT", "labelRo": "Afirmat", "labelEn": "Asserted"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}, {"value": "EXCEPTIE", "labelRo": "Excepție", "labelEn": "Exception"}]},
  {"key": "garantieEvictiune", "labelRo": "Garanție evicțiune", "labelEn": "Eviction warranty", "type": "select", "order": 40, "aiHint": null, "groupRo": "Stare juridică afirmată", "groupEn": "Asserted legal situation", "tabRo": "Stare juridică", "tabEn": "Legal status", "options": [{"value": "AFIRMAT", "labelRo": "Afirmat", "labelEn": "Asserted"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}, {"value": "EXCEPTIE", "labelRo": "Excepție", "labelEn": "Exception"}]},
  {"key": "garantieVicii", "labelRo": "Garanție vicii ascunse", "labelEn": "Hidden-defect warranty", "type": "select", "order": 41, "aiHint": null, "groupRo": "Stare juridică afirmată", "groupEn": "Asserted legal situation", "tabRo": "Stare juridică", "tabEn": "Legal status", "options": [{"value": "AFIRMAT", "labelRo": "Afirmat", "labelEn": "Asserted"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}, {"value": "EXCEPTIE", "labelRo": "Excepție", "labelEn": "Exception"}]},
  {"key": "cumparatorCunoasteSituatia", "labelRo": "Situație cunoscută", "labelEn": "Buyer knows the situation", "type": "select", "order": 42, "aiHint": null, "groupRo": "Stare juridică afirmată", "groupEn": "Asserted legal situation", "tabRo": "Stare juridică", "tabEn": "Legal status", "options": [{"value": "AFIRMAT", "labelRo": "Afirmat", "labelEn": "Asserted"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}, {"value": "EXCEPTIE", "labelRo": "Excepție", "labelEn": "Exception"}]},
  {"key": "temeiLegalEvictiune", "labelRo": "Temei legal evicțiune", "labelEn": "Eviction warranty citation", "type": "text", "order": 43, "aiHint": "articolele citate pentru evicțiune și vicii — «art. N Cod civil», «art. N și N Cod civil»", "groupRo": "Conformitate și formalități", "groupEn": "Compliance and formalities", "tabRo": "Conformitate", "tabEn": "Compliance", "options": null},
  {"key": "declaratieArt292", "labelRo": "Declarație art. 292 CP", "labelEn": "Criminal-code non-alienation declaration", "type": "select", "order": 44, "aiHint": null, "groupRo": "Conformitate și formalități", "groupEn": "Compliance and formalities", "tabRo": "Conformitate", "tabEn": "Compliance", "options": [{"value": "AFIRMAT", "labelRo": "Afirmat", "labelEn": "Asserted"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}, {"value": "EXCEPTIE", "labelRo": "Excepție", "labelEn": "Exception"}]},
  {"key": "pretRealDeclarat", "labelRo": "Preț declarat real", "labelEn": "Declared price is the real price", "type": "select", "order": 45, "aiHint": null, "groupRo": "Conformitate și formalități", "groupEn": "Compliance and formalities", "tabRo": "Conformitate", "tabEn": "Compliance", "options": [{"value": "AFIRMAT", "labelRo": "Afirmat", "labelEn": "Asserted"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}, {"value": "EXCEPTIE", "labelRo": "Excepție", "labelEn": "Exception"}]},
  {"key": "notificareAml", "labelRo": "Notificare AML", "labelEn": "AML notice", "type": "select", "order": 46, "aiHint": null, "groupRo": "Conformitate și formalități", "groupEn": "Compliance and formalities", "tabRo": "Conformitate", "tabEn": "Compliance", "options": [{"value": "AFIRMAT", "labelRo": "Afirmat", "labelEn": "Asserted"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}, {"value": "EXCEPTIE", "labelRo": "Excepție", "labelEn": "Exception"}]},
  {"key": "consimtamantDatePersonale", "labelRo": "Consimțământ date personale", "labelEn": "Personal-data consent", "type": "select", "order": 47, "aiHint": null, "groupRo": "Conformitate și formalități", "groupEn": "Compliance and formalities", "tabRo": "Conformitate", "tabEn": "Compliance", "options": [{"value": "AFIRMAT", "labelRo": "Afirmat", "labelEn": "Asserted"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}, {"value": "EXCEPTIE", "labelRo": "Excepție", "labelEn": "Exception"}]},
  {"key": "preemptiuneTerenAgricol", "labelRo": "Preempțiune teren agricol", "labelEn": "Agricultural pre-emption", "type": "select", "order": 48, "aiHint": "formalitățile de preempțiune pentru teren extravilan", "groupRo": "Conformitate și formalități", "groupEn": "Compliance and formalities", "tabRo": "Conformitate", "tabEn": "Compliance", "options": [{"value": "INDEPLINITA", "labelRo": "Îndeplinită", "labelEn": "Completed"}, {"value": "NU_E_CAZUL", "labelRo": "Nu e cazul", "labelEn": "Not applicable"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}]},
  {"key": "preemptiunePadure", "labelRo": "Preempțiune pădure", "labelEn": "Forest pre-emption", "type": "select", "order": 49, "aiHint": null, "groupRo": "Conformitate și formalități", "groupEn": "Compliance and formalities", "tabRo": "Conformitate", "tabEn": "Compliance", "options": [{"value": "INDEPLINITA", "labelRo": "Îndeplinită", "labelEn": "Completed"}, {"value": "NU_E_CAZUL", "labelRo": "Nu e cazul", "labelEn": "Not applicable"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}]},
  {"key": "taxeLocaleLaZi", "labelRo": "Taxe locale la zi", "labelEn": "Local taxes current", "type": "select", "order": 50, "aiHint": null, "groupRo": "Conformitate și formalități", "groupEn": "Compliance and formalities", "tabRo": "Conformitate", "tabEn": "Compliance", "options": [{"value": "AFIRMAT", "labelRo": "Afirmat", "labelEn": "Asserted"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}, {"value": "EXCEPTIE", "labelRo": "Excepție", "labelEn": "Exception"}]},
  {"key": "taxeLocalePlatiteDe", "labelRo": "Plătitor taxe locale", "labelEn": "Local taxes paid by", "type": "select", "order": 51, "aiHint": null, "groupRo": "Conformitate și formalități", "groupEn": "Compliance and formalities", "tabRo": "Conformitate", "tabEn": "Compliance", "options": [{"value": "VANZATOR", "labelRo": "Vânzător", "labelEn": "Seller"}, {"value": "CUMPARATOR", "labelRo": "Cumpărător", "labelEn": "Buyer"}, {"value": "AMBELE", "labelRo": "Ambele părți", "labelEn": "Both parties"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}]},
  {"key": "cheltuieliPerfectare", "labelRo": "Cheltuieli perfectare", "labelEn": "Closing costs borne by", "type": "select", "order": 52, "aiHint": null, "groupRo": "Conformitate și formalități", "groupEn": "Compliance and formalities", "tabRo": "Conformitate", "tabEn": "Compliance", "options": [{"value": "VANZATOR", "labelRo": "Vânzător", "labelEn": "Seller"}, {"value": "CUMPARATOR", "labelRo": "Cumpărător", "labelEn": "Buyer"}, {"value": "AMBELE", "labelRo": "Ambele părți", "labelEn": "Both parties"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}]}
]
$cvc$::jsonb
 WHERE key = 'CONTRACT_VANZARE';

UPDATE lookup_document_type
   SET template_fields = $act$
[
  {"key": "onorariuNotarial", "labelRo": "Onorariu notarial", "labelEn": "Notary fee", "type": "number", "order": 0, "aiHint": "onorariul cu TVA inclus, doar cifre", "groupRo": "Taxe și onorarii", "groupEn": "Fees", "tabRo": "Act adițional", "tabEn": "Supplement", "options": null},
  {"key": "actParinteNumar", "labelRo": "Nr. act părinte", "labelEn": "Parent instrument no.", "type": "text", "order": 1, "aiHint": "numărul încheierii de autentificare a actului completat, doar numărul", "groupRo": "Act părinte", "groupEn": "Parent instrument", "tabRo": "Act adițional", "tabEn": "Supplement", "options": null},
  {"key": "actParinteData", "labelRo": "Data act părinte", "labelEn": "Parent instrument date", "type": "date", "order": 2, "aiHint": "data autentificării actului completat", "groupRo": "Act părinte", "groupEn": "Parent instrument", "tabRo": "Act adițional", "tabEn": "Supplement", "options": null},
  {"key": "actParinteNotariat", "labelRo": "Notariat act părinte", "labelEn": "Parent notary office", "type": "text", "order": 3, "aiHint": "biroul notarial care a autentificat actul completat, cum e scris pe act", "groupRo": "Act părinte", "groupEn": "Parent instrument", "tabRo": "Act adițional", "tabEn": "Supplement", "options": null},
  {"key": "actParinteTip", "labelRo": "Tip act părinte", "labelEn": "Parent instrument type", "type": "select", "order": 4, "aiHint": null, "groupRo": "Act părinte", "groupEn": "Parent instrument", "tabRo": "Act adițional", "tabEn": "Supplement", "options": [{"value": "CONTRACT_VANZARE", "labelRo": "Contract de vânzare", "labelEn": "Sale contract"}, {"value": "ACT_PARTAJ", "labelRo": "Act de partaj", "labelEn": "Partition deed"}, {"value": "ACT_DONATIE", "labelRo": "Act de donație", "labelEn": "Donation deed"}, {"value": "ALTUL", "labelRo": "Alt act", "labelEn": "Other instrument"}]},
  {"key": "motivCompletare", "labelRo": "Motiv completare", "labelEn": "Reason for the supplement", "type": "textarea", "order": 5, "aiHint": "de ce a fost nevoie de completare, pe scurt și în termenii actului — «lipsă certificat de sarcini, intabulare refuzată»", "groupRo": "Act părinte", "groupEn": "Parent instrument", "tabRo": "Act adițional", "tabEn": "Supplement", "options": null},
  {"key": "temeiLegalCompletare", "labelRo": "Temei legal completare", "labelEn": "Legal basis of the supplement", "type": "text", "order": 6, "aiHint": "articolul și legea invocate pentru completare — «art. N alin. N Legea N/aaaa»", "groupRo": "Act părinte", "groupEn": "Parent instrument", "tabRo": "Act adițional", "tabEn": "Supplement", "options": null},
  {"key": "efectUrmarit", "labelRo": "Efect urmărit", "labelEn": "Intended effect", "type": "select", "order": 7, "aiHint": null, "groupRo": "Act părinte", "groupEn": "Parent instrument", "tabRo": "Act adițional", "tabEn": "Supplement", "options": [{"value": "INTABULARE", "labelRo": "Deblocarea intabulării", "labelEn": "Unblocking land-book registration"}, {"value": "RECTIFICARE", "labelRo": "Rectificarea actului", "labelEn": "Correcting the instrument"}, {"value": "COMPLETARE_CLAUZE", "labelRo": "Completarea clauzelor", "labelEn": "Supplementing the clauses"}, {"value": "ALTUL", "labelRo": "Alt efect", "labelEn": "Other effect"}]},
  {"key": "pretNeschimbat", "labelRo": "Preț neschimbat", "labelEn": "Price unchanged", "type": "select", "order": 8, "aiHint": null, "groupRo": "Act părinte", "groupEn": "Parent instrument", "tabRo": "Act adițional", "tabEn": "Supplement", "options": [{"value": "DA", "labelRo": "Da", "labelEn": "Yes"}, {"value": "NU", "labelRo": "Nu", "labelEn": "No"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}]},
  {"key": "calitateExemplar", "labelRo": "Calitate exemplar", "labelEn": "Copy status", "type": "select", "order": 9, "aiHint": null, "groupRo": "Act părinte", "groupEn": "Parent instrument", "tabRo": "Act adițional", "tabEn": "Supplement", "options": [{"value": "ORIGINAL", "labelRo": "Original", "labelEn": "Original"}, {"value": "DUPLICAT", "labelRo": "Duplicat", "labelEn": "Duplicate"}, {"value": "COPIE_LEGALIZATA", "labelRo": "Copie legalizată", "labelEn": "Certified copy"}]},
  {"key": "exemplareEmise", "labelRo": "Exemplare emise", "labelEn": "Originals issued", "type": "text", "order": 10, "aiHint": "numărul de exemplare și câte au rămas părților — «1 original și 7 duplicate, din care 6 părților»", "groupRo": "Act părinte", "groupEn": "Parent instrument", "tabRo": "Act adițional", "tabEn": "Supplement", "options": null},
  {"key": "liberDeSarcini", "labelRo": "Liber de sarcini", "labelEn": "Free of encumbrances", "type": "select", "order": 11, "aiHint": null, "groupRo": "Clauze completate", "groupEn": "Supplemented clauses", "tabRo": "Clauze adăugate", "tabEn": "Added clauses", "options": [{"value": "AFIRMAT", "labelRo": "Afirmat", "labelEn": "Asserted"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}, {"value": "EXCEPTIE", "labelRo": "Excepție", "labelEn": "Exception"}]},
  {"key": "faraServituti", "labelRo": "Lipsă servituți", "labelEn": "Free of easements", "type": "select", "order": 12, "aiHint": null, "groupRo": "Clauze completate", "groupEn": "Supplemented clauses", "tabRo": "Clauze adăugate", "tabEn": "Added clauses", "options": [{"value": "AFIRMAT", "labelRo": "Afirmat", "labelEn": "Asserted"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}, {"value": "EXCEPTIE", "labelRo": "Excepție", "labelEn": "Exception"}]},
  {"key": "nedezmembratNealipit", "labelRo": "Nedezmembrat și nealipit", "labelEn": "Not split and not merged", "type": "select", "order": 13, "aiHint": null, "groupRo": "Clauze completate", "groupEn": "Supplemented clauses", "tabRo": "Clauze adăugate", "tabEn": "Added clauses", "options": [{"value": "AFIRMAT", "labelRo": "Afirmat", "labelEn": "Asserted"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}, {"value": "EXCEPTIE", "labelRo": "Excepție", "labelEn": "Exception"}]},
  {"key": "nearendat", "labelRo": "Nearendat", "labelEn": "Not leased", "type": "select", "order": 14, "aiHint": null, "groupRo": "Clauze completate", "groupEn": "Supplemented clauses", "tabRo": "Clauze adăugate", "tabEn": "Added clauses", "options": [{"value": "AFIRMAT", "labelRo": "Afirmat", "labelEn": "Asserted"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}, {"value": "EXCEPTIE", "labelRo": "Excepție", "labelEn": "Exception"}]},
  {"key": "consimtamantRadiere", "labelRo": "Consimțământ radiere", "labelEn": "Consent to radiation", "type": "select", "order": 15, "aiHint": null, "groupRo": "Clauze completate", "groupEn": "Supplemented clauses", "tabRo": "Clauze adăugate", "tabEn": "Added clauses", "options": [{"value": "AFIRMAT", "labelRo": "Afirmat", "labelEn": "Asserted"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}, {"value": "EXCEPTIE", "labelRo": "Excepție", "labelEn": "Exception"}]},
  {"key": "taxeLocaleLaZi", "labelRo": "Taxe locale la zi", "labelEn": "Local taxes current", "type": "select", "order": 16, "aiHint": null, "groupRo": "Clauze completate", "groupEn": "Supplemented clauses", "tabRo": "Clauze adăugate", "tabEn": "Added clauses", "options": [{"value": "AFIRMAT", "labelRo": "Afirmat", "labelEn": "Asserted"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}, {"value": "EXCEPTIE", "labelRo": "Excepție", "labelEn": "Exception"}]},
  {"key": "notificareAml", "labelRo": "Notificare AML", "labelEn": "AML notice", "type": "select", "order": 17, "aiHint": null, "groupRo": "Clauze completate", "groupEn": "Supplemented clauses", "tabRo": "Clauze adăugate", "tabEn": "Added clauses", "options": [{"value": "AFIRMAT", "labelRo": "Afirmat", "labelEn": "Asserted"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}, {"value": "EXCEPTIE", "labelRo": "Excepție", "labelEn": "Exception"}]},
  {"key": "consimtamantDatePersonale", "labelRo": "Consimțământ date personale", "labelEn": "Personal-data consent", "type": "select", "order": 18, "aiHint": null, "groupRo": "Clauze completate", "groupEn": "Supplemented clauses", "tabRo": "Clauze adăugate", "tabEn": "Added clauses", "options": [{"value": "AFIRMAT", "labelRo": "Afirmat", "labelEn": "Asserted"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}, {"value": "EXCEPTIE", "labelRo": "Excepție", "labelEn": "Exception"}]},
  {"key": "celelalteClauzeNemodificate", "labelRo": "Celelalte clauze nemodificate", "labelEn": "Remaining parent clauses unchanged", "type": "select", "order": 19, "aiHint": null, "groupRo": "Clauze completate", "groupEn": "Supplemented clauses", "tabRo": "Clauze adăugate", "tabEn": "Added clauses", "options": [{"value": "AFIRMAT", "labelRo": "Afirmat", "labelEn": "Asserted"}, {"value": "NEMENTIONAT", "labelRo": "Nu e menționat", "labelEn": "Not stated"}, {"value": "EXCEPTIE", "labelRo": "Excepție", "labelEn": "Exception"}]}
]
$act$::jsonb
 WHERE key = 'ACT_ADITIONAL';

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
  -- its role pairs to 'Autorizație' (keyed AUTORIZATIE since the re-key; it was
  -- AUTORIZATIE_ALT when this note was written). These rows JOIN on the
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

-- ── lookup_person_role.valid_for_property ─────────────────────────────────────
-- Name-resolved. Roles valid for the Property ↔ Person association.
--
-- ⚠️ **This was four INSERTs into `lookup_property_person_role` until Slice
-- #34.04 (migration_079) turned that table into this column, and it is the one
-- door into a database where those four ticks could have gone missing without
-- passing through the migration at all.** A cloud project reference-loaded
-- through this file never runs migration_079's fold; if these four names were
-- simply deleted here, every role would come up `valid_for_property = false`
-- and no association screen would offer a role. An adversarial round found it.
-- One statement rather than four, because a column takes a set.
UPDATE lookup_person_role
   SET valid_for_property = true
 WHERE name IN (
   'Coproprietari / Coindivizari',
   'Cumpărător',
   'Proprietar / Titular de drept real',
   'Titular de drept'
 );

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
  ('Corecție a',            'Document care rectifică erori dintr-un altul',  8),
  -- Slice #36.03 (migration_086). The four a title chain needs: none of
  -- migration_055's eight fits one, and the closest — „Consolidat cu" — is
  -- deliberately neutral and therefore says nothing, which is the one thing a
  -- deed does not do. Each reads FORWARDS with document_document.role_reads_a_to_b
  -- set, i.e. as „A <rol> B". sort_orders 9-12 match migration_086 exactly:
  -- scripts/verify-rebuild.ts compares reference rows as WHOLE TUPLES, so a row
  -- present on both sides with a different sort_order is not one agreement, it
  -- is two differences.
  ('Titlu anterior al',        'Înscrisul din care provine dreptul transmis prin documentul asociat',  9),
  ('Înscris doveditor pentru', 'Act depus ca dovadă la încheierea documentului asociat',               10),
  ('Act adițional la',         'Act adițional care completează documentul asociat',                    11),
  ('Antecontract al',          'Promisiune de vânzare care a precedat documentul asociat',             12);

-- ── lookup_person_role.valid_for_person ───────────────────────────────────────
-- Deliberately no ticks. It is a whitelist Adrian fills from the Admin UI, and
-- migration_055 seeded nothing into the table this column replaced either, so
-- false everywhere is the same state a migrated database is in. It needs no
-- statement at all now: the column is `NOT NULL DEFAULT false` and the
-- lookup_person_role TRUNCATE above re-creates every row from scratch, so a
-- rebuild cannot inherit a previous run's whitelist. (Slice #34.04,
-- migration_079 -- it was the table `lookup_person_person_role`.)
