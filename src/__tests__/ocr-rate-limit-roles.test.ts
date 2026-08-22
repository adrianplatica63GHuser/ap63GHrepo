/**
 * The OCR/AI allowance is per user AND per role.               (Slice #29.09a)
 *
 * WHY THIS SUITE EXISTS
 * ---------------------
 * The limiter used to allow one number to everybody, and #29.09 discovered
 * that a DocTypeEngine run of twenty samples plus one clustering call cannot
 * fit inside it. The answer was not to raise the number for everyone: the
 * screens that need twenty are all inside /admin, which is superuser-only, and
 * the routes a normal user reaches are single-document actions that have never
 * needed more than a handful. So a superuser gets twenty a minute and everyone
 * else five.
 *
 * Two things about that are easy to break and expensive to notice:
 *
 *   1. **The client paces against the server's number.** `sample-read-pacing.ts`
 *      reads the superuser allowance out of the limiter itself. If the two ever
 *      disagree, a run reports refusals as readings — and the count of samples
 *      read IS the answer that run produces.
 *   2. **The role is resolved in one place.** SIX modules used to run the same
 *      drizzle query against `app_users.role`; the limiter would have been the
 *      seventh. The last test here fails the build if another appears.
 */

import {
  checkOcrRateLimit,
  ocrMaxRequests,
  OCR_MAX_REQUESTS_BY_ROLE,
  OCR_WINDOW_MS,
} from "@/lib/rate-limit/ocr";
import { OCR_MAX_REQUESTS_ADMIN } from "@/lib/import/sample-read-pacing";
import { APP_ROLES } from "@/lib/auth/roles";

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
 * otherwise be the next one's starting point. The obvious fix — exporting a
 * `__resetForTests()` — puts a function that empties every user's allowance
 * into a production module the client bundle imports, to solve a problem the
 * bucket key already solves. `uniqueUser()` is the whole mechanism.
 */
let nextUser = 0;
function uniqueUser(label: string): string {
  nextUser += 1;
  return `${label}-${nextUser}`;
}

/** Spend `n` requests and return how many were allowed. */
function spend(userId: string, role: "superuser" | "user", n: number): number {
  let allowed = 0;
  for (let i = 0; i < n; i += 1) {
    if (checkOcrRateLimit(userId, role).allowed) allowed += 1;
    clock += 100; // requests are not simultaneous; still well inside the window
  }
  return allowed;
}

describe("the allowance depends on the role", () => {
  it("gives a superuser twenty a minute and everyone else five", () => {
    expect(OCR_MAX_REQUESTS_BY_ROLE.superuser).toBe(20);
    expect(OCR_MAX_REQUESTS_BY_ROLE.user).toBe(5);
  });

  it("has an allowance for every role the application knows about", () => {
    // A new role added to APP_ROLES without a number here would be a route that
    // 429s on its first request (undefined >= anything is false, so in fact it
    // would never refuse at all) — the exact silent failure the Record type is
    // there to prevent. This asserts the runtime side of that.
    for (const role of APP_ROLES) {
      expect(typeof ocrMaxRequests(role)).toBe("number");
      expect(ocrMaxRequests(role)).toBeGreaterThan(0);
    }
  });

  it("lets a superuser through twenty times and refuses the twenty-first", () => {
    // Also the shape of a real DocTypeEngine run: twenty reads, then the
    // clustering call as the twenty-first. That refusal is why the run paces
    // and why `slotStarts` is threaded through to the clustering call at all.
    const u = uniqueUser("su");
    expect(spend(u, "superuser", 20)).toBe(20);
    const refused = checkOcrRateLimit(u, "superuser");
    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("lets a normal user through five times and refuses the sixth", () => {
    const u = uniqueUser("u");
    expect(spend(u, "user", 5)).toBe(5);
    expect(checkOcrRateLimit(u, "user").allowed).toBe(false);
  });

  it("⚠️ refuses a role it does not recognise rather than letting it through", () => {
    // ⚠️ **THE ONE PLACE THIS SLICE FAILED OPEN, FOUND BY AN ADVERSARIAL ROUND.**
    // `ocrMaxRequests` was `return OCR_MAX_REQUESTS_BY_ROLE[role]` with nothing
    // else, on the reasoning that `AppRole` makes an unknown role impossible.
    // The role comes out of Postgres: `ALTER TYPE app_user_role ADD VALUE
    // 'auditor'` without editing `src/db/schema/index.ts` leaves the build green
    // and makes that lookup `undefined` — and `length >= undefined` is FALSE, so
    // the account would never have been refused a single billed request. The
    // cast below is the point of the test: it reproduces exactly what the
    // database can hand the limiter and the type system cannot stop.
    const rogue = "auditor" as unknown as "user";
    const lowest = Math.min(...Object.values(OCR_MAX_REQUESTS_BY_ROLE));
    expect(ocrMaxRequests(rogue)).toBe(lowest);
    const u = uniqueUser("rogue");
    expect(spend(u, rogue, lowest)).toBe(lowest);
    expect(checkOcrRateLimit(u, rogue).allowed).toBe(false);
  });
});

describe("the bucket", () => {
  it("is per user, not shared", () => {
    const a = uniqueUser("a");
    const b = uniqueUser("b");
    expect(spend(a, "user", 5)).toBe(5);
    expect(checkOcrRateLimit(a, "user").allowed).toBe(false);
    expect(checkOcrRateLimit(b, "user").allowed).toBe(true);
  });

  it("does not charge for a refused request", () => {
    // The whole paced-retry design rests on this: a refusal that spent a slot
    // would push the next free slot further away on every retry.
    const u = uniqueUser("refused");
    spend(u, "user", 5);
    for (let i = 0; i < 10; i += 1) expect(checkOcrRateLimit(u, "user").allowed).toBe(false);
    clock += OCR_WINDOW_MS + 1;
    expect(checkOcrRateLimit(u, "user").allowed).toBe(true);
  });

  it("frees one slot at a time as the window slides", () => {
    // Five requests 100 ms apart, then a window later the first has expired and
    // exactly one slot is free.
    const u = uniqueUser("slide");
    spend(u, "user", 5);
    clock = 1_000_000 + OCR_WINDOW_MS + 1;
    expect(checkOcrRateLimit(u, "user").allowed).toBe(true);
    expect(checkOcrRateLimit(u, "user").allowed).toBe(false);
  });

  it("answers Retry-After from the slot that actually frees capacity", () => {
    // A user demoted mid-window holds more timestamps than their allowance.
    // Answering with the OLDEST of them would promise a slot that is fifteen
    // requests away from being free — the caller would retry, be refused, and
    // be told the same wrong number again.
    const u = uniqueUser("demoted");
    spend(u, "superuser", 20); // 20 requests, 100 ms apart, from t0
    const refused = checkOcrRateLimit(u, "user");
    expect(refused.allowed).toBe(false);
    // now = t0 + 2000. The 5th-from-last request was made at t0 + 1500 and its
    // slot frees one window later: 59_500 ms away, so 60 s.
    expect(refused.retryAfterSeconds).toBe(60);
    // The oldest timestamp in the window (t0) would have answered 58 — a slot
    // two seconds from now that is in fact fifteen requests away from freeing.
    expect(refused.retryAfterSeconds).not.toBe(58);
  });

  it("never answers Retry-After: 0", () => {
    // ⚠️ **THIS ASSERTS THE FLOOR, NOT THE CLAMP, AND THE DIFFERENCE MATTERS.**
    // A round measured that `Math.max(1, …)` in the limiter never fires: the
    // window filter is a strict `>`, so the raw value here is 1 ms and
    // `Math.ceil` alone answers 1 — deleting the clamp leaves this green. What
    // this case does guard is the floor itself: if the filter ever becomes
    // `>=`, a timestamp exactly on the boundary survives, the raw value is 0,
    // and this fails.
    const u = uniqueUser("hair");
    spend(u, "user", 5); // at t0, t0+100 … t0+400
    clock = 1_000_000 + OCR_WINDOW_MS - 1; // one millisecond before t0 expires
    const refused = checkOcrRateLimit(u, "user");
    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });
});

describe("the client paces against the server's number", () => {
  it("reads the superuser allowance out of the limiter itself", () => {
    expect(OCR_MAX_REQUESTS_ADMIN).toBe(OCR_MAX_REQUESTS_BY_ROLE.superuser);
  });
});

// ---------------------------------------------------------------------------
// The role is resolved in exactly one place
// ---------------------------------------------------------------------------

const SRC = join(process.cwd(), "src");

/** Exactly one module is allowed to read the column. */
const ALLOWED_ROLE_READERS = [join("lib", "auth", "current-role.ts")];

function isTestFile(relPath: string): boolean {
  return (
    relPath.includes("__tests__") ||
    relPath.endsWith(".test.ts") ||
    relPath.endsWith(".test.tsx")
  );
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
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("app_users.role is read in exactly one place", () => {
  const files = walk(SRC);

  it("finds source files to scan", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("⚠️ keeps the allowlist honest — every entry still reads the column", () => {
    // Two other guard suites in this repo carry this test, for the reason it
    // exists here too: an allowlist entry that stops matching is a permission
    // nobody notices is still granted. `db/schema/index.ts` was on this list in
    // the first draft and never matched at all — the schema declares
    // `role: appUserRoleEnum("role")`, which is not `appUsers.role`.
    for (const allowed of ALLOWED_ROLE_READERS) {
      const code = readFileSync(join(SRC, allowed), "utf8");
      expect({ allowed, reads: /appUsers\s*\.\s*role/.test(code) }).toEqual({
        allowed,
        reads: true,
      });
    }
  });

  it("no module outside the resolver queries appUsers.role", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const rel = relative(SRC, file);
      if (ALLOWED_ROLE_READERS.some((a) => rel === a || rel === a.split("/").join(sep))) continue;
      if (isTestFile(rel)) continue;

      const code = stripComments(readFileSync(file, "utf8"));
      if (/appUsers\s*\.\s*role/.test(code)) {
        offenders.push(rel.split(sep).join("/"));
      }
    }

    if (offenders.length > 0) {
      throw new Error(
        `These modules resolve the caller's role themselves:\n\n` +
          offenders.map((o) => `  - ${o}`).join("\n") +
          `\n\nUse getCurrentAppUser() or getCurrentUserIdAndRole() from\n` +
          `"@/lib/auth/current-role" instead.\n\n` +
          `The query was copy-pasted into six modules before Slice #29.09a —\n` +
          `admin/layout.tsx, admin/users/page.tsx, api/auth/me, import/preflight\n` +
          `and user-requests/{approve,reject} — and the rate limiter would have\n` +
          `been the seventh. Each copy has to decide for itself what UAT mode and\n` +
          `a missing app_users row mean, and they did not all decide the same.\n`,
      );
    }

    expect(offenders).toEqual([]);
  });
});
