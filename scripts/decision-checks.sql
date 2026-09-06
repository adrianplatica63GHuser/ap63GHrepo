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
--    1b  values on properties that match NO lookup_tarla row  <-- the problem
--    1c  duplicate codes inside lookup_tarla itself
--
--  Decision rule: if 1b comes back empty, the migration is mechanical. If it
--  returns rows, each one needs a home — either a new lookup_tarla row or a
--  correction — before tarla_sola can become NOT NULL-able as a key.
-- ===========================================================================

\echo ''
\echo '=== 1a. Properties carrying a tarla value ==='
SELECT
  count(*)                                                        AS properties_total,
  count(*) FILTER (WHERE btrim(coalesce(tarla_sola, '')) <> '')    AS with_tarla,
  count(*) FILTER (WHERE btrim(coalesce(tarla_sola, '')) =  '')    AS without_tarla,
  count(DISTINCT btrim(tarla_sola))
    FILTER (WHERE btrim(coalesce(tarla_sola, '')) <> '')           AS distinct_values
FROM property;

\echo ''
\echo '=== 1b. Tarla values on properties that match no lookup_tarla row ==='
\echo '    (empty result = the migration is mechanical)'
SELECT
  btrim(p.tarla_sola)        AS orphan_value,
  count(*)                   AS properties_affected,
  min(p.code)                AS example_property
FROM property p
WHERE btrim(coalesce(p.tarla_sola, '')) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM lookup_tarla t
    WHERE pg_temp.ga40_fold(t.indicativ) = pg_temp.ga40_fold(p.tarla_sola)
  )
GROUP BY 1
ORDER BY properties_affected DESC, orphan_value;

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
