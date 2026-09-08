-- migration_080_document_type_name_unique.sql
-- Slice #34.09 - two document types can no longer share one display name.
--
-- WHAT THIS DOES
--   One partial unique index on `lookup_document_type`, over the NORMALISED
--   name, excluding the normalised form that is empty. Nothing else: no
--   column, no table, no data change. Section 1 refuses to run if the archive
--   already holds a pair the index would reject, and names the pair.
--
-- WHY IT IS REFERENCE-DATA INTEGRITY AND NOT DOCUMENT-TYPE WORK
--   The create door performs NO name check at all. `createValue`'s own comment
--   says so in as many words (`src/lib/admin/value-lists/queries.ts`): the
--   duplicate-name refusal lives in the CLIENT - `sameTypeName` in the
--   discovery review dialog, against a react-query list that may be five
--   minutes old - so a second type with one display name is reachable through
--   a STALE LIST rather than through a race, and no lock can serialise against
--   a check nobody is making. #29.06 wrote that sentence and put the index in
--   its handover; this is that index.
--
--   The code half of the slice adds the server-side refusal
--   (`documentTypeNameTakenBy`, src/lib/documents/document-type-name-guard.ts)
--   so an administrator gets a Romanian sentence instead of a 23505. THIS FILE
--   is what makes the rule true of the DATABASE - of a direct caller, of a
--   script, of `psql`, and of the race the refusal cannot close because it is a
--   read and then a write.
--
-- ---------------------------------------------------------------------------
-- THE EXPRESSION IS THE CODE'S OWN NORMALISATION, COPIED, AND THE COPY IS
-- CHARACTER FOR CHARACTER THE ONE THAT MEASURED THIS DATABASE
-- ---------------------------------------------------------------------------
--
-- `normaliseDocumentTypeName` (src/lib/documents/document-type-match.ts) is:
-- NFD-decompose, strip the combining marks, lowercase, then drop everything
-- outside `[a-z0-9]`. A migration cannot call TypeScript, so the rule is
-- restated here in SQL - and it is restated as the EXACT inline expansion of
-- `pg_temp.ga40_norm_name` from `scripts/decision-checks.sql`, the script that
-- was run against `ga40db` on 6 September 2026 and reported zero collisions.
--
-- ⚠️ **THE LAST TWO STEPS OF THE FOLD ARE PROVABLE NO-OPS HERE AND ARE KEPT
-- ANYWAY.** `regexp_replace(..., '\s+', ' ', 'g')` and `btrim(...)` cannot
-- change a string from which every character outside `[a-z0-9]` is about to be
-- removed. They are in the expression so that the index is indexing the same
-- text the evidence was gathered over - a shortened "equivalent" would be a
-- second opinion about the rule, and this repo has spent slices on exactly
-- that shape. `src/__tests__/document-type-name-unique.test.ts` reads this file
-- and `scripts/decision-checks.sql` and fails when the two drift.
--
-- ⚠️ **`coalesce(name, '')` is kept for the same reason and is likewise a
-- no-op** - `lookup_document_type.name` is NOT NULL (migration_002, and
-- `src/db/schema/index.ts`). It is in `ga40_fold`; removing it here would make
-- the two texts differ for no gain.
--
-- ⚠️ **NO PERMANENT `IMMUTABLE` FUNCTION, AND THAT IS A DELIBERATE REVERSAL OF
-- WHAT migration_078 DECLINED TO DO.** That file rejected a unique index on
-- `lookup_tarla` partly because "a unique index would need the fold as a
-- permanent IMMUTABLE function - a new database object in three hand-
-- maintained files". True, and avoidable: `normalize`, `lower`,
-- `regexp_replace`, `btrim`, `coalesce` and `chr` are all IMMUTABLE in
-- PostgreSQL 16, so the expression can be inlined and no new object exists to
-- carry into `supabase_repair_missing_tables.sql`,
-- `supabase_schema_full.sql` or `sync-reference-data.sql`. What IS carried is
-- the index itself, and section 5 below lists those doors.
--
-- ⚠️ **`lower()` IS COLLATION-DEPENDENT, AND IS KEPT BECAUSE IT IS WHAT WAS
-- MEASURED - NOT BECAUSE OF THE COUNTEREXAMPLE AN EARLIER DRAFT GAVE.**
-- Postgres marks `lower(text)` IMMUTABLE, so it is legal in an index
-- expression, but a change of the database's default collation can in
-- principle change what it returns and leave the index stale. The alternative,
-- `lower(name COLLATE "C")`, would fold ASCII only.
--
-- An earlier draft justified rejecting the "C" variant with U+212A KELVIN
-- SIGN - "JavaScript gives k, `lower()` under a real collation gives k, under
-- C it stays U+212A and is dropped". An adversarial round measured it and it
-- is wrong: U+212A has a CANONICAL decomposition to U+004B, and
-- `normalize(..., NFD)` runs FIRST in this very expression, so `lower()` never
-- sees it. The same is true of U+2126 OHM SIGN and of every other singleton
-- whose lowercase is ASCII. After NFD there is no character reachable here on
-- which the two spellings of `lower()` are known to differ.
--
-- So the real reason is the one this whole section gives: `scripts/decision-
-- checks.sql` used bare `lower()` and that is the fold the archive was measured
-- under. Indexing something the evidence did not cover, to buy a robustness
-- nobody has shown a case for, is the trade this file declines. The
-- collation-dependence is named rather than hidden: a `REINDEX` after a
-- collation change is the remedy, and it is the same remedy every text index
-- in this database already needs.
--
-- ---------------------------------------------------------------------------
-- WHY THE EMPTY NORMALISED FORM IS EXCLUDED
-- ---------------------------------------------------------------------------
--
-- `sameDocumentTypeName` (document-type-match.ts) refuses to call two empty
-- normalised forms equal, deliberately, and its own ⚠️ says why: a name of "-"
-- or of a single space normalises to the empty string, and treating those as
-- equal would let ONE punctuation-only type absorb every other one. A total
-- unique index would encode the opposite rule - the first punctuation-only
-- name would take the empty slot and the second would be refused - so the
-- index is PARTIAL, `WHERE <normalised> <> ''`, and a punctuation-only name
-- stays creatable exactly as it is today.
--
-- That is not a hole this file leaves open. It is the code's rule, in the
-- database, including the exception. `scripts/decision-checks.sql` query 2c
-- lists such rows for exactly this reason; on 6 September there were none.
--
-- ---------------------------------------------------------------------------
-- THE MEASUREMENT, AND WHY SECTION 1 RE-TAKES IT
-- ---------------------------------------------------------------------------
--
-- `scripts/decision-checks.sql` query 2a was run against `ga40db` on
-- 6 September 2026: zero groups. Query 2c: zero rows. Ciprian's box is empty.
--
-- ⚠️ **AND THIS FILE STILL MEASURES, BECAUSE IT RUNS ON DATABASES NOBODY
-- MEASURED.** `migrationChain()` in `scripts/verify-rebuild.ts` globs
-- `src/db/migration_*.sql` and applies every match in name order, so this runs
-- on the rebuild chain, on the cloud project, on Ciprian's UAT box, and on
-- whatever Adrian's dev database has become by the time it is applied. A bare
-- `CREATE UNIQUE INDEX` on a colliding table fails with an unreadable
-- `could not create unique index ... Key (...)=(...) is duplicated` naming the
-- normalised form and NEITHER of the two rows. Section 1 asks first and names
-- both rows, their keys and how many documents each holds - which is the
-- information the person resolving it actually needs. migration_073 is the
-- precedent: measure in the file, do not assume the report.
--
-- ⚠️ **REFUSING IS THE RIGHT ANSWER AND MERGING WOULD NOT BE.** Two types with
-- one display name hold documents, and deciding which row survives and where
-- its documents move is a business question with an owner one room away. A
-- migration that picked for him would be a data change nobody asked for, made
-- silently, on the archive's most-referenced foreign key
-- (`document.document_type_id` is NOT NULL with no ON DELETE).
--
-- ---------------------------------------------------------------------------
-- THE OTHER DOORS INTO A DATABASE
-- ---------------------------------------------------------------------------
--
--   * `src/db/schema/index.ts` - declares the index in the same commit as this
--     file, as `uniqueIndex(...).on(sql`...`).where(sql`...`)`. Drizzle is not
--     what creates it here (this project applies migrations by hand through
--     `scripts\Apply-Migration.ps1`), so the declaration is the CODE-side
--     record; the shape is `user_requests_email_pending_unique`'s, one table
--     family over.
--   * `src/db/supabase_repair_missing_tables.sql` - the ADDITIVE door. Section
--     8 gains a guarded block that creates this index when it is absent, and
--     section 10 gains its post-flight. It cannot be a bare
--     `CREATE UNIQUE INDEX IF NOT EXISTS`: that file runs under `psql -f` with
--     no `ON_ERROR_STOP`, so a failure on colliding data would scroll past and
--     the final line would still say OK.
--   * `src/db/supabase_schema_full.sql` - GENERATED, and the FIRST thing to do
--     after applying this file. Regenerate with
--     `scripts\Export-SupabaseSchema.ps1`, then re-baseline
--     `src/db/rebuild-known-differences.txt`.
--
--     ⚠️ **TWO THINGS ARE BROKEN UNTIL THAT HAPPENS, AND THE SECOND IS NOT A
--     BUILD PROBLEM.** (1) `scripts/verify-rebuild.ts` step 3 reports
--     `INDEX public.lookup_document_type_name_normalised_unique :: absent from
--     ...` plus its `COMMENT ON INDEX` - a line type the baseline has never
--     carried - so the `DB rebuild` workflow is red on every push. (2)
--     `scripts/supabase-sync.ts` rebuilds the cloud from `supabase_reset.sql`
--     plus this file, so a SYNCED SUPABASE PROJECT HAS NO INDEX AT ALL. It runs
--     the new code, so the application-level refusal still fires and the
--     ordinary duplicate is still refused; what is missing there is the race
--     this file exists to close, silently. `supabase_repair_missing_tables.sql`
--     does not cover it either - that file is the additive repair door, not the
--     full-reset cloud path.
--
--     Regenerate FIRST and both go away, and the index costs the baseline
--     nothing: the two objects appear on both sides and the difference set is
--     unchanged.
--   * `src/db/sync-reference-data.sql` - NO CHANGE. Its 40 seeded document-type
--     names were checked under this exact fold: 40 distinct, zero collisions.
--     It is named here so the next reader does not have to re-derive that.
--   * `scripts/supabase-sync.ts`, `src/db/supabase_reset.sql`,
--     `scripts/closed-list-review.sql` - NO CHANGE. The first copies rows and
--     resolves its column list from the catalogue; the second drops by
--     catalogue walk and takes indexes with the table; the third's eight closed
--     vocabularies deliberately exclude document types.
--
-- ⚠️ **THERE IS NO UNSAFE ORDER FOR A RUNNING APP.** Old code against the new
--   index: a create or rename onto a duplicate name answers 23505 instead of
--   succeeding, which is this file's whole purpose and is a refusal rather than
--   a fault. New code against the old schema: the application-level refusal in
--   `document-type-name-guard.ts` still fires, it is simply no longer backed by
--   the database in a race. So this one may be applied before, with or after
--   the deploy - unlike 078 and 079, and said out loud because those two set
--   the expectation that it always matters.
--
-- ---------------------------------------------------------------------------
--
-- Idempotent: section 1's count is a read, `CREATE UNIQUE INDEX IF NOT EXISTS`
-- is a no-op on a second run, and section 3's COMMENT is idempotent by
-- definition. A second run says so rather than repeating the first run's
-- sentence.
--
-- WRAPPED IN A TRANSACTION
--   `scripts\Apply-Migration.ps1` feeds this file to `psql -f` with
--   `ON_ERROR_STOP=1` and no `--single-transaction`, so without a BEGIN each
--   statement commits on its own. Nothing here would be left half-done - there
--   is one DDL statement - but the BEGIN also means that section 1's refusal
--   rolls back rather than leaving a `COMMENT` from a partially-run file, and
--   it costs one line. (`CREATE INDEX CONCURRENTLY` cannot run inside a
--   transaction block and is deliberately not used: this is a lookup table of
--   about forty rows, the build is instantaneous, and the SHARE lock it takes
--   blocks writes to reference data for that instant on a single-user archive.)

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Ask first - is this database one the index can be created on?
-- ---------------------------------------------------------------------------
--
-- Two refusals, in the order that makes the message useful. A collision is
-- fatal and names the rows. There is deliberately NO check for
-- punctuation-only names: those are what the partial index excludes, so they
-- are not an obstacle, and counting them here would read as though they were.

DO $$
DECLARE
  n_groups integer;
  detail   text;
BEGIN
  SELECT count(*) INTO n_groups FROM (
    SELECT regexp_replace(
             btrim(regexp_replace(
               regexp_replace(
                 lower(normalize(coalesce(name, ''), NFD)),
                 '[' || chr(768) || '-' || chr(879) || ']', '', 'g'),
               '\s+', ' ', 'g')),
             '[^a-z0-9]', '', 'g') AS normalised
      FROM lookup_document_type
     GROUP BY 1
    HAVING count(*) > 1
       AND regexp_replace(
             btrim(regexp_replace(
               regexp_replace(
                 lower(normalize(coalesce(name, ''), NFD)),
                 '[' || chr(768) || '-' || chr(879) || ']', '', 'g'),
               '\s+', ' ', 'g')),
             '[^a-z0-9]', '', 'g') <> ''
  ) g;

  IF n_groups = 0 THEN
    RAISE NOTICE 'migration_080: no document-type name collides under the code normalisation - the index can be created.';
    RETURN;
  END IF;

  -- Every colliding row, with the count of documents filed under it, so the
  -- person resolving this can see which of a pair is the one to keep. This is
  -- query 2b of scripts/decision-checks.sql, rendered into one string because
  -- a RAISE cannot return a result set.
  SELECT string_agg(line, E'\n         ' ORDER BY line) INTO detail FROM (
    SELECT t.normalised || '  ' || t.key || ' = "' || t.name || '"  ('
           || t.n_docs || ' document(s))' AS line
      FROM (
        SELECT d.key, d.name,
               regexp_replace(
                 btrim(regexp_replace(
                   regexp_replace(
                     lower(normalize(coalesce(d.name, ''), NFD)),
                     '[' || chr(768) || '-' || chr(879) || ']', '', 'g'),
                   '\s+', ' ', 'g')),
                 '[^a-z0-9]', '', 'g') AS normalised,
               (SELECT count(*) FROM document doc WHERE doc.document_type_id = d.id) AS n_docs
          FROM lookup_document_type d
      ) t
     WHERE t.normalised <> ''
       AND EXISTS (
         SELECT 1 FROM lookup_document_type d2
          WHERE d2.key <> t.key
            AND regexp_replace(
                  btrim(regexp_replace(
                    regexp_replace(
                      lower(normalize(coalesce(d2.name, ''), NFD)),
                      '[' || chr(768) || '-' || chr(879) || ']', '', 'g'),
                    '\s+', ' ', 'g')),
                  '[^a-z0-9]', '', 'g') = t.normalised
       )
  ) x;

  RAISE EXCEPTION E'migration_080 REFUSED: % group(s) of document types share one display name under the code normalisation, so the unique index cannot be created.\n         %\n         Decide, per group, which row survives and move the other row''s documents onto it from Administration -> Reference Data, then re-run this migration. Nothing has been changed.',
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

CREATE UNIQUE INDEX IF NOT EXISTS lookup_document_type_name_normalised_unique
  ON lookup_document_type (
    (regexp_replace(
       btrim(regexp_replace(
         regexp_replace(
           lower(normalize(coalesce(name, ''), NFD)),
           '[' || chr(768) || '-' || chr(879) || ']', '', 'g'),
         '\s+', ' ', 'g')),
       '[^a-z0-9]', '', 'g'))
  )
  WHERE regexp_replace(
          btrim(regexp_replace(
            regexp_replace(
              lower(normalize(coalesce(name, ''), NFD)),
              '[' || chr(768) || '-' || chr(879) || ']', '', 'g'),
            '\s+', ' ', 'g')),
          '[^a-z0-9]', '', 'g') <> '';

-- ---------------------------------------------------------------------------
-- 3. What the index means
-- ---------------------------------------------------------------------------

COMMENT ON INDEX lookup_document_type_name_normalised_unique IS
  'Two document types may not share one display name (Slice #34.09, migration_080). The expression is normaliseDocumentTypeName() from src/lib/documents/document-type-match.ts - NFD-decompose, strip the combining marks, lowercase, drop everything outside [a-z0-9] - written as the exact inline expansion of pg_temp.ga40_norm_name in scripts/decision-checks.sql, which is the fold the archive was measured under. PARTIAL, excluding the empty normalised form, because sameDocumentTypeName() refuses to call two empty forms equal: a name of "-" or of a single space normalises to nothing, and a total index would let the first such row take the empty slot and refuse every other one. The application-level refusal that produces a Romanian sentence instead of a 23505 is documentTypeNameTakenBy() in src/lib/documents/document-type-name-guard.ts; this index is what makes the rule true of a direct caller, a script, psql, and the race that a read-then-write refusal cannot close.';

-- ---------------------------------------------------------------------------
-- 4. What this database now holds
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  n_types  integer;
  n_empty  integer;
BEGIN
  SELECT count(*) INTO n_types FROM lookup_document_type;
  SELECT count(*) INTO n_empty FROM lookup_document_type
   WHERE regexp_replace(
           btrim(regexp_replace(
             regexp_replace(
               lower(normalize(coalesce(name, ''), NFD)),
               '[' || chr(768) || '-' || chr(879) || ']', '', 'g'),
             '\s+', ' ', 'g')),
           '[^a-z0-9]', '', 'g') = '';

  RAISE NOTICE 'migration_080: lookup_document_type holds % type(s); % of them have a name that normalises to nothing and are outside the index by design.',
    n_types, n_empty;
END $$;

COMMIT;
