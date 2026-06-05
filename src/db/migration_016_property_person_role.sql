-- Slice 10.06 — add optional person_role_id to property_person
--
-- ON DELETE SET NULL: if the role entry is removed from lookup_person_role,
-- the association row keeps the person but the role tag is cleared.
-- Idempotent — safe to re-run.

ALTER TABLE property_person
  ADD COLUMN IF NOT EXISTS person_role_id uuid
    REFERENCES lookup_person_role(id) ON DELETE SET NULL;
