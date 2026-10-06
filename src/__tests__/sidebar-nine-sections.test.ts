/**
 * Slice #38.20 — the left navigation in nine sections: Tablou de bord,
 * Domeniu, Funcții, Import, Rapoarte, Administrare, Setări, Studiu, Ajutor.
 *
 * Every screen that exists is reachable from it; an item whose screen does not
 * exist yet is a disabled „În curând" placeholder; „Rapoarte" → „În lucru"
 * opens /reports; Settings has no „Altele"; since #38.21 every account with an
 * app_users row sees it all, one without a row the dashboard and the four lists. The browser half is TC-NAV-01.
 */
import fs from "node:fs";
import path from "node:path";
import { NAV_SECTIONS } from "@/components/sidebar/nav-config";
import { getActiveHref, getActiveSectionKey, sectionsFor } from "@/components/sidebar/sidebar-helpers";

// breadcrumb-bar.tsx is a client component; only its pure `buildSegments` is under test below, so
// what it imports for rendering is stood in for (breadcrumb-copy.test.ts does the same).
jest.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));
jest.mock("next/navigation", () => ({ usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
jest.mock("@/components/providers/navigation-history-provider", () => ({ useNavigationHistory: () => ({}) }));
jest.mock("@/components/help/screen-help-button", () => ({ ScreenHelpButton: () => null }));

const ROOT = process.cwd();
const read = (...p: string[]) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
type Msgs = Record<string, Record<string, unknown>>;
const RO = JSON.parse(read("messages", "ro-RO.json")) as Msgs;
const EN = JSON.parse(read("messages", "en-GB.json")) as Msgs;
const nav = (m: Msgs) => m.nav as { sections: Record<string, string>; items: Record<string, string>; comingSoon: string };

describe("the nine sections, in order, each with its items", () => {
  it("top to bottom", () => {
    expect(NAV_SECTIONS.map((s) => nav(RO).sections[s.key])).toEqual([
      "Tablou de bord", "Domeniu", "Funcții", "Import", "Rapoarte", "Administrare", "Setări", "Studiu", "Ajutor",
    ]);
  });

  it("each section's items, by their Romanian names; a placeholder has no address", () => {
    const tree = NAV_SECTIONS.map((s) => [nav(RO).sections[s.key], s.href ?? null, s.items.map((i) => [nav(RO).items[i.key], i.href ?? null])]);
    expect(tree).toEqual([
      ["Tablou de bord", "/", []],
      ["Domeniu", null, [["Persoane Fizice", "/natural-persons"], ["Persoane Juridice", "/judicial-persons"], ["Proprietăți", "/properties"], ["Acte", "/documents"], ["Date de referință", "/admin/value-lists"]]],
      ["Funcții", null, [["Căutare globală", "/admin/global-search"], ["Distilare Tipizate", "/admin/doc-type-engine"], ["Verificare corelări", null], ["Calcul drum lateral", "/admin/calculation"], ["Arbori de moștenire", null]]],
      ["Import", null, [["Dosare de proprietăți", "/admin/import"], ["Dosare diverse", null], ["Fișier individual", null]]],
      ["Rapoarte", null, [["În lucru", "/reports"]]],
      ["Administrare", null, [["Utilizatori & Acces", "/admin/users"], ["Grupuri", "/admin/groups"], ["Ștampile", "/admin/stamps"], ["Etichete", "/admin/tags"], ["Informații de ajutor", "/admin/help-content"]]],
      ["Setări", "/admin/settings", []],
      ["Studiu", null, [["Cursuri", null], ["Chestionare", null], ["Punctaj", null]]],
      ["Ajutor", null, [["Manual de utilizare", null], ["Întreabă AI", null]]],
    ]);
  });

  it("every section has an icon of its own — a collapsed sidebar shows section icons only", () => {
    const icons = NAV_SECTIONS.map((s) => s.icon);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it("every word exists in both languages", () => {
    for (const s of NAV_SECTIONS) {
      expect([s.key, typeof nav(RO).sections[s.key], typeof nav(EN).sections[s.key]]).toEqual([s.key, "string", "string"]);
      for (const i of s.items) expect([i.key, typeof nav(RO).items[i.key], typeof nav(EN).items[i.key]]).toEqual([i.key, "string", "string"]);
    }
    expect(nav(RO).comingSoon).toBe("În curând");
  });

  it("every address opens a page that exists", () => {
    const hrefs = NAV_SECTIONS.flatMap((s) => [s.href, ...s.items.map((i) => i.href)]).filter((h): h is string => !!h);
    const missing = hrefs.filter((h) => {
      const dir = h === "/" ? [] : h.split("/").filter(Boolean);
      const candidates = [path.join(ROOT, "src", "app", ...dir, "page.tsx"), path.join(ROOT, "src", "app", "(all-roles)", ...dir, "page.tsx")];
      return !candidates.some((c) => fs.existsSync(c));
    });
    expect(missing).toEqual([]);
  });

  it("„Raport post-import” is gone (Ask first 2)", () => {
    expect(NAV_SECTIONS.flatMap((s) => s.items).map((i) => i.key)).not.toContain("postImportReport");
    expect(nav(RO).items.postImportReport).toBeUndefined();
  });
});

describe("the active section and item for every route", () => {
  it.each([
    ["/natural-persons/abc", "domain", "/natural-persons"],
    ["/judicial-persons", "domain", "/judicial-persons"],
    ["/properties/map", "domain", "/properties"],
    ["/documents/new", "domain", "/documents"],
    ["/admin/value-lists", "domain", "/admin/value-lists"],
    ["/admin/global-search", "functions", "/admin/global-search"],
    ["/admin/doc-type-engine", "functions", "/admin/doc-type-engine"],
    ["/admin/calculation/history", "functions", "/admin/calculation"],
    ["/admin/import", "importSection", "/admin/import"],
    ["/reports", "reports", "/reports"],
    ["/admin/users", "administration", "/admin/users"],
    ["/admin/groups/x", "administration", "/admin/groups"],
    ["/admin/stamps", "administration", "/admin/stamps"],
    ["/admin/tags", "administration", "/admin/tags"],
    ["/admin/help-content", "administration", "/admin/help-content"],
  ])("%s → section %s, item %s", (route, section, item) => {
    expect(getActiveSectionKey(route, NAV_SECTIONS)).toBe(section);
    expect(getActiveHref(route, NAV_SECTIONS)).toBe(item);
  });
});

describe("an account without an app_users row sees what a `user` saw before #38.21", () => {
  it("the dashboard and the four lists, nothing else", () => {
    const seen = sectionsFor(NAV_SECTIONS, false);
    const hrefs = seen.flatMap((s) => [s.href, ...s.items.map((i) => i.href)]).filter(Boolean);
    expect(hrefs).toEqual(["/", "/natural-persons", "/judicial-persons", "/properties", "/documents"]);
  });

  it("the sidebar renders `sectionsFor(NAV_SECTIONS, fullAccess)`", () => {
    const src = code(read("src", "components", "sidebar", "sidebar-nav.tsx"));
    expect(src).toContain("sectionsFor(NAV_SECTIONS, fullAccess)");
    expect(src).not.toContain('startsWith("administration")');
    expect(src).toMatch(/\{sections\s*\.map/);
  });

  it("every other address is an /admin/ screen the layout refuses to an account without a row, or the static reports page", () => {
    const user = new Set(sectionsFor(NAV_SECTIONS, false).flatMap((s) => [s.href, ...s.items.map((i) => i.href)]));
    const rest = NAV_SECTIONS.flatMap((s) => [s.href, ...s.items.map((i) => i.href)]).filter((h): h is string => !!h && !user.has(h));
    expect(rest.filter((h) => !h.startsWith("/admin/") && h !== "/reports")).toEqual([]);
  });
});

describe("placeholders, the reports page, Settings", () => {
  it("a placeholder is drawn disabled, „În curând” as its tooltip", () => {
    const src = code(read("src", "components", "sidebar", "sidebar-nav.tsx"));
    expect(src).toMatch(/if \(!item\.href\) \{[\s\S]*?<IconTooltip label=\{comingSoon\}[\s\S]*?aria-disabled="true"/);
    expect(src).toContain('comingSoon={t("comingSoon")}');
  });

  it("„Rapoarte — în lucru”: the page says what reports will offer, in both languages", () => {
    const page = read("src", "app", "reports", "page.tsx");
    expect(page).toContain('getTranslations("reports")');
    for (const m of [RO, EN]) {
      const r = m.reports as Record<string, string>;
      expect((r.title ?? "").length).toBeGreaterThan(5);
      for (const k of ["intro", "questions", "analysis", "results", "noSkills"]) expect([k, (r[k] ?? "").length > 20]).toEqual([k, true]);
    }
    const ro = RO.reports as Record<string, string>;
    expect(ro.title).toBe("Rapoarte — în lucru");
    expect(ro.intro).toBe("Aici veți putea pune arhivei întrebări de business și primi răspunsurile ca tabele și grafice.");
    expect(ro.noSkills).toBe("Nu e nevoie de cunoștințe tehnice: alegeți ce vreți să aflați, iar sistemul face analiza.");
    expect((RO.navigation as { breadcrumb: Record<string, string> }).breadcrumb.reports).toBe("Rapoarte");
  });

  it("Settings has no „Altele”", () => {
    const src = code(read("src", "app", "admin", "settings", "_components", "settings-view.tsx"));
    expect(src).not.toMatch(/sectionOthers|othersGroups|othersStamps|othersTags|screenPanel\("others"/);
    for (const m of [RO, EN]) expect((m.settings as Record<string, unknown>).sectionOthers).toBeUndefined();
  });
});

describe("breadcrumbs name the section, not „Admin”", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { buildSegments } = require("@/components/breadcrumb-bar") as typeof import("@/components/breadcrumb-bar");
  const ro = RO.navigation as { breadcrumb: Record<string, unknown> };
  const crumb = (k: string): string => {
    const v = k.split(".").reduce<unknown>((o, p) => (o as Record<string, unknown>)?.[p], ro.breadcrumb);
    return typeof v === "string" ? v : `‹${k}›`;
  };
  const trail = (path: string, from?: [string, string]) =>
    buildSegments(path, crumb, {}, from?.[0], from?.[1]).map((s) => `${s.label}${s.href === null ? " (text)" : ""}`);

  it("each /admin/ screen under the section that holds it in the sidebar", () => {
    expect(trail("/admin/value-lists")).toEqual(["Acasă", "Domeniu (text)", "Date de referință"]);
    expect(trail("/admin/global-search")).toEqual(["Acasă", "Funcții (text)", "Căutare globală"]);
    expect(trail("/admin/doc-type-engine")).toEqual(["Acasă", "Funcții (text)", "Distilare Tipizate"]);
    expect(trail("/admin/calculation")).toEqual(["Acasă", "Funcții (text)", "Calcul"]);
    expect(trail("/admin/users")).toEqual(["Acasă", "Administrare (text)", "Utilizatori & Acces"]);
    expect(trail("/admin/groups")).toEqual(["Acasă", "Administrare (text)", "Grupuri"]);
    expect(trail("/admin/stamps")).toEqual(["Acasă", "Administrare (text)", "Ștampile"]);
    expect(trail("/admin/tags")).toEqual(["Acasă", "Administrare (text)", "Etichete"]);
    expect(trail("/admin/help-content")).toEqual(["Acasă", "Administrare (text)", "Informații de ajutor"]);
  });

  it("a section named as its screen is not said twice; a screen that is a section has none", () => {
    expect(trail("/admin/import")).toEqual(["Acasă", "Import"]);
    expect(trail("/admin/settings")).toEqual(["Acasă", "Setări"]);
    expect(trail("/reports")).toEqual(["Acasă", "Rapoarte"]);
  });

  it("?from= puts the record it came from before the section", () => {
    expect(trail("/admin/groups", ["/properties/p1", "Teren Nord"])).toEqual(["Acasă", "Teren Nord", "Administrare (text)", "Grupuri"]);
  });

  it("no „Admin” crumb is left, in either language", () => {
    for (const m of [RO, EN]) expect((m.navigation as { breadcrumb: Record<string, unknown> }).breadcrumb.admin).toBeUndefined();
  });
});
