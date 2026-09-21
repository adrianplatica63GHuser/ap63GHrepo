-- migration_086_document_reference_direction.sql
-- Slice #36.03 - a document_document role can say WHICH WAY it reads, a
-- document can carry the instruments its pages cited, and the four roles a
-- title chain needs exist.
--
-- WHAT THIS DOES
--   1. `document_document.role_reads_a_to_b boolean NOT NULL DEFAULT true`,
--      counted first so the run PRINTS how many existing rows take that
--      default and therefore carry a direction nobody verified.
--   2. `document.referenced_instruments jsonb` - the structured references the
--      AI read returned, so the review screen can be reopened without paying
--      for the pages again.
--   3. Four rows in `lookup_document_document_role`, each with its own
--      pre-check.
--   No row's data is changed. No index is dropped. No table is created.
--
-- ---------------------------------------------------------------------------
-- 1. WHY A BOOLEAN AND NOT THE TIDIER RESHAPE
-- ---------------------------------------------------------------------------
--
-- `document_document` is `(document_id_a, document_id_b, relationship_role_id)`
-- with `uniqueIndex document_document_unique` on (a, b) and a CHECK that
-- `document_id_a < document_id_b`. **THAT ORDERING IS BY UUID.** It is a
-- canonicalisation trick that stops one pair being stored twice, and it
-- carries no meaning whatever - `associateDocumentToDocument` in
-- src/lib/documents/queries.ts literally calls `[documentId, otherId].sort()`.
--
-- Every role migration_055 seeded is directional in its wording: „Inlocuieste",
-- „Modifica", „Prelungeste", „Anuleaza", „Versiune anterioara a", „Anexa la",
-- „Corectie a". On a pair whose uuids happen to sort the other way „Anexa la"
-- READS BACKWARDS, and nothing in the schema, the API or the screen can tell.
-- That is a live defect today and this file does not introduce it; what makes
-- it unacceptable NOW is that Slice #36.03 seeds „Titlu anterior al", in an
-- archive whose whole job is proving a chain of title.
--
-- ⚠️ **THE TIDY FIX WAS CONSIDERED AND IS REFUSED.** Dropping the CHECK,
-- renaming the columns to `from`/`to` and letting the order carry the meaning
-- is the better schema and cannot be reached from here: every EXISTING row
-- would need a direction, and for an existing row **the correct direction is
-- not knowable from anything in the database** - the uuids are random, so the
-- backfill would be a coin toss written down as fact. A boolean with a default
-- makes exactly the same guess, but it makes it ONCE, in a column whose name
-- says what it is, and section 1 below prints how many rows it was made for so
-- a person can go and look. A rename plus a coin-toss backfill would spread the
-- same guess across the primary key.
--
-- ⚠️ **THE UNIQUE INDEX AND THE CHECK ARE LEFT EXACTLY AS THEY ARE.** One pair
-- still stores one row. The flag is about how that row READS, never about how
-- many of them there may be - so a pair linked as „Titlu anterior al" cannot
-- also be stored as the reverse, which is correct: it is one relationship.
--
-- `true` is the right default rather than a neutral one, and `NOT NULL` rather
-- than nullable, for one reason: every reader must get a direction without a
-- branch. A nullable column makes „direction unknown" a third state that every
-- screen, every API and every test has to render, for a set of rows that will
-- never be corrected automatically. Rows written from Slice #36.03 on set the
-- flag DELIBERATELY, which is the only guarantee this column can honestly make.
--
-- ---------------------------------------------------------------------------
-- 2. WHY `referenced_instruments` IS A COLUMN AND NOT A RE-READ
-- ---------------------------------------------------------------------------
--
-- The AI read returns the instruments a deed cites as a structured array
-- beside `parties[]`. The review screen that turns those into links must be
-- reopenable - a deed imported today and linked next month has to work - and
-- the alternative to storing them is re-reading the pages, which is a BILLED
-- VISION CALL OVER EVERY PAGE each time the dialog opens. One jsonb column
-- costs a column.
--
-- ⚠️ **jsonb AND NOT A TABLE, DELIBERATELY.** A `document_referenced_instrument`
-- table would be the tidier shape for something queried across documents, and
-- nothing queries these across documents: they are read for ONE document, all
-- at once, by the screen that walks them. They are also a READING rather than a
-- fact - the model's answer, unverified, which nobody may act on until a person
-- does. A table invites a join that treats them as archive content; a column on
-- the document that produced them keeps them what they are. `custom_fields` is
-- jsonb one column up for a comparable reason.
--
-- ⚠️ **NOT VERSIONED, AND THE WRITE PATH IS SEPARATE BECAUSE OF IT.**
-- `DocumentSnapshot` (src/lib/documents/validation.ts) is the versioned form-
-- field set and this is not one - it is operational metadata, like
-- `ai_interpreted_at` and `import_title` beside it. So `documentUpdateSchema`
-- does NOT accept it and `updateDocument` never writes it: the only writer is
-- POST /api/documents/[id]/instrument-references. A reading that produced a
-- `document_version` row every time somebody pressed „recitește" would fill the
-- version history with entries in which no field changed.
--
-- The SHAPE is stated in src/lib/documents/referenced-instruments.ts and
-- validated there on the way in, not by a CHECK here: it is a model's answer
-- and a constraint that rejected one would lose the whole read rather than the
-- one entry. `NULL` means „this document has not been read for references",
-- which is every document imported before this slice, and `[]` means „read,
-- and it cited nothing" - the two are different and both are ordinary.
--
-- ---------------------------------------------------------------------------
-- 3. WHY THE FOUR ROLES NEED A PER-ROW PRE-CHECK AND NOT `ON CONFLICT`
-- ---------------------------------------------------------------------------
--
-- ⚠️ **migration_055's OWN INSERT DOES NOTHING ON A TABLE THAT ALREADY HAS
-- ROWS.** It ends `WHERE NOT EXISTS (SELECT 1 FROM lookup_document_document_role
-- LIMIT 1)` - a whole-table guard, not a per-row one. Copying that shape here
-- would seed nothing at all on every database that has ever run migration_055,
-- which is all of them.
--
-- `ON CONFLICT DO NOTHING` is no use either, for a blunter reason:
-- `lookup_document_document_role` has NO unique constraint on `name` (nor a
-- `key` column - it is `id/name/description/sort_order`), so there is no
-- conflict target to name and a re-run would simply insert the four rows a
-- second time.
--
-- So the shape is migration_081's: ask per row, insert what is missing, and
-- WARN rather than fail on anything that needs a person. The name test folds
-- the way `foldLookupName`/`normaliseDocumentTypeName` do - NFD, strip
-- combining marks, lower, drop non-alphanumerics - so a row somebody typed as
-- „Titlu anterior al" without the diacritic is recognised as the same row and
-- not duplicated.
--
-- ⚠️ **A COLLISION SKIPS THE ROW AND WARNS. IT DOES NOT FAIL THE RUN** -
-- migration_081's argument, unchanged: a migration that raises stops the whole
-- chain where it stands, parks every later migration behind a naming question,
-- and arrives at the same row on the next run.
--
-- ⚠️ **AND THE SEED GOES IN TWO PLACES OR IT DOES NOT SURVIVE A REBUILD.**
-- `src/db/sync-reference-data.sql` TRUNCATEs this table and re-inserts it from
-- scratch for a freshly-built cloud project; it carries all twelve rows in the
-- same commit as this file, with the same sort_orders (9-12 here), so
-- `scripts/verify-rebuild.ts` - which compares reference rows as whole tuples,
-- sort_order included - sees the two paths agree rather than eight `+` lines
-- and eight `-` lines.
--
-- THE NAMES, AND WHY THESE FOUR
--   None of migration_055's eight fits a title chain or a supporting
--   certificate. The closest is „Consolidat cu", which is deliberately neutral
--   and therefore says nothing - and „says nothing" is exactly what the deed
--   does not do. Each of the four below reads FORWARDS with the flag set, i.e.
--   as „A <role> B":
--
--     Titlu anterior al        the instrument the seller's own right came from
--     Înscris doveditor pentru a certificate produced for this deed
--     Act adițional la         an act adițional and the deed it completes
--     Antecontract al          the promise that preceded the sale
--
--   Romanian with diacritics, because that is what every other row in this
--   table carries and what the screen shows.
--
-- ---------------------------------------------------------------------------
-- WHY THE NUMBER IS 086
-- ---------------------------------------------------------------------------
--
-- Not assumed: `src/db/migration_0*.sql` was listed and 085
-- (`migration_085_seed_cvc_templates.sql`, Slice #36.01) is the highest that
-- exists. 058, 059 and 064 are free and are NOT candidates - `migrationChain()`
-- applies files in NAME order, so a gap number would run before migrations this
-- file must follow. It must follow 055 (which creates
-- `lookup_document_document_role` and seeds the eight) and it must follow the
-- creation of `document_document` itself.
--
-- ---------------------------------------------------------------------------
-- THE OTHER DOORS INTO A DATABASE
-- ---------------------------------------------------------------------------
--
--   * `src/db/schema/index.ts` - `roleReadsAToB` and `referencedInstruments`
--     are declared there in the same commit as this file.
--   * `src/db/sync-reference-data.sql` - the twelve roles, same commit.
--   * `src/db/supabase_schema_full.sql` - GENERATED. Regenerated by
--     `scripts/Export-SupabaseSchema.ps1`; never hand-edited.
--   * `scripts/Verify-Rebuild.ps1` - replays this chain onto an empty
--     `postgis/postgis:16-3.4` container and compares it against the generated
--     file, object by object and reference row by reference row.
--
-- Apply locally:
--   docker cp src/db/migration_086_document_reference_direction.sql ga40prj-postgres:/tmp/m086.sql
--   docker exec ga40prj-postgres psql -U postgres -d ga40db -f /tmp/m086.sql
-- Apply to Supabase: paste into SQL Editor.
-- ---------------------------------------------------------------------------

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Count first, and PRINT THE NUMBER. Nothing is refused here.
-- ---------------------------------------------------------------------------
--
-- ⚠️ **THIS COUNT IS THE POINT OF THE SECTION, NOT A SAFETY CHECK.** Section 2
-- cannot fail: adding a NOT NULL column with a DEFAULT is a catalogue-only
-- operation on PostgreSQL 11+. What a person actually needs to know is how many
-- rows are about to be given a direction NOBODY VERIFIED - because for those
-- rows the answer is a guess, and this NOTICE is the only place that guess is
-- ever declared. The rows that carry a directional role are counted separately:
-- on a neutral or absent role the flag decides nothing at all, so a database
-- whose associations are all role-less has nothing to look at, and one with
-- fourteen „Anexa la" rows has fourteen things to look at.

DO $$
DECLARE
  n_total       integer;
  n_directional integer;
BEGIN
  SELECT count(*) INTO n_total FROM document_document;

  -- ⚠️ **„HAS A ROLE AT ALL", NOT A LIST OF THE DIRECTIONAL SEVEN.** An
  -- earlier draft named migration_055's seven directional names literally and
  -- asked `r.name IN (...)`; on a database where any one of them had been
  -- renamed from Date de referință - which that screen allows - the count would
  -- have silently under-reported, in the one NOTICE whose whole job is to say
  -- how big the guess is. Counting every roled row over-reports by exactly the
  -- „Consolidat cu" rows, which is the safe direction and is named in the
  -- message rather than filtered out.
  SELECT count(*) INTO n_directional
    FROM document_document dd
   WHERE dd.relationship_role_id IS NOT NULL;

  RAISE NOTICE 'migration_086: % existing document_document row(s), % of them carrying a role. Every one of the % takes role_reads_a_to_b = true UNVERIFIED. The pair order in that table is by uuid and means nothing, so for those rows the direction is a guess this migration makes once and declares here. „Consolidat cu" is the only seeded role that is not directional, so rows carrying it are counted above and do not need looking at. List them with:  SELECT dd.document_id_a, dd.document_id_b, r.name FROM document_document dd JOIN lookup_document_document_role r ON r.id = dd.relationship_role_id ORDER BY r.name;',
    n_total, n_directional, n_directional;
END $$;

-- ---------------------------------------------------------------------------
-- 2. The direction flag.
-- ---------------------------------------------------------------------------

ALTER TABLE document_document
  ADD COLUMN IF NOT EXISTS role_reads_a_to_b boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN document_document.role_reads_a_to_b IS
  'Which way relationship_role_id reads. TRUE (the default) means the role reads A to B - "document_id_a <role> document_id_b". FALSE means it reads B to A. WHY THIS EXISTS: the pair order in this table is canonicalised by UUID (CHECK document_document_order, document_id_a < document_id_b) purely so one pair cannot be stored twice - it carries NO meaning, and src/lib/documents/queries.ts produces it with a literal .sort(). Every role migration_055 seeded is directional in its wording, so on a pair whose uuids sort the other way "Anexa la" read backwards and nothing could tell. Slice #36.03 seeds "Titlu anterior al", where reading backwards in an archive that exists to prove a chain of title is a wrong answer presented as a fact. Rows written from #36.03 on set this deliberately; rows that predate it took the default, and migration_086 prints how many. The alternative - renaming the columns to from/to and dropping the CHECK - is tidier and was refused because the backfill for existing rows would be a coin toss recorded as truth.';

-- ---------------------------------------------------------------------------
-- 3. The instruments a document's own pages cited.
-- ---------------------------------------------------------------------------

ALTER TABLE document
  ADD COLUMN IF NOT EXISTS referenced_instruments jsonb;

COMMENT ON COLUMN document.referenced_instruments IS
  'The instruments THIS document''s pages cite, as the AI read returned them: an array of { typeKey, nrDocument, dateDocument, issuer, purpose, rawText, status }. A READING, never a fact - nothing here is an association and nothing here may be acted on until a person confirms it in the reference-linker dialog, which is what POST /api/documents/[id]/instrument-references writes back with each entry''s status. Stored rather than re-read because reopening that dialog otherwise costs a billed vision call over every page of the document. NULL means this document has never been read for references (every document imported before Slice #36.03); an empty array means it was read and cited nothing - the two are different and both are ordinary. NOT VERSIONED: DocumentSnapshot omits it, documentUpdateSchema does not accept it, and updateDocument never writes it, exactly as for ai_interpreted_at and import_title. The shape is declared and validated in src/lib/documents/referenced-instruments.ts rather than by a CHECK here, because a constraint that rejected one malformed entry would throw away the whole paid read.';

-- ---------------------------------------------------------------------------
-- 4. The four roles a title chain needs. Per row, because migration_055's own
--    insert is a no-op on a table that already has rows.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  wanted CONSTANT text[][] := ARRAY[
    ARRAY['Titlu anterior al',        'Înscrisul din care provine dreptul transmis prin documentul asociat', '9'],
    ARRAY['Înscris doveditor pentru', 'Act depus ca dovadă la încheierea documentului asociat',              '10'],
    ARRAY['Act adițional la',         'Act adițional care completează documentul asociat',                   '11'],
    ARRAY['Antecontract al',          'Promisiune de vânzare care a precedat documentul asociat',            '12']
  ];
  i         integer;
  w_name    text;
  w_desc    text;
  w_sort    integer;
  held_name text;
  n_added   integer := 0;
  n_present integer := 0;   -- already there under exactly this name
  n_drift   integer := 0;   -- there under a name that only matches once folded
BEGIN
  FOR i IN 1 .. array_length(wanted, 1) LOOP
    w_name := wanted[i][1];
    w_desc := wanted[i][2];
    w_sort := wanted[i][3]::integer;

    -- The same fold `foldLookupName` and `normaliseDocumentTypeName` apply on
    -- the TypeScript side: NFD, strip combining marks, lower, drop everything
    -- that is not a letter or a digit. So „Titlu anterior al" typed without the
    -- diacritics, or in another case, is recognised as this row and NOT
    -- duplicated - which matters more here than on a keyed table, because this
    -- one has no unique constraint at all to catch a second copy.
    SELECT name INTO held_name
      FROM lookup_document_document_role
     WHERE regexp_replace(
             lower(normalize(coalesce(name, ''), NFD)),
             '[^a-z0-9]', '', 'g')
           = regexp_replace(
               lower(normalize(w_name, NFD)),
               '[^a-z0-9]', '', 'g')
     LIMIT 1;

    IF held_name IS NOT NULL THEN
      IF held_name = w_name THEN
        n_present := n_present + 1;
        RAISE NOTICE 'migration_086: "%" is already there, unchanged.', w_name;
      ELSE
        -- migration_081's lesson, one table over: a row needing a human choice
        -- counted into the clean bucket makes the SUMMARY - which is what an
        -- operator reads - report it as a no-op.
        n_drift := n_drift + 1;
        RAISE WARNING 'migration_086: a role named "%" is already there where the seed says "%" - the two only match once folded. Nothing written. Rename it from Date de referință if the seed is right; until then this row differs from a rebuilt project''s.',
          held_name, w_name;
      END IF;
      CONTINUE;
    END IF;

    INSERT INTO lookup_document_document_role (name, description, sort_order)
    VALUES (w_name, w_desc, w_sort);
    n_added := n_added + 1;
    RAISE NOTICE 'migration_086: created "%" (sort_order %).', w_name, w_sort;
  END LOOP;

  IF n_drift > 0 THEN
    -- ⚠️ **THIS RUN EXITS 0 AND Apply-Migration.ps1 COUNTS IT UNDER "Applied"
    -- WITH "Failed : 0" UNDERNEATH IT** - a RAISE WARNING is not an error under
    -- ON_ERROR_STOP=1, and this migration will never run again. So the warning
    -- carries the consequence and the query, not only the count.
    RAISE WARNING 'migration_086: % created, % already present as asked, % present under a name that only matches once folded. A DRIFTED row still works - the reference linker resolves these roles by name through the same fold - but its display name differs from a rebuilt project''s and verify-rebuild will report it. Run:  SELECT id, name, sort_order FROM lookup_document_document_role ORDER BY sort_order, name;',
      n_added, n_present, n_drift;
  ELSE
    RAISE NOTICE 'migration_086: % created, % already present and unchanged. Nothing needs a decision.',
      n_added, n_present;
  END IF;
END $$;

COMMIT;

-- Verify ------------------------------------------------------------------
-- On a database built by replaying the chain: twelve roles, the four new ones
-- at sort_order 9-12, and both new columns present.
--
--   SELECT name, sort_order FROM lookup_document_document_role ORDER BY sort_order, name;   -- 12 rows
--
--   SELECT column_name, data_type, is_nullable, column_default
--   FROM   information_schema.columns
--   WHERE  (table_name, column_name) IN (('document_document', 'role_reads_a_to_b'),
--                                        ('document',          'referenced_instruments'));
--
-- And the rows whose direction is a guess - the number section 1 printed:
--
--   SELECT dd.document_id_a, dd.document_id_b, r.name, dd.role_reads_a_to_b
--   FROM   document_document dd
--   JOIN   lookup_document_document_role r ON r.id = dd.relationship_role_id
--   ORDER  BY r.name;
