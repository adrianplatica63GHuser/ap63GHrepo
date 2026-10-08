-- migration_099_quality_becomes_roles.sql
-- Slice #38.38 - „Calitate" becomes two roles on Certificat de moștenitor.
--
-- WHAT THIS DOES
--   A party on a Certificat de moștenitor carried a QUALITY (person_document.
--   quality: NULL, 'DEFUNCT' or 'MOSTENITOR', held by person_document_quality_check,
--   migration_056) INSTEAD of a role. From here it carries a role, like every
--   other person <-> document link, and the column goes:
--     1. „Defunct" exists as a role. The list already had
--        „Titular al succesiunii / Defunct" (sort_order 52, paired with the
--        certificate) - it is RENAMED to „Defunct", keeping its id, so the list
--        does not gain a near-duplicate the day #38.37 cleaned it. A database
--        with neither gets a new row.
--     2. „Defunct" and „Moștenitor" are offered on CERTIFICAT_MOSTENITOR:
--        „Deține cotă" off for Defunct, on for Moștenitor (the certificate gives
--        the heirs their shares; the deceased's share is what is divided).
--     3. Each row's quality is written as its role. A row whose role disagrees
--        with its quality takes the quality's role - that is what the parties
--        panel showed - and each is RAISEd as a NOTICE by DOC code. A row that
--        would then duplicate a link the same person already has in that role
--        on that document is deleted instead, and RAISEd too.
--     4. person_document_quality_check and person_document.quality are dropped.
--
-- WHAT IT DOES NOT TOUCH
--   No version snapshot carries quality (a role lives on the junction row and
--   no person, property or document snapshot holds junction rows), so there is
--   no history to relabel.
--
-- Read on the local database 2026-10-08: three rows carry a quality, all on
-- DOC11949, all with no role (one DEFUNCT, two MOSTENITOR). None disagrees.

BEGIN;

-- 1. „Defunct" ---------------------------------------------------------------
UPDATE lookup_person_role
   SET name = 'Defunct',
       description = '(persoana decedată, a cărei moștenire o stabilește certificatul)'
 WHERE name = 'Titular al succesiunii / Defunct'
   AND NOT EXISTS (SELECT 1 FROM lookup_person_role r WHERE r.name = 'Defunct');

INSERT INTO lookup_person_role (name, description, sort_order)
SELECT 'Defunct', '(persoana decedată, a cărei moștenire o stabilește certificatul)', 66
 WHERE NOT EXISTS (SELECT 1 FROM lookup_person_role r WHERE r.name = 'Defunct');

-- 2. Offered on the certificate ----------------------------------------------
INSERT INTO lookup_doc_type_person_role (document_type_id, person_role_id, holds_share)
SELECT d.id, r.id, r.name = 'Moștenitor'
  FROM lookup_document_type d
  JOIN lookup_person_role r ON r.name IN ('Defunct', 'Moștenitor')
 WHERE d.key = 'CERTIFICAT_MOSTENITOR'
ON CONFLICT (document_type_id, person_role_id)
DO UPDATE SET holds_share = EXCLUDED.holds_share;

-- 3. Each quality written as its role ----------------------------------------
CREATE TEMP TABLE m099_role ON COMMIT DROP AS
SELECT q.quality, r.id AS role_id, r.name AS role_name
  FROM (VALUES ('DEFUNCT', 'Defunct'), ('MOSTENITOR', 'Moștenitor')) AS q(quality, name)
  JOIN lookup_person_role r ON r.name = q.name;

DO $$
DECLARE
  r record;
  n int;
BEGIN
  IF (SELECT count(*) FROM m099_role) <> 2 THEN
    RAISE EXCEPTION 'migration_099: „Defunct" or „Moștenitor" is not exactly one role; nothing was changed';
  END IF;
  IF EXISTS (SELECT 1 FROM lookup_person_role WHERE name IN ('Defunct', 'Moștenitor') GROUP BY name HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'migration_099: two roles share the name „Defunct" or „Moștenitor"; nothing was changed';
  END IF;

  SELECT count(*) INTO n FROM person_document WHERE quality IS NOT NULL;
  RAISE NOTICE 'migration_099: % link(s) carry a quality', n;

  -- Would duplicate a link the person already has in that role: deleted.
  FOR r IN
    SELECT d.code, pd.id, pd.quality
      FROM person_document pd
      JOIN document d ON d.id = pd.document_id
      JOIN m099_role m ON m.quality = pd.quality
     WHERE pd.person_role_id IS DISTINCT FROM m.role_id
       AND EXISTS (SELECT 1 FROM person_document o
                    WHERE o.id <> pd.id
                      AND o.person_id = pd.person_id
                      AND o.document_id = pd.document_id
                      AND o.person_role_id = m.role_id)
  LOOP
    RAISE NOTICE 'migration_099:   % - a % link that the same person already has as its role: deleted', r.code, r.quality;
    DELETE FROM person_document WHERE id = r.id;
  END LOOP;

  -- A role that disagrees with the quality: the quality wins.
  FOR r IN
    SELECT d.code, pr.name AS was, m.role_name AS becomes
      FROM person_document pd
      JOIN document d ON d.id = pd.document_id
      JOIN m099_role m ON m.quality = pd.quality
      JOIN lookup_person_role pr ON pr.id = pd.person_role_id
     WHERE pd.person_role_id <> m.role_id
  LOOP
    RAISE NOTICE 'migration_099:   % - role „%" overwritten by „%"', r.code, r.was, r.becomes;
  END LOOP;

  UPDATE person_document pd
     SET person_role_id = m.role_id
    FROM m099_role m
   WHERE m.quality = pd.quality
     AND pd.person_role_id IS DISTINCT FROM m.role_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'migration_099: % link(s) given their quality as role', n;
END $$;

-- 4. The column goes ----------------------------------------------------------
ALTER TABLE person_document DROP CONSTRAINT IF EXISTS person_document_quality_check;
ALTER TABLE person_document DROP COLUMN IF EXISTS quality;

COMMIT;

-- Verify:
--   SELECT r.name, p.holds_share FROM lookup_doc_type_person_role p
--     JOIN lookup_person_role r ON r.id = p.person_role_id
--     JOIN lookup_document_type d ON d.id = p.document_type_id
--    WHERE d.key = 'CERTIFICAT_MOSTENITOR' AND r.name IN ('Defunct', 'Moștenitor');
--   -- Defunct f, Moștenitor t
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'person_document' AND column_name = 'quality';   -- no row
