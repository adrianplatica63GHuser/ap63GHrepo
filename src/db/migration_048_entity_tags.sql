-- migration_048_entity_tags.sql
-- Adds the entity_tag table for the Tags/Keywords section on the Metadata tab.
-- Safe to re-run: the CREATE TABLE uses IF NOT EXISTS.

-- ---------------------------------------------------------------------------
-- entity_tag — free-text tags per principal_object
-- ---------------------------------------------------------------------------
-- One row per tag per entity.  Tags are simple text strings typed by the user
-- and stored verbatim.  Duplicates on the same entity are prevented by the
-- unique index below.  Deletion is hard-delete (no soft-delete needed).

CREATE TABLE IF NOT EXISTS entity_tag (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_object_id uuid       NOT NULL
    REFERENCES principal_object (id) ON DELETE CASCADE,
  tag               text         NOT NULL,
  created_at        timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS entity_tag_entity_tag_unique
  ON entity_tag (principal_object_id, lower(tag));

CREATE INDEX IF NOT EXISTS entity_tag_principal_object_idx
  ON entity_tag (principal_object_id);
