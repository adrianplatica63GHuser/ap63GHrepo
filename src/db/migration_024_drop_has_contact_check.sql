-- Slice.17.API.03 — Remove the "at least one phone or email is required"
-- rule for natural_person.
--
-- Adrian's call: a Person record should be saveable with zero phone/email
-- fields filled in (e.g. contact details aren't known yet, or are tracked
-- elsewhere).
--
-- Drops the DB CHECK constraint that enforced this. The matching Zod
-- refinements in src/lib/persons/validation.ts (API layer) and
-- src/app/natural-persons/_components/form-schema.ts (client form) are
-- removed in the same change — this migration is the DB-layer half.
--
-- Idempotent — safe to re-run.

ALTER TABLE natural_person DROP CONSTRAINT IF EXISTS natural_person_has_contact;
