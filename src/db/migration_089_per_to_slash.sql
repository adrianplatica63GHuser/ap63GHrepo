-- migration_089_per_to_slash.sql
-- Slice #37.39 - every „per" that stands for a slash becomes „/" once a value
-- is inside the system.
--
-- WHAT THIS DOES
--   Corrects, IN PLACE, the values an import took from a folder or file name
--   and stored with the folder's „per" where the system means „/":
--     property.nickname          - the folder's name (process route, import step)
--     property.parcela           - decoded since #26.07 under the NARROWER rule
--                                  (digits only), so a „T47 per P2" may remain
--     lookup_tarla.indicativ     - the same, for the tarla code
--     document.title             - titleForEntry(entry), a file's own name
--     document.import_title      - the same value, kept for the Pre-existing key
--     entity_tag.tag             - tagsForEntry, the folders' names
--   with the rule of perToSlash in src/lib/import/folder-utils.ts, widened by
--   this slice (Adrian, 2026-10-01: „cover all per instances"):
--     a „per" (any case) with something on both sides becomes „/", and the
--     spaces around it go - unless it is part of a word, which it is when a
--     letter touches it on one side and the other side is not a digit.
--
--   NO NEW VERSION, NO BACKUP TABLE (Adrian, 2026-10-01). The value is the same
--   fact, written the way the system should always have written it. Version
--   snapshots keep what they recorded. updated_at and updated_by are not
--   touched: nobody edited these records.
--
--   NOT TOUCHED: the files and folders on disk, and the names and paths the
--   import stores to find a file again (document_page.file_name, file_path).
--
-- WHAT IS LEFT ALONE, AND PRINTED
--   - A tarla code whose decoded form folds equal to another code's (the
--     unique index of migration_083), or to another decoded code's.
--   - A Property whose cadastral key - fold(tarla)+fold(parcela), every space
--     removed, as cadastralKey computes it - is, under the wider rule, the key
--     of another Property: its parcela, and its tarla code, are left as they
--     are, so two parcels the archive keeps apart are not written as one.
--   - A tag whose decoded form the same record already carries (the unique
--     index entity_tag (principal_object_id, lower(tag))).
--   Each is RAISEd as a NOTICE, so the apply's own output is the list.
--
-- THE DRY RUN (#37.39's handover): 31 distinct values on the local archive -
-- 2 nicknames, 15 titles, 14 tags - every one a digit „per" digit fraction, no
-- word broken, no tarla code or parcela, no collision.
--
-- ⚠️ pg_temp.ga40_per_to_slash IS perToSlash'S TWIN, and §1 below refuses to
-- run if it disagrees with the TypeScript tests' examples. Change the two
-- together.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The rule, and its self-test
-- ---------------------------------------------------------------------------
--
-- A walk over the string, the same as String.replace with
-- /(\s*)per(\s*)/giu: each „per" from the scan position on, with the spaces
-- before it (back to where the last match ended) and after it, is either kept
-- as it was or replaced by „/". regexp_instr rather than strpos(lower(...)),
-- because lower() can change a string's length and with it every position.

CREATE OR REPLACE FUNCTION pg_temp.ga40_per_to_slash(s text) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $fn$
DECLARE
  res     text := '';
  pos     int  := 1;
  len     int;
  p       int;
  m_start int;
  m_end   int;     -- exclusive
  lhs     text;
  rhs     text;
  l       text;
  r       text;
BEGIN
  IF s IS NULL THEN RETURN NULL; END IF;
  len := length(s);
  LOOP
    p := regexp_instr(s, 'per', pos, 1, 0, 'i');
    EXIT WHEN p = 0;
    m_start := p;
    WHILE m_start > pos AND substr(s, m_start - 1, 1) ~ '^\s$' LOOP
      m_start := m_start - 1;
    END LOOP;
    m_end := p + 3;
    WHILE m_end <= len AND substr(s, m_end, 1) ~ '^\s$' LOOP
      m_end := m_end + 1;
    END LOOP;
    lhs := substr(s, 1, m_start - 1);
    rhs := substr(s, m_end);
    l := CASE WHEN m_start = p     THEN right(lhs, 1) ELSE '' END;
    r := CASE WHEN m_end   = p + 3 THEN left(rhs, 1)  ELSE '' END;
    res := res || substr(s, pos, m_start - pos);
    IF lhs !~ '\S' OR rhs !~ '\S'
       OR (l ~ '^[[:alpha:]]$' AND r !~ '^[0-9]$')
       OR (r ~ '^[[:alpha:]]$' AND l !~ '^[0-9]$') THEN
      res := res || substr(s, m_start, m_end - m_start);
    ELSE
      res := res || '/';
    END IF;
    pos := m_end;
  END LOOP;
  RETURN res || substr(s, pos);
END
$fn$;

-- foldRomanian (src/lib/import/id-card.ts) - migration_083's index expression.
CREATE OR REPLACE FUNCTION pg_temp.ga40_fold(s text) RETURNS text
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT btrim(regexp_replace(regexp_replace(lower(normalize(coalesce(s, ''), NFD)),
           '[' || chr(768) || '-' || chr(879) || ']', '', 'g'), '\s+', ' ', 'g'))
$fn$;

-- cadastralKey (src/lib/properties/cadastral-identity.ts): fold(perToSlash), no spaces.
CREATE OR REPLACE FUNCTION pg_temp.ga40_cadastral_key(s text) RETURNS text
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT regexp_replace(pg_temp.ga40_fold(pg_temp.ga40_per_to_slash(coalesce(s, ''))), '\s+', '', 'g')
$fn$;

DO $$
DECLARE
  c record;
  got text;
  bad int := 0;
BEGIN
  FOR c IN SELECT * FROM (VALUES
    ('47per2', '47/2'), ('47 per 2', '47/2'), ('225per3per24', '225/3/24'),
    ('T47 per P2', 'T47/P2'), ('T47perP2', 'T47/P2'),
    ('Tarla 47 per Parcela 2', 'Tarla 47/Parcela 2'), ('Tarla 47per2', 'Tarla 47/2'),
    ('t47 PER p2', 't47/p2'), ('47PER2', '47/2'), ('47Per2', '47/2'),
    ('212per40IE55821', '212/40IE55821'), ('47per 2', '47/2'),
    ('superficie', 'superficie'), ('superficie teren', 'superficie teren'),
    ('Supermarket', 'Supermarket'), ('Super 2', 'Super 2'), ('Perdea', 'Perdea'),
    ('Perimetru', 'Perimetru'), ('Persoane fizice', 'Persoane fizice'),
    ('per2', 'per2'), ('47per', '47per'), ('40-Perdea', '40-Perdea'),
    ('12-superficie teren', '12-superficie teren'), ('Acte persoane', 'Acte persoane'),
    ('', ''), ('47', '47'), ('47/2', '47/2')
  ) AS t(raw, want) LOOP
    got := pg_temp.ga40_per_to_slash(c.raw);
    IF got IS DISTINCT FROM c.want THEN
      RAISE WARNING 'migration_089: per_to_slash(%) = %, expected %', quote_literal(c.raw), quote_literal(got), quote_literal(c.want);
      bad := bad + 1;
    END IF;
  END LOOP;
  IF bad > 0 THEN
    RAISE EXCEPTION 'migration_089: the Postgres rule disagrees with perToSlash on % example(s); nothing was changed', bad;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. The Properties whose cadastral key the wider rule makes shared
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE m089_shared_key ON COMMIT DROP AS
  SELECT p.id
  FROM property p
  LEFT JOIN lookup_tarla t ON t.id = p.tarla_id
  WHERE p.parcela IS NOT NULL AND btrim(p.parcela) <> '' AND t.id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM property q JOIN lookup_tarla u ON u.id = q.tarla_id
      WHERE q.id <> p.id AND q.parcela IS NOT NULL
        AND pg_temp.ga40_cadastral_key(u.indicativ) = pg_temp.ga40_cadastral_key(t.indicativ)
        AND pg_temp.ga40_cadastral_key(q.parcela)   = pg_temp.ga40_cadastral_key(p.parcela)
    );

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.code, t.indicativ, p.parcela FROM property p
    JOIN lookup_tarla t ON t.id = p.tarla_id
    WHERE p.id IN (SELECT id FROM m089_shared_key) ORDER BY p.code
  LOOP
    RAISE NOTICE 'migration_089: LEFT AS IT IS - % (tarla %, parcela %) shares its cadastral key with another Property under the wider rule',
      r.code, quote_literal(r.indicativ), quote_literal(r.parcela);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. lookup_tarla.indicativ
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE m089_tarla ON COMMIT DROP AS
  SELECT id, indicativ AS before, btrim(pg_temp.ga40_per_to_slash(indicativ)) AS after
  FROM lookup_tarla
  WHERE btrim(pg_temp.ga40_per_to_slash(indicativ)) <> indicativ;

-- Held back: folds equal to another row's code, or to another decoded code,
-- or is the tarla of a Property §2 keeps as it is.
CREATE TEMP TABLE m089_tarla_held ON COMMIT DROP AS
  SELECT m.id FROM m089_tarla m
  WHERE pg_temp.ga40_fold(m.after) <> ''
    AND (
      EXISTS (SELECT 1 FROM lookup_tarla o
              WHERE o.id <> m.id
                AND pg_temp.ga40_fold(coalesce((SELECT after FROM m089_tarla x WHERE x.id = o.id), o.indicativ))
                    = pg_temp.ga40_fold(m.after))
      OR EXISTS (SELECT 1 FROM property p
                 WHERE p.tarla_id = m.id AND p.id IN (SELECT id FROM m089_shared_key))
    );

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT m.before, m.after, (m.id IN (SELECT id FROM m089_tarla_held)) AS held
           FROM m089_tarla m ORDER BY m.before LOOP
    IF r.held THEN
      RAISE NOTICE 'migration_089: LEFT AS IT IS - tarla % would read % and collide', quote_literal(r.before), quote_literal(r.after);
    ELSE
      RAISE NOTICE 'migration_089: tarla % -> %', quote_literal(r.before), quote_literal(r.after);
    END IF;
  END LOOP;
END $$;

UPDATE lookup_tarla t SET indicativ = m.after
FROM m089_tarla m
WHERE t.id = m.id AND m.id NOT IN (SELECT id FROM m089_tarla_held);

-- ---------------------------------------------------------------------------
-- 4. property.parcela and property.nickname
-- ---------------------------------------------------------------------------

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT parcela AS before, btrim(pg_temp.ga40_per_to_slash(parcela)) AS after
           FROM property
           WHERE parcela IS NOT NULL AND btrim(pg_temp.ga40_per_to_slash(parcela)) <> parcela
             AND id NOT IN (SELECT id FROM m089_shared_key)
           ORDER BY 1 LOOP
    RAISE NOTICE 'migration_089: parcela % -> %', quote_literal(r.before), quote_literal(r.after);
  END LOOP;
  FOR r IN SELECT DISTINCT nickname AS before, btrim(pg_temp.ga40_per_to_slash(nickname)) AS after
           FROM property
           WHERE nickname IS NOT NULL AND btrim(pg_temp.ga40_per_to_slash(nickname)) <> nickname
           ORDER BY 1 LOOP
    RAISE NOTICE 'migration_089: nickname % -> %', quote_literal(r.before), quote_literal(r.after);
  END LOOP;
END $$;

UPDATE property SET parcela = btrim(pg_temp.ga40_per_to_slash(parcela))
WHERE parcela IS NOT NULL AND btrim(pg_temp.ga40_per_to_slash(parcela)) <> parcela
  AND id NOT IN (SELECT id FROM m089_shared_key);

UPDATE property SET nickname = btrim(pg_temp.ga40_per_to_slash(nickname))
WHERE nickname IS NOT NULL AND btrim(pg_temp.ga40_per_to_slash(nickname)) <> nickname;

-- ---------------------------------------------------------------------------
-- 5. document.title and document.import_title
-- ---------------------------------------------------------------------------

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT v AS before, btrim(pg_temp.ga40_per_to_slash(v)) AS after
           FROM (SELECT title AS v FROM document UNION SELECT import_title FROM document) d
           WHERE v IS NOT NULL AND btrim(pg_temp.ga40_per_to_slash(v)) <> v
           ORDER BY 1 LOOP
    RAISE NOTICE 'migration_089: title % -> %', quote_literal(r.before), quote_literal(r.after);
  END LOOP;
END $$;

UPDATE document SET title = btrim(pg_temp.ga40_per_to_slash(title))
WHERE title IS NOT NULL AND btrim(pg_temp.ga40_per_to_slash(title)) <> title;

UPDATE document SET import_title = btrim(pg_temp.ga40_per_to_slash(import_title))
WHERE import_title IS NOT NULL AND btrim(pg_temp.ga40_per_to_slash(import_title)) <> import_title;

-- ---------------------------------------------------------------------------
-- 6. entity_tag.tag
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE m089_tag ON COMMIT DROP AS
  SELECT id, principal_object_id, tag AS before, btrim(pg_temp.ga40_per_to_slash(tag)) AS after
  FROM entity_tag
  WHERE btrim(pg_temp.ga40_per_to_slash(tag)) <> tag;

-- Held back: the record already carries the decoded tag, or two of its tags
-- decode to one. The first of such a pair (by id) is converted when nothing
-- else holds the slot; the others stay.
CREATE TEMP TABLE m089_tag_held ON COMMIT DROP AS
  SELECT m.id FROM m089_tag m
  WHERE EXISTS (SELECT 1 FROM entity_tag e
                WHERE e.principal_object_id = m.principal_object_id
                  AND e.id NOT IN (SELECT id FROM m089_tag)
                  AND lower(e.tag) = lower(m.after))
     OR EXISTS (SELECT 1 FROM m089_tag o
                WHERE o.principal_object_id = m.principal_object_id
                  AND o.id < m.id AND lower(o.after) = lower(m.after));

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT before, after FROM m089_tag
           WHERE id NOT IN (SELECT id FROM m089_tag_held) ORDER BY 1 LOOP
    RAISE NOTICE 'migration_089: tag % -> %', quote_literal(r.before), quote_literal(r.after);
  END LOOP;
  FOR r IN SELECT m.before, m.after, po.code FROM m089_tag m
           JOIN principal_object po ON po.id = m.principal_object_id
           WHERE m.id IN (SELECT id FROM m089_tag_held) ORDER BY po.code, m.before LOOP
    RAISE NOTICE 'migration_089: LEFT AS IT IS - tag % on % (it already carries %)', quote_literal(r.before), r.code, quote_literal(r.after);
  END LOOP;
END $$;

UPDATE entity_tag e SET tag = m.after
FROM m089_tag m
WHERE e.id = m.id AND m.id NOT IN (SELECT id FROM m089_tag_held);

COMMIT;
