-- migration_018_judicial_contact_persons.sql
--
-- Slice 12.01 — Judicial Person form refactor
--
-- 1. Drop the temporary free-text contact person columns (these were always
--    placeholders; see schema comment: "→ Future slice will replace with M:M
--    to Person").
-- 2. Add FK-linked contact person columns pointing to person.id.
--    ON DELETE SET NULL: deleting the linked person clears the reference
--    without cascading to the judicial_person row itself.
-- 3. Add correspondence_same_as_hq flag.  When true, the UI hides the
--    correspondence address fields and no CORRESPONDENCE address row is
--    written; when false the fields are independent.

ALTER TABLE judicial_person
  DROP COLUMN IF EXISTS contact_person_1,
  DROP COLUMN IF EXISTS contact_person_2;

ALTER TABLE judicial_person
  ADD COLUMN IF NOT EXISTS contact_person_1_id uuid
    REFERENCES person(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contact_person_2_id uuid
    REFERENCES person(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS correspondence_same_as_hq boolean NOT NULL DEFAULT false;
