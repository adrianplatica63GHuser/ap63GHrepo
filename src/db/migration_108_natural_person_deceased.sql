-- migration_108_natural_person_deceased.sql
-- Slice #39.30 - „Decedat": a natural person can be marked dead, with a date of death.
--
-- WHAT THIS DOES
--   Adds natural_person.is_deceased (boolean, NOT NULL, default false) and
--   natural_person.date_of_death (date, nullable), beside date_of_birth.
--   „Decedat" is a tick, off by default; „Data decesului" is optional, because
--   a person can be known to be dead with the date unknown (the pattern of HL7
--   FHIR's Patient.deceased[x] and of a CRM's „Deceased" / „Deceased date").
--
-- THE CHECKS
--   natural_person_death_needs_deceased: a date of death only on a person
--     marked dead. The API clears the date when „Decedat" is unticked.
--   natural_person_death_after_birth: the date of death is never before the
--     date of birth, where both are set.
--   „Never in the future" is the API's and the form's: a CHECK cannot call
--   now() reliably (it would fail a restore on a machine with a wrong clock).
--
-- THE VERSION HISTORY
--   person_version stores a NATURAL snapshot as jsonb. As migration_038 did for
--   correspondenceSameAsHome, every natural snapshot missing the two keys gets
--   them with the values every person had until now — isDeceased false,
--   dateOfDeath null — so naturalSnapshotsEqual sees no phantom change on the
--   first save after this migration. No value anybody entered is touched.
--
-- THE DEATHS ALREADY IN THE DATA are not set here. That is
--   scripts/backfill-deceased.ts, run once with --dry-run first.

BEGIN;

ALTER TABLE natural_person
  ADD COLUMN IF NOT EXISTS is_deceased boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS date_of_death date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'natural_person_death_needs_deceased'
       AND conrelid = 'natural_person'::regclass
  ) THEN
    ALTER TABLE natural_person
      ADD CONSTRAINT natural_person_death_needs_deceased
        CHECK (date_of_death IS NULL OR is_deceased);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'natural_person_death_after_birth'
       AND conrelid = 'natural_person'::regclass
  ) THEN
    ALTER TABLE natural_person
      ADD CONSTRAINT natural_person_death_after_birth
        CHECK (date_of_death IS NULL OR date_of_birth IS NULL OR date_of_death >= date_of_birth);
  END IF;
END $$;

UPDATE person_version
   SET snapshot = jsonb_set(
         jsonb_set(snapshot, '{natural,isDeceased}', 'false'::jsonb),
         '{natural,dateOfDeath}', 'null'::jsonb)
 WHERE snapshot -> 'natural' IS NOT NULL
   AND jsonb_typeof(snapshot -> 'natural') = 'object'
   AND NOT (snapshot -> 'natural' ? 'isDeceased');

COMMIT;

-- Check after running:
--
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_name = 'natural_person' AND column_name IN ('is_deceased', 'date_of_death');
--
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conname LIKE 'natural_person_death%';
--
--   SELECT count(*) FROM person_version
--    WHERE snapshot -> 'natural' IS NOT NULL AND NOT (snapshot -> 'natural' ? 'isDeceased');   -- 0
