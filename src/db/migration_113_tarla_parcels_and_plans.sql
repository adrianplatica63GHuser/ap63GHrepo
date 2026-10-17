-- migration_113_tarla_parcels_and_plans.sql
-- Slice #39.69 - tarlale from imported plans parcelare: a tarla's parcels, and the plans that drew them.
--
-- WHY
--   A plan parcelar draws one tarla with every parcel in it. Adrian, on the research doc: „SO we should create lists of
--   tarla from "plan parcelar" documents that we import! let's prepare for that". The import now reads a plan's
--   locality, tarla code and parcels and, once a person confirms (D-12), creates or links the tarla, keeps its parcels
--   and links the document to it. This migration is where those two facts live.
--
-- WHAT THIS DOES
--   1. tarla_parcel (new): one row per parcel a plan draws on a tarla - the parcel number as printed, the area in m²
--      and the use category when the plan prints one. Owners are NOT kept (a plan lists them; persons go through the
--      parties step). The use is the matching lookup_use_category when there is one, and the printed words otherwise,
--      so nothing read is lost. One row per (tarla, folded parcel number); deleted with the tarla; the use is cleared
--      when its category is deleted; the plan it came from is cleared when that document is deleted.
--   2. document_tarla (new): which document drew which tarla - a plan links to the tarla it draws. Deleted with
--      either side. Not entity_cross_reference: that one links principal objects, and a tarla is not one (#39.67).
--
-- No existing row changes. src/db/supabase_repair_missing_tables.sql creates the same two tables.

BEGIN;

-- 1 ── a tarla's parcels ─────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tarla_parcel (
  id                 uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  tarla_id           uuid          NOT NULL REFERENCES lookup_tarla(id) ON DELETE CASCADE,
  parcela            text          NOT NULL,
  area_sqm           numeric(14,2),
  use_category_id    uuid          REFERENCES lookup_use_category(id) ON DELETE SET NULL,
  use_printed        text,
  source_document_id uuid          REFERENCES document(id) ON DELETE SET NULL,
  created_at         timestamptz   NOT NULL DEFAULT now(),
  updated_at         timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT tarla_parcel_parcela_not_blank CHECK (btrim(parcela) <> ''),
  CONSTRAINT tarla_parcel_area_positive CHECK (area_sqm IS NULL OR area_sqm > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS tarla_parcel_tarla_parcela_folded_unique
  ON tarla_parcel (
    tarla_id,
    (btrim(regexp_replace(
       regexp_replace(
         lower(normalize(parcela, NFD)),
         '[' || chr(768) || '-' || chr(879) || ']', '', 'g'),
       '\s+', ' ', 'g')))
  );
CREATE INDEX IF NOT EXISTS tarla_parcel_source_document_idx ON tarla_parcel (source_document_id);
COMMENT ON TABLE tarla_parcel IS
  'Slice #39.69: the parcels a plan parcelar draws on a tarla - number as printed, area in m2, use. No owners.';
COMMENT ON COLUMN tarla_parcel.use_printed IS
  'Slice #39.69: the use as the plan prints it, kept when it matches no lookup_use_category.';

-- 2 ── which document drew which tarla ───────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_tarla (
  document_id uuid        NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  tarla_id    uuid        NOT NULL REFERENCES lookup_tarla(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (document_id, tarla_id)
);
CREATE INDEX IF NOT EXISTS document_tarla_tarla_idx ON document_tarla (tarla_id);
COMMENT ON TABLE document_tarla IS
  'Slice #39.69: a plan parcelar (or any document) linked to the tarla it draws.';

COMMIT;
