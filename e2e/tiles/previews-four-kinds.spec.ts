/**
 * Case:   TC-TILES-11 — Cele patru previzualizări: „născută:", contactele firmei, cele trei rânduri ale proprietății, actul fără tip
 * Source: docs/testing/cases/TC-TILES-11.md, „Last green" 2026-10-03
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-TILES-11` (records.ts), and each list is
 *     searched for that.
 *   - The tarla is the archive's first, read from the list the property form
 *     reads; the spec compares the preview with its indicativ.
 *   - Slice #39.04: a second record of each kind (whose name holds none of the
 *     first's words), so step 7 has „another row" on every list.
 */

import fs from "node:fs";
import path from "node:path";
import { test, expect, type Locator, type Page } from "../helpers/test";
import {
  E2E_MARKER, createCompany, createDocumentOfType, createNaturalPerson, createProperty, removeLeftovers, removeRecord,
  type RecordKind,
} from "../helpers/records";
import { ROW_TILE_CEILING_PX, rowTileMinPx } from "../../src/lib/ui/field-widths";

const MARK = `${E2E_MARKER}TILES-11`;
/**
 * Slice #38.75: step 9's own records — a full page of them on each list. Its own marker, which neither holds
 * `MARK` nor is held by it, so steps 1–8's searches and leftovers never meet these.
 */
const TALL = `${E2E_MARKER}INCURSION-H`;
/** A list's page (`PAGE_SIZE` in each list-view). */
const PAGE = 15;

/** Searches the list for the case's marker and opens the preview of the row holding `name`. */
async function preview(page: Page, list: string, name: string): Promise<Locator> {
  await page.goto(list);
  const main = page.locator("main");
  const search = main.locator('input[placeholder^="caută"]').first();
  await expect(search).toBeVisible({ timeout: 30_000 });
  await search.fill(MARK);
  const row = main.locator("tbody tr").filter({ hasText: name });
  await expect(row).toHaveCount(1, { timeout: 30_000 });
  // Slice #38.71: the row's first button is the magnifier, „Previzualizare"; its last, „Deschide"; not pressed yet.
  const actions = row.locator("[data-row-actions]").locator("a, button");
  await expect(actions.first()).toHaveAccessibleName("Previzualizare");
  await expect(actions.last()).toHaveAccessibleName("Deschide");
  const magnifier = row.getByRole("button", { name: "Previzualizare", exact: true });
  await expect(magnifier).toHaveAttribute("aria-pressed", "false");
  await magnifier.click();
  const tile = page.locator("[data-preview]");
  await expect(tile.getByRole("link", { name: "Deschide", exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(magnifier).toHaveAttribute("aria-pressed", "true");
  return tile;
}

/** Slice #38.71: the magnifier pressed again closes its preview and is released. */
async function closeByMagnifier(page: Page, name: string): Promise<void> {
  const row = page.locator("main tbody tr").filter({ hasText: name });
  await row.getByRole("button", { name: "Previzualizare", exact: true }).click();
  await expect(page.locator("[data-preview]")).toHaveCount(0, { timeout: 15_000 });
  await expect(row.getByRole("button", { name: "Previzualizare", exact: true })).toHaveAttribute("aria-pressed", "false");
}

/**
 * Slice #38.72: the eye, „Incursiune", on one list. The row reads magnifier, eye, arrow; with a preview open,
 * the eye shows the object's tile beside the list — `inner` finds the reused tile in it. #39.04: the preview stays
 * and its magnifier stays pressed; the tile is 40 rem wide (±2 px) at 1366 and 1920 px — it read „filling the row to
 * the content area's right edge (±8 px), the preview closed and every magnifier disabled". The eye again closes it;
 * the magnifier then closes the preview. A picture at each width (the spec's own records only).
 */
async function peek(page: Page, list: string, name: string, kind: string, inner: (tile: Locator) => Locator, shot: string): Promise<void> {
  await page.goto(list);
  const main = page.locator("main");
  const search = main.locator('input[placeholder^="caută"]').first();
  await expect(search).toBeVisible({ timeout: 30_000 });
  await search.fill(MARK);
  const row = main.locator("tbody tr").filter({ hasText: name });
  await expect(row).toHaveCount(1, { timeout: 30_000 });
  const actions = row.locator("[data-row-actions]").locator("a, button");
  await expect(actions.nth(0)).toHaveAccessibleName("Previzualizare");
  await expect(actions.nth(1)).toHaveAccessibleName("Incursiune");
  // Slice #38.76: the chain link between the eye and the arrow (#38.72 read „Deschide" third).
  await expect(actions.nth(2)).toHaveAccessibleName("Legături");
  await expect(actions.nth(3)).toHaveAccessibleName("Deschide");
  // …and all three inside the table's frame, none cut at its edge.
  const cut = await row.evaluate((r) => {
    const frame = r.closest("table")!.parentElement!.getBoundingClientRect();
    return [...r.querySelectorAll<HTMLElement>("[data-row-actions] a, [data-row-actions] button")].filter((b) => b.getBoundingClientRect().right > frame.right + 0.5).length;
  });
  expect(cut, `${list}: buttons cut at the table's edge`).toBe(0);
  const magnifier = row.getByRole("button", { name: "Previzualizare", exact: true });
  const eye = row.getByRole("button", { name: "Incursiune", exact: true });
  await magnifier.click();
  await expect(page.locator("[data-preview]")).toHaveCount(1, { timeout: 30_000 });
  await eye.click();
  const tile = page.locator(`[data-incursion="${kind}"]`);
  await expect(tile).toBeVisible({ timeout: 30_000 });
  await expect(inner(tile)).toBeVisible({ timeout: 30_000 });
  await expect(eye).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-preview]")).toHaveCount(1);
  await expect(magnifier).toBeEnabled();
  await expect(magnifier).toHaveAttribute("aria-pressed", "true");
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(400);
    const off = await page.evaluate((k) => {
      const px = 40 * parseFloat(getComputedStyle(document.documentElement).fontSize);
      return document.querySelector(`[data-incursion="${k}"]`)!.getBoundingClientRect().width - px;
    }, kind);
    expect(Math.abs(off), `${list} at ${width}: the tile is ${off} px off 40 rem`).toBeLessThanOrEqual(2);
    await page.screenshot({ path: `playwright-report/incursion/${shot}-${width}.png` });
  }
  await page.setViewportSize({ width: 1366, height: 900 });
  await eye.click();
  await expect(tile).toHaveCount(0);
  await expect(eye).toHaveAttribute("aria-pressed", "false");
  await magnifier.click();
  await expect(page.locator("[data-preview]")).toHaveCount(0);
  await expect(magnifier).toHaveAttribute("aria-pressed", "false");
}

/**
 * Slice #39.04 — step 7: a row's three toggles on one list. The eye, then the magnifier, then the chain link: all
 * three pressed; the column reads „Previzualizare", „Legături", „Incursiune" top to bottom, each 40 rem (±2 px) at
 * 1366 and 1920 px; `other`'s three are disabled, its „Deschide" not. Released one by one, every row is enabled
 * again. A picture at each width (the spec's own records only).
 */
async function three(page: Page, list: string, name: string, other: string, shot: string): Promise<void> {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(list);
  const main = page.locator("main");
  const search = main.locator('input[placeholder^="caută"]').first();
  await expect(search).toBeVisible({ timeout: 30_000 });
  await search.fill(MARK);
  const rowOf = (n: string) => main.locator("[data-list-edge] tbody tr").filter({ hasText: n });
  const row = rowOf(name);
  const second = rowOf(other);
  await expect(row).toHaveCount(1, { timeout: 30_000 });
  await expect(second).toHaveCount(1, { timeout: 30_000 });
  const THREE = ["Previzualizare", "Incursiune", "Legături"] as const;
  const button = (r: Locator, n: string) => r.getByRole("button", { name: n, exact: true });
  for (const n of ["Incursiune", "Previzualizare", "Legături"]) await button(row, n).click();
  for (const n of THREE) await expect(button(row, n), `${list}: ${n} pressed`).toHaveAttribute("aria-pressed", "true");
  const column = page.locator("[data-list-row-tiles]");
  await expect(column.locator(":scope > *")).toHaveCount(3, { timeout: 30_000 });
  await expect(column.locator("[data-preview] [data-preview-head]")).toBeVisible({ timeout: 30_000 });
  const order = await column.evaluate((c) => [...c.children].map((k) => (k.hasAttribute("data-preview") ? "preview" : k.getAttribute("data-incursion-view"))));
  expect(order, `${list}: the column's order`).toEqual(["preview", "links", "peek"]);
  for (const n of THREE) {
    await expect(button(second, n), `${list}: another row's ${n}`).toBeDisabled();
    await expect(button(second, n)).toHaveAttribute("aria-pressed", "false");
  }
  await expect(second.getByRole("link", { name: "Deschide", exact: true })).toBeVisible();
  await expect(second.getByRole("link", { name: "Deschide", exact: true })).not.toHaveAttribute("aria-disabled", "true");
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(400);
    const off = await column.evaluate((c) => {
      const px = 40 * parseFloat(getComputedStyle(document.documentElement).fontSize);
      return [...c.children].map((k) => Math.round((k.getBoundingClientRect().width - px) * 10) / 10);
    });
    for (const o of off) expect(Math.abs(o), `${list} at ${width}: a tile ${o} px off 40 rem`).toBeLessThanOrEqual(2);
    await page.mouse.move(1, 1);
    await page.screenshot({ path: `playwright-report/row-tiles/${shot}-${width}.png` });
  }
  await page.setViewportSize({ width: 1366, height: 900 });
  for (const n of ["Legături", "Previzualizare", "Incursiune"]) await button(row, n).click();
  await expect(column).toHaveCount(0);
  for (const r of [row, second]) for (const n of THREE) await expect(button(r, n)).toBeEnabled();
}

/** A compact line's values, as read: the values' own text, not their read-aloud labels. */
async function linesOf(tile: Locator): Promise<string[]> {
  return tile.evaluate((el) => [...el.querySelectorAll("[data-preview-line]")].map((l) =>
    [...l.querySelectorAll("[data-preview-value]")]
      .map((v) => [...v.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join(""))
      .join("")));
}

/** The labelled fields, row by row, as „Label=value". */
async function rowsOf(tile: Locator): Promise<string[][]> {
  return tile.evaluate((el) => [...el.querySelectorAll("[data-preview-fields] > div")].map((r) =>
    [...r.children].map((f) => `${f.children[0]?.textContent}=${f.children[1]?.textContent}`)));
}

test.describe("TC-TILES-11 — cele patru previzualizări", () => {
  test("„născută:”, „(2 contacte)”, cele trei rânduri ale proprietății, actul fără „Tip document”", async ({ page }) => {
    test.slow();
    // A run that died before its `finally` leaves its records; they would be a second match here.
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const c1 = await createNaturalPerson(page.request, { lastName: `${MARK} Contact`, firstName: "Unu" });
    const c2 = await createNaturalPerson(page.request, { lastName: `${MARK} Contact`, firstName: "Doi" });
    const person = await createNaturalPerson(page.request, {
      lastName: MARK, firstName: "Ioana", gender: "FEMALE", nickname: "Ioni", dateOfBirth: "1960-03-12", placeOfBirth: "Bragadiru",
    });
    const res = await page.request.post("/api/judicial-persons", {
      data: { name: `${MARK} Firmă SRL`, nickname: "Firma", contactPerson1Id: c1, contactPerson2Id: c2, provenance: "MANUAL" },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    const company = ((await res.json()) as { person: { id: string } }).person.id;
    const tarla = ((await (await page.request.get("/api/admin/value-lists/tarla")).json()) as { items: { id: string; indicativ: string }[] }).items[0];
    const property = await createProperty(page.request, { nickname: `${MARK} Teren`, parcela: "77/1", tarlaId: tarla.id, surfaceAreaMp: 1234 });
    const doc = await createDocumentOfType(page.request, "ADEVERINTA", `${MARK} Act`, {
      subject: "Adeverință de rol fiscal", nrDocument: "123/2020", dateDocument: "2020-05-04",
    });
    // Slice #39.04: step 7's second row on each list — names holding none of the first's words.
    const company2 = await createCompany(page.request, { name: `${MARK} Societate Doi` });
    const property2 = await createProperty(page.request, { nickname: `${MARK} Livadă` });
    const doc2 = await createDocumentOfType(page.request, "ADEVERINTA", `${MARK} Adeverință Doi`);
    try {
      // Step 1 — the person: „Ioni" and „născută: 12.03.1960, Bragadiru".
      const p = await preview(page, "/natural-persons", "Ioana");
      await expect(p.locator("h2")).toHaveText(`${MARK} Ioana`);
      await expect.poll(() => linesOf(p)).toEqual(["Ioni", "născută: 12.03.1960, Bragadiru"]);
      await closeByMagnifier(page, "Ioana");

      // Step 2 — the company: „(2 contacte)" after its name, then „Firma".
      const c = await preview(page, "/judicial-persons", "Firmă");
      await expect(c.locator("h2")).toHaveText(`${MARK} Firmă SRL`);
      await expect(c.locator("[data-preview-title-note]")).toHaveText("(2 contacte)");
      await expect.poll(() => linesOf(c)).toEqual(["Firma"]);
      await closeByMagnifier(page, "Firmă");

      // Step 3 — the property's three rows.
      const r = await preview(page, "/properties", "Teren");
      await expect(r.locator("h2")).toHaveText(`${MARK} Teren`);
      await expect.poll(() => rowsOf(r)).toEqual([
        ["Nr. parcelă=77/1", `Tarla/Solă=${tarla.indicativ}`, "Suprafață (mp)=1234.00"],
        [`Poreclă=${MARK} Teren`],
        ["Carte funciară=—", "Nr. cadastral=—"],
      ]);
      await closeByMagnifier(page, "Teren");

      // Step 4 — the document: no „Tip document", no „Etichetă scurtă"; one row; „Prima pagină".
      const d = await preview(page, "/documents", "Act");
      await expect(d.locator("h2")).toHaveText(`${MARK} Act`);
      await expect.poll(() => rowsOf(d)).toEqual([["Subiect=Adeverință de rol fiscal", "Nr. document=123/2020", "Data=04.05.2020"]]);
      await expect(d).not.toContainText("Tip document");
      await expect(d).not.toContainText("Etichetă scurtă");
      await expect(d.getByText("Prima pagină", { exact: true })).toBeVisible();
      await page.screenshot({ path: "playwright-report/magnifier/documents-pressed-1366.png" });
      await closeByMagnifier(page, "Act");

      // Step 6 — (#38.72) „Incursiune" on each of the four lists: its tile beside the list, filling the row.
      await peek(page, "/natural-persons", "Ioana", "person", (t) => t.locator('[data-tile="interactions"]'), "natural-persons");
      await peek(page, "/judicial-persons", "Firmă", "company", (t) => t.locator('[data-tile="interactions"]'), "judicial-persons");
      await peek(page, "/properties", "Teren", "property", (t) => t.locator("[data-incursion-map]"), "properties");
      await peek(page, "/documents", "Act", "document", (t) => t.locator('section[aria-label="Pagini"]'), "documents");
      // In peek mode „Pagini" offers no write: no „+ Adaugă pagină", no turn, no „Salvează".
      // (Read on the open tile, below, where the documents' Incursiune is opened again.)

      // Step 7 — (#39.04) a row's three toggles: any combination, one column, the other rows locked. It read: „one at
      // a time: on Persoane Fizice, another row's eye moves it there".
      await three(page, "/natural-persons", "Ioana", "Unu", "natural-persons");
      await three(page, "/judicial-persons", "Firmă", "Societate Doi", "judicial-persons");
      await three(page, "/properties", "Teren", "Livadă", "properties");
      await three(page, "/documents", `${MARK} Act`, "Adeverință Doi", "documents");

      // Step 8 — the documents' Incursiune draws no write.
      await page.goto("/documents");
      const dsearch = page.locator("main").locator('input[placeholder^="caută"]').first();
      await expect(dsearch).toBeVisible({ timeout: 30_000 });
      await dsearch.fill(MARK);
      const docRow = page.locator("main tbody tr").filter({ hasText: `${MARK} Act` });
      await expect(docRow).toHaveCount(1, { timeout: 30_000 });
      await docRow.getByRole("button", { name: "Incursiune", exact: true }).click();
      const pagesTile = page.locator('[data-incursion="document"]');
      await expect(pagesTile.locator('section[aria-label="Pagini"]')).toBeVisible({ timeout: 30_000 });
      await expect(pagesTile.getByRole("button", { name: "+ Adaugă pagină" })).toHaveCount(0);
      await expect(pagesTile.locator("[data-page-turn]")).toHaveCount(0);
      // Slice #38.82 — the scan three quarters of the panel's width, the list a quarter (of the two, side by side):
      // the list at most 26 %, the viewer at least 74 %, at 1366 and 1920 px. A page with a 32-character name is shown
      // cut at 20 and „…", whole in its tooltip; no Notes column, no arrow, no pen.
      const up = await page.request.post(`/api/documents/${doc}/pages`, {
        multipart: {
          file: { name: "tc-e2e-pagina.png", mimeType: "image/png", buffer: fs.readFileSync(path.join(process.cwd(), "e2e", "fixtures", "tc-e2e-pagina.png")) },
          pageNumber: "1",
          pageName: "Plan de amplasament, scara 1:500",
        },
      });
      expect(up.ok(), await up.text()).toBeTruthy();
      await page.reload();
      const reopened = page.locator("main [data-list-edge] tbody tr").filter({ hasText: `${MARK} Act` });
      await expect(page.locator("main").locator('input[placeholder^="caută"]').first()).toBeVisible({ timeout: 30_000 });
      await page.locator("main").locator('input[placeholder^="caută"]').first().fill(MARK);
      await expect(reopened).toHaveCount(1, { timeout: 30_000 });
      // #39.26: the reload keeps the view — the address held the open Incursiune, so it is open again (it read
      // `await reopened.getByRole("button", { name: "Incursiune", exact: true }).click();`, which now closes it).
      await expect(reopened.getByRole("button", { name: "Incursiune", exact: true })).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });
      const peekPages = page.locator('[data-incursion="document"] section[aria-label="Pagini"]');
      const nameCell = peekPages.locator("[data-page-name]").first();
      await expect(nameCell).toHaveText("Plan de amplasament,…", { timeout: 30_000 });
      await expect(nameCell).toHaveAttribute("title", "Plan de amplasament, scara 1:500");
      await expect(peekPages.locator("thead th")).toHaveText(["Nr.", "Denumire pagină", "Acțiuni"]);
      await expect(peekPages.getByRole("button", { name: "Vizualizare", exact: true })).toHaveCount(0);
      await expect(peekPages.getByRole("button", { name: "Notițe pagină", exact: true })).toHaveCount(0);
      await expect(peekPages.getByRole("button", { name: "Tipărire", exact: true })).toHaveCount(1);
      for (const width of [1366, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        await page.waitForTimeout(400);
        const split = await peekPages.evaluate((sec) => {
          const viewer = sec.querySelector<HTMLElement>(".min-h-\\[320px\\]")!.parentElement!.getBoundingClientRect().width;
          const list = sec.querySelector<HTMLElement>("table")!.closest<HTMLElement>("div.order-1")!.getBoundingClientRect().width;
          return { viewer: viewer / (viewer + list), list: list / (viewer + list) };
        });
        expect(split.list, `the list's share at ${width}`).toBeLessThanOrEqual(0.26);
        expect(split.viewer, `the viewer's share at ${width}`).toBeGreaterThanOrEqual(0.74);
        if (width === 1366) {
          await page.locator('[data-incursion="document"]').evaluate((el) => el.scrollIntoView({ block: "nearest" }));
          await page.mouse.move(1, 1);
          await page.screenshot({ path: "playwright-report/incursion/documents-pages-1366.png" });
        }
      }
      await page.setViewportSize({ width: 1366, height: 900 });
    } finally {
      for (const [k, id] of [["document", doc], ["document", doc2], ["property", property], ["property", property2], ["company", company], ["company", company2], ["person", person], ["person", c1], ["person", c2]] as const) {
        await removeRecord(page.request, k, id);
      }
    }
  });
});

// ── Step 9 (Slice #38.75): the Incursiune as tall as the list, in its own purple ─────────────────────────────

type Box = { top: number; bottom: number; height: number };
type Measure = { list: Box; tile: Box; wrapped: boolean; surface: string; pinned: string; card: string };

/** The list's body (toolbar to pagination) and the Incursiune beside it; the reused tile's fill and the two fills it may wear. */
async function measure(page: Page): Promise<Measure> {
  return page.evaluate(() => {
    const box = (el: Element): Box => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, height: r.height };
    };
    const list = box(document.querySelector("[data-list-body]")!);
    const tile = box(document.querySelector("[data-incursion]")!);
    const fill = (cls: string) => {
      const probe = document.createElement("div");
      probe.className = cls;
      document.body.append(probe);
      const c = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return c;
    };
    return {
      list,
      tile,
      wrapped: tile.top >= list.bottom - 1,
      surface: getComputedStyle(document.querySelector("[data-incursion] > section")!).backgroundColor,
      pinned: fill("bg-card-pinned"),
      card: fill("bg-card"),
    };
  });
}

/**
 * The list's own rows — inside its frame. Not `main tbody tr`: the Incursiune beside it holds tables of its own
 * (Google Maps' hidden keyboard-shortcuts table under „Hartă", measured: 25 rows for 15; the pages under „Pagini").
 */
const listRows = (page: Page) => page.locator("main [data-list-body] [data-list-edge] tbody tr");

/** Searches the list and waits for `rows` rows. */
async function searchFor(page: Page, text: string, rows: number): Promise<void> {
  const main = page.locator("main");
  await main.locator('input[placeholder^="caută"]').first().fill(text);
  await expect(listRows(page)).toHaveCount(rows, { timeout: 30_000 });
  await page.waitForTimeout(400); // the tile's own read (the map's corners, the pages) settles
}

/**
 * On one list: one row (shorter than the tile) and a full page (taller), at 1920 and 1366 px. Beside the list,
 * the tile's top is the list's; with one row it keeps its own height and the list is not stretched; with a page
 * its bottom is the list's (±2 px). Under the list (a window too narrow for both) it keeps its own height.
 */
async function asTall(page: Page, list: string, kind: string, shot: string): Promise<void> {
  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.goto(list);
  await expect(page.locator("main").locator('input[placeholder^="caută"]').first()).toBeVisible({ timeout: 30_000 });
  const one = `${TALL} Rând 01`;
  await searchFor(page, one, 1);
  const before = await page.locator("[data-list-body]").evaluate((el) => el.getBoundingClientRect().height);
  await listRows(page).first().getByRole("button", { name: "Incursiune", exact: true }).click();
  await expect(page.locator(`[data-incursion="${kind}"] > section`)).toBeVisible({ timeout: 30_000 });
  for (const width of [1920, 1366]) {
    await page.setViewportSize({ width, height: 1000 });
    await searchFor(page, one, 1);
    const short = await measure(page);
    const at = `${list} at ${width}`;
    // #39.25: on the persons' lists the eye's tile is „Interacțiuni”, which is as tall as its rows now — these records
    // have none, so it is the row's preview's height, beside the list or under it, however long the list. „Hartă” and
    // „Pagini” keep #38.75's rule, below.
    if (kind === "person" || kind === "company") {
      expect(Math.abs(short.tile.height - rowTileMinPx(kind)), `${at}, one row: an empty „Interacțiuni” is the preview's height`).toBeLessThanOrEqual(2);
      if (!short.wrapped) expect(Math.abs(short.tile.top - short.list.top), `${at}, one row: tops`).toBeLessThanOrEqual(2);
      await searchFor(page, TALL, PAGE);
      const tall = await measure(page);
      expect(Math.abs(tall.tile.height - rowTileMinPx(kind)), `${at}, a page: still the preview's height`).toBeLessThanOrEqual(2);
      expect(tall.surface, `${at}: the tile's fill is the pinned purple`).toBe(tall.pinned);
      if (tall.wrapped) await page.locator("[data-incursion]").evaluate((el) => el.scrollIntoView({ block: "end" }));
      await page.mouse.move(1, 1);
      await page.screenshot({ path: `playwright-report/incursion-height/${shot}-${width}.png` });
      continue;
    }
    expect(short.surface, `${at}: the tile's fill is the pinned purple`).toBe(short.pinned);
    expect(short.surface, `${at}: not the card's grey-blue`).not.toBe(short.card);
    if (width === 1920) {
      expect(short.wrapped, `${at}: the tile stands beside the list`).toBe(false);
      expect(Math.abs(short.list.height - before), `${at}: the one-row list was stretched`).toBeLessThanOrEqual(1);
    }
    if (!short.wrapped) {
      expect(Math.abs(short.tile.top - short.list.top), `${at}, one row: tops`).toBeLessThanOrEqual(2);
      // Its own height, or the list's where that is taller: never shorter than the list. (#38.75's first check said
      // „taller than the list" — but „Pagini" of a document with no page is about one row's list tall: measured 360
      // against 360 at 1920 px in full 20261010T183342Z-8518; the list was not stretched, which is checked above.)
      expect(short.tile.bottom, `${at}, one row: the tile keeps its own height`).toBeGreaterThanOrEqual(short.list.bottom - 2);
    }
    await searchFor(page, TALL, PAGE);
    const tall = await measure(page);
    if (tall.wrapped) {
      // Under the list: its own height, whatever the list's.
      expect(Math.abs(tall.tile.height - short.tile.height), `${at}, under the list: its own height`).toBeLessThanOrEqual(2);
    } else {
      expect(tall.list.height, `${at}: a page of rows is taller than the tile's own height`).toBeGreaterThan(short.tile.height);
      expect(Math.abs(tall.tile.top - tall.list.top), `${at}: tops ${tall.tile.top} / ${tall.list.top}`).toBeLessThanOrEqual(2);
      expect(Math.abs(tall.tile.bottom - tall.list.bottom), `${at}: bottoms ${tall.tile.bottom} / ${tall.list.bottom}`).toBeLessThanOrEqual(2);
    }
    expect(tall.surface, `${at}: the tile's fill is the pinned purple`).toBe(tall.pinned);
    // The spec's own records only: nothing in the picture identifies anyone. A tile under the list is scrolled
    // into the picture (the page scrolls inside the layout, so `fullPage` stops at the window); the pointer off the
    // rows, so the eye's tooltip does not cover the list.
    if (tall.wrapped) await page.locator("[data-incursion]").evaluate((el) => el.scrollIntoView({ block: "end" }));
    await page.mouse.move(1, 1);
    await page.screenshot({ path: `playwright-report/incursion-height/${shot}-${width}.png` });
  }
}

test.describe("TC-TILES-11 — the Incursiune as tall as the list (#38.75)", () => {
  test("step 9: on the four lists, level with the list's top and bottom, in the pinned purple", async ({ page }) => {
    test.slow();
    for (let i = 0; i < 4; i++) await removeLeftovers(page.request, TALL); // the search answers a page at a time
    const made: [RecordKind, string][] = [];
    try {
      for (let n = 1; n <= PAGE; n++) {
        const name = `${TALL} Rând ${String(n).padStart(2, "0")}`;
        made.push(["person", await createNaturalPerson(page.request, { lastName: name, firstName: "Test" })]);
        made.push(["company", await createCompany(page.request, { name })]);
        made.push(["property", await createProperty(page.request, { nickname: name })]);
        made.push(["document", await createDocumentOfType(page.request, "ADEVERINTA", name)]);
      }
      await asTall(page, "/natural-persons", "person", "natural-persons");
      await asTall(page, "/judicial-persons", "company", "judicial-persons");
      await asTall(page, "/properties", "property", "properties");
      await asTall(page, "/documents", "document", "documents");
    } finally {
      for (const [kind, id] of made) await removeRecord(page.request, kind, id);
    }
  });
});

// ── Step 10 (Slice #38.76): the chain link shows „Legături” beside the list, read-only, in green ─────────────

/** Step 10's own records and links. Its own marker: neither holds `MARK` or `TALL`, nor is held by them. */
const LINKS = `${E2E_MARKER}LEGATURI-10`;

/** The fill of an element and of a probe wearing `cls`. */
async function fills(page: Page, selector: string, cls: string): Promise<[string, string]> {
  return page.evaluate(([sel, c]) => {
    const probe = document.createElement("div");
    probe.className = c;
    document.body.append(probe);
    const want = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return [getComputedStyle(document.querySelector(sel)!).backgroundColor, want];
  }, [selector, cls] as const);
}

/**
 * On one list: the row reads magnifier, eye, chain link, arrow, inside its frame; the chain link shows the object's
 * „Legături” — `rows` related rows, no radio, no „Asociază”, no „Dezasociază”, no share — in the related green,
 * pressed. #39.04: the row's preview stays open beside it; the eye after it opens its own tile UNDER it (it read „an
 * eye after it closes it, and the chain link after the eye"); the chain link again closes „Legături" alone.
 */
async function links(page: Page, list: string, name: string, kind: string, rows: number, shot: string): Promise<void> {
  await page.setViewportSize({ width: 1366, height: 1000 });
  await page.goto(list);
  const main = page.locator("main");
  const search = main.locator('input[placeholder^="caută"]').first();
  await expect(search).toBeVisible({ timeout: 30_000 });
  await search.fill(LINKS);
  const row = main.locator("[data-list-edge] tbody tr").filter({ hasText: name });
  await expect(row).toHaveCount(1, { timeout: 30_000 });
  const actions = row.locator("[data-row-actions]").locator("a, button");
  await expect(actions).toHaveCount(4);
  for (const [i, n] of ["Previzualizare", "Incursiune", "Legături", "Deschide"].entries()) await expect(actions.nth(i)).toHaveAccessibleName(n);
  const cut = await row.evaluate((r) => {
    const frame = r.closest("table")!.parentElement!.getBoundingClientRect();
    return [...r.querySelectorAll<HTMLElement>("[data-row-actions] a, [data-row-actions] button")].filter((b) => b.getBoundingClientRect().right > frame.right + 0.5).length;
  });
  expect(cut, `${list}: buttons cut at the table's edge`).toBe(0);

  const magnifier = row.getByRole("button", { name: "Previzualizare", exact: true });
  const eye = row.getByRole("button", { name: "Incursiune", exact: true });
  const chain = row.getByRole("button", { name: "Legături", exact: true });
  await magnifier.click();
  await expect(page.locator("[data-preview]")).toHaveCount(1, { timeout: 30_000 });
  await chain.click();
  const tile = page.locator(`[data-incursion="${kind}"][data-incursion-view="links"]`);
  const inner = tile.locator('[data-tile="incursion-links"]');
  await expect(inner.locator("[data-one-line-row]")).toHaveCount(rows, { timeout: 30_000 });
  await expect(chain).toHaveAttribute("aria-pressed", "true");
  await expect(eye).toHaveAttribute("aria-pressed", "false");
  // #39.04: was „the preview closed, the magnifier disabled".
  await expect(page.locator("[data-preview]")).toHaveCount(1);
  await expect(magnifier).toHaveAttribute("aria-pressed", "true");
  // A look, not an edit.
  await expect(inner.locator('input[type="radio"]')).toHaveCount(0);
  await expect(inner.getByRole("button", { name: /^Asociază/ })).toHaveCount(0);
  await expect(inner.getByRole("button", { name: "Dezasociază" })).toHaveCount(0);
  await expect(inner.locator("[data-share-button]")).toHaveCount(0);
  // The green its screen gives it — the tile and, calmer, its rows.
  const [tileFill, related] = await fills(page, `[data-incursion-view="links"] [data-tile="incursion-links"]`, "bg-card-related");
  expect(tileFill, `${list}: „Legături” in the related green`).toBe(related);
  const [rowsFill, relatedRow] = await fills(page, `[data-incursion-view="links"] [data-related-rows]`, "bg-card-related-row");
  expect(rowsFill, `${list}: its rows in the rows' green`).toBe(relatedRow);
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForTimeout(400);
    // The spec's own records only: nothing in the picture identifies anyone.
    await page.locator("[data-incursion]").evaluate((el) => el.scrollIntoView({ block: "nearest" }));
    await page.mouse.move(1, 1);
    await page.screenshot({ path: `playwright-report/legaturi/${shot}-${width}.png` });
  }
  await page.setViewportSize({ width: 1366, height: 1000 });

  // #39.04 — independent of the eye: the eye opens its tile under „Legături", both pressed; the chain link again
  // closes „Legături" alone; the eye and the magnifier close the rest. (#38.76 read: one choice with the eye.)
  await eye.click();
  const views = page.locator("[data-list-row-tiles] [data-incursion]");
  await expect(views).toHaveCount(2, { timeout: 30_000 });
  expect(await views.evaluateAll((els) => els.map((e) => e.getAttribute("data-incursion-view")))).toEqual(["links", "peek"]);
  await expect(eye).toHaveAttribute("aria-pressed", "true");
  await expect(chain).toHaveAttribute("aria-pressed", "true");
  await chain.click();
  await expect(tile).toHaveCount(0);
  await expect(views).toHaveCount(1);
  await expect(chain).toHaveAttribute("aria-pressed", "false");
  await eye.click();
  await magnifier.click();
  await expect(page.locator("[data-list-row-tiles]")).toHaveCount(0);
  for (const b of [magnifier, eye, chain]) await expect(b).toHaveAttribute("aria-pressed", "false");
}

test.describe("TC-TILES-11 — the chain link shows „Legături” (#38.76)", () => {
  test("step 10: on the four lists, the object's „Legături” beside the list, read-only, in green, beside the eye's tile", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, LINKS);
    const made: [RecordKind, string][] = [];
    try {
      const person = await createNaturalPerson(page.request, { lastName: LINKS, firstName: "Ana" });
      made.push(["person", person]);
      const company = await createCompany(page.request, { name: `${LINKS} Firmă` });
      made.push(["company", company]);
      const property = await createProperty(page.request, { nickname: `${LINKS} Teren` });
      made.push(["property", property]);
      const doc = await createDocumentOfType(page.request, "ADEVERINTA", `${LINKS} Act`);
      made.unshift(["document", doc]); // removed first, with its links
      for (const [url, data] of [
        [`/api/documents/${doc}/persons`, { personIds: [person, company] }],
        [`/api/documents/${doc}/properties`, { propertyIds: [property] }],
      ] as const) {
        const res = await page.request.post(url, { data });
        expect(res.ok(), `POST ${url}: ${res.status()} ${await res.text()}`).toBeTruthy();
      }
      await links(page, "/natural-persons", "Ana", "person", 1, "natural-persons");
      await links(page, "/judicial-persons", "Firmă", "company", 1, "judicial-persons");
      await links(page, "/properties", "Teren", "property", 1, "properties");
      await links(page, "/documents", "Act", "document", 3, "documents");
    } finally {
      for (const [kind, id] of made) await removeRecord(page.request, kind, id);
    }
  });
});

// ── Step 11 (Slice #39.25): „Legături” beside the list — no head bar, „Închide” on its line, as tall as its rows ─────

/** Step 11's own records. Its own marker, which neither holds the others' nor is held by them. */
const ROWS = `${E2E_MARKER}LEGATURI-H`;

/** Opens the chain link on the row holding `name` and reads the tile. */
async function linksTile(page: Page, list: string, name: string) {
  await page.goto(list);
  const search = page.locator("main").locator('input[placeholder^="caută"]').first();
  await expect(search).toBeVisible({ timeout: 30_000 });
  await search.fill(name);
  const row = page.locator("main [data-list-body] [data-list-edge] tbody tr").filter({ hasText: name });
  // The search is debounced: wait for the list to narrow to the one row, not just for the row — a press made while
  // the page re-renders is lost (TC-DOC-24 met the same, 20261011T011204Z-4538) — and press again until it shows.
  await expect(listRows(page)).toHaveCount(1, { timeout: 30_000 });
  await expect(row).toHaveCount(1, { timeout: 30_000 });
  const tile = page.locator('[data-incursion-view="links"]');
  await expect(async () => {
    const chain = row.getByRole("button", { name: "Legături", exact: true });
    if ((await chain.getAttribute("aria-pressed")) !== "true") await chain.click();
    await expect(tile.locator('[data-tile="incursion-links"]')).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 30_000 });
  await page.waitForTimeout(800); // the rows' read settles
  return { row, tile };
}

async function linksReading(page: Page) {
  return page.locator('[data-incursion-view="links"]').evaluate((el) => {
    const inner = el.querySelector<HTMLElement>("[data-incursion-links]")!;
    return {
      height: Math.round(el.getBoundingClientRect().height),
      rows: el.querySelectorAll("[data-one-line-row]").length,
      scrolls: inner.scrollHeight > inner.clientHeight + 1,
      bars: el.querySelectorAll("[data-incursion-head]").length,
      head: el.querySelector("[data-incursion-head] h2")!.textContent,
      buttons: [...el.querySelectorAll<HTMLElement>("a, button")].map((b) => (b.getAttribute("aria-label") ?? b.textContent ?? "").trim()),
      // The tile's own head line is its first child: nothing above it inside the section.
      headFirst: el.firstElementChild!.firstElementChild!.hasAttribute("data-incursion-head"),
    };
  });
}

test.describe("TC-TILES-11 — „Legături” beside the list, as tall as its rows (#39.25)", () => {
  test("step 11: empty, the preview's height; two rows, theirs; sixteen, the ceiling, scrolling; „Închide” on the tile's line", async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1920, height: 1000 });
    await removeLeftovers(page.request, ROWS);
    const made: [RecordKind, string][] = [];
    try {
      const alone = await createNaturalPerson(page.request, { lastName: `${ROWS} Singur`, firstName: "Ion" });
      made.push(["person", alone]);
      const people: string[] = [];
      for (let n = 1; n <= 16; n++) {
        const id = await createNaturalPerson(page.request, { lastName: `${ROWS} Parte ${String(n).padStart(2, "0")}`, firstName: "Ana" });
        people.push(id);
        made.push(["person", id]);
      }
      const two = await createDocumentOfType(page.request, "ADEVERINTA", `${ROWS} Act doi`);
      const many = await createDocumentOfType(page.request, "ADEVERINTA", `${ROWS} Act multe`);
      made.unshift(["document", two], ["document", many]); // removed first, with their links
      for (const [doc, ids] of [[two, people.slice(0, 2)], [many, people]] as const) {
        const res = await page.request.post(`/api/documents/${doc}/persons`, { data: { personIds: ids } });
        expect(res.ok(), `POST /api/documents/${doc}/persons: ${res.status()} ${await res.text()}`).toBeTruthy();
      }

      // Empty: the row's preview's height; the bar gone, „Închide” on the tile's line, no „Deschide”.
      const empty = await linksTile(page, "/natural-persons", `${ROWS} Singur`);
      const e = await linksReading(page);
      expect({ rows: e.rows, bars: e.bars, headFirst: e.headFirst, buttons: e.buttons })
        .toEqual({ rows: 0, bars: 1, headFirst: true, buttons: ["Închide"] });
      expect(e.head).toMatch(/^Legături— .*Singur/);
      expect(Math.abs(e.height - rowTileMinPx("person")), `empty: ${e.height} px`).toBeLessThanOrEqual(2);
      await page.mouse.move(1, 1);
      await page.screenshot({ path: "playwright-report/legaturi-height/empty-1920.png" });
      await empty.tile.getByRole("button", { name: "Închide", exact: true }).click();
      await expect(empty.tile).toHaveCount(0);
      await expect(empty.row.getByRole("button", { name: "Legături", exact: true })).toHaveAttribute("aria-pressed", "false");

      // Two rows: their own height — under the ceiling, nothing to scroll; no disabled „Previzualizare”.
      await linksTile(page, "/documents", `${ROWS} Act doi`);
      const t = await linksReading(page);
      expect({ rows: t.rows, scrolls: t.scrolls }).toEqual({ rows: 2, scrolls: false });
      expect(t.buttons.filter((b) => b === "Previzualizare" || b === "Deschide")).toEqual([]);
      expect(t.buttons.filter((b) => b === "Vizualizare")).toHaveLength(2);
      expect(t.height, `two rows: ${t.height} px`).toBeLessThan(ROW_TILE_CEILING_PX - 100);
      await page.mouse.move(1, 1);
      await page.screenshot({ path: "playwright-report/legaturi-height/two-1920.png" });

      // Sixteen: the ceiling, the rows scrolling inside.
      await linksTile(page, "/documents", `${ROWS} Act multe`);
      const m = await linksReading(page);
      expect({ rows: m.rows, scrolls: m.scrolls }).toEqual({ rows: 16, scrolls: true });
      expect(Math.abs(m.height - ROW_TILE_CEILING_PX), `sixteen rows: ${m.height} px`).toBeLessThanOrEqual(1);
      await page.mouse.move(1, 1);
      await page.screenshot({ path: "playwright-report/legaturi-height/many-1920.png" });
    } finally {
      for (const [kind, id] of made) await removeRecord(page.request, kind, id);
    }
  });
});

// ── Step 12 (Slice #39.26): Back from a record returns to the list exactly as it was, open tiles included ───────────

/** Step 12's own records. Its own marker, which neither holds the others' nor is held by them. */
const BACK = `${E2E_MARKER}INAPOI-12`;

/** What step 12 reads off a list: its search, the tiles' column, the row's pressed buttons, the page's scroll. */
async function listState(page: Page, name: string) {
  return page.evaluate((n) => {
    const row = [...document.querySelectorAll<HTMLTableRowElement>("main [data-list-body] [data-list-edge] tbody tr")].find((r) => (r.textContent ?? "").includes(n));
    return {
      search: document.querySelector<HTMLInputElement>('main input[placeholder^="caută"]')?.value ?? null,
      column: [...(document.querySelector("[data-list-row-tiles]")?.children ?? [])].map((c) =>
        c.hasAttribute("data-preview") ? "preview" : c.getAttribute("data-incursion-view"),
      ),
      pressed: row ? [...row.querySelectorAll('[aria-pressed="true"]')].map((b) => b.getAttribute("aria-label")) : null,
      scroll: Math.round(document.querySelector<HTMLElement>("[data-page-scroll]")!.scrollTop),
      // What the scroll is kept by — said in a failure's message, never compared.
      slot: (window as unknown as { navigation?: { currentEntry?: { key?: string } } }).navigation?.currentEntry?.key ?? null,
      memory: sessionStorage.getItem("ga:list-scroll"),
      max: Math.round(document.querySelector<HTMLElement>("[data-page-scroll]")!.scrollHeight - document.querySelector<HTMLElement>("[data-page-scroll]")!.clientHeight),
      load: (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.type ?? null,
      trace: JSON.stringify((window as unknown as { __gaScrollTrace?: unknown[] }).__gaScrollTrace ?? null),
    };
  }, name);
}

/**
 * On one list: the record's row searched, its tiles opened, the page scrolled; the row's „Deschide”, then back — by
 * the browser (`page.goBack()`, as its button, the mouse's and Alt+← do) or by the app's „Înapoi”. The list comes back
 * with the same search, the same tiles on the same row, the row on screen, and the same scroll (±2 px).
 */
async function roundTrip(page: Page, list: string, name: string, tiles: readonly string[], back: "browser" | "app"): Promise<void> {
  await page.goto(list);
  const search = page.locator("main").locator('input[placeholder^="caută"]').first();
  await expect(search).toBeVisible({ timeout: 30_000 });
  await search.fill(name);
  await expect(listRows(page)).toHaveCount(1, { timeout: 30_000 });
  const row = listRows(page).filter({ hasText: name });
  await expect(row).toHaveCount(1, { timeout: 30_000 });
  for (const t of tiles) {
    const b = row.getByRole("button", { name: t, exact: true });
    await expect(async () => {
      if ((await b.getAttribute("aria-pressed")) !== "true") await b.click();
      await expect(b).toHaveAttribute("aria-pressed", "true", { timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
  }
  await expect(page.locator("[data-list-row-tiles] > *")).toHaveCount(tiles.length, { timeout: 30_000 });
  await page.waitForTimeout(800); // the tiles' reads settle, so the page is as tall as it will be
  // A person's scroll — the wheel, over the page — so the list keeps it as it would Adrian's.
  await page.mouse.move(700, 300);
  await page.mouse.wheel(0, 2000);
  await page.waitForTimeout(400);
  const before = await listState(page, name);
  const address = new URL(page.url()).search;
  expect(address, `${list}: the view is in the address`).toContain("tiles=");

  await row.getByRole("link", { name: "Deschide", exact: true }).click();
  await expect(page).toHaveURL((u) => u.pathname.startsWith(`${list}/`), { timeout: 30_000 });
  await page.waitForTimeout(1_500);
  if (back === "browser") await page.goBack();
  else await page.locator("[data-breadcrumb-back]").getByRole("button", { name: "Înapoi", exact: true }).click();

  await expect(page).toHaveURL((u) => u.pathname === list && u.search === address, { timeout: 30_000 });
  await expect(page.locator("[data-list-row-tiles] > *")).toHaveCount(tiles.length, { timeout: 30_000 });
  await expect(row).toBeVisible({ timeout: 30_000 });
  // The scroll is put back once the page is tall enough for it — the tiles beside the list read their rows after it,
  // and the runner's dev server compiles a route on its first call — and held up to five seconds; so it is polled.
  await expect
    .poll(async () => Math.abs((await listState(page, name)).scroll - before.scroll), {
      timeout: 8_000,
      message: `${list}: the scroll comes back — before ${JSON.stringify(before)}, now ${JSON.stringify(await listState(page, name))}`,
    })
    .toBeLessThanOrEqual(2);
  const after = await listState(page, name);
  expect({ search: after.search, column: after.column, pressed: after.pressed }, `${list}: the list as it was left`).toEqual({
    search: before.search,
    column: before.column,
    pressed: before.pressed,
  });
  expect(Math.abs(after.scroll - before.scroll), `${list}: scroll ${before.scroll} → ${after.scroll}`).toBeLessThanOrEqual(2);
  await page.mouse.move(1, 1);
  await page.screenshot({ path: `playwright-report/back-keeps-list/${list.slice(1)}.png` });
}

test.describe("TC-TILES-11 — Back returns to the list as it was (#39.26)", () => {
  test("step 12: on the four lists, search, tiles and scroll come back after the record; from the menu the list opens clean", async ({ page }) => {
    test.slow();
    // Short, so the page scrolls with the tiles open beside the list.
    await page.setViewportSize({ width: 1366, height: 420 });
    await page.addInitScript(() => {
      (window as unknown as { __gaScrollTrace: unknown[] }).__gaScrollTrace = [];
    });
    await removeLeftovers(page.request, BACK);
    const made: [RecordKind, string][] = [];
    try {
      made.push(["person", await createNaturalPerson(page.request, { lastName: `${BACK} Popescu`, firstName: "Ion" })]);
      made.push(["company", await createCompany(page.request, { name: `${BACK} Firmă` })]);
      made.push(["property", await createProperty(page.request, { nickname: `${BACK} Teren` })]);
      made.push(["document", await createDocumentOfType(page.request, "ADEVERINTA", `${BACK} Act`)]);

      // Maps cost money (e2e/README.md): on Proprietăți the preview and „Legături”, never the eye's „Hartă”.
      await roundTrip(page, "/natural-persons", BACK, ["Previzualizare", "Legături", "Incursiune"], "browser");
      await roundTrip(page, "/judicial-persons", BACK, ["Previzualizare", "Legături", "Incursiune"], "browser");
      await roundTrip(page, "/properties", BACK, ["Previzualizare", "Legături"], "browser");
      await roundTrip(page, "/documents", BACK, ["Previzualizare", "Legături", "Incursiune"], "app");

      // From the menu, after the record: clean — no search, no tile, from the top (Ask first #2).
      await page.locator("nav").getByRole("link", { name: "Acte", exact: true }).click();
      await expect(page).toHaveURL((u) => u.pathname === "/documents" && u.search === "", { timeout: 30_000 });
      await expect(page.locator("main").locator('input[placeholder^="caută"]').first()).toHaveValue("", { timeout: 30_000 });
      await expect(page.locator("[data-list-row-tiles]")).toHaveCount(0);
    } finally {
      for (const [kind, id] of made) await removeRecord(page.request, kind, id);
    }
  });
});
