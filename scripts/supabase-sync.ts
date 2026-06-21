/**
 * supabase-sync.ts
 *
 * Full reset of Supabase to exactly match local Docker dev.
 *
 * Steps performed automatically:
 *   1. Drop everything on Supabase   (supabase_reset.sql)
 *   2. Rebuild the full schema       (supabase_schema_full.sql)
 *   3. Truncate all reference tables (remove defaults seeded by schema SQL)
 *   4. Copy every reference table row-for-row from local Docker
 *
 * Domain data (persons, properties, documents) is NOT touched —
 * re-seed separately with `npm run db:seed` against Supabase if needed.
 *
 * Usage:
 *   npm run supabase:sync
 *
 * Requires in .env:
 *   DATABASE_URL      — local Docker (already set for dev)
 *   SUPABASE_SYNC_URL — Supabase session pooler, port 5432
 *     e.g. postgres://postgres.[ref]:[password]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
 */

import { Pool } from "pg";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Connection setup
// ---------------------------------------------------------------------------

const DOCKER_URL   = process.env.DATABASE_URL;
const SUPABASE_URL = process.env.SUPABASE_SYNC_URL;

if (!DOCKER_URL) {
  console.error("\n❌  DATABASE_URL not set. Should point to local Docker.");
  process.exit(1);
}
if (!SUPABASE_URL) {
  console.error([
    "\n❌  SUPABASE_SYNC_URL not set.",
    "    Add to .env:",
    "    SUPABASE_SYNC_URL=postgres://postgres.[ref]:[password]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres",
    "    (Use the session pooler URL from the Supabase dashboard → Connect button)",
  ].join("\n"));
  process.exit(1);
}

const localPool = new Pool({ connectionString: DOCKER_URL });
const supaPool  = new Pool({
  connectionString: SUPABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function step(n: number, total: number, msg: string) {
  console.log(`\n▶  Step ${n}/${total} — ${msg}`);
}
function ok(msg: string)  { console.log(`   ✓  ${msg}`); }
function log(msg: string) { console.log(`      ${msg}`); }

async function execFile(pool: Pool, filePath: string): Promise<void> {
  const sql = fs.readFileSync(path.resolve(process.cwd(), filePath), "utf-8");
  await pool.query(sql);
}

// ---------------------------------------------------------------------------
// Reference table sync helpers
// ---------------------------------------------------------------------------

/**
 * Copy a simple lookup table (no FK columns that reference other lookups).
 * Copies only the listed data columns; id/timestamps are generated fresh.
 */
async function syncSimple(
  table: string,
  dataColumns: string[],
  orderBy: string,
): Promise<void> {
  const cols = dataColumns.join(", ");
  const placeholders = dataColumns.map((_, i) => `$${i + 1}`).join(", ");
  const { rows, rowCount } = await localPool.query(
    `SELECT ${cols} FROM ${table} ORDER BY ${orderBy}`,
  );
  for (const row of rows) {
    await supaPool.query(
      `INSERT INTO ${table} (${cols}) VALUES (${placeholders})`,
      dataColumns.map((c) => row[c]),
    );
  }
  ok(`${table}  (${rowCount ?? 0} rows)`);
}

/** lookup_others — needs category column plus optional description. */
async function syncLookupOthers(): Promise<void> {
  const { rows, rowCount } = await localPool.query(
    `SELECT name, description, category, sort_order
     FROM lookup_others
     ORDER BY category, sort_order`,
  );
  for (const row of rows) {
    await supaPool.query(
      `INSERT INTO lookup_others (name, description, category, sort_order)
       VALUES ($1, $2, $3, $4)`,
      [row.name, row.description, row.category, row.sort_order],
    );
  }
  ok(`lookup_others  (${rowCount ?? 0} rows)`);
}

/**
 * lookup_doc_type_person_role — M:M junction.
 * Reads names from Docker, inserts into Supabase by name lookup
 * (avoids UUID dependency between the two DBs).
 */
async function syncDocTypePersonRoles(): Promise<void> {
  const { rows, rowCount } = await localPool.query(`
    SELECT ldt.name AS doc_name, lpr.name AS role_name
    FROM   lookup_doc_type_person_role ldtpr
    JOIN   lookup_document_type ldt ON ldt.id = ldtpr.document_type_id
    JOIN   lookup_person_role   lpr ON lpr.id = ldtpr.person_role_id
    ORDER BY ldt.name, lpr.name
  `);
  for (const row of rows) {
    await supaPool.query(
      `INSERT INTO lookup_doc_type_person_role
         (id, document_type_id, person_role_id, created_at)
       SELECT gen_random_uuid(), d.id, r.id, now()
       FROM   lookup_document_type d,
              lookup_person_role   r
       WHERE  d.name = $1
         AND  r.name = $2`,
      [row.doc_name, row.role_name],
    );
  }
  ok(`lookup_doc_type_person_role  (${rowCount ?? 0} rows)`);
}

/**
 * lookup_property_person_role — FK to lookup_person_role.
 * Resolved by role name.
 */
async function syncPropertyPersonRoles(): Promise<void> {
  const { rows, rowCount } = await localPool.query(`
    SELECT lpr.name AS role_name
    FROM   lookup_property_person_role lppr
    JOIN   lookup_person_role lpr ON lpr.id = lppr.person_role_id
    ORDER BY lpr.name
  `);
  for (const row of rows) {
    await supaPool.query(
      `INSERT INTO lookup_property_person_role
         (id, person_role_id, created_at)
       SELECT gen_random_uuid(), id, now()
       FROM   lookup_person_role
       WHERE  name = $1`,
      [row.role_name],
    );
  }
  ok(`lookup_property_person_role  (${rowCount ?? 0} rows)`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const TOTAL = 5;

  console.log("\n══════════════════════════════════════════════════");
  console.log("   ga40prj — Supabase Sync (Full Reset from Dev)  ");
  console.log("══════════════════════════════════════════════════");
  console.log("  Source : local Docker  (DATABASE_URL)");
  console.log("  Target : Supabase      (SUPABASE_SYNC_URL)");

  // Step 1: Drop all Supabase objects
  step(1, TOTAL, "Dropping all Supabase objects...");
  await execFile(supaPool, "src/db/supabase_reset.sql");
  ok("All objects dropped");

  // Step 2: Rebuild the full schema (+ default seed data)
  step(2, TOTAL, "Rebuilding schema on Supabase...");
  await execFile(supaPool, "src/db/supabase_schema_full.sql");
  ok("Schema rebuilt");

  // Step 3: Replace default seed data with exact Docker state
  step(3, TOTAL, "Syncing reference data from Docker to Supabase...");
  log("Truncating defaults seeded by schema SQL...");

  // Truncate junction tables first, then base tables (CASCADE handles the rest).
  await supaPool.query(`
    TRUNCATE
      lookup_property_person_role,
      lookup_doc_type_person_role
    CASCADE
  `);
  await supaPool.query(`
    TRUNCATE
      lookup_person_role,
      lookup_property_type,
      lookup_tarla,
      lookup_use_category,
      lookup_person_type,
      lookup_citizenship,
      lookup_document_type,
      lookup_institution,
      lookup_others
    CASCADE
  `);

  log("Copying rows from Docker...");

  // Base tables (must be inserted before junction tables)
  await syncSimple("lookup_property_type", ["name", "sort_order"], "sort_order");
  await syncSimple("lookup_tarla",         ["indicativ", "descriere", "sort_order"], "sort_order");
  await syncSimple("lookup_use_category",  ["name", "sort_order"], "sort_order");
  await syncSimple("lookup_person_type",   ["name", "sort_order"], "sort_order");
  await syncSimple("lookup_citizenship",   ["name", "sort_order"], "sort_order");
  await syncSimple("lookup_document_type", ["key", "name", "sort_order"], "sort_order");
  await syncSimple("lookup_institution",   ["name", "institution_type", "sort_order"], "sort_order");
  await syncSimple("lookup_person_role",   ["name", "description", "sort_order"], "sort_order");
  await syncLookupOthers();

  // Junction tables (depend on base tables already inserted above)
  await syncDocTypePersonRoles();
  await syncPropertyPersonRoles();

  // Step 4: Seed domain data (persons, properties, documents, judicial persons)
  // Run seed.ts as a child process with DATABASE_URL temporarily pointed at Supabase.
  // The seed is idempotent — it skips any table that already has rows.
  step(4, TOTAL, "Seeding domain data (persons, properties, documents)...");
  execSync(
    "node node_modules/tsx/dist/cli.mjs src/db/seed.ts",
    {
      env: {
        ...process.env,
        DATABASE_URL: SUPABASE_URL,
        NODE_ENV: "production",
      },
      stdio: "inherit",
      cwd: process.cwd(),
    },
  );
  ok("Domain data seeded");

  // Step 5: Done
  step(5, TOTAL, "Done.");
  console.log("\n   ✅  Supabase matches local Docker exactly.");
  console.log("       Reference data + domain data are in sync.");
  console.log();
  console.log("   Note: the admin user account is NOT reset by this script.");
  console.log("   If needed, re-run: npm run seed:admin");
  console.log();
}

main()
  .catch((err) => {
    console.error("\n❌  Sync failed:", err.message ?? err);
    process.exit(1);
  })
  .finally(async () => {
    await Promise.allSettled([localPool.end(), supaPool.end()]);
  });
