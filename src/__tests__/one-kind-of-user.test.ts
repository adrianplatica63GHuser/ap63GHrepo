/**
 * @jest-environment node
 */
/**
 * Slice #38.21 — one kind of user: every account of this application has the
 * superuser's reach.
 *
 * Every former role check is one predicate, `hasFullAccess()` in
 * `src/lib/auth/current-role.ts`: a signed-in account with an `app_users` row
 * may use the whole application, whatever the row's `role` says. A request
 * without a session, and an account without a row, are refused as before. The
 * approve route creates every account as `superuser`; the role stays in the
 * data for the Portal.
 */
import fs from "node:fs";
import path from "node:path";

const mockGetCurrentUser = jest.fn();
jest.mock("@/lib/auth/current-user", () => ({
  ANONYMOUS_USER_ID: "anonymous",
  getCurrentUser: () => mockGetCurrentUser(),
}));

/** The rows `app_users` answers with; the select chain ends in `.limit()`. */
let mockRows: Array<Record<string, unknown>> = [];
let mockThrow = false;
jest.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            if (mockThrow) throw new Error("pooler down");
            return mockRows;
          },
        }),
      }),
    }),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const auth = require("@/lib/auth/current-role") as typeof import("@/lib/auth/current-role");

const ROOT = process.cwd();
const read = (...p: string[]) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const SIGNED_IN = { id: "uid-1", email: "tc-e2e-user@example.com", isUat: false };

beforeEach(() => {
  mockRows = [];
  mockThrow = false;
  mockGetCurrentUser.mockReset();
});

describe("the one predicate", () => {
  it("a row is full access; no row is not; the UAT identity is", () => {
    expect(auth.hasFullAccess({ isUat: false, hasRow: true })).toBe(true);
    expect(auth.hasFullAccess({ isUat: false, hasRow: false })).toBe(false);
    expect(auth.hasFullAccess({ isUat: true, hasRow: false })).toBe(true);
  });

  it("an account whose row still says „user” has the whole application", async () => {
    mockGetCurrentUser.mockResolvedValue(SIGNED_IN);
    mockRows = [{ username: "tc-e2e-user", role: "user" }];
    const me = await auth.getCurrentAppUser();
    expect(me).toMatchObject({ username: "tc-e2e-user", hasRow: true });
    expect(auth.hasFullAccess(me!)).toBe(true);
    expect(auth.canManageAccounts(me!)).toBe(true);
    expect(await auth.requireFullAccess()).toBeNull();
    expect(await auth.getCurrentUserIdAndAccess()).toEqual({ userId: "uid-1", fullAccess: true, degraded: false });
  });

  it("an account with no app_users row is refused, 403", async () => {
    mockGetCurrentUser.mockResolvedValue(SIGNED_IN);
    mockRows = [];
    const me = await auth.getCurrentAppUser();
    expect(me).toMatchObject({ username: null, hasRow: false });
    expect(auth.hasFullAccess(me!)).toBe(false);
    expect(auth.canManageAccounts(me!)).toBe(false);
    const res = await auth.requireFullAccess();
    expect(res?.status).toBe(403);
  });

  it("no session: no account at all, and the guard refuses (503 — the middleware already sent the person to /login)", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    expect(await auth.getCurrentAppUser()).toBeNull();
    const res = await auth.requireFullAccess();
    expect(res?.status).toBe(503);
    expect(await auth.getCurrentUserIdAndAccess()).toEqual({ userId: "anonymous", fullAccess: false, degraded: false });
  });

  it("a lookup that failed is degraded — 503, never a 403", async () => {
    mockGetCurrentUser.mockResolvedValue(SIGNED_IN);
    mockThrow = true;
    const spy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await auth.getCurrentUserIdAndAccess()).toEqual({ userId: "uid-1", fullAccess: false, degraded: true });
    expect((await auth.requireFullAccess())?.status).toBe(503);
    spy.mockRestore();
  });

  it("the UAT box keeps the whole application but not the account screens", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "uat", email: null, isUat: true });
    const me = await auth.getCurrentAppUser();
    expect(auth.hasFullAccess(me!)).toBe(true);
    expect(auth.canManageAccounts(me!)).toBe(false);
  });
});

describe("every former role check is on the predicate", () => {
  const src = (...p: string[]) => code(read("src", ...p));

  it("the /admin layout, the import preflight and the „Roluri pe Document” link", () => {
    expect(src("app", "admin", "layout.tsx")).toContain("if (!hasFullAccess(appUser)) redirect(\"/\");");
    expect(src("app", "api", "admin", "import", "preflight", "route.ts")).toContain("if (!hasFullAccess(caller))");
    expect(src("lib", "auth", "can-configure-roles.ts")).toContain("hasFullAccess(appUser)");
  });

  it("the three routes that spend Anthropic calls and refused by role", () => {
    for (const p of [
      ["app", "api", "admin", "doc-type-engine", "cluster", "route.ts"],
      ["app", "api", "admin", "doc-type-engine", "read-sample", "route.ts"],
      ["app", "api", "admin", "import", "extract-id-card", "route.ts"],
    ]) {
      // Read raw: a route's own strings ("image/*") defeat the simple comment stripper.
      const c = read("src", ...p);
      expect([p.join("/"), c.includes("await getCurrentUserIdAndAccess()"), /if \(!fullAccess\)/.test(c), c.includes("checkOcrRateLimit(userId)")])
        .toEqual([p.join("/"), true, true, true]);
    }
  });

  it("/api/auth/me answers whether the account has the whole application, not a role", () => {
    const c = src("app", "api", "auth", "me", "route.ts");
    expect(c).toContain("fullAccess: hasFullAccess(appUser)");
    expect(c).not.toMatch(/\brole\s*:/);
    expect(src("components", "sidebar", "sidebar-nav.tsx")).toContain("sectionsFor(NAV_SECTIONS, fullAccess)");
  });

  it("no module in the application compares against „superuser”", () => {
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name !== "__tests__") walk(p);
        } else if (/\.tsx?$/.test(e.name)) {
          const c = code(fs.readFileSync(p, "utf8"));
          if (/[!=]==\s*["']superuser["']|["']superuser["']\s*[!=]==/.test(c)) offenders.push(path.relative(ROOT, p));
        }
      }
    };
    walk(path.join(ROOT, "src"));
    expect(offenders).toEqual([]);
  });

  it("„superuser” is written only where the role lives: roles.ts, the schema, and the approve route that writes it", () => {
    const found: string[] = [];
    const walk = (dir: string): void => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name !== "__tests__") walk(p);
        } else if (/\.tsx?$/.test(e.name) && /["']superuser["']/.test(code(fs.readFileSync(p, "utf8")))) {
          found.push(path.relative(ROOT, p).split(path.sep).join("/"));
        }
      }
    };
    walk(path.join(ROOT, "src"));
    expect(found.sort()).toEqual([
      "src/app/api/admin/user-requests/approve/route.ts",
      "src/db/schema/index.ts",
      "src/lib/auth/roles.ts",
    ]);
  });
});

describe("a newly approved account is a superuser", () => {
  it("the approve route writes „superuser” — in the Auth metadata and in app_users — and never „user”", () => {
    const c = code(read("src", "app", "api", "admin", "user-requests", "approve", "route.ts"));
    expect(c.match(/role:\s*"superuser"/g)).toHaveLength(2);
    expect(c).not.toMatch(/role:\s*"user"/);
  });
});
