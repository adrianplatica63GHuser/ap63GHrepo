/**
 * verify-rebuild.ts   (Slice #31.01)
 *
 * Runs the cloud rebuild path end to end against a throwaway Postgres, so a
 * break in it is found by running it rather than by needing it.
 *
 * WHY THIS EXISTS
 *   Slice #29.04 was the first thing in months that needed the Supabase
 *   rebuild path, and it found six consecutive defects in it, each of which hid
 *   the next. Every one of those files was correct as read and wrong as run,
 *   and nothing in the repository ran them: the verification order in CLAUDE.md
 *   (e2e, lint, tsc, jest) covers the application and touches none of them, and
 *   Apply-Migration.ps1 / Verify-Schema.ps1 check the local Docker database,
 *   which is migrated incrementally and so is never rebuilt from
 *   supabase_schema_full.sql at all. The rebuild path was only ever exercised
 *   by a human who needed it, at the moment they needed it, and it had months
 *   to rot between those moments.
 *
 *   Fixing six more defects by hand would have bought nothing. This is the
 *   thing that runs them.
 *
 * WHAT IT ASSERTS, EXACTLY
 *   1. Every migration file, applied in order to an empty database, succeeds.
 *   2. supabase_schema_full.sql, applied to an empty database, succeeds --
 *      on its own, including every extension it needs.
 *   3. The two databases agree, object by object, under `pg_dump -s`, except for
 *      the differences recorded in src/db/rebuild-known-differences.txt. NOT
 *      "the same number of tables": Verify-Schema.ps1 already counts tables and
 *      reports 50 declared / 52 present as OK, which is true and would not have
 *      caught any of the six. WHAT IS NOT COMPARED, because of the pg_dump flags
 *      used: anything outside schema `public`, GRANTs (--no-privileges), object
 *      ownership (--no-owner), and which extensions are installed.
 *   4. Every table declared in src/db/schema/index.ts exists in the rebuilt one.
 *   5. sync-reference-data.sql loads into a freshly rebuilt database, leaves no
 *      lookup table empty or keyless without saying why, and seeds the same ROWS
 *      the migrations seed -- also against the baseline, because today it does
 *      not.
 *   6. supabase_reset.sql leaves nothing behind AND the full schema applies
 *      again on top of it -- which is the sequence the file exists for, and
 *      which "nothing left behind" alone does not prove.
 *   7. supabase_repair_missing_tables.sql restores the thirteen tables it owns
 *      to identical definitions, changes nothing else in the database, and
 *      refuses a database that predates migration_070.
 *   8. Every lookup_* table is both cleared and refilled by the Supabase sync.
 *      A name-mention test; see the caveat on that step.
 *
 * WHAT IT WILL NEVER TOUCH
 *   Adrian runs against a live Supabase project and a local dev database. This
 *   reads no connection string from the environment -- not SUPABASE_SYNC_URL,
 *   not DATABASE_URL, not PG* -- and strips those from every psql/pg_dump child
 *   it spawns. Before it connects it requires a loopback host; after it
 *   connects, and before it creates anything, it requires that the server hold
 *   no database other than `postgres` and that `postgres` itself be EMPTY.
 *   A Supabase project fails that second test (its database is named `postgres`
 *   and is full), and so does the dev container (it holds ga40db). It drops
 *   only databases it created in this run, and it drops nothing at all on a run
 *   that refused to start.
 *
 * USAGE
 *   The script provisions nothing; it verifies against a server it is given,
 *   and it only accepts a throwaway one.
 *
 *     Local  : .\scripts\Verify-Rebuild.ps1        (starts the container, calls this)
 *     CI     : .github/workflows/db-rebuild.yml    (postgis service container)
 *     Direct : npm run db:verify-rebuild -- --port 5433 --password <pw>
 *
 * FLAGS
 *   --container <name>  run psql/pg_dump INSIDE this docker container, using its
 *                       own client binaries. Use this on Windows, where there is
 *                       no psql on PATH; --host and --port are then ignored,
 *                       because inside the container the server is on its own
 *                       127.0.0.1:5432.
 *   --wait <seconds>    how long to keep retrying the first connection while a
 *                       fresh container finishes initdb. Default 120.
 *   --host <h>          default 127.0.0.1 (loopback only, enforced)
 *   --port <p>          default 5433
 *   --user <u>          default postgres
 *   --password <p>      default 'rebuild-check' (what Verify-Rebuild.ps1 uses)
 *   --stub-postgis      run without PostGIS, and say so. See below.
 *   --update-baseline   rewrite src/db/rebuild-known-differences.txt. Never
 *                       reports a pass -- see EXIT CODES.
 *   --keep              leave the scratch databases behind for inspection
 *
 * EXIT CODES
 *   0  PASS
 *   1  FAIL -- something asserted above is not true
 *   2  PARTIAL -- everything asserted passed, but PostGIS was faked. Distinct
 *      from 0 on purpose: a caller that treats a faked run as a pass is exactly
 *      the silent skip this file is trying not to be.
 *   3  the baseline was rewritten. Not a verification run.
 *
 * THE POSTGIS PROBLEM, STATED RATHER THAN HIDDEN
 *   property_corner_geom_idx -- a GIST index over ST_SetSRID(ST_MakePoint(...))
 *   -- is the one schema object in this database that depends on PostGIS, and
 *   exactly the kind of object that rots unnoticed. So PostGIS is required by
 *   default and its absence is a hard failure. `--stub-postgis` exists because
 *   some sandboxes cannot install it (the package fetch is blocked); it
 *   substitutes scripts/testing/postgis_stub.sql, names every object it
 *   therefore did not verify, and exits 2 rather than 0. It is refused outright
 *   when CI=true, so the one thing that runs on every push can never take it.
 */

import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Objects this check cannot verify when PostGIS is stubbed.
//
// Step 1 re-derives the PostGIS surface from the .sql files themselves, with
// comments stripped, and fails if it finds a file this list does not account
// for -- so the list cannot quietly fall behind the tree, which is the only
// way a "here is what I skipped" report is worth reading.
// ---------------------------------------------------------------------------
const UNVERIFIABLE_WITHOUT_POSTGIS = [
  {
    object: "index property_corner_geom_idx",
    where: "drizzle/0001_slim_black_bolt.sql, supabase_schema_full.sql",
    detail:
      "GIST over (ST_SetSRID(ST_MakePoint(lon, lat), 4326))::geography - built over " +
      "the stub's text expression instead, so its operator class, its expression type " +
      "and its dependency on the postgis extension are unverified.",
  },
  {
    object: "backfill in migration_033_property_calculated_area.sql",
    where: "src/db/migration_033_property_calculated_area.sql",
    detail:
      "ST_MakeLine / ST_AddPoint / ST_StartPoint / ST_MakePolygon / ST_Area - planned " +
      "against stub functions. property_corner is empty on a rebuilt database so no row " +
      "is computed either way, but the real functions' argument types are unverified.",
  },
];

// The .sql files allowed to use PostGIS. Any other file that does is a signal
// that UNVERIFIABLE_WITHOUT_POSTGIS is now understating what a stubbed run skips.
const POSTGIS_ALLOWED_FILES = new Set([
  "drizzle/0001_slim_black_bolt.sql",
  "src/db/migration_033_property_calculated_area.sql",
  "src/db/supabase_schema_full.sql",
]);

// Every object scripts/testing/postgis_stub.sql creates, by exact name. Used to
// tell the stub's own leftovers apart from the application's after a reset --
// by name, not by a substring like /st_/, which would also absolve
// `latest_stamp`, `request_status` and anything else with those letters in it.
const STUB_OBJECT_NAMES = new Set([
  "geography",
  "st_makepoint",
  "st_setsrid",
  "st_makeline",
  "st_makeline_stub_sfunc",
  "st_startpoint",
  "st_addpoint",
  "st_makepolygon",
  "st_area",
]);

// Lookup tables the reference-data path deliberately leaves empty, with why.
const LOOKUP_EMPTY_EXPECTED: Record<string, string> = {
  lookup_person_person_role:
    "a whitelist over lookup_person_role that Adrian fills from the Admin UI; migration_055 " +
    "seeds nothing into it, so empty is the same state a migrated database is in",
};

// Lookup tables with a `key` column the application switches on. A reference
// load that leaves the column NULL breaks the code that reads it, and row
// counts do not notice.
const LOOKUP_KEY_REQUIRED = ["lookup_property_type", "lookup_document_type"];

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------
function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const HOST = arg("host", "127.0.0.1");
const PORT = arg("port", "5433");
const USER = arg("user", "postgres");
const PASSWORD = arg("password", "rebuild-check");
const CONTAINER = arg("container", "");
const WAIT_SECONDS = Number(arg("wait", "120"));
const STUB_POSTGIS = flag("stub-postgis");
const UPDATE_BASELINE = flag("update-baseline");
const KEEP = flag("keep");

// Repo root, found by walking up from the working directory rather than from
// __dirname: tsx runs this file as CommonJS and Node's own
// --experimental-strip-types runs it as ESM, and __dirname exists in only one.
function findRepoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i += 1) {
    if (fs.existsSync(path.join(dir, "src", "db", "supabase_reset.sql"))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  throw new Error(
    `Could not find the repo root from ${process.cwd()} - src/db/supabase_reset.sql is not above it. Run this from the project root.`,
  );
}

const REPO = findRepoRoot();
const BASELINE_REL = "src/db/rebuild-known-differences.txt";

const DB_MIGRATIONS = "ga40_rebuild_migrations";
const DB_FULL = "ga40_rebuild_full";
const DB_REPAIR = "ga40_rebuild_repair";
const DB_PRE070 = "ga40_rebuild_pre070";
const SCRATCH = [DB_MIGRATIONS, DB_FULL, DB_REPAIR, DB_PRE070];

/** Only these are ever dropped, and only if this run created them. */
const created = new Set<string>();

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------
const failures: string[] = [];
const notes: string[] = [];
let stepNo = 0;

function step(title: string) {
  stepNo += 1;
  console.log(`\n>> Step ${stepNo} - ${title}`);
}
function ok(msg: string) {
  console.log(`   OK   ${msg}`);
}
function bad(msg: string) {
  console.log(`   FAIL ${msg}`);
  failures.push(msg);
}
function info(msg: string) {
  console.log(`        ${msg}`);
}
function note(msg: string) {
  notes.push(msg);
  console.log(`   NOTE ${msg}`);
}

// ---------------------------------------------------------------------------
// Child-process plumbing
//
// TWO TRANSPORTS, because there is no psql on a Windows dev machine.
//   --container <name>  runs `docker exec <name> psql ...` -- the container's
//                       OWN client binaries, which is how every other script in
//                       this repo talks to Postgres (Apply-Migration.ps1,
//                       Verify-Schema.ps1, Export-SupabaseSchema.ps1). It is
//                       what scripts\Verify-Rebuild.ps1 uses. The first version
//                       of this file assumed psql on PATH and died on Adrian's
//                       machine with `spawnSync psql ENOENT` before it had
//                       reached step 2.
//   no --container      runs psql/pg_dump from PATH, which is what the CI job
//                       does: the ubuntu runner ships the 16 client and the
//                       server is a service container it cannot docker exec by
//                       a name it knows.
// The SQL and the assertions are identical either way; only the argv prefix
// differs. A happy side effect of the container form is that client and server
// versions cannot disagree, because they are the same install.
//
// Every child gets a scrubbed environment. DATABASE_URL and SUPABASE_SYNC_URL
// are deleted rather than merely unused, and so is every PG* variable: psql
// reads none of the first two, but PGHOST, PGDATABASE, PGSERVICE and
// PGSERVICEFILE would silently redirect everything below.
// ---------------------------------------------------------------------------
function childEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const k of Object.keys(env)) {
    if (k.startsWith("PG") || k === "DATABASE_URL" || k === "SUPABASE_SYNC_URL") {
      delete env[k];
    }
  }
  env.PGPASSWORD = PASSWORD;
  env.PGCONNECT_TIMEOUT = "10";
  return env;
}

/** Inside the container the server is on its own loopback:5432, not the published port. */
function conn(db: string): string[] {
  return CONTAINER
    ? ["-h", "127.0.0.1", "-p", "5432", "-U", USER, "-d", db]
    : ["-h", HOST, "-p", PORT, "-U", USER, "-d", db];
}

/** The command and argv for one of the two Postgres client binaries. */
function pgCommand(bin: "psql" | "pg_dump", args: string[]): [string, string[]] {
  if (!CONTAINER) return [bin, args];
  // -i so `-f -` can be fed on stdin; -e so PGPASSWORD crosses into the
  // container, since childEnv() only reaches the docker client itself.
  return ["docker", ["exec", "-i", "-e", `PGPASSWORD=${PASSWORD}`, CONTAINER, bin, ...args]];
}

function runPg(
  bin: "psql" | "pg_dump",
  args: string[],
  input?: string,
): { status: number; out: string; err: string; error?: Error } {
  const [cmd, argv] = pgCommand(bin, args);
  const r = spawnSync(cmd, argv, {
    env: childEnv(),
    input,
    encoding: "utf-8",
    maxBuffer: 256 * 1024 * 1024,
  });
  return { status: r.status ?? -1, out: r.stdout ?? "", err: r.stderr ?? "", error: r.error };
}

function psql(db: string, args: string[], input?: string): string {
  const r = runPg("psql", [...conn(db), "-v", "ON_ERROR_STOP=1", "--no-psqlrc", ...args], input);
  if (r.error) throw r.error;
  if (r.status !== 0) {
    throw new Error(`psql exited ${r.status}\n${r.err.trim()}\n${r.out.trim()}`);
  }
  return r.out;
}

function psqlTry(db: string, args: string[]): { status: number; out: string; err: string } {
  const r = runPg("psql", [...conn(db), "-v", "ON_ERROR_STOP=1", "--no-psqlrc", ...args]);
  return { status: r.status, out: r.out, err: r.err };
}

function query(db: string, sql: string): string {
  return psql(db, ["-t", "-A", "-c", sql]).trim();
}

function rows(db: string, sql: string): string[] {
  return query(db, sql)
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s !== "");
}

/**
 * Files are fed on STDIN, never by path. `psql -f <hostpath>` cannot work over
 * docker exec -- the container has no view of the repo -- and `-f -` behaves
 * identically for these files, which use no \i. It also keeps both transports
 * on one code path.
 */
function applyFile(db: string, relPath: string): void {
  psql(db, ["-f", "-"], fs.readFileSync(path.join(REPO, relPath), "utf-8"));
}

function applyText(db: string, sql: string): void {
  psql(db, ["-f", "-"], sql);
}

/** applyFile, but returning the exit status instead of throwing. */
function applyFileTry(db: string, relPath: string): { status: number; out: string; err: string } {
  const r = runPg(
    "psql",
    [...conn(db), "-v", "ON_ERROR_STOP=1", "--no-psqlrc", "-f", "-"],
    fs.readFileSync(path.join(REPO, relPath), "utf-8"),
  );
  return { status: r.status, out: r.out, err: r.err };
}

// ---------------------------------------------------------------------------
// pg_dump, and comparing two dumps OBJECT BY OBJECT
//
// An earlier version of this file compared the two dumps as a sorted bag of
// changed lines. That was wrong in a way the adversarial review demonstrated in
// one command: the baseline already contains generic lines such as
// `+ principal_object_id uuid NOT NULL,`, so deleting `created_at` from an
// unrelated table produced a "difference" that was already in the baseline and
// the run went green. Positional diffs are no better -- they churn on every
// added table until nobody reads them.
//
// So the unit of comparison is the OBJECT. pg_dump labels every one with a
// `-- Name: x; Type: TABLE; Schema: public; Owner: -` header; the text between
// headers belongs to that object. A difference is reported as
// `TABLE public.document :: - created_at ...`, which is specific to the object
// it occurs in, and stable when unrelated objects are added or removed.
// ---------------------------------------------------------------------------
function dump(db: string): string {
  const r = runPg("pg_dump", [
    ...conn(db),
    "--schema-only",
    "--no-owner",
    "--no-privileges",
    "--schema=public",
  ]);
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`pg_dump exited ${r.status}\n${r.err.trim()}`);
  return r.out;
}

/**
 * Lines that vary run to run and say nothing about the schema. Anchored
 * exactly: `\restrict <token>` is a psql meta-command pg_dump has emitted since
 * 16.10 with a token that changes every run, and the two `-- Dumped ...` lines
 * carry the server version. A loose /Dumped (by|from)/ would also erase such a
 * line from inside a function body, which is a real difference.
 */
function isNoise(l: string): boolean {
  return (
    /^\\restrict [A-Za-z0-9]+$/.test(l) ||
    /^\\unrestrict [A-Za-z0-9]+$/.test(l) ||
    /^-- Dumped from database version /.test(l) ||
    /^-- Dumped by pg_dump version /.test(l)
  );
}

const HEADER_RE = /^-- Name: (.+); Type: (.+); Schema: (.+); Owner:/;

/** Split a dump into `TYPE schema.name` -> body. Everything before the first
 *  header is `(preamble)`, which is where SET and CREATE SCHEMA live. */
function parseObjects(text: string): Map<string, string> {
  const out = new Map<string, string>();
  let key = "(preamble)";
  let buf: string[] = [];
  const flush = () => {
    // Blank lines are kept: collapsing them meant a difference that was only
    // whitespace inside a function body vanished. Lines that are exactly `--`
    // are dropped, because they are pg_dump's own header delimiters; a real
    // difference consisting solely of a bare `--` at column 0 inside a function
    // body would be invisible, and that is the one hole left in this parse.
    const body = buf.join("\n").trim();
    if (body !== "") out.set(key, (out.has(key) ? out.get(key) + "\n" : "") + body);
    buf = [];
  };
  for (const raw of text.split("\n")) {
    const l = raw.replace(/\s+$/, "");
    if (isNoise(l)) continue;
    const m = HEADER_RE.exec(l);
    if (m) {
      flush();
      key = `${m[2]} ${m[3]}.${m[1]}`;
      continue;
    }
    if (l === "--") continue; // the header's own delimiter lines
    buf.push(l);
  }
  flush();
  return out;
}

/**
 * A real line diff of two short texts, in JavaScript.
 *
 * This shelled out to diff(1) until Adrian's first run: there is no diff on
 * Windows either, and it would have been the next ENOENT after psql. Object
 * bodies are tens of lines, so a plain longest-common-subsequence table is
 * quick enough and has no dependency to be missing.
 */
function lineDiff(a: string, b: string): string[] {
  const A = a.split("\n");
  const B = b.split("\n");
  const n = A.length;
  const m = B.length;

  // lcs[i][j] = length of the longest common subsequence of A[i..] and B[j..]
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i][j] = A[i] === B[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const out: string[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push(`- ${A[i].trim()}`);
      i += 1;
    } else {
      out.push(`+ ${B[j].trim()}`);
      j += 1;
    }
  }
  for (; i < n; i += 1) out.push(`- ${A[i].trim()}`);
  for (; j < m; j += 1) out.push(`+ ${B[j].trim()}`);
  return out.filter((l) => l.trim().length > 1);
}

/**
 * Every way the two dumps disagree, one entry per differing line, each tagged
 * with the object it belongs to. Sorted, and compared as a MULTISET (sorted
 * array equality), so three identical column-order differences cannot silently
 * become two or four.
 */
function objectDifferences(aText: string, bText: string, aName: string, bName: string): string[] {
  const A = parseObjects(aText);
  const B = parseObjects(bText);
  const out: string[] = [];
  for (const key of new Set([...A.keys(), ...B.keys()])) {
    const a = A.get(key);
    const b = B.get(key);
    if (a === undefined) out.push(`${key} :: absent from ${aName}`);
    else if (b === undefined) out.push(`${key} :: absent from ${bName}`);
    else if (a !== b) for (const l of lineDiff(a, b)) out.push(`${key} :: ${l}`);
  }
  return out.sort();
}

function sameMultiset(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Database lifecycle
// ---------------------------------------------------------------------------
function dropDb(name: string): void {
  psql("postgres", ["-c", `DROP DATABASE IF EXISTS ${name} WITH (FORCE)`]);
}
function createDb(name: string): void {
  dropDb(name);
  psql("postgres", ["-c", `CREATE DATABASE ${name}`]);
  created.add(name);
}

/**
 * Every migration file, in the order a from-empty rebuild has to apply them:
 * drizzle/*.sql (the baseline schema drizzle-kit generated) and then
 * src/db/migration_*.sql by name.
 *
 * NOT the order Apply-Migration.ps1 uses -- that script only ever applies
 * src/db/migration_*.sql, against a database that already has the drizzle
 * baseline, and it bootstraps migration_056_schema_migrations.sql first when
 * the tracking table is absent. There is no script in the repo that performs
 * the order below; that is the point. This is the order a database has to be
 * buildable in for the migration files to be the source of truth they are
 * described as, and until this check nothing had ever tried it.
 */
function migrationChain(): string[] {
  const drizzle = fs
    .readdirSync(path.join(REPO, "drizzle"))
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => `drizzle/${f}`);
  const app = fs
    .readdirSync(path.join(REPO, "src", "db"))
    .filter((f) => /^migration_.*\.sql$/.test(f))
    .sort()
    .map((f) => `src/db/${f}`);
  return [...drizzle, ...app];
}

/**
 * PostGIS, or the stub standing in for it. NOTHING ELSE is installed here on
 * purpose: pg_trgm used to be created by this function, which meant neither the
 * migration chain nor supabase_schema_full.sql was ever asked to install its
 * own extensions, and a file that cannot build a database on its own looked
 * like one that could.
 */
function preparePostgis(db: string): void {
  if (STUB_POSTGIS) applyFile(db, "scripts/testing/postgis_stub.sql");
  else psql(db, ["-c", "CREATE EXTENSION IF NOT EXISTS postgis"]);
}

/**
 * supabase_schema_full.sql opens with CREATE EXTENSION postgis, which is the
 * one line that cannot run in stub mode. Only that line is removed; everything
 * else is applied exactly as committed.
 */
function fullSchemaText(): string {
  const raw = fs.readFileSync(path.join(REPO, "src/db/supabase_schema_full.sql"), "utf-8");
  if (!STUB_POSTGIS) return raw;
  return raw.replace(/^CREATE EXTENSION IF NOT EXISTS postgis;$/m, "-- (stubbed) $&");
}

/**
 * The argument text of every `<needle>...)` call, by matching parentheses. A
 * fixed-size window after the needle is not good enough: round four's exploit
 * put `localPool.query("INSERT INTO lookup_tarla ...")` a few hundred characters
 * after a `supaPool.query(` TRUNCATE, and it fell inside the window.
 */
function callArguments(code: string, needle: string): string {
  const out: string[] = [];
  let at = code.indexOf(needle);
  while (at >= 0) {
    let depth = 0;
    let i = at + needle.length - 1; // sitting on the opening paren
    for (; i < code.length; i += 1) {
      if (code[i] === "(") depth += 1;
      else if (code[i] === ")") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    out.push(code.slice(at + needle.length, i));
    at = code.indexOf(needle, at + needle.length);
  }
  return out.join("\n");
}

function stripSqlComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
}
function stripTsComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

/**
 * The container's own log, for the one failure that cannot be diagnosed from
 * psql's exit code alone. `exited 2` covers refused, timed out and password
 * authentication failed, and the postgres entrypoint says which in its log.
 */
function containerLog(name: string): string {
  const r = spawnSync("docker", ["logs", "--tail", "25", name], {
    encoding: "utf-8",
    maxBuffer: 8 * 1024 * 1024,
  });
  if (r.error) return `(could not read the log: ${r.error.message})`;
  const text = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim();
  return text === "" ? "(the container has logged nothing)" : text;
}

/**
 * The first connection, retried.
 *
 * Readiness is not the caller's job to get right, and the evidence is that it
 * is easy to get wrong: Verify-Rebuild.ps1's first version polled `pg_isready`
 * and broke out of the loop while the postgis image was still running initdb,
 * so the check reported "cannot reach a Postgres server" against a container
 * that was thirty seconds from being fine. CI's service-container health-cmd is
 * the same shape of promise from a different direction.
 *
 * So the check waits for itself, with the client it actually uses, and only
 * gives up after --wait seconds. A server that is genuinely absent still fails,
 * just later.
 */
function waitForServer(): string[] {
  const deadline = Date.now() + WAIT_SECONDS * 1000;
  let last: Error | undefined;
  let announced = false;
  for (;;) {
    try {
      return rows("postgres", "SELECT datname FROM pg_database WHERE NOT datistemplate ORDER BY datname");
    } catch (e) {
      last = e as Error;
      if (Date.now() >= deadline) throw last;
      if (!announced) {
        info(`server not accepting connections yet - retrying for up to ${WAIT_SECONDS}s`);
        announced = true;
      }
      // Synchronous, because nothing else in this file is asynchronous and a
      // sleep that yields would need every caller above it to become async.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
    }
  }
}

function tablesIn(db: string): string[] {
  return rows(
    db,
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",
  );
}

function indent(s: string): string {
  return (s || "")
    .split("\n")
    .slice(0, 40)
    .map((l) => `          ${l}`)
    .join("\n");
}

function showDiff(label: string, lines: string[], limit = 40): void {
  for (const l of lines.slice(0, limit)) info(l);
  if (lines.length > limit) info(`... and ${lines.length - limit} more ${label}`);
}

// ---------------------------------------------------------------------------
// Baseline
// ---------------------------------------------------------------------------
function renderBaseline(lines: string[]): string {
  return (
    [
      "# ga40prj - accepted differences between a database built by replaying every",
      "# migration and one built from supabase_schema_full.sql.  (Slice #31.01)",
      "#",
      "# GENERATED. Rewrite with:",
      "#   .\\scripts\\Verify-Rebuild.ps1 -UpdateBaseline",
      "# which starts the throwaway container and runs psql INSIDE it. The bare npm",
      "# form -- `npm run db:verify-rebuild -- --update-baseline` -- needs a server",
      "# already running AND psql on PATH, and there is no psql on a Windows box with",
      "# only Docker Desktop: it dies with `spawnSync psql ENOENT` before step 2.",
      "# (Slice #29.07 was handed that command and hit exactly that; the CI job passes",
      "# --container as well.) Either way the run never reports a pass, so a",
      "# re-baseline is always a deliberate act with a diff to read. Every line added",
      "# here is a difference somebody decided not to care about.",
      "#",
      "# Format:  <TYPE> <schema>.<name> :: <-|+> <line>",
      "#   `-` = only in the migration-chain database, `+` = only in the file's.",
      "# Each entry is tied to the object it occurs in, so a difference appearing in",
      "# a DIFFERENT object is a new difference even when the text is identical.",
      "#",
      "# THREE CLASSES, and there should never be a fourth.",
      "#",
      "# 1. Constraint NAMES. The chain produces drizzle's explicit names",
      "#    (person_code_unique); the dumped file carries Postgres's defaults",
      "#    (person_code_key). ACCEPTED: it changes nothing the application can do.",
      "# 2. Column ORDER on person, property, document, person_document and",
      "#    property_person. ACCEPTED, same reason.",
      "#",
      "#    1 and 2 have one cause: the dev database was built by `drizzle-kit push`,",
      "#    not by replaying these files, and supabase_schema_full.sql is generated",
      "#    from the dev database. Both would disappear if dev were rebuilt from the",
      "#    chain and the schema file regenerated. That is a slice of its own.",
      "#",
      "# 3. REFDATA lines. NOT ACCEPTED - RECORDED. These are places where",
      "#    src/db/sync-reference-data.sql seeds different rows from the ones the",
      "#    migrations seed, so a rebuilt cloud project and a migrated dev database",
      "#    hold different reference data. Slice #31.01 measured them and assigned",
      "#    the document-type half to Slice #29.07, which has now closed it:",
      "#      * lookup_document_type    - the key sets now differ by ONE row, and",
      "#        it is named below. #29.07 dropped",
      "#        `Autorizare` (migration_043 deletes that row), renamed",
      "#        `Unclassified` to `NECLASIFICAT` (migration_043 renames it) and",
      "#        added HOTARARE_ADMINISTRATIVA / DOCUMENTATIE_CADASTRALA /",
      "#        AUTORIZATIE_CONSTRUIRE, which migration_035 seeds. Two differences",
      "#        remain and both are deliberate. CERTIFICAT_DE_MACANENTUR is a typo",
      "#        row created by drizzle/0002_value_lists.sql, re-asserted by",
      "#        migration_009 and given a generated key by migration_020's",
      "#        fallback slug; a fresh project is not given it, and removing it",
      "#        from a migrated database needs a migration nobody has written.",
      "#        And sort_order differs on 21 of the 26 shared rows (measured;",
      "#        ACT_ADJUDECARE, ACT_CADASTRU and the three rows copied from",
      "#        migration_035 already agree) - which changes nothing a user sees,",
      "#        because",
      "#        `listValues` orders document-types by the UNCLASSIFIED pin and then",
      "#        by NAME and never reads sort_order for this list. (The sentence",
      "#        this replaces claimed the dropdown ordered differently in a rebuilt",
      "#        project. It does not, and did not.)",
      "#      * lookup_doc_type_person_role - 74 pairs here vs 67 from the",
      "#        migrations. STILL OPEN: it is role work rather than key work, and",
      "#        #29.07 only re-pointed the five `Autorizare` pairs at `Autorizație`",
      "#        so they still resolve.",
      "#      * lookup_property_person_role - 4 rows here, 0 from the migrations, which",
      "#        never seed the Property<->Person role whitelist at all. STILL OPEN.",
      "#    They are listed here so the check can be green on everything else while",
      "#    making it impossible for the list to grow without somebody re-baselining",
      "#    and being asked why.",
      "",
    ].join("\n") +
    lines.join("\n") +
    "\n"
  );
}

function readBaseline(p: string): string[] {
  return fs
    .readFileSync(p, "utf-8")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l !== "" && !l.startsWith("#"))
    .sort();
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
function main(): void {
  console.log("\n==========================================================");
  console.log("   ga40prj - rebuild verification  (Slice #31.01)");
  console.log("==========================================================");

  // ── Step 1: guards ──────────────────────────────────────────────────────
  step("Guards - this must be a throwaway server");

  // Host first, before any connection: a refusal that has already opened a
  // socket to the host it is refusing is not a refusal.
  const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1"]);
  if (!LOOPBACK.has(HOST)) {
    bad(`--host ${HOST} is not loopback. This check only ever runs against a database it can destroy.`);
    finish();
    return;
  }
  ok(`host ${HOST}:${PORT} is loopback`);

  if (STUB_POSTGIS && process.env.CI) {
    bad("--stub-postgis is refused when CI is set. CI runs against real PostGIS or not at all.");
    finish();
    return;
  }

  let existing: string[];
  try {
    existing = waitForServer();
  } catch (e) {
    const how = CONTAINER
      ? `docker exec ${CONTAINER} psql (the container's own client)`
      : "psql from PATH";
    // The WHOLE message, not its first line. psql puts "exited 2" on line one
    // and the reason -- refused, no such host, password authentication failed --
    // on the next, and an earlier version of this printed only the first, which
    // made a diagnosable failure undiagnosable.
    bad(
      `cannot reach a Postgres server as ${USER} via ${how}:\n${indent((e as Error).message)}\n` +
        (CONTAINER
          ? `        The container's own last 25 log lines follow, because the reason is usually there\n` +
            `        and asking for them is another round trip.\n${indent(containerLog(CONTAINER))}`
          : `        If there is no psql on this machine -- there is none on a Windows box with only ` +
            `Docker Desktop -- pass --container <name> to use the container's own binaries instead.`),
    );
    finish();
    return;
  }
  const foreign = existing.filter((d) => d !== "postgres" && !SCRATCH.includes(d));
  if (foreign.length > 0) {
    bad(
      `the server at ${HOST}:${PORT} holds ${foreign.length} database(s) this check did not create ` +
        `(${foreign.join(", ")}). It creates and drops databases, so it refuses anything that is not empty.`,
    );
    finish();
    return;
  }

  // `postgres` cannot be excluded by name, because a Supabase project's
  // database IS called `postgres`. So it is checked for emptiness instead: a
  // fresh postgis/postgis container has nothing in public, a Supabase project
  // has the whole application in it, and a pooler tunnelled to 127.0.0.1 would
  // present the latter. (An earlier version excluded the name and would have
  // accepted a cloud project while rejecting the dev database -- exactly
  // inverted. Found by the Slice #31.01 adversarial review.)
  //
  // Extension-owned relations do not count. The postgis image both entry points
  // start runs CREATE EXTENSION postgis in `postgres` on first boot, which puts
  // spatial_ref_sys and two views in public -- so the first version of this
  // guard refused the only server either entry point provides, and CI would
  // have been red on every push. (Round two of the Slice #31.01 review.)
  //
  // "Owned by an extension" has to be asked of the right catalogue row. A
  // COMPOSITE TYPE an extension defines -- PostGIS has two in public,
  // geometry_dump and valid_detail -- carries its pg_depend deptype='e' row
  // against its pg_TYPE oid, not against the pg_class row that represents it.
  // Asking only about pg_class counted both of them as somebody's data and
  // refused the postgis container the two entry points exist to start.
  // (Measured on Adrian's machine: "holds 2 object(s) in public".)
  const foreignObjects = rows(
    "postgres",
    `SELECT c.relkind::text || ' ' || c.relname
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f','c')
        AND NOT EXISTS (
          SELECT 1 FROM pg_depend d
           WHERE d.deptype='e'
             AND ((d.classid = 'pg_class'::regclass AND d.objid = c.oid)
               OR (d.classid = 'pg_type'::regclass  AND d.objid = c.reltype)))
      UNION ALL
     SELECT 'type ' || t.typname
       FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname='public' AND t.typtype IN ('e','d') AND t.typrelid = 0
        AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid=t.oid AND d.deptype='e')
      UNION ALL
     SELECT 'function ' || p.proname
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname='public' AND p.prokind IN ('f','p','a')
        AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.deptype='e')
      ORDER BY 1`,
  );
  const inPostgres = String(foreignObjects.length);
  if (inPostgres !== "0") {
    // NAMED, not counted. "holds 2 object(s)" cost a round trip and told nobody
    // which two; the answer was two PostGIS composite types and the guard's own
    // ownership test being asked of the wrong catalogue row.
    bad(
      `the \`postgres\` database on ${HOST}:${PORT} holds ${inPostgres} object(s) in public that ` +
        `no extension owns. A throwaway server has none. This looks like a real database - a ` +
        `Supabase project's database is also called \`postgres\` - and this check destroys what it ` +
        `points at. They are:\n${indent(foreignObjects.join("\n"))}`,
    );
    finish();
    return;
  }
  const leftovers = existing.filter((d) => SCRATCH.includes(d));
  if (leftovers.length > 0) {
    note(
      `${leftovers.join(", ")} was already on this server and will be dropped and rebuilt. ` +
        `If that was a --keep run you wanted to look at, stop now.`,
    );
  }
  ok("server holds nothing this check did not create, and `postgres` is empty");

  const serverVersion = query("postgres", "SHOW server_version");
  const dumpVersion = runPg("pg_dump", ["--version"]).out.trim();
  const serverMajor = serverVersion.split(".")[0];
  const dumpMajor = (dumpVersion.match(/(\d+)\./) || [])[1];
  if (serverMajor !== dumpMajor) {
    bad(`pg_dump is ${dumpVersion} but the server is ${serverVersion}. A cross-major dump is not a comparison.`);
    finish();
    return;
  }
  ok(`server ${serverVersion}, ${dumpVersion}`);

  const postgisAvailable =
    query("postgres", "SELECT count(*) FROM pg_available_extensions WHERE name = 'postgis'") !== "0";
  if (!postgisAvailable && !STUB_POSTGIS) {
    bad(
      "PostGIS is not available on this server. The one schema object that depends on it - " +
        "property_corner_geom_idx - is exactly the kind of thing that rots unnoticed, so its " +
        "absence is a failure, not a skip. Use a postgis/postgis image, or pass --stub-postgis " +
        "to run the rest and have this report say what it did not verify.",
    );
    finish();
    return;
  }
  if (STUB_POSTGIS) {
    console.log("");
    console.log("   ###  --stub-postgis: POSTGIS IS FAKE ON THIS RUN.  ###");
    console.log("   ###  The verdict below can be PARTIAL at best.     ###");
    for (const u of UNVERIFIABLE_WITHOUT_POSTGIS) info(`not verified: ${u.object}  [${u.where}]`);
  } else {
    ok("PostGIS is available");
  }

  // Re-derive the PostGIS surface from the files, with comments stripped, so
  // prose about PostGIS does not count and a bare `geometry`/`geography` column
  // does. (The review added a real geography column and the old grep missed it.)
  const sqlFiles: string[] = [];
  for (const d of ["drizzle", path.join("src", "db")]) {
    for (const f of fs.readdirSync(path.join(REPO, d))) {
      if (f.endsWith(".sql")) sqlFiles.push(path.posix.join(d.replace(/\\/g, "/"), f));
    }
  }
  const POSTGIS_USE =
    /\b(geometry|geography)\b|\bst_[a-z_]+\s*\(|USING\s+GIST|CREATE\s+EXTENSION[^;]*postgis/i;
  const usesPostgis = sqlFiles.filter((rel) =>
    POSTGIS_USE.test(stripSqlComments(fs.readFileSync(path.join(REPO, rel), "utf-8"))),
  );
  const unexpected = usesPostgis.filter((f) => !POSTGIS_ALLOWED_FILES.has(f));
  if (unexpected.length > 0) {
    bad(
      `these .sql files use PostGIS and are not accounted for in verify-rebuild.ts's ` +
        `UNVERIFIABLE_WITHOUT_POSTGIS / POSTGIS_ALLOWED_FILES: ${unexpected.join(", ")}. ` +
        `Extend both, or a --stub-postgis report understates what it skipped.`,
    );
  } else {
    ok(`PostGIS surface accounted for (${usesPostgis.length} file(s))`);
  }

  // ── Step 2: build A from the migration chain ────────────────────────────
  step(`Apply every migration in order to an empty database  ->  ${DB_MIGRATIONS}`);
  const chain = migrationChain();
  createDb(DB_MIGRATIONS);
  preparePostgis(DB_MIGRATIONS);
  for (const f of chain) {
    try {
      applyFile(DB_MIGRATIONS, f);
    } catch (e) {
      bad(`${f} failed on an empty database:\n${indent((e as Error).message)}`);
      finish();
      return;
    }
  }
  ok(`${chain.length} migration file(s) applied, none failed`);

  // ── Step 3: build B from supabase_schema_full.sql ───────────────────────
  step(`Apply supabase_schema_full.sql to an empty database  ->  ${DB_FULL}`);
  createDb(DB_FULL);
  if (STUB_POSTGIS) applyFile(DB_FULL, "scripts/testing/postgis_stub.sql");
  try {
    applyText(DB_FULL, fullSchemaText());
    ok("supabase_schema_full.sql applied cleanly, on its own");
  } catch (e) {
    bad(
      `supabase_schema_full.sql failed on an empty database. It is the from-scratch rebuild ` +
        `file: whatever it needs, it has to create.\n${indent((e as Error).message)}`,
    );
    finish();
    return;
  }

  // ── Step 4: the comparison that makes this meaningful ───────────────────
  step("pg_dump -s of both, compared object by object");
  const differences = objectDifferences(dump(DB_MIGRATIONS), dump(DB_FULL), "migrations", "full-schema");
  if (differences.length === 0) ok("the two schemas are identical");
  else info(`${differences.length} schema difference(s) - held for the baseline comparison in the last step`);

  // ── Step 5: against the declared schema ─────────────────────────────────
  step("Every table declared in src/db/schema/index.ts exists");
  const schemaText = fs.readFileSync(path.join(REPO, "src/db/schema/index.ts"), "utf-8");
  const declared = [...new Set([...schemaText.matchAll(/pgTable\(\s*"([a-z_0-9]+)"/g)].map((m) => m[1]))].sort();
  if (declared.length === 0) {
    bad("parsed 0 pgTable declarations from src/db/schema/index.ts - has the file format changed?");
  } else {
    const present = new Set(tablesIn(DB_MIGRATIONS));
    const missing = declared.filter((t) => !present.has(t));
    if (missing.length === 0) ok(`${declared.length} declared table(s), all present`);
    else bad(`declared in schema/index.ts but absent from a rebuilt database: ${missing.join(", ")}`);
  }

  // ── Step 6: the reference data actually loads ───────────────────────────
  //
  // Run, not read. Until Slice #31.01 sync-reference-data.sql truncated
  // lookup_others -- dropped by migration_052 -- on its second statement, so it
  // could not have completed against any current database. Nothing ran it, so
  // nothing said so. Row counts alone are a weak test, so the `key` slugs the
  // application switches on are checked too.
  step("src/db/sync-reference-data.sql loads into a freshly rebuilt database");
  const refRun = applyFileTry(DB_FULL, "src/db/sync-reference-data.sql");
  if (refRun.status !== 0) {
    bad(`src/db/sync-reference-data.sql exited ${refRun.status}:\n${indent(refRun.err)}`);
  } else {
    ok("applied cleanly");
    const lookupTables = rows(
      DB_FULL,
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' " +
        "AND table_type='BASE TABLE' AND table_name LIKE 'lookup\\_%' ORDER BY table_name",
    );
    const empty = lookupTables.filter((t) => query(DB_FULL, `SELECT count(*) FROM public.${t}`) === "0");
    const unexplained = empty.filter((t) => !(t in LOOKUP_EMPTY_EXPECTED));
    if (unexplained.length === 0) {
      ok(`${lookupTables.length - empty.length} of ${lookupTables.length} lookup table(s) populated`);
      for (const t of empty) info(`${t}: empty, and expected to be - ${LOOKUP_EMPTY_EXPECTED[t]}`);
    } else {
      bad(
        `still empty after the reference-data load, and nothing says why: ${unexplained.join(", ")}. ` +
          `A rebuilt project ships with them blank and the screens that read them show nothing.`,
      );
    }
    // The rows themselves, against what the migrations produce. Row counts and
    // NULL checks are weak: measured at Slice #31.01, lookup_document_type came
    // out of this file with 24 rows where the chain has 27, re-introducing a
    // type migration_043 deleted and reverting a rename it made. Nothing in the
    // repository compared them, so the two rebuild paths had been seeding
    // different reference data for months.
    for (const t of lookupTables) {
      const a = referenceRows(DB_MIGRATIONS, t);
      const b = referenceRows(DB_FULL, t);
      for (const l of multisetDiff(a, b)) differences.push(`REFDATA ${t} :: ${l}`);
    }
    const refDiffCount = differences.filter((l) => l.startsWith("REFDATA ")).length;
    if (refDiffCount === 0) ok("every lookup table holds exactly what the migrations seed");
    else info(`${refDiffCount} reference-data difference(s) - held for the baseline comparison`);

    for (const t of LOOKUP_KEY_REQUIRED) {
      if (!lookupTables.includes(t)) continue;
      const nulls = query(DB_FULL, `SELECT count(*) FROM public.${t} WHERE key IS NULL`);
      if (nulls === "0") ok(`${t}: every row has a key`);
      else
        bad(
          `${t}: ${nulls} row(s) have key IS NULL after the reference-data load. ` +
            `\`key\` is the immutable slug the application switches on - a row without one is ` +
            `invisible to the code that reads it, and a row count does not notice.`,
        );
    }
  }

  // ── Step 7: reset, and then the sequence the reset exists for ───────────
  step("supabase_reset.sql empties the database, and the full schema applies again on top");
  const resetRun = applyFileTry(DB_FULL, "src/db/supabase_reset.sql");
  if (resetRun.status !== 0) {
    bad(`supabase_reset.sql exited ${resetRun.status}:\n${indent(resetRun.err)}`);
  } else {
    ok("supabase_reset.sql exited 0 and its own guard did not fire");
    const left = rows(
      DB_FULL,
      `SELECT c.relkind::text || ' ' || c.relname
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname='public' AND c.relkind IN ('r','p','S')
          AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid=c.oid AND d.deptype='e')
        UNION ALL
       SELECT 't ' || t.typname FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
        WHERE n.nspname='public' AND t.typtype IN ('e','d') AND t.typrelid = 0
          AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid=t.oid AND d.deptype='e')
        UNION ALL
       SELECT 'f ' || p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND p.prokind='f'
          AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.deptype='e')`,
    );
    // Only in stub mode, and only by exact name. A substring test on `st_`
    // absolved application objects called `latest_...` or `request_...`.
    const isStub = (l: string) => STUB_POSTGIS && STUB_OBJECT_NAMES.has(l.slice(2));
    const stubLeft = left.filter(isStub);
    const realLeft = left.filter((l) => !isStub(l));
    if (realLeft.length === 0) ok("nothing application-owned left in public");
    else bad(`supabase_reset.sql left ${realLeft.length} object(s) behind: ${realLeft.join(", ")}`);
    if (stubLeft.length > 0) {
      note(
        `the reset left ${stubLeft.length} stub object(s) behind (${stubLeft.join(", ")}) - this ` +
          `check's own fakes. The reason it left them is real though: supabase_reset.sql drops ` +
          `tables, sequences, enums and functions, and nothing else, so a DOMAIN or a composite ` +
          `type would survive it. The application schema has neither today.`,
      );
    }
    // The sequence the file exists for: reset, then rebuild. "Nothing left
    // behind" does not prove the schema can be applied again on top.
    if (STUB_POSTGIS) applyFile(DB_FULL, "scripts/testing/postgis_stub.sql");
    try {
      applyText(DB_FULL, fullSchemaText());
      ok("supabase_schema_full.sql applied again after the reset");
    } catch (e) {
      bad(
        `supabase_schema_full.sql failed when applied after supabase_reset.sql - which is the ` +
          `one sequence both files exist for:\n${indent((e as Error).message)}`,
      );
    }
  }

  // ── Step 8: the repair script ───────────────────────────────────────────
  //
  // Compared over the WHOLE database, not just the thirteen tables the file
  // owns. An earlier version dumped only those thirteen and reported "restored
  // to identical definitions" while the file was adding a duplicate unique
  // constraint to lookup_property_type, which is outside them.
  step("supabase_repair_missing_tables.sql restores what it owns, and changes nothing else");
  const REPAIRED = [
    "help_content", "help_hint", "stamps", "stamp_member",
    "entity_metadata", "entity_provenance_log", "entity_metadata_version",
    "entity_cross_reference", "entity_tag",
    "calculation_run", "calculation_run_output",
    "time_frame_setting", "property_corner_source",
  ];
  createDb(DB_REPAIR);
  preparePostgis(DB_REPAIR);
  for (const f of chain) applyFile(DB_REPAIR, f);
  const beforeDrop = dump(DB_REPAIR);
  psql(DB_REPAIR, ["-c", REPAIRED.map((t) => `DROP TABLE IF EXISTS public.${t} CASCADE;`).join(" ")]);
  const stillThere = rows(
    DB_REPAIR,
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN (${REPAIRED.map((t) => `'${t}'`).join(",")})`,
  );
  if (stillThere.length > 0) bad(`could not drop ${stillThere.join(", ")} - the test below proves nothing`);
  const repairRun = applyFileTry(DB_REPAIR, "src/db/supabase_repair_missing_tables.sql");
  if (repairRun.status !== 0) {
    bad(
      `supabase_repair_missing_tables.sql exited ${repairRun.status} on a database missing its 13 tables:\n${indent(repairRun.err)}`,
    );
  } else {
    const d = objectDifferences(beforeDrop, dump(DB_REPAIR), "migrations", "after-repair");
    if (d.length === 0) ok(`all ${REPAIRED.length} tables restored, and the rest of the database is untouched`);
    else {
      bad(`a repaired database differs from a migrated one in ${d.length} place(s):`);
      showDiff("differences", d);
    }
  }

  // ── Step 9: the repair refuses a database that predates the migrations ──
  step("supabase_repair_missing_tables.sql refuses a database that predates migration_070");
  createDb(DB_PRE070);
  preparePostgis(DB_PRE070);
  const pre070 = chain.filter((f) => !f.includes("migration_070"));
  if (pre070.length === chain.length) {
    bad("migration_070 is not in the chain - this step is testing nothing. Has it been renamed?");
  } else {
    for (const f of pre070) applyFile(DB_PRE070, f);
    const before = new Set(tablesIn(DB_PRE070));
    const refusal = applyFileTry(DB_PRE070, "src/db/supabase_repair_missing_tables.sql");
    if (refusal.status === 0) {
      bad("the repair ran to completion on a database that still carries deleted_at. Its pre-flight did not fire.");
    } else if (!/predates migration_070/.test(refusal.err)) {
      bad(`the repair failed on a pre-070 database, but not from its pre-flight:\n${indent(refusal.err)}`);
    } else {
      ok("refused, from its own pre-flight");
      // Measured against what was already there: a pre-070 database is the
      // whole chain minus one file, so help_content and time_frame_setting
      // exist in it from migrations 026 and 063.
      const added = tablesIn(DB_PRE070).filter((t) => !before.has(t));
      if (added.length > 0) bad(`...but it created ${added.join(", ")} before refusing`);
      else ok("and created nothing before refusing");
    }
  }

  // ── Step 10: reference-data coverage of the Supabase sync ───────────────
  //
  // A NAME-MENTION TEST, AND IT SAYS SO. It cannot tell whether a table is
  // synced correctly, only whether the sync both CLEARS it and REFILLS it --
  // two separate mentions, because naming a table in the TRUNCATE list and
  // never copying it back is the exact shape that leaves a lookup table empty
  // in the cloud with nothing saying so.
  step("Every lookup_* table is both cleared and refilled by the Supabase sync");
  const lookups = rows(
    DB_MIGRATIONS,
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' " +
      "AND table_type='BASE TABLE' AND table_name LIKE 'lookup\\_%' ORDER BY table_name",
  );
  info(`${lookups.length} lookup table(s) in a rebuilt database`);
  for (const rel of ["scripts/supabase-sync.ts", "src/db/sync-reference-data.sql"]) {
    const raw = fs.readFileSync(path.join(REPO, rel), "utf-8");
    // Comments stripped: sync-reference-data.sql explains, in a comment, that
    // lookup_others was dropped, and a scanner that reads comments takes the
    // explanation for the thing it is explaining away.
    const code = rel.endsWith(".sql") ? stripSqlComments(raw) : stripTsComments(raw);
    // CLEARED: named inside a TRUNCATE statement.
    const truncates = [...code.matchAll(/TRUNCATE[\s\S]*?(?:CASCADE|;)/gi)].map((m) => m[0]).join("\n");
    const uncleared = lookups.filter((t) => !new RegExp(`\\b${t}\\b`).test(truncates));

    // REFILLED: a construct that WRITES TO THE TARGET. Three successive
    // versions of this test were defeated by the adversarial review, each in
    // one line, and the sequence is worth keeping because it is the argument
    // for where it ended up:
    //   * "the name appears anywhere"  -> beaten by leaving it in a
    //     `const PENDING = { table: "lookup_tarla" }`.
    //   * "...next to INSERT INTO or FROM" -> beaten by a
    //     `SELECT count(*) FROM lookup_tarla` against the SOURCE database.
    //   * "...next to INSERT INTO" -> beaten by
    //     `localPool.query("INSERT INTO lookup_tarla ... WHERE false")`.
    // So the INSERT now has to sit inside a `supaPool.query(...)` call, matched
    // by parentheses rather than by a fixed window, or the table has to be
    // copied by syncSimple AND listed in SIMPLE_TABLES.
    //
    // THIS IS STILL A TEXT SCAN and it is worth saying what that costs: it
    // cannot tell whether a copy is CORRECT, only whether one is written. The
    // only thing that would prove more is running supabase-sync.ts itself
    // between two throwaway databases, which is deliberately out of scope --
    // see the note in the handover for Slice #31.01.
    const targetWrites = rel.endsWith(".ts") ? callArguments(code, "supaPool.query(") : code;
    const unfilled = lookups.filter((t) => {
      if (t in LOOKUP_EMPTY_EXPECTED) return false;
      const written = new RegExp(`INSERT\\s+INTO\\s+(public\\.)?${t}\\b`, "i").test(targetWrites);
      const simple = rel.endsWith(".ts") && new RegExp(`syncSimple\\(\\s*"${t}"`).test(code);
      const listed = rel.endsWith(".ts") && new RegExp(`SIMPLE_TABLES[\\s\\S]*?"${t}"[\\s\\S]*?\\]`).test(code);
      return !(written || (simple && listed));
    });
    const named = new Set(
      [...code.matchAll(/\blookup_[a-z0-9_]+\b/g)].map((m) => m[0]),
    );
    const stale = [...named].filter((t) => !lookups.includes(t));
    if (uncleared.length === 0) ok(`${rel}: every lookup table is cleared`);
    else bad(`${rel}: never truncates ${uncleared.join(", ")} - a rebuild inherits whatever was there`);
    if (unfilled.length === 0) ok(`${rel}: every lookup table is refilled`);
    else
      bad(
        `${rel}: truncates but never refills ${unfilled.join(", ")} - those arrive empty and nothing says so`,
      );
    if (stale.length === 0) ok(`${rel}: names no table that no longer exists`);
    else bad(`${rel}: names ${stale.join(", ")}, which a rebuilt database does not have`);
  }

  // ── Step 11: everything the two paths disagree on, against the baseline ──
  //
  // WHY THERE IS A BASELINE AND NOT A BARE `must be identical`
  //   The first run found 60 schema differences, in two classes and no others:
  //   constraint NAMES (the chain produces drizzle's explicit
  //   `person_code_unique`, the file carries Postgres's default `person_code_key`)
  //   and COLUMN ORDER on five tables. Both say the same thing: the local Docker
  //   database was not built by replaying these migration files -- it was built
  //   by `drizzle-kit push`, which names nothing and orders columns its own way
  //   -- and supabase_schema_full.sql is generated from that database, so it
  //   inherits the difference. The reference-data differences have the same
  //   shape: real, known, and not fixable inside this slice.
  //
  //   Failing on those would make this check red on the day it was written and
  //   red until somebody rebuilt the dev database from the chain, which is a
  //   slice of its own. A check nobody can get to green is a check everybody
  //   stops reading. So the accepted set is committed in full and this step
  //   asserts the differences are EXACTLY it -- as a multiset, so three
  //   identical column-order differences cannot quietly become two or four, and
  //   tagged by object, so the same text in a different object is a new
  //   difference. Anything that disappears fails too: a shrinking baseline is a
  //   claim to re-check, not to assume.
  step(`Everything the two paths disagree on, against ${BASELINE_REL}`);
  differences.sort();
  const baselinePath = path.join(REPO, BASELINE_REL);
  const accepted = fs.existsSync(baselinePath) ? readBaseline(baselinePath) : [];

  if (UPDATE_BASELINE) {
    const gone = accepted.filter((l) => !differences.includes(l));
    const fresh = differences.filter((l) => !accepted.includes(l));
    fs.writeFileSync(baselinePath, renderBaseline(differences));
    note(
      `--update-baseline: ${BASELINE_REL} rewritten with ${differences.length} difference(s) ` +
        `(${fresh.length} new, ${gone.length} dropped). This run is NOT a verification.`,
    );
    showDiff("new", fresh.map((l) => `new:  ${l}`));
    showDiff("dropped", gone.map((l) => `gone: ${l}`));
  } else if (differences.length === 0 && accepted.length === 0) {
    ok("the two rebuild paths agree completely");
  } else if (sameMultiset(differences, accepted)) {
    ok(`${differences.length} difference(s), exactly those in ${BASELINE_REL}`);
    info("(constraint names, column order, and reference-data rows - see the file's header for why each is accepted)");
  } else {
    const appeared = differences.filter((l) => !accepted.includes(l));
    const vanished = accepted.filter((l) => !differences.includes(l));
    // Without this line the reader has to open the baseline file to learn which
    // side is which, and every inference below is backwards without it.
    info("`-` = only in the database built from the migrations. `+` = only in the one built from supabase_schema_full.sql.");
    if (appeared.length > 0) {
      bad(`${appeared.length} difference(s) NOT in ${BASELINE_REL}:`);
      showDiff("new differences", appeared);
    }
    if (vanished.length > 0) {
      bad(
        `${vanished.length} baselined difference(s) no longer occur. This is NOT automatically ` +
          `good news: it means either that difference was fixed, or a NEW difference produced a ` +
          `line identical to another baselined one and displaced it. Deleting a column from ` +
          `supabase_schema_full.sql does exactly that. Look at the objects, not the lines:`,
      );
      showDiff("stale entries", vanished);
    }
    if (appeared.length === 0 && vanished.length === 0) {
      bad(
        `the baseline has the right lines but the wrong number of them ` +
          `(${differences.length} found, ${accepted.length} accepted) - a difference was duplicated or lost.`,
      );
    }
    // The lines above are per-line; a collision makes them misleading on their
    // own. So print everything currently true about every object either list
    // mentions -- that is the view in which a dropped column is unmistakable.
    const objects = new Set([...appeared, ...vanished].map((l) => l.split(" :: ")[0]));
    if (objects.size > 0) {
      info(`Everything currently true about the ${objects.size} affected object(s):`);
      showDiff("lines", differences.filter((l) => objects.has(l.split(" :: ")[0])), 80);
    }
    info(`Review each. If every line is acceptable, re-baseline with --update-baseline and commit ${BASELINE_REL}.`);
  }

  finish();
}

/**
 * A lookup table's rows as comparable text: every column except the three the
 * sync regenerates, with foreign keys resolved to the referenced row's `name`
 * so two databases that do not share UUIDs can still be compared.
 */
function referenceRows(db: string, table: string): string[] {
  const cols = rows(
    db,
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='${table}'
        AND column_name NOT IN ('id','created_at','updated_at')
      ORDER BY ordinal_position`,
  );
  if (cols.length === 0) return [];
  const fks = new Map<string, string>();
  for (const line of rows(
    db,
    `SELECT kcu.column_name || '=' || ccu.table_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_name = tc.constraint_name AND kcu.constraint_schema = tc.constraint_schema
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_name = tc.constraint_name AND ccu.constraint_schema = tc.constraint_schema
      WHERE tc.table_schema='public' AND tc.table_name='${table}'
        AND kcu.table_name = tc.table_name
        AND ccu.constraint_schema = tc.table_schema
        AND tc.constraint_type='FOREIGN KEY'`,
  )) {
    const [c, t] = line.split("=");
    fks.set(c, t);
  }
  const exprs = cols.map((c) => {
    const ref = fks.get(c);
    if (!ref) return `coalesce(x.${c}::text, '<null>')`;
    // Resolved by name. A referenced table with no `name` column would leave a
    // raw UUID here, which never compares equal - so it is named instead.
    const hasName = query(
      db,
      `SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='${ref}' AND column_name='name'`,
    );
    if (hasName === "0") return `'<unresolvable fk ${c} -> ${ref}>'`;
    return `coalesce((SELECT r.name FROM public.${ref} r WHERE r.id = x.${c}), '<null>')`;
  });
  // Bracketed, because rows() trims each line and an untrimmed comparison is the
  // whole point: a leading space on a Romanian name is invisible in the
  // reference data and makes every `WHERE name = $1` lookup in supabase-sync.ts
  // insert nothing. (Round three of the Slice #31.01 review.)
  // Newlines are escaped, not just bracketed: rows() splits on \n, so a
  // description containing one became two entries and the whitespace at the new
  // line start was trimmed away again -- the same blind spot the brackets were
  // added to close. (Round four.)
  return rows(
    db,
    `SELECT '[' || replace(concat_ws(' | ', ${exprs.join(", ")}), E'\n', '\\n') || ']'
       FROM public.${table} x ORDER BY 1`,
  );
}

/** `- ` for rows only in a, `+ ` for rows only in b, respecting multiplicity. */
function multisetDiff(a: string[], b: string[]): string[] {
  const count = (xs: string[]) => {
    const m = new Map<string, number>();
    for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
    return m;
  };
  const ca = count(a);
  const cb = count(b);
  const out: string[] = [];
  for (const k of new Set([...ca.keys(), ...cb.keys()])) {
    const d = (ca.get(k) ?? 0) - (cb.get(k) ?? 0);
    for (let i = 0; i < Math.abs(d); i += 1) out.push(`${d > 0 ? "-" : "+"} ${k}`);
  }
  return out.sort();
}

function finish(): never {
  // Only what this run created, and nothing at all on a run that refused to
  // start. An earlier version dropped all four scratch names unconditionally,
  // including on the path that had just refused the server for being somebody's.
  if (!KEEP) {
    for (const db of created) {
      try {
        dropDb(db);
      } catch {
        /* nothing here is worth masking a real failure */
      }
    }
  } else if (created.size > 0) {
    console.log(`\n   (--keep: ${[...created].join(", ")} left behind)`);
  }

  console.log("\n==========================================================");
  let code = 0;
  if (failures.length > 0) {
    console.log(`   FAIL - ${failures.length} problem(s):`);
    failures.forEach((f, i) => console.log(`     ${i + 1}. ${f.split("\n")[0]}`));
    code = 1;
  } else if (UPDATE_BASELINE) {
    console.log(`   BASELINE REWRITTEN - read the diff of ${BASELINE_REL} before committing it.`);
    console.log("   This was not a verification run. Re-run without --update-baseline.");
    code = 3;
  } else if (STUB_POSTGIS) {
    console.log("   PARTIAL - everything asserted passed, but PostGIS was faked.");
    for (const u of UNVERIFIABLE_WITHOUT_POSTGIS) console.log(`     not verified: ${u.object}`);
    console.log("   Re-run against a postgis/postgis server for a PASS. (exit 2, not 0)");
    code = 2;
  } else {
    console.log("   PASS - a rebuilt database matches the declared schema.");
  }
  if (notes.length > 0) {
    console.log("");
    for (const n of notes) console.log(`   NOTE ${n}`);
  }
  console.log("==========================================================\n");
  process.exit(code);
}

// NO SIGINT HANDLER, on purpose. Everything here is spawnSync/execFileSync and
// there is not one `await` in the file, so the event loop never gets a turn
// between registration and process.exit() -- a handler could never be
// dispatched. Registering one anyway is worse than nothing: it removes Node's
// default terminate-on-SIGINT, so Ctrl-C stops doing anything at all for the
// two minutes the run takes. (Measured in round four of the Slice #31.01
// review, which is where the handler this comment replaces came from.)
// Ctrl-C therefore leaves the scratch databases behind. The next run says so
// and rebuilds them, and Verify-Rebuild.ps1 takes the whole container down.
try {
  main();
} catch (e) {
  // Anything unguarded -- a missing file, a psql that died, a bug here -- still
  // has to go through finish(), or the databases this run created are left on
  // the server and the next run reports them as somebody else's.
  bad(`unexpected failure: ${(e as Error).stack ?? String(e)}`);
  finish();
}
