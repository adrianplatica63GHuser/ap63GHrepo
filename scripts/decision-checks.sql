-- ===========================================================================
--  decision-checks.sql
--  Three questions the source code cannot answer, for D-08, D-11 and the
--  identity-card row of the deletion list.
--
--  READ-ONLY. Every statement is a SELECT. Nothing here writes, locks or
--  changes a row.
--
--  Run it against whichever database the decision is about — the local dev
--  container first, then Ciprian's UAT box, since the answers can differ:
--
--    Get-Content .\scripts\decision-checks.sql | docker exec -i ga40prj-postgres psql -U postgres -d ga40db
--
--  The database is ga40db (POSTGRES_DB in .env); the container is named
--  ga40prj-postgres. The two names differ, which is easy to get wrong.
--
--  Against Supabase, paste the file into the SQL editor.
-- ===========================================================================


-- ---------------------------------------------------------------------------
--  Shared helper: the same fold the TypeScript applies.
--
--  foldRomanian() in src/lib/import/id-card.ts is NFD-decompose, strip the
--  combining marks, lowercase, collapse whitespace, trim. Postgres can do all
--  of that: normalize(..., NFD) splits ă into a + U+0306, and the character
--  class below removes the marks by code point rather than by a translate()
--  map — which is deliberate, because migration_020's translate() map is
--  misaligned and is one of the defects on the list.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pg_temp.ga40_fold(txt text) RETURNS text AS $$
  SELECT btrim(regexp_replace(
           regexp_replace(
             lower(normalize(coalesce($1, ''), NFD)),
             '[' || chr(768) || '-' || chr(879) || ']', '', 'g'),
           '\s+', ' ', 'g'))
$$ LANGUAGE sql IMMUTABLE;

--  normaliseDocumentTypeName() in src/lib/documents/document-type-match.ts:
--  the same fold, then everything that is not a-z0-9 removed entirely.
CREATE OR REPLACE FUNCTION pg_temp.ga40_norm_name(txt text) RETURNS text AS $$
  SELECT regexp_replace(pg_temp.ga40_fold($1), '[^a-z0-9]', '', 'g')
$$ LANGUAGE sql IMMUTABLE;


-- ===========================================================================
--  QUERY 1 — D-08.  Should property.tarla_sola become a foreign key?
--
--  What the migration would have to cope with. Three answers, in order of
--  how much they would hurt:
--    1a  how many properties carry a tarla value at all
--    1b  what migration_078 will do to this database  <-- the problem
--    1c  duplicate codes inside lookup_tarla itself
--
--  ⚠️ **1b IS THE COMPLETE PREVIEW OF migration_078, AND IT WAS NOT.** The
--  migration itself used to say so: 1b scoped on
--  `btrim(coalesce(tarla_sola,'')) <> ''`, knew nothing about `tarla_id`, and
--  said nothing about the two conditions that make the file ABORT. Slice
--  #34.18 closed all of it, and an adversarial round is why the list is four
--  fates rather than two:
--
--    fate 1  a `tarla_id` names no lookup_tarla row. Section 2 adds the
--            foreign key BEFORE anything else happens, so the ADD CONSTRAINT
--            fails and the file rolls back.
--    fate 2  the value matches MORE THAN ONE lookup_tarla row. Section 3 of
--            the migration RAISEs and the whole file rolls back. Same
--            outcome, different cause, and neither was visible here before.
--            The two are numbered in the order the migration REACHES them,
--            not by severity.
--
--            ⚠️ Fate 1 predicts the FK's failure, and section 2 only ADDS the
--            FK when no constraint of that shape is already there. Its guard
--            tests conrelid, contype, confrelid, conkey and confdeltype but
--            NOT `convalidated`, so a pre-existing NOT VALID foreign key of
--            the right shape satisfies it, the ADD is skipped, nothing
--            validates, and the file runs on to destroy the text that fate 1
--            said it would not reach. Nothing in this repo creates such a
--            constraint; the gap is in #34.18's handover under "Noticed, not
--            fixed". If you have hand-built an FK here, check `convalidated`
--            before trusting fate 1.
--    fate 3  no code matches the text: the text is ERASED at COMMIT and this
--            is the only warning anyone gets.
--    fate 4  the property already carries a DISAGREEING id: the id wins,
--            which is right, and the text is discarded anyway.
--
--  ⚠️ **FATES 2 AND 3 ARE GROUPED BY THE FOLD, NOT BY THE SPELLING.**
--  `min(...)` picks one spelling to SHOW. migration_078 section 3 states the
--  same rule and records the review round that caught the other version: `T9`
--  and `t9` on two properties are ONE value with one fix, and printing them as
--  two rows says there are two problems. 1a's `distinct_values_folded` counts
--  the same way, so those three agree.
--
--  Fates 1 and 4 do NOT, and deliberately: fate 1 is one row per property,
--  because the id is what has to be fixed and every property has its own; fate
--  4 groups by the fold AND the code its id names, because "this text lost to
--  THAT code" is the fact. So one folded value can legitimately produce
--  several rows under those two fates, and `distinct_values_folded` is not a
--  row count for them. Said here because an earlier draft of this paragraph
--  claimed 1a and 1b could never disagree, and a review round measured that
--  they can.
--
--  ⚠️ **THE BLANK TEST IS `pg_temp.ga40_fold(tarla_sola) <> ''`**, the SAME
--  function the match uses — as every guard in migration_078 does. Single-
--  argument `btrim` strips SPACES ONLY, so the old 1b listed a tab-only value
--  as a value about to be erased while the migration treated it as blank.
--
--  ⚠️ **`tarla_id` IS READ THROUGH `to_jsonb(p)`, DELIBERATELY, AND IT COSTS
--  SOMETHING.** This script runs BEFORE the migration, on a database that may
--  never have heard of that column — it exists only where
--  `supabase_repair_missing_tables.sql` has run, which adds it without
--  dropping the text. A bare `p.tarla_id` fails with `column does not exist`
--  on exactly the databases 1b is meant to preview. What it costs, said
--  plainly rather than discovered: `to_jsonb(p)` needs SELECT on the WHOLE
--  `property` row (a column-level grant is not enough) and it cannot use an
--  index, so on a large `property` it is a sequential scan. Both are fine for
--  the one operator this script has; if either ever bites, the replacement is
--  `\gset` + `\if` around two spellings of 1b, not a third mechanism.
--
--  ⚠️ **`tarla_sola` IS NOT GUARDED THAT WAY, and does not need to be.** 1a
--  and 1b both name it directly, so both fail on a database that has ALREADY
--  run migration_078 — which is correct: after the drop there is nothing left
--  to preview, and this file's whole purpose is the run that has not happened.
--
--  Decision rule, in order:
--    * any fate 1 or fate 2 row  — migration_078 will not apply at all. Fix
--      those first; nothing below them is reachable.
--    * any fate 3 row — each folded value needs a home, a new lookup_tarla row
--      or a correction, BEFORE the migration runs. After COMMIT the text is
--      gone and recovery is a restore.
--    * any fate 4 row — only a stale spelling is lost; the id is the answer
--      and it survives.
--    * empty — the migration applies and destroys no VALUE. It still drops
--      the `tarla_sola` column itself, and the trigram index over it; that is
--      the point of the migration, not a casualty of it.
--  This is the one chance to intervene: the migration's own WARNING is a
--  record, not a prompt.
-- ===========================================================================
\echo ''
\echo '=== 1a. Properties carrying a tarla value ==='
\echo '    (folded, so a whitespace-only value counts as blank — as migration_078 reads it)'
SELECT
  count(*)                                                          AS properties_total,
  count(*) FILTER (WHERE pg_temp.ga40_fold(tarla_sola) <> '')       AS with_tarla,
  count(*) FILTER (WHERE pg_temp.ga40_fold(tarla_sola) =  '')       AS without_tarla,
  count(DISTINCT pg_temp.ga40_fold(tarla_sola))
    FILTER (WHERE pg_temp.ga40_fold(tarla_sola) <> '')              AS distinct_values_folded
FROM property;

\echo ''
\echo '=== 1b. What migration_078 will do to this database ==='
\echo '    (empty result = it applies cleanly and no tarla VALUE is lost)'
\echo '    (ABORT rows stop the whole file: nothing listed below them happens)'
-- Section 2 adds `property_tarla_id_fkey` BEFORE anything else happens - before
-- section 3's refusal, before section 4 resolves and before section 5 says a
-- word - so a `tarla_id` pointing at no lookup_tarla row fails the ADD
-- CONSTRAINT and rolls the whole file back. It is fate 1 because it is the
-- first thing that can stop the file, and it is NOT scoped by `tarla_sola` at
-- all: the FK validates every row, including the ones carrying no text.
-- One row per property, deliberately: an aggregate row here would take its
-- `value` from one property and its example code from another.
SELECT
  '1. MIGRATION ABORTS - tarla_id names no lookup_tarla row (the FK fails)'  AS fate,
  coalesce(nullif(btrim(regexp_replace(p.tarla_sola, '\s+', ' ', 'g')), ''), '(no text)') AS value,
  '(none - the id is a dangling reference)'                                  AS lookup_tarla_codes,
  1                                                                          AS properties_affected,
  coalesce(p.code, '(no code)')                                              AS example_property
FROM property p
WHERE (to_jsonb(p) ->> 'tarla_id') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM lookup_tarla t
    WHERE t.id::text = (to_jsonb(p) ->> 'tarla_id')
  )

UNION ALL

SELECT
  '2. MIGRATION ABORTS - the value matches MORE THAN ONE lookup_tarla row'   AS fate,
  min(btrim(regexp_replace(p.tarla_sola, '\s+', ' ', 'g')))                  AS value,
  string_agg(DISTINCT t.indicativ, ' | ' ORDER BY t.indicativ)               AS lookup_tarla_codes,
  count(DISTINCT p.id)                                                       AS properties_affected,
  min(coalesce(p.code, '(no code)'))                                         AS example_property
FROM property p
JOIN lookup_tarla t
  ON pg_temp.ga40_fold(t.indicativ) = pg_temp.ga40_fold(p.tarla_sola)
WHERE pg_temp.ga40_fold(p.tarla_sola) <> ''
GROUP BY pg_temp.ga40_fold(p.tarla_sola)
HAVING count(DISTINCT t.id) > 1

UNION ALL

SELECT
  '3. text ERASED - no lookup_tarla code matches it'                         AS fate,
  min(btrim(regexp_replace(p.tarla_sola, '\s+', ' ', 'g')))                  AS value,
  NULL::text                                                                 AS lookup_tarla_codes,
  count(*)                                                                   AS properties_affected,
  min(coalesce(p.code, '(no code)'))                                         AS example_property
FROM property p
WHERE pg_temp.ga40_fold(p.tarla_sola) <> ''
  AND (to_jsonb(p) ->> 'tarla_id') IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM lookup_tarla t
    WHERE pg_temp.ga40_fold(t.indicativ) = pg_temp.ga40_fold(p.tarla_sola)
  )
GROUP BY pg_temp.ga40_fold(p.tarla_sola)

UNION ALL

-- The other way a value goes, and the one 1b could not see at all. Section 5
-- of migration_078 warns about it separately: the property already had an id,
-- its text does not agree with the code that id names, the id wins - which is
-- right - and the text still disappears. Inner join, exactly as section 5's
-- own listing does, because the id that names nothing is fate 1 above and
-- never reaches section 5.
SELECT
  '4. text DISCARDED - the property already carries a DISAGREEING tarla_id'  AS fate,
  min(btrim(regexp_replace(p.tarla_sola, '\s+', ' ', 'g')))                  AS value,
  t.indicativ                                                                AS lookup_tarla_codes,
  count(*)                                                                   AS properties_affected,
  min(coalesce(p.code, '(no code)'))                                         AS example_property
FROM property p
JOIN lookup_tarla t ON t.id::text = (to_jsonb(p) ->> 'tarla_id')
WHERE pg_temp.ga40_fold(p.tarla_sola) <> ''
  AND pg_temp.ga40_fold(t.indicativ) <> pg_temp.ga40_fold(p.tarla_sola)
GROUP BY pg_temp.ga40_fold(p.tarla_sola), t.indicativ

ORDER BY 1, 4 DESC, 2;

\echo ''
\echo '=== 1c. Duplicate codes inside lookup_tarla ==='
\echo '    (these are the pairs 33.03 item 11 describes: neither deletable nor movable)'
SELECT
  pg_temp.ga40_fold(indicativ) AS folded_code,
  count(*)                     AS row_count,
  string_agg(indicativ, ' | ' ORDER BY indicativ) AS spellings,
  string_agg(id::text, ' | ' ORDER BY indicativ)  AS ids
FROM lookup_tarla
GROUP BY 1
HAVING count(*) > 1
ORDER BY row_count DESC, folded_code;


-- ===========================================================================
--  QUERY 2 — D-11.  A unique index on the normalised document-type name.
--
--  Any group returned here has to be resolved BEFORE the index can be
--  created, because CREATE UNIQUE INDEX fails on existing duplicates.
--  The second block counts the documents filed under each side, so you can
--  see which of a pair is the one to keep.
--
--  Decision rule: empty result = schedule the migration. Rows = decide, per
--  group, which row survives and where its documents move.
-- ===========================================================================

\echo ''
\echo '=== 2a. Document types whose names collide under the code normalisation ==='
\echo '    (empty result = the unique index can be created as-is)'
SELECT
  pg_temp.ga40_norm_name(name)                       AS normalised,
  count(*)                                           AS row_count,
  string_agg(key  || ' = "' || name || '"', E'\n     ' ORDER BY key) AS rows
FROM lookup_document_type
WHERE pg_temp.ga40_norm_name(name) <> ''
GROUP BY 1
HAVING count(*) > 1
ORDER BY row_count DESC, normalised;

\echo ''
\echo '=== 2b. Documents filed under each colliding type ==='
SELECT
  t.key,
  t.name,
  t.origin,
  count(d.id) AS documents_filed
FROM lookup_document_type t
LEFT JOIN document d ON d.document_type_id = t.id
WHERE pg_temp.ga40_norm_name(t.name) IN (
        SELECT pg_temp.ga40_norm_name(name)
        FROM lookup_document_type
        WHERE pg_temp.ga40_norm_name(name) <> ''
        GROUP BY 1 HAVING count(*) > 1)
GROUP BY t.id, t.key, t.name, t.origin
ORDER BY pg_temp.ga40_norm_name(t.name), documents_filed DESC;

\echo ''
\echo '=== 2c. Types whose name normalises to nothing ==='
\echo '    (punctuation-only names — the index would not constrain these, by design)'
SELECT key, name FROM lookup_document_type
WHERE pg_temp.ga40_norm_name(name) = ''
ORDER BY key;


-- ===========================================================================
--  QUERY 3 — the identity-card row (deletion list, 33.04 item 13).
--
--  migration_073 clears the form from every identity-card type and deletes
--  the CARTE_DE_IDENTITATE_DOUA_EXEMPLARE row -- but only when no document is
--  filed under it. Whether either half actually happened in THIS database is
--  not knowable from source. This is migration_073's own assertion, run as a
--  read.
--
--  The predicate below is documentTypeIsIdCard(): the key list, OR the name
--  test with its vehicle vetoes applied first.
--
--  Decision rule: 3a empty and 3b showing zero rows = the migration ran and
--  the catalogue item is safe to close. Anything else means the migration has
--  not reached this database, and the deletion of the five hand-written test
--  copies is still correct in code but the data repair has not happened.
-- ===========================================================================

CREATE OR REPLACE FUNCTION pg_temp.ga40_is_id_card_type(k text, nm text) RETURNS boolean AS $$
  SELECT
    btrim(coalesce($1, '')) = ANY (ARRAY['CARTE_IDENTITATE'])
    OR (
      pg_temp.ga40_fold($2) <> ''
      AND pg_temp.ga40_fold($2) !~ 'vehicul'
      AND pg_temp.ga40_fold($2) !~ '(^|[^a-z0-9])auto(mobil|turism)?([^a-z0-9]|$)'
      AND pg_temp.ga40_fold($2) !~ '(^|[^a-z0-9])remorc'
      AND pg_temp.ga40_fold($2) ~
            '(^|[^a-z0-9])(cart(e|ea|i)|act(e)?|buletin)[[:space:]]+(de[[:space:]]+)?identitate([^a-z0-9]|$)'
    )
$$ LANGUAGE sql IMMUTABLE;

\echo ''
\echo '=== 3a. Identity-card types that still carry a form ==='
\echo '    (expected: empty. Any row here is a type migration_073 should have cleared)'
SELECT
  key,
  name,
  jsonb_array_length(template_fields) AS field_count
FROM lookup_document_type
WHERE pg_temp.ga40_is_id_card_type(key, name)
  AND jsonb_typeof(template_fields) = 'array'
  AND template_fields <> '[]'::jsonb
ORDER BY key;

\echo ''
\echo '=== 3b. The CARTE_DE_IDENTITATE_DOUA_EXEMPLARE row ==='
\echo '    (expected: no rows. One row with documents_filed > 0 is the legitimate keep)'
SELECT
  t.key,
  t.name,
  count(d.id) AS documents_filed,
  CASE WHEN count(d.id) > 0
       THEN 'kept on purpose - documents are filed under it'
       ELSE 'should have been deleted by migration_073'
  END AS reading
FROM lookup_document_type t
LEFT JOIN document d ON d.document_type_id = t.id
WHERE t.key = 'CARTE_DE_IDENTITATE_DOUA_EXEMPLARE'
GROUP BY t.id, t.key, t.name;

\echo ''
\echo '=== 3c. Every identity-card type in this database, for context ==='
SELECT
  key,
  name,
  origin,
  COALESCE(jsonb_array_length(NULLIF(template_fields, 'null'::jsonb)), 0) AS field_count
FROM lookup_document_type
WHERE pg_temp.ga40_is_id_card_type(key, name)
ORDER BY key;

\echo ''
\echo '=== done. Nothing above wrote anything. ==='
