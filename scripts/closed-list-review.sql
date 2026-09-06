-- ===========================================================================
--  closed-list-review.sql
--  The worksheet for the one-off pass through the EIGHT CLOSED LISTS with
--  Ciprian, named in the Slice #34.01 handover and answered by decision D-13
--  option (a): the eleven lists are three kinds and cannot take one answer.
--
--    • EIGHT CLOSED VOCABULARIES — this file. They describe the system's own
--      model, so they change when the model does, which is a conversation and
--      not a feature.
--    • TWO THAT ACCRUE from real work — `lookup_tarla` and
--      `lookup_institution`. Governed by the `origin` column in Slice #34.02,
--      not by this pass.
--    • DOCUMENT TYPES — its own kind; it already has `origin`
--      (migration_069) and its own catalogue screen.
--
--  READ-ONLY. Nothing here writes, locks or changes a row: every query is a
--  SELECT, and the only other statements create one helper function and one
--  view in `pg_temp`, which live for the session and vanish with it. It
--  decides nothing either — it puts the eight lists in front of a person with
--  the one number the screen does not show: how many live rows each value is
--  actually holding up.
--
--    Get-Content .\scripts\closed-list-review.sql | docker exec -i ga40prj-postgres psql -U postgres -d ga40db
--
--  The database is ga40db (POSTGRES_DB in .env); the container is named
--  ga40prj-postgres. The two names differ, which is easy to get wrong.
--  Against Supabase, paste the file into the SQL editor. Run it against
--  whichever database the decision is about — Ciprian's UAT box is the one
--  whose contents the conversation is about.
--
--  WHY THE `used_by` COLUMN IS THE WHOLE POINT
--    Since Slice #29.05 a delete is REFUSED while anything depends on the row,
--    and the dialog offers to move the dependents onto another value first.
--    So `used_by = 0` means "delete it and it is gone"; anything else means
--    "decide where its rows go, then delete". The counts below are the same
--    edges `LIST_DEPENDENCIES` (src/lib/admin/value-lists/dependents.ts)
--    counts, so this file and the screen agree.
--
--    `config_ticks` is different and is NOT a blocker: those are the
--    whitelist rows under "Roluri pe Proprietate" / "Roluri pe Document" /
--    "Persoană → Persoană", which the schema cascades away with the role.
--    They are settings that go with the row, not objects that depend on it.
--
--  ⚠️ WHAT THIS FILE CANNOT TELL YOU, AND WHY IT IS A HUMAN PASS
--    migration_070 dropped `deleted_at` from the eleven lookup tables. Rows
--    that had been soft-deleted while something still referenced them were
--    deliberately KEPT — and with the column gone they simply became VISIBLE
--    again (migration_070, section 1c, which said so in a NOTICE at the time).
--    Those rows are now INDISTINGUISHABLE from rows nobody ever deleted: no
--    column, no flag, no timestamp survives that would name them. §3 below
--    is the best proxy — a resurrected value is usually a near-duplicate of
--    the one it was replaced by — but the list it produces is a shortlist to
--    read, not an answer.
-- ===========================================================================


-- The same fold the application applies (foldRomanian, src/lib/import/id-card.ts):
-- NFD-decompose, strip combining marks, lowercase, collapse whitespace, trim.
CREATE OR REPLACE FUNCTION pg_temp.ga40_fold(txt text) RETURNS text AS $$
  SELECT btrim(regexp_replace(
           regexp_replace(
             lower(normalize(coalesce($1, ''), NFD)),
             '[' || chr(768) || '-' || chr(879) || ']', '', 'g'),
           '\s+', ' ', 'g'))
$$ LANGUAGE sql IMMUTABLE;


-- ---------------------------------------------------------------------------
--  The eight closed lists, one row per value, with its live dependents.
--  Built once here and read three times below.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW pg_temp.ga40_closed_lists AS
  SELECT 'Tipuri de Proprietate'      AS list, 1 AS ord, t.name AS value,
         (SELECT count(*) FROM property p WHERE p.property_type_id = t.id) AS used_by,
         0 AS config_ticks
  FROM lookup_property_type t
UNION ALL
  SELECT 'Categorii Folosință', 2, t.name,
         (SELECT count(*) FROM property p WHERE p.use_category_id = t.id),
         0
  FROM lookup_use_category t
UNION ALL
  SELECT 'Tipuri de Persoană Fizică', 3, t.name,
         (SELECT count(*) FROM natural_person n WHERE n.physical_person_type_id = t.id),
         0
  FROM lookup_person_type t
UNION ALL
  SELECT 'Cetățenie', 4, t.name,
         (SELECT count(*) FROM natural_person n WHERE n.citizenship_id = t.id),
         0
  FROM lookup_citizenship t
UNION ALL
  SELECT 'Tipuri de Persoană Juridică', 5, t.name,
         (SELECT count(*) FROM judicial_person j WHERE j.judicial_person_type_id = t.id),
         0
  FROM lookup_judicial_person_type t
UNION ALL
  -- Six inbound edges, and the split matters: three carry real associations
  -- and refuse the delete, three are whitelist ticks that cascade away with
  -- the row.
  SELECT 'Roluri Persoană', 6, t.name,
         (SELECT count(*) FROM property_person x WHERE x.person_role_id      = t.id)
       + (SELECT count(*) FROM person_document x WHERE x.person_role_id      = t.id)
       + (SELECT count(*) FROM person_person   x WHERE x.relationship_role_id = t.id),
         (SELECT count(*) FROM lookup_property_person_role x WHERE x.person_role_id = t.id)
       + (SELECT count(*) FROM lookup_doc_type_person_role x WHERE x.person_role_id = t.id)
       + (SELECT count(*) FROM lookup_person_person_role  x WHERE x.person_role_id = t.id)
  FROM lookup_person_role t
UNION ALL
  SELECT 'Proprietate → Proprietate', 7, t.name,
         (SELECT count(*) FROM property_property x WHERE x.relationship_role_id = t.id),
         0
  FROM lookup_property_property_role t
UNION ALL
  SELECT 'Document → Document', 8, t.name,
         (SELECT count(*) FROM document_document x WHERE x.relationship_role_id = t.id),
         0
  FROM lookup_document_document_role t;


-- ===========================================================================
--  §1  The shape of the afternoon, in eight rows.
--
--  `deletable_now` is what can go with one click and no conversation.
--  `needs_a_move_first` is what the delete dialog will refuse until its
--  dependents are pointed somewhere else.
-- ===========================================================================
\echo ''
\echo '=== 1. The eight closed lists, at a glance ==='
SELECT
  list                                                  AS "Listă",
  count(*)                                              AS rows_total,
  count(*) FILTER (WHERE used_by = 0)                   AS deletable_now,
  count(*) FILTER (WHERE used_by > 0)                   AS needs_a_move_first,
  sum(used_by)                                          AS live_rows_held_up
FROM pg_temp.ga40_closed_lists
GROUP BY list, ord
ORDER BY ord;


-- ===========================================================================
--  §2  Every value in every closed list, unused ones first.
--
--  Read top-down per list: the rows at the top of each block are the ones a
--  delete would take away today, which is where a vocabulary that has drifted
--  shows itself. A value nobody has ever used in this archive is either a
--  value nobody needs, or one nobody has found — and Ciprian is the only
--  person who can say which.
-- ===========================================================================
\echo ''
\echo '=== 2. Every value, with what it is holding up (unused first) ==='
SELECT
  list          AS "Listă",
  value         AS "Valoare",
  used_by       AS "În uz",
  config_ticks  AS "Bife whitelist",
  CASE WHEN used_by = 0 THEN 'delete goes through'
       ELSE 'delete refused - move its ' || used_by || ' row(s) first'
  END           AS "Ce se întâmplă la ștergere"
FROM pg_temp.ga40_closed_lists
ORDER BY ord, used_by, value;


-- ===========================================================================
--  §3  Near-duplicates — the best proxy for a resurrected tombstone.
--
--  Two rows whose names fold to the same string, or one of which is a prefix
--  of the other, are the shape a soft-delete-then-recreate leaves behind, and
--  the shape "Moștenitor / succesor" vs "Moștenitor / Succesor" already has
--  in the seed. Anything here is a candidate for MERGE (move the dependents
--  onto the survivor, then delete), not for deletion on its own.
--
--  Empty result does not mean the lists are clean — it means no two values
--  are near-identical. §2 is still the pass that has to be read.
-- ===========================================================================
\echo ''
\echo '=== 3a. Values that fold to the SAME string within one list ==='
\echo '    (identical to the eye of the fold — a merge, not a delete)'
SELECT
  list                                                              AS "Listă",
  pg_temp.ga40_fold(value)                                          AS folded,
  count(*)                                                          AS row_count,
  string_agg(value || ' (' || used_by || ')', ' | ' ORDER BY value) AS "Ortografii (în uz)"
FROM pg_temp.ga40_closed_lists
GROUP BY list, ord, 2
HAVING count(*) > 1
ORDER BY ord, row_count DESC, folded;

\echo ''
\echo '=== 3b. Values where one name starts with another, within one list ==='
\echo '    (e.g. "Moștenitor" / "Moștenitor / succesor" - a family to look at together)'
SELECT
  a.list                                        AS "Listă",
  a.value                                       AS "Valoare mai scurtă",
  a.used_by                                     AS "În uz",
  b.value                                       AS "Valoare mai lungă",
  b.used_by                                     AS "În uz "
FROM pg_temp.ga40_closed_lists a
JOIN pg_temp.ga40_closed_lists b
  ON  b.list = a.list
  AND pg_temp.ga40_fold(b.value) <> pg_temp.ga40_fold(a.value)
  AND pg_temp.ga40_fold(b.value) LIKE pg_temp.ga40_fold(a.value) || '%'
ORDER BY a.ord, a.value, b.value;


-- ===========================================================================
--  §4  „Tipuri de Persoană Fizică" — the list the handover names by name.
--
--  The column it fills is `natural_person.physical_person_type_id`, so every
--  value here is meant to answer "what KIND of natural person is this".
--  Four of the seven seeded values do not:
--
--    Persoană Juridică  — a company is not a kind of natural person; judicial
--                         persons have their own table AND their own list
--                         („Tipuri de Persoană Juridică", §1 row 5).
--    Instituție         — an authority, not a person. Institutions have their
--                         own table (`lookup_institution`) since migration_052.
--    ONG                — likewise an organisation; it is also already a value
--                         in „Tipuri de Persoană Juridică".
--    Consiliu Local     — a public body, not a person.
--
--  The other three are defensible: „Persoană Fizică" is the ordinary case,
--  „PFA" is a natural person trading as a sole proprietor (it is ALSO a
--  judicial-person type, which is worth a sentence from Ciprian rather than
--  an assumption), and „Expert" is a natural person in a role.
--
--  This block is the evidence for that conversation, not the conclusion:
--  a value carrying real people cannot simply go, whatever it says.
-- ===========================================================================
\echo ''
\echo '=== 4. Tipuri de Persoană Fizică, with the four that are not person types flagged ==='
SELECT
  t.name                                                     AS "Valoare",
  (SELECT count(*) FROM natural_person n
    WHERE n.physical_person_type_id = t.id)                  AS "Persoane fizice",
  CASE WHEN pg_temp.ga40_fold(t.name) IN
            ('persoana juridica', 'institutie', 'ong', 'consiliu local')
       THEN 'NOT a natural-person type - review'
       WHEN pg_temp.ga40_fold(t.name) = 'pfa'
       THEN 'also a judicial-person type - confirm which list owns it'
       ELSE ''
  END                                                        AS "Observație"
FROM lookup_person_type t
ORDER BY t.sort_order, t.name;

\echo ''
\echo '=== done. Nothing above wrote anything. ==='
