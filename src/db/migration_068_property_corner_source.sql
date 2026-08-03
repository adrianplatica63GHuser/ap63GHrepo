-- migration_068_property_corner_source.sql
-- Slice #23.06.Import - an honest link between a coordinate document and the
-- Property its corners built, replacing provenance-as-a-lock.
--
-- WHAT WENT WRONG
--   Adrian imported a property folder, used the results-table row action to
--   apply a coordinate .txt to the run's Property, then opened the same
--   document from the Documents list and found the "Process" panel still
--   enabled. Using it created a SECOND Property with identical coordinates -
--   visible on the map only as a flicker where the two polygons overlap.
--
--   The chain, confirmed by investigation:
--     1. classifyFileSource() in src/lib/metadata/provenance-rules.ts maps a
--        file by extension only, and deliberately never returns
--        COORDINATE_FILE - a .txt is indistinguishable from any other text
--        file by name alone.
--     2. "txt" is in DOCUMENT_EXTENSIONS, so inferProvenanceForFiles returns
--        DOC_FILE, and that is what the wizard stamped on the imported
--        coordinate document.
--     3. process-panel.tsx decided done-vs-ready with
--        `if (prov === "COORDINATE_FILE")`.  DOC_FILE is not COORDINATE_FILE.
--     4. The panel rendered ready/enabled. Second Property.
--
--   The reasoning behind step 1 is sound in general - but the wizard is not
--   guessing from a filename. PropertyStepDialog and CoordinatePropertyDialog
--   both actually parse the file through POST /api/properties/parse-text and
--   count real corners. They have proof, and before this migration they threw
--   that proof away.
--
-- THE FIX
--   Stop overloading a metadata VALUE as a concurrency lock. Record the fact
--   directly: this document produced that Property.
--
--   UNIQUE(document_id) IS the lock. Every creation path does
--
--       INSERT INTO property_corner_source (document_id, property_id, ...)
--       VALUES (...)
--       ON CONFLICT (document_id) DO NOTHING
--       RETURNING id;
--
--   Zero rows returned means another path already turned this document into a
--   Property -> 409. Atomic by construction: no SELECT ... FOR UPDATE, no
--   advisory lock, no provenance overloading, and no window between the check
--   and the claim for a concurrent request to slip through.
--
--   Provenance keeps being stamped where the code has parsed proof, but it is
--   now simply accurate metadata. It is no longer load-bearing, so the
--   four-places-must-move-together coupling recorded in CLAUDE.md is gone.
--
-- NO BACKFILL IS POSSIBLE
--   Nothing in the database records which document produced which existing
--   Property. The Process route wrote provenance = COORDINATE_FILE on BOTH
--   sides but never stored the pairing, and the wizard stored nothing at all.
--   Reconstructing it by matching corner geometry would be a guess, and a
--   wrong guess here permanently mislabels a document's origin.
--
--   Consequence, accepted deliberately: documents imported before this
--   migration stay UNLOCKED. Their Process panel still renders as ready, and
--   using it will still create a duplicate Property. Only documents imported
--   or processed from this migration onward are protected.
--
-- SOFT-DELETE
--   Properties soft-delete (softDeleteProperty in src/lib/properties/queries.ts
--   sets deleted_at; the row stays). The ON DELETE CASCADE below therefore
--   never fires for the normal delete path, so a stale link would block its
--   source document forever. src/lib/properties/corner-source.ts hard-deletes
--   the link row inside softDeleteProperty instead - see the comment there for
--   why cleanup-on-delete beats a trigger.
--
-- Idempotent: IF NOT EXISTS throughout; safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. The table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS property_corner_source (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The document whose coordinate file supplied the corners.
  -- ON DELETE CASCADE: a hard-deleted document releases its claim. (Documents
  -- soft-delete in the normal flow, so this fires only on a real DELETE.)
  document_id uuid NOT NULL
              REFERENCES document(id) ON DELETE CASCADE,

  -- The Property those corners became.
  property_id uuid NOT NULL
              REFERENCES property(id) ON DELETE CASCADE,

  created_at  timestamptz NOT NULL DEFAULT now(),

  -- Email of whoever ran the creating path, from getCurrentUserEmail().
  -- Null under UAT_NO_AUTH (the synthetic identity has no email) and for any
  -- path with no session - matching the updated_by convention set in #21.02.
  created_by  text
);

-- ---------------------------------------------------------------------------
-- 2. The lock
-- ---------------------------------------------------------------------------
--
-- One coordinate document can only ever be the origin of ONE Property. This
-- unique index is both the business rule and the concurrency primitive: it is
-- what ON CONFLICT (document_id) infers against.
--
-- Trade-off, stated so it is never a surprise: re-pointing a link is not an
-- UPDATE. The route is to soft-delete the wrong Property - which frees the
-- document, per the cleanup above - and then re-run the correct path.

CREATE UNIQUE INDEX IF NOT EXISTS property_corner_source_document_unique
  ON property_corner_source (document_id);

-- Lookup by Property, used by the soft-delete cleanup.
CREATE INDEX IF NOT EXISTS property_corner_source_property_idx
  ON property_corner_source (property_id);

-- ---------------------------------------------------------------------------
-- 3. Report
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  links integer;
BEGIN
  SELECT count(*) INTO links FROM property_corner_source;
  RAISE NOTICE 'migration_068: property_corner_source ready, % existing link(s) (expected 0 on first run - there is no backfill).', links;
END $$;
