-- migration_060_tag_normalization.sql
-- Normalises all existing entity_tag rows to lowercase.
--
-- Background: the unique index added in migration_048 is already on
-- (principal_object_id, lower(tag)), so the DB has always blocked
-- case-duplicate tags on the same entity.  However the application stored
-- tags verbatim ("Proprietate", "TEREN", etc.) — the stored value never
-- matched the index key.  This migration aligns the stored value with the
-- index key so that autocomplete, the tag cloud, and rename/merge all work
-- on a consistent lowercase corpus.
--
-- After this migration the application layer will always write lower(tag.trim())
-- before inserting, keeping the corpus clean going forward.
--
-- Safe to re-run: the UPDATE is idempotent (WHERE tag != lower(tag) is a no-op
-- when already lowercase).  No new tables or indexes are added here — they
-- were created by migration_048.

BEGIN;

-- Normalise any mixed-case tags that slipped through before this migration.
UPDATE entity_tag
SET    tag = lower(tag)
WHERE  tag <> lower(tag);

-- Record migration
INSERT INTO schema_migrations (filename)
VALUES ('migration_060_tag_normalization.sql')
ON CONFLICT DO NOTHING;

COMMIT;
