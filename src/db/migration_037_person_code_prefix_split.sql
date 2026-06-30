-- Slice #18.18: split the shared "PERS" system-ID prefix into
--   PPERS  for NATURAL (physical) persons
--   JPERS  for JUDICIAL persons
--
-- "PERS" is 4 characters; substr(code, 5) extracts the numeric suffix.
-- Both principal_object.code and person.code store the full code, so both
-- tables are updated. Idempotent: WHERE guards skip already-renamed rows.

-- 1. person table (has type column — easy to distinguish)
UPDATE person
SET code = 'PPERS' || substr(code, 5)
WHERE type = 'NATURAL'
  AND code LIKE 'PERS%';

UPDATE person
SET code = 'JPERS' || substr(code, 5)
WHERE type = 'JUDICIAL'
  AND code LIKE 'PERS%';

-- 2. principal_object table (join through person for type info)
UPDATE principal_object po
SET code = 'PPERS' || substr(po.code, 5)
FROM person p
WHERE p.principal_object_id = po.id
  AND p.type = 'NATURAL'
  AND po.code LIKE 'PERS%';

UPDATE principal_object po
SET code = 'JPERS' || substr(po.code, 5)
FROM person p
WHERE p.principal_object_id = po.id
  AND p.type = 'JUDICIAL'
  AND po.code LIKE 'PERS%';
