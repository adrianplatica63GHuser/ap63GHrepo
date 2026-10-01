-- migration_090_per_tag_twins.sql
-- Slice #37.39, FU-278 - the „per" twin of a tag its record already carries
-- decoded is deleted.
--
-- WHAT THIS DOES
--   Deletes every entity_tag row whose tag still reads „per" where the same
--   principal object already carries the decoded form (lower-cased, as
--   entity_tag's unique index compares). migration_089 held these back rather
--   than break that index: 75 rows on the local archive, one per document,
--   on documents from the first import of `40-212per40IE…`, `46-222per13…` and
--   `47per2-225per3…`, which were tagged with both spellings. Each now shows
--   its folder's tag twice.
--
--   LOSSLESS: the record keeps the decoded tag, which is the same fact. A tag
--   with no decoded twin is not touched, and no other table is.
--
--   Adrian, 2026-10-01, to „do you want the 75 duplicate per tags deleted?":
--   „Yes!" - the go-ahead a delete needs.
--
--   Every deleted row is RAISEd as a NOTICE (record code, tag), so the apply's
--   own output is the list.
--
-- ⚠️ pg_temp.ga40_per_to_slash is migration_089's copy of perToSlash
-- (src/lib/import/folder-utils.ts), checked against the same examples before
-- anything is deleted.

BEGIN;

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
      RAISE WARNING 'migration_090: per_to_slash(%) = %, expected %', quote_literal(c.raw), quote_literal(got), quote_literal(c.want);
      bad := bad + 1;
    END IF;
  END LOOP;
  IF bad > 0 THEN
    RAISE EXCEPTION 'migration_090: the Postgres rule disagrees with perToSlash on % example(s); nothing was changed', bad;
  END IF;
END $$;

CREATE TEMP TABLE m090_twin ON COMMIT DROP AS
  SELECT e.id, e.tag, po.code
  FROM entity_tag e
  JOIN principal_object po ON po.id = e.principal_object_id
  WHERE btrim(pg_temp.ga40_per_to_slash(e.tag)) <> e.tag
    AND EXISTS (
      SELECT 1 FROM entity_tag d
      WHERE d.principal_object_id = e.principal_object_id
        AND d.id <> e.id
        AND lower(d.tag) = lower(btrim(pg_temp.ga40_per_to_slash(e.tag)))
    );

DO $$
DECLARE
  r record;
  n integer;
BEGIN
  SELECT count(*) INTO n FROM m090_twin;
  RAISE NOTICE 'migration_090: % tag row(s) whose record already carries the decoded tag - deleting', n;
  FOR r IN SELECT code, tag FROM m090_twin ORDER BY code, tag LOOP
    RAISE NOTICE 'migration_090:   % - %', r.code, quote_literal(r.tag);
  END LOOP;
END $$;

DELETE FROM entity_tag WHERE id IN (SELECT id FROM m090_twin);

COMMIT;
