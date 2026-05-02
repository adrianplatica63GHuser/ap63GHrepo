-- Migration 0002 — Value Lists (Slice #3)
--
-- Creates the eight lookup / reference-data tables that back the
-- admin "Liste de Valori" screen, plus initial seed rows sourced from
-- the Centru de Control mockup PDF.
--
-- Drizzle-kit marker → run with: npm run db:migrate
-- Fallback           → paste directly into the Supabase SQL editor.

-- ── lookup_property_type ────────────────────────────────────────────────────
CREATE TABLE "lookup_property_type" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name"       text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TRIGGER "lookup_property_type_touch_updated_at"
  BEFORE UPDATE ON "lookup_property_type"
  FOR EACH ROW EXECUTE FUNCTION "touch_updated_at"();--> statement-breakpoint

INSERT INTO "lookup_property_type" ("name", "sort_order") VALUES
  ('Teren Arabil',    1),
  ('Teren Construit', 2),
  ('Liniară',         3),
  ('Pășune',          4),
  ('Apartament',      5),
  ('Casă',            6);--> statement-breakpoint

-- ── lookup_tarla ────────────────────────────────────────────────────────────
CREATE TABLE "lookup_tarla" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "indicativ"  text NOT NULL,
  "descriere"  text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TRIGGER "lookup_tarla_touch_updated_at"
  BEFORE UPDATE ON "lookup_tarla"
  FOR EACH ROW EXECUTE FUNCTION "touch_updated_at"();--> statement-breakpoint

INSERT INTO "lookup_tarla" ("indicativ", "descriere", "sort_order") VALUES
  ('T1',  'Tarla 1',  1),
  ('T2',  'Tarla 2',  2),
  ('T3',  'Tarla 3',  3),
  ('T4',  'Tarla 4',  4),
  ('T5',  'Tarla 5',  5),
  ('T6',  'Tarla 6',  6),
  ('T7',  'Tarla 7',  7),
  ('T8',  'Tarla 8',  8),
  ('T9',  'Tarla 9',  9),
  ('T10', 'Tarla 10', 10);--> statement-breakpoint

-- ── lookup_use_category ─────────────────────────────────────────────────────
CREATE TABLE "lookup_use_category" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name"       text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TRIGGER "lookup_use_category_touch_updated_at"
  BEFORE UPDATE ON "lookup_use_category"
  FOR EACH ROW EXECUTE FUNCTION "touch_updated_at"();--> statement-breakpoint

INSERT INTO "lookup_use_category" ("name", "sort_order") VALUES
  ('Arabil',      1),
  ('Pășune',      2),
  ('Fânețe',      3),
  ('Vie',         4),
  ('Livadă',      5),
  ('Pădure',      6),
  ('Ape',         7),
  ('Neproductiv', 8);--> statement-breakpoint

-- ── lookup_person_type ──────────────────────────────────────────────────────
CREATE TABLE "lookup_person_type" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name"       text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TRIGGER "lookup_person_type_touch_updated_at"
  BEFORE UPDATE ON "lookup_person_type"
  FOR EACH ROW EXECUTE FUNCTION "touch_updated_at"();--> statement-breakpoint

INSERT INTO "lookup_person_type" ("name", "sort_order") VALUES
  ('Persoană Fizică',   1),
  ('Persoană Juridică', 2),
  ('Expert',            3),
  ('PFA',               4),
  ('Instituție',        5),
  ('ONG',               6),
  ('Consiliu Local',    7);--> statement-breakpoint

-- ── lookup_citizenship ──────────────────────────────────────────────────────
CREATE TABLE "lookup_citizenship" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name"       text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TRIGGER "lookup_citizenship_touch_updated_at"
  BEFORE UPDATE ON "lookup_citizenship"
  FOR EACH ROW EXECUTE FUNCTION "touch_updated_at"();--> statement-breakpoint

INSERT INTO "lookup_citizenship" ("name", "sort_order") VALUES
  ('Română',     1),
  ('Moldoveană', 2),
  ('Americană',  3),
  ('Germană',    4),
  ('Franceză',   5),
  ('Italiană',   6),
  ('Spaniolă',   7),
  ('Engleză',    8);--> statement-breakpoint

-- ── lookup_document_type ────────────────────────────────────────────────────
CREATE TABLE "lookup_document_type" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name"       text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TRIGGER "lookup_document_type_touch_updated_at"
  BEFORE UPDATE ON "lookup_document_type"
  FOR EACH ROW EXECUTE FUNCTION "touch_updated_at"();--> statement-breakpoint

INSERT INTO "lookup_document_type" ("name", "sort_order") VALUES
  ('Act de Adjudecare',          1),
  ('Act Cadastru',               2),
  ('Autorizare',                 3),
  ('Aviz de Instituție',         4),
  ('Certificat Fiscal',          5),
  ('Certificat de Macanentur',   6),
  ('Certificat de Bunuri',       7),
  ('Certificat de Urbanism',     8),
  ('Contract de Arendă',         9),
  ('Contract de Închiriere',    10),
  ('Contract de Partaj',        11),
  ('Contract de Prestări Servicii', 12),
  ('Contract de Vânzare',       13),
  ('Extras din Carte Funciară', 14),
  ('Extras din PUG',            15),
  ('Hotărâre Judecătorească',   16),
  ('Titlu de Proprietate',      17);--> statement-breakpoint

-- ── lookup_institution ──────────────────────────────────────────────────────
CREATE TABLE "lookup_institution" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name"             text NOT NULL,
  "institution_type" text,
  "sort_order"       integer NOT NULL DEFAULT 0,
  "created_at"       timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"       timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TRIGGER "lookup_institution_touch_updated_at"
  BEFORE UPDATE ON "lookup_institution"
  FOR EACH ROW EXECUTE FUNCTION "touch_updated_at"();--> statement-breakpoint

INSERT INTO "lookup_institution" ("name", "institution_type", "sort_order") VALUES
  ('OCPI',                     'Cadastru',                  1),
  ('Primăria Municipiului',    'Administrație Locală',      2),
  ('Consiliu Județean',        'Administrație Județeană',   3),
  ('ANAF',                     'Fiscal',                    4),
  ('Notariat',                 'Juridic',                   5),
  ('Judecătorie',              'Juridic',                   6),
  ('Tribunal',                 'Juridic',                   7);--> statement-breakpoint

-- ── lookup_service_interest ─────────────────────────────────────────────────
CREATE TABLE "lookup_service_interest" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name"       text NOT NULL,
  "category"   text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TRIGGER "lookup_service_interest_touch_updated_at"
  BEFORE UPDATE ON "lookup_service_interest"
  FOR EACH ROW EXECUTE FUNCTION "touch_updated_at"();--> statement-breakpoint

INSERT INTO "lookup_service_interest" ("name", "category", "sort_order") VALUES
  ('Consultanță Juridică', 'Serviciu', 1),
  ('Evaluare Imobiliară',  'Serviciu', 2),
  ('Mediere',              'Serviciu', 3),
  ('Topografie',           'Serviciu', 4),
  ('Cumpărare',            'Interes',  5),
  ('Vânzare',             'Interes',  6),
  ('Închiriere',           'Interes',  7),
  ('Arendare',             'Interes',  8);
