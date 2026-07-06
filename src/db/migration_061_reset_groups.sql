-- Slice #20.08 — Reset groups for new GRP-NNN code scheme
--
-- Group codes are changing from the old type-prefixed two-letter scheme
-- (PROP-AA, PPERS-AB, JPERS-BA, DOC-ZZ) to a simple numeric scheme:
-- GRP-001, GRP-002, GRP-003 …
--
-- Since codes are NEVER reused, and the existing groups are disposable
-- (confirmed by Adrian), we hard-delete all data and reset the sequence
-- so new groups start at GRP-001.
--
-- Steps:
--   1. Hard-delete all group_member rows (FK cascade means groups delete
--      takes them too, but being explicit is safer).
--   2. Hard-delete all groups rows (including soft-deleted ones).
--   3. Reset group_code_seq to 1 so the next group gets GRP-001.
--
-- No schema changes — the `code` column is plain text; the new format
-- is enforced entirely in the application layer (src/lib/groups/code.ts).

DELETE FROM group_member;
DELETE FROM groups;

-- Reset the sequence so the first new group gets GRP-001.
ALTER SEQUENCE group_code_seq RESTART WITH 1;
