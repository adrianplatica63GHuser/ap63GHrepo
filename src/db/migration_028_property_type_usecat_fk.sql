-- Slice #15.16 — Property Type & Use Category: enum -> Reference-Data FK
--
-- Removes the hardcoded `property_type` ("LAND") and `use_category`
-- ("CATEG1"/"CATEG2"/"CATEG3") Postgres enums. Property type and use category
-- are now admin-managed rows in Reference Data (lookup_property_type /
-- lookup_use_category), referenced by nullable FK columns on `property`.
--
-- Both columns are nullable. ON DELETE SET NULL so removing a type/category
-- from Reference Data clears the tag rather than blocking the delete.
--
-- Per the Slice #15.16 decision: NO backfill. The old enum values
-- (LAND / CATEG1 / CATEG2 / CATEG3) have no canonical lookup-row equivalent,
-- so every existing property starts with property_type_id / use_category_id
-- = NULL and is re-picked from the new dropdowns.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS / DROP ... IF EXISTS throughout.

-- 1. New FK columns (nullable).
ALTER TABLE property
  ADD COLUMN IF NOT EXISTS property_type_id uuid
    REFERENCES lookup_property_type(id) ON DELETE SET NULL;

ALTER TABLE property
  ADD COLUMN IF NOT EXISTS use_category_id uuid
    REFERENCES lookup_use_category(id) ON DELETE SET NULL;

-- 2. Drop the old enum-backed columns (no backfill).
ALTER TABLE property DROP COLUMN IF EXISTS type;
ALTER TABLE property DROP COLUMN IF EXISTS use_category;

-- 3. Drop the now-unused enum types.
DROP TYPE IF EXISTS property_type;
DROP TYPE IF EXISTS use_category;
