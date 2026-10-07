-- migration_095_parents_from_id_card.sql
-- Slice #38.29 - an identity card creates its holder's father and mother too.
--
-- WHAT THIS DOES
--   1. A new provenance value, RELATIVE_ID_CARD - „Din actul de identitate al
--      unei rude": a person who entered the archive from a RELATIVE's identity
--      card (the holder's father or mother, read off the holder's card or typed
--      into the holder's „Carte de identitate" tile). Neither MANUAL nor
--      AI_INTERPRETED says that. The CHECK chk_em_provenance is recreated with
--      the eight values; src/lib/metadata/provenance.ts lists the same eight.
--   2. `lookup_person_role.parent_kind text NULL`, CHECK IN ('FATHER','MOTHER'),
--      at most one row each (a partial unique index). It is how the code finds
--      the two roles below without reading their NAMES: a role's name is
--      Adrian's to rename on Date de referință → Roluri Persoană, and a name
--      the code looked up would be a display value doubling as a lock. NULL on
--      every other role.
--   3. Two roles for people, „Tată" and „Mamă" (Persoană → Persoană), beside
--      „Părinte", which stays for a link where the side is unknown. The parent
--      HOLDS the role towards the child, so the child's „Corelate" tile reads
--      „Tată" / „Mamă", and the parent's reads the converse: „Fiu" or „Fiică"
--      by the child's gender, „Copil" when it is not set - „Părinte"'s own.
--      src/db/sync-reference-data.sql carries the same rows, so
--      scripts/verify-rebuild.ts compares equal.
--   No existing row is changed except the CHECK's definition. No table is
--   created or dropped.
--
-- REVERSIBLE?
--   Yes, while no row uses them: drop the two roles, the index and the column,
--   and recreate the CHECK with seven values. A RELATIVE_ID_CARD row would have
--   to be re-labelled first.
--
-- Idempotent: DROP/ADD of the CHECK, ADD COLUMN IF NOT EXISTS, a guarded
-- ADD CONSTRAINT, CREATE ... IF NOT EXISTS, INSERT ... WHERE NOT EXISTS by
-- name, and UPDATEs that set a value.

BEGIN;

-- ── 1. provenance: RELATIVE_ID_CARD ──────────────────────────────────────────

ALTER TABLE entity_metadata DROP CONSTRAINT IF EXISTS chk_em_provenance;
ALTER TABLE entity_metadata
  ADD CONSTRAINT chk_em_provenance
    CHECK (provenance IN (
      'MANUAL', 'IMAGE', 'DOC_FILE', 'COORDINATE_FILE',
      'ALGORITHM', 'AI_INTERPRETED', 'EXTERNAL_FEED', 'RELATIVE_ID_CARD'
    ));

-- ── 2. lookup_person_role.parent_kind ────────────────────────────────────────

ALTER TABLE lookup_person_role ADD COLUMN IF NOT EXISTS parent_kind text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'chk_lookup_person_role_parent_kind'
       AND conrelid = 'lookup_person_role'::regclass
  ) THEN
    ALTER TABLE lookup_person_role
      ADD CONSTRAINT chk_lookup_person_role_parent_kind
        CHECK (parent_kind IS NULL OR parent_kind IN ('FATHER', 'MOTHER'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_lookup_person_role_parent_kind
  ON lookup_person_role (parent_kind)
  WHERE parent_kind IS NOT NULL;

COMMENT ON COLUMN lookup_person_role.parent_kind IS
  'FATHER or MOTHER on the one role each that a person created from an identity card''s parents is linked by (Slice #38.29, „Tată" and „Mamă"); NULL on every other role. The code finds those two roles by this column, never by their names, which are Adrian''s to rename. At most one row each (uq_lookup_person_role_parent_kind).';

-- ── 3. „Tată" and „Mamă" ─────────────────────────────────────────────────────
--
-- sort_orders 64 and 65, after migration_088's 63; the same values are in
-- src/db/sync-reference-data.sql. Inserted only when the name is absent.

INSERT INTO lookup_person_role (name, description, sort_order, valid_for_person)
SELECT v.name, v.description, v.sort_order, true
  FROM (VALUES
    ('Tată', '(părintele, bărbat)', 64),
    ('Mamă', '(părintele, femeie)', 65)
  ) AS v(name, description, sort_order)
 WHERE NOT EXISTS (SELECT 1 FROM lookup_person_role r WHERE r.name = v.name);

UPDATE lookup_person_role r
   SET valid_for_person     = true,
       parent_kind          = c.kind,
       converse_name        = 'Copil',
       converse_name_male   = 'Fiu',
       converse_name_female = 'Fiică'
  FROM (VALUES ('Tată', 'FATHER'), ('Mamă', 'MOTHER')) AS c(name, kind)
 WHERE r.name = c.name;

COMMIT;

-- Check after running:
--
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conname IN ('chk_em_provenance', 'chk_lookup_person_role_parent_kind');
--
--   SELECT name, sort_order, valid_for_person, parent_kind,
--          converse_name, converse_name_male, converse_name_female
--     FROM lookup_person_role WHERE name IN ('Părinte', 'Tată', 'Mamă');
