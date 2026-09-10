-- migration_078_property_tarla_fk.sql
-- Slice #34.03 - a tarla code becomes an identity.
--
-- WHAT THE SLICE ASKS FOR
--   Renaming a code in Reference Data -> "Indicative Tarla" fixes every
--   property that carries it, in one write. Today it fixes none of them:
--   `property.tarla_sola` holds the TEXT, so the rename edits a row nothing
--   points at and the properties keep the old spelling for ever.
--
-- THIS IS migration_028 A THIRD TIME, AND THAT IS THE WHOLE DESIGN
--   #15.16 turned `property.type` and `property.use_category` - two Postgres
--   enums - into `property_type_id` and `use_category_id`, nullable, ON DELETE
--   SET NULL, pointing at their Reference-Data tables. Tarla was left out
--   because of one four-word comment, "no FK migration", and every awkward
--   thing about the list since has been a consequence: the dependents count is
--   a string match, an edit onto a new code seeds nothing, the delete path
--   carries `siblingsSharingValue` / `matchesByValue` / an ambiguous-value
--   refusal that exist for this one list, and the dropdown has to SYNTHESISE
--   the option a free-text value produces. The FK deletes all of that rather
--   than adding to it.
--
--   So the column shape is copied from migration_028 deliberately - nullable,
--   `REFERENCES lookup_tarla(id) ON DELETE SET NULL` - and for the same
--   reason: removing a code from Reference Data should clear the tag on the
--   properties that carried it, not refuse the delete. Ten of the eleven
--   lists behave that way; `dependents.ts`'s tarla entry already SAYS
--   "clears", as the honest reading of "nothing happens to them, which is the
--   problem". After this migration it is true rather than aspirational.
--
--   WHERE IT DEPARTS FROM 028: 028 backfilled NOTHING, because LAND and
--   CATEG1 had no lookup-row equivalent and every property was re-picked by
--   hand. Here the values ARE the lookup rows' own codes, on a database with
--   one business user's parcels in it, so a backfill is both possible and
--   obligatory - re-picking by hand is the manual effort CLAUDE.md forbids.
--   Sections 3 to 5 are that backfill. (Section 3 REFUSES an AMBIGUOUS value -
--   the one case this file must not decide alone; section 4 RESOLVES every
--   value that matches exactly one code AND has no id yet; section 5 NAMES
--   everything whose text is about to be destroyed, loudly, before section 7
--   drops it.)
--
-- ⚠️ THIS FILE IS NOT MECHANICAL ABOUT THE DATA IT FINDS, ONLY ABOUT THE ONE
-- DATABASE IT WAS MEASURED AGAINST.
--   `scripts/decision-checks.sql` was run against `ga40db` on 6 September 2026:
--   14 properties, 11 carrying a tarla value, 4 distinct values, exactly ONE
--   matching no `lookup_tarla` row - a test string, per Adrian, and therefore
--   erased rather than preserved; see below - and no
--   duplicate codes inside `lookup_tarla`. Those numbers are the REASON this
--   slice is cheap; they are not an assumption this file makes. Nothing below
--   is written for 14 rows: sections 3 to 5 resolve whatever they find, name
--   whatever they cannot resolve before it is destroyed, and raise rather than
--   proceeding on the one case they must not decide alone.
--   Re-running the check before applying is still worth a minute - the report
--   in section 5 is what confirms the answer matched.
--
--   RE-RUN ON 7 SEPTEMBER 2026, IMMEDIATELY BEFORE THE FIRST APPLY, AND THE
--   DATABASE HAD MOVED: 13 properties, not 14. Every other number held - 11
--   carrying a tarla value, 4 distinct values, the SAME single unmatched value
--   (`99/9-not-in-list` on PROP01612), and query 1c still empty, so there is
--   no folded twin and section 3 has nothing to refuse. The property that went
--   was one of the ones carrying NO tarla, so `without_tarla` went 3 -> 2 and
--   this file's work is unchanged.
--
--   That is recorded here rather than corrected in the paragraph above,
--   because the paragraph above is a statement about a date and stays true.
--   What the two together say is the point: the numbers moved by one row in a
--   day, which is exactly why this file resolves whatever it finds instead of
--   trusting them.
--
--   SO THE FIRST RUN SHOULD REPORT: one WARNING naming PROP01612, and a NOTICE
--   reading "11 propert(y/ies) carried a tarla value - 10 now point at a
--   lookup_tarla row (0 of those at a code that DISAGREED with the text) and 1
--   had no matching code and lose it; 2 carried none and stay NULL". Anything
--   else means the database moved again between the check and the apply.
--
-- THE ONE CASE THIS FILE REFUSES: TWO CODES THAT FOLD TO ONE
--   If two `lookup_tarla` rows fold to the same code and a property carries
--   it, there is no answer here that is not a guess - and picking one is
--   exactly the pair problem 33.03 item 11 describes, decided silently by a
--   migration instead of by a person. Section 3 raises with the rows named.
--   That database needs the twin merged or renamed first, which is a decision,
--   not a migration.
--
--   ⚠️ **Note what this file does NOT do about that: it adds no UNIQUE.** A
--   unique index over the folded `indicativ` would stop the twin being created
--   tomorrow, and it is tempting because "a tarla code becomes an identity" is
--   this slice's title. It is deliberately left out. The FK removes the
--   AMBIGUITY without needing uniqueness - a property points at one ROW, so a
--   twin no longer strands anything and `siblingsSharingValue` goes either way
--   - and a unique index would need the fold as a permanent IMMUTABLE function
--   (a new database object in three hand-maintained files), would turn the
--   admin add form's second "T1" into a 23505 needing a friendly error, and
--   would change what a code MEANS, which the slice puts out of scope. It is
--   in the handover under "Noticed, not fixed".
--
--   ⚠️ **ONE THIRD OF THAT IS WRONG, AND SLICE #34.09 IS WHAT PROVED IT.**
--   Comment-only correction to an applied migration; nothing below this line
--   changed. The permanent-IMMUTABLE-function claim is false: `normalize`,
--   `lower`, `regexp_replace`, `btrim`, `coalesce` and `chr` are all IMMUTABLE
--   in PostgreSQL 16, so the fold can be INLINED into the index expression and
--   no new database object exists to carry into
--   `supabase_repair_missing_tables.sql`, `supabase_schema_full.sql` or
--   `sync-reference-data.sql`. `migration_080_document_type_name_unique.sql`
--   does exactly that on `lookup_document_type`. The other two thirds still
--   stand and are the real reasons this file adds no UNIQUE: a second "T1"
--   would become a 23505 needing a friendly error nobody has written, and
--   uniqueness would change what a tarla code MEANS. The 23505 half is what
--   #34.09 had to build for document types - a named refusal, a `code` on the
--   wire and a Romanian sentence in both locales - which is the size of the
--   thing this file was right to leave out of its own scope.
--
-- THE FOLD IS decision-checks.sql's, CHARACTER FOR CHARACTER
--   `pg_temp.ga40_fold` below is copied from that script, which is itself the
--   Postgres spelling of `foldRomanian` (src/lib/import/id-card.ts): NFD
--   decompose, strip the combining marks by CODE POINT, lowercase, collapse
--   whitespace, trim. Copied rather than tightened, so that the values this
--   file resolves are exactly the values query 1b measured - a migration that
--   folded differently from the evidence would erase values the check never
--   reported, on the run where that matters most.
--
--   ⚠️ **It is NOT `cadastralKey`** (src/lib/properties/cadastral-identity.ts),
--   which additionally applies `perToSlash` and removes ALL whitespace. That
--   is the fold the IMPORT compares parcels with, and it is looser. Using it
--   here would resolve `47per2` onto `47/2` - which sounds like a feature and
--   is not: it would also collapse two `lookup_tarla` rows that this file must
--   refuse rather than merge, and it would resolve a value the evidence never
--   examined. Anything the strict fold cannot place is ERASED and named on the
--   way out (section 5) - so a looser fold here would not "rescue" a value, it
--   would quietly attach a property to a code nobody checked.
--
--   ⚠️ **The marks are removed by code point, not by `translate`, and that is
--   not stylistic**: migration_020's `translate` map is misaligned by one
--   character and is fixed in this same slice. See that file's header.
--
-- WHY A VALUE THAT MATCHES NOTHING IS ERASED, AND WHY THAT IS ADRIAN'S ANSWER
-- RATHER THAN THIS FILE'S
--   An earlier draft of this file created a `lookup_tarla` row for every
--   unresolved value, on the argument that deleting a row is one click and
--   recovering a cleared field is a restore. That argument is sound in
--   general and WRONG for the value this database actually holds: asked, the
--   answer was that `99/9-not-in-list` is not a real thing. It is a test
--   value, and preserving it would have put a made-up code into the Indicative
--   Tarla list permanently, at the TOP of it (every new row ties at
--   `sort_order` 0), offered in the dropdown of every property, for the sake of
--   not losing a string nobody wants.
--
--   So an unresolved value is not preserved. `tarla_id` stays NULL, and
--   section 7 drops the text with the column. **This file's job is therefore
--   to make sure that is never SILENT**: section 5 prints every property code
--   and value it is about to erase, as a WARNING - stderr, not the notice
--   stream - before the drop happens, and the counts underneath say how many
--   now point at a code and how many are dropped. (How many, not by whom:
--   after the backfill was narrowed to `tarla_id IS NULL` - see section 4 -
--   some of those may have been resolved by an earlier run or by the app, so
--   the number is a statement about the END STATE and is worded that way.)
--   On a database that has moved on
--   since 6 September that log is the only record those values ever existed,
--   which is exactly why it is a WARNING and why it names the property rather
--   than counting it.
--
--   ⚠️ **The one thing this must NOT become is a refusal.** An earlier draft
--   raised on an unresolved value, which would have made every future run of
--   this migration wait for somebody to hand-clean a test string. Adrian's
--   answer is that such a string is junk; the migration's answer is to say
--   loudly what it dropped.
--
--   ⚠️ **IF A LATER DATABASE HOLDS AN UNMATCHED VALUE THAT IS REAL, THE
--   WARNING IS TOO LATE TO ACT ON, AND A REVIEW ROUND IS WHY THIS SAYS SO.**
--   An earlier draft of this paragraph offered "stop with Ctrl-C before
--   COMMIT". There is no prompt to stop: `Apply-Migration.ps1` runs
--   `docker exec ... psql -v ON_ERROR_STOP=1 -f <file>`, non-interactive, and
--   COMMIT follows the WARNING by milliseconds. Nor is "re-apply after fixing
--   the data" a recovery - once COMMIT lands, `tarla_sola` is dropped and the
--   values are gone; a re-run has nothing left to resolve. **Recovery is a
--   restore.**
--
--   So the WARNING is a RECORD, not a chance to intervene, and the chance to
--   intervene is BEFORE the apply:
--
--       Get-Content .\scripts\decision-checks.sql |
--         docker exec -i ga40prj-postgres psql -U postgres -d ga40db
--
--   Query 1b lists everything this file will do to the database it is run
--   against: the two ways a value is destroyed, AND the two conditions under
--   which this file destroys nothing because it aborts. That is why that step
--   is in the handover as a real precondition rather than a courtesy.
--
--   ⚠️ **IT IS A COMPLETE PREVIEW SINCE SLICE #34.18, AND IT WAS NOT WHEN
--   THIS FILE SHIPPED.** The paragraph here used to say so at length, as a
--   review round's finding: 1b scoped on `btrim(coalesce(tarla_sola,'')) <> ''`
--   and knew nothing about `tarla_id`, so it differed from this file in two
--   directions - it did NOT show the DISAGREEING-id case (section 5's second
--   warning, which only exists on a database repaired through
--   `supabase_repair_missing_tables.sql`, since that file adds `tarla_id`
--   without dropping the text), and it DID list a whitespace-only value that
--   this file treats as blank (the btrim/fold split, two paragraphs BELOW -
--   the old text said "up", and it was wrong about that too). Both are closed:
--   1b now asks `pg_temp.ga40_fold(tarla_sola) <> ''`, the same function this
--   file asks, groups by that fold rather than by the spelling for the reason
--   section 3 gives, and prints the disagreeing case as a row of its own. It
--   reads `tarla_id` through `to_jsonb(p) ->> 'tarla_id'` so that it still
--   runs on a database that has no such column - which is most of them, and is
--   the state 1b exists to be run in.
--
--   ⚠️ **AND IT NOW PREVIEWS THE TWO ABORTS, WHICH NOTHING DID.** #34.18's
--   adversarial round pointed out that a preview naming only what is destroyed
--   leaves an operator reading four tidy rows while the apply dies: section 3
--   RAISEs on a value matching more than one `lookup_tarla` row, and section
--   2's `ADD CONSTRAINT property_tarla_id_fkey` - which runs BEFORE the
--   backfill and before section 5 says anything - fails outright on a
--   `tarla_id` that names no `lookup_tarla` row. Neither destroys a thing;
--   both mean this file does not apply. 1b lists them first, above the
--   destructions, because nothing below them is reachable.
--
--   ⚠️ **"EVERY UNRESOLVED VALUE" IS SCOPED BY ONE PREDICATE, AND A REVIEW
--   ROUND CHANGED WHICH ONE.** Sections 3 to 5 originally asked
--   `btrim(coalesce(tarla_sola, '')) <> ''`, and single-argument `btrim`
--   strips SPACES ONLY. A `tarla_sola` holding a tab therefore counted as
--   carrying a value and would have been reported as a value being erased,
--   while the resolve then matched `'' = ''` and quietly set `tarla_id` - two
--   statements disagreeing about whether the property had a tarla at all.
--   Every guard now
--   asks `pg_temp.ga40_fold(tarla_sola) <> ''` instead, which is the SAME
--   function the match uses (it collapses whitespace before trimming). The
--   blank test and the match test being one function is the point: they cannot
--   disagree about what "carries a value" means.
--
--   ⚠️ **NOTHING IN THIS FILE WRITES TO `lookup_tarla` ANY MORE, and that is
--   worth stating because migration_077's whole subject was who gets to.**
--   The draft that created rows had to argue for `origin` - it would have
--   taken the DEFAULT 'MANUAL', on 077's rule that origin says WHO CHOSE THE
--   NAME. That argument is now moot: this migration inserts nothing, so the
--   auto-seed in `createPropertyIn` remains the only writer of 'IMPORT' rows
--   and the admin modal the only writer of 'MANUAL' ones. The closed
--   two-writer list `document-type-origin-single-source.test.ts` pins is left
--   exactly as #34.02 built it, which is the better outcome - a migration in
--   that list would have been a third writer nobody could see from the code.
--
-- WHY `tarla_id` IS NULLABLE, AND WHY THAT IS NOT A CONCESSION
--   Three of the fourteen properties carry no tarla at all, and that is
--   correct rather than incomplete: `property_type_id` and `use_category_id`
--   are nullable for the same reason, the Add-Property form lets a user leave
--   any of them blank on purpose (`hasCadastralIdentity`'s docblock argues
--   this at length), and ON DELETE SET NULL needs the column to accept NULL by
--   definition. A NOT NULL tarla would make "I do not know the tarla yet" an
--   unrepresentable state on an archive whose whole job is holding incomplete
--   paperwork.
--
-- ⚠️ THE DEPLOY ORDER IS THE OPPOSITE OF migration_077's, AND GETTING IT
-- BACKWARDS BREAKS THE APP EITHER WAY.
--   077 ADDED a column, so the migration had to reach every database FIRST.
--   This file adds one AND DROPS ONE, so there is no order in which a running
--   app is safe:
--     - an app on the OLD schema, after this migration: every
--       `db.select().from(property)` names `tarla_sola`, which no longer
--       exists -> SQLSTATE 42703 on the property list, the property page, the
--       global search and the import.
--     - an app on the NEW schema, before this migration: the same 42703 on
--       `tarla_id`.
--   So this is a COORDINATED DEPLOY, not a rolling one: stop the app, apply
--   the migration, start the app carrying the matching `schema/index.ts`.
--   Local Docker AND Supabase, and Ciprian's box if it is ever brought up on
--   an image older than this slice.
--
--   ⚠️ **AND THEREFORE: DO NOT RUN `Apply-Migration.ps1` FOR THIS FILE UNTIL
--   THE CODE HALF OF #34.03 IS ON THE BRANCH.** The migration is written and
--   `schema/index.ts` is switched, but nothing that reads
--   `property.tarlaSola` is. Applying this file to `ga40db` before that lands
--   takes the running dev app down with 42703 on the property list, the
--   property page, global search and the import. Nothing is lost by waiting;
--   the migration slice ends here by design.
--
--   ⚠️ **AND `npx tsc --noEmit` IS NOT THE WORKLIST - a review round caught an
--   earlier draft of this paragraph claiming it was.** It reports 23 errors in
--   9 files, and those are only the sites that touch the DRIZZLE COLUMN. A
--   dozen more files carry `tarlaSola` as a plain field name on their own
--   types and stay GREEN while being wrong - `list-view.tsx`,
--   `property-form.tsx` (`displayHighlights?.property.tarlaSola`),
--   `move-history.ts`, `validation.ts`, `snapshot-registry.ts`,
--   `metadata/queries.ts`, `tag-dialog.tsx`, `async-select.tsx`,
--   `cadastral-identity.ts`, `property-step-dialog.tsx` - plus TWELVE of the
--   thirteen test files that carry the name (only `property.test.ts` is in the
--   tsc list). A session that lands the nine tsc names and sees green has
--   shipped half a slice.
--   The real worklist is `grep -rn "tarlaSola\|tarla_sola" src e2e scripts`,
--   read with one distinction in mind: the IMPORT's `tarlaSola` (folder-utils,
--   property-folders, import-property-plan, check-summary) is a string parsed
--   out of a FOLDER NAME and it stays a string - what changes is only where
--   that string is resolved to an id.
--
--   ⚠️ **That is why this slice needs Adrian's word and 077 did not.**
--   `C:\dev\.claude\rules\shared-database.md` says changes stay ADDITIVE while
--   more than one app is live, and that a drop needs an explicit confirmation
--   that every consumer goes down together. `ga40prj.Ciprian` is a deployed
--   BUILD of this same app rather than a second codebase - it holds no source,
--   only a schema dump and a docker bundle - and its box is empty, so there is
--   no second population to strand. That is the argument; it is not Claude's
--   to accept on its own, and it is question 3 in the handover.
--
--   ⚠️ THE MIGRATION CHAIN IS ONE OF THREE DOORS INTO A SUPABASE PROJECT.
--   Unchanged from 077, and it matters more here because a DROP is involved:
--     - `supabase_repair_missing_tables.sql` is HAND-MAINTAINED, and an
--       earlier draft of this paragraph claimed it "does not own `property`,
--       so it needs nothing". THAT WAS FALSE, and a review round caught it:
--       section 8 of that file, "COLUMN DRIFT", already carries
--       `ALTER TABLE property ADD COLUMN IF NOT EXISTS updated_by` and
--       `... calculated_area_mp`. It is precisely the door that repairs
--       `property` column drift, and it is the door used when a Supabase
--       project is behind - so a project repaired through it would have gained
--       every other column and NOT `tarla_id`, then answered 42703 on the
--       property list, the property page and global search while that script's
--       own post-flight reported OK. This slice adds the column and its FK
--       there. It does NOT add the DROP: that file's promise is that nothing
--       it does is destructive, and dropping a populated column is exactly
--       what the promise excludes - the same split it already has with
--       migration_070.
--     - `supabase_schema_full.sql` is GENERATED.
--       `.\scripts\Export-SupabaseSchema.ps1` regenerates it from the local
--       database AFTER Apply-Migration.ps1 has run, and the result is
--       committed with this slice. Until it is, `Verify-Rebuild.ps1` reports
--       unbaselined differences (the new column and FK, the dropped column,
--       the dropped trigram index, the COMMENTs) and exits 1 - which is the
--       check working, not a reason to re-baseline.
--
-- WHAT GOES WITH `tarla_sola` WHEN IT IS DROPPED, AND WHAT DOES NOT
--   GOES: `idx_property_tarla_sola_trgm` (migration_053), dropped by Postgres
--   with its column. Nothing replaces it. The global search's tarla clause
--   becomes an `ilike` on `lookup_tarla.indicativ` - a table holding a handful
--   of rows, where a trigram index would be slower than the sequential scan
--   it replaced.
--
--   ALSO GOES, AND A REVIEW ROUND HAD TO SAY SO: the two SEEDS write this
--   column. `src/db/seed_dev_data.sql` names `tarla_sola` in its 40-property
--   INSERT and `src/db/seed.ts` writes `tarlaSola` per row; both run inside
--   their own transaction after a `TRUNCATE ... CASCADE`, so against a
--   migrated database each fails with 42703 AFTER emptying the entity tables
--   and rolls back to an empty archive. `scripts/supabase-sync.ts` shells out
--   to the second of them as its step 4. They are code-half work and they are
--   on the handover's worklist - but they belong in THIS list, because "what
--   breaks when the column goes" is the question this section answers.
--
--   DOES NOT: `property_version.snapshot`. Every existing snapshot keeps the
--   `tarlaSola` TEXT it recorded, and this file does not touch one of them.
--   Rewriting them would be the exact thing `dependents.ts`'s header refuses -
--   "a version is a record of what was true when it was saved; re-pointing it
--   would rewrite history" - and it would be worse than re-pointing, because
--   a snapshot holding an ID reads the CURRENT name for ever after, so the
--   first rename would silently rewrite what every past version says. The
--   text in an old snapshot is the only record of what the property said at
--   the time, and it stays.
--
--   ⚠️ **The consequence is real and is accepted:** the FIRST save of each
--   property after the code half lands writes one version row whose diff shows
--   the tarla field changing, because the snapshot key changes with it. That
--   is bounded (one per property, once), it is honest (the storage really did
--   change), and the alternative - a migration rewriting 14 properties'
--   entire version history - is not. Which key the new snapshot carries, and
--   whether it stores the id or the resolved text, is a CODE decision and is
--   stated in the handover; nothing in this file depends on the answer.
--
-- WHAT THIS FILE DOES ABOUT D-23, WHICH IS LESS THAN THE SLICE EXPECTED
--   D-23 asks whether `lookup_property_type.key` - generated on every insert
--   by `generateUniquePropertyTypeKey` and read by NO application code -
--   should stop being written or start being read. It rides on this slice
--   because the brief expected it to need a migration: "stopping the write
--   means the column becomes nullable, which is a migration".
--
--   ⚠️ **IT DOES NOT. The column has been nullable since the day it was
--   added.** migration_039 writes `ADD COLUMN IF NOT EXISTS key text UNIQUE`
--   with no NOT NULL, `schema/index.ts` declares it `text("key").unique()`
--   with no `.notNull()`, and `supabase_schema_full.sql` dumps it as plain
--   `key text`. Nothing since has tightened it. So stopping the write needs no
--   ALTER at all, and the whole of D-23's answer is code: delete the
--   generator, and stop `scripts/verify-rebuild.ts` asserting a key on this
--   table. This file carries ONE statement for it - the COMMENT in section 6 -
--   because a column that is populated on old rows, NULL on new ones and read
--   by nothing is a trap for the next person, and the comment is where they
--   will look.
--
--   THE COLUMN IS NOT DROPPED, DELIBERATELY. Dropping it would reach into
--   `supabase_repair_missing_tables.sql` (which adds its UNIQUE by hand),
--   `sync-reference-data.sql` (which INSERTs it), `supabase_schema_full.sql`
--   and `schema/index.ts` - four more hand-maintained files, in a slice
--   already carrying a coordinated deploy - to remove something that costs
--   nothing by existing. `shared-database.md` says not to drop a column
--   in the same slice that stops using it, and there is no reason here to
--   spend Adrian's confirmation on a second drop. It is in the handover as a
--   later slice's one-liner.
--
--   The contrast that makes this safe is `lookup_document_type.key`, which is
--   the immutable slug ALL document matching runs on (`seed.ts` resolves
--   documents through it; migration_071 rekeyed it deliberately). That one
--   keeps its `verify-rebuild.ts` assertion. The two columns share a name and
--   nothing else.
--
-- ONE THING THIS MIGRATION MAKES POSSIBLE THAT THE CODE HALF MUST THEN CLOSE
--   The auto-seed in `createPropertyIn` (src/lib/properties/queries.ts) looks
--   its code up with `eq(lookupTarla.indicativ, propFields.tarlaSola)` - an
--   EXACT string match - and inserts when it finds none. This file resolves by
--   FOLD. Those two disagree, and the disagreement has a direction: an import
--   carrying `t3` finds no exact `T3`, so the auto-seed writes a SECOND row -
--   which is precisely the folded twin section 3 refuses to resolve, created
--   by the application on the day after the migration ran. Today that costs
--   only a duplicate-looking list; once `property.tarla_id` is a foreign key
--   it costs two properties that mean one tarla pointing at two rows, and a
--   rename that fixes half of them. **The code half must make that lookup fold
--   the same way this file does**, and it is item 4 of the slice ("the
--   auto-seed writes a row and then the id"). Named here rather than only in
--   the handover because this file is what makes the disagreement matter.
--   (Found by an adversarial round.)
--
-- Idempotent: IF NOT EXISTS / DROP ... IF EXISTS throughout, and section 3's
-- work is guarded on `tarla_sola` still existing, so a second run is a no-op
-- that says so.
--
-- WRAPPED IN A TRANSACTION, for migration_077's reason and one of its own
--   The runner feeds this file to `psql -f` with no --single-transaction, so
--   without a BEGIN each statement commits on its own - and here that would be
--   catastrophic rather than merely untidy: section 7 DROPS THE ONLY COPY of
--   the text. Unwrapped, section 3's refusal would fire AFTER the FK had been
--   committed, and any error between the backfill and the drop would leave the
--   database half-resolved, with a `tarla_sola` that is about to go and no
--   record of which properties were still relying on it. BEGIN/COMMIT makes
--   every failure in this file a rollback to exactly the state it started in.
--   (Section 5 raises no exception - see its own header. The rollback
--   guarantee rests on section 3 and on the drop, not on it.)

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The fold
-- ---------------------------------------------------------------------------
--
-- `pg_temp`, so it exists for this psql session and disappears with it: this
-- is a migration's private helper, not a database object the schema owns, and
-- a permanent function here would show up as an unbaselined difference in
-- Verify-Rebuild for ever. Character for character `decision-checks.sql`'s -
-- see the header for why it is copied rather than improved.

CREATE OR REPLACE FUNCTION pg_temp.ga40_fold(txt text) RETURNS text AS $fold$
  SELECT btrim(regexp_replace(
           regexp_replace(
             lower(normalize(coalesce($1, ''), NFD)),
             '[' || chr(768) || '-' || chr(879) || ']', '', 'g'),
           '\s+', ' ', 'g'))
$fold$ LANGUAGE sql IMMUTABLE;

-- ---------------------------------------------------------------------------
-- 2. The column
-- ---------------------------------------------------------------------------
--
-- migration_028's shape, for migration_028's reasons. The constraint is added
-- SEPARATELY from the column rather than inline, because
-- `ADD COLUMN IF NOT EXISTS ... REFERENCES` adds nothing at all on a second
-- run - including the constraint, if a first run somehow got the column in
-- without it.
--
-- ⚠️ **And it is added under a guard rather than DROPPED AND RE-ADDED. An
-- earlier draft of this file did the latter, and this paragraph still
-- described it two review rounds after the code stopped doing it** - which is
-- exactly the shape of comment this repo keeps catching. Do not "restore" the
-- `DROP CONSTRAINT IF EXISTS property_tarla_id_fkey`: the paragraph under the
-- next statement is the reason it is gone.

ALTER TABLE property
  ADD COLUMN IF NOT EXISTS tarla_id uuid;

-- ⚠️ **TESTED BY SHAPE, NOT BY NAME, AND THAT IS THE FIX FOR A MISTAKE THIS
-- REPO HAS ALREADY MADE ONCE.** `supabase_repair_missing_tables.sql`'s
-- `lookup_property_type.key` block carries the scar: a name-only test found
-- nothing on a migrated database, so the block added a SECOND unique
-- constraint over the same column and `pg_dump -s` of a repaired database
-- disagreed with a migrated one. The same trap is live here - a database
-- built by `drizzle-kit push` names this constraint
-- `property_tarla_id_lookup_tarla_id_fk`, so `DROP CONSTRAINT IF EXISTS
-- property_tarla_id_fkey` would no-op and the ADD would give `property` two
-- identical foreign keys. Asking `conrelid`/`contype`/`confrelid`/`conkey`
-- cannot be fooled by a name.
--
-- ⚠️ **AND THE DELETE ACTION IS PART OF THE SHAPE, NOT A DETAIL** - a third
-- review round asked what happens to an FK that is present with the WRONG one.
-- `ON DELETE SET NULL` is the entire point of copying migration_028: at the
-- default NO ACTION, removing a code from Reference Data fails with 23503
-- instead of clearing the tag, and at CASCADE it DELETES THE PROPERTIES. A
-- guard that only asked "is there an FK" would find such a constraint, skip
-- the ADD, and leave the migration reporting success on a database where the
-- delete path is broken or dangerous. So this block drops what it finds by its
-- OWN name, whatever that is, and re-adds it correctly. This file owns the
-- schema, so dropping here is legitimate; the repair script, which promises it
-- never drops, warns instead.        (Found by adversarial rounds two and three.)
DO $$
DECLARE
  tarla_attnum smallint;
  wrong_fk     text;
BEGIN
  SELECT attnum INTO STRICT tarla_attnum
    FROM pg_attribute
   WHERE attrelid = 'public.property'::regclass
     AND attname  = 'tarla_id'
     AND NOT attisdropped;

  -- Any FK on exactly (tarla_id) -> lookup_tarla whose delete action is not
  -- SET NULL ('n'), by its own name. There can be more than one; loop.
  FOR wrong_fk IN
    SELECT c.conname
      FROM pg_constraint c
     WHERE c.conrelid    = 'public.property'::regclass
       AND c.contype     = 'f'
       AND c.confrelid   = 'public.lookup_tarla'::regclass
       AND c.conkey      = ARRAY[tarla_attnum]::smallint[]
       AND c.confdeltype <> 'n'
  LOOP
    RAISE NOTICE 'migration_078: dropping foreign key % on property(tarla_id) - its ON DELETE action is not SET NULL.', wrong_fk;
    EXECUTE format('ALTER TABLE property DROP CONSTRAINT %I', wrong_fk);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint c
     WHERE c.conrelid    = 'public.property'::regclass
       AND c.contype     = 'f'
       AND c.confrelid   = 'public.lookup_tarla'::regclass
       AND c.conkey      = ARRAY[tarla_attnum]::smallint[]
       AND c.confdeltype = 'n'
  ) THEN
    ALTER TABLE property
      ADD CONSTRAINT property_tarla_id_fkey
      FOREIGN KEY (tarla_id) REFERENCES lookup_tarla(id) ON DELETE SET NULL;
  END IF;
END $$;

-- No index on `tarla_id`, and that matches `property_type_id` and
-- `use_category_id`, which have none either: this table holds one business
-- user's parcels and every read of it is already a sequential scan.

-- ---------------------------------------------------------------------------
-- 3. The one case this migration refuses to decide
-- ---------------------------------------------------------------------------
--
-- Guarded on `tarla_sola` still existing so the file is re-runnable - this is
-- the section that SAYS SO on a second run; sections 4 and 5 carry the same
-- guard and return silently rather than printing the same line three times.
-- Written with EXECUTE for that reason: a plain statement naming a dropped
-- column fails when plpgsql plans it, and relying on plpgsql never reaching
-- it would make a second run's success depend on lazy planning.

DO $$
DECLARE
  ambiguous text;
BEGIN
  -- ⚠️ `pg_attribute`, NOT `information_schema.columns`, and a review round is
  -- why. `information_schema` shows a column only to a role that holds SOME
  -- privilege on it, so under a restricted role - a Supabase SQL-editor
  -- session, say - the catalogue view comes back EMPTY and all three guards
  -- silently take the "already gone" branch: no ambiguity check, no rows
  -- created, no backfill. `pg_attribute` is not privilege-filtered.
  -- `attisdropped` excludes a column dropped but not yet vacuumed away.
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
     WHERE attrelid = 'public.property'::regclass
       AND attname  = 'tarla_sola'
       AND NOT attisdropped
  ) THEN
    RAISE NOTICE 'migration_078: property.tarla_sola is already gone - sections 3 to 5 have nothing to do.';
    RETURN;
  END IF;

  -- One row per offending VALUE, naming the spellings it matched, so the
  -- message is actionable rather than a count. `string_agg(DISTINCT x ORDER BY
  -- x)` is legal only when the ORDER BY expression is the DISTINCT one, which
  -- is why both name `t.indicativ`.
  EXECUTE $q$
    SELECT string_agg(g.line, E'\n' ORDER BY g.line)
      FROM (
        SELECT '  "' || min(btrim(regexp_replace(p.tarla_sola, '\s+', ' ', 'g')))
               || '" matches '
               || count(DISTINCT t.id) || ' lookup_tarla rows: '
               || string_agg(DISTINCT t.indicativ, ' | ' ORDER BY t.indicativ) AS line
          FROM property p
          JOIN lookup_tarla t
            ON pg_temp.ga40_fold(t.indicativ) = pg_temp.ga40_fold(p.tarla_sola)
         WHERE pg_temp.ga40_fold(p.tarla_sola) <> ''
         -- ⚠️ Grouped by THE FOLD - the same expression the JOIN matches on -
         -- so one logical value is one line. A third review round caught an
         -- earlier version grouping by the trimmed display value while joining
         -- on the fold: `T9` and `t9` on two properties then printed the
         -- identical pair twice, which is the "one line per spelling" outcome
         -- this comment claims to prevent. `min(...)` picks one spelling to
         -- SHOW; which one does not matter, because the point of the message
         -- is the lookup rows it names.
         GROUP BY pg_temp.ga40_fold(p.tarla_sola)
        HAVING count(DISTINCT t.id) > 1
      ) g
  $q$ INTO ambiguous;

  -- Built into a variable and raised with a single `%`, rather than assembled
  -- in the RAISE itself: a format string whose placeholder count drifts from
  -- its argument list fails at the moment it fires, which is the one moment
  -- this message has to work.
  IF ambiguous IS NOT NULL THEN
    RAISE EXCEPTION '%', E'migration_078 refuses to resolve. These tarla values on properties match MORE THAN ONE lookup_tarla row:\n'
      || ambiguous
      || E'\nMerge or rename the duplicate codes in Reference Data first, then re-run this migration. '
      || 'Picking one here would decide, silently and permanently, which of two codes every carrying '
      || 'property belongs to - see the header, "THE ONE CASE THIS FILE REFUSES".';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. The backfill
-- ---------------------------------------------------------------------------
--
-- A plain equi-join on the fold. Section 3 has already proved it cannot match
-- two rows; a value that matches none is left with `tarla_id` NULL and is
-- named by section 5 before section 7 destroys it.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
     WHERE attrelid = 'public.property'::regclass
       AND attname  = 'tarla_sola'
       AND NOT attisdropped
  ) THEN
    RETURN;
  END IF;

  -- ⚠️ `AND p.tarla_id IS NULL`, not `IS DISTINCT FROM t.id`, and a review
  -- round is why. `IS DISTINCT FROM` only skips a write that would change
  -- nothing; it happily OVERWRITES an id something else already set. That is
  -- reachable: `supabase_repair_missing_tables.sql` adds `tarla_id` and does
  -- NOT drop `tarla_sola` (it promises never to drop), so a repaired Supabase
  -- project runs with BOTH columns - the new-schema app writing the id while
  -- the old text sits unread and going stale. Re-pointing such a property at
  -- whatever its stale text folds to would silently undo an edit a person
  -- made. This migration BACKFILLS; it does not re-decide.
  --
  -- It also makes the three predicates in this file identical - backfill,
  -- count, and the list section 5 prints - which is what makes "nothing is
  -- dropped without being named" true rather than nearly true.
  EXECUTE $q$
    UPDATE property p
       SET tarla_id = t.id
      FROM lookup_tarla t
     WHERE pg_temp.ga40_fold(p.tarla_sola) <> ''
       AND p.tarla_id IS NULL
       AND pg_temp.ga40_fold(t.indicativ) = pg_temp.ga40_fold(p.tarla_sola)
  $q$;
END $$;

-- ---------------------------------------------------------------------------
-- 5. What is about to be destroyed, said out loud
-- ---------------------------------------------------------------------------
--
-- TWO WARNINGS, BECAUSE THERE ARE TWO WAYS A VALUE GOES
--   The first is the one this slice is about: no `lookup_tarla` code matches
--   the text, so the property is left with `tarla_id` NULL and the text dies
--   with the column. The second only exists on a database repaired through
--   `supabase_repair_missing_tables.sql` - which adds `tarla_id` and does not
--   drop the text - where a property can hold BOTH, disagreeing. There the id
--   wins, which is right, and the text still disappears, which still deserves
--   a line. Together with "the text agrees with the id" and "blank", those
--   four cases are the whole space; section 7's comment leans on that.
--
-- ⚠️ **THIS SECTION IS THE ONLY RECORD THAT AN UNMATCHED VALUE EVER EXISTED,
-- AND THAT IS WHY IT IS A WARNING AND WHY IT NAMES THE PROPERTY.** Section 7
-- drops the column two statements later, so a value that matched no
-- `lookup_tarla` row is gone at COMMIT. A count would be useless here - "1
-- value dropped" tells nobody which property to go and look at - so each one
-- is printed as `PROP01612 = "..."`, on stderr, where psql shows it above the
-- summary rather than in the notice stream with everything else.
--
-- It does NOT refuse. Adrian's answer for this database is that an unmatched
-- value is a test string; refusing would make every future run of this file
-- wait for somebody to hand-clean one. The header argues the whole of that
-- under "WHY A VALUE THAT MATCHES NOTHING IS ERASED"; what belongs here is
-- that the loudness is the substitute for the refusal, so it must not be
-- quietly downgraded to a NOTICE later.

DO $$
DECLARE
  n_with    integer;
  n_blank   integer;
  n_erased  integer;
  n_stale   integer;
  n_codes   integer;
  doomed    text;
  disagreed text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
     WHERE attrelid = 'public.property'::regclass
       AND attname  = 'tarla_sola'
       AND NOT attisdropped
  ) THEN
    RETURN;
  END IF;

  EXECUTE $q$SELECT count(*) FROM property WHERE pg_temp.ga40_fold(tarla_sola) <> ''$q$ INTO n_with;
  EXECUTE $q$SELECT count(*) FROM property WHERE pg_temp.ga40_fold(tarla_sola) =  ''$q$ INTO n_blank;
  EXECUTE $q$SELECT count(*) FROM property WHERE pg_temp.ga40_fold(tarla_sola) <> '' AND tarla_id IS NULL$q$ INTO n_erased;

  -- The OTHER way a value can be dropped: the property already had a
  -- `tarla_id` (see the backfill's comment - a repaired Supabase project runs
  -- with both columns) and its stale text does not agree with the code that id
  -- names. Nothing of value is lost - the id is the answer and it survives -
  -- but a review round was right that a text destroyed without a word is a
  -- text destroyed without a word, whatever its quality.
  EXECUTE $q$
    SELECT count(*) FROM property p
     WHERE pg_temp.ga40_fold(p.tarla_sola) <> ''
       AND p.tarla_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM lookup_tarla t
          WHERE t.id = p.tarla_id
            AND pg_temp.ga40_fold(t.indicativ) = pg_temp.ga40_fold(p.tarla_sola)
       )
  $q$ INTO n_stale;

  IF n_erased > 0 THEN
    -- Ordered by code so a re-run of this migration on a restored backup
    -- prints the same list in the same order, which is what makes the two
    -- logs comparable.
    EXECUTE $q$
      SELECT string_agg(
               '  ' || p.code || ' = "'
                    || btrim(regexp_replace(p.tarla_sola, '\s+', ' ', 'g')) || '"',
               E'\n' ORDER BY p.code)
        FROM property p
       WHERE pg_temp.ga40_fold(p.tarla_sola) <> ''
         AND p.tarla_id IS NULL
    $q$ INTO doomed;

    RAISE WARNING '%', E'migration_078 is about to ERASE the tarla value on '
      || n_erased || E' propert(y/ies). No lookup_tarla code matches them, and '
      || E'this migration does not invent one - see the header. They are gone at COMMIT:\n'
      || doomed
      || E'\nThis is a RECORD, not a prompt - the runner is non-interactive and '
      || 'COMMIT follows immediately. If any of those is a real code, recovery is a '
      || 'restore; the way to catch it next time is scripts/decision-checks.sql '
      || 'query 1b, run BEFORE Apply-Migration.';
  END IF;

  IF n_stale > 0 THEN
    EXECUTE $q$
      SELECT string_agg(
               '  ' || p.code || ': text "'
                    || btrim(regexp_replace(p.tarla_sola, '\s+', ' ', 'g'))
                    || '" vs code "' || t.indicativ || '" (the code is kept)',
               E'\n' ORDER BY p.code)
        FROM property p
        JOIN lookup_tarla t ON t.id = p.tarla_id
       WHERE pg_temp.ga40_fold(p.tarla_sola) <> ''
         AND pg_temp.ga40_fold(t.indicativ) <> pg_temp.ga40_fold(p.tarla_sola)
    $q$ INTO disagreed;

    RAISE WARNING '%', 'migration_078: ' || n_stale || E' propert(y/ies) already had a tarla_id '
      || E'that DISAGREES with the text being dropped. The id is kept and the '
      || E'text is discarded, which is the right way round - but it is the only '
      || E'notice either value ever gets:\n' || disagreed;
  END IF;

  -- One count per fact, and as many `%` in the format string as there are
  -- arguments under it - the rule section 3 states and an earlier draft of
  -- this block did not follow.
  SELECT count(*) INTO n_codes FROM lookup_tarla;
  RAISE NOTICE 'migration_078: % propert(y/ies) carried a tarla value - % now point at a lookup_tarla row (% of those at a code that DISAGREED with the text, warned above) and % had no matching code and lose it; % carried none and stay NULL; lookup_tarla holds % row(s), unchanged by this file.',
    n_with, n_with - n_erased, n_stale, n_erased, n_blank, n_codes;
END $$;

-- ---------------------------------------------------------------------------
-- 6. What the columns mean now
-- ---------------------------------------------------------------------------

COMMENT ON COLUMN property.tarla_id IS
  'Nr. tarla / sola, as a REFERENCE to the Indicative Tarla list rather than as text (Slice #34.03, migration_078). Replaced property.tarla_sola, which held the indicativ as free text: renaming a code in Reference Data reached no property at all, the dependents count was a string match, and the dropdown had to synthesise an option for any value the list did not hold. Nullable and ON DELETE SET NULL, exactly like property_type_id and use_category_id - a property may legitimately not know its tarla yet, and removing a code from Reference Data clears the tag rather than blocking the delete. Note that property_version.snapshot rows written BEFORE this migration still carry the old tarlaSola TEXT, deliberately: a version is a record of what was true when it was saved.';

COMMENT ON COLUMN lookup_property_type.key IS
  'DEAD SINCE Slice #34.03 (D-23): nothing writes it and nothing reads it. It was added by migration_039 as the slug src/lib/properties/type-config.ts switched on for per-type field visibility; that module no longer exists - migration_041 replaced it with the show_tarla_parcela / show_address / show_street_view booleans on this table - and #34.03 deleted the generator that was still filling the column in on every insert. So rows created before that slice hold a slug, rows created after hold NULL, and NEITHER is read. Do not start reading it without repopulating it. NOT the same thing as lookup_document_type.key, which is the immutable slug all document matching and seeding run on and which scripts/verify-rebuild.ts still requires. The column is left in place rather than dropped only because dropping it would reach into four more hand-maintained files for no gain; see migration_078''s header.';

-- ---------------------------------------------------------------------------
-- 7. The old column
-- ---------------------------------------------------------------------------
--
-- Last, and only after section 5 has PRINTED every value that is about to go
-- with it. There is no assertion in front of this statement and that is
-- deliberate, not an omission: a value matching no code is erased on purpose
-- here (header, "WHY A VALUE THAT MATCHES NOTHING IS ERASED"), so the guard is
-- the WARNING rather than a refusal. What section 5 DOES guarantee is that
-- every property whose text is about to disappear has been NAMED, in one of
-- its two lists: the values with no matching code at all, and the values whose
-- property already carried a DISAGREEING `tarla_id`. Those two, plus "the text
-- agrees with the id it already had" and "blank", are the whole space -
-- because all four ask the same question with the same function,
-- `pg_temp.ga40_fold(tarla_sola)`, and the backfill now writes only where
-- `tarla_id IS NULL`. An earlier version of this paragraph claimed the
-- guarantee while the report carried an `AND tarla_id IS NULL` that the drop
-- did not; that gap was real and is closed.
--
-- Postgres drops `idx_property_tarla_sola_trgm` (migration_053) with the
-- column; nothing replaces it, for the reason in the header.

ALTER TABLE property DROP COLUMN IF EXISTS tarla_sola;

COMMIT;
