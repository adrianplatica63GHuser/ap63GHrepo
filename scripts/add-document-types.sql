-- ===========================================================================
--  add-document-types.sql
--  Slice #34.09, part 4 - the types the archive contains and the database
--  does not.
--
--  DATA, NOT A MIGRATION, AND THE DISTINCTION IS DELIBERATE.
--  This file lives in `scripts\`, not in `src\db\`, so `Apply-Migration.ps1`
--  never sees it, `migrationChain()` in `scripts/verify-rebuild.ts` never
--  globs it, and it is not part of any rebuild. Run it once, by hand, against
--  whichever database should have the rows. The slice's own words:
--  "CREATING THE ROWS IS DATA, NOT CODE, AND IT COMES AFTER THE KEY FIELD."
--
--    Get-Content .\scripts\add-document-types.sql | docker exec -i ga40prj-postgres psql -U postgres -d ga40db
--
--  The database is ga40db (POSTGRES_DB in .env); the container is
--  ga40prj-postgres. The two names differ, which is easy to get wrong.
--  Against Supabase, paste the file into the SQL editor.
--
--  IDEMPOTENT, twice over, and BOTH halves are pre-checks rather than an
--  `ON CONFLICT` clause: a normalised-name lookup that skips a row whose NAME
--  is already held (by this key or by another), and a key lookup that skips a
--  row whose KEY is already held. `ON CONFLICT (key) DO NOTHING` would have
--  covered only the second, silently, and would have said nothing about the
--  case that actually matters - the name already being there under a DIFFERENT
--  key, which is a decision for a person and not a no-op. A second run says
--  which of the two it is, per row, and writes nothing.
--
-- ---------------------------------------------------------------------------
--  WHY THESE FOUR, AND WHERE THE EVIDENCE IS
-- ---------------------------------------------------------------------------
--
--  Catalogue 33.04 read `C:\dev\TEST.DATA\Modele.Acte\ZZZ Modele acte` on
--  3 September 2026 and found forty-three sample documents, not the thirty-two
--  the slice description expected.
--
--    * ACT_ADITIONAL - group 6, four folders, in two spellings ("6-Act adit"
--      and "6-Act aditional"). ⚠️ **ADRIAN ANSWERED THIS ONE BEFORE THE
--      QUESTION WAS ASKED**, in his own `New.DocTypes.docx`: "Type 6 is not a
--      CVC by itself but it's a legalized document that is appended to a CVC".
--      It is the only group whose folder names do not contain „CVC", and every
--      one of its four tarla-parcela triples also appears in group 2 or group
--      5 - which is what "appended to a CVC" looks like on disk. So: a type of
--      its own, sharing a property with a sale contract rather than being a
--      flavour of one. (Catalogue 33.04, item 77.)
--    * ACT_ALIPIRE (3 samples), ACT_DEZLIPIRE (3) and ACT_DEZMEMBRARE (5) -
--      the eleven folders under `zzz ALIPIRE-DEZLIPIRE`, the thirty-third and
--      only two-level directory, which no taxonomy had named. Dated 2005 to
--      2022. (Catalogue 33.04, items 74 and 78.)
--
--  ⚠️ **THE SLICE NAMED THREE OF THESE AND LEFT THE „zzz" ACTS TO ADRIAN;
--  ALL FOUR ARE HERE, WHICH IS A DECISION AND NOT AN OVERSIGHT.** The
--  description asks for „act adițional, act de alipire, act de dezmembrare,
--  plus whichever of the „zzz" acts Adrian wants findable". Every act under
--  `zzz ALIPIRE-DEZLIPIRE` is one of three kinds, and dezlipire is the one the
--  list omits - on the same evidence, in the same folder, with the same number
--  of samples as alipire. Excluding it would make the one thing an import
--  cannot file the one thing the archive demonstrably holds. Deleting a type
--  that has no documents on it costs one click in Reference Data, so this is
--  the cheaply-reversible direction.
--
-- ---------------------------------------------------------------------------
--  THE KEYS ARE CHOSEN, NOT SLUGGED - WHICH IS THE POINT OF THE SLICE
-- ---------------------------------------------------------------------------
--
--  `lookup_document_type.key` is an immutable slug that all document matching,
--  every `type-config` carve-out and the whole classifier catalogue run on.
--  Before #34.09 the create form asked only for a NAME and slugged whatever it
--  was given, so „Act Adițional" would have become `ACT_ADITIONAL` by accident
--  and „Act de Alipire" would have become `ACT_DE_ALIPIRE` by the same
--  accident - a connector word the catalogue's own style drops
--  (EXTRAS_CONT, not EXTRAS_DE_CONT; ACT_ADJUDECARE, not ACT_DE_ADJUDECARE).
--  The keys below are written in the catalogue's style on purpose, which is
--  exactly what the new key field is for.
--
--  The NAMES follow `sync-reference-data.sql`'s style: title case, connector
--  words kept, Romanian diacritics exactly as the interface will show them.
--
-- ---------------------------------------------------------------------------
--  WHAT THIS FILE DOES NOT DO  (REWRITTEN BY SLICE #34.19)
-- ---------------------------------------------------------------------------
--
--  ⚠️ **SLICE #34.19 ANSWERED THE QUESTION THIS SECTION USED TO LEAVE OPEN, SO
--  READ THE PARAGRAPH BELOW AND NOT THE ONE IT REPLACED.** What stood here
--  said that this file does NOT add the four to `src/db/sync-reference-data.sql`
--  and therefore not to `KNOWN_DOCUMENT_TYPES` either, because those two are
--  one list written twice - bound in both directions by
--  `src/__tests__/document-type-catalogue-single-source.test.ts` - and the
--  second of them is the classifier's whitelist, which is a decision about what
--  a MODEL may answer rather than about what the archive holds. That decision
--  belonged to the document-types series, and #34.19 is where it was taken:
--  **all four are in both lists now.** The rest of this file is unchanged and
--  still correct; only the consequences below moved.
--
--  What that changes, and what it does not:
--    * A database rebuilt from `sync-reference-data.sql` (a fresh Supabase
--      project, the reference-data seed) now HAS these four rows. A database
--      built by replaying the migration chain still does not: the chain seeds
--      document types through `migration_072_seed_document_types.sql`, which is
--      generated from that block but is an APPLIED migration whose MD5 sits in
--      `schema_migrations`, so #34.19 did not regenerate it in place. The two
--      rebuild paths therefore differ by these four rows, which is four new
--      REFDATA `+` lines in `src/db/rebuild-known-differences.txt` and a
--      re-baseline (`npm run db:verify-rebuild -- --update-baseline`, Docker).
--    * `build-ciprian-image.ps1` pg_dumps LIVE reference data, so the rows do
--      travel to Ciprian's box once this has been run against `ga40db` and the
--      image is rebuilt. `scripts/supabase-sync.ts` copies live rows too. So
--      the rows reach every place that matters by the routes that carry rows.
--    * The classifier can now answer one of these four BY KEY:
--      `canonicalTypeKey` resolves against `KNOWN_DOCUMENT_TYPES` and all four
--      are on it. It could already reach them by NAME -
--      `resolveClassifiedDocumentType` matches a model's label against the
--      stored rows through `matchDocumentType`, so a document the model calls
--      „act adițional" landed on the row below rather than creating a second
--      one - and that is still the fallback. What the key buys is a carve-out:
--      `type-config` and every other rule that matches a literal canonical key
--      can now be written for these types at all.
--
--  ⚠️ **THIS FILE IS STILL WORTH KEEPING AND STILL WORTH RUNNING.** It is how
--  the LIVE `ga40db` got these rows and it is idempotent twice over, so a
--  second run against a database that already has them writes nothing and says
--  so. One difference is now visible between the two routes: this file writes
--  no `sort_order`, so the live rows carry the column's DEFAULT 0, while the
--  seed block gives them 40-43. Nothing reads it - `listValues` orders
--  document-types by UNCLASSIFIED-first and then by NAME - which is the same
--  reason the `AND IT WRITES NO sort_order` paragraph below gives for leaving
--  the column out here in the first place.
--
--  ⚠️ **AND IT WRITES NO `sort_order`.** The document-types list is ordered
--  „UNCLASSIFIED first, then name" (`listValues`), so the column decides
--  nothing on any screen; leaving it out gives it its DEFAULT 0, which is
--  exactly what a row added through the Reference Data form gets.
--
--  ⚠️ **`origin` IS LEFT TO ITS DEFAULT, WHICH IS `MANUAL`, AND THAT IS
--  CORRECT.** #29.06 settled the rule: origin says WHO CHOSE THE NAME. A
--  person did - Adrian, in his own taxonomy, read out of his own folder names.
-- ===========================================================================

BEGIN;

DO $$
DECLARE
  wanted CONSTANT text[][] := ARRAY[
    ARRAY['ACT_ADITIONAL',    'Act Adițional'],
    ARRAY['ACT_ALIPIRE',      'Act de Alipire'],
    ARRAY['ACT_DEZLIPIRE',    'Act de Dezlipire'],
    ARRAY['ACT_DEZMEMBRARE',  'Act de Dezmembrare']
  ];
  i          integer;
  w_key      text;
  w_name     text;
  clash_key  text;
  n_added    integer := 0;
  n_present  integer := 0;   -- already there, under the key this file wants
  n_decide   integer := 0;   -- there under a DIFFERENT key, or the key is held
                             -- by a different name: a person has to choose
BEGIN
  FOR i IN 1 .. array_length(wanted, 1) LOOP
    w_key  := wanted[i][1];
    w_name := wanted[i][2];

    -- ⚠️ **THE NAME IS CHECKED WITH THE SAME FOLD migration_080 INDEXES**, so
    -- this script reports "already there under another key" instead of dying
    -- on a 23505 that names a normalised string and neither row. It is the
    -- inline expansion of pg_temp.ga40_norm_name from scripts/decision-checks.sql;
    -- see migration_080's header for why it is spelled out in full.
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
        n_present := n_present + 1;
        RAISE NOTICE 'add-document-types: % = "%" is already there, unchanged.', w_key, w_name;
      ELSE
        -- ⚠️ **COUNTED AS A DECISION, NOT AS "ALREADY PRESENT", AND AN
        -- ADVERSARIAL ROUND IS WHY.** The first version put this in the same
        -- counter as the line above, so the summary reported a row needing a
        -- human choice as a clean no-op - the operator reads the summary, not
        -- the per-row stream, which is the whole reason the summary exists.
        n_decide := n_decide + 1;
        RAISE WARNING 'add-document-types: "%" already exists under the key % rather than %. Nothing written for this one - decide which key the archive should keep before doing anything else.',
          w_name, clash_key, w_key;
      END IF;
      CONTINUE;
    END IF;

    IF EXISTS (SELECT 1 FROM lookup_document_type WHERE key = w_key) THEN
      n_decide := n_decide + 1;
      RAISE WARNING 'add-document-types: the key % is already held by a row with a DIFFERENT name. Nothing written for this one.', w_key;
      CONTINUE;
    END IF;

    INSERT INTO lookup_document_type (key, name) VALUES (w_key, w_name);
    n_added := n_added + 1;
    RAISE NOTICE 'add-document-types: created % = "%".', w_key, w_name;
  END LOOP;

  IF n_decide > 0 THEN
    RAISE WARNING 'add-document-types: % created, % already present as asked, and % need a decision - read the WARNING lines above; nothing was written for those.',
      n_added, n_present, n_decide;
  ELSE
    RAISE NOTICE 'add-document-types: % created, % already present. Nothing needs a decision.',
      n_added, n_present;
  END IF;
END $$;

COMMIT;

-- What the archive now holds, for the four this file is about.
SELECT key, name, origin, sort_order
  FROM lookup_document_type
 WHERE key IN ('ACT_ADITIONAL', 'ACT_ALIPIRE', 'ACT_DEZLIPIRE', 'ACT_DEZMEMBRARE')
 ORDER BY key;
