-- migration_106_role_kinship.sql
-- Slice #39.10 - family ties the inheritance tree can read: each person-to-person
-- role says which kinship it is.
--
-- WHAT THIS DOES
--   1. `lookup_person_role.kinship text NULL`, CHECK IN ('PARENT', 'CHILD',
--      'SPOUSE', 'SIBLING', 'OTHER'): the family tie the HOLDER of the role has
--      towards the other person of the pair - „A Tată B" makes A the parent of B,
--      read the way the role is (person_person.role_reads_a_to_b, #37.28). NULL
--      is „no family tie". OTHER is a relative who is not a parent, child, spouse
--      or sibling („Nepot", „Bunic"): the tree draws it and places no generation
--      by it. The tree reads generations from this column, never from a role's
--      name, which is Adrian's to rename - parent_kind's rule (#38.29).
--   2. The seed, once, as Adrian confirmed it on 2026-10-11 („yes, as listed"):
--        Tată, Mamă, Părinte  -> PARENT
--        Fiu, Fiică           -> CHILD
--        Soț, Soție           -> SPOUSE
--        Frate, Soră          -> SIBLING
--        Bunic, Nepot         -> OTHER
--      Every other role stays NULL (Administrator, Angajat, Asociat / Acționar,
--      Coproprietar, Moștenitor, Reprezentant legal / Mandatar, …). „Bunic" and
--      „Nepot" were entered by Adrian in the role editor and are in no file of
--      the repo, so a database without them changes nothing for them.
--      Only a row whose kinship is still NULL is set, so running this twice, or
--      after an edit by hand, changes nothing.
--   3. parent_kind stays (the identity-card import finds „Tată" and „Mamă" by it).
--      Every role with a parent_kind is a PARENT - set by the column, not the
--      name - and CHECK chk_lookup_person_role_kinship_parent keeps it so.
--   No row is created or deleted. No other table is touched.
--   src/db/sync-reference-data.sql seeds the same ties for the names it carries,
--   so scripts/verify-rebuild.ts compares equal.
--
-- REVERSIBLE?
--   Yes: drop the two constraints and the column. Nothing else reads it until the
--   inheritance tree (Slices #39.11-#39.13).
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, guarded ADD CONSTRAINTs, and UPDATEs
-- that only fill a NULL.

BEGIN;

-- ── 1. the column ────────────────────────────────────────────────────────────

ALTER TABLE lookup_person_role ADD COLUMN IF NOT EXISTS kinship text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'chk_lookup_person_role_kinship'
       AND conrelid = 'lookup_person_role'::regclass
  ) THEN
    ALTER TABLE lookup_person_role
      ADD CONSTRAINT chk_lookup_person_role_kinship
        CHECK (kinship IS NULL OR kinship IN ('PARENT', 'CHILD', 'SPOUSE', 'SIBLING', 'OTHER'));
  END IF;
END $$;

COMMENT ON COLUMN lookup_person_role.kinship IS
  'The family tie the holder of the role has towards the other person of a person_person pair, read the way the role is (role_reads_a_to_b): PARENT, CHILD, SPOUSE, SIBLING, OTHER (a relative placed in no generation), or NULL for no family tie (Slice #39.10). The inheritance tree reads generations from this column, never from a role''s name. A role with a parent_kind is always PARENT (chk_lookup_person_role_kinship_parent).';

-- ── 2. the seed (Adrian, 2026-10-11) ─────────────────────────────────────────

UPDATE lookup_person_role r
   SET kinship = c.kinship
  FROM (VALUES
    ('Tată',    'PARENT'),
    ('Mamă',    'PARENT'),
    ('Părinte', 'PARENT'),
    ('Fiu',     'CHILD'),
    ('Fiică',   'CHILD'),
    ('Soț',     'SPOUSE'),
    ('Soție',   'SPOUSE'),
    ('Frate',   'SIBLING'),
    ('Soră',    'SIBLING'),
    ('Bunic',   'OTHER'),
    ('Nepot',   'OTHER')
  ) AS c(name, kinship)
 WHERE r.name = c.name
   AND r.kinship IS NULL;

-- ── 3. parent_kind is a PARENT, by the column ────────────────────────────────

UPDATE lookup_person_role
   SET kinship = 'PARENT'
 WHERE parent_kind IS NOT NULL
   AND kinship IS DISTINCT FROM 'PARENT';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'chk_lookup_person_role_kinship_parent'
       AND conrelid = 'lookup_person_role'::regclass
  ) THEN
    ALTER TABLE lookup_person_role
      ADD CONSTRAINT chk_lookup_person_role_kinship_parent
        CHECK (parent_kind IS NULL OR kinship = 'PARENT');
  END IF;
END $$;

COMMIT;

-- Check after running:
--
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conname LIKE 'chk_lookup_person_role_kinship%';
--
--   SELECT name, valid_for_person, parent_kind, kinship
--     FROM lookup_person_role WHERE kinship IS NOT NULL ORDER BY kinship, name;
