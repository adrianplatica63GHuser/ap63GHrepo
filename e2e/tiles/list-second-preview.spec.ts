/**
 * Case:   TC-TILES-19 — Lângă o listă, previzualizarea unui rând stă în coloana lui, de 40 rem; celelalte rânduri așteaptă
 * Source: docs/testing/cases/TC-TILES-19.md, „Last green" 2026-10-05
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The properties carry `TC-E2E-TILES-19` (records.ts).
 *   - This test's browser context is new, so „Câmpuri afișate" is the list's
 *     default, as the case asks.
 *   - Playwright's mouse presses the eyes; the hand run did by script (FU-290).
 *   - The pictures, not steps of the case: the list with A's preview at 1920
 *     and 1366 px, into `playwright-report/list-second-preview/`.
 *   - Slice #39.04 rewrote steps 2–5: one row at a time, its preview at the top of
 *     the row tiles' column beside the WHOLE list, 40 rem; #38.05/#38.71's „a second
 *     preview under the first" and „a third replaces the oldest" are gone.
 */

import { test, expect, type Locator, type Page } from "../helpers/test";
import { E2E_MARKER, createProperty, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}TILES-19`;
const A = `${MARK} Teren A`;
const B = `${MARK} Teren B`;
const C = `${MARK} Teren C`;
const SHOTS = "playwright-report/list-second-preview";

type Box = { left: number; top: number; right: number; bottom: number };
const box = (l: Locator): Promise<Box> =>
  l.evaluate((e) => {
    const r = e.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  });
const near = (a: number, b: number) => Math.abs(a - b) <= 2;

function previewOf(page: Page, name: string): Locator {
  return page.locator("[data-preview]").filter({ has: page.locator("h2", { hasText: name }) });
}

test.describe("TC-TILES-19 — previzualizarea unui rând, în coloana lui", () => {
  test("la 1920 lângă listă, sus, de 40 rem; celelalte rânduri așteaptă; la 1366 sub listă, tot de 40 rem", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    const ids = [
      await createProperty(page.request, { nickname: A }),
      await createProperty(page.request, { nickname: B }),
      await createProperty(page.request, { nickname: C }),
    ];
    try {
      // Step 1 — 1920 × 1080; „Proprietăți", the search: the three rows.
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto("/properties");
      const main = page.locator("main");
      const search = main.getByPlaceholder("caută după Cod, Poreclă, Nr. cadastru, Nr. CF, Tarla/Solă sau Parcelă");
      await expect(search).toBeVisible({ timeout: 30_000 });
      await search.fill(MARK);
      const rows = main.locator("[data-list-edge] tbody tr");
      await expect(rows).toHaveCount(3, { timeout: 30_000 });
      const list = main.locator("[data-list-body]");
      const magnifier = (name: string) => rows.filter({ hasText: name }).getByRole("button", { name: "Previzualizare", exact: true });
      // 40.98: the row tiles' column is PAGES_PANEL_REM, 5 units of 119 px (40rem before).
      const rem40 = await page.evaluate(() => 41.1875 * parseFloat(getComputedStyle(document.documentElement).fontSize));

      // Step 2 — (#39.04) A's preview in the row tiles' column at the list's right, its top level with the list's
      // top (the toolbar's), 40 rem wide. It read: „at the table's right, its top level with the table's top".
      await magnifier(A).click();
      await expect(previewOf(page, A)).toBeVisible({ timeout: 30_000 });
      const l = await box(list);
      const a = await box(previewOf(page, A));
      expect(a.left).toBeGreaterThanOrEqual(l.right);
      expect(near(a.top, l.top), `A's top ${a.top} level with the list's ${l.top}`).toBe(true);
      expect(Math.abs(a.right - a.left - rem40), "A's width, 41.1875 rem").toBeLessThanOrEqual(2);
      await expect(magnifier(A)).toHaveAttribute("aria-pressed", "true");

      // Step 3 — (#39.04) the other rows wait: B's and C's magnifiers disabled. It read: „B's preview under A's".
      for (const other of [B, C]) await expect(magnifier(other)).toBeDisabled();
      await page.screenshot({ path: `${SHOTS}/properties-row-preview-1920.png`, fullPage: true });

      // Step 4 — 1366 × 900: the list and the column do not fit side by side, so the column stands under the list,
      // still 40 rem; the page does not scroll sideways.
      await page.setViewportSize({ width: 1366, height: 900 });
      await page.waitForTimeout(300);
      const l4 = await box(list);
      const a4 = await box(previewOf(page, A));
      expect(a4.top).toBeGreaterThan(l4.bottom);
      expect(Math.abs(a4.right - a4.left - rem40), "A's width at 1366, 41.1875 rem").toBeLessThanOrEqual(2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await page.screenshot({ path: `${SHOTS}/properties-row-preview-1366.png`, fullPage: true });

      // Step 5 — A's magnifier again: the preview closes and every row is free; B's then opens B's.
      // (#38.71's step 5 read: „C's preview opens and A's closes — at most two".)
      await magnifier(A).click();
      await expect(previewOf(page, A)).toHaveCount(0);
      for (const name of [A, B, C]) await expect(magnifier(name)).toBeEnabled();
      await magnifier(B).click();
      await expect(previewOf(page, B)).toBeVisible({ timeout: 30_000 });
      await expect(magnifier(A)).toBeDisabled();
    } finally {
      for (const id of ids) await removeRecord(page.request, "property", id);
    }
  });
});
