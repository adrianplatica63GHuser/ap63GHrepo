/**
 * scripts/test-runner/runner.ts                                (Slice Propus.2)
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
 * one failure per round trip, which is the cost it exists to remove.
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
  classifyDevServerOutput,
  classifyTscOutput,
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
  type DevServerTell,
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
};
/** Captured output kept in memory per process for classification; the full text is in the log file. */
const MAX_CAPTURE = 4 * 1024 * 1024;

const CHILD_ENV: NodeJS.ProcessEnv = { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" };
delete CHILD_ENV.CI; // `forbidOnly: !!process.env.CI` — the runner is not CI

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

type StepOutcome = Pick<StepResult, "status" | "exitCode" | "summary" | "notes">;

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

  for (let i = 0; i < plan.length; i++) {
    const p = plan[i];
    const s = result.steps[i];
    if (p.skipReason) continue;
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
      }
    } catch (e) {
      out = { status: "error", exitCode: null, summary: `runner fault: ${(e as Error).message}`, notes: [] };
    }
    Object.assign(s, out, { finishedAt: now(), seconds: Math.round((Date.now() - t0) / 100) / 10 });
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
