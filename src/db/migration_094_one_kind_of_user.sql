-- migration_094_one_kind_of_user.sql
-- Slice #38.21 - one kind of user: every account of this application has the
-- superuser's reach.
--
-- WHAT THIS DOES
--   Sets every app_users.role to 'superuser', and the column's default to
--   'superuser', so a row written by anything that does not name a role - a
--   seed, a hand-written INSERT - is the same kind of account as every other.
--
-- WHY THE ROLE STAYS
--   This application no longer reads it: since #38.21 every check is one
--   predicate, a signed-in account with an app_users row
--   (src/lib/auth/current-role.ts, `hasFullAccess`). The future Portal
--   application will need a role again, and that is where it comes back -
--   so the column, the enum and its 'user' value are kept. Dropping an enum
--   value is a destructive migration; keeping one nobody writes costs nothing.
--
-- REVERSIBLE?
--   The default, yes. The roles it overwrites are not recorded: which accounts
--   were 'user' before this ran is lost, by design - there is nothing left in
--   this application that could tell them apart.

BEGIN;

UPDATE app_users
   SET role = 'superuser'
 WHERE role <> 'superuser';

ALTER TABLE app_users
  ALTER COLUMN role SET DEFAULT 'superuser';

COMMIT;
