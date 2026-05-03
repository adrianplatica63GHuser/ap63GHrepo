-- Migration 0003 — Paperwork (Slice #4)
--
-- Creates the `paperwork_type` enum and the `paperwork` table with its
-- supporting sequence and trigger.
--
-- 19 document types cover the full domain: 17 from the business spec plus
-- Act de Donatie and Testament confirmed in session on 2026-05-03.
--
-- Type-specific nullable columns avoid a subtype explosion; the UI shows
-- only the relevant subset per selected type.
--
-- Drizzle-kit marker → run with: npm run db:migrate
-- Fallback           → paste directly into the Supabase SQL editor.

-- ── Enum ─────────────────────────────────────────────────────────────────────

CREATE TYPE "public"."paperwork_type" AS ENUM(
  'ACT_ADJUDECARE',
  'ACT_CADASTRU',
  'ACT_DONATIE',
  'AUTORIZATIE',
  'AVIZ_INSTITUTIE',
  'CERTIFICAT_FISCAL',
  'CERTIFICAT_MOSTENITOR',
  'CERTIFICAT_SARCINI',
  'CERTIFICAT_URBANISM',
  'CONTRACT_ARENDA',
  'CONTRACT_INCHIRIERE',
  'CONTRACT_PARTAJ',
  'CONTRACT_PRESTARI_SERVICII',
  'CONTRACT_VANZARE',
  'EXTRAS_CARTE_FUNCIARA',
  'EXTRAS_PUG',
  'HOTARARE_JUDECATOREASCA',
  'TESTAMENT',
  'TITLU_PROPRIETATE'
);--> statement-breakpoint

-- ── Sequence ──────────────────────────────────────────────────────────────────

-- Used by paperwork.code default expression: PAPR00001, PAPR00002, …
CREATE SEQUENCE "paperwork_code_seq" START 1;--> statement-breakpoint

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE "paperwork" (
  "id"                   uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code"                 text DEFAULT 'PAPR' || lpad(nextval('paperwork_code_seq')::text, 5, '0') NOT NULL,
  "type"                 "paperwork_type" NOT NULL,

  -- Short identifying label (the "Porecla" equivalent for paperwork)
  "title"                text,

  -- Common fields (UI label changes per type)
  "nr_document"          text,
  "date_document"        date,
  "institution"          text,

  -- Titlu de Proprietate specific
  "emitent"              text,
  "baza_legala"          text,
  "uat_proprietate"      text,
  "uat_proprietar"       text,
  "suprafata"            numeric(12, 2),

  -- Certificat de Mostenitor specific
  "nr_dosar_succesoral"  text,
  "data_decesului"       date,
  "ultimul_domiciliu"    text,
  "nr_certificat_deces"  text,

  -- Contract de Inchiriere specific
  "date_start"           date,
  "date_end"             date,

  -- Party placeholders (→ Slice 5 Person relationships)
  "titular_text"         text,  -- Titlu: Titular
  "defunct_text"         text,  -- Titlu: Defunct; Cert. mostenitor: Defunct; Testament: Testator
  "parties_a_text"       text,  -- Vanzatori / Proprietari / Donatori
  "parties_b_text"       text,  -- Cumparatori / Chiriasi / Donatari / Mostenitori

  -- Always present
  "notes"                text,

  "created_at"           timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"           timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at"           timestamp with time zone,

  CONSTRAINT "paperwork_code_unique" UNIQUE("code")
);--> statement-breakpoint

-- ── Trigger ───────────────────────────────────────────────────────────────────

-- Reuse the existing touch_updated_at() function (created in migration 0000).
CREATE TRIGGER "paperwork_touch_updated_at"
  BEFORE UPDATE ON "paperwork"
  FOR EACH ROW EXECUTE FUNCTION "touch_updated_at"();
