import { defineConfig } from "drizzle-kit";

// DATABASE_URL is loaded from .env via Node's built-in --env-file flag,
// wired up in the db:* scripts in package.json. No `import "dotenv/config"`
// needed.

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Tell drizzle-kit our DB has the postgis extension installed so it
  // doesn't try to manage anything in postgis-owned schemas.
  extensionsFilters: ["postgis"],
  // Default snake_case for any column/table names we don't explicitly set.
  casing: "snake_case",
});
