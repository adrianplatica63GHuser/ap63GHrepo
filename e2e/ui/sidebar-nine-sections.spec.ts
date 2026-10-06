/**
 * Case:   TC-NAV-01 — Bara laterală în nouă secțiuni: fiecare legătură își deschide ecranul, fiecare „În curând" e inactiv, „Rapoarte" → „În lucru" arată textul
 * Source: docs/testing/cases/TC-NAV-01.md, „Last green" 2026-10-06
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim; an icon is read as the case reads it, the Lucide
 * class on the <svg>.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The hand run pressed by script and dispatched `pointerover` for the
 *     tooltips (FU-290); here it is Playwright's mouse.
 *   - Slice #38.20's pictures, not steps of the case: the sidebar expanded with
 *     each section open, and collapsed, over the Reports page (static text, no
 *     records); the Reports page; Settings — at 1366 and 1920 px, into
 *     `playwright-report/sidebar-nine-sections/`. The sidebar's „Recente" list
 *     is painted over.
 */

import fs from "node:fs";
import { test, expect, type Locator, type Page } from "@playwright/test";
import { openSection, sidebar } from "../helpers/sidebar";

const SHOTS = "playwright-report/sidebar-nine-sections";

const SECTIONS = [
  "Tablou de bord", "Domeniu", "Funcții", "Import", "Rapoarte", "Administrare", "Setări", "Studiu", "Ajutor",
] as const;

/** Each section's items, in order; `null` marks a placeholder. */
const ITEMS: Record<string, [string, string | null][]> = {
  Domeniu: [
    ["Persoane Fizice", "/natural-persons"],
    ["Persoane Juridice", "/judicial-persons"],
    ["Proprietăți", "/properties"],
    ["Acte", "/documents"],
    ["Date de referință", "/admin/value-lists"],
  ],
  Funcții: [
    ["Căutare globală", "/admin/global-search"],
    ["Distilare Tipizate", "/admin/doc-type-engine"],
    ["Verificare corelări", null],
    ["Calcul drum lateral", "/admin/calculation"],
    ["Arbori de moștenire", null],
  ],
  Import: [
    ["Dosare de proprietăți", "/admin/import"],
    ["Dosare diverse", null],
    ["Fișier individual", null],
  ],
  Rapoarte: [["În lucru", "/reports"]],
  Administrare: [
    ["Utilizatori & Acces", "/admin/users"],
    ["Grupuri", "/admin/groups"],
    ["Ștampile", "/admin/stamps"],
    ["Etichete", "/admin/tags"],
    ["Informații de ajutor", "/admin/help-content"],
  ],
  Studiu: [["Cursuri", null], ["Chestionare", null], ["Punctaj", null]],
  Ajutor: [["Manual de utilizare", null], ["Întreabă AI", null]],
};

/** Step 3: the link's label, its section (none for a flat one), the title its screen shows. */
const LINKS: [string, string | null, string][] = [
  ["Tablou de bord", null, "Tablou de bord"],
  ["Persoane Fizice", "Domeniu", "Persoană fizică"],
  ["Persoane Juridice", "Domeniu", "Persoană juridică"],
  ["Proprietăți", "Domeniu", "Proprietăți"],
  ["Acte", "Domeniu", "Acte"],
  ["Date de referință", "Domeniu", "Date de referință"],
  ["Căutare globală", "Funcții", "Căutare globală"],
  ["Distilare Tipizate", "Funcții", "Distilare Tipizate"],
  ["Calcul drum lateral", "Funcții", "Calcul"],
  ["Dosare de proprietăți", "Import", "Import"],
  ["În lucru", "Rapoarte", "Rapoarte — în lucru"],
  ["Utilizatori & Acces", "Administrare", "Utilizatori & Acces"],
  ["Grupuri", "Administrare", "Grupuri"],
  ["Ștampile", "Administrare", "Ștampile"],
  ["Etichete", "Administrare", "Etichete"],
  ["Informații de ajutor", "Administrare", "Informații de ajutor"],
  ["Setări", null, "Setări"],
];

const ICONS = [
  "lucide-layout-dashboard", "lucide-database", "lucide-workflow", "lucide-upload", "lucide-chart-column",
  "lucide-shield-check", "lucide-settings", "lucide-graduation-cap", "lucide-life-buoy",
];

const recent = (page: Page) =>
  page.locator("aside div.border-t").filter({ has: page.getByRole("button", { name: /Recente/i }) });

async function photograph(page: Page, name: string, before?: () => Promise<void>): Promise<void> {
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: width === 1366 ? 768 : 1080 });
    if (before) await before();
    // Off every row: a pointer left on a placeholder would photograph its „În curând".
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

test.describe("TC-NAV-01 — the sidebar in nine sections", () => {
  test.beforeAll(() => {
    fs.mkdirSync(SHOTS, { recursive: true });
  });

  test("every link opens its screen, every placeholder is disabled, „În lucru” shows the text", async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/reports");
    const nav = sidebar(page);
    await expect(nav).toBeVisible({ timeout: 30_000 });

    // Step 1 — the nine sections, top to bottom.
    await expect(sectionRows(page)).toHaveCount(9);
    expect((await sectionRows(page).allInnerTexts()).map((t) => t.trim().split("\n")[0])).toEqual([...SECTIONS]);

    // Step 2 — each section's items; a placeholder is drawn disabled.
    for (const [section, items] of Object.entries(ITEMS)) {
      await openSection(page, section);
      for (const [label, href] of items) {
        if (href) {
          await expect(nav.getByRole("link", { name: label, exact: true })).toHaveAttribute("href", href);
        } else {
          const ph = nav.locator("[data-nav-placeholder]").filter({ hasText: label });
          await expect(ph).toHaveAttribute("aria-disabled", "true");
          await expect(ph).toHaveAttribute("tabindex", "0");
        }
      }
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

    // Step 4 — each placeholder: faded, „not allowed", „În curând", and pressing it goes nowhere.
    for (const [section, items] of Object.entries(ITEMS)) {
      const placeholders = items.filter(([, href]) => href === null);
      if (placeholders.length === 0) continue;
      await openSection(page, section);
      for (const [label] of placeholders) {
        const ph = nav.locator("[data-nav-placeholder]").filter({ hasText: label });
        const before = page.url();
        await ph.hover();
        await expect(page.locator("[role=tooltip][data-icon-tooltip]")).toHaveText("În curând");
        expect(await ph.evaluate((el) => getComputedStyle(el).cursor)).toBe("not-allowed");
        expect(Number(await ph.evaluate((el) => getComputedStyle(el).opacity))).toBeLessThan(1);
        await ph.click({ force: true });
        await page.waitForTimeout(300);
        expect(page.url()).toBe(before);
        await page.mouse.move(1900, 1060);
      }
    }

    // Step 5 — „Rapoarte" → „În lucru".
    await openSection(page, "Rapoarte");
    await nav.getByRole("link", { name: "În lucru", exact: true }).click();
    await expect(page).toHaveURL(/\/reports$/);
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
    await photograph(page, "reports");

    // Step 6 — „Setări": no „Altele".
    await nav.getByRole("link", { name: "Setări", exact: true }).click();
    await expect(await title(page)).toHaveText("Setări");
    await expect(page.locator("main").getByText("Intervale de timp", { exact: true })).toBeVisible();
    await expect(page.locator("main").getByText("Altele", { exact: true })).toHaveCount(0);
    await expect(page.locator("main a")).toHaveCount(0);
    await expect(crumbTrail(page)).toHaveText(["Acasă", "Setări"]);
    await photograph(page, "settings");

    // Step 7 — collapsed: nine icons, one per section, each named by its section.
    await page.goto("/reports");
    await expect(nav).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Restrânge bara laterală", exact: true }).click();
    await expect(page.getByRole("button", { name: "Extinde bara laterală", exact: true })).toBeVisible();
    const rows = sectionRows(page);
    await expect(rows).toHaveCount(9);
    for (let i = 0; i < 9; i++) {
      const row = rows.nth(i);
      expect(await iconOf(row)).toBe(ICONS[i]);
      await expect(row.locator("[aria-label]").first()).toHaveAttribute("aria-label", SECTIONS[i]);
    }
    await photograph(page, "collapsed");
    await page.getByRole("button", { name: "Extinde bara laterală", exact: true }).click();
    await expect(page.getByRole("button", { name: "Restrânge bara laterală", exact: true })).toBeVisible();

    // Step 8 — the breadcrumb names the section, as text; „Import" is not said twice.
    for (const [section, label, trail] of [
      ["Administrare", "Etichete", ["Acasă", "Administrare", "Etichete"]],
      ["Funcții", "Căutare globală", ["Acasă", "Funcții", "Căutare globală"]],
      ["Domeniu", "Date de referință", ["Acasă", "Domeniu", "Date de referință"]],
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
