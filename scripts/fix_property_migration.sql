-- fix_property_migration.sql
-- Run once in pgAdmin query tool to repair the partially-applied 0001 migration.
-- Safe to run when property table is missing but property_address / property_corner exist.

-- 1. Drop the half-built child tables (they have no FK and wrong trigger state).
DROP TABLE IF EXISTS property_corner  CASCADE;
DROP TABLE IF EXISTS property_address CASCADE;

-- 2. Create the property table.
--    property_code_seq already exists from the partial run.
CREATE TABLE IF NOT EXISTS "property" (
  "id"               uuid            PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code"             text            NOT NULL DEFAULT 'PROP' || lpad(nextval('property_code_seq')::text, 5, '0'),
  "type"             property_type   NOT NULL DEFAULT 'LAND',
  "nickname"         text,
  "tarla_sola"       text,
  "parcela"          text,
  "cadastral_number" text,
  "carte_funciara"   text,
  "use_category"     use_category,
  "surface_area_mp"  numeric(12, 2),
  "notes"            text,
  "created_at"       timestamptz     NOT NULL DEFAULT now(),
  "updated_at"       timestamptz     NOT NULL DEFAULT now(),
  "deleted_at"       timestamptz,
  CONSTRAINT "property_code_unique" UNIQUE ("code")
);

-- 3. Re-create child tables with proper FKs.
CREATE TABLE "property_address" (
  "id"          uuid    PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" uuid    NOT NULL REFERENCES "property"("id") ON DELETE CASCADE,
  "street_line" text,
  "postal_code" text,
  "locality"    text,
  "county"      text,
  "country"     text    NOT NULL,
  "notes"       text,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "property_corner" (
  "id"          uuid             PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" uuid             NOT NULL REFERENCES "property"("id") ON DELETE CASCADE,
  "sequence_no" integer          NOT NULL,
  "lat"         double precision NOT NULL,
  "lon"         double precision NOT NULL,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);

-- 4. Unique indexes.
CREATE UNIQUE INDEX "property_address_property_unique"
  ON "property_address" ("property_id");

CREATE UNIQUE INDEX "property_corner_property_seq_unique"
  ON "property_corner" ("property_id", "sequence_no");

CREATE UNIQUE INDEX "property_cadastral_number_unique"
  ON "property" ("cadastral_number")
  WHERE "cadastral_number" IS NOT NULL;

-- 5. updated_at triggers (touch_updated_at() was created in migration 0000).
CREATE TRIGGER "property_touch_updated_at"
  BEFORE UPDATE ON "property"
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER "property_address_touch_updated_at"
  BEFORE UPDATE ON "property_address"
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER "property_corner_touch_updated_at"
  BEFORE UPDATE ON "property_corner"
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- 6. PostGIS spatial index — only runs if PostGIS geography type is available.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'geography'
  ) THEN
    EXECUTE $idx$
      CREATE INDEX "property_corner_geom_idx"
        ON "property_corner"
        USING GIST (ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography)
    $idx$;
    RAISE NOTICE 'PostGIS spatial index created.';
  ELSE
    RAISE NOTICE 'PostGIS geography type not found — spatial index skipped.';
  END IF;
END;
$$;
