-- migration_035_group_code_prefix_split.sql
--
-- Slice #18.18: split the shared "PERS-" group code prefix into
--   PPERS-  for PHYSICAL_PERSON groups
--   JPERS-  for JUDICIAL_PERSON groups
--
-- "PERS-" is 5 characters; substr(code, 6) extracts the two-letter suffix.
-- The WHERE guards make this idempotent: re-running is a no-op.

UPDATE groups
SET code = 'PPERS-' || substr(code, 6)
WHERE target_type = 'PHYSICAL_PERSON'
  AND code LIKE 'PERS-%';

UPDATE groups
SET code = 'JPERS-' || substr(code, 6)
WHERE target_type = 'JUDICIAL_PERSON'
  AND code LIKE 'PERS-%';
