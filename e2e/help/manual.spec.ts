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
 * saves the picture under playwright-report/manual-figures/<locale>/, from where a slice copies it into
 * public/manual/figures/<locale>/ — so a figure is re-shot, not redrawn, when its screen changes. Since #39.46 it
 * shoots every figure TWICE, once per language, each in its own interface (the NEXT_LOCALE cookie), because each
 * manual is wholly in its language, its pictures included; the words it looks for come from messages/<locale>.json. It runs only when this
 * file is named on the command line (`claude.sh request e2e e2e/help/manual.spec.ts`; playwright.config.ts sets
 * GA40_MANUAL_FIGURES), never in the whole regression, and it skips when the seed is not in the database.
 * Whatever on a figure is not the seed's — a list row of the archive, the dashboard's lists, „Recente” — and the
 * seed person's CNP are blurred in the page before the picture is taken, so no unblurred copy is ever written
 * (C:\dev\.claude\rules\capture-and-personal-data.md). No figure loads a map or a Street View panorama.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "../helpers/test";
import { openSection, sidebar } from "../helpers/sidebar";
import { readZipStore } from "../../src/lib/docx/zip-store";
import {
  E2E_MARKER,
  createDocumentOfType,
  createSaleContract,
  documentRoleOptions,
  removeLeftovers,
  removeRecord,
} from "../helpers/records";

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
    expect(file.suggestedFilename()).toBe("Manual de utilizare GA40.docx");
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

    // Step 9 (#39.46) — „Descarcă în engleză (Word)”: the English manual, from this Romanian screen — wholly English.
    const download2 = page.waitForEvent("download");
    await page.getByRole("button", { name: "Descarcă în engleză (Word)", exact: true }).click();
    const file2 = await download2;
    expect(file2.suggestedFilename()).toBe("GA40 User Manual.docx");
    const parts2 = readZipStore(new Uint8Array(fs.readFileSync(await file2.path())));
    const doc2 = new TextDecoder().decode(parts2.find((p) => p.name === "word/document.xml")?.data);
    expect(doc2).toContain(">User manual<");
    expect(doc2).toContain(">Contents<");
    expect(doc2).toContain(">1  Introduction<");
    // Chapter 13's English title as its source writes it, escaped as Word's XML holds it.
    const en13 = fs.readFileSync(path.join(process.cwd(), "src", "lib", "manual", "content", "en-GB", "13-learning.ts"), "utf8");
    const title13 = /^# 13 (.+?) \{#learning\}$/m.exec(en13)?.[1] ?? "";
    expect(title13).not.toBe("");
    expect(doc2).toContain(`>13  ${title13.replace(/&/g, "&amp;")}<`);
    expect(doc2).not.toContain(">Cuprins<");
    expect(doc2).not.toContain("Figure missing");
    expect(parts2.filter((p) => p.name.startsWith("word/media/"))).toHaveLength(figureCount);
  });
});

// ── The manual's figures — not a step of the case (see the header) ─────────────────────────────────────────────

type SeedObject = { kind: string; id: string; code: string; label: string };

/**
 * Does the e2e account hold quiz attempts of its own? Then skills-map.spec.ts cannot seed the four states and
 * does not shoot the map's figure, so this test shoots it as the account stands (#39.46).
 */
function accountHasOwnAttempts(): boolean {
  const email = process.env.E2E_EMAIL;
  if (!email) return false;
  try {
    execFileSync(
      process.execPath,
      ["--env-file=.env", "node_modules/tsx/dist/cli.mjs", "scripts/skills/set-progress.ts", "--email", email, "--require-empty"],
      { stdio: "pipe", timeout: 60_000 },
    );
    return false;
  } catch (err) {
    return (err as { status?: number }).status === 3;
  }
}

function seed(): SeedObject[] | null {
  const file = path.join(process.cwd(), ".seed-dev-data-big", "manifest.json");
  if (!fs.existsSync(file)) return null;
  return (JSON.parse(fs.readFileSync(file, "utf8")) as { objects: SeedObject[] }).objects;
}

/**
 * The words the figures test looks for, in the language it shoots (#39.46: each manual has its own set, shot in
 * its own interface). Taken from messages/<locale>.json by key, so the English set is found by the English screen's
 * own strings; the data values of the seed („Teren curți construcții”) are the same in both.
 */
type Messages = { [k: string]: string | Messages };
function figureStrings(locale: "ro-RO" | "en-GB") {
  const all = JSON.parse(fs.readFileSync(path.join(process.cwd(), "messages", `${locale}.json`), "utf8")) as Messages;
  const m = (key: string): string => {
    const v = key.split(".").reduce<string | Messages>((o, k) => (o as Messages)[k], all);
    if (typeof v !== "string") throw new Error(`messages/${locale}.json has no string at ${key}`);
    return v;
  };
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const ro = locale === "ro-RO";
  return {
    recent: m("navigation.recentlyViewed.title"),
    recentActivity: m("dashboard.recentActivity.title"),
    domain: m("nav.sections.domain"),
    breadcrumb: m("navigation.breadcrumb.ariaLabel"),
    personSearch: m("naturalPerson.searchPlaceholder"),
    chooseFields: m("naturalPerson.chooseFields"),
    newPerson: m("naturalPerson.createTitle"),
    versions: new RegExp(`^${esc(m("naturalPerson.version.historyChip")).replace("\\{n\\}", "\\d+")}$`),
    makeCurrent: m("naturalPerson.version.makeCurrent"),
    mapTiles: [m("property.tiles.map"), m("property.tiles.corners"), m("property.tiles.streetView")],
    links: m("property.tiles.related"),
    parties: m("document.tiles.parties"),
    search: m("globalSearch.search"),
    results: ro ? /\d+ rezultat/ : /\d+ result/,
    // An identity document's fields, by their label: over-blurring is the safe direction.
    idLabel: ro ? /CNP|Serie|Număr/i : /CNP|Series|Number/i,
    idLabelStart: ro ? /^\s*(CNP|Serie|Nr\.|Număr)/ : /^\s*(CNP|Series|No\.|Number)/,
  };
}

/** Blur the „Recente" bar of the sidebar, whose records are whatever the account opened last. */
async function blurRecent(page: Page, title: string): Promise<void> {
  await page.evaluate(
    ([f, t]) => {
      const recent = [...document.querySelectorAll<HTMLElement>("aside div.border-t")].find((d) => (d.textContent ?? "").includes(t));
      if (recent) recent.style.filter = f;
    },
    [BLUR, title] as const,
  );
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
  for (const locale of ["ro-RO", "en-GB"] as const) test(`shot from the dev seed's invented records, in ${locale}`, async ({ page }) => {
    test.skip(!process.env.GA40_MANUAL_FIGURES, "Runs only when e2e/help/manual.spec.ts is named on the command line.");
    const S = figureStrings(locale);
    const dir = `${FIGURES}/${locale}`;
    await page.context().addCookies([{ name: "NEXT_LOCALE", value: locale, domain: "localhost", path: "/" }]);
    const objects = seed();
    test.skip(!objects, "The big dev seed is not in this database (.seed-dev-data-big/manifest.json is absent).");
    test.setTimeout(480_000);
    const naturals = objects!.filter((o) => o.kind === "NATURAL");
    const seedIds = new Set(objects!.map((o) => o.id));
    const person = naturals[0];
    fs.mkdirSync(dir, { recursive: true });
    await page.setViewportSize({ width: 1366, height: 768 });

    // Figura 1.1 — the dashboard. Its lists name records of the whole archive: blurred.
    await page.goto("/");
    await expect(page.getByText(S.recentActivity, { exact: false }).first()).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(1500);
    // The dashboard has no <main>: its four tiles are [data-panel] sections, and two of them list records.
    await page.evaluate((f) => {
      const lists = document.querySelectorAll<HTMLElement>(
        '[data-panel="expiring-documents"] tbody, [data-panel="recent-activity"] li',
      );
      if (lists.length === 0) throw new Error("The dashboard's lists were not found, so nothing would be blurred.");
      lists.forEach((el) => (el.style.filter = f));
    }, BLUR);
    await blurRecent(page, S.recent);
    await still(page);
    await page.screenshot({ path: `${dir}/dashboard.png` });

    // Figura 2.1 — the sidebar, „Domeniu" open.
    await openSection(page, S.domain);
    await blurRecent(page, S.recent);
    await still(page);
    await sidebar(page).locator("xpath=ancestor::aside").screenshot({ path: `${dir}/sidebar.png` });

    // Figura 2.2 — the navigation bar, on a seed person's screen.
    await page.goto(`/natural-persons/${person.id}`);
    const bar = page.getByRole("navigation", { name: S.breadcrumb }).filter({ visible: true });
    await expect(bar).toContainText(person.label.split(" ")[0], { timeout: 60_000 });
    await still(page);
    await bar.screenshot({ path: `${dir}/breadcrumb.png` });

    // Figura 2.4 — the person's screen and its tiles; the CNP blurred, „Recente" blurred.
    await page.waitForTimeout(1500);
    await page.evaluate(
      ([f, any, start]) => {
        const label1 = new RegExp(any, "i");
        const label2 = new RegExp(start);
        for (const el of document.querySelectorAll<HTMLElement>("input, [data-width-field]")) {
          const label = el.getAttribute("aria-label") ?? el.closest("label")?.textContent ?? "";
          if (label1.test(label)) el.style.filter = f;
        }
        for (const lbl of document.querySelectorAll<HTMLLabelElement>("label")) {
          if (label2.test(lbl.textContent ?? "") && lbl.htmlFor) {
            const box = document.getElementById(lbl.htmlFor);
            if (box) box.style.filter = f;
          }
        }
      },
      [BLUR, S.idLabel.source, S.idLabelStart.source] as const,
    );
    await blurCnp(page);
    await blurRecent(page, S.recent);
    await still(page);
    await page.screenshot({ path: `${dir}/record.png` });

    // Figura 2.3 — the list, searched by the seed person's surname, „Câmpuri afișate" open; rows not the seed's blurred.
    // #39.86: three columns chosen first — two with a funnel, one without — so the band of names (#39.83) shows them.
    await page.evaluate(() => localStorage.setItem("ga40-col-person-v3", JSON.stringify(["dateOfBirth", "age", "cnp"])));
    await page.goto("/natural-persons");
    const search = page.locator("main").getByPlaceholder(S.personSearch);
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
    await page.getByRole("button", { name: S.chooseFields }).first().click();
    await blurRecent(page, S.recent);
    await still(page);
    await page.screenshot({ path: `${dir}/list.png` });
    await page.keyboard.press("Escape");

    // Figura 2.5 — the „?" of the list, open.
    await page.goto("/natural-persons");
    await expect(search).toBeVisible({ timeout: 60_000 });
    const help = page.getByRole("navigation", { name: S.breadcrumb }).filter({ visible: true }).locator(":scope > span.ml-auto button").first();
    await expect(help).toBeVisible({ timeout: 30_000 });
    await help.click();
    await page.waitForTimeout(800);
    await page.evaluate((f) => document.querySelectorAll<HTMLElement>("main tbody").forEach((el) => (el.style.filter = f)), BLUR);
    await blurRecent(page, S.recent);
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page.screenshot({ path: `${dir}/help.png` });

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
    await expect(page.locator("h1").filter({ visible: true }).first()).toHaveText(S.newPerson, { timeout: 60_000 });
    await page.waitForTimeout(1000);
    await blurRecent(page, S.recent);
    await still(page);
    await page.screenshot({ path: `${dir}/persons-new.png` });

    // Figura 3.2 — the „Arbore de moștenire" tile of the seed's YOUNGEST person (the first, born 1907, has a family too
    // large to read in one tile): seed persons only.
    await page.goto(`/natural-persons/${naturals[naturals.length - 1].id}`);
    await expect(tile("inheritanceTree")).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(2000);
    await still(page);
    await tile("inheritanceTree").screenshot({ path: `${dir}/persons-tree.png` });

    // Figura 7.3 — on the first seed person again.
    await page.goto(`/natural-persons/${person.id}`);
    await expect(tile("identity")).toBeVisible({ timeout: 60_000 });

    // Figura 7.3 — the person's versions: „2 versiuni" opens the strip on the version before the current one (view
    // only; nothing is made current). With two versions „Versiunea anterioară" is then inactive, so it is not pressed.
    const versions = page.getByRole("button", { name: S.versions }).first();
    await versions.click();
    await expect(page.getByRole("button", { name: S.makeCurrent, exact: true }).first()).toBeVisible({ timeout: 30_000 });
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
    await blurRecent(page, S.recent);
    await still(page);
    await page.screenshot({ path: `${dir}/links-versions.png` });

    // Figura 4.1 — a judicial person's screen.
    await page.goto(`/judicial-persons/${judicial.id}`);
    await expect(page.locator("[data-tile]").first()).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(1500);
    await blurRecent(page, S.recent);
    await still(page);
    await page.screenshot({ path: `${dir}/companies-record.png` });

    // Figura 5.1 — the list of properties, searched for the seed's building plots; rows not the seed's blurred. #39.86:
    // four columns, three with a funnel (#39.82) and „Nr. cadastru" without, and the funnel under „Tip proprietate"
    // pressed, so the figure shows a column filter open under its funnel (Ask first 1: invented records only).
    await page.evaluate(() => localStorage.setItem("ga40-col-property-v4", JSON.stringify(["tarlaSola", "parcela", "propertyType", "cadastralNumber"])));
    await page.goto("/properties");
    const psearch = page.locator("main").getByRole("searchbox").or(page.locator("main input[type=search], main input[placeholder]")).first();
    await expect(psearch).toBeVisible({ timeout: 60_000 });
    await psearch.fill("Teren curți construcții");
    await page.waitForTimeout(2500);
    await blurNotSeed("/properties/");
    await page.locator('main [data-filter-funnel="propertyType"] button').click();
    await expect(page.locator('main [data-filter-editor="propertyType"] [data-filter-value]').first()).toBeVisible({ timeout: 30_000 });
    await blurRecent(page, S.recent);
    await still(page);
    await page.screenshot({ path: `${dir}/properties-list.png` });
    await page.keyboard.press("Escape");

    // Figura 5.2 — a property's screen, the map tiles hidden (no map load), and Figura 7.2 — its „Legături".
    await page.goto(`/properties/${property.id}`);
    await expect(tile("cadastral")).toBeVisible({ timeout: 60_000 });
    for (const label of S.mapTiles) await tick(label, false);
    await page.waitForTimeout(1500);
    await blurRecent(page, S.recent);
    await still(page);
    await page.screenshot({ path: `${dir}/properties-record.png` });
    // „Legături" is not among a fresh browser's default tiles: shown for its picture, then hidden again.
    await tick(S.links, true);
    await expect(tile("related")).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1500);
    await still(page);
    await tile("related").screenshot({ path: `${dir}/links-related.png` });
    await tick(S.links, false);
    for (const label of S.mapTiles) await tick(label, true); // left as found

    // Figura 7.1 — the association screen, searched for one seed document by its code.
    await page.goto(`/properties/${property.id}/associate-document`);
    const asearch = page.locator("main input").first();
    await expect(asearch).toBeVisible({ timeout: 60_000 });
    await asearch.fill(sale.code);
    await asearch.press("Enter");
    await page.waitForTimeout(2500);
    await blurRecent(page, S.recent);
    await still(page);
    await page.screenshot({ path: `${dir}/links-associate.png` });

    // Figura 6.2 — the seed's sale contract, „Părți" shown, the whole page.
    await page.goto(`/documents/${sale.id}`);
    await expect(tile("general")).toBeVisible({ timeout: 60_000 });
    await tick(S.parties, true);
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await blurRecent(page, S.recent);
    await still(page);
    await page.screenshot({ path: `${dir}/documents-sale.png`, fullPage: true });
    await tick(S.parties, false); // left as found

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
      await tile("pages").screenshot({ path: `${dir}/documents-pages.png` });
    } finally {
      await removeRecord(page.request, "document", docId);
    }

    // Figura 6.3 (Slice #39.47) — an antecontract's „Legături”, linked to the seed's sale contract with „Antecontract
    // al”, two seed persons on it. The seed has no antecontract, so one is made here — its title in the seed's own
    // style, the marker in its „Subiect” (which „Căutare globală” searches, so removeLeftovers finds it) — and
    // removed in `finally`, its links with it.
    const ANTE = `${E2E_MARKER}MANUAL-FIG-ANTE`;
    await removeLeftovers(page.request, ANTE);
    const anteTitle = `Antecontract nr. 848/19.07.2018 — ${sale.label.split(" — ").slice(1).join(" — ") || sale.label}`;
    const anteId = await createDocumentOfType(page.request, "ANTECONTRACT", anteTitle, { subject: ANTE });
    try {
      // What the type offers on „Asociere persoană”, for the manual's sentence on roles (printed, not asserted).
      console.log(`[manual-figures] Antecontract person roles: ${JSON.stringify(await documentRoleOptions(page.request, anteId))}`);
      // #39.57: the two seed persons as the antecontract's parties — „Promitent vânzător” and „Promitent cumpărător”,
      // which hold a share — so „Legături” shows the line that says they are in „Părți”. Where the type offers no
      // such role (a database without FU-344's rows), they are linked without one and stand on „Legături”.
      const validRes = await page.request.get(`/api/documents/${anteId}/valid-person-roles`);
      const validBody = (await validRes.json()) as { items?: { id: string; name: string }[] } | { id: string; name: string }[];
      const valid = Array.isArray(validBody) ? validBody : (validBody.items ?? []);
      for (const [person, roleName] of [[naturals[0], "Promitent vânzător"], [naturals[1], "Promitent cumpărător"]] as const) {
        const roleId = valid.find((r) => r.name === roleName)?.id ?? null;
        const persons = await page.request.post(`/api/documents/${anteId}/persons`, { data: { personIds: [person.id], personRoleId: roleId } });
        expect(persons.ok(), `POST persons ${persons.status()}`).toBeTruthy();
      }
      const roles = await page.request.get("/api/admin/value-lists/document-document-roles");
      expect(roles.ok()).toBeTruthy();
      const role = ((await roles.json()) as { items?: { id: string; name: string }[] }).items?.find((r) => r.name === "Antecontract al");
      expect(role, "the reference data has no „Antecontract al” role").toBeTruthy();
      const link = await page.request.post(`/api/documents/${anteId}/references`, {
        data: { documentIds: [sale.id], relationshipRoleId: role!.id },
      });
      expect(link.ok(), `POST references ${link.status()}`).toBeTruthy();
      await page.goto(`/documents/${anteId}`);
      await expect(tile("general")).toBeVisible({ timeout: 60_000 });
      // The tile bar renders after the first tile: `tick` skips a box that is not there yet.
      await expect(page.getByRole("checkbox", { name: S.links, exact: true })).toBeVisible({ timeout: 30_000 });
      await tick(S.links, true);
      await expect(tile("related")).toBeVisible({ timeout: 30_000 });
      await expect(tile("related")).toContainText(/Contract de v[âa]nzare/i, { timeout: 30_000 });
      await page.waitForTimeout(1500);
      await still(page);
      await tile("related").screenshot({ path: `${dir}/documents-antecontract.png` });
    } finally {
      await removeRecord(page.request, "document", anteId);
    }

    // Figures 9.1, 9.2, 10.1, 12.1, 12.2 (Slice #39.39) — five screens as they open. None of them lists a record of
    // the archive before something is chosen, so there is nothing to blur but „Recente”.
    for (const [url, file] of [
      ["/admin/doc-type-engine", "tools-doc-type-engine"],
      ["/admin/calculation", "tools-calculation"],
      ["/admin/import", "import-steps"],
      // #39.80: a page of Reference Data as tiles (#39.75), not the empty side the screen opens on.
      ["/admin/value-lists?list=property-types", "admin-value-lists"],
      ["/admin/settings", "admin-settings"],
    ] as const) {
      await page.goto(url);
      await expect(page.locator("h1").filter({ visible: true }).first()).toBeVisible({ timeout: 60_000 });
      await page.waitForTimeout(2500);
      await blurRecent(page, S.recent);
      await still(page);
      await page.screenshot({ path: `${dir}/${file}.png` });
    }

    // Figura 11.1 — „Căutare globală” with the results of a search for a seed person's surname. Any row whose
    // record is not the seed's is blurred, whatever kind of record it is.
    await page.goto("/admin/global-search");
    const surname = person.label.split(" ").pop() ?? person.label;
    await page.getByPlaceholder(/Popescu/).filter({ visible: true }).first().fill(surname);
    await page.getByRole("button", { name: S.search, exact: true }).filter({ visible: true }).first().click();
    await expect(page.getByText(S.results).filter({ visible: true }).first()).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(1500);
    await page.evaluate(
      ([ids, f]) => {
        for (const tr of document.querySelectorAll<HTMLElement>("tbody tr")) {
          const href = tr.querySelector("a[href]")?.getAttribute("href") ?? "";
          if (!(ids as string[]).includes(href.split("?")[0].split("/").pop() ?? "")) tr.style.filter = f as string;
        }
      },
      [[...seedIds], BLUR] as const,
    );
    await blurRecent(page, S.recent);
    await still(page);
    await page.screenshot({ path: `${dir}/reports-search.png` });

    // Figura 13.1 — the skills map. skills-map.spec.ts shoots it with the four states seeded, which it can do only on
    // an account with no attempts of its own; on one that has some, it is shot here, as the account stands.
    if (accountHasOwnAttempts()) {
      await page.setViewportSize({ width: 1366, height: 900 });
      await page.goto("/skills-map");
      await expect(page.locator("[data-skills-frame]").filter({ visible: true })).toBeVisible({ timeout: 60_000 });
      await page.waitForTimeout(1500);
      await blurRecent(page, S.recent);
      await page.locator("[data-skills-frame]").filter({ visible: true }).evaluate((el) => {
        for (let n: Element | null = el; n; n = n.parentElement) n.scrollTop = 0;
        window.scrollTo(0, 0);
      });
      await still(page);
      await page.screenshot({ path: `${dir}/skills-map.png` });
      expect(fs.existsSync(`${dir}/skills-map.png`)).toBe(true);
    }

    for (const f of [
      "dashboard", "sidebar", "breadcrumb", "list", "record", "help",
      "persons-new", "persons-tree", "companies-record", "properties-list", "properties-record",
      "documents-pages", "documents-sale", "documents-antecontract", "links-associate", "links-related", "links-versions",
      "tools-doc-type-engine", "tools-calculation", "import-steps", "reports-search", "admin-value-lists", "admin-settings",
    ]) {
      expect(fs.existsSync(`${dir}/${f}.png`)).toBe(true);
    }
  });
});
