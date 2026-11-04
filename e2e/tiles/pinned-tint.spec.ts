/**
 * Case:   TC-TILES-14 — Fișele care nu se mută sunt mov deschis: harta, colțurile, Street View, paginile
 * Source: docs/testing/cases/TC-TILES-14.md, „Last green" 2026-10-08
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-TILES-14` (records.ts); the page is
 *     `e2e/fixtures/tc-e2e-pagina.png`, sent as „Pagini" sends it.
 *   - A fresh browser context has no stored choice, so nothing is set aside.
 */

import fs from "node:fs";
import path from "node:path";
import { test, expect, type Locator, type Page } from "../helpers/test";
import { E2E_MARKER, createProperty, createSaleContract, removeLeftovers, removeRecord } from "../helpers/records";
import { showTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}TILES-14`;
const PAGE_FILE = path.join(process.cwd(), "e2e", "fixtures", "tc-e2e-pagina.png");
// Slice 41.68 switched the colours round to follow the kinds (tile-surface.ts SCREEN_HUES): a property's right tiles
// are green, a document's „Pagini" blue, „Legături" the card. This spec read them purple, purple and green.
const GREEN = "rgb(221, 240, 225) / rgb(175, 213, 183)";
const BLUE = "rgb(223, 240, 251) / rgb(169, 207, 230)";
const CARD = "rgb(238, 244, 250) / rgb(198, 212, 232)";
// Slice #37.88: „Clasificări" is the yellow group's, „Corelate" the green one's (TC-TILES-18).
// 41.82: salmon #FFB48F / rim #E39A74 on the record screens (it read "rgb(248, 243, 229) / rgb(221, 211, 174)").
const META = "rgb(255, 180, 143) / rgb(227, 154, 116)";

/** „Its colour": the computed background and top border colour. */
const colour = (l: Locator) =>
  l.evaluate((e) => `${getComputedStyle(e).backgroundColor} / ${getComputedStyle(e).borderTopColor}`);

/** 2026-11-04: the column beside the cadastral tile — „Hartă" top level with the row, right of „Identificare cadastrală". */
const columnBeside = (page: Page) =>
  page.evaluate(() => {
    const row = document.querySelector<HTMLElement>("[data-tile-row]")?.getBoundingClientRect();
    const map = document.querySelector<HTMLElement>('[data-panel="map"]')?.getBoundingClientRect();
    const cad = document.querySelector<HTMLElement>('[data-panel="cadastral"]')?.getBoundingClientRect();
    return !!row && !!map && !!cad && Math.abs(map.top - row.top) <= 1 && map.left >= cad.right - 1;
  });

test.describe("TC-TILES-14 — fișele care nu se mută sunt mov deschis", () => {
  test("harta, colțurile și Street View mov, la 1920 și sub formular la 1366; „Pagini” mov; celelalte ca până acum", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1920, height: 1080 });
    const propId = await createProperty(page.request, {
      nickname: `${MARK} Teren`,
      corners: [{ lat: 44.43512, lon: 26.10234 }, { lat: 44.43561, lon: 26.10301 }, { lat: 44.43527, lon: 26.10372 }, { lat: 44.4347, lon: 26.10335 }],
    });
    const docId = await createSaleContract(page.request, `${MARK} Act`);
    try {
      const up = await page.request.post(`/api/documents/${docId}/pages`, {
        multipart: { file: { name: "tc-e2e-pagina.png", mimeType: "image/png", buffer: fs.readFileSync(PAGE_FILE) }, pageNumber: "1" },
      });
      expect(up.ok(), `the page upload failed (${up.status()})`).toBeTruthy();

      // Step 1 — the property, „Street View" and „Clasificări" ticked.
      await page.goto(`/properties/${propId}`);
      await expect(page.locator('[data-panel="corners"] tbody tr')).toHaveCount(4, { timeout: 30_000 });
      await showTile(page, "Street View");
      const cls = await showTile(page, "Clasificare");
      const right = ["map", "corners", "street-view"].map((p) => page.locator(`[data-panel="${p}"]`));
      for (const t of right) await expect.poll(() => colour(t), { timeout: 20_000 }).toBe(GREEN);
      for (const t of [page.locator('[data-panel="cadastral"]'), page.locator('[data-panel="address"]')]) expect(await colour(t)).toBe(CARD);
      expect(await colour(cls)).toBe(META);
      expect(await page.locator('[data-panel="map"] [data-width-field="map"]').evaluate((e) => getComputedStyle(e).borderTopColor)).toBe("rgb(198, 212, 232)");
      expect(await page.locator('[data-panel="corners"] table').evaluate((t) => getComputedStyle(t.parentElement!).backgroundColor)).toBe("rgb(255, 255, 255)");

      // Step 2 — „Corelate", 1366: still green (41.68; it read purple). 2026-11-04: the column stands BESIDE
      // „Identificare cadastrală", top level with the row — at 1366 the row is 8 units of 119 px since 40.98, room for
      // the 4-unit cadastral tile and the 4-unit column (TC-TILES-07 step 6). It read `columnUnderLeft(page)` true.
      const related = await showTile(page, "Legături");
      await page.setViewportSize({ width: 1366, height: 1080 });
      await expect.poll(() => columnBeside(page), { timeout: 20_000 }).toBe(true);
      for (const t of right) expect(await colour(t)).toBe(GREEN);
      expect(await colour(related)).toBe(CARD);

      // Step 3 — the document at 1920: „Pagini" blue (41.68; it read purple), „Date generale" and „Preț și taxe" the card's.
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto(`/documents/${docId}`);
      const pages = page.getByRole("region", { name: "Pagini", exact: true });
      await expect(pages).toBeVisible({ timeout: 30_000 });
      await expect.poll(() => colour(pages), { timeout: 20_000 }).toBe(BLUE);
      expect(await colour(page.locator('[data-panel="general"]'))).toBe(CARD);
      expect(await colour(page.getByRole("region", { name: "Preț și plată", exact: true }))).toBe(CARD);
    } finally {
      await removeRecord(page.request, "document", docId);
      await removeRecord(page.request, "property", propId);
    }
  });
});
