/**
 * Case:   TC-TILES-07 — Unde stau părțile la deschidere: pagina actului la dreapta; harta, colțurile și Street View ale proprietății într-o coloană la dreapta
 * Source: docs/testing/cases/TC-TILES-07.md, „Last green" 2026-10-02
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-TILES-07` (records.ts); the page is
 *     `e2e/fixtures/tc-e2e-pagina.png`, sent as „Pagini" sends it.
 *   - A fresh browser context has no stored choice, so nothing is set aside.
 *   - The window is set with `setViewportSize`: 1920 × 1080 for steps 1–5, and
 *     1366 for step 6, where the hand run could only narrow the content column.
 *   - Slice #37.56's pictures and its measurement, not steps of the case: both
 *     screens at 1920 and 1366 px into `playwright-report/tile-placement/`, the
 *     sidebar's „Recente" list painted over; and the narrowest window at which
 *     each screen's column still stands beside the left area, by a sweep of
 *     window widths, into `breakpoints.json` there.
 */

import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { E2E_MARKER, createProperty, createSaleContract, removeLeftovers, removeRecord } from "../helpers/records";
import { hideTile, showTile, tileBox } from "../helpers/tiles";

const MARK = `${E2E_MARKER}TILES-07`;
const SHOTS = "playwright-report/tile-placement";
const PAGE_FILE = path.join(process.cwd(), "e2e", "fixtures", "tc-e2e-pagina.png");

const recent = (page: Page) =>
  page.locator("aside div.border-t").filter({ has: page.getByRole("button", { name: /Recente/i }) });

/** A tile's box relative to the tile row: left, top, right edge's distance from the row's, bottom. */
async function at(page: Page, tile: string): Promise<{ x: number; y: number; re: number; bottom: number }> {
  return page.evaluate((name) => {
    const row = document.querySelector<HTMLElement>("[data-tile-row]")!.getBoundingClientRect();
    const r = document.querySelector<HTMLElement>(`[data-tile="${name}"]`)!.getBoundingClientRect();
    return { x: Math.round(r.left - row.left), y: Math.round(r.top - row.top), re: Math.round(row.right - r.right), bottom: Math.round(r.bottom - row.top) };
  }, tile);
}

const rowWidth = (page: Page) => page.evaluate(() => Math.round(document.querySelector<HTMLElement>("[data-tile-row]")!.getBoundingClientRect().width));
const columnShown = (page: Page) => page.evaluate(() => {
  const c = document.querySelector<HTMLElement>('[data-tile-area="right"]');
  return !!c && !c.hidden && c.getBoundingClientRect().width > 0;
});

async function settle(page: Page): Promise<void> {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
}

/** „At the right, top level with the row". */
async function atTheRight(page: Page, tile: string): Promise<void> {
  const p = await at(page, tile);
  expect([tile, Math.abs(p.re) <= 1, Math.abs(p.y) <= 1]).toEqual([tile, true, true]);
}

/** The narrowest window, in steps of 2 px from `from` to `to`, at which `tile` stands at the top right. */
async function narrowestBeside(page: Page, tile: string, from: number, to: number): Promise<number | null> {
  for (let w = from; w <= to; w += 2) {
    await page.setViewportSize({ width: w, height: 1080 });
    await settle(page);
    const p = await at(page, tile);
    if (Math.abs(p.y) <= 1 && Math.abs(p.re) <= 1) return w;
  }
  return null;
}

async function photograph(page: Page, name: string): Promise<void> {
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 1080 });
    await settle(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${SHOTS}/${name}-${width}.png`, fullPage: true, mask: [recent(page)] });
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
}

test.describe("TC-TILES-07 — unde stau părțile la deschidere", () => {
  test("pagina actului la dreapta; harta, colțurile și Street View într-o coloană la dreapta", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1920, height: 1080 });
    const made: { kind: "document" | "property"; id: string }[] = [];
    const breakpoints: Record<string, number | null> = {};
    try {
      const docId = await createSaleContract(page.request, `${MARK} Act de test`);
      made.push({ kind: "document", id: docId });
      const up = await page.request.post(`/api/documents/${docId}/pages`, {
        multipart: {
          file: { name: "tc-e2e-pagina.png", mimeType: "image/png", buffer: fs.readFileSync(PAGE_FILE) },
          pageNumber: "1",
        },
      });
      expect(up.ok(), `the page upload failed (${up.status()})`).toBeTruthy();
      const propId = await createProperty(page.request, {
        nickname: `${MARK} Teren de test`,
        corners: [
          { lat: 44.43, lon: 26.1 },
          { lat: 44.43, lon: 26.101 },
          { lat: 44.4293, lon: 26.101 },
          { lat: 44.4293, lon: 26.1 },
        ],
      });
      made.push({ kind: "property", id: propId });

      // Step 1 — the document: „Date generale", „Pagini", „Preț și taxe" ticked; „Pagini" at the right, top level with the row.
      await page.goto(`/documents/${docId}`);
      for (const name of ["Identificarea actului", "Pagini", "Preț și plată"]) await expect(tileBox(page, name)).toBeChecked({ timeout: 30_000 }); // #38.33
      await expect(page.locator('[data-tile="pages"]')).toBeVisible({ timeout: 30_000 });
      expect(await rowWidth(page)).toBe(1624);
      await atTheRight(page, "pages");
      const fees = await at(page, "tab:Preț și plată");
      expect(fees.y).toBe(0);
      expect(fees.x + 1).toBeLessThan((await at(page, "pages")).x);
      await photograph(page, "document");
      breakpoints.document = await narrowestBeside(page, "pages", 1380, 1500);
      await page.setViewportSize({ width: 1920, height: 1080 });

      // Step 2 — the property: four ticked, „Street View" not; „Hartă" at the right, „Puncte de contur" under it.
      await page.goto(`/properties/${propId}`);
      for (const name of ["Identificare cadastrală", "Puncte de contur", "Adresă", "Hartă"]) await expect(tileBox(page, name)).toBeChecked({ timeout: 30_000 });
      await expect(tileBox(page, "Street View")).not.toBeChecked();
      await expect(page.locator('[data-tile="map"]')).toBeVisible({ timeout: 30_000 });
      await atTheRight(page, "map");
      const map = await at(page, "map");
      const corners = await at(page, "corners");
      expect(Math.abs(corners.re)).toBeLessThanOrEqual(1);
      expect(corners.y).toBeGreaterThan(map.bottom);
      for (const t of ["cadastral", "address"]) {
        const p = await at(page, t);
        expect([t, p.y]).toEqual([t, 0]);
        expect(p.x).toBeLessThan(corners.x);
      }
      await photograph(page, "property");
      breakpoints.property = await narrowestBeside(page, "map", 1380, 1500);
      await page.setViewportSize({ width: 1920, height: 1080 });
      await settle(page);

      // Step 3 — „Street View" under „Puncte de contur", at the right.
      await showTile(page, "Street View");
      const sv = await at(page, "streetView");
      expect(Math.abs(sv.re)).toBeLessThanOrEqual(1);
      expect(sv.y).toBeGreaterThan((await at(page, "corners")).bottom);

      // Step 4 — „Hartă" unticked: „Puncte de contur" at the top of the column, „Street View" under it.
      await hideTile(page, "Hartă");
      await atTheRight(page, "corners");
      expect((await at(page, "streetView")).y).toBeGreaterThan((await at(page, "corners")).bottom);

      // Step 5 — „Puncte de contur" and „Street View" unticked: no column.
      await hideTile(page, "Puncte de contur");
      await hideTile(page, "Street View");
      expect(await columnShown(page)).toBe(false);
      expect((await at(page, "cadastral")).x).toBe(0);
      expect((await at(page, "address")).y).toBe(0);

      // Step 6 — „Hartă" and „Puncte de contur" again, at 1366: 968 px; the 3-unit column (#37.77)
      // beside „Date cadastrale", „Adresă" under it.
      await showTile(page, "Hartă");
      await showTile(page, "Puncte de contur");
      await page.setViewportSize({ width: 1366, height: 900 });
      await settle(page);
      expect(await rowWidth(page)).toBe(968);
      await expect.poll(async () => {
        const [cad, addr, m6, c6] = await Promise.all([at(page, "cadastral"), at(page, "address"), at(page, "map"), at(page, "corners")]);
        return {
          cadastral: [cad.x, cad.y],
          mapAtTheRight: Math.abs(m6.re) <= 1 && Math.abs(m6.y) <= 1,
          cornersUnderMap: Math.abs(c6.re) <= 1 && c6.y > m6.bottom,
          addressUnderCadastral: addr.x === 0 && addr.y > cad.bottom,
        };
      }, { timeout: 20_000 }).toEqual({ cadastral: [0, 0], mapAtTheRight: true, cornersUnderMap: true, addressUnderCadastral: true });
    } finally {
      fs.mkdirSync(SHOTS, { recursive: true });
      fs.writeFileSync(`${SHOTS}/breakpoints.json`, JSON.stringify(breakpoints, null, 2));
      for (const m of made) await removeRecord(page.request, m.kind, m.id);
    }
  });
});
