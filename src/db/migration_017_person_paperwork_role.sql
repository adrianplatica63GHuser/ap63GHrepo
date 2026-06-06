-- migration_017_person_paperwork_role.sql
-- Slice 10.07 — add optional person_role_id to person_paperwork junction
--
-- Nullable FK to lookup_person_role. ON DELETE SET NULL keeps the association
-- but clears the role tag if the role is later removed from lookup_person_role.
-- Idempotent: safe to re-run (ADD COLUMN IF NOT EXISTS).

ALTER TABLE person_paperwork
  ADD COLUMN IF NOT EXISTS person_role_id uuid
    REFERENCES lookup_person_role(id) ON DELETE SET NULL;
