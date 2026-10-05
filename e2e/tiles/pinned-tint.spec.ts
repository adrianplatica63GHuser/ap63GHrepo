/**
 * Case:   TC-TILES-14 — Fișele care nu se mută sunt mov deschis: harta, colțurile, Street View, paginile
 * Source: docs/testing/cases/TC-TILES-14.md, „Last green" 2026-10-04
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
import { test, expect, type Locator, type Page } from "@playwright/test";
import { E2E_MARKER, createProperty, createSaleContract, removeLeftovers, removeRecord } from "../helpers/records";
import { showTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}TILES-14`;
const PAGE_FILE = path.join(process.cwd(), "e2e", "fixtures", "tc-e2e-pagina.png");
const PINNED = "rgb(246, 240, 254) / rgb(218, 203, 238)";
const CARD = "rgb(238, 244, 250) / rgb(198, 212, 232)";
// Slice #37.88: „Clasificări" is the yellow group's, „Corelate" the green one's (TC-TILES-18).
const META = "rgb(248, 243, 229) / rgb(221, 211, 174)";
const RELATED = "rgb(235, 247, 237) / rgb(187, 221, 194)";

/** „Its colour": the computed background and top border colour. */
const colour = (l: Locator) =>
  l.evaluate((e) => `${getComputedStyle(e).backgroundColor} / ${getComputedStyle(e).borderTopColor}`);

const columnUnderLeft = (page: Page) =>
  page.evaluate(() => {
    const l = document.querySelector('[data-tile-area="left"]')!.getBoundingClientRect();
    const r = document.querySelector('[data-tile-area="right"]')!.getBoundingClientRect();
    return r.top >= l.bottom - 1;
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
      const cls = await showTile(page, "Clasificări");
      const right = ["map", "corners", "street-view"].map((p) => page.locator(`[data-panel="${p}"]`));
      for (const t of right) await expect.poll(() => colour(t), { timeout: 20_000 }).toBe(PINNED);
      for (const t of [page.locator('[data-panel="cadastral"]'), page.locator('[data-panel="address"]')]) expect(await colour(t)).toBe(CARD);
      expect(await colour(cls)).toBe(META);
      expect(await page.locator('[data-panel="map"] [data-width-field="map"]').evaluate((e) => getComputedStyle(e).borderTopColor)).toBe("rgb(198, 212, 232)");
      expect(await page.locator('[data-panel="corners"] table').evaluate((t) => getComputedStyle(t.parentElement!).backgroundColor)).toBe("rgb(255, 255, 255)");

      // Step 2 — „Corelate", 1366: the column under the left area, still purple.
      const related = await showTile(page, "Corelate");
      await page.setViewportSize({ width: 1366, height: 1080 });
      await expect.poll(() => columnUnderLeft(page), { timeout: 20_000 }).toBe(true);
      for (const t of right) expect(await colour(t)).toBe(PINNED);
      expect(await colour(related)).toBe(RELATED);

      // Step 3 — the document at 1920: „Pagini" purple, „Date generale" and „Preț și taxe" the card's.
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto(`/documents/${docId}`);
      const pages = page.getByRole("region", { name: "Pagini", exact: true });
      await expect(pages).toBeVisible({ timeout: 30_000 });
      await expect.poll(() => colour(pages), { timeout: 20_000 }).toBe(PINNED);
      expect(await colour(page.locator('[data-panel="general"]'))).toBe(CARD);
      expect(await colour(page.getByRole("region", { name: "Preț și taxe", exact: true }))).toBe(CARD);
    } finally {
      await removeRecord(page.request, "document", docId);
      await removeRecord(page.request, "property", propId);
    }
  });
});
