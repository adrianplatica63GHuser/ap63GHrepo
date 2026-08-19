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
 * Domain data (persons, properties, documents) is not copied — re-seed
 * separately with `npm run db:seed` against Supabase if needed. It is not
 * PRESERVED either, and this line used to say it was: step 3's TRUNCATE ... 
 * CASCADE reaches 19 domain tables through the lookup foreign keys, and since
 * Slice #31.01 added lookup_judicial_person_type to the list it reaches
 * judicial_person too. In this script's own flow that is harmless — step 2 has
 * just rebuilt the schema empty — but the statements are not safe to lift out
 * and run against a database with data in it.
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
 * Copy a simple lookup table (no FK columns referencing other lookups).
 *
 * THE COLUMN LIST IS READ FROM THE DATABASE, NOT PASSED IN. It used to be a
 * hand-written array per table, and by Slice #31.01 two of them had gone stale
 * in exactly the way a hand-written list does: lookup_property_type was copied
 * as ("name", "sort_order"), so every sync left `key` NULL and all three panel
 * flags at their DEFAULT false on the live project -- no property type had the
 * slug type-config.ts switches on, and every form panel was hidden.
 * lookup_document_type was copied without `template_fields` (migration_066) and
 * without `origin` (migration_069), so document templates were lost and every
 * IMPORT-origin type silently became MANUAL. Both were invisible: the sync
 * printed a row count and the row count was right.
 *
 * So the columns are whatever the local table has, minus the three this sync
 * regenerates. A column added by a future migration is copied without anyone
 * remembering to add it here.
 */
const REGENERATED_COLUMNS = new Set(["id", "created_at", "updated_at"]);

/** Column plan for one table, resolved and validated before anything is dropped. */
async function planFor(table: string, orderBy: string): Promise<string[]> {
  const { rows: colRows } = await localPool.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position`,
    [table],
  );
  const dataColumns: string[] = colRows
    .map((r) => r.column_name as string)
    .filter((c) => !REGENERATED_COLUMNS.has(c));

  if (dataColumns.length === 0) {
    throw new Error(`${table}: no data columns found. Does the table exist in the local database?`);
  }

  // A foreign key cannot be copied by value: the two databases do not share
  // UUIDs. Every lookup that has one today is a junction table with its own
  // name-resolving function below, so a new FK here means a new function is
  // needed -- and failing loudly beats writing an id that means nothing on the
  // other side.
  const { rows: fkRows } = await localPool.query(
    `SELECT kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_name = tc.constraint_name
        AND kcu.table_schema    = tc.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.table_name   = $1
        AND tc.constraint_type = 'FOREIGN KEY'`,
    [table],
  );
  const fkCols = fkRows.map((r) => r.column_name as string).filter((c) => dataColumns.includes(c));
  if (fkCols.length > 0) {
    throw new Error(
      `${table} has foreign key column(s) ${fkCols.join(", ")}. syncSimple copies values, and a ` +
        `UUID from the local database means nothing on Supabase. Give this table a name-resolving ` +
        `sync function, the way lookup_property_person_role has one.`,
    );
  }

  if (!dataColumns.includes(orderBy)) {
    throw new Error(
      `${table} has no column \`${orderBy}\` to order by. Checked here rather than at copy time, ` +
        `because a throw between the TRUNCATE and the copy leaves the target with empty lookups.`,
    );
  }

  return dataColumns;
}

/**
 * Every plan, resolved BEFORE step 3 truncates anything. planFor throws when a
 * table has grown a foreign key or lost the column it is ordered by, and a
 * throw that lands between the TRUNCATE and the copy leaves the live project
 * with fourteen empty lookup tables. Resolving first turns that into a refusal
 * that leaves the reference data alone.
 *
 * It does NOT leave the project untouched: steps 1 and 2 have already reset and
 * rebuilt the schema by the time this runs, so the project is on the schema
 * file's defaults. Re-running the sync is the way out.
 */
const PLANS = new Map<string, string[]>();
async function planAll(tables: Array<[string, string]>): Promise<void> {
  for (const [t, orderBy] of tables) PLANS.set(t, await planFor(t, orderBy));
}

async function syncSimple(table: string, orderBy: string): Promise<void> {
  const dataColumns = PLANS.get(table);
  if (!dataColumns) throw new Error(`${table}: no column plan. planAll() must run before the truncate.`);
  // Quoted: these names come from the catalogue, and an unquoted reserved word
  // or mixed-case column would be a syntax error rather than a wrong result.
  const cols = dataColumns.map((c) => `"${c}"`).join(", ");
  const placeholders = dataColumns.map((_, i) => `$${i + 1}`).join(", ");
  const { rows, rowCount } = await localPool.query(
    `SELECT ${cols} FROM ${table} ORDER BY "${orderBy}"`,
  );
  for (const row of rows) {
    await supaPool.query(
      `INSERT INTO ${table} (${cols}) VALUES (${placeholders})`,
      dataColumns.map((c) => row[c]),
    );
  }
  ok(`${table}  (${rowCount ?? 0} rows, ${dataColumns.length} column(s): ${cols})`);
}

/** Every table syncSimple is called on, with its order column, in copy order. */
const SIMPLE_TABLES: Array<[string, string]> = [
  ["lookup_property_type", "sort_order"],
  ["lookup_tarla", "sort_order"],
  ["lookup_use_category", "sort_order"],
  ["lookup_person_type", "sort_order"],
  ["lookup_citizenship", "sort_order"],
  ["lookup_document_type", "sort_order"],
  ["lookup_institution", "sort_order"],
  ["lookup_person_role", "sort_order"],
  ["lookup_judicial_person_type", "sort_order"],
  ["lookup_property_property_role", "sort_order"],
  ["lookup_document_document_role", "sort_order"],
];


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

/**
 * lookup_person_person_role — whitelist over lookup_person_role, resolved by
 * role name for the same reason syncPropertyPersonRoles does it: the two
 * databases do not share UUIDs.
 *
 * Copies zero rows on a database where nothing has been whitelisted yet, and
 * that is the correct outcome — the point is that the table is cleared and
 * refilled from dev like every other lookup, rather than being left to whatever
 * the previous rebuild happened to leave behind. (Slice #31.01)
 */
async function syncPersonPersonRoles(): Promise<void> {
  const { rows, rowCount } = await localPool.query(`
    SELECT lpr.name AS role_name
    FROM   lookup_person_person_role lppr
    JOIN   lookup_person_role lpr ON lpr.id = lppr.person_role_id
    ORDER BY lpr.name
  `);
  for (const row of rows) {
    await supaPool.query(
      `INSERT INTO lookup_person_person_role
         (id, person_role_id, created_at)
       SELECT gen_random_uuid(), id, now()
       FROM   lookup_person_role
       WHERE  name = $1`,
      [row.role_name],
    );
  }
  ok(`lookup_person_person_role  (${rowCount ?? 0} rows)`);
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
  log("Resolving column plans before anything is truncated...");
  await planAll(SIMPLE_TABLES);
  log("Truncating defaults seeded by schema SQL...");

  // Truncate junction tables first, then base tables (CASCADE handles the rest).
  // Junction / whitelist tables first, then base tables (CASCADE handles the
  // rest). Four names were absent from these lists until Slice #31.01 --
  // lookup_person_person_role, lookup_property_property_role,
  // lookup_document_document_role (added by migration_055) and
  // lookup_judicial_person_type -- so they were neither cleared nor copied and
  // arrived empty on every sync, with nothing saying so. scripts/verify-rebuild.ts
  // now fails when a lookup_* table in a rebuilt database is named nowhere here.
  await supaPool.query(`
    TRUNCATE
      lookup_property_person_role,
      lookup_person_person_role,
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
      lookup_judicial_person_type,
      lookup_citizenship,
      lookup_document_type,
      lookup_institution,
      lookup_property_property_role,
      lookup_document_document_role
    CASCADE
  `);

  log("Copying rows from Docker...");

  // Base tables (must be inserted before junction tables)
  await syncSimple("lookup_property_type", "sort_order");
  await syncSimple("lookup_tarla",         "sort_order");
  await syncSimple("lookup_use_category",  "sort_order");
  await syncSimple("lookup_person_type",   "sort_order");
  await syncSimple("lookup_citizenship",   "sort_order");
  await syncSimple("lookup_document_type", "sort_order");
  await syncSimple("lookup_institution",   "sort_order");
  await syncSimple("lookup_person_role",   "sort_order");
  await syncSimple("lookup_judicial_person_type", "sort_order");

  // Relationship-role lookups (migration_055). lookup_person_person_role is a
  // whitelist over lookup_person_role and is copied by role name below, the
  // same way lookup_property_person_role is.
  await syncSimple("lookup_property_property_role", "sort_order");
  await syncSimple("lookup_document_document_role", "sort_order");

  // Junction tables (depend on base tables already inserted above)
  await syncDocTypePersonRoles();
  await syncPropertyPersonRoles();
  await syncPersonPersonRoles();

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
