-- migration_096_judicial_person_phone_email.sql
-- Slice #38.31 - a firm has a phone and an e-mail of its own.
--
-- WHAT THIS DOES
--   Adds judicial_person.phone and judicial_person.email, both nullable text.
--   A natural person has had personal_phone_1/2, work_phone, personal_email_1/2
--   and work_email since the start; a judicial person had nowhere to keep a
--   number. They are edited and shown on „Reprezentanți și contact", beside
--   the contact persons.
--
-- ONE OF EACH
--   The request asks for a phone and an e-mail. A second of either is one more
--   column later, the way natural_person grew personal_phone_2.
--
-- NO CHECK ON THE E-MAIL'S SHAPE
--   The form and the API check it (src/lib/persons/email-shape.ts). A CHECK
--   here would refuse a row an older client or an import wrote, and
--   natural_person's e-mails carry none either.
--
-- THE VERSION HISTORY
--   person_version stores a JUDICIAL snapshot as jsonb. A snapshot written
--   before this migration has no "phone" or "email" key; the readers take a
--   missing key as null, so nothing here rewrites the history. The next save
--   of each firm writes both keys.

BEGIN;

ALTER TABLE judicial_person
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text;

COMMIT;
