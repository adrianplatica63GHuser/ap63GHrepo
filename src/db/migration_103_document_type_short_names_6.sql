-- migration_103_document_type_short_names_6.sql
-- Slice #38.54 - six document types get the short names Adrian chose.
--
-- WHAT THIS DOES
--   Sets lookup_document_type.short_name (migration_092, #37.95) for six
--   types, by key:
--     UNCLASSIFIED             „NECLASIFICAT"         -> „NECLASIF."
--     AUTORIZATIE_CONSTRUIRE   „AC"                   -> „Aut. Constr."
--     CERTIFICAT_URBANISM      „CU"                   -> „Urbanism"
--     HOTARARE_JUDECATOREASCA  „Hot. judecătorească"  -> „Hot. judec."
--     AUTORIZATIE              „Autorizație"          -> „Aut."
--     HOTARARE_ADMINISTRATIVA  „Hot. administrativă"  -> „Hot. admin."
--   The Documents list's „Tip" column shows them; the full name stays in its
--   tooltip and everywhere else.
--
-- ONLY THESE SIX
--   migration_092's VALUES list is history and is not rewritten. This one
--   names the six and nothing else, so a short name somebody has since typed
--   for ANOTHER type in „Date de referință" is left alone. The six are set
--   whatever they hold now: the mapping is Adrian's.
--   src/db/sync-reference-data.sql carries the same six in its own list, and
--   src/__tests__/document-type-short-name.test.ts holds it equal to
--   migration_092's list with this file's six applied.
--
-- NOTHING ELSE CHANGES
--   `name` and `key` are untouched; English has no short names.

BEGIN;

-- SHORT NAMES (Slice #38.54). Applied over migration_092's list.
UPDATE lookup_document_type AS t
   SET short_name = s.short_name
  FROM (VALUES
    ('UNCLASSIFIED',                 'NECLASIF.'),
    ('AUTORIZATIE_CONSTRUIRE',       'Aut. Constr.'),
    ('CERTIFICAT_URBANISM',          'Urbanism'),
    ('HOTARARE_JUDECATOREASCA',      'Hot. judec.'),
    ('AUTORIZATIE',                  'Aut.'),
    ('HOTARARE_ADMINISTRATIVA',      'Hot. admin.')
  ) AS s(key, short_name)
 WHERE t.key = s.key;

COMMIT;
