-- Sequence used by `person.code` default expression. Created here so that
-- inserts on `person` are valid from the moment the table exists.
CREATE SEQUENCE "person_code_seq" START 1;--> statement-breakpoint
CREATE TYPE "public"."address_kind" AS ENUM('HOME', 'POSTAL', 'HEADQUARTERS', 'CORRESPONDENCE');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('MALE', 'FEMALE');--> statement-breakpoint
CREATE TYPE "public"."id_document_type" AS ENUM('ID_CARD', 'PASSPORT');--> statement-breakpoint
CREATE TYPE "public"."person_type" AS ENUM('NATURAL', 'JUDICIAL');--> statement-breakpoint
CREATE TABLE "address" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"kind" "address_kind" NOT NULL,
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
CREATE TABLE "natural_person" (
	"person_id" uuid PRIMARY KEY NOT NULL,
	"first_name" text,
	"last_name" text,
	"nickname" text,
	"cnp" text,
	"id_document_type" "id_document_type",
	"id_document_number" text,
	"gender" "gender",
	"date_of_birth" date,
	"personal_phone_1" text,
	"personal_phone_2" text,
	"work_phone" text,
	"personal_email_1" text,
	"personal_email_2" text,
	"work_email" text,
	CONSTRAINT "natural_person_has_name" CHECK ("natural_person"."first_name" IS NOT NULL OR "natural_person"."last_name" IS NOT NULL),
	CONSTRAINT "natural_person_id_doc_paired" CHECK (("natural_person"."id_document_type" IS NULL) = ("natural_person"."id_document_number" IS NULL)),
	CONSTRAINT "natural_person_has_contact" CHECK (coalesce("natural_person"."personal_phone_1", "natural_person"."personal_phone_2", "natural_person"."work_phone", "natural_person"."personal_email_1", "natural_person"."personal_email_2", "natural_person"."work_email") IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "person" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text DEFAULT 'PERS' || lpad(nextval('person_code_seq')::text, 5, '0') NOT NULL,
	"type" "person_type" NOT NULL,
	"display_name" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "person_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "address_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "natural_person" ADD CONSTRAINT "natural_person_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "address_person_kind_unique" ON "address" USING btree ("person_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "natural_person_cnp_unique" ON "natural_person" USING btree ("cnp") WHERE "natural_person"."cnp" IS NOT NULL;--> statement-breakpoint
-- Trigger: lock CNP once set. Allows NULL → value (initial set later),
-- blocks value → anything-different (rename or clear). Enforced at the DB
-- so the rule survives bypass attempts via the API.
CREATE OR REPLACE FUNCTION "natural_person_lock_cnp"() RETURNS trigger AS $$
BEGIN
  IF OLD.cnp IS NOT NULL AND NEW.cnp IS DISTINCT FROM OLD.cnp THEN
    RAISE EXCEPTION 'CNP cannot be changed once set; delete and recreate the person instead';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "natural_person_lock_cnp" BEFORE UPDATE ON "natural_person" FOR EACH ROW EXECUTE FUNCTION "natural_person_lock_cnp"();--> statement-breakpoint
-- Trigger: auto-bump updated_at on row update. Single function reused by
-- person and address. natural_person has no updated_at — its row is part
-- of the person aggregate.
CREATE OR REPLACE FUNCTION "touch_updated_at"() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "person_touch_updated_at" BEFORE UPDATE ON "person" FOR EACH ROW EXECUTE FUNCTION "touch_updated_at"();--> statement-breakpoint
CREATE TRIGGER "address_touch_updated_at" BEFORE UPDATE ON "address" FOR EACH ROW EXECUTE FUNCTION "touch_updated_at"();