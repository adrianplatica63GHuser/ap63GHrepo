-- migration_121_cvc_field_widths.sql
-- Slice 40.89 - Adrian's sizes on the Contract de vânzare's four tiles (his marks on „Field sizes — gray
-- tiles.docx", 2026-10-27), and his three moves.
--
-- WHAT THIS DOES
--   On CONTRACT_VANZARE's form (lookup_document_type.template_fields):
--   1. Sets the optional `width` key (a step of src/lib/ui/field-widths.ts's scale) on the fields he marked:
--        Preț și plată        pretTotal S, monedaPret S, pretRealDeclarat M, starePlata M, modalitatePlata M
--        Carte funciară       categorieInterna XL, documentatieFinalizata M, marcajCarteFunciara L,
--                             poateFiIntabulat M, consimtamantRadiere M, temeiExceptieCadastru TILE,
--                             renuntareCercetareOcpi M, obligatieNrCadastral M, termenFormalitati TILE,
--                             completareUlterioara TILE
--        Declarații și garanții  the nineteen dropdowns M, temeiLegalEvictiune L
--        Taxe și cheltuieli   timbruJudiciar, onorariuNotarial, impozitTransfer, taxaTimbruPublicitate S;
--                             cheltuieliPerfectare, taxeLocalePlatiteDe, taxeLocaleLaZi M
--   2. Sets `newRow: true` on consimtamantRadiere: it starts a row (40.89, read by template-fields.ts and
--      honoured by rule 18), so Marcaj carte funciară stands alone above Consimțământ radiere | Intabulare posibilă.
--   3. Moves pretRealDeclarat to right after monedaPret (temeiPret and alocarePret move down one), and
--      consimtamantRadiere to right before poateFiIntabulat. Every other order keeps its place.
--
-- KEY BY KEY, NEVER THE WHOLE FORM
--   Each field keeps every other key it has — whatever was edited on the Form editor since the forms file was
--   exported survives. A named field the form no longer holds is simply not found.
--
-- NOTHING ELSE CHANGES
--   No column, and no document's value: custom_fields is keyed by `key`, which does not change.
--
-- IDEMPOTENT
--   Setting a key to the value it holds changes nothing; each move runs only while the field is not yet where it
--   goes, so a second run changes nothing.

BEGIN;

WITH w(field_key, width) AS (
  VALUES
    ('pretTotal', 'S'), ('monedaPret', 'S'), ('pretRealDeclarat', 'M'), ('starePlata', 'M'), ('modalitatePlata', 'M'),
    ('categorieInterna', 'XL'), ('documentatieFinalizata', 'M'), ('marcajCarteFunciara', 'L'),
    ('poateFiIntabulat', 'M'), ('consimtamantRadiere', 'M'), ('temeiExceptieCadastru', 'TILE'),
    ('renuntareCercetareOcpi', 'M'), ('obligatieNrCadastral', 'M'), ('termenFormalitati', 'TILE'),
    ('completareUlterioara', 'TILE'),
    ('inCircuitCivil', 'M'), ('liberDeSarcini', 'M'), ('faraServituti', 'M'), ('neipotecat', 'M'),
    ('nepromisAltcuiva', 'M'), ('nearendat', 'M'), ('neaportatSocietate', 'M'), ('faraLitigii', 'M'),
    ('faraExpropriere', 'M'), ('faraMonumentIstoric', 'M'), ('nedezmembratContrar', 'M'),
    ('cumparatorCunoasteSituatia', 'M'), ('garantieEvictiune', 'M'), ('temeiLegalEvictiune', 'L'),
    ('garantieVicii', 'M'), ('declaratieArt292', 'M'), ('notificareAml', 'M'), ('consimtamantDatePersonale', 'M'),
    ('preemptiuneTerenAgricol', 'M'), ('preemptiunePadure', 'M'),
    ('timbruJudiciar', 'S'), ('onorariuNotarial', 'S'), ('impozitTransfer', 'S'), ('taxaTimbruPublicitate', 'S'),
    ('cheltuieliPerfectare', 'M'), ('taxeLocalePlatiteDe', 'M'), ('taxeLocaleLaZi', 'M')
)
UPDATE lookup_document_type t
   SET template_fields = (
         SELECT jsonb_agg(CASE
                            WHEN w.width IS NULL THEN e.f
                            WHEN e.f->>'key' = 'consimtamantRadiere'
                              THEN jsonb_set(jsonb_set(e.f, '{width}', to_jsonb(w.width)), '{newRow}', 'true'::jsonb)
                            ELSE jsonb_set(e.f, '{width}', to_jsonb(w.width)) END
                          ORDER BY e.ord)
           FROM jsonb_array_elements(t.template_fields) WITH ORDINALITY AS e(f, ord)
           LEFT JOIN w ON w.field_key = e.f->>'key')
 WHERE t.key = 'CONTRACT_VANZARE'
   AND jsonb_typeof(t.template_fields) = 'array';

-- Preț declarat real right after Monedă: it takes Monedă's order + 1, and every field between moves down one.
UPDATE lookup_document_type t
   SET template_fields = (
         SELECT jsonb_agg(s.f ORDER BY (s.f->>'order')::int, s.ord)
           FROM (
             SELECT CASE
                      WHEN e.f->>'key' = 'pretRealDeclarat' THEN jsonb_set(e.f, '{order}', to_jsonb(o.moneda + 1))
                      WHEN (e.f->>'order')::int > o.moneda AND (e.f->>'order')::int < o.pret
                        THEN jsonb_set(e.f, '{order}', to_jsonb((e.f->>'order')::int + 1))
                      ELSE e.f END AS f,
                    e.ord
               FROM jsonb_array_elements(t.template_fields) WITH ORDINALITY AS e(f, ord)
           ) AS s)
  FROM (
    SELECT t2.key,
           max((f->>'order')::int) FILTER (WHERE f->>'key' = 'monedaPret')       AS moneda,
           max((f->>'order')::int) FILTER (WHERE f->>'key' = 'pretRealDeclarat') AS pret
      FROM lookup_document_type t2, jsonb_array_elements(t2.template_fields) f
     WHERE t2.key = 'CONTRACT_VANZARE' AND jsonb_typeof(t2.template_fields) = 'array'
     GROUP BY t2.key
  ) o
 WHERE t.key = o.key
   AND o.moneda IS NOT NULL AND o.pret IS NOT NULL
   AND o.pret > o.moneda + 1;

-- Consimțământ radiere right before Intabulare posibilă: it takes that order, and every field from there to where
-- it was moves down one.
UPDATE lookup_document_type t
   SET template_fields = (
         SELECT jsonb_agg(s.f ORDER BY (s.f->>'order')::int, s.ord)
           FROM (
             SELECT CASE
                      WHEN e.f->>'key' = 'consimtamantRadiere' THEN jsonb_set(e.f, '{order}', to_jsonb(o.poate))
                      WHEN (e.f->>'order')::int >= o.poate AND (e.f->>'order')::int < o.consimt
                        THEN jsonb_set(e.f, '{order}', to_jsonb((e.f->>'order')::int + 1))
                      ELSE e.f END AS f,
                    e.ord
               FROM jsonb_array_elements(t.template_fields) WITH ORDINALITY AS e(f, ord)
           ) AS s)
  FROM (
    SELECT t2.key,
           max((f->>'order')::int) FILTER (WHERE f->>'key' = 'poateFiIntabulat')    AS poate,
           max((f->>'order')::int) FILTER (WHERE f->>'key' = 'consimtamantRadiere') AS consimt
      FROM lookup_document_type t2, jsonb_array_elements(t2.template_fields) f
     WHERE t2.key = 'CONTRACT_VANZARE' AND jsonb_typeof(t2.template_fields) = 'array'
     GROUP BY t2.key
  ) o
 WHERE t.key = o.key
   AND o.poate IS NOT NULL AND o.consimt IS NOT NULL
   AND o.consimt > o.poate;

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
     AND f->>'key' IN ('pretTotal', 'monedaPret', 'pretRealDeclarat', 'temeiPret', 'alocarePret',
                       'marcajCarteFunciara', 'consimtamantRadiere', 'poateFiIntabulat');
  RAISE NOTICE 'migration_121: CVC fields with a width: % (44 expected: 42 here, 2 from migration_120); with newRow: % (1); in order: %', n_width, n_row, seq;
END $$;

COMMIT;
