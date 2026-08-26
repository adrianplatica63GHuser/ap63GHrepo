-- migration_071_doctype_rekey.sql
-- Retire the `_ALT` document-type keys, and give CERTIFICAT_SARCINI the name
-- it reads as.
--
-- WHAT THIS DOES
--   migration_021_keep_alternate_wordings.sql added three second Romanian
--   wordings as document types of their own. Each got an `_ALT` key for one
--   reason only: the bare key was already occupied by the row carrying the
--   other wording. Two of those occupants are no longer in the way, so the
--   suffix has stopped meaning anything and is removed; the third pair is
--   collapsed to one type.
--
--     AUTORIZATIE_ALT            'Autorizație'             -> AUTORIZATIE
--     CERTIFICAT_SARCINI         'Certificat de Bunuri'    -> CERTIFICAT_BUNURI
--     CERTIFICAT_SARCINI_ALT     'Certificat de Sarcini'   -> CERTIFICAT_SARCINI
--     EXTRAS_CARTE_FUNCIARA_ALT  'Extras de Carte Funciară'-> folded into
--                                                             EXTRAS_CARTE_FUNCIARA
--
--   No display name changes. No document changes what it is called; the three
--   surviving rows keep their `name`, their `sort_order`, their id and
--   therefore every document, version snapshot and person-role pair already
--   hanging off them. Only the fourth row moves anything, because it ceases to
--   exist.
--
-- ⚠️ **THE ORDER OF SECTION 2 IS LOAD-BEARING AND THE MIGRATION IS WRONG
-- WITHOUT IT.** `CERTIFICAT_SARCINI` is a REUSED key: it names 'Certificat de
-- Bunuri' before this migration and 'Certificat de Sarcini' after it. That is
-- the one thing an immutable key is not supposed to do, and it is only safe
-- because the old holder is renamed out of the way FIRST. Run the two
-- statements the other way round and the second fails on the UNIQUE index,
-- which is the good outcome; the bad one is a hand-written variant that drops
-- or upserts instead, leaving every 'Certificat de Bunuri' document filed under
-- a row the user now reads as 'Certificat de Sarcini' with nothing said.
--
-- ⚠️ **`key` IS IMMUTABLE BY DESIGN (migration_020) AND THIS MIGRATION IS THE
-- EXCEPTION THAT PROVES IT.** Application code switches on the key --
-- `type-config.ts`, `ID_CARD_TYPE_KEYS`, `canonicalTypeKey` -- so a key that
-- moves under a live row is a carve-out silently changing which documents it
-- fires on. None of the four keys here is matched by any carve-out
-- (`src/__tests__/document-type-catalogue-single-source.test.ts` asserts that
-- every configured key is in the catalogue, and the catalogue is what this
-- migration makes true), which is why the rename is safe to do at all. Adding
-- a key to `type-config.ts` and then re-keying it is a different and much worse
-- change.
--
-- ⚠️ **A RENAME, NOT A DELETE-AND-INSERT, AND THE DIFFERENCE IS THE DATA.**
-- `document.document_type_id` is a plain FK with Postgres' default RESTRICT
-- (see src/db/schema/index.ts), so a row with documents cannot be deleted --
-- and a delete-and-insert would give the new row a new id that every existing
-- document, snapshot and whitelist pair points away from. UPDATE ... SET key
-- keeps the id, so nothing downstream moves.
--
-- Idempotent -- safe to re-run. Every statement is guarded on the row it
-- expects still being there, so a second run is a no-op rather than an error.
--
-- Apply locally:
--   docker cp src/db/migration_071_doctype_rekey.sql ga40prj-postgres:/tmp/m071.sql
--   docker exec ga40prj-postgres psql -U postgres -d ga40db -f /tmp/m071.sql
-- Apply to Supabase: paste into SQL Editor.

BEGIN;

-- ── 1. AUTORIZATIE_ALT -> AUTORIZATIE ────────────────────────────────────
-- migration_043 deleted the 'Autorizare' row that held this key, so nothing
-- occupies it. The WHERE NOT EXISTS is the idempotency guard, not a race: this
-- runs in one transaction against a lookup table nothing writes concurrently.
UPDATE lookup_document_type
SET    key = 'AUTORIZATIE', updated_at = now()
WHERE  key = 'AUTORIZATIE_ALT'
  AND  NOT EXISTS (SELECT 1 FROM lookup_document_type WHERE key = 'AUTORIZATIE');

-- ── 2. The CERTIFICAT_SARCINI hand-off, in this order ────────────────────
-- 2a. The current holder moves to the key that matches its name...
UPDATE lookup_document_type
SET    key = 'CERTIFICAT_BUNURI', updated_at = now()
WHERE  key = 'CERTIFICAT_SARCINI'
  AND  name = 'Certificat de Bunuri'
  AND  NOT EXISTS (SELECT 1 FROM lookup_document_type WHERE key = 'CERTIFICAT_BUNURI');

-- 2b. ...and only then is the name free for the row that should carry it.
UPDATE lookup_document_type
SET    key = 'CERTIFICAT_SARCINI', updated_at = now()
WHERE  key = 'CERTIFICAT_SARCINI_ALT'
  AND  NOT EXISTS (SELECT 1 FROM lookup_document_type WHERE key = 'CERTIFICAT_SARCINI');

-- ── 3. Fold EXTRAS_CARTE_FUNCIARA_ALT into EXTRAS_CARTE_FUNCIARA ─────────
-- This one row really is removed, so everything pointing at it has to be moved
-- first. Same three edges migration_043 had to move for 'Autorizare', in the
-- same order, and for the same reason: the delete at the end is a RESTRICT
-- delete that fails while a document still references the row.

-- 3a. Documents.
UPDATE document
SET    document_type_id = (
         SELECT id FROM lookup_document_type WHERE key = 'EXTRAS_CARTE_FUNCIARA' LIMIT 1
       ),
       updated_at = now()
WHERE  document_type_id = (
         SELECT id FROM lookup_document_type WHERE key = 'EXTRAS_CARTE_FUNCIARA_ALT' LIMIT 1
       );

-- 3b. Version snapshots, which hold the id as text inside the jsonb.
UPDATE document_version
SET    snapshot = jsonb_set(
         snapshot,
         '{documentTypeId}',
         to_jsonb((SELECT id::text FROM lookup_document_type WHERE key = 'EXTRAS_CARTE_FUNCIARA' LIMIT 1))
       )
WHERE  (snapshot->>'documentTypeId') = (
         SELECT id::text FROM lookup_document_type WHERE key = 'EXTRAS_CARTE_FUNCIARA_ALT' LIMIT 1
       );

-- 3c. Person-role whitelist pairs. Re-inserted under the surviving type
--     (ON CONFLICT DO NOTHING, because the pair may already be granted there),
--     then the old ones removed. The FK is ON DELETE CASCADE, so 3d would take
--     them anyway -- doing it here is what carries a role the surviving type
--     did not already have.
INSERT INTO lookup_doc_type_person_role (document_type_id, person_role_id)
SELECT (SELECT id FROM lookup_document_type WHERE key = 'EXTRAS_CARTE_FUNCIARA' LIMIT 1),
       person_role_id
FROM   lookup_doc_type_person_role
WHERE  document_type_id = (
         SELECT id FROM lookup_document_type WHERE key = 'EXTRAS_CARTE_FUNCIARA_ALT' LIMIT 1
       )
ON CONFLICT DO NOTHING;

DELETE FROM lookup_doc_type_person_role
WHERE  document_type_id = (
         SELECT id FROM lookup_document_type WHERE key = 'EXTRAS_CARTE_FUNCIARA_ALT' LIMIT 1
       );

-- 3d. The row itself.
DELETE FROM lookup_document_type
WHERE  key = 'EXTRAS_CARTE_FUNCIARA_ALT';

COMMIT;

-- ── Verify ───────────────────────────────────────────────────────────────
-- Expect four rows: AUTORIZATIE, CERTIFICAT_BUNURI, CERTIFICAT_SARCINI and
-- EXTRAS_CARTE_FUNCIARA, each beside the name it reads as, and no `_ALT` key
-- anywhere in the table.
--
--   SELECT key, name, sort_order
--   FROM   lookup_document_type
--   WHERE  key IN ('AUTORIZATIE', 'CERTIFICAT_BUNURI', 'CERTIFICAT_SARCINI',
--                  'EXTRAS_CARTE_FUNCIARA')
--       OR key LIKE '%\_ALT'
--   ORDER  BY key;
