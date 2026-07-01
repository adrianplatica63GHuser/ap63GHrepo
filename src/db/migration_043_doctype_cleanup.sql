-- migration_043_doctype_cleanup.sql
--
-- 1. Rename UNCLASSIFIED → NECLASIFICAT (display name only; key stays UNCLASSIFIED
--    so existing code references continue to work).
-- 2. Remove the duplicate "Autorizare" type (key=AUTORIZATIE), reassigning any
--    existing rows to "Autorizație" (key=AUTORIZATIE_ALT) first.
--
-- Apply locally:
--   docker cp src/db/migration_043_doctype_cleanup.sql ga40prj-postgres:/tmp/m043.sql
--   docker exec ga40prj-postgres psql -U postgres -d ga40db -f /tmp/m043.sql
-- Apply to Supabase: paste into SQL Editor.

-- ── 1. Rename Unclassified → NECLASIFICAT ────────────────────────────────
UPDATE lookup_document_type
SET    name = 'NECLASIFICAT', updated_at = now()
WHERE  key  = 'UNCLASSIFIED';

-- ── 2. Reassign documents that reference AUTORIZATIE → AUTORIZATIE_ALT ───
-- (no-op if there are none; safe to run on a clean DB)
UPDATE document
SET    document_type_id = (
         SELECT id FROM lookup_document_type WHERE key = 'AUTORIZATIE_ALT' LIMIT 1
       ),
       updated_at = now()
WHERE  document_type_id = (
         SELECT id FROM lookup_document_type WHERE key = 'AUTORIZATIE' LIMIT 1
       );

-- Also migrate any version snapshots that reference the old type id.
UPDATE document_version
SET    snapshot = jsonb_set(
         snapshot,
         '{documentTypeId}',
         to_jsonb((SELECT id::text FROM lookup_document_type WHERE key = 'AUTORIZATIE_ALT' LIMIT 1))
       )
WHERE  (snapshot->>'documentTypeId') = (
         SELECT id::text FROM lookup_document_type WHERE key = 'AUTORIZATIE' LIMIT 1
       );

-- Migrate lookup_doc_type_person_role rows that reference AUTORIZATIE.
-- Re-insert under AUTORIZATIE_ALT (skipping duplicates), then delete the old ones.
INSERT INTO lookup_doc_type_person_role (document_type_id, person_role_id)
SELECT (SELECT id FROM lookup_document_type WHERE key = 'AUTORIZATIE_ALT' LIMIT 1),
       person_role_id
FROM   lookup_doc_type_person_role
WHERE  document_type_id = (SELECT id FROM lookup_document_type WHERE key = 'AUTORIZATIE' LIMIT 1)
ON CONFLICT DO NOTHING;

DELETE FROM lookup_doc_type_person_role
WHERE  document_type_id = (SELECT id FROM lookup_document_type WHERE key = 'AUTORIZATIE' LIMIT 1);

-- ── 3. Delete the AUTORIZATIE row ────────────────────────────────────────
DELETE FROM lookup_document_type
WHERE  key = 'AUTORIZATIE';
