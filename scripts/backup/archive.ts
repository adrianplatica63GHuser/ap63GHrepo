/**
 * scripts/backup/archive.ts                (Slice #37.11, FU-006, FU-251)
 *
 * The archive's backup and its restore drill — the I/O. Every rule it applies
 * is in `./rules.ts`, pinned by `src/__tests__/archive-backup.test.ts`.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/backup/archive.ts backup
 *   node node_modules/tsx/dist/cli.mjs scripts/backup/archive.ts drill
 *   node node_modules/tsx/dist/cli.mjs scripts/backup/archive.ts where
 *
 * Normally run by the test runner — its `backup` and `restore-drill` sequences,
 * the backup at the start of `migrate-local`, and its own daily and monthly
 * runs — or by hand through `scripts\Backup-Archive.ps1`.
 *
 * ⚠️ **THE LIVE DATABASE IS ONLY READ.** Live is touched by `pg_dump` (which
 * runs in a read-only transaction of its own) and by the SELECTs in `rules.ts`,
 * every one of them in a session started with
 * `PGOPTIONS=-c default_transaction_read_only=on`, so a writing statement would
 * be refused by Postgres itself. The dump is written to the container's /tmp and
 * copied out with `docker cp` — never `docker exec … > file`, which PowerShell
 * would re-encode (Export-SupabaseSchema.ps1's header). The live container is
 * reached as `ga40prj-postgres`, with `POSTGRES_DB`/`POSTGRES_USER` from `.env`
 * and nothing else from it; no connection string is read, and Supabase and UAT
 * are never reached.
 *
 * ⚠️ **NOTHING IS RESTORED OVER LIVE.** The drill restores into a throwaway
 * `postgis/postgis:16-3.4` container on 127.0.0.1:5434 whose data directory is
 * a tmpfs — no volume — and into a scratch folder under `.test-runner\drill\`,
 * and removes both at the end, pass or fail. Its app runs on 3200 from its own
 * build folder with every `.env` key blanked (`rules.ts` → `drillAppEnv`).
 *
 * Exit: backup 0 written · 2 could not. drill 0 passed · 1 failed (the copy is
 * not the archive) · 2 could not run. The last line is `BACKUP: …` or `DRILL: …`.
 */
import { spawn, spawnSync, type SpawnSyncReturns } from "child_process";
import crypto from "crypto";
import fs from "fs";
import net from "net";
import path from "path";

import {
  DRILL_APP_LISTS,
  DRILL_APP_PORT,
  DRILL_CONTAINER,
  DRILL_DATABASE,
  DRILL_DIST_DIR,
  DRILL_IMAGE,
  DRILL_LOG_FILE,
  DRILL_PORT,
  DUMP_FILE,
  LAST_RESULT_FILE,
  LATEST_MIGRATION_SQL,
  MANIFEST_FILE,
  MANIFEST_FORMAT,
  PAGE_PATHS_SQL,
  TABLE_COUNT_SQL,
  UPLOADS_DIR,
  backupFolderName,
  compareCounts,
  drillAppEnv,
  envFileKeys,
  reconcileDrill,
  selectPrune,
  validateManifest,
  type AppProbe,
  type Manifest,
  type ManifestFile,
  type TableCount,
} from "./rules";
import { backupRoot, listBackups, readDrillLog, type DrillLogEntry } from "./state";

const REPO = path.resolve(__dirname, "..", "..");
const LIVE_CONTAINER = "ga40prj-postgres";
const CHANNEL = path.join(REPO, ".test-runner");
const STAGING = path.join(CHANNEL, "backup-staging");
const DRILL_WORK = path.join(CHANNEL, "drill");
const READ_ONLY = "PGOPTIONS=-c default_transaction_read_only=on";
const MB = 1024 * 1024;

class Stop extends Error {}
function stop(message: string): never {
  throw new Stop(message);
}
const say = (s: string): void => {
  process.stdout.write(`${s}\n`);
};
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const mb = (bytes: number): string => (bytes / MB).toFixed(1);

// ---- the live database's names: POSTGRES_DB and POSTGRES_USER from .env, nothing else ----

function liveNames(): { database: string; user: string } {
  const out = { database: "ga40db", user: "postgres" };
  const envFile = path.join(REPO, ".env");
  if (!fs.existsSync(envFile)) return out;
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = /^\s*(POSTGRES_DB|POSTGRES_USER)\s*=\s*"?([^"#\s]+)"?/.exec(line);
    if (!m) continue;
    if (m[1] === "POSTGRES_DB") out.database = m[2];
    else out.user = m[2];
  }
  return out;
}

// ---- docker ----------------------------------------------------------------------------

function docker(args: string[], input?: string): SpawnSyncReturns<string> {
  const r = spawnSync("docker", args, { input, encoding: "utf8", maxBuffer: 256 * MB, windowsHide: true });
  if (r.error) stop(`could not start docker: ${r.error.message}`);
  return r;
}

function lastLines(s: string | null | undefined, n = 3): string {
  return (s ?? "").trim().split(/\r?\n/).slice(-n).join(" | ");
}

/** One statement through psql in a container; its single answer, parsed as JSON. */
function psqlJson<T>(container: string, user: string, database: string, sql: string, extra: string[] = []): T {
  const r = docker(
    ["exec", "-i", "-e", READ_ONLY, "-e", "PGCLIENTENCODING=UTF8", ...extra, container, "psql", "-U", user, "-d", database, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1"],
    sql,
  );
  if (r.status !== 0) stop(`psql in ${container} exited ${r.status}: ${lastLines(r.stderr)}`);
  const text = (r.stdout ?? "").trim();
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

// ---- files ----------------------------------------------------------------------------

function sha256File(p: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash("sha256");
    fs.createReadStream(p)
      .on("error", reject)
      .on("data", (b) => h.update(b))
      .on("end", () => resolve(h.digest("hex")));
  });
}

/** Every file under `dir`, relative to it, forward slashes, sorted. */
function walkFiles(dir: string): string[] {
  const out: string[] = [];
  const visit = (d: string, rel: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) visit(path.join(d, e.name), r);
      else if (e.isFile()) out.push(r);
    }
  };
  if (fs.existsSync(dir)) visit(dir, "");
  return out.sort();
}

/**
 * Copy every file of `from` into `to`, hashing the source and then the copy.
 * A copy whose hash is not its source's stops the run: a backup that is not
 * byte for byte is not one. Returns the copy's manifest entries.
 */
async function copyTree(from: string, to: string): Promise<ManifestFile[]> {
  const files: ManifestFile[] = [];
  for (const rel of walkFiles(from)) {
    const src = path.join(from, ...rel.split("/"));
    const dst = path.join(to, ...rel.split("/"));
    const before = await sha256File(src);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    const after = await sha256File(dst);
    if (after !== before) stop(`the copy of ${rel} does not hash like its source`);
    files.push({ path: rel, size: fs.statSync(dst).size, sha256: after });
  }
  return files;
}

async function hashTree(dir: string): Promise<ManifestFile[]> {
  const out: ManifestFile[] = [];
  for (const rel of walkFiles(dir)) {
    const p = path.join(dir, ...rel.split("/"));
    out.push({ path: rel, size: fs.statSync(p).size, sha256: await sha256File(p) });
  }
  return out;
}

function removeTree(p: string): void {
  fs.rmSync(p, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
}

/** Rename, retried while OneDrive or an indexer holds a handle; across volumes, copy then remove. */
async function moveDir(from: string, to: string): Promise<void> {
  for (let i = 0; ; i++) {
    try {
      fs.renameSync(from, to);
      return;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code === "EXDEV") {
        fs.cpSync(from, to, { recursive: true, errorOnExist: true, force: false });
        removeTree(from);
        return;
      }
      if ((code === "EPERM" || code === "EBUSY" || code === "EACCES") && i < 10) {
        await sleep(1_000);
        continue;
      }
      throw e;
    }
  }
}

function writeLastResult(root: string, kind: string, line: string): void {
  try {
    fs.writeFileSync(path.join(root, LAST_RESULT_FILE), `${new Date().toISOString()} ${kind} ${line}\n`, "utf8");
  } catch {
    /* a convenience for a glance in OneDrive; never a reason to fail */
  }
}

function headCommit(): string | null {
  const r = spawnSync("git", ["--no-optional-locks", "rev-parse", "HEAD"], { cwd: REPO, encoding: "utf8", windowsHide: true });
  return r.status === 0 ? r.stdout.trim() : null;
}

// ---- backup ------------------------------------------------------------------------------

function liveCounts(live: { database: string; user: string }): TableCount[] {
  return psqlJson<TableCount[]>(LIVE_CONTAINER, live.user, live.database, TABLE_COUNT_SQL);
}

async function backup(): Promise<number> {
  const { root, why } = backupRoot();
  if (!root) {
    say(`BACKUP: FAILED — ${why}`);
    return 2;
  }
  const now = new Date();
  const name = backupFolderName(now);
  const staging = path.join(STAGING, name);
  try {
    fs.mkdirSync(root, { recursive: true });
    if (fs.existsSync(path.join(root, name))) stop(`a backup named ${name} already exists`);
    const live = liveNames();
    const ping = docker(["exec", "-e", READ_ONLY, LIVE_CONTAINER, "psql", "-U", live.user, "-d", live.database, "-X", "-At", "-c", "SELECT 1"]);
    if (ping.status !== 0 || ping.stdout.trim() !== "1") stop(`cannot reach ${LIVE_CONTAINER} (is Docker running?): ${lastLines(ping.stderr)}`);

    removeTree(STAGING); // this script's own scratch, from a run that died
    fs.mkdirSync(staging, { recursive: true });
    say(`backup ${name} → ${root} (${why})`);

    const latest = String(psqlJson<unknown>(LIVE_CONTAINER, live.user, live.database, LATEST_MIGRATION_SQL) ?? "").trim() || null;
    const tmp = `/tmp/ga40-backup-${name}.dump`;
    const dumpFile = path.join(staging, DUMP_FILE);
    let tables: TableCount[] = [];
    // Counted before and after the dump: equal counts mean the dump and the
    // manifest describe the same archive. One retry, then say so and stop.
    for (let attempt = 1; ; attempt++) {
      const before = liveCounts(live);
      const d = docker(["exec", "-e", READ_ONLY, LIVE_CONTAINER, "pg_dump", "-U", live.user, "-d", live.database, "-Fc", "-f", tmp]);
      if (d.status !== 0) stop(`pg_dump exited ${d.status}: ${lastLines(d.stderr)}`);
      const cp = docker(["cp", `${LIVE_CONTAINER}:${tmp}`, dumpFile]);
      docker(["exec", LIVE_CONTAINER, "rm", "-f", tmp]);
      if (cp.status !== 0) stop(`docker cp of the dump exited ${cp.status}: ${lastLines(cp.stderr)}`);
      const after = liveCounts(live);
      const moved = compareCounts(before, after);
      if (moved.equal) {
        tables = after;
        break;
      }
      if (attempt === 2) stop(`rows moved during the dump twice (${moved.differences.slice(0, 3).join("; ")}); try again when nothing is being saved`);
      say(`rows moved during the dump (${moved.differences.length} table(s)); dumping again`);
    }
    say(`dump: ${mb(fs.statSync(dumpFile).size)} MB, ${tables.length} tables, ${tables.reduce((s, t) => s + t.rows, 0)} rows`);

    const files = await copyTree(path.join(REPO, UPLOADS_DIR), path.join(staging, UPLOADS_DIR));
    const fileBytes = files.reduce((s, f) => s + f.size, 0);
    say(`files: ${files.length} copied and hashed, ${mb(fileBytes)} MB`);

    const manifest: Manifest = {
      format: MANIFEST_FORMAT,
      createdAt: now.toISOString(),
      source: { container: LIVE_CONTAINER, database: live.database },
      appCommit: headCommit(),
      latestMigration: latest,
      dump: { file: DUMP_FILE, size: fs.statSync(dumpFile).size, sha256: await sha256File(dumpFile) },
      tables,
      files,
    };
    const v = validateManifest(manifest);
    if (!v.ok) stop(`the manifest this run built is not valid: ${v.problems.join("; ")}`);
    fs.writeFileSync(path.join(staging, MANIFEST_FILE), JSON.stringify(manifest, null, 2) + "\n", "utf8");

    // Complete before it is visible: the folder appears under the root only now,
    // with its manifest, so the newest backup is never a half-written one.
    await moveDir(staging, path.join(root, name));

    const prune = selectPrune(fs.readdirSync(root), now);
    for (const n of prune.remove) removeTree(path.join(root, n));
    const line =
      `${name} — ${tables.length} tables, ${tables.reduce((s, t) => s + t.rows, 0)} rows, dump ${mb(manifest.dump.size)} MB, ` +
      `${files.length} files (${mb(fileBytes)} MB) → ${path.join(root, name)}; ${prune.keep.length} kept, ${prune.remove.length} pruned`;
    writeLastResult(root, "backup", line);
    say(`BACKUP: ${line}`);
    return 0;
  } catch (e) {
    removeTree(staging);
    const msg = e instanceof Stop ? e.message : ((e as Error).stack ?? String(e));
    writeLastResult(root, "backup", `FAILED — ${msg.split(/\r?\n/)[0]}`);
    say(`BACKUP: FAILED — ${msg.split(/\r?\n/)[0]}`);
    if (!(e instanceof Stop)) process.stderr.write(`${msg}\n`);
    return 2;
  }
}

// ---- the drill -----------------------------------------------------------------------------

function portIsOpen(port: number, host = "127.0.0.1", timeoutMs = 1_500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    let settled = false;
    const done = (open: boolean): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

function killTree(pid: number | undefined): void {
  if (!pid) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true });
  else {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* gone */
    }
  }
}

/** Over TCP inside the container: the image's init runs a socket-only server first, so TCP answering means the real one is up. */
function drillPsql(password: string, database: string, args: string[], input?: string): SpawnSyncReturns<string> {
  return docker(
    ["exec", ...(input !== undefined ? ["-i"] : []), "-e", `PGPASSWORD=${password}`, "-e", "PGCLIENTENCODING=UTF8", DRILL_CONTAINER, "psql", "-h", "127.0.0.1", "-U", "postgres", "-d", database, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", ...args],
    input,
  );
}

function drillJson<T>(password: string, sql: string): T {
  const r = drillPsql(password, DRILL_DATABASE, [], sql);
  if (r.status !== 0) stop(`psql in ${DRILL_CONTAINER} exited ${r.status}: ${lastLines(r.stderr)}`);
  return JSON.parse((r.stdout ?? "").trim()) as T;
}

/**
 * The restored app, asked once for each entity list. Its own `next dev` on 3200
 * from its own build folder (`.next/drill`, whose type globs tsconfig.json
 * already holds), with `--webpack` so there is no Turbopack cache to half-write,
 * and every `.env` key blanked. `next-env.d.ts` and `tsconfig.json` are put back
 * exactly as they were, and the build folder is removed.
 */
async function probeApp(password: string): Promise<AppProbe[]> {
  if (await portIsOpen(DRILL_APP_PORT, "localhost")) {
    return [{ list: "server", status: null, total: null, error: `port ${DRILL_APP_PORT} is already in use` }];
  }
  const keys: string[] = [];
  for (const f of [".env", ".env.local", ".env.development", ".env.development.local"]) {
    const p = path.join(REPO, f);
    if (fs.existsSync(p)) keys.push(...envFileKeys(fs.readFileSync(p, "utf8")));
  }
  const url = `postgres://postgres:${password}@127.0.0.1:${DRILL_PORT}/${DRILL_DATABASE}`;
  const env = drillAppEnv(process.env, [...new Set(keys)], url, DRILL_DIST_DIR);
  const guarded = [path.join(REPO, "next-env.d.ts"), path.join(REPO, "tsconfig.json")];
  const snap = new Map(guarded.map((f) => [f, fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null]));
  const distDir = path.join(REPO, ...DRILL_DIST_DIR.split("/"));
  removeTree(distDir);

  const next = path.join(REPO, "node_modules", "next", "dist", "bin", "next");
  let text = "";
  let exited = false;
  const child = spawn(process.execPath, [next, "dev", "--port", String(DRILL_APP_PORT), "--webpack"], {
    cwd: REPO,
    // Next's own types require NODE_ENV on ProcessEnv; next dev sets it itself.
    env: env as NodeJS.ProcessEnv,
    windowsHide: true,
  });
  const onData = (b: Buffer): void => {
    text += b.toString("utf8");
    if (text.length > 1_000_000) text = text.slice(-1_000_000);
  };
  child.stdout?.on("data", onData);
  child.stderr?.on("data", onData);
  child.once("close", () => {
    exited = true;
  });
  const out: AppProbe[] = [];
  try {
    const deadline = Date.now() + 5 * 60_000;
    let ready = false;
    while (Date.now() < deadline && !exited) {
      await sleep(1_000);
      if (/\bReady in\b/.test(text) && (await portIsOpen(DRILL_APP_PORT, "localhost"))) {
        ready = true;
        break;
      }
    }
    if (!ready) {
      say(`app: next dev output, last lines: ${lastLines(text, 8)}`);
      return [{ list: "server", status: null, total: null, error: exited ? "next dev exited before it was ready" : "not ready within 300 s" }];
    }
    say("app: next dev is up on 3200 against the restored copy");
    for (const list of DRILL_APP_LISTS) {
      try {
        const res = await fetch(`http://localhost:${DRILL_APP_PORT}/api/${list}?limit=1`, { signal: AbortSignal.timeout(180_000) });
        let total: number | null = null;
        try {
          const body = (await res.json()) as { total?: unknown };
          total = typeof body.total === "number" ? body.total : null;
        } catch {
          /* not JSON: the status says enough */
        }
        out.push({ list, status: res.status, total });
        say(`app: GET /api/${list}?limit=1 → ${res.status}${total !== null ? `, total ${total}` : ""}`);
      } catch (e) {
        out.push({ list, status: null, total: null, error: (e as Error).message });
        say(`app: GET /api/${list} — ${(e as Error).message}`);
      }
    }
    return out;
  } finally {
    killTree(child.pid);
    for (let i = 0; i < 30 && (!exited || (await portIsOpen(DRILL_APP_PORT, "localhost"))); i++) await sleep(500);
    for (const [f, before] of snap) {
      const after = fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null;
      if (after === before) continue;
      if (before === null) fs.rmSync(f, { force: true });
      else fs.writeFileSync(f, before, "utf8");
      say(`app: restored ${path.basename(f)}, which next dev had rewritten`);
    }
    removeTree(distDir);
  }
}

function appendDrillLog(root: string, entry: DrillLogEntry): void {
  const log = readDrillLog(root);
  log.push(entry);
  fs.writeFileSync(path.join(root, DRILL_LOG_FILE), JSON.stringify(log, null, 2) + "\n", "utf8");
}

async function drill(resultId: string | null): Promise<number> {
  const { root, why } = backupRoot();
  if (!root) {
    say(`DRILL: could not run — ${why}`);
    return 2;
  }
  const newest = listBackups(root)[0];
  if (!newest) {
    say(`DRILL: could not run — no backup under ${root} yet; take one first (claude.sh request backup)`);
    return 2;
  }
  const password = crypto.randomBytes(12).toString("hex");
  const work = path.join(DRILL_WORK, resultId ?? newest.name);
  let started = false;
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(newest.dir, MANIFEST_FILE), "utf8")) as unknown;
    const v = validateManifest(raw);
    if (!v.ok) stop(`the manifest of ${newest.name} is not valid: ${v.problems.slice(0, 3).join("; ")}`);
    const manifest = v.manifest;
    say(`drill: restoring ${newest.name} (${newest.dir})`);
    const dumpPath = path.join(newest.dir, manifest.dump.file);
    const dumpSha256 = await sha256File(dumpPath);

    docker(["rm", "-f", "-v", DRILL_CONTAINER]); // a leftover from a run that died; ours by name
    if (await portIsOpen(DRILL_PORT)) stop(`port ${DRILL_PORT} is in use by something that is not the drill`);
    const run = docker([
      "run", "-d", "--name", DRILL_CONTAINER,
      "--tmpfs", "/var/lib/postgresql/data",
      "-e", `POSTGRES_PASSWORD=${password}`,
      "-p", `127.0.0.1:${DRILL_PORT}:5432`,
      DRILL_IMAGE,
    ]);
    if (run.status !== 0) stop(`docker run exited ${run.status}: ${lastLines(run.stderr)}`);
    started = true;
    let ready = false;
    for (let i = 1; i <= 180 && !ready; i++) {
      await sleep(1_000);
      const p = drillPsql(password, "postgres", ["-c", "SELECT 1"]);
      ready = p.status === 0 && p.stdout.trim() === "1";
    }
    if (!ready) stop(`${DRILL_CONTAINER} did not accept connections within 180 s: ${lastLines(docker(["logs", "--tail", "5", DRILL_CONTAINER]).stderr)}`);
    const create = drillPsql(password, "postgres", ["-c", `CREATE DATABASE ${DRILL_DATABASE} TEMPLATE template0`]);
    if (create.status !== 0) stop(`CREATE DATABASE exited ${create.status}: ${lastLines(create.stderr)}`);

    const cp = docker(["cp", dumpPath, `${DRILL_CONTAINER}:/tmp/restore.dump`]);
    if (cp.status !== 0) stop(`docker cp of the dump exited ${cp.status}: ${lastLines(cp.stderr)}`);
    const t0 = Date.now();
    const restore = docker([
      "exec", "-e", `PGPASSWORD=${password}`, DRILL_CONTAINER,
      "pg_restore", "-h", "127.0.0.1", "-U", "postgres", "-d", DRILL_DATABASE, "--no-owner", "--no-privileges", "/tmp/restore.dump",
    ]);
    const restoreErrors = (restore.stderr ?? "").split(/\r?\n/).filter((l) => /^pg_restore: error:/.test(l));
    if (restore.status !== 0 && restoreErrors.length === 0) restoreErrors.push(`pg_restore exited ${restore.status}: ${lastLines(restore.stderr)}`);
    say(`drill: pg_restore ${restore.status === 0 ? "clean" : `exit ${restore.status}, ${restoreErrors.length} error(s)`} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    for (const e of restoreErrors.slice(0, 10)) say(`  ${e}`);

    const restoredTables = drillJson<TableCount[]>(password, TABLE_COUNT_SQL);
    const pagePaths = drillJson<string[]>(password, PAGE_PATHS_SQL);

    removeTree(work);
    fs.mkdirSync(work, { recursive: true });
    fs.cpSync(path.join(newest.dir, UPLOADS_DIR), path.join(work, UPLOADS_DIR), { recursive: true });
    const restoredFiles = await hashTree(path.join(work, UPLOADS_DIR));
    say(`drill: ${restoredFiles.length} files restored into ${path.relative(REPO, work)} and hashed`);

    let liveTables: TableCount[] | null = null;
    try {
      liveTables = liveCounts(liveNames());
    } catch (e) {
      say(`drill: live not read — ${(e as Error).message}`);
    }

    const app = await probeApp(password);

    const report = reconcileDrill({
      backup: newest.name,
      manifest,
      dumpSha256,
      restoreErrors,
      restoredTables,
      liveTables,
      pagePaths,
      restoredFiles,
      app,
    });
    for (const d of report.details) say(`  ${d}`);
    for (const p of report.problems) say(`  PROBLEM ${p}`);
    appendDrillLog(root, {
      at: new Date().toISOString(),
      backup: newest.name,
      verdict: report.verdict,
      latestMigration: manifest.latestMigration,
      resultId,
      line: report.line,
    });
    writeLastResult(root, "drill", report.line);
    say(`DRILL: ${report.line}`);
    return report.verdict === "passed" ? 0 : 1;
  } catch (e) {
    const msg = e instanceof Stop ? e.message : ((e as Error).stack ?? String(e));
    writeLastResult(root, "drill", `could not run — ${msg.split(/\r?\n/)[0]}`);
    say(`DRILL: could not run — ${msg.split(/\r?\n/)[0]}`);
    if (!(e instanceof Stop)) process.stderr.write(`${msg}\n`);
    return 2;
  } finally {
    if (started) {
      const rm = spawnSync("docker", ["rm", "-f", "-v", DRILL_CONTAINER], { encoding: "utf8", windowsHide: true });
      say(`drill: ${DRILL_CONTAINER} ${rm.status === 0 ? "removed" : `NOT removed (docker rm exit ${rm.status}) — docker rm -f -v ${DRILL_CONTAINER}`}`);
    }
    removeTree(work);
  }
}

// ---- where -----------------------------------------------------------------------------------

function where(): number {
  const { root, why } = backupRoot();
  if (!root) {
    say(`WHERE: no backup folder — ${why}`);
    return 2;
  }
  const backups = listBackups(root);
  const drills = readDrillLog(root);
  say(`root: ${root} (${why})`);
  for (const b of backups) say(`  ${b.name}  ${b.latestMigration ?? "(no migration recorded)"}`);
  const last = drills[drills.length - 1];
  say(`WHERE: ${backups.length} backup(s) in ${root}; newest ${backups[0]?.name ?? "none"}; last drill ${last ? `${last.at} ${last.verdict}` : "none"}`);
  return 0;
}

// ---- entry ------------------------------------------------------------------------------------

function argValue(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
}

if (require.main === module) {
  const mode = process.argv[2];
  const resultId = argValue("--result-id");
  const run = mode === "backup" ? backup() : mode === "drill" ? drill(resultId) : mode === "where" ? Promise.resolve(where()) : null;
  if (run === null) {
    process.stderr.write("usage: archive.ts backup | drill [--result-id <id>] | where\n");
    process.exit(2);
  } else {
    void run.then(
      (code) => process.exit(code),
      (e: unknown) => {
        process.stderr.write(`${(e as Error).stack ?? String(e)}\n`);
        process.exit(2);
      },
    );
  }
}
