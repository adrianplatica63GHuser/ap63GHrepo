-- Slice #18.07 — Groups (target type + system code + member items)
--
-- A "Group" gathers items of a single target type (Physical person, Judicial
-- person, Property, Document). For now only PROPERTY membership is wired in the
-- application; the other target types can be created but their member editor
-- shows a "not implemented yet" message.
--
-- Code: a two-letter, system-assigned code (AA, AB, ... AZ, BA, ...) drawn from
-- the alphabet WITHOUT the letters I and O (24 letters). Codes are allocated in
-- order from `group_code_seq` and NEVER reused — deleting a group does not roll
-- the sequence back. The integer->letters encoding lives in the application
-- layer (src/lib/groups/code.ts); the sequence here only guarantees ordering +
-- no-reuse. (576 = 24*24 two-letter codes available before a 3rd letter is
-- needed; the encoder guards against overflow.)
--
-- Position: each member gets a 1-based position within its group, shown as
-- [01], [02], ... Positions are allocated from groups.last_position (a
-- high-water counter) and are NEVER reused — removing a member leaves a gap.
--
-- This slice REPLACES the old lightweight "Grup" lookup (lookup_others rows
-- with category = 'Grup', a name+description placeholder with no target/code/
-- members). Those rows are deleted at the end of this migration.
--
-- Idempotent: CREATE ... IF NOT EXISTS throughout.

-- Target type enum.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'group_target_type') THEN
    CREATE TYPE group_target_type AS ENUM (
      'PHYSICAL_PERSON',
      'JUDICIAL_PERSON',
      'PROPERTY',
      'DOCUMENT'
    );
  END IF;
END$$;

-- Sequence backing the never-reused group codes.
CREATE SEQUENCE IF NOT EXISTS group_code_seq START WITH 1 INCREMENT BY 1;

-- Group entity. (`groups` plural to avoid the reserved word `group`.)
CREATE TABLE IF NOT EXISTS groups (
  id            uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text               NOT NULL UNIQUE,
  target_type   group_target_type  NOT NULL,
  description   text               NOT NULL,
  -- High-water counter for member positions; never decreases (no reuse).
  last_position integer            NOT NULL DEFAULT 0,
  created_at    timestamptz        NOT NULL DEFAULT now(),
  updated_at    timestamptz        NOT NULL DEFAULT now()
);

-- Group members. property_id is the only target wired for now (nullable so the
-- table can grow other typed FKs later without a destructive migration).
CREATE TABLE IF NOT EXISTS group_member (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  property_id uuid        REFERENCES property(id) ON DELETE CASCADE,
  position    integer     NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Position is unique within a group; a property appears at most once per group.
CREATE UNIQUE INDEX IF NOT EXISTS group_member_group_position_unique
  ON group_member (group_id, position);
CREATE UNIQUE INDEX IF NOT EXISTS group_member_group_property_unique
  ON group_member (group_id, property_id);

-- Keep updated_at fresh (matches the touch_updated_at trigger used elsewhere).
DROP TRIGGER IF EXISTS groups_touch_updated_at ON groups;
CREATE TRIGGER groups_touch_updated_at
  BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Retire the superseded lightweight "Grup" lookup rows (Slice #9.8/#9.9).
DELETE FROM lookup_others WHERE category = 'Grup';
