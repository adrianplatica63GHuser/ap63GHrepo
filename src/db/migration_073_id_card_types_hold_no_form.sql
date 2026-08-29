-- migration_073_id_card_types_hold_no_form.sql
-- Slice #32.07 - An identity card type can never hold a form.
--
-- WHAT THIS DOES
--   1. Removes the row keyed CARTE_DE_IDENTITATE_DOUA_EXEMPLARE - a document
--      type named `Carte de identitate (doua exemplare)' carrying a 24-field
--      form: TWO complete identity records, including two CNPs, as freely
--      editable form fields on every document that type would ever hold.
--   2. Clears `template_fields` on every OTHER document type that reads as an
--      identity card and still carries one.
--   3. Reports what it changed, by name, and asserts the archive is clean
--      afterwards.
--
-- WHY THE ROW GOES ENTIRELY RATHER THAN BEING LEFT FORMLESS
--   Adrian, 29 August: "a scan containing two identity cards should not be
--   processed by the import - this type of file should be forbidden to enter
--   the system and there should be no document type or form for it." The FILE
--   is refused by Slice #32.08, on the import side; the TYPE goes here.
--
--   The measurements that made deleting it free, all taken 29 August before
--   any of the 32.05 UAT runs: ZERO documents on the type, ZERO stored values,
--   ZERO person roles configured on it. Nothing references the row, the
--   classifier is never offered its key (it is not in KNOWN_DOCUMENT_TYPES),
--   and nothing routes to it. Deleting it today costs nothing and stops
--   costing nothing the moment anything is filed on it.
--
-- ⚠️ **AND IT IS STILL MEASURED HERE RATHER THAN ASSUMED, BECAUSE THIS FILE
-- RUNS ON DATABASES NOBODY MEASURED.** `migrationChain()` in
-- scripts/verify-rebuild.ts globs `src/db/migration_*.sql` and applies every
-- match in name order, so this runs on the rebuild chain, on the cloud
-- project, and on Ciprian's UAT box. `document.document_type_id` is NOT NULL
-- with no ON DELETE - the one lookup list Postgres actually protects - so a
-- delete on a box where a document HAS been filed under this type would abort
-- the whole migration with a 23503. Section 1 therefore counts first: with
-- documents on the row it clears the FORM and keeps the row, says so loudly,
-- and leaves the delete to a human who can move those documents. The privacy
-- fix - no editable copy of a CNP on a form - lands either way, which is the
-- half that cannot wait.
--
-- ⚠️ **THE PREDICATE IS A SNAPSHOT OF `isIdCardTypeName`, AND SQL IS THE ONLY
-- REASON IT IS COPIED AT ALL.** The owner is
-- `documentTypeIsIdCard` in src/lib/import/id-card.ts - one exported answer,
-- with src/__tests__/id-card-type-single-source.test.ts binding its call
-- sites. A migration cannot call TypeScript, so `pg_temp.ga40_is_id_card_type`
-- below restates it, ONCE, in a temporary function that dies with the session.
-- Where the two can differ, they differ in the direction that changes FEWER
-- rows:
--   - `translate()` folds the Romanian diacritics rather than `unaccent`,
--     which is an extension this database is not guaranteed to have.
--   - The vehicle veto's word boundaries are `[^a-z0-9]` where JavaScript's
--     `\b` also treats `_` as a word character. So `auto_ceva' is vetoed here
--     and not there: the veto fires MORE often, which clears fewer forms.
--   - The positive pattern is the JavaScript one with `\s` written
--     `[[:space:]]` and nothing else changed. It already uses `(^|[^a-z0-9])`
--     anchors rather than `\b`, for the reason CLAUDE.md states: `\b` is
--     ASCII-only and must never be pointed at Romanian.
--
-- ⚠️ **AND THE COPY IS BOUND BY A TEST, because a header saying "this is a
-- faithful copy" is exactly the kind of claim this codebase keeps finding to be
-- stale.** `src/__tests__/id-card-type-single-source.test.ts` reads this file
-- and asserts the ARRAY below against `ID_CARD_TYPE_KEYS` and the pattern below
-- against `isIdCardTypeName`'s own regex source. A wording added to that
-- function without being added here turns that test red — which matters most
-- for the run that has ALREADY applied this file and would otherwise read
-- section 4's "0 identity-card types still carry a form" as a live all-clear
-- measured by a stale predicate.
--
-- ⚠️ **"NON-EMPTY ARRAY" IS SPELLED `jsonb_typeof(...) = 'array' AND ... <>
-- '[]'::jsonb`, NEVER WITH `jsonb_array_length`, AND THAT IS NOT A STYLE
-- CHOICE.** `AND` DOES NOT SHORT-CIRCUIT IN SQL: the planner orders quals by
-- cost, and it puts `jsonb_array_length(template_fields) > 0` ahead of the type
-- test, so the length function is applied to rows the type test would have
-- excluded. Measured: with one row anywhere in `lookup_document_type` carrying
-- a non-array `template_fields` — which `sanitizeDocumentTypeTemplateFields`
-- passes through unchanged and no CHECK constraint forbids — the whole
-- migration aborts with `ERROR: cannot get array length of a non-array`,
-- rolls back, and the privacy fix does not land at all. It is also
-- planner-dependent, so it can pass locally and fail on UAT. `<> '[]'::jsonb`
-- compares fine across jsonb types and needs no guard.
--
-- The two `jsonb_array_length` calls that remain are both already gated: one is
-- inside a `CASE` (which does short-circuit) and one runs inside an aggregate
-- over rows the WHERE has already filtered.
--
-- ⚠️ **"HAS A FORM" IS BROADER HERE THAN `documentTypeHasForm`, DELIBERATELY.**
-- That function parses and drops entries with no usable `key`, so `[{}]`
-- counts as no form; this file clears any non-empty array. Clearing a stored
-- `[{}]` to NULL removes nothing anybody can see and makes the column say what
-- the application already believes.
--
-- SAFE TO RUN TWICE, AND SAFE WHERE THE ROW IS ALREADY GONE. Every statement
-- is a DELETE or an UPDATE with a WHERE that is false the second time; the
-- counts then report 0 and the assertions still hold.

-- Apply locally (either):
--   pwsh .\scripts\Apply-Migration.ps1
--   docker cp src/db/migration_073_id_card_types_hold_no_form.sql ga40prj-postgres:/tmp/m073.sql
--   docker exec ga40prj-postgres psql -v ON_ERROR_STOP=1 -U postgres -d ga40db -f /tmp/m073.sql
--
-- ⚠️ `-v ON_ERROR_STOP=1` is not optional here and Apply-Migration.ps1 records
-- why (a #26.12 finding): without it psql prints section 3's ERROR, prints
-- ROLLBACK, and still EXITS 0 — a migration that refused to apply, reported as
-- applied. Measured on this file: exit 0 without the flag, exit 3 with it.
-- Apply to Supabase: paste into SQL Editor.
--
-- ⚠️ **READ THE RESULT GRID.** Section 4 SELECTs a report, because two of the
-- three apply paths never show a RAISE NOTICE and section 1 can end by asking a
-- human to move documents by hand.

BEGIN;

-- ⚠️ **EVERY TABLE NAME BELOW IS BARE, SO THE SEARCH PATH IS PINNED.** This is
-- migration_070's measured finding, not a precaution: an unqualified DELETE run
-- through a caller that sets its own search_path (the Supabase SQL Editor does)
-- counted rows in one schema's `document` and deleted from another schema's
-- `lookup_document_type`, and reported success.
--
-- ⚠️ **AND `pg_temp` IS NAMED EXPLICITLY, WHICH IS THE HALF THAT ACTUALLY
-- MATTERS HERE.** An adversarial round measured both directions of the folklore
-- and both were the wrong way round from the comment this replaces:
--
--   - For FUNCTIONS, `pg_temp` is never searched implicitly. `SELECT probe()`
--     against a `pg_temp.probe()` errors with "function probe() does not
--     exist". The three calls below work because every one of them is written
--     `pg_temp.`-qualified, not because the schema is on the path.
--   - For RELATIONS it IS searched implicitly, and AHEAD of everything listed —
--     so `pg_catalog, public` alone pins nothing about the bare table names
--     this file is built out of. Measured: with a temp table also called
--     `lookup_document_type` in the session, the whole migration ran green,
--     exit 0, reporting "0 identity-card type(s) still carry a form", while
--     `public.lookup_document_type` kept every form including the 24-field one.
--     That is migration_070's failure mode reproduced by the line meant to
--     prevent it.
--
-- Naming `pg_temp` LAST moves it to that position instead of first, which is
-- what makes `lookup_document_type` below mean `public.lookup_document_type`.
SET LOCAL search_path = pg_catalog, public, pg_temp;

-- ---------------------------------------------------------------------------
-- 0. The predicate, once
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION pg_temp.ga40_fold_ro(txt text) RETURNS text AS $fold$
  SELECT btrim(
           regexp_replace(
             translate(
               lower(coalesce($1, '')),
               -- comma-below (correct Romanian) AND cedilla (the legacy
               -- Turkish-borrowed forms some OCR and fonts still emit), both
               -- of which `foldRomanian`'s NFD decomposition handles.
               U&'\0103\00E2\00EE\0219\015F\021B\0163',
               'aaisstt'),
             '[[:space:]]+', ' ', 'g'))
$fold$ LANGUAGE sql IMMUTABLE;

-- ⚠️ **A REPORT TABLE, FOR THE ONE APPLY PATH THAT RENDERS RESULT SETS AND NOT
-- NOTICES: the Supabase SQL Editor.** An earlier version of this paragraph
-- claimed it rescued two of the three paths and a round measured that as false —
-- `verify-rebuild.ts`'s `psql()` discards stdout on success, which discards a
-- result grid exactly as much as a NOTICE, and `Apply-Migration.ps1` already
-- showed the NOTICEs. One path, then, and it is the path the cloud project is
-- applied through, where section 1 can end by asking a human to move documents
-- by hand and section 2 performs an IRREVERSIBLE clear.
--
-- ⚠️ **On the abort path the report is not printed at all** — section 3 raises
-- before section 4 runs, and the transaction takes the table with it. Nothing
-- is lost that matters: the EXCEPTION message names the offending types itself,
-- which is why it is written that way.
-- ⚠️ No `DROP … IF EXISTS` ahead of this, deliberately: `ON COMMIT DROP` takes
-- the table at COMMIT and a failed run rolls the CREATE back, so a second run
-- in the same session always finds it absent — and `pg_temp` is a schema that
-- may not exist yet on the first statement of a fresh session.
CREATE TEMP TABLE ga40_m073_report (seq serial, line text) ON COMMIT DROP;

CREATE OR REPLACE FUNCTION pg_temp.ga40_say(line text) RETURNS void AS $say$
  INSERT INTO pg_temp.ga40_m073_report (line) VALUES ($1);
$say$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION pg_temp.ga40_is_id_card_type(k text, nm text) RETURNS boolean AS $isid$
  SELECT
    -- ID_CARD_TYPE_KEYS. Kept as a list for the same reason the TypeScript is
    -- an array: a genuine alternate wording is a one-line addition.
    btrim(coalesce($1, '')) = ANY (ARRAY['CARTE_IDENTITATE'])
    OR (
      -- isIdCardTypeName: veto first, then the positive pattern.
      pg_temp.ga40_fold_ro($2) <> ''
      AND pg_temp.ga40_fold_ro($2) !~ 'vehicul'
      AND pg_temp.ga40_fold_ro($2) !~ '(^|[^a-z0-9])auto(mobil|turism)?([^a-z0-9]|$)'
      AND pg_temp.ga40_fold_ro($2) !~ '(^|[^a-z0-9])remorc'
      AND pg_temp.ga40_fold_ro($2) ~
            '(^|[^a-z0-9])(cart(e|ea|i)|act(e)?|buletin)[[:space:]]+(de[[:space:]]+)?identitate([^a-z0-9]|$)'
    )
$isid$ LANGUAGE sql IMMUTABLE;

-- ---------------------------------------------------------------------------
-- 1. The row this slice is about
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  row_id   uuid;
  row_name text;
  fields   integer;
  fields_kind text;
  fields_json text;
  docs     integer;
  roles    integer;
  msg      text;
BEGIN
  SELECT id, name,
         CASE WHEN jsonb_typeof(template_fields) = 'array'
              THEN jsonb_array_length(template_fields) ELSE 0 END,
         -- ⚠️ The KIND is captured separately, because `fields = 0` cannot tell
         -- an empty array from a value that is not an array at all, and a round
         -- found the delete message using it for exactly that: `'[]'` printed
         -- "whose template_fields was not an array" while quoting `[]` in the
         -- same sentence.
         coalesce(jsonb_typeof(template_fields), 'null'),
         coalesce(template_fields::text, 'null')
    INTO row_id, row_name, fields, fields_kind, fields_json
    FROM lookup_document_type
   WHERE key = 'CARTE_DE_IDENTITATE_DOUA_EXEMPLARE';

  IF row_id IS NULL THEN
    msg := 'migration_073: CARTE_DE_IDENTITATE_DOUA_EXEMPLARE is not present - nothing to remove. (Expected on a fresh database and on a second run.)';
    RAISE NOTICE '%', msg;
    PERFORM pg_temp.ga40_say(msg);
    RETURN;
  END IF;

  SELECT count(*)::int INTO docs  FROM document WHERE document_type_id = row_id;
  -- The doc-type/person-role whitelist is ON DELETE CASCADE, so it never
  -- blocks; it is counted only so the report says what went with the row.
  SELECT count(*)::int INTO roles
    FROM lookup_doc_type_person_role WHERE document_type_id = row_id;

  IF docs > 0 THEN
    -- ⚠️ **THE SAME WHERE THE SENTENCE BELOW DESCRIBES, and a round found the
    -- first version wider than it.** `template_fields IS NOT NULL` also matches
    -- a jsonb value that is not an array - which `sanitizeDocumentTypeTemplate-
    -- Fields` returns UNCHANGED, so a direct caller of `updateValue` can write
    -- one - and `fields` is 0 for those. The column was destroyed and the
    -- message said "It carried no form, so nothing was cleared", with none of
    -- the recovery JSON section 2 prints before it removes anything. Scoped to
    -- the same array test sections 2 and 3 use, so all three agree about what a
    -- form is.
    UPDATE lookup_document_type
       SET template_fields = NULL, updated_at = now()
     WHERE id = row_id
       AND jsonb_typeof(template_fields) = 'array'
       AND template_fields <> '[]'::jsonb;
    -- ⚠️ **The sentence is built from what was ACTUALLY there.** An earlier
    -- version said "CLEARED its % form field(s)" unconditionally, so a second
    -- run - where the column is already NULL - claimed a clearing that had not
    -- happened, in the one branch whose whole job is telling a human the truth
    -- about a row it decided not to delete.
    msg := format(
      'migration_073: KEPT the row "%s" (CARTE_DE_IDENTITATE_DOUA_EXEMPLARE) because %s document(s) are filed under it. %s Move those documents onto a real type and delete the row by hand.',
      row_name, docs,
      CASE WHEN fields > 0
           THEN format('Its %s-field form was CLEARED, so nothing on this type renders an identity field any more; the JSON that was removed is: %s.', fields, fields_json)
           ELSE 'It carried no form, so nothing was cleared.'
      END);
    RAISE NOTICE '%', msg;
    PERFORM pg_temp.ga40_say(msg);
    -- ⚠️ **AND WHAT CLEARING THE TEMPLATE DOES NOT DO, SAID OUT LOUD.**
    -- `document.custom_fields` is keyed by the very `template_fields[].key`
    -- being removed, and nothing here touches it - nor the `document_version`
    -- snapshots that carry it. So any values those documents hold survive:
    -- unreachable from the document form (which renders from `template_fields`),
    -- still present in the API payload and in every version row. Stating it is
    -- the point: an earlier draft asserted "the editable copy of the identity
    -- data is already gone", which is only true of the FORM.
    --
    -- ⚠️ **GATED ON `fields > 0`, AND COUNTED AGAINST THE KEYS THAT WERE
    -- ACTUALLY REMOVED** - a round found the first version of this block
    -- committing, twenty lines below the fix for it, the very defect that fix
    -- was for: it ran on a second pass where nothing had been cleared ("still
    -- hold values under the removed keys" when no key was removed), and it
    -- counted any non-empty `custom_fields`, so a document holding
    -- `{"observatii": "..."}` was reported as holding identity values.
    IF fields > 0 THEN
      SELECT count(*)::int INTO docs
        FROM document d
       WHERE d.document_type_id = row_id
         AND jsonb_typeof(d.custom_fields) = 'object'
         AND EXISTS (
               SELECT 1 FROM jsonb_array_elements(fields_json::jsonb) e
                WHERE e ? 'key' AND d.custom_fields ? (e ->> 'key'));
      IF docs > 0 THEN
        msg := format('migration_073: %s of those document(s) still hold values in custom_fields under keys this migration just removed from the template. Clearing the template does NOT remove them - they are simply no longer rendered anywhere. Removing stored values is a separate slice.', docs);
        RAISE NOTICE '%', msg;
        PERFORM pg_temp.ga40_say(msg);
      END IF;
    END IF;
    RETURN;
  END IF;

  DELETE FROM lookup_document_type WHERE id = row_id;
  -- ⚠️ The "two identity records" clause is CONDITIONAL: on a database where
  -- the row exists without the form, asserting it would be describing this
  -- archive's row rather than the one being deleted.
  msg := format(
    'migration_073: deleted the document type "%s" (CARTE_DE_IDENTITATE_DOUA_EXEMPLARE)%s 0 documents, %s person-role whitelist row(s) cascaded.',
    row_name,
    -- ⚠️ **THE `ELSE` ARM STILL PRINTS THE VALUE, and a round found the first
    -- version destroying it in silence.** `fields` is 0 for a jsonb value that
    -- is not an array - which `sanitizeDocumentTypeTemplateFields` passes
    -- through unchanged, so a direct caller of `updateValue` can write one -
    -- and the row goes either way, so unlike the KEPT branch this one cannot
    -- narrow its WHERE to spare it. Saying "which carried no form" over a
    -- 24-entry OBJECT, and throwing it away unprinted, is the same claim
    -- nobody can check that this file records fixing twice already.
    CASE WHEN fields > 0
         THEN format(', which carried a %s-field form. The JSON that went with it, so a wrong deletion is repairable by hand: %s.', fields, fields_json)
         WHEN fields_kind NOT IN ('array', 'null')
         THEN format(', whose template_fields was %s rather than an array, so it carried no form this application can render. The JSON that went with it: %s.', fields_kind, fields_json)
         ELSE ', which carried no form.'
    END,
    roles);
  RAISE NOTICE '%', msg;
  PERFORM pg_temp.ga40_say(msg);
END $$;

-- ---------------------------------------------------------------------------
-- 2. Every other identity-card type that still carries a form
-- ---------------------------------------------------------------------------
--
-- ⚠️ **CLEARED, NOT DELETED, and the asymmetry with section 1 is the point.**
-- Section 1 removes a row Adrian asked for by name, measured empty. Here the
-- rows are ones nobody has looked at - CARTE_IDENTITATE itself is a seeded
-- type that documents ARE filed under, and deleting it would take the archive's
-- identity-card type with it. What must not exist is the FORM.
--
-- ⚠️ **THE JSON IT REMOVES IS PRINTED BEFORE IT REMOVES IT, and that is not
-- decoration.** `template_fields` has no version column, this file is not
-- reversible, and the rule driving the UPDATE is a NAME heuristic whose own
-- docblock says a false positive "is silent and costs a whole type its form".
-- Until this slice that cost was recoverable - a type wrongly excluded from
-- discovery could be re-included. It is not any more. So a false positive has
-- to be repairable by hand from the report, which means the report carries the
-- definition and not a count of it.

DO $$
DECLARE
  cleared  integer := 0;
  names    text;
  stranded integer := 0;
  msg      text;
BEGIN
  -- ORDER BY, because this list is what a human retypes a form back from and a
  -- nondeterministic order makes two runs of the same migration incomparable.
  SELECT string_agg(format('%s (%s, %s field(s)): %s', name, key,
                           jsonb_array_length(template_fields),
                           template_fields::text), E'\n  ' ORDER BY key)
    INTO names
    FROM lookup_document_type
   WHERE pg_temp.ga40_is_id_card_type(key, name)
     AND jsonb_typeof(template_fields) = 'array'
     AND template_fields <> '[]'::jsonb;

  -- ⚠️ Counted against THAT TYPE's own keys, not against "custom_fields is not
  -- empty". A document holding an unrelated key is not a document holding an
  -- identity value, and saying so would be the same unfalsifiable claim the
  -- section above records a round finding.
  SELECT count(*)::int INTO stranded
    FROM document d
    JOIN lookup_document_type t ON t.id = d.document_type_id
   WHERE pg_temp.ga40_is_id_card_type(t.key, t.name)
     AND jsonb_typeof(t.template_fields) = 'array'
     AND t.template_fields <> '[]'::jsonb
     AND jsonb_typeof(d.custom_fields) = 'object'
     AND EXISTS (
           SELECT 1 FROM jsonb_array_elements(t.template_fields) e
            WHERE e ? 'key' AND d.custom_fields ? (e ->> 'key'));

  UPDATE lookup_document_type
     SET template_fields = NULL, updated_at = now()
   WHERE pg_temp.ga40_is_id_card_type(key, name)
     AND jsonb_typeof(template_fields) = 'array'
     AND template_fields <> '[]'::jsonb;
  GET DIAGNOSTICS cleared = ROW_COUNT;

  IF cleared > 0 THEN
    msg := format('migration_073: cleared the form on %s identity-card type(s). The definitions removed, so a false positive can be put back by hand:%s  %s', cleared, E'\n  ', names);
    RAISE NOTICE '%', msg;
    PERFORM pg_temp.ga40_say(msg);
    IF stranded > 0 THEN
      msg := format('migration_073: %s document(s) on those types still hold values in custom_fields under keys this migration just removed from the template. Clearing the template does NOT remove them - they are simply no longer rendered anywhere. Removing stored values is a separate slice.', stranded);
      RAISE NOTICE '%', msg;
      PERFORM pg_temp.ga40_say(msg);
    END IF;
  ELSE
    msg := 'migration_073: no other identity-card type carried a form.';
    RAISE NOTICE '%', msg;
    PERFORM pg_temp.ga40_say(msg);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Assert
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  left_over integer;
  ghost     integer;
  offenders text;
  msg       text;
BEGIN
  SELECT count(*)::int,
         string_agg(format('%s (%s)', name, key), ', ')
    INTO left_over, offenders
    FROM lookup_document_type
   WHERE pg_temp.ga40_is_id_card_type(key, name)
     AND jsonb_typeof(template_fields) = 'array'
     AND template_fields <> '[]'::jsonb;

  -- Not an assertion: the row is legitimately KEPT when documents are filed
  -- under it (section 1), and aborting there would undo the form clearing that
  -- is the half that matters.
  SELECT count(*)::int INTO ghost
    FROM lookup_document_type WHERE key = 'CARTE_DE_IDENTITATE_DOUA_EXEMPLARE';

  msg := format('migration_073: %s identity-card type(s) still carry a form (expected 0), %s CARTE_DE_IDENTITATE_DOUA_EXEMPLARE row(s) remain (expected 0, or 1 with documents filed under it - see the line above).', left_over, ghost);
  RAISE NOTICE '%', msg;
  PERFORM pg_temp.ga40_say(msg);

  IF left_over <> 0 THEN
    RAISE EXCEPTION 'migration_073: % identity-card type(s) still carry a form after this migration: %. Rolling back.', left_over, offenders;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. The report, as a RESULT SET
-- ---------------------------------------------------------------------------
--
-- Read this. It is the only place two of the three apply paths can see what
-- happened, and section 1's KEPT branch ends with a request to a human.

SELECT line AS migration_073_report FROM pg_temp.ga40_m073_report ORDER BY seq;

COMMIT;
