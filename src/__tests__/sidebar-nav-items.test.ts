/**
 * Every sidebar item has a label, and nothing in the nav is developer-only.
 *                                                                (Slice #32.19)
 *
 * WHY THIS EXISTS
 * ---------------
 * Two failures, one file, and the first of them is already written down as a
 * warning that nothing enforced. `itemLabels` in `sidebar-nav.tsx` is a
 * hand-written map that is NOT derived from `NAV_SECTIONS`, and its own comment
 * says so: "an item added to nav-config without a line here renders its raw key
 * in the sidebar, silently." Silently is exact — `sidebar-nav.tsx` falls back to
 * `item.key`, so a missing label ships a sidebar reading `groups` in BOTH
 * languages with no tsc error, no lint error and no failing test. This slice
 * adds three items, which is precisely the moment to make that comment false.
 *
 * The second is item 17 itself. Groups, Stamps and Tags existed as pages for
 * slices and appeared in no nav at all; the report read that as a consequence of
 * Settings being `devOnly`, which it was not — the pages were simply never
 * listed. The assertions below pin both halves of the fix: the entries exist,
 * and no nav item is gated by the build flag any more.
 *
 * ⚠️ **THIS IS A BEHAVIOUR GUARD, SO IT READS ONLY CODE.** The rule this repo
 * learned from `activity-cue-single-source.test.ts`: a guard about a NAME may
 * strip comments and must not punish them, and a guard about rendered behaviour
 * must read only code. `sidebar-nav.tsx` explains at length, in a comment, what
 * it used to do with `isDevToolsEnabled` — a scan that read comments would
 * accuse the file for describing its own history correctly.
 *
 * ⚠️ **`NAV_SECTIONS` IS IMPORTED, NOT PARSED.** `lucide-react` ships a CJS main
 * and declares no `exports` map, so `nav-config.ts` loads cleanly under
 * `next/jest` — unlike `sidebar-nav.tsx`, which is `"use client"` and pulls in
 * ESM-only next-intl. A regex over the config's source would pass happily the
 * day somebody reformats it onto two lines.
 */

import fs from "node:fs";
import path from "node:path";

import { NAV_SECTIONS, type NavItem } from "@/components/sidebar/nav-config";

const SRC = path.join(process.cwd(), "src");

function source(...parts: string[]): string {
  return fs.readFileSync(path.join(SRC, ...parts), "utf8");
}

/** Strip block and line comments — see the header: this guard reads only code. */
function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function messages(file: string): Record<string, unknown> {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "messages", file), "utf8"),
  ) as Record<string, unknown>;
}

function navItemLabels(file: string): Record<string, string> {
  const nav = messages(file).nav as { items?: Record<string, string> };
  if (!nav?.items) throw new Error(`${file} has no nav.items block`);
  return nav.items;
}

const EVERY_ITEM: NavItem[] = NAV_SECTIONS.flatMap((section) => section.items);
const SIDEBAR = stripComments(source("components", "sidebar", "sidebar-nav.tsx"));
const NAV_CONFIG = stripComments(source("components", "sidebar", "nav-config.ts"));

// ---------------------------------------------------------------------------
// The label map and the config agree
// ---------------------------------------------------------------------------

describe("every nav item can be read", () => {
  it("finds items to check", () => {
    // A regex-free sanity floor: if this ever drops, the import broke rather
    // than the nav shrinking, and every assertion below would pass vacuously.
    expect(EVERY_ITEM.length).toBeGreaterThanOrEqual(9);
    expect(new Set(EVERY_ITEM.map((i) => i.key)).size).toBe(EVERY_ITEM.length);
  });

  it("⚠️ has a line in sidebar-nav's itemLabels map for every item", () => {
    // The failure this test is named for: the map is hand-written and the
    // component falls back to `item.key`, so a missing line renders the key.
    //
    // Scoped to the `itemLabels` object rather than run over the whole file — a
    // round pointed out that `groups: t("items.groups")` written into any OTHER
    // map in this component would otherwise satisfy a test whose whole claim is
    // about THIS one.
    const block = /const itemLabels: Record<string, string> = \{([\s\S]*?)\n  \};/.exec(SIDEBAR);
    expect(block).not.toBeNull();
    const map = block![1]!;
    const missing = EVERY_ITEM.map((i) => i.key).filter(
      (key) => !new RegExp(`\\b${key}:\\s*t\\("items\\.${key}"\\)`).test(map),
    );
    expect(missing).toEqual([]);
  });

  it.each(["ro-RO.json", "en-GB.json"])(
    "%s has a nav.items entry for every item, and it is not blank",
    (file) => {
      const labels = navItemLabels(file);
      const bad: string[] = [];
      for (const { key } of EVERY_ITEM) {
        const label = labels[key];
        if (typeof label !== "string" || label.trim().length === 0) {
          bad.push(`${file}: nav.items.${key}`);
        }
      }
      expect(bad).toEqual([]);
    },
  );

  it("⚠️ the two locales do not ship the same word for a Romanian screen", () => {
    // Not a general rule — "DocTypeEngine" and "Import" are legitimately close.
    // This is about the three added here: the Romanian sidebar must not read
    // "Groups", which is what a copy-paste of the English block produces.
    const ro = navItemLabels("ro-RO.json");
    const en = navItemLabels("en-GB.json");
    for (const key of ["groups", "stamps", "tags"]) {
      expect([key, ro[key]]).not.toEqual([key, en[key]]);
    }
  });
});

// ---------------------------------------------------------------------------
// Item 17 — the three screens are reachable
// ---------------------------------------------------------------------------

describe("Groups, Stamps and Tags are in the sidebar", () => {
  const EXPECTED = [
    { key: "groups", href: "/admin/groups" },
    { key: "stamps", href: "/admin/stamps" },
    { key: "tags", href: "/admin/tags" },
  ] as const;

  it.each(EXPECTED)("$key is a nav item pointing at $href", ({ key, href }) => {
    const item = EVERY_ITEM.find((i) => i.key === key);
    expect([key, item?.href]).toEqual([key, href]);
  });

  it.each(EXPECTED)("$key's page actually exists on disk", ({ href }) => {
    // A nav entry to a route that is not there is the same dead link the
    // devOnly server-side redirects would have left behind.
    expect(fs.existsSync(path.join(SRC, "app", ...href.split("/").filter(Boolean), "page.tsx")))
      .toBe(true);
  });

  it.each(EXPECTED)("$key sits in a section the superuser filter covers", ({ key }) => {
    // ⚠️ **A nav entry is not by itself reachability.** src/app/admin/layout.tsx
    // redirects anyone whose role is not `superuser` away from all of /admin/*,
    // so these three would ship as dead links to a non-superuser if the sidebar
    // showed them to one. They need no per-item role field because they sit in
    // "administrationSetup", and sidebar-nav filters every section key starting
    // "administration" — the same set the layout guards, matched by the same
    // prefix. This test is what keeps the two matched.
    const section = NAV_SECTIONS.find((s) => s.items.some((i) => i.key === key));
    expect([key, section?.key.startsWith("administration")]).toEqual([key, true]);
    // Two fragments rather than the whole 88-character line: a reformat must not
    // fail a test titled "Groups sits in a section the superuser filter covers"
    // and send the next reader hunting through nav-config.
    expect(SIDEBAR).toContain('startsWith("administration")');
    expect(SIDEBAR).toContain("isSuperuser");
  });

  it("every admin nav item is under /admin/, which is what the layout guards", () => {
    const stray = NAV_SECTIONS.filter((s) => s.key.startsWith("administration"))
      .flatMap((s) => s.items)
      .filter((i) => i.href !== undefined && !i.href.startsWith("/admin/"))
      .map((i) => `${i.key} -> ${i.href}`);
    expect(stray).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Nothing in the nav is developer-only any more
// ---------------------------------------------------------------------------

describe("the nav is the same on a build without developer tools", () => {
  it("⚠️ nav-config declares no dev-tools gate", () => {
    // Adrian: "remove all the devonly clauses that allow only the developer to
    // see some screen items". The two entries that carried one — Help
    // information and Settings — are ordinary Admin-Setup items now, and the
    // optional field they used has gone with them, so a new item cannot
    // reintroduce the gate by copying a neighbour.
    expect(NAV_CONFIG).not.toContain("devOnly");
    expect(NAV_CONFIG).not.toContain("isDevToolsEnabled");
    expect(NAV_CONFIG).not.toContain("dev-tools");
  });

  it("⚠️ sidebar-nav filters no item by the build flag", () => {
    // The filter is gone, and so are the constant and the import that existed
    // only for it — in the same commit, because nothing in the verification
    // sequence reports an unused local here: no-unused-vars is "warn",
    // `npm run lint` passes no --max-warnings, tsconfig sets no noUnusedLocals,
    // and this Next version no longer runs ESLint during `next build`.
    expect(SIDEBAR).not.toContain("isDevToolsEnabled");
    expect(SIDEBAR).not.toContain("devOnly");
    expect(SIDEBAR).not.toContain("devTools");
  });

  it("⚠️ the two screens that were devOnly no longer redirect server-side", () => {
    // Hiding the item was only ever half the gate. A nav entry whose route still
    // refuses is a link that goes home without saying why — which is worse than
    // the state before, because now there is something to click.
    for (const screen of ["help-content", "settings"]) {
      const page = stripComments(source("app", "admin", screen, "page.tsx"));
      expect([screen, page.includes("isDevToolsEnabled")]).toEqual([screen, false]);
      expect([screen, page.includes("redirect(")]).toEqual([screen, false]);
    }
  });

  it("⚠️ the locale toggle is still gated, and deliberately", () => {
    // The split, stated where a future reader will look for it. Every user of
    // this archive is Romanian; a flag that puts the whole interface into
    // English — on the sign-in page, before anyone has authenticated — is not a
    // developer diagnostic, it is a control that can only do harm on Ciprian's
    // box. #20.10's Settings checkbox was removed for the same reason, and
    // Settings is a business screen again, so there is nowhere else it could go.
    expect(SIDEBAR).toContain("<DevOnly>");
    expect(SIDEBAR).toContain("<LocaleToggle />");
    for (const page of ["login", "signup"]) {
      expect([page, stripComments(source("app", page, "page.tsx")).includes("<DevOnly>")])
        .toEqual([page, true]);
    }
  });

  it("⚠️ …and so is the Settings page's developer-notes panel — the other exception", () => {
    // The second exception, found by an adversarial round rather than chosen up
    // front. Revealing the Settings ROUTE puts it in front of Ciprian — the UAT
    // box reports as a superuser, so admin/layout.tsx admits him — and the panel
    // renders a hard-coded ENGLISH note about this application's multi-user
    // model not being production-ready, under a translated Romanian heading.
    // Time frames, which is what a person comes to that screen for, is revealed.
    const view = stripComments(source("app", "admin", "settings", "_components", "settings-view.tsx"));
    expect(view).toContain("<DevOnly>");
    expect(view).toContain("<DeveloperPanel />");
    expect(view).toContain("<TimeFramesPanel />");
    // The time-frames panel must NOT be the one inside the wrapper.
    expect(view.indexOf("<TimeFramesPanel />")).toBeLessThan(view.indexOf("<DevOnly>"));
  });
});
