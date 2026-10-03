-- migration_091_doc_type_role_holds_share.sql
-- Slice #37.59 - whether a role holds a share in the property, set per
-- document type, beside the tick that offers the role for that type.
--
-- WHAT THIS DOES
--   Adds lookup_doc_type_person_role.holds_share (boolean NOT NULL DEFAULT
--   false) and ticks it for the roles that own or transfer ownership: Vânzător,
--   Cumpărător, Proprietar and its variants, Coproprietar and its variants,
--   Moștenitor and its variants, Succesor universal, Adjudecatar, Titular /
--   Proprietar, Titular al imobilului, Titular de drept. Every other pair -
--   Notar, Proiectant / Consultant, Topograf / Expert cadastral, Reprezentant
--   legal, Solicitant, … - stays false.
--
--   A Document's „Persoane" then draws „Cotă-parte", „Suprafață echivalentă
--   (mp)" and „Mod de deținere" only for a link whose role holds a share on
--   that document's type (or has no role, or already stores a value), and
--   the write routes refuse a share for a role that holds none.
--
-- WHY ON THE PAIR AND NOT ON THE ROLE
--   The same reason migration_079 kept this table a grid: „Vânzător" is a
--   party to a sale and not to a cadastral plan, and the tick that says a role
--   holds a share belongs where the role is offered for a type - the screen
--   Adrian already uses („Persoană → Document").
--
-- NOTHING STORED CHANGES
--   person_document's three share columns are not touched. A link whose role
--   now holds no share but stores a value keeps it; the screen shows it
--   read-only.
--
-- The names are matched as written in lookup_person_role (migration_014 and
-- later), with the comma-below ș and its cedilla twin both accepted.

BEGIN;

ALTER TABLE lookup_doc_type_person_role
  ADD COLUMN IF NOT EXISTS holds_share boolean NOT NULL DEFAULT false;

UPDATE lookup_doc_type_person_role AS p
   SET holds_share = true
  FROM lookup_person_role AS r
 WHERE r.id = p.person_role_id
   AND (
        r.name IN ('Vânzător', 'Cumpărător', 'Succesor universal', 'Adjudecatar',
                   'Titular / Proprietar', 'Titular al imobilului', 'Titular de drept')
     OR r.name LIKE 'Proprietar%'
     OR r.name LIKE 'Coproprietar%'
     OR r.name LIKE 'Moștenitor%'
     OR r.name LIKE 'Moştenitor%'
   );

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT t.name AS doc_type, r.name AS role, p.holds_share
      FROM lookup_doc_type_person_role p
      JOIN lookup_document_type t ON t.id = p.document_type_id
      JOIN lookup_person_role   r ON r.id = p.person_role_id
     ORDER BY t.name, r.name
  LOOP
    RAISE NOTICE 'holds_share % | % | %', rec.holds_share, rec.doc_type, rec.role;
  END LOOP;
  -- The links that store a share on a role that now holds none: kept, shown
  -- read-only. Counted here so the apply's own output says how many.
  RAISE NOTICE 'stored shares on a role that holds none: %', (
    SELECT count(*)
      FROM person_document pd
      JOIN document d ON d.id = pd.document_id
      JOIN lookup_doc_type_person_role p
        ON p.document_type_id = d.document_type_id AND p.person_role_id = pd.person_role_id
     WHERE p.holds_share = false
       AND (pd.cota_parte IS NOT NULL OR pd.cota_suprafata_mp IS NOT NULL OR pd.cota_mod IS NOT NULL)
  );
END $$;

COMMIT;
