/**
 * Case:   TC-HELP-02 — „Manual de utilizare”: din bara laterală, o secțiune deschisă după link, descărcat ca Word
 * Source: docs/testing/cases/TC-HELP-02.md, „Last green" 2026-10-14
 *
 * A translation of the case file, step for step. Every Romanian string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - Step 8's file is read by the spec — its parts, its headings and its pictures — where the hand run opens it
 *     in Word.
 *
 * AND A SECOND TEST THAT IS NOT A STEP OF THE CASE: „the manual's figures” (Slice #39.37's Ask first 5). It opens
 * each screen a figure shows, on the big dev seed's INVENTED records (.seed-dev-data-big/manifest.json), and
 * saves the picture under playwright-report/manual-figures/, from where a slice copies it into
 * public/manual/figures/ — so a figure is re-shot, not redrawn, when its screen changes. It runs only when this
 * file is named on the command line (`claude.sh request e2e e2e/help/manual.spec.ts`; playwright.config.ts sets
 * GA40_MANUAL_FIGURES), never in the whole regression, and it skips when the seed is not in the database.
 * Whatever on a figure is not the seed's — a list row of the archive, the dashboard's lists, „Recente” — and the
 * seed person's CNP are blurred in the page before the picture is taken, so no unblurred copy is ever written
 * (C:\dev\.claude\rules\capture-and-personal-data.md). No figure loads a map or a Street View panorama.
 */

import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "../helpers/test";
import { openSection, sidebar } from "../helpers/sidebar";
import { readZipStore } from "../../src/lib/docx/zip-store";

const FIGURES = "playwright-report/manual-figures";
const BLUR = "blur(7px)";

function chapterNav(page: Page) {
  return page.getByRole("navigation", { name: "Capitolele manualului", exact: true });
}
function article(page: Page) {
  return page.locator("article[data-manual-chapter]");
}

test.describe("TC-HELP-02 — „Manual de utilizare”", () => {
  test("from the sidebar, a section opened by its link, downloaded as Word", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Step 1 — „Ajutor și învățare" → „Manual de utilizare".
    await page.goto("/");
    await expect(sidebar(page)).toBeVisible({ timeout: 30_000 });
    await openSection(page, "Ajutor și învățare");
    await sidebar(page).getByRole("link", { name: "Manual de utilizare", exact: true }).click();
    await expect(page).toHaveURL((u) => u.pathname === "/manual", { timeout: 30_000 });
    await expect(page.locator("h1").filter({ visible: true }).first()).toHaveText("Manual de utilizare", { timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Descarcă (Word)", exact: true })).toBeVisible();
    const nav = chapterNav(page);
    await expect(nav.getByRole("heading", { name: "Cuprins", exact: true })).toBeVisible();
    const chapters = nav.locator(":scope > ol > li > a");
    await expect(chapters).toHaveCount(13);
    await expect(chapters.first()).toHaveText("1 Introducere");
    await expect(chapters.last()).toHaveText("13 Ajutor și învățare");
    await expect(article(page).locator("h2")).toHaveText("1 Introducere");
    const crumbs = page
      .getByRole("navigation", { name: "Fir de navigare" })
      .filter({ visible: true })
      .locator("a, [data-crumb-section], [aria-current=page]");
    await expect(crumbs).toHaveText(["Acasă", "Ajutor și învățare", "Manual de utilizare"]);

    // Step 2 — „2 Primii pași": its nine sections under it.
    await nav.getByRole("link", { name: "2 Primii pași", exact: true }).click();
    await expect(page).toHaveURL(/\/manual\?s=start$/);
    await expect(article(page).locator("h2")).toHaveText("2 Primii pași");
    const sections = nav.locator(":scope > ol > li > ol > li > a");
    await expect(sections).toHaveCount(9);
    await expect(sections.first()).toHaveText("2.1 Conectarea");
    await expect(sections.last()).toHaveText("2.9 Exemple și cazuri de utilizare");

    // Step 3 — „2.2 Bara laterală": the heading in view, the table, Figura 2.1 with its picture.
    await nav.getByRole("link", { name: "2.2 Bara laterală", exact: true }).click();
    await expect(page).toHaveURL(/\/manual\?s=start-sidebar$/);
    const h = page.locator("#start-sidebar");
    await expect(h).toHaveText("2.2 Bara laterală");
    await expect(h).toBeInViewport();
    const table = article(page).locator("table").first();
    await expect(table.locator("th")).toHaveText(["Secțiunea", "Ce cuprinde"]);
    await expect(table.locator("tbody tr").last().locator("td").first()).toHaveText("Ajutor și învățare");
    const fig = page.locator("#fig-sidebar");
    await expect(fig.locator("figcaption")).toHaveText("Figura 2.1 — Bara laterală, cu secțiunea „Domeniu” deschisă");
    await expect.poll(() => fig.locator("img").evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);

    // Step 4 — the cross-reference „2.8" in section 2.3.
    const ref = article(page).locator('a[data-manual-ref="start-help"]').first();
    await expect(ref).toHaveText("2.8");
    await ref.click();
    await expect(page).toHaveURL(/\/manual\?s=start-help$/);
    await expect(page.locator("#start-help")).toHaveText("2.8 Ajutorul din spatele „?”");
    await expect(page.locator("#start-help")).toBeInViewport();

    // Step 5 — a figure by its address.
    await page.goto("/manual?s=fig-list");
    await expect(page.locator("#fig-list figcaption")).toHaveText(
      "Figura 2.3 — Lista persoanelor fizice, cu „Câmpuri afișate” deschis",
      { timeout: 30_000 },
    );
    await expect(page.locator("#fig-list")).toBeInViewport();

    // Step 6 — an address naming no section.
    await page.goto("/manual?s=nu-exista");
    await expect(page.getByRole("status")).toHaveText(
      "Secțiunea „nu-exista” nu există în manual; s-a deschis primul capitol.",
      { timeout: 30_000 },
    );
    await expect(article(page).locator("h2")).toHaveText("1 Introducere");

    // Step 7 — „Capitolul următor: 2 Primii pași".
    await page.getByRole("link", { name: "Capitolul următor: 2 Primii pași", exact: true }).click();
    await expect(page).toHaveURL(/\/manual\?s=start$/);
    await expect(article(page).locator("h2")).toHaveText("2 Primii pași");

    // Step 8 — „Descarcă (Word)": the file, its parts, its headings, its pictures.
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Descarcă (Word)", exact: true }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("Manual de utilizare.docx");
    const parts = readZipStore(new Uint8Array(fs.readFileSync(await file.path())));
    const names = parts.map((p) => p.name);
    expect(names).toContain("word/document.xml");
    const doc = new TextDecoder().decode(parts.find((p) => p.name === "word/document.xml")?.data);
    expect(doc).toContain(">Manual de utilizare<");
    expect(doc).toContain(">Cuprins<");
    expect(doc).toContain(">1  Introducere<");
    expect(doc).toContain(">13  Ajutor și învățare<");
    expect(names.filter((n) => n.startsWith("word/media/"))).toHaveLength(6);
    expect(doc).not.toContain("Figura lipsește");
  });
});

// ── The manual's figures — not a step of the case (see the header) ─────────────────────────────────────────────

type SeedObject = { kind: string; id: string; label: string };

function seed(): SeedObject[] | null {
  const file = path.join(process.cwd(), ".seed-dev-data-big", "manifest.json");
  if (!fs.existsSync(file)) return null;
  return (JSON.parse(fs.readFileSync(file, "utf8")) as { objects: SeedObject[] }).objects;
}

/** Blur the „Recente" bar of the sidebar, whose records are whatever the account opened last. */
async function blurRecent(page: Page): Promise<void> {
  await page.evaluate((f) => {
    const recent = [...document.querySelectorAll<HTMLElement>("aside div.border-t")].find((d) => /Recente/i.test(d.textContent ?? ""));
    if (recent) recent.style.filter = f;
  }, BLUR);
}

/** Off every row (no hover in the picture), and without `next dev`'s own badge in the corner. */
async function still(page: Page): Promise<void> {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.mouse.move(5, 5);
  await page.waitForTimeout(400);
}

test.describe("the manual's figures (Slice #39.37) — only when this file is named", () => {
  test("shot from the dev seed's invented records", async ({ page }) => {
    test.skip(!process.env.GA40_MANUAL_FIGURES, "Runs only when e2e/help/manual.spec.ts is named on the command line.");
    const objects = seed();
    test.skip(!objects, "The big dev seed is not in this database (.seed-dev-data-big/manifest.json is absent).");
    test.setTimeout(240_000);
    const naturals = objects!.filter((o) => o.kind === "NATURAL");
    const seedIds = new Set(objects!.map((o) => o.id));
    const person = naturals[0];
    fs.mkdirSync(FIGURES, { recursive: true });
    await page.setViewportSize({ width: 1366, height: 768 });

    // Figura 1.1 — the dashboard. Its lists name records of the whole archive: blurred.
    await page.goto("/");
    await expect(page.getByText("Activitate recentă", { exact: false }).first()).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(1500);
    // The dashboard has no <main>: its four tiles are [data-panel] sections, and two of them list records.
    await page.evaluate((f) => {
      const lists = document.querySelectorAll<HTMLElement>(
        '[data-panel="expiring-documents"] tbody, [data-panel="recent-activity"] li',
      );
      if (lists.length === 0) throw new Error("The dashboard's lists were not found, so nothing would be blurred.");
      lists.forEach((el) => (el.style.filter = f));
    }, BLUR);
    await blurRecent(page);
    await still(page);
    await page.screenshot({ path: `${FIGURES}/dashboard.png` });

    // Figura 2.1 — the sidebar, „Domeniu" open.
    await openSection(page, "Domeniu");
    await blurRecent(page);
    await still(page);
    await sidebar(page).locator("xpath=ancestor::aside").screenshot({ path: `${FIGURES}/sidebar.png` });

    // Figura 2.2 — the navigation bar, on a seed person's screen.
    await page.goto(`/natural-persons/${person.id}`);
    const bar = page.getByRole("navigation", { name: "Fir de navigare" }).filter({ visible: true });
    await expect(bar).toContainText(person.label.split(" ")[0], { timeout: 60_000 });
    await still(page);
    await bar.screenshot({ path: `${FIGURES}/breadcrumb.png` });

    // Figura 2.4 — the person's screen and its tiles; the CNP blurred, „Recente" blurred.
    await page.waitForTimeout(1500);
    await page.evaluate((f) => {
      for (const el of document.querySelectorAll<HTMLElement>("input, [data-width-field]")) {
        const label = el.getAttribute("aria-label") ?? el.closest("label")?.textContent ?? "";
        if (/CNP|Serie|Număr/i.test(label)) el.style.filter = f;
      }
      for (const lbl of document.querySelectorAll<HTMLLabelElement>("label")) {
        if (/^\s*(CNP|Serie|Nr\.|Număr)/.test(lbl.textContent ?? "") && lbl.htmlFor) {
          const box = document.getElementById(lbl.htmlFor);
          if (box) box.style.filter = f;
        }
      }
    }, BLUR);
    await blurRecent(page);
    await still(page);
    await page.screenshot({ path: `${FIGURES}/record.png` });

    // Figura 2.3 — the list, searched by the seed person's surname, „Câmpuri afișate" open; rows not the seed's blurred.
    await page.goto("/natural-persons");
    const search = page.locator("main").getByPlaceholder("caută după cod, nume, email sau telefon");
    await expect(search).toBeVisible({ timeout: 60_000 });
    await search.fill(person.label.split(" ").slice(-1)[0]);
    await page.waitForTimeout(2000);
    await page.evaluate(
      ([ids, f]) => {
        for (const tr of document.querySelectorAll<HTMLElement>("main tbody tr")) {
          const href = tr.querySelector("a[href^='/natural-persons/']")?.getAttribute("href") ?? "";
          const id = href.split("/").pop() ?? "";
          if (!(ids as string[]).includes(id)) tr.style.filter = f as string;
        }
      },
      [[...seedIds], BLUR] as const,
    );
    await page.getByRole("button", { name: "Câmpuri afișate" }).first().click();
    await blurRecent(page);
    await still(page);
    await page.screenshot({ path: `${FIGURES}/list.png` });
    await page.keyboard.press("Escape");

    // Figura 2.5 — the „?" of the list, open.
    await page.goto("/natural-persons");
    await expect(search).toBeVisible({ timeout: 60_000 });
    const help = page.getByRole("navigation", { name: "Fir de navigare" }).filter({ visible: true }).locator(":scope > span.ml-auto button").first();
    await expect(help).toBeVisible({ timeout: 30_000 });
    await help.click();
    await page.waitForTimeout(800);
    await page.evaluate((f) => document.querySelectorAll<HTMLElement>("main tbody").forEach((el) => (el.style.filter = f)), BLUR);
    await blurRecent(page);
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page.screenshot({ path: `${FIGURES}/help.png` });

    for (const f of ["dashboard", "sidebar", "breadcrumb", "list", "record", "help"]) {
      expect(fs.existsSync(`${FIGURES}/${f}.png`)).toBe(true);
    }
  });
});
