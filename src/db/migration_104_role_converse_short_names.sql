-- migration_104_role_converse_short_names.sql
-- Slice #38.70 - two roles' converse names, shortened as Adrian wrote them.
--
-- WHAT THIS DOES
--   „Roluri Persoane"'s „Rol invers" cell joins converse_name, converse_name_male
--   and converse_name_female (joined-cell.ts, #38.55, #38.58). Adrian:
--     „Bunic / Unchi, Bunică / Mătușă"                 -> „Bunic(ă), Unchi, Mătușă"
--     „Reprezentat / Mandant, Reprezentată / Mandantă" -> „Reprezentat(ă) / Mandant(ă)"
--   Each new text becomes the role's NEUTRAL converse name and its two gendered
--   names are emptied (Ask first #1), so the cell reads exactly his text and a man
--   and a woman are both shown it — the „(ă)" carries both.
--
--     Nepot                          ('Bunic / Unchi', 'Bunic / Unchi', 'Bunică / Mătușă')
--                                 -> ('Bunic(ă), Unchi, Mătușă', NULL, NULL)
--       Entered by Adrian in the role editor; in no file of the repo. Read from the
--       archive on 2026-10-10 (GET /api/admin/value-lists/person-roles).
--     Reprezentant legal / Mandatar  ('Reprezentat / Mandant', NULL, 'Reprezentată / Mandantă')
--                                 -> ('Reprezentat(ă) / Mandant(ă)', NULL, NULL)
--       Seeded by migration_088; src/db/sync-reference-data.sql changes with it.
--
-- ONLY WHILE THEY STILL HOLD TODAY'S VALUES (Ask first #2)
--   Each UPDATE matches the role by name AND its three converse fields as they are
--   today, so a later edit by hand is left alone, and a database without the role
--   (a cloud project that never had „Nepot") changes nothing. Running it twice
--   changes nothing the second time.

BEGIN;

UPDATE lookup_person_role
   SET converse_name = 'Bunic(ă), Unchi, Mătușă', converse_name_male = NULL, converse_name_female = NULL
 WHERE name = 'Nepot'
   AND converse_name        IS NOT DISTINCT FROM 'Bunic / Unchi'
   AND converse_name_male   IS NOT DISTINCT FROM 'Bunic / Unchi'
   AND converse_name_female IS NOT DISTINCT FROM 'Bunică / Mătușă';

UPDATE lookup_person_role
   SET converse_name = 'Reprezentat(ă) / Mandant(ă)', converse_name_male = NULL, converse_name_female = NULL
 WHERE name = 'Reprezentant legal / Mandatar'
   AND converse_name        IS NOT DISTINCT FROM 'Reprezentat / Mandant'
   AND converse_name_male   IS NULL
   AND converse_name_female IS NOT DISTINCT FROM 'Reprezentată / Mandantă';

COMMIT;
