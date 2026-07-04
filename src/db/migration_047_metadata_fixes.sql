-- ---------------------------------------------------------------------------
-- migration_047_metadata_fixes.sql  (Slice #19.11)
--
-- Applies six improvements to entity_metadata:
--   1. Normalize any stale 'OBSOLETE' relevance values → 'INACTIVE'
--   2. CHECK constraints on importance / relevance / provenance (text columns)
--   3. Indexes on those three columns for filter/sort queries
--   4. entity_provenance_log — proper relational table replacing the JSONB
--      provenance_history array; migrates existing rows then drops the column
--   5. entity_metadata_version — full-snapshot version history (pattern
--      identical to property_version / person_version / document_version)
--   6. Backfill version 0 for every existing entity_metadata row
--
-- Apply locally:
--   docker cp src/db/migration_047_metadata_fixes.sql ga40prj-postgres:/tmp/m047.sql
--   docker exec ga40prj-postgres psql -U postgres -d ga40db -f /tmp/m047.sql
--
-- Apply on Supabase: paste this file into the SQL Editor.
-- ---------------------------------------------------------------------------

-- 1. Normalize stale OBSOLETE → INACTIVE (safety net before adding CHECK)
UPDATE entity_metadata SET relevance = 'INACTIVE' WHERE relevance = 'OBSOLETE';

-- 2. CHECK constraints (idempotent via DO blocks)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_em_importance' AND conrelid = 'entity_metadata'::regclass
  ) THEN
    ALTER TABLE entity_metadata
      ADD CONSTRAINT chk_em_importance
        CHECK (importance IN ('LOW', 'MEDIUM', 'HIGH'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_em_relevance' AND conrelid = 'entity_metadata'::regclass
  ) THEN
    ALTER TABLE entity_metadata
      ADD CONSTRAINT chk_em_relevance
        CHECK (relevance IN ('INACTIVE', 'HISTORICAL', 'CURRENT', 'FUTURE'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_em_provenance' AND conrelid = 'entity_metadata'::regclass
  ) THEN
    ALTER TABLE entity_metadata
      ADD CONSTRAINT chk_em_provenance
        CHECK (provenance IN (
          'MANUAL', 'IMAGE_UPLOAD', 'TEXT_FILE',
          'ALGORITHM', 'AI_INTERPRETED', 'EXTERNAL_IMPORT'
        ));
  END IF;
END $$;

-- 3. Indexes on the three classification columns
CREATE INDEX IF NOT EXISTS entity_metadata_importance_idx ON entity_metadata (importance);
CREATE INDEX IF NOT EXISTS entity_metadata_relevance_idx  ON entity_metadata (relevance);
CREATE INDEX IF NOT EXISTS entity_metadata_provenance_idx ON entity_metadata (provenance);

-- 4a. Provenance log table
CREATE TABLE IF NOT EXISTS entity_provenance_log (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_metadata_id uuid        NOT NULL
                                   REFERENCES entity_metadata(id) ON DELETE CASCADE,
  -- The provenance method value that was active BEFORE this change.
  method             text        NOT NULL,
  -- Calendar date the change was recorded (YYYY-MM-DD).
  logged_at          date        NOT NULL DEFAULT CURRENT_DATE,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS entity_provenance_log_meta_idx
  ON entity_provenance_log (entity_metadata_id, logged_at);

-- 4b. Migrate existing JSONB history rows → entity_provenance_log
-- Only runs when provenance_history column still exists (safe on re-run).
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entity_metadata' AND column_name = 'provenance_history'
  ) THEN
    INSERT INTO entity_provenance_log (entity_metadata_id, method, logged_at, created_at)
    SELECT
      em.id,
      entry->>'method',
      COALESCE((entry->>'date')::date, CURRENT_DATE),
      now()
    FROM entity_metadata em,
         jsonb_array_elements(em.provenance_history) AS entry
    WHERE em.provenance_history IS NOT NULL
      AND jsonb_array_length(em.provenance_history) > 0
      AND (entry->>'method') IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- 4c. Drop the old JSONB column (idempotent)
ALTER TABLE entity_metadata DROP COLUMN IF EXISTS provenance_history;

-- 5. Full-snapshot version table (same pattern as property_version et al.)
CREATE TABLE IF NOT EXISTS entity_metadata_version (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_metadata_id uuid        NOT NULL
                                   REFERENCES entity_metadata(id) ON DELETE CASCADE,
  -- 0-based; unique per entity_metadata row.
  version_number     int         NOT NULL,
  -- Snapshot: {importance, relevance, provenance} — all string | null.
  snapshot           jsonb       NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_metadata_id, version_number)
);

CREATE INDEX IF NOT EXISTS entity_metadata_version_meta_idx
  ON entity_metadata_version (entity_metadata_id, version_number);

-- 6. Backfill version 0 for all existing entity_metadata rows
INSERT INTO entity_metadata_version (entity_metadata_id, version_number, snapshot, created_at)
SELECT
  em.id,
  0,
  jsonb_build_object(
    'importance', em.importance,
    'relevance',  em.relevance,
    'provenance', em.provenance
  ),
  em.created_at
FROM entity_metadata em
WHERE NOT EXISTS (
  SELECT 1 FROM entity_metadata_version emv
  WHERE emv.entity_metadata_id = em.id AND emv.version_number = 0
);
