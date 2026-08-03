-- ============================================================
-- ga40prj -- Full Schema Script (Supabase)
--
-- GENERATED FILE -- DO NOT EDIT BY HAND.
-- Regenerate with:  .\scripts\Export-SupabaseSchema.ps1
--
-- Generated : 2026-08-03 13:17
-- Source    : local Docker database (ga40db @ ga40prj-postgres)
--
-- Applies the complete schema from scratch after running
-- supabase_reset.sql. Run in the Supabase SQL Editor.
-- PostGIS must already be enabled in the project.
--
-- This file was hand-maintained until Slice #21.09.help.error, by which
-- point it had drifted to 37 of 49 tables with 21 more missing columns.
-- It is now generated from the live schema so it cannot drift again.
-- For an ADDITIVE repair of an existing database (which this file is not --
-- it assumes an empty schema), use supabase_repair_missing_tables.sql.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;
--
-- PostgreSQL database dump
--

-- Dumped from database version 16.4 (Debian 16.4-1.pgdg110+2)
-- Dumped by pg_dump version 16.4 (Debian 16.4-1.pgdg110+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: address_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.address_kind AS ENUM (
    'HOME',
    'POSTAL',
    'HEADQUARTERS',
    'CORRESPONDENCE'
);


--
-- Name: app_user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_user_role AS ENUM (
    'superuser',
    'user'
);


--
-- Name: gender; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.gender AS ENUM (
    'MALE',
    'FEMALE'
);


--
-- Name: group_target_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.group_target_type AS ENUM (
    'PHYSICAL_PERSON',
    'JUDICIAL_PERSON',
    'PROPERTY',
    'DOCUMENT'
);


--
-- Name: id_document_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.id_document_type AS ENUM (
    'ID_CARD',
    'PASSPORT'
);


--
-- Name: person_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.person_type AS ENUM (
    'NATURAL',
    'JUDICIAL'
);


--
-- Name: principal_object_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.principal_object_type AS ENUM (
    'PERSON',
    'PROPERTY',
    'DOCUMENT'
);


--
-- Name: user_request_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_request_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);


--
-- Name: judicial_person_check_cui_unique(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.judicial_person_check_cui_unique() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.cui_number IS NOT NULL AND EXISTS (
    SELECT 1
    FROM judicial_person jp
    JOIN person p ON p.id = jp.person_id
    WHERE jp.cui_number = NEW.cui_number
      AND jp.person_id IS DISTINCT FROM NEW.person_id
      AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'A judicial person with this CUI already exists'
      USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: judicial_person_lock_cui(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.judicial_person_lock_cui() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF OLD.cui_number IS NOT NULL AND NEW.cui_number IS DISTINCT FROM OLD.cui_number THEN
    RAISE EXCEPTION 'CUI cannot be changed once set; delete and recreate the judicial person instead';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: natural_person_check_cnp_unique(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.natural_person_check_cnp_unique() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.cnp IS NOT NULL AND EXISTS (
    SELECT 1
    FROM natural_person np
    JOIN person p ON p.id = np.person_id
    WHERE np.cnp = NEW.cnp
      AND np.person_id IS DISTINCT FROM NEW.person_id
      AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'A person with this CNP already exists'
      USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: natural_person_lock_cnp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.natural_person_lock_cnp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF OLD.cnp IS NOT NULL AND NEW.cnp IS DISTINCT FROM OLD.cnp THEN
    RAISE EXCEPTION 'CNP cannot be changed once set; delete and recreate the person instead';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: address; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.address (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    person_id uuid NOT NULL,
    kind public.address_kind NOT NULL,
    street_line text,
    postal_code text,
    locality text,
    county text,
    country text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: app_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supabase_uid text,
    email text NOT NULL,
    username text NOT NULL,
    role public.app_user_role DEFAULT 'user'::public.app_user_role NOT NULL,
    approved_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: calculation_run; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calculation_run (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    algorithm_type text NOT NULL,
    input_params jsonb NOT NULL,
    steps_log jsonb DEFAULT '{}'::jsonb NOT NULL,
    result_group_id uuid,
    status text DEFAULT 'active'::text NOT NULL,
    notes text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT calculation_run_status_check CHECK ((status = ANY (ARRAY['active'::text, 'superseded'::text])))
);


--
-- Name: calculation_run_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.calculation_run_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: calculation_run_output; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calculation_run_output (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    calculation_run_id uuid NOT NULL,
    principal_object_id uuid NOT NULL,
    output_role text DEFAULT 'OWNER_PARCEL'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    principal_object_id uuid NOT NULL,
    code text NOT NULL,
    title text,
    nr_document text,
    date_document date,
    emitent text,
    baza_legala text,
    uat_proprietate text,
    uat_proprietar text,
    suprafata numeric(12,2),
    nr_dosar_succesoral text,
    data_decesului date,
    ultimul_domiciliu text,
    nr_certificat_deces text,
    date_start date,
    date_end date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    document_type_id uuid NOT NULL,
    institution_id uuid,
    subject text,
    date_valid_until date,
    surveyor_id uuid,
    updated_by text,
    ai_interpreted_at timestamp with time zone,
    custom_fields jsonb
);


--
-- Name: document_document; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_document (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id_a uuid NOT NULL,
    document_id_b uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    relationship_role_id uuid,
    CONSTRAINT document_document_order CHECK ((document_id_a < document_id_b))
);


--
-- Name: document_page; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_page (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    page_number integer NOT NULL,
    page_name text,
    page_notes text,
    file_name text NOT NULL,
    file_path text NOT NULL,
    file_size integer,
    mime_type text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_version (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    version_number integer NOT NULL,
    snapshot jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text
);


--
-- Name: entity_cross_reference; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entity_cross_reference (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_principal_object_id uuid NOT NULL,
    target_principal_object_id uuid NOT NULL,
    relationship_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ecr_no_self_ref CHECK ((source_principal_object_id <> target_principal_object_id))
);


--
-- Name: entity_metadata; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entity_metadata (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    principal_object_id uuid NOT NULL,
    importance text,
    relevance text,
    provenance text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    importance_updated_at timestamp with time zone,
    relevance_updated_at timestamp with time zone,
    provenance_updated_at timestamp with time zone,
    updated_by text,
    CONSTRAINT chk_em_importance CHECK ((importance = ANY (ARRAY['LOW'::text, 'MEDIUM'::text, 'HIGH'::text]))),
    CONSTRAINT chk_em_provenance CHECK ((provenance = ANY (ARRAY['MANUAL'::text, 'IMAGE'::text, 'DOC_FILE'::text, 'COORDINATE_FILE'::text, 'ALGORITHM'::text, 'AI_INTERPRETED'::text, 'EXTERNAL_FEED'::text]))),
    CONSTRAINT chk_em_relevance CHECK ((relevance = ANY (ARRAY['INACTIVE'::text, 'HISTORICAL'::text, 'CURRENT'::text, 'FUTURE'::text])))
);


--
-- Name: entity_metadata_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entity_metadata_version (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_metadata_id uuid NOT NULL,
    version_number integer NOT NULL,
    snapshot jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: entity_provenance_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entity_provenance_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_metadata_id uuid NOT NULL,
    method text NOT NULL,
    logged_at date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: entity_tag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entity_tag (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    principal_object_id uuid NOT NULL,
    tag text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: group_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.group_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: group_member; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_member (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    "position" integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    principal_object_id uuid NOT NULL
);


--
-- Name: groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    target_type public.group_target_type NOT NULL,
    description text NOT NULL,
    last_position integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: help_content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.help_content (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    screen_key text NOT NULL,
    background_en text,
    background_ro text,
    how_to_en text,
    how_to_ro text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: help_hint; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.help_hint (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    screen_key text NOT NULL,
    hint_key text NOT NULL,
    text_en text,
    text_ro text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: judicial_person; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.judicial_person (
    person_id uuid NOT NULL,
    name text NOT NULL,
    nickname text,
    cui_number text,
    trade_register_number text,
    contact_person_1_id uuid,
    contact_person_2_id uuid,
    correspondence_same_as_hq boolean DEFAULT false NOT NULL,
    judicial_person_type_id uuid
);


--
-- Name: lookup_citizenship; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lookup_citizenship (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: lookup_doc_type_person_role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lookup_doc_type_person_role (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_type_id uuid NOT NULL,
    person_role_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lookup_document_document_role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lookup_document_document_role (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: lookup_document_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lookup_document_type (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    key text NOT NULL,
    deleted_at timestamp with time zone,
    template_fields jsonb
);


--
-- Name: lookup_institution; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lookup_institution (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    institution_type text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: lookup_judicial_person_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lookup_judicial_person_type (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: lookup_person_person_role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lookup_person_person_role (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    person_role_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lookup_person_role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lookup_person_role (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: lookup_person_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lookup_person_type (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: lookup_property_person_role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lookup_property_person_role (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    person_role_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lookup_property_property_role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lookup_property_property_role (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: lookup_property_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lookup_property_type (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    key text,
    show_tarla_parcela boolean DEFAULT false NOT NULL,
    show_address boolean DEFAULT false NOT NULL,
    show_street_view boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: lookup_tarla; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lookup_tarla (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    indicativ text NOT NULL,
    descriere text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: lookup_use_category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lookup_use_category (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: natural_person; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.natural_person (
    person_id uuid NOT NULL,
    first_name text,
    last_name text,
    nickname text,
    cnp text,
    id_document_type public.id_document_type,
    id_document_number text,
    gender public.gender,
    date_of_birth date,
    personal_phone_1 text,
    personal_phone_2 text,
    work_phone text,
    personal_email_1 text,
    personal_email_2 text,
    work_email text,
    place_of_birth text,
    id_issuing_authority text,
    id_valid_from date,
    id_valid_until date,
    id_card_number text,
    id_mrz_raw text,
    citizenship_id uuid,
    physical_person_type_id uuid,
    correspondence_same_as_home boolean DEFAULT false NOT NULL,
    CONSTRAINT natural_person_has_name CHECK (((first_name IS NOT NULL) OR (last_name IS NOT NULL)))
);


--
-- Name: person; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.person (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    principal_object_id uuid NOT NULL,
    code text NOT NULL,
    type public.person_type NOT NULL,
    display_name text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    updated_by text
);


--
-- Name: person_document; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.person_document (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    person_id uuid NOT NULL,
    document_id uuid NOT NULL,
    quality text,
    person_role_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT person_document_quality_check CHECK (((quality IS NULL) OR (quality = ANY (ARRAY['DEFUNCT'::text, 'MOSTENITOR'::text]))))
);


--
-- Name: person_person; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.person_person (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    person_id_a uuid NOT NULL,
    person_id_b uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    relationship_role_id uuid,
    CONSTRAINT person_person_order CHECK ((person_id_a < person_id_b))
);


--
-- Name: person_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.person_version (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    person_id uuid NOT NULL,
    version_number integer NOT NULL,
    snapshot jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text
);


--
-- Name: principal_object; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.principal_object (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    object_type public.principal_object_type NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: principal_object_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.principal_object_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: property; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.property (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    principal_object_id uuid NOT NULL,
    code text NOT NULL,
    nickname text,
    tarla_sola text,
    parcela text,
    cadastral_number text,
    carte_funciara text,
    surface_area_mp numeric(12,2),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    property_type_id uuid,
    use_category_id uuid,
    calculated_area_mp numeric(12,2),
    updated_by text
);


--
-- Name: property_address; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.property_address (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    property_id uuid NOT NULL,
    street_line text,
    postal_code text,
    locality text,
    county text,
    country text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    street_view_street_line text
);


--
-- Name: property_corner; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.property_corner (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    property_id uuid NOT NULL,
    sequence_no integer NOT NULL,
    lat double precision NOT NULL,
    lon double precision NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    original_index integer
);


--
-- Name: property_corner_source; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.property_corner_source (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    property_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by text
);


--
-- Name: property_document; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.property_document (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    property_id uuid NOT NULL,
    document_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: property_person; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.property_person (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    property_id uuid NOT NULL,
    person_id uuid NOT NULL,
    person_role_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: property_property; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.property_property (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    property_id_a uuid NOT NULL,
    property_id_b uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    relationship_role_id uuid,
    CONSTRAINT property_property_order CHECK ((property_id_a < property_id_b))
);


--
-- Name: property_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.property_version (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    property_id uuid NOT NULL,
    version_number integer NOT NULL,
    snapshot jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    filename text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL,
    checksum text
);


--
-- Name: stamp_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stamp_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stamp_member; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stamp_member (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    stamp_id uuid NOT NULL,
    target_type public.group_target_type NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    principal_object_id uuid NOT NULL
);


--
-- Name: stamps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stamps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    short_description text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: time_frame_setting; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.time_frame_setting (
    key text NOT NULL,
    value integer NOT NULL,
    unit text DEFAULT 'days'::text NOT NULL,
    label_en text NOT NULL,
    label_ro text NOT NULL,
    description_en text,
    description_ro text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    username text NOT NULL,
    status public.user_request_status DEFAULT 'pending'::public.user_request_status NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    processed_by text,
    email_sent boolean DEFAULT false NOT NULL
);


--
-- Name: address address_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.address
    ADD CONSTRAINT address_pkey PRIMARY KEY (id);


--
-- Name: app_users app_users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_email_key UNIQUE (email);


--
-- Name: app_users app_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_pkey PRIMARY KEY (id);


--
-- Name: app_users app_users_supabase_uid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_supabase_uid_key UNIQUE (supabase_uid);


--
-- Name: app_users app_users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_username_key UNIQUE (username);


--
-- Name: calculation_run calculation_run_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calculation_run
    ADD CONSTRAINT calculation_run_code_key UNIQUE (code);


--
-- Name: calculation_run_output calculation_run_output_calculation_run_id_principal_object__key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calculation_run_output
    ADD CONSTRAINT calculation_run_output_calculation_run_id_principal_object__key UNIQUE (calculation_run_id, principal_object_id);


--
-- Name: calculation_run_output calculation_run_output_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calculation_run_output
    ADD CONSTRAINT calculation_run_output_pkey PRIMARY KEY (id);


--
-- Name: calculation_run calculation_run_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calculation_run
    ADD CONSTRAINT calculation_run_pkey PRIMARY KEY (id);


--
-- Name: document_page document_page_document_number_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_page
    ADD CONSTRAINT document_page_document_number_unique UNIQUE (document_id, page_number);


--
-- Name: document_version document_version_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_version
    ADD CONSTRAINT document_version_pkey PRIMARY KEY (id);


--
-- Name: entity_cross_reference ecr_unique_pair; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_cross_reference
    ADD CONSTRAINT ecr_unique_pair UNIQUE (source_principal_object_id, target_principal_object_id);


--
-- Name: entity_cross_reference entity_cross_reference_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_cross_reference
    ADD CONSTRAINT entity_cross_reference_pkey PRIMARY KEY (id);


--
-- Name: entity_metadata entity_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_metadata
    ADD CONSTRAINT entity_metadata_pkey PRIMARY KEY (id);


--
-- Name: entity_metadata entity_metadata_principal_object_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_metadata
    ADD CONSTRAINT entity_metadata_principal_object_id_key UNIQUE (principal_object_id);


--
-- Name: entity_metadata_version entity_metadata_version_entity_metadata_id_version_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_metadata_version
    ADD CONSTRAINT entity_metadata_version_entity_metadata_id_version_number_key UNIQUE (entity_metadata_id, version_number);


--
-- Name: entity_metadata_version entity_metadata_version_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_metadata_version
    ADD CONSTRAINT entity_metadata_version_pkey PRIMARY KEY (id);


--
-- Name: entity_provenance_log entity_provenance_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_provenance_log
    ADD CONSTRAINT entity_provenance_log_pkey PRIMARY KEY (id);


--
-- Name: entity_tag entity_tag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_tag
    ADD CONSTRAINT entity_tag_pkey PRIMARY KEY (id);


--
-- Name: group_member group_member_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_member
    ADD CONSTRAINT group_member_pkey PRIMARY KEY (id);


--
-- Name: groups groups_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_code_key UNIQUE (code);


--
-- Name: groups groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_pkey PRIMARY KEY (id);


--
-- Name: help_content help_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.help_content
    ADD CONSTRAINT help_content_pkey PRIMARY KEY (id);


--
-- Name: help_content help_content_screen_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.help_content
    ADD CONSTRAINT help_content_screen_key_key UNIQUE (screen_key);


--
-- Name: help_hint help_hint_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.help_hint
    ADD CONSTRAINT help_hint_pkey PRIMARY KEY (id);


--
-- Name: help_hint help_hint_screen_hint_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.help_hint
    ADD CONSTRAINT help_hint_screen_hint_unique UNIQUE (screen_key, hint_key);


--
-- Name: judicial_person judicial_person_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.judicial_person
    ADD CONSTRAINT judicial_person_pkey PRIMARY KEY (person_id);


--
-- Name: lookup_citizenship lookup_citizenship_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lookup_citizenship
    ADD CONSTRAINT lookup_citizenship_pkey PRIMARY KEY (id);


--
-- Name: lookup_doc_type_person_role lookup_doc_type_person_role_document_type_id_person_role_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lookup_doc_type_person_role
    ADD CONSTRAINT lookup_doc_type_person_role_document_type_id_person_role_id_key UNIQUE (document_type_id, person_role_id);


--
-- Name: lookup_doc_type_person_role lookup_doc_type_person_role_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lookup_doc_type_person_role
    ADD CONSTRAINT lookup_doc_type_person_role_pkey PRIMARY KEY (id);


--
-- Name: lookup_document_document_role lookup_document_document_role_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lookup_document_document_role
    ADD CONSTRAINT lookup_document_document_role_pkey PRIMARY KEY (id);


--
-- Name: lookup_document_type lookup_document_type_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lookup_document_type
    ADD CONSTRAINT lookup_document_type_key_unique UNIQUE (key);


--
-- Name: lookup_document_type lookup_document_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lookup_document_type
    ADD CONSTRAINT lookup_document_type_pkey PRIMARY KEY (id);


--
-- Name: lookup_institution lookup_institution_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lookup_institution
    ADD CONSTRAINT lookup_institution_pkey PRIMARY KEY (id);


--
-- Name: lookup_judicial_person_type lookup_judicial_person_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lookup_judicial_person_type
    ADD CONSTRAINT lookup_judicial_person_type_pkey PRIMARY KEY (id);


--
-- Name: lookup_person_person_role lookup_person_person_role_person_role_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lookup_person_person_role
    ADD CONSTRAINT lookup_person_person_role_person_role_id_key UNIQUE (person_role_id);


--
-- Name: lookup_person_person_role lookup_person_person_role_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lookup_person_person_role
    ADD CONSTRAINT lookup_person_person_role_pkey PRIMARY KEY (id);


--
-- Name: lookup_person_role lookup_person_role_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lookup_person_role
    ADD CONSTRAINT lookup_person_role_pkey PRIMARY KEY (id);


--
-- Name: lookup_person_type lookup_person_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lookup_person_type
    ADD CONSTRAINT lookup_person_type_pkey PRIMARY KEY (id);


--
-- Name: lookup_property_person_role lookup_property_person_role_person_role_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lookup_property_person_role
    ADD CONSTRAINT lookup_property_person_role_person_role_id_key UNIQUE (person_role_id);


--
-- Name: lookup_property_person_role lookup_property_person_role_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lookup_property_person_role
    ADD CONSTRAINT lookup_property_person_role_pkey PRIMARY KEY (id);


--
-- Name: lookup_property_property_role lookup_property_property_role_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lookup_property_property_role
    ADD CONSTRAINT lookup_property_property_role_pkey PRIMARY KEY (id);


--
-- Name: lookup_property_type lookup_property_type_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lookup_property_type
    ADD CONSTRAINT lookup_property_type_key_key UNIQUE (key);


--
-- Name: lookup_property_type lookup_property_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lookup_property_type
    ADD CONSTRAINT lookup_property_type_pkey PRIMARY KEY (id);


--
-- Name: lookup_tarla lookup_tarla_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lookup_tarla
    ADD CONSTRAINT lookup_tarla_pkey PRIMARY KEY (id);


--
-- Name: lookup_use_category lookup_use_category_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lookup_use_category
    ADD CONSTRAINT lookup_use_category_pkey PRIMARY KEY (id);


--
-- Name: natural_person natural_person_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.natural_person
    ADD CONSTRAINT natural_person_pkey PRIMARY KEY (person_id);


--
-- Name: document paperwork_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT paperwork_code_key UNIQUE (code);


--
-- Name: document_page paperwork_page_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_page
    ADD CONSTRAINT paperwork_page_pkey PRIMARY KEY (id);


--
-- Name: document_document paperwork_paperwork_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_document
    ADD CONSTRAINT paperwork_paperwork_pkey PRIMARY KEY (id);


--
-- Name: document paperwork_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT paperwork_pkey PRIMARY KEY (id);


--
-- Name: document paperwork_principal_object_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT paperwork_principal_object_id_key UNIQUE (principal_object_id);


--
-- Name: person person_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person
    ADD CONSTRAINT person_code_key UNIQUE (code);


--
-- Name: person_document person_paperwork_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_document
    ADD CONSTRAINT person_paperwork_pkey PRIMARY KEY (id);


--
-- Name: person_person person_person_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_person
    ADD CONSTRAINT person_person_pkey PRIMARY KEY (id);


--
-- Name: person person_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person
    ADD CONSTRAINT person_pkey PRIMARY KEY (id);


--
-- Name: person person_principal_object_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person
    ADD CONSTRAINT person_principal_object_id_key UNIQUE (principal_object_id);


--
-- Name: person_version person_version_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_version
    ADD CONSTRAINT person_version_pkey PRIMARY KEY (id);


--
-- Name: principal_object principal_object_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.principal_object
    ADD CONSTRAINT principal_object_code_key UNIQUE (code);


--
-- Name: principal_object principal_object_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.principal_object
    ADD CONSTRAINT principal_object_pkey PRIMARY KEY (id);


--
-- Name: property_address property_address_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_address
    ADD CONSTRAINT property_address_pkey PRIMARY KEY (id);


--
-- Name: property property_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property
    ADD CONSTRAINT property_code_key UNIQUE (code);


--
-- Name: property_corner property_corner_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_corner
    ADD CONSTRAINT property_corner_pkey PRIMARY KEY (id);


--
-- Name: property_corner_source property_corner_source_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_corner_source
    ADD CONSTRAINT property_corner_source_pkey PRIMARY KEY (id);


--
-- Name: property_document property_paperwork_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_document
    ADD CONSTRAINT property_paperwork_pkey PRIMARY KEY (id);


--
-- Name: property_person property_person_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_person
    ADD CONSTRAINT property_person_pkey PRIMARY KEY (id);


--
-- Name: property property_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property
    ADD CONSTRAINT property_pkey PRIMARY KEY (id);


--
-- Name: property property_principal_object_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property
    ADD CONSTRAINT property_principal_object_id_key UNIQUE (principal_object_id);


--
-- Name: property_property property_property_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_property
    ADD CONSTRAINT property_property_pkey PRIMARY KEY (id);


--
-- Name: property_version property_version_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_version
    ADD CONSTRAINT property_version_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (filename);


--
-- Name: stamp_member stamp_member_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stamp_member
    ADD CONSTRAINT stamp_member_pkey PRIMARY KEY (id);


--
-- Name: stamps stamps_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stamps
    ADD CONSTRAINT stamps_code_key UNIQUE (code);


--
-- Name: stamps stamps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stamps
    ADD CONSTRAINT stamps_pkey PRIMARY KEY (id);


--
-- Name: time_frame_setting time_frame_setting_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_frame_setting
    ADD CONSTRAINT time_frame_setting_pkey PRIMARY KEY (key);


--
-- Name: user_requests user_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_requests
    ADD CONSTRAINT user_requests_pkey PRIMARY KEY (id);


--
-- Name: address_person_kind_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX address_person_kind_unique ON public.address USING btree (person_id, kind);


--
-- Name: calculation_run_output_po_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calculation_run_output_po_idx ON public.calculation_run_output USING btree (principal_object_id);


--
-- Name: calculation_run_output_run_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calculation_run_output_run_idx ON public.calculation_run_output USING btree (calculation_run_id);


--
-- Name: document_document_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX document_document_unique ON public.document_document USING btree (document_id_a, document_id_b);


--
-- Name: document_version_document_number_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX document_version_document_number_unique ON public.document_version USING btree (document_id, version_number);


--
-- Name: ecr_source_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ecr_source_idx ON public.entity_cross_reference USING btree (source_principal_object_id);


--
-- Name: ecr_target_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ecr_target_idx ON public.entity_cross_reference USING btree (target_principal_object_id);


--
-- Name: entity_metadata_importance_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX entity_metadata_importance_idx ON public.entity_metadata USING btree (importance);


--
-- Name: entity_metadata_provenance_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX entity_metadata_provenance_idx ON public.entity_metadata USING btree (provenance);


--
-- Name: entity_metadata_relevance_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX entity_metadata_relevance_idx ON public.entity_metadata USING btree (relevance);


--
-- Name: entity_metadata_version_meta_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX entity_metadata_version_meta_idx ON public.entity_metadata_version USING btree (entity_metadata_id, version_number);


--
-- Name: entity_provenance_log_meta_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX entity_provenance_log_meta_idx ON public.entity_provenance_log USING btree (entity_metadata_id, logged_at);


--
-- Name: entity_tag_entity_tag_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX entity_tag_entity_tag_unique ON public.entity_tag USING btree (principal_object_id, lower(tag));


--
-- Name: entity_tag_principal_object_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX entity_tag_principal_object_idx ON public.entity_tag USING btree (principal_object_id);


--
-- Name: group_member_group_position_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX group_member_group_position_unique ON public.group_member USING btree (group_id, "position");


--
-- Name: group_member_group_principal_object_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX group_member_group_principal_object_unique ON public.group_member USING btree (group_id, principal_object_id);


--
-- Name: idx_document_nr_document_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_nr_document_trgm ON public.document USING gin (nr_document public.gin_trgm_ops) WHERE (nr_document IS NOT NULL);


--
-- Name: idx_document_subject_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_subject_trgm ON public.document USING gin (subject public.gin_trgm_ops) WHERE (subject IS NOT NULL);


--
-- Name: idx_document_title_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_title_trgm ON public.document USING gin (title public.gin_trgm_ops) WHERE (title IS NOT NULL);


--
-- Name: idx_person_display_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_person_display_name_trgm ON public.person USING gin (display_name public.gin_trgm_ops);


--
-- Name: idx_principal_object_code_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_principal_object_code_trgm ON public.principal_object USING gin (code public.gin_trgm_ops);


--
-- Name: idx_property_cadastral_number_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_cadastral_number_trgm ON public.property USING gin (cadastral_number public.gin_trgm_ops) WHERE (cadastral_number IS NOT NULL);


--
-- Name: idx_property_carte_funciara_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_carte_funciara_trgm ON public.property USING gin (carte_funciara public.gin_trgm_ops) WHERE (carte_funciara IS NOT NULL);


--
-- Name: idx_property_nickname_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_nickname_trgm ON public.property USING gin (nickname public.gin_trgm_ops) WHERE (nickname IS NOT NULL);


--
-- Name: idx_property_tarla_sola_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_tarla_sola_trgm ON public.property USING gin (tarla_sola public.gin_trgm_ops) WHERE (tarla_sola IS NOT NULL);


--
-- Name: person_document_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX person_document_unique ON public.person_document USING btree (person_id, document_id);


--
-- Name: person_person_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX person_person_unique ON public.person_person USING btree (person_id_a, person_id_b);


--
-- Name: person_version_person_number_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX person_version_person_number_unique ON public.person_version USING btree (person_id, version_number);


--
-- Name: property_address_property_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX property_address_property_unique ON public.property_address USING btree (property_id);


--
-- Name: property_cadastral_number_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX property_cadastral_number_unique ON public.property USING btree (cadastral_number) WHERE (cadastral_number IS NOT NULL);


--
-- Name: property_corner_geom_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX property_corner_geom_idx ON public.property_corner USING gist (((public.st_setsrid(public.st_makepoint(lon, lat), 4326))::public.geography));


--
-- Name: property_corner_property_seq_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX property_corner_property_seq_unique ON public.property_corner USING btree (property_id, sequence_no);


--
-- Name: property_corner_source_document_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX property_corner_source_document_unique ON public.property_corner_source USING btree (document_id);


--
-- Name: property_corner_source_property_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX property_corner_source_property_idx ON public.property_corner_source USING btree (property_id);


--
-- Name: property_document_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX property_document_unique ON public.property_document USING btree (property_id, document_id);


--
-- Name: property_person_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX property_person_unique ON public.property_person USING btree (property_id, person_id);


--
-- Name: property_property_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX property_property_unique ON public.property_property USING btree (property_id_a, property_id_b);


--
-- Name: property_version_property_number_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX property_version_property_number_unique ON public.property_version USING btree (property_id, version_number);


--
-- Name: stamp_member_principal_object_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stamp_member_principal_object_idx ON public.stamp_member USING btree (principal_object_id);


--
-- Name: stamp_member_stamp_principal_object_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX stamp_member_stamp_principal_object_unique ON public.stamp_member USING btree (stamp_id, principal_object_id);


--
-- Name: user_requests_email_pending_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX user_requests_email_pending_unique ON public.user_requests USING btree (email) WHERE (status = 'pending'::public.user_request_status);


--
-- Name: address address_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER address_touch_updated_at BEFORE UPDATE ON public.address FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: groups groups_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER groups_touch_updated_at BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: judicial_person judicial_person_check_cui_unique; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER judicial_person_check_cui_unique BEFORE INSERT OR UPDATE ON public.judicial_person FOR EACH ROW EXECUTE FUNCTION public.judicial_person_check_cui_unique();


--
-- Name: judicial_person judicial_person_lock_cui; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER judicial_person_lock_cui BEFORE UPDATE ON public.judicial_person FOR EACH ROW EXECUTE FUNCTION public.judicial_person_lock_cui();


--
-- Name: lookup_citizenship lookup_citizenship_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER lookup_citizenship_touch_updated_at BEFORE UPDATE ON public.lookup_citizenship FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: lookup_document_type lookup_document_type_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER lookup_document_type_touch_updated_at BEFORE UPDATE ON public.lookup_document_type FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: lookup_institution lookup_institution_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER lookup_institution_touch_updated_at BEFORE UPDATE ON public.lookup_institution FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: lookup_person_type lookup_person_type_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER lookup_person_type_touch_updated_at BEFORE UPDATE ON public.lookup_person_type FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: lookup_property_type lookup_property_type_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER lookup_property_type_touch_updated_at BEFORE UPDATE ON public.lookup_property_type FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: lookup_tarla lookup_tarla_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER lookup_tarla_touch_updated_at BEFORE UPDATE ON public.lookup_tarla FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: lookup_use_category lookup_use_category_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER lookup_use_category_touch_updated_at BEFORE UPDATE ON public.lookup_use_category FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: natural_person natural_person_check_cnp_unique; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER natural_person_check_cnp_unique BEFORE INSERT OR UPDATE ON public.natural_person FOR EACH ROW EXECUTE FUNCTION public.natural_person_check_cnp_unique();


--
-- Name: natural_person natural_person_lock_cnp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER natural_person_lock_cnp BEFORE UPDATE ON public.natural_person FOR EACH ROW EXECUTE FUNCTION public.natural_person_lock_cnp();


--
-- Name: document paperwork_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER paperwork_touch_updated_at BEFORE UPDATE ON public.document FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: person person_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER person_touch_updated_at BEFORE UPDATE ON public.person FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: property_address property_address_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER property_address_touch_updated_at BEFORE UPDATE ON public.property_address FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: property_corner property_corner_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER property_corner_touch_updated_at BEFORE UPDATE ON public.property_corner FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: property property_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER property_touch_updated_at BEFORE UPDATE ON public.property FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: lookup_document_document_role touch_lookup_document_document_role_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER touch_lookup_document_document_role_updated_at BEFORE UPDATE ON public.lookup_document_document_role FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: lookup_property_property_role touch_lookup_property_property_role_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER touch_lookup_property_property_role_updated_at BEFORE UPDATE ON public.lookup_property_property_role FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: entity_metadata touch_updated_at_entity_metadata; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER touch_updated_at_entity_metadata BEFORE UPDATE ON public.entity_metadata FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: help_content touch_updated_at_help_content; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER touch_updated_at_help_content BEFORE UPDATE ON public.help_content FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: help_hint touch_updated_at_help_hint; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER touch_updated_at_help_hint BEFORE UPDATE ON public.help_hint FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: lookup_judicial_person_type touch_updated_at_lookup_judicial_person_type; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER touch_updated_at_lookup_judicial_person_type BEFORE UPDATE ON public.lookup_judicial_person_type FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: lookup_person_role touch_updated_at_lookup_person_role; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER touch_updated_at_lookup_person_role BEFORE UPDATE ON public.lookup_person_role FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: document_page touch_updated_at_paperwork_page; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER touch_updated_at_paperwork_page BEFORE UPDATE ON public.document_page FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: stamps touch_updated_at_stamps; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER touch_updated_at_stamps BEFORE UPDATE ON public.stamps FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: address address_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.address
    ADD CONSTRAINT address_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.person(id) ON DELETE CASCADE;


--
-- Name: calculation_run_output calculation_run_output_calculation_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calculation_run_output
    ADD CONSTRAINT calculation_run_output_calculation_run_id_fkey FOREIGN KEY (calculation_run_id) REFERENCES public.calculation_run(id) ON DELETE CASCADE;


--
-- Name: calculation_run_output calculation_run_output_principal_object_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calculation_run_output
    ADD CONSTRAINT calculation_run_output_principal_object_id_fkey FOREIGN KEY (principal_object_id) REFERENCES public.principal_object(id) ON DELETE CASCADE;


--
-- Name: calculation_run calculation_run_result_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calculation_run
    ADD CONSTRAINT calculation_run_result_group_id_fkey FOREIGN KEY (result_group_id) REFERENCES public.groups(id) ON DELETE SET NULL;


--
-- Name: document_document document_document_relationship_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_document
    ADD CONSTRAINT document_document_relationship_role_id_fkey FOREIGN KEY (relationship_role_id) REFERENCES public.lookup_document_document_role(id) ON DELETE SET NULL;


--
-- Name: document document_document_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT document_document_type_id_fkey FOREIGN KEY (document_type_id) REFERENCES public.lookup_document_type(id);


--
-- Name: document document_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT document_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.lookup_institution(id) ON DELETE SET NULL;


--
-- Name: document document_surveyor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT document_surveyor_id_fkey FOREIGN KEY (surveyor_id) REFERENCES public.person(id) ON DELETE SET NULL;


--
-- Name: document_version document_version_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_version
    ADD CONSTRAINT document_version_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.document(id) ON DELETE CASCADE;


--
-- Name: entity_cross_reference entity_cross_reference_source_principal_object_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_cross_reference
    ADD CONSTRAINT entity_cross_reference_source_principal_object_id_fkey FOREIGN KEY (source_principal_object_id) REFERENCES public.principal_object(id) ON DELETE CASCADE;


--
-- Name: entity_cross_reference entity_cross_reference_target_principal_object_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_cross_reference
    ADD CONSTRAINT entity_cross_reference_target_principal_object_id_fkey FOREIGN KEY (target_principal_object_id) REFERENCES public.principal_object(id) ON DELETE CASCADE;


--
-- Name: entity_metadata entity_metadata_principal_object_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_metadata
    ADD CONSTRAINT entity_metadata_principal_object_id_fkey FOREIGN KEY (principal_object_id) REFERENCES public.principal_object(id) ON DELETE CASCADE;


--
-- Name: entity_metadata_version entity_metadata_version_entity_metadata_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_metadata_version
    ADD CONSTRAINT entity_metadata_version_entity_metadata_id_fkey FOREIGN KEY (entity_metadata_id) REFERENCES public.entity_metadata(id) ON DELETE CASCADE;


--
-- Name: entity_provenance_log entity_provenance_log_entity_metadata_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_provenance_log
    ADD CONSTRAINT entity_provenance_log_entity_metadata_id_fkey FOREIGN KEY (entity_metadata_id) REFERENCES public.entity_metadata(id) ON DELETE CASCADE;


--
-- Name: entity_tag entity_tag_principal_object_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_tag
    ADD CONSTRAINT entity_tag_principal_object_id_fkey FOREIGN KEY (principal_object_id) REFERENCES public.principal_object(id) ON DELETE CASCADE;


--
-- Name: group_member group_member_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_member
    ADD CONSTRAINT group_member_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: group_member group_member_principal_object_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_member
    ADD CONSTRAINT group_member_principal_object_id_fkey FOREIGN KEY (principal_object_id) REFERENCES public.principal_object(id) ON DELETE CASCADE;


--
-- Name: judicial_person judicial_person_contact_person_1_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.judicial_person
    ADD CONSTRAINT judicial_person_contact_person_1_id_fkey FOREIGN KEY (contact_person_1_id) REFERENCES public.person(id) ON DELETE SET NULL;


--
-- Name: judicial_person judicial_person_contact_person_2_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.judicial_person
    ADD CONSTRAINT judicial_person_contact_person_2_id_fkey FOREIGN KEY (contact_person_2_id) REFERENCES public.person(id) ON DELETE SET NULL;


--
-- Name: judicial_person judicial_person_judicial_person_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.judicial_person
    ADD CONSTRAINT judicial_person_judicial_person_type_id_fkey FOREIGN KEY (judicial_person_type_id) REFERENCES public.lookup_judicial_person_type(id) ON DELETE SET NULL;


--
-- Name: judicial_person judicial_person_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.judicial_person
    ADD CONSTRAINT judicial_person_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.person(id) ON DELETE CASCADE;


--
-- Name: lookup_doc_type_person_role lookup_doc_type_person_role_document_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lookup_doc_type_person_role
    ADD CONSTRAINT lookup_doc_type_person_role_document_type_id_fkey FOREIGN KEY (document_type_id) REFERENCES public.lookup_document_type(id) ON DELETE CASCADE;


--
-- Name: lookup_doc_type_person_role lookup_doc_type_person_role_person_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lookup_doc_type_person_role
    ADD CONSTRAINT lookup_doc_type_person_role_person_role_id_fkey FOREIGN KEY (person_role_id) REFERENCES public.lookup_person_role(id) ON DELETE CASCADE;


--
-- Name: lookup_person_person_role lookup_person_person_role_person_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lookup_person_person_role
    ADD CONSTRAINT lookup_person_person_role_person_role_id_fkey FOREIGN KEY (person_role_id) REFERENCES public.lookup_person_role(id) ON DELETE CASCADE;


--
-- Name: lookup_property_person_role lookup_property_person_role_person_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lookup_property_person_role
    ADD CONSTRAINT lookup_property_person_role_person_role_id_fkey FOREIGN KEY (person_role_id) REFERENCES public.lookup_person_role(id) ON DELETE CASCADE;


--
-- Name: natural_person natural_person_citizenship_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.natural_person
    ADD CONSTRAINT natural_person_citizenship_id_fkey FOREIGN KEY (citizenship_id) REFERENCES public.lookup_citizenship(id) ON DELETE SET NULL;


--
-- Name: natural_person natural_person_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.natural_person
    ADD CONSTRAINT natural_person_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.person(id) ON DELETE CASCADE;


--
-- Name: natural_person natural_person_physical_person_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.natural_person
    ADD CONSTRAINT natural_person_physical_person_type_id_fkey FOREIGN KEY (physical_person_type_id) REFERENCES public.lookup_person_type(id) ON DELETE SET NULL;


--
-- Name: document_page paperwork_page_paperwork_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_page
    ADD CONSTRAINT paperwork_page_paperwork_id_fkey FOREIGN KEY (document_id) REFERENCES public.document(id) ON DELETE CASCADE;


--
-- Name: document_document paperwork_paperwork_paperwork_id_a_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_document
    ADD CONSTRAINT paperwork_paperwork_paperwork_id_a_fkey FOREIGN KEY (document_id_a) REFERENCES public.document(id) ON DELETE CASCADE;


--
-- Name: document_document paperwork_paperwork_paperwork_id_b_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_document
    ADD CONSTRAINT paperwork_paperwork_paperwork_id_b_fkey FOREIGN KEY (document_id_b) REFERENCES public.document(id) ON DELETE CASCADE;


--
-- Name: document paperwork_principal_object_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT paperwork_principal_object_id_fkey FOREIGN KEY (principal_object_id) REFERENCES public.principal_object(id);


--
-- Name: person_document person_paperwork_paperwork_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_document
    ADD CONSTRAINT person_paperwork_paperwork_id_fkey FOREIGN KEY (document_id) REFERENCES public.document(id) ON DELETE CASCADE;


--
-- Name: person_document person_paperwork_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_document
    ADD CONSTRAINT person_paperwork_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.person(id) ON DELETE CASCADE;


--
-- Name: person_document person_paperwork_person_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_document
    ADD CONSTRAINT person_paperwork_person_role_id_fkey FOREIGN KEY (person_role_id) REFERENCES public.lookup_person_role(id) ON DELETE SET NULL;


--
-- Name: person_person person_person_person_id_a_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_person
    ADD CONSTRAINT person_person_person_id_a_fkey FOREIGN KEY (person_id_a) REFERENCES public.person(id) ON DELETE CASCADE;


--
-- Name: person_person person_person_person_id_b_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_person
    ADD CONSTRAINT person_person_person_id_b_fkey FOREIGN KEY (person_id_b) REFERENCES public.person(id) ON DELETE CASCADE;


--
-- Name: person_person person_person_relationship_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_person
    ADD CONSTRAINT person_person_relationship_role_id_fkey FOREIGN KEY (relationship_role_id) REFERENCES public.lookup_person_role(id) ON DELETE SET NULL;


--
-- Name: person person_principal_object_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person
    ADD CONSTRAINT person_principal_object_id_fkey FOREIGN KEY (principal_object_id) REFERENCES public.principal_object(id);


--
-- Name: person_version person_version_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_version
    ADD CONSTRAINT person_version_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.person(id) ON DELETE CASCADE;


--
-- Name: property_address property_address_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_address
    ADD CONSTRAINT property_address_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.property(id) ON DELETE CASCADE;


--
-- Name: property_corner property_corner_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_corner
    ADD CONSTRAINT property_corner_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.property(id) ON DELETE CASCADE;


--
-- Name: property_corner_source property_corner_source_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_corner_source
    ADD CONSTRAINT property_corner_source_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.document(id) ON DELETE CASCADE;


--
-- Name: property_corner_source property_corner_source_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_corner_source
    ADD CONSTRAINT property_corner_source_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.property(id) ON DELETE CASCADE;


--
-- Name: property_document property_paperwork_paperwork_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_document
    ADD CONSTRAINT property_paperwork_paperwork_id_fkey FOREIGN KEY (document_id) REFERENCES public.document(id) ON DELETE CASCADE;


--
-- Name: property_document property_paperwork_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_document
    ADD CONSTRAINT property_paperwork_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.property(id) ON DELETE CASCADE;


--
-- Name: property_person property_person_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_person
    ADD CONSTRAINT property_person_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.person(id) ON DELETE CASCADE;


--
-- Name: property_person property_person_person_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_person
    ADD CONSTRAINT property_person_person_role_id_fkey FOREIGN KEY (person_role_id) REFERENCES public.lookup_person_role(id) ON DELETE SET NULL;


--
-- Name: property_person property_person_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_person
    ADD CONSTRAINT property_person_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.property(id) ON DELETE CASCADE;


--
-- Name: property property_principal_object_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property
    ADD CONSTRAINT property_principal_object_id_fkey FOREIGN KEY (principal_object_id) REFERENCES public.principal_object(id);


--
-- Name: property_property property_property_property_id_a_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_property
    ADD CONSTRAINT property_property_property_id_a_fkey FOREIGN KEY (property_id_a) REFERENCES public.property(id) ON DELETE CASCADE;


--
-- Name: property_property property_property_property_id_b_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_property
    ADD CONSTRAINT property_property_property_id_b_fkey FOREIGN KEY (property_id_b) REFERENCES public.property(id) ON DELETE CASCADE;


--
-- Name: property_property property_property_relationship_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_property
    ADD CONSTRAINT property_property_relationship_role_id_fkey FOREIGN KEY (relationship_role_id) REFERENCES public.lookup_property_property_role(id) ON DELETE SET NULL;


--
-- Name: property property_property_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property
    ADD CONSTRAINT property_property_type_id_fkey FOREIGN KEY (property_type_id) REFERENCES public.lookup_property_type(id) ON DELETE SET NULL;


--
-- Name: property property_use_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property
    ADD CONSTRAINT property_use_category_id_fkey FOREIGN KEY (use_category_id) REFERENCES public.lookup_use_category(id) ON DELETE SET NULL;


--
-- Name: property_version property_version_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_version
    ADD CONSTRAINT property_version_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.property(id) ON DELETE CASCADE;


--
-- Name: stamp_member stamp_member_principal_object_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stamp_member
    ADD CONSTRAINT stamp_member_principal_object_id_fkey FOREIGN KEY (principal_object_id) REFERENCES public.principal_object(id) ON DELETE CASCADE;


--
-- Name: stamp_member stamp_member_stamp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stamp_member
    ADD CONSTRAINT stamp_member_stamp_id_fkey FOREIGN KEY (stamp_id) REFERENCES public.stamps(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

