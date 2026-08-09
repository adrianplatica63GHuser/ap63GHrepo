-- migration_069_document_type_origin.sql
-- Slice #26.12 - the ONE fact about a document type that cannot be derived.
--
-- WHAT THE SLICE ASKS FOR
--   A document type reads as New, AI scanned or AI completed, and in the
--   Reference Data list a hand-added type is black, an import-created one is
--   blue, and one with a custom form is bold green.
--
-- WHY THERE IS NO status COLUMN HERE
--   Six labels were asked for (three for a type, three for a document) and
--   five of them are already written down somewhere else in this database:
--
--     type    AI completed  <=>  lookup_document_type.template_fields is a
--                                non-empty array. #26.11 made that the only
--                                way a type gets a form, from either origin.
--     doc     AI processed  <=>  document.ai_interpreted_at IS NOT NULL AND
--                                its type has a form.
--     doc     Imported      <=>  ai_interpreted_at IS NOT NULL and the type
--                                has none. Since #26.09 removed the AI
--                                Interpret button, the import run is the only
--                                writer of that stamp, so the column that used
--                                to mean "somebody pressed the button" now
--                                means "an import read this document".
--     doc     New           <=>  ai_interpreted_at IS NULL.
--
--   Storing those as a status column too would give each of them a second
--   home, and a second home is where the two answers start to disagree - the
--   failure this codebase already writes single-source tests about. The one
--   that genuinely is NOT recoverable is a type's ORIGIN: nothing on the row
--   distinguishes a type Adrian typed into Reference Data from one
--   ensureDocType() created mid-import. Both go through the same POST and end
--   up with a slugified key and a name. So ORIGIN is stored, and every other
--   label is computed from it in src/lib/documents/status.ts.
--
--   Note what this buys twice over: the three type STATUSES and the three
--   admin COLOURS partition the same rows the same way (has a form -> bold
--   green / AI completed; else IMPORT -> blue / AI scanned; else black / New),
--   so one function decides both and a colour can never contradict a label.
--
-- WHY EVERY EXISTING ROW BECOMES 'MANUAL'
--   Not because it is certainly true - a type auto-created by an earlier
--   import run is indistinguishable from a hand-added one today, which is the
--   whole reason this column exists. It is because MANUAL is the only value
--   that cannot make a NEW claim about an old row: it renders black and reads
--   "New", which is exactly what the list shows now. Backfilling anything to
--   IMPORT would need a guess, and a wrong guess here paints a type Adrian
--   created himself as something the machine invented.
--
--   Consequence, accepted deliberately and stated in the handover: types
--   created by imports run BEFORE this migration keep reading as New/black.
--   Only types created from here on are marked. Nothing repairs that later -
--   there is no evidence to repair it from.
--
-- WHY NOT A BOOLEAN
--   A text code with a CHECK, matching lookup/metadata convention in this
--   schema (entity_metadata.provenance, importance, relevance). is_imported
--   would need renaming the day a third origin appears - a type created by a
--   future API feed, say - and a boolean cannot be read in a psql dump without
--   knowing which way round it was defined.
--
-- WHY NOT REUSE entity_metadata.provenance
--   Two reasons, and either alone is enough. Lookup rows have no
--   principal_object, so there is no entity_metadata row to hang it on. And
--   provenance is USER-EDITABLE in the Metadata tab: #26.08's own migration
--   (068) exists because provenance had been overloaded as a lock and a
--   display value was doing a job it could be edited out of. This column is
--   written once at creation and by nothing afterwards - see the PUT carve-out
--   in src/lib/admin/value-lists/queries.ts, which strips `origin` from every
--   update so a rename can never re-origin a type.
--
-- Idempotent: IF NOT EXISTS / DROP CONSTRAINT IF EXISTS throughout.

-- ---------------------------------------------------------------------------
-- 1. The column
-- ---------------------------------------------------------------------------
--
-- NOT NULL DEFAULT 'MANUAL' does the backfill in the same statement: Postgres
-- fills existing rows from the default, and every future insert that says
-- nothing is a hand-added type. The import path is the only caller that has to
-- speak up, which is the right way round - a new writer that forgets is
-- labelled conservatively rather than claiming to be an import.

ALTER TABLE lookup_document_type
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'MANUAL';

-- ---------------------------------------------------------------------------
-- 2. The value set
-- ---------------------------------------------------------------------------

ALTER TABLE lookup_document_type DROP CONSTRAINT IF EXISTS chk_ldt_origin;

ALTER TABLE lookup_document_type
  ADD CONSTRAINT chk_ldt_origin CHECK (origin IN ('MANUAL', 'IMPORT'));

COMMENT ON COLUMN lookup_document_type.origin IS
  'How this type came to exist: MANUAL = added in Reference Data, IMPORT = created by ensureDocType during an import scan. Write-once at creation; the value-lists PUT strips it. Everything else about a type''s status is derived - see src/lib/documents/status.ts.';

-- ---------------------------------------------------------------------------
-- 3. Report
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  manual integer;
  imported integer;
BEGIN
  SELECT count(*) INTO manual   FROM lookup_document_type WHERE origin = 'MANUAL';
  SELECT count(*) INTO imported FROM lookup_document_type WHERE origin = 'IMPORT';
  RAISE NOTICE 'migration_069: % type(s) MANUAL, % IMPORT (expected all-MANUAL on first run - there is no backfill).', manual, imported;
END $$;
