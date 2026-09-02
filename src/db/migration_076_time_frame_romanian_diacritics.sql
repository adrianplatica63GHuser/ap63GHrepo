-- migration_076_time_frame_romanian_diacritics.sql
-- Slice #32.17 - the ten time-frame labels read as Romanian.
--
-- Apply locally:  scripts\Apply-Migration.ps1
-- Apply to cloud: paste into the Supabase SQL Editor - AND IT HAS TO BE PASTED.
--                 See "WHERE THIS HAS TO BE APPLIED" below.
--
-- WHAT THIS DOES
--   Rewrites `label_ro` and `description_ro` on all ten `time_frame_setting`
--   rows so they carry the diacritics they were seeded without. Nothing else
--   changes: no DDL, no new row, no English column touched, and nothing a user
--   can set: the Settings screen changes `value` (and `updated_at` with it),
--   and neither appears in any statement below.
--
-- WHY A NEW MIGRATION AND NOT AN EDIT TO 063
--   migration_063_time_frame_settings.sql seeded these rows with
--   `ON CONFLICT (key) DO NOTHING`. Dev has already run it, so editing that
--   file in place would change nothing there, and re-running it would repair
--   nothing - the conflict clause is exactly what makes the second run a no-op.
--   063 is therefore left exactly as it is and this file carries the correction
--   forward, which is the only shape that reaches a database that already
--   exists. (The other two databases hold these rows by other routes entirely,
--   and neither of those routes is the migration chain - see WHERE THIS HAS TO
--   BE APPLIED below.)
--
-- WHERE THE TEXT RENDERS - ONE SCREEN, AND IT IS A DEVELOPER SCREEN
--   Administration -> Settings, one row per setting:
--   src/app/admin/settings/_components/settings-view.tsx:126 picks `labelRo` /
--   `descriptionRo` whenever the interface is Romanian, and DEFAULT_LOCALE is
--   `ro-RO`, so that is what is rendered by default. The description sits under
--   its label on the same line, which is why fixing only the labels would have
--   been half a fix. Those two fields are read nowhere else in the tree.
--
--   ⚠️ **AND THAT SCREEN IS `devOnly`, SO CIPRIAN CANNOT REACH IT.** An
--   adversarial round checked what the slice description asserted: the sidebar
--   omits it (nav-config.ts:144, `devOnly: true`, "A business user configures
--   neither") and src/app/admin/settings/page.tsx redirects a hand-typed URL
--   home unless developer tools are on. build-ciprian-image.ps1:439-441 says
--   the same. So the ten labels this file corrects are read on Adrian's dev
--   build and nowhere else today, and the practical cost of the file existing
--   is the build gate in point 2 below. Correct data is still worth having -
--   the rows are wrong on every database that has run 063, the repair script
--   seeds them for anything rebuilt from empty, and the screen is one feature
--   flag away from being visible - but "Ciprian sees this" is not the reason.
--
-- MATCHED ON `key` ALONE, DELIBERATELY
--   `label_ro` and `description_ro` are not user-editable: PATCH
--   /api/time-frames accepts `{ key, value }` and nothing else, and
--   `upsertTimeFrameSetting` in src/lib/time-frames/queries.ts updates only
--   `value` and `updated_at` on conflict. So there is no hand-edited Romanian
--   for a `key`-only match to clobber, and matching on the old diacritic-free
--   value as well would only have added a way for the fix to silently skip a
--   row. (That function's INSERT branch does write `label_ro = key`, for a key
--   that has no row at all. It is unreachable from the Settings screen, which
--   can only PATCH keys the GET already returned; a row it created for one of
--   the ten keys below would be repaired by this file, and one created for any
--   other key would be a different bug than this one.)
--
--   For the record, the ten values this replaces - the state 063 left, and what
--   a diff against a database that has not run this file should show:
--
--     dashboard_recent_days     'Fereastra activitate recenta'
--     dashboard_expiring_docs   'Orizont documente ce expira'
--     dashboard_stale_metadata  'Prag metadate invechite'
--     dashboard_expiring_amber  'Prag expirare curand (chihlimbar)'
--     documents_expiring_soon   'Fereastra filtru expira curand'
--     metadata_review_warning   'Varsta avertizare revizuire metadate'
--     id_card_expiring_soon     'Prag CI expira curand'
--     recency_badge_red         'Prag insigna recenta (rosu)'
--     recency_badge_amber       'Prag insigna recenta (chihlimbar)'
--     recency_badge_window      'Fereastra afisare insigna recenta'
--
-- WHERE THIS HAS TO BE APPLIED - THREE DATABASES, THREE DIFFERENT ANSWERS
--   Two adversarial rounds went at this paragraph and the first draft of it was
--   wrong in both directions, so it is written out rather than summarised.
--
--   1. DEV (ga40prj-postgres). `scripts\Apply-Migration.ps1`. Nothing else in
--      this list happens until this one has.
--
--   2. CIPRIAN'S UAT BOX. Nothing to do - and NOT because it runs the
--      migrations. It does not: his database is rebuilt from
--      `build-ciprian-image.ps1`, whose Step 5 `pg_dump --data-only`s the
--      reference tables live out of dev, and `$refTablePatterns` there names
--      `time_frame_setting` explicitly - added by name because the `lookup_*`
--      pattern silently left it out, and his UAT had run for sixty-three
--      migrations on the hard-coded fallbacks in src/lib/time-frames/config.ts
--      without anything saying so. So the corrected Romanian reaches him on the
--      next image build, out of dev, automatically. What DOES bite: that
--      script's Step 0.5 refuses to build while dev has an unapplied migration,
--      so from the moment this file exists in src/db/ every Ciprian build is
--      blocked until step 1 above has been done.
--
--   3. THE SUPABASE / VERCEL PROJECT. By hand, in the SQL Editor, exactly as
--      migration_063's own header says. ⚠️ **THE FULL-RESET CLOUD SYNC WILL NOT
--      CARRY IT, AND DOES NOT CARRY THESE ROWS AT ALL**:
--      `scripts/supabase-sync.ts` runs exactly two SQL files -
--      `supabase_reset.sql` then the DDL-only `supabase_schema_full.sql`, which
--      contains no INSERT - and `src/db/seed.ts`, which runs after them, never
--      mentions `time_frame_setting`. A full reset therefore leaves this table
--      EMPTY on Supabase rather than stale: the Settings screen renders no
--      time-frame rows at all and the rest of the application falls back to
--      TIME_FRAME_DEFAULTS. That gap is older than this slice and is not closed
--      here; it is noted so that "the Settings list is empty on the cloud" is
--      recognised as that gap and not as a regression from this file.
--
-- THE SECOND COPY OF THIS TEXT, AND THE TEST THAT KEEPS THEM TOGETHER
--   src/db/supabase_repair_missing_tables.sql seeds the same ten rows, and is
--   updated in the same commit. That script is the repair path for a database
--   that is MISSING tables (scripts/verify-rebuild.ts exercises it); its
--   `ON CONFLICT (key) DO NOTHING` makes it a no-op against a database that
--   already holds these ten keys, so it can never repair the text on its own -
--   but a database rebuilt from empty through it would otherwise have been born
--   with the diacritic-free spelling, which is why it is corrected here too.
--   src/__tests__/romanian-diacritics.test.ts now reads both files and fails
--   when the two disagree, so the pair cannot drift again.
--
-- Idempotent: plain UPDATEs to fixed literals. Re-running writes the same text.

BEGIN;

-- ⚠️ **EVERY TABLE NAME BELOW IS BARE, SO THE SEARCH PATH IS PINNED**, exactly
-- as migration_073 does and for its measured reason: the Supabase SQL Editor -
-- which is how point 3 above applies this file - sets its own `search_path`,
-- and migration_070 measured an unqualified statement counting rows in one
-- schema and writing to another while reporting success. `pg_temp` is named
-- LAST because for RELATIONS it is searched implicitly and AHEAD of everything
-- listed unless it is placed by hand; naming only `pg_catalog, public` pins
-- nothing about a bare table name. See migration_073:111-137 for the
-- measurement, both directions of it.
SET LOCAL search_path = pg_catalog, public, pg_temp;

-- 1. The ten rows ------------------------------------------------------------

UPDATE time_frame_setting SET
  label_ro       = 'Fereastră activitate recentă',
  description_ro = 'Cât de departe privește contorul "Recente" de pe panou'
WHERE key = 'dashboard_recent_days';

UPDATE time_frame_setting SET
  label_ro       = 'Orizont documente ce expiră',
  description_ro = 'Cât de departe scanează panoul pentru documente ce expiră'
WHERE key = 'dashboard_expiring_docs';

UPDATE time_frame_setting SET
  label_ro       = 'Prag metadate învechite',
  description_ro = 'Metadatele mai vechi decât această valoare sunt marcate ca învechite'
WHERE key = 'dashboard_stale_metadata';

UPDATE time_frame_setting SET
  label_ro       = 'Prag expirare curând (chihlimbar)',
  description_ro = 'Documentele care expiră în această perioadă devin chihlimbar pe panou'
WHERE key = 'dashboard_expiring_amber';

UPDATE time_frame_setting SET
  label_ro       = 'Fereastră filtru expiră curând',
  description_ro = 'Fereastra folosită de filtrul "Expiră curând" din lista Documente'
WHERE key = 'documents_expiring_soon';

UPDATE time_frame_setting SET
  label_ro       = 'Vârstă avertizare revizuire metadate',
  description_ro = 'Câmpurile de metadate mai vechi decât această valoare afișează un avertisment'
WHERE key = 'metadata_review_warning';

UPDATE time_frame_setting SET
  label_ro       = 'Prag CI expiră curând',
  description_ro = 'Zile înainte de expirare pentru a avertiza că CI-ul expiră'
WHERE key = 'id_card_expiring_soon';

UPDATE time_frame_setting SET
  label_ro       = 'Prag insignă recentă (roșu)',
  description_ro = 'Entitățile actualizate în această perioadă primesc o insignă "Nou!" roșie'
WHERE key = 'recency_badge_red';

UPDATE time_frame_setting SET
  label_ro       = 'Prag insignă recentă (chihlimbar)',
  description_ro = 'Entitățile actualizate în această perioadă primesc o insignă chihlimbar'
WHERE key = 'recency_badge_amber';

UPDATE time_frame_setting SET
  label_ro       = 'Fereastră afișare insignă recentă',
  description_ro = 'Entitățile actualizate în această perioadă afișează o insignă de recență'
WHERE key = 'recency_badge_window';

-- 2. Say what happened --------------------------------------------------------
--
-- A result set and not a RAISE NOTICE, for the reason migration_073 measured:
-- the Supabase SQL Editor renders result sets and not notices, so a NOTICE is
-- invisible on the path the cloud project is applied through.
--
-- `without_diacritics` counts rows whose Romanian label or description still
-- contains none of ă â î ș ț. Every one of the ten strings above carries at
-- least one, so on a database this migration has just run the count is 0. It is
-- NOT an assertion: on an empty database `total_rows` is 0 too, and both zeros are
-- correct. The comma-below spellings are the ones tested for on purpose - a
-- cedilla ş/ţ would count as missing, which is the right answer for this table.
SELECT
  (SELECT count(*) FROM time_frame_setting) AS total_rows,
  (SELECT count(*) FROM time_frame_setting
     WHERE label_ro       !~ '[ăâîșț]'
        OR description_ro !~ '[ăâîșț]')     AS without_diacritics,
  'Settings shows label_ro/description_ro whenever the interface is Romanian' AS note;

COMMIT;
