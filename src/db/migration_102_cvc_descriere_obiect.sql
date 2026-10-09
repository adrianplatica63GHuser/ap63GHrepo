-- migration_102_cvc_descriere_obiect.sql
-- Slice #38.49 - the contract de vânzare's „Obiectul vânzării" says what is
-- being sold.
--
-- WHAT THIS DOES
--   Adds one field to the contract de vânzare's form
--   (lookup_document_type.template_fields, key CONTRACT_VANZARE):
--     descriereObiect — textarea, „Descrierea obiectului" / „Description of
--     the object", tab „Obiectul vânzării", group „Descriere", FIRST in the
--     tab: it takes order 12, where „Scop vânzare" stood, and every field from
--     order 12 on moves down by one, so the orders stay 0-based and contiguous.
--   The app composes the text from the contract's properties, its „Părți" and
--   „Scop vânzare" (src/lib/documents/sale-object-description.ts), fills it
--   when the contract is opened for editing with the field empty, and
--   „Recompune" writes it again; it can be corrected by hand and is found by
--   the list's search. Its aiHint lets a new import use the deed's own words.
--
-- NOTHING ELSE CHANGES
--   No column, and no stored value: every contract's custom_fields stays as it
--   is, the new key absent until the screen fills it.
--
-- IDEMPOTENT
--   Only a CONTRACT_VANZARE form that is an array and does not hold the key
--   yet is changed; a second run changes nothing.

BEGIN;

UPDATE lookup_document_type t
   SET template_fields = (
         SELECT jsonb_agg(f ORDER BY (f->>'order')::int)
           FROM (
             SELECT CASE WHEN (e.f->>'order')::int >= 12
                         THEN jsonb_set(e.f, '{order}', to_jsonb((e.f->>'order')::int + 1))
                         ELSE e.f END AS f
               FROM jsonb_array_elements(t.template_fields) AS e(f)
             UNION ALL
             SELECT jsonb_build_object(
                      'key',     'descriereObiect',
                      'type',    'textarea',
                      'order',   12,
                      'tabEn',   'What is sold',
                      'tabRo',   'Obiectul vânzării',
                      'aiHint',  'o frază despre ce se vinde, cu cuvintele actului: felul bunului, suprafața, tarla / parcela, nr. cadastral, localitatea, cota vândută și, dacă actul o spune, de ce se vinde',
                      'groupEn', 'Description',
                      'groupRo', 'Descriere',
                      'labelEn', 'Description of the object',
                      'labelRo', 'Descrierea obiectului',
                      'options', NULL)
           ) AS fields)
 WHERE t.key = 'CONTRACT_VANZARE'
   AND jsonb_typeof(t.template_fields) = 'array'
   AND NOT EXISTS (
         SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(t.template_fields) = 'array' THEN t.template_fields ELSE '[]'::jsonb END) f
          WHERE f->>'key' = 'descriereObiect');

DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n
    FROM lookup_document_type t, jsonb_array_elements(t.template_fields) f
   WHERE t.key = 'CONTRACT_VANZARE' AND jsonb_typeof(t.template_fields) = 'array' AND f->>'key' = 'descriereObiect';
  RAISE NOTICE 'migration_102: the contract de vânzare''s form holds descriereObiect: %', CASE WHEN n = 1 THEN 'yes' ELSE 'NO' END;
END $$;

COMMIT;
