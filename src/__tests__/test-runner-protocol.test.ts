/**
 * @jest-environment node
 */

/**
 * Slices Propus.2 and Propus.3 — the request/result contract between Claude and
 * the Windows-side test runner (`scripts/test-runner/`), and the guards on the
 * three sequences that do more than test: push, ci and migrate-local.
 *
 * ⚠️ **EVERY REFUSAL IS PINNED, BECAUSE A REFUSAL IS THE SAFETY PROPERTY.**
 * The runner executes a fixed sequence on Adrian's laptop whenever a file
 * lands in `.test-runner/requests/`. What keeps that from being a remote shell
 * is that a request is data: a sequence from a closed list, the commit it must
 * run on, and optionally test files that already exist. Each case below is one
 * way a request could ask for more than that, or for something at the wrong
 * moment, and the runner must say no to it by name.
 *
 * ⚠️ **THE ORDER OF THE CHECKS IS PINNED TOO.** A malformed request must be
 * reported as malformed even while the runner is busy, and a request for the
 * wrong commit must not be reported as busy — so Claude's fix is always the
 * one the refusal names.
 */

import fs from "fs";
import path from "path";

import {
  AI_CORPUS_ROOT_SEGMENTS,
  CHANNEL_DIR,
  DATA_ROOT_SEGMENTS,
  DEPENDENT_STEPS,
  FOLDER_SEQUENCES,
  SCHEMA_CONFIRMED_TRAILER,
  MAX_ONLY_ENTRIES,
  MAX_READ_CAP,
  MAX_REQUEST_BYTES,
  RUNNER_DIST_DIR,
  RUNNER_DIST_ENV,
  RUNNER_PORT,
  SEQUENCES,
  SEQUENCE_NAMES,
  ciVerdict,
  classifyDevServerOutput,
  classifyTscOutput,
  decideMigrateLocal,
  devServerCompiled,
  e2eFailuresAreAllTimeouts,
  failedE2eSpecs,
  PLAYWRIGHT_RERUN_ARGS,
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
  summariseStep,
  type CiRun,
  type GreenRunCandidate,
  type GuardCode,
  type MigrateObservation,
  type PushObservation,
  type RefusalCode,
  type RequestContext,
  type RunnerInfo,
  type StepResult,
} from "../../scripts/test-runner/protocol";

const REPO = process.cwd();
const HEAD = "0123456789abcdef0123456789abcdef01234567";
const ID = "20260924T153000Z-4711";

const ctx = (over: Partial<RequestContext> = {}): RequestContext => ({
  fileName: `${ID}.json`,
  headCommit: HEAD,
  busyWith: null,
  knownE2eSpecs: ["e2e/versioning/property-versioning.spec.ts", "e2e/auth/login-dashboard.spec.ts"],
  knownJestSuites: ["src/__tests__/test-runner-protocol.test.ts"],
  knownDataFolders: ["07.smoke.tc.marker", "10.big.tc.marker"],
  knownCorpora: { cvc: 10, empty: 0 },
  ...over,
});

const req = (over: Record<string, unknown> = {}): string =>
  JSON.stringify({ version: 1, id: ID, sequence: "full", commit: HEAD, ...over });

function refusal(raw: string, c: RequestContext = ctx()): RefusalCode | "accepted" {
  const r = parseRequest(raw, c);
  return r.ok ? "accepted" : r.refusal.code;
}

describe("a request that asks for exactly what it may", () => {
  it("is accepted and comes back normalised", () => {
    const r = parseRequest(req(), ctx());
    expect(r).toEqual({ ok: true, request: { version: 1, id: ID, sequence: "full", commit: HEAD } });
  });

  it.each(SEQUENCE_NAMES.map((s) => [s]))("sequence %s is on the fixed list", (sequence) => {
    const args =
      sequence === "ai-score"
        ? { folder: "cvc", readCap: 10 }
        : FOLDER_SEQUENCES.includes(sequence)
          ? { folder: "07.smoke.tc.marker" }
          : {};
    expect(refusal(req({ sequence, ...args }))).toBe("accepted");
  });

  it("reconcile carries its folder through, and only a folder the runner listed (Slice #36.22)", () => {
    const r = parseRequest(req({ sequence: "reconcile", folder: "10.big.tc.marker" }), ctx());
    expect(r).toEqual({
      ok: true,
      request: { version: 1, id: ID, sequence: "reconcile", commit: HEAD, folder: "10.big.tc.marker" },
    });
    expect(FOLDER_SEQUENCES).toEqual(["reconcile", "ai-score"]);
    expect(DATA_ROOT_SEGMENTS).toEqual(["..", "TEST.DATA", "Test.Claude"]);
  });

  it("ai-score carries its corpus and read cap through (Slice #36.23)", () => {
    const r = parseRequest(req({ sequence: "ai-score", folder: "cvc", readCap: 30 }), ctx());
    expect(r).toEqual({
      ok: true,
      request: { version: 1, id: ID, sequence: "ai-score", commit: HEAD, folder: "cvc", readCap: 30 },
    });
    expect(AI_CORPUS_ROOT_SEGMENTS).toEqual(["..", "TEST.DATA", "Test.Claude", "ai-corpus"]);
    expect(refusal(req({ sequence: "ai-score", folder: "cvc", readCap: 10 }))).toBe("accepted");
  });

  it("ai-score is a sequence of its own: nothing else pays for a read", () => {
    expect(SEQUENCES["ai-score"]).toEqual(["ai-score"]);
    for (const name of SEQUENCE_NAMES.filter((n) => n !== "ai-score")) {
      expect(SEQUENCES[name] as readonly string[]).not.toContain("ai-score");
    }
  });

  it("tolerates a UTF-8 byte-order mark (a PowerShell 5.1 Set-Content habit)", () => {
    expect(refusal("\uFEFF" + req())).toBe("accepted");
  });

  it("accepts HEAD in upper case from git on the other side", () => {
    expect(refusal(req(), ctx({ headCommit: HEAD.toUpperCase() }))).toBe("accepted");
  });

  it("de-duplicates only entries", () => {
    const f = "e2e/auth/login-dashboard.spec.ts";
    const r = parseRequest(req({ only: [f, f] }), ctx());
    expect(r.ok && r.request.only).toEqual([f]);
  });
});

describe("every refusal, by name", () => {
  const cases: [string, string, RefusalCode, Partial<RequestContext>?][] = [
    ["too large", JSON.stringify({ pad: "x".repeat(MAX_REQUEST_BYTES) }), "too-large"],
    ["not JSON", "{ version: 1 ", "malformed-json"],
    ["an array", "[1]", "not-an-object"],
    ["null", "null", "not-an-object"],
    ["a command line smuggled in a field", req({ command: "npm run supabase:migrate" }), "unknown-field"],
    ["an args field", req({ args: ["--update-baseline"] }), "unknown-field"],
    ["no commit", JSON.stringify({ version: 1, id: ID, sequence: "full" }), "missing-field"],
    ["protocol 2", req({ version: 2 }), "unsupported-version"],
    ["version as a string", req({ version: "1" }), "unsupported-version"],
    ["an id with a path in it", req({ id: "../x" }), "bad-id"],
    ["an id with a space", req({ id: "a b" }), "bad-id"],
    ["an id that is not the file name", req({ id: "other-id" }), "id-filename-mismatch"],
    ["an unknown sequence", req({ sequence: "migrate" }), "unknown-sequence"],
    ["a sequence spelled as a command", req({ sequence: "npm run e2e" }), "unknown-sequence"],
    ["a short SHA", req({ commit: HEAD.slice(0, 7) }), "bad-commit"],
    ["an upper-case SHA", req({ commit: HEAD.toUpperCase() }), "bad-commit"],
    ["a branch name", req({ commit: "main" }), "bad-commit"],
    ["only as a string", req({ only: "e2e/auth/login-dashboard.spec.ts" }), "bad-only"],
    ["only empty", req({ only: [] }), "bad-only"],
    ["only too long", req({ only: Array(MAX_ONLY_ENTRIES + 1).fill("e2e/auth/login-dashboard.spec.ts") }), "bad-only"],
    ["only with a flag", req({ only: ["--update-snapshots"] }), "bad-only"],
    ["only with a backslash path", req({ only: ["e2e\\auth\\login-dashboard.spec.ts"] }), "bad-only"],
    ["only climbing out", req({ only: ["e2e/../scripts/x.spec.ts"] }), "bad-only"],
    ["only naming a file that does not exist", req({ only: ["e2e/auth/nope.spec.ts"] }), "bad-only"],
    ["only naming a non-test file", req({ only: ["src/lib/x.ts"] }), "bad-only"],
    ["only narrowing a step the sequence lacks", req({ sequence: "jest", only: ["e2e/auth/login-dashboard.spec.ts"] }), "only-not-applicable"],
    ["only on a ping", req({ sequence: "ping", only: ["src/__tests__/test-runner-protocol.test.ts"] }), "only-not-applicable"],
    ["reconcile with no folder", req({ sequence: "reconcile" }), "bad-folder"],
    ["a folder that is a path", req({ sequence: "reconcile", folder: "..\\..\\Windows" }), "bad-folder"],
    ["a folder with a slash", req({ sequence: "reconcile", folder: "07.smoke.tc.marker/x" }), "bad-folder"],
    ["a folder climbing out", req({ sequence: "reconcile", folder: "a..b" }), "bad-folder"],
    ["a hidden folder", req({ sequence: "reconcile", folder: ".git" }), "bad-folder"],
    ["a folder as a number", req({ sequence: "reconcile", folder: 7 }), "bad-folder"],
    ["a folder the runner did not list", req({ sequence: "reconcile", folder: "CLINCENI.3" }), "bad-folder"],
    ["a folder on a sequence that takes none", req({ sequence: "full", folder: "07.smoke.tc.marker" }), "folder-not-applicable"],
    ["ai-score with no corpus", req({ sequence: "ai-score", readCap: 10 }), "bad-folder"],
    ["ai-score naming a data folder, not a corpus", req({ sequence: "ai-score", folder: "07.smoke.tc.marker", readCap: 10 }), "bad-folder"],
    ["reconcile naming a corpus", req({ sequence: "reconcile", folder: "cvc" }), "bad-folder"],
    ["a corpus with no answer keys", req({ sequence: "ai-score", folder: "empty", readCap: 10 }), "bad-folder"],
    ["ai-score with no read cap", req({ sequence: "ai-score", folder: "cvc" }), "bad-read-cap"],
    ["a read cap as a string", req({ sequence: "ai-score", folder: "cvc", readCap: "10" }), "bad-read-cap"],
    ["a read cap of zero", req({ sequence: "ai-score", folder: "cvc", readCap: 0 }), "bad-read-cap"],
    ["a fractional read cap", req({ sequence: "ai-score", folder: "cvc", readCap: 10.5 }), "bad-read-cap"],
    ["a read cap over the most", req({ sequence: "ai-score", folder: "cvc", readCap: MAX_READ_CAP + 1 }), "bad-read-cap"],
    ["a read cap below the corpus", req({ sequence: "ai-score", folder: "cvc", readCap: 9 }), "read-cap-below-corpus"],
    ["a read cap on a sequence that spends nothing", req({ sequence: "full", readCap: 10 }), "read-cap-not-applicable"],
    ["busy", req(), "busy", { busyWith: "20260924T150000Z-1" }],
    ["git could not answer", req(), "head-unknown", { headCommit: null }],
    ["the wrong commit", req({ commit: "f".repeat(40) }), "head-mismatch"],
  ];

  // ⚠️ Every row is padded to four cells. Jest reads a callback that declares
  // MORE parameters than the row supplies as asking for `done`, and times the
  // test out at 5 s — which is what 28 three-cell rows did in the runner's
  // first `full` run (20260924T160926Z-12680) while the jest shim passed them.
  const rows = cases.map(([label, raw, code, over]) => [label, raw, code, over ?? {}] as const);
  it.each(rows)("%s → refused", (_label, raw, code, over) => {
    expect(refusal(raw, ctx(over))).toBe(code);
  });

  it("every RefusalCode is reached by a case above", () => {
    const src = fs.readFileSync(path.join(REPO, "scripts", "test-runner", "protocol.ts"), "utf8");
    const union = /export type RefusalCode =([\s\S]*?);/.exec(src)?.[1] ?? "";
    const declared = [...union.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]).sort();
    const reached = [...new Set(cases.map((c) => c[2]))].sort();
    expect(reached).toEqual(declared);
  });

  it("carries the id it could read, so the result lands where Claude looks", () => {
    const r = parseRequest(req({ sequence: "nope" }), ctx());
    expect(r.ok ? null : r.id).toBe(ID);
  });
});

describe("the order the checks run in", () => {
  it("malformed beats busy", () => {
    expect(refusal("{", ctx({ busyWith: "x" }))).toBe("malformed-json");
  });
  it("an unknown sequence beats busy", () => {
    expect(refusal(req({ sequence: "nope" }), ctx({ busyWith: "x" }))).toBe("unknown-sequence");
  });
  it("busy beats the wrong commit — the commit is checked when the runner is free to run it", () => {
    expect(refusal(req({ commit: "f".repeat(40) }), ctx({ busyWith: "x" }))).toBe("busy");
  });
});

describe("resultIdForFile", () => {
  it("uses the stem Claude named the file with", () => {
    expect(resultIdForFile(`${ID}.json`, "fallback")).toBe(ID);
  });
  it("falls back when the stem could not be an id", () => {
    expect(resultIdForFile("a b.json", "fallback")).toBe("fallback");
  });
});

describe("the plan for a request", () => {
  it("full is e2e, then lint, tsc and jest — the order in C:\\dev\\CLAUDE.md", () => {
    expect(SEQUENCES.full).toEqual(["e2e", "lint", "tsc", "jest"]);
    expect(SEQUENCES["full-db"]).toEqual(["e2e", "lint", "tsc", "jest", "verify-rebuild"]);
    expect(SEQUENCES.ping).toEqual([]);
  });

  it("only narrows e2e and jest, skips the one it names nothing for, and never narrows lint or tsc", () => {
    const plan = planSteps({ sequence: "full", only: ["src/__tests__/test-runner-protocol.test.ts"] });
    expect(plan).toEqual([
      { name: "e2e", files: null, skipReason: "only names no e2e spec" },
      { name: "lint", files: null, skipReason: null },
      { name: "tsc", files: null, skipReason: null },
      { name: "jest", files: ["src/__tests__/test-runner-protocol.test.ts"], skipReason: null },
    ]);
    expect(pendingSteps(plan).map((s) => s.status)).toEqual(["skipped", "pending", "pending", "pending"]);
  });

  it("argv carries only enumerated paths, never request text", () => {
    expect(playwrightArgs(null)).toEqual(["test"]);
    expect(playwrightArgs(["e2e/auth/login-dashboard.spec.ts"])).toEqual(["test", "auth/login-dashboard.spec.ts"]);
    expect(jestArgs(null)).toEqual([]);
    expect(jestArgs(["src/__tests__/a.test.ts"], 1)).toEqual(["--maxWorkers=1", "--runTestsByPath", "src/__tests__/a.test.ts"]);
  });
});

describe("what next dev's output says", () => {
  it.each([
    ["\u001b[32m✓\u001b[39m Ready in 586ms", true, null],
    ["Persisting failed: Unable to write SST file 00000039.sst\n  2: Insufficient system resources exist (os error 1450)", false, "os-error-1450"],
    ["thread 'tokio-runtime-worker' panicked: Failed to restore task data (corrupted database or bug)", false, "corrupt-cache"],
    ["FATAL: An unexpected Turbopack error occurred", false, "corrupt-cache"],
    ["⨯ Another next dev server is already running in this directory.", false, "lock-held"],
    ["Error: listen EADDRINUSE: address already in use :::3100", false, "port-in-use"],
    ["✓ Ready in 2.1s\n...\nos error 1450", true, "os-error-1450"],
  ])("%s", (text, ready, tell) => {
    expect(classifyDevServerOutput(text)).toEqual({ ready, tell });
  });
});

describe("tsc: the build cache is not the code", () => {
  it("errors only under .next/dev are cache-only, and say whose cache", () => {
    const out =
      ".next/dev/types/routes.d.ts(12,1): error TS1128: Declaration or statement expected.\n" +
      ".next\\dev\\types\\validator.ts(3,5): error TS1434: Unexpected keyword or identifier.\n";
    expect(classifyTscOutput(out)).toEqual({
      errorCount: 2,
      files: [".next/dev/types/routes.d.ts", ".next/dev/types/validator.ts"],
      cacheOnly: true,
      cacheRoots: ["dev"],
    });
  });
  it("the runner's own cache is told apart from Adrian's", () => {
    const out = `${RUNNER_DIST_DIR}/types/validator.ts(1,1): error TS2307: Cannot find module.\n`;
    expect(classifyTscOutput(out).cacheRoots).toEqual(["runner"]);
  });
  it("one error in src/ makes it a code failure", () => {
    const out =
      ".next/dev/types/routes.d.ts(12,1): error TS1128: x\nsrc/lib/a.ts(4,2): error TS2322: Type 'x' is not assignable.\n";
    expect(classifyTscOutput(out).cacheOnly).toBe(false);
  });
  it("an error tsc could not locate makes it a code failure", () => {
    expect(classifyTscOutput("error TS5083: Cannot read file 'tsconfig.json'.\n").cacheOnly).toBe(false);
  });
  it("no errors is not cache-only", () => {
    expect(classifyTscOutput("").cacheOnly).toBe(false);
  });
});

describe("jest: dead workers are not a red run", () => {
  it("suites failed, no test failed, a worker tell → crash only", () => {
    const out = "Test suite failed to run\nJest worker ran out of memory\nTest Suites: 3 failed, 99 passed, 102 total\nTests:       1400 passed, 1400 total\n";
    expect(isJestWorkerCrashOnly(out)).toBe(true);
  });
  it("a failed test is a red run, whatever else is in the output", () => {
    const out = "Jest worker ran out of memory\nTest Suites: 1 failed, 101 passed, 102 total\nTests:       1 failed, 1399 passed, 1400 total\n";
    expect(isJestWorkerCrashOnly(out)).toBe(false);
  });
});

describe("one-line summaries", () => {
  it.each([
    ["e2e", "Running 9 tests\n  8 passed (41.2s)\n  1 failed\n", 1, "8 passed (41.2s); 1 failed (exit 1)"],
    ["jest", "Test Suites: 103 passed, 103 total\nTests:       1402 passed, 1402 total\n", 0, "Test Suites: 103 passed, 103 total | Tests:       1402 passed, 1402 total (exit 0)"],
    ["lint", "", 0, "no problems (exit 0)"],
    ["lint", "\n✖ 3 problems (1 error, 2 warnings)\n", 1, "✖ 3 problems (1 error, 2 warnings) (exit 1)"],
    ["tsc", "", 0, "0 errors (exit 0)"],
    ["tsc", "src/a.ts(1,1): error TS2322: x\n", 2, "1 error in 1 file (exit 2)"],
    ["verify-rebuild", "step 1\nPASS — rebuild matches\n", 0, "PASS — rebuild matches (exit 0)"],
    ["e2e", "", null, "no exit code"],
    [
      "reconcile",
      "LANDED     a.jpg → DOC00001 its only page\n\nRECONCILE: 10.big.tc.marker — 1 file: 1 landed, 0 missing; 0 extra pages; structure clean\n",
      0,
      "10.big.tc.marker — 1 file: 1 landed, 0 missing; 0 extra pages; structure clean (exit 0)",
    ],
    [
      "ai-score",
      "  cvc-01 [proposed]: 3 page(s), 41 s — 14/17\n\nAI-SCORE: 81.0% over 4 confirmed · all 10: 79.2% · prompt 0a1b2c3d4e5f · 10 reads of cap 10\n",
      0,
      "81.0% over 4 confirmed · all 10: 79.2% · prompt 0a1b2c3d4e5f · 10 reads of cap 10 (exit 0)",
    ],
  ] as const)("%s", (step, text, code, expected) => {
    expect(summariseStep(step, text, code)).toBe(expected);
  });
});

describe("the result file", () => {
  const runner: RunnerInfo = { protocol: 1, pid: 1, host: "h", port: RUNNER_PORT, startedAt: "t", runnerCommit: HEAD };
  const step = (status: StepResult["status"]): StepResult => ({
    name: "lint",
    status,
    exitCode: 0,
    startedAt: null,
    finishedAt: null,
    seconds: null,
    summary: "",
    log: null,
    notes: [],
  });

  it("is passed only when every step that ran passed; skipped steps do not count", () => {
    expect(overallStatus([step("passed"), step("skipped")])).toBe("passed");
    expect(overallStatus([])).toBe("passed");
  });
  it("a failed step makes it failed — the code is wrong", () => {
    expect(overallStatus([step("error"), step("failed")])).toBe("failed");
  });
  it("an error or a cache-only step makes it error — no answer, which is not a pass", () => {
    expect(overallStatus([step("passed"), step("cache-only")])).toBe("error");
    expect(overallStatus([step("passed"), step("error")])).toBe("error");
  });
  it("a refusal is written as the runner's, never as Adrian's, and keeps what it could read", () => {
    const r = refusedResult(ID, { code: "busy", message: "m" }, "t", runner, { sequence: "full", commit: "junk" });
    expect(r).toMatchObject({ source: "runner", status: "refused", sequence: "full", commit: null, steps: [] });
  });
});

describe("the files the runner depends on agree with the protocol", () => {
  const read = (p: string): string => fs.readFileSync(path.join(REPO, p), "utf8");

  it(`next.config.ts takes distDir from ${RUNNER_DIST_ENV}, defaulting to .next`, () => {
    expect(read("next.config.ts")).toMatch(new RegExp(`distDir:\\s*process\\.env\\.${RUNNER_DIST_ENV}\\s*\\|\\|\\s*"\\.next"`));
  });
  it("tsconfig.json already holds the runner's type globs, so next dev never rewrites it", () => {
    const include = (JSON.parse(read("tsconfig.json")) as { include: string[] }).include;
    expect(include).toEqual(expect.arrayContaining([`${RUNNER_DIST_DIR}/types/**/*.ts`, `${RUNNER_DIST_DIR}/dev/types/**/*.ts`]));
  });
  it("playwright.config.ts takes its base URL from E2E_BASE_URL, defaulting to 3000", () => {
    expect(read("playwright.config.ts")).toMatch(/baseURL:\s*process\.env\.E2E_BASE_URL\s*\|\|\s*"http:\/\/localhost:3000"/);
  });
  it(`${CHANNEL_DIR}/ is ignored by git and by the Docker build context`, () => {
    expect(read(".gitignore")).toMatch(new RegExp(`^/${CHANNEL_DIR.replace(".", "\\.")}/$`, "m"));
    expect(read(".dockerignore")).toMatch(new RegExp(`^${CHANNEL_DIR.replace(".", "\\.")}$`, "m"));
  });
});

// ---- Slice Propus.3: the guards ---------------------------------------------------

const REMOTE = "fedcba9876543210fedcba9876543210fedcba98";

const green = (over: Partial<GreenRunCandidate> = {}): GreenRunCandidate => ({
  id: "20260924T170000Z-1",
  source: "runner",
  status: "passed",
  sequence: "full",
  commit: HEAD,
  only: null,
  dirty: [],
  finishedAt: "2026-09-24T17:10:00.000Z",
  ...over,
});

const pushObs = (over: Partial<PushObservation> = {}): PushObservation => ({
  branch: "main",
  head: HEAD,
  results: [green()],
  remoteMain: REMOTE,
  remoteIsAncestor: true,
  rangeChanges: ["M\tscripts/test-runner/runner.ts", "A\tsrc/__tests__/x.test.ts"],
  rangeCommits: 3,
  ...over,
});

function pushOutcome(o: PushObservation): GuardCode | "push" | "nothing-to-push" {
  const d = decidePush(o);
  if (!d.ok) return d.code;
  return d.commits === 0 ? "nothing-to-push" : "push";
}

const migrateObs = (over: Partial<MigrateObservation> = {}): MigrateObservation => ({
  pending: ["migration_087_x.sql"],
  dirtyMigrations: [],
  addingCommitMessage: {
    "migration_087_x.sql": `feat(db): x\n\nBody.\n\n${SCHEMA_CONFIRMED_TRAILER}: Adrian, 2026-09-25 — „yes"\n`,
  },
  ...over,
});

function migrateOutcome(o: MigrateObservation): GuardCode | "apply" | "nothing-pending" {
  const d = decideMigrateLocal(o);
  if (!d.ok) return d.code;
  return d.apply.length === 0 ? "nothing-pending" : "apply";
}

describe("the push guard — every condition holds the push, by name", () => {
  it("pushes a fast-forward of main on a clean green full run, and says how much", () => {
    expect(decidePush(pushObs())).toEqual({ ok: true, greenRun: "20260924T170000Z-1", from: REMOTE, to: HEAD, commits: 3 });
  });
  it("full-db licenses a push as well as full", () => {
    expect(pushOutcome(pushObs({ results: [green({ sequence: "full-db" })] }))).toBe("push");
  });
  it("an untracked file in the green run's tree does not stop it — it is not what is pushed", () => {
    expect(pushOutcome(pushObs({ results: [green({ dirty: ["?? notes.txt"] })] }))).toBe("push");
  });
  it("origin already at HEAD is nothing to push, not a hold", () => {
    expect(pushOutcome(pushObs({ remoteMain: HEAD }))).toBe("nothing-to-push");
  });
  it("a later clean green run is found behind an earlier dirty one", () => {
    const results = [green({ id: "a", dirty: [" M src/x.ts"], finishedAt: "2026-09-24T18:00:00Z" }), green({ id: "b", finishedAt: "2026-09-24T17:00:00Z" })];
    const d = decidePush(pushObs({ results }));
    expect(d.ok && d.greenRun).toBe("b");
  });

  const cases: [string, Partial<PushObservation>, GuardCode, null][] = [
    ["a branch other than main", { branch: "feature/x" }, "not-on-main", null],
    ["a detached HEAD", { branch: null }, "not-on-main", null],
    ["no result at all", { results: [] }, "no-green-run", null],
    ["a red full run", { results: [green({ status: "failed" })] }, "no-green-run", null],
    ["a green run on another commit", { results: [green({ commit: "f".repeat(40) })] }, "no-green-run", null],
    ["a green run narrowed by only", { results: [green({ only: ["e2e/auth/login-dashboard.spec.ts"] })] }, "no-green-run", null],
    ["a green static run — not the whole sequence", { results: [green({ sequence: "static" })] }, "no-green-run", null],
    ["a green e2e run alone", { results: [green({ sequence: "e2e" })] }, "no-green-run", null],
    ["a result that is not the runner's", { results: [green({ source: "adrian" as "runner" })] }, "no-green-run", null],
    ["a green run over uncommitted changes", { results: [green({ dirty: [" M src/lib/a.ts"] })] }, "green-run-dirty", null],
    ["ls-remote could not answer", { remoteMain: null }, "remote-unknown", null],
    ["origin has moved on", { remoteIsAncestor: false }, "not-fast-forward", null],
    ["the range adds a migration", { rangeChanges: ["A\tsrc/db/migration_087_x.sql"] }, "migration-in-range", null],
    ["the range edits a migration", { rangeChanges: ["M\tsrc/db/migration_086_document_reference_direction.sql"] }, "migration-in-range", null],
    ["the range renames one", { rangeChanges: ["R100\tsrc/db/migration_087_a.sql\tsrc/db/migration_087_b.sql"] }, "migration-in-range", null],
  ];
  it.each(cases)("%s → held", (_label, over, code, _pad) => {
    expect(pushOutcome(pushObs(over))).toBe(code);
  });

  it("a range touching src/db but no migration is pushed", () => {
    expect(pushOutcome(pushObs({ rangeChanges: ["M\tsrc/db/supabase_schema_full.sql", "M\tsrc/db/schema/index.ts"] }))).toBe("push");
  });

  it("the order is the order of fixing: main first, then the green run, then the remote, then migrations", () => {
    expect(pushOutcome(pushObs({ branch: "x", results: [], remoteMain: null }))).toBe("not-on-main");
    expect(pushOutcome(pushObs({ results: [], remoteMain: null }))).toBe("no-green-run");
    expect(pushOutcome(pushObs({ remoteIsAncestor: false, rangeChanges: ["A\tsrc/db/migration_087_x.sql"] }))).toBe("not-fast-forward");
  });
});

describe("the migrate-local guard — only a committed, confirmed migration reaches the database", () => {
  it("applies a committed migration whose adding commit carries the trailer", () => {
    expect(decideMigrateLocal(migrateObs())).toEqual({ ok: true, apply: ["migration_087_x.sql"] });
  });
  it("nothing pending is a pass with nothing to apply", () => {
    expect(migrateOutcome(migrateObs({ pending: [] }))).toBe("nothing-pending");
  });

  const cases: [string, Partial<MigrateObservation>, GuardCode, null][] = [
    ["an untracked migration in the working tree", { dirtyMigrations: ["?? src/db/migration_088_y.sql"] }, "migration-dirty", null],
    ["an edited, committed migration", { dirtyMigrations: [" M src/db/migration_087_x.sql"] }, "migration-dirty", null],
    ["a pending file no commit added", { addingCommitMessage: { "migration_087_x.sql": null } }, "migration-uncommitted", null],
    ["a commit with no trailer", { addingCommitMessage: { "migration_087_x.sql": "feat(db): x\n\nAdrian said yes.\n" } }, "migration-unconfirmed", null],
    ["an empty trailer", { addingCommitMessage: { "migration_087_x.sql": `feat(db): x\n\n${SCHEMA_CONFIRMED_TRAILER}:\n` } }, "migration-unconfirmed", null],
    ["the trailer quoted mid-line, not as a trailer", { addingCommitMessage: { "migration_087_x.sql": `feat(db): x — no ${SCHEMA_CONFIRMED_TRAILER}: yet\n` } }, "migration-unconfirmed", null],
  ];
  it.each(cases)("%s → held", (_label, over, code, _pad) => {
    expect(migrateOutcome(migrateObs(over))).toBe(code);
  });

  it("an uncommitted migration holds the run even when nothing is pending — the script would apply the working tree", () => {
    expect(migrateOutcome(migrateObs({ pending: [], dirtyMigrations: ["?? src/db/migration_088_y.sql"] }))).toBe("migration-dirty");
  });

  it("one unconfirmed file holds all of them", () => {
    const o = migrateObs({
      pending: ["migration_087_x.sql", "migration_088_y.sql"],
      addingCommitMessage: { ...migrateObs().addingCommitMessage, "migration_088_y.sql": "feat(db): y\n" },
    });
    expect(migrateOutcome(o)).toBe("migration-unconfirmed");
  });

  it("export-schema runs only after the step before it passed", () => {
    expect(DEPENDENT_STEPS).toEqual(["export-schema"]);
    expect(SEQUENCES["migrate-local"]).toEqual(["apply-migration", "export-schema"]);
    expect(SEQUENCES.reconcile).toEqual(["reconcile"]);
  });
});

describe("every GuardCode is reached by a case above", () => {
  it("push and migrate-local together reach the whole union", () => {
    const src = fs.readFileSync(path.join(REPO, "scripts", "test-runner", "protocol.ts"), "utf8");
    const union = /export type GuardCode =([\s\S]*?);/.exec(src)?.[1] ?? "";
    const declared = [...union.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]).sort();
    const pushCodes: GuardCode[] = ["not-on-main", "no-green-run", "green-run-dirty", "remote-unknown", "not-fast-forward", "migration-in-range"];
    const migrateCodes: GuardCode[] = ["migration-dirty", "migration-uncommitted", "migration-unconfirmed"];
    expect([...pushCodes, ...migrateCodes].sort()).toEqual(declared);
  });
});

describe("ci: reading GitHub Actions", () => {
  const run = (over: Partial<CiRun> = {}): CiRun => ({
    id: 10,
    name: "CI",
    run_number: 412,
    status: "completed",
    conclusion: "success",
    html_url: "https://github.com/o/r/actions/runs/10",
    head_sha: HEAD,
    ...over,
  });

  it.each([
    ["https://github.com/adrianplatica63GHuser/ap63GHrepo.git", { owner: "adrianplatica63GHuser", repo: "ap63GHrepo" }],
    ["https://github.com/o/r", { owner: "o", repo: "r" }],
    ["https://user@github.com/o/r.git", { owner: "o", repo: "r" }],
    ["git@github.com:o/r.git", { owner: "o", repo: "r" }],
    ["ssh://git@github.com/o/r.git", { owner: "o", repo: "r" }],
    ["https://gitlab.com/o/r.git", null],
    ["https://github.com.evil.example/o/r.git", null],
  ] as const)("remote %s", (url, expected) => {
    expect(parseGithubRemote(url)).toEqual(expected);
  });

  it("no run is none, a run in progress is pending, all green is passed, one red is failed", () => {
    expect(ciVerdict([])).toBe("none");
    expect(ciVerdict([run(), run({ id: 11, name: "DB rebuild", status: "in_progress", conclusion: null })])).toBe("pending");
    expect(ciVerdict([run(), run({ id: 11, name: "DB rebuild", conclusion: "skipped" })])).toBe("passed");
    expect(ciVerdict([run(), run({ id: 11, name: "DB rebuild", conclusion: "failure" })])).toBe("failed");
    expect(ciVerdict([run({ conclusion: "cancelled" })])).toBe("failed");
  });

  it("keeps the newest run per workflow for this commit only", () => {
    const runs = [run({ id: 10 }), run({ id: 12, conclusion: "failure" }), run({ id: 11, name: "DB rebuild" }), run({ id: 13, head_sha: "f".repeat(40) })];
    expect(latestRunPerWorkflow(runs, HEAD).map((r) => r.id)).toEqual([12, 11]);
  });

  it("summarises in one line and names the step a red job died in", () => {
    expect(summariseCi([run(), run({ id: 11, name: "DB rebuild", run_number: 88, conclusion: "failure" })])).toBe("CI #412 success · DB rebuild #88 failure");
    expect(summariseCi([])).toBe("no workflow run for this commit");
    const job = {
      id: 1,
      name: "build",
      status: "completed",
      conclusion: "failure",
      steps: [
        { name: "Run npm ci", status: "completed", conclusion: "success", number: 1 },
        { name: "Run npm run lint", status: "completed", conclusion: "failure", number: 2 },
        { name: "Run npm test", status: "completed", conclusion: "skipped", number: 3 },
      ],
    };
    expect(firstFailedStep(job)).toBe("Run npm run lint");
  });
});

describe("a held run", () => {
  const s = (status: StepResult["status"]): StepResult => ({
    name: "push",
    status,
    exitCode: null,
    startedAt: null,
    finishedAt: null,
    seconds: null,
    summary: "",
    log: null,
    notes: [],
  });
  it("is held — neither passed nor failed nor error", () => {
    expect(overallStatus([s("held")])).toBe("held");
    expect(overallStatus([s("held"), s("skipped")])).toBe("held");
  });
  it("a failure or an error still wins over a hold", () => {
    expect(overallStatus([s("held"), s("failed")])).toBe("failed");
    expect(overallStatus([s("held"), s("error")])).toBe("error");
  });
});

describe("what the runner's code does with a push, read from its code", () => {
  // A BEHAVIOUR guard reads only code, so comments are stripped first
  // (C:\dev\CLAUDE.md → Design habits).
  const code = fs
    .readFileSync(path.join(REPO, "scripts", "test-runner", "runner.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("never forces: no --force, no -f, no +refspec anywhere in the runner", () => {
    expect(code).not.toMatch(/--force|"-f"|"\+refs\//);
  });
  it("pushes exactly main:main to origin, and nothing else", () => {
    const pushes = [...code.matchAll(/\["push",[^\]]*\]/g)].map((m) => m[0]);
    expect(pushes).toEqual(['["push", "--porcelain", PUSH_REMOTE, `refs/heads/${PUSH_BRANCH}:refs/heads/${PUSH_BRANCH}`]']);
  });
  it("never reaches Supabase: no supabase script and no SUPABASE_ variable", () => {
    expect(code).not.toMatch(/supabase-migrate|supabase:migrate|supabase-sync|SUPABASE_/);
  });
  it("reads GitHub with GET only", () => {
    expect(code).not.toMatch(/method:\s*"(POST|PUT|PATCH|DELETE)"/);
  });
});

describe("e2e on a cold next dev: a wait that ran out during a compile is re-run once", () => {
  // Shaped on 20260924T164218Z-7585, the runner's first Propus.3 full run.
  const block = (n: number, file: string, error: string): string =>
    `  ${n}) [chromium] › ${file}:37:7 › TC — titlu › pas \n\n    Error: ${error}\n\n    Call log:\n      - waiting\n\n`;
  const visible = "expect(locator).toBeVisible() failed\n\n    Locator: getByText('x')\n    Expected: visible\n    Timeout: 5000ms\n    Error: element(s) not found";
  const url = "expect(page).toHaveURL(expected) failed\n\n    Expected pattern: /x/\n    Timeout: 30000ms";
  const equal = "expect(received).toBe(expected)\n\n    Expected: 2\n    Received: 1";

  it("names the failed spec files, with forward slashes", () => {
    const out = block(1, "e2e\\association\\document-person.spec.ts", visible) + block(2, "e2e\\search\\global-search.spec.ts", url) + "  2 failed\n";
    expect(failedE2eSpecs(out)).toEqual(["e2e/association/document-person.spec.ts", "e2e/search/global-search.spec.ts"]);
  });
  it("every failure a wait that ran out → re-runnable", () => {
    expect(e2eFailuresAreAllTimeouts(block(1, "e2e\\a.spec.ts", visible) + block(2, "e2e\\b.spec.ts", url) + "  2 failed\n")).toBe(true);
    expect(e2eFailuresAreAllTimeouts(block(1, "e2e\\a.spec.ts", "Test timeout of 90000ms exceeded."))).toBe(true);
  });
  it("one failure that is not a wait → not re-run: that is a defect, not a compile", () => {
    expect(e2eFailuresAreAllTimeouts(block(1, "e2e\\a.spec.ts", visible) + block(2, "e2e\\b.spec.ts", equal))).toBe(false);
  });
  it("the first block counts even when it starts the text — the one a slice(1) would drop", () => {
    expect(e2eFailuresAreAllTimeouts(block(1, "e2e\\a.spec.ts", equal) + block(2, "e2e\\b.spec.ts", visible))).toBe(false);
  });
  it("no failure blocks → nothing to re-run", () => {
    expect(e2eFailuresAreAllTimeouts("  12 passed (3.5m)\n")).toBe(false);
  });
  it("the server must have compiled something during the run", () => {
    expect(devServerCompiled("○ Compiling /admin/global-search ...\n GET /admin/global-search 200 in 43s")).toBe(true);
    expect(devServerCompiled(" GET /api/auth/me 200 in 119ms")).toBe(false);
  });
  it("the re-run is Playwright's own --last-failed, never a list built from request text", () => {
    expect(PLAYWRIGHT_RERUN_ARGS).toEqual(["test", "--last-failed"]);
  });
});
