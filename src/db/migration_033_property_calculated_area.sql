-- Slice #18.09 — Property calculated area (m²) from corners
--
-- Adds a system-computed `calculated_area_mp` column to `property`. The value
-- is the interior area of the polygon formed by the property's ordered corners,
-- in square metres. It is NOT user-editable — the application recomputes it on
-- every save (createProperty / updateProperty) by projecting the WGS84 corners
-- back to Stereo 70 (metres) and applying the shoelace formula, so the runtime
-- value is consistent with how corners are entered and displayed.
--
-- Backfill below uses PostGIS geodesic area (ST_Area over geography) instead of
-- the runtime Stereo 70 shoelace, because the Stereo 70 grid interpolation is
-- not available inside SQL. For parcel-sized polygons the two methods differ by
-- well under 0.1%, and the column self-corrects to the Stereo 70 method on the
-- property's next save. Only polygons with >= 3 corners get a value; everything
-- else stays NULL (blank in the UI).
--
-- Idempotent: ADD COLUMN IF NOT EXISTS; the backfill only fills rows that are
-- still NULL.

ALTER TABLE property
  ADD COLUMN IF NOT EXISTS calculated_area_mp numeric(12,2);

-- Backfill existing properties that have >= 3 corners.
WITH rings AS (
  SELECT
    c.property_id,
    count(*) AS n,
    -- Ordered ring of the corners (lon = X, lat = Y), SRID 4326.
    ST_MakeLine(
      ST_SetSRID(ST_MakePoint(c.lon, c.lat), 4326)
      ORDER BY c.sequence_no
    ) AS line
  FROM property_corner c
  GROUP BY c.property_id
)
UPDATE property p
SET calculated_area_mp = ROUND(
  ST_Area(
    -- Close the ring (first point == last point) before making the polygon,
    -- then measure geodesic area on the geography type to get square metres.
    ST_MakePolygon(ST_AddPoint(r.line, ST_StartPoint(r.line)))::geography
  )::numeric,
  2
)
FROM rings r
WHERE r.property_id = p.id
  AND r.n >= 3
  AND p.calculated_area_mp IS NULL;
