-- migration_114_person_professions_and_relationship.sql
-- Slice #39.70 - natural persons: „Tip profesional" lists professions, and „Relația cu firma" says why a person is
-- in the archive.
--
-- WHY
--   Adrian: „for the natural person we can maybe filter by professional type but right now we have very few values
--   so please bring your contribution ... come with some common sense List of values; Maybe it will useful to have
--   one more category or type for natural person beside the professional type". lookup_person_type (migration_036)
--   mixes professions with kinds of organisation that are not natural persons at all (FU-057).
--
-- WHAT THIS DOES
--   1. The organisation kinds leave lookup_person_type: Persoană Juridică, Instituție, ONG, Consiliu Local and PFA
--      (PFA is already a juridical person type). A person typed with one of them keeps everything else and loses the
--      type; each is RAISEd as a NOTICE (code, name, the type it had) for the handover — never converted
--      automatically: some may need to be recreated as juridical persons.
--   2. Two renames, keeping every person on the row: Expert → „Expert tehnic / judiciar"; Persoană Fizică →
--      „Persoană privată". Each only when the new name is not there already (then the old row's persons move to it).
--   3. The professions, added when missing (compared folded), in this order: Notar, Avocat, Executor judecătoresc,
--      Topograf / expert cadastral, Evaluator, Expert tehnic / judiciar, Agent imobiliar, Arhitect / proiectant,
--      Constructor / meșter, Funcționar public, Contabil / consultant fiscal, Fermier / arendaș, Persoană privată.
--      A value someone added by hand that is not one of them stays, after them.
--   4. lookup_person_relationship (new), „Relația cu firma": Client, Vânzător de teren, Cumpărător, Moștenitor /
--      familie, Colaborator, Vecin, Contact instituțional.
--   5. natural_person_relationship (new): which relationships a natural person holds - several per person, one row
--      each; deleted with the person or the value.
--
-- src/db/sync-reference-data.sql writes the same end state for a rebuilt database (verify-rebuild); the repair file
-- creates the two tables.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.ga40_fold(x text) RETURNS text LANGUAGE sql IMMUTABLE AS $f$
  SELECT btrim(regexp_replace(
           regexp_replace(lower(normalize(coalesce(x, ''), NFD)), '[' || chr(768) || '-' || chr(879) || ']', '', 'g'),
           '\s+', ' ', 'g'))
$f$;

-- 1 ── the organisation kinds leave the list ───────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  r       record;
  cleared int := 0;
BEGIN
  FOR r IN
    SELECT p.code, coalesce(np.first_name || ' ', '') || coalesce(np.last_name, '') AS name, t.name AS type_name
      FROM natural_person np
      JOIN person p ON p.id = np.person_id
      JOIN lookup_person_type t ON t.id = np.physical_person_type_id
     WHERE pg_temp.ga40_fold(t.name) IN ('persoana juridica', 'institutie', 'ong', 'consiliu local', 'pfa')
     ORDER BY p.code
  LOOP
    cleared := cleared + 1;
    RAISE NOTICE 'migration_114 cleared: % (%) was typed %', r.code, btrim(r.name), r.type_name;
  END LOOP;
  UPDATE natural_person SET physical_person_type_id = NULL
   WHERE physical_person_type_id IN (
     SELECT id FROM lookup_person_type
      WHERE pg_temp.ga40_fold(name) IN ('persoana juridica', 'institutie', 'ong', 'consiliu local', 'pfa'));
  DELETE FROM lookup_person_type
   WHERE pg_temp.ga40_fold(name) IN ('persoana juridica', 'institutie', 'ong', 'consiliu local', 'pfa');
  RAISE NOTICE 'migration_114: % person(s) lost an organisation type', cleared;
END $$;

-- 2 ── two renames ───────────────────────────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  pair     text[];
  old_id   uuid;
  new_id   uuid;
BEGIN
  FOREACH pair SLICE 1 IN ARRAY ARRAY[['expert', 'Expert tehnic / judiciar'], ['persoana fizica', 'Persoană privată']] LOOP
    SELECT id INTO old_id FROM lookup_person_type WHERE pg_temp.ga40_fold(name) = pair[1] ORDER BY sort_order, id LIMIT 1;
    CONTINUE WHEN old_id IS NULL;
    SELECT id INTO new_id FROM lookup_person_type WHERE pg_temp.ga40_fold(name) = pg_temp.ga40_fold(pair[2]) LIMIT 1;
    IF new_id IS NULL THEN
      UPDATE lookup_person_type SET name = pair[2], updated_at = now() WHERE id = old_id;
    ELSE
      UPDATE natural_person SET physical_person_type_id = new_id WHERE physical_person_type_id = old_id;
      DELETE FROM lookup_person_type WHERE id = old_id;
    END IF;
  END LOOP;
END $$;

-- 3 ── the professions ───────────────────────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  names text[] := ARRAY['Notar', 'Avocat', 'Executor judecătoresc', 'Topograf / expert cadastral', 'Evaluator',
                        'Expert tehnic / judiciar', 'Agent imobiliar', 'Arhitect / proiectant', 'Constructor / meșter',
                        'Funcționar public', 'Contabil / consultant fiscal', 'Fermier / arendaș', 'Persoană privată'];
  i int;
BEGIN
  FOR i IN 1 .. array_length(names, 1) LOOP
    IF EXISTS (SELECT 1 FROM lookup_person_type WHERE pg_temp.ga40_fold(name) = pg_temp.ga40_fold(names[i])) THEN
      UPDATE lookup_person_type SET sort_order = i * 10, updated_at = now()
       WHERE pg_temp.ga40_fold(name) = pg_temp.ga40_fold(names[i]);
    ELSE
      INSERT INTO lookup_person_type (name, sort_order) VALUES (names[i], i * 10);
    END IF;
  END LOOP;
  -- A value added by hand that is not a profession above goes after them, in its own order.
  UPDATE lookup_person_type SET sort_order = 1000 + sort_order, updated_at = now()
   WHERE pg_temp.ga40_fold(name) <> ALL (SELECT pg_temp.ga40_fold(n) FROM unnest(names) AS n)
     AND sort_order < 1000;
END $$;

-- 4 ── „Relația cu firma" ────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lookup_person_relationship (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  sort_order integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE lookup_person_relationship IS
  'Slice #39.70: „Relația cu firma" - why a natural person is in the archive. A person may hold several.';
INSERT INTO lookup_person_relationship (name, sort_order)
SELECT v.name, v.ord
  FROM (VALUES ('Client', 10), ('Vânzător de teren', 20), ('Cumpărător', 30), ('Moștenitor / familie', 40),
               ('Colaborator', 50), ('Vecin', 60), ('Contact instituțional', 70)) AS v(name, ord)
 WHERE NOT EXISTS (SELECT 1 FROM lookup_person_relationship r WHERE pg_temp.ga40_fold(r.name) = pg_temp.ga40_fold(v.name));

-- 5 ── which relationships a person holds ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS natural_person_relationship (
  natural_person_id uuid        NOT NULL REFERENCES natural_person(person_id) ON DELETE CASCADE,
  relationship_id   uuid        NOT NULL REFERENCES lookup_person_relationship(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (natural_person_id, relationship_id)
);
CREATE INDEX IF NOT EXISTS natural_person_relationship_relationship_idx ON natural_person_relationship (relationship_id);
COMMENT ON TABLE natural_person_relationship IS
  'Slice #39.70: the relationships („Relația cu firma") a natural person holds - several per person.';

COMMIT;
