-- migration_122_cvc_six_tiles.sql
-- Slice 40.93 - Adrian's six changes to the Contract de vânzare's tiles (his request of 2026-10-28, evening).
--
-- WHAT THIS DOES
--   On CONTRACT_VANZARE's form (lookup_document_type.template_fields):
--   1. `width` (a step of src/lib/ui/field-widths.ts's scale):
--        Identificarea actului   temeiAutentificare TILE — Data conținutului then starts the next row by itself
--        Preț și plată           starePlata L, modalitatePlata L
--        Declarații și garanții  temeiLegalEvictiune TILE
--        Taxe și cheltuieli      timbruJudiciar, onorariuNotarial, impozitTransfer, taxaTimbruPublicitate M
--                                (cheltuieliPerfectare, taxeLocalePlatiteDe, taxeLocaleLaZi are M already)
--      and documentatieFinalizata's `width` REMOVED, so it measures to its widest choice again (184 px, as before
--      40.89).
--   2. `newRow: true` (40.89, honoured by rule 18) on the field that starts a row:
--        modalitatePlata (under Stare plată); documentatieFinalizata (under Categorie internă);
--        the 3rd, 5th, … dropdown of Declarațiile vânzătorului (faraServituti, nepromisAltcuiva,
--        neaportatSocietate, faraExpropriere, nedezmembratContrar) and of Declarații legale
--        (consimtamantDatePersonale, preemptiunePadure) — rows of two; timbruJudiciar and taxeLocaleLaZi.
--   3. Moves, each by exchanging `order` values, so nothing outside the moved fields changes:
--        dataPlatii into modalitatePlata's place          Stare plată | Data plății, then Modalitate plată
--        garantieVicii into temeiLegalEvictiune's place   Garanție evicțiune | Garanție vicii ascunse, then Temei
--        onorariuNotarial, impozitTransfer, timbruJudiciar  Onorariu notarial | Impozit transfer first
--   Excepția de la cadastru is not touched: migration_121 already drew it as Adrian asks.
--
-- KEY BY KEY, NEVER THE WHOLE FORM
--   Each field keeps every other key it has. A named field the form no longer holds is simply not found.
--
-- NOTHING ELSE CHANGES
--   No column, and no document's value: custom_fields is keyed by `key`, which does not change.
--
-- IDEMPOTENT
--   Setting a key to the value it holds changes nothing; removing an absent key changes nothing; each move runs
--   only while its fields are still in their old order, so a second run changes nothing.

BEGIN;

WITH w(field_key, width, drop_width, new_row) AS (
  VALUES
    ('temeiAutentificare', 'TILE', false, false),
    ('starePlata', 'L', false, false), ('modalitatePlata', 'L', false, true),
    ('documentatieFinalizata', NULL, true, true),
    ('faraServituti', NULL, false, true), ('nepromisAltcuiva', NULL, false, true),
    ('neaportatSocietate', NULL, false, true), ('faraExpropriere', NULL, false, true),
    ('nedezmembratContrar', NULL, false, true),
    ('temeiLegalEvictiune', 'TILE', false, false),
    ('consimtamantDatePersonale', NULL, false, true), ('preemptiunePadure', NULL, false, true),
    ('timbruJudiciar', 'M', false, true), ('onorariuNotarial', 'M', false, false),
    ('impozitTransfer', 'M', false, false), ('taxaTimbruPublicitate', 'M', false, false),
    ('taxeLocaleLaZi', 'M', false, true)
)
UPDATE lookup_document_type t
   SET template_fields = (
         SELECT jsonb_agg(b.f2 ORDER BY e.ord)
           FROM jsonb_array_elements(t.template_fields) WITH ORDINALITY AS e(f, ord)
           LEFT JOIN w ON w.field_key = e.f->>'key'
           CROSS JOIN LATERAL (
             SELECT CASE
                      WHEN w.field_key IS NULL THEN e.f
                      WHEN w.drop_width THEN e.f - 'width'
                      WHEN w.width IS NOT NULL THEN jsonb_set(e.f, '{width}', to_jsonb(w.width))
                      ELSE e.f END AS f1
           ) a
           CROSS JOIN LATERAL (
             SELECT CASE WHEN w.new_row THEN jsonb_set(a.f1, '{newRow}', 'true'::jsonb) ELSE a.f1 END AS f2
           ) b)
 WHERE t.key = 'CONTRACT_VANZARE'
   AND jsonb_typeof(t.template_fields) = 'array';

-- The moves: each field named takes the order the map gives it, read from the orders the form holds now, and the
-- array is put back in order. One statement per move, each guarded by the old order.
CREATE TEMP TABLE m122_orders ON COMMIT DROP AS
SELECT f->>'key' AS field_key, (f->>'order')::int AS ord
  FROM lookup_document_type t, jsonb_array_elements(t.template_fields) f
 WHERE t.key = 'CONTRACT_VANZARE' AND jsonb_typeof(t.template_fields) = 'array'
   AND f->>'key' IN ('modalitatePlata', 'dataPlatii', 'temeiLegalEvictiune', 'garantieVicii',
                     'timbruJudiciar', 'onorariuNotarial', 'impozitTransfer');

CREATE TEMP TABLE m122_moves (field_key text, new_ord int) ON COMMIT DROP;

-- Data plății | Modalitate plată exchange places, while Modalitate plată is still before Data plății.
INSERT INTO m122_moves
SELECT 'dataPlatii', m.ord FROM m122_orders m, m122_orders d
 WHERE m.field_key = 'modalitatePlata' AND d.field_key = 'dataPlatii' AND m.ord < d.ord
UNION ALL
SELECT 'modalitatePlata', d.ord FROM m122_orders m, m122_orders d
 WHERE m.field_key = 'modalitatePlata' AND d.field_key = 'dataPlatii' AND m.ord < d.ord;

-- Garanție vicii ascunse | Temei legal evicțiune exchange places, while the Temei is still before it.
INSERT INTO m122_moves
SELECT 'garantieVicii', l.ord FROM m122_orders l, m122_orders v
 WHERE l.field_key = 'temeiLegalEvictiune' AND v.field_key = 'garantieVicii' AND l.ord < v.ord
UNION ALL
SELECT 'temeiLegalEvictiune', v.ord FROM m122_orders l, m122_orders v
 WHERE l.field_key = 'temeiLegalEvictiune' AND v.field_key = 'garantieVicii' AND l.ord < v.ord;

-- Onorariu notarial, Impozit transfer, Timbru judiciar take the three places, while Timbru judiciar is still first.
INSERT INTO m122_moves
SELECT x.field_key, x.new_ord FROM (
  SELECT 'onorariuNotarial' AS field_key, j.ord AS new_ord, j.ord AS j, o.ord AS o, i.ord AS i
    FROM m122_orders j, m122_orders o, m122_orders i
   WHERE j.field_key = 'timbruJudiciar' AND o.field_key = 'onorariuNotarial' AND i.field_key = 'impozitTransfer'
  UNION ALL
  SELECT 'impozitTransfer', o.ord, j.ord, o.ord, i.ord
    FROM m122_orders j, m122_orders o, m122_orders i
   WHERE j.field_key = 'timbruJudiciar' AND o.field_key = 'onorariuNotarial' AND i.field_key = 'impozitTransfer'
  UNION ALL
  SELECT 'timbruJudiciar', i.ord, j.ord, o.ord, i.ord
    FROM m122_orders j, m122_orders o, m122_orders i
   WHERE j.field_key = 'timbruJudiciar' AND o.field_key = 'onorariuNotarial' AND i.field_key = 'impozitTransfer'
) x
 WHERE x.j < x.o AND x.o < x.i;

UPDATE lookup_document_type t
   SET template_fields = (
         SELECT jsonb_agg(s.f ORDER BY (s.f->>'order')::int, s.ord)
           FROM (
             SELECT CASE WHEN mv.field_key IS NULL THEN e.f ELSE jsonb_set(e.f, '{order}', to_jsonb(mv.new_ord)) END AS f,
                    e.ord
               FROM jsonb_array_elements(t.template_fields) WITH ORDINALITY AS e(f, ord)
               LEFT JOIN m122_moves mv ON mv.field_key = e.f->>'key'
           ) AS s)
 WHERE t.key = 'CONTRACT_VANZARE'
   AND jsonb_typeof(t.template_fields) = 'array'
   AND EXISTS (SELECT 1 FROM m122_moves);

DO $$
DECLARE
  n_width int;
  n_row int;
  seq text;
BEGIN
  SELECT count(*) FILTER (WHERE f ? 'width'), count(*) FILTER (WHERE f ? 'newRow') INTO n_width, n_row
    FROM lookup_document_type t, jsonb_array_elements(t.template_fields) f
   WHERE t.key = 'CONTRACT_VANZARE' AND jsonb_typeof(t.template_fields) = 'array';
  SELECT string_agg(f->>'key', ', ' ORDER BY (f->>'order')::int) INTO seq
    FROM lookup_document_type t, jsonb_array_elements(t.template_fields) f
   WHERE t.key = 'CONTRACT_VANZARE' AND jsonb_typeof(t.template_fields) = 'array'
     AND f->>'key' IN ('starePlata', 'modalitatePlata', 'dataPlatii', 'garantieEvictiune', 'temeiLegalEvictiune',
                       'garantieVicii', 'timbruJudiciar', 'onorariuNotarial', 'impozitTransfer', 'taxaTimbruPublicitate');
  RAISE NOTICE 'migration_122: CVC fields with a width: % (44 expected), with newRow: % (12), in order: %', n_width, n_row, seq;
END $$;

COMMIT;
