-- migration_083_tarla_code_unique.sql
-- Slice #34.32 - two tarla codes can no longer fold to one.
--
-- WHY 083 AND NOT 081. Slice #34.32's own description says the number is not
-- 081 "because this document says so": 34.30 and 34.31 each add one, and the
-- rule is to LIST `src/db/migration_0*.sql` and take the next number that
-- actually is free. Listed on the tip of `main` at the time this was written:
-- the chain ends at `migration_082_lookup_tarla_origin_comment.sql`, so 083 is
-- the free number and 083 is what this file takes.
--
-- WHAT THIS DOES
--   One partial unique index on `lookup_tarla`, over the FOLDED `indicativ`,
--   excluding the folded form that is empty. Nothing else: no column, no
--   table, no data change. Section 1 refuses to run if the archive already
--   holds a pair the index would reject, and names the pair.
--
-- WHY IT EXISTS, AND WHY IT IS THE INDEX migration_078 DECLINED
--   `lookup_tarla` has SIX writers of the `indicativ` column - three in the
--   running application and three in the seeds - and until this slice not one
--   of them was bound by the database. Enumerated for this file rather than
--   remembered, with `grep -rn 'lookupTarla\|lookup_tarla' src/db src/lib` and
--   the results filtered to WRITES.
--
--   ⚠️ **THE COUNT HAS BEEN WRONG TWICE AND BOTH TIMES IN THE SENTENCE THAT
--   CLAIMED IT WAS MEASURED.** It said FOUR and then named
--   `sync-reference-data.sql` as a fifth two hundred lines below; corrected to
--   FIVE, it still left out `updateValue`'s rename door - the one whose absence
--   matters most, because a rename is how a twin is made without a create.
--
--   TWO further statements write this table and are deliberately NOT among the
--   six, for two DIFFERENT reasons - both stated rather than silent, because a
--   reader re-running the grep will find them:
--     * `supabase_repair_missing_tables.sql`'s `UPDATE lookup_tarla SET
--       origin = 'MANUAL' WHERE origin IS NULL` never touches `indicativ`, so
--       it cannot reach this index at all.
--     * `scripts/supabase-sync.ts` DOES write `indicativ` - it TRUNCATEs and
--       re-copies every row into the cloud - and it is outside the scope this
--       paragraph's grep declares (`src/db src/lib`). It is accounted for in
--       THE OTHER DOORS section below, as NO CHANGE: it resolves its column
--       list from the catalogue and copies rows that were already unique on
--       the source database, so it can only reproduce a collision it was
--       given, never invent one.
--
--     * Reference Data's "Adauga", through `createValue`
--       (src/lib/admin/value-lists/queries.ts). It took no lock and applied
--       no fold, so an administrator typing `t3` beside an existing `T3` made
--       the twin pair with no race at all. ⚠️ **AND SO DID `updateValue`, WHICH
--       IS THE SAME DOOR FACING THE OTHER WAY:** renaming `T4` to `t3` beside
--       an existing `T3` is the same two rows with the same one code, arrived
--       at from the other side, and a guard on the create door alone would be
--       a lock on a door with the window open beside it. Both branches now go
--       through `writeTarlaRow`. Slice #34.32 gives them the fold, and
--       the SAME two advisory locks the auto-seed takes - without those the two
--       doors serialise against themselves and not against each other, and the
--       loser of an import-versus-administrator race gets this index's 23505
--       where nothing maps it. #34.14's handover says so in as
--       many words: "Reference Data's 'Adauga' still mints tarla twins with no
--       fold and no lock - t3 beside T3. Older than this slice; the unique
--       index migration_078 declines is the real fix."
--     * `resolveTarlaForCreate` (src/lib/properties/queries.ts), the import's
--       auto-seed, which DOES fold (`cadastralKey`) and DOES take an advisory
--       lock on the folded code (#34.14). That one has been closed against
--       itself since #34.14 - but a lock in one process closes nothing against
--       the other door, and nothing at all against `psql`.
--
--       ⚠️ **AND ITS FOLD IS NOT THIS ONE, WHICH IS WHY IT NEEDED A SECOND
--       PASS RATHER THAN NOTHING.** `cadastralKey` applies `perToSlash` before
--       folding and that regex knows nothing about diacritics, so it is not a
--       coarsening of `ga40_fold`. Measured: a stored row `47PER2` (typed into
--       Reference Data, which writes `indicativ` verbatim) and an import value
--       of `47pér2` key as `47/2` and `47per2` - a MISS for the scan - while
--       both fold to `47per2` here - ONE CODE for this index. Left as it was,
--       an import would miss on its own fold, insert, and die on THIS index:
--       an import failing on a spelling. Slice #34.32 makes it scan under both
--       folds and ADOPT, so it can never reach this index with a row the index
--       rejects. The decision, and why an import adopts where a person is
--       refused, is stated at length in that function's header.
--
--     * `src/db/sync-reference-data.sql`, which TRUNCATEs the lookup family and
--       re-seeds `T1` .. `T10`. Ten distinct folds, and a TRUNCATE means it
--       never inserts beside anything, so it needs no change - but it is a
--       writer, and the doors section below carries the measurement.
--
--     * `src/db/seed.ts` (the properties fixture) and
--       `src/db/seed_dev_data.sql`, which both looked a code up by EXACT
--       equality before inserting it. Merely untidy while nothing was
--       enforced; a failed seed once this index exists, on a database whose
--       reference-data load spelled a code differently from the fixture. Both
--       now match by this fold and adopt. `src/db/sync-reference-data.sql`
--       needs no change for a different reason - see the doors section below.
--
--   migration_078 declined this index and gave three reasons. #34.09 retracted
--   the first (a permanent IMMUTABLE function is not needed - every operator
--   here is IMMUTABLE in PostgreSQL 16, so the fold inlines) and 078's header
--   now says so. The other two were "an admin form's second 'T1' would become
--   a 23505 needing a friendly refusal" and "uniqueness would change what a
--   code MEANS". This slice answers the first by building the refusal
--   (`src/lib/properties/tarla-code-guard.ts` and both value-lists routes) and
--   accepts the second deliberately: a tarla code IS an identity now, because
--   `property.tarla_id` has been a foreign key at this table since
--   migration_078.
--
-- ---------------------------------------------------------------------------
-- THE EXPRESSION IS `pg_temp.ga40_fold`, INLINED - AND IT IS NOT
-- migration_080's FOLD
-- ---------------------------------------------------------------------------
--
-- `pg_temp.ga40_fold` (scripts/decision-checks.sql, copied character for
-- character into migration_078 section 1) is the Postgres spelling of
-- `foldRomanian` (src/lib/import/id-card.ts): NFD-decompose, strip the
-- combining marks by CODE POINT, lowercase, collapse whitespace, trim. That is
-- the fold `lookup_tarla` has been measured under - `decision-checks.sql`
-- query 1c groups by exactly it - and it is the one this index uses, inlined
-- for the reason migration_080's header gives.
--
-- ⚠️ **IT IS DELIBERATELY NOT `ga40_norm_name`, WHICH IS migration_080's.**
-- That one additionally drops everything outside `[a-z0-9]`, which is right
-- for a document type's DISPLAY NAME and wrong here: a tarla code is `47/2`,
-- `48-50d`, `99/9`, and stripping the separators would make `47/2` and `472`
-- one code and refuse the second. Two codes that differ by a slash are two
-- codes. The slice's own instruction is "copy both shapes; do not invent a
-- third fold" - so the SHAPE is migration_080's and the FOLD is 078's.
--
-- ⚠️ **AND IT IS NOT `cadastralKey` EITHER**, which is what the import's
-- auto-seed matches with (`foldRomanian(perToSlash(x))` with whitespace
-- removed). That fold is LOOSER on purpose: it must CHOOSE, and choosing
-- `47/2` for a folder that wrote `47per2` is right. An index must REFUSE, and
-- refusing `47per2` because `47/2` exists would refuse a code that reads
-- differently to a person. The application side is where the looser fold
-- belongs, and Slice #34.32 makes `resolveTarlaForCreate` adopt under BOTH
-- folds so the import can never arrive at this index with a row it would
-- reject - see that function's header for why "looser" is not automatically
-- "safer" here.
--
-- ⚠️ **`coalesce(indicativ, '')` is a provable no-op and is kept anyway** -
-- `lookup_tarla.indicativ` is NOT NULL (`src/db/schema/index.ts`) - for
-- migration_080's reason: it is in `ga40_fold`, and removing it would make the
-- index's text differ from the text the evidence was gathered over for no
-- gain.
--
-- ⚠️ **`lower()` IS COLLATION-DEPENDENT AND IS KEPT**, exactly as
-- migration_080 keeps it and for the same stated reason: it is what
-- `decision-checks.sql` used and therefore what this table was measured under.
-- A `REINDEX` after a collation change is the remedy, and it is the remedy
-- every text index in this database already needs.
--
-- ---------------------------------------------------------------------------
-- WHY THE EMPTY FOLDED FORM IS EXCLUDED
-- ---------------------------------------------------------------------------
--
-- `tarlaSchema` is `indicativ: z.string().min(1)`, so a SINGLE SPACE is a
-- valid payload and folds to the empty string. A TOTAL unique index would give
-- the first such row the empty slot and refuse every other one - migration_080
-- makes the same argument about a punctuation-only document-type name, and the
-- application-side guard inherits the exception rather than restating it
-- (`sameTarlaCode` in src/lib/properties/tarla-code-guard.ts answers false for
-- two empty folds).
--
-- ⚠️ **NOTE WHAT THAT DOES AND DOES NOT MEAN.** `ga40_fold` does not strip
-- punctuation, so a code of `-` folds to `-` and IS covered by this index;
-- only whitespace folds away. The excluded set is therefore much smaller here
-- than it is for document types, and section 4 reports its size rather than
-- leaving the reader to assume it is empty.
--
-- ---------------------------------------------------------------------------
-- THE MEASUREMENT, AND WHY SECTION 1 TAKES IT
-- ---------------------------------------------------------------------------
--
-- `scripts/decision-checks.sql` query 1c is this question, already written:
-- "Duplicate codes inside lookup_tarla", grouped by `pg_temp.ga40_fold`. It is
-- described there as "the pairs 33.03 item 11 describes: neither deletable nor
-- movable".
--
-- ⚠️ **1c DOES NOT EXCLUDE THE EMPTY FOLD AND SECTION 1 DOES**, which is the
-- one place the two deliberately differ: 1c is a report about the table and
-- this is a pre-flight for a PARTIAL index, so a pair of whitespace-only codes
-- is a finding for the first and is not an obstacle to the second. Counting it
-- here would refuse a database over rows the index does not cover.
--
-- ⚠️ **AND THIS FILE MEASURES RATHER THAN TRUSTING A REPORT**, for
-- migration_080's reason: `migrationChain()` in `scripts/verify-rebuild.ts`
-- globs `src/db/migration_*.sql` and applies every match in name order, so
-- this runs on the rebuild chain, on the cloud project, on Ciprian's UAT box
-- and on whatever Adrian's dev database has become. A bare
-- `CREATE UNIQUE INDEX` on a colliding table fails with an unreadable
-- `could not create unique index ... Key (...)=(...) is duplicated` naming the
-- folded form and NEITHER of the two rows. Section 1 asks first and names both
-- rows, their ids and how many properties point at each - which is the
-- information the person resolving it actually needs.
--
-- ⚠️ **REFUSING IS THE RIGHT ANSWER AND MERGING WOULD NOT BE.** Two codes that
-- fold to one may both have properties pointing at them, and deciding which
-- row survives is a business question with an owner one room away - the same
-- answer migration_078 section 3 gives to the same pair, and migration_080
-- section 1 to its own. The slice's out-of-scope says it outright: "this slice
-- stops new twins, it does not clean up old ones."
--
-- ---------------------------------------------------------------------------
-- THE OTHER DOORS INTO A DATABASE
-- ---------------------------------------------------------------------------
--
--   * `src/db/schema/index.ts` - declares the index in the same commit as this
--     file, as `uniqueIndex(...).on(sql`...`).where(sql`...`)`. Drizzle is not
--     what creates it here (this project applies migrations by hand through
--     `scripts\Apply-Migration.ps1`), so the declaration is the CODE-side
--     record; the shape is `lookup_document_type_name_normalised_unique`'s,
--     one table over.
--   * `src/db/supabase_repair_missing_tables.sql` - the ADDITIVE door. Section
--     8 gains a guarded block that creates this index when it is absent, and
--     section 10 gains its post-flight WARNING. It cannot be a bare
--     `CREATE UNIQUE INDEX IF NOT EXISTS`: that file runs under `psql -f` with
--     no `ON_ERROR_STOP`, so a failure on colliding data would scroll past and
--     the final line would still say OK. #34.09's block for migration_080 is
--     the shape, including the probe by SHAPE rather than by NAME.
--   * `src/db/supabase_schema_full.sql` - GENERATED, and the FIRST thing to do
--     after applying this file. Regenerate with
--     `scripts\Export-SupabaseSchema.ps1`, then re-baseline
--     `src/db/rebuild-known-differences.txt`.
--
--     ⚠️ **TWO THINGS ARE BROKEN UNTIL THAT HAPPENS**, exactly as they were
--     for migration_080 and for the same two reasons: (1)
--     `scripts/verify-rebuild.ts` step 3 reports the index and its
--     `COMMENT ON INDEX` as absent from the baseline, so the `DB rebuild`
--     workflow is red on every push; (2) `scripts/supabase-sync.ts` rebuilds
--     the cloud from `supabase_reset.sql` plus that file, so a SYNCED SUPABASE
--     PROJECT HAS NO INDEX AT ALL until it is regenerated. It runs the new
--     code, so the application-level refusal still fires, the auto-seed still
--     adopts, and the two advisory locks both writers take serialise them
--     against each other - so what is missing there is narrower than "the
--     race": it is any writer that takes no lock at all, which means a direct
--     `psql` session or a script. (⚠️ This sentence read "what is missing
--     there is the race, silently" and an adversarial round caught it
--     answering the same question two ways twenty lines apart from the
--     deploy-order paragraph below.)
--   * `src/db/sync-reference-data.sql` - checked, NO CHANGE NEEDED, and the
--     reason is a measurement rather than an absence. It DOES seed
--     `lookup_tarla`: ten rows, `T1` through `T10`, after a TRUNCATE of the
--     whole lookup family. Under this fold those are `t1` .. `t10` - ten
--     distinct values, no collision - and the TRUNCATE means it never inserts
--     beside anything. Named here with the count so the next reader does not
--     re-derive it, and so that an eleventh code added to that block has
--     somewhere to be checked against.
--   * `scripts/supabase-sync.ts`, `src/db/supabase_reset.sql`,
--     `scripts/closed-list-review.sql` - NO CHANGE. The first TRUNCATEs and
--     re-copies rows and resolves its column list from the catalogue, so it
--     writes `indicativ` but only ever reproduces the source database's rows -
--     it can carry a collision across, never invent one, and the source is a
--     database this migration has run on; the second drops by catalogue walk
--     and takes indexes with the table; the third's closed vocabularies
--     exclude tarla codes, which are an open list by definition.
--
-- ⚠️ **APPLY THIS WITH OR AFTER THE DEPLOY, NEVER BEFORE IT - AND THAT IS THE
--   OPPOSITE OF WHAT migration_080 COULD SAY ABOUT ITSELF.** An adversarial
--   round caught this paragraph claiming "there is no unsafe order", on the
--   grounds that the import's auto-seed "cannot reach the index at all, because
--   it adopts an existing row before it inserts". That is true of the auto-seed
--   Slice #34.32 ships and false of the one that is deployed until it lands.
--
--   OLD CODE, NEW INDEX - the unsafe combination. The old
--   `resolveTarlaForCreate` scans under `cadastralKey` ALONE, which is not a
--   coarsening of this index's fold: with a stored row `47PER2` and a folder
--   value `47pér2` it misses (`47/2` vs `47per2`), inserts, and this index
--   refuses it - an import dying on a 23505 nothing maps. The old Reference
--   Data door is worse in the ordinary case: it applies no fold at all, so
--   every `t3` beside `T3` becomes a 23505 that reaches an administrator as the
--   generic Romanian "operation failed".
--
--   NEW CODE, OLD SCHEMA - safe. The application-level refusal in
--   `tarla-code-guard.ts` still fires and the auto-seed still adopts; what is
--   missing is only the race those cannot close, and the advisory locks both
--   writers now take cover that between the two application doors anyway.
--
--   So: deploy, then apply. Applying it in the same window is fine; applying
--   it to a box running the previous build is not.
--
-- ---------------------------------------------------------------------------
--
-- Idempotent: section 1's count is a read, `CREATE UNIQUE INDEX IF NOT EXISTS`
-- is a no-op on a second run, and section 3's COMMENT is idempotent by
-- definition.
--
-- WRAPPED IN A TRANSACTION
--   `scripts\Apply-Migration.ps1` feeds this file to `psql -f` with
--   `ON_ERROR_STOP=1` and no `--single-transaction`, so without a BEGIN each
--   statement commits on its own. The BEGIN means section 1's refusal rolls
--   back rather than leaving a `COMMENT` from a partially-run file.
--   (`CREATE INDEX CONCURRENTLY` cannot run inside a transaction block and is
--   deliberately not used: this is a lookup table of a few dozen rows, the
--   build is instantaneous, and the SHARE lock it takes blocks writes to
--   reference data for that instant on a single-user archive.)

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Ask first - is this database one the index can be created on?
-- ---------------------------------------------------------------------------
--
-- One refusal, naming the rows. There is deliberately NO check for
-- whitespace-only codes: those are what the partial index excludes, so they
-- are not an obstacle, and counting them here would read as though they were.

DO $$
DECLARE
  n_groups integer;
  detail   text;
BEGIN
  SELECT count(*) INTO n_groups FROM (
    SELECT btrim(regexp_replace(
             regexp_replace(
               lower(normalize(coalesce(indicativ, ''), NFD)),
               '[' || chr(768) || '-' || chr(879) || ']', '', 'g'),
             '\s+', ' ', 'g')) AS folded
      FROM lookup_tarla
     GROUP BY 1
    HAVING count(*) > 1
       AND btrim(regexp_replace(
             regexp_replace(
               lower(normalize(coalesce(indicativ, ''), NFD)),
               '[' || chr(768) || '-' || chr(879) || ']', '', 'g'),
             '\s+', ' ', 'g')) <> ''
  ) g;

  IF n_groups = 0 THEN
    RAISE NOTICE 'migration_083: no tarla code collides under the code fold - the index can be created.';
    RETURN;
  END IF;

  -- Every colliding row, with the count of properties pointing at it, so the
  -- person resolving this can see which of a pair is the one to keep. This is
  -- query 1c of scripts/decision-checks.sql with the property count added and
  -- the empty fold excluded, rendered into one string because a RAISE cannot
  -- return a result set.
  SELECT string_agg(line, E'\n         ' ORDER BY line) INTO detail FROM (
    SELECT t.folded || '  ' || t.id::text || ' = "' || t.indicativ || '"  ('
           || t.n_props || ' propert' || CASE WHEN t.n_props = 1 THEN 'y' ELSE 'ies' END
           || ')' AS line
      FROM (
        SELECT lt.id, lt.indicativ,
               btrim(regexp_replace(
                 regexp_replace(
                   lower(normalize(coalesce(lt.indicativ, ''), NFD)),
                   '[' || chr(768) || '-' || chr(879) || ']', '', 'g'),
                 '\s+', ' ', 'g')) AS folded,
               -- ⚠️ **READ THROUGH `to_jsonb`, DELIBERATELY, AND IT COSTS
               -- NOTHING.** `property.tarla_id` is migration_078's column, and
               -- this file is written to be hand-applied to a box that may not
               -- have run 078 yet - which is exactly the audience section 1
               -- exists for. PL/pgSQL plans this query only when a collision
               -- has actually been found, so a bare `p.tarla_id` would replace
               -- the readable refusal with `column p.tarla_id does not exist`
               -- on the one run where the refusal is the point.
               -- `scripts/decision-checks.sql` reads the same column the same
               -- way for the same reason; see its query 1b.
               (SELECT count(*) FROM property p
                 WHERE (to_jsonb(p) ->> 'tarla_id') = lt.id::text) AS n_props
          FROM lookup_tarla lt
      ) t
     WHERE t.folded <> ''
       AND EXISTS (
         SELECT 1 FROM lookup_tarla t2
          WHERE t2.id <> t.id
            AND btrim(regexp_replace(
                  regexp_replace(
                    lower(normalize(coalesce(t2.indicativ, ''), NFD)),
                    '[' || chr(768) || '-' || chr(879) || ']', '', 'g'),
                  '\s+', ' ', 'g')) = t.folded
       )
  ) x;

  RAISE EXCEPTION E'migration_083 REFUSED: % group(s) of tarla codes fold to one code, so the unique index cannot be created.\n         %\n         Decide, per group, which row survives and move the other row''s properties onto it from Administration -> Reference Data -> Indicativ tarla, then re-run this migration. Nothing has been changed.',
    n_groups, coalesce(detail, '(none)');
END $$;

-- ---------------------------------------------------------------------------
-- 2. The index
-- ---------------------------------------------------------------------------
--
-- ⚠️ **The expression appears TWICE and the two must stay identical.** Postgres
-- uses a partial index only when it can prove the query's predicate implies
-- the index's, and it compares the two expressions structurally - so a WHERE
-- clause that folded differently from the indexed expression would still
-- create, still enforce uniqueness over the rows it covers, and quietly cover
-- a different set of rows than it appears to. They are written out in full
-- rather than hidden behind a function for the reason the header gives.

CREATE UNIQUE INDEX IF NOT EXISTS lookup_tarla_indicativ_folded_unique
  ON lookup_tarla (
    (btrim(regexp_replace(
       regexp_replace(
         lower(normalize(coalesce(indicativ, ''), NFD)),
         '[' || chr(768) || '-' || chr(879) || ']', '', 'g'),
       '\s+', ' ', 'g')))
  )
  WHERE btrim(regexp_replace(
          regexp_replace(
            lower(normalize(coalesce(indicativ, ''), NFD)),
            '[' || chr(768) || '-' || chr(879) || ']', '', 'g'),
          '\s+', ' ', 'g')) <> '';

-- ---------------------------------------------------------------------------
-- 3. What the index means
-- ---------------------------------------------------------------------------

COMMENT ON INDEX lookup_tarla_indicativ_folded_unique IS
  'Two tarla codes may not fold to one code (Slice #34.32, migration_083). The expression is pg_temp.ga40_fold from scripts/decision-checks.sql - the Postgres spelling of foldRomanian() in src/lib/import/id-card.ts: NFD-decompose, strip the combining marks by code point, lowercase, collapse whitespace, trim - which is the fold this table was measured under by query 1c, and which migration_078 resolves property.tarla_sola with. It is deliberately NOT normaliseDocumentTypeName()''s fold (migration_080): that one drops everything outside [a-z0-9], which would make 47/2 and 472 one code. PARTIAL, excluding the empty folded form, because tarlaSchema accepts a single space as an indicativ and a total index would let the first whitespace-only row take the empty slot and refuse every other one. The application-level refusal that produces a Romanian sentence instead of a 23505 is tarlaCodeTakenBy() in src/lib/properties/tarla-code-guard.ts; the import auto-seed adopts an existing row rather than reaching this index, in resolveTarlaForCreate() in src/lib/properties/queries.ts, and both application writers hold the two advisory locks tarlaLockIdentities() returns so neither can land a colliding row while the other is between its scan and its insert. This index is what makes the rule true of a direct caller, a script, psql, and the race that a read-then-write refusal cannot close.';

-- ---------------------------------------------------------------------------
-- 4. What this database now holds
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  n_codes integer;
  n_empty integer;
BEGIN
  SELECT count(*) INTO n_codes FROM lookup_tarla;
  SELECT count(*) INTO n_empty FROM lookup_tarla
   WHERE btrim(regexp_replace(
           regexp_replace(
             lower(normalize(coalesce(indicativ, ''), NFD)),
             '[' || chr(768) || '-' || chr(879) || ']', '', 'g'),
           '\s+', ' ', 'g')) = '';

  RAISE NOTICE 'migration_083: lookup_tarla holds % code(s); % of them fold to nothing and are outside the index by design.',
    n_codes, n_empty;
END $$;

COMMIT;
