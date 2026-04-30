import { defineConfig } from "drizzle-kit";

// DATABASE_URL / DIRECT_URL are loaded from .env via Node's built-in
// --env-file flag, wired up in the db:* scripts in package.json.
// No `import "dotenv/config"` needed.
//
// Two connection strings are used when targeting Supabase:
//   DIRECT_URL  — direct Postgres connection (port 5432); required by
//                 drizzle-kit because it uses prepared statements, which
//                 are incompatible with Supabase's connection pooler.
//   DATABASE_URL — pooled connection (port 6543); used by the running app.
// In local dev only DATABASE_URL (pointing at Docker) is needed.

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema",
  out: "./drizzle",
  dbCredentials: {
    // Prefer DIRECT_URL for migrations (Supabase); fall back to DATABASE_URL
    // for local Docker where there is no pooler to bypass.
    url: (process.env.DIRECT_URL ?? process.env.DATABASE_URL)!,
  },
  // Tell drizzle-kit our DB has the postgis extension installed so it
  // doesn't try to manage anything in postgis-owned schemas.
  extensionsFilters: ["postgis"],
  // Default snake_case for any column/table names we don't explicitly set.
  casing: "snake_case",
});
