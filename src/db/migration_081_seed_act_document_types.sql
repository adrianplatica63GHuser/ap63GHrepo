-- migration_081_seed_act_document_types.sql
-- Slice #34.30 - the four act types reach the migration chain.
--
-- Seeds ACT_ADITIONAL, ACT_ALIPIRE, ACT_DEZLIPIRE and ACT_DEZMEMBRARE into
-- `lookup_document_type`. Nothing else: no column, no table, no rename, no
-- delete.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS SUPERSEDES IN migration_072'S HEADER, AND WHY THAT HEADER WAS NOT
-- EDITED INSTEAD
-- ---------------------------------------------------------------------------
--
-- ⚠️ **migration_072_seed_document_types.sql CANNOT BE EDITED, AND THAT IS THE
-- WHOLE REASON THIS FILE EXISTS.** Its MD5 is recorded in `schema_migrations`,
-- and `scripts/Apply-Migration.ps1` Step 4 compares every recorded checksum
-- against the file on disk and STOPS THE RUN on a mismatch. Changing even one
-- character of one comment would report every database as differing from the
-- repository, permanently, for ever. Slice #34.19 raised this through three
-- review rounds and left it; #34.30 is where it is paid off, additively.
--
-- TWO SENTENCES IN THAT HEADER ARE FALSE, AND THIS FILE IS WHERE THEY ARE
-- CORRECTED, BECAUSE THEY CANNOT BE CORRECTED WHERE THEY STAND:
--
--   1. „the two rebuild paths now AGREE about all forty types". ⚠️ **READ
--      LITERALLY THIS IS STILL TRUE OF THOSE FORTY, AND THAT IS THE TRAP** -
--      what it was asserting is that the two paths agree, full stop, and it
--      has not been able to say that since #34.19. It is now true of forty of
--      forty-four. Slice #34.19 added the four acts below to
--      `src/db/sync-reference-data.sql` and to `KNOWN_DOCUMENT_TYPES`, and
--      could not add them to 072 - so the seed has held FORTY-FOUR types and
--      the chain FORTY ever since, and the sentence has been wrong by exactly
--      these four rows. This migration makes it true again: forty-four on both
--      sides, and it is true of the CHAIN rather than of 072's own INSERT,
--      which is the only way it can now be made true.
--
--   2. „Regenerate rather than hand-edit if the catalogue grows again."
--      ⚠️ **DO NOT. THAT INSTRUCTION IS THE ONE THING THAT MUST NOT HAPPEN.**
--      072 is an APPLIED migration; regenerating it is a hand-edit by another
--      name, and Step 4 cannot tell the two apart. The catalogue grew again in
--      #34.19 and the correct answer was this file: a NEW, additive,
--      numbered migration. It is the answer next time too.
--
-- Everything else 072's header says is still correct, including the reasons it
-- gives for being additive, for not renaming, and for leaving `origin` alone -
-- all three of which this file follows.
--
-- ---------------------------------------------------------------------------
-- WHY THE NUMBER IS 081
-- ---------------------------------------------------------------------------
--
-- Not because anything said so: `src/db/migration_0*.sql` was listed and 080
-- (`migration_080_document_type_name_unique.sql`) is the highest that exists.
-- 058, 059 and 064 are free too and are NOT candidates - `migrationChain()`
-- applies files in NAME order, so a gap number would run before migrations
-- this file must follow. It must follow 072 (which seeds the other forty; out
-- of order, these four would be inserted and then joined by forty more, which
-- is harmless, but the ON CONFLICT reasoning below is written for the real
-- order) and it must follow 080, whose unique index over the normalised name
-- is what the per-row pre-check below is built around.
--
-- ---------------------------------------------------------------------------
-- THE FOUR ROWS ARE WRITTEN IN TWO OTHER FILES AND THIS ONE AGREES WITH BOTH
-- ---------------------------------------------------------------------------
--
--   * `scripts/add-document-types.sql` (Slice #34.09) created them against the
--     live `ga40db` by hand. It is DATA, not a migration - it lives outside
--     `src/db/` so that Apply-Migration.ps1 never sees it - and it writes NO
--     `sort_order`, so the live rows carry the column's DEFAULT 0.
--   * `src/db/sync-reference-data.sql` (Slice #34.19) seeds them for a rebuilt
--     cloud project, with sort_orders 40-43.
--
-- The KEYS below are those two files' keys, character for character; the NAMES
-- are theirs too, diacritics included.
-- `src/__tests__/document-type-catalogue-single-source.test.ts` reads this file
-- and both of those and fails when any of them drifts.
--
-- ⚠️ **THE `sort_order`s ARE 40-43 BECAUSE THAT IS WHAT MAKES THE REBUILD
-- DIFFERENCE CANCEL, AND ANY OTHER VALUE WOULD DOUBLE IT.**
-- `scripts/verify-rebuild.ts` compares reference rows as whole tuples - every
-- column except id/created_at/updated_at - so a row present on both sides with
-- a DIFFERENT sort_order is not one agreement, it is TWO differences: a `+`
-- line for the seed's value and a `-` line for the chain's. That is already
-- true of twenty of the forty shared document types, and
-- `src/db/rebuild-known-differences.txt` records every one of them. Seeding
-- these four with 0 (matching the live rows) or with nothing (the column
-- default, also 0) would turn four `+` lines into eight lines and make this
-- slice's baseline strictly worse. 40-43 makes them vanish.
--
-- The live rows keep their 0 and nothing corrects them, which is deliberate:
-- `listValues` (src/lib/admin/value-lists/queries.ts) orders document types by
-- the UNCLASSIFIED pin and then by NAME, and never reads sort_order for this
-- list, so the column decides nothing on any screen. Writing an UPDATE to
-- align live rows would be a data change in a slice that is meant to be purely
-- additive, to fix a number nothing displays.
--
-- ---------------------------------------------------------------------------
-- WHY THIS IS NOT `INSERT ... ON CONFLICT (key) DO NOTHING`, WHICH IS WHAT 072
-- USES ONE FILE OVER
-- ---------------------------------------------------------------------------
--
-- ⚠️ **BECAUSE migration_080 EXISTS AND 072 PREDATES IT.** 080 put a partial
-- UNIQUE index on `lookup_document_type` over the NORMALISED name. A bare
-- `ON CONFLICT (key)` only catches a collision on the KEY; a row already
-- holding one of these four NAMES under a DIFFERENT key raises 23505 on the
-- name index, uncaught, and the whole migration run dies there - on a database
-- where nothing is wrong except that somebody already has the type.
--
-- That is not a hypothetical. It is the documented behaviour of
-- `resolveClassifiedDocumentType`: before #34.19 whitelisted these keys, a
-- model answering „act de alipire" reached the row only through
-- `matchDocumentType` on the display label, and where no row existed the
-- resolver CREATED one from that label - `ACT_DE_ALIPIRE`, slugged with the
-- connector word the catalogue's style drops. Any database that ran an import
-- over one of these documents can be holding „Act de Alipire" under a key this
-- file does not use. `scripts/add-document-types.sql` was written with exactly
-- this in mind and checks both halves per row; so does this.
--
-- ⚠️ **A COLLISION SKIPS THE ROW AND WARNS. IT DOES NOT FAIL THE RUN.** A
-- migration that raises stops the whole run where it stands: Apply-Migration.ps1
-- Step 6 counts the failure and BREAKS, so nothing is recorded for this file,
-- every later migration is reported "Not attempted", and the next run arrives
-- at the same row and stops again. The archive is then parked behind a naming
-- question until a person answers it, and everything numbered above 081 is
-- parked with it. Skipping leaves the database exactly as it was, lets every
-- other migration through, and says so. Deciding which key the archive should
-- keep is a person's call either way - it is a rename, and a rename is
-- `migration_071`-shaped work, not a seed's.
--
-- The name fold is the inline expansion of `pg_temp.ga40_norm_name` from
-- `scripts/decision-checks.sql`, character for character the expression
-- migration_080 indexes and `scripts/add-document-types.sql` checks with. See
-- migration_080's header for why the two provable no-ops in it are kept.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DOES NOT GIVE YOU
-- ---------------------------------------------------------------------------
--
-- A form. All four land with `template_fields` NULL, exactly as 072's forty
-- did, so the first import over one of these folders still stops at the Slice
-- #29.08 gate - but it stops saying „this type needs a form", which
-- DocTypeEngine answers, instead of „this type does not exist", which nothing
-- on that screen can answer.
--
-- ⚠️ **`origin` IS LEFT AT ITS DEFAULT, WHICH IS 'MANUAL', AND THAT IS
-- CORRECT.** Slice #26.12's rule: origin says WHO CHOSE THE NAME. Adrian did,
-- in his own taxonomy, read out of his own folder names (Catalogue 33.04,
-- items 74, 77 and 78). Only `resolveClassifiedDocumentType` writes 'IMPORT'.
--
-- Apply locally:
--   docker cp src/db/migration_081_seed_act_document_types.sql ga40prj-postgres:/tmp/m081.sql
--   docker exec ga40prj-postgres psql -U postgres -d ga40db -f /tmp/m081.sql
-- Apply to Supabase: paste into SQL Editor.

BEGIN;

DO $$
DECLARE
  wanted CONSTANT text[][] := ARRAY[
    ARRAY['ACT_ADITIONAL',    'Act Adițional',       '40'],
    ARRAY['ACT_ALIPIRE',      'Act de Alipire',      '41'],
    ARRAY['ACT_DEZLIPIRE',    'Act de Dezlipire',    '42'],
    ARRAY['ACT_DEZMEMBRARE',  'Act de Dezmembrare',  '43']
  ];
  i          integer;
  w_key      text;
  w_name     text;
  w_sort     integer;
  clash_key  text;
  held_name  text;
  n_added    integer := 0;
  n_present  integer := 0;   -- already there, under the key this file wants
  n_drift    integer := 0;   -- there under the right key but a name that only
                             -- MATCHES ONCE FOLDED: nothing to write, something
                             -- to tell somebody
  n_skipped  integer := 0;   -- there under a DIFFERENT key, or the key is held
                             -- by a different name: a person has to choose
BEGIN
  FOR i IN 1 .. array_length(wanted, 1) LOOP
    w_key  := wanted[i][1];
    w_name := wanted[i][2];
    w_sort := wanted[i][3]::integer;

    -- Does any row already hold this NAME, under any key? Checked with the
    -- same fold migration_080 indexes, so this reports a resolvable situation
    -- instead of dying on a 23505 that names a normalised string and neither
    -- row.
    SELECT key INTO clash_key
      FROM lookup_document_type
     WHERE regexp_replace(
             btrim(regexp_replace(
               regexp_replace(
                 lower(normalize(coalesce(name, ''), NFD)),
                 '[' || chr(768) || '-' || chr(879) || ']', '', 'g'),
               '\s+', ' ', 'g')),
             '[^a-z0-9]', '', 'g')
           = regexp_replace(
               btrim(regexp_replace(
                 regexp_replace(
                   lower(normalize(w_name, NFD)),
                   '[' || chr(768) || '-' || chr(879) || ']', '', 'g'),
                 '\s+', ' ', 'g')),
               '[^a-z0-9]', '', 'g')
     LIMIT 1;

    IF clash_key IS NOT NULL THEN
      IF clash_key = w_key THEN
        -- ⚠️ **THE MATCH ABOVE IS ON THE FOLD, SO "unchanged" HAS TO BE CHECKED
        -- AND NOT ASSUMED.** `Act Aditional` (no diacritic) and `act aditional`
        -- both fold onto `Act Adițional` and would otherwise be reported as
        -- already there and unchanged, while the row differs from the one
        -- `sync-reference-data.sql` seeds - which is the same
        -- two-baselined-differences drift the sort_order paragraph in the
        -- header is about, in the other column. Nothing is written either way:
        -- the key is right, the classifier resolves against it, and correcting
        -- a display name a person may have chosen is not a seed's business.
        SELECT name INTO held_name FROM lookup_document_type WHERE key = w_key;
        IF held_name = w_name THEN
          n_present := n_present + 1;
          RAISE NOTICE 'migration_081: % = "%" is already there, unchanged.', w_key, w_name;
        ELSE
          -- ⚠️ **COUNTED SEPARATELY, NOT AS "already present", AND THE SIBLING
          -- SCRIPT IS WHY.** scripts/add-document-types.sql carries a comment
          -- recording the adversarial round that caught exactly this: a row
          -- needing a human choice counted into the clean bucket, so the
          -- SUMMARY - which is what an operator reads - reported it as a
          -- no-op. The first version of THIS branch reproduced it, and ended
          -- a run holding a drifted row on "Nothing needs a decision."
          n_drift := n_drift + 1;
          RAISE WARNING 'migration_081: % is already there but is named "%" where the seed says "%" - the two only match once folded. Nothing written. Rename it from Reference Data if the seed is right; until then this row differs from a rebuilt project''s.',
            w_key, held_name, w_name;
        END IF;
      ELSE
        n_skipped := n_skipped + 1;
        RAISE WARNING 'migration_081: "%" already exists under the key % rather than %. Nothing written for this one, and the rest of this migration continues. Decide which key the archive should keep; a rename is migration_071-shaped work, not a seed.',
          w_name, clash_key, w_key;
      END IF;
      CONTINUE;
    END IF;

    -- And does any row already hold this KEY, under a different name? (The
    -- name check above has already ruled out "same key, same name".)
    IF EXISTS (SELECT 1 FROM lookup_document_type WHERE key = w_key) THEN
      n_skipped := n_skipped + 1;
      RAISE WARNING 'migration_081: the key % is already held by a row with a DIFFERENT name. Nothing written for this one, and the rest of this migration continues.', w_key;
      CONTINUE;
    END IF;

    INSERT INTO lookup_document_type (key, name, sort_order) VALUES (w_key, w_name, w_sort);
    n_added := n_added + 1;
    RAISE NOTICE 'migration_081: created % = "%" (sort_order %).', w_key, w_name, w_sort;
  END LOOP;

  IF n_skipped > 0 OR n_drift > 0 THEN
    -- ⚠️ **THIS RUN EXITS 0 AND Apply-Migration.ps1 COUNTS IT UNDER "Applied"
    -- WITH "Failed : 0" UNDERNEATH IT**, so the summary an operator actually
    -- reads is green while a key the classifier can now answer has no row. A
    -- RAISE WARNING is not an error under ON_ERROR_STOP=1. The warning
    -- therefore carries the query and the consequence rather than only the
    -- count - it is the last chance this condition has to be seen.
    RAISE WARNING 'migration_081: % created, % already present as asked, % SKIPPED and needing a decision, % present under a name that only matches once folded. This migration still succeeded and will never run again (Apply-Migration.ps1 records it, Step 4 verifies it), so nothing else will raise this. A SKIPPED row means the key the archive holds is not the canonical one, and every type-config carve-out written for the canonical key silently never fires on those documents. A DRIFTED row is not that and is the milder of the two: its key IS canonical and every carve-out fires, but its display name differs from the one a rebuilt project seeds. Run:  SELECT key, name FROM lookup_document_type WHERE key IN (''ACT_ADITIONAL'',''ACT_ALIPIRE'',''ACT_DEZLIPIRE'',''ACT_DEZMEMBRARE'') OR name ~* ''(adi(t|ț)ional|alipire|dezlipire|dezmembrare)'' ORDER BY key;',
      n_added, n_present, n_skipped, n_drift;
  ELSE
    RAISE NOTICE 'migration_081: % created, % already present and unchanged. Nothing needs a decision.',
      n_added, n_present;
  END IF;
END $$;

COMMIT;

-- Verify ------------------------------------------------------------------
-- On a database built by replaying the chain: expect 44 rows in the
-- catalogue, and these four present with sort_orders 40-43, no form, and
-- origin 'MANUAL'. ⚠️ **ON THE LIVE ga40db THE SORT_ORDERS WILL BE 0, NOT
-- 40-43, AND THAT IS NOT A FAILURE** - scripts/add-document-types.sql created
-- those rows without the column and this file reports them as already present
-- rather than correcting them. The paragraph at the end says why.
--
--   SELECT key, name, sort_order, origin,
--          (template_fields IS NOT NULL) AS has_form
--   FROM   lookup_document_type
--   WHERE  key IN ('ACT_ADITIONAL', 'ACT_ALIPIRE', 'ACT_DEZLIPIRE', 'ACT_DEZMEMBRARE')
--   ORDER  BY key;
--
--   SELECT count(*) FROM lookup_document_type;   -- 44
--
-- On the LIVE ga40db these four already exist with sort_order 0, put there by
-- scripts/add-document-types.sql; this file reports them as already present
-- and writes nothing. That 0-against-40 difference is between the live
-- database and the repository's seed, not between the two rebuild paths, and
-- nothing reads the column - see the sort_order paragraph in the header.
