/**
 * Slice #38.20 — the left navigation in nine sections: Tablou de bord,
 * Domeniu, Funcții, Import, Rapoarte, Administrare, Setări, Studiu, Ajutor.
 *
 * Slice 40.08 — seven sections: „Setări" is the last item of „Administrare", no longer a section of its own.
 *
 * Slice #38.42 — six of them drawn: what is not built is not drawn
 * (`drawnSections`). „Rapoarte", „Studiu" and „Ajutor" hold nothing built, so
 * they draw nothing; „Date de referință" moved to Administrare; „Funcții" is
 * called „Instrumente". The config keeps every entry. (This file was
 * `sidebar-nine-sections.test.ts`.)
 *
 * Every screen that exists is reachable from it; an item whose screen does not
 * exist yet is a disabled „În curând" placeholder; „Rapoarte" → „În lucru"
 * opens /reports; Settings has no „Altele"; since #38.21 every account with an
 * app_users row sees it all, one without a row the dashboard and the four lists. The browser half is TC-NAV-01.
 *
 * Slice #39.02 — „Rapoarte" drawn again, between „Import" and „Administrare": „Interacțiuni" (from
 * „Domeniu"), „Arbori de moștenire" (no screen until #39.11, so undrawn) and „Căutare globală" (from
 * „Instrumente"). Their URLs did not move. The „În lucru" item left the config; /reports still opens.
 */
import fs from "node:fs";
import path from "node:path";
import { NAV_SECTIONS } from "@/components/sidebar/nav-config";
import { drawnSections, getActiveHref, getActiveSectionKey, sectionsFor } from "@/components/sidebar/sidebar-helpers";

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

// #39.37: was „the nine sections" — „Studiu" and „Ajutor" (placeholders) last; „Ajutor și învățare" replaces both.
// 40.08: was „the eight sections", „Setări" between „Administrare" and „Ajutor și învățare".
describe("the seven sections in the config, in order, each with its items", () => {
  it("top to bottom", () => {
    expect(NAV_SECTIONS.map((s) => nav(RO).sections[s.key])).toEqual([
      "Tablou de bord", "Domeniu", "Instrumente", "Import", "Rapoarte", "Administrare", "Ajutor și învățare",
    ]);
    // 40.08: no section is called „Setări" any more, in either language.
    expect(nav(RO).sections.settings).toBeUndefined();
    expect(nav(EN).sections.settings).toBeUndefined();
  });

  it("each section's items, by their Romanian names; a placeholder has no address, a placeholder page is `wip`", () => {
    const tree = NAV_SECTIONS.map((s) => [nav(RO).sections[s.key], s.href ?? null, s.items.map((i) => [nav(RO).items[i.key], i.href ?? null])]);
    expect(tree).toEqual([
      ["Tablou de bord", "/", []],
      // #39.02: was Domeniu … ["Acte", "/documents"], ["Interacțiuni", "/interactions"]]; Instrumente
      // [["Căutare globală", "/admin/global-search"], …, ["Arbori de moștenire", null]]; Rapoarte [["În lucru", "/reports"]].
      ["Domeniu", null, [["Persoane Fizice", "/natural-persons"], ["Persoane Juridice", "/judicial-persons"], ["Proprietăți", "/properties"], ["Acte", "/documents"]]],
      // #39.09: „Calcul suprafață" after „Calcul drum lateral" — /properties/map?area=1. #39.78: in its place the
      // three guides to the big map's buttons, boxes rather than addresses (their `guide`, the next test).
      ["Instrumente", null, [["Distilare Tipizate", "/admin/doc-type-engine"], ["Verificare corelări", null], ["Calcul drum lateral", "/admin/calculation"], ["Măsurători pe hartă", null], ["Grupări de proprietăți", null], ["Navigare", null]]],
      ["Import", null, [["Dosare de proprietăți", "/admin/import"], ["Dosare diverse", null], ["Fișier individual", null]]],
      // #39.11: „Arbori de moștenire" had no href.
      ["Rapoarte", null, [["Interacțiuni", "/interactions"], ["Arbori de moștenire", "/inheritance-tree"], ["Căutare globală", "/admin/global-search"]]],
      // #39.37: „Informații de ajutor" moved to „Ajutor și învățare"; „Studiu" and „Ajutor" are gone.
      // 40.08: + „Setări", last — was ["Setări", "/admin/settings", []], a section of its own, after this one.
      ["Administrare", null, [["Date de referință", "/admin/value-lists"], ["Utilizatori & Acces", "/admin/users"], ["Grupuri", "/admin/groups"], ["Ștampile", "/admin/stamps"], ["Etichete", "/admin/tags"], ["Setări", "/admin/settings"]]],
      ["Ajutor și învățare", null, [["Informații de ajutor", "/admin/help-content"], ["Manual de utilizare", "/manual"], ["Harta competențelor", "/skills-map"], ["Întreabă", "/ask"]]], // #39.42: + the map; #39.45: + „Întreabă”
    ]);
  });

  it("#39.78: the three guides under „Instrumente” name their box, and only they carry one", () => {
    const guides = NAV_SECTIONS.flatMap((s) => s.items.filter((i) => i.guide).map((i) => [s.key, i.key, i.guide, i.href ?? null]));
    expect(guides).toEqual([
      ["functions", "mapMeasurements", "measure", null],
      ["functions", "mapGroupings", "groups", null],
      ["functions", "mapNavigation", "navigation", null],
    ]);
    expect(NAV_SECTIONS.flatMap((s) => s.items).map((i) => i.key)).not.toContain("areaCalculation");
    for (const m of [RO, EN]) expect(nav(m).items.areaCalculation).toBeUndefined();
    expect([nav(EN).items.mapMeasurements, nav(EN).items.mapGroupings, nav(EN).items.mapNavigation]).toEqual([
      "Measurements on map", "Groupings of properties", "Navigation",
    ]);
  });

  // #39.02: was „only „În lucru” is marked `wip`" — toEqual(["reportsInProgress"]). The item left the config.
  it("no item is marked `wip`, and „În lucru” is gone from the config and both languages", () => {
    expect(NAV_SECTIONS.flatMap((s) => s.items).filter((i) => i.wip).map((i) => i.key)).toEqual([]);
    expect(NAV_SECTIONS.flatMap((s) => s.items).map((i) => i.key)).not.toContain("reportsInProgress");
    for (const m of [RO, EN]) expect(nav(m).items.reportsInProgress).toBeUndefined();
  });

  it("„Rapoarte” is „Reporting” in en-GB, in the sidebar and as a breadcrumb section (#39.02)", () => {
    expect(nav(EN).sections.reports).toBe("Reporting");
    const crumbSections = (m: Msgs) => (m.navigation as { breadcrumb: { sections: Record<string, string> } }).breadcrumb.sections;
    expect(crumbSections(RO).reports).toBe("Rapoarte");
    expect(crumbSections(EN).reports).toBe("Reporting");
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
      // #39.09: an address may carry a query (#39.09's „Calcul suprafață", /properties/map?area=1) — the page is its path's.
      const p = h.split("?")[0]!;
      const dir = p === "/" ? [] : p.split("/").filter(Boolean);
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

describe("what is drawn (#38.42)", () => {
  const drawn = drawnSections(NAV_SECTIONS);
  const ro = (s: { key: string; items: { key: string }[] }) => [nav(RO).sections[s.key], s.items.map((i) => nav(RO).items[i.key])];

  // #39.02: was „six sections" — Domeniu ending „Acte", „Interacțiuni"; Instrumente opening „Căutare globală"; no Rapoarte.
  // #39.37: was „seven sections", ending „Administrare" [… „Etichete", „Informații de ajutor"], „Setări".
  // 40.08: was „eight sections", with ["Setări", []] after „Administrare".
  it("seven sections, each with only built screens — „Setări” last in „Administrare”, „Ajutor și învățare” last", () => {
    expect(drawn.map(ro)).toEqual([
      ["Tablou de bord", []],
      ["Domeniu", ["Persoane Fizice", "Persoane Juridice", "Proprietăți", "Acte"]],
      // #39.09: + „Calcul suprafață"; #39.78: in its place the three guides, drawn though they have no href.
      ["Instrumente", ["Distilare Tipizate", "Calcul drum lateral", "Măsurători pe hartă", "Grupări de proprietăți", "Navigare"]],
      ["Import", ["Dosare de proprietăți"]],
      ["Rapoarte", ["Interacțiuni", "Arbori de moștenire", "Căutare globală"]], // #39.11: + „Arbori de moștenire"
      ["Administrare", ["Date de referință", "Utilizatori & Acces", "Grupuri", "Ștampile", "Etichete", "Setări"]],
      ["Ajutor și învățare", ["Informații de ajutor", "Manual de utilizare", "Harta competențelor", "Întreabă"]], // #39.42, #39.45
    ]);
  });

  // #39.78: was „no item without an href" — a guide (a box about the map's buttons) has none, and is drawn.
  it("no item without an href or a guide, no `wip` item, and no section left empty", () => {
    for (const s of drawn) {
      expect([s.key, s.items.length > 0 || !!s.href]).toEqual([s.key, true]);
      for (const i of s.items) expect([i.key, !!i.href || !!i.guide, !!i.wip]).toEqual([i.key, true, false]);
    }
  });

  it("an href brings a placeholder back; `wip` hides a page", () => {
    // #39.37: was over „Studiu" → „Cursuri", a placeholder section that left the config.
    const withHref = NAV_SECTIONS.map((s) =>
      s.key === "importSection" ? { ...s, items: s.items.map((i) => (i.key === "miscFolders" ? { ...i, href: "/misc" } : i)) } : s,
    );
    expect(drawnSections(withHref).find((s) => s.key === "importSection")?.items.map((i) => i.key)).toEqual(["import", "miscFolders"]);
    // #39.02: was „`wip` going brings a page back", over the „În lucru" item that left the config.
    const wip = NAV_SECTIONS.map((s) => (s.key === "reports" ? { ...s, items: s.items.map((i) => ({ ...i, wip: true as const })) } : s));
    expect(drawnSections(wip).some((s) => s.key === "reports")).toBe(false);
  });

  it("the sidebar draws through it, for every account", () => {
    expect(sectionsFor(NAV_SECTIONS, true)).toEqual(drawn);
    const user = sectionsFor(NAV_SECTIONS, false).flatMap((s) => s.items);
    expect(user.every((i) => !!i.href && !i.wip)).toBe(true);
  });
});

describe("the active section and item for every route", () => {
  it.each([
    ["/natural-persons/abc", "domain", "/natural-persons"],
    ["/judicial-persons", "domain", "/judicial-persons"],
    ["/properties/map", "domain", "/properties"],
    ["/documents/new", "domain", "/documents"],
    ["/admin/value-lists", "administration", "/admin/value-lists"],
    ["/admin/global-search", "reports", "/admin/global-search"], // #39.02: was "functions"
    ["/interactions", "reports", "/interactions"], // #39.02
    ["/admin/doc-type-engine", "functions", "/admin/doc-type-engine"],
    ["/admin/calculation/history", "functions", "/admin/calculation"],
    ["/admin/import", "importSection", "/admin/import"],
    // #39.02: was ["/reports", "reports", "/reports"] — „În lucru" left the config, so no item is active there.
    ["/admin/users", "administration", "/admin/users"],
    ["/admin/groups/x", "administration", "/admin/groups"],
    ["/admin/stamps", "administration", "/admin/stamps"],
    ["/admin/tags", "administration", "/admin/tags"],
    ["/admin/help-content", "helpLearning", "/admin/help-content"], // #39.37: was "administration"
    ["/manual", "helpLearning", "/manual"], // #39.37
    ["/skills-map", "helpLearning", "/skills-map"], // #39.42
    ["/ask", "helpLearning", "/ask"], // #39.45
  ])("%s → section %s, item %s", (route, section, item) => {
    expect(getActiveSectionKey(route, NAV_SECTIONS)).toBe(section);
    expect(getActiveHref(route, NAV_SECTIONS)).toBe(item);
  });
});

describe("an account without an app_users row sees what a `user` saw before #38.21", () => {
  it("the dashboard, the four lists and „Interacțiuni” (#38.84), nothing else", () => {
    const seen = sectionsFor(NAV_SECTIONS, false);
    const hrefs = seen.flatMap((s) => [s.href, ...s.items.map((i) => i.href)]).filter(Boolean);
    // #39.11: + „Arbori de moștenire", view only, the domain's persons as „Interacțiuni" is.
    // #39.37: + „Manual de utilizare". #39.42: + „Harta competențelor". #39.45: + „Întreabă".
    expect(hrefs).toEqual(["/", "/natural-persons", "/judicial-persons", "/properties", "/documents", "/interactions", "/inheritance-tree", "/manual", "/skills-map", "/ask"]);
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
    // #39.09: an address under a screen the account is shown (the old „Calcul suprafață", /properties/map?area=1) is not a reach it was denied.
    expect(
      rest
        .filter((h) => !h.startsWith("/admin/") && h !== "/reports")
        .filter((h) => ![...user].some((u) => !!u && u !== "/" && h.split("?")[0]!.startsWith(u + "/"))),
    ).toEqual([]);
  });
});

describe("placeholders, the reports page, Settings", () => {
  it("the disabled drawing is kept for an item handed over without an href — unreached since #38.42 (`drawnSections`)", () => {
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
    expect(trail("/admin/value-lists")).toEqual(["Acasă", "Administrare (text)", "Date de referință"]);
    // #39.02: was ["Acasă", "Instrumente (text)", "Căutare globală"].
    expect(trail("/admin/global-search")).toEqual(["Acasă", "Rapoarte (text)", "Căutare globală"]);
    expect(trail("/admin/doc-type-engine")).toEqual(["Acasă", "Instrumente (text)", "Distilare Tipizate"]);
    expect(trail("/admin/calculation")).toEqual(["Acasă", "Instrumente (text)", "Calcul drum lateral"]); // #39.79–#39.80: was „Calcul"
    expect(trail("/admin/users")).toEqual(["Acasă", "Administrare (text)", "Utilizatori & Acces"]);
    expect(trail("/admin/groups")).toEqual(["Acasă", "Administrare (text)", "Grupuri"]);
    expect(trail("/admin/stamps")).toEqual(["Acasă", "Administrare (text)", "Ștampile"]);
    expect(trail("/admin/tags")).toEqual(["Acasă", "Administrare (text)", "Etichete"]);
    // #39.37: was ["Acasă", "Administrare (text)", "Informații de ajutor"].
    expect(trail("/admin/help-content")).toEqual(["Acasă", "Ajutor și învățare (text)", "Informații de ajutor"]);
  });

  it("„Întreabă” under „Ajutor și învățare” (#39.45)", () => {
    expect(trail("/ask")).toEqual(["Acasă", "Ajutor și învățare (text)", "Întreabă"]);
  });

  it("„Harta competențelor” under „Ajutor și învățare”, and a skill's quiz under the map (#39.42)", () => {
    expect(trail("/skills-map")).toEqual(["Acasă", "Ajutor și învățare (text)", "Harta competențelor"]);
    expect(trail("/skills-map/persons-person-from-id-card")).toEqual(["Acasă", "Ajutor și învățare (text)", "Harta competențelor", "Chestionar"]);
  });

  it("„Manual de utilizare” under „Ajutor și învățare”, as text (#39.37)", () => {
    expect(trail("/manual")).toEqual(["Acasă", "Ajutor și învățare (text)", "Manual de utilizare"]);
  });

  it("„Interacțiuni” under „Rapoarte”, as text, though its address is not under /admin/ (#39.02)", () => {
    // Was ["Acasă", "Interacțiuni"] while it sat in „Domeniu", whose four lists name no section.
    expect(trail("/interactions")).toEqual(["Acasă", "Rapoarte (text)", "Interacțiuni"]);
  });

  it("a section named as its screen is not said twice; a screen that is a section has none", () => {
    expect(trail("/admin/import")).toEqual(["Acasă", "Import"]);
    // 40.08: was ["Acasă", "Setări"] while „Setări" was a section of its own; now its section is named, as text.
    expect(trail("/admin/settings")).toEqual(["Acasă", "Administrare (text)", "Setări"]);
    expect(trail("/reports")).toEqual(["Acasă", "Rapoarte"]);
  });

  it("?from= puts the record it came from before the section", () => {
    expect(trail("/admin/groups", ["/properties/p1", "Teren Nord"])).toEqual(["Acasă", "Teren Nord", "Administrare (text)", "Grupuri"]);
  });

  it("no „Admin” crumb is left, in either language", () => {
    for (const m of [RO, EN]) expect((m.navigation as { breadcrumb: Record<string, unknown> }).breadcrumb.admin).toBeUndefined();
  });
});
