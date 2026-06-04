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
