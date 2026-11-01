-- migration_123_cvc_price_payment.sql
-- Slice 41.25 - Adrian's layout of the Contract de vânzare's „Preț și plată" (his request of 2026-10-31, evening).
--
-- WHAT THIS DOES
--   On CONTRACT_VANZARE's form (lookup_document_type.template_fields), in „Preț și plată":
--   1. `width` (a step of src/lib/ui/field-widths.ts's scale):
--        pretTotal M, monedaPret M          („make "Preț total" and "Monedă" size M"; both were S)
--        temeiPret TILE, alocarePret TILE   („make "Temei preț" and "Alocare preț" size TILE"; both had none)
--   2. `newRow: true` (40.89, honoured by rule 18) on the field that starts a row:
--        pretRealDeclarat   („move "Preț declarat real" under "Preț total"")
--        dataPlatii         („move "Data plății" field under the "Stare plată" field")
--      modalitatePlata keeps the newRow it has (migration_122).
--   So the tile reads: Preț total | Monedă — Preț declarat real — Temei preț — Alocare preț — Stare plată —
--   Data plății — Modalitate plată. The order already is that order (orders 4 to 11) and does not change.
--
-- KEY BY KEY, NEVER THE WHOLE FORM
--   Each field keeps every other key it has. A named field the form no longer holds is simply not found.
--
-- NOTHING ELSE CHANGES - NOT DESTRUCTIVE
--   No column, and no document's value: custom_fields is keyed by `key`, which does not change.
--
-- IDEMPOTENT
--   Setting a key to the value it holds changes nothing, so a second run changes nothing.

BEGIN;

WITH w(field_key, width, new_row) AS (
  VALUES
    ('pretTotal', 'M', false),
    ('monedaPret', 'M', false),
    ('pretRealDeclarat', NULL, true),
    ('temeiPret', 'TILE', false),
    ('alocarePret', 'TILE', false),
    ('dataPlatii', NULL, true)
)
UPDATE lookup_document_type t
   SET template_fields = (
         SELECT jsonb_agg(b.f2 ORDER BY e.ord)
           FROM jsonb_array_elements(t.template_fields) WITH ORDINALITY AS e(f, ord)
           LEFT JOIN w ON w.field_key = e.f->>'key'
           CROSS JOIN LATERAL (
             SELECT CASE
                      WHEN w.field_key IS NOT NULL AND w.width IS NOT NULL THEN jsonb_set(e.f, '{width}', to_jsonb(w.width))
                      ELSE e.f END AS f1
           ) a
           CROSS JOIN LATERAL (
             SELECT CASE WHEN w.new_row THEN jsonb_set(a.f1, '{newRow}', 'true'::jsonb) ELSE a.f1 END AS f2
           ) b)
 WHERE t.key = 'CONTRACT_VANZARE'
   AND jsonb_typeof(t.template_fields) = 'array';

COMMIT;
