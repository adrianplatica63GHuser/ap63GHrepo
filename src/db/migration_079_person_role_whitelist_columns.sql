-- migration_079_person_role_whitelist_columns.sql
-- Slice #34.04 - two whitelist tables become two columns on the row they describe.
--
-- ⚠️ **MIGRATION HALF. DO NOT RUN `scripts\Apply-Migration.ps1` FOR 079 UNTIL
--   THE CODE HALF IS ON THE BRANCH.** `schema/index.ts` no longer declares the
--   two tables and the four files that still import them do not compile; the
--   deploy-order section below says what breaks in each direction and why there
--   is no safe order.
--
-- WHAT THE SLICE ASKS FOR
--   „Persoană → Proprietate" and „Persoană → Persoană" are two buttons on the
--   Reference Data hub, each opening a modal that lists the roles ticked for
--   one kind of association. Neither shows anything the „Roluri Persoană" row
--   could not show itself, so one question about one role - is this role
--   usable on a property? on another person? - costs three windows to answer.
--   After this file the answer is two checkboxes on the role's own row.
--
-- THE SHAPE IS THE WHOLE ARGUMENT, AND IT IS TWELVE LINES OF SCHEMA
--   `lookup_property_person_role` (migration_015) and
--   `lookup_person_person_role` (migration_055, section 3) each hold exactly:
--
--     id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--     person_role_id uuid NOT NULL UNIQUE REFERENCES lookup_person_role(id)
--                                          ON DELETE CASCADE,
--     created_at     timestamptz NOT NULL DEFAULT now()
--
--   Nothing else, and identical in every column to each other. (Not byte for
--   byte: 015 names its uniqueness `CONSTRAINT lookup_property_person_role_unique`
--   while 055 declares `UNIQUE` inline and lets Postgres name it
--   `lookup_person_person_role_person_role_id_key`. That asymmetry is real
--   enough to have two baseline lines of its own in
--   `src/db/rebuild-known-differences.txt`, and both of them go with the tables.
--   An adversarial round caught the first draft of this paragraph claiming
--   otherwise.)
--
--   A table whose only content is a UNIQUE, NOT NULL foreign key to another
--   table's primary key carries one bit per row of that other table: present or
--   absent. That is a boolean column wearing a costume, and every consequence
--   of the costume - two API route families, two modals that are one component
--   written twice, two cache-key families, a synthetic `id` - is paid for a bit
--   that has nowhere to hide once it is a column.
--
--   The precedent is in this repo and on a lookup table: migration_041 put
--   `show_tarla_parcela` / `show_address` / `show_street_view` on
--   `lookup_property_type` as `boolean NOT NULL DEFAULT false`. Same shape,
--   same reason, same defaults.
--
-- ⚠️ `lookup_doc_type_person_role` DOES NOT COLLAPSE AND IS NOT TOUCHED HERE
--   It looks like a third member of the family and it is not. Its unique index
--   is over the PAIR `(document_type_id, person_role_id)`, because „Vânzător"
--   is a valid party on a sale contract and not on a cadastral plan. That is
--   real information and a boolean on the role would destroy it: there is no
--   `valid_for_document` column below, and there should never be one. It stays
--   a grid; Slice #34.10 moves it to the document-type screen.
--
-- WHAT IS LOST, NAMED RATHER THAN DISCOVERED
--   1. `created_at` per tick - the moment an administrator ticked a role for
--      one kind of association. Nothing reads it (neither modal selects it,
--      neither `queries.ts` module returns it), and a boolean has no room for
--      it. Section 4 raises the range being discarded as a WARNING - stderr,
--      above the notice stream - for migration_078 section 5's reason: it is
--      the only record those timestamps will ever get, and the runner tees
--      nothing to a file.
--   2. The tick's own `id`. That is the point rather than a cost - see the
--      cache-collision paragraph below.
--   3. The delete dialog's „La ștergere se elimină și:" list loses two named,
--      live-counted lines, because `dependents.ts` holds these two tables as
--      `enforcement: "cascades"` with `configuration: true` and boolean
--      columns have no rows to count. That is the one fact the collapse loses
--      that a person could notice, and it is the thing Adrian was asked to
--      confirm before this file was written.
--
-- WHAT THE `id` WAS COSTING, SINCE IT IS ITEM 2 ABOVE
--   `["person-person-roles"]` is ONE React Query key over TWO row shapes.
--   `person-person-modal.tsx` caches the raw rows and renders
--   `row.personRoleName`; `natural-persons/[id]/associate-person/`
--   `associate-person-view.tsx` fetches the same endpoint under the same key
--   and caches `.map(r => ({ id: r.personRoleId, name: r.name }))`. Each is
--   correct alone. React Query serves one entry per key, so when the modal
--   mounts first the associate view is handed the modal's shape for the 30 s
--   staleTime: blank `<option>` labels, and on selection a
--   `lookup_person_person_role.id` submitted into
--   `person_person.relationship_role_id`, where it is a 23503. Conditional on
--   mount order, not standing - the first draft of this paragraph said
--   otherwise and an adversarial round measured it. Note the asymmetry it
--   exposes: the property side was given a key of its own
--   (`property-person-roles-whitelist`) for exactly this reason and the person
--   side never was. Collapsing the tables deletes the key, and with it the
--   question.
--
-- WHAT THE MIGRATION DOES NOT DO
--   It does not decide anything. Every role ticked in either table is ticked
--   in its column; every role ticked in neither is false, which is what it
--   already was. „Persoană → Persoană" is empty by default today, so most
--   archives will see `valid_for_person` come out false everywhere - that is
--   the current state made visible on the master list, not a change to it.
--
-- ⚠️ THE BACKFILL ONLY EVER SETS TRUE - IT NEVER SETS FALSE, AND THAT IS
--   DELIBERATE. `supabase_repair_missing_tables.sql` is additive and promises
--   never to drop, so a repaired project can end up running with BOTH the new
--   columns and the old tables - the new-schema app writing the column while
--   the table sits unread. Clearing a column because the stale table has no
--   row for it would silently undo an edit a person made. This file folds; it
--   does not re-decide. (Section 4 counts those separately and says so.)
--
-- ⚠️ The backfill fires `touch_updated_at_lookup_person_role`
--   (migration_013_person_roles.sql), so every role that gains a tick gets a
--   fresh `updated_at`. Nothing reads that column - it is selected by no query
--   in `src/lib/admin/value-lists/` and rendered nowhere - so the bump is
--   invisible, and disabling the trigger would need table ownership this file
--   cannot assume on Supabase. Named rather than worked around.
--
-- ---------------------------------------------------------------------------
-- THE OTHER DOORS INTO A DATABASE, AND THE DEPLOY ORDER
-- ---------------------------------------------------------------------------
--
-- A migration is not the only way this schema arrives, and migration_078's
-- header is the precedent for naming every door in the file that moves the
-- schema rather than leaving them to a handover line. Five, and four of them
-- change in the same commit as this file. (Four, and three, until an
-- adversarial round pointed out that the fifth was the one that performs the
-- cloud sync.)
--
--   * `src/db/supabase_repair_missing_tables.sql` - the ADDITIVE door. A
--     project repaired through it must gain the two columns, or every
--     `lookup_person_role` read in the app answers 42703 while that script's
--     post-flight reports OK. Its section 8 gains the `ADD COLUMN IF NOT
--     EXISTS` pair and the six-statement convergence block behind it (that
--     file's own rule: `ADD COLUMN IF NOT EXISTS` no-ops over a nullable
--     column of the same name, so the three properties are asserted
--     separately), its section 10 gains two post-flight checks, and its
--     not-purely-additive count goes from seven to eleven. Deliberately NOT
--     the DROPs, the same split it already keeps with migration_070.
--   * `src/db/sync-reference-data.sql` - the SEEDING door, and the one that
--     would have lost data in silence. It TRUNCATEs both tables and seeds FOUR
--     rows into `lookup_property_person_role` (Coproprietari / Coindivizari,
--     Cumpărător, Proprietar / Titular de drept real, Titular de drept). After
--     this file those statements are 42P01, and a cloud project reference-
--     loaded through it would come up with `valid_for_property` false on every
--     role - the four ticks gone, having never passed through this migration
--     at all. It becomes one `UPDATE ... SET valid_for_property = true WHERE
--     name IN (...)` over the same four names.
--   * `scripts/supabase-sync.ts` - the CLOUD SYNC door, and the one this file
--     is checked against by name. Its `syncPropertyPersonRoles` and
--     `syncPersonPersonRoles` read both tables from the LOCAL database - 42P01
--     the first time step 3 runs after `Apply-Migration.ps1` - and its
--     `supaPool` TRUNCATE names both. Both functions are DELETED rather than
--     rewritten: the ticks are now columns on a row `syncSimple` already
--     copies, and `planFor` resolves its column list from the catalogue, so
--     the sync needs no code for them at all. ⚠️ `scripts/verify-rebuild.ts`
--     scans this file for lookup names a rebuilt database does not have and
--     calls `bad()` on a match, so leaving it alone fails Verify-Rebuild for a
--     reason no re-baseline can absolve.
--   * `scripts/closed-list-review.sql` - the operator worksheet for the
--     closed-list review with Ciprian. Its „Roluri Persoană" branch counts
--     rows in both tables; two of its three sub-counts become 42P01 and take
--     the whole script with them. It becomes two `CASE WHEN`s over the columns.
--   * `src/db/supabase_schema_full.sql` - GENERATED, never hand-edited.
--     Regenerate with `scripts\Export-SupabaseSchema.ps1` after applying this
--     file, and re-baseline `src/db/rebuild-known-differences.txt`.
--     ⚠️ **The re-baseline is bigger than the six lines that mention the two
--     tables by name.** Those go (two CONSTRAINT, four REFDATA), but
--     `verify-rebuild.ts`'s `referenceRows` builds each row string from that
--     database's OWN column list, so until the full-schema file is regenerated
--     DB_MIGRATIONS' `lookup_person_role` has two columns DB_FULL's has not
--     and EVERY role row differs - of the order of a hundred REFDATA lines,
--     not six. Regenerate first, then re-baseline; doing it the other way
--     round bakes the noise into the file. `.\scripts\Verify-Rebuild.ps1`
--     exits 1 until both are done, which is the check working rather than
--     failing.
--
-- ⚠️ **THERE IS NO SAFE ORDER FOR A RUNNING APP, SO THIS IS A COORDINATED
--   DEPLOY.** New code against the old schema: 42703 on `valid_for_property`
--   for every read of `lookup_person_role`, which is most screens. Old code
--   against the new schema: 42P01 on `/api/admin/property-person-roles` and
--   `/api/admin/person-person-roles`, and - less obviously - inside
--   `src/lib/admin/value-lists/dependents.ts`, which counts rows in both
--   tables on every person-role delete-confirm dialog, and inside
--   `grantPersonRoleWhitelists` (`role-whitelists.ts`), which runs in the
--   caller's transaction, so a person-role MOVE fails and rolls back. Apply
--   and deploy together.
--
-- ---------------------------------------------------------------------------
--
-- Idempotent: `ADD COLUMN IF NOT EXISTS`, every read of the old tables guarded
-- on their still existing, `DROP TABLE IF EXISTS`, and a backfill that is a
-- no-op once the columns already hold the ticks. A second run says so, and
-- says a DIFFERENT thing rather than printing the first run's sentence with
-- zeroes in it (section 4).
--
-- ⚠️ Every statement that READS one of the two old tables is inside an
--   `EXECUTE` string. A plain SQL statement referencing a missing table fails
--   at PARSE time, before its own `IF EXISTS` guard can run, so a guarded but
--   un-EXECUTEd query would turn the second run into an error rather than a
--   no-op. migration_078 learned this; it is not a style choice. The two
--   `DROP TABLE IF EXISTS` in section 6 are the exception and are exempt:
--   `IF EXISTS` there is resolved at execution, not at parse.
--
-- ⚠️ `to_regclass`, not `information_schema.tables`, for migration_078's
--   reason: `information_schema` shows an object only to a role holding some
--   privilege on it, so under a restricted role it comes back empty and every
--   guard silently takes the "already gone" branch - no backfill, no record,
--   and then a DROP that finds the table after all. `to_regclass` reads
--   `pg_class` and is not privilege-filtered. Schema-qualified, so it does not
--   depend on `search_path`.
--
-- WRAPPED IN A TRANSACTION
--   The runner feeds this file to `psql -f` with no `--single-transaction`, so
--   without a BEGIN each statement commits on its own - and section 6 DROPS
--   THE ONLY COPY of the ticks. Unwrapped, a failure between the backfill and
--   the drop would leave a database with the tables gone and the columns
--   half-written, and nothing to recover them from short of a restore.
--   BEGIN/COMMIT makes every failure in this file a rollback to exactly the
--   state it started in.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The columns
-- ---------------------------------------------------------------------------
--
-- `NOT NULL DEFAULT false` in one statement: since Postgres 11 that is a
-- catalogue-only change, no table rewrite, whatever the row count. There is no
-- third column, and the ⚠️ in the header says why.

ALTER TABLE lookup_person_role
  ADD COLUMN IF NOT EXISTS valid_for_property boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS valid_for_person   boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- 2. Fold lookup_property_person_role into valid_for_property
-- ---------------------------------------------------------------------------
--
-- The `EXISTS` sub-select is against the whitelist table alone rather than a
-- join, so an orphan row - impossible while the FK is NOT NULL and
-- `REFERENCES lookup_person_role(id)`, but this file does not have to assume
-- it - could never cause a role to be missed. The name list in section 4 IS a
-- join, so a count that disagrees with the number of names printed is exactly
-- how such an orphan would announce itself.

DO $$
BEGIN
  IF to_regclass('public.lookup_property_person_role') IS NULL THEN
    RAISE NOTICE 'migration_079: lookup_property_person_role is already gone - valid_for_property keeps whatever it holds.';
    RETURN;
  END IF;

  EXECUTE $q$
    UPDATE lookup_person_role r
       SET valid_for_property = true
     WHERE NOT r.valid_for_property
       AND EXISTS (
         SELECT 1 FROM lookup_property_person_role w
          WHERE w.person_role_id = r.id
       )
  $q$;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Fold lookup_person_person_role into valid_for_person
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.lookup_person_person_role') IS NULL THEN
    RAISE NOTICE 'migration_079: lookup_person_person_role is already gone - valid_for_person keeps whatever it holds.';
    RETURN;
  END IF;

  EXECUTE $q$
    UPDATE lookup_person_role r
       SET valid_for_person = true
     WHERE NOT r.valid_for_person
       AND EXISTS (
         SELECT 1 FROM lookup_person_person_role w
          WHERE w.person_role_id = r.id
       )
  $q$;
END $$;

-- ---------------------------------------------------------------------------
-- 4. The record - what is about to be dropped, by name
-- ---------------------------------------------------------------------------
--
-- Runs AFTER the backfill and reads the columns, so what it prints is what the
-- database will actually hold once section 6 has run - not what the tables
-- said. `n_*_rows` comes from the table and `*_names` from the join, on
-- purpose: see section 2.
--
-- ⚠️ **Each list gets a DIFFERENT sentence depending on whether its table is
-- still there.** An earlier draft computed the "already ticked, no row"
-- counters only inside the guard, so a re-run - where the table is gone and
-- EVERY ticked role is in that state - printed `0` for them and „being
-- dropped" in the present tense about rows a previous run had already dropped.
-- An adversarial round found it. The presence flags are read once, into
-- variables, so the branch and the counters cannot disagree.
--
-- One `%` per argument. A format string whose placeholder count drifts from
-- its argument list fails at the moment it fires, which is the one moment this
-- message has to work - so each RAISE below is built from a variable rather
-- than assembled inline.

DO $$
DECLARE
  prop_present boolean := to_regclass('public.lookup_property_person_role') IS NOT NULL;
  pers_present boolean := to_regclass('public.lookup_person_person_role')  IS NOT NULL;
  n_prop_rows  integer := 0;
  n_pers_rows  integer := 0;
  n_prop_col   integer := 0;
  n_pers_col   integer := 0;
  n_prop_extra integer := 0;
  n_pers_extra integer := 0;
  prop_names   text;
  pers_names   text;
  prop_oldest  timestamptz;
  prop_newest  timestamptz;
  pers_oldest  timestamptz;
  pers_newest  timestamptz;
  n_roles      integer;
BEGIN
  SELECT count(*) INTO n_roles FROM lookup_person_role;
  SELECT count(*) INTO n_prop_col FROM lookup_person_role WHERE valid_for_property;
  SELECT count(*) INTO n_pers_col FROM lookup_person_role WHERE valid_for_person;

  RAISE NOTICE 'migration_079: lookup_person_role holds % role(s) - valid_for_property is true on %, valid_for_person on %.',
    n_roles, n_prop_col, n_pers_col;

  IF prop_present THEN
    EXECUTE $q$SELECT count(*), min(created_at), max(created_at) FROM lookup_property_person_role$q$
      INTO n_prop_rows, prop_oldest, prop_newest;
    EXECUTE $q$
      SELECT string_agg(r.name, ', ' ORDER BY r.name)
        FROM lookup_property_person_role w
        JOIN lookup_person_role r ON r.id = w.person_role_id
    $q$ INTO prop_names;
    -- Roles the COLUMN says yes to and the TABLE has no row for: the repaired
    -- Supabase case in the header, or a tick made in the new UI before this
    -- file ran. Counted so the number above is never read as "rows folded".
    EXECUTE $q$
      SELECT count(*) FROM lookup_person_role r
       WHERE r.valid_for_property
         AND NOT EXISTS (
           SELECT 1 FROM lookup_property_person_role w WHERE w.person_role_id = r.id
         )
    $q$ INTO n_prop_extra;
    RAISE NOTICE 'migration_079: Persoană → Proprietate - % row(s) folded into valid_for_property and dropped: %. (% ticked role(s) had no row, so they came from somewhere else.)',
      n_prop_rows, coalesce(prop_names, '(none)'), n_prop_extra;
  ELSE
    RAISE NOTICE 'migration_079: Persoană → Proprietate - lookup_property_person_role was already gone, so this run folded nothing; valid_for_property is what an earlier run or the UI left on % role(s).',
      n_prop_col;
  END IF;

  IF pers_present THEN
    EXECUTE $q$SELECT count(*), min(created_at), max(created_at) FROM lookup_person_person_role$q$
      INTO n_pers_rows, pers_oldest, pers_newest;
    EXECUTE $q$
      SELECT string_agg(r.name, ', ' ORDER BY r.name)
        FROM lookup_person_person_role w
        JOIN lookup_person_role r ON r.id = w.person_role_id
    $q$ INTO pers_names;
    EXECUTE $q$
      SELECT count(*) FROM lookup_person_role r
       WHERE r.valid_for_person
         AND NOT EXISTS (
           SELECT 1 FROM lookup_person_person_role w WHERE w.person_role_id = r.id
         )
    $q$ INTO n_pers_extra;
    RAISE NOTICE 'migration_079: Persoană → Persoană - % row(s) folded into valid_for_person and dropped: %. (% ticked role(s) had no row.)',
      n_pers_rows, coalesce(pers_names, '(none)'), n_pers_extra;
  ELSE
    RAISE NOTICE 'migration_079: Persoană → Persoană - lookup_person_person_role was already gone, so this run folded nothing; valid_for_person is what an earlier run or the UI left on % role(s).',
      n_pers_col;
  END IF;

  -- The one fact the collapse really destroys, and the only statement in this
  -- file about something unrecoverable - so WARNING, not NOTICE, for
  -- migration_078 section 5's reason: psql puts it on stderr above the summary
  -- instead of in the notice stream with everything else, and `Apply-Migration.ps1`
  -- tees nothing to a file. Printed as a range rather than per row: nothing
  -- reads these timestamps, and this line is the whole of the record they get.
  IF n_prop_rows > 0 OR n_pers_rows > 0 THEN
    RAISE WARNING '%', 'migration_079: the per-tick created_at timestamps are discarded at COMMIT. '
      || 'Persoană → Proprietate spanned ' || coalesce(prop_oldest::text, '-') || ' .. ' || coalesce(prop_newest::text, '-')
      || '; Persoană → Persoană spanned '  || coalesce(pers_oldest::text, '-') || ' .. ' || coalesce(pers_newest::text, '-')
      || '. A boolean has no room for them and nothing read them. This is a RECORD, not a prompt - '
      || 'the runner is non-interactive and COMMIT follows immediately.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. What the columns mean
-- ---------------------------------------------------------------------------

COMMENT ON COLUMN lookup_person_role.valid_for_property IS
  'TRUE when this role may tag a Proprietate ↔ Persoană association (Slice #34.04, migration_079). Replaces the table lookup_property_person_role, which held one row per ticked role - a UNIQUE NOT NULL FK to this table''s primary key, i.e. exactly this bit, at the cost of an API route family, a modal, two React Query cache-key names for one endpoint, and a synthetic id. Edited from the „Roluri Persoană" row in Reference Data. Defaults to false: a new role is usable nowhere until someone says otherwise, which is what the empty table meant.';

COMMENT ON COLUMN lookup_person_role.valid_for_person IS
  'TRUE when this role may tag a Persoană ↔ Persoană association (Slice #34.04, migration_079). Replaces the table lookup_person_person_role, which was identical in every column to lookup_property_person_role and is collapsed for the same reason. Note there is deliberately NO valid_for_document column: lookup_doc_type_person_role is unique over (document_type_id, person_role_id), so a role can be valid on one document type and not another, and a boolean on the role would destroy that distinction. See migration_079''s header.';

-- ---------------------------------------------------------------------------
-- 6. The tables
-- ---------------------------------------------------------------------------
--
-- No CASCADE, deliberately. Nothing in the schema references either table -
-- both FKs point OUT of them, at lookup_person_role, and `person_person`'s
-- `relationship_role_id` points at lookup_person_role directly (migration_055,
-- section 4) rather than at the whitelist. Verified against
-- `supabase_schema_full.sql` and every file in `src/db/`: no inbound FK, no
-- view, no trigger, no policy, no grant, no index beyond the PK and the UNIQUE.
-- If some object this file does not know about does depend on one of them, the
-- DROP should fail and roll the whole migration back, not silently take that
-- object with it.

DROP TABLE IF EXISTS lookup_property_person_role;
DROP TABLE IF EXISTS lookup_person_person_role;

COMMIT;
