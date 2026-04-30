import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Reuse a single connection pool across hot reloads in dev. Without this,
// every code change would leak a Pool and quickly exhaust the DB's
// max_connections.
const globalForDb = globalThis as unknown as { pool?: Pool };

export const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    // Supabase (and any remote Postgres) requires TLS in production.
    // Locally (Docker) we leave SSL off so no cert setup is needed.
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export const db = drizzle(pool, { schema });
