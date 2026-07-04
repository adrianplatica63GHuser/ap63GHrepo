-- migration_049_entity_cross_ref.sql
-- Adds the entity_cross_reference table for the "See Also / Related to" section
-- on the Metadata tab.
--
-- PURPOSE: informal, researcher-created cross-references between any two
-- entities (Person, Property, Document) when a connection is meaningful but is
-- NOT part of any recorded transaction or formal association.  Examples:
--   - A natural person is the de-facto representative of a judicial person
--     even though no document formalises this
--   - A property was historically related to another property before a split
--   - A document references another document outside the system
--
-- Each row is UNIDIRECTIONAL: the creator (source) points to a target.
-- The UI shows all refs where an entity is source OR target, so both sides
-- can see the link.  Only the source side may delete the row.
--
-- relationship_note: optional free-text (max 500 chars) explaining the link.
-- Safe to re-run: CREATE TABLE/INDEX use IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS entity_cross_reference (
  id                          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  source_principal_object_id  uuid         NOT NULL
    REFERENCES principal_object (id) ON DELETE CASCADE,
  target_principal_object_id  uuid         NOT NULL
    REFERENCES principal_object (id) ON DELETE CASCADE,
  relationship_note           text,
  created_at                  timestamptz  NOT NULL DEFAULT now(),

  -- Prevent self-references
  CONSTRAINT ecr_no_self_ref CHECK (
    source_principal_object_id <> target_principal_object_id
  ),
  -- Prevent exact duplicate (same direction)
  CONSTRAINT ecr_unique_pair UNIQUE (
    source_principal_object_id,
    target_principal_object_id
  )
);

CREATE INDEX IF NOT EXISTS ecr_source_idx
  ON entity_cross_reference (source_principal_object_id);

CREATE INDEX IF NOT EXISTS ecr_target_idx
  ON entity_cross_reference (target_principal_object_id);
