/**
 * scripts/test-runner/protocol.ts                              (Slice Propus.2)
 *
 * The contract between Claude and the Windows-side test runner, and every
 * decision the runner takes that can be made without touching a disk, a clock
 * or a process.
 *
 * Claude cannot run `npm run e2e` or `npx jest`: the device VM holds only the
 * Windows SWC/esbuild binaries and no Playwright browsers, and it cannot reach
 * localhost:3000 or 127.0.0.1:5432 (measured in #36.13). The one channel
 * between Claude and Windows is files in a connected folder. So Claude writes
 * a REQUEST file into `.test-runner/requests/`, `runner.ts` (started at logon
 * by the Scheduled Task that `scripts/Install-TestRunner.ps1` registers) runs
 * the sequence it names, and writes a RESULT file into `.test-runner/results/`
 * that Claude polls.
 *
 * ⚠️ **THE REQUEST IS DATA, NEVER A COMMAND LINE.** It names a sequence from
 * the fixed list below and the commit it must run on, and optionally narrows
 * the e2e/jest steps to files that ALREADY EXIST in the repository. Nothing in
 * it is ever passed to a shell, and every value that reaches an argv is either
 * a constant here or a path the runner enumerated itself. That is why unknown
 * fields are refused rather than ignored: a field this file does not know is a
 * field somebody expected to have an effect.
 *
 * ⚠️ **NOTHING HERE READS A FILE, SPAWNS A PROCESS OR ASKS THE TIME.** The
 * runner passes in what it observed (HEAD, whether it is busy, which spec files
 * exist) and gets back a decision. That is what lets
 * `src/__tests__/test-runner-protocol.test.ts` pin every refusal case without a
 * Windows box, a git repository or a dev server.
 */

export const PROTOCOL_VERSION = 1 as const;

/** The runner's own `next dev` port. Adrian's server keeps 3000. */
export const RUNNER_PORT = 3100;
/** Adrian's `npm run dev` port — read only, to decide whether his cache is live. */
export const ADRIAN_DEV_PORT = 3000;

/**
 * The runner's own `next dev` build output, handed to `next.config.ts` through
 * `GA40_NEXT_DIST_DIR`. Next 16 refuses a second `next dev` in one directory
 * ("Another next dev server is already running in this directory") by locking
 * `<distDir>/dev/lock`, so a second server needs a second distDir. It sits
 * INSIDE `.next/` so that everything which already ignores `.next/` (git,
 * ESLint, jest's haste map, `.dockerignore`) ignores it too.
 */
export const RUNNER_DIST_DIR = ".next/runner";
export const RUNNER_DIST_ENV = "GA40_NEXT_DIST_DIR";

/** Repo-relative channel folder. Gitignored. */
export const CHANNEL_DIR = ".test-runner";
export const MAX_REQUEST_BYTES = 4096;
export const MAX_ONLY_ENTRIES = 50;

export const STEPS = ["e2e", "lint", "tsc", "jest", "verify-rebuild"] as const;
export type StepName = (typeof STEPS)[number];

/**
 * The fixed list. `full` is the verification sequence from `C:\dev\CLAUDE.md`
 * → Delivering work: e2e with a server up, then lint, tsc and jest with it
 * stopped. `full-db` adds `Verify-Rebuild.ps1` for a slice that touches the
 * database — it builds a throwaway Postgres on 5433, so Adrian's data is not
 * touched. `ping` runs nothing and proves the runner is alive.
 */
export const SEQUENCES = {
  ping: [],
  full: ["e2e", "lint", "tsc", "jest"],
  "full-db": ["e2e", "lint", "tsc", "jest", "verify-rebuild"],
  static: ["lint", "tsc", "jest"],
  e2e: ["e2e"],
  jest: ["jest"],
  "verify-rebuild": ["verify-rebuild"],
} as const satisfies Record<string, readonly StepName[]>;

export type SequenceName = keyof typeof SEQUENCES;
export const SEQUENCE_NAMES = Object.keys(SEQUENCES) as SequenceName[];

export const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
export const COMMIT_RE = /^[0-9a-f]{40}$/;
/** What an `only` entry may look like before it is checked against the files that exist. */
export const ONLY_RE =
  /^(?:e2e\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.spec\.ts|src\/__tests__\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.test\.tsx?)$/;

const ALLOWED_FIELDS = ["version", "id", "sequence", "commit", "only"] as const;
const REQUIRED_FIELDS = ["version", "id", "sequence", "commit"] as const;

export interface RunRequest {
  version: typeof PROTOCOL_VERSION;
  id: string;
  sequence: SequenceName;
  commit: string;
  /** Repo-relative, forward slashes. e2e specs narrow the e2e step, jest suites the jest step. */
  only?: string[];
}

export type RefusalCode =
  | "too-large"
  | "malformed-json"
  | "not-an-object"
  | "unknown-field"
  | "missing-field"
  | "unsupported-version"
  | "bad-id"
  | "id-filename-mismatch"
  | "unknown-sequence"
  | "bad-commit"
  | "bad-only"
  | "only-not-applicable"
  | "busy"
  | "head-unknown"
  | "head-mismatch";

export interface Refusal {
  code: RefusalCode;
  message: string;
}

export interface RequestContext {
  /** The request's file name, e.g. `20260924T153000Z-4711.json`. */
  fileName: string;
  /** `git rev-parse HEAD` at the moment of reading, or null when git could not answer. */
  headCommit: string | null;
  /** The id of the request being run right now, or null when idle. */
  busyWith: string | null;
  /** Repo-relative, forward slashes: every `e2e/**\/*.spec.ts` that exists. */
  knownE2eSpecs: readonly string[];
  /** Repo-relative, forward slashes: every `src/__tests__/**\/*.test.ts(x)` that exists. */
  knownJestSuites: readonly string[];
}

export type ParseOutcome =
  | { ok: true; request: RunRequest }
  | { ok: false; refusal: Refusal; id: string | null };

function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

function refuse(code: RefusalCode, message: string, id: string | null = null): ParseOutcome {
  return { ok: false, refusal: { code, message }, id };
}

/**
 * The file-name stem to write a refusal under when the request's own id cannot
 * be trusted. Claude named the file, so the stem is what Claude will look for.
 */
export function resultIdForFile(fileName: string, fallback: string): string {
  const stem = fileName.replace(/\.json$/i, "");
  return ID_RE.test(stem) ? stem : fallback;
}

/**
 * Validate one request file's text. Checks run in a fixed order — shape first,
 * then "is the runner free", then "is HEAD the commit asked for" — so that a
 * malformed request is always reported as malformed, whatever else is true.
 */
export function parseRequest(raw: string, ctx: RequestContext): ParseOutcome {
  if (byteLength(raw) > MAX_REQUEST_BYTES) {
    return refuse("too-large", `A request is at most ${MAX_REQUEST_BYTES} bytes; this one is ${byteLength(raw)}.`);
  }
  const text = raw.replace(/^\uFEFF/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return refuse("malformed-json", `Not JSON: ${(e as Error).message}`);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return refuse("not-an-object", "A request is one JSON object.");
  }
  const obj = parsed as Record<string, unknown>;
  const rawId = typeof obj.id === "string" && ID_RE.test(obj.id) ? obj.id : null;

  const unknown = Object.keys(obj).filter((k) => !(ALLOWED_FIELDS as readonly string[]).includes(k));
  if (unknown.length > 0) {
    return refuse(
      "unknown-field",
      `Unknown field(s): ${unknown.join(", ")}. A request carries only ${ALLOWED_FIELDS.join(", ")}.`,
      rawId,
    );
  }
  const missing = REQUIRED_FIELDS.filter((k) => !(k in obj));
  if (missing.length > 0) {
    return refuse("missing-field", `Missing field(s): ${missing.join(", ")}.`, rawId);
  }
  if (obj.version !== PROTOCOL_VERSION) {
    return refuse(
      "unsupported-version",
      `This runner speaks protocol version ${PROTOCOL_VERSION}; the request says ${JSON.stringify(obj.version)}.`,
      rawId,
    );
  }
  if (rawId === null) {
    return refuse("bad-id", `id must match ${ID_RE}; got ${JSON.stringify(obj.id)}.`);
  }
  if (ctx.fileName !== `${rawId}.json`) {
    return refuse("id-filename-mismatch", `The file must be named ${rawId}.json; it is ${ctx.fileName}.`, rawId);
  }
  if (typeof obj.sequence !== "string" || !(SEQUENCE_NAMES as string[]).includes(obj.sequence)) {
    return refuse(
      "unknown-sequence",
      `sequence must be one of ${SEQUENCE_NAMES.join(", ")}; got ${JSON.stringify(obj.sequence)}.`,
      rawId,
    );
  }
  const sequence = obj.sequence as SequenceName;
  if (typeof obj.commit !== "string" || !COMMIT_RE.test(obj.commit)) {
    return refuse("bad-commit", `commit must be a full 40-character lower-case SHA; got ${JSON.stringify(obj.commit)}.`, rawId);
  }
  const commit = obj.commit;

  let only: string[] | undefined;
  if ("only" in obj) {
    const o = obj.only;
    if (!Array.isArray(o) || o.length === 0 || o.length > MAX_ONLY_ENTRIES || !o.every((x) => typeof x === "string")) {
      return refuse("bad-only", `only must be a non-empty array of at most ${MAX_ONLY_ENTRIES} strings.`, rawId);
    }
    const entries = o as string[];
    const badShape = entries.filter((e) => !ONLY_RE.test(e) || e.split("/").includes(".."));
    if (badShape.length > 0) {
      return refuse(
        "bad-only",
        `only takes repo-relative e2e/**/*.spec.ts or src/__tests__/**/*.test.ts(x) paths with forward slashes; refused: ${badShape.join(", ")}.`,
        rawId,
      );
    }
    const known = new Set([...ctx.knownE2eSpecs, ...ctx.knownJestSuites]);
    const absent = entries.filter((e) => !known.has(e));
    if (absent.length > 0) {
      return refuse("bad-only", `No such test file in the working tree: ${absent.join(", ")}.`, rawId);
    }
    const steps = SEQUENCES[sequence] as readonly StepName[];
    const applies = entries.some(
      (e) => (e.startsWith("e2e/") && steps.includes("e2e")) || (e.startsWith("src/") && steps.includes("jest")),
    );
    if (!applies) {
      return refuse(
        "only-not-applicable",
        `Sequence ${sequence} runs ${steps.join(", ") || "nothing"}; none of the only entries narrows one of those steps.`,
        rawId,
      );
    }
    only = [...new Set(entries)];
  }

  if (ctx.busyWith !== null) {
    return refuse("busy", `The runner is running ${ctx.busyWith}. Wait for its result, then ask again.`, rawId);
  }
  if (ctx.headCommit === null) {
    return refuse("head-unknown", "git rev-parse HEAD failed on the runner's side, so the commit cannot be checked.", rawId);
  }
  if (ctx.headCommit.toLowerCase() !== commit) {
    return refuse(
      "head-mismatch",
      `HEAD is ${ctx.headCommit.toLowerCase()}, the request asks for ${commit}. The runner tests the working tree; it never checks anything out.`,
      rawId,
    );
  }
  return { ok: true, request: { version: PROTOCOL_VERSION, id: rawId, sequence, commit, ...(only ? { only } : {}) } };
}

// ---- the plan for one request -------------------------------------------------

export interface PlannedStep {
  name: StepName;
  /** For e2e and jest: the files to run, or null for all of them. */
  files: string[] | null;
  /** Set when `only` leaves this step with nothing to run. */
  skipReason: string | null;
}

export function planSteps(request: Pick<RunRequest, "sequence" | "only">): PlannedStep[] {
  const steps = SEQUENCES[request.sequence] as readonly StepName[];
  return steps.map((name) => {
    if (!request.only || (name !== "e2e" && name !== "jest")) return { name, files: null, skipReason: null };
    const prefix = name === "e2e" ? "e2e/" : "src/__tests__/";
    const files = request.only.filter((e) => e.startsWith(prefix));
    return files.length > 0
      ? { name, files, skipReason: null }
      : { name, files: null, skipReason: `only names no ${name === "e2e" ? "e2e spec" : "jest suite"}` };
  });
}

/**
 * Playwright's positional arguments are file filters. They are passed relative
 * to `testDir` (`./e2e`), which is how Playwright prints them back.
 */
export function playwrightArgs(files: string[] | null): string[] {
  return ["test", ...(files ?? []).map((f) => f.replace(/^e2e\//, ""))];
}

/** `--runTestsByPath` makes each entry an exact path rather than a regex. */
export function jestArgs(files: string[] | null, maxWorkers: number | null = null): string[] {
  return [
    ...(maxWorkers !== null ? [`--maxWorkers=${maxWorkers}`] : []),
    ...(files && files.length > 0 ? ["--runTestsByPath", ...files] : []),
  ];
}

// ---- reading what the tools printed -----------------------------------------

const ANSI_RE = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;
export function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, "");
}

export type DevServerTell = "lock-held" | "port-in-use" | "os-error-1450" | "corrupt-cache";

/**
 * What `next dev`'s own output says about it. The tells, and why each one has
 * the remedy it has, are in `C:\dev\.claude\rules\sandbox-and-toolchain.md`:
 *
 *   os-error-1450  Windows refused Turbopack's SST write (commit charge). The
 *                  half-written cache is what makes the NEXT start panic, so
 *                  the remedy is: stop, clear the runner's `dev` cache, restart
 *                  with `--webpack`, which builds no SST database at all.
 *   corrupt-cache  the panic that follows it — "Failed to restore task data
 *                  (corrupted database or bug)". Stop, clear, restart.
 *   lock-held      another `next dev` holds `<distDir>/dev/lock`; with the
 *                  runner's own distDir that should never be Adrian's, so it
 *                  is reported, never worked around.
 *   port-in-use    something else listens on the runner's port. Reported.
 *
 * Ordered: the two that cannot be recovered from are checked first.
 */
export function classifyDevServerOutput(text: string): { ready: boolean; tell: DevServerTell | null } {
  const t = stripAnsi(text);
  const ready = /\bReady in\b/.test(t);
  let tell: DevServerTell | null = null;
  if (/Another\s+\S*\s*next dev\s*\S*\s*server is already running/i.test(t) || /already running in this directory/i.test(t)) {
    tell = "lock-held";
  } else if (/EADDRINUSE|address already in use|Port \d+ is in use/i.test(t)) {
    tell = "port-in-use";
  } else if (/os error 1450/i.test(t)) {
    tell = "os-error-1450";
  } else if (
    /Failed to restore task data|corrupted database|Unable to open static sorted file|An unexpected Turbopack error occurred/i.test(t)
  ) {
    tell = "corrupt-cache";
  }
  return { ready, tell };
}

export type CacheRoot = "runner" | "dev" | "types" | "other";

export interface TscClassification {
  errorCount: number;
  /** Files with at least one located error, forward slashes, as tsc printed them. */
  files: string[];
  /** True when there are errors and EVERY one of them is located under `.next/`. */
  cacheOnly: boolean;
  /** For a cache-only run: which build caches the errors are in. */
  cacheRoots: CacheRoot[];
}

/**
 * ⚠️ **AN ERROR WHOSE PATH STARTS WITH `.next/` IS A STATEMENT ABOUT THE BUILD
 * CACHE, NOT ABOUT THE CODE.** (`C:\dev\CLAUDE.md` → Delivering work.) A
 * `next dev` killed or caught mid-write leaves a generated file with the tail
 * of its previous version attached, and tsc reports TS1128/TS1434 in a file
 * nobody wrote. So a run is `cacheOnly` only when every error is located AND
 * under `.next/`; one error anywhere else, or one tsc could not locate
 * (`error TS5083: Cannot read file ...`), makes it a code failure.
 */
export function classifyTscOutput(text: string): TscClassification {
  const lines = stripAnsi(text).split(/\r?\n/);
  const located = /^(.+?)\((\d+),(\d+)\): error TS\d+:/;
  const anyError = /\berror TS\d+:/;
  let errorCount = 0;
  let unlocated = 0;
  const files = new Set<string>();
  for (const line of lines) {
    if (!anyError.test(line)) continue;
    errorCount++;
    const m = located.exec(line);
    if (m) files.add(m[1].replace(/\\/g, "/").replace(/^\.\//, ""));
    else unlocated++;
  }
  const list = [...files];
  const cacheOnly = errorCount > 0 && unlocated === 0 && list.every((f) => f.startsWith(".next/"));
  const roots = new Set<CacheRoot>();
  if (cacheOnly) {
    for (const f of list) {
      if (f.startsWith(`${RUNNER_DIST_DIR}/`)) roots.add("runner");
      else if (f.startsWith(".next/dev/")) roots.add("dev");
      else if (f.startsWith(".next/types/")) roots.add("types");
      else roots.add("other");
    }
  }
  return { errorCount, files: list, cacheOnly, cacheRoots: [...roots] };
}

/**
 * ⚠️ **A JEST RUN WHOSE WORKERS DIED IS NOT A RED RUN.** On this machine, above
 * a certain commit charge, Windows refuses a worker at spawn and jest reports
 * `Test suite failed to run` for suites that never reached an assertion
 * (`jest.config.ts` → maxWorkers). The tell is the summary: suites failed, and
 * `Tests:` counts no failed test.
 */
export function isJestWorkerCrashOnly(text: string): boolean {
  const t = stripAnsi(text);
  const suites = /^Test Suites:.*$/m.exec(t)?.[0] ?? "";
  const tests = /^Tests:.*$/m.exec(t)?.[0] ?? "";
  if (!/\bfailed\b/.test(suites) || /\bfailed\b/.test(tests)) return false;
  return /Jest worker|ran out of memory|paging file is too small|Failed to load bindings|Zone Allocation failed|HashMap::Initialize/i.test(t);
}

/** One line per step, for the result file and the handover. */
export function summariseStep(step: StepName, text: string, exitCode: number | null): string {
  const t = stripAnsi(text);
  const lines = t.split(/\r?\n/).map((l) => l.trim());
  const exit = exitCode === null ? "no exit code" : `exit ${exitCode}`;
  let body = "";
  switch (step) {
    case "e2e": {
      body = lines
        .filter((l) => /^\d+ (passed|failed|flaky|skipped|did not run|interrupted)\b/.test(l))
        .join("; ");
      if (!body && /No tests found/i.test(t)) body = "No tests found";
      break;
    }
    case "jest": {
      body = lines.filter((l) => /^(Test Suites|Tests):/.test(l)).join(" | ");
      break;
    }
    case "lint": {
      // stylish prints "✖ 3 problems (…)"; a Windows console code page can turn the mark into anything.
      body = lines.filter((l) => /^\S{0,2}\s*\d+ problems? \(/.test(l)).pop() ?? (exitCode === 0 ? "no problems" : "");
      break;
    }
    case "tsc": {
      const c = classifyTscOutput(t);
      body =
        c.errorCount === 0
          ? exitCode === 0
            ? "0 errors"
            : ""
          : `${c.errorCount} error${c.errorCount === 1 ? "" : "s"} in ${c.files.length} file${c.files.length === 1 ? "" : "s"}${c.cacheOnly ? ", all under .next/" : ""}`;
      break;
    }
    case "verify-rebuild": {
      body = lines.filter((l) => /\b(PASS|FAIL|PARTIAL)\b/.test(l)).pop() ?? "";
      break;
    }
  }
  return body ? `${body} (${exit})` : exit;
}

// ---- the result file -----------------------------------------------------------

export type StepStatus = "pending" | "running" | "passed" | "failed" | "cache-only" | "error" | "skipped";
export type RunStatus = "refused" | "running" | "passed" | "failed" | "error";

export interface StepResult {
  name: StepName;
  status: StepStatus;
  exitCode: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  seconds: number | null;
  summary: string;
  /** Repo-relative, forward slashes. */
  log: string | null;
  /** Every recovery the runner made on its own, in the order it made them. */
  notes: string[];
}

export interface RunnerInfo {
  protocol: typeof PROTOCOL_VERSION;
  pid: number;
  host: string;
  port: number;
  startedAt: string;
  /** HEAD when the runner process started — the runner's own code is that commit's. */
  runnerCommit: string | null;
}

export interface RunResult {
  version: typeof PROTOCOL_VERSION;
  /** Always "runner": a result from this file is never Adrian's run. */
  source: "runner";
  id: string;
  sequence: SequenceName | null;
  commit: string | null;
  only: string[] | null;
  status: RunStatus;
  refusal: Refusal | null;
  receivedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  /** `git status --porcelain` at the start: what the working tree held beyond HEAD. */
  dirty: string[];
  steps: StepResult[];
  runner: RunnerInfo;
}

export function pendingSteps(plan: PlannedStep[]): StepResult[] {
  return plan.map((p) => ({
    name: p.name,
    status: p.skipReason ? "skipped" : "pending",
    exitCode: null,
    startedAt: null,
    finishedAt: null,
    seconds: null,
    summary: p.skipReason ?? "",
    log: null,
    notes: [],
  }));
}

/**
 * `passed` only when every step that ran passed. A step that failed makes the
 * run `failed` — the code is wrong. Otherwise any `error` or `cache-only` step
 * makes it `error` — the runner could not give an answer, which is neither.
 */
export function overallStatus(steps: StepResult[]): Exclude<RunStatus, "refused" | "running"> {
  if (steps.some((s) => s.status === "failed")) return "failed";
  if (steps.some((s) => s.status === "error" || s.status === "cache-only" || s.status === "pending" || s.status === "running")) {
    return "error";
  }
  return "passed";
}

export function refusedResult(
  id: string,
  refusal: Refusal,
  receivedAt: string,
  runner: RunnerInfo,
  partial: { sequence?: unknown; commit?: unknown } = {},
): RunResult {
  return {
    version: PROTOCOL_VERSION,
    source: "runner",
    id,
    sequence:
      typeof partial.sequence === "string" && (SEQUENCE_NAMES as string[]).includes(partial.sequence)
        ? (partial.sequence as SequenceName)
        : null,
    commit: typeof partial.commit === "string" && COMMIT_RE.test(partial.commit) ? partial.commit : null,
    only: null,
    status: "refused",
    refusal,
    receivedAt,
    startedAt: null,
    finishedAt: receivedAt,
    dirty: [],
    steps: [],
    runner,
  };
}
