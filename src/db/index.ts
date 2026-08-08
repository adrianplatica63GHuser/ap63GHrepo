import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Reuse a single connection pool across hot reloads in dev. Without this,
// every code change would leak a Pool and quickly exhaust the DB's
// max_connections.
const globalForDb = globalThis as unknown as { pool?: Pool };

function makePool(): Pool {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    // Explicitly set UTF-8 as a PostgreSQL startup parameter so every
    // connection uses it from the start — no runtime query needed.
    // This avoids the pg DeprecationWarning that fires when client.query()
    // is called inside the pool's "connect" event handler.
    options: "-c client_encoding=UTF8",
    // Supabase (and any remote Postgres) requires TLS in production.
    // Locally (Docker) we leave SSL off so no cert setup is needed.
    // Set DATABASE_SSL=false in the container environment to disable it —
    // used for the local Docker Postgres in Ciprian's UAT stack (Slice 9.0).
    ssl:
      process.env.NODE_ENV === "production" && process.env.DATABASE_SSL !== "false"
        ? { rejectUnauthorized: false }
        : undefined,
  });
}

export const pool = globalForDb.pool ?? makePool();

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export const db = drizzle(pool, { schema });

/**
 * The `tx` a `db.transaction(...)` callback is handed.   (Slice #26.07)
 *
 * Derived from `db` rather than imported from `drizzle-orm/pg-core`, because
 * the generic parameters of `PgTransaction` include the whole schema and the
 * driver's result HKT — spelling them out by hand gives a type that compiles
 * today and stops matching the moment the driver or the schema moves, with an
 * error pointing at the annotation rather than at the change. This spelling
 * cannot go stale: it is whatever `db.transaction` actually passes.
 *
 * Exported for query modules that need to run inside a transaction their
 * CALLER opened — `createPropertyIn` is the first, so that a lookup and a
 * create can share one transaction and one advisory lock.
 */
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
