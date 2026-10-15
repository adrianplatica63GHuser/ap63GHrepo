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
import { E2E_MARKER, createSaleContract, removeLeftovers, removeRecord } from "../helpers/records";

const FIGURES = "playwright-report/manual-figures";
const BLUR = "blur(7px)";

// The router can keep the page before mounted and hidden, ids and all: every locator takes the visible one.
function chapterNav(page: Page) {
  return page.getByRole("navigation", { name: "Capitolele manualului", exact: true }).filter({ visible: true });
}
function article(page: Page) {
  return page.locator("article[data-manual-chapter]").filter({ visible: true });
}
function byId(page: Page, id: string) {
  return page.locator(`[id="${id}"]`).filter({ visible: true });
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
    const h = byId(page, "start-sidebar");
    await expect(h).toHaveText("2.2 Bara laterală");
    await expect(h).toBeInViewport();
    const table = article(page).locator("table").first();
    await expect(table.locator("th")).toHaveText(["Secțiunea", "Ce cuprinde"]);
    await expect(table.locator("tbody tr").last().locator("td").first()).toHaveText("Ajutor și învățare");
    const fig = byId(page, "fig-sidebar");
    await expect(fig.locator("figcaption")).toHaveText("Figura 2.1 — Bara laterală, cu secțiunea „Domeniu” deschisă");
    await expect.poll(() => fig.locator("img").evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);

    // Step 4 — the cross-reference „2.8" in section 2.3.
    const ref = article(page).locator('a[data-manual-ref="start-help"]').first();
    await expect(ref).toHaveText("2.8");
    await ref.click();
    await expect(page).toHaveURL(/\/manual\?s=start-help$/);
    await expect(byId(page, "start-help")).toHaveText("2.8 Ajutorul din spatele „?”");
    await expect(byId(page, "start-help")).toBeInViewport();

    // Step 5 — a figure by its address.
    await page.goto("/manual?s=fig-list");
    await expect(byId(page, "fig-list").locator("figcaption")).toHaveText(
      "Figura 2.3 — Lista persoanelor fizice, cu „Câmpuri afișate” deschis",
      { timeout: 30_000 },
    );
    await expect(byId(page, "fig-list")).toBeInViewport();

    // Step 6 — an address naming no section.
    await page.goto("/manual?s=nu-exista");
    await expect(page.getByRole("status").filter({ visible: true })).toHaveText(
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
    // One picture per figure of the Romanian manual, counted from its sources (#39.38 added chapters 3–7's).
    const roDir = path.join(process.cwd(), "src", "lib", "manual", "content", "ro-RO");
    const figureCount = fs
      .readdirSync(roDir)
      .reduce((n, f) => n + (fs.readFileSync(path.join(roDir, f), "utf8").match(/^!\[/gm)?.length ?? 0), 0);
    expect(figureCount).toBeGreaterThan(6);
    expect(names.filter((n) => n.startsWith("word/media/"))).toHaveLength(figureCount);
    expect(doc).not.toContain("Figura lipsește");
  });
});

// ── The manual's figures — not a step of the case (see the header) ─────────────────────────────────────────────

type SeedObject = { kind: string; id: string; code: string; label: string };

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
/** Any box holding a 13-digit number — a CNP, in an editable form or a read-only version alike — blurred. */
async function blurCnp(page: Page): Promise<void> {
  await page.evaluate((f) => {
    for (const el of document.querySelectorAll<HTMLInputElement>("input")) {
      if (/^\s*\d{13}\s*$/.test(el.value)) el.style.filter = f;
    }
  }, BLUR);
}

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
    test.setTimeout(480_000);
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
    await blurCnp(page);
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

    // ── Slice #39.38: chapters 3–7 ──────────────────────────────────────────────────────────────────────────
    const judicial = objects!.filter((o) => o.kind === "JUDICIAL")[0];
    const property = objects!.filter((o) => o.kind === "PROPERTY")[0];
    const sale = objects!.find((o) => o.kind === "DOCUMENT" && o.label.startsWith("Contract de vânzare"))!;
    const tile = (key: string) => page.locator(`[data-tile="${key}"]`).filter({ visible: true }).first();
    const tick = async (label: string, on: boolean) => {
      const box = page.getByRole("checkbox", { name: label, exact: true });
      if ((await box.count()) && (await box.isChecked()) !== on) await box.setChecked(on);
    };
    /** Rows of a list or of „Rezultate” whose record is not the seed's are blurred. */
    const blurNotSeed = async (prefix: string) =>
      page.evaluate(
        ([pre, ids, f]) => {
          for (const tr of document.querySelectorAll<HTMLElement>("tbody tr")) {
            const href = tr.querySelector(`a[href^='${pre as string}']`)?.getAttribute("href") ?? "";
            if (!(ids as string[]).includes(href.split("/").pop() ?? "")) tr.style.filter = f as string;
          }
        },
        [prefix, [...seedIds], BLUR] as const,
      );

    // Figura 3.1 — a new natural person's form.
    await page.goto("/natural-persons/new");
    // The new form is panels ([data-panel]), not yet the record's tiles.
    await expect(page.locator("h1").filter({ visible: true }).first()).toHaveText("Persoană fizică nouă", { timeout: 60_000 });
    await page.waitForTimeout(1000);
    await blurRecent(page);
    await still(page);
    await page.screenshot({ path: `${FIGURES}/persons-new.png` });

    // Figura 3.2 — the „Arbore de moștenire" tile of the seed's YOUNGEST person (the first, born 1907, has a family too
    // large to read in one tile): seed persons only.
    await page.goto(`/natural-persons/${naturals[naturals.length - 1].id}`);
    await expect(tile("inheritanceTree")).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(2000);
    await still(page);
    await tile("inheritanceTree").screenshot({ path: `${FIGURES}/persons-tree.png` });

    // Figura 7.3 — on the first seed person again.
    await page.goto(`/natural-persons/${person.id}`);
    await expect(tile("identity")).toBeVisible({ timeout: 60_000 });

    // Figura 7.3 — the person's versions: „2 versiuni" opens the strip on the version before the current one (view
    // only; nothing is made current). With two versions „Versiunea anterioară" is then inactive, so it is not pressed.
    const versions = page.getByRole("button", { name: /^\d+ versiuni$/ }).first();
    await versions.click();
    await expect(page.getByRole("button", { name: "Fă curentă", exact: true }).first()).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1500);
    await page.evaluate((f) => {
      for (const el of document.querySelectorAll<HTMLElement>("input, [data-width-field]")) {
        const label = el.getAttribute("aria-label") ?? "";
        if (/CNP/i.test(label)) el.style.filter = f;
      }
      for (const lbl of document.querySelectorAll<HTMLLabelElement>("label")) {
        if (/^\s*CNP/.test(lbl.textContent ?? "") && lbl.htmlFor) {
          const box = document.getElementById(lbl.htmlFor);
          if (box) box.style.filter = f;
        }
      }
    }, BLUR);
    await blurCnp(page);
    await blurRecent(page);
    await still(page);
    await page.screenshot({ path: `${FIGURES}/links-versions.png` });

    // Figura 4.1 — a judicial person's screen.
    await page.goto(`/judicial-persons/${judicial.id}`);
    await expect(page.locator("[data-tile]").first()).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(1500);
    await blurRecent(page);
    await still(page);
    await page.screenshot({ path: `${FIGURES}/companies-record.png` });

    // Figura 5.1 — the list of properties, searched for the seed's building plots; rows not the seed's blurred.
    await page.goto("/properties");
    const psearch = page.locator("main").getByRole("searchbox").or(page.locator("main input[type=search], main input[placeholder]")).first();
    await expect(psearch).toBeVisible({ timeout: 60_000 });
    await psearch.fill("Teren curți construcții");
    await page.waitForTimeout(2500);
    await blurNotSeed("/properties/");
    await blurRecent(page);
    await still(page);
    await page.screenshot({ path: `${FIGURES}/properties-list.png` });

    // Figura 5.2 — a property's screen, the map tiles hidden (no map load), and Figura 7.2 — its „Legături".
    await page.goto(`/properties/${property.id}`);
    await expect(tile("cadastral")).toBeVisible({ timeout: 60_000 });
    for (const label of ["Hartă", "Puncte de contur", "Street View"]) await tick(label, false);
    await page.waitForTimeout(1500);
    await blurRecent(page);
    await still(page);
    await page.screenshot({ path: `${FIGURES}/properties-record.png` });
    // „Legături" is not among a fresh browser's default tiles: shown for its picture, then hidden again.
    await tick("Legături", true);
    await expect(tile("related")).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1500);
    await still(page);
    await tile("related").screenshot({ path: `${FIGURES}/links-related.png` });
    await tick("Legături", false);
    for (const label of ["Hartă", "Puncte de contur", "Street View"]) await tick(label, true); // left as found

    // Figura 7.1 — the association screen, searched for one seed document by its code.
    await page.goto(`/properties/${property.id}/associate-document`);
    const asearch = page.locator("main input").first();
    await expect(asearch).toBeVisible({ timeout: 60_000 });
    await asearch.fill(sale.code);
    await asearch.press("Enter");
    await page.waitForTimeout(2500);
    await blurRecent(page);
    await still(page);
    await page.screenshot({ path: `${FIGURES}/links-associate.png` });

    // Figura 6.2 — the seed's sale contract, „Părți" shown, the whole page.
    await page.goto(`/documents/${sale.id}`);
    await expect(tile("general")).toBeVisible({ timeout: 60_000 });
    await tick("Părți", true);
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await blurRecent(page);
    await still(page);
    await page.screenshot({ path: `${FIGURES}/documents-sale.png`, fullPage: true });
    await tick("Părți", false); // left as found

    // Figura 6.1 — „Pagini" with a page in it. The seed's page files do not open, so a TC-E2E- contract of its own,
    // its page the repo's synthetic fixture, removed in `finally`.
    const MARK = `${E2E_MARKER}MANUAL-FIG`;
    await removeLeftovers(page.request, MARK);
    const docId = await createSaleContract(page.request, `${MARK} Act`);
    try {
      const up = await page.request.post(`/api/documents/${docId}/pages`, {
        multipart: {
          file: { name: "tc-e2e-pagina-1.jpg", mimeType: "image/jpeg", buffer: fs.readFileSync(path.join("e2e", "fixtures", "tc-e2e-pagina-1.jpg")) },
          pageNumber: "1",
        },
      });
      expect(up.ok()).toBeTruthy();
      await page.goto(`/documents/${docId}`);
      await expect(tile("pages").locator("img").first()).toBeVisible({ timeout: 60_000 });
      await page.waitForTimeout(1500);
      await still(page);
      await tile("pages").screenshot({ path: `${FIGURES}/documents-pages.png` });
    } finally {
      await removeRecord(page.request, "document", docId);
    }

    for (const f of [
      "dashboard", "sidebar", "breadcrumb", "list", "record", "help",
      "persons-new", "persons-tree", "companies-record", "properties-list", "properties-record",
      "documents-pages", "documents-sale", "links-associate", "links-related", "links-versions",
    ]) {
      expect(fs.existsSync(`${FIGURES}/${f}.png`)).toBe(true);
    }
  });
});
