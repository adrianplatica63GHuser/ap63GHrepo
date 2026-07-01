-- Slice #19.02 — Property type key slug
--
-- Adds a nullable unique text column `key` to `lookup_property_type`,
-- mirroring the `key` column on `lookup_document_type` (migration_020).
--
-- The key is a stable slug that `src/lib/properties/type-config.ts` switches
-- on to apply per-type field visibility in the Property form.  It is
-- server-generated on create (same auto-slug logic as document types) and
-- never exposed in the Reference Data UI.
--
-- Backfills all six existing rows by matching their seeded `name` values.
-- Idempotent: ADD COLUMN IF NOT EXISTS + UPDATE ... WHERE key IS NULL.

ALTER TABLE lookup_property_type
  ADD COLUMN IF NOT EXISTS key text UNIQUE;

UPDATE lookup_property_type SET key = 'APARTAMENT'      WHERE name = 'Apartament'      AND key IS NULL;
UPDATE lookup_property_type SET key = 'CASA'            WHERE name = 'Casă'            AND key IS NULL;
UPDATE lookup_property_type SET key = 'TEREN_CONSTRUIT' WHERE name = 'Teren Construit' AND key IS NULL;
UPDATE lookup_property_type SET key = 'TEREN_ARABIL'    WHERE name = 'Teren Arabil'    AND key IS NULL;
UPDATE lookup_property_type SET key = 'PASUNE'          WHERE name = 'Pășune'          AND key IS NULL;
UPDATE lookup_property_type SET key = 'LINIARA'         WHERE name = 'Liniară'         AND key IS NULL;
