-- Slice #15.05 — rename "paperwork" to "document" everywhere in the DB,
-- and replace the hardcoded paperwork_type enum with a FK to
-- lookup_document_type (admin-managed via Reference Data).
--
-- AUTHORIZED FULL RESET: per Adrian, all transactional Person / Property /
-- Document data and associations may be wiped (this is test data). Only the
-- lookup_* reference tables are preserved. This is intentionally a reset,
-- not a delta — per CLAUDE.md's "full reset over delta" rule, and because it
-- sidesteps the need to backfill 21 old enum values onto live document rows.
--
-- Apply via:
--   docker cp src/db/migration_020_rename_to_document.sql ga40prj-postgres:/tmp/m020.sql
--   docker exec ga40prj-postgres psql -U postgres -d ga40db -f /tmp/m020.sql
--
-- NOTE: step 4 below (ALTER TYPE ... RENAME VALUE) must run outside an
-- explicit transaction in some Postgres versions when combined with other
-- DDL in the same statement batch; psql -f runs each statement separately
-- by default (no surrounding BEGIN/COMMIT in this file), so this is safe.

-- ---------------------------------------------------------------------------
-- 1. Full reset of transactional tables (old names — rename happens later)
-- ---------------------------------------------------------------------------

TRUNCATE TABLE
  person_paperwork,
  property_paperwork,
  paperwork_paperwork,
  paperwork_page,
  property_person,
  property_property,
  person_person,
  paperwork,
  property_corner,
  property_address,
  property,
  address,
  natural_person,
  judicial_person,
  person,
  principal_object
RESTART IDENTITY CASCADE;

-- The code-generation sequence is standalone (not an IDENTITY column), so
-- RESTART IDENTITY above does not touch it. Reset it explicitly.
ALTER SEQUENCE IF EXISTS principal_object_code_seq RESTART WITH 1;

-- ---------------------------------------------------------------------------
-- 2. lookup_document_type: add the immutable `key` slug column
-- ---------------------------------------------------------------------------

ALTER TABLE lookup_document_type ADD COLUMN IF NOT EXISTS key text;

-- Backfill `key` for existing rows by matching the Romanian display name
-- against the 21 old paperwork_type enum values. This is a one-time
-- reconciliation of pre-existing drift, not an ongoing auto-seed.
UPDATE lookup_document_type SET key = 'ACT_ADJUDECARE'              WHERE key IS NULL AND name = 'Act de Adjudecare';
UPDATE lookup_document_type SET key = 'ACT_CADASTRU'                WHERE key IS NULL AND name = 'Act Cadastru';
UPDATE lookup_document_type SET key = 'ACT_DONATIE'                 WHERE key IS NULL AND name = 'Act de Donație';
UPDATE lookup_document_type SET key = 'AUTORIZATIE'                 WHERE key IS NULL AND name = 'Autorizare';
UPDATE lookup_document_type SET key = 'AVIZ_INSTITUTIE'             WHERE key IS NULL AND name = 'Aviz de Instituție';
UPDATE lookup_document_type SET key = 'CARTE_IDENTITATE'            WHERE key IS NULL AND name = 'Carte de Identitate';
UPDATE lookup_document_type SET key = 'CERTIFICAT_FISCAL'           WHERE key IS NULL AND name = 'Certificat Fiscal';
UPDATE lookup_document_type SET key = 'CERTIFICAT_MOSTENITOR'       WHERE key IS NULL AND name = 'Certificat de Moștenitor';
UPDATE lookup_document_type SET key = 'CERTIFICAT_SARCINI'          WHERE key IS NULL AND name = 'Certificat de Bunuri';
UPDATE lookup_document_type SET key = 'CERTIFICAT_URBANISM'         WHERE key IS NULL AND name = 'Certificat de Urbanism';
UPDATE lookup_document_type SET key = 'CONTRACT_ARENDA'             WHERE key IS NULL AND name = 'Contract de Arendă';
UPDATE lookup_document_type SET key = 'CONTRACT_INCHIRIERE'         WHERE key IS NULL AND name = 'Contract de Închiriere';
UPDATE lookup_document_type SET key = 'CONTRACT_PARTAJ'             WHERE key IS NULL AND name = 'Contract de Partaj';
UPDATE lookup_document_type SET key = 'CONTRACT_PRESTARI_SERVICII'  WHERE key IS NULL AND name = 'Contract de Prestări Servicii';
UPDATE lookup_document_type SET key = 'CONTRACT_VANZARE'            WHERE key IS NULL AND name = 'Contract de Vânzare';
UPDATE lookup_document_type SET key = 'EXTRAS_CARTE_FUNCIARA'       WHERE key IS NULL AND name = 'Extras din Carte Funciară';
UPDATE lookup_document_type SET key = 'EXTRAS_PUG'                  WHERE key IS NULL AND name = 'Extras din PUG';
UPDATE lookup_document_type SET key = 'HOTARARE_JUDECATOREASCA'     WHERE key IS NULL AND name = 'Hotărâre Judecătorească';
UPDATE lookup_document_type SET key = 'TESTAMENT'                   WHERE key IS NULL AND name = 'Testament';
UPDATE lookup_document_type SET key = 'TITLU_PROPRIETATE'           WHERE key IS NULL AND name = 'Titlu de Proprietate';
UPDATE lookup_document_type SET key = 'UNCLASSIFIED'                WHERE key IS NULL AND name = 'Unclassified';

-- Any row that still has no key (custom rows Adrian added by hand, or a
-- Romanian name that doesn't exactly match the guesses above) gets a
-- generated fallback slug so the NOT NULL/UNIQUE constraint below can be
-- applied without manual intervention. Romanian diacritics are folded to
-- their ASCII base letter first (no `unaccent` extension dependency).
--
-- ⚠️ ONE CHARACTER OF THE `to` STRING WAS MISSING FROM THE DAY THIS FILE WAS
-- WRITTEN, AND Slice #34.03 PUT IT BACK.
--   It read 'aaisstAAITTSS' — THIRTEEN characters against a fourteen-character
--   `from` string. Postgres `translate` pairs them by position and DELETES any
--   `from` character with no counterpart, so from the seventh position the
--   whole map was off by one: ţ→A, Ă→A, Â→I, Î→T, Ț→T, Ţ→S, Ș→S, and Ş was
--   removed from the name outright. "Hotărâre Judecătorească" folded to
--   HOTARARE_JUDECATOREASCA correctly - its accents are all in the first six
--   positions, which is why nobody noticed.
--
--   ⚠️ Note WHICH letters were actually wrong, because the obvious guess is
--   not it. Written out against the fourteen-character `from` string, the old
--   thirteen-character `to` produced:
--
--     ă→a  â→a  î→i  ș→s  ş→s  ț→t      the first six, all correct
--     ţ→A                               WRONG (lowercase cedilla t)
--     Ă→A                               right, by accident
--     Â→I  Î→T                          WRONG
--     Ț→T                               right, by accident
--     Ţ→S                               WRONG (cedilla T)
--     Ș→S                               right, by accident
--     Ş→(deleted)                       WRONG (cedilla S, removed outright)
--
--   So FIVE characters were mis-mapped and three of the shifted ones happened
--   to land on the letter they wanted. `Î` is the one that would actually turn
--   up in this data: a name like "Închiriere" reaching this fallback would
--   slug as TNCHIRIERE - silently, into a UNIQUE column that other code
--   matches on. (The seeded "Contract de Închiriere" is in the explicit list
--   above, so it never reached the fallback; a hand-added row would have.)
--
--   The bug is exactly one missing `t`: `ț` and `ţ` are two spellings of the
--   same letter and BOTH map to `t`, but only one `t` was written. The fix is
--   'aaissttAAITTSS' — the `from` string is untouched, so this is a
--   one-character change and every pair can be checked by counting.
--
--   ⚠️ **FIXED RATHER THAN DELETED, AND THE CHOICE MATTERS.** This statement
--   is the fallback that lets the NOT NULL + UNIQUE below be applied without
--   anyone editing rows by hand; deleting it would turn a mis-slugged key into
--   a FAILED MIGRATION on precisely the pre-#15.05 databases it was written
--   for. And the fix is a no-op everywhere it has already run: the `WHERE key
--   IS NULL` means a database that has passed this file once has nothing left
--   for it to touch, so no existing row anywhere changes. What changes is only
--   what a REPLAY onto an old database would now produce.
--
--   ⚠️ **AND THEREFORE THIS FIX REACHES NO DATABASE THAT HAS ALREADY RUN THIS
--   FILE, WHICH IS ALL OF THEM.** `scripts/Apply-Migration.ps1` picks pending
--   files by FILENAME against `schema_migrations` and never re-reads or
--   re-checks a recorded one, so `migration_020_rename_to_document.sql` is
--   skipped for ever on ga40db, on Ciprian's box and on Supabase. The
--   correction therefore changes exactly two things: what a REBUILD produces
--   (`Verify-Rebuild.ps1`, `supabase_schema_full.sql`), and what a
--   pre-#15.05 database would get if one were ever migrated from scratch. It
--   fixes no row anywhere today. A row already slugged by the broken map stays
--   broken until somebody renames it in Reference Data - there is no evidence
--   in the database to find those rows from, because the wrong slug is
--   indistinguishable from a deliberate one.
--
--   ⚠️ Side effect worth knowing: the MD5 `Apply-Migration.ps1` recorded in
--   `schema_migrations.checksum` for this file is now stale, and nothing in
--   the repo verifies it. That is a pre-existing gap in the runner rather than
--   something this edit introduces - it is in the #34.03 handover under
--   "Noticed, not fixed".
--
--   ⚠️ Consequence for `Verify-Rebuild.ps1`: if any row in the live database
--   holds a key the broken map produced, the rebuilt database will now produce
--   a different one and the comparison will say so. That is the check working.
UPDATE lookup_document_type
SET key = regexp_replace(
  upper(
    translate(name,
      'ăâîșşțţĂÂÎȚŢȘŞ',
      'aaissttAAITTSS'
    )
  ),
  '[^A-Z0-9]+', '_', 'g'
)
WHERE key IS NULL;

-- Resolve any accidental duplicate fallback slugs (e.g. two differently-
-- worded rows that fold to the same ASCII slug) by suffixing with the row's
-- short id so the UNIQUE constraint below never fails.
WITH dups AS (
  SELECT id, key, row_number() OVER (PARTITION BY key ORDER BY created_at) AS rn
  FROM lookup_document_type
)
UPDATE lookup_document_type t
SET key = t.key || '_' || left(t.id::text, 8)
FROM dups
WHERE dups.id = t.id AND dups.rn > 1;

-- One-time reconciliation insert: any of the 21 old enum values that have no
-- matching row at all yet (not found by name, so never received a key
-- above) become new rows now. This is fixing the consequence of removing
-- the old enum — not an ongoing auto-seed-on-demand pattern.
INSERT INTO lookup_document_type (key, name, sort_order)
SELECT v.key, v.name, 1000 + v.ord
FROM (VALUES
  ('ACT_ADJUDECARE',             'Act de Adjudecare',              1),
  ('ACT_CADASTRU',               'Act Cadastru',                   2),
  ('ACT_DONATIE',                'Act de Donație',                 3),
  ('AUTORIZATIE',                'Autorizare',                     4),
  ('AVIZ_INSTITUTIE',            'Aviz de Instituție',             5),
  ('CARTE_IDENTITATE',           'Carte de Identitate',            6),
  ('CERTIFICAT_FISCAL',          'Certificat Fiscal',              7),
  ('CERTIFICAT_MOSTENITOR',      'Certificat de Moștenitor',       8),
  ('CERTIFICAT_SARCINI',         'Certificat de Bunuri',           9),
  ('CERTIFICAT_URBANISM',        'Certificat de Urbanism',        10),
  ('CONTRACT_ARENDA',            'Contract de Arendă',            11),
  ('CONTRACT_INCHIRIERE',        'Contract de Închiriere',        12),
  ('CONTRACT_PARTAJ',            'Contract de Partaj',            13),
  ('CONTRACT_PRESTARI_SERVICII', 'Contract de Prestări Servicii', 14),
  ('CONTRACT_VANZARE',           'Contract de Vânzare',           15),
  ('EXTRAS_CARTE_FUNCIARA',      'Extras din Carte Funciară',     16),
  ('EXTRAS_PUG',                 'Extras din PUG',                17),
  ('HOTARARE_JUDECATOREASCA',    'Hotărâre Judecătorească',       18),
  ('TESTAMENT',                  'Testament',                     19),
  ('TITLU_PROPRIETATE',          'Titlu de Proprietate',          20),
  ('UNCLASSIFIED',               'Unclassified',                  21)
) AS v(key, name, ord)
WHERE NOT EXISTS (SELECT 1 FROM lookup_document_type d WHERE d.key = v.key);

ALTER TABLE lookup_document_type ALTER COLUMN key SET NOT NULL;
ALTER TABLE lookup_document_type ADD CONSTRAINT lookup_document_type_key_unique UNIQUE (key);

-- ---------------------------------------------------------------------------
-- 3. principal_object_type enum: PAPERWORK -> DOCUMENT
-- ---------------------------------------------------------------------------

ALTER TYPE principal_object_type RENAME VALUE 'PAPERWORK' TO 'DOCUMENT';

-- ---------------------------------------------------------------------------
-- 4. paperwork -> document (table rename + enum column -> FK column)
-- ---------------------------------------------------------------------------

ALTER TABLE paperwork RENAME TO document;

ALTER TABLE document DROP COLUMN type;
ALTER TABLE document ADD COLUMN document_type_id uuid REFERENCES lookup_document_type(id);
ALTER TABLE document ALTER COLUMN document_type_id SET NOT NULL;

DROP TYPE IF EXISTS paperwork_type;

-- ---------------------------------------------------------------------------
-- 5. paperwork_page -> document_page
-- ---------------------------------------------------------------------------

ALTER TABLE paperwork_page RENAME TO document_page;
ALTER TABLE document_page RENAME COLUMN paperwork_id TO document_id;
ALTER INDEX IF EXISTS paperwork_page_paperwork_number_unique RENAME TO document_page_document_number_unique;

-- ---------------------------------------------------------------------------
-- 6. paperwork_paperwork -> document_document
-- ---------------------------------------------------------------------------

ALTER TABLE paperwork_paperwork RENAME TO document_document;
ALTER TABLE document_document RENAME COLUMN paperwork_id_a TO document_id_a;
ALTER TABLE document_document RENAME COLUMN paperwork_id_b TO document_id_b;
ALTER INDEX IF EXISTS paperwork_paperwork_unique RENAME TO document_document_unique;
ALTER TABLE document_document RENAME CONSTRAINT paperwork_paperwork_order TO document_document_order;

-- ---------------------------------------------------------------------------
-- 7. person_paperwork -> person_document
-- ---------------------------------------------------------------------------

ALTER TABLE person_paperwork RENAME TO person_document;
ALTER TABLE person_document RENAME COLUMN paperwork_id TO document_id;
ALTER INDEX IF EXISTS person_paperwork_unique RENAME TO person_document_unique;

-- ---------------------------------------------------------------------------
-- 8. property_paperwork -> property_document
-- ---------------------------------------------------------------------------

ALTER TABLE property_paperwork RENAME TO property_document;
ALTER TABLE property_document RENAME COLUMN paperwork_id TO document_id;
ALTER INDEX IF EXISTS property_paperwork_unique RENAME TO property_document_unique;

-- ---------------------------------------------------------------------------
-- Done. Manual follow-up (not done by this script):
--   - Rename the Supabase Storage bucket "paperwork-pages" -> "document-pages"
--     (Supabase dashboard; no data migration needed, contents are test data).
--   - Re-seed admin user + sample data if desired (npm run seed:admin / seed).
--   - Apply the equivalent reset to Supabase (SQL Editor) and Ciprian UAT.
-- ---------------------------------------------------------------------------
