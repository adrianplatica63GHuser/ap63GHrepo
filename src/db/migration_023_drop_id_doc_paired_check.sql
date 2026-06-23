-- Slice.17.API.02 — Remove the "ID Type and ID Number must be both set or
-- both empty" rule for natural_person.
--
-- Adrian's call: a person's ID document type and number no longer need to
-- be paired. Either can be filled in independently (e.g. the number is
-- known but the type wasn't captured, or vice versa).
--
-- Drops the DB CHECK constraint that enforced this (added alongside the
-- column in an earlier slice). The matching Zod refinements in
-- src/lib/persons/validation.ts (API layer) and
-- src/app/natural-persons/_components/form-schema.ts (client form) are
-- removed in the same change — this migration is the DB-layer half.
--
-- Idempotent — safe to re-run.

ALTER TABLE natural_person DROP CONSTRAINT IF EXISTS natural_person_id_doc_paired;
