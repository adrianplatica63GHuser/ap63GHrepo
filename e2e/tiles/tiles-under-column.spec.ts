/**
 * Case:   TC-TILES-15 — O fișă trasă în spațiul liber de sub coloana din dreapta rămâne acolo; coloana nu se mișcă
 * Source: docs/testing/cases/TC-TILES-15.md, „Last green" 2026-10-04
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-TILES-15` (records.ts); the page is
 *     `e2e/fixtures/tc-e2e-pagina.png`, sent as „Pagini" sends it.
 *   - A fresh browser context has no stored choice: „Conexiuni" is ticked here.
 *   - Playwright's mouse drags; the hand run dispatched the pointer events,
 *     because the pane's emulated viewport drops real clicks (FU-290).
 */

import fs from "node:fs";
import path from "node:path";
import { test, expect, type Locator, type Page } from "@playwright/test";
import { E2E_MARKER, createProperty, createSaleContract, removeLeftovers, removeRecord } from "../helpers/records";
import { hideTile, showTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}TILES-15`;
const PAGE_FILE = path.join(process.cwd(), "e2e", "fixtures", "tc-e2e-pagina.png");
const GAP = 16;

type Box = { x: number; y: number; b: number };

/** A box's place relative to the tile row. */
async function place(page: Page, l: Locator): Promise<Box> {
  const [row, r] = await Promise.all([page.locator("[data-tile-row]").boundingBox(), l.boundingBox()]);
  if (!row || !r) throw new Error("not on the page");
  return { x: Math.round(r.x - row.x), y: Math.round(r.y - row.y), b: Math.round(r.y + r.height - row.y) };
}

/** Drag `tile` by its padding until its top-left corner is at `x`, `y` (page px); the outline's verdict. */
async function dragTo(page: Page, tile: Locator, x: number, y: number): Promise<string | null> {
  const r = await tile.boundingBox();
  if (!r) throw new Error("not on the page");
  await page.mouse.move(r.x + 5, r.y + 5);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(r.x + 5 + ((x - r.x) * i) / 12, r.y + 5 + ((y - r.y) * i) / 12);
  const free = await page.locator("[data-tile-outline]").getAttribute("data-free");
  await page.mouse.up();
  return free;
}

test.describe("TC-TILES-15 — sub coloana din dreapta", () => {
  test("„Conexiuni” sub „Puncte de contur” rămâne după reîncărcare; „Street View” o împinge; „Clasificare subiectivă” sub „Pagini”; „Implicit”", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1920, height: 1200 });
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

      // Step 1 — the property: the column at the right, „Conexiuni" under „Date cadastrale".
      await page.goto(`/properties/${propId}`);
      await expect(page.locator('[data-panel="corners"] tbody tr')).toHaveCount(4, { timeout: 30_000 });
      const conn = await showTile(page, "Conexiuni");
      const map = page.locator('[data-tile="map"]');
      const corners = page.locator('[data-tile="corners"]');
      const cad = page.locator('[data-tile="cadastral"]');
      await expect.poll(async () => (await place(page, conn)).y - (await place(page, cad)).b, { timeout: 20_000 }).toBe(GAP);
      const [m1, c1, k1] = await Promise.all([place(page, map), place(page, corners), place(page, cad)]);
      expect((await place(page, conn)).x).toBe(k1.x);

      // Step 2 — dragged 60 px under „Puncte de contur", on its left edge: free, and it stays; nothing else moves.
      const cBox = (await corners.boundingBox())!;
      expect(await dragTo(page, conn, cBox.x, cBox.y + cBox.height + 60)).toBe("true");
      const c2 = await place(page, conn);
      expect(c2.x).toBe(c1.x);
      expect(c2.y - c1.b).toBeGreaterThanOrEqual(GAP);
      expect([await place(page, map), await place(page, corners), await place(page, cad)]).toEqual([m1, c1, k1]);

      // Step 3 — after a reload, where step 2 put it.
      await page.reload();
      await expect.poll(async () => place(page, conn), { timeout: 30_000 }).toEqual(c2);

      // Step 4 — „Street View" pushes it under itself; unticked, it is back.
      const sv = await showTile(page, "Street View");
      await expect.poll(async () => (await place(page, conn)).y - (await place(page, sv)).b, { timeout: 20_000 }).toBe(GAP);
      await hideTile(page, "Street View");
      await expect.poll(async () => place(page, conn), { timeout: 20_000 }).toEqual(c2);

      // Step 5 — at 1366 in the left area, the column beside it; at 1920 back under the column.
      await page.setViewportSize({ width: 1366, height: 1200 });
      await expect.poll(async () => (await place(page, conn)).x < (await place(page, map)).x, { timeout: 20_000 }).toBe(true);
      await page.setViewportSize({ width: 1920, height: 1200 });
      await expect.poll(async () => place(page, conn), { timeout: 20_000 }).toEqual(c2);

      // Step 6 — the document: „Clasificare subiectivă" 40 px under „Pagini", on its left edge.
      await page.goto(`/documents/${docId}`);
      const pages = page.locator('[data-tile="pages"]');
      await expect(pages).toBeVisible({ timeout: 30_000 });
      const cls = await showTile(page, "Clasificare subiectivă");
      await page.waitForTimeout(1500);
      const p1 = await place(page, pages);
      const pBox = (await pages.boundingBox())!;
      expect(await dragTo(page, cls, pBox.x, pBox.y + pBox.height + 40)).toBe("true");
      const k6 = await place(page, cls);
      expect(k6.x).toBe(p1.x);
      expect(k6.y - p1.b).toBeGreaterThanOrEqual(GAP);
      expect(await place(page, pages)).toEqual(p1);

      // Step 7 — the property: „Implicit", then „Conexiuni": under „Date cadastrale", nothing stored.
      await page.goto(`/properties/${propId}`);
      await expect(page.locator('[data-panel="corners"] tbody tr')).toHaveCount(4, { timeout: 30_000 });
      await page.getByRole("button", { name: "Implicit", exact: true }).click();
      await showTile(page, "Conexiuni");
      await expect.poll(async () => (await place(page, conn)).y - (await place(page, cad)).b, { timeout: 20_000 }).toBe(GAP);
      expect((await place(page, conn)).x).toBe(k1.x);
      expect(await page.evaluate(() => localStorage.getItem("ga40-tile-positions-property-v1"))).toBeNull();
    } finally {
      await removeRecord(page.request, "document", docId);
      await removeRecord(page.request, "property", propId);
    }
  });
});
