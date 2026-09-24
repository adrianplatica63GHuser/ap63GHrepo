/**
 * @jest-environment node
 */

/**
 * Slice Propus.2 — the request/result contract between Claude and the
 * Windows-side test runner (`scripts/test-runner/`).
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
  CHANNEL_DIR,
  MAX_ONLY_ENTRIES,
  MAX_REQUEST_BYTES,
  RUNNER_DIST_DIR,
  RUNNER_DIST_ENV,
  RUNNER_PORT,
  SEQUENCES,
  SEQUENCE_NAMES,
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
  summariseStep,
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
    expect(refusal(req({ sequence }))).toBe("accepted");
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
    ["busy", req(), "busy", { busyWith: "20260924T150000Z-1" }],
    ["git could not answer", req(), "head-unknown", { headCommit: null }],
    ["the wrong commit", req({ commit: "f".repeat(40) }), "head-mismatch"],
  ];

  it.each(cases)("%s → refused", (_label, raw, code, over) => {
    expect(refusal(raw, ctx(over ?? {}))).toBe(code);
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
