/**
 * Case:   TC-NAV-01 — Bara laterală arată doar ce există: șapte secțiuni, fiecare legătură își deschide ecranul, niciun „În curând"
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
import { test, expect, type Locator, type Page } from "../helpers/test";
import { openFromSidebar, openSection, sidebar } from "../helpers/sidebar";
import { E2E_MARKER, createNaturalPerson, removeLeftovers, removeRecord } from "../helpers/records";

const SHOTS = "playwright-report/sidebar-sections";

// Slice #39.02: „Rapoarte" between „Import" and „Administrare" (was six, without it).
// Slice #39.37: „Ajutor și învățare" last (was seven, without it).
// Slice 40.08: „Setări" is the last item of „Administrare" (was eight, „Setări" a section after „Administrare").
const SECTIONS = ["Tablou de bord", "Domeniu", "Instrumente", "Import", "Rapoarte", "Administrare", "Ajutor și învățare"] as const;

/** What #38.42 stopped drawing: placeholders and a placeholder page. #39.02 brought „Rapoarte" back. */
const GONE = [
  // #39.11: „Arbori de moștenire" left this list — it has its screen.
  "Funcții", "Studiu", "Ajutor", "În lucru", "Verificare corelări",
  // #39.37: „Manual de utilizare" left this list — it has its screen, in „Ajutor și învățare".
  "Dosare diverse", "Fișier individual", "Cursuri", "Chestionare", "Punctaj", "Întreabă AI",
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
    ["Distilare Tipizate", "/admin/doc-type-engine"],
    ["Calcul drum lateral", "/admin/calculation"],
    // #39.09's „Calcul suprafață" (/properties/map?area=1) gave way in #39.78 to three guides — buttons, GUIDES below.
  ],
  Import: [["Dosare de proprietăți", "/admin/import"]],
  // Slice #39.02: moved here from „Domeniu" and „Instrumente", their addresses unchanged.
  Rapoarte: [
    ["Interacțiuni", "/interactions"],
    ["Arbori de moștenire", "/inheritance-tree"], // #39.11
    ["Căutare globală", "/admin/global-search"],
  ],
  Administrare: [
    ["Date de referință", "/admin/value-lists"],
    ["Utilizatori & Acces", "/admin/users"],
    ["Grupuri", "/admin/groups"],
    ["Ștampile", "/admin/stamps"],
    ["Etichete", "/admin/tags"],
    ["Setări", "/admin/settings"], // 40.08: was a section of its own
  ],
  // Slice #39.37: „Informații de ajutor" moved here from „Administrare", its address unchanged.
  "Ajutor și învățare": [
    ["Informații de ajutor", "/admin/help-content"],
    ["Manual de utilizare", "/manual"],
    ["Harta competențelor", "/skills-map"], // #39.42
    ["Întreabă", "/ask"], // #39.45
  ],
};

/** Slice #39.78: „Instrumente"'s three guides to the big map's buttons — buttons that open a box, not links. */
const GUIDES = ["Măsurători pe hartă", "Grupări de proprietăți", "Navigare"] as const;

/** Step 3: the link's label, its section (none for a flat one), the title its screen shows. */
const LINKS: [string, string | null, string][] = [
  ["Tablou de bord", null, "Tablou de bord"],
  ["Persoane Fizice", "Domeniu", "Persoane fizice"], // 40.22: the lists' titles in the plural
  ["Persoane Juridice", "Domeniu", "Persoane juridice"],
  ["Proprietăți", "Domeniu", "Proprietăți"],
  ["Acte", "Domeniu", "Acte"],
  ["Distilare Tipizate", "Instrumente", "Distilare Tipizate"],
  ["Calcul drum lateral", "Instrumente", "Calcul drum lateral"], // #39.79: the page title was „Calcul"
  // #39.09's ["Calcul suprafață", "Instrumente", "Toate Proprietățile"] went in #39.78; its guides are step 2's.
  ["Dosare de proprietăți", "Import", "Import"],
  ["Interacțiuni", "Rapoarte", "Interacțiuni"], // #39.02: was under „Domeniu"
  ["Căutare globală", "Rapoarte", "Căutare globală"], // #39.02: was under „Instrumente"
  ["Date de referință", "Administrare", "Date de referință"],
  ["Utilizatori & Acces", "Administrare", "Utilizatori & Acces"],
  ["Grupuri", "Administrare", "Grupuri"],
  ["Ștampile", "Administrare", "Ștampile"],
  ["Etichete", "Administrare", "Etichete"],
  ["Informații de ajutor", "Ajutor și învățare", "Informații de ajutor"], // #39.37: was under „Administrare"
  ["Manual de utilizare", "Ajutor și învățare", "Manual de utilizare"], // #39.37
  ["Harta competențelor", "Ajutor și învățare", "Harta competențelor"], // #39.42
  ["Întreabă", "Ajutor și învățare", "Întreabă"], // #39.45
  ["Setări", "Administrare", "Setări"], // 40.08: was ["Setări", null, "Setări"], a flat section
  // #39.11: last — its screen is the whole page, over the sidebar, and step 4 leaves it by its address.
  ["Arbori de moștenire", "Rapoarte", "Arbori de moștenire"],
];

// 40.08: „lucide-settings" left, with „Setări"'s section; the gear is its item's icon in „Administrare" now.
const ICONS = ["lucide-layout-dashboard", "lucide-database", "lucide-workflow", "lucide-upload", "lucide-chart-column", "lucide-shield-check", "lucide-life-buoy"];

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

  test("seven sections, every link opens its screen, no placeholder is drawn", async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/admin/settings");
    const nav = sidebar(page);
    await expect(nav).toBeVisible({ timeout: 30_000 });

    // Step 1 — the seven sections, top to bottom; nothing #38.42 stopped drawing.
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
      // The open section's links, and the flat one („Tablou de bord"; „Setări" was the second until 40.08): nothing else.
      await expect(rows).toHaveCount(items.length + 1);
      // #39.78: „Instrumente" ends with its three guides, buttons after the links, in order.
      const guides = nav.locator("[data-nav-guide]").filter({ visible: true });
      if (section === "Instrumente") {
        expect((await guides.allInnerTexts()).map((t) => t.trim())).toEqual([...GUIDES]);
        for (const g of GUIDES) await expect(nav.getByRole("button", { name: g, exact: true })).toHaveAttribute("aria-haspopup", "dialog");
      } else {
        await expect(guides).toHaveCount(0);
      }
      await photograph(page, `section-${section.normalize("NFD").replace(/[^A-Za-z]/g, "").toLowerCase()}`);
    }

    // Step 3 — every link opens its screen and is the active item.
    for (const [label, section, heading] of LINKS) {
      if (section) await openSection(page, section);
      const link = nav.getByRole("link", { name: label, exact: true });
      const href = (await link.getAttribute("href"))!;
      await link.click();
      await expect(page).toHaveURL((u) => u.pathname + u.search === href, { timeout: 30_000 });
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
    // #39.02: was `nav.getByText("Rapoarte", { exact: true })` toHaveCount(0) — the section is drawn now, without „În lucru".
    await expect(nav.locator('a[href="/reports"]')).toHaveCount(0);

    // Step 5 — „Administrare" → „Setări": no „Altele"; the breadcrumb names the section (40.08).
    await openSection(page, "Administrare");
    const settings = nav.getByRole("link", { name: "Setări", exact: true });
    await expect(settings.locator("svg.lucide-settings")).toHaveCount(1);
    await settings.click();
    await expect(await title(page)).toHaveText("Setări");
    await expect(page.locator("main").getByText("Praguri de timp", { exact: true }).first()).toBeVisible();
    await expect(page.locator("main").getByText("Altele", { exact: true })).toHaveCount(0);
    await expect(page.locator("main a")).toHaveCount(0);
    await expect(settings).toHaveAttribute("aria-current", "page");
    await expect(crumbTrail(page)).toHaveText(["Acasă", "Administrare", "Setări"]);

    // Step 6 — collapsed: seven icons, one per section, each named by its section.
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
      // #39.02: was ["Instrumente", "Căutare globală", ["Acasă", "Instrumente", "Căutare globală"]].
      ["Rapoarte", "Căutare globală", ["Acasă", "Rapoarte", "Căutare globală"]],
      ["Rapoarte", "Interacțiuni", ["Acasă", "Rapoarte", "Interacțiuni"]],
      ["Administrare", "Date de referință", ["Acasă", "Administrare", "Date de referință"]],
      ["Administrare", "Setări", ["Acasă", "Administrare", "Setări"]], // 40.08
      ["Import", "Dosare de proprietăți", ["Acasă", "Import"]],
      // #39.37: the two screens of „Ajutor și învățare".
      ["Ajutor și învățare", "Informații de ajutor", ["Acasă", "Ajutor și învățare", "Informații de ajutor"]],
      ["Ajutor și învățare", "Manual de utilizare", ["Acasă", "Ajutor și învățare", "Manual de utilizare"]],
      ["Ajutor și învățare", "Harta competențelor", ["Acasă", "Ajutor și învățare", "Harta competențelor"]], // #39.42
      ["Ajutor și învățare", "Întreabă", ["Acasă", "Ajutor și învățare", "Întreabă"]], // #39.45
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

  // Slice #39.03 — step 8: „Înapoi", the bar's first item. A test person of its own, removed in `finally`.
  test("„Înapoi” first on the bar: back to the list; a changed form asks first", async ({ page }) => {
    test.setTimeout(180_000);
    const MARK = `${E2E_MARKER}NAV-01-BACK`;
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 768 });
    const personId = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Înapoi" });
    const bar = page.getByRole("navigation", { name: "Fir de navigare" }).filter({ visible: true });
    const back = bar.getByRole("button", { name: "Înapoi", exact: true });
    // Slice #39.97 — step 8a: „Înainte", right of „Înapoi".
    const forward = bar.getByRole("button", { name: "Înainte", exact: true });
    const openRecord = async () => {
      const search = page.locator("main").getByPlaceholder("caută după ID, Nume, Poreclă, CNP, Email Personal 1, Email Personal 2, Email serviciu, Telefon Personal 1, Telefon Personal 2 sau Telefon serviciu");
      await search.fill(MARK);
      const row = page.locator("main tbody tr").filter({ hasText: MARK });
      await expect(row).toHaveCount(1, { timeout: 30_000 });
      await row.getByRole("link", { name: "Deschide", exact: true }).click();
      await expect(page).toHaveURL((u) => u.pathname === `/natural-persons/${personId}`, { timeout: 30_000 });
    };
    try {
      // The list, then a record, both reached inside the app.
      await page.goto("/natural-persons");
      await expect(page.locator("main").getByPlaceholder("caută după ID, Nume, Poreclă, CNP, Email Personal 1, Email Personal 2, Email serviciu, Telefon Personal 1, Telefon Personal 2 sau Telefon serviciu")).toBeVisible({ timeout: 30_000 });
      await openRecord();
      await expect(page.locator("h1").filter({ visible: true }).first()).toContainText(MARK, { timeout: 30_000 });

      // „Înapoi" is the bar's first item, left of the first crumb, a gap and a rule between; the „?" stays right.
      await expect(back).toBeVisible();
      await expect(back).toBeEnabled();
      await expect(forward).toBeDisabled();
      await expect(bar.locator(":scope > *").first()).toHaveAttribute("data-breadcrumb-back", "");
      expect(await back.locator("svg").first().getAttribute("class")).toContain("lucide-arrow-left");
      const home = bar.getByRole("link", { name: "Acasă", exact: true });
      const [b, h, nav] = [(await back.boundingBox())!, (await home.boundingBox())!, (await bar.boundingBox())!];
      expect(b.x - nav.x).toBeLessThanOrEqual(16);
      expect(h.x - (b.x + b.width)).toBeGreaterThanOrEqual(16);
      // The „?"'s slot is still the bar's last item, pushed to the right (ml-auto).
      const help = bar.locator(":scope > span.ml-auto");
      await expect(help).toHaveCount(1);
      expect((await help.boundingBox())?.x ?? nav.x + nav.width).toBeGreaterThan(h.x);
      await page.mouse.move(1356, 758);
      await page.waitForTimeout(400); // the button's hover colour fades (transition-colors)
      await page.screenshot({ path: `${SHOTS}/back-record-1366.png`, mask: [recent(page)] });

      // Pressed: back on the list.
      await back.click();
      await expect(page).toHaveURL((u) => u.pathname === "/natural-persons", { timeout: 30_000 });
      await expect(page.locator("main").getByPlaceholder("caută după ID, Nume, Poreclă, CNP, Email Personal 1, Email Personal 2, Email serviciu, Telefon Personal 1, Telefon Personal 2 sau Telefon serviciu")).toBeVisible({ timeout: 30_000 });
      // The picture shows the test person alone: the archive's other rows are real people
      // (C:\dev\.claude\rules\capture-and-personal-data.md).
      await page.locator("main").getByPlaceholder("caută după ID, Nume, Poreclă, CNP, Email Personal 1, Email Personal 2, Email serviciu, Telefon Personal 1, Telefon Personal 2 sau Telefon serviciu").fill(MARK);
      await expect(page.locator("main tbody tr")).toHaveCount(1, { timeout: 30_000 });
      await page.mouse.move(1356, 758);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${SHOTS}/back-list-1366.png`, mask: [recent(page)] });

      // Step 8a (#39.97) — after the step back, „Înainte" (a right arrow, right of „Înapoi") is enabled and returns to
      // the person; „Înapoi" again, then a new screen — „Acte" from the sidebar — disables it.
      await expect(forward).toBeEnabled({ timeout: 15_000 });
      expect(await forward.locator("svg").first().getAttribute("class")).toContain("lucide-arrow-right");
      const [b8, f8] = [(await back.boundingBox())!, (await forward.boundingBox())!];
      expect(f8.x).toBeGreaterThan(b8.x + b8.width);
      expect(Math.abs(f8.y - b8.y)).toBeLessThanOrEqual(2);
      await forward.click();
      await expect(page).toHaveURL((u) => u.pathname === `/natural-persons/${personId}`, { timeout: 30_000 });
      await expect(page.locator("h1").filter({ visible: true }).first()).toContainText(MARK, { timeout: 30_000 });
      await expect(forward).toBeDisabled();
      await back.click();
      await expect(page).toHaveURL((u) => u.pathname === "/natural-persons", { timeout: 30_000 });
      await expect(forward).toBeEnabled({ timeout: 15_000 });
      await openFromSidebar(page, "Acte", "Domeniu");
      await expect(page).toHaveURL((u) => u.pathname === "/documents", { timeout: 30_000 });
      await expect(forward).toBeDisabled({ timeout: 15_000 });
      await page.goto("/natural-persons");

      // A changed field, then „Înapoi": the unsaved-changes dialog; „Anulează" keeps the form, as it was typed.
      await openRecord();
      const firstName = page.getByRole("textbox", { name: "Prenume", exact: true });
      await expect(firstName).toHaveValue("Înapoi", { timeout: 30_000 });
      await firstName.fill("Schimbat");
      await back.click();
      const leave = page.getByRole("dialog").filter({ hasText: "Modificări nesalvate" });
      await expect(leave).toBeVisible();
      await leave.getByRole("button", { name: "Anulează", exact: true }).click();
      await expect(leave).toHaveCount(0);
      await expect(page).toHaveURL((u) => u.pathname === `/natural-persons/${personId}`);
      await expect(firstName).toHaveValue("Schimbat");

      // „Renunță" leaves, unsaved: back on the list.
      await back.click();
      await expect(leave).toBeVisible();
      await leave.getByRole("button", { name: "Renunță", exact: true }).click();
      await expect(page).toHaveURL((u) => u.pathname === "/natural-persons", { timeout: 30_000 });

      // Opened by its address, nothing in this tab to go back to: the parent crumb, the list.
      await page.goto(`/natural-persons/${personId}`);
      await expect(back).toBeEnabled({ timeout: 30_000 });
      await back.click();
      await expect(page).toHaveURL((u) => u.pathname === "/natural-persons", { timeout: 30_000 });
    } finally {
      await removeRecord(page.request, "person", personId);
    }
  });
});
