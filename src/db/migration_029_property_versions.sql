-- Slice #18.02 — Property versioning (full-snapshot history)
--
-- Every Property keeps a complete version history. Version 0 is the state at
-- creation; every saved edit appends the next version. Each version stores a
-- FULL snapshot (property fields + address + ordered corners) as JSONB, so
-- reconstructing "version N" is a direct lookup — no delta replay. The label
-- colour and per-field highlights shown in the UI are derived at display time
-- by diffing snapshot N against snapshot N-1 (snapshots are the single source
-- of truth; nothing derived is persisted).
--
-- Snapshot JSON shape (kept identical between this backfill and the app's
-- write path in src/lib/properties/queries.ts):
--   {
--     "property": { propertyTypeId, nickname, tarlaSola, parcela,
--                   cadastralNumber, carteFunciara, useCategoryId,
--                   surfaceAreaMp, notes },          -- all string|null
--     "address":  { streetLine, postalCode, locality, county, country,
--                   notes } | null,                   -- all string|null
--     "corners":  [ { lat:number, lon:number, originalIndex:number|null } ]
--   }
--
-- Idempotent: CREATE ... IF NOT EXISTS, and the backfill skips any property
-- that already has a version 0.

CREATE TABLE IF NOT EXISTS property_version (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id    uuid        NOT NULL REFERENCES property(id) ON DELETE CASCADE,
  version_number integer     NOT NULL,
  snapshot       jsonb       NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS property_version_property_number_unique
  ON property_version (property_id, version_number);

-- Backfill: give every existing property a version 0 from its current state.
-- (Soft-deleted properties are included too — harmless, and keeps the
-- invariant "every property has at least one version" total.)
INSERT INTO property_version (property_id, version_number, snapshot)
SELECT
  p.id,
  0,
  jsonb_build_object(
    'property', jsonb_build_object(
      'propertyTypeId',  p.property_type_id,
      'nickname',        p.nickname,
      'tarlaSola',       p.tarla_sola,
      'parcela',         p.parcela,
      'cadastralNumber', p.cadastral_number,
      'carteFunciara',   p.carte_funciara,
      'useCategoryId',   p.use_category_id,
      'surfaceAreaMp',   p.surface_area_mp::text,
      'notes',           p.notes
    ),
    'address', (
      SELECT jsonb_build_object(
        'streetLine', a.street_line,
        'postalCode', a.postal_code,
        'locality',   a.locality,
        'county',     a.county,
        'country',    a.country,
        'notes',      a.notes
      )
      FROM property_address a
      WHERE a.property_id = p.id
      LIMIT 1
    ),
    'corners', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'lat',           c.lat,
          'lon',           c.lon,
          'originalIndex', c.original_index
        )
        ORDER BY c.sequence_no
      )
      FROM property_corner c
      WHERE c.property_id = p.id
    ), '[]'::jsonb)
  )
FROM property p
WHERE NOT EXISTS (
  SELECT 1 FROM property_version v
  WHERE v.property_id = p.id AND v.version_number = 0
);
