-- Migration 027: track the original corner index from imported cadastral
-- text/OCR sources on property_corner, so it stays bound to its lat/lon pair
-- when the corner order is fixed (e.g. resolving a bow-tie polygon via the
-- up/down arrows in the Corners table).
--
-- Nullable: manual entry, OCR-derived corners, and the legacy 2-column text
-- format never have a source index and should show "-" in the UI.

ALTER TABLE property_corner ADD COLUMN IF NOT EXISTS original_index integer;
