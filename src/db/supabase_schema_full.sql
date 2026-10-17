-- ============================================================
-- ga40prj -- Full Schema Script (Supabase)
--
-- GENERATED FILE -- DO NOT EDIT BY HAND.
-- Regenerate with:  .\scripts\Export-SupabaseSchema.ps1
--
-- Generated : 2026-10-17 11:26
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

-- Every extension the schema below depends on. pg_dump does not emit these
-- (it dumps objects, not the extensions their operator classes come from), so
-- they are prepended here. pg_trgm was missing until Slice #31.01, which meant
-- this file died 1748 lines in with operator class "public.gin_trgm_ops" does
-- not exist for access method "gin" -- on a file whose whole job is to build a
-- database from scratch. Nothing had ever applied it to an empty database.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
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

CREATE SCHEMA IF NOT EXISTS public;


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
-- Name: ai_paid_read; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_paid_read (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    route text NOT NULL,
    model text NOT NULL,
    success boolean NOT NULL,
    at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: app_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supabase_uid text,
    email text NOT NULL,
    username text NOT NULL,
    role public.app_user_role DEFAULT 'superuser'::public.app_user_role NOT NULL,
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
-- Name: cost_record; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cost_record (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    amount numeric(12,2) NOT NULL,
    currency text NOT NULL,
    cad_rate numeric(12,6) NOT NULL,
    source text NOT NULL,
    note text,
    entered_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cost_record_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT cost_record_currency_check CHECK ((currency ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT cost_record_period_check CHECK ((period_end >= period_start)),
    CONSTRAINT cost_record_provider_check CHECK ((provider ~ '^[a-z][a-z-]{1,39}$'::text)),
    CONSTRAINT cost_record_rate_check CHECK ((cad_rate > (0)::numeric)),
    CONSTRAINT cost_record_source_check CHECK ((source = ANY (ARRAY['live'::text, 'counted'::text, 'entered'::text])))
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
    document_type_id uuid NOT NULL,
    institution_id uuid,
    subject text,
    date_valid_until date,
    surveyor_id uuid,
    updated_by text,
    ai_interpreted_at timestamp with time zone,
    custom_fields jsonb,
    import_title text,
    referenced_instruments jsonb
);


--
-- Name: COLUMN document.import_title; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document.import_title IS 'The title the import derived from the folder entry (titleForEntry). The Pre-existing stage keys on import_title ?? title, so the AI rewriting document.title can no longer make a re-imported folder look new. Null for anything the import did not create. Slice #32.06.';


--
-- Name: COLUMN document.referenced_instruments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document.referenced_instruments IS 'The instruments THIS document''s pages cite, as the AI read returned them: an array of { typeKey, nrDocument, dateDocument, issuer, purpose, rawText, status }. A READING, never a fact - nothing here is an association and nothing here may be acted on until a person confirms it in the reference-linker dialog, which is what POST /api/documents/[id]/instrument-references writes back with each entry''s status. Stored rather than re-read because reopening that dialog otherwise costs a billed vision call over every page of the document. NULL means this document has never been read for references (every document imported before Slice #36.03); an empty array means it was read and cited nothing - the two are different and both are ordinary. NOT VERSIONED: DocumentSnapshot omits it, documentUpdateSchema does not accept it, and updateDocument never writes it, exactly as for ai_interpreted_at and import_title. The shape is declared and validated in src/lib/documents/referenced-instruments.ts rather than by a CHECK here, because a constraint that rejected one malformed entry would throw away the whole paid read.';


--
-- Name: document_document; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_document (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id_a uuid NOT NULL,
    document_id_b uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    relationship_role_id uuid,
    role_reads_a_to_b boolean DEFAULT true NOT NULL,
    CONSTRAINT document_document_order CHECK ((document_id_a < document_id_b))
);


--
-- Name: COLUMN document_document.role_reads_a_to_b; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_document.role_reads_a_to_b IS 'Which way relationship_role_id reads. TRUE (the default) means the role reads A to B - "document_id_a <role> document_id_b". FALSE means it reads B to A. WHY THIS EXISTS: the pair order in this table is canonicalised by UUID (CHECK document_document_order, document_id_a < document_id_b) purely so one pair cannot be stored twice - it carries NO meaning, and src/lib/documents/queries.ts produces it with a literal .sort(). Every role migration_055 seeded is directional in its wording, so on a pair whose uuids sort the other way "Anexa la" read backwards and nothing could tell. Slice #36.03 seeds "Titlu anterior al", where reading backwards in an archive that exists to prove a chain of title is a wrong answer presented as a fact. Rows written from #36.03 on set this deliberately; rows that predate it took the default, and migration_086 prints how many. The alternative - renaming the columns to from/to and dropping the CHECK - is tidier and was refused because the backfill for existing rows would be a coin toss recorded as truth.';


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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    rotation smallint DEFAULT 0 NOT NULL,
    CONSTRAINT document_page_rotation_check CHECK ((rotation = ANY (ARRAY[0, 90, 180, 270])))
);


--
-- Name: document_tarla; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_tarla (
    document_id uuid NOT NULL,
    tarla_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE document_tarla; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.document_tarla IS 'Slice #39.69: a plan parcelar (or any document) linked to the tarla it draws.';


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
    CONSTRAINT chk_em_provenance CHECK ((provenance = ANY (ARRAY['MANUAL'::text, 'IMAGE'::text, 'DOC_FILE'::text, 'COORDINATE_FILE'::text, 'ALGORITHM'::text, 'AI_INTERPRETED'::text, 'EXTERNAL_FEED'::text, 'RELATIVE_ID_CARD'::text]))),
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
-- Name: interaction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interaction (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    channel text NOT NULL,
    direction text DEFAULT 'OUTBOUND'::text NOT NULL,
    occurred_at timestamp with time zone NOT NULL,
    person_id uuid NOT NULL,
    subject text NOT NULL,
    description text,
    internal_note text,
    status text DEFAULT 'LOGGED'::text NOT NULL,
    follow_up_on date,
    related_property_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text,
    CONSTRAINT interaction_channel_check CHECK ((channel = ANY (ARRAY['EMAIL'::text, 'WHATSAPP'::text, 'SMS'::text, 'PHONE'::text, 'MEETING'::text, 'PAPER_MAIL'::text]))),
    CONSTRAINT interaction_direction_check CHECK ((direction = ANY (ARRAY['INBOUND'::text, 'OUTBOUND'::text]))),
    CONSTRAINT interaction_status_check CHECK ((status = ANY (ARRAY['LOGGED'::text, 'NEEDS_REPLY'::text, 'SENT'::text, 'COMPLETED'::text, 'SCHEDULED'::text]))),
    CONSTRAINT interaction_subject_check CHECK (((char_length(btrim(subject)) >= 1) AND (char_length(btrim(subject)) <= 120)))
);


--
-- Name: interaction_document; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interaction_document (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    interaction_id uuid NOT NULL,
    document_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: interaction_tag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interaction_tag (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    interaction_id uuid NOT NULL,
    tag text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT interaction_tag_tag_check CHECK (((char_length(btrim(tag)) >= 1) AND (char_length(btrim(tag)) <= 60)))
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
    judicial_person_type_id uuid,
    phone text,
    email text
);


--
-- Name: lookup_citizenship; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lookup_citizenship (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lookup_doc_type_person_role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lookup_doc_type_person_role (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_type_id uuid NOT NULL,
    person_role_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    holds_share boolean DEFAULT false NOT NULL
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
    template_fields jsonb,
    origin text DEFAULT 'MANUAL'::text NOT NULL,
    short_name text,
    CONSTRAINT chk_ldt_origin CHECK ((origin = ANY (ARRAY['MANUAL'::text, 'IMPORT'::text])))
);


--
-- Name: COLUMN lookup_document_type.origin; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.lookup_document_type.origin IS 'How this type came to exist: MANUAL = added in Reference Data, IMPORT = created by ensureDocType during an import scan. Write-once at creation; the value-lists PUT strips it. Everything else about a type''s status is derived - see src/lib/documents/status.ts.';


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
    origin text DEFAULT 'MANUAL'::text NOT NULL,
    CONSTRAINT chk_li_origin CHECK ((origin = ANY (ARRAY['MANUAL'::text, 'IMPORT'::text])))
);


--
-- Name: COLUMN lookup_institution.origin; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.lookup_institution.origin IS 'How this institution came to exist: MANUAL = added in Reference Data (every row today), IMPORT = created by a machine reading. Nothing writes IMPORT yet - src/lib/import/id-card.ts still refuses to mint an institution from a model reading, and #34.02 keeps that refusal - so the column exists to make the status word answerable on both lists in one modal.';


--
-- Name: lookup_judicial_person_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lookup_judicial_person_type (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lookup_person_relationship; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lookup_person_relationship (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE lookup_person_relationship; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.lookup_person_relationship IS 'Slice #39.70: „Relația cu firma" - why a natural person is in the archive. A person may hold several.';


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
    valid_for_property boolean DEFAULT false NOT NULL,
    valid_for_person boolean DEFAULT false NOT NULL,
    converse_name text,
    converse_name_male text,
    converse_name_female text,
    parent_kind text,
    kinship text,
    CONSTRAINT chk_lookup_person_role_kinship CHECK (((kinship IS NULL) OR (kinship = ANY (ARRAY['PARENT'::text, 'CHILD'::text, 'SPOUSE'::text, 'SIBLING'::text, 'OTHER'::text])))),
    CONSTRAINT chk_lookup_person_role_kinship_parent CHECK (((parent_kind IS NULL) OR (kinship = 'PARENT'::text))),
    CONSTRAINT chk_lookup_person_role_parent_kind CHECK (((parent_kind IS NULL) OR (parent_kind = ANY (ARRAY['FATHER'::text, 'MOTHER'::text]))))
);


--
-- Name: COLUMN lookup_person_role.valid_for_property; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.lookup_person_role.valid_for_property IS 'TRUE when this role may tag a Proprietate ↔ Persoană association (Slice #34.04, migration_079). Replaces the table lookup_property_person_role, which held one row per ticked role - a UNIQUE NOT NULL FK to this table''s primary key, i.e. exactly this bit, at the cost of an API route family, a modal, two React Query cache-key names for one endpoint, and a synthetic id. Edited from the „Roluri Persoană" row in Reference Data. Defaults to false: a new role is usable nowhere until someone says otherwise, which is what the empty table meant.';


--
-- Name: COLUMN lookup_person_role.valid_for_person; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.lookup_person_role.valid_for_person IS 'TRUE when this role may tag a Persoană ↔ Persoană association (Slice #34.04, migration_079). Replaces the table lookup_person_person_role, which was identical in every column to lookup_property_person_role and is collapsed for the same reason. Note there is deliberately NO valid_for_document column: lookup_doc_type_person_role is unique over (document_type_id, person_role_id), so a role can be valid on one document type and not another, and a boolean on the role would destroy that distinction. See migration_079''s header.';


--
-- Name: COLUMN lookup_person_role.converse_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.lookup_person_role.converse_name IS 'What the OTHER end of this role is called when a person-to-person relationship is read from the holder''s side (Slice #37.28). Used when the person shown has no gender (a company, or gender not set) and whenever converse_name_male / converse_name_female is NULL. A role that reads the same both ways names itself ("Coproprietar"). NULL: no converse - the screen says in a sentence that the person viewed holds the role.';


--
-- Name: COLUMN lookup_person_role.converse_name_male; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.lookup_person_role.converse_name_male IS 'The converse when the person shown is MALE ("Fiu" for "Părinte"). NULL falls back to converse_name.';


--
-- Name: COLUMN lookup_person_role.converse_name_female; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.lookup_person_role.converse_name_female IS 'The converse when the person shown is FEMALE ("Fiică" for "Părinte"). NULL falls back to converse_name.';


--
-- Name: COLUMN lookup_person_role.parent_kind; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.lookup_person_role.parent_kind IS 'FATHER or MOTHER on the one role each that a person created from an identity card''s parents is linked by (Slice #38.29, „Tată" and „Mamă"); NULL on every other role. The code finds those two roles by this column, never by their names, which are Adrian''s to rename. At most one row each (uq_lookup_person_role_parent_kind).';


--
-- Name: COLUMN lookup_person_role.kinship; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.lookup_person_role.kinship IS 'The family tie the holder of the role has towards the other person of a person_person pair, read the way the role is (role_reads_a_to_b): PARENT, CHILD, SPOUSE, SIBLING, OTHER (a relative placed in no generation), or NULL for no family tie (Slice #39.10). The inheritance tree reads generations from this column, never from a role''s name. A role with a parent_kind is always PARENT (chk_lookup_person_role_kinship_parent).';


--
-- Name: lookup_person_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lookup_person_type (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
    show_street_view boolean DEFAULT false NOT NULL
);


--
-- Name: COLUMN lookup_property_type.key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.lookup_property_type.key IS 'DEAD SINCE Slice #34.03 (D-23): nothing writes it and nothing reads it. It was added by migration_039 as the slug src/lib/properties/type-config.ts switched on for per-type field visibility; that module no longer exists - migration_041 replaced it with the show_tarla_parcela / show_address / show_street_view booleans on this table - and #34.03 deleted the generator that was still filling the column in on every insert. So rows created before that slice hold a slug, rows created after hold NULL, and NEITHER is read. Do not start reading it without repopulating it. NOT the same thing as lookup_document_type.key, which is the immutable slug all document matching and seeding run on and which scripts/verify-rebuild.ts still requires. The column is left in place rather than dropped only because dropping it would reach into four more hand-maintained files for no gain; see migration_078''s header.';


--
-- Name: lookup_property_type_use; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lookup_property_type_use (
    property_type_id uuid NOT NULL,
    use_category_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE lookup_property_type_use; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.lookup_property_type_use IS 'Slice #39.66: the use categories allowed for a property type. A type with no rows allows every use.';


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
    origin text DEFAULT 'MANUAL'::text NOT NULL,
    locality text,
    county text,
    notes text,
    CONSTRAINT chk_lt_origin CHECK ((origin = ANY (ARRAY['MANUAL'::text, 'IMPORT'::text])))
);


--
-- Name: COLUMN lookup_tarla.origin; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.lookup_tarla.origin IS 'How this code came to exist: MANUAL = typed into the Indicative Tarla list by a person, IMPORT = auto-seeded by createPropertyIn from a tarla value an import parsed out of a folder name. The origin is decided at that write site and is never read from a request body. Write-once, and guarded twice: stripLookupOrigin() removes origin from the payload of every value-lists PUT in updateValue (src/lib/admin/value-lists/queries.ts), for all eleven lists including this one, and from every POST but document-types in createValue - and this list''s route schema (LIST_UPDATE_SCHEMAS["tarla"], a Zod object that declares no origin field) drops an unknown origin before the query layer sees it. The document-types POST schema is the one exception anywhere, and it carries origin as a create-only field on purpose. Superseded the comment migration_077 installed, which said no explicit strip existed for this table and that Zod was the only guard; that stopped being true when the strip moved above updateValue''s switch. See migration_077 for the full note on what MANUAL and IMPORT mean, and migration_082 for why this text had to arrive as a second statement rather than an edit.';


--
-- Name: COLUMN lookup_tarla.locality; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.lookup_tarla.locality IS 'Slice #39.67: the locality the tarla belongs to - tarla numbers restart in every locality. Free text, as on property_address; compared folded.';


--
-- Name: lookup_use_category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lookup_use_category (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
    is_deceased boolean DEFAULT false NOT NULL,
    date_of_death date,
    CONSTRAINT natural_person_death_after_birth CHECK (((date_of_death IS NULL) OR (date_of_birth IS NULL) OR (date_of_death >= date_of_birth))),
    CONSTRAINT natural_person_death_needs_deceased CHECK (((date_of_death IS NULL) OR is_deceased)),
    CONSTRAINT natural_person_has_name CHECK (((first_name IS NOT NULL) OR (last_name IS NOT NULL)))
);


--
-- Name: natural_person_relationship; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.natural_person_relationship (
    natural_person_id uuid NOT NULL,
    relationship_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE natural_person_relationship; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.natural_person_relationship IS 'Slice #39.70: the relationships („Relația cu firma") a natural person holds - several per person.';


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
    updated_by text
);


--
-- Name: person_document; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.person_document (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    person_id uuid NOT NULL,
    document_id uuid NOT NULL,
    person_role_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cota_parte numeric(7,4),
    cota_suprafata_mp numeric(12,2),
    cota_mod text,
    CONSTRAINT person_document_cota_mod_check CHECK (((cota_mod IS NULL) OR (cota_mod = ANY (ARRAY['NUME_PROPRIU'::text, 'DEVALMASIE'::text, 'INDIVIZIUNE'::text, 'PRIN_MANDATAR'::text]))))
);


--
-- Name: COLUMN person_document.cota_parte; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.person_document.cota_parte IS 'The undivided share this person holds on this document IN THIS ROLE, as a percentage. numeric(7,4) - four decimals because the archive holds 63,6400 / 9,0900 / 27,2700 / 10,4100, which are thirds and elevenths written out, and two decimals round them into a total that no longer reaches 100. NULL is ordinary and is not a defect: a notary has no share, a mandatar usually has none, and a 2006 deed may state none at all. NO range CHECK, deliberately - see migration_084. The per-role total that warns on a deed which does not close is code, in src/lib/documents/cota-parte-total.ts, and it warns rather than blocks.';


--
-- Name: COLUMN person_document.cota_suprafata_mp; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.person_document.cota_suprafata_mp IS 'The equivalent area in square metres where the deed states one, matching property.surface_area_mp''s numeric(12,2) on purpose. Not redundant with cota_parte: the deeds state both („63,64% (3.182 mp)", „10,41% = 114,86 mp din 1.103,38 mp") and it is the mp figure the deed was signed on - recomputing it from a rounded percentage gives a different number. NULL when the deed states only a percentage.';


--
-- Name: COLUMN person_document.cota_mod; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.person_document.cota_mod IS 'How the share is held: NUME_PROPRIU (in nume propriu), DEVALMASIE (comunitate devalmasa - spouses, no determinate shares between them), INDIVIZIUNE (coproprietate pe cote-parti), PRIN_MANDATAR (held through a mandatar). ASCII keys, not display text; the Romanian with diacritics is in messages/ro-RO.json under document.persons.cotaMod.*. DEVALMASIE is the reason this column exists: in 5-CVC 2-2-5000 CRH 2016 the sellers are two married couples holding 60% and 40% - four people, two shares - and splitting 60 into 30/30 is legally wrong while writing 60 on both rows makes the sellers total 200%. The counting rule (a devalmasie block counts ONCE) is in src/lib/documents/cota-parte-total.ts, not restated as a constraint.';


--
-- Name: person_person; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.person_person (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    person_id_a uuid NOT NULL,
    person_id_b uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    relationship_role_id uuid,
    role_reads_a_to_b boolean DEFAULT true NOT NULL,
    CONSTRAINT person_person_order CHECK ((person_id_a < person_id_b))
);


--
-- Name: COLUMN person_person.role_reads_a_to_b; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.person_person.role_reads_a_to_b IS 'Which way relationship_role_id reads. TRUE (the default) means person_id_a holds the role towards person_id_b - "A <role> B", e.g. A is "Fiu" of B. FALSE means B holds it towards A. The pair order is canonicalised by UUID (CHECK person_person_order) only so one pair cannot be stored twice, and carries no meaning. Rows written from Slice #37.28 on set it from the association screen, where the role is the ticked person''s; rows that predate it took the default, and migration_088 printed them. Same column and reasoning as document_document (migration_086) and property_property (migration_087). The other end''s wording is lookup_person_role.converse_name*.';


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
    parcela text,
    cadastral_number text,
    carte_funciara text,
    surface_area_mp numeric(12,2),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    property_type_id uuid,
    use_category_id uuid,
    calculated_area_mp numeric(12,2),
    updated_by text,
    corner_order_self_intersects boolean DEFAULT false NOT NULL,
    tarla_id uuid
);


--
-- Name: COLUMN property.corner_order_self_intersects; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.property.corner_order_self_intersects IS 'True when the stored corner ORDER traces a self-intersecting (bow-tie) ring, which makes calculated_area_mp meaningless. Server-computed, never user-editable: it is written by polygonSelfIntersects (src/lib/properties/area.ts) from the two corner-write choke points in src/lib/properties/queries.ts once the rest of Slice #32.14 lands - as of this migration nothing writes it and every row is false. There is no backfill; see the migration file header. Slice #32.14.';


--
-- Name: COLUMN property.tarla_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.property.tarla_id IS 'Nr. tarla / sola, as a REFERENCE to the Indicative Tarla list rather than as text (Slice #34.03, migration_078). Replaced property.tarla_sola, which held the indicativ as free text: renaming a code in Reference Data reached no property at all, the dependents count was a string match, and the dropdown had to synthesise an option for any value the list did not hold. Nullable and ON DELETE SET NULL, exactly like property_type_id and use_category_id - a property may legitimately not know its tarla yet, and removing a code from Reference Data clears the tag rather than blocking the delete. Note that property_version.snapshot rows written BEFORE this migration still carry the old tarlaSola TEXT, deliberately: a version is a record of what was true when it was saved.';


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
    role_reads_a_to_b boolean DEFAULT true NOT NULL,
    CONSTRAINT property_property_order CHECK ((property_id_a < property_id_b))
);


--
-- Name: COLUMN property_property.role_reads_a_to_b; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.property_property.role_reads_a_to_b IS 'Which way relationship_role_id reads. TRUE (the default) means the role reads A to B - "property_id_a <role> property_id_b". FALSE means it reads B to A. The pair order is canonicalised by UUID (CHECK property_property_order) only so one pair cannot be stored twice, and carries no meaning; three seeded roles ("Inclus în", "Subdiviziune a", "Acces prin") are directional, so without this a pair whose uuids sorted the other way read backwards (FU-220, Slice #37.10). Rows written from #37.10 on set it from the screen the link was made on; rows that predate it took the default, and migration_087 prints how many. Same column and reasoning as document_document.role_reads_a_to_b (migration_086).';


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
-- Name: skill_attempt; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.skill_attempt (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id text NOT NULL,
    skill_key text NOT NULL,
    quiz_variant text NOT NULL,
    items jsonb NOT NULL,
    question_count integer NOT NULL,
    correct_count integer NOT NULL,
    passed boolean NOT NULL,
    started_at timestamp with time zone NOT NULL,
    finished_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT skill_attempt_count_check CHECK (((question_count > 0) AND (correct_count >= 0) AND (correct_count <= question_count))),
    CONSTRAINT skill_attempt_items_check CHECK (((jsonb_typeof(items) = 'array'::text) AND (jsonb_array_length(items) = question_count))),
    CONSTRAINT skill_attempt_passed_check CHECK ((passed = ((correct_count * 5) >= (question_count * 4)))),
    CONSTRAINT skill_attempt_skill_check CHECK ((skill_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text)),
    CONSTRAINT skill_attempt_time_check CHECK ((finished_at >= started_at)),
    CONSTRAINT skill_attempt_user_check CHECK (((user_id <> ''::text) AND (user_id <> 'anonymous'::text))),
    CONSTRAINT skill_attempt_variant_check CHECK ((quiz_variant ~ '^[a-z0-9-]{1,40}$'::text))
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tarla_corner; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tarla_corner (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tarla_id uuid NOT NULL,
    sequence_no integer NOT NULL,
    lat double precision NOT NULL,
    lon double precision NOT NULL,
    original_index integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE tarla_corner; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tarla_corner IS 'Slice #39.67: the optional outline of a tarla, WGS84 decimal degrees, 1-based order - property_corner''s shape.';


--
-- Name: tarla_parcel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tarla_parcel (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tarla_id uuid NOT NULL,
    parcela text NOT NULL,
    area_sqm numeric(14,2),
    use_category_id uuid,
    use_printed text,
    source_document_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tarla_parcel_area_positive CHECK (((area_sqm IS NULL) OR (area_sqm > (0)::numeric))),
    CONSTRAINT tarla_parcel_parcela_not_blank CHECK ((btrim(parcela) <> ''::text))
);


--
-- Name: TABLE tarla_parcel; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tarla_parcel IS 'Slice #39.69: the parcels a plan parcelar draws on a tarla - number as printed, area in m2, use. No owners.';


--
-- Name: COLUMN tarla_parcel.use_printed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tarla_parcel.use_printed IS 'Slice #39.69: the use as the plan prints it, kept when it matches no lookup_use_category.';


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
-- Name: user_tile_default; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_tile_default (
    user_id text NOT NULL,
    kind text NOT NULL,
    tiles jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_tile_default_kind_check CHECK ((kind = ANY (ARRAY['natural-person'::text, 'judicial-person'::text, 'property'::text, 'document'::text])))
);


--
-- Name: address address_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.address
    ADD CONSTRAINT address_pkey PRIMARY KEY (id);


--
-- Name: ai_paid_read ai_paid_read_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_paid_read
    ADD CONSTRAINT ai_paid_read_pkey PRIMARY KEY (id);


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
-- Name: cost_record cost_record_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_record
    ADD CONSTRAINT cost_record_pkey PRIMARY KEY (id);


--
-- Name: document_page document_page_document_number_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_page
    ADD CONSTRAINT document_page_document_number_unique UNIQUE (document_id, page_number);


--
-- Name: document_tarla document_tarla_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_tarla
    ADD CONSTRAINT document_tarla_pkey PRIMARY KEY (document_id, tarla_id);


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
-- Name: interaction_document interaction_document_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interaction_document
    ADD CONSTRAINT interaction_document_pkey PRIMARY KEY (id);


--
-- Name: interaction_document interaction_document_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interaction_document
    ADD CONSTRAINT interaction_document_unique UNIQUE (interaction_id, document_id);


--
-- Name: interaction interaction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interaction
    ADD CONSTRAINT interaction_pkey PRIMARY KEY (id);


--
-- Name: interaction_tag interaction_tag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interaction_tag
    ADD CONSTRAINT interaction_tag_pkey PRIMARY KEY (id);


--
-- Name: interaction_tag interaction_tag_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interaction_tag
    ADD CONSTRAINT interaction_tag_unique UNIQUE (interaction_id, tag);


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
-- Name: lookup_person_relationship lookup_person_relationship_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lookup_person_relationship
    ADD CONSTRAINT lookup_person_relationship_pkey PRIMARY KEY (id);


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
-- Name: lookup_property_type_use lookup_property_type_use_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lookup_property_type_use
    ADD CONSTRAINT lookup_property_type_use_pkey PRIMARY KEY (property_type_id, use_category_id);


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
-- Name: natural_person_relationship natural_person_relationship_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.natural_person_relationship
    ADD CONSTRAINT natural_person_relationship_pkey PRIMARY KEY (natural_person_id, relationship_id);


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
-- Name: skill_attempt skill_attempt_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_attempt
    ADD CONSTRAINT skill_attempt_pkey PRIMARY KEY (id);


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
-- Name: tarla_corner tarla_corner_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tarla_corner
    ADD CONSTRAINT tarla_corner_pkey PRIMARY KEY (id);


--
-- Name: tarla_parcel tarla_parcel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tarla_parcel
    ADD CONSTRAINT tarla_parcel_pkey PRIMARY KEY (id);


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
-- Name: user_tile_default user_tile_default_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_tile_default
    ADD CONSTRAINT user_tile_default_pkey PRIMARY KEY (user_id, kind);


--
-- Name: address_person_kind_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX address_person_kind_unique ON public.address USING btree (person_id, kind);


--
-- Name: ai_paid_read_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_paid_read_at_idx ON public.ai_paid_read USING btree (at);


--
-- Name: calculation_run_output_po_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calculation_run_output_po_idx ON public.calculation_run_output USING btree (principal_object_id);


--
-- Name: calculation_run_output_run_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calculation_run_output_run_idx ON public.calculation_run_output USING btree (calculation_run_id);


--
-- Name: cost_record_provider_period_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cost_record_provider_period_idx ON public.cost_record USING btree (provider, period_start);


--
-- Name: document_document_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX document_document_unique ON public.document_document USING btree (document_id_a, document_id_b);


--
-- Name: document_tarla_tarla_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_tarla_tarla_idx ON public.document_tarla USING btree (tarla_id);


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
-- Name: interaction_document_document_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX interaction_document_document_idx ON public.interaction_document USING btree (document_id);


--
-- Name: interaction_occurred_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX interaction_occurred_at_idx ON public.interaction USING btree (occurred_at DESC);


--
-- Name: interaction_person_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX interaction_person_idx ON public.interaction USING btree (person_id);


--
-- Name: interaction_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX interaction_status_idx ON public.interaction USING btree (status);


--
-- Name: interaction_tag_tag_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX interaction_tag_tag_idx ON public.interaction_tag USING btree (tag);


--
-- Name: judicial_person_cui_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX judicial_person_cui_unique ON public.judicial_person USING btree (cui_number) WHERE (cui_number IS NOT NULL);


--
-- Name: lookup_document_type_name_normalised_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX lookup_document_type_name_normalised_unique ON public.lookup_document_type USING btree (regexp_replace(btrim(regexp_replace(regexp_replace(lower(NORMALIZE(COALESCE(name, ''::text), NFD)), (((('['::text || chr(768)) || '-'::text) || chr(879)) || ']'::text), ''::text, 'g'::text), '\s+'::text, ' '::text, 'g'::text)), '[^a-z0-9]'::text, ''::text, 'g'::text)) WHERE (regexp_replace(btrim(regexp_replace(regexp_replace(lower(NORMALIZE(COALESCE(name, ''::text), NFD)), (((('['::text || chr(768)) || '-'::text) || chr(879)) || ']'::text), ''::text, 'g'::text), '\s+'::text, ' '::text, 'g'::text)), '[^a-z0-9]'::text, ''::text, 'g'::text) <> ''::text);


--
-- Name: INDEX lookup_document_type_name_normalised_unique; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.lookup_document_type_name_normalised_unique IS 'Two document types may not share one display name (Slice #34.09, migration_080). The expression is normaliseDocumentTypeName() from src/lib/documents/document-type-match.ts - NFD-decompose, strip the combining marks, lowercase, drop everything outside [a-z0-9] - written as the exact inline expansion of pg_temp.ga40_norm_name in scripts/decision-checks.sql, which is the fold the archive was measured under. PARTIAL, excluding the empty normalised form, because sameDocumentTypeName() refuses to call two empty forms equal: a name of "-" or of a single space normalises to nothing, and a total index would let the first such row take the empty slot and refuse every other one. The application-level refusal that produces a Romanian sentence instead of a 23505 is documentTypeNameTakenBy() in src/lib/documents/document-type-name-guard.ts; this index is what makes the rule true of a direct caller, a script, psql, and the race that a read-then-write refusal cannot close.';


--
-- Name: lookup_document_type_short_name_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX lookup_document_type_short_name_uq ON public.lookup_document_type USING btree (lower(btrim(short_name))) WHERE ((short_name IS NOT NULL) AND (btrim(short_name) <> ''::text));


--
-- Name: lookup_tarla_locality_indicativ_folded_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX lookup_tarla_locality_indicativ_folded_unique ON public.lookup_tarla USING btree (btrim(regexp_replace(regexp_replace(lower(NORMALIZE(COALESCE(locality, ''::text), NFD)), (((('['::text || chr(768)) || '-'::text) || chr(879)) || ']'::text), ''::text, 'g'::text), '\s+'::text, ' '::text, 'g'::text)), btrim(regexp_replace(regexp_replace(lower(NORMALIZE(COALESCE(indicativ, ''::text), NFD)), (((('['::text || chr(768)) || '-'::text) || chr(879)) || ']'::text), ''::text, 'g'::text), '\s+'::text, ' '::text, 'g'::text))) WHERE (btrim(regexp_replace(regexp_replace(lower(NORMALIZE(COALESCE(indicativ, ''::text), NFD)), (((('['::text || chr(768)) || '-'::text) || chr(879)) || ']'::text), ''::text, 'g'::text), '\s+'::text, ' '::text, 'g'::text)) <> ''::text);


--
-- Name: INDEX lookup_tarla_locality_indicativ_folded_unique; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.lookup_tarla_locality_indicativ_folded_unique IS 'Slice #39.67 (was migration_083''s code-only index): one tarla per folded locality and folded code.';


--
-- Name: natural_person_cnp_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX natural_person_cnp_unique ON public.natural_person USING btree (cnp) WHERE (cnp IS NOT NULL);


--
-- Name: natural_person_relationship_relationship_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX natural_person_relationship_relationship_idx ON public.natural_person_relationship USING btree (relationship_id);


--
-- Name: person_document_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX person_document_unique ON public.person_document USING btree (person_id, document_id, person_role_id) NULLS NOT DISTINCT;


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
-- Name: skill_attempt_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX skill_attempt_user_idx ON public.skill_attempt USING btree (user_id, skill_key, finished_at);


--
-- Name: stamp_member_principal_object_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stamp_member_principal_object_idx ON public.stamp_member USING btree (principal_object_id);


--
-- Name: stamp_member_stamp_principal_object_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX stamp_member_stamp_principal_object_unique ON public.stamp_member USING btree (stamp_id, principal_object_id);


--
-- Name: tarla_corner_tarla_seq_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tarla_corner_tarla_seq_unique ON public.tarla_corner USING btree (tarla_id, sequence_no);


--
-- Name: tarla_parcel_source_document_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tarla_parcel_source_document_idx ON public.tarla_parcel USING btree (source_document_id);


--
-- Name: tarla_parcel_tarla_parcela_folded_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tarla_parcel_tarla_parcela_folded_unique ON public.tarla_parcel USING btree (tarla_id, btrim(regexp_replace(regexp_replace(lower(NORMALIZE(parcela, NFD)), (((('['::text || chr(768)) || '-'::text) || chr(879)) || ']'::text), ''::text, 'g'::text), '\s+'::text, ' '::text, 'g'::text)));


--
-- Name: uq_lookup_person_role_parent_kind; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_lookup_person_role_parent_kind ON public.lookup_person_role USING btree (parent_kind) WHERE (parent_kind IS NOT NULL);


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
-- Name: document_tarla document_tarla_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_tarla
    ADD CONSTRAINT document_tarla_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.document(id) ON DELETE CASCADE;


--
-- Name: document_tarla document_tarla_tarla_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_tarla
    ADD CONSTRAINT document_tarla_tarla_id_fkey FOREIGN KEY (tarla_id) REFERENCES public.lookup_tarla(id) ON DELETE CASCADE;


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
-- Name: interaction_document interaction_document_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interaction_document
    ADD CONSTRAINT interaction_document_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.document(id) ON DELETE CASCADE;


--
-- Name: interaction_document interaction_document_interaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interaction_document
    ADD CONSTRAINT interaction_document_interaction_id_fkey FOREIGN KEY (interaction_id) REFERENCES public.interaction(id) ON DELETE CASCADE;


--
-- Name: interaction interaction_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interaction
    ADD CONSTRAINT interaction_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.person(id) ON DELETE CASCADE;


--
-- Name: interaction interaction_related_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interaction
    ADD CONSTRAINT interaction_related_property_id_fkey FOREIGN KEY (related_property_id) REFERENCES public.property(id) ON DELETE SET NULL;


--
-- Name: interaction_tag interaction_tag_interaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interaction_tag
    ADD CONSTRAINT interaction_tag_interaction_id_fkey FOREIGN KEY (interaction_id) REFERENCES public.interaction(id) ON DELETE CASCADE;


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
-- Name: lookup_property_type_use lookup_property_type_use_property_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lookup_property_type_use
    ADD CONSTRAINT lookup_property_type_use_property_type_id_fkey FOREIGN KEY (property_type_id) REFERENCES public.lookup_property_type(id) ON DELETE CASCADE;


--
-- Name: lookup_property_type_use lookup_property_type_use_use_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lookup_property_type_use
    ADD CONSTRAINT lookup_property_type_use_use_category_id_fkey FOREIGN KEY (use_category_id) REFERENCES public.lookup_use_category(id) ON DELETE CASCADE;


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
-- Name: natural_person_relationship natural_person_relationship_natural_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.natural_person_relationship
    ADD CONSTRAINT natural_person_relationship_natural_person_id_fkey FOREIGN KEY (natural_person_id) REFERENCES public.natural_person(person_id) ON DELETE CASCADE;


--
-- Name: natural_person_relationship natural_person_relationship_relationship_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.natural_person_relationship
    ADD CONSTRAINT natural_person_relationship_relationship_id_fkey FOREIGN KEY (relationship_id) REFERENCES public.lookup_person_relationship(id) ON DELETE CASCADE;


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
-- Name: property property_tarla_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property
    ADD CONSTRAINT property_tarla_id_fkey FOREIGN KEY (tarla_id) REFERENCES public.lookup_tarla(id) ON DELETE SET NULL;


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
-- Name: tarla_corner tarla_corner_tarla_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tarla_corner
    ADD CONSTRAINT tarla_corner_tarla_id_fkey FOREIGN KEY (tarla_id) REFERENCES public.lookup_tarla(id) ON DELETE CASCADE;


--
-- Name: tarla_parcel tarla_parcel_source_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tarla_parcel
    ADD CONSTRAINT tarla_parcel_source_document_id_fkey FOREIGN KEY (source_document_id) REFERENCES public.document(id) ON DELETE SET NULL;


--
-- Name: tarla_parcel tarla_parcel_tarla_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tarla_parcel
    ADD CONSTRAINT tarla_parcel_tarla_id_fkey FOREIGN KEY (tarla_id) REFERENCES public.lookup_tarla(id) ON DELETE CASCADE;


--
-- Name: tarla_parcel tarla_parcel_use_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tarla_parcel
    ADD CONSTRAINT tarla_parcel_use_category_id_fkey FOREIGN KEY (use_category_id) REFERENCES public.lookup_use_category(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--


--
-- Restore a usable search_path for the session that applied this file.
-- pg_dump emptied it at the top; every consumer that issues an unqualified
-- statement afterwards on the same connection needs it back. (Slice #29.04)
--

SELECT pg_catalog.set_config('search_path', 'public', false);