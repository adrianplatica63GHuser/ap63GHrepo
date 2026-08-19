-- ============================================================
-- ga40prj — Supabase Reset Script
--
-- Drops every application-owned object in `public` so the full schema can be
-- applied from scratch via supabase_schema_full.sql.
--
-- Run in the Supabase SQL Editor BEFORE applying the schema.
-- PostGIS must already be enabled in the project.
--
-- WHY THIS IS DERIVED AND NOT A LIST  (Slice #29.04)
--   It used to be a hand-written list of DROP statements, and by the time
--   #29.04 came to use it the list was twenty-eight tables long against a
--   schema of fifty-one. Measured: running it left 23 tables standing —
--   groups, stamps, entity_metadata and its satellites, entity_tag,
--   entity_cross_reference, calculation_run, help_content, the three *_version
--   tables, property_corner_source, four lookup tables and schema_migrations —
--   five of which still carried the deleted_at column this slice removes.
--   supabase_schema_full.sql then died on its 116th line with `type
--   "group_target_type" already exists`, exit 3, leaving the project with no
--   core domain tables and 23 orphans.
--
--   Every table added since the list was written was invisible to it, and
--   nothing failed loudly enough to say so — the reset itself exits 0, because
--   `DROP TABLE IF EXISTS` on a table you forgot to name is not an error, it
--   is silence. A list that must be updated by hand every time a migration
--   adds a table is a list that will be wrong again by Slice #30.
--
--   So this asks the catalogue instead. It cannot go stale.
--
-- WHAT IT WILL NOT TOUCH
--   Anything belonging to an EXTENSION. PostGIS installs `spatial_ref_sys`
--   and several hundred functions into `public`, and pg_trgm its operator
--   classes; dropping those would take the extension with them and the
--   rebuild would fail on the first geometry column. `pg_depend.deptype = 'e'`
--   is what distinguishes them, and it is the whole safety argument here.
--
--   Anything outside `public` — Supabase's own `auth`, `storage`, `graphql`
--   and `extensions` schemas are untouched, so logins and buckets survive.
--
-- ⚠️ THIS DESTROYS ALL APPLICATION DATA IN THE TARGET PROJECT. That is the
--   point: CLAUDE.md's rule for the cloud side is a full reset over a delta.
--   It is not a migration and must never be run against anything you would
--   miss.
-- ============================================================

-- ── Tables ────────────────────────────────────────────────
--
-- CASCADE takes the triggers, indexes, constraints, owned sequences and any
-- views built on them, so those need no pass of their own.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'p')          -- ordinary + partitioned tables
       AND NOT EXISTS (SELECT 1 FROM pg_depend d
                        WHERE d.objid = c.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.relname);
  END LOOP;
END $$;

-- ── Sequences ─────────────────────────────────────────────
--
-- Anything OWNED BY a column went with its table above. What is left is the
-- standalone ones the application allocates codes from — principal_object_
-- code_seq and its siblings — which are created by the migrations, not by a
-- serial column, and so have no owner to take them.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'S'
       AND NOT EXISTS (SELECT 1 FROM pg_depend d
                        WHERE d.objid = c.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('DROP SEQUENCE IF EXISTS public.%I CASCADE', r.relname);
  END LOOP;
END $$;

-- ── Types (the enums) ─────────────────────────────────────
--
-- `typtype = 'e'` is an enum; a table's implicit composite row-type has
-- already gone with its table and is excluded here by `typrelid = 0` anyway.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT t.typname
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'public'
       AND t.typtype  = 'e'
       AND NOT EXISTS (SELECT 1 FROM pg_depend d
                        WHERE d.objid = t.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('DROP TYPE IF EXISTS public.%I CASCADE', r.typname);
  END LOOP;
END $$;

-- ── Functions ─────────────────────────────────────────────
--
-- touch_updated_at, the CNP/CUI lock triggers, and — until migration_070 —
-- the two soft-delete-aware uniqueness checks. Their triggers are already
-- gone with their tables; this removes the functions themselves.
--
-- `prokind = 'f'` skips aggregates and window functions, which this schema
-- has none of but PostGIS has many of (already excluded by the extension
-- test; belt and braces).

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prokind  = 'f'
       AND NOT EXISTS (SELECT 1 FROM pg_depend d
                        WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', r.sig);
  END LOOP;
END $$;

-- ── Report ────────────────────────────────────────────────
--
-- Loud, because the failure this file is being rewritten for was a silent
-- one: the old list exited 0 having left 23 tables standing.

DO $$
DECLARE
  t integer;
  s integer;
  e integer;
  f integer;
BEGIN
  SELECT count(*) INTO t FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname='public' AND c.relkind IN ('r','p')
     AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid=c.oid AND d.deptype='e');
  SELECT count(*) INTO s FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname='public' AND c.relkind='S'
     AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid=c.oid AND d.deptype='e');
  SELECT count(*) INTO e FROM pg_type t2 JOIN pg_namespace n ON n.oid = t2.typnamespace
   WHERE n.nspname='public' AND t2.typtype='e'
     AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid=t2.oid AND d.deptype='e');
  SELECT count(*) INTO f FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.prokind='f'
     AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.deptype='e');

  RAISE NOTICE 'supabase_reset: % application table(s), % sequence(s), % enum(s), % function(s) left in public (expected 0, 0, 0, 0).', t, s, e, f;

  IF t <> 0 OR s <> 0 OR e <> 0 OR f <> 0 THEN
    RAISE EXCEPTION 'supabase_reset: the reset did not finish - see the NOTICE above. Do NOT apply supabase_schema_full.sql on top of this.';
  END IF;
END $$;
