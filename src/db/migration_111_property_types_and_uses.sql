-- migration_111_property_types_and_uses.sql
-- Slice #39.66 - property types and use categories: one page, two tiles, no overlap.
--
-- WHY
--   „Tip proprietate" says what a property IS (land outside the village, land inside it, a house, a flat...);
--   „Categorie de folosință" says its legal category of use (arabil, pășune, vie, curți-construcții...). Until now the
--   two lists overlapped — „Pășune" and „Vie" were in both, „Teren Arabil" beside „Arabil" — so the same fact could be
--   recorded twice, or two ways. Adrian, on the research doc: „Agree: one page, Property types and uses, with two
--   tiles. Also fix the overlap between the two lists and add Curți-construcții and Drumuri."; the type names were
--   Ciprian's to confirm, and he agreed with the recommended ones.
--
-- WHAT THIS DOES — each step finds rows by NAME, so it runs the same on dev (10 types), on a database rebuilt from
-- sync-reference-data.sql (14) and on Supabase; a row that is not there is simply not touched.
--   1. lookup_use_category gains „Curți-construcții" and „Drumuri" (sort 9, 10) where no use of that name exists. A
--      use spelled „Curți construcții" (the big dev seed's, #39.23) is that use, and takes the agreed spelling instead.
--   2. lookup_property_type gains „Teren extravilan" (tarla/parcelă only) and „Teren intravilan" (all three panels)
--      where no type of that name exists; „Teren Construit" and „Spațiu Comercial" are spelled „Teren construit" and
--      „Spațiu comercial".
--   3. A property typed as one of the land-USE types — Teren Arabil, Pășune, Vie, Livadă, Fâneață, Pădure, Vegetație
--      Forestieră — becomes „Teren extravilan", and takes the use of the same name (Arabil, Pășune, Vie, Livadă,
--      Fânețe, Pădure, Pădure) WHEN IT HAS NO USE. A property whose use already says something is moved and keeps its
--      use (the handover lists those found on dev). A property typed „Teren pentru Construcții" — a type only the big
--      dev seed creates (#39.23), its building plots — becomes „Teren intravilan", its use untouched.
--   4. Those eight types are deleted once no property is left on them. (property.property_type_id is ON DELETE SET
--      NULL, so a property that somehow still pointed at one would lose its type rather than block the delete; step 3
--      leaves none.) Version snapshots that name a deleted type show it as „valoare ștearsă", as for any deleted
--      reference value (#34.27).
--   5. The types are put in the order Ciprian agreed: Teren extravilan, Teren intravilan, Teren construit, Liniară,
--      Casă, Apartament, Garaj, Spațiu comercial, Birou; any other type keeps its place after them.
--   6. lookup_property_type_use (new) pairs a type with the uses allowed for it; A TYPE WITH NO ROWS ALLOWS EVERY USE.
--      Teren extravilan: Arabil, Pășune, Fânețe, Vie, Livadă, Pădure, Ape, Neproductiv. Casă, Apartament, Garaj,
--      Spațiu comercial, Birou: Curți-construcții. Teren intravilan, Teren construit and Liniară get no rows, so every
--      use stays open to them. Both foreign keys cascade: deleting a type or a use deletes its pairs.
--
-- src/db/sync-reference-data.sql writes the same end state for a rebuilt database (verify-rebuild).

BEGIN;

-- 1 ── the two new uses ───────────────────────────────────────────────────────────────────────────────────────────────
UPDATE lookup_use_category SET name = 'Curți-construcții', updated_at = now()
 WHERE name = 'Curți construcții' AND NOT EXISTS (SELECT 1 FROM lookup_use_category u WHERE u.name = 'Curți-construcții');
INSERT INTO lookup_use_category (id, name, sort_order, created_at, updated_at)
SELECT gen_random_uuid(), v.name, v.sort_order, now(), now()
  FROM (VALUES ('Curți-construcții', 9), ('Drumuri', 10)) AS v(name, sort_order)
 WHERE NOT EXISTS (SELECT 1 FROM lookup_use_category u WHERE u.name = v.name);

-- 2 ── the two new types, and two spellings ──────────────────────────────────────────────────────────────────────────
INSERT INTO lookup_property_type (id, name, sort_order, show_tarla_parcela, show_address, show_street_view, created_at, updated_at)
SELECT gen_random_uuid(), v.name, v.sort_order, v.tp, v.addr, v.sv, now(), now()
  FROM (VALUES
    ('Teren extravilan', 1, TRUE, FALSE, FALSE),
    ('Teren intravilan', 2, TRUE, TRUE,  TRUE)
  ) AS v(name, sort_order, tp, addr, sv)
 WHERE NOT EXISTS (SELECT 1 FROM lookup_property_type t WHERE t.name = v.name);

UPDATE lookup_property_type SET name = 'Teren construit', updated_at = now()
 WHERE name = 'Teren Construit' AND NOT EXISTS (SELECT 1 FROM lookup_property_type t WHERE t.name = 'Teren construit');
UPDATE lookup_property_type SET name = 'Spațiu comercial', updated_at = now()
 WHERE name = 'Spațiu Comercial' AND NOT EXISTS (SELECT 1 FROM lookup_property_type t WHERE t.name = 'Spațiu comercial');

-- 3 ── the land-use types' properties move to Teren extravilan; the dev seed's building plots to Teren intravilan ────
-- `use_name` NULL: the type's properties keep whatever use they have.
CREATE TEMP TABLE _land_use (type_name text, new_type text, use_name text) ON COMMIT DROP;
INSERT INTO _land_use VALUES
  ('Teren Arabil', 'Teren extravilan', 'Arabil'), ('Pășune', 'Teren extravilan', 'Pășune'),
  ('Vie', 'Teren extravilan', 'Vie'), ('Livadă', 'Teren extravilan', 'Livadă'),
  ('Fâneață', 'Teren extravilan', 'Fânețe'), ('Pădure', 'Teren extravilan', 'Pădure'),
  ('Vegetație Forestieră', 'Teren extravilan', 'Pădure'),
  ('Teren pentru Construcții', 'Teren intravilan', NULL);

UPDATE property p
   SET property_type_id = (SELECT t.id FROM lookup_property_type t WHERE t.name = l.new_type ORDER BY t.sort_order, t.id LIMIT 1),
       use_category_id  = COALESCE(p.use_category_id,
                                   (SELECT u.id FROM lookup_use_category u WHERE u.name = l.use_name ORDER BY u.sort_order, u.id LIMIT 1)),
       updated_at       = now()
  FROM lookup_property_type old
  JOIN _land_use l ON l.type_name = old.name
 WHERE p.property_type_id = old.id;

-- 4 ── the eight types go, once nothing is on them ───────────────────────────────────────────────────────────────────
DELETE FROM lookup_property_type t
 USING _land_use l
 WHERE t.name = l.type_name
   AND NOT EXISTS (SELECT 1 FROM property p WHERE p.property_type_id = t.id);

-- 5 ── the agreed order ──────────────────────────────────────────────────────────────────────────────────────────────
UPDATE lookup_property_type t SET sort_order = o.sort_order, updated_at = now()
  FROM (VALUES
    ('Teren extravilan', 1), ('Teren intravilan', 2), ('Teren construit', 3), ('Liniară', 4), ('Casă', 5),
    ('Apartament', 6), ('Garaj', 7), ('Spațiu comercial', 8), ('Birou', 9)
  ) AS o(name, sort_order)
 WHERE t.name = o.name;
UPDATE lookup_property_type t SET sort_order = 100 + t.sort_order, updated_at = now()
 WHERE t.name NOT IN ('Teren extravilan', 'Teren intravilan', 'Teren construit', 'Liniară', 'Casă', 'Apartament',
                      'Garaj', 'Spațiu comercial', 'Birou')
   AND t.sort_order < 100;

-- 6 ── the uses each type allows ─────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lookup_property_type_use (
  property_type_id uuid        NOT NULL REFERENCES lookup_property_type(id) ON DELETE CASCADE,
  use_category_id  uuid        NOT NULL REFERENCES lookup_use_category(id)  ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (property_type_id, use_category_id)
);
COMMENT ON TABLE lookup_property_type_use IS
  'Slice #39.66: the use categories allowed for a property type. A type with no rows allows every use.';

INSERT INTO lookup_property_type_use (property_type_id, use_category_id)
SELECT t.id, u.id
  FROM (VALUES
    ('Teren extravilan', 'Arabil'), ('Teren extravilan', 'Pășune'), ('Teren extravilan', 'Fânețe'),
    ('Teren extravilan', 'Vie'), ('Teren extravilan', 'Livadă'), ('Teren extravilan', 'Pădure'),
    ('Teren extravilan', 'Ape'), ('Teren extravilan', 'Neproductiv'),
    ('Casă', 'Curți-construcții'), ('Apartament', 'Curți-construcții'), ('Garaj', 'Curți-construcții'),
    ('Spațiu comercial', 'Curți-construcții'), ('Birou', 'Curți-construcții')
  ) AS v(type_name, use_name)
  JOIN lookup_property_type t ON t.name = v.type_name
  JOIN lookup_use_category  u ON u.name = v.use_name
ON CONFLICT DO NOTHING;

COMMIT;
