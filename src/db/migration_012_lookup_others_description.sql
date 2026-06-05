-- Slice 9.9 — add description column to lookup_others
--
-- Applies to all four "Others" lists: Services, Interests, Groups, Stamps.
-- Idempotent: IF NOT EXISTS guard makes it safe to re-run.

ALTER TABLE lookup_others
  ADD COLUMN IF NOT EXISTS description text;
