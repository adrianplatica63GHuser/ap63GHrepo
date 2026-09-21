/**
 * supabase-migrate.ts
 *
 * Apply pending `src\db\migration_*.sql` to the Supabase project named by
 * `SUPABASE_SYNC_URL`, and record each one in `schema_migrations` there --
 * the job `scripts\Apply-Migration.ps1` does against local Docker, pointed at
 * the cloud.
 *
 * Usage:
 *   npm run supabase:migrate -- --status      report only, change nothing
 *   npm run supabase:migrate -- --baseline 086  record 008..086 as applied, RUN NOTHING
 *   npm run supabase:migrate                  apply everything pending
 *
 * Requires in .env:
 *   SUPABASE_SYNC_URL -- the same session-pooler URL `supabase-sync.ts` uses
 *     (port 5432). Deliberately the same variable: a second name for the same
 *     connection string is a second thing to get wrong, and the two scripts
 *     are never pointed at different projects.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * Until this file, step 4 of the migration workflow was "Adrian pastes the
 * file's contents into the Supabase SQL Editor". That records nothing, so the
 * cloud project had no answer to "which migrations does it hold?" -- only
 * Adrian's memory of which tabs he had pasted. A paste skipped in a busy
 * session is invisible until a route 500s in production, which is the same
 * failure `schema_migrations` was created to end locally.
 *
 * ---------------------------------------------------------------------------
 * IDEMPOTENT, AND WHAT THAT DOES AND DOES NOT MEAN
 * ---------------------------------------------------------------------------
 * Running this twice applies nothing the second time: the second run reads
 * the rows the first one wrote and finds nothing pending. That is the whole
 * of the guarantee, and it is a property of the RUNNER, not of the migration
 * files -- most of them are not safe to run twice, which is exactly why the
 * runner refuses rather than re-running whenever it cannot prove a file is
 * pending.
 *
 * ⚠️ **AND IT IS WHY THERE IS NO BOOTSTRAP HERE.** `Apply-Migration.ps1`
 * bootstraps an empty database by applying `migration_056_schema_migrations.sql`,
 * which backfills 008..056 BY ASSERTION. Doing that against Supabase would be
 * a disaster with a clean exit code: the cloud schema is built by
 * `supabase_schema_full.sql`, which creates `schema_migrations` EMPTY and
 * already holds every table through 086. A 056 bootstrap would declare 008..056
 * applied and then apply 057..086 for a second time against a schema that has
 * them -- dropped columns, re-seeded lookups, failed constraints, mid-chain.
 *
 * So the first run against any cloud project must declare its own baseline,
 * and the runner refuses to guess one. `--baseline 086` writes those rows with
 * a NULL checksum, which is this codebase's word for "recorded, unverified" --
 * the same thing migration_056's backfill rows say locally. They will show as
 * UNKNOWN on every later run, for ever, and that is honest: nothing hashed
 * what actually ran.
 *
 * The one case that needs no baseline is a genuinely EMPTY project -- no
 * application tables at all -- where the whole chain from 008 is the right
 * thing to run. That is detected, not assumed.
 *
 * ---------------------------------------------------------------------------
 * HOW A FILE IS RUN, AND THE ONE DIFFERENCE FROM psql
 * ---------------------------------------------------------------------------
 * Each file is sent to `pg` as ONE simple query, which is how
 * `supabase-sync.ts` has always run `supabase_schema_full.sql`. Postgres wraps
 * a multi-statement simple query in an implicit transaction, so a file that
 * fails halfway rolls back -- the same net effect as psql's `ON_ERROR_STOP=1`
 * on the files here that carry their own `BEGIN;`/`COMMIT;`, and strictly
 * safer on the ones that do not.
 *
 * ⚠️ **THE DIFFERENCE IS `CREATE INDEX CONCURRENTLY`, `VACUUM` and
 * `ALTER SYSTEM`, none of which can run inside a transaction block.** No
 * migration in `src\db` uses one today -- both files that mention CONCURRENTLY
 * (080, 083) do so in a comment explaining why they did NOT use it. If a
 * future migration does, this runner stops on Postgres's own error, rolls the
 * file back and records nothing; run that one statement in the Supabase SQL
 * Editor and re-run this with the file split, rather than working around it
 * here.
 *
 * ---------------------------------------------------------------------------
 * EXIT CODES -- the same vocabulary as Apply-Migration.ps1
 * ---------------------------------------------------------------------------
 *   0  nothing pending, or everything pending applied (or --status, clean).
 *   1  the run could not proceed or did not finish: no URL, unreachable,
 *      src\db unreadable, a query failed, a migration failed to apply.
 *   2  the cloud and src\db disagree about something already recorded, or the
 *      project needs a baseline. NOTHING was applied.
 *   3  a migration APPLIED but its row could not be written. Do not re-run
 *      until the row exists; the message prints the exact INSERT.
 */

import { Client } from "pg";
import fs from "fs";
import path from "path";
import {
  compareMigrationState,
  parseBaselineArg,
  readMigrationsOnDisk,
  selectBaseline,
  type AppliedRow,
  type DiskMigration,
} from "./migration-state";

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const wantStatus = argv.includes("--status");
const baselineIdx = argv.indexOf("--baseline");
let baselineThrough: number | null = null;

if (baselineIdx !== -1) {
  const raw = argv[baselineIdx + 1];
  if (!raw || raw.startsWith("--")) {
    console.error("\n❌  --baseline needs a migration number, e.g. --baseline 086");
    process.exit(1);
  }
  try {
    baselineThrough = parseBaselineArg(raw);
  } catch (e) {
    console.error(`\n❌  ${(e as Error).message}`);
    process.exit(1);
  }
}

if (wantStatus && baselineThrough !== null) {
  console.error("\n❌  --status and --baseline do the opposite of each other. Pick one.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_SYNC_URL;

if (!SUPABASE_URL) {
  console.error(
    [
      "\n❌  SUPABASE_SYNC_URL not set.",
      "    Add to .env:",
      "    SUPABASE_SYNC_URL=postgres://postgres.[ref]:[password]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres",
      "    (Use the session pooler URL from the Supabase dashboard → Connect button)",
    ].join("\n"),
  );
  process.exit(1);
}

/**
 * Host and database only. ⚠️ The connection string carries the project
 * password, and `C:\dev\CLAUDE.md` is explicit that a secret never gets echoed
 * back into the conversation -- which includes a console this runner's output
 * gets pasted out of.
 */
function describeTarget(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`;
  } catch {
    return "(unparseable SUPABASE_SYNC_URL)";
  }
}

const client = new Client({
  connectionString: SUPABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// A migration that reshapes a big table can outrun a default statement
// timeout, and a timeout mid-chain is the one failure mode that leaves the
// operator guessing. Ten minutes, set on the session rather than the project.
const STATEMENT_TIMEOUT_MS = 10 * 60 * 1000;

// One writer at a time. Two runs racing would both read the same empty
// pending set at different moments and apply the same non-idempotent file
// twice; an advisory lock costs one round trip and removes the question.
const ADVISORY_LOCK_KEY = 40_360_301;

const MIGRATIONS_DIR = path.resolve(process.cwd(), "src", "db");

// ---------------------------------------------------------------------------
// Output helpers -- same shapes supabase-sync.ts prints, so the two read alike
// ---------------------------------------------------------------------------

function ok(msg: string) { console.log(`   ✓  ${msg}`); }
function log(msg: string) { console.log(`      ${msg}`); }

function fail(msg: string, code: number): never {
  console.error(`\n❌  ${msg}`);
  process.exit(code);
}

// ---------------------------------------------------------------------------

async function main(): Promise<number> {
  console.log("\n==== GA40 Supabase Migration Runner ====");
  console.log(`Target   : ${describeTarget(SUPABASE_URL!)}`);
  console.log(`Folder   : ${MIGRATIONS_DIR}`);
  console.log(
    `Mode     : ${wantStatus ? "status (nothing will change)" : baselineThrough !== null ? `baseline through ${String(baselineThrough).padStart(3, "0")} (nothing will be RUN)` : "apply pending"}`,
  );
  console.log("========================================\n");

  let disk: DiskMigration[];
  try {
    disk = readMigrationsOnDisk(MIGRATIONS_DIR);
  } catch (e) {
    fail(`${(e as Error).message} Nothing has been applied.`, 1);
  }
  ok(`${disk.length} migration file(s) on disk (${disk[0].name} .. ${disk[disk.length - 1].name})`);

  await client.connect();
  await client.query(`SET statement_timeout = ${STATEMENT_TIMEOUT_MS}`);

  const lock = await client.query<{ locked: boolean }>(
    "SELECT pg_try_advisory_lock($1) AS locked",
    [ADVISORY_LOCK_KEY],
  );
  if (!lock.rows[0].locked) {
    fail("Another migration run holds the advisory lock on this project. Nothing has been applied.", 1);
  }

  // The table, and NOT migration_056 -- see the header. This is the same DDL
  // migration_056 carries, with its 008..056 backfill deliberately absent.
  //
  // ⚠️ **NOT UNDER --status.** That mode's whole promise is that it changes
  // nothing, and creating a table is a change -- a small one, but this
  // repository's recurring defect is output that is confident about something
  // it never checked, and a runner that says "nothing will change" while
  // issuing DDL is that defect in its own console. A project with no table
  // reads as no rows, which is what an empty table would have said anyway.
  const tableExists =
    (await client.query<{ reg: string | null }>("SELECT to_regclass('public.schema_migrations')::text AS reg"))
      .rows[0].reg !== null;

  if (!tableExists && wantStatus) {
    console.log("");
    console.log("schema_migrations does not exist on this project yet, so nothing is recorded.");
    console.log("Declare the baseline to create it (this RUNS no migration):");
    log(`npm run supabase:migrate -- --baseline 086`);
    return 0;
  }

  if (!tableExists) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename    TEXT        PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        checksum    TEXT
      );
    `);
    ok("schema_migrations created (empty -- no backfill; see this file's header)");
  }

  const rows = await client.query<AppliedRow>(
    "SELECT filename, coalesce(checksum, '') AS checksum FROM schema_migrations ORDER BY filename",
  );
  const appliedRows = rows.rows;
  const state = compareMigrationState(disk, appliedRows);

  console.log("");
  ok(`Already recorded : ${appliedRows.length}`);
  ok(
    `Checksum match   : ${state.comparable - state.changed.length} of ${state.comparable} comparable; ` +
      `${state.unknown.length} unknown, ${state.absent.length} with no file, ${state.miscased.length} wrong case`,
  );
  ok(`Pending          : ${state.pending.length}`);

  // -------------------------------------------------------------------------
  // Refusals -- each one leaves the project untouched
  // -------------------------------------------------------------------------

  if (state.duplicateNames.length > 0) {
    console.log("");
    console.log("schema_migrations holds rows whose filenames differ only in case:");
    for (const n of state.duplicateNames) log(`- ${n}`);
    console.log("Postgres treats them as two migrations; Windows treats the files as one.");
    console.log("Decide which spelling is real and DELETE the other before running this again.");
    return 2;
  }

  if (state.miscased.length > 0) {
    console.log("");
    console.log(`WRONG CASE (${state.miscased.length}) -- recorded under a spelling the file does not have:`);
    for (const m of state.miscased) {
      log(`! recorded: ${m.recorded}`);
      log(`  on disk : ${m.onDisk}`);
    }
    console.log("The real file is NOT recorded, so it would be treated as applied and never run.");
    console.log("Fix the row, then run this again:");
    log(`UPDATE schema_migrations SET filename = '<name on disk>' WHERE filename = '<recorded name>';`);
    return 2;
  }

  if (state.changed.length > 0) {
    console.log("");
    console.log(`CHANGED (${state.changed.length}) -- recorded, but the file no longer hashes to what was stored:`);
    for (const c of state.changed) {
      log(`! ${c.name}`);
      log(`     stored  : ${c.stored}`);
      log(`     on disk : ${c.actual}`);
    }
    console.log("");
    console.log("NOTHING HAS BEEN APPLIED. Re-applying is wrong -- most of these files are not");
    console.log("idempotent. If the edit was cosmetic (a comment, whitespace, a line ending),");
    console.log("the cloud is correct and only the record is stale -- re-record the hash:");
    log(`UPDATE schema_migrations SET checksum = '<on disk>' WHERE filename = '<file>';`);
    console.log("If the SQL now does something different, re-record the hash anyway (until you");
    console.log("do, this script stops here and cannot apply the fix either) and then write a");
    console.log("NEW migration carrying the correction forward.");
    console.log("Read the edit first if you are not sure:  git log -p -- src/db/<file>");
    return 2;
  }

  if (state.absent.length > 0 && state.pending.length > 0) {
    console.log("");
    console.log(
      `STOPPING -- ${state.absent.length} recorded migration(s) have no file, and ${state.pending.length} file(s) have no row.`,
    );
    console.log("Recorded, no file:");
    for (const a of state.absent) log(`- ${a.name}${a.nowCalled ? `   (a file on disk carries its hash: ${a.nowCalled})` : ""}`);
    console.log("Pending, no row:");
    for (const p of state.pending) log(`+ ${p.name}`);
    console.log("");
    console.log("That pair is what a RENAME looks like, and applying the second list would then");
    console.log("re-run SQL this project has already run. If it is a rename, move the row:");
    log(`UPDATE schema_migrations SET filename = '<name on disk>' WHERE filename = '<recorded name>';`);
    console.log("If the two lists are unrelated, delete the stale row and run this again:");
    log(`DELETE FROM schema_migrations WHERE filename = '<recorded name>';`);
    return 2;
  }

  // -------------------------------------------------------------------------
  // --baseline : record without running
  // -------------------------------------------------------------------------

  if (baselineThrough !== null) {
    const toRecord = selectBaseline(disk, baselineThrough);
    if (toRecord.length === 0) {
      fail(`No migration on disk is numbered ${baselineThrough} or below. Nothing recorded.`, 1);
    }
    console.log("");
    console.log(`Recording ${toRecord.length} migration(s) as applied, WITHOUT running them:`);
    log(`${toRecord[0].name} .. ${toRecord[toRecord.length - 1].name}`);
    console.log("");

    // NULL checksum, not the hash on disk. Nothing here verified what actually
    // ran on that project, and writing a hash would claim it did -- the exact
    // lie migration_056's backfill is criticised for elsewhere in this repo.
    const res = await client.query(
      `INSERT INTO schema_migrations (filename, checksum)
       SELECT unnest($1::text[]), NULL
       ON CONFLICT (filename) DO NOTHING`,
      [toRecord.map((f) => f.name)],
    );
    ok(`${res.rowCount} row(s) written, ${toRecord.length - (res.rowCount ?? 0)} already present.`);
    console.log("");
    console.log("These rows carry NO checksum, so every later run reports them as UNKNOWN.");
    console.log("That is correct: nothing hashed what actually ran on this project.");
    console.log("");
    console.log("Next: npm run supabase:migrate -- --status");
    return 0;
  }

  // -------------------------------------------------------------------------
  // Nothing pending
  // -------------------------------------------------------------------------

  if (state.pending.length === 0) {
    console.log("");
    console.log("Supabase is up to date. Nothing to do.");
    if (state.unknown.length > 0) {
      console.log("");
      console.log(`NOTE: ${state.unknown.length} recorded row(s) carry no checksum, so 'up to date' means`);
      console.log("their names are recorded -- not that their SQL ever ran on this project.");
    }
    return 0;
  }

  // -------------------------------------------------------------------------
  // The baseline guard -- the one refusal that is about THIS runner
  // -------------------------------------------------------------------------

  if (appliedRows.length === 0) {
    const appTables = await client.query<{ n: string }>(`
      SELECT count(*)::text AS n
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name NOT IN ('schema_migrations', 'spatial_ref_sys')
    `);
    const n = Number(appTables.rows[0].n);
    if (n > 0) {
      console.log("");
      console.log(`STOPPING -- schema_migrations is EMPTY, but this project already holds ${n} table(s).`);
      console.log("");
      console.log("So the schema exists and nothing says which migrations built it. Applying the");
      console.log(`${state.pending.length} pending file(s) would re-run SQL against tables that already have it, and`);
      console.log("most of these files are not idempotent.");
      console.log("");
      console.log("Declare the baseline once -- this RUNS nothing, it only records:");
      log(`npm run supabase:migrate -- --baseline 086`);
      console.log("(use the highest migration number this project actually holds), then run this");
      console.log("again and it will apply only what came after it.");
      return 2;
    }
    console.log("");
    console.log("NOTE: this project has no application tables and no recorded migrations, so the");
    console.log("whole chain is about to run from the first file. If that is not what you meant,");
    console.log("stop now (Ctrl+C) and declare a baseline instead.");
  }

  // -------------------------------------------------------------------------
  // --status stops here
  // -------------------------------------------------------------------------

  console.log("");
  console.log(`Pending (${state.pending.length}):`);
  for (const p of state.pending) log(`+ ${p.name}`);

  if (wantStatus) {
    console.log("");
    console.log("Status only -- nothing was applied. Run without --status to apply.");
    return 0;
  }

  // -------------------------------------------------------------------------
  // Apply
  // -------------------------------------------------------------------------

  console.log("");
  let applied = 0;

  for (const file of state.pending) {
    console.log(`▶  ${file.name}`);

    // A BOM reaches Postgres as a syntax error at the first character, and
    // psql strips one where `pg` does not. The checksum is of the raw bytes,
    // BOM included, so stripping it here cannot change what gets recorded.
    const sql = fs.readFileSync(file.fullPath, "utf-8").replace(/^\uFEFF/, "");

    try {
      await client.query(sql);
    } catch (e) {
      const notAttempted = state.pending.length - applied - 1;
      console.error(`\n❌  ${file.name} FAILED. Postgres said:`);
      console.error(`    ${(e as Error).message}`);
      console.error("");
      console.error("    The file rolled back and NO row was written, so re-running this script");
      console.error("    resumes at the same file once the error is fixed.");
      if (notAttempted > 0) console.error(`    Not attempted : ${notAttempted} migration(s).`);
      console.error(`    Applied this run : ${applied}`);
      return 1;
    }

    // Recorded as its own statement, because most of these files carry their
    // own COMMIT -- so there is no transaction left to enlist this INSERT in.
    // Same window Apply-Migration.ps1 has, and the same handling: name it, and
    // print the row to write by hand.
    try {
      await client.query(
        "INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2) ON CONFLICT (filename) DO NOTHING",
        [file.name, file.checksum],
      );
    } catch (e) {
      console.error(`\n❌  APPLIED, BUT NOT RECORDED: ${file.name}`);
      console.error(`    ${(e as Error).message}`);
      console.error("");
      console.error("    The migration RAN. Its row was not written, so re-running this script");
      console.error("    would apply it a second time -- and most of these files are not");
      console.error("    idempotent. Write the row first, in the Supabase SQL Editor:");
      console.error(
        `    INSERT INTO schema_migrations (filename, checksum) VALUES ('${file.name}', '${file.checksum}') ON CONFLICT (filename) DO NOTHING;`,
      );
      return 3;
    }

    ok(`applied and recorded (MD5 ${file.checksum})`);
    applied++;
  }

  console.log("");
  console.log("========================================");
  console.log(`Applied : ${applied}`);
  console.log(`Baseline: ${appliedRows.length} (were already recorded)`);
  console.log("========================================");
  console.log("");
  console.log("Next: check the app against the cloud project -- these migrations ran on");
  console.log("      Supabase only; local Docker is applied by scripts\\Apply-Migration.ps1.");
  return 0;
}

main()
  .then(async (code) => {
    await client.end().catch(() => {});
    process.exit(code);
  })
  .catch(async (e) => {
    console.error(`\n❌  ${(e as Error).message}`);
    await client.end().catch(() => {});
    process.exit(1);
  });
