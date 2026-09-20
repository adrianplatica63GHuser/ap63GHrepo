-- migration_084_person_document_cota_parte.sql
-- Slice #36.02 - a person may hold several roles on one document, and each
-- role may carry a cota-parte.
--
-- WHAT THIS DOES
--   Three nullable columns on `person_document` - `cota_parte`,
--   `cota_suprafata_mp`, `cota_mod` - one CHECK on the third, and
--   `person_document_unique` dropped and recreated over
--   (person_id, document_id, person_role_id) WITH NULLS NOT DISTINCT.
--   No data is changed. No row is deleted. Nothing else is touched.
--
-- ---------------------------------------------------------------------------
-- WHY THE WIDENING IS A DEFECT FIX AND NOT A FEATURE
-- ---------------------------------------------------------------------------
--
-- `person_document_unique` is today over (person_id, document_id) alone, so one
-- person may hold ONE role on one document. `associatePersonsToDocument`
-- (src/lib/documents/queries.ts) and `associateDocumentsToPerson`
-- (src/lib/persons/queries.ts) both end in `.onConflictDoNothing()`, so a
-- second role on the same pair is not REFUSED: the insert does nothing, returns
-- successfully, and says nothing. A user who attaches one man as „Vanzator"
-- and then as „Reprezentant legal / Mandatar" sees no error, no warning and no
-- second row.
--
-- `5-CVC 2-2-5000 CRH 2016` is exactly that document: one seller in his own
-- name who is also mandatar for three other sellers. Today the archive cannot
-- hold what that deed says, and does not admit it.
--
-- ---------------------------------------------------------------------------
-- THE TRAP IN THE NAIVE RECREATION, AND WHY `NULLS NOT DISTINCT`
-- ---------------------------------------------------------------------------
--
-- ⚠️ **`person_role_id` IS NULLABLE AND POSTGRES TREATS NULLS AS DISTINCT IN A
-- UNIQUE INDEX BY DEFAULT.** A bare
--   CREATE UNIQUE INDEX ... ON person_document (person_id, document_id, person_role_id)
-- therefore lets the SAME person be attached to the SAME document with NO role
-- an unlimited number of times - a new defect introduced by the fix for the old
-- one, and a worse one, because the role-less attachment is the ordinary path
-- from the general Persons tab.
--
-- The server is PostgreSQL 16, so `NULLS NOT DISTINCT` (PG15+) is available and
-- is what this file uses. Two role-less rows for one pair collide exactly as
-- they do today.
--
-- ⚠️ **THE ALTERNATIVE WAS A PAIR OF PARTIAL INDEXES, AND WHAT ARGUES FOR IT IS
-- THE CODE-SIDE RECORD, NOT THE DATABASE.** drizzle-orm 0.45.2's `uniqueIndex`
-- builder has no `nullsNotDistinct()` - it exists only on `unique()`, the table
-- CONSTRAINT builder (node_modules/drizzle-orm/pg-core/unique-constraint.d.ts).
-- So `src/db/schema/index.ts` cannot state this index exactly, and carries a
-- ⚠️ saying so and pointing here. A partial pair
--   (person_id, document_id, person_role_id) WHERE person_role_id IS NOT NULL
--   (person_id, document_id)                 WHERE person_role_id IS NULL
-- WOULD be exactly expressible on both sides.
--
-- It was not taken, for three reasons. It is two objects and two names where
-- the archive has one, and the second name would have to be carried into
-- `supabase_schema_full.sql`, the rebuild comparison and every place that
-- reads an index name. Drizzle is not what creates this index - migrations are
-- applied by hand through `scripts\Apply-Migration.ps1` - and the only drizzle
-- code that touches the conflict is `.onConflictDoNothing()` with NO conflict
-- target, which covers every unique index on the table whatever its shape, so
-- the approximation in the declaration costs nothing at runtime. And a
-- comment naming the limitation is a cheaper honesty than a second index.
--
-- If drizzle later grows `nullsNotDistinct()` on `uniqueIndex`, the declaration
-- becomes exact and this paragraph becomes history.
--
-- ---------------------------------------------------------------------------
-- WHY SECTION 1 COUNTS FIRST EVEN THOUGH IT CANNOT FAIL HERE
-- ---------------------------------------------------------------------------
--
-- The new key is strictly WIDER than the old one, so on any database where
-- `person_document_unique` exists as it is today a collision is arithmetically
-- impossible: rows unique on (person, document) are unique on
-- (person, document, role) too, nulls-not-distinct included.
--
-- ⚠️ **AND THIS FILE STILL MEASURES, FOR migration_080's REASON.**
-- `migrationChain()` in `scripts/verify-rebuild.ts` globs
-- `src/db/migration_*.sql` and applies every match in name order, so this runs
-- on the rebuild chain, on the cloud project, on Ciprian's UAT box, and on
-- whatever Adrian's dev database has become. A database whose old index was
-- dropped by hand, or restored without it, CAN hold a colliding pair - and
-- `CREATE UNIQUE INDEX` on one "fails with an unreadable" error
-- (migration_080) naming the key and neither row. Section 1 asks first and
-- names the person, the document and how many rows each pair holds, which is
-- what the person resolving it actually needs. Nothing is changed when it
-- refuses: the whole file is one transaction.
--
-- ---------------------------------------------------------------------------
-- THE THREE COLUMNS
-- ---------------------------------------------------------------------------
--
-- All three are nullable, and all three sit on `person_document` beside
-- `person_role_id`, because a share belongs to a PERSON IN A ROLE and not to a
-- person: the same man is a seller at 40% and a mandatar at nothing.
--
--   * `cota_parte numeric(7,4)` - the undivided share as a percentage. FOUR
--     decimals because the archive contains 63,6400 / 9,0900 / 27,2700 /
--     10,4100, which are thirds and elevenths written out; two decimals would
--     round them into a total that no longer reaches 100.
--
--   * `cota_suprafata_mp numeric(12,2)` - the equivalent area where the deed
--     states one, matching `property.surface_area_mp`'s precision on purpose.
--     The deeds state both: „63,64% (3.182 mp)", „10,41% = 114,86 mp din
--     1.103,38 mp". Storing the mp is not redundancy - it is what the deed was
--     signed on, and recomputing it from a rounded percentage gives a
--     different number.
--
--   * `cota_mod text` with a CHECK - how the share is held. This is the column
--     that makes spouses representable, and the one that is expensive to add
--     later, because it would need a backfill nobody could redo from the scans
--     a second time.
--
-- ⚠️ **NO RANGE CHECK ON `cota_parte`, DELIBERATELY.** `0 < cota_parte <= 100`
-- reads like free integrity and is the wrong rule for this table. The archive's
-- job is to show the user what the paper says rather than to refuse the paper -
-- which is the same sentence that makes the per-role total a WARNING and not a
-- block (`src/lib/documents/cota-parte-total.ts`). A notary's rounding, a deed
-- that states shares that do not close, a figure transcribed from a scan that
-- is itself wrong: every one of those must be savable and visible, because an
-- archive that refuses them records nothing at all. `numeric(7,4)` bounds the
-- value at 999.9999 as a consequence of its precision; that is a storage fact,
-- not a rule this file is asserting.
--
-- ⚠️ **AND NO `carries_share` FLAG ON `lookup_person_role`.** A notary has no
-- share and a mandatar usually has none, so the temptation is a column saying
-- which roles may carry one. migration_079's header carries a loud warning that
-- `lookup_person_role` has `valid_for_property` and `valid_for_person` and must
-- never grow a `valid_for_document`, because document roles are per-type and
-- live in the `lookup_doc_type_person_role` grid. A `carries_share` boolean
-- would be a third dimension on that same table, would need a seed value for
-- every existing role, and would have to be hand-maintained forever to save a
-- user from leaving a box empty. An empty box is not a defect, and the per-role
-- total ignores nulls, so a notary costs nothing.
--
-- ---------------------------------------------------------------------------
-- THE `cota_mod` VALUES, AND WHY DEVALMASIE IS THE REASON THE COLUMN EXISTS
-- ---------------------------------------------------------------------------
--
--   NUME_PROPRIU   - in nume propriu
--   DEVALMASIE     - comunitate devalmasa (spouses, no determinate shares)
--   INDIVIZIUNE    - coproprietate pe cote-parti
--   PRIN_MANDATAR  - held through a mandatar
--
-- In `5-CVC 2-2-5000 CRH 2016` the sellers are „sotii SIMON, 60%" and „sotii
-- PRISECARU, 40%" - FOUR PEOPLE AND TWO SHARES. Comunitate devalmasa has no
-- determinate shares between the spouses, so splitting 60 into 30 and 30 is
-- legally wrong, and writing 60 on both rows makes the sellers total 200%.
-- `DEVALMASIE` is what lets both spouses carry 60 and be counted once. The
-- counting rule itself is code, not a constraint, and lives in
-- `src/lib/documents/cota-parte-total.ts` with its own tests; it is not
-- restated here, because a rule stated twice is a rule that can disagree with
-- itself.
--
-- The values are ASCII keys, not display text: the Romanian with diacritics is
-- in `messages/ro-RO.json` under `document.persons.cotaMod.*`, so a rename of
-- the label is not a data migration.
--
-- ---------------------------------------------------------------------------
-- THE OTHER DOORS INTO A DATABASE
-- ---------------------------------------------------------------------------
--
--   * `src/db/schema/index.ts` - the three columns, the CHECK and the widened
--     index are declared there in the same commit as this file, with the
--     drizzle ⚠️ described above.
--   * `src/db/supabase_schema_full.sql` - GENERATED. Regenerated by
--     `scripts/Export-SupabaseSchema.ps1`; never hand-edited.
--   * `scripts/Verify-Rebuild.ps1` - replays this chain onto an empty
--     `postgis/postgis:16-3.4` container and compares it object by object
--     against the generated file. A dropped-and-recreated index is exactly the
--     shape that shows up there.
--
-- ---------------------------------------------------------------------------

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Count first. Refuse, and name the pairs, rather than fail unreadably.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  n_pairs integer;
  detail  text;
BEGIN
  SELECT count(*) INTO n_pairs FROM (
    SELECT person_id, document_id, person_role_id
      FROM person_document
     GROUP BY person_id, document_id, person_role_id
    HAVING count(*) > 1
  ) g;

  IF n_pairs = 0 THEN
    RAISE NOTICE 'migration_084: no (person, document, role) triple is duplicated - the widened index can be created.';
  ELSE
    SELECT string_agg(line, E'\n         ' ORDER BY line) INTO detail FROM (
      SELECT coalesce(p.display_name, p.id::text)
             || '  /  ' || coalesce(d.code, d.id::text)
             || '  /  ' || coalesce(r.name, '(fara rol)')
             || '  =  ' || g.n || ' row(s)' AS line
        FROM (
          SELECT person_id, document_id, person_role_id, count(*) AS n
            FROM person_document
           GROUP BY person_id, document_id, person_role_id
          HAVING count(*) > 1
        ) g
        JOIN person   p ON p.id = g.person_id
        JOIN document d ON d.id = g.document_id
        LEFT JOIN lookup_person_role r ON r.id = g.person_role_id
    ) x;

    RAISE EXCEPTION E'migration_084 REFUSED: % (person, document, role) triple(s) are already duplicated, so the widened unique index cannot be created.\n         %\n         This should be impossible where person_document_unique still exists over (person_id, document_id) - it means that index is gone on this database. Delete the surplus rows (they are exact duplicates: same person, same document, same role), then re-run. Nothing has been changed.',
      n_pairs, coalesce(detail, '(none)');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. The three columns, and the one CHECK.
-- ---------------------------------------------------------------------------

ALTER TABLE person_document
  ADD COLUMN IF NOT EXISTS cota_parte        numeric(7,4),
  ADD COLUMN IF NOT EXISTS cota_suprafata_mp numeric(12,2),
  ADD COLUMN IF NOT EXISTS cota_mod          text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'person_document_cota_mod_check'
       AND conrelid = 'public.person_document'::regclass
  ) THEN
    ALTER TABLE person_document
      ADD CONSTRAINT person_document_cota_mod_check
      CHECK (cota_mod IS NULL OR cota_mod IN ('NUME_PROPRIU', 'DEVALMASIE', 'INDIVIZIUNE', 'PRIN_MANDATAR'));
  END IF;
END $$;

COMMENT ON COLUMN person_document.cota_parte IS
  'The undivided share this person holds on this document IN THIS ROLE, as a percentage. numeric(7,4) - four decimals because the archive holds 63,6400 / 9,0900 / 27,2700 / 10,4100, which are thirds and elevenths written out, and two decimals round them into a total that no longer reaches 100. NULL is ordinary and is not a defect: a notary has no share, a mandatar usually has none, and a 2006 deed may state none at all. NO range CHECK, deliberately - see migration_084. The per-role total that warns on a deed which does not close is code, in src/lib/documents/cota-parte-total.ts, and it warns rather than blocks.';

COMMENT ON COLUMN person_document.cota_suprafata_mp IS
  'The equivalent area in square metres where the deed states one, matching property.surface_area_mp''s numeric(12,2) on purpose. Not redundant with cota_parte: the deeds state both („63,64% (3.182 mp)", „10,41% = 114,86 mp din 1.103,38 mp") and it is the mp figure the deed was signed on - recomputing it from a rounded percentage gives a different number. NULL when the deed states only a percentage.';

COMMENT ON COLUMN person_document.cota_mod IS
  'How the share is held: NUME_PROPRIU (in nume propriu), DEVALMASIE (comunitate devalmasa - spouses, no determinate shares between them), INDIVIZIUNE (coproprietate pe cote-parti), PRIN_MANDATAR (held through a mandatar). ASCII keys, not display text; the Romanian with diacritics is in messages/ro-RO.json under document.persons.cotaMod.*. DEVALMASIE is the reason this column exists: in 5-CVC 2-2-5000 CRH 2016 the sellers are two married couples holding 60% and 40% - four people, two shares - and splitting 60 into 30/30 is legally wrong while writing 60 on both rows makes the sellers total 200%. The counting rule (a devalmasie block counts ONCE) is in src/lib/documents/cota-parte-total.ts, not restated as a constraint.';

-- ---------------------------------------------------------------------------
-- 3. The index: dropped, and recreated one column wider, NULLS NOT DISTINCT.
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS person_document_unique;

CREATE UNIQUE INDEX IF NOT EXISTS person_document_unique
  ON person_document (person_id, document_id, person_role_id)
  NULLS NOT DISTINCT;

DO $$
DECLARE
  n_rows      integer;
  n_with_role integer;
BEGIN
  SELECT count(*), count(person_role_id) INTO n_rows, n_with_role FROM person_document;
  RAISE NOTICE 'migration_084: person_document holds % row(s), % of them with a role. person_document_unique is now over (person_id, document_id, person_role_id) NULLS NOT DISTINCT; cota_parte, cota_suprafata_mp and cota_mod added, all NULL.',
    n_rows, n_with_role;
END $$;

COMMIT;
