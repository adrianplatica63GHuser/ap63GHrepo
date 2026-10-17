-- migration_112_tarla_locality.sql
-- Slice #39.67 - a tarla belongs to a locality: T50 in Bragadiru and T50 in Cornetu are two tarlale.
--
-- WHY
--   Tarla numbers restart in every locality. lookup_tarla held one row per folded code (migration_083's unique
--   index), so a property in Cornetu on T50 shared Bragadiru's T50, and the one-property-per-parcel check compared
--   unrelated parcels. Adrian, on the research doc: tarla as an object, „its own page, but no groups or interactions
--   until you need them" — „(Adrian: agree)".
--
-- WHAT THIS DOES
--   1. lookup_tarla gains `locality`, `county` (the same free text a property's address carries) and `notes`.
--   2. Each existing tarla takes the locality of its properties' addresses — the most common one, compared folded
--      (lower case, no diacritics, one space), spelled as the first property spelled it; the county comes with it.
--      Properties with no locality on their address do not count, and stay on the tarla.
--   3. A tarla whose properties sit in SEVERAL localities is split: the most common keeps the row, and every other
--      locality gets a copy of the row (code, description, order, origin) with its own locality and county; the
--      properties of that locality move to the copy. Each split is RAISEd as a NOTICE, and so is the number of
--      tarlale left with no locality (no property, or none with a locality) — the handover lists both.
--   4. migration_083's unique index on the folded code becomes a unique index on (folded locality, folded code),
--      the empty code still excluded. An empty locality is a locality of its own: two T50 with no locality collide.
--   5. tarla_corner (new) holds a tarla's optional outline, in property_corner's shape; it is deleted with the tarla.
--
-- src/db/sync-reference-data.sql writes the same end state for a rebuilt database (verify-rebuild); the repair
-- file creates the new index in place of the old one.

BEGIN;

-- 1 ── the columns ───────────────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE lookup_tarla ADD COLUMN IF NOT EXISTS locality text;
ALTER TABLE lookup_tarla ADD COLUMN IF NOT EXISTS county   text;
ALTER TABLE lookup_tarla ADD COLUMN IF NOT EXISTS notes    text;
COMMENT ON COLUMN lookup_tarla.locality IS
  'Slice #39.67: the locality the tarla belongs to - tarla numbers restart in every locality. Free text, as on property_address; compared folded.';

-- The fold migration_083 uses, as a session-only function for the data steps. The index below writes it out in full.
CREATE OR REPLACE FUNCTION pg_temp.ga40_fold(x text) RETURNS text LANGUAGE sql IMMUTABLE AS $f$
  SELECT btrim(regexp_replace(
           regexp_replace(lower(normalize(coalesce(x, ''), NFD)), '[' || chr(768) || '-' || chr(879) || ']', '', 'g'),
           '\s+', ' ', 'g'))
$f$;

-- 2 and 3 ── each tarla takes its properties' locality; several localities split it ────────────────────────────────
DROP INDEX IF EXISTS lookup_tarla_indicativ_folded_unique;

DO $$
DECLARE
  t       record;
  g       record;
  rank_no int;
  new_id  uuid;
  moved   int;
  splits  int := 0;
BEGIN
  FOR t IN SELECT id, indicativ, descriere, sort_order, origin FROM lookup_tarla WHERE locality IS NULL ORDER BY indicativ, id LOOP
    rank_no := 0;
    FOR g IN
      SELECT pg_temp.ga40_fold(a.locality)                               AS folded,
             (array_agg(btrim(a.locality) ORDER BY p.code))[1]          AS locality,
             (array_agg(btrim(a.county) ORDER BY p.code)
                FILTER (WHERE pg_temp.ga40_fold(a.county) <> ''))[1]  AS county,
             count(*)                                                    AS n
        FROM property p
        JOIN property_address a ON a.property_id = p.id
       WHERE p.tarla_id = t.id AND pg_temp.ga40_fold(a.locality) <> ''
       GROUP BY 1
       ORDER BY count(*) DESC, 1
    LOOP
      rank_no := rank_no + 1;
      IF rank_no = 1 THEN
        UPDATE lookup_tarla SET locality = g.locality, county = g.county, updated_at = now() WHERE id = t.id;
      ELSE
        INSERT INTO lookup_tarla (id, indicativ, descriere, sort_order, origin, locality, county, created_at, updated_at)
        VALUES (gen_random_uuid(), t.indicativ, t.descriere, t.sort_order, t.origin, g.locality, g.county, now(), now())
        RETURNING id INTO new_id;
        UPDATE property p SET tarla_id = new_id, updated_at = now()
          FROM property_address a
         WHERE a.property_id = p.id AND p.tarla_id = t.id AND pg_temp.ga40_fold(a.locality) = g.folded;
        GET DIAGNOSTICS moved = ROW_COUNT;
        splits := splits + 1;
        RAISE NOTICE 'migration_112 split: tarla % -> a new tarla % in %, % propert(y/ies) moved', t.indicativ, t.indicativ, g.locality, moved;
      END IF;
    END LOOP;
  END LOOP;
  RAISE NOTICE 'migration_112: % split(s); % tarla(e) with no locality', splits,
    (SELECT count(*) FROM lookup_tarla WHERE pg_temp.ga40_fold(locality) = '');
END $$;

-- 4 ── unique per (locality, code) ───────────────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS lookup_tarla_locality_indicativ_folded_unique
  ON lookup_tarla (
    (btrim(regexp_replace(
       regexp_replace(
         lower(normalize(coalesce(locality, ''), NFD)),
         '[' || chr(768) || '-' || chr(879) || ']', '', 'g'),
       '\s+', ' ', 'g'))),
    (btrim(regexp_replace(
       regexp_replace(
         lower(normalize(coalesce(indicativ, ''), NFD)),
         '[' || chr(768) || '-' || chr(879) || ']', '', 'g'),
       '\s+', ' ', 'g')))
  )
  WHERE btrim(regexp_replace(
          regexp_replace(
            lower(normalize(coalesce(indicativ, ''), NFD)),
            '[' || chr(768) || '-' || chr(879) || ']', '', 'g'),
          '\s+', ' ', 'g')) <> '';
COMMENT ON INDEX lookup_tarla_locality_indicativ_folded_unique IS
  'Slice #39.67 (was migration_083''s code-only index): one tarla per folded locality and folded code.';

-- 5 ── a tarla's outline ─────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tarla_corner (
  id             uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  tarla_id       uuid             NOT NULL REFERENCES lookup_tarla(id) ON DELETE CASCADE,
  sequence_no    integer          NOT NULL,
  lat            double precision NOT NULL,
  lon            double precision NOT NULL,
  original_index integer,
  created_at     timestamptz      NOT NULL DEFAULT now(),
  updated_at     timestamptz      NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS tarla_corner_tarla_seq_unique ON tarla_corner (tarla_id, sequence_no);
COMMENT ON TABLE tarla_corner IS
  'Slice #39.67: the optional outline of a tarla, WGS84 decimal degrees, 1-based order - property_corner''s shape.';

COMMIT;
