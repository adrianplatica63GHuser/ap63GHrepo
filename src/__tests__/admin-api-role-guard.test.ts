/**
 * Every handler under /api/admin checks the role, or says why it may not.
 *                                                              (Slice #36.20)
 *
 * ⚠️ **A ROUTE HANDLER IS NOT GUARDED BY BEING UNDER /admin.** The page layout
 * `src/app/admin/layout.tsx` never runs for `src/app/api/admin/**`, so until
 * #36.20 nineteen of the twenty-six handlers there answered any signed-in
 * account — a `user` could write reference data, help text and imports the
 * screens would never have shown it (FU-002).
 *
 * This is the help-coverage pattern again, deliberately: a files-only suite
 * that walks every `route.ts`, reads its CODE (comments stripped, so a comment
 * that mentions the helper is not a call), and fails when
 *   - an exported POST, PUT, PATCH or DELETE does not call a role check, or
 *   - an exported GET neither calls one nor is in ADMIN_API_OPEN_READS
 *     (`src/lib/auth/admin-api-access.ts`) with a reason.
 * No server, no database — so it runs in CI, on every push.
 *
 * What counts as a role check is a short, closed list: `requireSuperuser()`,
 * the one helper; `canManageAccounts(`, the account screens' stricter rule;
 * and the rate-limited handlers' own `role !== "superuser"` after
 * `getCurrentUserIdAndRole()` (read-sample, cluster, extract-id-card), which
 * need the role anyway to size their bucket. `import/preflight` answers its own
 * question about the role and is named below with its reason.
 */

import { readdirSync, readFileSync, statSync } from "fs";
import ts from "typescript";
import { join, relative, sep } from "path";
import { ADMIN_API_OPEN_READS } from "@/lib/auth/admin-api-access";

const ROOT = join(__dirname, "..", "..");
const ADMIN_API = join(ROOT, "src", "app", "api", "admin");
const MUTATING = ["POST", "PUT", "PATCH", "DELETE"] as const;

/** Handlers that decide on the role in their own words, and why that is enough. */
const OWN_ROLE_LOGIC: Readonly<Record<string, string>> = {
  "import/preflight":
    "Tells the import wizard whether THIS caller may import, so it must answer a non-superuser rather than refuse one; it reads the role through getCurrentAppUser().",
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : name === "route.ts" ? [p] : [];
  });
}

/** `src/app/api/admin/value-lists/[list]/route.ts` → `value-lists/[list]`. */
function routeKey(file: string): string {
  return relative(ADMIN_API, file).split(sep).slice(0, -1).join("/");
}

/**
 * The code of the exported handler `method`, found in TypeScript's own syntax
 * tree and printed back WITHOUT COMMENTS — so a comment that names the helper
 * is not a call.
 *
 * ⚠️ **NOT A REGEX, AND NOT A BRACE COUNT — BOTH WERE TRIED.** A regex that
 * stripped `/* … *\/` read the string `"image/*"` in `read-sample` as a comment
 * opening and ate the handler's role check; counting braces stopped at a `{`
 * inside a string. The parser knows a string from a comment and a body from a
 * signature; neither shortcut does.
 */
function handlerBody(source: string, method: string): string | null {
  const sf = ts.createSourceFile("route.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const printer = ts.createPrinter({ removeComments: true });
  for (const node of sf.statements) {
    const exported = ts.canHaveModifiers(node) &&
      (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!exported) continue;
    if (ts.isFunctionDeclaration(node) && node.name?.text === method && node.body) {
      return printer.printNode(ts.EmitHint.Unspecified, node.body, sf);
    }
    if (ts.isVariableStatement(node)) {
      for (const d of node.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.name.text === method && d.initializer) {
          return printer.printNode(ts.EmitHint.Unspecified, d.initializer, sf);
        }
      }
    }
  }
  return null;
}

function checksRole(body: string): boolean {
  return (
    /\brequireSuperuser\(\)/.test(body) ||
    /\bcanManageAccounts\(/.test(body) ||
    (/\bgetCurrentUserIdAndRole\(\)/.test(body) && /role\s*!==\s*"superuser"/.test(body))
  );
}

const files = walk(ADMIN_API).sort();
const handlers = files.flatMap((file) => {
  const code = readFileSync(file, "utf8");
  return ["GET", ...MUTATING].flatMap((method) => {
    const body = handlerBody(code, method);
    return body ? [{ key: routeKey(file), file: relative(ROOT, file).split(sep).join("/"), method, body }] : [];
  });
});

describe("the /api/admin role guard", () => {
  it("finds the handlers", () => {
    // Guards the walker: returning nothing would make every case below vacuous.
    expect(files.length).toBeGreaterThanOrEqual(26);
    expect(handlers.filter((h) => h.method !== "GET").length).toBeGreaterThanOrEqual(15);
  });

  it.each(handlers.filter((h) => h.method !== "GET").map((h) => [`${h.method} ${h.key}`, h] as const))(
    "%s checks the role",
    (_name, h) => {
      if (!checksRole(h.body) && !(h.key in OWN_ROLE_LOGIC)) {
        throw new Error(
          `${h.file}: ${h.method} writes under /api/admin and checks no role.\n\n` +
            `A route handler is not guarded by being under /admin — the page layout never runs for it.\n` +
            `Start the handler with\n\n` +
            `  const denied = await requireSuperuser();\n  if (denied) return denied;\n\n` +
            `and import it from "@/lib/auth/current-role".\n`,
        );
      }
    },
  );

  it.each(handlers.filter((h) => h.method === "GET").map((h) => [`GET ${h.key}`, h] as const))(
    "%s is guarded or listed as an open read",
    (_name, h) => {
      const guarded = checksRole(h.body) || h.key in OWN_ROLE_LOGIC;
      const listed = h.key in ADMIN_API_OPEN_READS;
      if (!guarded && !listed) {
        throw new Error(
          `${h.file}: GET checks no role, and is not in ADMIN_API_OPEN_READS.\n\n` +
            `If only /admin screens read it, start the handler with\n` +
            `  const denied = await requireSuperuser();\n  if (denied) return denied;\n` +
            `If a screen a \`user\` works on reads it, add\n` +
            `  "${h.key}": "<the screen that needs it>",\n` +
            `to ADMIN_API_OPEN_READS in src/lib/auth/admin-api-access.ts.\n`,
        );
      }
      // Both at once is a contradiction the list would hide: it says open, the code says closed.
      expect(guarded && listed).toBe(false);
    },
  );

  it.each(Object.keys(ADMIN_API_OPEN_READS).map((k) => [k] as const))(
    "ADMIN_API_OPEN_READS names a GET that exists: %s",
    (key) => {
      expect(handlers.some((h) => h.key === key && h.method === "GET")).toBe(true);
      expect(ADMIN_API_OPEN_READS[key].length).toBeGreaterThan(20);
    },
  );

  it("recognises the one helper, and not a mention of it", () => {
    const body = (src: string) => handlerBody(src, "POST") ?? "";
    expect(checksRole(body("export async function POST() {\n  const denied = await requireSuperuser();\n  if (denied) return denied;\n}"))).toBe(true);
    expect(checksRole(body("export async function POST() {\n  // requireSuperuser()\n  return ok;\n}"))).toBe(false);
    expect(checksRole(body('export async function POST() {\n  const m = "image/*";\n  const denied = await requireSuperuser();\n}'))).toBe(true);
    expect(checksRole(body("export async function POST() {\n  const r = await getCurrentUserIdAndRole();\n  return r;\n}"))).toBe(false);
    expect(handlerBody("async function POST() {}", "POST")).toBeNull();
  });
});
