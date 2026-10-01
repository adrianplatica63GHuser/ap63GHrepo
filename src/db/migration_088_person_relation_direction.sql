-- migration_088_person_relation_direction.sql
-- Slice #37.28 - a relationship between two people reads the right way from
-- both ends, and the roles for it are in the chain (FU-221).
--
-- WHAT THIS DOES
--   1. `person_person.role_reads_a_to_b boolean NOT NULL DEFAULT true`, the
--      same column, type and default `document_document` (migration_086) and
--      `property_property` (migration_087) have. TRUE means person_id_a HOLDS
--      the role towards person_id_b - „A <rol> B", e.g. A „Fiu" of B.
--      Existing rows are counted first and each one that carries a role is
--      PRINTED with the way it reads after this file, because every one of
--      them takes the default unverified.
--   2. Three nullable text columns on `lookup_person_role` holding each role's
--      CONVERSE - what the other end of the relationship is called:
--        converse_name         - used when the person shown has no gender set
--                                 (a company, or a person whose gender is
--                                 empty), and whenever the two below are NULL;
--        converse_name_male    - used when the person shown is MALE;
--        converse_name_female  - used when the person shown is FEMALE.
--      A role that reads the same from both ends names ITSELF as its converse
--      („Coproprietar"). A role with no converse at all is not guessed at: the
--      screen then says which of the two holds it, in a sentence.
--   3. Adrian's roles for people (#37.27, 2026-09-30): „Reprezentant legal /
--      Mandatar", „Moștenitor" and „Coproprietar" ticked valid_for_person, and
--      Soț, Soție, Părinte, Fiu, Fiică, Frate, Soră added and ticked - then the
--      converse of all ten. #37.27 put them in the local database only, through
--      the admin API; this file puts them where a rebuilt or cloud database
--      gets them, and src/db/sync-reference-data.sql carries the same rows so
--      scripts/verify-rebuild.ts compares equal.
--   No existing row's role is changed. No index is dropped. No table is created.
--
-- ---------------------------------------------------------------------------
-- WHY THE DIRECTION
-- ---------------------------------------------------------------------------
--
-- `person_person` is (person_id_a, person_id_b, relationship_role_id) with a
-- unique index on (a, b) and a CHECK that person_id_a < person_id_b. **THAT
-- ORDERING IS BY UUID** - a canonicalisation trick so one pair cannot be stored
-- twice, produced by a literal `[personId, otherId].sort()` in
-- `associatePersonsToPerson`. It means nothing, so until this file a role
-- chosen on one person's screen showed the same word on both people's
-- „Persoane" tiles: Ion recorded as „Fiu" of Maria read „Ion - Fiu" on Maria's
-- tile, which is right, and „Maria - Fiu" on Ion's, which is not.
--
-- The reasoning migration_086 gives for a boolean rather than a from/to
-- reshape applies word for word: the tidy schema needs every existing row's
-- direction, and for an existing row that is not knowable from the database.
--
-- ⚠️ THE UNIQUE INDEX AND THE CHECK ARE LEFT EXACTLY AS THEY ARE. One pair
-- still stores one row; the flag is about how that row READS.
--
-- ⚠️ `true`, NOT NULL, because every reader must get a direction without a
-- branch. Rows written from Slice #37.28 on set it deliberately
-- (src/lib/persons/queries.ts, associatePersonsToPerson): the „Asociază"
-- screen asks for the role of the person TICKED, so the ticked person holds it.
--
-- ---------------------------------------------------------------------------
-- WHY THE CONVERSE IS DATA
-- ---------------------------------------------------------------------------
--
-- The roles are Adrian's and are edited on Date de referință → Roluri
-- Persoană. A converse written in code would be a list of names the next
-- rename silently falls off; three columns on the role are edited on the same
-- screen as the name. Gendered, because Romanian kinship is: the other end of
-- „Părinte" is „Fiu" or „Fiică" depending on who it is, and of „Frate" it is
-- „Frate" or „Soră". With no gender to go on, the neutral wording is shown
-- („Copil", „Frate / Soră") - Slice #37.28's decision under „Ask first".
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, INSERT ... WHERE NOT EXISTS by name,
-- UPDATEs that set a value, and the count is a NOTICE.

BEGIN;

-- ── 1. person_person.role_reads_a_to_b ───────────────────────────────────────

DO $$
DECLARE
  n_total integer;
  n_roled integer;
  r record;
BEGIN
  SELECT count(*) INTO n_total FROM person_person;
  SELECT count(*) INTO n_roled FROM person_person WHERE relationship_role_id IS NOT NULL;
  RAISE NOTICE 'migration_088: % existing person_person row(s), % of them carrying a role. Every one takes role_reads_a_to_b = true UNVERIFIED - the pair order is by uuid and means nothing. A row without a role reads the same both ways and needs no look. Each row with a role reads, after this file, as follows:',
    n_total, n_roled;
  FOR r IN
    SELECT pa.code AS code_a, pa.display_name AS name_a,
           pb.code AS code_b, pb.display_name AS name_b,
           lpr.name AS role
      FROM person_person pp
      JOIN person pa ON pa.id = pp.person_id_a
      JOIN person pb ON pb.id = pp.person_id_b
      JOIN lookup_person_role lpr ON lpr.id = pp.relationship_role_id
     ORDER BY pa.code, pb.code
  LOOP
    RAISE NOTICE 'migration_088:   % (%) „%” of % (%)', r.code_a, r.name_a, r.role, r.code_b, r.name_b;
  END LOOP;
END $$;

ALTER TABLE person_person
  ADD COLUMN IF NOT EXISTS role_reads_a_to_b boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN person_person.role_reads_a_to_b IS
  'Which way relationship_role_id reads. TRUE (the default) means person_id_a holds the role towards person_id_b - "A <role> B", e.g. A is "Fiu" of B. FALSE means B holds it towards A. The pair order is canonicalised by UUID (CHECK person_person_order) only so one pair cannot be stored twice, and carries no meaning. Rows written from Slice #37.28 on set it from the association screen, where the role is the ticked person''s; rows that predate it took the default, and migration_088 printed them. Same column and reasoning as document_document (migration_086) and property_property (migration_087). The other end''s wording is lookup_person_role.converse_name*.';

-- ── 2. lookup_person_role.converse_name* ─────────────────────────────────────

ALTER TABLE lookup_person_role ADD COLUMN IF NOT EXISTS converse_name        text;
ALTER TABLE lookup_person_role ADD COLUMN IF NOT EXISTS converse_name_male   text;
ALTER TABLE lookup_person_role ADD COLUMN IF NOT EXISTS converse_name_female text;

COMMENT ON COLUMN lookup_person_role.converse_name IS
  'What the OTHER end of this role is called when a person-to-person relationship is read from the holder''s side (Slice #37.28). Used when the person shown has no gender (a company, or gender not set) and whenever converse_name_male / converse_name_female is NULL. A role that reads the same both ways names itself ("Coproprietar"). NULL: no converse - the screen says in a sentence that the person viewed holds the role.';
COMMENT ON COLUMN lookup_person_role.converse_name_male IS
  'The converse when the person shown is MALE ("Fiu" for "Părinte"). NULL falls back to converse_name.';
COMMENT ON COLUMN lookup_person_role.converse_name_female IS
  'The converse when the person shown is FEMALE ("Fiică" for "Părinte"). NULL falls back to converse_name.';

-- ── 3. Adrian's roles for people (#37.27) ────────────────────────────────────
--
-- The seven new ones take sort_orders 57-63, after migration_013's 56, and the
-- same values are in src/db/sync-reference-data.sql: verify-rebuild.ts compares
-- reference rows as WHOLE TUPLES. Inserted only when the name is absent - the
-- local database already has them from #37.27, with its own descriptions,
-- which this file leaves alone.

INSERT INTO lookup_person_role (name, description, sort_order, valid_for_person)
SELECT v.name, v.description, v.sort_order, true
  FROM (VALUES
    ('Soț',     '(masculin)',       57),
    ('Soție',   '(feminin)',        58),
    ('Părinte', '(tată sau mamă)',  59),
    ('Fiu',     '(masculin)',       60),
    ('Fiică',   '(feminin)',        61),
    ('Frate',   '(masculin)',       62),
    ('Soră',    '(feminin)',        63)
  ) AS v(name, description, sort_order)
 WHERE NOT EXISTS (SELECT 1 FROM lookup_person_role r WHERE r.name = v.name);

UPDATE lookup_person_role
   SET valid_for_person = true
 WHERE name IN ('Reprezentant legal / Mandatar', 'Moștenitor', 'Coproprietar',
                'Soț', 'Soție', 'Părinte', 'Fiu', 'Fiică', 'Frate', 'Soră');

UPDATE lookup_person_role r
   SET converse_name        = c.neutral,
       converse_name_male   = c.male,
       converse_name_female = c.female
  FROM (VALUES
    -- Reads the same from both ends.
    ('Coproprietar',                  'Coproprietar',          NULL,    NULL),
    -- One end holds it, the other is its converse.
    ('Reprezentant legal / Mandatar', 'Reprezentat / Mandant', NULL,    'Reprezentată / Mandantă'),
    ('Moștenitor',                    'Autorul moștenirii',    NULL,    NULL),
    -- Kinship: the converse follows the gender of the person shown.
    ('Soț',                           'Soț / Soție',           'Soț',   'Soție'),
    ('Soție',                         'Soț / Soție',           'Soț',   'Soție'),
    ('Părinte',                       'Copil',                 'Fiu',   'Fiică'),
    ('Fiu',                           'Părinte',               NULL,    NULL),
    ('Fiică',                         'Părinte',               NULL,    NULL),
    ('Frate',                         'Frate / Soră',          'Frate', 'Soră'),
    ('Soră',                          'Frate / Soră',          'Frate', 'Soră')
  ) AS c(name, neutral, male, female)
 WHERE r.name = c.name;

COMMIT;

-- Check after running:
--
--   SELECT column_name, data_type, is_nullable, column_default
--   FROM   information_schema.columns
--   WHERE  (table_name = 'person_person' AND column_name = 'role_reads_a_to_b')
--      OR  (table_name = 'lookup_person_role' AND column_name LIKE 'converse_name%');
--
--   SELECT name, valid_for_person, converse_name, converse_name_male, converse_name_female
--   FROM   lookup_person_role WHERE valid_for_person ORDER BY name;
