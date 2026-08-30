-- migration_074_document_import_title.sql
-- Slice #32.06 - the Pre-existing stage stops missing a document the AI retitled.
--
-- WHAT THIS DOES
--   1. Adds `document.import_title` - the title the IMPORT derived from the
--      folder entry, which is `titleForEntry(entry)` in
--      src/lib/import/preexisting-check.ts and nothing else.
--   2. Backfills it for single-page documents from their page's file name,
--      which is the same value for that shape, and ONLY for that shape.
--   3. Reports what it filled and what it deliberately left null.
--
-- WHY A COLUMN AND NOT A CHEAPER FIX
--   `preexistingKeyOf` folds the TITLE into the key. The folder side keys on
--   what the folder says - a file's own name. The archive side keys on
--   `document.title`, and `resolveImportedTitle` REWRITES that title after the
--   pages are uploaded whenever the model returns a printed heading and the
--   file's own name does not both name the KIND and distinguish WHICH one. The
--   two sides then key differently, the stage reports the folder as new, and
--   every document in it is imported a second time.
--
--   Measured on 2026-08-30, over C:\dev\TEST.DATA\CLINCENI.3, by
--   scripts/testing/measure-title-loss.ts calling the real
--   `resolveImportedTitle`: 206 of 304 readable documents - 67.8% - would lose
--   the title the import stored. Files alone: 176 of 246, 71.5%. That is an
--   UPPER BOUND and the script says why: it always supplies a reading where a
--   real run sometimes gets none.
--
--   The two cheaper fixes were considered and both are wrong:
--
--   - DROP THE TITLE FROM THE KEY. That makes this key the same shape as
--     DUP-02's, which `preexisting-check.ts` spends four paragraphs explaining
--     is the wrong direction for this stage: under-claiming costs a duplicate,
--     over-claiming attaches somebody else's document to the user's property
--     and records nothing.
--
--   - NORMALISE THE STORED TITLE AND COMPARE LOOSELY. Ruled out by evidence
--     rather than by argument. The 32.05 UAT imported 03.types.noform twice.
--     `Fisa corp proprietate 4432.jpg` was stored as `FISA CORPULUI DE
--     PROPRIETATE` on the first run (DOC01511) and `FISA CORPULUI DE
--     PROPRIETATE TARLA 46, PARCELA 222/13/1` on the second (DOC01519). The
--     rewritten title is not stable between reads of the SAME file, so no
--     normalisation of it can converge. Only a value the FOLDER produces can.
--
-- ⚠️ **NULLABLE, AND THE FALLBACK IS THE WHOLE COMPATIBILITY STORY.** The
-- archive side reads `import_title ?? title`. Every document this migration
-- leaves null therefore keys exactly as it does today - a document added by
-- hand, one imported before the wizard, and every multi-page document this
-- backfill declines to touch. Nothing gets worse for any of them; the column
-- only ever ADDS a document that could not be recognised before.
--
-- ⚠️ **THE BACKFILL IS THE ONE PART OF THIS FILE THAT NEEDS A HUMAN'S EYE, and
-- it is deliberately the narrowest thing that is worth doing.** For a document
-- imported from a plain file, `titleForEntry` returns `entry.name` - the file
-- name WITH its extension - and `bulk-import-dialog.tsx` uploads that same
-- string as `document_page.file_name`. So for a document holding exactly one
-- page, the page's file name IS the value this column wants, recoverable
-- exactly. Nothing else is: a page group's title came from
-- `folderNameToTitleHint(folder)` and the folder name is not stored anywhere.
--
-- ⚠️ **AND A ONE-PAGE PAGE GROUP IS THE TRAP THE FILTER BELOW EXISTS FOR.**
-- A page group's members are numerically-named images (`isPageGroupMember` in
-- src/lib/files/file-kinds.ts: an image kind AND a purely numeric basename), so
-- a page group that arrived with one page holds `530.jpg` while its title came
-- from the FOLDER's name. Backfilling that one from its file name would write
-- `530.jpg` into the key and the folder side would compute the folder's title
-- hint - a MISS, which is the defect this slice is fixing, reintroduced by its
-- own migration. The WHERE clause below excludes that shape. `isPageGroupMember`
-- is the authority; this is a deliberately WIDER SQL approximation of it, and
-- wider is the safe direction here because every name it wrongly excludes is
-- simply left null and keeps today's behaviour.
--
-- ⚠️ **WHAT THE BACKFILL CHANGES FOR DOCUMENTS THE WIZARD DID NOT CREATE.** It
-- fills any single-page document, including one added by hand years ago, and
-- that makes some rows matchable that were not. It cannot make a match WRONG
-- that was previously right: the key it produces is the file name plus the page
-- name and byte size, which is exactly what the folder side computes for a file
-- of that name. What it does is widen exposure to the `link` collision
-- `preexisting-check.ts` already documents - two genuinely different scans off
-- one machine sharing a name and a byte count. That collision is not new, it is
-- listed as this stage's known expensive failure, and its escape - rename the
-- file and the system treats it as new - is unchanged and still on the screen.

BEGIN;

-- 1. The column --------------------------------------------------------------
ALTER TABLE public.document
  ADD COLUMN IF NOT EXISTS import_title text;

COMMENT ON COLUMN public.document.import_title IS 'The title the import derived from the folder entry (titleForEntry). The Pre-existing stage keys on import_title ?? title, so the AI rewriting document.title can no longer make a re-imported folder look new. Null for anything the import did not create. Slice #32.06.';

-- 2. The backfill ------------------------------------------------------------
--
-- Exactly-one-page documents only, and not the ones whose single page looks
-- like a page-group member. Written as an UPDATE ... FROM over a CTE rather
-- than a correlated subquery so the "exactly one page" test and the value come
-- from the same scan and cannot disagree.
WITH one_page AS (
  SELECT document_id,
         min(file_name) AS file_name
    FROM public.document_page
   GROUP BY document_id
  HAVING count(*) = 1
)
UPDATE public.document d
   SET import_title = o.file_name
  FROM one_page o
 WHERE d.id = o.document_id
   AND d.import_title IS NULL
   AND o.file_name IS NOT NULL
   AND btrim(o.file_name) <> ''
   -- Not a page-group member: see the header. Wider than isPageGroupMember on
   -- purpose - every extension listed here plus every numeric name is left
   -- alone, and being left alone is today's behaviour.
   AND o.file_name !~* '^[0-9]+\.[a-z0-9]{1,4}$';

-- 3. Say what happened --------------------------------------------------------
--
-- This file runs on the rebuild chain, on the cloud project and on Ciprian's
-- UAT box (`migrationChain()` in scripts/verify-rebuild.ts globs
-- src/db/migration_*.sql and applies every match in name order), so it reports
-- rather than assumes. None of these counts is an assertion: every one of them
-- is legitimately zero on an empty database.
DO $$
DECLARE
  v_total    bigint;
  v_filled   bigint;
  v_multi    bigint;
  v_pagegrp  bigint;
  v_nopages  bigint;
BEGIN
  SELECT count(*) INTO v_total  FROM public.document;
  SELECT count(*) INTO v_filled FROM public.document WHERE import_title IS NOT NULL;

  SELECT count(*) INTO v_multi FROM (
    SELECT document_id FROM public.document_page
     GROUP BY document_id HAVING count(*) > 1
  ) m;

  SELECT count(*) INTO v_pagegrp FROM (
    SELECT document_id, min(file_name) AS file_name
      FROM public.document_page
     GROUP BY document_id HAVING count(*) = 1
  ) s WHERE s.file_name ~* '^[0-9]+\.[a-z0-9]{1,4}$';

  SELECT count(*) INTO v_nopages FROM public.document d
   WHERE NOT EXISTS (SELECT 1 FROM public.document_page p WHERE p.document_id = d.id);

  RAISE NOTICE '#32.06 import_title: % of % documents filled.', v_filled, v_total;
  RAISE NOTICE '  left null - multi-page documents (title came from the folder): %', v_multi;
  RAISE NOTICE '  left null - single page that looks like a page-group member:  %', v_pagegrp;
  RAISE NOTICE '  left null - documents with no page at all:                    %', v_nopages;
  RAISE NOTICE '  Every null keys on document.title exactly as it does today.';
END $$;

COMMIT;
