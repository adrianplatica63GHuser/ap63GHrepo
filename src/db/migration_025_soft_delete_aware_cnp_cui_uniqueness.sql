-- Slice.17.API.04 — Fix soft-delete-blind CNP/CUI uniqueness.
--
-- Bug: natural_person.cnp and judicial_person.cui_number were enforced
-- unique via plain partial unique indexes. Deleting a Person is a SOFT
-- delete (person.deleted_at is set; natural_person/judicial_person rows
-- are left untouched). A partial unique index can't see person.deleted_at
-- (it lives on a different table), so a soft-deleted person's CNP/CUI
-- stayed permanently "taken" — reusing that CNP/CUI for a new person (e.g.
-- re-importing the same ID card after deleting a duplicate) always failed
-- with "A person with this CNP already exists", even though the person no
-- longer appears anywhere in the app.
--
-- Fix: drop the plain unique indexes; replace with BEFORE INSERT OR UPDATE
-- triggers that only count a collision against persons where
-- person.deleted_at IS NULL. Mirrors the existing natural_person_lock_cnp /
-- judicial_person_lock_cui trigger style already in this codebase. The
-- raised exception uses ERRCODE 23505 (unique_violation) so it's still
-- caught as a 409 by dbErrorToResponse() in src/lib/api/errors.ts.
--
-- Idempotent — safe to re-run.

DROP INDEX IF EXISTS natural_person_cnp_unique;
DROP INDEX IF EXISTS judicial_person_cui_unique;

CREATE OR REPLACE FUNCTION natural_person_check_cnp_unique() RETURNS trigger AS $$
BEGIN
  IF NEW.cnp IS NOT NULL AND EXISTS (
    SELECT 1
    FROM natural_person np
    JOIN person p ON p.id = np.person_id
    WHERE np.cnp = NEW.cnp
      AND np.person_id IS DISTINCT FROM NEW.person_id
      AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'A person with this CNP already exists'
      USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION judicial_person_check_cui_unique() RETURNS trigger AS $$
BEGIN
  IF NEW.cui_number IS NOT NULL AND EXISTS (
    SELECT 1
    FROM judicial_person jp
    JOIN person p ON p.id = jp.person_id
    WHERE jp.cui_number = NEW.cui_number
      AND jp.person_id IS DISTINCT FROM NEW.person_id
      AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'A judicial person with this CUI already exists'
      USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS natural_person_check_cnp_unique ON natural_person;
CREATE TRIGGER natural_person_check_cnp_unique
  BEFORE INSERT OR UPDATE ON natural_person
  FOR EACH ROW EXECUTE FUNCTION natural_person_check_cnp_unique();

DROP TRIGGER IF EXISTS judicial_person_check_cui_unique ON judicial_person;
CREATE TRIGGER judicial_person_check_cui_unique
  BEFORE INSERT OR UPDATE ON judicial_person
  FOR EACH ROW EXECUTE FUNCTION judicial_person_check_cui_unique();
