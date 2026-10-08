-- migration_098_addendum_nedezmembrat_and_parties.sql
-- Slice #38.34 - the act adițional: one key for the „nedezmembrat" clause, and
-- its sellers and buyers hold a share.
--
-- WHAT THIS DOES
--   1. The act adițional's clause „Nedezmembrat și nealipit"
--      (custom_fields.nedezmembratNealipit) takes the contract de vânzare's key
--      and wording: nedezmembratContrar, „Nedezmembrat contrar extrasului"
--      (Ask first 1: the key with more stored values survives — on the local
--      database 5 under nedezmembratContrar, 2 under nedezmembratNealipit, read
--      2026-10-08). Both forms offer the same three values (AFIRMAT,
--      NEMENTIONAT, EXCEPTIE), so a value moves as it is.
--        - the stored values: on every document that has the old key, the
--          value moves to the new one;
--        - the act adițional's form (lookup_document_type.template_fields):
--          the field is renamed and relabelled, everything else on it kept.
--   2. On the act adițional, „Vânzător" and „Cumpărător" hold a share
--      (lookup_doc_type_person_role.holds_share), so its „Părți" lists them
--      with their cota-parte, as the contract de vânzare's does. Those two
--      pairs were added on the act adițional after migration_091 ticked the
--      ownership roles, so they kept the column's default, false. Every other
--      role on it — Notar public, Reprezentant legal, the promitents, the
--      arendaș and arendator — stays as it is.
--
-- NOTHING IS DROPPED
--   A document that already holds BOTH keys keeps its nedezmembratContrar; the
--   old value is appended to its „Note" (document.notes) as
--   „Nedezmembrat și nealipit (vechea cheie): <value>", and the old key goes.
--   Each such document is named in a NOTICE (on the local database: none).
--
-- THE HISTORY
--   document_version snapshots keep what they recorded; a past version viewed
--   on screen shows the old key's value nowhere, as any renamed field does.
--
-- WHICH ROWS
--   Every document whose custom_fields has nedezmembratNealipit, whatever its
--   type: the key belongs to the act adițional's form, and a value under it on
--   another type is the same field copied across.

BEGIN;

-- 1a. The stored values.
CREATE TEMP TABLE _m098 ON COMMIT DROP AS
SELECT d.id,
       d.code,
       d.custom_fields->'nedezmembratNealipit' AS old_value,
       d.custom_fields ? 'nedezmembratContrar' AS has_new
FROM document d
WHERE d.custom_fields ? 'nedezmembratNealipit';

UPDATE document d
   SET custom_fields = (d.custom_fields - 'nedezmembratNealipit')
                       || jsonb_build_object('nedezmembratContrar', m.old_value)
  FROM _m098 m
 WHERE m.id = d.id
   AND NOT m.has_new;

UPDATE document d
   SET custom_fields = d.custom_fields - 'nedezmembratNealipit',
       notes = concat_ws(E'\n', nullif(d.notes, ''),
                         'Nedezmembrat și nealipit (vechea cheie): ' || (m.old_value #>> '{}'))
  FROM _m098 m
 WHERE m.id = d.id
   AND m.has_new;

-- 1b. The act adițional's form.
UPDATE lookup_document_type t
   SET template_fields = (
         SELECT jsonb_agg(
                  CASE WHEN f->>'key' = 'nedezmembratNealipit'
                       THEN f || jsonb_build_object(
                              'key',     'nedezmembratContrar',
                              'labelRo', 'Nedezmembrat contrar extrasului',
                              'labelEn', 'Not subdivided contrary to the extract')
                       ELSE f END
                  ORDER BY ord)
           FROM jsonb_array_elements(t.template_fields) WITH ORDINALITY AS e(f, ord))
 WHERE t.key = 'ACT_ADITIONAL'
   AND jsonb_typeof(t.template_fields) = 'array'
   AND EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(t.template_fields) = 'array' THEN t.template_fields ELSE '[]'::jsonb END) f WHERE f->>'key' = 'nedezmembratNealipit')
   AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(t.template_fields) = 'array' THEN t.template_fields ELSE '[]'::jsonb END) f WHERE f->>'key' = 'nedezmembratContrar');

-- 2. The act adițional's sellers and buyers hold a share.
UPDATE lookup_doc_type_person_role AS p
   SET holds_share = true
  FROM lookup_document_type AS t, lookup_person_role AS r
 WHERE t.id = p.document_type_id
   AND r.id = p.person_role_id
   AND t.key = 'ACT_ADITIONAL'
   AND r.name IN ('Vânzător', 'Cumpărător');

DO $$
DECLARE
  r record;
BEGIN
  RAISE NOTICE 'migration_098: % value(s) moved to nedezmembratContrar, % kept in Note beside an existing one.',
    (SELECT count(*) FROM _m098 WHERE NOT has_new), (SELECT count(*) FROM _m098 WHERE has_new);
  FOR r IN SELECT code, old_value FROM _m098 WHERE has_new ORDER BY code LOOP
    RAISE NOTICE 'migration_098: % kept „Nedezmembrat și nealipit" in Note: %', r.code, r.old_value;
  END LOOP;
  RAISE NOTICE 'migration_098: the act adițional''s form now % nedezmembratContrar.',
    CASE WHEN EXISTS (
      SELECT 1 FROM lookup_document_type t, jsonb_array_elements(CASE WHEN jsonb_typeof(t.template_fields) = 'array' THEN t.template_fields ELSE '[]'::jsonb END) f
       WHERE t.key = 'ACT_ADITIONAL' AND jsonb_typeof(t.template_fields) = 'array' AND f->>'key' = 'nedezmembratContrar')
    THEN 'holds' ELSE 'does NOT hold (no form, or no such field)' END;
  RAISE NOTICE 'migration_098: % act adițional role(s) hold a share.', (
    SELECT count(*) FROM lookup_doc_type_person_role p JOIN lookup_document_type t ON t.id = p.document_type_id
     WHERE t.key = 'ACT_ADITIONAL' AND p.holds_share);
END $$;

COMMIT;
