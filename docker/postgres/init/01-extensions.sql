-- Enable PostGIS on the target database.
--
-- Placed in /docker-entrypoint-initdb.d/, this script runs automatically
-- ONCE when the Postgres data volume is first initialized. It is not re-run
-- on subsequent container starts. If you need to re-run it, drop the volume:
--   docker compose -f docker/postgres/docker-compose.yml --env-file .env down -v
--
-- Creates extensions in the default DB named by $POSTGRES_DB.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Sanity line you can spot with:
--   docker compose -f docker/postgres/docker-compose.yml logs postgres | findstr PostGIS
DO $$
BEGIN
  RAISE NOTICE 'PostGIS % enabled on database %', PostGIS_Version(), current_database();
END $$;
