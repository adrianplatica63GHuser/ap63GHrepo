/**
 * Case:   TC-NAV-01 — Bara laterală arată doar ce există: șase secțiuni, fiecare legătură își deschide ecranul, niciun „În curând"
 * Source: docs/testing/cases/TC-NAV-01.md, „Last green" 2026-10-06
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim; an icon is read as the case reads it, the Lucide
 * class on the <svg>. Slice #38.42 rewrote the case — the sidebar draws only
 * what exists — and renamed this file from `sidebar-nine-sections.spec.ts`.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - Slice #38.42's pictures, not steps of the case: the sidebar expanded with
 *     each section open, and collapsed — at 1366 and 1920 px, into
 *     `playwright-report/sidebar-sections/`. The sidebar's „Recente" list is
 *     painted over.
 */

import fs from "node:fs";
import { test, expect, type Locator, type Page } from "@playwright/test";
import { openSection, sidebar } from "../helpers/sidebar";

const SHOTS = "playwright-report/sidebar-sections";

const SECTIONS = ["Tablou de bord", "Domeniu", "Instrumente", "Import", "Administrare", "Setări"] as const;

/** What #38.42 stopped drawing: four sections' worth of placeholders and a placeholder page. */
const GONE = [
  "Funcții", "Rapoarte", "Studiu", "Ajutor", "În lucru", "Verificare corelări", "Arbori de moștenire",
  "Dosare diverse", "Fișier individual", "Cursuri", "Chestionare", "Punctaj", "Manual de utilizare", "Întreabă AI",
] as const;

/** Each section's items, in order, with their addresses. */
const ITEMS: Record<string, [string, string][]> = {
  Domeniu: [
    ["Persoane Fizice", "/natural-persons"],
    ["Persoane Juridice", "/judicial-persons"],
    ["Proprietăți", "/properties"],
    ["Acte", "/documents"],
  ],
  Instrumente: [
    ["Căutare globală", "/admin/global-search"],
    ["Distilare Tipizate", "/admin/doc-type-engine"],
    ["Calcul drum lateral", "/admin/calculation"],
  ],
  Import: [["Dosare de proprietăți", "/admin/import"]],
  Administrare: [
    ["Date de referință", "/admin/value-lists"],
    ["Utilizatori & Acces", "/admin/users"],
    ["Grupuri", "/admin/groups"],
    ["Ștampile", "/admin/stamps"],
    ["Etichete", "/admin/tags"],
    ["Informații de ajutor", "/admin/help-content"],
  ],
};

/** Step 3: the link's label, its section (none for a flat one), the title its screen shows. */
const LINKS: [string, string | null, string][] = [
  ["Tablou de bord", null, "Tablou de bord"],
  ["Persoane Fizice", "Domeniu", "Persoană fizică"],
  ["Persoane Juridice", "Domeniu", "Persoană juridică"],
  ["Proprietăți", "Domeniu", "Proprietăți"],
  ["Acte", "Domeniu", "Acte"],
  ["Căutare globală", "Instrumente", "Căutare globală"],
  ["Distilare Tipizate", "Instrumente", "Distilare Tipizate"],
  ["Calcul drum lateral", "Instrumente", "Calcul"],
  ["Dosare de proprietăți", "Import", "Import"],
  ["Date de referință", "Administrare", "Date de referință"],
  ["Utilizatori & Acces", "Administrare", "Utilizatori & Acces"],
  ["Grupuri", "Administrare", "Grupuri"],
  ["Ștampile", "Administrare", "Ștampile"],
  ["Etichete", "Administrare", "Etichete"],
  ["Informații de ajutor", "Administrare", "Informații de ajutor"],
  ["Setări", null, "Setări"],
];

const ICONS = ["lucide-layout-dashboard", "lucide-database", "lucide-workflow", "lucide-upload", "lucide-shield-check", "lucide-settings"];

const recent = (page: Page) =>
  page.locator("aside div.border-t").filter({ has: page.getByRole("button", { name: /Recente/i }) });

async function photograph(page: Page, name: string, before?: () => Promise<void>): Promise<void> {
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: width === 1366 ? 768 : 1080 });
    if (before) await before();
    // Off every row: a pointer left on one would photograph its hover.
    await page.mouse.move(width - 10, (width === 1366 ? 768 : 1080) - 10);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/${name}-${width}.png`, mask: [recent(page)] });
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
}

async function iconOf(el: Locator): Promise<string> {
  const cls = (await el.locator("svg").first().getAttribute("class")) ?? "";
  return cls.split(" ").find((c) => c.startsWith("lucide-") && c !== "lucide") ?? "";
}

/** The rows of the sidebar's <nav>: a flat link, or a section's button. */
function sectionRows(page: Page): Locator {
  return sidebar(page).locator(":scope > *");
}

/** The visible breadcrumb's crumbs: links, the section's text, the screen's own. */
function crumbTrail(page: Page): Locator {
  return page
    .getByRole("navigation", { name: "Fir de navigare" })
    .filter({ visible: true })
    .locator("a, [data-crumb-section], [aria-current=page]");
}

async function title(page: Page): Promise<Locator> {
  // The dashboard's title sits in its banner, not in <main>; the router keeps the page
  // before, hidden — so: the visible <h1>.
  const h1 = page.locator("h1").filter({ visible: true }).first();
  await expect(h1).toBeVisible({ timeout: 30_000 });
  return h1;
}

test.describe("TC-NAV-01 — the sidebar draws only what exists", () => {
  test.beforeAll(() => {
    fs.mkdirSync(SHOTS, { recursive: true });
  });

  test("six sections, every link opens its screen, no placeholder is drawn", async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/admin/settings");
    const nav = sidebar(page);
    await expect(nav).toBeVisible({ timeout: 30_000 });

    // Step 1 — the six sections, top to bottom; nothing #38.42 stopped drawing.
    await expect(sectionRows(page)).toHaveCount(SECTIONS.length);
    expect((await sectionRows(page).allInnerTexts()).map((t) => t.trim().split("\n")[0])).toEqual([...SECTIONS]);

    // Step 2 — each section's items, exactly; no placeholder, no „În curând".
    for (const [section, items] of Object.entries(ITEMS)) {
      await openSection(page, section);
      const rows = nav.getByRole("link").filter({ visible: true });
      for (const [label, href] of items) {
        await expect(nav.getByRole("link", { name: label, exact: true })).toHaveAttribute("href", href);
      }
      await expect(nav.locator("[data-nav-placeholder]")).toHaveCount(0);
      for (const gone of GONE) await expect(nav.getByText(gone, { exact: true })).toHaveCount(0);
      // The open section's links, and the two flat ones („Tablou de bord", „Setări"): nothing else.
      await expect(rows).toHaveCount(items.length + 2);
      await photograph(page, `section-${section.normalize("NFD").replace(/[^A-Za-z]/g, "").toLowerCase()}`);
    }

    // Step 3 — every link opens its screen and is the active item.
    for (const [label, section, heading] of LINKS) {
      if (section) await openSection(page, section);
      const link = nav.getByRole("link", { name: label, exact: true });
      const href = (await link.getAttribute("href"))!;
      await link.click();
      await expect(page).toHaveURL((u) => u.pathname === href, { timeout: 30_000 });
      await expect(await title(page)).toHaveText(heading, { timeout: 30_000 });
      if (section) await expect(link).toHaveAttribute("aria-current", "page");
    }

    // Step 4 — /reports by its address: the page is there, the sidebar does not offer it.
    await page.goto("/reports");
    await expect(await title(page)).toHaveText("Rapoarte — în lucru");
    const paras = page.locator("main p");
    await expect(paras).toHaveCount(5);
    await expect(paras.first()).toHaveText(
      "Aici veți putea pune arhivei întrebări de business și primi răspunsurile ca tabele și grafice.",
    );
    await expect(paras.last()).toHaveText(
      "Nu e nevoie de cunoștințe tehnice: alegeți ce vreți să aflați, iar sistemul face analiza.",
    );
    await expect(crumbTrail(page)).toHaveText(["Acasă", "Rapoarte"]);
    await expect(nav.getByText("Rapoarte", { exact: true })).toHaveCount(0);

    // Step 5 — „Setări": no „Altele".
    await nav.getByRole("link", { name: "Setări", exact: true }).click();
    await expect(await title(page)).toHaveText("Setări");
    await expect(page.locator("main").getByText("Praguri de timp", { exact: true }).first()).toBeVisible();
    await expect(page.locator("main").getByText("Altele", { exact: true })).toHaveCount(0);
    await expect(page.locator("main a")).toHaveCount(0);
    await expect(crumbTrail(page)).toHaveText(["Acasă", "Setări"]);

    // Step 6 — collapsed: six icons, one per section, each named by its section.
    await page.getByRole("button", { name: "Restrânge bara laterală", exact: true }).click();
    await expect(page.getByRole("button", { name: "Extinde bara laterală", exact: true })).toBeVisible();
    const rows = sectionRows(page);
    await expect(rows).toHaveCount(SECTIONS.length);
    for (let i = 0; i < SECTIONS.length; i++) {
      const row = rows.nth(i);
      expect(await iconOf(row)).toBe(ICONS[i]);
      await expect(row.locator("[aria-label]").first()).toHaveAttribute("aria-label", SECTIONS[i]);
    }
    await photograph(page, "collapsed");
    await page.getByRole("button", { name: "Extinde bara laterală", exact: true }).click();
    await expect(page.getByRole("button", { name: "Restrânge bara laterală", exact: true })).toBeVisible();

    // Step 7 — the breadcrumb names the section, as text; „Import" is not said twice.
    for (const [section, label, trail] of [
      ["Administrare", "Etichete", ["Acasă", "Administrare", "Etichete"]],
      ["Instrumente", "Căutare globală", ["Acasă", "Instrumente", "Căutare globală"]],
      ["Administrare", "Date de referință", ["Acasă", "Administrare", "Date de referință"]],
      ["Import", "Dosare de proprietăți", ["Acasă", "Import"]],
    ] as const) {
      await openSection(page, section);
      const link = nav.getByRole("link", { name: label, exact: true });
      const href = (await link.getAttribute("href"))!;
      await link.click();
      await expect(page).toHaveURL((u) => u.pathname === href, { timeout: 30_000 });
      await expect(crumbTrail(page)).toHaveText([...trail], { timeout: 15_000 });
      if (trail.length === 3) {
        const bar = page.getByRole("navigation", { name: "Fir de navigare" }).filter({ visible: true });
        await expect(bar.getByRole("link", { name: section, exact: true })).toHaveCount(0);
        await expect(bar.locator("[data-crumb-section]")).toHaveText(section);
      }
    }
  });
});
