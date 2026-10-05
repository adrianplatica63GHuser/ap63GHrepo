-- migration_092_document_type_short_name.sql
-- Slice #37.95 - each document type's short name, for the Documents list.
--
-- WHAT THIS DOES
--   Adds lookup_document_type.short_name (text, NULL allowed) and seeds it for
--   the catalogue's types, by key: an abbreviation where the archive uses one
--   (CVC, PAD, CU, AC, TP, CI), otherwise the type's meaningful last words
--   (Adjudecare, Arendă, Intabulare, ...). The Documents list's „Tip" column
--   shows it, the full name in its tooltip; Date de referință edits it beside
--   the name.
--
-- A BLANK IS NOT AN ERROR
--   A type with no short name - one added by hand or by the import before
--   anyone names it - shows the rule's: the name without its leading
--   „Contract de", „Act de", „Încheiere de", „Certificat de"... phrase
--   (src/lib/documents/type-short-name.ts). So NULL is the column's normal
--   state for a new type, and nothing here fills the types it does not know.
--
-- TWO TYPES MAY NOT SHARE ONE
--   A unique index on the folded, trimmed name, partial on a non-blank value,
--   refuses a stored duplicate. A stored name that would equal another type's
--   DERIVED one is refused by the reference-data route, which can compute it.
--
-- NOTHING ELSE CHANGES
--   `name` stays the full name everywhere else - the type filter, the document
--   form, the previews, the import, the classifier's catalogue - and `key` is
--   untouched.

BEGIN;

ALTER TABLE lookup_document_type
  ADD COLUMN IF NOT EXISTS short_name text;

-- SHORT NAMES (Slice #37.95). This VALUES list is written twice, here and in
-- src/db/sync-reference-data.sql, and src/__tests__/document-type-short-name.test.ts
-- holds the two byte-equal.
UPDATE lookup_document_type AS t
   SET short_name = s.short_name
  FROM (VALUES
    ('ACT_ADJUDECARE',               'Adjudecare'),
    ('ACT_CADASTRU',                 'Act cadastru'),
    ('ACT_DONATIE',                  'Donație'),
    ('AVIZ_INSTITUTIE',              'Aviz'),
    ('CARTE_IDENTITATE',             'CI'),
    ('CERTIFICAT_FISCAL',            'Cert. fiscal'),
    ('CERTIFICAT_MOSTENITOR',        'Moștenitor'),
    ('CERTIFICAT_BUNURI',            'Bunuri'),
    ('CERTIFICAT_URBANISM',          'CU'),
    ('CONTRACT_ARENDA',              'Arendă'),
    ('CONTRACT_INCHIRIERE',          'Închiriere'),
    ('CONTRACT_PARTAJ',              'Contract partaj'),
    ('CONTRACT_PRESTARI_SERVICII',   'Prestări servicii'),
    ('CONTRACT_VANZARE',             'CVC'),
    ('EXTRAS_CARTE_FUNCIARA',        'Extras CF'),
    ('EXTRAS_PUG',                   'Extras PUG'),
    ('HOTARARE_JUDECATOREASCA',      'Hot. judecătorească'),
    ('TESTAMENT',                    'Testament'),
    ('TITLU_PROPRIETATE',            'TP'),
    ('UNCLASSIFIED',                 'NECLASIFICAT'),
    ('AUTORIZATIE',                  'Autorizație'),
    ('CERTIFICAT_SARCINI',           'Sarcini'),
    ('HOTARARE_ADMINISTRATIVA',      'Hot. administrativă'),
    ('DOCUMENTATIE_CADASTRALA',      'Doc. cadastrală'),
    ('AUTORIZATIE_CONSTRUIRE',       'AC'),
    ('ACT_LOTIZARE',                 'Lotizare'),
    ('ACT_PARTAJ',                   'Act partaj'),
    ('ADEVERINTA',                   'Adeverință'),
    ('ADRESA_OFICIALA',              'Adresă'),
    ('ANTECONTRACT',                 'Antecontract'),
    ('CERERE_DESPAGUBIRE',           'Despăgubire'),
    ('CHITANTA',                     'Chitanță'),
    ('COMUNICARE_OFICIALA',          'Comunicare'),
    ('DOVADA_EXPROPRIERE',           'Expropriere'),
    ('EXTRAS_CONT',                  'Extras cont'),
    ('FISA_CORPULUI_PROPRIETATE',    'Fișa corpului'),
    ('INCHEIERE_INTABULARE',         'Intabulare'),
    ('PLAN_AMPLASAMENT_DELIMITARE',  'PAD'),
    ('PLAN_PARCELAR',                'Plan parcelar'),
    ('PROCURA',                      'Procură'),
    ('ACT_ADITIONAL',                'Act adițional'),
    ('ACT_ALIPIRE',                  'Alipire'),
    ('ACT_DEZLIPIRE',                'Dezlipire'),
    ('ACT_DEZMEMBRARE',              'Dezmembrare')
  ) AS s(key, short_name)
 WHERE t.key = s.key;

CREATE UNIQUE INDEX IF NOT EXISTS lookup_document_type_short_name_uq
  ON lookup_document_type (lower(btrim(short_name)))
  WHERE short_name IS NOT NULL AND btrim(short_name) <> '';

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT key, name, short_name FROM lookup_document_type ORDER BY name
  LOOP
    RAISE NOTICE 'short_name % | % | %', rec.key, rec.name, coalesce(rec.short_name, '(the rule)');
  END LOOP;
END $$;

COMMIT;
