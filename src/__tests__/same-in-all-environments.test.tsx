/**
 * Slice #38.22 — the same application in DEV, UAT and on Vercel.
 *
 * NEXT_PUBLIC_DEV_TOOLS is retired: the language toggle is drawn on every build,
 * the developer-notes panel on none (its note is in docs/claude/DEVELOPER-NOTES.md),
 * and nothing reads the flag. What UAT cannot offer — it has no Supabase project,
 * so no accounts — its screens say in one sentence instead of differing silently.
 */
import fs from "node:fs";
import path from "node:path";
import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
  usePathname: () => "/",
}));
jest.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require("react") as typeof import("react")).createElement("a", null, children),
}));
jest.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { signOut: jest.fn() } }) }));
jest.mock("@/components/locale-toggle", () => ({
  LocaleToggle: () =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require("react") as typeof import("react")).createElement("span", { "data-testid": "locale-toggle" }),
}));
jest.mock("@/components/recently-viewed-panel", () => ({ RecentlyViewedPanel: () => null }));
jest.mock("@/components/providers/unsaved-changes-provider", () => ({
  useUnsavedChanges: () => ({ guardedAction: (a: () => void) => a(), guardedNavigate: () => undefined }),
}));
jest.mock("@/components/providers/navigation-history-provider", () => ({ clearRecentlyViewed: () => undefined }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { SidebarNav } = require("@/components/sidebar/sidebar-nav") as typeof import("@/components/sidebar/sidebar-nav");

const ROOT = process.cwd();
const read = (...p: string[]) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const exists = (...p: string[]) => fs.existsSync(path.join(ROOT, ...p));
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
type Msgs = Record<string, Record<string, unknown>>;
const RO = JSON.parse(read("messages", "ro-RO.json")) as Msgs;
const EN = JSON.parse(read("messages", "en-GB.json")) as Msgs;

function renderSidebar(me: Record<string, unknown>) {
  global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => me }) as Response) as unknown as typeof fetch;
  const client = new QueryClient({ defaultOptions: { queries: { retry: 0 } } });
  return render(<QueryClientProvider client={client}><SidebarNav /></QueryClientProvider>);
}

describe("NEXT_PUBLIC_DEV_TOOLS is retired", () => {
  it("its helper, its wrapper and their guard test are gone", () => {
    expect(exists("src", "lib", "features", "dev-tools.ts")).toBe(false);
    expect(exists("src", "components", "dev-only.tsx")).toBe(false);
    expect(exists("src", "__tests__", "dev-tools-single-source.test.ts")).toBe(false);
  });

  it("no source reads it: the app, the middleware, the Next config, the e2e", () => {
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (!["node_modules", ".next", "__tests__"].includes(e.name)) walk(p);
        } else if (/\.(ts|tsx|mjs|js)$/.test(e.name)) {
          if (/NEXT_PUBLIC_DEV_TOOLS|isDevToolsEnabled|DevOnly\b|dev-only"/.test(code(fs.readFileSync(p, "utf8")))) offenders.push(path.relative(ROOT, p));
        }
      }
    };
    for (const d of ["src", "e2e"]) walk(path.join(ROOT, d));
    for (const f of ["middleware.ts", "next.config.ts"]) {
      if (/NEXT_PUBLIC_DEV_TOOLS/.test(code(read(f)))) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });

  it("the image is built without it: no ARG, ENV or --build-arg", () => {
    expect(read("Dockerfile")).not.toMatch(/(ARG|ENV)\s+NEXT_PUBLIC_DEV_TOOLS/);
    expect(read("build-ciprian-image.ps1")).not.toMatch(/--build-arg\s+"NEXT_PUBLIC_DEV_TOOLS/);
  });
});

describe("the language toggle is drawn on every build", () => {
  const before = process.env.NEXT_PUBLIC_DEV_TOOLS;
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_DEV_TOOLS;
  });
  afterAll(() => {
    if (before !== undefined) process.env.NEXT_PUBLIC_DEV_TOOLS = before;
  });

  it("in the sidebar's header, with no flag set", async () => {
    renderSidebar({ username: "tc-e2e", fullAccess: true });
    expect(await screen.findByTestId("locale-toggle")).toBeInTheDocument();
  });

  it("on the sign-in and request-access pages, unwrapped", () => {
    for (const page of ["login", "signup"]) {
      const c = code(read("src", "app", page, "page.tsx"));
      expect([page, c.includes("<LocaleToggle />")]).toEqual([page, true]);
    }
  });
});

describe("the developer-notes panel is gone, everywhere", () => {
  it("Settings draws no developer panel, and its two words are gone from both languages", () => {
    const view = code(read("src", "app", "admin", "settings", "_components", "settings-view.tsx"));
    expect(view).not.toMatch(/DeveloperPanel|showDevNotes|sectionDeveloper/);
    expect(view).toContain("<TimeFramesPanel />");
    for (const m of [RO, EN]) {
      expect((m.settings as Record<string, unknown>).sectionDeveloper).toBeUndefined();
      expect((m.settings as Record<string, unknown>).showDevNotes).toBeUndefined();
    }
  });

  it("its note lives in docs/claude/DEVELOPER-NOTES.md", () => {
    expect(read("docs", "claude", "DEVELOPER-NOTES.md")).toContain("Multi-user model is not production-ready");
  });
});

describe("UAT says what it cannot offer", () => {
  it("the sidebar: „Utilizatori & Acces” stays; instead of „Schimbă parola” and „Ieșire”, one sentence", async () => {
    renderSidebar({ username: "UAT", fullAccess: true, uatMode: true });
    const note = await screen.findByText("uatNoAccounts");
    expect(note).toHaveAttribute("data-uat-no-accounts", "sidebar");
    expect(screen.queryByRole("button", { name: "signOut" })).toBeNull();
    expect(screen.queryByRole("link", { name: "changePassword" })).toBeNull();
    expect(code(read("src", "components", "sidebar", "sidebar-nav.tsx"))).not.toMatch(/i\.key\s*!==\s*"users"/);
  });

  it("a signed-in account's sidebar has no such sentence", async () => {
    renderSidebar({ username: "tc-e2e", fullAccess: true });
    await waitFor(() => expect(screen.getByRole("button", { name: "signOut" })).toBeInTheDocument());
    expect(screen.queryByText("uatNoAccounts")).toBeNull();
  });

  it("„Utilizatori & Acces” and „Schimbă parola” say it on the screen, before anything else is tried", () => {
    const users = code(read("src", "app", "admin", "users", "page.tsx"));
    expect(users).toMatch(/if \(appUser\.isUat\) \{[\s\S]*?data-uat-no-accounts="users"[\s\S]*?t\("uatNoAccounts"\)/);
    expect(users.indexOf("if (appUser.isUat)")).toBeLessThan(users.indexOf("canManageAccounts(appUser)"));
    const pw = code(read("src", "app", "account", "change-password", "page.tsx"));
    expect(pw).toMatch(/isUatNoAuth\(\) \?[\s\S]*?data-uat-no-accounts="password"[\s\S]*?<ChangePasswordForm \/>/);
  });

  it("the three sentences, in both languages", () => {
    for (const m of [RO, EN]) {
      const nav = m.nav as Record<string, string>;
      const ua = m.usersAccess as Record<string, string>;
      const cp = (m.auth as Record<string, Record<string, string>>).changePassword;
      for (const s of [nav.uatNoAccounts, ua.uatNoAccounts, cp.uatNoAccounts]) expect((s ?? "").length).toBeGreaterThan(30);
    }
    expect((RO.usersAccess as Record<string, string>).uatNoAccounts).toMatch(/^Această instalare \(UAT\)/);
  });
});
