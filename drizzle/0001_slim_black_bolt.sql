CREATE TYPE "public"."property_type" AS ENUM('LAND');--> statement-breakpoint
CREATE TYPE "public"."use_category" AS ENUM('CATEG1', 'CATEG2', 'CATEG3');--> statement-breakpoint
CREATE TABLE "property" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text DEFAULT 'PROP' || lpad(nextval('property_code_seq')::text, 5, '0') NOT NULL,
	"type" "property_type" DEFAULT 'LAND' NOT NULL,
	"nickname" text,
	"tarla_sola" text,
	"parcela" text,
	"cadastral_number" text,
	"carte_funciara" text,
	"use_category" "use_category",
	"surface_area_mp" numeric(12, 2),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "property_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "property_address" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"street_line" text,
	"postal_code" text,
	"locality" text,
	"county" text,
	"country" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_corner" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"sequence_no" integer NOT NULL,
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "property_address" ADD CONSTRAINT "property_address_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_corner" ADD CONSTRAINT "property_corner_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "property_address_property_unique" ON "property_address" USING btree ("property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "property_corner_property_seq_unique" ON "property_corner" USING btree ("property_id","sequence_no");--> statement-breakpoint
-- Sequence used by property.code default expression.
CREATE SEQUENCE "property_code_seq" START 1;--> statement-breakpoint
-- Partial unique index: cadastral_number is unique when present.
CREATE UNIQUE INDEX "property_cadastral_number_unique"
  ON "property" ("cadastral_number")
  WHERE "cadastral_number" IS NOT NULL;--> statement-breakpoint
-- Reuse the existing touch_updated_at() function (created in migration 0000).
CREATE TRIGGER "property_touch_updated_at"
  BEFORE UPDATE ON "property"
  FOR EACH ROW EXECUTE FUNCTION "touch_updated_at"();--> statement-breakpoint
CREATE TRIGGER "property_address_touch_updated_at"
  BEFORE UPDATE ON "property_address"
  FOR EACH ROW EXECUTE FUNCTION "touch_updated_at"();--> statement-breakpoint
CREATE TRIGGER "property_corner_touch_updated_at"
  BEFORE UPDATE ON "property_corner"
  FOR EACH ROW EXECUTE FUNCTION "touch_updated_at"();--> statement-breakpoint
-- PostGIS spatial index on property_corner using a derived geography point.
-- Enables fast bounding-box queries and ST_DWithin range searches.
CREATE INDEX "property_corner_geom_idx"
  ON "property_corner"
  USING GIST (ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography);