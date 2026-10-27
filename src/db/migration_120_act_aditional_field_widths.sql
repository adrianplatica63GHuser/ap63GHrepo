-- migration_120_act_aditional_field_widths.sql
-- Slice 40.88 - Adrian's sizes on Act Adițional's tiles (his marks on „Field sizes — gray tiles.docx",
-- 2026-10-27), and Exemplare emise / Onorariu notarial swapped.
--
-- WHAT THIS DOES
--   Sets the optional `width` key (a step of src/lib/ui/field-widths.ts's scale, read by
--   src/lib/documents/template-fields.ts since #37.15) on the named fields of two forms
--   (lookup_document_type.template_fields):
--     ACT_ADITIONAL     calitateExemplar M, exemplareEmise TILE, temeiLegalCompletare TILE,
--                       efectUrmarit M, pretNeschimbat M, and the nine „Clauze completate"
--                       dropdowns M (liberDeSarcini, faraServituti, nearendat, notificareAml,
--                       consimtamantRadiere, taxeLocaleLaZi, nedezmembratContrar,
--                       consimtamantDatePersonale, celelalteClauzeNemodificate);
--     CONTRACT_VANZARE  calitateExemplar M, exemplareEmise TILE.
--   TILE is the panel's whole inner width on a row of its own (40.88).
--   On ACT_ADITIONAL, swaps the orders of exemplareEmise and onorariuNotarial, so
--   „Identificarea actului" reads Calitate exemplar | Onorariu notarial, then Exemplare emise
--   across the tile.
--
-- KEY BY KEY, NEVER THE WHOLE FORM
--   Each field keeps every other key it has — whatever was edited on the Form editor since the
--   forms file was exported survives. A field that is not named is not touched; a named field
--   that a form no longer holds is simply not found.
--
-- NOTHING ELSE CHANGES
--   No column, and no document's value: custom_fields is keyed by `key`, which does not change.
--
-- IDEMPOTENT
--   Setting a key to the value it holds changes nothing; the swap runs only while exemplareEmise
--   still comes before onorariuNotarial, so a second run changes nothing.

BEGIN;

WITH w(type_key, field_key, width) AS (
  VALUES
    ('ACT_ADITIONAL',    'calitateExemplar',            'M'),
    ('ACT_ADITIONAL',    'exemplareEmise',              'TILE'),
    ('ACT_ADITIONAL',    'temeiLegalCompletare',        'TILE'),
    ('ACT_ADITIONAL',    'efectUrmarit',                'M'),
    ('ACT_ADITIONAL',    'pretNeschimbat',              'M'),
    ('ACT_ADITIONAL',    'liberDeSarcini',              'M'),
    ('ACT_ADITIONAL',    'faraServituti',               'M'),
    ('ACT_ADITIONAL',    'nearendat',                   'M'),
    ('ACT_ADITIONAL',    'notificareAml',               'M'),
    ('ACT_ADITIONAL',    'consimtamantRadiere',         'M'),
    ('ACT_ADITIONAL',    'taxeLocaleLaZi',              'M'),
    ('ACT_ADITIONAL',    'nedezmembratContrar',         'M'),
    ('ACT_ADITIONAL',    'consimtamantDatePersonale',   'M'),
    ('ACT_ADITIONAL',    'celelalteClauzeNemodificate', 'M'),
    ('CONTRACT_VANZARE', 'calitateExemplar',            'M'),
    ('CONTRACT_VANZARE', 'exemplareEmise',              'TILE')
)
UPDATE lookup_document_type t
   SET template_fields = (
         SELECT jsonb_agg(CASE WHEN w.width IS NULL THEN e.f
                               ELSE jsonb_set(e.f, '{width}', to_jsonb(w.width)) END
                          ORDER BY e.ord)
           FROM jsonb_array_elements(t.template_fields) WITH ORDINALITY AS e(f, ord)
           LEFT JOIN w ON w.type_key = t.key AND w.field_key = e.f->>'key')
 WHERE t.key IN ('ACT_ADITIONAL', 'CONTRACT_VANZARE')
   AND jsonb_typeof(t.template_fields) = 'array';

-- The swap: each field takes the other's order, only while Exemplare emise comes first. The array is
-- written in the new order, as migration_102 wrote its own.
UPDATE lookup_document_type t
   SET template_fields = (
         SELECT jsonb_agg(s.f ORDER BY (s.f->>'order')::int, s.ord)
           FROM (
             SELECT CASE e.f->>'key'
                      WHEN 'exemplareEmise'   THEN jsonb_set(e.f, '{order}', to_jsonb(o.onorariu))
                      WHEN 'onorariuNotarial' THEN jsonb_set(e.f, '{order}', to_jsonb(o.exemplare))
                      ELSE e.f END AS f,
                    e.ord
               FROM jsonb_array_elements(t.template_fields) WITH ORDINALITY AS e(f, ord)
           ) AS s)
  FROM (
    SELECT t2.key,
           max(((f->>'order')::int)) FILTER (WHERE f->>'key' = 'exemplareEmise')   AS exemplare,
           max(((f->>'order')::int)) FILTER (WHERE f->>'key' = 'onorariuNotarial') AS onorariu
      FROM lookup_document_type t2, jsonb_array_elements(t2.template_fields) f
     WHERE t2.key = 'ACT_ADITIONAL' AND jsonb_typeof(t2.template_fields) = 'array'
     GROUP BY t2.key
  ) o
 WHERE t.key = o.key
   AND o.exemplare IS NOT NULL AND o.onorariu IS NOT NULL
   AND o.exemplare < o.onorariu;

DO $$
DECLARE
  n_width int;
  n_first text;
BEGIN
  SELECT count(*) INTO n_width
    FROM lookup_document_type t, jsonb_array_elements(t.template_fields) f
   WHERE t.key IN ('ACT_ADITIONAL', 'CONTRACT_VANZARE') AND jsonb_typeof(t.template_fields) = 'array'
     AND f ? 'width';
  SELECT f->>'key' INTO n_first
    FROM lookup_document_type t, jsonb_array_elements(t.template_fields) f
   WHERE t.key = 'ACT_ADITIONAL' AND jsonb_typeof(t.template_fields) = 'array'
     AND f->>'key' IN ('exemplareEmise', 'onorariuNotarial')
   ORDER BY (f->>'order')::int
   LIMIT 1;
  RAISE NOTICE 'migration_120: fields with a width on the two forms: % (16 expected); first of the swapped pair: %', n_width, coalesce(n_first, 'none');
END $$;

COMMIT;
