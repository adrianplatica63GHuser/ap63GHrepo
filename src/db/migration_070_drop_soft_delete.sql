-- migration_070_drop_soft_delete.sql
-- Slice #29.04 - Delete means gone: the column, the row, and everything that
-- could still see it.
--
-- WHAT THIS DOES
--   Removes deleted_at from all sixteen tables that carry it, drops the two
--   trigger functions that read it, and restores the two plain unique indexes
--   those triggers replaced. After this migration nothing in the database can
--   hold a name, a key or a CNP on behalf of a row the user has deleted.
--
-- WHY THE TOMBSTONES ARE PURGED FIRST, AND WHY THAT IS THE WHOLE POINT
--   A soft-deleted row is invisible to the application only because every
--   query filters on deleted_at. Drop the column with the rows still in place
--   and every one of them becomes VISIBLE again - the exact opposite of what
--   this slice is for. So section 1 deletes them, and it runs BEFORE section 4
--   drops the column, because after that there is no way to tell which rows
--   were tombstones.
--
-- THE THREE CATEGORIES, AND WHY THEY ARE NOT TREATED ALIKE
--   1. person / property / document - purged unconditionally, together with
--      the principal_object row that holds their code. Everything that hangs
--      off them (versions, addresses, corners, pages, junctions, tags,
--      metadata, cross-references, group and stamp membership) is already
--      ON DELETE CASCADE and goes with them. The two back-references that are
--      ON DELETE SET NULL - judicial_person.contact_person_1_id / _2_id and
--      document.surveyor_id - are blanked on LIVE rows. That is deliberate:
--      those columns already render as empty today, because every read joins
--      through `deleted_at IS NULL`. Blanking them makes the database agree
--      with the screen, which is the sentence this slice exists to make true.
--
--   2. groups / stamps - purged unconditionally. group_member and stamp_member
--      cascade. migration_057 kept them so a soft-deleted group could in
--      principle be restored; nothing in the application has ever restored
--      one (there is no code path that writes deleted_at = NULL anywhere), so
--      they are membership rows of a group the user deleted and nothing else.
--
--   3. The eleven lookup tables - purged ONLY where nothing references them.
--      This is the one place the migration is deliberately conservative, and
--      the reason is that soft delete on a lookup row was never only a
--      tombstone: migration_057 chose it precisely so that "historical
--      associations keep their role tag name". Hard-deleting a referenced
--      lookup row would either blank that name (ON DELETE SET NULL) or fail
--      outright (document.document_type_id is NOT NULL with no ON DELETE, the
--      one list Postgres actually protects). Neither is this slice's call to
--      make - deciding what happens when the value being deleted is still in
--      use IS Slice #29.05, by name.
--
--      So a tombstoned lookup row that something still points at is KEPT, and
--      because the column goes away it simply becomes VISIBLE again. That is
--      the honest outcome and it is strictly better than today: the row is no
--      longer an invisible squatter on its key, it is a row on the screen with
--      a reason. The report in section 1c names every one of them by table.
--
--      A CASCADE child does not count as a reference. If the database itself
--      says a child dies with its parent (lookup_doc_type_person_role and the
--      other whitelists), keeping the parent alive on its account would be the
--      child holding the parent up, which is backwards.
--
-- WHAT IS DELETED WITH THE ROW, STATED OUT LOUD RATHER THAN DISCOVERED LATER
--   The full version history. person_version, property_version,
--   document_version, entity_metadata_version and entity_provenance_log all
--   reference their parent ON DELETE CASCADE. Soft delete kept every snapshot
--   alive behind the tombstone; hard delete removes them, silently, with
--   nothing filtering or warning. There is no undo and no archive table.
--   A cross-reference is the same story from both ends: entity_cross_reference
--   cascades on BOTH source_principal_object_id and target_principal_object_id,
--   so deleting an entity removes every link INTO it as well as every link out
--   of it. The entity at the other end loses the link with no tombstone and no
--   notification - it simply has one fewer cross-reference than it had.
--
-- WHY THE TWO TRIGGERS GO AND THE TWO INDEXES COME BACK
--   migration_025 dropped natural_person_cnp_unique and
--   judicial_person_cui_unique and replaced them with BEFORE INSERT OR UPDATE
--   triggers, for one reason only: a partial unique index on natural_person
--   cannot see person.deleted_at, so a soft-deleted person's CNP stayed taken
--   forever. With the column gone that reason is gone, and the trigger bodies
--   would raise `column p.deleted_at does not exist` on every insert into
--   natural_person or judicial_person. The original indexes are correct again
--   and are restored under their original names.
--
--   The 409 survives the swap. dbErrorToResponse (src/lib/api/errors.ts)
--   already matches EITHER `e.constraint` containing "cnp"/"cui" OR the raised
--   message text, and the restored index names are natural_person_cnp_unique
--   and judicial_person_cui_unique - so a duplicate CNP still answers 409 with
--   "A person with this CNP already exists", exactly as it does today.
--
-- WHAT THIS MIGRATION MUST NOT DO, AND DOES NOT
--   It contains no ALTER SEQUENCE ... RESTART, and it must never grow one.
--   Every entity code is drawn from principal_object_code_seq via nextval(),
--   which does not roll back - not on DELETE, not on ROLLBACK - so PPERS00112
--   continues from where the sequence left off by this file doing nothing at
--   all. Two rules that sound alike live in this slice and they are opposite:
--   a deleted document TYPE KEY must be immediately reusable, and a deleted
--   entity CODE must never be reused. The first is delivered by removing the
--   tombstone; the second by leaving the sequence alone.
--
-- WHAT AN ADVERSARIAL ROUND CHANGED, SO THE REASONS ARE NOT LOST
--   * `SET LOCAL search_path = pg_catalog, public` at the top. Section 1c's
--     existence check is schema-qualified and its DELETE was not, so under a
--     caller-supplied search_path (the Supabase SQL Editor sets one) it could
--     find no column in `public`, skip nothing, and then DELETE from a
--     same-named table in another schema. Measured, on a schema called
--     `shadow`: seven rows deleted from the wrong table.
--   * Every ALTER/DROP/CREATE below is guarded on the TABLE existing, not just
--     the column. `ALTER TABLE stamps DROP COLUMN IF EXISTS` still fails with
--     42P01 on a database that has no `stamps` — which is the exact database
--     supabase_repair_missing_tables.sql exists to fix, and that file now
--     refuses to run until this migration has. Unguarded, the two deadlock.
--   * Section 1c deletes each table inside its own sub-transaction and keeps
--     the row on a foreign_key_violation, instead of trying to enumerate every
--     FK shape in advance. The old section-0 guard promised to stop rather
--     than guess, and it did not cover the shape that actually breaks the
--     predicate: an FK onto one of the CASCADE CHILDREN that 1c ignores.
--   * Section 1c repeats until a pass purges nothing. A lookup row referenced
--     only by ANOTHER lookup row's tombstone was kept on a single pass,
--     because the referencing tombstone was purged later in the same loop.
--
-- IDEMPOTENT, AND WRAPPED IN A TRANSACTION
--   Every statement is IF EXISTS / IF NOT EXISTS guarded, and section 1's
--   report is driven off the column itself, so a second run is a no-op: with
--   deleted_at gone, section 1 skips every table it cannot find the column on.
--   BEGIN/COMMIT is not decoration - the runner feeds this file to `psql -f`
--   with ON_ERROR_STOP but no --single-transaction, so without it a failure
--   half way through would leave the database with some columns dropped, some
--   tombstones purged and the CNP triggers already gone. The one statement
--   genuinely able to fail is CREATE UNIQUE INDEX on a table that already
--   holds duplicate live CNPs, and a loud rollback is the only acceptable
--   answer to that.

-- MEASURED, NOT ASSERTED
--   Run against the real schema (src/db/supabase_schema_full.sql, 51 tables,
--   loaded into a throwaway Postgres 16) seeded with the shape that would
--   embarrass it: a tombstoned document with pages, a version row, metadata
--   and a cross-reference pointing at it; a tombstoned person who is another
--   document's surveyor AND a judicial person's contact; a deleted document
--   type nothing references; a deleted type a LIVE document still uses; a
--   deleted type referenced only by a CASCADE whitelist child; a deleted type
--   referenced only by a TOMBSTONED document; a deleted person role reachable
--   only through a CASCADE whitelist and another held by a live association;
--   a deleted group and a deleted stamp, both with members.
--
--   Observed, in one run: 1 document + 1 person purged with their
--   principal_object rows; pages, versions, metadata and the cross-reference
--   all cascaded to zero; surveyor_id and contact_person_1_id blanked on the
--   surviving live rows; 3 of 4 deleted document types and 1 of 2 deleted
--   person roles purged, the other two named in the NOTICE and now visible;
--   groups and stamps to zero with their members; the sequence still at 11 so
--   the next code was DOC00012 and not a reissue; the purged person's CNP
--   free for immediate reuse; a duplicate LIVE CNP still rejected as 23505 on
--   constraint "natural_person_cnp_unique". A second run of the whole file on
--   the same database changed nothing and exited 0.
--
--   What the sandbox could NOT check: PostGIS was unavailable, so the two
--   geometry-bearing objects were stubbed out of the loaded schema. Neither
--   is touched by this migration.

BEGIN;

-- Resolve every unqualified name in this file against `public`, whatever the
-- caller's search_path. See the adversarial-round note above: without this,
-- section 1c's dynamic DELETE can hit a same-named table in another schema
-- while its guard reports the column missing.
SET LOCAL search_path = pg_catalog, public;

-- ---------------------------------------------------------------------------
-- 0. Pre-check: the one thing section 3 can fail on, named before it happens
-- ---------------------------------------------------------------------------
--
-- Section 3 restores the plain partial unique indexes on natural_person.cnp
-- and judicial_person.cui_number. Those CREATEs fail if two LIVE rows already
-- share a value, and the raw failure ("Key (cnp)=(...) is duplicated") does
-- not say which people, so nobody can act on it.
--
-- It is reachable. The triggers being replaced were BEFORE INSERT EXISTS
-- checks, and an EXISTS check is not a unique constraint: under READ
-- COMMITTED two concurrent POST /api/people with the same CNP both pass it
-- and both commit. Measured with two overlapping psql sessions.
--
-- So: look first, and if there is a collision say exactly which rows, inside
-- the same transaction, before anything has been dropped.

DO $$
DECLARE
  dup text;
BEGIN
  SELECT string_agg(format('CNP %s on person_id %s', np.cnp, np.person_id), '; ')
    INTO dup
    FROM natural_person np
   WHERE np.cnp IS NOT NULL
     AND EXISTS (SELECT 1 FROM natural_person o
                  WHERE o.cnp = np.cnp AND o.person_id IS DISTINCT FROM np.person_id);
  IF dup IS NOT NULL THEN
    RAISE EXCEPTION 'migration_070: duplicate live CNP(s) block the unique index that section 3 restores. Merge or correct these first: %', dup;
  END IF;

  SELECT string_agg(format('CUI %s on person_id %s', jp.cui_number, jp.person_id), '; ')
    INTO dup
    FROM judicial_person jp
   WHERE jp.cui_number IS NOT NULL
     AND EXISTS (SELECT 1 FROM judicial_person o
                  WHERE o.cui_number = jp.cui_number AND o.person_id IS DISTINCT FROM jp.person_id);
  IF dup IS NOT NULL THEN
    RAISE EXCEPTION 'migration_070: duplicate live CUI(s) block the unique index that section 3 restores. Merge or correct these first: %', dup;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1a. Purge tombstoned entities, and the principal_object row each one owns
-- ---------------------------------------------------------------------------
--
-- The FK from person/property/document to principal_object carries no
-- ON DELETE clause (NO ACTION), so the entity row has to go first and the
-- principal_object row second. The ids are collected into an array before the
-- entity delete rather than threaded through a data-modifying CTE: every
-- sub-statement of a CTE shares one snapshot and the referential-integrity
-- check that would have to see the entity row already gone is exactly the
-- thing that makes that subtle. Two plain statements have no such question.
--
-- Guarded by to_regclass/column existence so a re-run after the column is
-- dropped is a no-op rather than a syntax error.

DO $$
DECLARE
  po_ids    uuid[];
  n         integer;
  pages     integer;
  page_list text;
BEGIN
  -- document
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'document'
                AND column_name = 'deleted_at') THEN

    -- The bytes this migration CANNOT reach. document_page cascades and
    -- file_path is the only record of where a scan lives, so the moment those
    -- rows go the keys are unrecoverable. SQL cannot call Supabase Storage,
    -- so the honest thing is to print them: this NOTICE is the only artefact
    -- a later sweep could ever use. Soft delete never touched storage, so
    -- every tombstoned document's scans were already orphaned before this
    -- file ran — it is not creating the backlog, only recording it.
    SELECT count(*)::int, string_agg(dp.file_path, E'\n  ')
      INTO pages, page_list
      FROM document_page dp
      JOIN document d ON d.id = dp.document_id
     WHERE d.deleted_at IS NOT NULL;
    IF COALESCE(pages, 0) > 0 THEN
      RAISE NOTICE 'migration_070: % page file(s) belong to documents being purged and are NOT deleted by this migration (SQL cannot reach storage). Keys, for a sweep:%  %', pages, E'\n  ', page_list;
    END IF;

    SELECT array_agg(principal_object_id) INTO po_ids
      FROM document WHERE deleted_at IS NOT NULL;
    DELETE FROM document WHERE deleted_at IS NOT NULL;
    GET DIAGNOSTICS n = ROW_COUNT;
    DELETE FROM principal_object WHERE id = ANY (COALESCE(po_ids, '{}'::uuid[]));
    RAISE NOTICE 'migration_070: purged % soft-deleted document(s) and their principal_object row(s).', n;
  END IF;

  -- property
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'property'
                AND column_name = 'deleted_at') THEN
    SELECT array_agg(principal_object_id) INTO po_ids
      FROM property WHERE deleted_at IS NOT NULL;
    DELETE FROM property WHERE deleted_at IS NOT NULL;
    GET DIAGNOSTICS n = ROW_COUNT;
    DELETE FROM principal_object WHERE id = ANY (COALESCE(po_ids, '{}'::uuid[]));
    RAISE NOTICE 'migration_070: purged % soft-deleted propert(y/ies) and their principal_object row(s).', n;
  END IF;

  -- person LAST of the three. document.surveyor_id is ON DELETE SET NULL, so
  -- purging a tombstoned surveyor blanks that column on every document naming
  -- them; running person after document means the documents that were
  -- themselves tombstones are already gone and are never touched.
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'person'
                AND column_name = 'deleted_at') THEN
    SELECT array_agg(principal_object_id) INTO po_ids
      FROM person WHERE deleted_at IS NOT NULL;
    DELETE FROM person WHERE deleted_at IS NOT NULL;
    GET DIAGNOSTICS n = ROW_COUNT;
    DELETE FROM principal_object WHERE id = ANY (COALESCE(po_ids, '{}'::uuid[]));
    RAISE NOTICE 'migration_070: purged % soft-deleted person(s) and their principal_object row(s).', n;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1b. Purge tombstoned groups and stamps
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  n    integer;
  runs integer := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'groups'
                AND column_name = 'deleted_at') THEN
    SELECT count(*)::int INTO runs
      FROM calculation_run cr
      JOIN groups g ON g.id = cr.result_group_id
     WHERE g.deleted_at IS NOT NULL;
    DELETE FROM groups WHERE deleted_at IS NOT NULL;
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE 'migration_070: purged % soft-deleted group(s); their group_member rows cascaded, and % calculation run(s) lost their result_group_id (ON DELETE SET NULL).', n, runs;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'stamps'
                AND column_name = 'deleted_at') THEN
    DELETE FROM stamps WHERE deleted_at IS NOT NULL;
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE 'migration_070: purged % soft-deleted stamp(s); their stamp_member rows cascaded.', n;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1c. Purge tombstoned lookup rows that nothing references
-- ---------------------------------------------------------------------------
--
-- For each of the eleven lookup tables, build the delete predicate from
-- pg_constraint: `deleted_at IS NOT NULL` AND, for every non-CASCADE foreign
-- key pointing at this table, `NOT EXISTS (a child row referencing it)`.
-- Whatever survives that is a row something still needs, and it becomes
-- visible again when section 4 drops the column. Each one is named.
--
-- A CASCADE child does not count as a reference. If the database itself says
-- a child dies with its parent (lookup_doc_type_person_role and the other
-- whitelists), keeping the parent alive on its account would be the child
-- holding the parent up, which is backwards. NOTE what that means in
-- practice, because the NOTICE below cannot say it: purging a person role
-- takes its rows in lookup_doc_type_person_role, lookup_person_person_role
-- and lookup_property_person_role with it. Those are configuration, not
-- history, and the same cascade fires on every Reference Data delete from
-- here on — which is one of the reasons #29.05 exists.
--
-- TWO THINGS THIS DELIBERATELY DOES NOT TRY TO BE CLEVER ABOUT, both found by
-- an adversarial round after the first version tried:
--
--   1. IT DOES NOT ENUMERATE FK SHAPES. The first version had a guard that
--      refused to run on composite or self-referencing FKs. It refused on
--      shapes 1c never touches (CASCADE ones), and it did NOT catch the shape
--      that actually breaks the predicate — a plain FK onto one of the CASCADE
--      CHILDREN, one hop further out than the guard looked, which makes the
--      DELETE raise 23503 and take the whole migration down. Enumerating
--      shapes is the wrong tool: the database already knows. So each table is
--      deleted inside its OWN sub-transaction and a foreign_key_violation is
--      caught and treated as "still referenced" — the same conservative answer
--      the predicate would have given if it had known.
--
--   2. IT REPEATS UNTIL A PASS PURGES NOTHING. The loop runs the eleven tables
--      in a fixed order, so a lookup row referenced only by ANOTHER lookup
--      row's tombstone was kept when the referencing tombstone happened to be
--      purged later in the same pass — and the NOTICE then reported it as
--      "still referenced" when by COMMIT nothing referenced it. Measured, with
--      an FK from lookup_institution to lookup_document_type. Running to a
--      fixed point costs one extra no-op pass and removes the whole class,
--      the same way 1c running after 1a/1b does for entity tombstones.
--
-- Runs AFTER 1a and 1b on purpose: a lookup row referenced only by rows that
-- were themselves tombstones must be purgeable, and it only is once those
-- rows are gone.

DO $$
DECLARE
  t         text;
  fk        record;
  cond      text;
  n         integer;
  purged    integer := 0;
  kept_here integer;
  pass      integer := 0;
  moved     integer;
  tables    text[] := ARRAY[
    'lookup_property_type', 'lookup_tarla', 'lookup_use_category',
    'lookup_person_type', 'lookup_person_role',
    'lookup_judicial_person_type', 'lookup_citizenship',
    'lookup_document_type', 'lookup_institution',
    'lookup_property_property_role', 'lookup_document_document_role'
  ];
BEGIN
  LOOP
    pass  := pass + 1;
    moved := 0;

    FOREACH t IN ARRAY tables LOOP
      CONTINUE WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = t
           AND column_name = 'deleted_at');

      cond := 'deleted_at IS NOT NULL';

      FOR fk IN
        SELECT c.conrelid::regclass::text AS child_table,
               ca.attname                 AS child_col,
               pa.attname                 AS parent_col
          FROM pg_constraint c
          JOIN pg_attribute ca ON ca.attrelid = c.conrelid  AND ca.attnum = c.conkey[1]
          JOIN pg_attribute pa ON pa.attrelid = c.confrelid AND pa.attnum = c.confkey[1]
         WHERE c.contype     = 'f'
           AND c.confrelid   = ('public.' || t)::regclass
           AND c.confdeltype <> 'c'          -- a CASCADE child dies with its parent
           AND array_length(c.conkey, 1) = 1 -- composite FKs fall through to the
                                             -- exception handler below, which is
                                             -- the same conservative answer
           AND c.conrelid   <> c.confrelid   -- ditto self-references
      LOOP
        cond := cond || format(
          ' AND NOT EXISTS (SELECT 1 FROM %s ch WHERE ch.%I = public.%I.%I)',
          fk.child_table, fk.child_col, t, fk.parent_col);
      END LOOP;

      BEGIN
        EXECUTE format('DELETE FROM public.%I WHERE %s', t, cond);
        GET DIAGNOSTICS n = ROW_COUNT;
      EXCEPTION WHEN foreign_key_violation THEN
        -- Something the predicate could not see still points at one of these
        -- rows. Keeping it is the conservative answer and matches what the
        -- predicate does for every FK it CAN see.
        n := 0;
        RAISE NOTICE 'migration_070: % - a foreign key the predicate could not model refused the delete; every deleted row in this table is kept.', t;
      END;

      purged := purged + n;
      moved  := moved + n;
    END LOOP;

    EXIT WHEN moved = 0;
    IF pass > 20 THEN
      RAISE EXCEPTION 'migration_070: section 1c did not reach a fixed point after 20 passes.';
    END IF;
  END LOOP;

  -- Report what is left, once, after the loop has settled — a per-pass NOTICE
  -- would name rows that a later pass then purged.
  FOREACH t IN ARRAY tables LOOP
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = t
         AND column_name = 'deleted_at');
    EXECUTE format('SELECT count(*)::int FROM public.%I WHERE deleted_at IS NOT NULL', t)
       INTO kept_here;
    IF kept_here > 0 THEN
      RAISE NOTICE 'migration_070: % - % deleted row(s) are STILL REFERENCED and become visible again. Their keys stay taken; freeing them is Slice #29.05''s conversation, not this one''s.', t, kept_here;
    END IF;
  END LOOP;

  RAISE NOTICE 'migration_070: purged % unreferenced lookup row(s) in % pass(es).', purged, pass;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Drop the two triggers and their functions
-- ---------------------------------------------------------------------------
--
-- Order matters only in that the functions cannot be dropped while a trigger
-- still uses them. Dropped by name rather than with CASCADE so an unexpected
-- second dependant is an error rather than a silent casualty.

DO $$
BEGIN
  IF to_regclass('public.natural_person') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS natural_person_check_cnp_unique ON natural_person;
  END IF;
  IF to_regclass('public.judicial_person') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS judicial_person_check_cui_unique ON judicial_person;
  END IF;
END $$;

DROP FUNCTION IF EXISTS natural_person_check_cnp_unique();
DROP FUNCTION IF EXISTS judicial_person_check_cui_unique();

-- ---------------------------------------------------------------------------
-- 3. Restore the two plain partial unique indexes migration_025 removed
-- ---------------------------------------------------------------------------
--
-- Same names and same definitions as drizzle/0000_initial_schema.sql:58 and
-- drizzle/0004_judicial_person.sql:53, so nothing downstream has to learn a
-- new constraint name - including dbErrorToResponse's substring match.
--
-- These are the statements that can fail: if two LIVE rows already share a
-- CNP or a CUI the CREATE raises and the whole migration rolls back. That
-- should be impossible (the triggers being replaced enforced exactly this on
-- live rows), and if it happens the right answer is to look at the data, not
-- to weaken the index.

DO $$
BEGIN
  IF to_regclass('public.natural_person') IS NOT NULL THEN
    CREATE UNIQUE INDEX IF NOT EXISTS natural_person_cnp_unique
      ON natural_person USING btree (cnp)
      WHERE cnp IS NOT NULL;
  END IF;
  IF to_regclass('public.judicial_person') IS NOT NULL THEN
    CREATE UNIQUE INDEX IF NOT EXISTS judicial_person_cui_unique
      ON judicial_person USING btree (cui_number)
      WHERE cui_number IS NOT NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Drop the column from all sixteen tables
-- ---------------------------------------------------------------------------
--
-- No CASCADE. Nothing in this schema indexes, constrains or views deleted_at
-- (checked: zero index and zero view definitions mention it), so a plain DROP
-- succeeds - and if some object outside this repo does depend on it, failing
-- loudly here is better than dropping that object silently.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    -- Record tables
    'person', 'property', 'document',
    -- Lookup tables
    'lookup_property_type', 'lookup_tarla', 'lookup_use_category',
    'lookup_person_type', 'lookup_person_role',
    'lookup_judicial_person_type', 'lookup_citizenship',
    'lookup_document_type', 'lookup_institution',
    'lookup_property_property_role', 'lookup_document_document_role',
    -- Groups and stamps
    'groups', 'stamps'
  ] LOOP
    -- `ALTER TABLE x DROP COLUMN IF EXISTS` still raises 42P01 when x itself
    -- is absent, and `stamps` genuinely can be: it is one of the thirteen
    -- tables supabase_repair_missing_tables.sql exists to create. Unguarded,
    -- this migration dies on exactly the database that needs it, and that
    -- repair script refuses to run until this migration has — a deadlock with
    -- no order that works. Found by an adversarial round.
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I DROP COLUMN IF EXISTS deleted_at', t);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Report
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  cols integer;
  trg  integer;
  idx  integer;
BEGIN
  -- Scoped to the sixteen tables this migration owns, in `public`, and to
  -- `public` for the functions and indexes. The first version counted every
  -- deleted_at in the schema and every matching proname/relname in the whole
  -- cluster: an unrelated audit table with its own deleted_at, or a same-named
  -- index in an `archive` schema, made it abort on a database it had migrated
  -- correctly — and a same-named table in another schema made it pass on one
  -- it had not. An assertion that reports on things the file never touched is
  -- not a stronger assertion, it is a less specific one.
  SELECT count(*)::int INTO cols
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND column_name  = 'deleted_at'
     AND table_name IN (
       'person', 'property', 'document',
       'lookup_property_type', 'lookup_tarla', 'lookup_use_category',
       'lookup_person_type', 'lookup_person_role',
       'lookup_judicial_person_type', 'lookup_citizenship',
       'lookup_document_type', 'lookup_institution',
       'lookup_property_property_role', 'lookup_document_document_role',
       'groups', 'stamps');

  SELECT count(*)::int INTO trg
    FROM pg_proc p
    JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public'
     AND p.proname IN ('natural_person_check_cnp_unique', 'judicial_person_check_cui_unique');

  SELECT count(*)::int INTO idx
    FROM pg_class c
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
   WHERE ns.nspname = 'public'
     AND c.relkind  = 'i'
     AND c.relname IN ('natural_person_cnp_unique', 'judicial_person_cui_unique');

  RAISE NOTICE 'migration_070: % of the 16 owned table(s) still carry deleted_at (expected 0), % soft-delete trigger function(s) remain in public (expected 0), % restored unique index(es) present (expected 2, or fewer if natural_person/judicial_person are absent).', cols, trg, idx;

  IF cols <> 0 OR trg <> 0 THEN
    RAISE EXCEPTION 'migration_070: post-conditions not met - see the NOTICE above. Rolling back.';
  END IF;

  -- The index count is asserted only against the tables that exist: on a
  -- database missing natural_person entirely, section 3 correctly created
  -- nothing and demanding 2 here would abort a run that did its job.
  IF idx <> (CASE WHEN to_regclass('public.natural_person')  IS NULL THEN 0 ELSE 1 END
           + CASE WHEN to_regclass('public.judicial_person') IS NULL THEN 0 ELSE 1 END) THEN
    RAISE EXCEPTION 'migration_070: the restored unique indexes are not in the expected state - see the NOTICE above. Rolling back.';
  END IF;
END $$;

COMMIT;
