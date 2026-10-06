/**
 * The OCR/AI allowance: one number for every account, per user.
 *                                                  (Slice #29.09a, #38.21)
 *
 * WHY THIS SUITE EXISTS
 * ---------------------
 * From #29.09a to #38.21 the allowance depended on the role — twenty a minute
 * for a superuser, five for everyone else. Since #38.21 there is one kind of
 * user, and every account has what the superuser had. Three things about that
 * are easy to break and expensive to notice:
 *
 *   1. **One number, the old superuser's.** Twenty is the size of a
 *      DocTypeEngine run (twenty reads, then one clustering call).
 *   2. **The client paces against the server's number.** `sample-read-pacing.ts`
 *      reads the allowance out of the limiter itself. If the two ever disagree,
 *      a run reports refusals as readings.
 *   3. **Nothing in the application reads `app_users.role` any more.** Six
 *      modules once ran the same drizzle query against it; since #38.21 none
 *      does — the role stays in the data for the Portal. The last test here
 *      fails the build if a reader comes back.
 */

import { checkOcrRateLimit, OCR_MAX_REQUESTS, OCR_WINDOW_MS } from "@/lib/rate-limit/ocr";
import * as limiter from "@/lib/rate-limit/ocr";
import { OCR_MAX_REQUESTS_ADMIN } from "@/lib/import/sample-read-pacing";

import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative, sep } from "path";

/** A clock the tests drive, so a window can pass in one statement. */
let clock = 1_000_000;

beforeEach(() => {
  clock = 1_000_000;
  jest.spyOn(Date, "now").mockImplementation(() => clock);
});

afterEach(() => {
  jest.restoreAllMocks();
});

/**
 * ⚠️ **EVERY CASE USES ITS OWN USER ID, AND THAT IS THE ISOLATION.** The
 * limiter's buckets are a module-level singleton, so one case's spending would
 * otherwise be the next one's starting point. `uniqueUser()` is the whole
 * mechanism — no reset function in a module the client bundle imports.
 */
let nextUser = 0;
function uniqueUser(label: string): string {
  nextUser += 1;
  return `${label}-${nextUser}`;
}

/** Spend `n` requests and return how many were allowed. */
function spend(userId: string, n: number): number {
  let allowed = 0;
  for (let i = 0; i < n; i += 1) {
    if (checkOcrRateLimit(userId).allowed) allowed += 1;
    clock += 100; // requests are not simultaneous; still well inside the window
  }
  return allowed;
}

describe("one allowance, every account's (Slice #38.21)", () => {
  it("is twenty a minute — what the superuser had", () => {
    expect(OCR_MAX_REQUESTS).toBe(20);
    expect(OCR_WINDOW_MS).toBe(60_000);
  });

  it("takes no role: the per-role table and its lookup are gone", () => {
    expect(Object.keys(limiter).sort()).toEqual(["OCR_MAX_REQUESTS", "OCR_WINDOW_MS", "checkOcrRateLimit"].sort());
    expect(checkOcrRateLimit.length).toBe(1);
  });

  it("lets an account through twenty times and refuses the twenty-first", () => {
    // Also the shape of a real DocTypeEngine run: twenty reads, then the
    // clustering call as the twenty-first. That refusal is why the run paces.
    const u = uniqueUser("acct");
    expect(spend(u, 20)).toBe(20);
    const refused = checkOcrRateLimit(u);
    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterSeconds).toBeGreaterThan(0);
  });
});

describe("the bucket", () => {
  it("is per user, not shared", () => {
    const a = uniqueUser("a");
    const b = uniqueUser("b");
    expect(spend(a, 20)).toBe(20);
    expect(checkOcrRateLimit(a).allowed).toBe(false);
    expect(checkOcrRateLimit(b).allowed).toBe(true);
  });

  it("does not charge for a refused request", () => {
    // The whole paced-retry design rests on this: a refusal that spent a slot
    // would push the next free slot further away on every retry.
    const u = uniqueUser("refused");
    spend(u, 20);
    for (let i = 0; i < 10; i += 1) expect(checkOcrRateLimit(u).allowed).toBe(false);
    clock += OCR_WINDOW_MS + 1;
    expect(checkOcrRateLimit(u).allowed).toBe(true);
  });

  it("frees one slot at a time as the window slides", () => {
    const u = uniqueUser("slide");
    spend(u, 20); // t0, t0+100 … t0+1900
    clock = 1_000_000 + OCR_WINDOW_MS + 1; // t0 has expired, t0+100 has not
    expect(checkOcrRateLimit(u).allowed).toBe(true);
    expect(checkOcrRateLimit(u).allowed).toBe(false);
  });

  it("answers Retry-After from the oldest request still in the window", () => {
    const u = uniqueUser("retry");
    spend(u, 20); // t0 … t0+1900; now t0+2000
    const refused = checkOcrRateLimit(u);
    expect(refused.allowed).toBe(false);
    // The slot that frees first is t0's, one window after t0: 58 000 ms away.
    expect(refused.retryAfterSeconds).toBe(58);
  });

  it("never answers Retry-After: 0", () => {
    // If the window filter ever becomes `>=`, a timestamp exactly on the
    // boundary survives, the raw value is 0, and this fails.
    const u = uniqueUser("hair");
    spend(u, 20);
    clock = 1_000_000 + OCR_WINDOW_MS - 1; // one millisecond before t0 expires
    const refused = checkOcrRateLimit(u);
    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });
});

describe("the client paces against the server's number", () => {
  it("reads the allowance out of the limiter itself", () => {
    expect(OCR_MAX_REQUESTS_ADMIN).toBe(OCR_MAX_REQUESTS);
  });
});

// ---------------------------------------------------------------------------
// Nothing reads app_users.role
// ---------------------------------------------------------------------------

const SRC = join(process.cwd(), "src");

function isTestFile(relPath: string): boolean {
  return relPath.includes("__tests__") || relPath.endsWith(".test.ts") || relPath.endsWith(".test.tsx");
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      out.push(...walk(full));
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

/** Strips block and line comments so a mention in prose is not a match. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("app_users.role is read nowhere (Slice #38.21)", () => {
  const files = walk(SRC);

  it("finds source files to scan", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("no module queries appUsers.role", () => {
    const offenders = files
      .map((f) => relative(SRC, f))
      .filter((rel) => !isTestFile(rel))
      .filter((rel) => /appUsers\s*\.\s*role/.test(stripComments(readFileSync(join(SRC, rel), "utf8"))))
      .map((rel) => rel.split(sep).join("/"));
    if (offenders.length > 0) {
      throw new Error(
        `These modules read app_users.role:\n\n${offenders.map((o) => `  - ${o}`).join("\n")}\n\n` +
          `Since Slice #38.21 there is one kind of user and the application reads no role: ask\n` +
          `hasFullAccess() / requireFullAccess() in "@/lib/auth/current-role". The role stays in\n` +
          `the data for the Portal, whose rule goes beside hasFullAccess, not into a module of its own.\n`,
      );
    }
    expect(offenders).toEqual([]);
  });
});
