-- migration_124_address_country.sql
-- Slice 41.51 - „Țara adresei": a value list of countries, chosen on every address tile.
--
-- WHY
--   Adrian, 2026-11-02: „Let's add a new value list called "Address Country" under the Citizenship item in Reference
--   data; let's populate it with the same countries that are present in Citizenship Value List; Let's show this new
--   value list as a dropdown on every address tile".
--
-- WHAT THIS DOES
--   1. lookup_address_country (new): id, name, sort_order, timestamps — the shape of lookup_citizenship.
--   2. Seeded with the countries of the eight seeded citizenships, as country names, in the same order: România,
--      Moldova, Statele Unite ale Americii, Germania, Franța, Italia, Spania, Regatul Unit. Each only when missing
--      (compared folded), so a second run adds nothing.
--   3. A citizenship added by hand beyond the eight is not guessed at: each is RAISEd as a NOTICE for the handover, to
--      be added to the new list by hand if it should be there.
--
-- NOT DESTRUCTIVE
--   A new table and its rows. address.country and property_address.country stay text and keep every value: the
--   dropdown writes the chosen name, and a stored value not in the list stays selectable.
--
-- src/db/sync-reference-data.sql writes the same end state for a rebuilt database (verify-rebuild); the repair file
-- creates the table.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.ga40_fold(x text) RETURNS text LANGUAGE sql IMMUTABLE AS $f$
  SELECT btrim(regexp_replace(
           regexp_replace(lower(normalize(coalesce(x, ''), NFD)), '[' || chr(768) || '-' || chr(879) || ']', '', 'g'),
           '\s+', ' ', 'g'))
$f$;

CREATE TABLE IF NOT EXISTS lookup_address_country (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  sort_order integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE lookup_address_country IS
  'Slice 41.51: „Țara adresei" - the countries an address tile''s „Țară" is chosen from. Kept in step with lookup_citizenship by hand; a save in either list says so.';

INSERT INTO lookup_address_country (name, sort_order)
SELECT v.name, v.ord
  FROM (VALUES ('România', 1), ('Moldova', 2), ('Statele Unite ale Americii', 3), ('Germania', 4),
               ('Franța', 5), ('Italia', 6), ('Spania', 7), ('Regatul Unit', 8)) AS v(name, ord)
 WHERE NOT EXISTS (SELECT 1 FROM lookup_address_country c WHERE pg_temp.ga40_fold(c.name) = pg_temp.ga40_fold(v.name));

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT name FROM lookup_citizenship
     WHERE pg_temp.ga40_fold(name) NOT IN ('romana', 'moldoveana', 'americana', 'germana', 'franceza', 'italiana',
                                            'spaniola', 'engleza')
     ORDER BY sort_order, name
  LOOP
    RAISE NOTICE 'migration_124: citizenship „%" has no country in „Țara adresei" - add it by hand if it should', r.name;
  END LOOP;
END $$;

COMMIT;
