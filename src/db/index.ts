import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Reuse a single connection pool across hot reloads in dev. Without this,
// every code change would leak a Pool and quickly exhaust the DB's
// max_connections.
const globalForDb = globalThis as unknown as { pool?: Pool };

function makePool(): Pool {
  const p = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Supabase (and any remote Postgres) requires TLS in production.
    // Locally (Docker) we leave SSL off so no cert setup is needed.
    // SSL is on by default in production (needed for Supabase / remote Postgres).
    // Set DATABASE_SSL=false in the container environment to disable it —
    // used for the local Docker Postgres in Ciprian's UAT stack (Slice 9.0).
    ssl:
      process.env.NODE_ENV === "production" && process.env.DATABASE_SSL !== "false"
        ? { rejectUnauthorized: false }
        : undefined,
  });
  // Explicitly set UTF-8 on every new connection. node-postgres can inherit
  // the OS code page on Windows (e.g. CP1252), which cannot represent
  // Romanian characters like ă (U+0103) or ț (U+021B) and silently
  // substitutes '?' for them.
  p.on("connect", (client) => {
    client.query("SET client_encoding = 'UTF8'").catch(console.error);
  });
  return p;
}

export const pool = globalForDb.pool ?? makePool();

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export const db = drizzle(pool, { schema });
