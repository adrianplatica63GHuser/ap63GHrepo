-- migration_054_updated_by.sql
--
-- Add updated_by (email of the last writer) to the three core entity tables
-- and to their version tables.
--
-- Core tables: know who last edited a record.
-- Version tables: know who created each individual version snapshot.
--
-- All columns are nullable so legacy rows and seed data are unaffected.
-- Safe to run more than once (IF NOT EXISTS / idempotent).

BEGIN;

-- Core entity tables ---------------------------------------------------------

ALTER TABLE person
  ADD COLUMN IF NOT EXISTS updated_by text;

ALTER TABLE property
  ADD COLUMN IF NOT EXISTS updated_by text;

ALTER TABLE document
  ADD COLUMN IF NOT EXISTS updated_by text;

-- Version tables -------------------------------------------------------------

ALTER TABLE person_version
  ADD COLUMN IF NOT EXISTS updated_by text;

ALTER TABLE property_version
  ADD COLUMN IF NOT EXISTS updated_by text;

ALTER TABLE document_version
  ADD COLUMN IF NOT EXISTS updated_by text;

COMMIT;
