/**
 * Auth single-source guard  (Slice #21.11.uat.auth)
 *
 * Ciprian's UAT box runs with UAT_NO_AUTH=true and no Supabase project. The
 * rule "UAT bypasses auth" was copy-pasted into middleware.ts,
 * admin/layout.tsx, api/auth/me and lib/storage — but 25 files called
 * supabase.auth.getUser() directly, and /api/documents/[id]/process hard-
 * failed with 401 on that box. The client showed "Sesiunea a expirat. Vă
 * rugăm să vă autentificați din nou", which Ciprian could not act on because
 * UAT mode deliberately hides the login link.
 *
 * The bug was not the missing check. It was that the rule was duplicated and
 * unenforced. This test enforces it: identity resolution happens in
 * src/lib/auth/current-user.ts and nowhere else.
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative, sep } from "path";

const SRC = join(process.cwd(), "src");

/** The helper is the one legitimate caller. */
const ALLOWED = [join("lib", "auth", "current-user.ts")];

/**
 * Test files are excluded from the scan.
 *
 * Not a convenience exemption — this file's own failure messages quote the
 * very patterns it bans ("supabase.auth.getUser()", "UAT_NO_AUTH"), so
 * scanning itself made the guard report itself as an offender on its first
 * run. Comments are stripped before matching, but these live in template
 * literals. Tests are not request paths, so a mock or a quoted pattern in one
 * is never the defect this guard is looking for.
 */
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

describe("auth is resolved in exactly one place", () => {
  const files = walk(SRC);

  it("finds source files to scan", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("no module outside the helper calls supabase.auth.getUser()", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const rel = relative(SRC, file);
      if (ALLOWED.some((a) => rel === a || rel === a.split("/").join(sep))) continue;
      if (isTestFile(rel)) continue;

      const code = stripComments(readFileSync(file, "utf8"));
      if (/\.auth\s*\.\s*getUser\s*\(/.test(code)) {
        offenders.push(rel.split(sep).join("/"));
      }
    }

    if (offenders.length > 0) {
      throw new Error(
        `These modules resolve the user themselves instead of using the shared helper:\n\n` +
          offenders.map((o) => `  - ${o}`).join("\n") +
          `\n\nUse getCurrentUser() / getCurrentUserId() / getCurrentUserEmail()\n` +
          `from "@/lib/auth/current-user" instead.\n\n` +
          `A direct supabase.auth.getUser() call does not know about\n` +
          `UAT_NO_AUTH, so it returns no user on Ciprian's UAT box. A route\n` +
          `that 401s there surfaces as "session expired" on a build with no\n` +
          `login link — which is what this guard exists to prevent.\n`,
      );
    }

    expect(offenders).toEqual([]);
  });

  it("UAT_NO_AUTH is only read by the helper and the middleware", () => {
    // middleware.ts sits outside src/ and is the one other legitimate reader:
    // it must decide whether to run the Supabase session refresh at all,
    // before any route code executes.
    const offenders: string[] = [];

    for (const file of files) {
      const rel = relative(SRC, file);
      if (ALLOWED.some((a) => rel === a || rel === a.split("/").join(sep))) continue;
      if (isTestFile(rel)) continue;

      const code = stripComments(readFileSync(file, "utf8"));
      if (code.includes("UAT_NO_AUTH")) {
        offenders.push(rel.split(sep).join("/"));
      }
    }

    if (offenders.length > 0) {
      throw new Error(
        `These modules read process.env.UAT_NO_AUTH directly:\n\n` +
          offenders.map((o) => `  - ${o}`).join("\n") +
          `\n\nImport isUatNoAuth() from "@/lib/auth/current-user" instead, so\n` +
          `the definition of "are we in UAT mode?" stays in one module.\n`,
      );
    }

    expect(offenders).toEqual([]);
  });
});
