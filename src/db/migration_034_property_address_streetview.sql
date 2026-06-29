-- Slice #18.12 — Street View address (street line only) on property_address
--
-- A property's corners give it a map location and, where coverage exists, a
-- Street View panorama. Street View comes with its own reverse-geocoded
-- address. For a parcel that address shares the same postal code / locality /
-- county / country as the property's official (document-derived) address — only
-- the street line (street, number, block, floor, apt) tends to differ. So we
-- store just that one extra street line on the SAME single property_address row
-- rather than repeating the shared location fields or adding a second address.
--
-- Nullable; no default. Existing property_version snapshots predate this field
-- and correctly read as null at display time (no version backfill needed).
--
-- Idempotent: ADD COLUMN IF NOT EXISTS.

ALTER TABLE property_address
  ADD COLUMN IF NOT EXISTS street_view_street_line text;
