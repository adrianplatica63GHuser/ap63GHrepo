-- ============================================================
-- ga40prj — Supabase Reset Script
--
-- Drops all application-owned objects so the full schema can
-- be applied from scratch via supabase_schema_full.sql.
--
-- Run in the Supabase SQL Editor BEFORE applying the schema.
-- PostGIS must already be enabled in the project.
-- ============================================================

-- ── Junction / association tables ──────────────────────────
DROP TABLE IF EXISTS lookup_doc_type_person_role CASCADE;
DROP TABLE IF EXISTS lookup_property_person_role CASCADE;
DROP TABLE IF EXISTS paperwork_paperwork CASCADE;
DROP TABLE IF EXISTS person_person CASCADE;
DROP TABLE IF EXISTS property_property CASCADE;
DROP TABLE IF EXISTS property_paperwork CASCADE;
DROP TABLE IF EXISTS person_paperwork CASCADE;
DROP TABLE IF EXISTS property_person CASCADE;
DROP TABLE IF EXISTS paperwork_page CASCADE;

-- ── Auth tables ────────────────────────────────────────────
DROP TABLE IF EXISTS app_users CASCADE;
DROP TABLE IF EXISTS user_requests CASCADE;

-- ── Person subtypes ────────────────────────────────────────
DROP TABLE IF EXISTS natural_person CASCADE;
DROP TABLE IF EXISTS judicial_person CASCADE;
DROP TABLE IF EXISTS address CASCADE;

-- ── Property children ──────────────────────────────────────
DROP TABLE IF EXISTS property_corner CASCADE;
DROP TABLE IF EXISTS property_address CASCADE;

-- ── Core domain tables ─────────────────────────────────────
DROP TABLE IF EXISTS paperwork CASCADE;
DROP TABLE IF EXISTS property CASCADE;
DROP TABLE IF EXISTS person CASCADE;
DROP TABLE IF EXISTS principal_object CASCADE;

-- ── Lookup tables ──────────────────────────────────────────
DROP TABLE IF EXISTS lookup_person_role CASCADE;
DROP TABLE IF EXISTS lookup_document_type CASCADE;
DROP TABLE IF EXISTS lookup_institution CASCADE;
DROP TABLE IF EXISTS lookup_others CASCADE;
DROP TABLE IF EXISTS lookup_service_interest CASCADE;
DROP TABLE IF EXISTS lookup_property_type CASCADE;
DROP TABLE IF EXISTS lookup_tarla CASCADE;
DROP TABLE IF EXISTS lookup_use_category CASCADE;
DROP TABLE IF EXISTS lookup_person_type CASCADE;
DROP TABLE IF EXISTS lookup_citizenship CASCADE;

-- ── Enums ──────────────────────────────────────────────────
DROP TYPE IF EXISTS principal_object_type CASCADE;
DROP TYPE IF EXISTS address_kind CASCADE;
DROP TYPE IF EXISTS gender CASCADE;
DROP TYPE IF EXISTS id_document_type CASCADE;
DROP TYPE IF EXISTS person_type CASCADE;
DROP TYPE IF EXISTS judicial_type CASCADE;
DROP TYPE IF EXISTS property_type CASCADE;
DROP TYPE IF EXISTS use_category CASCADE;
DROP TYPE IF EXISTS paperwork_type CASCADE;
DROP TYPE IF EXISTS user_request_status CASCADE;
DROP TYPE IF EXISTS app_user_role CASCADE;

-- ── Sequences ──────────────────────────────────────────────
DROP SEQUENCE IF EXISTS principal_object_code_seq CASCADE;
DROP SEQUENCE IF EXISTS person_code_seq CASCADE;
DROP SEQUENCE IF EXISTS property_code_seq CASCADE;
DROP SEQUENCE IF EXISTS paperwork_code_seq CASCADE;

-- ── Functions (triggers dropped via CASCADE above) ─────────
DROP FUNCTION IF EXISTS touch_updated_at() CASCADE;
DROP FUNCTION IF EXISTS natural_person_lock_cnp() CASCADE;
DROP FUNCTION IF EXISTS judicial_person_lock_cui() CASCADE;
