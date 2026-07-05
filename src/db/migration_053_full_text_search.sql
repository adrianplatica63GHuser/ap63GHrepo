-- migration_053_full_text_search.sql
--
-- Enables the pg_trgm extension and adds GIN trigram indexes on the main
-- searchable text columns used by /admin/complex-query (the metadata-query
-- API route at /api/admin/metadata-query).
--
-- After these indexes exist PostgreSQL uses them automatically for
-- ILIKE '%term%' queries, making substring/fuzzy text search sub-millisecond
-- even as the dataset grows.
--
-- Safe to run multiple times (IF NOT EXISTS guards throughout).

BEGIN;

-- pg_trgm provides the gin_trgm_ops operator class used by every index
-- below.  On local Docker (superuser) this always works.  On Supabase the
-- extension is typically pre-enabled; the IF NOT EXISTS guard is a no-op
-- when it already exists.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── person ───────────────────────────────────────────────────────────────────
-- display_name is maintained by the app layer as the canonical human-readable
-- label for both subtypes (first_name + last_name for natural; company name
-- for judicial).  All person text searches hit this single column.

CREATE INDEX IF NOT EXISTS idx_person_display_name_trgm
  ON person USING gin(display_name gin_trgm_ops);

-- ── property ─────────────────────────────────────────────────────────────────
-- nickname is the main display label ("Porecla / elemente definitorii").
-- carte_funciara, tarla_sola, and cadastral_number are the most-searched
-- cadastral identifiers.

CREATE INDEX IF NOT EXISTS idx_property_nickname_trgm
  ON property USING gin(nickname gin_trgm_ops)
  WHERE nickname IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_property_carte_funciara_trgm
  ON property USING gin(carte_funciara gin_trgm_ops)
  WHERE carte_funciara IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_property_tarla_sola_trgm
  ON property USING gin(tarla_sola gin_trgm_ops)
  WHERE tarla_sola IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_property_cadastral_number_trgm
  ON property USING gin(cadastral_number gin_trgm_ops)
  WHERE cadastral_number IS NOT NULL;

-- ── document ─────────────────────────────────────────────────────────────────
-- title is the primary display field; nr_document and subject are the next
-- most-searched columns (e.g. searching for a contract number or keywords).

CREATE INDEX IF NOT EXISTS idx_document_title_trgm
  ON document USING gin(title gin_trgm_ops)
  WHERE title IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_document_nr_document_trgm
  ON document USING gin(nr_document gin_trgm_ops)
  WHERE nr_document IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_document_subject_trgm
  ON document USING gin(subject gin_trgm_ops)
  WHERE subject IS NOT NULL;

-- ── principal_object.code ────────────────────────────────────────────────────
-- Codes like "PERS00012" are searched by partial suffix ("00012") as well as
-- by full value.  A trigram index supports both patterns; the existing btree
-- unique index handles exact lookups.

CREATE INDEX IF NOT EXISTS idx_principal_object_code_trgm
  ON principal_object USING gin(code gin_trgm_ops);

COMMIT;
