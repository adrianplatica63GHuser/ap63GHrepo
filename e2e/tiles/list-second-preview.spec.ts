/**
 * Case:   TC-TILES-19 — Lângă o listă, a doua previzualizare se deschide sub prima, nu sub listă
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
 *   - Slice #38.05's pictures, not steps of the case: the list with two
 *     previews at 1920 and 1366 px, into `playwright-report/list-second-preview/`.
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
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

test.describe("TC-TILES-19 — a doua previzualizare sub prima", () => {
  test("la 1920 sub prima, lângă tabel; la 1366 amândouă sub tabel, una sub alta", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    const ids = [
      await createProperty(page.request, { nickname: A }),
      await createProperty(page.request, { nickname: B }),
      await createProperty(page.request, { nickname: C }),
    ];
    try {
      // Step 1 — 1920 × 1080; „Proprietăți", the search: the two rows.
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto("/properties");
      const main = page.locator("main");
      const search = main.getByPlaceholder("caută după cod, poreclă, nr. cadastru, carte funciară, tarla sau parcelă");
      await expect(search).toBeVisible({ timeout: 30_000 });
      await search.fill(MARK);
      const rows = main.locator("tbody tr");
      await expect(rows).toHaveCount(3, { timeout: 30_000 });
      const table = main.locator("[data-list-previews] table").first();

      // Step 2 — A's preview at the table's right, level with its top.
      await rows.filter({ hasText: A }).getByRole("button", { name: "Previzualizare", exact: true }).click();
      await expect(previewOf(page, A)).toBeVisible({ timeout: 30_000 });
      const t = await box(table);
      const a = await box(previewOf(page, A));
      expect(a.left).toBeGreaterThanOrEqual(t.right);
      expect(near(a.top, t.top), `A's top ${a.top} level with the table's ${t.top}`).toBe(true);

      // Step 3 — B's under A's: the same left edge, just under; both right of the table; nothing under the table.
      await rows.filter({ hasText: B }).getByRole("button", { name: "Previzualizare", exact: true }).click();
      await expect(previewOf(page, B)).toBeVisible({ timeout: 30_000 });
      const b = await box(previewOf(page, B));
      const a2 = await box(previewOf(page, A));
      expect(near(b.left, a2.left), `B's left ${b.left} = A's ${a2.left}`).toBe(true);
      expect(near(b.top, a2.bottom + 16), `B's top ${b.top} just under A's bottom ${a2.bottom}`).toBe(true);
      expect(b.left).toBeGreaterThanOrEqual(t.right);
      await page.screenshot({ path: `${SHOTS}/properties-two-previews-1920.png`, fullPage: true });

      // Step 4 — 1366 × 900: both below the table, B under A, the same left edge; no sideways scroll.
      await page.setViewportSize({ width: 1366, height: 900 });
      await page.waitForTimeout(300);
      const t4 = await box(table);
      const a4 = await box(previewOf(page, A));
      const b4 = await box(previewOf(page, B));
      expect(a4.top).toBeGreaterThan(t4.bottom);
      expect(near(b4.left, a4.left)).toBe(true);
      expect(near(b4.top, a4.bottom + 16)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await page.screenshot({ path: `${SHOTS}/properties-two-previews-1366.png`, fullPage: true });

      // Step 5 — (#38.71) C's magnifier: a third preview replaces the oldest, A's, and A's magnifier is released.
      const magnifier = (name: string) => rows.filter({ hasText: name }).getByRole("button", { name: "Previzualizare", exact: true });
      await magnifier(C).click();
      await expect(previewOf(page, C)).toBeVisible({ timeout: 30_000 });
      await expect(previewOf(page, A)).toHaveCount(0);
      await expect(magnifier(A)).toHaveAttribute("aria-pressed", "false");
      await expect(magnifier(B)).toHaveAttribute("aria-pressed", "true");
      await expect(magnifier(C)).toHaveAttribute("aria-pressed", "true");
    } finally {
      for (const id of ids) await removeRecord(page.request, "property", id);
    }
  });
});
