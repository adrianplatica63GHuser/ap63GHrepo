-- migration_077_reference_data_origin.sql
-- Slice #34.02 - which reference rows a PERSON vouched for.
--
-- WHAT THE SLICE ASKS FOR
--   An administrator opening "Indicative Tarla" or "Institutii" can see at a
--   glance which rows somebody chose and which arrived as a side effect of an
--   import, and can work through the second group. Nothing is blocked or
--   hidden: an imported tarla code stays selectable the moment it exists.
--
-- THIS IS migration_069 A SECOND AND THIRD TIME
--   Same column, same default, same value set, same write-once discipline, and
--   deliberately the same two WORDS - see "WHY IMPORT IS STILL THE RIGHT WORD"
--   below. lookup_document_type.origin already ships; two more lookup tables
--   answering the same question with a different vocabulary would need a second
--   guard, a second Romanian label and a second filter component, and would
--   make `origin` mean one thing on one table and another thing next door.
--
-- WHY EVERY EXISTING ROW BECOMES 'MANUAL'
--   The same reason 069 gives, and it is not that MANUAL is certainly true. A
--   tarla code auto-seeded by an import run last month is indistinguishable
--   from one Adrian typed into the modal, which is the whole reason this column
--   exists. MANUAL is the only value that cannot make a NEW claim about an old
--   row: it reads "added by a person", which is what the list implies today.
--   Backfilling to IMPORT would need a guess, and a wrong guess here puts a row
--   Adrian curated himself into a review queue and tells him a machine made it.
--
--   Consequence, accepted deliberately and stated in the handover: codes seeded
--   by import runs BEFORE this migration keep reading as MANUAL. Only rows
--   created from here on are marked. Nothing repairs that later - there is no
--   evidence to repair it from.
--
-- WHY THE SERVER DECIDES IT AND THE PAYLOAD NEVER DOES
--   069's column is create-only but its value is read off the request body
--   (`isDocumentTypeOrigin(data.origin)` in
--   src/lib/admin/value-lists/queries.ts), so a client that posts
--   `origin: "MANUAL"` is believed. On these two tables the value is a property
--   of the WRITE SITE, never a field anything can send:
--
--     lookup_tarla     the auto-seed inside `createPropertyIn`
--                      (src/lib/properties/queries.ts) writes the literal
--                      'IMPORT'. It takes no parameter and reads no ORIGIN off
--                      the payload, so there is nothing for a sixth caller to
--                      forget or a client to claim. (It does read `indicativ`
--                      from the request body - the value; never the origin.)
--
--     lookup_institution
--                      nothing writes 'IMPORT'. The id-card reader's refusal to
--                      mint an institution from a model's reading stays, so
--                      every row on this table takes the DEFAULT.
--     lookup_institution / lookup_tarla, admin modal
--                      say nothing, and get 'MANUAL' from this DEFAULT.
--
--   The value-lists create path must NOT start reading `origin` off the body
--   for these two lists, and a rename must not be able to re-origin a row.
--
--   ⚠️ WHAT ACTUALLY GUARDS THAT TODAY IS ONE LAYER, NOT TWO - a review round
--   corrected an earlier draft of this paragraph that named a `stripOrigin`
--   covering every list. There is no such function. There is
--   `stripDocumentTypeOrigin` (src/lib/admin/value-lists/validation.ts), and
--   `updateValue` calls it in exactly one branch: `case "document-types"`. The
--   `tarla` and `institutions` branches are a bare `.set(data).returning()`.
--   Through HTTP the property still holds, because
--   LIST_UPDATE_SCHEMAS["tarla"] and ["institutions"] are plain z.object and
--   Zod drops an unknown `origin` before it reaches the query layer. What is
--   missing is the SECOND guard, the one whose own docblock says it exists to
--   stop "a script, a future admin action, a test" re-originating a row by
--   handing back the row it just read - which is precisely the shape a
--   maintenance script for this column would take. Extending the strip to
--   those two branches belongs with the code half of this slice.
--
--   ⚠️ RETRACTED BY SLICE #34.14 - THE PARAGRAPH ABOVE IS HISTORY, NOT THE
--   CURRENT STATE, and it is left standing because it is the argument the fix
--   was built from. `updateValue` now calls `stripLookupOrigin` ONCE above its
--   switch, so all eleven lists are stripped on the way in and the property no
--   longer rests on a schema that happens not to mention the column;
--   `createValue` strips it too, for every list but `document-types`, whose
--   POST schema carries `origin` as a create-only field on purpose. Zod is
--   still the route-side half and is still worth having.
--
--   ⚠️ AND THE COMMENT ON lookup_tarla.origin BELOW STILL SAYS THE OLD THING -
--   "no explicit strip guards the value-lists PUT for this table - Zod drops an
--   unknown origin from the update payload and that is the only guard". That
--   text is LIVE IN THE DATABASE, not just in this file, so correcting it needs
--   a `COMMENT ON COLUMN` in a new migration rather than an edit here. It is in
--   the #34.14 handover.
--
-- WHY 'IMPORT' IS STILL THE RIGHT WORD FOR A CODE READ OFF A FOLDER NAME
--   The slice asks whether it is, because a tarla code arrives from a FOLDER
--   NAME rather than from a document. It is, and the reason is that every path
--   that can reach the auto-seed is an import run:
--
--     src/app/api/documents/[id]/process/route.ts   tarla parsed out of the
--                                                   folder name by the scan
--     src/lib/properties/import-property.ts         same value, via
--                                                   ensurePropertyForFolder
--
--   The other three callers of `createProperty` cannot reach it at all: both
--   calls in src/app/api/calculation/commit/route.ts pass no `tarlaSola`, and
--   POST /api/properties has TWO clients, neither of which can send an unlisted
--   one - `property-form.tsx`, whose tarla field is a SELECT over this very
--   table (#18.16.VL) so there is nothing to type into, and
--   `add-property-dialog.tsx`, which builds its payload key by key and never
--   sets `tarlaSola` at all. (An adversarial round asked "is there another
--   client"; there is, and the answer survives it.) The case the
--   slice worried about, "a property typed by hand also seeds a code", is
--   unreachable through the UI; what remains is a raw POST carrying an unlisted
--   string, and a payload is not a person.
--
--   ⚠️ THAT LAST CLAIM IS ONE ABSENT PROP DEEP, NOT STRUCTURAL, and a review
--   round is why it is stated that way. The field carries
--   `allowUnlistedValue`, so `optionsWithUnlistedValues` will synthesise an
--   option for whatever the form value holds; create mode is safe only because
--   `new-property-shell.tsx` renders `<PropertyForm mode="create" />` with NO
--   `initialValues`, so the value starts "". There is no query-param prefill,
--   no clone action and no create-mode AI prefill today - all three checked -
--   and `tarlaSola` is validated against the lookup NOWHERE
--   (src/lib/properties/validation.ts derives it as free text). The day a
--   create-mode prefill is added, that form becomes a writer of IMPORT rows for
--   values a person chose, and this paragraph is what to come back to.
--
--   That leaves #29.06's rule intact, one table over: ORIGIN SAYS WHO CHOSE THE
--   NAME. A machine parsed "47/2" out of a directory listing -> IMPORT. A
--   person typed it into Indicative Tarla -> MANUAL. A folder name is a machine
--   reading a string, exactly like a classifier reading a label.
--
-- WHY lookup_institution GETS THE COLUMN THOUGH NOTHING WILL WRITE 'IMPORT'
--   Today `lookup_institution` is written only by the seed and by an
--   administrator, and #34.02 keeps `src/lib/import/id-card.ts`'s refusal to
--   mint an institution from a model's reading. So every row in it will read
--   MANUAL, and that is the honest answer rather than a gap: the two lists sit
--   side by side in the same modal under the same status word, and a list that
--   simply had no answer would read as one whose answer was lost. The column
--   also stops being a migration the day the one-click "adauga" button in the
--   identity-card dialog wants to say where its spelling came from.
--
--   The asymmetry is the point, not a mistake: tarla is the list whose creation
--   path writes PAST the dropdown into the table; institutions is a real
--   foreign key (`document.institution_id`, ON DELETE SET NULL) that only two
--   doors write.
--
-- WHY NOT A BOOLEAN, WHY NOT entity_metadata.provenance
--   Unchanged from migration_069's header; both arguments apply verbatim.
--   Note especially the second: `provenance` is USER-EDITABLE from the
--   References tab, and #26.08/migration_068 exists because a display value had
--   been overloaded as a lock. This column is written once, by one site, and
--   read by nothing that can write it back.
--
-- ⚠️ THIS MIGRATION AND src/db/schema/index.ts MUST LAND TOGETHER, AND THE
-- MIGRATION MUST REACH EVERY DATABASE FIRST.
--   Drizzle never emits `select *` or a bare INSERT: it names every column from
--   the table definition. So the moment `schema/index.ts` declares `origin`,
--   a database that has not run this file answers SQLSTATE 42703 and five
--   things 500 - the "Indicative Tarla" and "Institutii" modals, the tarla
--   dropdown on both Property forms and the institution dropdown on the
--   Document form (all four are the same two
--   `db.select().from(...)` in src/lib/admin/value-lists/queries.ts), the POST
--   and PUT behind those modals, and the auto-seed's own INSERT - which aborts
--   the whole `createPropertyIn` transaction, so an import fails on a NEW tarla
--   code and succeeds on a re-run, which is the least readable failure of the
--   set. The other direction is harmless: this file applied against the older
--   code changes nothing.
--   Local Docker AND Supabase, before the app carrying that schema is
--   restarted against either. `npm run supabase:sync` builds its column list
--   from the LOCAL information_schema, so it starts naming `origin` the moment
--   Apply-Migration has run here.
--
--   ⚠️ THE MIGRATION CHAIN IS ONE OF THREE DOORS INTO A SUPABASE PROJECT, and
--   an adversarial round is why the other two are named here. A project brought
--   up from `supabase_schema_full.sql`, or topped up with
--   `supabase_repair_missing_tables.sql`, never runs this file at all:
--     - `supabase_repair_missing_tables.sql` is HAND-MAINTAINED and this slice
--       edits it, in the migration_069 block's shape, right below it. Its own
--       header says a migration-added column has to be added there by hand
--       every time, because Verify-Rebuild's step 8 is structurally blind to a
--       column on a table it never drops.
--     - `supabase_schema_full.sql` is GENERATED and this slice does NOT edit
--       it. `.\scripts\Export-SupabaseSchema.ps1` regenerates it from the local
--       database AFTER Apply-Migration.ps1 has run, and the result is committed
--       with this slice. Until it is, `Verify-Rebuild.ps1` reports six
--       unbaselined differences (two columns, two CHECKs, two COMMENTs) and
--       exits 1 - which is the check working, not a reason to re-baseline.
--
-- Idempotent: IF NOT EXISTS / DROP CONSTRAINT IF EXISTS throughout.
--
-- WRAPPED IN A TRANSACTION, for migration_069's reason
--   The runner feeds this file to `psql -f` with no --single-transaction, so
--   without a BEGIN each statement commits on its own. Section 2 DROPs each
--   CHECK and re-ADDs it, which is what makes the file re-runnable - but on a
--   database holding an origin outside the value set the DROP succeeds and the
--   ADD fails, leaving the table PERMANENTLY UNCONSTRAINED while the report
--   below still reads clean (a stray origin counts in neither total).
--   BEGIN/COMMIT turns that into a rollback and a loud failure.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The columns
-- ---------------------------------------------------------------------------
--
-- NOT NULL DEFAULT 'MANUAL' does the backfill in the same statement: Postgres
-- fills existing rows from the default, and every future insert that says
-- nothing is a hand-added row. The tarla auto-seed is the only writer that has
-- to speak up, which is the right way round - a new writer that forgets is
-- labelled as a person's choice rather than crediting a machine with a row
-- Adrian typed himself.

ALTER TABLE lookup_tarla
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'MANUAL';

ALTER TABLE lookup_institution
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'MANUAL';

-- ---------------------------------------------------------------------------
-- 2. The value set
-- ---------------------------------------------------------------------------
--
-- The same two values as chk_ldt_origin, on purpose. Constraint names follow
-- that one's abbreviation: chk_<table initials>_origin.

ALTER TABLE lookup_tarla DROP CONSTRAINT IF EXISTS chk_lt_origin;

ALTER TABLE lookup_tarla
  ADD CONSTRAINT chk_lt_origin CHECK (origin IN ('MANUAL', 'IMPORT'));

ALTER TABLE lookup_institution DROP CONSTRAINT IF EXISTS chk_li_origin;

ALTER TABLE lookup_institution
  ADD CONSTRAINT chk_li_origin CHECK (origin IN ('MANUAL', 'IMPORT'));

COMMENT ON COLUMN lookup_tarla.origin IS
  'How this code came to exist: MANUAL = typed into the Indicative Tarla list by a person, IMPORT = auto-seeded by createPropertyIn from a tarla value an import parsed out of a folder name. The origin is decided at that write site and is never read from a request body. Write-once by convention: unlike lookup_document_type, no explicit strip guards the value-lists PUT for this table - Zod drops an unknown origin from the update payload and that is the only guard. See migration_077 for the full note.';

COMMENT ON COLUMN lookup_institution.origin IS
  'How this institution came to exist: MANUAL = added in Reference Data (every row today), IMPORT = created by a machine reading. Nothing writes IMPORT yet - src/lib/import/id-card.ts still refuses to mint an institution from a model reading, and #34.02 keeps that refusal - so the column exists to make the status word answerable on both lists in one modal.';

-- ---------------------------------------------------------------------------
-- 3. Report
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  t_manual   integer;
  t_imported integer;
  i_manual   integer;
  i_imported integer;
BEGIN
  SELECT count(*) INTO t_manual   FROM lookup_tarla       WHERE origin = 'MANUAL';
  SELECT count(*) INTO t_imported FROM lookup_tarla       WHERE origin = 'IMPORT';
  SELECT count(*) INTO i_manual   FROM lookup_institution WHERE origin = 'MANUAL';
  SELECT count(*) INTO i_imported FROM lookup_institution WHERE origin = 'IMPORT';
  RAISE NOTICE 'migration_077: lookup_tarla % MANUAL / % IMPORT, lookup_institution % MANUAL / % IMPORT (expected all-MANUAL on first run - there is no backfill).',
    t_manual, t_imported, i_manual, i_imported;
END $$;

COMMIT;
