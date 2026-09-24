/**
 * scripts/test-runner/runner.ts                     (Slices Propus.2, Propus.3)
 *
 * The Windows-side half of the test runner: watches `.test-runner/requests/`,
 * runs the fixed sequence a request names, and writes `.test-runner/results/`.
 * Every decision that can be made without I/O is in `./protocol.ts`, pinned by
 * `src/__tests__/test-runner-protocol.test.ts`; this file only does the I/O.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/test-runner/runner.ts --watch [--pwsh <path>]
 *   node node_modules/tsx/dist/cli.mjs scripts/test-runner/runner.ts --self-test
 *
 * Started at logon by `scripts/Invoke-TestRunner.ps1`, which the Scheduled
 * Task "\ga40prj\Test runner" runs (`scripts/Install-TestRunner.ps1`).
 *
 * ⚠️ **IT TESTS THE WORKING TREE AND NEVER CHECKS ANYTHING OUT.** A request
 * names the commit Claude committed; when HEAD is anything else the request is
 * refused, not "fixed". Uncommitted changes are listed in the result's `dirty`
 * so a red run caused by work that is not the slice's can be told apart.
 *
 * ⚠️ **ADRIAN'S DEV SERVER IS NEVER TOUCHED.** The runner's own `next dev`
 * listens on 3100 and builds into `.next/runner` (`GA40_NEXT_DIST_DIR`, read
 * by `next.config.ts`), so Next's per-distDir lock does not collide with his
 * server on 3000. His `.next/dev` is cleared only on the tsc corrupt-cache
 * tell, and only when nothing listens on 3000 and his lock file is absent —
 * deleting a cache under a live server is what poisons it
 * (`sandbox-and-toolchain.md` → `Remove-Item .next` with the server running).
 *
 * ⚠️ **EVERY STEP RUNS, EVEN AFTER A RED ONE.** The point of the runner is
 * fewer round trips; a run that stopped at the first red step would hand back
 * one failure per round trip, which is the cost it exists to remove. The one
 * exception is a step in `DEPENDENT_STEPS` (export-schema), which is only
 * meaningful after the step before it passed.
 *
 * ⚠️ **PUSH, CI AND MIGRATE-LOCAL ARE GUARDED IN `protocol.ts`, NOT HERE.**
 * (Slice Propus.3.) This file observes — the branch, `ls-remote`, the result
 * files, `schema_migrations`, the commit that added a migration — and the
 * guard decides. The push is fast-forward only and never forced; CI is read
 * with GET requests only; nothing here reaches Supabase or UAT. The GitHub
 * credential is Adrian's own, taken from `git credential fill` for the length
 * of one step, and is never written to a log, a result or a note.
 */

import { spawn, spawnSync } from "child_process";
import fs from "fs";
import net from "net";
import os from "os";
import path from "path";

import {
  ADRIAN_DEV_PORT,
  CHANNEL_DIR,
  MAX_REQUEST_BYTES,
  PROTOCOL_VERSION,
  RUNNER_DIST_DIR,
  RUNNER_DIST_ENV,
  RUNNER_PORT,
  CI_FINISH_WAIT_MS,
  CI_FIRST_RUN_WAIT_MS,
  CI_POLL_MS,
  DEPENDENT_STEPS,
  MIGRATION_PATH_RE,
  PUSH_BRANCH,
  PUSH_REMOTE,
  ciVerdict,
  classifyDevServerOutput,
  classifyTscOutput,
  decideMigrateLocal,
  decidePush,
  firstFailedStep,
  latestRunPerWorkflow,
  parseGithubRemote,
  summariseCi,
  isJestWorkerCrashOnly,
  jestArgs,
  overallStatus,
  parseRequest,
  pendingSteps,
  planSteps,
  playwrightArgs,
  refusedResult,
  resultIdForFile,
  stripAnsi,
  summariseStep,
  type CiJob,
  type CiRun,
  type DevServerTell,
  type GreenRunCandidate,
  type GuardCode,
  type PlannedStep,
  type RunRequest,
  type RunResult,
  type RunnerInfo,
  type StepResult,
} from "./protocol";

// ---- paths and constants -------------------------------------------------------

const REPO = path.resolve(__dirname, "..", "..");
const CH = path.join(REPO, CHANNEL_DIR);
const REQ_DIR = path.join(CH, "requests");
const RES_DIR = path.join(CH, "results");
const LOG_DIR = path.join(CH, "logs");
const LOCK_FILE = path.join(CH, "runner.lock");
const HEARTBEAT_FILE = path.join(CH, "heartbeat.json");
const RUNNER_LOG = path.join(CH, "runner.log");

const NODE = process.execPath;
const BIN = {
  next: path.join(REPO, "node_modules", "next", "dist", "bin", "next"),
  playwright: path.join(REPO, "node_modules", "@playwright", "test", "cli.js"),
  eslint: path.join(REPO, "node_modules", "eslint", "bin", "eslint.js"),
  tsc: path.join(REPO, "node_modules", "typescript", "bin", "tsc"),
  jest: path.join(REPO, "node_modules", "jest", "bin", "jest.js"),
};
const VERIFY_REBUILD = path.join(REPO, "scripts", "Verify-Rebuild.ps1");
const APPLY_MIGRATION = path.join(REPO, "scripts", "Apply-Migration.ps1");
const EXPORT_SCHEMA = path.join(REPO, "scripts", "Export-SupabaseSchema.ps1");
const SCHEMA_FILE = "src/db/supabase_schema_full.sql";
/** The same defaults Apply-Migration.ps1 and Export-SupabaseSchema.ps1 use. */
const DB = { container: "ga40prj-postgres", database: "ga40db", user: "postgres" };
/** The runner's own source. When either changes while idle, it exits 75 and the wrapper restarts it. */
const OWN_SOURCE = [path.join(__dirname, "runner.ts"), path.join(__dirname, "protocol.ts")];
const RELOAD_EXIT_CODE = 75;

const SCAN_MS = 2_000;
const HEARTBEAT_MS = 5_000;
const KEEP_RESULTS = 60;
const MIN = 60_000;
const TIMEOUT = {
  devStart: 3 * MIN,
  e2e: 40 * MIN,
  lint: 10 * MIN,
  tsc: 10 * MIN,
  jest: 20 * MIN,
  rebuild: 20 * MIN,
  push: 3 * MIN,
  gitNet: MIN,
  migrate: 15 * MIN,
  exportSchema: 10 * MIN,
};
/** Captured output kept in memory per process for classification; the full text is in the log file. */
const MAX_CAPTURE = 4 * 1024 * 1024;

const CHILD_ENV: NodeJS.ProcessEnv = { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" };
delete CHILD_ENV.CI; // `forbidOnly: !!process.env.CI` — the runner is not CI
/**
 * For every git command that talks to GitHub: it must fail rather than wait for
 * a person. Git Credential Manager would otherwise open a sign-in window on a
 * desktop nobody is watching, and the step would hang until its timeout.
 */
const NET_ENV: NodeJS.ProcessEnv = { ...CHILD_ENV, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never" };

function argValue(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
}
const PWSH = argValue("--pwsh") ?? "pwsh";

// ---- small I/O helpers ---------------------------------------------------------

const now = (): string => new Date().toISOString();
const rel = (p: string): string => path.relative(REPO, p).split(path.sep).join("/");

function logLine(msg: string): void {
  const line = `${now()} ${msg}\n`;
  try {
    fs.appendFileSync(RUNNER_LOG, line, "utf8");
  } catch {
    /* the log is a convenience; a full disk must not stop a run */
  }
  // Under the Scheduled Task stdout is runner.console.log; echoing there too would log everything twice.
  if (process.stdout.isTTY) process.stdout.write(line);
}

/** Write-then-rename, so a poller never reads half a file. */
function writeJsonAtomic(file: string, value: unknown): void {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, file);
}

function git(args: string[]): { ok: boolean; out: string } {
  const r = spawnSync("git", ["--no-optional-locks", ...args], { cwd: REPO, encoding: "utf8", windowsHide: true });
  return { ok: r.status === 0, out: (r.stdout ?? "").trim() };
}

function headCommit(): string | null {
  const r = git(["rev-parse", "HEAD"]);
  return r.ok && /^[0-9a-f]{40}$/i.test(r.out) ? r.out.toLowerCase() : null;
}

function dirtyPaths(): string[] {
  const r = git(["status", "--porcelain"]);
  return r.ok ? r.out.split(/\r?\n/).filter(Boolean) : ["(git status failed)"];
}

function walk(dir: string, match: (name: string) => boolean): string[] {
  const out: string[] = [];
  const visit = (d: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name !== "node_modules" && !e.name.startsWith(".")) visit(p);
      } else if (e.isFile() && match(e.name)) {
        out.push(rel(p));
      }
    }
  };
  visit(dir);
  return out.sort();
}

function portIsOpen(port: number, host = "localhost", timeoutMs = 1_500): Promise<boolean> {
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

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function killTree(pid: number | undefined): void {
  if (!pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true });
  } else {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* already gone */
    }
  }
}

function removeDir(p: string): boolean {
  try {
    fs.rmSync(p, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
  } catch {
    /* re-tested below */
  }
  return !fs.existsSync(p);
}

// ---- running one process, logged ---------------------------------------------

interface Ran {
  exitCode: number | null;
  timedOut: boolean;
  text: string;
}

function runLogged(cmd: string, args: string[], logFile: string, timeoutMs: number, env = CHILD_ENV): Promise<Ran> {
  return new Promise((resolve) => {
    const log = fs.createWriteStream(logFile, { flags: "a" });
    log.write(`\n$ ${[cmd, ...args].join(" ")}\n# started ${now()}\n`);
    let text = "";
    let timedOut = false;
    let child;
    try {
      child = spawn(cmd, args, { cwd: REPO, env, windowsHide: true });
    } catch (e) {
      log.end(`# could not start: ${(e as Error).message}\n`);
      resolve({ exitCode: null, timedOut: false, text: `could not start: ${(e as Error).message}` });
      return;
    }
    const onData = (b: Buffer): void => {
      log.write(b);
      text += b.toString("utf8");
      if (text.length > MAX_CAPTURE) text = text.slice(text.length - MAX_CAPTURE);
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child.pid);
    }, timeoutMs);
    child.once("error", (e) => {
      text += `\n${e.message}`;
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      log.end(`\n# finished ${now()} exit=${code}${timedOut ? " (timed out, killed)" : ""}\n`);
      resolve({ exitCode: code, timedOut, text });
    });
  });
}

// ---- the runner's own dev server ------------------------------------------------

interface DevServer {
  pid: number | undefined;
  ready: boolean;
  tell: DevServerTell | null;
  output: () => string;
  exited: () => boolean;
}

async function startDevServer(logFile: string, webpack: boolean): Promise<DevServer> {
  const args = [BIN.next, "dev", "--port", String(RUNNER_PORT), ...(webpack ? ["--webpack"] : [])];
  const env = { ...CHILD_ENV, [RUNNER_DIST_ENV]: RUNNER_DIST_DIR };
  const log = fs.createWriteStream(logFile, { flags: "a" });
  log.write(`\n$ node ${args.map((a) => (a.startsWith(REPO) ? rel(a) : a)).join(" ")}  (${RUNNER_DIST_ENV}=${RUNNER_DIST_DIR})\n# started ${now()}\n`);
  let text = "";
  let exited = false;
  const child = spawn(NODE, args, { cwd: REPO, env, windowsHide: true });
  const onData = (b: Buffer): void => {
    log.write(b);
    text += b.toString("utf8");
    if (text.length > MAX_CAPTURE) text = text.slice(text.length - MAX_CAPTURE);
  };
  child.stdout?.on("data", onData);
  child.stderr?.on("data", onData);
  child.once("close", (code) => {
    exited = true;
    log.end(`\n# dev server exited ${now()} code=${code}\n`);
  });
  child.once("error", (e) => {
    exited = true;
    text += `\n${e.message}`;
  });

  const deadline = Date.now() + TIMEOUT.devStart;
  let ready = false;
  let tell: DevServerTell | null = null;
  while (Date.now() < deadline && !exited) {
    await sleep(1_000);
    const c = classifyDevServerOutput(text);
    tell = c.tell;
    if (tell) break;
    if (c.ready && (await portIsOpen(RUNNER_PORT))) {
      ready = true;
      break;
    }
  }
  return { pid: child.pid, ready, tell, output: () => text, exited: () => exited };
}

async function stopDevServer(server: DevServer | null): Promise<void> {
  if (!server) return;
  killTree(server.pid);
  for (let i = 0; i < 30 && (!server.exited() || (await portIsOpen(RUNNER_PORT))); i++) await sleep(500);
}

/**
 * `next dev` rewrites `next-env.d.ts` for ITS distDir, and would add its type
 * globs to `tsconfig.json` if they were missing (they are not — the slice put
 * them there). Both are put back exactly as they were, so a run never leaves
 * Adrian a `next-env.d.ts` that imports the runner's cache.
 */
function snapshot(files: string[]): Map<string, string | null> {
  const m = new Map<string, string | null>();
  for (const f of files) m.set(f, fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null);
  return m;
}
function restore(snap: Map<string, string | null>, notes: string[]): void {
  for (const [f, before] of snap) {
    const after = fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null;
    if (after === before) continue;
    if (before === null) fs.rmSync(f, { force: true });
    else fs.writeFileSync(f, before, "utf8");
    notes.push(`restored ${rel(f)}, which next dev had rewritten for ${RUNNER_DIST_DIR}`);
  }
}

// ---- the steps ------------------------------------------------------------------

type StepOutcome = Pick<StepResult, "status" | "exitCode" | "summary" | "notes"> & { held?: GuardCode; applied?: number };

async function stepE2e(files: string[] | null, logFile: string): Promise<StepOutcome> {
  const notes: string[] = [];
  const devLog = logFile.replace(/e2e\.log$/, "dev-server.log");
  if (await portIsOpen(RUNNER_PORT)) {
    return {
      status: "error",
      exitCode: null,
      summary: `port ${RUNNER_PORT} is already in use by something that is not this run's server`,
      notes,
    };
  }
  const snap = snapshot([path.join(REPO, "next-env.d.ts"), path.join(REPO, "tsconfig.json")]);
  const runnerDevCache = path.join(REPO, RUNNER_DIST_DIR, "dev");
  let webpack = false;
  let server: DevServer | null = null;
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      server = await startDevServer(devLog, webpack);
      const startTell = server.tell;
      if (startTell === "os-error-1450" || startTell === "corrupt-cache") {
        await stopDevServer(server);
        server = null;
        if (attempt === 1) {
          return {
            status: "error",
            exitCode: null,
            summary: `dev server hit ${startTell} again after its cache was cleared (see ${rel(devLog)})`,
            notes,
          };
        }
        const cleared = removeDir(runnerDevCache);
        // 1450 is Turbopack's SST writer refused by Windows: --webpack builds no SST database at all.
        webpack = webpack || startTell === "os-error-1450";
        notes.push(
          `dev server start hit ${startTell}; ${cleared ? "cleared" : "could NOT clear"} ${RUNNER_DIST_DIR}/dev and restarted${webpack ? " with --webpack" : ""}`,
        );
        continue;
      }
      if (!server.ready) {
        const why = server.tell
          ? `dev server: ${server.tell}`
          : server.exited()
            ? "dev server exited before it was ready"
            : `dev server not ready within ${TIMEOUT.devStart / 1000}s`;
        return { status: "error", exitCode: null, summary: `${why} (see ${rel(devLog)})`, notes };
      }
      const mark = server.output().length;
      const env = { ...CHILD_ENV, E2E_BASE_URL: `http://localhost:${RUNNER_PORT}` };
      const r = await runLogged(NODE, [BIN.playwright, ...playwrightArgs(files)], logFile, TIMEOUT.e2e, env);
      const during = classifyDevServerOutput(server.output().slice(mark)).tell;
      await stopDevServer(server);
      server = null;
      if (r.exitCode !== 0 && attempt === 0 && (during === "os-error-1450" || during === "corrupt-cache")) {
        removeDir(runnerDevCache);
        webpack = webpack || during === "os-error-1450";
        notes.push(
          `dev server logged ${during} during the run; cleared ${RUNNER_DIST_DIR}/dev and re-ran e2e once${webpack ? " with --webpack" : ""}`,
        );
        continue;
      }
      if (webpack) notes.push("served with next dev --webpack");
      return {
        status: r.timedOut ? "error" : r.exitCode === 0 ? "passed" : "failed",
        exitCode: r.exitCode,
        summary: (r.timedOut ? `timed out after ${TIMEOUT.e2e / MIN} min; ` : "") + summariseStep("e2e", r.text, r.exitCode),
        notes,
      };
    }
    return { status: "error", exitCode: null, summary: "e2e did not complete in two attempts", notes };
  } finally {
    await stopDevServer(server);
    restore(snap, notes);
  }
}

async function stepLint(logFile: string): Promise<StepOutcome> {
  const r = await runLogged(NODE, [BIN.eslint], logFile, TIMEOUT.lint);
  return {
    status: r.timedOut || r.exitCode === null || r.exitCode > 1 ? "error" : r.exitCode === 0 ? "passed" : "failed",
    exitCode: r.exitCode,
    summary: (r.timedOut ? "timed out; " : "") + summariseStep("lint", r.text, r.exitCode),
    notes: [],
  };
}

/** May Adrian's `.next/dev` be cleared? Only with no server listening and no lock left behind. */
async function adrianCacheIsIdle(): Promise<boolean> {
  if (await portIsOpen(ADRIAN_DEV_PORT)) return false;
  return !fs.existsSync(path.join(REPO, ".next", "dev", "lock"));
}

async function stepTsc(logFile: string): Promise<StepOutcome> {
  const notes: string[] = [];
  const args = [BIN.tsc, "--noEmit", "-p", "tsconfig.json", "--incremental", "false"];
  let r = await runLogged(NODE, args, logFile, TIMEOUT.tsc);
  for (let attempt = 0; attempt < 1 && r.exitCode !== 0 && !r.timedOut; attempt++) {
    const c = classifyTscOutput(r.text);
    if (!c.cacheOnly) break;
    const targets: string[] = [];
    if (c.cacheRoots.includes("runner")) targets.push(path.join(REPO, RUNNER_DIST_DIR));
    const adrians = c.cacheRoots.filter((x) => x === "dev" || x === "types");
    if (adrians.length > 0 || c.cacheRoots.includes("other")) {
      if (!(await adrianCacheIsIdle())) {
        notes.push(
          `every error is under .next/ and your dev server on ${ADRIAN_DEV_PORT} is live (or left its lock), so its cache was not touched`,
        );
        return { status: "cache-only", exitCode: r.exitCode, summary: summariseStep("tsc", r.text, r.exitCode), notes };
      }
      if (adrians.includes("dev")) targets.push(path.join(REPO, ".next", "dev"));
      if (adrians.includes("types")) targets.push(path.join(REPO, ".next", "types"));
      if (c.cacheRoots.includes("other")) {
        notes.push("errors under .next/ outside dev/, types/ and runner/ — not cleared");
        return { status: "cache-only", exitCode: r.exitCode, summary: summariseStep("tsc", r.text, r.exitCode), notes };
      }
    }
    for (const t of targets) {
      notes.push(`${removeDir(t) ? "cleared" : "could NOT clear"} ${rel(t)} (every tsc error was under .next/) and re-ran tsc once`);
    }
    r = await runLogged(NODE, args, logFile, TIMEOUT.tsc);
  }
  const c = classifyTscOutput(r.text);
  const status =
    r.timedOut || r.exitCode === null ? "error" : r.exitCode === 0 ? "passed" : c.cacheOnly ? "cache-only" : "failed";
  return { status, exitCode: r.exitCode, summary: (r.timedOut ? "timed out; " : "") + summariseStep("tsc", r.text, r.exitCode), notes };
}

async function stepJest(files: string[] | null, logFile: string): Promise<StepOutcome> {
  const notes: string[] = [];
  if (await portIsOpen(ADRIAN_DEV_PORT)) {
    notes.push(`your dev server on ${ADRIAN_DEV_PORT} was up during jest (commit-charge risk, jest.config.ts → maxWorkers)`);
  }
  let r = await runLogged(NODE, [BIN.jest, ...jestArgs(files)], logFile, TIMEOUT.jest);
  if (r.exitCode !== 0 && !r.timedOut && isJestWorkerCrashOnly(r.text)) {
    notes.push("workers died at spawn with no failed test (the commit-charge tell); re-ran once with --maxWorkers=1");
    r = await runLogged(NODE, [BIN.jest, ...jestArgs(files, 1)], logFile, TIMEOUT.jest);
  }
  return {
    status: r.timedOut || r.exitCode === null ? "error" : r.exitCode === 0 ? "passed" : "failed",
    exitCode: r.exitCode,
    summary: (r.timedOut ? "timed out; " : "") + summariseStep("jest", r.text, r.exitCode),
    notes,
  };
}

async function stepVerifyRebuild(logFile: string): Promise<StepOutcome> {
  // Fixed argv: no -Keep (leaves a container), no -UpdateBaseline (rewrites a tracked file).
  const r = await runLogged(
    PWSH,
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", VERIFY_REBUILD],
    logFile,
    TIMEOUT.rebuild,
  );
  // Verify-Rebuild.ps1: 0 PASS, 1 FAIL, 2 PARTIAL, 3 baseline rewritten (never from here).
  const status = r.timedOut || r.exitCode === null ? "error" : r.exitCode === 0 ? "passed" : r.exitCode === 1 || r.exitCode === 2 ? "failed" : "error";
  return { status, exitCode: r.exitCode, summary: (r.timedOut ? "timed out; " : "") + summariseStep("verify-rebuild", r.text, r.exitCode), notes: [] };
}

// ---- push, ci, migrate-local (Slice Propus.3) --------------------------------------

function appendLog(logFile: string, text: string): void {
  try {
    fs.appendFileSync(logFile, text.endsWith("\n") ? text : `${text}\n`, "utf8");
  } catch {
    /* the log is a convenience */
  }
}

function held(code: GuardCode, message: string, notes: string[] = []): StepOutcome {
  return { status: "held", exitCode: null, summary: `held: ${code} — ${message}`, notes, held: code };
}

/** A git command that talks to origin: bounded, and never waiting on a prompt. */
function gitNet(args: string[]): { ok: boolean; out: string; err: string } {
  const r = spawnSync("git", args, { cwd: REPO, env: NET_ENV, encoding: "utf8", windowsHide: true, timeout: TIMEOUT.gitNet });
  return { ok: r.status === 0, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
}

function remoteMainCommit(): string | null {
  const r = gitNet(["ls-remote", "--heads", PUSH_REMOTE, `refs/heads/${PUSH_BRANCH}`]);
  const m = r.ok ? /^([0-9a-f]{40})\s+refs\/heads\//im.exec(r.out) : null;
  return m ? m[1].toLowerCase() : null;
}

function readResults(): GreenRunCandidate[] {
  const out: GreenRunCandidate[] = [];
  let files: string[] = [];
  try {
    files = fs.readdirSync(RES_DIR).filter((f) => f.endsWith(".json"));
  } catch {
    return out;
  }
  for (const f of files) {
    try {
      out.push(JSON.parse(fs.readFileSync(path.join(RES_DIR, f), "utf8")) as GreenRunCandidate);
    } catch {
      /* a half-written or foreign file is not evidence */
    }
  }
  return out;
}

async function stepPush(logFile: string): Promise<StepOutcome> {
  const notes: string[] = [];
  const head = headCommit();
  if (!head) return { status: "error", exitCode: null, summary: "git rev-parse HEAD failed", notes };
  const br = git(["symbolic-ref", "--short", "-q", "HEAD"]);
  const remoteMain = remoteMainCommit();
  let remoteIsAncestor = false;
  let rangeChanges: string[] = [];
  let rangeCommits = 0;
  if (remoteMain && remoteMain !== head) {
    const a = spawnSync("git", ["merge-base", "--is-ancestor", remoteMain, head], { cwd: REPO, windowsHide: true });
    remoteIsAncestor = a.status === 0;
    if (remoteIsAncestor) {
      rangeChanges = git(["diff", "--name-status", remoteMain, head]).out.split(/\r?\n/).filter(Boolean);
      rangeCommits = Number(git(["rev-list", "--count", `${remoteMain}..${head}`]).out) || 0;
    }
  }
  const decision = decidePush({
    branch: br.ok && br.out ? br.out : null,
    head,
    results: readResults(),
    remoteMain,
    remoteIsAncestor,
    rangeChanges,
    rangeCommits,
  });
  appendLog(
    logFile,
    `# push guard on ${head}: branch=${br.out || "(detached)"} origin/${PUSH_BRANCH}=${remoteMain ?? "(unknown)"} ` +
      `ancestor=${remoteIsAncestor} commits=${rangeCommits}\n${rangeChanges.map((l) => `#   ${l}`).join("\n")}\n# decision: ${JSON.stringify(decision)}`,
  );
  if (!decision.ok) return held(decision.code, decision.message, notes);
  if (decision.commits === 0) {
    return { status: "passed", exitCode: 0, summary: `${PUSH_REMOTE}/${PUSH_BRANCH} is already ${head.slice(0, 7)}; nothing to push`, notes };
  }
  // Never --force, never a refspec but main:main. git itself refuses a non-fast-forward as well.
  const r = await runLogged("git", ["push", "--porcelain", PUSH_REMOTE, `refs/heads/${PUSH_BRANCH}:refs/heads/${PUSH_BRANCH}`], logFile, TIMEOUT.push, NET_ENV);
  if (r.exitCode !== 0 || r.timedOut) {
    const last = stripAnsi(r.text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(-2).join(" / ");
    return { status: "error", exitCode: r.exitCode, summary: `git push did not complete${r.timedOut ? " (timed out)" : ""}: ${last}`, notes };
  }
  const after = remoteMainCommit();
  notes.push(after === head ? `${PUSH_REMOTE}/${PUSH_BRANCH} now reads ${head.slice(0, 7)} (ls-remote)` : `ls-remote after the push reads ${after ?? "nothing"}, not ${head.slice(0, 7)}`);
  return {
    status: after === head ? "passed" : "error",
    exitCode: 0,
    summary: `pushed ${decision.from.slice(0, 7)}..${decision.to.slice(0, 7)} (${decision.commits} commit${decision.commits === 1 ? "" : "s"}) to ${PUSH_REMOTE}/${PUSH_BRANCH}, licensed by green run ${decision.greenRun}`,
    notes,
  };
}

/**
 * Adrian's GitHub credential as git on this machine already holds it — the one
 * `git push` uses. Kept in memory for one step. Null when none is stored; the
 * step then reads anonymously, which works only for a public repository.
 */
function githubToken(): string | null {
  const r = spawnSync("git", ["credential", "fill"], {
    cwd: REPO,
    env: NET_ENV,
    input: "protocol=https\nhost=github.com\n\n",
    encoding: "utf8",
    windowsHide: true,
    timeout: TIMEOUT.gitNet,
  });
  if (r.status !== 0) return null;
  const m = /^password=(.+)$/m.exec(r.stdout ?? "");
  return m ? m[1].trim() : null;
}

async function githubGet(pathname: string, token: string | null): Promise<{ status: number; body: unknown; text: string }> {
  const res = await fetch(`https://api.github.com${pathname}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "ga40prj-test-runner",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* a job log is plain text */
  }
  return { status: res.status, body, text };
}

async function stepCi(head: string, logDir: string, logFile: string): Promise<StepOutcome> {
  const notes: string[] = [];
  const url = git(["remote", "get-url", PUSH_REMOTE]).out;
  const gh = parseGithubRemote(url);
  if (!gh) return { status: "error", exitCode: null, summary: `${PUSH_REMOTE} is not a github.com remote`, notes };
  const token = githubToken();
  if (!token) notes.push("git holds no GitHub credential for the runner's account; read anonymously");
  const base = `/repos/${gh.owner}/${gh.repo}/actions`;
  const t0 = Date.now();
  let runs: CiRun[] = [];
  for (;;) {
    let r: Awaited<ReturnType<typeof githubGet>>;
    try {
      r = await githubGet(`${base}/runs?head_sha=${head}&per_page=100`, token);
    } catch (e) {
      appendLog(logFile, `# GET runs failed: ${(e as Error).message}`);
      if (Date.now() - t0 > CI_FINISH_WAIT_MS) return { status: "error", exitCode: null, summary: `GitHub did not answer: ${(e as Error).message}`, notes };
      await sleep(CI_POLL_MS);
      continue;
    }
    if (r.status !== 200) {
      return { status: "error", exitCode: null, summary: `GitHub answered ${r.status} for ${gh.owner}/${gh.repo}'s runs`, notes };
    }
    runs = latestRunPerWorkflow(((r.body as { workflow_runs?: CiRun[] }).workflow_runs ?? []), head);
    const verdict = ciVerdict(runs);
    appendLog(logFile, `# ${now()} ${verdict}: ${summariseCi(runs)}`);
    if (verdict === "passed" || verdict === "failed") break;
    const waited = Date.now() - t0;
    if (verdict === "none" && waited > CI_FIRST_RUN_WAIT_MS) {
      return { status: "error", exitCode: null, summary: `no workflow run for ${head.slice(0, 7)} after ${CI_FIRST_RUN_WAIT_MS / MIN} min — was it pushed?`, notes };
    }
    if (waited > CI_FINISH_WAIT_MS) {
      return { status: "error", exitCode: null, summary: `still running after ${CI_FINISH_WAIT_MS / MIN} min: ${summariseCi(runs)}`, notes };
    }
    await sleep(CI_POLL_MS);
  }
  for (const run of runs) {
    notes.push(`${run.name} #${run.run_number}: ${run.conclusion} — ${run.html_url}`);
    if (run.conclusion === "success" || run.conclusion === "skipped" || run.conclusion === "neutral") continue;
    const jr = await githubGet(`${base}/runs/${run.id}/jobs?per_page=100&filter=latest`, token);
    const jobs = jr.status === 200 ? ((jr.body as { jobs?: CiJob[] }).jobs ?? []) : [];
    for (const job of jobs) {
      if (job.conclusion === "success" || job.conclusion === "skipped" || job.conclusion === "neutral") continue;
      const file = path.join(logDir, `ci-${job.id}.log`);
      let saved = false;
      try {
        const lr = await githubGet(`${base}/jobs/${job.id}/logs`, token);
        if (lr.status === 200) {
          fs.writeFileSync(file, lr.text, "utf8");
          saved = true;
        }
      } catch {
        /* reported below */
      }
      notes.push(
        `  job "${job.name}" ${job.conclusion ?? job.status}${firstFailedStep(job) ? ` at step "${firstFailedStep(job)}"` : ""} — ${saved ? `log ${rel(file)}` : "log not available"}`,
      );
    }
  }
  const verdict = ciVerdict(runs);
  return { status: verdict === "passed" ? "passed" : "failed", exitCode: null, summary: summariseCi(runs), notes };
}

/** `schema_migrations` in Adrian's local container: read-only, one SELECT. */
function appliedMigrations(): string[] | null {
  const r = spawnSync(
    "docker",
    ["exec", DB.container, "psql", "-U", DB.user, "-d", DB.database, "-t", "-A", "-c", "SELECT filename FROM schema_migrations;"],
    { cwd: REPO, encoding: "utf8", windowsHide: true, timeout: TIMEOUT.gitNet },
  );
  if (r.status !== 0) return null;
  return (r.stdout ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

function porcelainPath(line: string): string[] {
  return line.slice(3).split(" -> ").map((p) => p.replace(/^"|"$/g, ""));
}

async function stepApplyMigration(logFile: string): Promise<StepOutcome> {
  const notes: string[] = [];
  const dirtyMigrations = dirtyPaths().filter((l) => porcelainPath(l).some((p) => MIGRATION_PATH_RE.test(p)));
  const applied = appliedMigrations();
  if (applied === null) {
    return { status: "error", exitCode: null, summary: `could not read schema_migrations in ${DB.container} (is Docker running?)`, notes };
  }
  const appliedSet = new Set(applied);
  const onDisk = fs.readdirSync(path.join(REPO, "src", "db")).filter((f) => MIGRATION_PATH_RE.test(`src/db/${f}`));
  const pending = onDisk.filter((f) => !appliedSet.has(f)).sort();
  const addingCommitMessage: Record<string, string | null> = {};
  for (const f of pending) {
    const r = git(["log", "-1", "--diff-filter=A", "--format=%B", "--", `src/db/${f}`]);
    addingCommitMessage[f] = r.ok && r.out ? r.out : null;
  }
  const decision = decideMigrateLocal({ pending, dirtyMigrations, addingCommitMessage });
  appendLog(logFile, `# migrate-local guard: pending=${pending.join(",") || "(none)"} dirty=${dirtyMigrations.join(" · ") || "(none)"}\n# decision: ${JSON.stringify(decision)}`);
  if (!decision.ok) return held(decision.code, decision.message, notes);
  if (decision.apply.length === 0) {
    return { status: "passed", exitCode: 0, summary: `nothing pending: ${DB.container} records every migration in src/db`, notes, applied: 0 };
  }
  // Fixed argv: the script's own defaults are the container this guard just read.
  const r = await runLogged(PWSH, ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", APPLY_MIGRATION], logFile, TIMEOUT.migrate);
  const tally = stripAnsi(r.text).split(/\r?\n/).map((l) => l.trim()).filter((l) => /^(Applied|Failed)\s*:/.test(l)).join(", ");
  // Apply-Migration.ps1: 0 applied/nothing pending, 1 could not proceed, 2 disagreement (nothing applied), 3 applied but not recorded.
  if (r.exitCode === 3) notes.push("a migration APPLIED but its schema_migrations row was not written — do not re-run until it exists; the log prints the INSERT");
  if (r.exitCode === 2) notes.push("schema_migrations and src\\db disagree about a recorded migration; nothing was applied");
  return {
    status: r.timedOut || r.exitCode === null ? "error" : r.exitCode === 0 ? "passed" : "failed",
    exitCode: r.exitCode,
    summary: `${r.timedOut ? "timed out; " : ""}${decision.apply.join(", ")}${tally ? ` — ${tally}` : ""} (exit ${r.exitCode ?? "none"})`,
    notes,
    applied: r.exitCode === 0 ? decision.apply.length : 0,
  };
}

async function stepExportSchema(logFile: string): Promise<StepOutcome> {
  const r = await runLogged(PWSH, ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", EXPORT_SCHEMA], logFile, TIMEOUT.exportSchema);
  const changed = git(["status", "--porcelain", "--", SCHEMA_FILE]).out !== "";
  return {
    status: r.timedOut || r.exitCode === null ? "error" : r.exitCode === 0 ? "passed" : "failed",
    exitCode: r.exitCode,
    summary: `${r.timedOut ? "timed out; " : ""}${SCHEMA_FILE} ${r.exitCode === 0 ? (changed ? "regenerated — commit it" : "regenerated, unchanged") : "not regenerated"} (exit ${r.exitCode ?? "none"})`,
    notes: [],
  };
}

// ---- one request ------------------------------------------------------------------

let runnerInfo: RunnerInfo;
let current: string | null = null;

function resultFile(id: string): string {
  return path.join(RES_DIR, `${id}.json`);
}

async function runRequest(req: RunRequest, receivedAt: string): Promise<void> {
  const plan: PlannedStep[] = planSteps(req);
  const logDir = path.join(LOG_DIR, req.id);
  fs.mkdirSync(logDir, { recursive: true });
  const result: RunResult = {
    version: PROTOCOL_VERSION,
    source: "runner",
    id: req.id,
    sequence: req.sequence,
    commit: req.commit,
    only: req.only ?? null,
    status: "running",
    refusal: null,
    receivedAt,
    startedAt: now(),
    finishedAt: null,
    dirty: dirtyPaths(),
    steps: pendingSteps(plan),
    runner: runnerInfo,
  };
  const save = (): void => writeJsonAtomic(resultFile(req.id), result);
  save();
  logLine(`run ${req.id}: ${req.sequence}${req.only ? ` only=${req.only.join(",")}` : ""}`);

  let previous: { status: StepResult["status"]; applied: number } | null = null;
  for (let i = 0; i < plan.length; i++) {
    const p = plan[i];
    const s = result.steps[i];
    if (p.skipReason) continue;
    if (DEPENDENT_STEPS.includes(p.name) && (previous?.status !== "passed" || previous.applied === 0)) {
      s.status = "skipped";
      s.summary = previous?.status === "passed" ? "nothing was applied, so there is nothing to regenerate" : `the step before it ended ${previous?.status ?? "unrun"}`;
      save();
      previous = { status: "skipped", applied: 0 };
      continue;
    }
    const logFile = path.join(logDir, `${p.name}.log`);
    s.status = "running";
    s.startedAt = now();
    s.log = rel(logFile);
    save();
    const t0 = Date.now();
    let out: StepOutcome;
    try {
      switch (p.name) {
        case "e2e":
          out = await stepE2e(p.files, logFile);
          break;
        case "lint":
          out = await stepLint(logFile);
          break;
        case "tsc":
          out = await stepTsc(logFile);
          break;
        case "jest":
          out = await stepJest(p.files, logFile);
          break;
        case "verify-rebuild":
          out = await stepVerifyRebuild(logFile);
          break;
        case "push":
          out = await stepPush(logFile);
          break;
        case "ci":
          out = await stepCi(req.commit, logDir, logFile);
          break;
        case "apply-migration":
          out = await stepApplyMigration(logFile);
          break;
        case "export-schema":
          out = await stepExportSchema(logFile);
          break;
      }
    } catch (e) {
      out = { status: "error", exitCode: null, summary: `runner fault: ${(e as Error).message}`, notes: [] };
    }
    const { applied, held: heldCode, ...stepFields } = out;
    Object.assign(s, stepFields, heldCode ? { held: heldCode } : {}, { finishedAt: now(), seconds: Math.round((Date.now() - t0) / 100) / 10 });
    previous = { status: s.status, applied: applied ?? 0 };
    save();
    logLine(`run ${req.id}: ${p.name} ${s.status} — ${s.summary}`);
  }
  result.status = overallStatus(result.steps);
  result.finishedAt = now();
  save();
  logLine(`run ${req.id}: ${result.status}`);
  prune();
}

/** The runner deletes its own files — the bridge could not, before delete permission existed. */
function prune(): void {
  try {
    const results = fs
      .readdirSync(RES_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => ({ f, t: fs.statSync(path.join(RES_DIR, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    for (const { f } of results.slice(KEEP_RESULTS)) {
      fs.rmSync(path.join(RES_DIR, f), { force: true });
      fs.rmSync(path.join(LOG_DIR, f.replace(/\.json$/, "")), { recursive: true, force: true });
    }
  } catch (e) {
    logLine(`prune: ${(e as Error).message}`);
  }
}

// ---- the watch loop -------------------------------------------------------------

let scanning = false;
const sourceMtimes = OWN_SOURCE.map((f) => (fs.existsSync(f) ? fs.statSync(f).mtimeMs : 0));

function ownSourceChanged(): boolean {
  return OWN_SOURCE.some((f, i) => (fs.existsSync(f) ? fs.statSync(f).mtimeMs : 0) !== sourceMtimes[i]);
}

function scan(): void {
  if (scanning) return;
  scanning = true;
  try {
    if (current === null && ownSourceChanged()) {
      logLine(`own source changed on disk; exiting ${RELOAD_EXIT_CODE} so the wrapper restarts the new code`);
      shutdown(RELOAD_EXIT_CODE);
      return;
    }
    const files = fs.readdirSync(REQ_DIR).filter((f) => f.toLowerCase().endsWith(".json")).sort();
    if (files.length === 0) return;
    const knownE2eSpecs = walk(path.join(REPO, "e2e"), (n) => n.endsWith(".spec.ts"));
    const knownJestSuites = walk(path.join(REPO, "src", "__tests__"), (n) => /\.test\.tsx?$/.test(n));
    const head = headCommit();
    for (const fileName of files) {
      const full = path.join(REQ_DIR, fileName);
      const receivedAt = now();
      let raw = "";
      try {
        const size = fs.statSync(full).size;
        raw = size > MAX_REQUEST_BYTES ? "x".repeat(MAX_REQUEST_BYTES + 1) : fs.readFileSync(full, "utf8");
      } catch {
        continue; // vanished between readdir and read
      }
      fs.rmSync(full, { force: true });
      const outcome = parseRequest(raw, { fileName, headCommit: head, busyWith: current, knownE2eSpecs, knownJestSuites });
      if (!outcome.ok) {
        const id = outcome.id ?? resultIdForFile(fileName, `invalid-${Date.now()}`);
        let partial: { sequence?: unknown; commit?: unknown } = {};
        try {
          const o: unknown = JSON.parse(raw.replace(/^﻿/, ""));
          if (o && typeof o === "object") partial = o as typeof partial;
        } catch {
          /* already refused as malformed */
        }
        writeJsonAtomic(resultFile(id), refusedResult(id, outcome.refusal, receivedAt, runnerInfo, partial));
        logLine(`refused ${fileName}: ${outcome.refusal.code} — ${outcome.refusal.message}`);
        continue;
      }
      const req = outcome.request;
      current = req.id;
      void runRequest(req, receivedAt)
        .catch((e: unknown) => logLine(`run ${req.id}: runner fault ${(e as Error).message}`))
        .finally(() => {
          current = null;
        });
    }
  } catch (e) {
    logLine(`scan: ${(e as Error).message}`);
  } finally {
    scanning = false;
  }
}

function heartbeat(): void {
  try {
    writeJsonAtomic(HEARTBEAT_FILE, { ...runnerInfo, beatAt: now(), busyWith: current });
  } catch (e) {
    logLine(`heartbeat: ${(e as Error).message}`);
  }
}

function shutdown(code: number): never {
  try {
    const held = fs.readFileSync(LOCK_FILE, "utf8").trim();
    if (held === String(process.pid)) fs.rmSync(LOCK_FILE, { force: true });
  } catch {
    /* nothing to release */
  }
  process.exit(code);
}

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** A result left at "running" by a runner that died mid-run is closed as an error, so no poller waits on it forever. */
function closeOrphanedResults(): void {
  for (const f of fs.readdirSync(RES_DIR).filter((x) => x.endsWith(".json"))) {
    const file = path.join(RES_DIR, f);
    try {
      const r = JSON.parse(fs.readFileSync(file, "utf8")) as RunResult;
      if (r.status !== "running") continue;
      for (const s of r.steps) {
        if (s.status === "running" || s.status === "pending") {
          s.status = "error";
          s.summary = s.summary || "the runner stopped before this step finished";
        }
      }
      r.status = "error";
      r.finishedAt = now();
      writeJsonAtomic(file, r);
      logLine(`closed orphaned run ${r.id}`);
    } catch {
      /* not ours to repair */
    }
  }
}

function watch(): void {
  for (const d of [CH, REQ_DIR, RES_DIR, LOG_DIR]) fs.mkdirSync(d, { recursive: true });
  // Single instance: the task says IgnoreNew, and this makes it true for a hand-started copy too.
  try {
    fs.writeFileSync(LOCK_FILE, String(process.pid), { flag: "wx" });
  } catch {
    const other = Number(fs.readFileSync(LOCK_FILE, "utf8").trim());
    // A pid alone proves nothing after a reboot — Windows reuses them. The
    // holder is live only if it is ALSO still beating.
    const beatAge = fs.existsSync(HEARTBEAT_FILE) ? Date.now() - fs.statSync(HEARTBEAT_FILE).mtimeMs : Infinity;
    if (other && other !== process.pid && processAlive(other) && beatAge < 6 * HEARTBEAT_MS) {
      logLine(`another runner (pid ${other}) holds ${rel(LOCK_FILE)}; exiting`);
      process.exit(3);
    }
    fs.writeFileSync(LOCK_FILE, String(process.pid));
  }
  runnerInfo = {
    protocol: PROTOCOL_VERSION,
    pid: process.pid,
    host: os.hostname(),
    port: RUNNER_PORT,
    startedAt: now(),
    runnerCommit: headCommit(),
  };
  closeOrphanedResults();
  logLine(`started pid=${process.pid} port=${RUNNER_PORT} commit=${runnerInfo.runnerCommit ?? "?"} channel=${rel(CH)}`);
  heartbeat();
  setInterval(heartbeat, HEARTBEAT_MS);
  setInterval(scan, SCAN_MS);
  scan();
  for (const sig of ["SIGINT", "SIGTERM", "SIGBREAK"] as const) process.on(sig, () => shutdown(0));
}

// ---- self-test --------------------------------------------------------------------

/**
 * Run by the installer before it registers anything. It checks the machine,
 * not the protocol — jest pins the protocol — and prints only names, never a
 * value from `.env`.
 */
async function selfTest(): Promise<number> {
  const problems: string[] = [];
  const say = (ok: boolean, what: string): void => {
    process.stdout.write(`  ${ok ? "ok  " : "FAIL"} ${what}\n`);
    if (!ok) problems.push(what);
  };
  for (const [name, p] of Object.entries(BIN)) say(fs.existsSync(p), `${name}: ${rel(p)}`);
  say(fs.existsSync(VERIFY_REBUILD), `Verify-Rebuild.ps1: ${rel(VERIFY_REBUILD)}`);
  say(fs.existsSync(APPLY_MIGRATION), `Apply-Migration.ps1: ${rel(APPLY_MIGRATION)}`);
  say(fs.existsSync(EXPORT_SCHEMA), `Export-SupabaseSchema.ps1: ${rel(EXPORT_SCHEMA)}`);
  say(parseGithubRemote(git(["remote", "get-url", PUSH_REMOTE]).out) !== null, `${PUSH_REMOTE} is a github.com remote (push, ci)`);
  say(headCommit() !== null, "git rev-parse HEAD answers");
  const envFile = path.join(REPO, ".env");
  const envText = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : "";
  for (const key of ["E2E_EMAIL", "E2E_PASSWORD"]) {
    say(new RegExp(`^\\s*${key}\\s*=\\s*\\S`, "m").test(envText), `.env sets ${key} (value not read)`);
  }
  say(!(await portIsOpen(RUNNER_PORT)), `port ${RUNNER_PORT} is free`);
  const pw = spawnSync(PWSH, ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"], {
    encoding: "utf8",
    windowsHide: true,
  });
  say(pw.status === 0, `pwsh answers (${(pw.stdout ?? "").trim() || "no output"}) — needed by verify-rebuild`);
  const next = fs.readFileSync(path.join(REPO, "next.config.ts"), "utf8");
  say(next.includes(RUNNER_DIST_ENV), `next.config.ts reads ${RUNNER_DIST_ENV}`);
  const pwConfig = fs.readFileSync(path.join(REPO, "playwright.config.ts"), "utf8");
  say(pwConfig.includes("E2E_BASE_URL"), "playwright.config.ts reads E2E_BASE_URL");
  const probe = classifyDevServerOutput(stripAnsi("\u001b[32m✓\u001b[39m Ready in 586ms"));
  say(probe.ready && probe.tell === null, "protocol module loads and classifies");
  process.stdout.write(problems.length ? `\n  ${problems.length} problem(s)\n` : "\n  self-test green\n");
  return problems.length ? 1 : 0;
}

// ---- entry ------------------------------------------------------------------------

if (require.main === module) {
  if (process.argv.includes("--self-test")) {
    void selfTest().then((code) => process.exit(code));
  } else if (process.argv.includes("--watch")) {
    watch();
  } else {
    process.stderr.write("usage: runner.ts --watch [--pwsh <path>] | --self-test\n");
    process.exit(2);
  }
}
