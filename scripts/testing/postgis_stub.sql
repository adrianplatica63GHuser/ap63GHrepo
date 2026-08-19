-- ===========================================================================
-- postgis_stub.sql   (Slice #31.01)
--
-- A DELIBERATE FAKE. Do not apply this to any database you care about.
--
-- WHY IT EXISTS
--   verify-rebuild.ts rebuilds the database twice and diffs the two dumps.
--   That needs a Postgres server, and the one shape of server this project
--   cannot always get is one with PostGIS on it: the sandbox that verified
--   Slice #29.04 could install PostgreSQL 16 but not PostGIS (the package
--   fetch is blocked), and the same is true of the sandbox that wrote this
--   file. Without something standing where PostGIS stands, the migration
--   chain dies on drizzle/0001 and the check cannot run at all.
--
--   So this file defines just enough to let the chain apply, and
--   verify-rebuild.ts refuses to treat a run that used it as a full pass:
--   it names, in its own output, every object it could not verify, and its
--   verdict line reads PARTIAL rather than PASS. A check that silently
--   skipped the hard part would be worse than no check.
--
-- WHAT THE PROJECT ACTUALLY USES POSTGIS FOR
--   Measured on the tree at Slice #31.01, by grepping every .sql under
--   drizzle/ and src/db/ for geometry / geography / st_ / gist:
--
--     1. drizzle/0001_slim_black_bolt.sql — index property_corner_geom_idx,
--        GIST over (ST_SetSRID(ST_MakePoint(lon, lat), 4326))::geography.
--        This is the ONE schema object in the whole database that depends on
--        PostGIS. There is no geometry or geography COLUMN anywhere; corners
--        are stored as two double precision columns, lat and lon.
--
--     2. src/db/migration_033_property_calculated_area.sql — a backfill
--        UPDATE using ST_MakeLine (as an ordered-set aggregate), ST_AddPoint,
--        ST_StartPoint, ST_MakePolygon and ST_Area. On a rebuilt database
--        property_corner is empty, so no row is ever computed — but Postgres
--        still parses and plans the statement, so the functions have to exist
--        or the migration fails.
--
--   Both are reproduced below with the same names and argument types and
--   deliberately wrong behaviour. If a future migration adds a real geometry
--   column, this file will NOT be able to stand in for it, the chain will
--   fail loudly on the sandbox, and that is the correct outcome — extend the
--   list in verify-rebuild.ts's UNVERIFIABLE_WITHOUT_POSTGIS or get a server
--   with real PostGIS.
-- ===========================================================================

-- GIST over an expression needs an operator class for the expression's type.
-- The stub geography is a domain over text, and btree_gist supplies the text
-- opclass, so the index below is a real index on a real (wrong) expression
-- rather than a statement that was skipped.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- The stub type. A DOMAIN over text so that `expr::geography` casts, which is
-- the only thing the schema does with it.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                  WHERE n.nspname = 'public' AND t.typname = 'geography') THEN
    CREATE DOMAIN public.geography AS text;
  END IF;
END $$;

-- ── The functions drizzle/0001 needs ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.st_makepoint(double precision, double precision)
RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$ SELECT 'STUB_POINT(' || $1 || ' ' || $2 || ')' $$;

CREATE OR REPLACE FUNCTION public.st_setsrid(text, integer)
RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$ SELECT 'SRID=' || $2 || ';' || $1 $$;

-- ── The functions migration_033 needs ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.st_makeline_stub_sfunc(text, text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT coalesce($1 || '|', '') || $2 $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname = 'st_makeline') THEN
    CREATE AGGREGATE public.st_makeline(text) (
      SFUNC = public.st_makeline_stub_sfunc,
      STYPE = text
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.st_startpoint(text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$ SELECT split_part($1, '|', 1) $$;

CREATE OR REPLACE FUNCTION public.st_addpoint(text, text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$ SELECT $1 || '|' || $2 $$;

CREATE OR REPLACE FUNCTION public.st_makepolygon(text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$ SELECT 'STUB_POLY(' || $1 || ')' $$;

CREATE OR REPLACE FUNCTION public.st_area(public.geography)
RETURNS double precision LANGUAGE sql IMMUTABLE STRICT AS $$ SELECT 0::double precision $$;
