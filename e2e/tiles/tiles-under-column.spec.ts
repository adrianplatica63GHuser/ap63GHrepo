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
import { test, expect, type Locator, type Page } from "../helpers/test";
import { E2E_MARKER, createProperty, createSaleContract, removeLeftovers, removeRecord } from "../helpers/records";
import { hideTile, pressTileButton, showTile } from "../helpers/tiles";

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
  test("„Conexiuni” sub „Puncte de contur” rămâne după reîncărcare; „Street View” o împinge; „Clasificări” sub „Pagini”; „Implicit”", async ({ page }) => {
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
      const conn = await showTile(page, "Etichete și grupuri");
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

      // Step 3 — after a reload, where step 2 put it. Its place, not its bottom: „Etichete și grupuri" grows as its four
      // parts load (measured 142 px, then 387 — 40.35's run), and a place read before that is still the place.
      const at = async () => { const p = await place(page, conn); return { x: p.x, y: p.y }; };
      await page.reload();
      await expect.poll(at, { timeout: 30_000 }).toEqual({ x: c2.x, y: c2.y });

      // Step 4 — „Street View" pushes it under itself; unticked, it is back.
      await showTile(page, "Street View");
      // The tile's own section: once Google draws the panorama, its scene is a second region named „Street View" (#38.16, a strict-mode violation).
      const sv = page.locator('section[data-tile="streetView"]');
      await expect.poll(async () => {
        const [c, s, k, m] = await Promise.all([place(page, conn), place(page, sv), place(page, corners), place(page, map)]);
        return `gap ${c.y - s.b} — conn ${JSON.stringify(c)} sv ${JSON.stringify(s)} corners ${JSON.stringify(k)} map ${JSON.stringify(m)}`;
      }, { timeout: 20_000 }).toMatch(new RegExp(`^gap ${GAP} `));
      await hideTile(page, "Street View");
      await expect.poll(at, { timeout: 20_000 }).toEqual({ x: c2.x, y: c2.y });

      // Step 5 — at 1366 in the left area, the column beside it; at 1920 back under the column.
      await page.setViewportSize({ width: 1366, height: 1200 });
      await expect.poll(async () => (await place(page, conn)).x < (await place(page, map)).x, { timeout: 20_000 }).toBe(true);
      await page.setViewportSize({ width: 1920, height: 1200 });
      await expect.poll(at, { timeout: 20_000 }).toEqual({ x: c2.x, y: c2.y });

      // Step 6 — the document: „Clasificări" 40 px under „Pagini", on its left edge.
      await page.goto(`/documents/${docId}`);
      const pages = page.locator('[data-tile="pages"]');
      await expect(pages).toBeVisible({ timeout: 30_000 });
      const cls = await showTile(page, "Clasificare");
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
      await pressTileButton(page, "Implicit");
      await showTile(page, "Etichete și grupuri");
      await expect.poll(async () => (await place(page, conn)).y - (await place(page, cad)).b, { timeout: 20_000 }).toBe(GAP);
      expect((await place(page, conn)).x).toBe(k1.x);
      expect(await page.evaluate(() => localStorage.getItem("ga40-tile-positions-property-v1"))).toBeNull();
    } finally {
      await removeRecord(page.request, "document", docId);
      await removeRecord(page.request, "property", propId);
    }
  });

  // Slice 40.32 — steps 8–11: the right-hand tiles move. „Hartă" starts at the right edge, is dragged to the left
  // under every tile, stays there after a reload, and „Implicit" sends it back; „Pagini" on the document the same.
  // The Street View tile is not ticked here.
  test("„Hartă” și „Pagini” se mută ca orice fișă și rămân unde au fost lăsate; „Implicit” le pune înapoi", async ({ page }) => {
    test.slow();
    const M = `${MARK}-MOVE`;
    await removeLeftovers(page.request, M);
    await page.setViewportSize({ width: 1920, height: 1600 });
    const propId = await createProperty(page.request, {
      nickname: `${M} Teren`,
      corners: [{ lat: 44.43512, lon: 26.10234 }, { lat: 44.43561, lon: 26.10301 }, { lat: 44.43527, lon: 26.10372 }, { lat: 44.4347, lon: 26.10335 }],
    });
    const docId = await createSaleContract(page.request, `${M} Act`);
    const forget = () => page.evaluate(() => {
      for (const k of Object.keys(localStorage)) if (k.startsWith("ga40-tile-positions-")) localStorage.removeItem(k);
    });
    /** The row's right edge and the lowest bottom of every tile but the action bar, relative to the row. */
    const rowFacts = () => page.evaluate(() => {
      const row = document.querySelector<HTMLElement>("[data-tile-row]")!.getBoundingClientRect();
      const tiles = [...document.querySelectorAll<HTMLElement>("[data-tile-row] [data-packed-col]:not(.order-last)")];
      return { w: Math.round(row.width), lowest: Math.round(Math.max(...tiles.map((t) => t.getBoundingClientRect().bottom - row.top))) };
    });
    /** Drag `tile` to the row's left edge, 48 px under every tile; the outline's verdict. */
    const toTheLeft = async (tile: Locator) => {
      const row = (await page.locator("[data-tile-row]").boundingBox())!;
      const { lowest } = await rowFacts();
      return dragTo(page, tile, row.x, row.y + lowest + 48);
    };
    try {
      const up = await page.request.post(`/api/documents/${docId}/pages`, {
        multipart: { file: { name: "tc-e2e-pagina.png", mimeType: "image/png", buffer: fs.readFileSync(PAGE_FILE) }, pageNumber: "1" },
      });
      expect(up.ok(), `the page upload failed (${up.status()})`).toBeTruthy();

      // Step 8 — the property, nothing stored: „Hartă" against the row's right edge, at its top.
      await page.goto(`/properties/${propId}`);
      await forget();
      await page.reload();
      await expect(page.locator('[data-panel="corners"] tbody tr')).toHaveCount(4, { timeout: 30_000 });
      await page.waitForTimeout(2500); // past the first layout's settling
      const map = page.locator('[data-tile="map"]');
      const { w } = await rowFacts();
      const m8 = await place(page, map);
      expect(m8.y).toBe(0);
      expect(Math.abs(w - (m8.x + Math.round((await map.boundingBox())!.width)))).toBeLessThanOrEqual(1);

      // Step 9 — grabbed by its free space and dropped at the left, under every tile: free, and it stays.
      expect(await toTheLeft(map)).toBe("true");
      await expect.poll(async () => (await place(page, map)).x, { timeout: 10_000 }).toBe(0);
      const m9 = await place(page, map);
      expect(m9.y).toBeGreaterThan(m8.y);
      // Stored under its box's id — the map is a panel in a `display: contents` tile, so „map#0".
      expect(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("ga40-tile-positions-property-v1") ?? "{}")).some((k) => k === "map" || k.startsWith("map#")))).toBe(true);

      // Step 10 — after a reload, where step 9 left it; „Implicit" sends it back to the right edge.
      await page.reload();
      await expect(page.locator('[data-panel="corners"] tbody tr')).toHaveCount(4, { timeout: 30_000 });
      await expect.poll(async () => place(page, map), { timeout: 30_000 }).toEqual(m9);
      await pressTileButton(page, "Implicit");
      await expect.poll(async () => (await place(page, map)).y, { timeout: 20_000 }).toBe(0);
      expect((await place(page, map)).x).toBe(m8.x);

      // Step 11 — the document: „Pagini" at the right edge, dragged to the left, kept after a reload.
      await page.goto(`/documents/${docId}`);
      const pages = page.locator('[data-tile="pages"]');
      await expect(pages).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(2500);
      const p11 = await place(page, pages);
      expect(p11.y).toBe(0);
      expect(await toTheLeft(pages)).toBe("true");
      await expect.poll(async () => (await place(page, pages)).x, { timeout: 10_000 }).toBe(0);
      const p11b = await place(page, pages);
      await page.reload();
      await expect(pages).toBeVisible({ timeout: 30_000 });
      await expect.poll(async () => place(page, pages), { timeout: 30_000 }).toEqual(p11b);
    } finally {
      await forget().catch(() => undefined);
      await removeRecord(page.request, "document", docId);
      await removeRecord(page.request, "property", propId);
    }
  });
});

